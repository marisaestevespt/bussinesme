import { useState, useEffect } from 'react';
import { enrichQuestionsWithAutoFill } from '@/lib/portalAutoFill';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Copy, Trash2, Plus, CalendarIcon, ExternalLink, Save, X, RefreshCw, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO, addDays } from 'date-fns';
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
import { useConfirm } from '@/components/ui/confirm-dialog';
import { DEPARTMENTS } from '@/lib/departments';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ClientCustomerSuccess } from '@/components/client/ClientCustomerSuccess';
import { BackNavigation } from '@/components/BackNavigation';
import { ClientFeedbackSection } from '@/components/client/ClientFeedbackSection';
import { CustomFieldsSection } from '@/components/CustomFieldsSection';
import { MeetingFormDialog } from '@/pages/Reunioes';
import { LeadPreviewDialog } from '@/components/commercial/crm/LeadPreviewDialog';
import { useClientFinancialHealth, HEALTH_BADGE } from '@/hooks/useClientFinancialHealth';
import { sumRevenue } from '@/lib/salesCalculations';
import { EmptyHint } from '@/components/ui/loading-skeletons';

// ─── Client Financial Health Card ────────────────────────────────
function ClientFinancialHealthCard({ clientName }: { clientName: string }) {
  const { getHealth } = useClientFinancialHealth();
  const health = getHealth(clientName);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Saúde Financeira</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4">
          <Badge variant="outline" className={`text-sm px-3 py-1 ${HEALTH_BADGE[health.status]?.className || ''}`}>
            {health.label}
          </Badge>
          <div className="flex gap-6 text-sm">
            <div>
              <span className="text-muted-foreground">Total: </span>
              <span className="font-medium">{health.total}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Pagos: </span>
              <span className="font-medium text-success">{health.paid}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Pendentes: </span>
              <span className="font-medium">{health.pending}</span>
            </div>
            {health.overdue > 0 && (
              <div>
                <span className="text-muted-foreground">Em atraso: </span>
                <span className="font-medium text-destructive">{health.overdue}</span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

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
          <Button
            variant="outline"
            className={cn(
              'w-full justify-start text-left font-normal text-sm h-10 px-3 rounded-lg border border-input bg-background !text-foreground shadow-none hover:bg-background hover:!text-foreground hover:border-input hover:translate-y-0 hover:shadow-none active:scale-100',
              !date && '!text-muted-foreground/60'
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
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
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [offboardingDialogOpen, setOffboardingDialogOpen] = useState(false);
  const [offboardingNps, setOffboardingNps] = useState(true);
  const [pendingPaymentsCount, setPendingPaymentsCount] = useState(0);
  const [pendingPaymentsTotal, setPendingPaymentsTotal] = useState(0);
  const [leadPreviewId, setLeadPreviewId] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const confirm = useConfirm();

  if (client && !initialized) { setForm(client); setInitialized(true); }
  if (isNew && !initialized) { setForm({ full_name: '', status: 'em_onboarding' }); setInitialized(true); }

  const update = (field: string, value: any) => setForm(prev => ({ ...prev, [field]: value }));

  const save = async (skipOffboardingCheck = false): Promise<string | null> => {
    if (!form.full_name?.trim()) { toast.error('Nome obrigatório'); return null; }
    try {
      const prevStatus = client?.status;
      const newStatus = form.status;

      if (isNew) {
        const { resolveProductId } = await import('@/lib/productResolver');
        const currentProductId = form.current_product
          ? await resolveProductId(form.current_product)
          : null;
        const { data, error } = await supabase.from('clients').insert({
          full_name: form.full_name,
          ...form,
          current_product_id: currentProductId,
        } as any).select('id').single();
        if (error) throw error;
        toast.success('Cliente guardado');
        if (form.current_product && form.start_date) {
          autoGenerateNps(data.id, form.current_product, form.start_date);
        }
        return data.id;
      } else {
        // Handle status transitions
        if (prevStatus !== newStatus && id) {
          // em_offboarding → show popup first
          if (newStatus === 'em_offboarding' && !skipOffboardingCheck) {
            // Check pending payments
            const unpaid = clientSales.filter(s => s.status !== 'pago' && s.status !== 'cancelada');
            setPendingPaymentsCount(unpaid.length);
            setPendingPaymentsTotal(unpaid.reduce((sum, s) => sum + Number(s.base_value || 0), 0));
            setOffboardingNps(true);
            setOffboardingDialogOpen(true);
            return null; // Don't save yet — wait for dialog confirmation
          }
          // terminado → set portal deactivation in 30 days
          if (newStatus === 'terminado') {
            const deactivationDate = format(addDays(new Date(), 30), 'yyyy-MM-dd');
            setForm(prev => ({ ...prev, portal_deactivation_date: deactivationDate }));
            form.portal_deactivation_date = deactivationDate;
          }
        }
        await upsertClient.mutateAsync(form as any);
        toast.success('Cliente guardado');
        return id || null;
      }
    } catch (err: any) {
      console.error('Client save error:', err);
      toast.error(err?.message || 'Erro ao guardar cliente');
      return null;
    }
  };

  const confirmOffboarding = async () => {
    if (!id) return;
    // 1. Seed offboarding checklist from product template
    await seedOffboardingChecklist(id, form.current_product || null);

    // 2. Add pending payments item to checklist if any
    if (pendingPaymentsCount > 0) {
      const { data: existing } = await supabase.from('client_offboarding')
        .select('id').eq('client_id', id).limit(100);
      const maxOrder = existing?.length || 0;
      await supabase.from('client_offboarding').insert({
        client_id: id,
        activity: `⚠️ Verificar ${pendingPaymentsCount} pagamento(s) pendente(s) — ${pendingPaymentsTotal.toFixed(2)}€`,
        phase: 'Financeiro',
        responsible: null,
        rule: 'Verificar antes de concluir offboarding',
        sort_order: 0,
        completed: false,
      });
      queryClient.invalidateQueries({ queryKey: ['client_offboarding', id] });
    }

    // 3. Schedule final NPS if requested
    if (offboardingNps && form.current_product) {
      const { data: prod } = await supabase.from('products').select('id').eq('name', form.current_product).maybeSingle();
      if (prod) {
        await supabase.from('client_nps_records').insert({
          client_id: id,
          product_id: prod.id,
          expected_date: format(new Date(), 'yyyy-MM-dd'),
          status: 'por_fazer',
          is_manual: false,
          notes: 'NPS Final — Offboarding',
        } as any);
        queryClient.invalidateQueries({ queryKey: ['client_nps_records'] });
        toast.success('NPS final agendado');
      }
    }

    // 4. Add history entry
    await supabase.from('client_history').insert({
      client_id: id,
      entry_date: format(new Date(), 'yyyy-MM-dd'),
      milestone: 'Início de offboarding',
      observations: pendingPaymentsCount > 0
        ? `${pendingPaymentsCount} pagamento(s) pendente(s): ${pendingPaymentsTotal.toFixed(2)}€`
        : null,
    });
    queryClient.invalidateQueries({ queryKey: ['client_history', id] });

    setOffboardingDialogOpen(false);

    // 5. Now save with skip flag
    await save(true);
  };

  const seedOffboardingChecklist = async (clientId: string, productName: string | null) => {
    if (!productName) return;
    // Find product
    const { data: prod } = await supabase.from('products').select('id').eq('name', productName).maybeSingle();
    if (!prod) return;
    // Fetch offboarding template
    const { data: templates } = await supabase
      .from('product_offboarding_templates' as any)
      .select('activity, phase, responsible, rule, sort_order')
      .eq('product_id', prod.id)
      .order('sort_order');
    if (!templates?.length) return;
    // Check if offboarding items already exist
    const { data: existing } = await supabase.from('client_offboarding').select('id').eq('client_id', clientId).limit(1);
    if (existing?.length) return;
    // Seed
    const rows = (templates as any[]).map(t => ({
      client_id: clientId,
      activity: t.activity || '',
      phase: t.phase || null,
      responsible: t.responsible || null,
      rule: t.rule || null,
      sort_order: t.sort_order || 0,
      completed: false,
    }));
    await supabase.from('client_offboarding').insert(rows);
    queryClient.invalidateQueries({ queryKey: ['client_offboarding', clientId] });
    toast.success('Checklist de offboarding criada');
  };

  const autoGenerateNps = async (clientId: string, productName: string, startDate: string) => {
    const { data: prod } = await supabase.from('products').select('id').eq('name', productName).maybeSingle();
    if (!prod) return;
    const { data: npsConfig } = await supabase.from('product_nps_config' as any).select('cadence_days').eq('product_id', prod.id).maybeSingle();
    const cadence = (npsConfig as any)?.cadence_days;
    if (!cadence) return;
    const start = parseISO(startDate);
    const records = [];
    for (let i = 1; i <= Math.floor(730 / cadence); i++) {
      records.push({
        client_id: clientId,
        product_id: prod.id,
        expected_date: format(addDays(start, cadence * i), 'yyyy-MM-dd'),
        status: 'por_fazer',
        is_manual: false,
      });
    }
    if (records.length) {
      await supabase.from('client_nps_records' as any).insert(records);
    }
  };

  const handleDuplicate = async () => {
    if (client) { await duplicateClient.mutateAsync(client); navigate('/hub/clientes'); }
  };
  const handleDelete = async () => {
    if (!client) return;
    const ok = await confirm({
      title: 'Eliminar cliente?',
      description: `O cliente "${client.full_name}" será removido. Vendas e tarefas associadas mantêm-se mas perdem a ligação.`,
      confirmText: 'Eliminar',
      variant: 'destructive',
    });
    if (!ok) return;
    await deleteClient.mutateAsync(client.id);
    navigate('/hub/clientes');
  };

  // Filtered payments
  const allSales = commercialData.sales.data || [];
  const clientSales = allSales.filter(s => s.client === form.full_name);

  // Filtered meetings
  const { data: clientMeetings = [] } = useFilteredMeetings(isNew ? undefined : id);

  // Create meeting
  // Profiles and projects for MeetingFormDialog
  const { data: meetingProfiles = [] } = useQuery({
    queryKey: ['profiles-for-meetings'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, user_id, full_name, avatar_url, role_title');
      return (data || []) as { id: string; user_id: string; full_name: string | null; avatar_url: string | null; role_title: string | null }[];
    },
  });
  const { data: meetingProjectOptions = [] } = useQuery({
    queryKey: ['projects-for-meetings'],
    queryFn: async () => {
      const { data } = await supabase.from('projects').select('id, name, client_id, client_name, department, type');
      return (data || []) as { id: string; name: string; client_id: string | null; client_name: string | null; department: string | null; type: string | null }[];
    },
  });
  const meetingClients = (commercialData.sales.data || [])
    .map(s => s.client)
    .filter((v, i, a) => v && a.indexOf(v) === i)
    .map(name => {
      const c = client;
      return { id: c?.id || '', full_name: name || '' };
    });
  // Build a proper clients list from our client + any others
  const meetingClientsList = client ? [{ id: client.id, full_name: client.full_name }] : [];

  const defaultRecurrenceEnd = form.end_of_cycle ? parseISO(form.end_of_cycle) : undefined;

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
      // Find the product by name to get cycle_duration and id
      const productList = products.data || [];
      const matchedProduct = form.current_product
        ? productList.find(p => p.name === form.current_product)
        : null;

      // Calculate deadline from start_date + cycle_duration (months)
      let deadline: string | null = null;
      if (form.start_date && matchedProduct?.cycle_duration) {
        const start = parseISO(form.start_date);
        const end = new Date(start);
        end.setMonth(end.getMonth() + matchedProduct.cycle_duration);
        deadline = format(end, 'yyyy-MM-dd');
      }

      const isRecurring = matchedProduct?.sales_type === 'avenca_mensal' || matchedProduct?.sales_type === 'subscricao';
      const { data, error } = await supabase.from('projects').insert({
        name,
        type: isRecurring ? 'cliente_servico_mensal' : 'cliente_projeto_unico',
        status: 'em_onboarding',
        department: 'clientes',
        departments: ['clientes', 'operacao'],
        client_name: form.full_name || null,
        client_id: isNew ? null : (id || null),
        product_id: matchedProduct?.id || null,
        product_name: form.current_product || null,
        start_date: form.start_date || null,
        deadline,
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

  // ─── Renewal / New Cycle ────────────────────────────────────────
  const [renewDialogOpen, setRenewDialogOpen] = useState(false);
  const [renewProduct, setRenewProduct] = useState('');
  const [renewCloseActive, setRenewCloseActive] = useState(true);
  const [renewStartDate, setRenewStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const activeProjects = clientProjects.filter((p: any) => !['concluido', 'cancelado', 'arquivado'].includes(p.status));

  const openRenewDialog = () => {
    setRenewProduct(form.current_product || '');
    setRenewCloseActive(activeProjects.length > 0);
    setRenewStartDate(format(new Date(), 'yyyy-MM-dd'));
    setRenewDialogOpen(true);
  };

  const handleRenew = useMutation({
    mutationFn: async () => {
      if (!renewProduct) throw new Error('Selecione um produto');
      if (!id) throw new Error('Cliente não guardado');

      const matchedProduct = productList.find(p => p.name === renewProduct);

      // 1. Optionally close active projects + snapshot to portal history
      if (renewCloseActive && activeProjects.length > 0) {
        // Get portal id for snapshots
        const { data: portalRow } = await supabase.from('client_portals').select('id').eq('client_id', id).maybeSingle();
        const portalId = portalRow?.id;

        for (const proj of activeProjects) {
          await supabase.from('projects').update({ status: 'concluido' }).eq('id', proj.id);

          // Save snapshot of project data to portal history
          if (portalId) {
            // Fetch project full details
            const { data: projDetail } = await supabase.from('projects')
              .select('name, product_name, start_date, deadline, notes')
              .eq('id', proj.id).maybeSingle();

            // Fetch project phases from project_phases
            const { data: projPhases } = await (supabase as any).from('project_phases')
              .select('name, status, sort_order')
              .eq('project_id', proj.id)
              .order('sort_order');

            // Fetch monthly summaries if any
            const { data: projSummaries } = await supabase.from('portal_monthly_summaries' as any)
              .select('month, year, content')
              .eq('portal_id', portalId)
              .order('year', { ascending: false })
              .order('month', { ascending: false });

            await supabase.from('portal_project_history' as any).insert({
              portal_id: portalId,
              project_id: proj.id,
              project_name: projDetail?.name || proj.name,
              product_name: projDetail?.product_name || null,
              start_date: projDetail?.start_date || null,
              end_date: format(new Date(), 'yyyy-MM-dd'),
              status: 'concluido',
              timeline_phases: (projPhases || []).map((p: any) => ({ title: p.name, status: p.status, sort_order: p.sort_order })),
              monthly_summaries: projSummaries || [],
              notes: projDetail?.notes || null,
            });

            // Clear current summaries for the new cycle
            await supabase.from('portal_monthly_summaries' as any).delete().eq('portal_id', portalId);
          }
        }
      }

      // 2. Calculate deadline
      let deadline: string | null = null;
      if (renewStartDate && matchedProduct?.cycle_duration) {
        const start = parseISO(renewStartDate);
        const end = new Date(start);
        end.setMonth(end.getMonth() + matchedProduct.cycle_duration);
        deadline = format(end, 'yyyy-MM-dd');
      }

      // 3. Create new project
      const isRecurringRenew = matchedProduct?.sales_type === 'avenca_mensal' || matchedProduct?.sales_type === 'subscricao';
      const { data: newProject, error: projError } = await supabase.from('projects').insert({
        name: `${renewProduct} — ${form.full_name || 'Cliente'}`,
        type: isRecurringRenew ? 'cliente_servico_mensal' : 'cliente_projeto_unico',
        status: 'em_onboarding',
        department: 'clientes',
        departments: ['clientes', 'operacao'],
        client_name: form.full_name || null,
        client_id: id,
        product_id: matchedProduct?.id || null,
        product_name: renewProduct,
        start_date: renewStartDate,
        deadline,
      }).select('id').single();
      if (projError) throw projError;

      // 4. Update client current_product, start_date and end_of_cycle
      await supabase.from('clients').update({
        current_product: renewProduct,
        current_product_id: matchedProduct?.id || null,
        start_date: renewStartDate,
        end_of_cycle: deadline,
        status: 'ativo',
      }).eq('id', id);

      // 5. Auto-create/reactivate portal if product type supports it
      if (matchedProduct?.product_type) {
        const projetoTypes = ['projeto_1_1', 'servico_pontual', 'consultoria_individual', 'consultoria_grupo', 'mentoria_individual', 'mentoria_grupo', 'workshop'];
        let portalType: 'projeto_unico' | 'servico_mensal' | null = null;
        if (projetoTypes.includes(matchedProduct.product_type)) portalType = 'projeto_unico';
        else if (matchedProduct.product_type === 'servico_mensal') portalType = 'servico_mensal';

        if (portalType) {
          const { data: existingPortal } = await supabase.from('client_portals').select('id').eq('client_id', id).maybeSingle();
          let portalId: string | null = null;
          if (!existingPortal) {
            const { data: newPortal } = await supabase.from('client_portals').insert({ client_id: id, portal_type: portalType, is_active: true }).select('id').single();
            portalId = newPortal?.id || null;
          } else {
            await supabase.from('client_portals').update({ is_active: true, portal_type: portalType }).eq('id', existingPortal.id);
            portalId = existingPortal.id;
          }

          // Copy diagnostic questions from product to portal
          if (portalId && matchedProduct?.id) {
            const { data: existingQ } = await supabase.from('portal_initial_questions').select('id').eq('portal_id', portalId).limit(1);
            if (!existingQ?.length) {
              const { data: diagQuestions } = await supabase
                .from('product_diagnostic_questions')
                .select('question, sort_order, question_group, answer_type, group_sort_order')
                .eq('product_id', matchedProduct.id)
                .order('group_sort_order')
                .order('sort_order');
              if (diagQuestions?.length) {
                // Fetch business data for auto-fill
                const { data: businessData } = await supabase.from('business_setup').select('*').limit(1).maybeSingle();
                const clientData = { email: form.email, nif: form.nif, fiscal_address: form.fiscal_address, full_name: form.full_name };
                const rows = diagQuestions.map((dq, i) => ({
                    portal_id: portalId!,
                    question: dq.question,
                    sort_order: dq.sort_order ?? i,
                    question_group: dq.question_group || null,
                    answer_type: dq.answer_type || 'text',
                    group_sort_order: dq.group_sort_order ?? 0,
                }));
                const enrichedRows = enrichQuestionsWithAutoFill(rows, clientData, businessData || null);
                await supabase.from('portal_initial_questions').insert(enrichedRows as any);
              }
            }
          }
        }
      }
      // 6. Add history entry
      await supabase.from('client_history').insert({
        client_id: id,
        entry_date: format(new Date(), 'yyyy-MM-dd'),
        milestone: `Renovação/Novo ciclo: ${renewProduct}`,
        observations: renewCloseActive && activeProjects.length > 0
          ? `Projetos anteriores concluídos: ${activeProjects.map((p: any) => p.name).join(', ')}`
          : null,
      });

      return newProject.id;
    },
    onSuccess: (projectId) => {
      queryClient.invalidateQueries({ queryKey: ['projects', 'client'] });
      queryClient.invalidateQueries({ queryKey: ['client'] });
      setRenewDialogOpen(false);
      setForm(prev => ({ ...prev, current_product: renewProduct, start_date: renewStartDate, status: 'ativo' }));
      toast.success('Novo ciclo criado com sucesso!');
      navigate(`/hub/projetos/${projectId}`);
    },
    onError: (err: any) => toast.error(err.message || 'Erro ao criar novo ciclo'),
  });

  if (!isNew && isLoading) {
    return <AppLayout><div className="space-y-6"><div className="h-8 w-48 animate-pulse rounded bg-muted" /><div className="grid gap-4 md:grid-cols-2"><div className="h-32 animate-pulse rounded-lg bg-muted" /><div className="h-32 animate-pulse rounded-lg bg-muted" /></div><div className="h-64 animate-pulse rounded-lg bg-muted" /></div></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="space-y-6 w-full">
        {/* Pending payments alert for offboarding */}
        {form.status === 'em_offboarding' && clientSales.filter(s => s.status !== 'pago' && s.status !== 'cancelada').length > 0 && (
          <div className="flex items-center gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
            <div>
              <p className="text-sm font-medium text-destructive">Pagamentos pendentes</p>
              <p className="text-xs text-muted-foreground">
                Este cliente tem {clientSales.filter(s => s.status !== 'pago' && s.status !== 'cancelada').length} pagamento(s)
                pendente(s) no valor de {clientSales.filter(s => s.status !== 'pago' && s.status !== 'cancelada').reduce((sum, s) => sum + Number(s.base_value || 0), 0).toFixed(2)}€
              </p>
            </div>
          </div>
        )}
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BackNavigation parentRoute="/hub/clientes" parentLabel="Clientes" />
            <div className="min-w-0 flex-1">
              <Input
                value={form.full_name || ''}
                onChange={e => update('full_name', e.target.value)}
                placeholder="Nome do cliente"
                className="text-xl font-bold border-none shadow-none px-0 h-auto focus-visible:ring-0 bg-transparent w-full min-w-[320px]"
              />
              {form.client_id && <p className="text-xs text-muted-foreground font-mono">{form.client_id}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isNew && <Button variant="outline" size="sm" onClick={handleDuplicate}><Copy className="h-4 w-4 mr-1" />Duplicar</Button>}
            {!isNew && <Button variant="outline" size="sm" className="text-destructive" onClick={handleDelete}><Trash2 className="h-4 w-4 mr-1" />Eliminar</Button>}
            {!isNew && (
              <Button variant="outline" size="sm" onClick={openRenewDialog}>
                <RefreshCw className="h-4 w-4 mr-1" />Renovar / Novo Ciclo
              </Button>
            )}
            <Button size="sm" onClick={() => save()}><Save className="h-4 w-4 mr-1" />Guardar</Button>
          </div>
        </div>

        {/* Properties */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Propriedades</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {/* Linha 1: ID | Status | Data de Início | Fim de Ciclo */}
            <div className="grid grid-cols-1 md:grid-cols-[120px_1fr_1fr_1fr] gap-4">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">ID</Label>
                <Input value={form.client_id || ''} onChange={e => update('client_id', e.target.value)} placeholder="Auto" className="font-mono text-xs" />
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
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Fim de Ciclo</Label>
                <Input value={form.end_of_cycle || ''} readOnly className="bg-muted/50 cursor-default text-muted-foreground" placeholder="Auto (do projeto)" />
              </div>
            </div>
            {/* Linha 2: Conversão | Produto Atual | Email | Whatsapp | Aniversário */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <DateField label="Data de Conversão" value={form.conversion_date || null} onChange={v => update('conversion_date', v)} />
              <div className="space-y-1 min-w-0">
                <Label className="text-xs text-muted-foreground">Produto Atual</Label>
                <Select value={form.current_product || ''} onValueChange={v => update('current_product', v)}>
                  <SelectTrigger className="[&>span]:truncate [&>span]:block [&>span]:max-w-full min-w-0">
                    <SelectValue placeholder="Selecionar" />
                  </SelectTrigger>
                  <SelectContent>
                    {productList.map(p => <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">E-mail</Label>
                <Input type="email" value={form.email || ''} onChange={e => update('email', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Whatsapp</Label>
                <Input value={form.whatsapp || ''} onChange={e => update('whatsapp', e.target.value)} />
              </div>
              <DateField label="Aniversário" value={form.birthday || null} onChange={v => update('birthday', v)} />
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

        {/* Custom Fields */}
        {!isNew && id && (
          <CustomFieldsSection entityType="client" entityId={id} showConfig={true} />
        )}

        {/* Final Settlement (offboarding/terminado) */}
        {(form.status === 'em_offboarding' || form.status === 'terminado') && !isNew && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Liquidação Final</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Valor de Liquidação (€)</Label>
                  <Input type="number" step="0.01" value={(form as any).final_settlement_amount || ''} onChange={e => update('final_settlement_amount', parseFloat(e.target.value) || 0)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Estado</Label>
                  <Select value={(form as any).final_settlement_status || 'pendente'} onValueChange={v => update('final_settlement_status', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pendente">Pendente</SelectItem>
                      <SelectItem value="parcial">Parcial</SelectItem>
                      <SelectItem value="liquidado">Liquidado</SelectItem>
                      <SelectItem value="perdido">Perdido</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Notas</Label>
                  <Input value={(form as any).final_settlement_notes || ''} onChange={e => update('final_settlement_notes', e.target.value)} placeholder="Notas sobre a liquidação..." />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

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
                <Button size="sm" variant="outline" onClick={async () => {
                  if (isNew) {
                    const newId = await save();
                    if (!newId) return;
                    navigate(`/hub/clientes/${newId}`, { replace: true });
                  }
                  setNewProjectName(`${form.full_name || 'Cliente'} — ${form.current_product || 'Projeto'}`);
                  setProjectDialogOpen(true);
                }}>
                  <Plus className="h-3 w-3 mr-1" />Novo Projeto
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <div className="bg-primary text-primary-foreground px-4 py-2 font-medium text-xs grid grid-cols-[1fr_120px_100px] gap-2">
                  <span>Projeto</span><span>Status</span><span>Data</span>
                </div>
                {clientProjects.length === 0 ? (
                  <EmptyHint>Sem projetos associados</EmptyHint>
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
                  <EmptyHint>Sem entradas</EmptyHint>
                ) : (history.data || []).map(h => {
                  const isCrm = !!(h as any).lead_id;
                  return isCrm ? (
                    <div
                      key={h.id}
                      className="px-4 py-2.5 text-xs grid grid-cols-[100px_1fr_1fr_32px] gap-2 border-b items-center cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => setLeadPreviewId((h as any).lead_id)}
                    >
                      <span>{h.entry_date ? format(parseISO(h.entry_date), 'dd/MM/yyyy') : '—'}</span>
                      <span className="text-primary font-medium">{h.milestone}</span>
                      <span className="text-muted-foreground">{h.observations || '—'}</span>
                      <ExternalLink className="h-3 w-3 text-muted-foreground" />
                    </div>
                  ) : (
                    <div key={h.id} className="px-4 py-2 text-xs grid grid-cols-[100px_1fr_1fr_32px] gap-2 border-b items-center">
                      <Input type="date" className="h-7 text-xs" defaultValue={h.entry_date} onBlur={e => updateHistory.mutate({ id: h.id, entry_date: e.target.value })} />
                      <Input className="h-7 text-xs" defaultValue={h.milestone} placeholder="O que aconteceu..." onBlur={e => updateHistory.mutate({ id: h.id, milestone: e.target.value })} />
                      <Input className="h-7 text-xs" defaultValue={h.observations || ''} placeholder="Observações" onBlur={e => updateHistory.mutate({ id: h.id, observations: e.target.value })} />
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteHistory.mutate(h.id)}><X className="h-3 w-3" /></Button>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── Tab 2: Gestão do Cliente ──────────────────── */}
          <TabsContent value="gestao" className="space-y-6 mt-4">
            {/* Financial Health */}
            {!isNew && <ClientFinancialHealthCard clientName={form.full_name || ''} />}
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
                  <EmptyHint>Sem reuniões associadas</EmptyHint>
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
                  <EmptyHint>Sem pagamentos associados</EmptyHint>
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
                    <span>Valor total: {sumRevenue(clientSales).toFixed(2)}€</span>
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
                      <Button variant="outline" aria-label="Abrir link externo" size="icon" asChild>
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
                      <Button variant="outline" aria-label="Abrir link externo" size="icon" asChild>
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

      {/* Meeting dialog — full form with recurrence support */}
      <MeetingFormDialog
        open={meetingOpen}
        onOpenChange={setMeetingOpen}
        profiles={meetingProfiles}
        projects={meetingProjectOptions}
        clients={meetingClientsList}
        defaultClientId={isNew ? undefined : id}
        defaultClientName={form.full_name || undefined}
        defaultRecurrenceEndDate={defaultRecurrenceEnd}
      />

      {/* New Project dialog */}
      <Dialog open={projectDialogOpen} onOpenChange={setProjectDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Novo Projeto</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome do Projeto</Label>
              <Input value={newProjectName} onChange={e => setNewProjectName(e.target.value)} placeholder="Ex: Cliente — Produto" />
            </div>
            <p className="text-xs text-muted-foreground">Cliente: <span className="font-medium text-foreground">{form.full_name || '—'}</span> (pré-associado)</p>
            <Button className="w-full" onClick={() => {
              if (!newProjectName.trim()) { toast.error('Nome obrigatório'); return; }
              createProject.mutate(newProjectName.trim());
            }}>Criar Projeto</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Renewal dialog */}
      <Dialog open={renewDialogOpen} onOpenChange={setRenewDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Renovar / Novo Ciclo</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Produto para o novo ciclo</Label>
              <Select value={renewProduct} onValueChange={setRenewProduct}>
                <SelectTrigger><SelectValue placeholder="Selecionar produto" /></SelectTrigger>
                <SelectContent>
                  {productList.map(p => <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {renewProduct && renewProduct !== form.current_product && (
                <p className="text-xs text-muted-foreground">
                  ⚠️ Produto diferente do atual ({form.current_product || 'nenhum'})
                </p>
              )}
            </div>

            <div className="space-y-1">
              <Label>Data de início do novo ciclo</Label>
              <Input type="date" value={renewStartDate} onChange={e => setRenewStartDate(e.target.value)} />
            </div>

            {activeProjects.length > 0 && (
              <div className="flex items-center justify-between gap-3 rounded-md border p-3">
                <div>
                  <p className="text-sm font-medium">Concluir projetos ativos?</p>
                  <p className="text-xs text-muted-foreground">
                    {activeProjects.length} projeto(s) ativo(s): {activeProjects.map((p: any) => p.name).join(', ')}
                  </p>
                </div>
                <Switch checked={renewCloseActive} onCheckedChange={setRenewCloseActive} />
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              Será criado um novo projeto, o produto atual do cliente será atualizado, e o portal será reactivado (se aplicável).
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenewDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => handleRenew.mutate()} disabled={!renewProduct || handleRenew.isPending}>
              {handleRenew.isPending ? 'A criar...' : 'Iniciar Novo Ciclo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Offboarding confirmation dialog */}
      <Dialog open={offboardingDialogOpen} onOpenChange={setOffboardingDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Iniciar Offboarding</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {pendingPaymentsCount > 0 && (
              <div className="flex items-start gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-3">
                <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-destructive">
                    {pendingPaymentsCount} pagamento(s) pendente(s)
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Valor total em aberto: {pendingPaymentsTotal.toFixed(2)}€.
                    Será adicionado um item à checklist de offboarding.
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between gap-3 rounded-md border p-3">
              <div>
                <p className="text-sm font-medium">Agendar NPS Final?</p>
                <p className="text-xs text-muted-foreground">
                  Cria um registo de NPS para recolher feedback antes de terminar.
                </p>
              </div>
              <Switch checked={offboardingNps} onCheckedChange={setOffboardingNps} />
            </div>

            <p className="text-xs text-muted-foreground">
              A checklist de offboarding será criada com base no template do produto.
              {pendingPaymentsCount > 0 && ' Um item de verificação de pagamentos pendentes será adicionado automaticamente.'}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOffboardingDialogOpen(false)}>Cancelar</Button>
            <Button onClick={confirmOffboarding}>Confirmar Offboarding</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lead CRM Preview Dialog */}
      <LeadPreviewDialog leadId={leadPreviewId} onClose={() => setLeadPreviewId(null)} />
    </AppLayout>
  );
}
