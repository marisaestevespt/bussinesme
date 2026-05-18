import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, ChevronRight, CheckCircle2, Loader2, Wand2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { fetchPaymentMethods, buildPaymentMethodOptions } from '@/lib/paymentMethods';

type GapRow = {
  key: string;
  label: string;
  desc: string;
  count: number;
  link: string | null;
  linkLabel: string;
  bulk?: 'entregas-role' | 'vendas-vendedor' | 'despesas-metodo';
};

async function fetchGaps(): Promise<GapRow[]> {
  // Cada query devolve apenas a contagem (head:true) para ser eficiente.
  const queries = await Promise.all([
    supabase.from('project_deliverables').select('id', { count: 'exact', head: true })
      .eq('responsible_type', 'equipa').is('responsible_role', null).is('assigned_to', null),
    supabase.from('commercial_sales').select('id', { count: 'exact', head: true }).is('assigned_to', null),
    supabase.from('financial_expenses').select('id', { count: 'exact', head: true })
      .or('payment_method.is.null,payment_method.eq.').eq('is_recurring', false),
    supabase.from('clients').select('id', { count: 'exact', head: true }),
    supabase.from('client_assignments').select('client_id'),
    supabase.from('projects').select('id', { count: 'exact', head: true })
      .is('deadline', null).not('status', 'in', '("concluido","cancelado","arquivo")'),
    supabase.from('products').select('id', { count: 'exact', head: true }).or('base_price.is.null,base_price.eq.0'),
    supabase.from('suppliers').select('id', { count: 'exact', head: true }).or('nif.is.null,nif.eq.'),
  ]);

  const totalClients = queries[3].count ?? 0;
  const assignedClientIds = new Set((queries[4].data ?? []).map((r: any) => r.client_id));
  const clientsSemResp = Math.max(totalClients - assignedClientIds.size, 0);

  return [
    {
      key: 'entregas-equipa-sem-role',
      label: 'Entregas da equipa sem função atribuída',
      desc: 'Entregas marcadas como responsabilidade da equipa mas sem função/role indicada.',
      count: queries[0].count ?? 0,
      link: '/hub/projetos',
      linkLabel: 'Abrir Projetos',
      bulk: 'entregas-role',
    },
    {
      key: 'vendas-sem-vendedor',
      label: 'Vendas sem vendedor',
      desc: 'Vendas que não têm o membro responsável atribuído.',
      count: queries[1].count ?? 0,
      link: '/hub/comercial?tab=vendas',
      linkLabel: 'Abrir Vendas',
      bulk: 'vendas-vendedor',
    },
    {
      key: 'despesas-sem-metodo',
      label: 'Despesas sem método de pagamento',
      desc: 'Despesas reais (não regras) sem método de pagamento indicado.',
      count: queries[2].count ?? 0,
      link: '/hub/financeiro?tab=saidas',
      linkLabel: 'Abrir Despesas',
      bulk: 'despesas-metodo',
    },
    {
      key: 'clientes-sem-responsavel',
      label: 'Clientes sem responsável atribuído',
      desc: 'Clientes sem nenhum membro da equipa atribuído como responsável.',
      count: clientsSemResp,
      link: '/hub/clientes',
      linkLabel: 'Abrir Clientes',
    },
    {
      key: 'projetos-sem-deadline',
      label: 'Projetos ativos sem deadline',
      desc: 'Projetos não concluídos sem data de entrega definida.',
      count: queries[5].count ?? 0,
      link: '/hub/projetos',
      linkLabel: 'Abrir Projetos',
    },
    {
      key: 'produtos-sem-preco',
      label: 'Produtos sem preço base',
      desc: 'Produtos com preço base ausente ou zero.',
      count: queries[6].count ?? 0,
      link: '/hub/produtos',
      linkLabel: 'Abrir Produtos',
    },
    {
      key: 'fornecedores-sem-nif',
      label: 'Fornecedores sem NIF',
      desc: 'Fornecedores ativos sem número fiscal registado.',
      count: queries[7].count ?? 0,
      link: '/hub/financeiro/fornecedores',
      linkLabel: 'Abrir Fornecedores',
    },
  ];
}

