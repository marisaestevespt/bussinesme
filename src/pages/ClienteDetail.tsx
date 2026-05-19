import { useState, useEffect } from 'react';
import { enrichQuestionsWithAutoFill } from '@/lib/portalAutoFill';
import { useParams, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Copy, Trash2, Plus, CalendarIcon, ExternalLink, Save, X, RefreshCw, AlertTriangle, Hash, Activity, CalendarDays, Clock, Package, Mail, Phone, Cake, FileText, MapPin, NotebookText, Wallet, Link2, FolderOpen, MessageCircle, History, Briefcase, Heart, Users, Receipt, Calculator, User, Inbox, CheckCircle2 } from 'lucide-react';
import { ClientFinancialHealthCard } from '@/components/clients/ClientFinancialHealthCard';
import { useFilteredMeetings, DateField } from '@/components/clients/ClientDetailHelpers';
import { ClientQuotesSection } from '@/components/clients/ClientQuotesSection';
import { toast } from 'sonner';
import { format, parseISO, addDays } from 'date-fns';
import { pt } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { ProductIcon } from '@/components/entity-icon';
import { EntityHeroHeader, parseIcon } from '@/components/entity-icon';
import {
  useClient, useClients, useClientHistory,
  CLIENT_STATUS_OPTIONS, Client
} from '@/hooks/useClients';
import { getClientStatusInfo } from '@/lib/clientStatus';
import { useProducts } from '@/hooks/useProducts';
import { useCommercialData } from '@/hooks/useCommercialData';
import { EntryDetailSheet } from '@/components/financial/EntryDetailSheet';
import { ClientRequestsBlock } from '@/components/clients/ClientRequestsBlock';
import { ClientPortalHealthBlock } from '@/components/clients/ClientPortalHealthBlock';
import { supabase } from '@/integrations/supabase/client';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { DEPARTMENTS } from '@/lib/departments';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ClientCustomerSuccess } from '@/components/client/ClientCustomerSuccess';
import { ClientCustomerSuccessGallery } from '@/components/client/ClientCustomerSuccessGallery';
import { RenegotiationBlock } from '@/components/client/RenegotiationBlock';
import {
  EntityTitle,
  EntityTopBar,
  EntityProperties,
  EntityProperty,
  EntitySection,
  EntityTabs,
  EntityTabsList,
  EntityTabsTrigger,
  EntityTabsContent,
  inlineInputClass,
  inlineTriggerClass,
  type EntityAction,
} from '@/components/layout/entity';
import { ClientFeedbackSection } from '@/components/client/ClientFeedbackSection';
import { CustomFieldsSection } from '@/components/CustomFieldsSection';
import { MeetingFormDialog } from '@/pages/Reunioes';
import { LeadPreviewDialog } from '@/components/commercial/crm/LeadPreviewDialog';
import { sumRevenue, pendingSales } from '@/lib/salesCalculations';
import { EmptyHint } from '@/components/ui/loading-skeletons';
import { buildPaymentEntries } from '@/lib/paymentGenerator';
import { useAuth } from '@/hooks/useAuth';
import { PAYMENT_METHOD_OPTIONS } from '@/lib/salesConstants';
import { getEntryStatusBadge, getEffectiveEntryStatus } from '@/components/financial/EntryDetailSheet';
import { getProjectStatusInfo } from '@/lib/projectStatus';
import { getMeetingStatusInfo } from '@/lib/meetingStatus';
import { useSectorConfig } from '@/hooks/useSectorConfig';

