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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ChevronLeft, Plus, Trash2, FileText, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { BackNavigation } from '@/components/BackNavigation';
import { ObjetivoFinalField, parseObjetivoFinal, serializeObjetivoFinal, displayObjetivoFinal, type ObjetivoFinalType } from '@/components/traffic/ObjetivoFinalField';
import { EmptyHint } from '@/components/ui/loading-skeletons';
import { safeUrl } from '@/lib/url';
import { requireConfirm, confirmDestructive } from '@/lib/confirmDestructive';

const STATUSES = [
  { value: 'em_desenho', label: 'Em desenho', color: 'bg-accent-violet/15 text-accent-violet' },
  { value: 'escrita_copy', label: 'Escrita de copy', color: 'bg-warning/15 text-warning' },
  { value: 'gravacao', label: 'Gravação', color: 'bg-warning/15 text-warning' },
  { value: 'edicao', label: 'Edição', color: 'bg-info/15 text-info' },
  { value: 'design', label: 'Design', color: 'bg-accent-violet/15 text-accent-violet' },
  { value: 'para_aprovacao', label: 'Para aprovação final', color: 'bg-warning/15 text-warning' },
  { value: 'em_campanha', label: 'Em campanha', color: 'bg-success/15 text-success' },
  { value: 'ajustes', label: 'Ajustes a fazer', color: 'bg-destructive/15 text-destructive' },
  { value: 'off', label: 'OFF', color: 'bg-muted text-muted-foreground' },
];

const FORMATOS = ['Vídeo', 'Imagem', 'Carrossel', 'Stories', 'Outro'];

type ReportCard = { id: string; title: string; content: string | null; sort_order: number };
type Creative = {
  id: string; name: string; status: string; start_date: string | null;
  formato: string | null; objetivo: string | null; oferta_goal: string | null;
  link: string | null; updated_at: string;
};

