import { useState, useEffect, useMemo } from 'react';
import { useSectorConfig } from '@/hooks/useSectorConfig';
import { useParams, useNavigate } from 'react-router-dom';
import type { Json } from '@/integrations/supabase/types';
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
import { ArrowLeft, Plus, Trash2, Save, ExternalLink, GripVertical, ListChecks, History, FileText, ChevronDown, ChevronUp, Paperclip, Pencil, Tag, Layers, Building2, UserCircle2, Package, Timer, Calendar as CalendarIcon, Hash, Clock, Link2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { EntitySection, EntityTopBar, EntityTitle, EntityProperties, EntityProperty, inlineInputClass, inlineTriggerClass } from '@/components/layout/entity';
import { EntityHeroHeader, parseIcon } from '@/components/entity-icon';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { EmptyHint, InlineLoader } from '@/components/ui/loading-skeletons';

import { DEPARTMENTS as SHARED_DEPARTMENTS } from '@/lib/departments';

const DEPARTMENTS = SHARED_DEPARTMENTS.map(d => ({ value: d.value, label: d.label }));

import { SOP_STATUSES, getSopStatusInfo } from '@/lib/sopStatus';

type ListItem = { text: string; checked?: boolean };

import {
  parseJsonList, parseCheckList,
  EditableTextList, EditableBulletList, EditableCheckList, UtilizacaoTable,
} from '@/components/sop/SopEditableLists';

import { RenewalSection } from '@/components/sop-detail/RenewalSection';
import { PaymentMethodsSection } from '@/components/sop-detail/PaymentMethodsSection';
import { MilestonesSection } from '@/components/sop-detail/MilestonesSection';
import { KpisSection } from '@/components/sop-detail/KpisSection';

// ─── Main Page ──────────────────────────────────────────────────

export default function SopDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const sectorConfig = useSectorConfig();

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
  const routineId = sop?.routine_id;
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
      const unique = [...new Set((data || []).map((d) => d.role_title).filter(Boolean))].sort();
      return unique as string[];
    },
  });

  // Fetch structured steps
  const { data: sopSteps = [] } = useQuery({
    queryKey: ['sop-steps', id],
    queryFn: async () => {
      const { data } = await (supabase.from as any)('sop_steps').select('*').eq('sop_id', id!).order('sort_order');
      return (data || []) as Array<Record<string, any>>;
    },
    enabled: !!id,
  });

  // Fetch step documents (linked to sop_steps via step_id)
  const { data: stepDocuments = [] } = useQuery({
    queryKey: ['sop-step-documents', id],
    queryFn: async () => {
      const { data } = await (supabase.from as any)('sop_step_documents').select('*').eq('sop_id', id!).order('sort_order');
      return (data || []) as Array<Record<string, any>>;
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
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const [docExpandedSteps, setDocExpandedSteps] = useState<Set<string>>(new Set());
  const [editingDoc, setEditingDoc] = useState<Record<string, any> | null>(null);
  const [sopEstimatedTime, setSopEstimatedTime] = useState('');
  const [editingSections, setEditingSections] = useState<Set<string>>(new Set());
  const toggleEdit = (section: string) => setEditingSections(prev => {
    const next = new Set(prev);
    next.has(section) ? next.delete(section) : next.add(section);
    return next;
  });
  const [taskProjectId, setTaskProjectId] = useState('');
  const [taskDepartment, setTaskDepartment] = useState('');
  const [taskDeadline, setTaskDeadline] = useState('');
  // Detect if this is an onboarding/offboarding SOP linked to a product
  const isOnboardingSop = useMemo(() => {
    if (!sop) return false;
    return sop.linked_entity_type === 'produto' && !!sop.linked_entity_id && sop.name?.toLowerCase().includes('onboarding') && !sop.name?.toLowerCase().includes('offboarding');
  }, [sop]);

  const isOffboardingSop = useMemo(() => {
    if (!sop) return false;
    return sop.linked_entity_type === 'produto' && !!sop.linked_entity_id && sop.name?.toLowerCase().includes('offboarding');
  }, [sop]);

  const isRenewalSop = useMemo(() => {
    if (!sop) return false;
    const n = sop.name?.toLowerCase() || '';
    return sop.linked_entity_type === 'produto' && !!sop.linked_entity_id && (n.includes('renovação') || n.includes('renovacao'));
  }, [sop]);

  const isPaymentSop = useMemo(() => {
    if (!sop) return false;
    return sop.linked_entity_type === 'produto' && !!sop.linked_entity_id && sop.name?.toLowerCase().includes('pagamento');
  }, [sop]);

  const isAcompanhamentoSop = useMemo(() => {
    if (!sop) return false;
    const n = sop.name?.toLowerCase() || '';
    return sop.linked_entity_type === 'produto' && !!sop.linked_entity_id && n.includes('acompanhamento');
  }, [sop]);

  const isKpisSop = useMemo(() => {
    if (!sop) return false;
    const n = sop.name?.toLowerCase() || '';
    return sop.linked_entity_type === 'produto' && !!sop.linked_entity_id && n.includes('kpis');
  }, [sop]);

  const templateTable = isOnboardingSop
    ? 'product_onboarding_templates'
    : isOffboardingSop
      ? 'product_offboarding_templates'
      : isRenewalSop
        ? 'product_renewal_templates'
        : null;
  const linkedProductId = sop?.linked_entity_id;

  // Team members (used by NPS + Milestones sub-sections)
  const { members } = useTeamData({ members: true });
  const teamMembers = members.data || [];

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
    queryFn: async () => { const { data } = await supabase.from('clients').select('id, full_name').eq('status', 'ativo'); return data || []; },
  });
  const { data: projectsList = [] } = useQuery({
    queryKey: ['projects-list'],
    queryFn: async () => { const { data } = await supabase.from('projects').select('id, name').is('archived_at', null); return data || []; },
  });

  useEffect(() => {
    if (!sop) return;
    setName(sop.name);
    setSopId(sop.sop_id);
    setStatus(sop.status);
    setDepartment(sop.department);
    setDepartments(sop.departments?.length ? sop.departments : [sop.department]);
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
    setLinkedEntityType(sop.linked_entity_type || 'geral');
    setLinkedEntityId(sop.linked_entity_id || '');
    setApplyToAllActiveClients(sop.apply_to_all_active_clients || false);
    setSopType(sop.sop_type || 'operacional');
    setSopRoleTitle(sop.role_title || '');
    setSopProductId(sop.product_id || '');
    setSopVersion(sop.version || 1);
    setSopVersionNotes(sop.version_notes || '');
    setSopEstimatedTime(sop.estimated_time != null ? String(sop.estimated_time) : '');
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
        utilizacao_usado: usado as unknown as Json,
        utilizacao_nao_usado: naoUsado as unknown as Json,
        inputs: inputs as unknown as Json,
        passos: passos as unknown as Json,
        decisoes: decisoes as unknown as Json,
        outputs: outputs as unknown as Json,
        notas: notas as unknown as Json,
        linked_entity_type: linkedEntityType,
        linked_entity_id: linkedEntityId || null,
        apply_to_all_active_clients: applyToAllActiveClients,
        sop_type: sopType,
        role_title: sopRoleTitle || null,
        product_id: sopProductId || null,
        version: sopVersion,
        version_notes: sopVersionNotes || null,
        estimated_time: sopEstimatedTime ? parseFloat(sopEstimatedTime) : null,
      }).eq('id', id!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sop', id] });
      queryClient.invalidateQueries({ queryKey: ['sops'] });
      toast.success('Processo guardado');
    },
    onError: () => toast.error('Não consegui guardar a SOP. Tenta novamente.'),
  });

  const bumpVersion = useMutation({
    mutationFn: async () => {
      const newVersion = sopVersion + 1;
      const { error } = await supabase.from('sops').update({
        version: newVersion,
        version_notes: `Atualizado para v${newVersion} em ${format(new Date(), 'dd/MM/yyyy HH:mm')}`,
      }).eq('id', id!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sop', id] });
      toast.success(`Versão atualizada para v${sopVersion + 1}`);
    },
  });

  const createTasksFromSop = useMutation({
    mutationFn: async () => {
      const steps = sopSteps.filter((s) => s.description?.trim());
      if (steps.length === 0) throw new Error('Sem passos para criar tarefas');
      const rows = steps.map((step) => ({
        name: `[${sopId}] ${step.description}`,
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
    onError: (e: Error) => toast.error(e.message || 'Erro ao criar tarefas'),
  });

  const addTemplateRow = useMutation({
    mutationFn: async () => {
      if (!templateTable || !linkedProductId) return;
      const nextOrder = templateRows.length;
      await (supabase.from as any)(templateTable).insert({ product_id: linkedProductId, activity: '', sort_order: nextOrder });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sop-template-rows', templateTable, linkedProductId] }),
  });

  const updateTemplateRow = useMutation({
    mutationFn: async ({ rowId, data }: { rowId: string; data: Record<string, unknown> }) => {
      if (!templateTable) return;
      await (supabase.from as any)(templateTable).update(data).eq('id', rowId);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sop-template-rows', templateTable, linkedProductId] }),
  });

  const deleteTemplateRow = useMutation({
    mutationFn: async (rowId: string) => {
      if (!templateTable) return;
      await (supabase.from as any)(templateTable).delete().eq('id', rowId);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sop-template-rows', templateTable, linkedProductId] }),
  });

  // ─── Sop Steps CRUD ──────────────────────────────────────
  const addSopStep = useMutation({
    mutationFn: async () => {
      await (supabase.from as any)('sop_steps').insert({
        sop_id: id,
        description: '',
        sort_order: sopSteps.length,
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sop-steps', id] }),
  });

  const updateSopStep = useMutation({
    mutationFn: async ({ stepId, data }: { stepId: string; data: Record<string, unknown> }) => {
      await (supabase.from as any)('sop_steps').update(data).eq('id', stepId);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sop-steps', id] }),
  });

  const deleteSopStep = useMutation({
    mutationFn: async (stepId: string) => {
      await (supabase.from as any)('sop_steps').delete().eq('id', stepId);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sop-steps', id] }),
  });

  const moveStep = async (idx: number, direction: 'up' | 'down') => {
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sopSteps.length) return;
    const a = sopSteps[idx];
    const b = sopSteps[swapIdx];
    await Promise.all([
      (supabase.from as any)('sop_steps').update({ sort_order: b.sort_order }).eq('id', a.id),
      (supabase.from as any)('sop_steps').update({ sort_order: a.sort_order }).eq('id', b.id),
    ]);
    queryClient.invalidateQueries({ queryKey: ['sop-steps', id] });
  };

  // ─── Step Documents CRUD ──────────────────────────────────────
  const addStepDoc = useMutation({
    mutationFn: async (stepId: string) => {
      await (supabase.from as any)('sop_step_documents').insert({
        sop_id: id,
        step_id: stepId,
        step_index: 0,
        document_type: 'template',
        title: '',
        content: '',
        sort_order: stepDocuments.filter((d) => d.step_id === stepId).length,
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sop-step-documents', id] }),
  });

  const updateStepDoc = useMutation({
    mutationFn: async ({ docId, data }: { docId: string; data: Record<string, unknown> }) => {
      await (supabase.from as any)('sop_step_documents').update(data).eq('id', docId);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sop-step-documents', id] }),
  });

  const deleteStepDoc = useMutation({
    mutationFn: async (docId: string) => {
      await (supabase.from as any)('sop_step_documents').delete().eq('id', docId);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sop-step-documents', id] }),
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
          <InlineLoader />
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
      <div className="w-full space-y-8">
        {/* Top bar */}
        <EntityTopBar
          backTo="/hub/processos"
          backLabel="Processos"
          secondaryActions={[
            { label: 'Criar Tarefas', icon: ListChecks, onClick: () => setShowCreateTasks(true), hideLabelOnMobile: true },
            { label: `v${sopVersion + 1}`, icon: History, onClick: () => bumpVersion.mutate(), disabled: bumpVersion.isPending, loading: bumpVersion.isPending, hideLabelOnMobile: true },
          ]}
          primaryAction={{ label: 'Guardar', icon: Save, onClick: () => saveMutation.mutate(), disabled: saveMutation.isPending, loading: saveMutation.isPending }}
        />

        {/* Hero: cover + icon */}
        <EntityHeroHeader
          icon={parseIcon((sop as any)?.icon)}
          onIconChange={(next) => {
            if (!id) return;
            supabase.from('sops').update({ icon: next as any }).eq('id', id).then(() => queryClient.invalidateQueries({ queryKey: ['sop', id] }));
          }}
          coverUrl={(sop as any)?.cover_url}
          onCoverChange={(url) => {
            if (!id) return;
            supabase.from('sops').update({ cover_url: url }).eq('id', id).then(() => queryClient.invalidateQueries({ queryKey: ['sop', id] }));
          }}
          bucket="entity-icons"
          pathPrefix={`sops/${id || 'new'}`}
        />

        {/* Title + meta badges */}
        <EntityTitle
          title={name}
          onTitleChange={(v) => setName(v as string)}
          isOwner={true}
          inlineMode
          meta={
            <>
              <Input value={sopId} onChange={e => setSopId(e.target.value)} className="w-24 font-mono text-xs h-7" />
              <Badge className={cn('text-xs', statusInfo.color)}>{statusInfo.label}</Badge>
              <Badge variant="outline" className="text-xs font-mono">v{sopVersion}</Badge>
            </>
          }
        />

        {/* Properties (Notion-style) */}
        <EntityProperties>
          <EntityProperty icon={Tag} label="Status">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className={inlineTriggerClass}><SelectValue /></SelectTrigger>
              <SelectContent>
                {SOP_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </EntityProperty>
          <EntityProperty icon={Layers} label="Tipo de SOP">
            <Select value={sopType} onValueChange={setSopType}>
              <SelectTrigger className={inlineTriggerClass}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="operacional">Operacional</SelectItem>
                <SelectItem value="onboarding">Onboarding</SelectItem>
                <SelectItem value="rotina">Rotina</SelectItem>
                <SelectItem value="entrega">Entrega</SelectItem>
                <SelectItem value="outro">Outro</SelectItem>
              </SelectContent>
            </Select>
          </EntityProperty>
          <EntityProperty icon={Building2} label="Departamentos">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" className={cn(inlineTriggerClass, 'w-full justify-start font-normal')}>
                  {departments.length === 0
                    ? <span className="text-muted-foreground">Selecionar…</span>
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
          </EntityProperty>
          <EntityProperty icon={UserCircle2} label="Função associada">
            <Select value={sopRoleTitle || '_none_'} onValueChange={v => setSopRoleTitle(v === '_none_' ? '' : v)}>
              <SelectTrigger className={inlineTriggerClass}><SelectValue placeholder="Nenhuma" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_none_">Nenhuma</SelectItem>
                {teamRoles.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </EntityProperty>
          <EntityProperty icon={Package} label={sectorConfig.t('produto')}>
            <Select value={sopProductId || '_none_'} onValueChange={v => setSopProductId(v === '_none_' ? '' : v)}>
              <SelectTrigger className={inlineTriggerClass}><SelectValue placeholder="Nenhum" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_none_">Nenhum</SelectItem>
                {productsList.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </EntityProperty>
          <EntityProperty icon={Timer} label="Tempo estimado">
            <Input type="number" min="0" step="0.5" value={sopEstimatedTime} onChange={e => setSopEstimatedTime(e.target.value)} placeholder="Ex: 2.5h" className={inlineInputClass} />
          </EntityProperty>
          <EntityProperty icon={CalendarIcon} label="Data de criação">
            <Input type="date" value={createdAt} onChange={e => setCreatedAt(e.target.value)} className={inlineInputClass} />
          </EntityProperty>
          <EntityProperty icon={Hash} label="Versão">
            <span className="font-mono text-sm px-2">v{sopVersion}{sopVersionNotes ? ` — ${sopVersionNotes}` : ''}</span>
          </EntityProperty>
          <EntityProperty icon={Clock} label="Última atualização">
            <span className="text-sm px-2">{sop.updated_at ? format(new Date(sop.updated_at), "dd MMM yyyy, HH:mm", { locale: pt }) : '—'}</span>
          </EntityProperty>
        </EntityProperties>

        {/* Routine info */}
        {linkedRoutine && (
          <div className="flex items-center gap-2 flex-wrap">
            <Badge  variant="violet" className="border text-xs px-3 py-1">
              🔄 Rotina {linkedRoutine.recurrence_type === 'semanal'
                ? `Semanal — ${['', '2ª', '3ª', '4ª', '5ª', '6ª', 'Sáb', 'Dom'][linkedRoutine.weekday || 0]} feira`
                : `Mensal — dia ${linkedRoutine.month_day}`}
              {linkedRoutine.hour_time ? ` às ${String(linkedRoutine.hour_time).slice(0, 5)}` : ''}
            </Badge>
            <Badge variant={linkedRoutine.active ? 'default' : 'secondary'} className="text-[10px]">
              {linkedRoutine.active ? 'Ativa' : 'Inativa'}
            </Badge>
          </div>
        )}

        {/* Linked entity */}
        <EntityProperties>
          <EntityProperty icon={Link2} label="Tipo de ligação">
            <Select value={linkedEntityType} onValueChange={v => { setLinkedEntityType(v); setLinkedEntityId(''); setApplyToAllActiveClients(false); }}>
              <SelectTrigger className={inlineTriggerClass}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="geral">Geral</SelectItem>
                <SelectItem value="produto">Produto</SelectItem>
                <SelectItem value="projeto">Projeto</SelectItem>
              </SelectContent>
            </Select>
          </EntityProperty>
          {linkedEntityType === 'produto' && (
            <>
              <EntityProperty icon={Package} label={sectorConfig.t('produto')}>
                <Select value={linkedEntityId} onValueChange={setLinkedEntityId}>
                  <SelectTrigger className={inlineTriggerClass}><SelectValue placeholder="Selecionar…" /></SelectTrigger>
                  <SelectContent>
                    {productsList.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </EntityProperty>
              <EntityProperty icon={UserCircle2} label="Aplicar a todos os clientes ativos">
                <Switch checked={applyToAllActiveClients} onCheckedChange={setApplyToAllActiveClients} />
              </EntityProperty>
            </>
          )}
          {linkedEntityType === 'projeto' && (
            <EntityProperty icon={Layers} label={sectorConfig.t('projeto')}>
              <Select value={linkedEntityId} onValueChange={setLinkedEntityId}>
                <SelectTrigger className={inlineTriggerClass}><SelectValue placeholder="Selecionar…" /></SelectTrigger>
                <SelectContent>
                  {projectsList.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </EntityProperty>
          )}
        </EntityProperties>

        <EntitySection
          title="1 · Objetivo"
          action={
            <Button variant="ghost" aria-label="Editar" size="icon" className="h-7 w-7" onClick={() => toggleEdit('objetivo')}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          }
        >
            {editingSections.has('objetivo') ? (
              <Textarea value={objetivo} onChange={e => setObjetivo(e.target.value)} placeholder="Descrever o objetivo deste SOP..." rows={3} />
            ) : (
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{objetivo || <span className="italic">Sem objetivo definido</span>}</p>
            )}
        </EntitySection>

        <EntitySection
          title="2 · Utilização"
          action={
            <Button variant="ghost" aria-label="Editar" size="icon" className="h-7 w-7" onClick={() => toggleEdit('utilizacao')}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          }
        >
            {editingSections.has('utilizacao') ? (
              <UtilizacaoTable usado={usado} naoUsado={naoUsado} onChangeUsado={setUsado} onChangeNaoUsado={setNaoUsado} />
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Quando é usado</p>
                  {usado.filter(u => u.trim()).length > 0 ? (
                    <ul className="text-sm space-y-0.5">{usado.filter(u => u.trim()).map((u, i) => <li key={i}>• {u}</li>)}</ul>
                  ) : <p className="text-sm text-muted-foreground italic">Não definido</p>}
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Quando NÃO é usado</p>
                  {naoUsado.filter(u => u.trim()).length > 0 ? (
                    <ul className="text-sm space-y-0.5">{naoUsado.filter(u => u.trim()).map((u, i) => <li key={i}>• {u}</li>)}</ul>
                  ) : <p className="text-sm text-muted-foreground italic">Não definido</p>}
                </div>
              </div>
            )}
        </EntitySection>

        <EntitySection
          title="3 · Inputs Necessários"
          action={
            <Button variant="ghost" aria-label="Editar" size="icon" className="h-7 w-7" onClick={() => toggleEdit('inputs')}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          }
        >
            {editingSections.has('inputs') ? (
              <>
                <p className="text-sm text-warning mb-3">⚠️ Se algum item estiver em falta, não iniciar.</p>
                <EditableCheckList items={inputs} onChange={setInputs} />
              </>
            ) : (
              inputs.filter(i => i.text.trim()).length > 0 ? (
                <ul className="text-sm space-y-1">{inputs.filter(i => i.text.trim()).map((i, idx) => (
                  <li key={idx} className="flex items-center gap-2">
                    <span className={i.checked ? 'text-primary' : 'text-muted-foreground'}>{i.checked ? '✅' : '⬜'}</span>
                    <span className={i.checked ? 'line-through text-muted-foreground' : ''}>{i.text}</span>
                  </li>
                ))}</ul>
              ) : <EmptyHint>Sem inputs definidos</EmptyHint>
            )}
        </EntitySection>

        <EntitySection
          title="4 · Passos do Processo"
          action={
            <Button size="sm" variant="outline" onClick={() => addSopStep.mutate()}>
              <Plus className="h-3 w-3 mr-1" /> Passo
            </Button>
          }
        >
          {(isOnboardingSop || isOffboardingSop || isRenewalSop) && (
            <p className="text-xs text-muted-foreground mb-3">
              Os passos marcados com 👁️ aparecerão no checklist do cliente no portal. Os restantes são apenas internos.
            </p>
          )}
          {sopSteps.length === 0 && (
            <EmptyHint>Sem passos definidos. Clica em "+ Passo" para começar.</EmptyHint>
          )}
          <div className="space-y-2">
            {sopSteps.map((step, idx) => {
              const isExpanded = expandedSteps.has(step.id);
              const isDocOpen = docExpandedSteps.has(step.id);
              const docs = stepDocuments.filter((d) => d.step_id === step.id);
              return (
                <div key={step.id} className="border rounded-lg overflow-hidden">
                  {/* Main row */}
                  <div className="flex items-center gap-2 px-3 py-2">
                    <div className="flex flex-col shrink-0">
                      <Button variant="ghost" aria-label="Mostrar menos" size="icon" className="h-5 w-5" disabled={idx === 0} onClick={() => moveStep(idx, 'up')}>
                        <ChevronUp className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" aria-label="Mostrar mais" size="icon" className="h-5 w-5" disabled={idx === sopSteps.length - 1} onClick={() => moveStep(idx, 'down')}>
                        <ChevronDown className="h-3 w-3" />
                      </Button>
                    </div>
                    <span className="text-xs text-muted-foreground font-mono w-6 shrink-0">{idx + 1}.</span>
                    <Input
                      defaultValue={step.description}
                      onBlur={e => updateSopStep.mutate({ stepId: step.id, data: { description: e.target.value } })}
                      placeholder="Descrever passo..."
                      className="flex-1 border-none shadow-none h-8 px-1 text-sm focus-visible:ring-0"
                    />
                    {/* Doc toggle */}
                    <Button
                      variant="ghost"
                      aria-label="Anexar" size="icon"
                      className={cn("h-7 w-7 shrink-0", docs.length > 0 ? "text-primary" : "text-muted-foreground/30")}
                      onClick={() => setDocExpandedSteps(prev => {
                        const next = new Set(prev);
                        next.has(step.id) ? next.delete(step.id) : next.add(step.id);
                        return next;
                      })}
                      title="Documentos"
                    >
                      <Paperclip className="h-3.5 w-3.5" />
                      {docs.length > 0 && <span className="absolute -top-0.5 -right-0.5 text-[9px] bg-primary text-primary-foreground rounded-full w-3.5 h-3.5 flex items-center justify-center">{docs.length}</span>}
                    </Button>
                    {/* Expand details */}
                    <Button
                      variant="ghost"
                      aria-label="Mostrar menos" size="icon"
                      className="h-7 w-7 shrink-0 text-muted-foreground"
                      onClick={() => setExpandedSteps(prev => {
                        const next = new Set(prev);
                        next.has(step.id) ? next.delete(step.id) : next.add(step.id);
                        return next;
                      })}
                    >
                      {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </Button>
                    <Button variant="ghost" aria-label="Eliminar" size="icon" className="h-7 w-7 shrink-0" onClick={() => deleteSopStep.mutate(step.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>

                  {/* Expanded details: deadline, trigger, responsible */}
                  {isExpanded && (
                    <div className="px-3 pb-3 pt-1 border-t bg-muted/20">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="flex items-center gap-2">
                          <Label className="text-[10px] text-muted-foreground whitespace-nowrap">Prazo</Label>
                          <Input
                            type="number"
                            min={0}
                            defaultValue={step.deadline_days ?? ''}
                            placeholder="Nº"
                            onBlur={e => updateSopStep.mutate({ stepId: step.id, data: { deadline_days: e.target.value ? parseInt(e.target.value) : null } })}
                            className="h-7 text-xs w-14"
                          />
                          <select
                            value={step.deadline_unit || 'dias'}
                            onChange={e => updateSopStep.mutate({ stepId: step.id, data: { deadline_unit: e.target.value } })}
                            className="text-[10px] bg-transparent border rounded px-1 py-1 text-muted-foreground"
                          >
                            <option value="horas_uteis">h úteis</option>
                            <option value="dias_uteis">dias úteis</option>
                            <option value="dias">dias</option>
                            <option value="semanas">semanas</option>
                          </select>
                        </div>
                        <div>
                          <Label className="text-[10px] text-muted-foreground">Gatilho</Label>
                          <select
                            defaultValue={step.deadline_trigger || 'apos_inicio'}
                            onChange={e => updateSopStep.mutate({ stepId: step.id, data: { deadline_trigger: e.target.value } })}
                            className="w-full text-xs bg-transparent border rounded px-2 py-1.5 text-muted-foreground"
                          >
                            <option value="no_dia">No dia</option>
                            <option value="apos_inicio">Após início</option>
                            <option value="apos_passo_anterior">Após passo anterior</option>
                            <option value="reuniao_inicial">Após reunião inicial</option>
                            <option value="onboarding_completo">Após onboarding completo</option>
                            <option value="fim_ciclo">Antes do fim do ciclo</option>
                          </select>
                        </div>
                        <div>
                          <Label className="text-[10px] text-muted-foreground">Responsável</Label>
                          <Select
                            value={step.responsible || '_none_'}
                            onValueChange={v => updateSopStep.mutate({ stepId: step.id, data: { responsible: v === '_none_' ? null : v } })}
                          >
                            <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Nenhuma" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="_none_">Nenhuma</SelectItem>
                              <SelectItem value="cliente">Cliente</SelectItem>
                              {teamRoles.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Inline docs */}
                  {isDocOpen && (
                    <div className="px-3 pb-3 pt-1 border-t bg-muted/10 space-y-2">
                      {docs.map((doc) => (
                        <div key={doc.id} className="flex items-start gap-2 bg-background rounded p-2 border">
                          <select
                            value={doc.document_type}
                            onChange={e => updateStepDoc.mutate({ docId: doc.id, data: { document_type: e.target.value } })}
                            className="text-[10px] bg-transparent border rounded px-1 py-0.5 text-muted-foreground shrink-0 mt-0.5"
                          >
                            <option value="email">📧 Email</option>
                            <option value="mensagem">💬 Mensagem</option>
                            <option value="documento">📄 Documento</option>
                            <option value="template">📋 Template</option>
                            <option value="link">🔗 Link</option>
                          </select>
                          <div className="flex-1 space-y-1">
                            <Input
                              defaultValue={doc.title}
                              onBlur={e => updateStepDoc.mutate({ docId: doc.id, data: { title: e.target.value } })}
                              placeholder="Título..."
                              className="h-6 text-xs border-none shadow-none px-0 focus-visible:ring-0"
                            />
                            {doc.document_type === 'link' ? (
                              <Input
                                defaultValue={doc.url || ''}
                                onBlur={e => updateStepDoc.mutate({ docId: doc.id, data: { url: e.target.value } })}
                                placeholder="https://..."
                                className="h-7 text-xs"
                              />
                            ) : (
                              <div className="flex items-center gap-1">
                                <div className="text-xs text-muted-foreground truncate flex-1">
                                  {doc.content ? `${doc.content.substring(0, 60)}...` : 'Sem conteúdo'}
                                </div>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-6 text-[10px] shrink-0"
                                  onClick={() => setEditingDoc(doc)}
                                >
                                  <Pencil className="h-3 w-3 mr-1" /> Editar
                                </Button>
                              </div>
                            )}
                          </div>
                          <Button variant="ghost" aria-label="Eliminar" size="icon" className="h-6 w-6 shrink-0" onClick={() => deleteStepDoc.mutate(doc.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => addStepDoc.mutate(step.id)}>
                          <Plus className="h-3 w-3 mr-1" /> Documento/Template
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => {
                          (async () => {
                            await (supabase.from as any)('sop_step_documents').insert({
                              sop_id: id,
                              step_id: step.id,
                              step_index: 0,
                              document_type: 'link',
                              title: '',
                              url: '',
                              sort_order: docs.length,
                            });
                            queryClient.invalidateQueries({ queryKey: ['sop-step-documents', id] });
                          })();
                        }}>
                          <ExternalLink className="h-3 w-3 mr-1" /> Link
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </EntitySection>

        {isOffboardingSop && linkedProductId && (
          <RenewalSection productId={linkedProductId} />
        )}

        {isPaymentSop && linkedProductId && (
          <PaymentMethodsSection productId={linkedProductId} />
        )}

        {isAcompanhamentoSop && linkedProductId && (
          <MilestonesSection productId={linkedProductId} teamMembers={teamMembers} />
        )}

        {isKpisSop && linkedProductId && (
          <KpisSection productId={linkedProductId} />
        )}

        <EntitySection
          title="5 · Decisões / Exceções"
          action={
            <Button variant="ghost" aria-label="Editar" size="icon" className="h-7 w-7" onClick={() => toggleEdit('decisoes')}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          }
        >
            {editingSections.has('decisoes') ? (
              <EditableBulletList items={decisoes} onChange={setDecisoes} placeholder="(se acontecer X, fazer Y)" />
            ) : (
              decisoes.filter(d => d.trim()).length > 0 ? (
                <ul className="text-sm space-y-0.5">{decisoes.filter(d => d.trim()).map((d, i) => <li key={i}>• {d}</li>)}</ul>
              ) : <EmptyHint>Sem decisões definidas</EmptyHint>
            )}
        </EntitySection>

        <EntitySection
          title="6 · Outputs Finais"
          action={
            <Button variant="ghost" aria-label="Editar" size="icon" className="h-7 w-7" onClick={() => toggleEdit('outputs')}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          }
        >
            {editingSections.has('outputs') ? (
              <>
                <p className="text-sm text-success mb-3">✅ O processo considera-se concluído quando:</p>
                <EditableCheckList items={outputs} onChange={setOutputs} />
              </>
            ) : (
              outputs.filter(o => o.text.trim()).length > 0 ? (
                <ul className="text-sm space-y-1">{outputs.filter(o => o.text.trim()).map((o, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className={o.checked ? 'text-primary' : 'text-muted-foreground'}>{o.checked ? '✅' : '⬜'}</span>
                    <span className={o.checked ? 'line-through text-muted-foreground' : ''}>{o.text}</span>
                  </li>
                ))}</ul>
              ) : <EmptyHint>Sem outputs definidos</EmptyHint>
            )}
        </EntitySection>

        <EntitySection
          title="7 · Notas"
          action={
            <Button variant="ghost" aria-label="Editar" size="icon" className="h-7 w-7" onClick={() => toggleEdit('notas')}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          }
        >
            {editingSections.has('notas') ? (
              <EditableBulletList items={notas} onChange={setNotas} placeholder="Nota..." />
            ) : (
              notas.filter(n => n.trim()).length > 0 ? (
                <ul className="text-sm space-y-0.5">{notas.filter(n => n.trim()).map((n, i) => <li key={i}>• {n}</li>)}</ul>
              ) : <EmptyHint>Sem notas</EmptyHint>
            )}
        </EntitySection>

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
            Serão criadas {sopSteps.filter((s) => s.description?.trim()).length} tarefas a partir dos passos do processo.
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
              Criar {sopSteps.filter((s) => s.description?.trim()).length} Tarefas
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Document Content Dialog */}
      <Dialog open={!!editingDoc} onOpenChange={open => { if (!open) setEditingDoc(null); }}>
        <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editingDoc?.document_type === 'email' && '📧'}
              {editingDoc?.document_type === 'mensagem' && '💬'}
              {editingDoc?.document_type === 'documento' && '📄'}
              {editingDoc?.document_type === 'template' && '📋'}
              {editingDoc?.title || 'Documento sem título'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 flex-1 overflow-auto">
            <div>
              <Label className="text-xs">Título</Label>
              <Input
                defaultValue={editingDoc?.title || ''}
                onBlur={e => {
                  if (editingDoc && e.target.value !== editingDoc.title) {
                    updateStepDoc.mutate({ docId: editingDoc.id, data: { title: e.target.value } });
                    setEditingDoc((prev) => prev ? { ...prev, title: e.target.value } : null);
                  }
                }}
                placeholder="Título do documento..."
              />
            </div>
            <div className="flex-1">
              <Label className="text-xs">Conteúdo</Label>
              <p className="text-[10px] text-muted-foreground mb-1">Variáveis disponíveis: {'{nome_cliente}'}, {'{produto}'}, {'{data}'}, {'{empresa}'}</p>
              <Textarea
                defaultValue={editingDoc?.content || ''}
                onBlur={e => {
                  if (editingDoc && e.target.value !== (editingDoc.content || '')) {
                    updateStepDoc.mutate({ docId: editingDoc.id, data: { content: e.target.value } });
                    setEditingDoc((prev) => prev ? { ...prev, content: e.target.value } : null);
                  }
                }}
                placeholder="Escreve o conteúdo do documento/template aqui..."
                className="min-h-[350px] text-sm font-mono"
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
