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
  { value: 'em_ideia', label: 'Em ideia', color: 'bg-primary/15 text-primary' },
  { value: 'em_construcao', label: 'Em construção', color: 'bg-warning/15 text-warning' },
  { value: 'ativo', label: 'Ativo', color: 'bg-success/15 text-success' },
  { value: 'pausado', label: 'Pausado', color: 'bg-info/15 text-info' },
  { value: 'arquivo', label: 'Arquivo', color: 'bg-muted text-muted-foreground' },
];

const ENTRY_POINTS = ['Landing Page', 'Redes Sociais', 'Email', 'Anúncio', 'Orgânico', 'Outro'];
const PLATAFORMAS = ['Systeme.io', 'Mailerlite', 'ActiveCampaign', 'Stripe', 'Hotmart', 'Outro'];
const TIPOS_FUNIL = [
  { value: 'venda', label: 'Venda', color: 'bg-success/15 text-success' },
  { value: 'nutricao', label: 'Nutrição', color: 'bg-info/15 text-info' },
  { value: 'captacao', label: 'Captação', color: 'bg-warning/15 text-warning' },
  { value: 'reactivacao', label: 'Reactivação', color: 'bg-primary/15 text-primary' },
  { value: 'outro', label: 'Outro', color: 'bg-muted text-muted-foreground' },
];

type Funnel = {
  id: string; name: string; status: string; entry_points: string[];
  oferta_final: string | null; objetivo: string | null; plataformas: string[];
  tipo_funil: string | null; notas: string | null; updated_at: string;
};

