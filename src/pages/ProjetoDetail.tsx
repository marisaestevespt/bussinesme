import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
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
import { Save, Target, BookOpen, CalendarIcon, FileText, Users, Lightbulb, StickyNote, Plus, CheckSquare, Upload, Trash2, ImageIcon, X, Clock, MessageSquare, ExternalLink, AlertTriangle, DollarSign, Check, Flag, LayoutDashboard, Workflow, Settings2, BarChart3 } from 'lucide-react';
import { useTaskTimeTotals } from '@/components/TaskTimeTracker';
import { BackNavigation } from '@/components/BackNavigation';
import {
  EntityTabs,
  EntityTabsList,
  EntityTabsTrigger,
  EntityTabsContent,
} from '@/components/layout/entity';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useImpersonation } from '@/contexts/ImpersonationContext';
import { useSensitiveAccess } from '@/hooks/useSensitiveAccess';
import { toast } from 'sonner';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { pt } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { ProductIcon } from '@/components/entity-icon';
import { isTaskDone } from '@/lib/taskStatus';
import { PROJECT_STATUSES, DEPARTMENTS, getTypeInfo, getStatusInfo, getDeptLabel, getInitials } from './Projetos';
import { LaunchDashboard } from '@/components/launch/LaunchDashboard';
import { ProjectGestaoTab } from '@/components/project/ProjectGestaoTab';
import { ProjectHealthBadge } from '@/components/project/ProjectHealthBadge';
import { computeMonthlyCycleProgress, isDeliverableDone, isPhaseDone } from '@/lib/projectProgress';
import { ProjectAnaliseTab } from '@/components/project/tabs/ProjectAnaliseTab';
import { ProjectFechoTab } from '@/components/project/tabs/ProjectFechoTab';
import { ProjectPortalTab } from '@/components/project/tabs/ProjectPortalTab';
import { ProjectMainTab } from '@/components/project/tabs/ProjectMainTab';
import { ProjectProcessosSection } from '@/components/project/tabs/ProjectProcessosSection';
import { type DocEntry } from '@/components/financial/InvoiceUpload';
import { MeetingFormDialog } from '@/pages/Reunioes';
import type { Profile as MeetingProfile } from '@/pages/Reunioes';
import { useProjectDetailData, calcTotalTime, type ProjectFull } from '@/hooks/useProjectDetailData';
import { useProducts, TASK_MODE_OPTIONS, normalizeTaskModes } from '@/hooks/useProducts';
import { Checkbox } from '@/components/ui/checkbox';
import { TaskFormDialog } from '@/components/tasks/TaskFormDialog';
import { EntregaveisSubPage } from '@/components/project/subpages/EntregaveisSubPage';
import { CronogramaSubPage } from '@/components/project/subpages/CronogramaSubPage';
import { OutrasInfoSubPage } from '@/components/project/subpages/OutrasInfoSubPage';
import { ReunioesSubPage } from '@/components/project/subpages/ReunioesSubPage';
import { TextWithAssetsSubPage } from '@/components/project/subpages/TextWithAssetsSubPage';
import { BriefingSubPage } from '@/components/project/subpages/BriefingSubPage';
import { BrainstormingSubPage } from '@/components/project/subpages/BrainstormingSubPage';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { safeUrl } from '@/lib/url';
import { useSectorConfig } from '@/hooks/useSectorConfig';

// ─── Sub-page sections for Internal project ─────────────────────

type SubPage = null | 'objetivo' | 'diretrizes' | 'cronograma' | 'briefing' | 'brainstorming' | 'entregaveis' | 'reunioes' | 'recursos' | 'notas' | 'outras_info';

// ─── Main Component ─────────────────────────────────────────────