export default function MarketingTrafegoPago() {
  const navigate = useNavigate();
  const { user, isOwner } = useAuth();
  const qc = useQueryClient();

  const [showNewCreative, setShowNewCreative] = useState(false);
  const [showNewCard, setShowNewCard] = useState(false);
  const [newCardTitle, setNewCardTitle] = useState('');
  const [creativeForm, setCreativeForm] = useState({ name: '', status: 'em_desenho', formato: '', objetivo: '', oferta_type: '' as ObjetivoFinalType, oferta_value: '', link: '', product_name: '' });
  const { products: productsQuery } = useProducts();
  const productsList = productsQuery.data || [];

  const { data: reportCards = [] } = useQuery({
    queryKey: ['traffic-report-cards'],
    queryFn: async () => {
      const { data } = await supabase.from('traffic_report_cards').select('*').order('sort_order') as any;
      return (data || []) as ReportCard[];
    },
  });

  const { data: creatives = [] } = useQuery({
    queryKey: ['traffic-creatives'],
    queryFn: async () => {
      const { data } = await supabase.from('traffic_creatives').select('*').order('created_at', { ascending: false }) as any;
      return (data || []) as Creative[];
    },
  });

  const createCreative = async () => {
    if (!creativeForm.name.trim()) return;
    const productId = await resolveProductId(creativeForm.product_name);
    await supabase.from('traffic_creatives').insert({
      name: creativeForm.name, status: creativeForm.status,
      formato: creativeForm.formato || null, objetivo: creativeForm.objetivo || null,
      oferta_goal: serializeObjetivoFinal(creativeForm.oferta_type, creativeForm.oferta_value),
      link: creativeForm.link || null,
      product_name: creativeForm.product_name || null,
      product_id: productId,
      created_by: user?.id,
    } as any);
    qc.invalidateQueries({ queryKey: ['traffic-creatives'] });
    setShowNewCreative(false);
    setCreativeForm({ name: '', status: 'em_desenho', formato: '', objetivo: '', oferta_type: '', oferta_value: '', link: '', product_name: '' });
    toast.success('Criativo criado');
  };

  const deleteCreative = async (id: string) => {
    if (!(await confirmDestructive())) return;
    await supabase.from('traffic_creatives').delete().eq('id', id) as any;
    qc.invalidateQueries({ queryKey: ['traffic-creatives'] });
    toast.success('Criativo eliminado');
  };

  const createCard = async () => {
    if (!newCardTitle.trim()) return;
    const maxOrder = reportCards.reduce((m, c) => Math.max(m, c.sort_order), -1);
    await supabase.from('traffic_report_cards').insert({ title: newCardTitle, sort_order: maxOrder + 1 } as any);
    qc.invalidateQueries({ queryKey: ['traffic-report-cards'] });
    setShowNewCard(false);
    setNewCardTitle('');
    toast.success('Card criado');
  };

  const deleteCard = async (id: string) => {
    if (!(await confirmDestructive())) return;
    await supabase.from('traffic_report_cards').delete().eq('id', id) as any;
    qc.invalidateQueries({ queryKey: ['traffic-report-cards'] });
    toast.success('Card eliminado');
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader title="Tráfego Pago" subtitle="Marketing 360" />

        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <BackNavigation parentRoute="/hub/marketing" parentLabel="Marketing" />
          </div>

          {/* Centro de Tráfego Pago */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">Reports & Análises</h2>
              {isOwner && (
                <Button variant="outline" size="sm" onClick={() => setShowNewCard(true)}>
                  <Plus className="h-3.5 w-3.5 mr-1" />Novo Card
                </Button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {reportCards.map(card => (
                <Card key={card.id} className="cursor-pointer hover:shadow-md transition-shadow group relative"
                  onClick={() => navigate(`/hub/marketing/trafego-pago/report/${card.id}`)}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      {card.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">Clica para editar</p>
                  </CardContent>
                  {isOwner && (
                    <Button variant="ghost" aria-label="Eliminar" size="icon"
                      className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100"
                      onClick={e => { e.stopPropagation(); deleteCard(card.id); }}>
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  )}
                </Card>
              ))}
            </div>
          </section>

          {/* Todos os Criativos */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">Todos os Criativos</h2>
              <Button size="sm" onClick={() => setShowNewCreative(true)}>
                <Plus className="h-4 w-4 mr-1" />Novo Criativo
              </Button>
            </div>

            {creatives.length === 0 ? (
              <EmptyHint>Nenhum criativo criado.</EmptyHint>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Criativo</TableHead>
                      <TableHead className="w-36">Status</TableHead>
                      <TableHead className="w-28">Data Início</TableHead>
                      <TableHead className="w-24">Formato</TableHead>
                      <TableHead className="w-44">Objetivo</TableHead>
                      <TableHead className="w-36">Objetivo Final</TableHead>
                      <TableHead className="w-10">Link</TableHead>
                      <TableHead className="w-32">Última Atualização</TableHead>
                      {isOwner && <TableHead className="w-10" />}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {creatives.map(c => {
                      const st = STATUSES.find(s => s.value === c.status) || STATUSES[0];
                      return (
                        <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/hub/marketing/trafego-pago/criativo/${c.id}`)}>
                          <TableCell className="font-medium">{c.name}</TableCell>
                          <TableCell><Badge className={cn('text-xs', st.color)}>{st.label}</Badge></TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {c.start_date ? format(new Date(c.start_date), 'dd MMM yyyy', { locale: pt }) : '—'}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{c.formato || '—'}</TableCell>
                          <TableCell className="text-sm text-muted-foreground truncate max-w-[180px]">{c.objetivo || '—'}</TableCell>
                          <TableCell className="text-sm text-muted-foreground truncate max-w-[140px]">{displayObjetivoFinal(c.oferta_goal)}</TableCell>
                          <TableCell>
                            {c.link ? (
                              <a href={safeUrl(c.link)} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>
                                <ExternalLink className="h-3.5 w-3.5 text-primary" />
                              </a>
                            ) : '—'}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{format(new Date(c.updated_at), 'dd MMM yyyy', { locale: pt })}</TableCell>
                          {isOwner && (
                            <TableCell>
                              <Button variant="ghost" aria-label="Eliminar" size="icon" className="h-7 w-7" onClick={e => { e.stopPropagation(); deleteCreative(c.id); }}>
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
          </section>
        </div>
      </div>

      {/* New Creative Dialog */}
      <Dialog open={showNewCreative} onOpenChange={setShowNewCreative}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Novo Criativo</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Nome *</Label><Input value={creativeForm.name} onChange={e => setCreativeForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Vídeo campanha de verão" /></div>
            <div>
              <Label>Status</Label>
              <Select value={creativeForm.status} onValueChange={v => setCreativeForm(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Formato</Label>
              <Select value={creativeForm.formato} onValueChange={v => setCreativeForm(f => ({ ...f, formato: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>{FORMATOS.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Objetivo</Label><Input value={creativeForm.objetivo} onChange={e => setCreativeForm(f => ({ ...f, objetivo: e.target.value }))} placeholder="Objetivo do criativo" /></div>
            <ObjetivoFinalField
              type={creativeForm.oferta_type}
              value={creativeForm.oferta_value}
              onTypeChange={t => setCreativeForm(f => ({ ...f, oferta_type: t, oferta_value: '' }))}
              onValueChange={v => setCreativeForm(f => ({ ...f, oferta_value: v }))}
            />
            <div><Label>Link</Label><Input value={creativeForm.link} onChange={e => setCreativeForm(f => ({ ...f, link: e.target.value }))} placeholder="https://..." /></div>
            <div>
              <Label>Produto</Label>
              <Select value={creativeForm.product_name} onValueChange={v => setCreativeForm(f => ({ ...f, product_name: v === '___none___' ? '' : v }))}>
                <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="___none___">Nenhum</SelectItem>
                  {productsList.map(p => <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full" disabled={!creativeForm.name.trim()} onClick={createCreative}>Criar Criativo</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* New Card Dialog */}
      <Dialog open={showNewCard} onOpenChange={setShowNewCard}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Novo Card</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Título *</Label><Input value={newCardTitle} onChange={e => setNewCardTitle(e.target.value)} placeholder="Ex: Relatório Q1" /></div>
            <Button className="w-full" disabled={!newCardTitle.trim()} onClick={createCard}>Criar Card</Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
