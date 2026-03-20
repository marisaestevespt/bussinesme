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
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowLeft, Copy, Trash2, Plus, CalendarIcon, ExternalLink, Save, X } from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO, differenceInDays } from 'date-fns';
import { pt } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import {
  useClient, useClients, useClientHistory, useClientActivities, useClientOnboarding, useClientOffboarding,
  CLIENT_STATUS_OPTIONS, Client
} from '@/hooks/useClients';
import { useProducts } from '@/hooks/useProducts';
import { useCommercialData } from '@/hooks/useCommercialData';
import { SaleFormDialog } from '@/components/commercial/SaleFormDialog';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ClientCustomerSuccess } from '@/components/client/ClientCustomerSuccess';
import { ClientPortalSection } from '@/components/client/ClientPortalSection';
import { BackNavigation } from '@/components/BackNavigation';
import { LinkedSopsSection } from '@/components/LinkedSopsSection';

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
  const [saleOpen, setSaleOpen] = useState(false);
  const [meetingOpen, setMeetingOpen] = useState(false);
  const [meetingForm, setMeetingForm] = useState({ title: '', date_time: '', meeting_url: '' });
  const [totalValue, setTotalValue] = useState('');

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

  // Filtered payments from commercial sales
  const allSales = commercialData.sales.data || [];
  const clientSales = allSales.filter(s => s.client === form.full_name);

  // Filtered meetings
  const { data: clientMeetings = [] } = useFilteredMeetings(form.full_name);

  // Create meeting mutation
  const createMeeting = useMutation({
    mutationFn: async (data: { title: string; date_time: string; meeting_url: string }) => {
      const { error } = await supabase.from('meetings').insert({
        title: data.title,
        date_time: data.date_time,
        client_name: form.full_name || '',
        status: 'agendada' as any,
        meeting_url: data.meeting_url || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
      toast.success('Reunião criada');
      setMeetingOpen(false);
      setMeetingForm({ title: '', date_time: '', meeting_url: '' });
    },
    onError: () => toast.error('Erro ao criar reunião'),
  });

  // Auto-generate installment payments
  const generateInstallments = async () => {
    const numPayments = parseInt(form.payment_method?.replace('x', '') || '0');
    if (!numPayments || numPayments < 1) { toast.error('Seleciona uma forma de pagamento (1x-6x)'); return; }
    if (!form.start_date) { toast.error('Define a Data de Início primeiro'); return; }
    if (!form.full_name) { toast.error('Nome do cliente é obrigatório'); return; }

    const startDate = parseISO(form.start_date);
    const product = form.current_product || '';
    const client = form.full_name;

    try {
      // Fetch product VAT rate
      let vatMultiplier = 1.23;
      if (product) {
        const { data: prodData } = await supabase.from('products').select('vat_rate').eq('name', product).maybeSingle();
        const rate = prodData?.vat_rate;
        if (rate === 'isento') vatMultiplier = 1;
        else if (rate) vatMultiplier = 1 + parseFloat(rate) / 100;
      }

      for (let i = 0; i < numPayments; i++) {
        const payDate = new Date(startDate);
        payDate.setMonth(payDate.getMonth() + i);
        const payMonth = payDate.getMonth() + 1;
        const payQuarter = Math.ceil(payMonth / 3);
        const payYear = payDate.getFullYear();
        const payDateStr = format(payDate, 'yyyy-MM-dd');

        // Generate sale_id
        const { data: countData } = await supabase.from('commercial_sales').select('id').eq('sale_year', payYear);
        const nextNum = ((countData?.length || 0) + 1).toString().padStart(2, '0');
        const saleId = `V${payYear}-${nextNum}`;

          const installmentValue = totalValue ? parseFloat(totalValue) / numPayments : 0;
          const installmentRounded = Math.round(installmentValue * 100) / 100;

        await supabase.from('commercial_sales').insert({
          sale_id: saleId,
          status: 'na',
          payment_date: payDateStr,
          description: `${form.client_id}_Pagamento_${['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'][payMonth - 1]}`,
          base_value: installmentRounded,
          invoice_total: Math.round(installmentRounded * vatMultiplier * 100) / 100,
          product,
          client,
          source: null,
          documents: [],
          sale_month: payMonth,
          sale_quarter: payQuarter,
          sale_year: payYear,
        });
      }
      queryClient.invalidateQueries({ queryKey: ['commercial'] });
      toast.success(`${numPayments} pagamentos criados com sucesso`);
    } catch (e) {
      toast.error('Erro ao gerar pagamentos');
    }
  };

  // Local tables
  const { history, addEntry: addHistory, updateEntry: updateHistory, deleteEntry: deleteHistory } = useClientHistory(isNew ? undefined : id);
  const { activities, addEntry: addActivity, updateEntry: updateActivity, deleteEntry: deleteActivity } = useClientActivities(isNew ? undefined : id);
  const { onboarding, addEntry: addOnboarding, updateEntry: updateOnboarding, deleteEntry: deleteOnboarding } = useClientOnboarding(isNew ? undefined : id);
  const { offboarding, addEntry: addOffboarding, updateEntry: updateOffboarding, deleteEntry: deleteOffboarding } = useClientOffboarding(isNew ? undefined : id);

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
            <DateField label="Data de Início" value={form.start_date || null} onChange={v => {
              update('start_date', v);
              // Auto-calculate end_of_cycle if product has cycle_duration
              if (v && form.current_product) {
                const prod = productList.find(p => p.name === form.current_product);
                if (prod?.cycle_duration) {
                  const start = parseISO(v);
                  const end = new Date(start);
                  end.setDate(end.getDate() + prod.cycle_duration);
                  update('end_of_cycle', format(end, 'yyyy-MM-dd'));
                }
              }
            }} />
            <DateField label="Fim de Ciclo" value={form.end_of_cycle || null} onChange={v => update('end_of_cycle', v)} />
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Produto Atual</Label>
              <Select value={form.current_product || ''} onValueChange={async (v) => {
                update('current_product', v);
                // Auto-calculate end_of_cycle if start_date exists and product has cycle_duration
                if (form.start_date) {
                  const prod = productList.find(p => p.name === v);
                  if (prod?.cycle_duration) {
                    const start = parseISO(form.start_date);
                    const end = new Date(start);
                    end.setDate(end.getDate() + prod.cycle_duration);
                    update('end_of_cycle', format(end, 'yyyy-MM-dd'));
                  }
                }
                // Auto-copy onboarding & offboarding templates from product
                if (!isNew && id) {
                  const prod = productList.find(p => p.name === v);
                  if (prod) {
                    // Only copy if client has no existing onboarding entries
                    const currentOnb = onboarding.data || [];
                    if (currentOnb.length === 0) {
                      const { data: onbTemplate } = await supabase.from('product_onboarding_templates' as any).select('*').eq('product_id', prod.id).order('sort_order');
                      if (onbTemplate && onbTemplate.length > 0) {
                        for (const t of onbTemplate as any[]) {
                          await addOnboarding.mutateAsync({ client_id: id, phase: t.phase || '', activity: t.activity || '', responsible: t.responsible || '', rule: t.rule || '', documents_links: t.documents_links || '', sort_order: t.sort_order || 0 });
                        }
                        toast.success('Checklist de onboarding copiada automaticamente');
                      }
                    }
                    // Only copy if client has no existing offboarding entries
                    const currentOffb = offboarding.data || [];
                    if (currentOffb.length === 0) {
                      const { data: offbTemplate } = await supabase.from('product_offboarding_templates' as any).select('*').eq('product_id', prod.id).order('sort_order');
                      if (offbTemplate && offbTemplate.length > 0) {
                        for (const t of offbTemplate as any[]) {
                          await addOffboarding.mutateAsync({ client_id: id, phase: t.phase || '', activity: t.activity || '', responsible: t.responsible || '', rule: t.rule || '', documents_links: t.documents_links || '', sort_order: t.sort_order || 0 });
                        }
                        toast.success('Checklist de offboarding copiada automaticamente');
                      }
                    }

                    // Auto-create project of type "clientes" with tasks from product template
                    const { data: projData, error: projErr } = await supabase.from('projects').insert({
                      name: `${form.full_name || 'Cliente'} — ${v}`,
                      type: 'clientes',
                      status: 'em_curso',
                      department: 'clientes',
                      client_name: form.full_name || null,
                    }).select('id').single();
                    if (!projErr && projData) {
                      const { data: taskTemplates } = await supabase.from('product_project_templates' as any).select('*').eq('product_id', prod.id).order('sort_order');
                      if (taskTemplates && taskTemplates.length > 0) {
                        for (const t of taskTemplates as any[]) {
                          await supabase.from('tasks').insert({
                            name: t.task_name || '',
                            project_id: projData.id,
                            department: 'clientes',
                            status: 'pendente',
                            priority: 'media',
                          });
                        }
                      }
                      toast.success('Projeto criado automaticamente');
                    }

                    // Auto-generate Customer Success records (NPS + Milestones)
                    if (form.start_date) {
                      // Generate NPS records
                      const { data: npsConf } = await supabase.from('product_nps_config' as any).select('*').eq('product_id', prod.id).maybeSingle();
                      if (npsConf) {
                        await supabase.from('client_nps_records' as any).delete().eq('client_id', id).eq('is_manual', false);
                        const startD = parseISO(form.start_date);
                        const cadence = (npsConf as any).cadence_days || 30;
                        const npsRows = [];
                        for (let i = 1; i <= Math.floor(730 / cadence); i++) {
                          const d = new Date(startD);
                          d.setDate(d.getDate() + cadence * i);
                          npsRows.push({ client_id: id, product_id: prod.id, expected_date: format(d, 'yyyy-MM-dd'), status: 'por_fazer', is_manual: false });
                        }
                        if (npsRows.length) await supabase.from('client_nps_records' as any).insert(npsRows);
                      }

                      // Generate milestones
                      await supabase.from('client_milestones' as any).delete().eq('client_id', id).eq('product_id', prod.id);
                      const { data: prodMs } = await supabase.from('product_milestones' as any).select('*').eq('product_id', prod.id).order('days_after_start');
                      if (prodMs?.length) {
                        const startD = parseISO(form.start_date);
                        const msRows = (prodMs as any[]).map(m => ({
                          client_id: id, product_id: prod.id, milestone: m.milestone,
                          expected_date: format(new Date(startD.getTime() + m.days_after_start * 86400000), 'yyyy-MM-dd'),
                          milestone_type: m.milestone_type, responsible_id: m.responsible_id, status: 'por_fazer',
                        }));
                        await supabase.from('client_milestones' as any).insert(msRows);
                      }
                      queryClient.invalidateQueries({ queryKey: ['client-nps-records', id] });
                      queryClient.invalidateQueries({ queryKey: ['client-milestones', id] });
                    }
                  }
                }
              }}>
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>
                  {productList.map(p => <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">F. de Pagamento</Label>
              <Select value={form.payment_method || ''} onValueChange={v => update('payment_method', v)}>
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>
                  {['1x', '2x', '3x', '4x', '5x', '6x'].map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Valor Total (€)</Label>
              <Input type="number" step="0.01" value={totalValue} onChange={e => setTotalValue(e.target.value)} placeholder="Ex: 900" />
              {totalValue && form.payment_method && parseInt(form.payment_method) > 1 && (
                <p className="text-xs text-muted-foreground mt-1">
                  = {(parseFloat(totalValue) / parseInt(form.payment_method)).toFixed(2)}€ + IVA × {form.payment_method} ({(parseFloat(totalValue) / parseInt(form.payment_method) * 1.23).toFixed(2)}€ c/ IVA)
                </p>
              )}
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
        <Tabs defaultValue="jornada" className="w-full">
          <TabsList className="bg-transparent gap-2 flex-wrap">
            <TabsTrigger value="jornada" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary data-[state=active]:shadow-sm bg-background border border-secondary text-secondary-foreground">Jornada</TabsTrigger>
            <TabsTrigger value="gestao" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary data-[state=active]:shadow-sm bg-background border border-secondary text-secondary-foreground">Gestão do Cliente</TabsTrigger>
            <TabsTrigger value="customer-success" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary data-[state=active]:shadow-sm bg-background border border-secondary text-secondary-foreground">Customer Success</TabsTrigger>
            <TabsTrigger value="uteis" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary data-[state=active]:shadow-sm bg-background border border-secondary text-secondary-foreground">Úteis</TabsTrigger>
          </TabsList>

          {/* ─── Gestão do Cliente ───────────────────────── */}
          <TabsContent value="gestao" className="space-y-6 mt-4">
            {/* Payments filtered view */}
            <Card>
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm">Gestão de Pagamentos</CardTitle>
                <div className="flex items-center gap-2">
                  {form.payment_method && parseInt(form.payment_method) > 1 && (
                    <Button size="sm" variant="secondary" onClick={generateInstallments}>
                      Gerar {form.payment_method} Pagamentos
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => setSaleOpen(true)}><Plus className="h-3 w-3 mr-1" />Novo Pagamento</Button>
                </div>
              </CardHeader>
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
                    <span className="truncate">{Array.isArray(s.documents) && s.documents.length > 0 ? `${s.documents.length} doc(s)` : '—'}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Meetings filtered view */}
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
          </TabsContent>

          {/* ─── Úteis ─────────────────────────────────── */}
          <TabsContent value="uteis" className="space-y-6 mt-4">
            {/* Linked SOPs */}
            {!isNew && id && (
              <LinkedSopsSection
                entityType="cliente"
                entityId={id}
                productId={productList.find(p => p.name === form.current_product)?.id}
              />
            )}
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
                  <span>Data</span><span>Marco</span><span>Observações</span><span></span>
                </div>
                {(history.data || []).length === 0 ? (
                  <p className="text-center text-muted-foreground py-8 text-sm">Sem entradas</p>
                ) : (history.data || []).map(h => (
                  <div key={h.id} className="px-4 py-2 text-xs grid grid-cols-[100px_1fr_1fr_32px] gap-2 border-b items-center">
                    <Input type="date" className="h-7 text-xs" defaultValue={h.entry_date} onBlur={e => updateHistory.mutate({ id: h.id, entry_date: e.target.value })} />
                    <Input className="h-7 text-xs" defaultValue={h.milestone} placeholder="Marco" onBlur={e => updateHistory.mutate({ id: h.id, milestone: e.target.value })} />
                    <Input className="h-7 text-xs" defaultValue={h.observations || ''} placeholder="Observações" onBlur={e => updateHistory.mutate({ id: h.id, observations: e.target.value })} />
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteHistory.mutate(h.id)}><X className="h-3 w-3" /></Button>
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
                <div className="bg-primary text-primary-foreground px-4 py-2 font-medium text-xs grid grid-cols-[1fr_1fr_1fr_1fr_32px] gap-2">
                  <span>Fase</span><span>Atividade</span><span>Responsável</span><span>Regra</span><span></span>
                </div>
                {(activities.data || []).length === 0 ? (
                  <p className="text-center text-muted-foreground py-8 text-sm">Sem entradas</p>
                ) : (activities.data || []).map(a => (
                  <div key={a.id} className="px-4 py-2 text-xs grid grid-cols-[1fr_1fr_1fr_1fr_32px] gap-2 border-b items-center">
                    <Input className="h-7 text-xs" defaultValue={a.phase || ''} placeholder="Fase" onBlur={e => updateActivity.mutate({ id: a.id, phase: e.target.value })} />
                    <Input className="h-7 text-xs" defaultValue={a.activity} placeholder="Atividade" onBlur={e => updateActivity.mutate({ id: a.id, activity: e.target.value })} />
                    <Input className="h-7 text-xs" defaultValue={a.responsible || ''} placeholder="Responsável" onBlur={e => updateActivity.mutate({ id: a.id, responsible: e.target.value })} />
                    <Input className="h-7 text-xs" defaultValue={a.rule || ''} placeholder="Regra" onBlur={e => updateActivity.mutate({ id: a.id, rule: e.target.value })} />
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteActivity.mutate(a.id)}><X className="h-3 w-3" /></Button>
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
                <div className="flex gap-2">
                  {!isNew && form.current_product && (onboarding.data || []).length === 0 && (
                    <Button size="sm" variant="outline" onClick={async () => {
                      // Find product by name and copy its onboarding template
                      const prod = productList.find(p => p.name === form.current_product);
                      if (!prod) { toast.error('Produto não encontrado'); return; }
                      const { data: template } = await supabase.from('product_onboarding_templates' as any).select('*').eq('product_id', prod.id).order('sort_order');
                      if (!template || template.length === 0) { toast.error('Sem template de onboarding neste produto'); return; }
                      for (const t of template as any[]) {
                        await addOnboarding.mutateAsync({ client_id: id!, phase: t.phase || '', activity: t.activity || '', responsible: t.responsible || '', rule: t.rule || '', documents_links: t.documents_links || '', sort_order: t.sort_order || 0 });
                      }
                      toast.success('Checklist copiada do produto');
                    }}>
                      <Copy className="h-3 w-3 mr-1" />Copiar do Produto
                    </Button>
                  )}
                  {!isNew && (
                    <Button size="sm" variant="outline" onClick={() => addOnboarding.mutateAsync({ client_id: id!, activity: '' })}>
                      <Plus className="h-3 w-3 mr-1" />Nova Entrada
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="bg-primary text-primary-foreground px-4 py-2 font-medium text-xs grid grid-cols-[32px_1fr_1fr_1fr_1fr_1fr_32px] gap-2">
                  <span>✓</span><span>Fase</span><span>Atividade</span><span>Responsável</span><span>Regra</span><span>Docs/Links</span><span></span>
                </div>
                {(onboarding.data || []).length === 0 ? (
                  <p className="text-center text-muted-foreground py-8 text-sm">Sem entradas</p>
                ) : (onboarding.data || []).map(o => (
                  <div key={o.id} className={cn("px-4 py-2 text-xs grid grid-cols-[32px_1fr_1fr_1fr_1fr_1fr_32px] gap-2 border-b items-center", o.completed && "opacity-60")}>
                    <Checkbox checked={o.completed} onCheckedChange={(v) => updateOnboarding.mutate({ id: o.id, completed: !!v })} />
                    <Input className="h-7 text-xs" defaultValue={o.phase || ''} placeholder="Fase" onBlur={e => updateOnboarding.mutate({ id: o.id, phase: e.target.value })} />
                    <Input className={cn("h-7 text-xs", o.completed && "line-through")} defaultValue={o.activity} placeholder="Atividade" onBlur={e => updateOnboarding.mutate({ id: o.id, activity: e.target.value })} />
                    <Input className="h-7 text-xs" defaultValue={o.responsible || ''} placeholder="Responsável" onBlur={e => updateOnboarding.mutate({ id: o.id, responsible: e.target.value })} />
                    <Input className="h-7 text-xs" defaultValue={o.rule || ''} placeholder="Regra" onBlur={e => updateOnboarding.mutate({ id: o.id, rule: e.target.value })} />
                    <Input className="h-7 text-xs" defaultValue={(o as any).documents_links || ''} placeholder="URL/notas" onBlur={e => updateOnboarding.mutate({ id: o.id, documents_links: e.target.value } as any)} />
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteOnboarding.mutate(o.id)}><X className="h-3 w-3" /></Button>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Offboarding checklist */}
            <Card>
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm">Checklist de Offboarding</CardTitle>
                <div className="flex gap-2">
                  {!isNew && form.current_product && (offboarding.data || []).length === 0 && (
                    <Button size="sm" variant="outline" onClick={async () => {
                      const prod = productList.find(p => p.name === form.current_product);
                      if (!prod) { toast.error('Produto não encontrado'); return; }
                      const { data: template } = await supabase.from('product_offboarding_templates' as any).select('*').eq('product_id', prod.id).order('sort_order');
                      if (!template || template.length === 0) { toast.error('Sem template de offboarding neste produto'); return; }
                      for (const t of template as any[]) {
                        await addOffboarding.mutateAsync({ client_id: id!, phase: t.phase || '', activity: t.activity || '', responsible: t.responsible || '', rule: t.rule || '', documents_links: t.documents_links || '', sort_order: t.sort_order || 0 });
                      }
                      toast.success('Checklist de offboarding copiada do produto');
                    }}>
                      <Copy className="h-3 w-3 mr-1" />Copiar do Produto
                    </Button>
                  )}
                  {!isNew && (
                    <Button size="sm" variant="outline" onClick={() => addOffboarding.mutateAsync({ client_id: id!, activity: '' })}>
                      <Plus className="h-3 w-3 mr-1" />Nova Entrada
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="bg-primary text-primary-foreground px-4 py-2 font-medium text-xs grid grid-cols-[32px_1fr_1fr_1fr_1fr_1fr_32px] gap-2">
                  <span>✓</span><span>Fase</span><span>Atividade</span><span>Responsável</span><span>Regra</span><span>Docs/Links</span><span></span>
                </div>
                {(offboarding.data || []).length === 0 ? (
                  <p className="text-center text-muted-foreground py-8 text-sm">Sem entradas</p>
                ) : (offboarding.data || []).map(o => (
                  <div key={o.id} className={cn("px-4 py-2 text-xs grid grid-cols-[32px_1fr_1fr_1fr_1fr_1fr_32px] gap-2 border-b items-center", o.completed && "opacity-60")}>
                    <Checkbox checked={o.completed} onCheckedChange={(v) => updateOffboarding.mutate({ id: o.id, completed: !!v })} />
                    <Input className="h-7 text-xs" defaultValue={o.phase || ''} placeholder="Fase" onBlur={e => updateOffboarding.mutate({ id: o.id, phase: e.target.value })} />
                    <Input className={cn("h-7 text-xs", o.completed && "line-through")} defaultValue={o.activity} placeholder="Atividade" onBlur={e => updateOffboarding.mutate({ id: o.id, activity: e.target.value })} />
                    <Input className="h-7 text-xs" defaultValue={o.responsible || ''} placeholder="Responsável" onBlur={e => updateOffboarding.mutate({ id: o.id, responsible: e.target.value })} />
                    <Input className="h-7 text-xs" defaultValue={o.rule || ''} placeholder="Regra" onBlur={e => updateOffboarding.mutate({ id: o.id, rule: e.target.value })} />
                    <Input className="h-7 text-xs" defaultValue={(o as any).documents_links || ''} placeholder="URL/notas" onBlur={e => updateOffboarding.mutate({ id: o.id, documents_links: e.target.value } as any)} />
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteOffboarding.mutate(o.id)}><X className="h-3 w-3" /></Button>
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
          {/* ─── Customer Success ──────────────────────── */}
          <TabsContent value="customer-success" className="space-y-6 mt-4">
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

      {/* Sale dialog */}
      <SaleFormDialog
        open={saleOpen}
        onOpenChange={setSaleOpen}
        products={productList.map(p => p.name)}
        initialData={{ client: form.full_name || '' }}
        onSave={(sale) => {
          commercialData.upsertSale.mutate(sale);
          setSaleOpen(false);
        }}
      />

      {/* Meeting dialog */}
      <Dialog open={meetingOpen} onOpenChange={setMeetingOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova Reunião</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Título</Label>
              <Input value={meetingForm.title} onChange={e => setMeetingForm(p => ({ ...p, title: e.target.value }))} />
            </div>
            <div>
              <Label>Data & Hora</Label>
              <Input type="datetime-local" value={meetingForm.date_time} onChange={e => setMeetingForm(p => ({ ...p, date_time: e.target.value }))} />
            </div>
            <div>
              <Label>Link de Acesso</Label>
              <Input value={meetingForm.meeting_url} onChange={e => setMeetingForm(p => ({ ...p, meeting_url: e.target.value }))} placeholder="https://..." />
            </div>
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
