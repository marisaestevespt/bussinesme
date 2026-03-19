import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { ArrowLeft, Copy, Trash2, Plus, CalendarIcon, ExternalLink, Save } from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO, differenceInDays } from 'date-fns';
import { pt } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import {
  useClient, useClients, useClientHistory, useClientActivities, useClientOnboarding,
  CLIENT_STATUS_OPTIONS, Client
} from '@/hooks/useClients';
import { useProducts } from '@/hooks/useProducts';
import { useCommercialData } from '@/hooks/useCommercialData';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

// ─── Meetings query for filtered view ───────────────────────────
function useFilteredMeetings(clientName: string | undefined) {
  return useQuery({
    queryKey: ['meetings', 'client', clientName],
    queryFn: async () => {
      if (!clientName) return [];
      const { data, error } = await supabase
        .from('meetings')
        .select('*, meeting_participants(profile_id, profiles:profiles(full_name))')
        .eq('client_name', clientName)
        .order('date_time', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!clientName,
  });
}

// ─── Date picker helper ─────────────────────────────────────────
function DateField({ value, onChange, label }: { value: string | null; onChange: (v: string | null) => void; label: string }) {
  const date = value ? parseISO(value) : undefined;
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !date && 'text-muted-foreground')}>
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date ? format(date, 'dd/MM/yyyy') : 'Selecionar'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            onSelect={d => onChange(d ? format(d, 'yyyy-MM-dd') : null)}
            locale={pt}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

// ─── End of cycle badge ─────────────────────────────────────────
function EndOfCycleBadge({ date }: { date: string | null }) {
  if (!date) return null;
  const d = parseISO(date);
  const days = differenceInDays(d, new Date());
  if (days < 0) return <Badge variant="outline" className="bg-red-100 text-red-800 ml-2">Expirado</Badge>;
  if (days <= 30) return <Badge variant="outline" className="bg-amber-100 text-amber-800 ml-2">Expira em {days}d</Badge>;
  return null;
}

export default function ClienteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = id === 'novo';

  const { data: client, isLoading } = useClient(isNew ? undefined : id);
  const { upsertClient, duplicateClient, deleteClient } = useClients();
  const { products } = useProducts();
  const commercialData = useCommercialData();

  const [form, setForm] = useState<Partial<Client>>({});
  const [initialized, setInitialized] = useState(false);

  if (client && !initialized) { setForm(client); setInitialized(true); }
  if (isNew && !initialized) { setForm({ full_name: '', status: 'ativo' }); setInitialized(true); }

  const update = (field: string, value: any) => setForm(prev => ({ ...prev, [field]: value }));

  const save = async () => {
    if (!form.full_name?.trim()) { toast.error('Nome é obrigatório'); return; }
    try {
      await upsertClient.mutateAsync(form as any);
      toast.success('Cliente guardado');
      if (isNew) navigate('/hub/clientes');
    } catch {}
  };

  const handleDuplicate = async () => {
    if (client) { await duplicateClient.mutateAsync(client); navigate('/hub/clientes'); }
  };
  const handleDelete = async () => {
    if (client && confirm('Eliminar este cliente?')) { await deleteClient.mutateAsync(client.id); navigate('/hub/clientes'); }
  };

  // Filtered payments from commercial sales
  const allSales = commercialData.sales.data || [];
  const clientSales = allSales.filter(s => s.client === form.full_name);

  // Filtered meetings
  const { data: clientMeetings = [] } = useFilteredMeetings(form.full_name);

  // Local tables
  const { history, addEntry: addHistory, deleteEntry: deleteHistory } = useClientHistory(isNew ? undefined : id);
  const { activities, addEntry: addActivity, deleteEntry: deleteActivity } = useClientActivities(isNew ? undefined : id);
  const { onboarding, addEntry: addOnboarding, deleteEntry: deleteOnboarding } = useClientOnboarding(isNew ? undefined : id);

  const productList = products.data || [];

  if (!isNew && isLoading) {
    return <AppLayout><div className="flex items-center justify-center min-h-[60vh]"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="p-6 space-y-6 max-w-5xl mx-auto">
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/hub/clientes')}><ArrowLeft className="h-4 w-4" /></Button>
            <div>
              <h1 className="text-xl font-bold">{form.full_name || 'Novo Cliente'}</h1>
              {form.client_id && <p className="text-xs text-muted-foreground font-mono">{form.client_id}</p>}
            </div>
            <EndOfCycleBadge date={form.end_of_cycle || null} />
          </div>
          <div className="flex items-center gap-2">
            {!isNew && <Button variant="outline" size="sm" onClick={handleDuplicate}><Copy className="h-4 w-4 mr-1" />Duplicar</Button>}
            {!isNew && <Button variant="outline" size="sm" className="text-destructive" onClick={handleDelete}><Trash2 className="h-4 w-4 mr-1" />Eliminar</Button>}
            <Button size="sm" onClick={save}><Save className="h-4 w-4 mr-1" />Guardar</Button>
          </div>
        </div>

        {/* Properties grid */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Propriedades</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">ID</Label>
              <Input value={form.client_id || ''} onChange={e => update('client_id', e.target.value)} placeholder="Auto" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Status</Label>
              <Select value={form.status || 'ativo'} onValueChange={v => update('status', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CLIENT_STATUS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <DateField label="Data de Início" value={form.start_date || null} onChange={v => update('start_date', v)} />
            <DateField label="Fim de Ciclo" value={form.end_of_cycle || null} onChange={v => update('end_of_cycle', v)} />
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Produto Atual</Label>
              <Select value={form.current_product || ''} onValueChange={v => update('current_product', v)}>
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>
                  {productList.map(p => <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">DP</Label>
              <Input value={form.dp || ''} onChange={e => update('dp', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">F. de Pagamento</Label>
              <Input value={form.payment_method || ''} onChange={e => update('payment_method', e.target.value)} placeholder="Ex: mensal, trimestral" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Nome Completo</Label>
              <Input value={form.full_name || ''} onChange={e => update('full_name', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">NIF</Label>
              <Input value={form.nif || ''} onChange={e => update('nif', e.target.value)} />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label className="text-xs text-muted-foreground">Morada Fiscal</Label>
              <Input value={form.fiscal_address || ''} onChange={e => update('fiscal_address', e.target.value)} />
            </div>
            <DateField label="Aniversário" value={form.birthday || null} onChange={v => update('birthday', v)} />
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">E-mail</Label>
              <Input type="email" value={form.email || ''} onChange={e => update('email', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Whatsapp</Label>
              <Input value={form.whatsapp || ''} onChange={e => update('whatsapp', e.target.value)} />
            </div>
            <div className="space-y-1 md:col-span-3">
              <Label className="text-xs text-muted-foreground">Observações</Label>
              <Textarea value={form.observations || ''} onChange={e => update('observations', e.target.value)} rows={2} />
            </div>
            <div className="space-y-1 md:col-span-3">
              <Label className="text-xs text-muted-foreground">Documentos (link)</Label>
              <Input value={form.documents || ''} onChange={e => update('documents', e.target.value)} placeholder="URL ou referência" />
            </div>
          </CardContent>
        </Card>

        {/* Content tabs */}
        <Tabs defaultValue="gestao" className="w-full">
          <TabsList className="bg-transparent gap-2 flex-wrap">
            <TabsTrigger value="gestao" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary data-[state=active]:shadow-sm bg-background border border-secondary text-secondary-foreground">Gestão do Cliente</TabsTrigger>
            <TabsTrigger value="uteis" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary data-[state=active]:shadow-sm bg-background border border-secondary text-secondary-foreground">Úteis</TabsTrigger>
            <TabsTrigger value="jornada" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary data-[state=active]:shadow-sm bg-background border border-secondary text-secondary-foreground">Jornada</TabsTrigger>
          </TabsList>

          {/* ─── Gestão do Cliente ───────────────────────── */}
          <TabsContent value="gestao" className="space-y-6 mt-4">
            {/* Payments filtered view */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Gestão de Pagamentos</CardTitle></CardHeader>
              <CardContent className="p-0">
                <div className="bg-primary text-primary-foreground px-4 py-2 font-medium text-xs grid grid-cols-9 gap-2">
                  <span>Status</span><span>Data</span><span>Descrição</span><span>Valor Base</span><span>Fatura</span><span>Produto</span><span>Mês</span><span>Ano</span><span>Docs</span>
                </div>
                {clientSales.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8 text-sm">Sem pagamentos associados</p>
                ) : clientSales.map(s => (
                  <div key={s.id} className="px-4 py-2 text-xs grid grid-cols-9 gap-2 border-b items-center">
                    <span>{s.status}</span>
                    <span>{s.payment_date || '—'}</span>
                    <span className="truncate">{s.description || '—'}</span>
                    <span>{Number(s.base_value).toFixed(2)}€</span>
                    <span>{Number(s.invoice_total).toFixed(2)}€</span>
                    <span className="truncate">{s.product || '—'}</span>
                    <span>{s.sale_month || '—'}</span>
                    <span>{s.sale_year || '—'}</span>
                    <span className="truncate">{s.documents || '—'}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Meetings filtered view */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Reuniões</CardTitle></CardHeader>
              <CardContent className="p-0">
                <div className="bg-primary text-primary-foreground px-4 py-2 font-medium text-xs grid grid-cols-5 gap-2">
                  <span>Status</span><span>Data & Hora</span><span>Reunião</span><span>Participantes</span><span>Link</span>
                </div>
                {clientMeetings.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8 text-sm">Sem reuniões associadas</p>
                ) : clientMeetings.map((m: any) => (
                  <div key={m.id} className="px-4 py-2 text-xs grid grid-cols-5 gap-2 border-b items-center">
                    <span><Badge variant="outline">{m.status}</Badge></span>
                    <span>{m.date_time ? format(parseISO(m.date_time), 'dd/MM/yyyy HH:mm') : '—'}</span>
                    <span className="truncate">{m.title}</span>
                    <span className="truncate">
                      {m.meeting_participants?.map((p: any) => p.profiles?.full_name).filter(Boolean).join(', ') || '—'}
                    </span>
                    <span>
                      {m.transcript_url ? <a href={m.transcript_url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3 w-3" /></a> : '—'}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── Úteis ─────────────────────────────────── */}
          <TabsContent value="uteis" className="space-y-6 mt-4">
            {/* Client history */}
            <Card>
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm">Histórico do Cliente</CardTitle>
                {!isNew && (
                  <Button size="sm" variant="outline" onClick={() => addHistory.mutateAsync({ client_id: id!, milestone: '', entry_date: format(new Date(), 'yyyy-MM-dd') })}>
                    <Plus className="h-3 w-3 mr-1" />Nova Entrada
                  </Button>
                )}
              </CardHeader>
              <CardContent className="p-0">
                <div className="bg-primary text-primary-foreground px-4 py-2 font-medium text-xs grid grid-cols-4 gap-2">
                  <span>Data</span><span className="col-span-2">Marco</span><span>Observações</span>
                </div>
                {(history.data || []).length === 0 ? (
                  <p className="text-center text-muted-foreground py-8 text-sm">Sem entradas</p>
                ) : (history.data || []).map(h => (
                  <div key={h.id} className="px-4 py-2 text-xs grid grid-cols-4 gap-2 border-b items-center">
                    <span>{format(parseISO(h.entry_date), 'dd/MM/yyyy')}</span>
                    <span className="col-span-2">{h.milestone || '—'}</span>
                    <span className="truncate">{h.observations || '—'}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Activities map */}
            <Card>
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm">Mapa de Atividades Base</CardTitle>
                {!isNew && (
                  <Button size="sm" variant="outline" onClick={() => addActivity.mutateAsync({ client_id: id!, activity: '' })}>
                    <Plus className="h-3 w-3 mr-1" />Nova Entrada
                  </Button>
                )}
              </CardHeader>
              <CardContent className="p-0">
                <div className="bg-primary text-primary-foreground px-4 py-2 font-medium text-xs grid grid-cols-4 gap-2">
                  <span>Fase</span><span>Atividade</span><span>Responsável</span><span>Regra</span>
                </div>
                {(activities.data || []).length === 0 ? (
                  <p className="text-center text-muted-foreground py-8 text-sm">Sem entradas</p>
                ) : (activities.data || []).map(a => (
                  <div key={a.id} className="px-4 py-2 text-xs grid grid-cols-4 gap-2 border-b items-center">
                    <span>{a.phase || '—'}</span>
                    <span>{a.activity || '—'}</span>
                    <span>{a.responsible || '—'}</span>
                    <span>{a.rule || '—'}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── Jornada ───────────────────────────────── */}
          <TabsContent value="jornada" className="space-y-6 mt-4">
            {/* Onboarding checklist */}
            <Card>
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm">Checklist de Onboarding</CardTitle>
                {!isNew && (
                  <Button size="sm" variant="outline" onClick={() => addOnboarding.mutateAsync({ client_id: id!, activity: '' })}>
                    <Plus className="h-3 w-3 mr-1" />Nova Entrada
                  </Button>
                )}
              </CardHeader>
              <CardContent className="p-0">
                <div className="bg-primary text-primary-foreground px-4 py-2 font-medium text-xs grid grid-cols-4 gap-2">
                  <span>Fase</span><span>Atividade</span><span>Responsável</span><span>Regra</span>
                </div>
                {(onboarding.data || []).length === 0 ? (
                  <p className="text-center text-muted-foreground py-8 text-sm">Sem entradas</p>
                ) : (onboarding.data || []).map(o => (
                  <div key={o.id} className="px-4 py-2 text-xs grid grid-cols-4 gap-2 border-b items-center">
                    <span>{o.phase || '—'}</span>
                    <span>{o.activity || '—'}</span>
                    <span>{o.responsible || '—'}</span>
                    <span>{o.rule || '—'}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Drive folder */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Pasta Drive</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Link para pasta de Drive</Label>
                  <div className="flex gap-2">
                    <Input
                      value={form.drive_folder_url || ''}
                      onChange={e => update('drive_folder_url', e.target.value)}
                      placeholder="https://drive.google.com/..."
                    />
                    {form.drive_folder_url && (
                      <Button variant="outline" size="icon" asChild>
                        <a href={form.drive_folder_url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /></a>
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
