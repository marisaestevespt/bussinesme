import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { getTaskStatusInfo } from '@/lib/taskStatus';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useTeamPhotos } from '@/hooks/useTeamPhotos';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Save, Target, BookOpen, CalendarIcon, Link2, FileText, Users, Lightbulb, StickyNote, Plus, ChevronDown, ChevronRight, CheckSquare, Upload, Trash2, Download, File, ImageIcon, X, Clock, MessageSquare, MessageCircle, ExternalLink, AlertTriangle, DollarSign, Check, ListChecks, Flag, ClipboardList, LayoutDashboard, Workflow, Settings2 } from 'lucide-react';
import { BackNavigation } from '@/components/BackNavigation';
import {
  EntitySection,
  EntityTabs,
  EntityTabsList,
  EntityTabsTrigger,
  EntityTabsContent,
} from '@/components/layout/entity';
import { useTaskTimeTotals, formatDuration } from '@/components/TaskTimeTracker';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useImpersonation } from '@/contexts/ImpersonationContext';
import { toast } from 'sonner';
import { format, parseISO, startOfMonth, endOfMonth } from 'date-fns';
import { pt } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { ProductIcon } from '@/components/entity-icon';
import { isTaskDone } from '@/lib/taskStatus';
import { MentionTextarea } from '@/components/MentionTextarea';
import { PROJECT_TYPES, PROJECT_STATUSES, DEPARTMENTS, getTypeInfo, getStatusInfo, getDeptLabel, getDeptInfo, getInitials } from './Projetos';
import { LaunchDashboard } from '@/components/launch/LaunchDashboard';
import { ProjectDeliverables } from '@/components/project/ProjectDeliverables';
import { ProjectProcessosTab } from '@/components/project/ProjectProcessosTab';
import { ProjectPhasesGallery } from '@/components/project/ProjectPhasesGallery';
import { ProjectGestaoTab } from '@/components/project/ProjectGestaoTab';
import { ClientPortalSection } from '@/components/client/ClientPortalSection';
import { ClientPortalFeedbackSection } from '@/components/client/ClientPortalFeedbackSection';
import { InvoiceUpload, type DocEntry } from '@/components/financial/InvoiceUpload';
import { MeetingFormDialog } from '@/pages/Reunioes';
import type { Profile as MeetingProfile, ProjectOption } from '@/pages/Reunioes';
import { useProjectDetailData, calcTotalTime, type ProjectFull, type Profile, type Task, type Meeting } from '@/hooks/useProjectDetailData';
import { TaskFormDialog } from '@/components/tasks/TaskFormDialog';
import { EntregaveisSubPage } from '@/components/project/subpages/EntregaveisSubPage';
import { CronogramaSubPage } from '@/components/project/subpages/CronogramaSubPage';
import { OutrasInfoSubPage } from '@/components/project/subpages/OutrasInfoSubPage';
import { ReunioesSubPage } from '@/components/project/subpages/ReunioesSubPage';
import { TextWithAssetsSubPage } from '@/components/project/subpages/TextWithAssetsSubPage';
import { BriefingSubPage } from '@/components/project/subpages/BriefingSubPage';

import { Alert, AlertDescription } from '@/components/ui/alert';

// ─── Sub-page sections for Internal project ─────────────────────

type SubPage = null | 'objetivo' | 'diretrizes' | 'cronograma' | 'briefing' | 'entregaveis' | 'reunioes' | 'recursos' | 'notas' | 'outras_info';

const TASK_PRIORITIES = [
  { value: 'baixa', label: 'Baixa', color: 'bg-muted text-muted-foreground' },
  { value: 'media', label: 'Média', color: 'bg-warning/15 text-warning' },
  { value: 'alta', label: 'Alta', color: 'bg-warning/15 text-warning' },
  { value: 'urgente', label: 'Urgente', color: 'bg-destructive/15 text-destructive' },
];

function getPriorityInfo(v: string) { return TASK_PRIORITIES.find(p => p.value === v) || TASK_PRIORITIES[1]; }

function ProjectTimeDisplay({ taskIds }: { taskIds: string[] }) {
  const { data: totalMinutes = 0 } = useTaskTimeTotals(taskIds);
  if (totalMinutes === 0) return null;
  return (
    <Badge variant="secondary" className="gap-1 text-xs">
      <Clock className="h-3 w-3" /> {formatDuration(totalMinutes)} investidas
    </Badge>
  );
}

// ─── Main Component ─────────────────────────────────────────────