function ProjetoDetailInner() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const sectorConfig = useSectorConfig();
  const { isOwner } = useAuth();
  const { impersonating } = useImpersonation();
  const effectiveUserId = impersonating?.user_id || user?.id;
  const { canSee: canSeeSensitive } = useSensitiveAccess();
  const canSeeFinancial = canSeeSensitive('financial_values');
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
    monthlyOccurrences,
    monthlyCycleLoading,
    meetings,
    toggleMember,
    deleteMutation,
  } = useProjectDetailData(id, { isRecorrenteMensal, monthStart, monthEnd });
  const resolvedClientId = clientForProject?.id;
  const { products: productsQ } = useProducts();
  const productsList = productsQ.data || [];
  const selectedProduct = productsList.find((p: any) => p.id === local?.product_id);
  const effectiveTaskModes = normalizeTaskModes(local?.task_modes, local?.task_mode);
  const primaryTaskMode = effectiveTaskModes[0];

  const taskIds = useMemo(() => tasks.map(t => t.id), [tasks]);
  const { data: trackedTaskMinutes = 0 } = useTaskTimeTotals(taskIds);

  const projectAnalysisQ = useQuery({
    queryKey: ['project-analysis', id, monthStart, taskIds],
    enabled: !!id,
    queryFn: async () => {
      const [{ data: directEntries }, { data: taskEntries }, { data: taskTimerEntries }, { data: members }] = await Promise.all([
        supabase.from('time_entries').select('id, duration, member_id, entry_date').eq('project_id', id!),
        taskIds.length > 0
          ? supabase.from('time_entries').select('id, duration, member_id, task_id, entry_date').in('task_id', taskIds)
          : Promise.resolve({ data: [] as any[] }),
        taskIds.length > 0
          ? supabase.from('task_time_entries').select('duration_minutes, user_id, task_id, created_at, ended_at, is_manual').in('task_id', taskIds)
          : Promise.resolve({ data: [] as any[] }),
        supabase.from('team_members').select('id, profile_id, full_name, photo_url'),
      ]);
      return { directEntries: directEntries || [], taskEntries: taskEntries || [], taskTimerEntries: taskTimerEntries || [], members: members || [] };
    },
  });

  const projectAnalysis = useMemo(() => {
    const data = projectAnalysisQ.data;
    const timerEntries = ((data?.taskTimerEntries || []) as any[]).filter(e => e.duration_minutes > 0 && (e.ended_at || e.is_manual));
    const manualEntries = Array.from(new Map([...((data?.directEntries || []) as any[]), ...((data?.taskEntries || []) as any[])].map(e => [e.id, e])).values());
    const manualMinutes = manualEntries.reduce((sum, e) => sum + Math.round(Number(e.duration || 0) * 60), 0);
    const timerMinutes = timerEntries.reduce((sum, e) => sum + Number(e.duration_minutes || 0), 0);
    const totalMinutes = manualMinutes + timerMinutes;
    const doneTasks = tasks.filter(isTaskDone).length;
    const estimatedTaskMinutes = tasks.reduce((sum, t) => sum + (Number(t.estimated_minutes || 0) || Math.round(Number(t.estimated_time || 0) * 60)), 0);
    const deliverableEstimatedMinutes = (projectDeliverables as any[]).reduce((sum, d) => sum + Number(d.estimated_minutes || 0), 0);
    const budgetMinutes = Number(local?.budgeted_minutes || 0) || estimatedTaskMinutes || deliverableEstimatedMinutes;
    const memberNames = new Map<string, string>();
    (data?.members || []).forEach((m: any) => {
      if (m.id) memberNames.set(m.id, m.full_name || 'Membro');
      if (m.profile_id) memberNames.set(m.profile_id, m.full_name || 'Membro');
    });
    profiles.forEach(p => { memberNames.set(p.id, p.full_name || 'Membro'); if (p.user_id) memberNames.set(p.user_id, p.full_name || 'Membro'); });
    const byPerson = new Map<string, { id: string; name: string; minutes: number }>();
    const addPerson = (key: string | null | undefined, minutes: number) => {
      const id = key || 'sem-responsavel';
      const current = byPerson.get(id) || { id, name: memberNames.get(id) || 'Sem responsável', minutes: 0 };
      current.minutes += minutes;
      byPerson.set(id, current);
    };
    timerEntries.forEach((e: any) => addPerson(e.user_id, Number(e.duration_minutes || 0)));
    manualEntries.forEach((e: any) => addPerson(e.member_id, Math.round(Number(e.duration || 0) * 60)));
    const monthTimerMinutes = timerEntries
      .filter((e: any) => e.created_at && e.created_at >= monthStart && e.created_at <= `${monthEnd}T23:59:59`)
      .reduce((sum, e: any) => sum + Number(e.duration_minutes || 0), 0);
    const monthManualMinutes = manualEntries
      .filter((e: any) => e.entry_date && e.entry_date >= monthStart && e.entry_date <= monthEnd)
      .reduce((sum, e: any) => sum + Math.round(Number(e.duration || 0) * 60), 0);
    const monthlyBudget = isServicoMensal ? Number(local?.budgeted_minutes || 0) : 0;
    return {
      totalMinutes,
      trackedTaskMinutes,
      budgetMinutes,
      estimatedTaskMinutes,
      deliverableEstimatedMinutes,
      doneTasks,
      totalTasks: tasks.length,
      completedDeliverables: (projectDeliverables as any[]).filter((d: any) => d.status === 'concluido' || d.status === 'entregue').length,
      totalDeliverables: projectDeliverables.length,
      people: Array.from(byPerson.values()).sort((a, b) => b.minutes - a.minutes),
      currentMonthMinutes: monthTimerMinutes + monthManualMinutes,
      monthlyBudget,
    };
  }, [projectAnalysisQ.data, tasks, projectDeliverables, local?.budgeted_minutes, profiles, monthStart, monthEnd, isServicoMensal, trackedTaskMinutes]);

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

  // Contract-wide progress: all phases + all occurrences + all standalone tasks
  // for the entire contract duration (not just the current month). This means
  // manually-added items also count towards progress.
  const monthlyCycleProgress = useMemo(() => {
    return computeMonthlyCycleProgress({
      phases: projectPhases as any,
      occurrences: monthlyOccurrences as any,
      tasks: monthlyTasks as any,
    });
  }, [projectPhases, monthlyOccurrences, monthlyTasks]);

  const projectProgressValue = Math.min(100, Math.max(0, Math.round(Number(local?.progress || 0))));

  function getProjectProgressSummary() {
    if (isRecorrenteMensal) {
      if (monthlyCycleLoading) return 'A carregar agenda do mês';
      if (monthlyCycleProgress.total === 0) return 'Sem agenda definida no contrato';
      return `${monthlyCycleProgress.done}/${monthlyCycleProgress.total} itens do contrato concluídos`;
    }

    if (projectDeliverables.length > 0) {
      const completed = projectDeliverables.filter(isDeliverableDone).length;
      return `${completed}/${projectDeliverables.length} points concluídos`;
    }

    if (projectPhases.length > 0) {
      const completed = projectPhases.filter(isPhaseDone).length;
      return `${completed}/${projectPhases.length} fases concluídas`;
    }

    return 'Sem fases ou points definidos';
  }

  // Deadline overdue check
  const isOverdue = local?.deadline && local.status !== 'concluido' && local.status !== 'cancelado' && new Date(local.deadline) < new Date()
    // Don't show overdue banner for recurring monthly services (deadline is not meaningful there)
    && !(local?.type === 'cliente_servico_mensal' && (local as any)?.project_mode === 'recorrente');

  // Fetch end_of_cycle for recurring monthly service clients
  const clientCycleQ = useQuery({
    queryKey: ['client-cycle', resolvedClientId],
    queryFn: async () => {
      const { data } = await supabase.from('clients').select('end_of_cycle, status, renewal_count').eq('id', resolvedClientId!).maybeSingle();
      return data as { end_of_cycle: string | null; status: string; renewal_count: number } | null;
    },
    enabled: !!resolvedClientId && isServicoMensal,
  });
  const endOfCycle = clientCycleQ.data?.end_of_cycle ? new Date(clientCycleQ.data.end_of_cycle) : null;
  const daysToRenewal = endOfCycle ? Math.ceil((endOfCycle.getTime() - now.getTime()) / 86400000) : null;
  const clientStatus = clientCycleQ.data?.status;
  // Encerramento da Avença só faz sentido se cliente está cancelado/pausado/altura_renovacao
  const canCloseAvenca = isServicoMensal && clientStatus && ['cancelado', 'pausado', 'inativo'].includes(clientStatus);

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
        budgeted_minutes: local.budgeted_minutes ?? null,
        project_mode: (local as any).project_mode || 'pontual',
        task_modes: effectiveTaskModes,
        task_mode: primaryTaskMode,
        brainstorming: (local as any).brainstorming ?? null,
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
  if (subPage === 'brainstorming') {
    return (
      <BrainstormingSubPage
        projectId={id!}
        value={(local as any).brainstorming || ''}
        onChange={(html) => updateField('brainstorming' as any, html)}
        onSave={() => saveMutation.mutate()}
        saving={saveMutation.isPending}
        dirty={dirty}
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
        description: local.type === 'interno'
          ? 'Que problema interno resolve este projeto e qual o resultado esperado.'
          : 'O objetivo do projeto e a sua definição/escopo.',
        icon: Target,
        textLabel: 'Definição do projeto',
        textPlaceholder: local.type === 'interno'
          ? 'Problema a resolver, resultado esperado, KPI / impacto...'
          : 'Escopo, resultados esperados, restrições...',
        assetsLabel: local.type === 'interno' ? 'Referências e contexto' : 'Briefings e referências',
        assetsDescription: local.type === 'interno'
          ? 'Documentos, dados ou referências que fundamentam o objetivo deste projeto interno.'
          : 'Documentos que fundamentam o objetivo (briefing, RFP, propostas).',
        assetCategories: local.type === 'interno'
          ? ['Contexto', 'Dados', 'Referência']
          : ['Briefing', 'Proposta', 'Contexto'],
      },
      diretrizes: {
        field: 'diretrizes',
        title: 'Diretrizes Iniciais',
        description: local.type === 'interno'
          ? 'Princípios, regras e direções acordadas com a equipa.'
          : 'Princípios, regras e direções acordadas com o cliente / equipa.',
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
              {(local as any)?.project_mode === 'recorrente' && (
                <Badge variant="outline" className="text-xs font-medium gap-1">🔄 Operacional</Badge>
              )}
              <Select value={local.status} onValueChange={v => updateField('status', v)}><SelectTrigger className="w-36 h-8"><SelectValue /></SelectTrigger><SelectContent>{PROJECT_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent></Select>
              {local.department && <span className="text-sm text-muted-foreground">{getDeptLabel(local.department)}</span>}
            </div>
            <Input value={local.name} onChange={e => updateField('name', e.target.value)} className="text-2xl sm:text-3xl md:text-4xl font-bold border-none px-0 focus-visible:ring-0 h-auto" />
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
    local.type === 'cliente_servico_mensal' ||
    local.type === 'cliente_projeto_unico' ||
    local.type === 'interno'
  ) {
    const taskMode = primaryTaskMode;
    const taskModes = effectiveTaskModes;
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
          <div className="space-y-2">
            {/* Health card (left) + project name on the same row */}
            <div className="flex items-center gap-3">
              <Input
                value={local.name}
                onChange={e => updateField('name', e.target.value)}
                placeholder="Nome do projeto"
                className="block w-full kpi-display-sm mt-1 border-none px-0 focus-visible:ring-0 h-auto bg-transparent md:text-2xl"
              />
              <ProjectHealthBadge
                project={local as any}
                tasks={tasks as any}
                progressOverride={projectProgressValue}
                variant="square"
                className="ml-auto"
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {local.type === 'interno' && (
              <Badge variant="outline" className="shrink-0 gap-1.5 px-2.5 py-1 text-[11px] font-medium border-primary/30 bg-primary/5 text-primary">
                <Lightbulb className="h-3 w-3" />
                Projeto Interno
              </Badge>
            )}
            </div>
          </div>

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
            {/* Modo Operacional (combinável) */}
            <div className="flex items-start gap-3 py-2.5 px-3 rounded-lg bg-muted/60 border border-border/50">
              <span className="flex items-center gap-2 text-sm text-muted-foreground w-40 shrink-0 pt-1"><CheckSquare className="h-4 w-4" /> Operação</span>
              <div className="flex flex-col gap-1.5">
                {TASK_MODE_OPTIONS.map(opt => {
                  const checked = taskModes.includes(opt.value);
                  return (
                    <label key={opt.value} className="flex items-start gap-2 cursor-pointer text-sm">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(v) => {
                          const next = v
                            ? Array.from(new Set([...taskModes, opt.value]))
                            : taskModes.filter(m => m !== opt.value);
                          const normalizedNext = normalizeTaskModes(next.length > 0 ? next : ['fases']);
                          updateField('task_modes' as keyof ProjectFull, normalizedNext);
                          updateField('task_mode' as keyof ProjectFull, normalizedNext[0]);
                        }}
                        className="mt-0.5"
                      />
                      <span>{opt.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
            {/* Orçamento de tempo — junto à Operação */}
            <div className="flex items-center gap-3 py-2.5 px-3 rounded-lg bg-muted/60 border border-border/50">
              <span className="flex items-center gap-2 text-sm text-muted-foreground w-40 shrink-0"><Clock className="h-4 w-4" /> Orçamento tempo</span>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="0"
                  step="0.25"
                  value={local.budgeted_minutes ? local.budgeted_minutes / 60 : ''}
                  onChange={e => updateField('budgeted_minutes', e.target.value ? Math.round(Number(e.target.value) * 60) : null)}
                  placeholder={isServicoMensal ? 'Horas/mês' : 'Horas/projeto'}
                  className="h-8 w-28 text-sm"
                />
                <span className="text-xs text-muted-foreground">{isServicoMensal ? 'h/mês contratadas' : 'h previstas no projeto'}</span>
              </div>
            </div>
            {/* Progresso */}
            {taskMode !== 'tarefas_livres' && (
              <div className="flex items-center gap-3 py-2.5 px-3 rounded-lg bg-muted/60 border border-border/50">
                <span className="flex items-center gap-2 text-sm text-muted-foreground w-40 shrink-0"><Target className="h-4 w-4" /> {isRecorrenteMensal ? 'Progresso do contrato' : 'Progresso'}</span>
                <div className="flex items-center gap-3 flex-1">
                  <span className="text-sm font-medium">{projectProgressValue}%</span>
                  <span className="text-xs text-muted-foreground">{getProjectProgressSummary()}</span>
                  <Progress value={projectProgressValue} className="h-2 max-w-xs" />
                </div>
              </div>
            )}
            {/* Cliente — não aplicável a projetos internos */}
            {local.type !== 'interno' && (
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
            )}
            {/* Departamentos */}
            <div className="flex items-start gap-3 py-2.5 px-3 rounded-lg bg-muted/60 border border-border/50">
              <span className="flex items-center gap-2 text-sm text-muted-foreground w-40 shrink-0 pt-0.5"><BookOpen className="h-4 w-4" /> Departamentos</span>
              <div className="flex-1">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-auto min-h-[32px] w-full justify-start text-left font-normal px-0 py-1.5 border-0 bg-transparent hover:bg-muted/40">
                      {(() => {
                        const depts: string[] = (local.departments as string[]) || (local.department ? [local.department] : []);
                        if (depts.length === 0) return <span className="text-muted-foreground text-xs">Selecionar departamentos…</span>;
                        return <div className="flex flex-wrap gap-1.5">{depts.map(v => { const d = DEPARTMENTS.find(x => x.value === v); return d ? <Badge key={v} variant="outline" className={cn("text-xs font-medium border", d.color)}>{d.label}</Badge> : null; })}</div>;
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
            {(() => {
              const depts: string[] = (local.departments as string[]) || (local.department ? [local.department] : []);
              return depts.includes('produtos');
            })() && (
            <div className="flex items-center gap-3 py-2.5 px-3 rounded-lg bg-muted/60 border border-border/50">
              <span className="flex items-center gap-2 text-sm text-muted-foreground w-40 shrink-0"><Lightbulb className="h-4 w-4" /> Produto</span>
              <div className="flex-1 min-w-0">
                <Select
                  value={local.product_id || '__none__'}
                  onValueChange={v => {
                    if (v === '__none__') {
                      updateField('product_id', null);
                      updateField('product_name', null);
                    } else {
                      const p = productsList.find((x: any) => x.id === v);
                      updateField('product_id', v);
                      updateField('product_name', p?.name || null);
                    }
                  }}
                >
                  <SelectTrigger className="h-8 w-full justify-start gap-2 pl-3 pr-2 [&>svg]:ml-auto [&>span]:line-clamp-none">
                    <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
                      {local.product_id && (
                        <ProductIcon productId={local.product_id as any} icon={selectedProduct?.icon} logoUrl={selectedProduct?.logo_url} className="h-6 w-6 shrink-0" emojiClassName="text-lg" />
                      )}
                      <span className={cn("min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-left", !local.product_id && "text-muted-foreground")}>
                        {selectedProduct?.name || local.product_name || 'Sem produto associado'}
                      </span>
                    </div>
                  </SelectTrigger>
                  <SelectContent className="max-w-[min(48rem,calc(100vw-2rem))]">
                    <SelectItem value="__none__">— Sem produto —</SelectItem>
                    {productsList.map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
            {/* Contrato — não aplicável a projetos internos */}
            {local.type !== 'interno' && (
            <div className="flex items-start gap-3 py-2.5 px-3 rounded-lg bg-muted/60 border border-border/50">
              <span className="flex items-center gap-2 text-sm text-muted-foreground w-40 shrink-0 pt-1"><FileText className="h-4 w-4" /> Contrato</span>
              <div className="flex items-center gap-3 flex-wrap flex-1">
                {((local.contract_documents as DocEntry[]) || []).map((doc, i) => {
                  const isPdf = doc.name?.toLowerCase().endsWith('.pdf');
                  const isImage = /\.(jpg|jpeg|png|webp)$/i.test(doc.name || '');
                  return (
                    <div key={i} className="group relative rounded-lg border bg-muted/60 border border-border/50 hover:bg-muted/60 transition-colors w-48 overflow-hidden">
                      {isImage ? (
                        <a href={safeUrl(doc.url)} target="_blank" rel="noopener noreferrer" className="block h-28 overflow-hidden">
                          <img src={safeUrl(doc.url)} alt={doc.name} className="w-full h-full object-cover" />
                        </a>
                      ) : (
                        <a href={safeUrl(doc.url)} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center h-28 bg-muted/50">
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
            )}
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
                Fluxo de Trabalho
              </EntityTabsTrigger>
              {canSeeFinancial && (
                <EntityTabsTrigger
                  value="analise"
                  className="!rounded-lg !px-5 !py-2.5 gap-2 text-sm font-semibold data-[state=active]:shadow-md"
                >
                  <BarChart3 className="h-4 w-4" />
                  Análise de Projeto
                </EntityTabsTrigger>
              )}
              {resolvedClientId && local.client_name && (
                <EntityTabsTrigger
                  value="portal"
                  className="!rounded-lg !px-5 !py-2.5 gap-2 text-sm font-semibold data-[state=active]:shadow-md"
                >
                  <Users className="h-4 w-4" />
                  Portal de Cliente
                </EntityTabsTrigger>
              )}
              {local.type !== 'interno' && canSeeFinancial && (
                <EntityTabsTrigger
                  value="gestao"
                  className="!rounded-lg !px-5 !py-2.5 gap-2 text-sm font-semibold data-[state=active]:shadow-md"
                >
                  <Settings2 className="h-4 w-4" />
                  Gestão
                </EntityTabsTrigger>
              )}
              {(!isServicoMensal || canCloseAvenca) && (
                <EntityTabsTrigger
                  value="fecho"
                  className="!rounded-lg !px-5 !py-2.5 gap-2 text-sm font-semibold data-[state=active]:shadow-md"
                >
                  <Flag className="h-4 w-4" />
                  {isServicoMensal ? 'Encerramento da Avença' : 'Fecho de Projeto'}
                </EntityTabsTrigger>
              )}
            </EntityTabsList>

            {/* ─── TAB 1: PROJETO ──────────────────────────── */}
            <EntityTabsContent value="projeto" className="space-y-8 mt-6">
              <ProjectMainTab
                projectId={id!}
                local={local}
                meetings={meetings}
                resolvedClientId={resolvedClientId}
                taskMode={taskMode}
                taskModes={taskModes}
                setSubPage={setSubPage}
              />
            </EntityTabsContent>

            {/* ─── TAB 2: TAREFAS & RESPONSABILIDADES ─────── */}
            <EntityTabsContent value="processos" className="mt-4 space-y-8">
              <ProjectProcessosSection
                projectId={id!}
                local={local}
                isServicoMensal={isServicoMensal}
                taskMode={taskMode}
                taskModes={taskModes}
                tasks={tasks}
                meetings={meetings}
                profileMap={profileMap}
                getPhotoUrl={getPhotoUrl}
                resolvedClientId={resolvedClientId}
                reunioesLabel={sectorConfig.t('reunioes')}
                onGenerateMonthly={() => generateMonthlyTasksMutation.mutate()}
                onAddTask={() => setTaskDialogOpen(true)}
                onAddMeeting={() => setMeetingDialogOpen(true)}
                onOpenTaskDetail={(taskId) => setTaskDetailId(taskId)}
                onOpenAllMeetings={() => setSubPage('reunioes')}
              />
            </EntityTabsContent>

            {/* ─── TAB 3: ANÁLISE DE PROJETO ───────────────── */}
            {canSeeFinancial && (
              <EntityTabsContent value="analise" className="mt-4 space-y-8">
                <ProjectAnaliseTab projectAnalysis={projectAnalysis} isServicoMensal={isServicoMensal} />
              </EntityTabsContent>
            )}

            {/* ─── TAB 3: PORTAL DE CLIENTE ────────────────── */}
            {resolvedClientId && local.client_name && (
              <EntityTabsContent value="portal" className="mt-4 space-y-8">
                <ProjectPortalTab
                  resolvedClientId={resolvedClientId}
                  clientName={local.client_name}
                  productName={local.product_name || null}
                  productId={local.product_id}
                />
              </EntityTabsContent>
            )}

            {/* ─── TAB 4: GESTÃO (apenas com acesso a valores financeiros) ─── */}
            {canSeeFinancial && (
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
            )}

            {/* ─── TAB 5: FECHO DE PROJETO ─────────────────── */}
            <EntityTabsContent value="fecho" className="mt-4 space-y-8">
              <ProjectFechoTab
                local={local}
                resolvedClientId={resolvedClientId}
                updateField={updateField}
              />
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

import { DetailAccessGuard } from '@/components/access/DetailAccessGuard';

export default function ProjetoDetailPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <DetailAccessGuard entity="project" id={id}>
      <ProjetoDetailInner />
    </DetailAccessGuard>
  );
}
