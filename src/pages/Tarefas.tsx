import { useState, useMemo, useCallback } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { BackNavigation } from '@/components/BackNavigation';
import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { ViewTabs } from '@/components/ViewTabs';
import { useUserViews, type DefaultView } from '@/hooks/useUserViews';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Plus, CalendarIcon, ListTodo, AlertTriangle, Clock, CalendarDays, List, Users, Link2, GitBranch, ChevronRight, Play, Repeat, Filter, X, History } from 'lucide-react';
import { RotinasView } from '@/components/tasks/RotinasView';
import { TaskTimeTracker } from '@/components/TaskTimeTracker';
import { HistoricoView } from '@/components/tasks/HistoricoView';
import { useActiveTimer } from '@/hooks/useActiveTimer';
import { Button } from '@/components/ui/button';
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { InfiniteScrollList } from '@/components/InfiniteScrollList';
import { PAGE_SIZE, flattenInfiniteData, getInfiniteCount, type InfinitePageResult } from '@/hooks/useInfiniteSupabaseQuery';
import { supabase } from '@/integrations/supabase/client';
import { sendNotification } from '@/hooks/useNotifications';
import { useAbsenceCoverage, findCoverageForMemberOnDate } from '@/hooks/useAbsenceCoverage';
import { useOffDates, findOffRange } from '@/hooks/useOffDates';
import { useAuth } from '@/hooks/useAuth';
import { useImpersonation } from '@/contexts/ImpersonationContext';
import { toast } from 'sonner';
import { isTaskDone, isTaskOpen, isTaskOverdue } from '@/lib/taskStatus';
import { weeklyHours as memberWeeklyHours } from '@/lib/memberCapacity';
import { cn } from '@/lib/utils';
import { format, isPast, isToday, startOfDay, isBefore, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths, addDays, addWeeks, isSameDay, setDate as setDateFns, startOfWeek, endOfWeek } from 'date-fns';
import { pt } from 'date-fns/locale';
import { PROCESS_DEPARTMENTS } from '@/lib/departments';
import { TaskTable, TASK_STATUSES, PRIORITIES, getStatusInfo, getPriorityInfo, getDeptInfo } from '@/components/tasks/TaskTable';
import { CalendarView } from '@/components/tasks/CalendarView';
import { ResponsavelView } from '@/components/tasks/ResponsavelView';
import { TaskFormDialog } from '@/components/tasks/TaskFormDialog';

// ─── Constants ──────────────────────────────────────────────────

type RecurrenceType = 'semanal' | 'quinzenal' | 'mensal' | 'mensal_primeiro' | 'diario';
const RECURRENCE_OPTIONS: { value: RecurrenceType | ''; label: string }[] = [
  { value: '', label: 'Não se repete' },
  { value: 'diario', label: 'Todos os dias' },
  { value: 'semanal', label: 'Todas as semanas' },
  { value: 'quinzenal', label: 'A cada 2 semanas' },
  { value: 'mensal', label: 'Todos os meses (mesmo dia)' },
  { value: 'mensal_primeiro', label: '1º dia de cada mês' },
];

type View = 'todo' | 'atrasadas' | 'proximas' | 'calendario' | 'responsavel' | 'todas' | 'rotinas';

const DEFAULT_VIEWS: DefaultView[] = [
  { key: 'todo', label: 'To Do', icon: <ListTodo className="h-4 w-4" />, isDefault: true },
  { key: 'atrasadas', label: 'Atrasadas', icon: <AlertTriangle className="h-4 w-4" />, isDefault: true },
  { key: 'proximas', label: 'Próximas Tarefas', icon: <Clock className="h-4 w-4" />, isDefault: true },
  { key: 'responsavel', label: 'Por Responsável', icon: <Users className="h-4 w-4" />, isDefault: true },
  { key: 'calendario', label: 'Calendário', icon: <CalendarDays className="h-4 w-4" />, isDefault: true },
  { key: 'todas', label: 'Todas as Tarefas', icon: <List className="h-4 w-4" />, isDefault: true },
  { key: 'historico', label: 'Histórico', icon: <History className="h-4 w-4" />, isDefault: true },
  { key: 'rotinas', label: 'Rotinas', icon: <Repeat className="h-4 w-4" />, isDefault: true },
];