function ClienteDetailPageInner() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = id === 'novo';
  const sectorConfig = useSectorConfig();

  const { data: client, isLoading } = useClient(isNew ? undefined : id);
  const { upsertClient, duplicateClient, deleteClient, reactivateClient } = useClients();
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
  const { user, isAdminOrOwner } = useAuth();

  // ─── Renewals (history + scheduled) ─────────────────────────────
  const renewalsQuery = useQuery({
    queryKey: ['client-renewals', id],
    queryFn: async () => {
      if (!id) return [];
      const { data } = await supabase.from('client_renewals')
        .select('*')
        .eq('client_id', id)
        .order('cycle_number', { ascending: false })
        .order('sort_order');
      return data || [];
    },
    enabled: !!id && !isNew,
  });

  const scheduledRenewalProjectQuery = useQuery({
    queryKey: ['scheduled-renewal-project', form.pending_renewal_project_id],
    queryFn: async () => {
      const pid = form.pending_renewal_project_id;
      if (!pid) return null;
      const { data } = await supabase.from('projects')
        .select('id, name, start_date, deadline, status, product_name')
        .eq('id', pid).maybeSingle();
      return data;
    },
    enabled: !!form.pending_renewal_project_id,
  });

  // ─── Rollback: latest activated renewal project (≠ scheduled) ───
  const latestActivatedRenewal = (() => {
    const pendingPid = form.pending_renewal_project_id || null;
    const items = (renewalsQuery.data || []) as any[];
    // pick highest cycle_number that has a project_id and isn't the scheduled one
    const candidate = items
      .filter(r => r.project_id && r.project_id !== pendingPid)
      .sort((a, b) => (b.cycle_number || 0) - (a.cycle_number || 0))[0];
    return candidate ? { project_id: candidate.project_id as string, cycle_number: candidate.cycle_number as number } : null;
  })();

  const rollbackProjectQuery = useQuery({
    queryKey: ['rollback-renewal-project', latestActivatedRenewal?.project_id],
    queryFn: async () => {
      if (!latestActivatedRenewal?.project_id) return null;
      const { data } = await supabase.from('projects')
        .select('id, name, status, created_at')
        .eq('id', latestActivatedRenewal.project_id).maybeSingle();
      return data;
    },
    enabled: !!latestActivatedRenewal?.project_id && isAdminOrOwner,
  });

  const canRollbackRenewal = (() => {
    if (!isAdminOrOwner || !latestActivatedRenewal || !rollbackProjectQuery.data) return false;
    const p = rollbackProjectQuery.data as any;
    if (!p?.created_at) return false;
    const ageDays = (Date.now() - new Date(p.created_at).getTime()) / (1000 * 60 * 60 * 24);
    return ageDays <= 7 && p.status !== 'cancelado';
  })();

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
        const { confirmNoClientDuplicates } = await import('@/lib/clientDuplicateCheck');
        const okDup = await confirmNoClientDuplicates({ nif: form.nif as string | null | undefined, email: form.email as string | null | undefined });
        if (!okDup) return null;
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
            const unpaid = pendingSales(clientSales);
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

    // 6. Send offboarding email to client (best-effort, non-blocking)
    if (form.email) {
      try {
        // Fetch business settings (brand) and owner profile
        const [{ data: bs }, { data: portal }, { data: profile }, { data: emailCustom }] = await Promise.all([
          supabase.from('business_settings').select('business_name,primary_color,accent_color,text_color,font_display,font_body,logo_url').maybeSingle(),
          supabase.from('client_portals').select('token').eq('client_id', id).eq('is_active', true).maybeSingle(),
          (async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return { data: null } as any;
            return supabase.from('profiles').select('full_name').eq('user_id', user.id).maybeSingle();
          })(),
          supabase.from('email_template_settings').select('*').eq('template_key', 'client-offboarding').maybeSingle(),
        ]);

        const portalUrl = portal?.token
          ? `${window.location.origin}/portal/${portal.token}/view`
          : window.location.origin;

        await supabase.functions.invoke('send-transactional-email', {
          body: {
            templateName: 'client-offboarding',
            recipientEmail: form.email,
            idempotencyKey: `client-offboarding-${id}-${Date.now()}`,
            templateData: {
              clientName: form.full_name || form.email,
              portalUrl,
              portalDays: 30,
              businessName: bs?.business_name || 'a equipa',
              ownerName: profile?.full_name || '',
              supportEmail: '',
              primaryColor: emailCustom?.primary_color || bs?.primary_color,
              primaryForeground: emailCustom?.primary_foreground || '0 0% 100%',
              textColor: emailCustom?.text_color || bs?.text_color,
              accentColor: emailCustom?.muted_color || bs?.accent_color,
              fontDisplay: emailCustom?.font_display || bs?.font_display,
              fontBody: emailCustom?.font_body || bs?.font_body,
              logoUrl: bs?.logo_url || undefined,
              customTitle: emailCustom?.title_text || undefined,
              customSubtitle: emailCustom?.subtitle_text || undefined,
              customCta: emailCustom?.cta_text || undefined,
              customFooter: emailCustom?.footer_text || undefined,
              customEmoji: emailCustom?.emoji || undefined,
            },
          },
        });
        toast.success('Email de offboarding enviado ao cliente');
      } catch (err) {
        console.error('Failed to send offboarding email', err);
        toast.error('Não foi possível enviar o email de offboarding');
      }
    }
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
    const { data: configs } = await supabase
      .from('product_nps_config' as any)
      .select('id, kind, title, cadence_days, questions')
      .eq('product_id', prod.id);
    const list = (configs || []) as any[];
    if (list.length === 0) return;
    const start = parseISO(startDate);
    const records: any[] = [];
    for (const cfg of list) {
      const cadence = Number(cfg?.cadence_days) || 0;
      if (cadence <= 0) continue;
      for (let i = 1; i <= Math.floor(730 / cadence); i++) {
        records.push({
          client_id: clientId,
          product_id: prod.id,
          config_id: cfg.id,
          kind: cfg.kind || 'nps',
          title: cfg.title || (cfg.kind === 'feedback' ? 'Feedback' : 'NPS'),
          questions: cfg.kind === 'feedback' ? (cfg.questions || []) : null,
          expected_date: format(addDays(start, cadence * i), 'yyyy-MM-dd'),
          status: 'por_fazer',
          is_manual: false,
        });
      }
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
  // Fetch all sales for this client across ALL years (current year hook is year-scoped)
  const { data: clientAllYearSales = [] } = useQuery({
    queryKey: ['client-all-sales', form.full_name],
    enabled: !!form.full_name,
    queryFn: async () => {
      const { data } = await supabase
        .from('commercial_sales')
        .select('id,sale_id,client,product,product_id,base_value,invoice_total,payment_date,status,sale_month,sale_quarter,sale_year,source,description,documents,project_id,created_at')
        .eq('client', form.full_name)
        .order('payment_date', { ascending: false });
      return data || [];
    },
    staleTime: 60 * 1000,
  });
  const clientSales = clientAllYearSales.length > 0
    ? clientAllYearSales
    : allSales.filter(s => s.client === form.full_name);

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
      const { data } = await supabase.from('projects').select('id, name, client_id, client_name, department, type').is('archived_at', null);
      return (data || []) as { id: string; name: string; client_id: string | null; client_name: string | null; department: string | null; type: string | null }[];
    },
  });
  // Active team members for Account Manager selector
  const { data: activeTeamMembers = [] } = useQuery({
    queryKey: ['team-members-active'],
    queryFn: async () => {
      const { data } = await supabase
        .from('team_members')
        .select('id, full_name, role_title, photo_url, works_with_clients')
        .eq('status', 'ativo')
        .eq('works_with_clients', true)
        .order('full_name');
      return (data || []) as { id: string; full_name: string; role_title: string | null; photo_url: string | null }[];
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
      const { data } = await supabase.from('projects').select('id, name, status, created_at, archived_at').eq('client_name', form.full_name).is('archived_at', null).order('created_at', { ascending: false });
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
  // Payment fields for renewal (mirrors ProjectGestaoTab)
  const [renewPayMethod, setRenewPayMethod] = useState('');
  const [renewTotalValue, setRenewTotalValue] = useState('');
  const [renewEntradaValue, setRenewEntradaValue] = useState('');
  const [renewNumPrestacoes, setRenewNumPrestacoes] = useState('');
  const [renewPayDay, setRenewPayDay] = useState('1');
  const [renewNumMeses, setRenewNumMeses] = useState('');
  const [renewAvencaValue, setRenewAvencaValue] = useState('');
  const [renewPaymentMethodType, setRenewPaymentMethodType] = useState('');

  const activeProjects = clientProjects.filter((p: any) => !['concluido', 'cancelado', 'arquivado'].includes(p.status));

  const openRenewDialog = () => {
    setRenewProduct(form.current_product || '');
    setRenewCloseActive(activeProjects.length > 0);
    // Default start = end_of_cycle of current cycle (or today if none)
    const defaultStart = form.end_of_cycle
      ? format(addDays(parseISO(form.end_of_cycle as string), 1), 'yyyy-MM-dd')
      : format(new Date(), 'yyyy-MM-dd');
    setRenewStartDate(defaultStart);
    // Pre-fill payment method based on current product type
    const curProd = productList.find(p => p.name === form.current_product);
    const defaultPay = curProd?.sales_type === 'avenca_mensal' || curProd?.sales_type === 'subscricao'
      ? 'avenca_mensal' : 'pagamento_total';
    setRenewPayMethod(defaultPay);
    setRenewTotalValue('');
    setRenewEntradaValue('');
    setRenewNumPrestacoes('');
    setRenewPayDay('1');
    setRenewNumMeses(curProd?.cycle_duration ? String(curProd.cycle_duration) : '');
    setRenewAvencaValue('');
    setRenewPaymentMethodType('');
    setRenewDialogOpen(true);
  };

  const handleRenew = useMutation({
    mutationFn: async () => {
      if (!renewProduct) throw new Error('Selecione um produto');
      if (!id) throw new Error('Cliente não guardado');

      const matchedProduct = productList.find(p => p.name === renewProduct);
      const today = new Date(); today.setHours(0,0,0,0);
      const startDateObj = parseISO(renewStartDate);
      const isFutureStart = startDateObj > today;

      // 1. Optionally close active projects NOW (only if start is today/past).
      //    For future start, we keep current project active and let the cron
      //    activate the scheduled project on its start date.
      if (renewCloseActive && !isFutureStart && activeProjects.length > 0) {
        // Get portal id for snapshots
        const { data: portalRow } = await supabase.from('client_portals').select('id').eq('client_id', id).maybeSingle();
        const portalId = portalRow?.id;

        const projIds = activeProjects.map((p: any) => p.id);

        // Batch close all active projects in a single UPDATE
        await supabase.from('projects').update({ status: 'concluido' }).in('id', projIds);

        if (portalId) {
          // Pre-fetch details + phases + summaries in parallel via .in() / single read
          const [detailsRes, phasesRes, summariesRes] = await Promise.all([
            supabase.from('projects')
              .select('id, name, product_name, start_date, deadline, notes')
              .in('id', projIds),
            supabase.from('project_phases')
              .select('project_id, name, status, sort_order')
              .in('project_id', projIds)
              .order('sort_order'),
            supabase.from('portal_monthly_summaries' as any)
              .select('month, year, content')
              .eq('portal_id', portalId)
              .order('year', { ascending: false })
              .order('month', { ascending: false }),
          ]);

          const detailsMap: Record<string, any> = {};
          (detailsRes.data || []).forEach((d: any) => { detailsMap[d.id] = d; });
          const phasesMap: Record<string, any[]> = {};
          ((phasesRes as any).data || []).forEach((p: any) => {
            (phasesMap[p.project_id] ||= []).push(p);
          });
          const summaries = summariesRes.data || [];

          // Bulk insert snapshots
          const historyRows = activeProjects.map((proj: any) => {
            const projDetail = detailsMap[proj.id];
            const projPhases = phasesMap[proj.id] || [];
            return {
              portal_id: portalId,
              project_id: proj.id,
              project_name: projDetail?.name || proj.name,
              product_name: projDetail?.product_name || null,
              start_date: projDetail?.start_date || null,
              end_date: format(new Date(), 'yyyy-MM-dd'),
              status: 'concluido',
              timeline_phases: projPhases.map((p: any) => ({ title: p.name, status: p.status, sort_order: p.sort_order })),
              monthly_summaries: summaries,
              notes: projDetail?.notes || null,
            };
          });
          await supabase.from('portal_project_history' as any).insert(historyRows);

          // Clear current summaries for the new cycle (only once)
          await supabase.from('portal_monthly_summaries' as any).delete().eq('portal_id', portalId);
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

      // 3. Create new project (scheduled if future, em_onboarding if today/past)
      const isRecurringRenew = matchedProduct?.sales_type === 'avenca_mensal' || matchedProduct?.sales_type === 'subscricao';
      const projStatus = isFutureStart ? 'agendado' : 'em_onboarding';
      const { data: newProject, error: projError } = await supabase.from('projects').insert({
        name: `${renewProduct} — ${form.full_name || 'Cliente'}`,
        type: isRecurringRenew ? 'cliente_servico_mensal' : 'cliente_projeto_unico',
        status: projStatus,
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

      // 3.1 Generate payments for the new cycle (do NOT filter from current month — renewal can be in future)
      try {
        const vatRate = Number(matchedProduct?.vat_rate) || 0;
        const entries = buildPaymentEntries({
          payMethod: renewPayMethod,
          startDate: renewStartDate,
          deadline,
          totalValue: renewTotalValue,
          entradaValue: renewEntradaValue,
          numPrestacoes: renewNumPrestacoes,
          payDay: renewPayDay,
          numMeses: renewNumMeses,
          avencaValue: renewAvencaValue,
          paymentMethodType: renewPaymentMethodType,
          product: renewProduct,
          client: form.full_name || '',
          projectId: newProject.id,
          vatRate,
          createdBy: user?.id || null,
          filterFromCurrentMonth: false,
        });
        if (entries.length > 0) {
          // Add product_id for ficheiro/sales linkage
          const enriched = entries.map(e => ({ ...e, product_id: matchedProduct?.id || null }));
          const { error: salesErr } = await supabase.from('commercial_sales').insert(enriched);
          if (salesErr) throw salesErr;
        }
      } catch (e: any) {
        // Don't block renewal if payment generation fails — surface a soft warning
        console.warn('Falha ao gerar pagamentos do novo ciclo:', e);
        toast.warning(`Projeto criado, mas pagamentos não foram gerados: ${e.message || e}`);
      }

      // 3.2 Create renewal checklist from product_renewal_templates
      const cycleNumber = (form.renewal_count || 0) + 1;
      const { data: templates } = await supabase
        .from('product_renewal_templates')
        .select('*')
        .eq('product_id', matchedProduct?.id)
        .order('sort_order');

      if (templates && templates.length > 0) {
        const renewalRows = templates.map((t: any, i: number) => {
          // Compute due_date from rule
          let dueDate: string | null = null;
          if (t.rule_days && deadline) {
            const refDate = parseISO(deadline);
            const offsetDays = (t.rule_unit === 'semanas' ? t.rule_days * 7 : t.rule_days) * (t.rule_trigger === 'apos_inicio_ciclo' ? 1 : -1);
            const due = new Date(refDate);
            due.setDate(due.getDate() + offsetDays);
            dueDate = format(due, 'yyyy-MM-dd');
          }
          return {
            client_id: id,
            cycle_number: cycleNumber,
            activity: t.name,
            phase: t.notes || null,
            responsible: t.responsible_type || null,
            rule_days: t.rule_days,
            rule_unit: t.rule_unit,
            rule_trigger: t.rule_trigger,
            due_date: dueDate,
            sort_order: t.sort_order ?? i,
            completed: false,
          };
        });
        await supabase.from('client_renewals').insert(renewalRows);
      }

      // 4. Update client current_product, start_date and end_of_cycle
      if (isFutureStart) {
        // Mark pending renewal — keep current product, but reset altura_renovacao→ativo
        // because the renewal is already organized (scheduled). The status will move
        // again automatically when the cron activates the scheduled project.
        const updates: any = { pending_renewal_project_id: newProject.id };
        if (form.status === 'altura_renovacao') updates.status = 'ativo';
        await supabase.from('clients').update(updates).eq('id', id);
      } else {
        await supabase.from('clients').update({
          current_product: renewProduct,
          current_product_id: matchedProduct?.id || null,
          start_date: renewStartDate,
          end_of_cycle: deadline,
          status: 'ativo',
          renewal_count: cycleNumber,
        }).eq('id', id);
      }

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
        milestone: isFutureStart
          ? `Renovação agendada para ${renewStartDate}: ${renewProduct}`
          : `Renovação/Novo ciclo: ${renewProduct}`,
        observations: renewCloseActive && activeProjects.length > 0
          ? `Projetos anteriores concluídos: ${activeProjects.map((p: any) => p.name).join(', ')}`
          : null,
      });

      // 7. Auto-close any active renegotiation as "renovada"
      if ((form as any).renegotiation_status === 'em_curso') {
        await supabase
          .from('clients')
          .update({ renegotiation_status: 'concluida_renovada' })
          .eq('id', id);
      }

      return newProject.id;
    },
    onSuccess: (projectId) => {
      queryClient.invalidateQueries({ queryKey: ['projects', 'client'] });
      queryClient.invalidateQueries({ queryKey: ['client'] });
      setRenewDialogOpen(false);
      const startObj = parseISO(renewStartDate);
      const today = new Date(); today.setHours(0,0,0,0);
      if (startObj > today) {
        setForm(prev => ({ ...prev, pending_renewal_project_id: projectId } as any));
        toast.success(`Renovação agendada para ${format(startObj, 'dd/MM/yyyy')}!`);
      } else {
        setForm(prev => ({
          ...prev,
          current_product: renewProduct,
          start_date: renewStartDate,
          status: 'ativo',
          ...((prev as any).renegotiation_status === 'em_curso' ? { renegotiation_status: 'concluida_renovada' } : {}),
        } as any));
        toast.success('Novo ciclo criado com sucesso!');
      }
      navigate(`/hub/projetos/${projectId}`);
    },
    onError: (err: any) => {
      const msg: string = err?.message || '';
      // Gap #13: friendly message when the unique index blocks a duplicate scheduled renewal
      if (msg.includes('uniq_one_scheduled_project_per_client')) {
        toast.error('Este cliente já tem uma renovação agendada. Cancela a anterior antes de agendar outra.');
      } else if (msg.includes('uniq_client_renewal_per_cycle')) {
        toast.error('Já existe um checklist de renovação para este ciclo.');
      } else {
        toast.error(msg || 'Erro ao criar novo ciclo');
      }
    },
  });

  if (!isNew && isLoading) {
    return <AppLayout><div className="space-y-6"><div className="h-8 w-48 animate-pulse rounded bg-muted" /><div className="grid gap-4 md:grid-cols-2"><div className="h-32 animate-pulse rounded-lg bg-muted" /><div className="h-32 animate-pulse rounded-lg bg-muted" /></div><div className="h-64 animate-pulse rounded-lg bg-muted" /></div></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="space-y-6 w-full">
        {/* Pending payments alert for offboarding */}
        {form.status === 'em_offboarding' && pendingSales(clientSales).length > 0 && (
          <div className="flex items-center gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
            <div>
              <p className="text-sm font-medium text-destructive">Pagamentos pendentes</p>
              <p className="text-xs text-muted-foreground">
                Este cliente tem {pendingSales(clientSales).length} pagamento(s)
                pendente(s) no valor de {pendingSales(clientSales).reduce((sum, s) => sum + Number(s.base_value || 0), 0).toFixed(2)}€
              </p>
            </div>
          </div>
        )}
        {/* Top bar */}
        <EntityTopBar
          backTo="/hub/clientes"
          backLabel={sectorConfig.t('clientes')}
          primaryAction={{ label: 'Guardar', icon: Save, onClick: () => save() }}
          secondaryActions={[
            ...(!isNew ? [{ label: 'Duplicar', icon: Copy, onClick: handleDuplicate, hideLabelOnMobile: true } as EntityAction] : []),
            ...(!isNew ? [{ label: 'Eliminar', icon: Trash2, onClick: handleDelete, variant: 'destructive', hideLabelOnMobile: true } as EntityAction] : []),
            ...(!isNew ? [{ label: 'Renovar / Novo Ciclo', icon: RefreshCw, onClick: openRenewDialog, hideLabelOnMobile: true } as EntityAction] : []),
          ]}
        />

        {/* Hero: cover + icon (Notion-style) */}
        <EntityHeroHeader
          icon={parseIcon(form.icon)}
          onIconChange={(next) => update('icon' as any, next as any)}
          coverUrl={form.cover_url}
          onCoverChange={(url) => update('cover_url' as any, url as any)}
          bucket="entity-icons"
          pathPrefix={`clients/${id || 'new'}`}
          iconVariant="circle"
          disabled={false}
        />

        {/* Title */}
        <EntityTitle
          title={form.full_name || ''}
          onTitleChange={(v) => update('full_name', v)}
          isOwner
          inlineMode
          placeholder="Nome do cliente"
          meta={
            <span className="flex items-center gap-2 flex-wrap">
              {form.client_id && <span className="text-xs text-muted-foreground font-mono">{form.client_id}</span>}
              {form.pending_renewal_project_id && (
                <Badge variant="outline" className="bg-accent-violet/15 text-accent-violet border-accent-violet/30 gap-1">
                  <RefreshCw className="h-3 w-3" /> Renovação agendada
                </Badge>
              )}
              {form.client_since && (
                <span className="text-xs text-muted-foreground">
                  Cliente desde {format(parseISO(form.client_since), 'MMM yyyy', { locale: pt })}
                </span>
              )}
            </span>
          }
        />

        {/* Properties */}
        <EntityProperties>
          <EntityProperty icon={Hash} label="ID">
            <Input value={form.client_id || ''} onChange={e => update('client_id', e.target.value)} placeholder="Auto" className={cn(inlineInputClass, 'font-mono text-xs')} />
          </EntityProperty>
          <EntityProperty icon={Activity} label="Status">
            <Select value={form.status || 'ativo'} onValueChange={v => update('status', v)}>
              <SelectTrigger className={inlineTriggerClass}>
                {(() => {
                  const info = getClientStatusInfo(form.status);
                  return (
                    <span className="flex items-center gap-2 min-w-0">
                      <span className={cn('inline-block h-2 w-2 rounded-full shrink-0', info.color.split(' ')[0].replace('/15', ''))} />
                      <span className="truncate">{info.label}</span>
                    </span>
                  );
                })()}
              </SelectTrigger>
              <SelectContent>
                {CLIENT_STATUS_OPTIONS.map(o => {
                  const info = getClientStatusInfo(o.value);
                  return (
                    <SelectItem key={o.value} value={o.value}>
                      <span className="flex items-center gap-2">
                        <span className={cn('inline-block h-2 w-2 rounded-full', info.color.split(' ')[0].replace('/15', ''))} />
                        {o.label}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </EntityProperty>
          <EntityProperty icon={CalendarDays} label="Data de Início">
            <Input type="date" value={form.start_date || ''} onChange={e => update('start_date', e.target.value || null)} className={inlineInputClass} />
          </EntityProperty>
          <EntityProperty icon={Clock} label="Fim de Ciclo">
            <Input value={form.end_of_cycle || ''} readOnly className={cn(inlineInputClass, 'text-muted-foreground')} placeholder="Auto (do projeto)" />
          </EntityProperty>
          <EntityProperty icon={CalendarDays} label="Conversão">
            <Input type="date" value={form.conversion_date || ''} onChange={e => update('conversion_date', e.target.value || null)} className={inlineInputClass} />
          </EntityProperty>
          <EntityProperty icon={Package} label="Produto Atual">
            <Select value={form.current_product || ''} onValueChange={v => update('current_product', v)}>
              <SelectTrigger className={cn(inlineTriggerClass, '[&>span]:truncate [&>span]:block [&>span]:max-w-full min-w-0')}>
                {form.current_product ? (
                  <span className="flex items-center gap-2 min-w-0">
                    <span
                      className="inline-block h-2 w-2 rounded-full shrink-0"
                      style={{ background: `hsl(${(form.current_product.split('').reduce((a,c)=>a+c.charCodeAt(0),0) * 47) % 360} 65% 55%)` }}
                    />
                    <span className="truncate">{form.current_product}</span>
                  </span>
                ) : <SelectValue placeholder="Selecionar" />}
              </SelectTrigger>
              <SelectContent>
                {productList.map(p => (
                  <SelectItem key={p.id} value={p.name}>
                    <span className="flex items-center gap-2">
                      <span
                        className="inline-block h-2 w-2 rounded-full"
                        style={{ background: `hsl(${(p.name.split('').reduce((a,c)=>a+c.charCodeAt(0),0) * 47) % 360} 65% 55%)` }}
                      />
                      {p.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </EntityProperty>
          <EntityProperty icon={Mail} label="E-mail">
            <Input type="email" value={form.email || ''} onChange={e => update('email', e.target.value)} className={inlineInputClass} placeholder="email@exemplo.com" />
          </EntityProperty>
          <EntityProperty icon={Phone} label="Whatsapp">
            <Input value={form.whatsapp || ''} onChange={e => update('whatsapp', e.target.value)} className={inlineInputClass} placeholder="+351 ..." />
          </EntityProperty>
          <EntityProperty icon={Cake} label="Aniversário">
            <Input type="date" value={form.birthday || ''} onChange={e => update('birthday', e.target.value || null)} className={inlineInputClass} />
          </EntityProperty>
          <EntityProperty icon={FileText} label="NIF">
            <Input value={form.nif || ''} onChange={e => update('nif', e.target.value)} className={inlineInputClass} placeholder="—" />
          </EntityProperty>
          <EntityProperty icon={MapPin} label="Morada Fiscal">
            <Input value={form.fiscal_address || ''} onChange={e => update('fiscal_address', e.target.value)} className={inlineInputClass} placeholder="—" />
          </EntityProperty>
          <EntityProperty icon={User} label="Responsável">
            <Select
              value={form.account_manager_id || 'none'}
              onValueChange={(v) => update('account_manager_id' as any, v === 'none' ? null : v)}
            >
              <SelectTrigger className={cn(inlineTriggerClass, '[&>span]:truncate [&>span]:block [&>span]:max-w-full min-w-0')}>
                {(() => {
                  const m = activeTeamMembers.find(x => x.id === form.account_manager_id);
                  if (!m) return <SelectValue placeholder="Sem responsável" />;
                  return (
                    <span className="flex items-center gap-2 min-w-0">
                      <Avatar className="h-5 w-5 shrink-0">
                        {m.photo_url && <AvatarImage src={m.photo_url} alt={m.full_name} />}
                        <AvatarFallback className="text-[9px]">{m.full_name?.[0] || '?'}</AvatarFallback>
                      </Avatar>
                      <span className="truncate">{m.full_name}</span>
                    </span>
                  );
                })()}
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem responsável</SelectItem>
                {activeTeamMembers.map(m => (
                  <SelectItem key={m.id} value={m.id}>
                    <span className="flex items-center gap-2">
                      <Avatar className="h-5 w-5">
                        {m.photo_url && <AvatarImage src={m.photo_url} alt={m.full_name} />}
                        <AvatarFallback className="text-[9px]">{m.full_name?.[0] || '?'}</AvatarFallback>
                      </Avatar>
                      {m.full_name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </EntityProperty>
        </EntityProperties>

        {/* Observações */}
        <EntitySection title="Observações" icon={NotebookText}>
          <Textarea value={form.observations || ''} onChange={e => update('observations', e.target.value)} rows={3} placeholder="Notas sobre este cliente..." />
        </EntitySection>

        {/* Custom Fields */}
        {!isNew && id && (
          <CustomFieldsSection entityType="client" entityId={id} showConfig={true} />
        )}

        {/* Final Settlement (offboarding/terminado) */}
        {(form.status === 'em_offboarding' || form.status === 'terminado') && !isNew && (
          <EntitySection title="Liquidação Final" icon={Wallet}>
            {form.status === 'terminado' && id && (
              <div className="mb-4 flex items-center justify-between gap-3 rounded-md border border-border bg-muted/30 p-3">
                <div className="text-xs text-muted-foreground">
                  Este cliente está terminado. Se voltou a contratar, reactiva em vez de criar novo registo — preserva o histórico, NIF e ID de cliente.
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => reactivateClient.mutate(id)}
                  disabled={reactivateClient.isPending}
                >
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                  Reactivar cliente
                </Button>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Valor de Liquidação (€)</Label>
                  <Input type="number" step="0.01" value={form.final_settlement_amount || ''} onChange={e => update('final_settlement_amount', parseFloat(e.target.value) || 0)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Estado</Label>
                  <Select value={form.final_settlement_status || 'pendente'} onValueChange={v => update('final_settlement_status', v)}>
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
                  <Input value={form.final_settlement_notes || ''} onChange={e => update('final_settlement_notes', e.target.value)} placeholder="Notas sobre a liquidação..." />
                </div>
            </div>
          </EntitySection>
        )}

        {/* Tabs */}
        <EntityTabs defaultValue="jornada" className="w-full">
          <EntityTabsList>
            <EntityTabsTrigger value="jornada">Jornada</EntityTabsTrigger>
            <EntityTabsTrigger value="gestao">Gestão do Cliente</EntityTabsTrigger>
            <EntityTabsTrigger value="pedidos">Pedidos</EntityTabsTrigger>
            <EntityTabsTrigger value="links">Links</EntityTabsTrigger>
            <EntityTabsTrigger value="customer-success">Customer Success</EntityTabsTrigger>
          </EntityTabsList>

          {/* ─── Tab 1: Jornada ───────────────────────────── */}
          <EntityTabsContent value="jornada" className="space-y-6 mt-4">
            {/* Projects history */}
            <EntitySection
              title="Histórico de Projetos"
              icon={Briefcase}
              action={
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
              }
            >
              <div className="rounded-lg border overflow-hidden bg-card">
                <div className="bg-primary text-primary-foreground px-4 py-3 font-semibold text-xs uppercase tracking-wide grid grid-cols-[1fr_140px_120px] gap-3">
                  <span>Projeto</span><span>Status</span><span>Data</span>
                </div>
                {clientProjects.length === 0 ? (
                  <EmptyHint>Sem projetos associados</EmptyHint>
                ) : clientProjects.map((p: any) => {
                  const ps = getProjectStatusInfo(p.status);
                  return (
                    <div
                      key={p.id}
                      className="px-4 py-3 text-sm grid grid-cols-[1fr_140px_120px] gap-3 border-b last:border-b-0 items-center cursor-pointer hover:bg-muted/40 transition-colors"
                      onClick={() => navigate(`/hub/projetos/${p.id}`)}
                    >
                      <span className="font-medium truncate">{p.name}</span>
                      <Badge variant="outline" className={`${ps.color} w-fit whitespace-nowrap`}>{ps.label}</Badge>
                      <span className="text-muted-foreground">{p.created_at ? format(parseISO(p.created_at), 'dd/MM/yyyy') : '—'}</span>
                    </div>
                  );
                })}
              </div>
            </EntitySection>

            {/* Client history */}
            <EntitySection
              title="Histórico do Cliente"
              icon={History}
              action={!isNew ? (
                  <Button size="sm" variant="outline" onClick={() => addHistory.mutateAsync({ client_id: id!, milestone: '', entry_date: format(new Date(), 'yyyy-MM-dd') })}>
                    <Plus className="h-3 w-3 mr-1" />Nova Entrada
                  </Button>
                ) : undefined}
            >
              <div className="rounded-lg border overflow-hidden bg-card">
                <div className="bg-primary text-primary-foreground px-4 py-3 font-semibold text-xs uppercase tracking-wide grid grid-cols-[110px_1fr_1fr_40px] gap-3">
                  <span>Data</span><span>Entrada</span><span>Observações</span><span></span>
                </div>
                {(history.data || []).length === 0 ? (
                  <EmptyHint>Sem entradas</EmptyHint>
                ) : (history.data || []).map(h => {
                  const isCrm = !!(h as any).lead_id;
                  return isCrm ? (
                    <div
                      key={h.id}
                      className="px-4 py-3 text-sm grid grid-cols-[110px_1fr_1fr_40px] gap-3 border-b last:border-b-0 items-center cursor-pointer hover:bg-muted/40 transition-colors"
                      onClick={() => setLeadPreviewId((h as any).lead_id)}
                    >
                      <span>{h.entry_date ? format(parseISO(h.entry_date), 'dd/MM/yyyy') : '—'}</span>
                      <span className="text-primary font-medium">{h.milestone}</span>
                      <span className="text-muted-foreground">{h.observations || '—'}</span>
                      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                  ) : (
                    <div key={h.id} className="px-4 py-2.5 text-sm grid grid-cols-[110px_1fr_1fr_40px] gap-3 border-b last:border-b-0 items-center">
                      <Input type="date" className="h-9 text-sm" defaultValue={h.entry_date} onBlur={e => updateHistory.mutate({ id: h.id, entry_date: e.target.value })} />
                      <Input className="h-9 text-sm" defaultValue={h.milestone} placeholder="O que aconteceu..." onBlur={e => updateHistory.mutate({ id: h.id, milestone: e.target.value })} />
                      <Input className="h-9 text-sm" defaultValue={h.observations || ''} placeholder="Observações" onBlur={e => updateHistory.mutate({ id: h.id, observations: e.target.value })} />
                      <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive" onClick={() => deleteHistory.mutate(h.id)}><X className="h-3.5 w-3.5" /></Button>
                    </div>
                  );
                })}
              </div>
            </EntitySection>

            {/* Renewals */}
            {!isNew && (
              <EntitySection title="Renovações" icon={RefreshCw}>
                <div className="space-y-3">
                  {scheduledRenewalProjectQuery.data && (
                    <div className="flex items-start justify-between gap-3 rounded-lg border border-accent-violet/40 bg-accent-violet/5 p-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="bg-accent-violet/15 text-accent-violet border-accent-violet/30 gap-1">
                            <RefreshCw className="h-3 w-3" /> Renovação agendada
                          </Badge>
                          <span className="text-sm font-medium">{scheduledRenewalProjectQuery.data.product_name}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Início: {scheduledRenewalProjectQuery.data.start_date ? format(parseISO(scheduledRenewalProjectQuery.data.start_date), 'dd MMM yyyy', { locale: pt }) : '—'}
                          {scheduledRenewalProjectQuery.data.deadline && ` • Fim: ${format(parseISO(scheduledRenewalProjectQuery.data.deadline), 'dd MMM yyyy', { locale: pt })}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" onClick={() => navigate(`/hub/projetos/${scheduledRenewalProjectQuery.data!.id}`)}>
                          <ExternalLink className="h-3 w-3 mr-1" />Ver
                        </Button>
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={async () => {
                          if (!await confirm({ title: 'Cancelar renovação agendada?', description: 'O projeto agendado será eliminado e os pagamentos pendentes removidos.' })) return;
                          const { data, error } = await supabase.rpc('cancel_scheduled_renewal', { _client_id: id });
                          if (error) { toast.error(error.message || 'Erro ao cancelar renovação'); return; }
                          setForm(prev => ({ ...prev, pending_renewal_project_id: null } as any));
                          queryClient.invalidateQueries({ queryKey: ['scheduled-renewal-project'] });
                          queryClient.invalidateQueries({ queryKey: ['client-renewals', id] });
                          queryClient.invalidateQueries({ queryKey: ['projects', 'client'] });
                          const r = data as any;
                          toast.success(`Renovação cancelada — ${r?.deleted_renewals || 0} item(ns) da checklist e ${r?.deleted_sales || 0} pagamento(s) removidos`);
                        }}>
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  )}
                  <div className="rounded-lg border overflow-hidden bg-card">
                    {canRollbackRenewal && latestActivatedRenewal && (
                      <div className="flex items-center justify-between gap-3 px-4 py-2 bg-warning/10 border-b border-warning/30 text-xs">
                        <span className="text-warning-foreground">
                          Ciclo #{latestActivatedRenewal.cycle_number} ativado há pouco (≤ 7 dias). Podes reverter se foi por engano.
                        </span>
                        <Button size="sm" variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/10" onClick={async () => {
                          if (!await confirm({
                            title: `Reverter ciclo #${latestActivatedRenewal.cycle_number}?`,
                            description: 'O projeto, checklist e pagamentos pendentes deste ciclo serão eliminados. Pagamentos já pagos bloqueiam a operação.',
                          })) return;
                          const { data, error } = await supabase.rpc('rollback_renewal_project', { _project_id: latestActivatedRenewal.project_id });
                          if (error) { toast.error(error.message || 'Erro ao reverter renovação'); return; }
                          queryClient.invalidateQueries({ queryKey: ['client-renewals', id] });
                          queryClient.invalidateQueries({ queryKey: ['rollback-renewal-project'] });
                          queryClient.invalidateQueries({ queryKey: ['projects', 'client'] });
                          queryClient.invalidateQueries({ queryKey: ['client', id] });
                          const r = data as any;
                          toast.success(`Ciclo revertido — ${r?.deleted_renewal_items || 0} item(ns) e ${r?.deleted_payments || 0} pagamento(s) removidos`);
                        }}>
                          Reverter ciclo
                        </Button>
                      </div>
                    )}
                    <div className="bg-primary text-primary-foreground px-4 py-3 font-semibold text-xs uppercase tracking-wide grid grid-cols-[70px_1fr_140px_120px_110px] gap-3">
                      <span>Ciclo</span><span>Atividade</span><span>Responsável</span><span>Prazo</span><span>Estado</span>
                    </div>
                    {(renewalsQuery.data || []).length === 0 ? (
                      <EmptyHint>Sem renovações registadas</EmptyHint>
                    ) : (renewalsQuery.data || []).map((r: any) => (
                      <div key={r.id} className="px-4 py-3 text-sm grid grid-cols-[70px_1fr_140px_120px_110px] gap-3 border-b last:border-b-0 items-center">
                        <Badge variant="outline" className="bg-accent-violet/15 text-accent-violet border-accent-violet/30 w-fit">#{r.cycle_number}</Badge>
                        <span className="font-medium truncate">{r.activity}</span>
                        <span className="text-muted-foreground truncate">{r.responsible || '—'}</span>
                        <span className="text-muted-foreground">{r.due_date ? format(parseISO(r.due_date), 'dd/MM/yyyy') : '—'}</span>
                        <Badge variant="outline" className={`w-fit whitespace-nowrap ${r.completed ? 'bg-success/15 text-success border-success/30' : 'bg-warning/15 text-warning border-warning/30'}`}>
                          {r.completed ? 'Concluída' : 'Pendente'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </EntitySection>
            )}
          </EntityTabsContent>

          {/* ─── Tab 2: Gestão do Cliente ──────────────────── */}
          <EntityTabsContent value="gestao" className="space-y-6 mt-4">
            {!isNew && (
              <RenegotiationBlock
                status={(form as any).renegotiation_status}
                reason={(form as any).renegotiation_reason}
                startedAt={(form as any).renegotiation_started_at}
                ownerId={(form as any).renegotiation_owner_id}
                notes={(form as any).renegotiation_notes}
                onChange={(f, v) => { update(f, v); setTimeout(() => save(), 0); }}
                onRenewCycle={openRenewDialog}
              />
            )}
            {/* Financial Health */}
            {!isNew && <ClientFinancialHealthCard clientName={form.full_name || ''} />}
            {/* Portal Health */}
            {!isNew && form.id && <ClientPortalHealthBlock clientId={form.id} />}
            {/* Meetings */}
            <EntitySection
              title={sectorConfig.t('reunioes')}
              icon={Users}
              action={<Button size="sm" variant="outline" onClick={() => setMeetingOpen(true)}><Plus className="h-3 w-3 mr-1" />Nova Reunião</Button>}
            >
              <div className="rounded-lg border overflow-hidden bg-card">
                <div className="bg-primary text-primary-foreground px-4 py-3 font-semibold text-xs uppercase tracking-wide grid grid-cols-[140px_160px_1fr_1fr_60px] gap-3">
                  <span>Status</span><span>Data & Hora</span><span>Reunião</span><span>Participantes</span><span>Link</span>
                </div>
                {clientMeetings.length === 0 ? (
                  <EmptyHint>Sem reuniões associadas</EmptyHint>
                ) : clientMeetings.map((m: any) => {
                  const ms = getMeetingStatusInfo(m.status);
                  return (
                    <div key={m.id} className="px-4 py-3 text-sm grid grid-cols-[140px_160px_1fr_1fr_60px] gap-3 border-b last:border-b-0 items-center">
                      <Badge variant="outline" className={`${ms.color} w-fit whitespace-nowrap`}>{ms.label}</Badge>
                      <span className="text-muted-foreground">{m.date_time ? format(parseISO(m.date_time), 'dd/MM/yyyy HH:mm') : '—'}</span>
                      <span className="font-medium truncate">{m.title}</span>
                      <span className="text-muted-foreground truncate">
                        {m.meeting_participants?.map((p: any) => p.profiles?.full_name).filter(Boolean).join(', ') || '—'}
                      </span>
                      <span>
                        {m.transcript_url ? <a href={m.transcript_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center text-primary hover:underline"><ExternalLink className="h-4 w-4" /></a> : <span className="text-muted-foreground">—</span>}
                      </span>
                    </div>
                  );
                })}
              </div>
            </EntitySection>

            {/* Payments */}
            <EntitySection title="Pagamentos" icon={Receipt}>
              <div className="rounded-lg border overflow-hidden bg-card">
                <div className="bg-primary text-primary-foreground px-4 py-3 font-semibold text-xs uppercase tracking-wide grid grid-cols-[130px_110px_1fr_110px_110px_180px] gap-3">
                  <span>Status</span><span>Data</span><span>Descrição</span><span>Valor Base</span><span>Fatura</span><span>Produto</span>
                </div>
                {clientSales.length === 0 ? (
                  <EmptyHint>Sem pagamentos associados</EmptyHint>
                ) : clientSales.map(s => {
                  const eff = getEffectiveEntryStatus(s.status, s.payment_date ?? null);
                  const sb = getEntryStatusBadge(eff);
                  return (
                    <div key={s.id} className="px-4 py-3 text-sm grid grid-cols-[130px_110px_1fr_110px_110px_180px] gap-3 border-b last:border-b-0 items-center cursor-pointer hover:bg-muted/40 transition-colors" onClick={() => { setSelectedPayment(s); setPaymentSheetOpen(true); }}>
                      <Badge variant="outline" className={`${sb.cls} w-fit whitespace-nowrap`}>{sb.label}</Badge>
                      <span className="text-muted-foreground">{s.payment_date || '—'}</span>
                      <span className="truncate">{s.description || <span className="text-muted-foreground">—</span>}</span>
                      <span className="font-medium tabular-nums">{Number(s.base_value).toFixed(2)}€</span>
                      <span className="font-medium tabular-nums">{Number(s.invoice_total).toFixed(2)}€</span>
                      <span className="truncate inline-flex items-center gap-1.5">
                        {s.product_id ? <ProductIcon productId={s.product_id as any} className="h-4 w-4" emojiClassName="text-[10px]" /> : null}
                        <span className="truncate">{s.product || '—'}</span>
                      </span>
                    </div>
                  );
                })}
                {clientSales.length > 0 && (
                  <div className="px-4 py-3 text-sm font-semibold border-t bg-muted/30 flex justify-between">
                    <span>Total: {clientSales.length} pagamento(s)</span>
                    <span className="tabular-nums">Valor total: {sumRevenue(clientSales).toFixed(2)}€</span>
                  </div>
                )}
              </div>
            </EntitySection>

            <EntryDetailSheet sale={selectedPayment} open={paymentSheetOpen} onOpenChange={setPaymentSheetOpen} />
          </EntityTabsContent>

          {/* ─── Tab: Pedidos ──────────────────────────────── */}
          <EntityTabsContent value="pedidos" className="space-y-6 mt-4">
            {!isNew && form.id ? (
              <ClientRequestsBlock clientId={form.id} />
            ) : (
              <EmptyHint>Disponível depois de guardar o cliente.</EmptyHint>
            )}
          </EntityTabsContent>

          {/* ─── Tab: Links ───────────────────────────────── */}
          <EntityTabsContent value="links" className="space-y-6 mt-4">
            <EntitySection title="Links" icon={Link2}>
              <div className="space-y-4">
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
                    <Input value={form.whatsapp_group_url || ''} onChange={e => update('whatsapp_group_url' as any, e.target.value)} placeholder="https://chat.whatsapp.com/..." />
                    {form.whatsapp_group_url && (
                      <Button variant="outline" aria-label="Abrir link externo" size="icon" asChild>
                        <a href={form.whatsapp_group_url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /></a>
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </EntitySection>
          </EntityTabsContent>

          {/* ─── Tab 3: Customer Success ──────────────────── */}
          <EntityTabsContent value="customer-success" className="mt-4">
            <ClientCustomerSuccessGallery
              clientId={isNew ? undefined : id}
              clientName={form.full_name || ''}
              productName={form.current_product || null}
              startDate={form.start_date || null}
              isNew={isNew}
            />
          </EntityTabsContent>
        </EntityTabs>
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Data de início do novo ciclo</Label>
                <Input type="date" value={renewStartDate} onChange={e => setRenewStartDate(e.target.value)} />
                {(() => {
                  const startObj = parseISO(renewStartDate);
                  const today = new Date(); today.setHours(0,0,0,0);
                  return startObj > today ? (
                    <p className="text-xs text-info">
                      📅 Data futura — projeto será criado como <b>agendado</b> e ativado automaticamente.
                    </p>
                  ) : null;
                })()}
              </div>
              <div className="space-y-1">
                <Label>Método de pagamento</Label>
                <Select value={renewPayMethod} onValueChange={setRenewPayMethod}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pagamento_total">Pagamento Total</SelectItem>
                    <SelectItem value="entrada_prestacoes">Entrada + Prestações</SelectItem>
                    <SelectItem value="prestacoes">Prestações</SelectItem>
                    <SelectItem value="avenca_mensal">Avença Mensal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Payment-specific fields */}
            <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
              <p className="text-xs font-medium text-muted-foreground">Configuração dos pagamentos</p>

              {renewPayMethod === 'pagamento_total' && (
                <div className="space-y-1">
                  <Label>Valor total (€)</Label>
                  <Input type="number" step="0.01" value={renewTotalValue} onChange={e => setRenewTotalValue(e.target.value)} />
                </div>
              )}

              {renewPayMethod === 'entrada_prestacoes' && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label>Valor total (€)</Label><Input type="number" step="0.01" value={renewTotalValue} onChange={e => setRenewTotalValue(e.target.value)} /></div>
                  <div className="space-y-1"><Label>Entrada (€)</Label><Input type="number" step="0.01" value={renewEntradaValue} onChange={e => setRenewEntradaValue(e.target.value)} /></div>
                  <div className="space-y-1"><Label>Nº prestações</Label><Input type="number" value={renewNumPrestacoes} onChange={e => setRenewNumPrestacoes(e.target.value)} /></div>
                  <div className="space-y-1"><Label>Dia de pagamento</Label><Input type="number" min="1" max="28" value={renewPayDay} onChange={e => setRenewPayDay(e.target.value)} /></div>
                </div>
              )}

              {renewPayMethod === 'prestacoes' && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1"><Label>Valor total (€)</Label><Input type="number" step="0.01" value={renewTotalValue} onChange={e => setRenewTotalValue(e.target.value)} /></div>
                  <div className="space-y-1"><Label>Nº prestações</Label><Input type="number" value={renewNumPrestacoes} onChange={e => setRenewNumPrestacoes(e.target.value)} /></div>
                  <div className="space-y-1"><Label>Dia de pagamento</Label><Input type="number" min="1" max="28" value={renewPayDay} onChange={e => setRenewPayDay(e.target.value)} /></div>
                </div>
              )}

              {renewPayMethod === 'avenca_mensal' && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1"><Label>Valor mensal (€)</Label><Input type="number" step="0.01" value={renewAvencaValue} onChange={e => setRenewAvencaValue(e.target.value)} /></div>
                  <div className="space-y-1"><Label>Nº meses</Label><Input type="number" value={renewNumMeses} onChange={e => setRenewNumMeses(e.target.value)} /></div>
                  <div className="space-y-1"><Label>Dia de pagamento</Label><Input type="number" min="1" max="28" value={renewPayDay} onChange={e => setRenewPayDay(e.target.value)} /></div>
                </div>
              )}

              <div className="space-y-1">
                <Label>Forma de cobrança (opcional)</Label>
                <Select value={renewPaymentMethodType} onValueChange={setRenewPaymentMethodType}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHOD_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {activeProjects.length > 0 && (
              <div className="flex items-center justify-between gap-3 rounded-md border p-3">
                <div>
                  <p className="text-sm font-medium">Concluir projetos ativos?</p>
                  <p className="text-xs text-muted-foreground">
                    {activeProjects.length} projeto(s) ativo(s): {activeProjects.map((p: any) => p.name).join(', ')}
                  </p>
                  {(() => {
                    const startObj = parseISO(renewStartDate);
                    const today = new Date(); today.setHours(0,0,0,0);
                    return startObj > today ? (
                      <p className="text-xs text-muted-foreground mt-1">
                        ℹ️ Como a data é futura, os projetos atuais serão concluídos automaticamente apenas quando o novo ciclo arrancar.
                      </p>
                    ) : null;
                  })()}
                </div>
                <Switch checked={renewCloseActive} onCheckedChange={setRenewCloseActive} />
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              Será criado um novo projeto, gerados os pagamentos do novo ciclo, criada a checklist de renovação a partir do template do produto, e o portal será reactivado (se aplicável).
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

import { DetailAccessGuard } from '@/components/access/DetailAccessGuard';

export default function ClienteDetailPage() {
  const { id } = useParams<{ id: string }>();
  // 'novo' = criação de cliente, sem id ainda → não aplica guard
  if (!id || id === 'novo') return <ClienteDetailPageInner />;
  return (
    <DetailAccessGuard entity="client" id={id}>
      <ClienteDetailPageInner />
    </DetailAccessGuard>
  );
}