export default function MarketingFunis() {
  const navigate = useNavigate();
  const { user, isOwner } = useAuth();
  const qc = useQueryClient();

  const [showNew, setShowNew] = useState(false);
  const [addingTipo, setAddingTipo] = useState(false);
  const [newTipo, setNewTipo] = useState('');
  const [form, setForm] = useState({ name: '', status: 'em_ideia', oferta_final: '', objetivo: '', tipo_funil: '', product_name: '' });
  const { products: productsQuery } = useProducts();
  const productsList = productsQuery.data || [];

  const { data: funnels = [] } = useQuery({
    queryKey: ['marketing-funnels'],
    queryFn: async () => {
      const { data } = await supabase.from('marketing_funnels').select('*').order('created_at', { ascending: false }) as any;
      return (data || []) as Funnel[];
    },
  });

  // Dynamic tipo list: defaults + any custom values from DB
  const allTiposFunil = Array.from(new Set([
    ...TIPOS_FUNIL.map(t => t.value),
    ...funnels.map(f => f.tipo_funil).filter(Boolean) as string[],
  ]));

  const create = async () => {
    if (!form.name.trim()) return;
    const productId = await resolveProductId(form.product_name);
    const { error } = await supabase.from('marketing_funnels').insert({
      name: form.name, status: form.status,
      oferta_final: form.oferta_final || null,
      objetivo: form.objetivo || null,
      tipo_funil: form.tipo_funil || null,
      product_name: form.product_name || null,
      product_id: productId,
      created_by: user?.id,
    } as any);
    if (error) {
      console.error('Insert error:', error);
      toast.error('Erro ao criar funil: ' + error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ['marketing-funnels'] });
    setShowNew(false);
    setForm({ name: '', status: 'em_ideia', oferta_final: '', objetivo: '', tipo_funil: '', product_name: '' });
    toast.success('Funil criado');
  };

  const deleteFunnel = async (id: string) => {
    if (!(await confirmDestructive())) return;
    await supabase.from('marketing_funnels').delete().eq('id', id) as any;
    qc.invalidateQueries({ queryKey: ['marketing-funnels'] });
    toast.success('Funil eliminado');
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader title="Funis" subtitle="Marketing 360" />

        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <BackNavigation parentRoute="/hub/marketing" parentLabel="Marketing" />
            <Button size="sm" onClick={() => setShowNew(true)}>
              <Plus className="h-4 w-4 mr-1" />Novo Funil
            </Button>
          </div>

          {funnels.length === 0 ? (
            <EmptyHint>Nenhum funil criado.</EmptyHint>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead className="w-28">Status</TableHead>
                    <TableHead className="w-28">Tipo</TableHead>
                    <TableHead className="w-36">Ponto(s) de Entrada</TableHead>
                    <TableHead className="w-36">Plataforma(s)</TableHead>
                    <TableHead className="w-40">Oferta Final</TableHead>
                    <TableHead className="w-32">Última Atualização</TableHead>
                    {isOwner && <TableHead className="w-10" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {funnels.map(f => {
                    const st = STATUSES.find(s => s.value === f.status) || STATUSES[0];
                    const tf = TIPOS_FUNIL.find(t => t.value === f.tipo_funil);
                    const entries = Array.isArray(f.entry_points) ? f.entry_points : [];
                    const plats = Array.isArray(f.plataformas) ? f.plataformas : [];
                    return (
                      <TableRow key={f.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/hub/marketing/funis/${f.id}`)}>
                        <TableCell className="font-medium">{f.name}</TableCell>
                        <TableCell><Badge className={cn('text-xs', st.color)}>{st.label}</Badge></TableCell>
                        <TableCell>{tf ? <Badge className={cn('text-xs', tf.color)}>{tf.label}</Badge> : '—'}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {entries.length > 0 ? entries.map((e: string) => (
                            <Badge key={e} variant="outline" className="text-xs mr-1 mb-0.5">{e}</Badge>
                          )) : '—'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground truncate max-w-[140px]">
                          {plats.length > 0 ? plats.join(', ') : '—'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground truncate max-w-[160px]">{f.oferta_final || '—'}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{format(new Date(f.updated_at), 'dd MMM yyyy', { locale: pt })}</TableCell>
                        {isOwner && (
                          <TableCell>
                            <Button variant="ghost" aria-label="Eliminar" size="icon" className="h-7 w-7" onClick={e => { e.stopPropagation(); deleteFunnel(f.id); }}>
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
          <DialogHeader><DialogTitle>Novo Funil</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Nome *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Funil de venda do curso X" /></div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tipo de Funil</Label>
              {addingTipo ? (
                <div className="flex gap-2">
                  <Input value={newTipo} onChange={e => setNewTipo(e.target.value)} placeholder="Nome do tipo" autoFocus />
                  <Button size="sm" variant="outline" disabled={!newTipo.trim()} onClick={() => {
                    setForm(f => ({ ...f, tipo_funil: newTipo.trim() }));
                    setAddingTipo(false);
                    setNewTipo('');
                  }}>OK</Button>
                  <Button size="sm" variant="ghost" onClick={() => { setAddingTipo(false); setNewTipo(''); }}>Cancelar</Button>
                </div>
              ) : (
                <Select value={form.tipo_funil} onValueChange={v => {
                  if (v === '___add_new___') { setAddingTipo(true); return; }
                  setForm(f => ({ ...f, tipo_funil: v }));
                }}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>
                    {allTiposFunil.map(val => {
                      const tf = TIPOS_FUNIL.find(t => t.value === val);
                      return <SelectItem key={val} value={val}>{tf ? tf.label : val}</SelectItem>;
                    })}
                    <SelectItem value="___add_new___" className="text-primary font-medium">+ Adicionar novo...</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
            <div><Label>Oferta Final</Label><Input value={form.oferta_final} onChange={e => setForm(f => ({ ...f, oferta_final: e.target.value }))} placeholder="Produto/Plataforma/Outro Final" /></div>
            <div><Label>Objetivo</Label><Input value={form.objetivo} onChange={e => setForm(f => ({ ...f, objetivo: e.target.value }))} placeholder="Objetivo do funil" /></div>
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
            <Button className="w-full" disabled={!form.name.trim()} onClick={create}>Criar Funil</Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
