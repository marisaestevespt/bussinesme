import { useState, useEffect } from 'react';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Copy, Trash2, Plus, CalendarIcon, ExternalLink, Save, X } from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import {
  useClient, useClients, useClientHistory,
  CLIENT_STATUS_OPTIONS, Client
} from '@/hooks/useClients';
import { useProducts } from '@/hooks/useProducts';
import { useCommercialData } from '@/hooks/useCommercialData';
import { EntryDetailSheet } from '@/components/financial/EntryDetailSheet';
import { supabase } from '@/integrations/supabase/client';
import { DEPARTMENTS } from '@/lib/departments';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ClientCustomerSuccess } from '@/components/client/ClientCustomerSuccess';
import { BackNavigation } from '@/components/BackNavigation';
import { ClientFeedbackSection } from '@/components/client/ClientFeedbackSection';

// ─── Meetings query ─────────────────────────────────────────────
function useFilteredMeetings(clientId: string | undefined) {
  return useQuery({
    queryKey: ['meetings', 'client', clientId],
    queryFn: async () => {
      if (!clientId) return [];
      const { data, error } = await supabase
        .from('meetings')
        .select('*, meeting_participants(profile_id, profiles:profiles(full_name))')
        .eq('client_id', clientId)
        .order('date_time', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!clientId,
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
          <Calendar mode="single" selected={date} onSelect={d => onChange(d ? format(d, 'yyyy-MM-dd') : null)} locale={pt} />
        </PopoverContent>
      </Popover>
    </div>
  );
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
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const [paymentSheetOpen, setPaymentSheetOpen] = useState(false);
  const [meetingOpen, setMeetingOpen] = useState(false);
  const [meetingForm, setMeetingForm] = useState({ title: '', date_time: '', meeting_url: '', meeting_type: 'cliente' as 'recorrente' | 'projeto' | 'cliente', department: '' });
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');

  const queryClient = useQueryClient();

  if (client && !initialized) { setForm(client); setInitialized(true); }
  if (isNew && !initialized) { setForm({ full_name: '', status: 'em_onboarding' }); setInitialized(true); }

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

  // Filtered payments
  const allSales = commercialData.sales.data || [];
  const clientSales = allSales.filter(s => s.client === form.full_name);

  // Filtered meetings
  const { data: clientMeetings = [] } = useFilteredMeetings(isNew ? undefined : id);

  // Create meeting
  const createMeeting = useMutation({
    mutationFn: async (data: { title: string; date_time: string; meeting_url: string; meeting_type: string; department: string }) => {
      const { error } = await supabase.from('meetings').insert({
        title: data.title,
        date_time: data.date_time,
        client_id: id || null,
        client_name: form.full_name || '',
        status: 'agendada' as any,
        meeting_url: data.meeting_url || null,
        meeting_type: data.meeting_type as any,
        department: data.department || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
      toast.success('Reunião criada');
      setMeetingOpen(false);
      setMeetingForm({ title: '', date_time: '', meeting_url: '', meeting_type: 'cliente', department: '' });
    },
    onError: () => toast.error('Erro ao criar reunião'),
  });

  // History
  const { history, addEntry: addHistory, updateEntry: updateHistory, deleteEntry: deleteHistory } = useClientHistory(isNew ? undefined : id);

  // Client projects
  const { data: clientProjects = [] } = useQuery({
    queryKey: ['projects', 'client', form.full_name],
    queryFn: async () => {
      if (!form.full_name) return [];
      const { data } = await supabase.from('projects').select('id, name, status, created_at').eq('client_name', form.full_name).order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!form.full_name && !isNew,
  });

  const createProject = useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase.from('projects').insert({
        name,
        type: 'clientes',
        status: 'em_curso',
        department: 'clientes',
        client_name: form.full_name || null,
      }).select('id').single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['projects', 'client'] });
      toast.success('Projeto criado');
      setProjectDialogOpen(false);
      setNewProjectName('');
      navigate(`/hub/projetos/${data.id}`);
    },
    onError: () => toast.error('Erro ao criar projeto'),
  });

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
            <BackNavigation parentRoute="/hub/clientes" parentLabel="Clientes" />
            <div>
              <Input
                value={form.full_name || ''}
                onChange={e => update('full_name', e.target.value)}
                placeholder="Nome do cliente"
                className="text-xl font-bold border-none shadow-none px-0 h-auto focus-visible:ring-0 bg-transparent"
              />
              {form.client_id && <p className="text-xs text-muted-foreground font-mono">{form.client_id}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isNew && <Button variant="outline" size="sm" onClick={handleDuplicate}><Copy className="h-4 w-4 mr-1" />Duplicar</Button>}
            {!isNew && <Button variant="outline" size="sm" className="text-destructive" onClick={handleDelete}><Trash2 className="h-4 w-4 mr-1" />Eliminar</Button>}
            <Button size="sm" onClick={save}><Save className="h-4 w-4 mr-1" />Guardar</Button>
          </div>
        </div>

        {/* Properties */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Propriedades</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Produto Atual</Label>
                <Select value={form.current_product || ''} onValueChange={v => update('current_product', v)}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>
                    {productList.map(p => <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <DateField label="Aniversário" value={form.birthday || null} onChange={v => update('birthday', v)} />
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">E-mail</Label>
                <Input type="email" value={form.email || ''} onChange={e => update('email', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Whatsapp</Label>
                <Input value={form.whatsapp || ''} onChange={e => update('whatsapp', e.target.value)} />
              </div>
              <DateField label="Data de Início" value={form.start_date || null} onChange={v => update('start_date', v)} />
            </div>
          </CardContent>
        </Card>

        {/* Dados Fiscais */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Dados Fiscais</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Nome Completo</Label>
              <Input value={form.full_name || ''} onChange={e => update('full_name', e.target.value)} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">NIF</Label>
                <Input value={form.nif || ''} onChange={e => update('nif', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Morada Fiscal</Label>
                <Input value={form.fiscal_address || ''} onChange={e => update('fiscal_address', e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Observações */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Observações</CardTitle></CardHeader>
          <CardContent>
            <Textarea value={form.observations || ''} onChange={e => update('observations', e.target.value)} rows={3} placeholder="Notas sobre este cliente..." />
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="jornada" className="w-full">
          <TabsList className="bg-transparent gap-2 flex-wrap">
            <TabsTrigger value="jornada">Jornada</TabsTrigger>
            <TabsTrigger value="gestao">Gestão do Cliente</TabsTrigger>
            <TabsTrigger value="customer-success">Customer Success</TabsTrigger>
          </TabsList>

          {/* ─── Tab 1: Jornada ───────────────────────────── */}
          <TabsContent value="jornada" className="space-y-6 mt-4">
            {/* Projects history */}
            <Card>
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm">Histórico de Projetos</CardTitle>
                {!isNew && (
                  <Button size="sm" variant="outline" onClick={() => { setNewProjectName(`${form.full_name || 'Cliente'} — ${form.current_product || 'Projeto'}`); setProjectDialogOpen(true); }}>
                    <Plus className="h-3 w-3 mr-1" />Novo Projeto
                  </Button>
                )}
              </CardHeader>
              <CardContent className="p-0">
                <div className="bg-primary text-primary-foreground px-4 py-2 font-medium text-xs grid grid-cols-[1fr_120px_100px] gap-2">
                  <span>Projeto</span><span>Status</span><span>Data</span>
                </div>
                {clientProjects.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8 text-sm">Sem projetos associados</p>
                ) : clientProjects.map((p: any) => (
                  <div
                    key={p.id}
                    className="px-4 py-2 text-xs grid grid-cols-[1fr_120px_100px] gap-2 border-b items-center cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/hub/projetos/${p.id}`)}
                  >
                    <span className="font-medium">{p.name}</span>
                    <Badge variant="outline" className="w-fit">{p.status}</Badge>
                    <span>{p.created_at ? format(parseISO(p.created_at), 'dd/MM/yyyy') : '—'}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

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
                <div className="bg-primary text-primary-foreground px-4 py-2 font-medium text-xs grid grid-cols-[100px_1fr_1fr_32px] gap-2">
                  <span>Data</span><span>Entrada</span><span>Observações</span><span></span>
                </div>
                {(history.data || []).length === 0 ? (
                  <p className="text-center text-muted-foreground py-8 text-sm">Sem entradas</p>
                ) : (history.data || []).map(h => (
                  <div key={h.id} className="px-4 py-2 text-xs grid grid-cols-[100px_1fr_1fr_32px] gap-2 border-b items-center">
                    <Input type="date" className="h-7 text-xs" defaultValue={h.entry_date} onBlur={e => updateHistory.mutate({ id: h.id, entry_date: e.target.value })} />
                    <Input className="h-7 text-xs" defaultValue={h.milestone} placeholder="O que aconteceu..." onBlur={e => updateHistory.mutate({ id: h.id, milestone: e.target.value })} />
                    <Input className="h-7 text-xs" defaultValue={h.observations || ''} placeholder="Observações" onBlur={e => updateHistory.mutate({ id: h.id, observations: e.target.value })} />
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteHistory.mutate(h.id)}><X className="h-3 w-3" /></Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── Tab 2: Gestão do Cliente ──────────────────── */}
          <TabsContent value="gestao" className="space-y-6 mt-4">
            {/* Meetings */}
            <Card>
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm">Reuniões</CardTitle>
                <Button size="sm" variant="outline" onClick={() => setMeetingOpen(true)}><Plus className="h-3 w-3 mr-1" />Nova Reunião</Button>
              </CardHeader>
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

            {/* Payments */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Pagamentos</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="bg-primary text-primary-foreground px-4 py-2 font-medium text-xs grid grid-cols-6 gap-2">
                  <span>Status</span><span>Data</span><span>Descrição</span><span>Valor Base</span><span>Fatura</span><span>Produto</span>
                </div>
                {clientSales.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8 text-sm">Sem pagamentos associados</p>
                ) : clientSales.map(s => (
                  <div key={s.id} className="px-4 py-2 text-xs grid grid-cols-6 gap-2 border-b items-center cursor-pointer hover:bg-muted/50" onClick={() => { setSelectedPayment(s); setPaymentSheetOpen(true); }}>
                    <span>{s.status}</span>
                    <span>{s.payment_date || '—'}</span>
                    <span className="truncate">{s.description || '—'}</span>
                    <span>{Number(s.base_value).toFixed(2)}€</span>
                    <span>{Number(s.invoice_total).toFixed(2)}€</span>
                    <span className="truncate">{s.product || '—'}</span>
                  </div>
                ))}
                {clientSales.length > 0 && (
                  <div className="px-4 py-3 text-xs font-medium border-t flex justify-between">
                    <span>Total: {clientSales.length} pagamento(s)</span>
                    <span>Valor total: {clientSales.reduce((s, p) => s + Number(p.invoice_total || 0), 0).toFixed(2)}€</span>
                  </div>
                )}
              </CardContent>
            </Card>

            <EntryDetailSheet sale={selectedPayment} open={paymentSheetOpen} onOpenChange={setPaymentSheetOpen} />

            {/* Links */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Links</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Pasta Drive</Label>
                  <div className="flex gap-2">
                    <Input value={form.drive_folder_url || ''} onChange={e => update('drive_folder_url', e.target.value)} placeholder="https://drive.google.com/..." />
                    {form.drive_folder_url && (
                      <Button variant="outline" size="icon" asChild>
                        <a href={form.drive_folder_url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /></a>
                      </Button>
                    )}
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Grupo WhatsApp</Label>
                  <div className="flex gap-2">
                    <Input value={(form as any).whatsapp_group_url || ''} onChange={e => update('whatsapp_group_url' as any, e.target.value)} placeholder="https://chat.whatsapp.com/..." />
                    {(form as any).whatsapp_group_url && (
                      <Button variant="outline" size="icon" asChild>
                        <a href={(form as any).whatsapp_group_url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /></a>
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── Tab 3: Customer Success ──────────────────── */}
          <TabsContent value="customer-success" className="space-y-6 mt-4">
            {/* Feedback */}
            <ClientFeedbackSection clientId={isNew ? undefined : id} clientName={form.full_name || ''} />

            {!isNew && (
              <ClientCustomerSuccess
                clientId={id!}
                clientName={form.full_name || ''}
                productName={form.current_product || null}
                startDate={form.start_date || null}
              />
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Meeting dialog */}
      <Dialog open={meetingOpen} onOpenChange={setMeetingOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova Reunião</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Tipo de reunião</Label>
              <Select value={meetingForm.meeting_type} onValueChange={v => setMeetingForm(p => ({ ...p, meeting_type: v as any }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cliente">Reunião com Cliente</SelectItem>
                  <SelectItem value="recorrente">Reunião Recorrente</SelectItem>
                  <SelectItem value="projeto">Reunião de Projeto</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Título</Label>
              <Input value={meetingForm.title} onChange={e => setMeetingForm(p => ({ ...p, title: e.target.value }))} />
            </div>
            <div>
              <Label>Data & Hora</Label>
              <Input type="datetime-local" value={meetingForm.date_time} onChange={e => setMeetingForm(p => ({ ...p, date_time: e.target.value }))} />
            </div>
            <div>
              <Label>Departamento</Label>
              <Select value={meetingForm.department} onValueChange={v => setMeetingForm(p => ({ ...p, department: v }))}>
                <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                <SelectContent>
                  {DEPARTMENTS.map(d => (
                    <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Link de Acesso</Label>
              <Input value={meetingForm.meeting_url} onChange={e => setMeetingForm(p => ({ ...p, meeting_url: e.target.value }))} placeholder="https://..." />
            </div>
            <p className="text-xs text-muted-foreground">Cliente: <span className="font-medium text-foreground">{form.full_name || '—'}</span> (pré-associado)</p>
            <Button className="w-full" onClick={() => {
              if (!meetingForm.title || !meetingForm.date_time) { toast.error('Título e data são obrigatórios'); return; }
              createMeeting.mutate(meetingForm);
            }}>Criar Reunião</Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
