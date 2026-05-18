import { useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { resolveProductId } from '@/lib/productResolver';
import { useProducts } from '@/hooks/useProducts';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ChevronLeft, Plus, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { BackNavigation } from '@/components/BackNavigation';
import { EmptyHint } from '@/components/ui/loading-skeletons';
import { requireConfirm, confirmDestructive } from '@/lib/confirmDestructive';

const STATUSES = [
  { value: 'em_desenho', label: 'Em desenho', color: 'bg-warning/15 text-warning' },
  { value: 'ativa', label: 'Ativa', color: 'bg-success/15 text-success' },
  { value: 'pausada', label: 'Pausada', color: 'bg-info/15 text-info' },
  { value: 'arquivo', label: 'Arquivo', color: 'bg-muted text-muted-foreground' },
];

const DEFAULT_PLATAFORMAS = [
  'Mailerlite', 'ActiveCampaign', 'Zapier', 'Make', 'Systeme.io',
];

type Automation = {
  id: string; name: string; status: string; oferta_final: string | null;
  objetivo: string | null; plataforma: string | null; notas: string | null;
  updated_at: string; created_at: string;
};

export default function MarketingAutomacoes() {
  const navigate = useNavigate();
  const { user, isOwner } = useAuth();
  const qc = useQueryClient();

  const [showNew, setShowNew] = useState(false);
  const [addingPlatform, setAddingPlatform] = useState(false);
  const [newPlatform, setNewPlatform] = useState('');
  const [form, setForm] = useState({ name: '', status: 'em_desenho', oferta_final: '', objetivo: '', plataforma: '', notas: '', product_name: '' });
  const { products: productsQuery } = useProducts();
  const productsList = productsQuery.data || [];

  const { data: automations = [] } = useQuery({
    queryKey: ['marketing-automations'],
    queryFn: async () => {
      const { data } = await supabase.from('marketing_automations').select('*').order('created_at', { ascending: false }) as any;
      return (data || []) as Automation[];
    },
  });

  const allPlataformas = Array.from(new Set([
    ...DEFAULT_PLATAFORMAS,
    ...automations.map(a => a.plataforma).filter(Boolean) as string[],
  ])).sort();

  const create = async () => {
    if (!form.name.trim()) return;
    const productId = await resolveProductId(form.product_name);
    const { error } = await supabase.from('marketing_automations').insert({
      name: form.name, status: form.status,
      oferta_final: form.oferta_final || null,
      objetivo: form.objetivo || null,
      plataforma: form.plataforma || null,
      notas: form.notas || null,
      product_name: form.product_name || null,
      product_id: productId,
      created_by: user?.id,
    } as any);
    if (error) {
      console.error('Insert error:', error);
      toast.error('Erro ao criar automação: ' + error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ['marketing-automations'] });
    setShowNew(false);
    setForm({ name: '', status: 'em_desenho', oferta_final: '', objetivo: '', plataforma: '', notas: '', product_name: '' });
    toast.success('Automação criada');
  };

  const deleteAuto = async (id: string) => {
    if (!(await confirmDestructive())) return;
    await supabase.from('marketing_automations').delete().eq('id', id);
    qc.invalidateQueries({ queryKey: ['marketing-automations'] });
    toast.success('Automação eliminada');
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader title="Automações" subtitle="Marketing 360" />

        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <BackNavigation parentRoute="/hub/marketing" parentLabel="Marketing" />
            <Button size="sm" onClick={() => setShowNew(true)}>
              <Plus className="h-4 w-4 mr-1" />Nova Automação
            </Button>
          </div>

          {automations.length === 0 ? (
            <EmptyHint>Nenhuma automação criada.</EmptyHint>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead className="w-28">Status</TableHead>
                    <TableHead className="w-36">Plataforma</TableHead>
                    <TableHead className="w-40">Oferta Final</TableHead>
                    <TableHead className="w-44">Objetivo</TableHead>
                    <TableHead className="w-32">Última Atualização</TableHead>
                    {isOwner && <TableHead className="w-10" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {automations.map(a => {
                    const st = STATUSES.find(s => s.value === a.status) || STATUSES[0];
                    return (
                      <TableRow key={a.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/hub/marketing/automacoes/${a.id}`)}>
                        <TableCell className="font-medium whitespace-nowrap">{a.name}</TableCell>
                        <TableCell className="whitespace-nowrap"><Badge className={cn('text-xs', st.color)}>{st.label}</Badge></TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{a.plataforma || '—'}</TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{a.oferta_final || '—'}</TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap max-w-[220px] truncate">{a.objetivo || '—'}</TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{format(new Date(a.updated_at), 'dd MMM yyyy', { locale: pt })}</TableCell>
                        {isOwner && (
                          <TableCell>
                            <Button variant="ghost" aria-label="Eliminar" size="icon" className="h-7 w-7" onClick={e => { e.stopPropagation(); deleteAuto(a.id); }}>
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>

      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Nova Automação</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Nome *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Sequência de boas-vindas" /></div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Plataforma</Label>
              {addingPlatform ? (
                <div className="flex gap-2">
                  <Input value={newPlatform} onChange={e => setNewPlatform(e.target.value)} placeholder="Nome da plataforma" autoFocus />
                  <Button size="sm" variant="outline" disabled={!newPlatform.trim()} onClick={() => {
                    setForm(f => ({ ...f, plataforma: newPlatform.trim() }));
                    setAddingPlatform(false);
                    setNewPlatform('');
                  }}>OK</Button>
                  <Button size="sm" variant="ghost" onClick={() => { setAddingPlatform(false); setNewPlatform(''); }}>Cancelar</Button>
                </div>
              ) : (
                <Select value={form.plataforma} onValueChange={v => {
                  if (v === '___add_new___') { setAddingPlatform(true); return; }
                  setForm(f => ({ ...f, plataforma: v }));
                }}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>
                    {allPlataformas.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    <SelectItem value="___add_new___" className="text-primary font-medium">+ Adicionar nova...</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
            <div><Label>Oferta Final</Label><Input value={form.oferta_final} onChange={e => setForm(f => ({ ...f, oferta_final: e.target.value }))} placeholder="Produto/Plataforma/Outro Final" /></div>
            <div><Label>Objetivo</Label><Input value={form.objetivo} onChange={e => setForm(f => ({ ...f, objetivo: e.target.value }))} placeholder="Objetivo da automação" /></div>
            <div>
              <Label>Produto</Label>
              <Select value={form.product_name} onValueChange={v => setForm(f => ({ ...f, product_name: v === '___none___' ? '' : v }))}>
                <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="___none___">Nenhum</SelectItem>
                  {productsList.map(p => <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full" disabled={!form.name.trim()} onClick={create}>Criar Automação</Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