export default function ProjetoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { isOwner } = useAuth();
  const { impersonating } = useImpersonation();
  const effectiveUserId = impersonating?.user_id || user?.id;
  const { getPhotoUrl } = useTeamPhotos();

  const [subPage, setSubPage] = useState<SubPage>(null);
  const [dirty, setDirty] = useState(false);
  const [local, setLocal] = useState<ProjectFull | null>(null);

  // Task dialog
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [taskDetailId, setTaskDetailId] = useState<string | null>(null);
  const [taskName, setTaskName] = useState('');
  const [taskPriority, setTaskPriority] = useState('media');
  const [taskDeadline, setTaskDeadline] = useState<Date | undefined>();

  // Meeting dialog
  const [meetingDialogOpen, setMeetingDialogOpen] = useState(false);

  // Members dialog
  const [membersDialogOpen, setMembersDialogOpen] = useState(false);

  // Compute monthly window (used by data hook for recorrente mensal projects)
  const isServicoMensal = local?.type === 'cliente_servico_mensal';
  const isRecorrenteMensal = isServicoMensal && (local as any)?.project_mode === 'recorrente';
  const now = new Date();
  const monthStart = format(startOfMonth(now), 'yyyy-MM-dd');
  const monthEnd = format(endOfMonth(now), 'yyyy-MM-dd');

  // Aggregated data hook: 11 queries + 2 mutations extraídos para reduzir 200+ linhas
  const {
    allProjectsForMeeting,
    project,
    isLoading,
    profiles,
    teamMembersPhotos,
    projectMembers,
    tasks,
    clientsList,
    projectCost,
    clientForProject,
    projectPhases,
    projectDeliverables,
    monthlyTasks,
    meetings,
    toggleMember,
    deleteMutation,
  } = useProjectDetailData(id, { isRecorrenteMensal, monthStart, monthEnd });
  const resolvedClientId = clientForProject?.id;

  // Suggested meeting title from the next pending meeting-deliverable's template
  const suggestedMeetingTitle = useMemo(() => {
    const dels = (projectDeliverables || []) as any[];
    if (!dels.length) return '';
    const meetingDels = dels
      .filter(d => (d.deliverable_type === 'reuniao' || d.is_meeting === true))
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    const next = meetingDels.find(d => !d.meeting_id && d.meeting_title_template);
    if (!next?.meeting_title_template) return '';
    const sameTpl = meetingDels.filter(d => d.meeting_title_template === next.meeting_title_template);
    const n = sameTpl.findIndex(d => d.id === next.id) + 1;
    const clientName = (local as any)?.client_name || (clientForProject as any)?.full_name || '';
    return String(next.meeting_title_template)
      .replace(/\{N\}/g, String(n))
      .replace(/\{cliente\}/gi, clientName);
  }, [projectDeliverables, (local as any)?.client_name, (clientForProject as any)?.full_name]);

  function getProjectProgress() {
    // Recorrente mensal: progress by current month tasks
    if (isRecorrenteMensal) {
      if (monthlyTasks.length === 0) return 0;
      const completed = monthlyTasks.filter(isTaskDone).length;
      return Math.round((completed / monthlyTasks.length) * 100);
    }

    // All other projects: deliverables > phases
    if (projectDeliverables.length > 0) {
      const completed = projectDeliverables.filter((d: any) => d.status === 'concluido').length;
      return Math.round((completed / projectDeliverables.length) * 100);
    }

    if (projectPhases.length > 0) {
      const completed = projectPhases.filter((p: any) => p.status === 'concluida').length;
      return Math.round((completed / projectPhases.length) * 100);
    }

    return 0;
  }

  function getProjectProgressSummary() {
    if (isRecorrenteMensal) {
      if (monthlyTasks.length === 0) return 'Sem tarefas este mês';
      const completed = monthlyTasks.filter(isTaskDone).length;
      return `${completed}/${monthlyTasks.length} tarefas do mês concluídas`;
    }

    if (projectDeliverables.length > 0) {
      const completed = projectDeliverables.filter((d: any) => d.status === 'concluido').length;
      return `${completed}/${projectDeliverables.length} points concluídos`;
    }

    if (projectPhases.length > 0) {
      const completed = projectPhases.filter((p: any) => p.status === 'concluida').length;
      return `${completed}/${projectPhases.length} fases concluídas`;
    }

    return 'Sem fases ou points definidos';
  }

  const autoProgress = getProjectProgress();
  // Persist computed progress when it diverges, but debounced and only when DB value
  // (project.progress) is out of sync — avoids a write on every render/keypress.
  useEffect(() => {
    if (!local || !project) return;
    if (autoProgress === project.progress) return;
    const t = setTimeout(() => {
      supabase.from('projects').update({ progress: autoProgress }).eq('id', local.id);
    }, 1500);
    return () => clearTimeout(t);
  }, [autoProgress, project?.progress, local?.id]);

  // Deadline overdue check
  const isOverdue = local?.deadline && local.status !== 'concluido' && local.status !== 'cancelado' && new Date(local.deadline) < new Date();

  const formatCost = (v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}k €` : `${v.toFixed(0)} €`;

  const teamPhotoByProfileId = new Map(
    teamMembersPhotos
      .filter((t) => t.profile_id && t.photo_url)
      .map((t) => [t.profile_id as string, t.photo_url as string])
  );
  const teamPhotoByName = new Map(
    teamMembersPhotos
      .filter((t) => t.full_name && t.photo_url)
      .map((t) => [t.full_name.trim().toLowerCase(), t.photo_url as string])
  );
  const profileMap = new Map(
    profiles.map((p) => [
      p.id,
      {
        ...p,
        avatar_url:
          p.avatar_url ||
          teamPhotoByProfileId.get(p.id) ||
          teamPhotoByProfileId.get(p.user_id) ||
          teamPhotoByName.get((p.full_name || '').trim().toLowerCase()) ||
          null,
      },
    ])
  );

  useEffect(() => { if (project && !local) setLocal(project); }, [project]);

  const updateField = (field: keyof ProjectFull, value: any) => {
    setLocal(prev => (prev ? { ...prev, [field]: value } : prev));
    setDirty(true);
  };

  // Auto-save with debounce when dirty
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!dirty || !local) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      saveMutation.mutate();
    }, 1500);
    return () => { if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current); };
  }, [dirty, local]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!local) return;
      const payload: Record<string, any> = {
        name: local.name, type: local.type, status: local.status, department: local.department,
        departments: local.departments,
        client_name: local.client_name, client_id: local.client_id,
        product_id: local.product_id, product_name: local.product_name,
        start_date: local.start_date, deadline: local.deadline, notes: local.notes,
        objetivo: local.objetivo, objetivo_curto: (local as any).objetivo_curto,
        diretrizes: local.diretrizes, cronograma: local.cronograma,
        entregaveis: local.entregaveis, recursos: local.recursos, project_notes: local.project_notes,
        closure_good: local.closure_good, closure_bad: local.closure_bad, closure_lessons: local.closure_lessons,
        cover_url: local.cover_url, contract_documents: local.contract_documents || [],
        payment_method: local.payment_method || null, payment_config: local.payment_config || null,
        project_mode: (local as any).project_mode || 'pontual',
        task_mode: (local as any).task_mode || 'fases',
      };
      // Auto-calculate total time when marking as concluded
      if (local.status === 'concluido' && project?.status !== 'concluido') {
        payload.total_time_minutes = await calcTotalTime(local.id);
      }
      const { error } = await supabase.from('projects').update(payload as any).eq('id', local.id);
      if (error) throw error;
    },
    onSuccess: () => { setDirty(false); queryClient.invalidateQueries({ queryKey: ['project', id] }); toast.success('Guardado'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const path = `covers/${id}/${Date.now()}_${file.name}`;
    const { error } = await supabase.storage.from('project-files').upload(path, file);
    if (error) { toast.error(error.message); return; }
    const { data } = supabase.storage.from('project-files').getPublicUrl(path);
    updateField('cover_url', data.publicUrl);
    // Auto-save cover
    await supabase.from('projects').update({ cover_url: data.publicUrl }).eq('id', id!);
    queryClient.invalidateQueries({ queryKey: ['project', id] });
    toast.success('Capa atualizada');
  };

  const createTaskMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('tasks').insert({
        name: taskName, priority: taskPriority, project_id: id,
        department: local?.department || null,
        deadline: taskDeadline ? format(taskDeadline, 'yyyy-MM-dd') : null,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-tasks', id] });
      toast.success('Tarefa criada');
      setTaskDialogOpen(false); setTaskName(''); setTaskPriority('media'); setTaskDeadline(undefined);
    },
  });

  const generateMonthlyTasksMutation = useMutation({
    mutationFn: async () => {
      if (!local?.product_id) { toast.error('Sem produto associado — não é possível gerar tarefas.'); throw new Error('no product'); }
      const now = new Date();
      const monthLabel = format(now, 'MMMM yyyy', { locale: pt });
      // Get product deliverable templates
      const { data: templates } = await supabase.from('product_deliverable_templates').select('name, description, sort_order').eq('product_id', local.product_id).order('sort_order');
      if (!templates || templates.length === 0) { toast.error('Sem entregáveis configurados no produto.'); throw new Error('no templates'); }
      // Check if already generated this month
      const monthStart = format(startOfMonth(now), 'yyyy-MM-dd');
      const monthEnd = format(endOfMonth(now), 'yyyy-MM-dd');
      const { data: existing } = await supabase.from('tasks').select('id').eq('project_id', id!).gte('deadline', monthStart).lte('deadline', monthEnd);
      if (existing && existing.length > 0) { toast.info(`Já existem ${existing.length} tarefas este mês.`); return; }
      // Create tasks
      const lastDay = format(endOfMonth(now), 'yyyy-MM-dd');
      const tasksToInsert = templates.map((t: any) => ({
        name: t.name,
        notes: t.description || null,
        project_id: id,
        department: local?.department || null,
        deadline: lastDay,
        created_by: user?.id,
        priority: 'media',
      }));
      const { error } = await supabase.from('tasks').insert(tasksToInsert);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-tasks', id] });
      toast.success('Tarefas do mês geradas com sucesso!');
    },
  });

  if (isLoading || !local) return <AppLayout><div className="space-y-6"><div className="h-8 w-48 animate-pulse rounded bg-muted" /><div className="grid gap-4 md:grid-cols-2"><div className="h-32 animate-pulse rounded-lg bg-muted" /><div className="h-32 animate-pulse rounded-lg bg-muted" /></div><div className="h-64 animate-pulse rounded-lg bg-muted" /></div></AppLayout>;

  // Access gate: Owner real (sem impersonação), criador, ou membro do projeto.
  const realIsOwner = isOwner && !impersonating;
  const myProfileId = profiles.find((p: any) => p.user_id === effectiveUserId)?.id ?? null;
  const isCreator = !!effectiveUserId && (local as any).created_by === effectiveUserId;
  const isProjectMember = !!myProfileId && projectMembers.includes(myProfileId);
  if (!realIsOwner && !isCreator && !isProjectMember) {
    return (
      <AppLayout>
        <div className="max-w-xl mx-auto mt-12 rounded-xl border border-border/60 bg-card p-8 text-center space-y-3 shadow-subtle">
          <h2 className="text-lg font-semibold text-foreground">Sem acesso ao projeto</h2>
          <p className="text-sm text-muted-foreground">
            Só os membros e o criador do projeto podem ver o detalhe e editar.
          </p>
          <Button variant="outline" onClick={() => navigate('/hub/projetos')}>← Voltar aos projetos</Button>
        </div>
      </AppLayout>
    );
  }

  const typeI = getTypeInfo(local.type);
  const statusI = getStatusInfo(local.status);

  // ─── Render sub-page ──────────────────────────────────────────
  if (subPage) {
  // ─── Cronograma sub-page (table with Macro + Prazo) ──────────
  if (subPage === 'cronograma') {
    return (
      <CronogramaSubPage
        projectId={id!}
        cronogramaJson={local.cronograma}
        onChange={v => updateField('cronograma', v)}
        onBack={() => setSubPage(null)}
        onSave={() => saveMutation.mutate()}
        saving={saveMutation.isPending}
        dirty={dirty}
      />
    );
  }
  if (subPage === 'outras_info') {
    return (
      <OutrasInfoSubPage
        projectId={id!}
        value={(local.project_notes as string) || ''}
        onChange={v => updateField('project_notes', v)}
        onBack={() => setSubPage(null)}
        onSave={() => saveMutation.mutate()}
        saving={saveMutation.isPending}
        dirty={dirty}
      />
    );
  }
  if (subPage === 'reunioes') {
    return (
      <ReunioesSubPage
        projectId={id!}
        meetings={meetings}
        projectMembers={projectMembers}
        profileMap={profileMap}
        getPhotoUrl={getPhotoUrl}
        onBack={() => setSubPage(null)}
        onNewMeeting={() => setMeetingDialogOpen(true)}
      />
    );
  }
  if (subPage === 'briefing') {
    return (
      <BriefingSubPage
        projectId={id!}
        clientId={local.client_id}
        clientName={local.client_name}
        projectName={local.name}
        onBack={() => setSubPage(null)}
      />
    );
  }

  // ─── Entregáveis sub-page (file upload + list) ────────────────
  if (subPage === 'entregaveis') {
    return <EntregaveisSubPage projectId={id!} entregaveisText={local.entregaveis || ''} onTextChange={v => updateField('entregaveis', v)} onSave={() => saveMutation.mutate()} saving={saveMutation.isPending} dirty={dirty} onBack={() => setSubPage(null)} />;
  }

    const textPagesConfig: Record<string, {
      field: keyof ProjectFull;
      title: string;
      description: string;
      icon: React.ElementType;
      textLabel: string;
      textPlaceholder: string;
      assetsLabel: string;
      assetsDescription: string;
      assetCategories: string[];
    }> = {
      objetivo: {
        field: 'objetivo',
        title: 'Objetivo e Definição',
        description: 'O objetivo do projeto e a sua definição/escopo.',
        icon: Target,
        textLabel: 'Definição do projeto',
        textPlaceholder: 'Escopo, resultados esperados, restrições...',
        assetsLabel: 'Briefings e referências',
        assetsDescription: 'Documentos que fundamentam o objetivo (briefing, RFP, propostas).',
        assetCategories: ['Briefing', 'Proposta', 'Contexto'],
      },
      diretrizes: {
        field: 'diretrizes',
        title: 'Diretrizes Iniciais',
        description: 'Princípios, regras e direções acordadas com o cliente / equipa.',
        icon: BookOpen,
        textLabel: 'Diretrizes',
        textPlaceholder: 'Tom, restrições, princípios, do/don\'t...',
        assetsLabel: 'Manuais e guias',
        assetsDescription: 'Brand guidelines, manuais, templates de referência.',
        assetCategories: ['Manual', 'Guideline', 'Template'],
      },
      recursos: {
        field: 'recursos',
        title: 'Recursos & Materiais',
        description: 'Ferramentas, contas, materiais e referências usadas no projeto.',
        icon: Lightbulb,
        textLabel: 'Notas de recursos & materiais',
        textPlaceholder: 'Listas de ferramentas, acessos, observações...',
        assetsLabel: 'Galeria de recursos & materiais',
        assetsDescription: 'Ferramentas, contas, ficheiros de apoio, anexos internos da equipa, links externos. Não é partilhado com o cliente.',
        assetCategories: ['Anexo interno', 'Ferramenta', 'Acesso', 'Referência', 'Inspiração'],
      },
      notas: {
        field: 'project_notes',
        title: 'Notas',
        description: 'Notas livres, decisões, comentários ao longo do projeto.',
        icon: StickyNote,
        textLabel: 'Notas livres',
        textPlaceholder: 'Escreve... usa @ para mencionar membros.',
        assetsLabel: 'Anexos das notas',
        assetsDescription: 'Imagens, prints, PDFs anexados às notas.',
        assetCategories: ['Decisão', 'Print', 'Comentário'],
      },
    };

    const cfg = textPagesConfig[subPage];
    if (!cfg) return null;
    return (
      <TextWithAssetsSubPage
        projectId={id!}
        pageKey={subPage}
        title={cfg.title}
        description={cfg.description}
        icon={cfg.icon}
        shortLabel={subPage === 'objetivo' ? 'Objetivo' : undefined}
        shortPlaceholder={subPage === 'objetivo' ? 'Numa frase: o que se vai alcançar com este projeto?' : undefined}
        shortValue={subPage === 'objetivo' ? ((local as any).objetivo_curto || '') : undefined}
        onShortChange={subPage === 'objetivo' ? (v) => updateField('objetivo_curto' as any, v) : undefined}
        textLabel={cfg.textLabel}
        textPlaceholder={cfg.textPlaceholder}
        assetsLabel={cfg.assetsLabel}
        assetsDescription={cfg.assetsDescription}
        assetCategories={cfg.assetCategories}
        value={(local[cfg.field] as string) || ''}
        onChange={v => updateField(cfg.field, v)}
        onBack={() => setSubPage(null)}
        onSave={() => saveMutation.mutate()}
        saving={saveMutation.isPending}
        dirty={dirty}
      />
    );
  }

  // ─── Launch project ────────────────────────────────────────────
  if (local.type === 'lancamento') {
    return (
      <AppLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <BackNavigation />
            {dirty && <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} size="sm" className="gap-2"><Save className="h-4 w-4" /> Guardar</Button>}
          </div>

          {/* Header */}
          <div className="space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              <Badge className={`${typeI.color} border-0`}>{typeI.label}</Badge>
              <Select value={local.status} onValueChange={v => updateField('status', v)}><SelectTrigger className="w-36 h-8"><SelectValue /></SelectTrigger><SelectContent>{PROJECT_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent></Select>
              {local.department && <span className="text-sm text-muted-foreground">{getDeptLabel(local.department)}</span>}
            </div>
            <Input value={local.name} onChange={e => updateField('name', e.target.value)} className="text-4xl font-bold border-none px-0 focus-visible:ring-0 h-auto" />
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">Prazo:</Label>
                <Popover><PopoverTrigger asChild><Button variant="outline" size="sm" className={cn("h-7 text-xs", !local.deadline && "text-muted-foreground")}><CalendarIcon className="mr-1 h-3 w-3" />{local.deadline ? format(new Date(local.deadline), 'd MMM yyyy', { locale: pt }) : '—'}</Button></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={local.deadline ? new Date(local.deadline) : undefined} onSelect={d => updateField('deadline', d ? format(d, 'yyyy-MM-dd') : null)} className="p-3 pointer-events-auto" /></PopoverContent></Popover>
              </div>
              <div className="flex -space-x-1">{projectMembers.map(pid => { const p = profileMap.get(pid); return p ? <Avatar key={pid} className="h-6 w-6 border-2 border-background"><AvatarImage src={getPhotoUrl(p)} /><AvatarFallback className="text-[8px]">{getInitials(p.full_name)}</AvatarFallback></Avatar> : null; })}</div>
            </div>
          </div>

          <Separator />

          {/* Launch Dashboard */}
          <LaunchDashboard projectId={id!} projectName={local.name} profiles={profiles} />

          <Separator />
          <AlertDialog>
            <AlertDialogTrigger asChild><Button variant="ghost" size="sm" className="text-destructive hover:text-destructive gap-2"><Trash2 className="h-4 w-4" /> Arquivar projeto</Button></AlertDialogTrigger>
            <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Arquivar projeto?</AlertDialogTitle><AlertDialogDescription>O projeto deixa de aparecer na lista principal mas todos os dados (fases, entregas, tarefas, reuniões) ficam preservados. Podes restaurá-lo a qualquer momento na aba "Arquivados".</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => deleteMutation.mutate()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Arquivar</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
          </AlertDialog>
        </div>
      </AppLayout>
    );
  }

  // ─── Project layout (cliente_*, servico, clientes, interno) ─────
  if (
    local.type === 'servico' ||
    local.type === 'cliente_servico_mensal' ||
    local.type === 'cliente_projeto_unico' ||
    local.type === 'clientes' ||
    local.type === 'cliente' ||
    local.type === 'interno'
  ) {
    const taskMode: string = (local as any).task_mode || 'fases';
    return (
      <AppLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <BackNavigation />
            <div className="flex items-center gap-2">
              {dirty && <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} size="sm" className="gap-2"><Save className="h-4 w-4" /> Guardar</Button>}
            </div>
          </div>

          {/* Cover image */}
          {local.cover_url ? (
            <div className="relative rounded-xl overflow-hidden h-48 group">
              <img src={local.cover_url} alt="Capa" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                <label className="cursor-pointer"><input type="file" accept="image/*" onChange={handleCoverUpload} className="hidden" /><Button variant="secondary" size="sm" className="gap-2"><ImageIcon className="h-3.5 w-3.5" /> Alterar</Button></label>
                <Button variant="secondary" size="sm" className="gap-2 ml-2" onClick={() => { updateField('cover_url', null); supabase.from('projects').update({ cover_url: null }).eq('id', id!); }}><X className="h-3.5 w-3.5" /> Remover</Button>
              </div>
            </div>
          ) : (
            <label className="flex items-center justify-center h-32 border-2 border-dashed rounded-xl cursor-pointer hover:bg-muted/60 border border-border/50 transition-colors">
              <input type="file" accept="image/*" onChange={handleCoverUpload} className="hidden" />
              <div className="flex items-center gap-2 text-muted-foreground"><ImageIcon className="h-5 w-5" /><span className="text-sm">Adicionar capa</span></div>
            </label>
          )}

          {/* Deadline overdue banner */}
          {isOverdue && (
            <Alert variant="destructive" className="border-destructive/50 bg-destructive/10">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-sm">
                A deadline deste projeto ({format(new Date(local.deadline!), 'd MMM yyyy', { locale: pt })}) já passou. Atualiza o prazo ou conclui o projeto.
              </AlertDescription>
            </Alert>
          )}

          {/* Header - Name first, then tags, then fields in single column */}
          {/* Project title */}
          <Input value={local.name} onChange={e => updateField('name', e.target.value)} className="text-4xl font-bold border-none px-0 focus-visible:ring-0 h-auto" />

          {/* Notion-style property rows */}
          <div className="space-y-1">
            {/* Status */}
            <div className="flex items-center gap-3 py-2.5 px-3 rounded-lg bg-muted/60 border border-border/50">
              <span className="flex items-center gap-2 text-sm text-muted-foreground w-40 shrink-0"><Target className="h-4 w-4" /> Status</span>
              <Select value={local.status} onValueChange={v => updateField('status', v)}><SelectTrigger className="w-40 h-8"><SelectValue /></SelectTrigger><SelectContent>{PROJECT_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent></Select>
            </div>
            {/* Tipo */}
            <div className="flex items-center gap-3 py-2.5 px-3 rounded-lg bg-muted/60 border border-border/50">
              <span className="flex items-center gap-2 text-sm text-muted-foreground w-40 shrink-0"><FileText className="h-4 w-4" /> Tipo</span>
              <Badge className={`${typeI.color} border-0`}>{typeI.label}</Badge>
            </div>
            {/* Modo */}
            <div className="flex items-center gap-3 py-2.5 px-3 rounded-lg bg-muted/60 border border-border/50">
              <span className="flex items-center gap-2 text-sm text-muted-foreground w-40 shrink-0"><FileText className="h-4 w-4" /> Modo</span>
              <Select value={(local as any).project_mode || 'pontual'} onValueChange={v => updateField('project_mode', v)}>
                <SelectTrigger className="w-40 h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pontual">Pontual</SelectItem>
                  <SelectItem value="recorrente">🔄 Recorrente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {/* Modo Operacional */}
            <div className="flex items-center gap-3 py-2.5 px-3 rounded-lg bg-muted/60 border border-border/50">
              <span className="flex items-center gap-2 text-sm text-muted-foreground w-40 shrink-0"><CheckSquare className="h-4 w-4" /> Operação</span>
              <Select value={taskMode} onValueChange={v => updateField('task_mode', v)}>
                <SelectTrigger className="w-52 h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fases">📊 Fases e Entregáveis</SelectItem>
                  <SelectItem value="tarefas_fixas">📋 Tarefas Fixas Mensais</SelectItem>
                  <SelectItem value="tarefas_livres">✏️ Tarefas Livres</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {/* Progresso */}
            {taskMode !== 'tarefas_livres' && (
              <div className="flex items-center gap-3 py-2.5 px-3 rounded-lg bg-muted/60 border border-border/50">
                <span className="flex items-center gap-2 text-sm text-muted-foreground w-40 shrink-0"><Target className="h-4 w-4" /> {isRecorrenteMensal ? `Progresso de ${format(now, 'MMMM', { locale: pt })}` : 'Progresso'}</span>
                <div className="flex items-center gap-3 flex-1">
                  <Progress value={getProjectProgress()} className="h-2 max-w-xs" />
                  <span className="text-sm font-medium">{getProjectProgress()}%</span>
                  <span className="text-xs text-muted-foreground">{getProjectProgressSummary()}</span>
                </div>
              </div>
            )}
            {/* Cliente */}
            <div className="flex items-center gap-3 py-2.5 px-3 rounded-lg bg-muted/60 border border-border/50">
              <span className="flex items-center gap-2 text-sm text-muted-foreground w-40 shrink-0"><Users className="h-4 w-4" /> Cliente</span>
              <Select value={local.client_id || ''} onValueChange={v => {
                const selected = clientsList.find((c: any) => c.id === v);
                updateField('client_id', v || null);
                updateField('client_name', selected?.full_name || null);
              }}>
                <SelectTrigger className="w-64 h-8"><SelectValue placeholder="Selecionar cliente" /></SelectTrigger>
                <SelectContent>
                  {clientsList.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* Departamentos */}
            <div className="flex items-start gap-3 py-2.5 px-3 rounded-lg bg-muted/60 border border-border/50">
              <span className="flex items-center gap-2 text-sm text-muted-foreground w-40 shrink-0 pt-0.5"><BookOpen className="h-4 w-4" /> Departamentos</span>
              <div className="flex-1">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-auto min-h-[32px] w-full justify-start text-left font-normal py-1.5 border-0 bg-transparent hover:bg-muted/40">
                      {(() => {
                        const depts: string[] = (local.departments as string[]) || (local.department ? [local.department] : []);
                        if (depts.length === 0) return <span className="text-muted-foreground text-xs">Selecionar departamentos…</span>;
                        return <div className="flex flex-wrap gap-1">{depts.map(v => { const d = DEPARTMENTS.find(x => x.value === v); return d ? <Badge key={v} variant="secondary" className="text-xs">{d.label}</Badge> : null; })}</div>;
                      })()}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-60 p-2" align="start">
                    <div className="space-y-1">
                      {DEPARTMENTS.map(d => {
                        const depts: string[] = (local.departments as string[]) || (local.department ? [local.department] : []);
                        const active = depts.includes(d.value);
                        return (
                          <button
                            key={d.value}
                            type="button"
                            onClick={() => {
                              const current: string[] = (local.departments as string[]) || (local.department ? [local.department] : []);
                              const next = active ? current.filter(v => v !== d.value) : [...current, d.value];
                              updateField('departments', next);
                              updateField('department', next[0] || null);
                            }}
                            className={cn(
                              "flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-sm transition-colors",
                              active ? "bg-primary/10 text-foreground" : "hover:bg-muted text-muted-foreground"
                            )}
                          >
                            <div className={cn("h-4 w-4 rounded border flex items-center justify-center", active ? "bg-primary border-primary" : "border-muted-foreground/40")}>
                              {active && <Check className="h-3 w-3 text-primary-foreground" />}
                            </div>
                            {d.label}
                          </button>
                        );
                      })}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            {/* Membros */}
            <div className="flex items-center gap-3 py-2.5 px-3 rounded-lg bg-muted/60 border border-border/50">
              <span className="flex items-center gap-2 text-sm text-muted-foreground w-40 shrink-0"><Users className="h-4 w-4" /> Membros</span>
              <button type="button" onClick={() => setMembersDialogOpen(true)} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                <div className="flex -space-x-1">
                  {projectMembers.map(pid => { const p = profileMap.get(pid); return p ? <Avatar key={pid} className="h-7 w-7 border-2 border-background"><AvatarImage src={getPhotoUrl(p)} /><AvatarFallback className="text-[9px]">{getInitials(p.full_name)}</AvatarFallback></Avatar> : null; })}
                </div>
                <div className="h-7 w-7 rounded-full border-2 border-dashed border-muted-foreground/40 flex items-center justify-center">
                  <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              </button>
            </div>
            {/* Produto */}
            {local.product_name && (
              <div className="flex items-center gap-3 py-2.5 px-3 rounded-lg bg-muted/60 border border-border/50">
                <span className="flex items-center gap-2 text-sm text-muted-foreground w-40 shrink-0"><Lightbulb className="h-4 w-4" /> Produto</span>
                <span className="inline-flex items-center gap-2">
                  <ProductIcon productId={local.product_id as any} className="h-5 w-5" emojiClassName="text-sm" />
                  <Badge className="bg-accent text-accent-foreground border-0">{local.product_name}</Badge>
                </span>
              </div>
            )}
            {/* Datas */}
            <div className="flex items-center gap-3 py-2.5 px-3 rounded-lg bg-muted/60 border border-border/50">
              <span className="flex items-center gap-2 text-sm text-muted-foreground w-40 shrink-0"><CalendarIcon className="h-4 w-4" /> Datas</span>
              <div className="flex items-center gap-2">
                <Popover><PopoverTrigger asChild><Button variant="ghost" size="sm" className={cn("h-7 text-xs px-2", !local.start_date && "text-muted-foreground")}>{local.start_date ? format(new Date(local.start_date), 'd MMM yyyy', { locale: pt }) : 'Início'}</Button></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={local.start_date ? new Date(local.start_date) : undefined} onSelect={d => updateField('start_date', d ? format(d, 'yyyy-MM-dd') : null)} className="p-3 pointer-events-auto" /></PopoverContent></Popover>
                <span className="text-muted-foreground">→</span>
                <Popover><PopoverTrigger asChild><Button variant="ghost" size="sm" className={cn("h-7 text-xs px-2", !local.deadline && "text-muted-foreground")}>{local.deadline ? format(new Date(local.deadline), 'd MMM yyyy', { locale: pt }) : 'Prazo'}</Button></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={local.deadline ? new Date(local.deadline) : undefined} onSelect={d => updateField('deadline', d ? format(d, 'yyyy-MM-dd') : null)} className="p-3 pointer-events-auto" /></PopoverContent></Popover>
              </div>
            </div>
            {/* WhatsApp */}
            <div className="flex items-center gap-3 py-2.5 px-3 rounded-lg bg-muted/60 border border-border/50">
              <span className="flex items-center gap-2 text-sm text-muted-foreground w-40 shrink-0"><MessageSquare className="h-4 w-4" /> WhatsApp</span>
              <div className="flex items-center gap-2 flex-1">
                <Input value={(local as any).whatsapp_group_url || ''} onChange={e => updateField('whatsapp_group_url', e.target.value)} placeholder="https://chat.whatsapp.com/..." className="h-8 text-sm max-w-sm" />
                {(local as any).whatsapp_group_url && (
                  <a href={(local as any).whatsapp_group_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1 shrink-0">
                    Abrir <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>
            {/* Contrato */}
            <div className="flex items-start gap-3 py-2.5 px-3 rounded-lg bg-muted/60 border border-border/50">
              <span className="flex items-center gap-2 text-sm text-muted-foreground w-40 shrink-0 pt-1"><FileText className="h-4 w-4" /> Contrato</span>
              <div className="flex items-center gap-3 flex-wrap flex-1">
                {((local.contract_documents as DocEntry[]) || []).map((doc, i) => {
                  const isPdf = doc.name?.toLowerCase().endsWith('.pdf');
                  const isImage = /\.(jpg|jpeg|png|webp)$/i.test(doc.name || '');
                  return (
                    <div key={i} className="group relative rounded-lg border bg-muted/60 border border-border/50 hover:bg-muted/60 transition-colors w-48 overflow-hidden">
                      {isImage ? (
                        <a href={doc.url} target="_blank" rel="noopener noreferrer" className="block h-28 overflow-hidden">
                          <img src={doc.url} alt={doc.name} className="w-full h-full object-cover" />
                        </a>
                      ) : (
                        <a href={doc.url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center h-28 bg-muted/50">
                          <span className="text-4xl">{isPdf ? '📄' : '📎'}</span>
                        </a>
                      )}
                      <div className="px-2.5 py-2 flex items-center gap-2">
                        <span className="text-xs truncate flex-1 font-medium">{doc.name}</span>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); const docs = ((local.contract_documents as DocEntry[]) || []).filter((_, j) => j !== i); updateField('contract_documents', docs); }}
                          className="text-destructive/60 hover:text-destructive shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
                {/* Small upload button */}
                <label className="flex flex-col items-center justify-center w-48 h-[148px] rounded-lg border-2 border-dashed border-muted-foreground/30 hover:border-muted-foreground/50 cursor-pointer transition-colors">
                  <input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" className="hidden" onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const ext = file.name.split('.').pop();
                    const path = `invoices/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
                    const { error } = await supabase.storage.from('financial-files').upload(path, file);
                    if (error) { toast.error('Erro ao carregar'); return; }
                    const { data: urlData } = supabase.storage.from('financial-files').getPublicUrl(path);
                    updateField('contract_documents', [...((local.contract_documents as DocEntry[]) || []), { name: file.name, url: urlData.publicUrl }]);
                    e.target.value = '';
                  }} />
                  <Upload className="h-5 w-5 text-muted-foreground mb-1.5" />
                  <span className="text-xs text-muted-foreground">Carregar</span>
                </label>
              </div>
            </div>
            {/* Custo */}
            {projectCost > 0 && (
              <div className="flex items-center gap-3 py-2.5 px-3 rounded-lg bg-muted/60 border border-border/50">
                <span className="flex items-center gap-2 text-sm text-muted-foreground w-40 shrink-0"><DollarSign className="h-4 w-4" /> Custo</span>
                <span className="text-sm font-medium">{formatCost(projectCost)}</span>
              </div>
            )}
          </div>


          {/* ─── Tabs ──────────────────────────────────────── */}
          <div className="mt-6">
          <EntityTabs defaultValue="projeto" className="w-full">
            <EntityTabsList className="!rounded-xl !p-1.5 bg-muted/70 shadow-sm w-full sm:w-auto">
              <EntityTabsTrigger
                value="projeto"
                className="!rounded-lg !px-5 !py-2.5 gap-2 text-sm font-semibold data-[state=active]:shadow-md"
              >
                <LayoutDashboard className="h-4 w-4" />
                Overview de Projeto
              </EntityTabsTrigger>
              <EntityTabsTrigger
                value="processos"
                className="!rounded-lg !px-5 !py-2.5 gap-2 text-sm font-semibold data-[state=active]:shadow-md"
              >
                <Workflow className="h-4 w-4" />
                Tarefas &amp; Responsabilidades
              </EntityTabsTrigger>
              {resolvedClientId && local.client_name && (
                <EntityTabsTrigger
                  value="portal"
                  className="!rounded-lg !px-5 !py-2.5 gap-2 text-sm font-semibold data-[state=active]:shadow-md"
                >
                  <Users className="h-4 w-4" />
                  Portal de Cliente
                </EntityTabsTrigger>
              )}
              <EntityTabsTrigger
                value="gestao"
                className="!rounded-lg !px-5 !py-2.5 gap-2 text-sm font-semibold data-[state=active]:shadow-md"
              >
                <Settings2 className="h-4 w-4" />
                Gestão
              </EntityTabsTrigger>
              <EntityTabsTrigger
                value="fecho"
                className="!rounded-lg !px-5 !py-2.5 gap-2 text-sm font-semibold data-[state=active]:shadow-md"
              >
                <Flag className="h-4 w-4" />
                Fecho de Projeto
              </EntityTabsTrigger>
            </EntityTabsList>

            {/* ─── TAB 1: PROJETO ──────────────────────────── */}
            <EntityTabsContent value="projeto" className="space-y-8 mt-6">
              {/* ── Section: Menu Inicial ─────────────────── */}
              <EntitySection title="Menu Inicial" icon={Target}>
                <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
                  {(local.type === 'cliente_servico_mensal' ? [
                    { key: 'diretrizes' as SubPage, icon: BookOpen, label: 'Diretrizes Iniciais' },
                    { key: 'cronograma' as SubPage, icon: CalendarIcon, label: 'Cronograma Geral' },
                    { key: 'notas' as SubPage, icon: StickyNote, label: 'Notas' },
                  ] : [
                    { key: 'objetivo' as SubPage, icon: Target, label: 'Objetivo e Definição' },
                    { key: 'diretrizes' as SubPage, icon: BookOpen, label: 'Diretrizes Iniciais' },
                    { key: 'cronograma' as SubPage, icon: CalendarIcon, label: 'Cronograma Geral' },
                    { key: 'notas' as SubPage, icon: StickyNote, label: 'Notas' },
                  ]).map(({ key, icon: Icon, label }) => (
                    <button key={key} onClick={() => setSubPage(key)} className="group relative flex flex-col items-start gap-3 rounded-xl border border-border/60 bg-gradient-to-br from-card to-card/80 p-4 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10">
                      <div className="rounded-lg bg-gradient-to-br from-primary/15 to-primary/5 p-2.5 ring-1 ring-primary/10 transition-all group-hover:from-primary/25 group-hover:to-primary/10 group-hover:ring-primary/30">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <span className="text-sm font-semibold text-foreground leading-tight">{label}</span>
                      <ChevronRight className="absolute right-3 top-3 h-4 w-4 text-muted-foreground/40 transition-all group-hover:translate-x-0.5 group-hover:text-primary" />
                    </button>
                  ))}
                </div>
              </EntitySection>

              {/* ── Section: Desenvolvimento ──────────────── */}
              <EntitySection title="Desenvolvimento" icon={FileText}>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {[
                    { key: 'briefing' as SubPage, icon: ClipboardList, label: 'Briefing' },
                    { key: 'entregaveis' as SubPage, icon: FileText, label: 'Entregáveis' },
                    { key: 'reunioes' as SubPage, icon: Users, label: `Reuniões (${meetings.length})` },
                    { key: 'recursos' as SubPage, icon: Lightbulb, label: 'Recursos & Materiais' },
                  ].map(({ key, icon: Icon, label }) => (
                    <button key={key} onClick={() => setSubPage(key)} className="group relative flex flex-col items-start gap-3 rounded-xl border border-border/60 bg-gradient-to-br from-card to-card/80 p-4 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10">
                      <div className="rounded-lg bg-gradient-to-br from-primary/15 to-primary/5 p-2.5 ring-1 ring-primary/10 transition-all group-hover:from-primary/25 group-hover:to-primary/10 group-hover:ring-primary/30">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <span className="text-sm font-semibold text-foreground leading-tight">{label}</span>
                      <ChevronRight className="absolute right-3 top-3 h-4 w-4 text-muted-foreground/40 transition-all group-hover:translate-x-0.5 group-hover:text-primary" />
                    </button>
                  ))}
                </div>
              </EntitySection>

              {/* ── Section: Fases do Projeto (galeria) ── */}
              {taskMode === 'fases' && (
                <EntitySection title="Fases do Projeto" icon={Workflow}>
                  <ProjectPhasesGallery projectId={id!} projectStartDate={local.start_date} />
                </EntitySection>
              )}

            </EntityTabsContent>

            {/* ─── TAB 2: TAREFAS & RESPONSABILIDADES ─────── */}
            <EntityTabsContent value="processos" className="mt-4 space-y-8">
              <EntitySection
                title={taskMode === 'tarefas_fixas' ? 'Tarefas do Mês' : taskMode === 'tarefas_livres' ? 'Tarefas' : 'Estado e Prioridades'}
                icon={CheckSquare}
                action={
                  <div className="flex gap-2 items-center">
                    <ProjectTimeDisplay taskIds={tasks.map(t => t.id)} />
                    {taskMode === 'tarefas_fixas' && <Button size="sm" variant="outline" className="gap-1" onClick={() => generateMonthlyTasksMutation.mutate()}>📋 Gerar</Button>}
                    <Button size="sm" variant="outline" className="gap-1" onClick={() => setTaskDialogOpen(true)}><Plus className="h-3.5 w-3.5" /> Tarefa</Button>
                    <Button size="sm" variant="outline" className="gap-1" onClick={() => setMeetingDialogOpen(true)}><Plus className="h-3.5 w-3.5" /> Reunião</Button>
                  </div>
                }
              >
                {tasks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed rounded-xl">
                    <CheckSquare className="h-10 w-10 text-muted-foreground/30 mb-3" />
                    <p className="text-sm text-muted-foreground">{taskMode === 'tarefas_fixas' ? 'Usa o botão "Gerar tarefas" para criar as tarefas deste mês.' : taskMode === 'tarefas_livres' ? 'Adiciona tarefas conforme necessário.' : 'Nenhuma tarefa ligada a este projeto'}</p>
                  </div>
                ) : (
                  <div className="rounded-xl border overflow-hidden">
                    <Table>
                      <TableHeader><TableRow className="bg-muted/60">
                        <TableHead className="font-semibold">Status</TableHead><TableHead className="font-semibold">Prioridade</TableHead><TableHead className="font-semibold">Tarefa</TableHead><TableHead className="font-semibold">Data final</TableHead><TableHead className="font-semibold">Responsável</TableHead>
                      </TableRow></TableHeader>
                      <TableBody>
                        {tasks.map(t => {
                          const si = getTaskStatusInfo(t.status);
                          const pi = getPriorityInfo(t.priority);
                          const assignee = t.assigned_to ? profileMap.get(t.assigned_to) : null;
                          return (
                            <TableRow
 key={t.id}
 className="cursor-pointer hover:bg-muted/30"
 onClick={() => setTaskDetailId(t.id)}
                            >
                              <TableCell><Badge className={`${si.color} border-0 text-[10px]`}>{si.label}</Badge></TableCell>
                              <TableCell><Badge className={`${pi.color} border-0 text-[10px]`}>{pi.label}</Badge></TableCell>
                              <TableCell className="font-medium text-sm">{t.name}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">{t.deadline ? format(new Date(t.deadline), 'd MMM', { locale: pt }) : '—'}</TableCell>
                              <TableCell>{assignee ? <div className="flex items-center gap-2"><Avatar className="h-5 w-5"><AvatarImage src={getPhotoUrl(assignee)} /><AvatarFallback className="text-[8px]">{getInitials(assignee.full_name)}</AvatarFallback></Avatar><span className="text-xs">{assignee.full_name}</span></div> : <span className="text-xs text-muted-foreground">—</span>}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </EntitySection>

              {/* SOPs ligados ao projeto */}
              <ProjectProcessosTab
                projectId={id!}
                clientId={resolvedClientId}
                productId={local.product_id}
                projectStartDate={local.start_date}
              />
            </EntityTabsContent>

            {/* ─── TAB 3: PORTAL DE CLIENTE ────────────────── */}
            {resolvedClientId && local.client_name && (
              <EntityTabsContent value="portal" className="mt-4 space-y-8">
                <EntitySection title="Portal do Cliente" icon={Users}>
                  <ClientPortalSection
                    clientId={resolvedClientId}
                    clientName={local.client_name}
                    currentProduct={local.product_name || null}
                    productId={local.product_id}
                  />
                </EntitySection>
              </EntityTabsContent>
            )}

            {/* ─── TAB 4: GESTÃO ───────────────────────────── */}
            <EntityTabsContent value="gestao" className="mt-4">
              <ProjectGestaoTab
                projectId={id!}
                projectName={local.name}
                clientName={local.client_name}
                clientId={resolvedClientId}
                productName={local.product_name || null}
                startDate={local.start_date}
                deadline={local.deadline}
                projectPaymentMethod={local.payment_method}
                projectPaymentConfig={local.payment_config}
                onNewMeeting={() => setMeetingDialogOpen(true)}
                onUpdateProject={(field, value) => updateField(field as keyof ProjectFull, value)}
              />
            </EntityTabsContent>

            {/* ─── TAB 5: FECHO DE PROJETO ─────────────────── */}
            <EntityTabsContent value="fecho" className="mt-4 space-y-8">
              <EntitySection title="Retrospetiva" icon={Flag}>
                <div className="space-y-2">
                  {[
                    { field: 'closure_good' as keyof ProjectFull, label: '✅ O que funcionou bem' },
                    { field: 'closure_bad' as keyof ProjectFull, label: '❌ O que não voltaria a fazer' },
                    { field: 'closure_lessons' as keyof ProjectFull, label: '💡 Lições finais' },
                  ].map(({ field, label }) => (
                    <Collapsible key={field}>
                      <CollapsibleTrigger asChild>
                        <button className="flex items-center justify-between w-full p-3 rounded-lg border border-border/60 bg-card hover:bg-muted/40 transition-colors">
                          <span className="text-sm font-medium">{label}</span>
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        </button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="px-3 pb-3 pt-2">
                        <MentionTextarea
                          value={(local[field] as string) || ''}
                          onChange={v => updateField(field, v)}
                          rows={4}
                          placeholder="Escreve aqui..."
                        />
                      </CollapsibleContent>
                    </Collapsible>
                  ))}
                </div>
              </EntitySection>

              {resolvedClientId && local.client_name && (
                <EntitySection title="Feedback Recebido do Cliente" icon={MessageCircle}>
                  <ClientPortalFeedbackSection clientId={resolvedClientId} />
                </EntitySection>
              )}
            </EntityTabsContent>
          </EntityTabs>
          </div>

          {dirty && <div className="sticky bottom-4"><Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="gap-2 shadow-lg"><Save className="h-4 w-4" /> Guardar</Button></div>}
          <Separator />
          <AlertDialog>
            <AlertDialogTrigger asChild><Button variant="ghost" size="sm" className="text-destructive hover:text-destructive gap-2"><Trash2 className="h-4 w-4" /> Arquivar projeto</Button></AlertDialogTrigger>
            <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Arquivar projeto?</AlertDialogTitle><AlertDialogDescription>O projeto deixa de aparecer na lista principal mas todos os dados (fases, entregas, tarefas, reuniões, anexos) ficam preservados. Podes restaurá-lo a qualquer momento na aba "Arquivados".</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => deleteMutation.mutate()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Arquivar</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
          </AlertDialog>
        </div>

        {/* Meeting dialog — full form */}
        <MeetingFormDialog
          open={meetingDialogOpen}
          onOpenChange={setMeetingDialogOpen}
          profiles={profiles as MeetingProfile[]}
          projects={allProjectsForMeeting}
          clients={clientsList}
          defaultClientId={local.client_id || undefined}
          defaultClientName={local.client_name || undefined}
          defaultProjectId={id}
          defaultProjectName={local.name}
          defaultTitle={suggestedMeetingTitle || undefined}
        />

        {/* Task dialog (mesmo da página Tarefas) */}
        <TaskFormDialog
          open={taskDialogOpen}
          onOpenChange={setTaskDialogOpen}
          defaultProjectId={id}
          defaultClientId={local.client_id || undefined}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['project-tasks', id] });
            queryClient.invalidateQueries({ queryKey: ['tasks'] });
          }}
        />

        <TaskFormDialog
          open={!!taskDetailId}
          onOpenChange={(open) => !open && setTaskDetailId(null)}
          editingTask={taskDetailId ? tasks.find((task) => task.id === taskDetailId) : null}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['project-tasks', id] });
            queryClient.invalidateQueries({ queryKey: ['tasks'] });
          }}
        />

        {/* Members dialog */}
        <Dialog open={membersDialogOpen} onOpenChange={setMembersDialogOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Equipa do Projeto</DialogTitle></DialogHeader>
            <div className="space-y-1 max-h-80 overflow-y-auto">
              {profiles.map(p => {
                const resolvedProfile = profileMap.get(p.id) ?? p;
                const isMember = projectMembers.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggleMember.mutate(p.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                      isMember ? "bg-primary/10 text-foreground" : "hover:bg-muted text-muted-foreground"
                    )}
                  >
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={getPhotoUrl(resolvedProfile)} />
                      <AvatarFallback className="text-[9px]">{getInitials(resolvedProfile.full_name)}</AvatarFallback>
                    </Avatar>
                    <span className="flex-1 text-left">{resolvedProfile.full_name || 'Sem nome'}</span>
                    {isMember && <CheckSquare className="h-4 w-4 text-primary" />}
                  </button>
                );
              })}
            </div>
          </DialogContent>
        </Dialog>
      </AppLayout>
    );
  }


  // ─── Fallback for unknown project types ────────────────────────
  return (
    <AppLayout>
      <div className="space-y-4 p-6">
        <BackNavigation />
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Tipo de projeto não suportado: <strong>{local.type || 'desconhecido'}</strong>.
          </AlertDescription>
        </Alert>
      </div>
    </AppLayout>
  );
}
