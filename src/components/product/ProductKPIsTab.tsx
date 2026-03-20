import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import { toast } from 'sonner';

const KPI_TYPES = [
  { value: 'numerico', label: 'Numérico' },
  { value: 'percentagem', label: 'Percentagem' },
  { value: 'monetario', label: 'Monetário' },
];

const AUTO_SOURCES = [
  { value: 'vendas_count', label: 'Vendas do mês (número)' },
  { value: 'vendas_valor', label: 'Faturação do mês (valor)' },
  { value: 'novos_clientes', label: 'Novos clientes' },
  { value: 'clientes_ativos', label: 'Clientes ativos' },
  { value: 'churn', label: 'Churn' },
  { value: 'taxa_renovacao', label: 'Taxa de renovação' },
  { value: 'nps_medio', label: 'NPS médio atual' },
  { value: 'ticket_medio', label: 'Ticket médio' },
];

interface Props {
  productId: string;
  productName: string;
  isOwner: boolean;
}

export function ProductKPIsTab({ productId, productName, isOwner }: Props) {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '',
    kpi_type: 'numerico',
    source: 'manual' as 'manual' | 'automatico',
    auto_source: '',
    monthly_goal: '',
  });

  const { data: kpis = [], isLoading } = useQuery({
    queryKey: ['product-kpis', productId],
    queryFn: async () => {
      const { data } = await supabase
        .from('product_kpis' as any)
        .select('*')
        .eq('product_id', productId)
        .order('sort_order');
      return (data || []) as any[];
    },
  });

  const createKpi = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error('Nome é obrigatório');
      const { error } = await supabase.from('product_kpis' as any).insert({
        product_id: productId,
        name: form.name.trim(),
        kpi_type: form.kpi_type,
        source: form.source,
        auto_source: form.source === 'automatico' ? form.auto_source : null,
        monthly_goal: form.monthly_goal ? Number(form.monthly_goal) : null,
        sort_order: kpis.length,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['product-kpis', productId] });
      setShowForm(false);
      setForm({ name: '', kpi_type: 'numerico', source: 'manual', auto_source: '', monthly_goal: '' });
      toast.success('KPI criado');
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao criar KPI'),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from('product_kpis' as any).update({ active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['product-kpis', productId] }),
  });

  const deleteKpi = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('product_kpis' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['product-kpis', productId] });
      toast.success('KPI eliminado');
    },
  });

  const sourceLabel = (kpi: any) => {
    if (kpi.source === 'manual') return 'Manual';
    return AUTO_SOURCES.find(s => s.value === kpi.auto_source)?.label || 'Automático';
  };

  const typeLabel = (v: string) => KPI_TYPES.find(t => t.value === v)?.label || v;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">KPIs do Produto</h3>
        {isOwner && (
          <Button size="sm" onClick={() => setShowForm(true)} disabled={showForm}>
            <Plus className="h-4 w-4 mr-1" /> Novo KPI
          </Button>
        )}
      </div>

      {/* New KPI form */}
      {showForm && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Nome do KPI</Label>
                <Input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Ex: Taxa de retenção"
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Tipo</Label>
                <Select value={form.kpi_type} onValueChange={v => setForm(f => ({ ...f, kpi_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {KPI_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Fonte</Label>
                <Select value={form.source} onValueChange={v => setForm(f => ({ ...f, source: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual</SelectItem>
                    <SelectItem value="automatico">Automático</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.source === 'automatico' && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Fonte automática</Label>
                  <Select value={form.auto_source} onValueChange={v => setForm(f => ({ ...f, auto_source: v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecionar fonte" /></SelectTrigger>
                    <SelectContent>
                      {AUTO_SOURCES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-1.5">
                <Label className="text-xs">Meta mensal (opcional)</Label>
                <Input
                  type="number"
                  value={form.monthly_goal}
                  onChange={e => setForm(f => ({ ...f, monthly_goal: e.target.value }))}
                  placeholder="Ex: 5000"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button size="sm" onClick={() => createKpi.mutate()} disabled={createKpi.isPending}>Criar KPI</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPIs list */}
      {kpis.length === 0 && !showForm ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Nenhum KPI personalizado definido. Cria o primeiro KPI para acompanhar o desempenho deste produto.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {kpis.map((kpi: any) => (
            <Card key={kpi.id} className={kpi.active ? '' : 'opacity-50'}>
              <CardContent className="p-3 flex items-center gap-3">
                <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">{kpi.name}</span>
                    <Badge variant="outline" className="text-[10px] shrink-0">{typeLabel(kpi.kpi_type)}</Badge>
                    <Badge variant={kpi.source === 'automatico' ? 'default' : 'secondary'} className="text-[10px] shrink-0">
                      {kpi.source === 'automatico' ? 'Auto' : 'Manual'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                    <span>Fonte: {sourceLabel(kpi)}</span>
                    {kpi.monthly_goal != null && <span>Meta: {kpi.kpi_type === 'monetario' ? `${Number(kpi.monthly_goal).toLocaleString('pt-PT')} €` : kpi.kpi_type === 'percentagem' ? `${kpi.monthly_goal}%` : kpi.monthly_goal}</span>}
                  </div>
                </div>
                {isOwner && (
                  <div className="flex items-center gap-2 shrink-0">
                    <Switch
                      checked={kpi.active}
                      onCheckedChange={v => toggleActive.mutate({ id: kpi.id, active: v })}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={() => { if (confirm('Eliminar este KPI?')) deleteKpi.mutate(kpi.id); }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
