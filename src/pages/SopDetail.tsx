import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTeamData } from '@/hooks/useTeamData';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ArrowLeft, Plus, Trash2, Save, ExternalLink, GripVertical, ListChecks, History } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { BackNavigation } from '@/components/BackNavigation';

import { DEPARTMENTS as SHARED_DEPARTMENTS } from '@/lib/departments';

const DEPARTMENTS = SHARED_DEPARTMENTS.map(d => ({ value: d.value, label: d.label }));

const SOP_STATUSES = [
  { value: 'para_criar', label: 'Para criar', color: 'bg-muted text-muted-foreground' },
  { value: 'em_criacao', label: 'Em criação', color: 'bg-amber-100 text-amber-800 border-amber-200' },
  { value: 'ativo', label: 'Ativo', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  { value: 'em_revisao', label: 'Em revisão', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  { value: 'off', label: 'Off', color: 'bg-red-100 text-red-800 border-red-200' },
];

type ListItem = { text: string; checked?: boolean };

import {
  parseJsonList, parseCheckList,
  EditableTextList, EditableBulletList, EditableCheckList, UtilizacaoTable,
} from '@/components/sop/SopEditableLists';

// ─── Main Page ──────────────────────────────────────────────────

export default function SopDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // ─── Fetch SOP ──────────────────────────────────────────────
  const { data: sop, isLoading } = useQuery({
    queryKey: ['sop', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('sops').select('*').eq('id', id!).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch linked routine if exists
  const routineId = (sop as any)?.routine_id;
  const { data: linkedRoutine } = useQuery({
    queryKey: ['linked-routine', routineId],
    queryFn: async () => {
      const { data } = await supabase.from('planning_routines').select('*').eq('id', routineId).single();
      return data;
    },
    enabled: !!routineId,
  });

  const { data: roles = [] } = useQuery({
    queryKey: ['custom_roles'],
    queryFn: async () => {
      const { data, error } = await supabase.from('custom_roles').select('*');
      if (error) throw error;
      return data;
    },
  });

  // Fetch unique role titles from team members
  const { data: teamRoles = [] } = useQuery({
    queryKey: ['team-role-titles'],
    queryFn: async () => {
      const { data } = await supabase.from('team_members').select('role_title').eq('status', 'ativo').not('role_title', 'is', null);
      const unique = [...new Set((data || []).map((d: any) => d.role_title).filter(Boolean))].sort();
      return unique as string[];
    },
  });

  // Fetch step documents
  const { data: stepDocuments = [] } = useQuery({
    queryKey: ['sop-step-documents', id],
    queryFn: async () => {
      const { data } = await supabase.from('sop_step_documents' as any).select('*').eq('sop_id', id!).order('step_index').order('sort_order');
      return (data || []) as any[];
    },
    enabled: !!id,
  });

  const [name, setName] = useState('');
  const [sopId, setSopId] = useState('');
  const [status, setStatus] = useState('para_criar');
  const [department, setDepartment] = useState('administrativo');
  const [departments, setDepartments] = useState<string[]>([]);
  const [roleId, setRoleId] = useState<string>('');
  const [productName, setProductName] = useState('');
  const [createdAt, setCreatedAt] = useState('');
  const [objetivo, setObjetivo] = useState('');
  const [usado, setUsado] = useState<string[]>(['']);
  const [naoUsado, setNaoUsado] = useState<string[]>(['']);
  const [inputs, setInputs] = useState<ListItem[]>([{ text: '', checked: false }]);
  const [passos, setPassos] = useState<string[]>(['', '', '', '', '', '']);
  const [decisoes, setDecisoes] = useState<string[]>(['']);
  const [outputs, setOutputs] = useState<ListItem[]>([{ text: '', checked: false }]);
  const [notas, setNotas] = useState<string[]>(['']);
  const [linkedEntityType, setLinkedEntityType] = useState('geral');
  const [linkedEntityId, setLinkedEntityId] = useState<string>('');
  const [applyToAllActiveClients, setApplyToAllActiveClients] = useState(false);
  const [sopType, setSopType] = useState('operacional');
  const [sopRoleTitle, setSopRoleTitle] = useState('');
  const [sopProductId, setSopProductId] = useState('');
  const [sopVersion, setSopVersion] = useState(1);
  const [sopVersionNotes, setSopVersionNotes] = useState('');
  const [showCreateTasks, setShowCreateTasks] = useState(false);
  const [sopEstimatedTime, setSopEstimatedTime] = useState('');
  const [taskProjectId, setTaskProjectId] = useState('');
  const [taskDepartment, setTaskDepartment] = useState('');
  const [taskDeadline, setTaskDeadline] = useState('');
  // Detect if this is an onboarding/offboarding SOP linked to a product
  const isOnboardingSop = useMemo(() => {
    if (!sop) return false;
    return (sop as any).linked_entity_type === 'produto' && (sop as any).linked_entity_id && sop.name?.toLowerCase().includes('onboarding') && !sop.name?.toLowerCase().includes('offboarding');
  }, [sop]);

  const isOffboardingSop = useMemo(() => {
    if (!sop) return false;
    return (sop as any).linked_entity_type === 'produto' && (sop as any).linked_entity_id && sop.name?.toLowerCase().includes('offboarding');
  }, [sop]);

  const isPaymentSop = useMemo(() => {
    if (!sop) return false;
    return (sop as any).linked_entity_type === 'produto' && (sop as any).linked_entity_id && sop.name?.toLowerCase().includes('pagamento');
  }, [sop]);

  const isNpsSop = useMemo(() => {
    if (!sop) return false;
    const n = sop.name?.toLowerCase() || '';
    return (sop as any).linked_entity_type === 'produto' && (sop as any).linked_entity_id && (n.includes('nps') || n.includes('feedback'));
  }, [sop]);

  const isAcompanhamentoSop = useMemo(() => {
    if (!sop) return false;
    const n = sop.name?.toLowerCase() || '';
    return (sop as any).linked_entity_type === 'produto' && (sop as any).linked_entity_id && n.includes('acompanhamento');
  }, [sop]);

  const isKpisSop = useMemo(() => {
    if (!sop) return false;
    const n = sop.name?.toLowerCase() || '';
    return (sop as any).linked_entity_type === 'produto' && (sop as any).linked_entity_id && n.includes('kpis');
  }, [sop]);

  const templateTable = isOnboardingSop ? 'product_onboarding_templates' : isOffboardingSop ? 'product_offboarding_templates' : null;
  const linkedProductId = (sop as any)?.linked_entity_id;

  // Payment methods for "Gestão de Pagamentos" SOP
  const { data: paymentMethods = [] } = useQuery({
    queryKey: ['product-payment-methods', linkedProductId],
    queryFn: async () => {
      if (!linkedProductId) return [];
      const { data } = await supabase.from('product_payment_methods' as any).select('*').eq('product_id', linkedProductId);
      return (data || []) as any[];
    },
    enabled: isPaymentSop && !!linkedProductId,
  });

  // NPS Config for "Recolha de NPS/Feedbacks" SOP
  const { members } = useTeamData();
  const teamMembers = members.data || [];

  const { data: npsConfig } = useQuery({
    queryKey: ['product-nps-config', linkedProductId],
    queryFn: async () => {
      if (!linkedProductId) return null;
      const { data } = await supabase.from('product_nps_config' as any).select('*').eq('product_id', linkedProductId).maybeSingle();
      return data as any;
    },
    enabled: isNpsSop && !!linkedProductId,
  });

  const [npsConfigForm, setNpsConfigForm] = useState<any>(null);
  const effectiveNpsConfig = npsConfigForm ?? npsConfig;

  useEffect(() => {
    if (npsConfig && !npsConfigForm) setNpsConfigForm(npsConfig);
  }, [npsConfig]);

  const saveNpsConfig = useMutation({
    mutationFn: async () => {
      const payload = {
        product_id: linkedProductId,
        cadence_days: effectiveNpsConfig?.cadence_days || 30,
        collection_message: effectiveNpsConfig?.collection_message || '',
        responsible_id: effectiveNpsConfig?.responsible_id || null,
        nps_form_url: effectiveNpsConfig?.nps_form_url || null,
      };
      if (effectiveNpsConfig?.id) {
        const { error } = await supabase.from('product_nps_config' as any).update(payload).eq('id', effectiveNpsConfig.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('product_nps_config' as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-nps-config', linkedProductId] });
      toast.success('Configuração NPS guardada');
    },
    onError: () => toast.error('Erro ao guardar configuração'),
  });

  // Renewal advance days for "Offboarding" SOP
  const { data: productRenewal } = useQuery({
    queryKey: ['product-renewal', linkedProductId],
    queryFn: async () => {
      if (!linkedProductId) return null;
      const { data } = await supabase.from('products').select('renewal_advance_days').eq('id', linkedProductId).maybeSingle();
      return data;
    },
    enabled: isOffboardingSop && !!linkedProductId,
  });

  const [renewalDays, setRenewalDays] = useState<number>(30);

  useEffect(() => {
    if (productRenewal) setRenewalDays(productRenewal.renewal_advance_days ?? 30);
  }, [productRenewal]);

  const saveRenewalDays = useMutation({
    mutationFn: async (days: number) => {
      const { error } = await supabase.from('products').update({ renewal_advance_days: days } as any).eq('id', linkedProductId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-renewal', linkedProductId] });
      toast.success('Antecedência de renovação guardada');
    },
    onError: () => toast.error('Erro ao guardar'),
  });

  const QUICK_RENEWAL_DAYS = [15, 30, 45, 60];

  // Milestones for "Acompanhamento de Cliente" SOP
  const MILESTONE_TYPE_OPTIONS = [
    { value: 'check_in', label: 'Check-in' },
    { value: 'feedback', label: 'Recolha de Feedback' },
    { value: 'reuniao', label: 'Reunião' },
    { value: 'email', label: 'Email' },
    { value: 'outro', label: 'Outro' },
  ];

  const { data: milestones = [] } = useQuery({
    queryKey: ['product-milestones', linkedProductId],
    queryFn: async () => {
      if (!linkedProductId) return [];
      const { data } = await supabase.from('product_milestones' as any).select('*').eq('product_id', linkedProductId).order('days_after_start');
      return (data || []) as any[];
    },
    enabled: isAcompanhamentoSop && !!linkedProductId,
  });

  const addMilestone = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('product_milestones' as any).insert({
        product_id: linkedProductId,
        milestone: '',
        days_after_start: 0,
        milestone_type: 'check_in',
        sort_order: milestones.length,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['product-milestones', linkedProductId] }),
  });

  const updateMilestone = useMutation({
    mutationFn: async ({ id: mId, data: mData }: { id: string; data: any }) => {
      const { error } = await supabase.from('product_milestones' as any).update(mData).eq('id', mId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['product-milestones', linkedProductId] }),
  });

  const deleteMilestone = useMutation({
    mutationFn: async (mId: string) => {
      const { error } = await supabase.from('product_milestones' as any).delete().eq('id', mId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['product-milestones', linkedProductId] }),
  });
  // KPIs for "KPIs de Produto" SOP
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

  const { data: kpis = [] } = useQuery({
    queryKey: ['product-kpis', linkedProductId],
    queryFn: async () => {
      if (!linkedProductId) return [];
      const { data } = await supabase.from('product_kpis' as any).select('*').eq('product_id', linkedProductId).order('sort_order');
      return (data || []) as any[];
    },
    enabled: isKpisSop && !!linkedProductId,
  });

  const [showKpiForm, setShowKpiForm] = useState(false);
  const [kpiForm, setKpiForm] = useState({ name: '', kpi_type: 'numerico', source: 'manual' as 'manual' | 'automatico', auto_source: '', monthly_goal: '' });

  const createKpi = useMutation({
    mutationFn: async () => {
      if (!kpiForm.name.trim()) throw new Error('Nome é obrigatório');
      const { error } = await supabase.from('product_kpis' as any).insert({
        product_id: linkedProductId,
        name: kpiForm.name.trim(),
        kpi_type: kpiForm.kpi_type,
        source: kpiForm.source,
        auto_source: kpiForm.source === 'automatico' ? kpiForm.auto_source : null,
        monthly_goal: kpiForm.monthly_goal ? Number(kpiForm.monthly_goal) : null,
        sort_order: kpis.length,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-kpis', linkedProductId] });
      setShowKpiForm(false);
      setKpiForm({ name: '', kpi_type: 'numerico', source: 'manual', auto_source: '', monthly_goal: '' });
      toast.success('KPI criado');
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao criar KPI'),
  });

  const toggleKpiActive = useMutation({
    mutationFn: async ({ id: kId, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from('product_kpis' as any).update({ active }).eq('id', kId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['product-kpis', linkedProductId] }),
  });

  const deleteKpi = useMutation({
    mutationFn: async (kId: string) => {
      const { error } = await supabase.from('product_kpis' as any).delete().eq('id', kId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-kpis', linkedProductId] });
      toast.success('KPI eliminado');
    },
  });

  const { data: templateRows = [] } = useQuery({
    queryKey: ['sop-template-rows', templateTable, linkedProductId],
    queryFn: async () => {
      if (!templateTable || !linkedProductId) return [];
      const { data } = await supabase.from(templateTable as any).select('*').eq('product_id', linkedProductId).order('sort_order');
      return (data || []) as any[];
    },
    enabled: !!templateTable && !!linkedProductId,
  });

  // Entity lists for selects
  const { data: productsList = [] } = useQuery({
    queryKey: ['products-list'],
    queryFn: async () => { const { data } = await supabase.from('products').select('id, name'); return data || []; },
  });
  const { data: clientsList = [] } = useQuery({
    queryKey: ['clients-list'],
    queryFn: async () => { const { data } = await supabase.from('clients').select('id, full_name'); return data || []; },
  });
  const { data: projectsList = [] } = useQuery({
    queryKey: ['projects-list'],
    queryFn: async () => { const { data } = await supabase.from('projects').select('id, name'); return data || []; },
  });

  useEffect(() => {
    if (!sop) return;
    setName(sop.name);
    setSopId(sop.sop_id);
    setStatus(sop.status);
    setDepartment(sop.department);
    setDepartments((sop as any).departments?.length ? (sop as any).departments : [sop.department]);
    setRoleId(sop.custom_role_id || '');
    setProductName(sop.product_name || '');
    setCreatedAt(sop.created_at ? format(new Date(sop.created_at), 'yyyy-MM-dd') : '');
    setObjetivo(sop.objetivo || '');
    setUsado(parseJsonList(sop.utilizacao_usado).length ? parseJsonList(sop.utilizacao_usado) : ['']);
    setNaoUsado(parseJsonList(sop.utilizacao_nao_usado).length ? parseJsonList(sop.utilizacao_nao_usado) : ['']);
    setInputs(parseCheckList(sop.inputs).length ? parseCheckList(sop.inputs) : [{ text: '', checked: false }]);
    setPassos(parseJsonList(sop.passos).length ? parseJsonList(sop.passos) : ['', '', '', '', '', '']);
    setDecisoes(parseJsonList(sop.decisoes).length ? parseJsonList(sop.decisoes) : ['']);
    setOutputs(parseCheckList(sop.outputs).length ? parseCheckList(sop.outputs) : [{ text: '', checked: false }]);
    setNotas(parseJsonList(sop.notas).length ? parseJsonList(sop.notas) : ['']);
    setLinkedEntityType((sop as any).linked_entity_type || 'geral');
    setLinkedEntityId((sop as any).linked_entity_id || '');
    setApplyToAllActiveClients((sop as any).apply_to_all_active_clients || false);
    setSopType((sop as any).sop_type || 'operacional');
    setSopRoleTitle((sop as any).role_title || '');
    setSopProductId((sop as any).product_id || '');
    setSopVersion((sop as any).version || 1);
    setSopVersionNotes((sop as any).version_notes || '');
    setSopEstimatedTime((sop as any).estimated_time != null ? String((sop as any).estimated_time) : '');
  }, [sop]);

  // ─── Save ───────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('sops').update({
        name,
        sop_id: sopId,
        status,
        department: departments[0] || department,
        departments,
        custom_role_id: roleId || null,
        product_name: productName || null,
        objetivo: objetivo || null,
        utilizacao_usado: usado as any,
        utilizacao_nao_usado: naoUsado as any,
        inputs: inputs as any,
        passos: passos as any,
        decisoes: decisoes as any,
        outputs: outputs as any,
        notas: notas as any,
        linked_entity_type: linkedEntityType,
        linked_entity_id: linkedEntityId || null,
        apply_to_all_active_clients: applyToAllActiveClients,
        sop_type: sopType,
        role_title: sopRoleTitle || null,
        product_id: sopProductId || null,
        version: sopVersion,
        version_notes: sopVersionNotes || null,
        estimated_time: sopEstimatedTime ? parseFloat(sopEstimatedTime) : null,
      } as any).eq('id', id!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sop', id] });
      queryClient.invalidateQueries({ queryKey: ['sops'] });
      toast.success('Processo guardado');
    },
    onError: () => toast.error('Erro ao guardar'),
  });

  const bumpVersion = useMutation({
    mutationFn: async () => {
      const newVersion = sopVersion + 1;
      const { error } = await supabase.from('sops').update({
        version: newVersion,
        version_notes: `Atualizado para v${newVersion} em ${format(new Date(), 'dd/MM/yyyy HH:mm')}`,
      } as any).eq('id', id!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sop', id] });
      toast.success(`Versão atualizada para v${sopVersion + 1}`);
    },
  });

  const createTasksFromSop = useMutation({
    mutationFn: async () => {
      const steps = parseJsonList((sop as any)?.passos).filter(s => s.trim());
      if (steps.length === 0) throw new Error('Sem passos para criar tarefas');
      const rows = steps.map((step, i) => ({
        name: `[${sopId}] ${step}`,
        project_id: taskProjectId || null,
        department: taskDepartment || null,
        deadline: taskDeadline || null,
        status: 'por_comecar',
        priority: 'alta',
        notes: `Criada a partir do SOP: ${name}`,
      }));
      const { error } = await supabase.from('tasks').insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Tarefas criadas a partir dos passos do SOP');
      setShowCreateTasks(false);
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao criar tarefas'),
  });

  const addTemplateRow = useMutation({
    mutationFn: async () => {
      if (!templateTable || !linkedProductId) return;
      const nextOrder = templateRows.length;
      await supabase.from(templateTable as any).insert({ product_id: linkedProductId, activity: '', sort_order: nextOrder } as any);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sop-template-rows', templateTable, linkedProductId] }),
  });

  const updateTemplateRow = useMutation({
    mutationFn: async ({ rowId, data }: { rowId: string; data: Record<string, any> }) => {
      if (!templateTable) return;
      await supabase.from(templateTable as any).update(data).eq('id', rowId);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sop-template-rows', templateTable, linkedProductId] }),
  });

  const deleteTemplateRow = useMutation({
    mutationFn: async (rowId: string) => {
      if (!templateTable) return;
      await supabase.from(templateTable as any).delete().eq('id', rowId);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sop-template-rows', templateTable, linkedProductId] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('sops').delete().eq('id', id!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sops'] });
      navigate('/hub/processos');
      toast.success('Processo eliminado');
    },
  });

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </AppLayout>
    );
  }

  if (!sop) {
    return (
      <AppLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Processo não encontrado.</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate('/hub/processos')}>
            Voltar
          </Button>
        </div>
      </AppLayout>
    );
  }

  const statusInfo = SOP_STATUSES.find(s => s.value === status) || SOP_STATUSES[0];

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center gap-3">
          <BackNavigation parentRoute="/hub/processos" parentLabel="Processos" />
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Input value={sopId} onChange={e => setSopId(e.target.value)} className="w-24 font-mono text-xs h-7" />
              <Badge className={cn('text-xs', statusInfo.color)}>{statusInfo.label}</Badge>
              <Badge variant="outline" className="text-xs font-mono">v{sopVersion}</Badge>
            </div>
            <Input value={name} onChange={e => setName(e.target.value)} className="text-xl font-bold border-none px-0 h-auto focus-visible:ring-0" />
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowCreateTasks(true)} title="Criar tarefas a partir dos passos">
            <ListChecks className="h-4 w-4 mr-1" /> Criar Tarefas
          </Button>
          <Button variant="outline" size="sm" onClick={() => bumpVersion.mutate()} disabled={bumpVersion.isPending} title="Criar nova versão">
            <History className="h-4 w-4 mr-1" /> v{sopVersion + 1}
          </Button>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            <Save className="h-4 w-4 mr-1" /> Guardar
          </Button>
        </div>

        {/* Meta fields */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <Label className="text-xs text-muted-foreground">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SOP_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Tipo de SOP</Label>
            <Select value={sopType} onValueChange={setSopType}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="operacional">Operacional</SelectItem>
                <SelectItem value="onboarding">Onboarding</SelectItem>
                <SelectItem value="rotina">Rotina</SelectItem>
                <SelectItem value="entrega">Entrega</SelectItem>
                <SelectItem value="outro">Outro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Departamentos</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start h-9 text-sm font-normal">
                  {departments.length === 0
                    ? 'Selecionar departamentos...'
                    : departments.map(d => DEPARTMENTS.find(x => x.value === d)?.label || d).join(', ')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-2" align="start">
                {DEPARTMENTS.map(d => (
                  <label key={d.value} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer text-sm">
                    <Checkbox
                      checked={departments.includes(d.value)}
                      onCheckedChange={(checked) => setDepartments(prev => checked ? [...prev, d.value] : prev.filter(v => v !== d.value))}
                    />
                    {d.label}
                  </label>
                ))}
              </PopoverContent>
            </Popover>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Função associada</Label>
            <Select value={sopRoleTitle || '_none_'} onValueChange={v => setSopRoleTitle(v === '_none_' ? '' : v)}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_none_">Nenhuma</SelectItem>
                {teamRoles.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Produto</Label>
            <Select value={sopProductId || '_none_'} onValueChange={v => setSopProductId(v === '_none_' ? '' : v)}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Nenhum" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_none_">Nenhum</SelectItem>
                {productsList.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Tempo Estimado (horas)</Label>
            <Input type="number" min="0" step="0.5" value={sopEstimatedTime} onChange={e => setSopEstimatedTime(e.target.value)} placeholder="Ex: 2.5" className="h-9" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Data de criação</Label>
            <Input type="date" value={createdAt} onChange={e => setCreatedAt(e.target.value)} className="h-9" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Versão</Label>
            <p className="text-sm pt-2 font-mono">v{sopVersion}{sopVersionNotes ? ` — ${sopVersionNotes}` : ''}</p>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Última atualização</Label>
            <p className="text-sm pt-2">{sop.updated_at ? format(new Date(sop.updated_at), "dd MMM yyyy, HH:mm", { locale: pt }) : '—'}</p>
          </div>
        </div>

        {/* Routine info */}
        {linkedRoutine && (
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className="bg-violet-100 text-violet-800 border-violet-200 border text-xs px-3 py-1">
              🔄 Rotina {linkedRoutine.recurrence_type === 'semanal'
                ? `Semanal — ${['', '2ª', '3ª', '4ª', '5ª', '6ª', 'Sáb', 'Dom'][(linkedRoutine as any).weekday || 0]} feira`
                : `Mensal — dia ${(linkedRoutine as any).month_day}`}
              {(linkedRoutine as any).hour_time ? ` às ${String((linkedRoutine as any).hour_time).slice(0, 5)}` : ''}
            </Badge>
            <Badge variant={linkedRoutine.active ? 'default' : 'secondary'} className="text-[10px]">
              {linkedRoutine.active ? 'Ativa' : 'Inativa'}
            </Badge>
          </div>
        )}

        {/* Linked entity */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <Label className="text-xs text-muted-foreground">Tipo de ligação</Label>
            <Select value={linkedEntityType} onValueChange={v => { setLinkedEntityType(v); setLinkedEntityId(''); setApplyToAllActiveClients(false); }}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="geral">Geral</SelectItem>
                <SelectItem value="produto">Produto</SelectItem>
                <SelectItem value="cliente">Cliente</SelectItem>
                <SelectItem value="projeto">Projeto</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {linkedEntityType === 'produto' && (
            <>
              <div>
                <Label className="text-xs text-muted-foreground">Produto</Label>
                <Select value={linkedEntityId} onValueChange={setLinkedEntityId}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                  <SelectContent>
                    {productsList.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-2 pb-1">
                <Switch checked={applyToAllActiveClients} onCheckedChange={setApplyToAllActiveClients} id="apply-all-clients" />
                <Label htmlFor="apply-all-clients" className="text-xs cursor-pointer">Aplicar a todos os clientes ativos</Label>
              </div>
            </>
          )}
          {linkedEntityType === 'cliente' && (
            <div>
              <Label className="text-xs text-muted-foreground">Cliente</Label>
              <Select value={linkedEntityId} onValueChange={setLinkedEntityId}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                <SelectContent>
                  {clientsList.map(c => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          {linkedEntityType === 'projeto' && (
            <div>
              <Label className="text-xs text-muted-foreground">Projeto</Label>
              <Select value={linkedEntityId} onValueChange={setLinkedEntityId}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                <SelectContent>
                  {projectsList.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <section>
          <h3 className="text-lg font-semibold mb-2">1. Objetivo</h3>
          <Textarea value={objetivo} onChange={e => setObjetivo(e.target.value)} placeholder="Descrever o objetivo deste SOP..." rows={3} />
        </section>

        {/* 2. Utilização */}
        <section>
          <h3 className="text-lg font-semibold mb-2">2. Utilização</h3>
          <UtilizacaoTable usado={usado} naoUsado={naoUsado} onChangeUsado={setUsado} onChangeNaoUsado={setNaoUsado} />
        </section>

        {/* 3. Inputs Necessários */}
        <section>
          <h3 className="text-lg font-semibold mb-1">3. Inputs Necessários</h3>
          <p className="text-sm text-amber-600 mb-3">⚠️ Se algum item estiver em falta, não iniciar.</p>
          <EditableCheckList items={inputs} onChange={setInputs} />
        </section>

        {/* 4. Passos do Processo */}
        <section>
          <h3 className="text-lg font-semibold mb-2">4. Passos do Processo</h3>
          <EditableTextList items={passos} onChange={setPassos} placeholder="Descrever passo..." />
        </section>

        {/* Template de Onboarding/Offboarding (structured steps for client automation) */}
        {(isOnboardingSop || isOffboardingSop) && (
          <section>
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="text-base">
                  {isOnboardingSop ? 'Template de Onboarding de Clientes' : 'Template de Offboarding de Clientes'}
                </CardTitle>
                <Button size="sm" variant="outline" onClick={() => addTemplateRow.mutate()}>
                  <Plus className="h-3 w-3 mr-1" /> Adicionar Passo
                </Button>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground mb-3">
                  Estes passos serão copiados automaticamente para cada cliente associado a este produto.
                </p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fase</TableHead>
                      <TableHead>Atividade</TableHead>
                      <TableHead>Responsável</TableHead>
                      <TableHead>Prazo</TableHead>
                      <TableHead>Gatilho</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {templateRows.length === 0 && (
                      <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-4">Sem passos definidos</TableCell></TableRow>
                    )}
                    {templateRows.map((row: any) => (
                      <TableRow key={row.id}>
                        <TableCell>
                          <Input defaultValue={row.phase || ''} placeholder="Fase" onBlur={e => updateTemplateRow.mutate({ rowId: row.id, data: { phase: e.target.value } })} className="border-none shadow-none h-auto p-0 text-sm" />
                        </TableCell>
                        <TableCell>
                          <Input defaultValue={row.activity || ''} placeholder="Atividade" onBlur={e => updateTemplateRow.mutate({ rowId: row.id, data: { activity: e.target.value } })} className="border-none shadow-none h-auto p-0 text-sm" />
                        </TableCell>
                        <TableCell>
                          <Input defaultValue={row.responsible || ''} placeholder="Cliente / Função" onBlur={e => updateTemplateRow.mutate({ rowId: row.id, data: { responsible: e.target.value } })} className="border-none shadow-none h-auto p-0 text-sm" />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <Input
                              type="number"
                              min={0}
                              defaultValue={row.rule_days ?? ''}
                              placeholder="Nº"
                              onBlur={e => {
                                const val = e.target.value ? parseInt(e.target.value) : null;
                                updateTemplateRow.mutate({ rowId: row.id, data: { rule_days: val, rule: val != null ? `+${val} ${row.rule_unit || 'dias_uteis'}` : null } });
                              }}
                              className="border-none shadow-none h-auto p-0 text-sm w-12"
                            />
                            <select
                              value={row.rule_unit || 'dias_uteis'}
                              onChange={e => updateTemplateRow.mutate({ rowId: row.id, data: { rule_unit: e.target.value } })}
                              className="text-xs bg-transparent border-none p-0 text-muted-foreground focus:outline-none"
                            >
                              <option value="horas_uteis">h úteis</option>
                              <option value="dias_uteis">dias úteis</option>
                              <option value="dias_corridos">dias</option>
                              <option value="semanas">semanas</option>
                            </select>
                          </div>
                        </TableCell>
                        <TableCell>
                          <select
                            value={row.rule_trigger || 'inicio_cliente'}
                            onChange={e => updateTemplateRow.mutate({ rowId: row.id, data: { rule_trigger: e.target.value } })}
                            className="text-xs bg-transparent border-none p-0 text-muted-foreground focus:outline-none"
                          >
                            <option value="inicio_cliente">Após início do cliente</option>
                            <option value="reuniao_inicial">Após reunião inicial</option>
                            <option value="assinatura_contrato">Após assinatura de contrato</option>
                            <option value="onboarding_completo">Após onboarding completo</option>
                            <option value="fim_ciclo">Antes do fim do ciclo</option>
                          </select>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteTemplateRow.mutate(row.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </section>
        )}

        {/* Antecedência de Renovação (for Offboarding SOP) */}
        {isOffboardingSop && (
          <section>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Antecedência de Renovação</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Antecedência de renovação (dias)</Label>
                  <div className="flex items-center gap-3">
                    <Input
                      type="number"
                      min={1}
                      max={365}
                      value={renewalDays}
                      onChange={e => setRenewalDays(Number(e.target.value))}
                      className="h-9 w-32"
                    />
                    <Button
                      size="sm"
                      onClick={() => saveRenewalDays.mutate(renewalDays)}
                      disabled={saveRenewalDays.isPending}
                    >
                      <Save className="h-4 w-4 mr-1" /> Guardar
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Quantos dias antes do fim de ciclo iniciar o processo de renovação com o cliente
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {QUICK_RENEWAL_DAYS.map(d => (
                    <Button
                      key={d}
                      variant={renewalDays === d ? 'default' : 'outline'}
                      size="sm"
                      className="text-xs"
                      onClick={() => {
                        setRenewalDays(d);
                        saveRenewalDays.mutate(d);
                      }}
                    >
                      {d} dias
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </section>
        )}

        {/* Formas de Pagamento (for "Gestão de Pagamentos" SOP) */}
        {isPaymentSop && (
          <section>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Formas de Pagamento</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground mb-3">Seleciona as formas de pagamento disponíveis para este produto. Ao associar a um cliente, apenas estas opções aparecerão.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { value: 'pagamento_total', label: 'Pagamento Total' },
                    { value: 'entrada_prestacoes', label: 'Pagamento Entrada + Prestações' },
                    { value: 'prestacoes', label: 'Pagamento Prestações' },
                    { value: 'avenca_mensal', label: 'Pagamento Avença Mensal' },
                  ].map(opt => {
                    const isActive = paymentMethods.some((pm: any) => pm.payment_method === opt.value);
                    return (
                      <label key={opt.value} className={cn(
                        "flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors",
                        isActive ? "border-primary bg-primary/5" : "border-border"
                      )}>
                        <Checkbox
                          checked={isActive}
                          onCheckedChange={async (checked) => {
                            if (checked) {
                              await supabase.from('product_payment_methods' as any).insert({ product_id: linkedProductId, payment_method: opt.value });
                            } else {
                              const row = paymentMethods.find((pm: any) => pm.payment_method === opt.value);
                              if (row) await supabase.from('product_payment_methods' as any).delete().eq('id', row.id);
                            }
                            queryClient.invalidateQueries({ queryKey: ['product-payment-methods', linkedProductId] });
                          }}
                        />
                        <span className="text-sm">{opt.label}</span>
                      </label>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </section>
        )}

        {/* Configuração NPS (for "Recolha de NPS/Feedbacks" SOP) */}
        {isNpsSop && (
          <section>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Configuração de Recolha de NPS</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Cadência de recolha (dias)</Label>
                    <Input
                      type="number"
                      min={1}
                      placeholder="Ex: 30"
                      value={effectiveNpsConfig?.cadence_days ?? 30}
                      onChange={e => setNpsConfigForm((p: any) => ({ ...(p || {}), cadence_days: Number(e.target.value) }))}
                      className="h-9"
                    />
                    <p className="text-xs text-muted-foreground">30 = mensal · 60 = bimensal · 90 = trimestral</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Responsável pela recolha</Label>
                    <Select
                      value={effectiveNpsConfig?.responsible_id || ''}
                      onValueChange={v => setNpsConfigForm((p: any) => ({ ...(p || {}), responsible_id: v }))}
                    >
                      <SelectTrigger className="h-9"><SelectValue placeholder="Selecionar membro" /></SelectTrigger>
                      <SelectContent>
                        {teamMembers.map((m: any) => (
                          <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <Button size="sm" onClick={() => saveNpsConfig.mutate()} disabled={saveNpsConfig.isPending}>
                      <Save className="h-4 w-4 mr-1" /> Guardar Config
                    </Button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Mensagem de recolha</Label>
                  <Textarea
                    placeholder="Mensagem ou pergunta a enviar ao cliente..."
                    value={effectiveNpsConfig?.collection_message || ''}
                    onChange={e => setNpsConfigForm((p: any) => ({ ...(p || {}), collection_message: e.target.value }))}
                    className="min-h-[60px]"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Link do formulário de recolha de NPS</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="https://forms.google.com/... ou outro link"
                      value={effectiveNpsConfig?.nps_form_url || ''}
                      onChange={e => setNpsConfigForm((p: any) => ({ ...(p || {}), nps_form_url: e.target.value }))}
                      className="h-9"
                    />
                    {effectiveNpsConfig?.nps_form_url && (
                      <Button variant="outline" size="sm" className="shrink-0" asChild>
                        <a href={effectiveNpsConfig.nps_form_url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>
        )}

        {/* Marcos de Acompanhamento (for "Acompanhamento de Cliente" SOP) */}
        {isAcompanhamentoSop && (
          <section>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Marcos de Acompanhamento</CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                      Estes marcos são aplicados automaticamente à ficha de cada cliente associado a este produto.
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => addMilestone.mutate()}>
                    <Plus className="h-4 w-4 mr-1" /> Adicionar Marco
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {milestones.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">Sem marcos definidos.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Marco</TableHead>
                        <TableHead className="w-[120px]">Dias após início</TableHead>
                        <TableHead className="w-[160px]">Tipo</TableHead>
                        <TableHead className="w-[180px]">Responsável</TableHead>
                        <TableHead className="w-[50px]" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {milestones.map((m: any) => (
                        <TableRow key={m.id}>
                          <TableCell>
                            <Input
                              value={m.milestone}
                              onChange={e => updateMilestone.mutate({ id: m.id, data: { milestone: e.target.value } })}
                              className="h-8 text-sm"
                              placeholder="Ex: Check-in semana 2"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min={0}
                              value={m.days_after_start}
                              onChange={e => updateMilestone.mutate({ id: m.id, data: { days_after_start: Number(e.target.value) } })}
                              className="h-8 text-sm w-20"
                            />
                          </TableCell>
                          <TableCell>
                            <Select
                              value={m.milestone_type}
                              onValueChange={v => updateMilestone.mutate({ id: m.id, data: { milestone_type: v } })}
                            >
                              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {MILESTONE_TYPE_OPTIONS.map(o => (
                                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Select
                              value={m.responsible_id || ''}
                              onValueChange={v => updateMilestone.mutate({ id: m.id, data: { responsible_id: v } })}
                            >
                              <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                              <SelectContent>
                                {teamMembers.map((t: any) => (
                                  <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteMilestone.mutate(m.id)}>
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </section>
        )}

        {/* KPIs de Produto (for "KPIs de Produto" SOP) */}
        {isKpisSop && (
          <section>
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="text-base">KPIs do Produto</CardTitle>
                <Button size="sm" onClick={() => setShowKpiForm(true)} disabled={showKpiForm}>
                  <Plus className="h-4 w-4 mr-1" /> Novo KPI
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {showKpiForm && (
                  <Card>
                    <CardContent className="p-4 space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-xs">Nome do KPI</Label>
                          <Input value={kpiForm.name} onChange={e => setKpiForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Taxa de retenção" autoFocus />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Tipo</Label>
                          <Select value={kpiForm.kpi_type} onValueChange={v => setKpiForm(f => ({ ...f, kpi_type: v }))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {KPI_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Fonte</Label>
                          <Select value={kpiForm.source} onValueChange={v => setKpiForm(f => ({ ...f, source: v as any }))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="manual">Manual</SelectItem>
                              <SelectItem value="automatico">Automático</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {kpiForm.source === 'automatico' && (
                          <div className="space-y-1.5">
                            <Label className="text-xs">Fonte automática</Label>
                            <Select value={kpiForm.auto_source} onValueChange={v => setKpiForm(f => ({ ...f, auto_source: v }))}>
                              <SelectTrigger><SelectValue placeholder="Selecionar fonte" /></SelectTrigger>
                              <SelectContent>
                                {AUTO_SOURCES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                        <div className="space-y-1.5">
                          <Label className="text-xs">Meta mensal (opcional)</Label>
                          <Input type="number" value={kpiForm.monthly_goal} onChange={e => setKpiForm(f => ({ ...f, monthly_goal: e.target.value }))} placeholder="Ex: 5000" />
                        </div>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <Button variant="outline" size="sm" onClick={() => setShowKpiForm(false)}>Cancelar</Button>
                        <Button size="sm" onClick={() => createKpi.mutate()} disabled={createKpi.isPending}>Criar KPI</Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {kpis.length === 0 && !showKpiForm ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Nenhum KPI definido. Cria o primeiro KPI para acompanhar o desempenho deste produto.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {kpis.map((kpi: any) => (
                      <Card key={kpi.id} className={kpi.active ? '' : 'opacity-50'}>
                        <CardContent className="p-3 flex items-center gap-3">
                          <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm truncate">{kpi.name}</span>
                              <Badge variant="outline" className="text-[10px] shrink-0">{KPI_TYPES.find(t => t.value === kpi.kpi_type)?.label || kpi.kpi_type}</Badge>
                              <Badge variant={kpi.source === 'automatico' ? 'default' : 'secondary'} className="text-[10px] shrink-0">
                                {kpi.source === 'automatico' ? 'Auto' : 'Manual'}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                              <span>Fonte: {kpi.source === 'manual' ? 'Manual' : (AUTO_SOURCES.find(s => s.value === kpi.auto_source)?.label || 'Automático')}</span>
                              {kpi.monthly_goal != null && <span>Meta: {kpi.kpi_type === 'monetario' ? `${Number(kpi.monthly_goal).toLocaleString('pt-PT')} €` : kpi.kpi_type === 'percentagem' ? `${kpi.monthly_goal}%` : kpi.monthly_goal}</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Switch checked={kpi.active} onCheckedChange={v => toggleKpiActive.mutate({ id: kpi.id, active: v })} />
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => { if (confirm('Eliminar este KPI?')) deleteKpi.mutate(kpi.id); }}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </section>
        )}

        <section>
          <h3 className="text-lg font-semibold mb-2">5. Decisões / Exceções</h3>
          <EditableBulletList items={decisoes} onChange={setDecisoes} placeholder="(se acontecer X, fazer Y)" />
        </section>

        {/* 6. Outputs Finais */}
        <section>
          <h3 className="text-lg font-semibold mb-1">6. Outputs Finais</h3>
          <p className="text-sm text-emerald-600 mb-3">✅ O processo considera-se concluído quando:</p>
          <EditableCheckList items={outputs} onChange={setOutputs} />
        </section>

        {/* 7. Notas */}
        <section>
          <h3 className="text-lg font-semibold mb-2">7. Notas</h3>
          <EditableBulletList items={notas} onChange={setNotas} placeholder="Nota..." />
        </section>

        {/* Delete */}
        <div className="border-t pt-6">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <Trash2 className="h-4 w-4 mr-1" /> Eliminar processo
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Eliminar processo?</AlertDialogTitle>
                <AlertDialogDescription>Esta ação não pode ser revertida.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => deleteMutation.mutate()}>Eliminar</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Create Tasks Dialog */}
      <Dialog open={showCreateTasks} onOpenChange={setShowCreateTasks}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Criar Tarefas a partir deste SOP</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Serão criadas {parseJsonList((sop as any)?.passos).filter(s => s.trim()).length} tarefas a partir dos passos do processo.
          </p>
          <div className="space-y-3">
            <div>
              <Label>Projeto (opcional)</Label>
              <Select value={taskProjectId || '_none_'} onValueChange={v => setTaskProjectId(v === '_none_' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none_">Nenhum</SelectItem>
                  {projectsList.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Departamento</Label>
              <Select value={taskDepartment || '_none_'} onValueChange={v => setTaskDepartment(v === '_none_' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none_">Nenhum</SelectItem>
                  {DEPARTMENTS.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Prazo (opcional)</Label>
              <Input type="date" value={taskDeadline} onChange={e => setTaskDeadline(e.target.value)} />
            </div>
            <Button className="w-full" onClick={() => createTasksFromSop.mutate()} disabled={createTasksFromSop.isPending}>
              Criar {parseJsonList((sop as any)?.passos).filter(s => s.trim()).length} Tarefas
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