// ─── Main Page ──────────────────────────────────────────────────

export default function TarefasPage() {
  const { user, isOwner } = useAuth();
  const { impersonating } = useImpersonation();
  const effectiveUserId = impersonating?.user_id || user?.id;
  const realIsOwner = isOwner && !impersonating;
  const queryClient = useQueryClient();
  const { startTimer: globalStartTimer } = useActiveTimer();
  const { allViews, addView, renameView, deleteView } = useUserViews('tarefas', DEFAULT_VIEWS);
  const [view, setView] = useState<string>('todo');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<any>(null);
  const [calMonth, setCalMonth] = useState(new Date());
  const [timerPromptTaskId, setTimerPromptTaskId] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [status, setStatus] = useState('por_comecar');
  const [priority, setPriority] = useState('alta');
  const [deadline, setDeadline] = useState<Date | undefined>();
  const [assignedTo, setAssignedTo] = useState('');
  const [department, setDepartment] = useState('');
  const [projectId, setProjectId] = useState('');
  const [clientId, setClientId] = useState('');
  const [notes, setNotes] = useState('');
  const [parentTaskId, setParentTaskId] = useState('');
  const [dependsOnIds, setDependsOnIds] = useState<string[]>([]);
  const [isSubtask, setIsSubtask] = useState(false);
  const [recurrenceType, setRecurrenceType] = useState('');
  const [recurrenceEnd, setRecurrenceEnd] = useState<Date | undefined>();
  const [estimatedTime, setEstimatedTime] = useState('');
  const [suggestion, setSuggestion] = useState<{ taskName: string; avgHours: number } | null>(null);
  const [suggestionDismissed, setSuggestionDismissed] = useState(false);

  // Dynamic filters
  const [filterDept, setFilterDept] = useState('');
  const [filterResponsible, setFilterResponsible] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterProject, setFilterProject] = useState('');

  // Queries
  // Server-side status filter
  const [filterStatus, setFilterStatus] = useState('');

  const { data: myProfileId } = useQuery({
    queryKey: ['my-profile-id', effectiveUserId],
    enabled: !!effectiveUserId,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', effectiveUserId!)
        .maybeSingle();
      return data?.id as string | null;
    },
  });

  function canAccessTask(task: any): boolean {
    if (realIsOwner) return true;
    if (!task) return false;
    if (effectiveUserId && task.created_by === effectiveUserId) return true;
    if (myProfileId && task.assigned_to === myProfileId) return true;
    if (myProfileId && task.original_assignee === myProfileId) return true;
    return false;
  }

  const tasksQuery = useInfiniteQuery<InfinitePageResult<any>>({
    queryKey: ['tasks', filterStatus],
    initialPageParam: 0,
    staleTime: 2 * 60 * 1000,
    queryFn: async ({ pageParam = 0 }) => {
      const from = (pageParam as number) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      let query = supabase.from('tasks').select('id,name,status,priority,deadline,assigned_to,original_assignee,created_by,department,project_id,client_id,notes,parent_task_id,recurrence_type,recurrence_end,estimated_time,tag,created_at,updated_at', { count: 'exact' }).order('created_at', { ascending: false });
      if (filterStatus) {
        query = query.eq('status', filterStatus);
      }
      const { data, error, count } = await query.range(from, to);
      if (error) throw error;
      return { data: data || [], count, nextPage: (data?.length ?? 0) === PAGE_SIZE ? (pageParam as number) + 1 : undefined };
    },
    getNextPageParam: (last) => last.nextPage,
  });
  const tasks = flattenInfiniteData(tasksQuery.data?.pages);
  const tasksTotal = getInfiniteCount(tasksQuery.data?.pages);

  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, user_id, full_name, avatar_url');
      return data || [];
    },
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects-list-with-client'],
    queryFn: async () => {
      const { data } = await supabase.from('projects').select('id, name, client_id, client_name').is('archived_at', null);
      return data || [];
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients-list-simple'],
    queryFn: async () => {
      const { data } = await supabase.from('clients').select('id, full_name').eq('status', 'ativo').order('full_name');
      return data || [];
    },
  });

  // All time entries for similarity suggestion (task_id + duration)
  const { data: allTimeEntries = [] } = useQuery({
    queryKey: ['task-time-entries-all'],
    queryFn: async () => {
      const { data } = await supabase.from('task_time_entries').select('task_id, duration_minutes').or('ended_at.not.is.null,is_manual.eq.true');
      return data || [];
    },
  });

  // Team members for capacity warning
  const { data: teamMembers = [] } = useQuery({
    queryKey: ['team', 'members'],
    queryFn: async () => {
      const { data } = await supabase.from('team_members').select('id, full_name, profile_id, expected_weekly_hours, status');
      return data || [];
    },
  });

  const { data: taskDependencies = [] } = useQuery({
    queryKey: ['task-dependencies'],
    queryFn: async () => {
      const { data, error } = await supabase.from('task_dependencies').select('*');
      if (error) throw error;
      return data || [];
    },
  });

  const { coverages: absenceCoverages } = useAbsenceCoverage();
  const { data: offRanges } = useOffDates();

  // Mutations
  const upsertTask = useMutation({
    mutationFn: async (payload: any) => {
      const { _dependsOnIds, _prevStatus, ...taskPayload } = payload;
      let taskId: string;
      if (editingTask) {
        const { error } = await supabase.from('tasks').update(taskPayload).eq('id', editingTask.id);
        if (error) throw error;
        taskId = editingTask.id;
      } else {
        const { data, error } = await supabase.from('tasks').insert({ ...taskPayload, created_by: user?.id }).select('id').single();
        if (error) throw error;
        taskId = data.id;
      }
      // Sync dependencies
      if (_dependsOnIds !== undefined) {
        await supabase.from('task_dependencies').delete().eq('task_id', taskId);
        if (_dependsOnIds.length > 0) {
          const rows = _dependsOnIds.map((depId: string) => ({ task_id: taskId, depends_on_task_id: depId }));
          const { error: depErr } = await supabase.from('task_dependencies').insert(rows);
          if (depErr) throw depErr;
        }
      }
      return { taskId, newStatus: taskPayload.status, prevStatus: _prevStatus };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['task-dependencies'] });
      toast.success(editingTask ? 'Tarefa atualizada' : 'Tarefa criada');
      // Notify assigned user
      if (assignedTo && assignedTo !== user?.id) {
        const wasReassigned = editingTask && editingTask.assigned_to !== assignedTo;
        const isNew = !editingTask;
        if (isNew || wasReassigned) {
          sendNotification({
            userId: assignedTo,
            type: 'task',
            title: `Tarefa atribuída: ${name}`,
            message: deadline ? `Prazo: ${format(deadline, 'dd/MM/yyyy')}` : undefined,
            link: '/hub/tarefas',
          });
        }
      }
      // If status changed to "a_fazer", prompt for timer
      if (result && result.newStatus === 'a_fazer' && result.prevStatus !== 'a_fazer') {
        setTimerPromptTaskId(result.taskId);
      }
      closeDialog();
    },
    onError: () => toast.error('Erro ao guardar tarefa'),
  });

  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tasks').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['task-dependencies'] });
      toast.success('Tarefa eliminada');
      closeDialog();
    },
  });

  // Inline update (name / status / priority / deadline / responsible)
  const updateTaskInline = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Record<string, any> }) => {
      const { error } = await supabase.from('tasks').update(patch as any).eq('id', id);
      if (error) throw error;
      return { id, patch };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: (e: any) => toast.error(e?.message || 'Erro ao atualizar tarefa'),
  });

  function openNew() {
    setEditingTask(null);
    setName(''); setStatus('por_comecar'); setPriority('alta');
    setDeadline(undefined); setAssignedTo(''); setDepartment(''); setProjectId(''); setClientId(''); setNotes('');
    setParentTaskId(''); setDependsOnIds([]); setIsSubtask(false); setRecurrenceType(''); setRecurrenceEnd(undefined);
    setEstimatedTime(''); setSuggestion(null); setSuggestionDismissed(false);
    setDialogOpen(true);
  }

  function openEdit(task: any) {
    if (!canAccessTask(task)) {
      toast.error('Sem acesso', { description: 'Só o responsável ou criador da tarefa pode abrir o detalhe.' });
      return;
    }
    setEditingTask(task);
    setName(task.name); setStatus(task.status); setPriority(task.priority);
    setDeadline(task.deadline ? parseISO(task.deadline) : undefined);
    setAssignedTo(task.assigned_to || ''); setDepartment(task.department || '');
    setProjectId(task.project_id || ''); setClientId(task.client_id || ''); setNotes(task.notes || '');
    setParentTaskId(task.parent_task_id || '');
    setIsSubtask(!!task.parent_task_id);
    setRecurrenceType(task.recurrence_type || '');
    setRecurrenceEnd(task.recurrence_end ? parseISO(task.recurrence_end) : undefined);
    setEstimatedTime(task.estimated_time != null ? String(task.estimated_time) : '');
    setSuggestion(null); setSuggestionDismissed(false);
    // Load dependencies for this task
    const deps = taskDependencies.filter(d => d.task_id === task.id).map(d => d.depends_on_task_id);
    setDependsOnIds(deps);
    setDialogOpen(true);
  }

  // ─── Similarity search ────────────────────────────────────────
  function normalize(s: string) {
    return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  }

  function findSimilarTasks(input: string) {
    if (!input || input.length < 3 || editingTask) return;
    const norm = normalize(input);
    // Find tasks with similar names that have time entries
    const taskTimeMap: Record<string, number[]> = {};
    allTimeEntries.forEach(e => {
      if (!e.task_id || !e.duration_minutes) return;
      if (!taskTimeMap[e.task_id]) taskTimeMap[e.task_id] = [];
      taskTimeMap[e.task_id].push(e.duration_minutes);
    });

    for (const t of tasks) {
      if (!taskTimeMap[t.id]) continue;
      const tn = normalize(t.name);
      // Check if names are similar (one contains the other, or levenshtein-like)
      if (tn === norm || tn.includes(norm) || norm.includes(tn)) {
        const times = taskTimeMap[t.id];
        const avgMinutes = times.reduce((s, v) => s + v, 0) / times.length;
        const avgHours = Math.round((avgMinutes / 60) * 10) / 10;
        if (avgHours > 0) {
          setSuggestion({ taskName: t.name, avgHours });
          return;
        }
      }
    }
    setSuggestion(null);
  }

  function handleNameChange(val: string) {
    setName(val);
    setSuggestionDismissed(false);
    // Debounce-like: only search when typing pauses (simple approach)
    findSimilarTasks(val);
  }

  // ─── Capacity warning ─────────────────────────────────────────
  const capacityWarning = useMemo(() => {
    if (!assignedTo || !estimatedTime || !deadline) return null;
    const estHours = parseFloat(estimatedTime);
    if (isNaN(estHours) || estHours <= 0) return null;

    const member = teamMembers.find(m => m.profile_id === assignedTo && m.status === 'ativo');
    if (!member) return null;

    const weeklyHours = memberWeeklyHours(member);
    // Calculate existing committed hours for the deadline week
    const dlDate = deadline;
    const weekStart = startOfDay(dlDate);
    // Get tasks assigned to same member in same week (simple: same week)
    const wStart = startOfWeek(dlDate, { weekStartsOn: 1 });
    const wEnd = endOfWeek(dlDate, { weekStartsOn: 1 });

    let committedHours = 0;
    tasks.forEach(t => {
      if (t.assigned_to !== assignedTo || isTaskDone(t)) return;
      if (editingTask && t.id === editingTask.id) return;
      if (!t.deadline) return;
      const td = parseISO(t.deadline);
      if (td >= wStart && td <= wEnd && t.estimated_time) {
        committedHours += Number(t.estimated_time);
      }
    });

    const totalAfter = committedHours + estHours;
    const occupancy = Math.round((totalAfter / weeklyHours) * 100);
    const memberName = member.full_name || profiles.find(p => p.id === assignedTo)?.full_name || 'Membro';

    if (occupancy >= 80) {
      return { memberName, occupancy };
    }
    return null;
  }, [assignedTo, estimatedTime, deadline, tasks, teamMembers, profiles, editingTask]);

  function closeDialog() {
    setDialogOpen(false);
    setEditingTask(null);
  }

  function handleSave() {
    if (!name.trim() || !deadline) {
      toast.error('Preenche o nome e o prazo');
      return;
    }
    if (isSubtask && (!parentTaskId || parentTaskId === 'none')) {
      toast.error('Seleciona a tarefa principal');
      return;
    }
    // Block saving "Done" after deadline without notes
    const isChangingToDone = status === 'done' && editingTask?.status !== 'done';
    const deadlineDate = startOfDay(deadline);
    const now = new Date();
    if (isChangingToDone && isBefore(deadlineDate, startOfDay(now)) && !notes?.trim()) {
      toast.error('Esta tarefa está atrasada. Indica nas notas o motivo do atraso antes de concluir.');
      return;
    }
    // Soft warning: deadline lands on a business closure ("Off") day
    const offRange = findOffRange(offRanges, deadline);
    if (offRange && !editingTask) {
      toast.warning(`Atenção: o prazo cai num período Off (${offRange.title}).`, { duration: 6000 });
    }
    // ─── Auto-reassignment based on absence coverage ──────────
    let finalAssignedTo = assignedTo || null;
    let originalAssignee: string | null = null;

    if (finalAssignedTo && deadline) {
      const deadlineStr = format(deadline, 'yyyy-MM-dd');
      const coverage = findCoverageForMemberOnDate(absenceCoverages, finalAssignedTo, deadlineStr, teamMembers as any);

      if (coverage) {
        const absentMember = teamMembers.find(m => m.id === coverage.member_id);
        const absentName = absentMember?.full_name || 'Membro';

        if (coverage.substitute_id) {
          // Find substitute's profile_id
          const sub = teamMembers.find(m => m.id === coverage.substitute_id);
          if (sub?.profile_id) {
            originalAssignee = finalAssignedTo;
            finalAssignedTo = sub.profile_id;
            const subName = sub.full_name || 'Substituto';

            toast.info(
              `${absentName} está ausente de ${format(parseISO(coverage.start_date), 'dd/MM')} a ${format(parseISO(coverage.end_date), 'dd/MM')}. Tarefa atribuída a ${subName}.${coverage.sos_notes ? ` Notas SOS: ${coverage.sos_notes}` : ''}`,
              { duration: 8000 }
            );

            // Notify substitute
            sendNotification({
              userId: sub.profile_id,
              type: 'task',
              title: `Tarefa reatribuída: ${name.trim()}`,
              message: `Data limite: ${format(deadline, 'dd/MM/yyyy')}. ${absentName} está ausente. ${coverage.sos_notes ? `Notas SOS: ${coverage.sos_notes}` : ''}`,
              link: '/hub/tarefas',
            });
          }
        } else {
          toast.warning(
            `${absentName} está ausente nessa data mas não tem substituto definido. Atribui manualmente ou define um substituto na página Escala.`,
            { duration: 8000 }
          );
        }
      }
    }

    const payload: any = {
      name: name.trim(),
      status,
      priority,
      deadline: format(deadline, 'yyyy-MM-dd'),
      assigned_to: finalAssignedTo,
      original_assignee: originalAssignee || (editingTask?.original_assignee || null),
      department: department || null,
      project_id: projectId && projectId !== 'none' ? projectId : null,
      client_id: clientId && clientId !== 'none' ? clientId : null,
      parent_task_id: parentTaskId && parentTaskId !== 'none' ? parentTaskId : null,
      notes: notes || null,
      recurrence_type: recurrenceType || null,
      recurrence_end: recurrenceEnd ? format(recurrenceEnd, 'yyyy-MM-dd') : null,
      estimated_time: estimatedTime ? parseFloat(estimatedTime) : null,
      _dependsOnIds: dependsOnIds,
      _prevStatus: editingTask?.status || null,
    };
    if (isChangingToDone) {
      payload.updated_at = new Date().toISOString();
    }
    upsertTask.mutate(payload);
  }

  // ─── Filters ──────────────────────────────────────────────────
  const today = startOfDay(new Date());

  const filteredTasks = useMemo(() => {
    let result: typeof tasks;
    switch (view) {
      case 'todo':
        result = tasks.filter(isTaskOpen).sort((a, b) => {
          const da = a.deadline || '9999';
          const db = b.deadline || '9999';
          return da.localeCompare(db);
        }); break;
      case 'atrasadas':
        result = tasks.filter(t => isTaskOverdue(t, today)); break;
      case 'proximas':
        result = tasks.filter(t => t.status === 'por_comecar' && t.deadline && !isBefore(parseISO(t.deadline), today)); break;
      case 'historico':
        result = tasks.filter(isTaskDone); break;
      case 'todas':
      case 'responsavel':
      case 'calendario':
      default:
        result = tasks;
    }
    if (filterDept) result = result.filter(t => t.department === filterDept);
    if (filterResponsible) result = result.filter(t => t.assigned_to === filterResponsible);
    if (filterPriority) result = result.filter(t => t.priority === filterPriority);
    if (filterProject) result = result.filter(t => t.project_id === filterProject);
    return result;
  }, [tasks, view, today, filterDept, filterResponsible, filterPriority, filterProject]);

  // Helpers
  const isOverdue = (task: any) => isTaskOverdue(task, today);
  const isDoneAfterDeadline = (task: any) => {
    if (!isTaskDone(task) || !task.deadline) return false;
    const completedAt = task.updated_at ? parseISO(task.updated_at) : null;
    return completedAt && isBefore(parseISO(task.deadline), startOfDay(completedAt));
  };

  const getProfileName = (id: string | null) => {
    if (!id) return '—';
    const p = profiles.find(p => p.id === id);
    return p?.full_name || '—';
  };

  const getProjectName = (id: string | null) => {
    if (!id) return '';
    return projects.find(p => p.id === id)?.name || '';
  };

  // ─── Calendar view helpers ────────────────────────────────────
  const calStart = startOfMonth(calMonth);
  const calEnd = endOfMonth(calMonth);
  const calDays = eachDayOfInterval({ start: calStart, end: calEnd });
  const firstDayOffset = (getDay(calStart) + 6) % 7; // Monday-first

  const expandedCalendarTasks = useMemo(() => {
    const result: any[] = [];
    for (const t of tasks) {
      if (!t.deadline) continue;
      const start = parseISO(t.deadline);
      if (!t.recurrence_type) {
        result.push(t);
        continue;
      }
      const recEnd = t.recurrence_end ? parseISO(t.recurrence_end) : calEnd;
      let cursor = new Date(start);
      let count = 0;
      while (cursor <= recEnd && cursor <= calEnd && count < 366) {
        if (cursor >= calStart || isSameDay(cursor, calStart)) {
          result.push({
            ...t,
            id: `${t.id}_${format(cursor, 'yyyy-MM-dd')}`,
            deadline: format(cursor, 'yyyy-MM-dd'),
            _isOccurrence: true,
            _originalId: t.id,
          });
        }
        count++;
        switch (t.recurrence_type) {
          case 'diario': cursor = addDays(cursor, 1); break;
          case 'semanal': cursor = addWeeks(cursor, 1); break;
          case 'quinzenal': cursor = addWeeks(cursor, 2); break;
          case 'mensal': cursor = addMonths(cursor, 1); break;
          case 'mensal_primeiro': cursor = addMonths(cursor, 1); cursor = setDateFns(cursor, 1); break;
          default: count = 366;
        }
      }
    }
    return result;
  }, [tasks, calStart, calEnd]);

  const tasksByDate = useMemo(() => {
    const map: Record<string, any[]> = {};
    expandedCalendarTasks.forEach(t => {
      if (!t.deadline) return;
      const key = t.deadline;
      if (!map[key]) map[key] = [];
      map[key].push(t);
    });
    return map;
  }, [expandedCalendarTasks]);

  // ─── Render ───────────────────────────────────────────────────
  return (
    <AppLayout>
      <div className="space-y-6">
        <BackNavigation />
        {/* Header */}
        <PageHeader title="Tarefas" />
        <div className="flex items-center justify-end">
          <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Nova Tarefa</Button>
        </div>

        {/* View switcher + filters */}
        {(() => {
          const activeFilterCount = [filterDept, filterResponsible, filterPriority, filterProject, filterStatus].filter(Boolean).length;
          const filtersTrigger = (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground shrink-0">
                  <Filter className="h-3.5 w-3.5" /> Filtros
                  {activeFilterCount > 0 && (
                    <Badge variant="secondary" className="h-4 min-w-4 px-1 ml-1 flex items-center justify-center text-[9px] rounded-full">
                      {activeFilterCount}
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 space-y-3" align="start">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Status (server-side)</Label>
                    <Select value={filterStatus} onValueChange={v => setFilterStatus(v === '_all' ? '' : v)}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Todos" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_all">Todos</SelectItem>
                        {TASK_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Departamento</Label>
                    <Select value={filterDept} onValueChange={v => setFilterDept(v === '_all' ? '' : v)}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Todos" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_all">Todos</SelectItem>
                        {PROCESS_DEPARTMENTS.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Responsável</Label>
                    <Select value={filterResponsible} onValueChange={v => setFilterResponsible(v === '_all' ? '' : v)}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Todos" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_all">Todos</SelectItem>
                        {profiles.filter(p => p.full_name).map(p => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Prioridade</Label>
                    <Select value={filterPriority} onValueChange={v => setFilterPriority(v === '_all' ? '' : v)}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Todas" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_all">Todas</SelectItem>
                        {PRIORITIES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Projeto</Label>
                    <Select value={filterProject} onValueChange={v => setFilterProject(v === '_all' ? '' : v)}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Todos" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_all">Todos</SelectItem>
                        {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  {activeFilterCount > 0 && (
                    <Button size="sm" variant="ghost" className="w-full h-7 text-xs" onClick={() => { setFilterDept(''); setFilterResponsible(''); setFilterPriority(''); setFilterProject(''); setFilterStatus(''); }}>
                      <X className="h-3 w-3 mr-1" /> Limpar filtros
                    </Button>
                  )}
                </PopoverContent>
              </Popover>
          );

          return (
            <>
              <ViewTabs
                views={allViews}
                activeKey={view}
                onSelect={setView}
                onAdd={(label) => addView(label)}
                onRename={(id, label) => renameView({ id, label })}
                onDelete={(id) => { if (view.startsWith('custom_')) setView('todo'); deleteView(id); }}
                trailing={filtersTrigger}
              />
              {activeFilterCount > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  {filterStatus && <Badge variant="secondary" className="text-xs gap-1">{TASK_STATUSES.find(s => s.value === filterStatus)?.label || filterStatus} <X className="h-3 w-3 cursor-pointer" onClick={() => setFilterStatus('')} /></Badge>}
                  {filterDept && <Badge variant="secondary" className="text-xs gap-1">{PROCESS_DEPARTMENTS.find(d => d.value === filterDept)?.label || filterDept} <X className="h-3 w-3 cursor-pointer" onClick={() => setFilterDept('')} /></Badge>}
                  {filterResponsible && <Badge variant="secondary" className="text-xs gap-1">{profiles.find(p => p.id === filterResponsible)?.full_name} <X className="h-3 w-3 cursor-pointer" onClick={() => setFilterResponsible('')} /></Badge>}
                  {filterPriority && <Badge variant="secondary" className="text-xs gap-1">{PRIORITIES.find(p => p.value === filterPriority)?.label} <X className="h-3 w-3 cursor-pointer" onClick={() => setFilterPriority('')} /></Badge>}
                  {filterProject && <Badge variant="secondary" className="text-xs gap-1">{projects.find(p => p.id === filterProject)?.name} <X className="h-3 w-3 cursor-pointer" onClick={() => setFilterProject('')} /></Badge>}
                </div>
              )}
            </>
          );
        })()}

        {/* Content */}
        {view === 'calendario' ? (
          <CalendarView
            calMonth={calMonth}
            setCalMonth={setCalMonth}
            calDays={calDays}
            firstDayOffset={firstDayOffset}
            tasksByDate={tasksByDate}
            isOverdue={isOverdue}
            onTaskClick={(t) => {
              // For recurring occurrences, open the original task
              const originalId = t._originalId || t.id;
              const original = tasks.find(tk => tk.id === originalId) || t;
              openEdit(original);
            }}
          />
        ) : view === 'responsavel' ? (
          <ResponsavelView
            tasks={tasks.filter(isTaskOpen)}
            profiles={profiles}
            isOverdue={isOverdue}
            isDoneAfterDeadline={isDoneAfterDeadline}
            getProfileName={getProfileName}
            getProjectName={getProjectName}
            onTaskClick={openEdit}
          />
        ) : view === 'historico' ? (
          <HistoricoView
            tasks={tasks}
            profiles={profiles}
            projects={projects}
            timeEntries={allTimeEntries}
          />
        ) : view === 'rotinas' ? (
          <RotinasView />
        ) : (
          <TaskTable
            tasks={filteredTasks}
            isOverdue={isOverdue}
            isDoneAfterDeadline={isDoneAfterDeadline}
            getProfileName={getProfileName}
            getProjectName={getProjectName}
            onTaskClick={openEdit}
            taskDependencies={taskDependencies}
            allTasks={tasks}
            profiles={profiles}
            onUpdateTask={(id, patch) => updateTaskInline.mutate({ id, patch })}
          />
        )}
        <InfiniteScrollList
          totalCount={tasksTotal}
          loadedCount={tasks.length}
          hasNextPage={tasksQuery.hasNextPage}
          isFetchingNextPage={tasksQuery.isFetchingNextPage}
          fetchNextPage={tasksQuery.fetchNextPage}
          showCounter={false}
        >
          <span />
        </InfiniteScrollList>
      </div>

      <TaskFormDialog open={dialogOpen} onOpenChange={setDialogOpen} editingTask={editingTask} onSuccess={() => { queryClient.invalidateQueries({ queryKey: ['tasks'] }); queryClient.invalidateQueries({ queryKey: ['task-dependencies'] }); }} />

      {/* Timer prompt when changing to "A fazer" */}
      <Dialog open={!!timerPromptTaskId} onOpenChange={(v) => { if (!v) { toast('Não te esqueças de iniciar o timer quando começares a tarefa! ⏱️'); setTimerPromptTaskId(null); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Play className="h-4 w-4" /> Iniciar o timer?
            </DialogTitle>
            <DialogDescription>
              Mudaste o status para "A fazer". Queres iniciar o timer automáticamente?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => {
                toast('Não te esqueças de iniciar o timer quando começares a tarefa! ⏱️');
                setTimerPromptTaskId(null);
              }}
            >
              Agora não
            </Button>
            <Button
              onClick={async () => {
                if (timerPromptTaskId) {
                  const taskName = tasks.find(t => t.id === timerPromptTaskId)?.name || 'Tarefa';
                  await globalStartTimer(timerPromptTaskId, taskName);
                  toast.success('Timer iniciado! ▶️');
                }
                setTimerPromptTaskId(null);
              }}
              className="gap-1"
            >
              <Play className="h-3.5 w-3.5" /> Sim, iniciar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

// Sub-components (TaskTable, CalendarView, ResponsavelView) extracted to src/components/tasks/