export function SettingsBackfill() {
  const qc = useQueryClient();
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['admin-backfill-gaps'],
    queryFn: fetchGaps,
    staleTime: 60_000,
  });
  const [bulkOpen, setBulkOpen] = useState<null | GapRow>(null);

  const gaps = (data ?? []).filter(g => g.count > 0);
  const total = gaps.reduce((s, g) => s + g.count, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">Pendentes de preenchimento</h3>
          <p className="text-xs text-muted-foreground">
            {isLoading
              ? 'A verificar registos incompletos…'
              : total > 0
                ? `${total} registos incompletos em ${gaps.length} categorias.`
                : 'Todos os registos críticos estão preenchidos.'}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Atualizar'}
        </Button>
      </div>

      {isLoading ? (
        <Card><CardContent className="p-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> A carregar…
        </CardContent></Card>
      ) : gaps.length === 0 ? (
        <Card><CardContent className="p-6 flex items-center gap-2 text-sm text-foreground">
          <CheckCircle2 className="h-5 w-5 text-success" />
          Está tudo limpo. Nenhum registo crítico em falta.
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {gaps.map(g => (
            <Card key={g.key}>
              <CardContent className="p-4 flex items-center justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <AlertCircle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{g.label}</span>
                      <Badge variant="secondary" className="text-[10px]">{g.count}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{g.desc}</p>
                  </div>
                </div>
                {g.link && (
                  <div className="flex items-center gap-2 shrink-0">
                    {g.bulk && (
                      <Button variant="default" size="sm" className="gap-1" onClick={() => setBulkOpen(g)}>
                        <Wand2 className="h-3.5 w-3.5" /> Resolver em massa
                      </Button>
                    )}
                    <Button asChild variant="outline" size="sm" className="gap-1">
                      <Link to={g.link}>{g.linkLabel} <ChevronRight className="h-3.5 w-3.5" /></Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <BulkFixDialog
        gap={bulkOpen}
        onClose={() => setBulkOpen(null)}
        onDone={() => { qc.invalidateQueries({ queryKey: ['admin-backfill-gaps'] }); setBulkOpen(null); }}
      />
    </div>
  );
}

// ──────────────────────────────────────────────
// Bulk fix dialog
// ──────────────────────────────────────────────
function BulkFixDialog({ gap, onClose, onDone }: { gap: GapRow | null; onClose: () => void; onDone: () => void }) {
  const [value, setValue] = useState<string>('');
  const [saving, setSaving] = useState(false);

  const rolesQ = useQuery({
    queryKey: ['bulk-roles'],
    enabled: gap?.bulk === 'entregas-role',
    queryFn: async () => {
      const { data } = await supabase.from('custom_roles').select('id, name').order('name');
      return (data || []).filter((r: any) => !r.name.startsWith('dept_')) as { id: string; name: string }[];
    },
  });

  const sellersQ = useQuery({
    queryKey: ['bulk-sellers'],
    enabled: gap?.bulk === 'vendas-vendedor',
    queryFn: async () => {
      const { data } = await supabase
        .from('team_members')
        .select('profile_id, full_name')
        .eq('status', 'ativo')
        .not('profile_id', 'is', null)
        .order('full_name');
      return (data || []) as { profile_id: string; full_name: string }[];
    },
  });

  const methodsQ = useQuery({
    queryKey: ['bulk-payment-methods'],
    enabled: gap?.bulk === 'despesas-metodo',
    queryFn: async () => buildPaymentMethodOptions(await fetchPaymentMethods()),
  });

  if (!gap || !gap.bulk) return null;

  const handleApply = async () => {
    if (!value) {
      toast.error('Escolhe um valor antes de aplicar.');
      return;
    }
    setSaving(true);
    try {
      let affected = 0;
      if (gap.bulk === 'entregas-role') {
        // Apply role to project_deliverables AND product_deliverable_templates with equipa+no role
        const { data, error } = await supabase
          .from('project_deliverables')
          .update({ responsible_role: value })
          .eq('responsible_type', 'equipa')
          .is('responsible_role', null)
          .is('assigned_to', null)
          .select('id');
        if (error) throw error;
        affected += data?.length || 0;
        // Optional: also fix templates so future projects inherit it
        const { data: t } = await supabase
          .from('product_deliverable_templates')
          .update({ responsible_role: value })
          .eq('responsible_type', 'equipa')
          .is('responsible_role', null)
          .select('id');
        affected += t?.length || 0;
      } else if (gap.bulk === 'vendas-vendedor') {
        const { data, error } = await supabase
          .from('commercial_sales')
          .update({ assigned_to: value })
          .is('assigned_to', null)
          .select('id');
        if (error) throw error;
        affected = data?.length || 0;
      } else if (gap.bulk === 'despesas-metodo') {
        const { data, error } = await supabase
          .from('financial_expenses')
          .update({ payment_method: value })
          .or('payment_method.is.null,payment_method.eq.')
          .eq('is_recurring', false)
          .select('id');
        if (error) throw error;
        affected = data?.length || 0;
      }
      toast.success(`Atualizados ${affected} registos.`);
      setValue('');
      onDone();
    } catch (e: any) {
      toast.error(`Erro: ${e?.message || 'falha ao aplicar'}`);
    } finally {
      setSaving(false);
    }
  };

  const options =
    gap.bulk === 'entregas-role'
      ? (rolesQ.data || []).map(r => ({ value: r.name, label: `Equipa · ${r.name}` }))
      : gap.bulk === 'vendas-vendedor'
        ? (sellersQ.data || []).map(s => ({ value: s.profile_id, label: s.full_name }))
        : (methodsQ.data || []);

  const labelForField =
    gap.bulk === 'entregas-role' ? 'Função responsável (role)' :
    gap.bulk === 'vendas-vendedor' ? 'Vendedor a atribuir' :
    'Método de pagamento';

  return (
    <Dialog open={!!gap} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Resolver em massa — {gap.label}</DialogTitle>
          <DialogDescription>
            Vais atualizar <strong>{gap.count}</strong> registos de uma só vez.
            Esta ação aplica o mesmo valor a todos os registos em falta.
            {gap.bulk === 'entregas-role' && ' Também atualiza os templates de entrega correspondentes para evitar que novos projetos voltem a ficar incompletos.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{labelForField}</label>
          <Select value={value} onValueChange={setValue}>
            <SelectTrigger><SelectValue placeholder="Seleciona…" /></SelectTrigger>
            <SelectContent>
              {options.length === 0 ? (
                <SelectItem value="__none__" disabled>Sem opções disponíveis</SelectItem>
              ) : options.map(o => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleApply} disabled={saving || !value}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Wand2 className="h-4 w-4 mr-2" />}
            Aplicar a {gap.count} registos
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}