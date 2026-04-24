import { useState, useMemo, useEffect } from 'react';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useActiveTimer } from '@/hooks/useActiveTimer';
import { useAbsenceCoverage, findCoverageForMemberOnDate } from '@/hooks/useAbsenceCoverage';
import { sendNotification } from '@/hooks/useNotifications';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { TaskTimeTracker } from '@/components/TaskTimeTracker';
import { TASK_STATUSES, PRIORITIES, getStatusInfo } from '@/components/tasks/TaskTable';
import { PROCESS_DEPARTMENTS } from '@/lib/departments';
import { CalendarIcon, AlertTriangle, Clock, Repeat, GitBranch, Link2, Play, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, parseISO, isBefore, startOfDay, startOfWeek, endOfWeek } from 'date-fns';
import { pt } from 'date-fns/locale';
import { toast } from 'sonner';
import { isTaskDone, isTaskOverdue } from '@/lib/taskStatus';
import { useOffDates, findOffRange } from '@/hooks/useOffDates';

type RecurrenceType = 'semanal' | 'quinzenal' | 'mensal' | 'mensal_primeiro' | 'mensal_ultimo' | 'diario' | 'personalizado';
const RECURRENCE_OPTIONS: { value: RecurrenceType | ''; label: string }[] = [
  { value: '', label: 'Não se repete' },
  { value: 'diario', label: 'Todos os dias' },
  { value: 'semanal', label: 'Todas as semanas' },
  { value: 'quinzenal', label: 'A cada 2 semanas' },
  { value: 'mensal', label: 'Todos os meses (mesmo dia)' },
  { value: 'mensal_primeiro', label: '1º dia útil de cada mês' },
  { value: 'mensal_ultimo', label: 'Último dia útil do mês' },
  { value: 'personalizado', label: 'Personalizado (a cada X dias)' },
];

interface TaskFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingTask?: any;
  /** Default deadline for new tasks */
  defaultDeadline?: Date;
  /** Default project for new tasks */
  defaultProjectId?: string;
  /** Default client for new tasks */
  defaultClientId?: string;
  /** Called after successful create/update */
  onSuccess?: () => void;
}

export function TaskFormDialog({ open, onOpenChange, editingTask, defaultDeadline, defaultProjectId, defaultClientId, onSuccess }: TaskFormDialogProps) {
  const { user, isOwner } = useAuth();
  const queryClient = useQueryClient();
  const { startTimer: globalStartTimer } = useActiveTimer();
  const { coverages: absenceCoverages } = useAbsenceCoverage();

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
  const [recurrenceIntervalDays, setRecurrenceIntervalDays] = useState('');
  const [estimatedTime, setEstimatedTime] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [sopId, setSopId] = useState('');
  // timerPromptTaskId removed — timer auto-starts on status change

  // Queries
  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles'],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, user_id, full_name, avatar_url');
      return data || [];
    },
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects-list-with-client'],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase.from('projects').select('id, name, client_id, client_name');
      return data || [];
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients-list-simple'],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase.from('clients').select('id, full_name').order('full_name');
      return data || [];
    },
  });

  const { data: allTasks = [] } = useQuery({
    queryKey: ['tasks-for-deps'],
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase.from('tasks').select('id,name,status,priority,deadline,assigned_to,parent_task_id,estimated_time').order('created_at', { ascending: false }).limit(500);
      return data || [];
    },
  });

  const { data: taskDependencies = [] } = useQuery({
    queryKey: ['task-dependencies'],
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase.from('task_dependencies').select('*');
      return data || [];
    },
  });

  const { data: teamMembers = [] } = useQuery({
    queryKey: ['team', 'members'],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase.from('team_members').select('id, full_name, profile_id, expected_weekly_hours, status');
      return data || [];
    },
  });

  const { data: allTimeEntries = [] } = useQuery({
    queryKey: ['task-time-entries-all'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase.from('task_time_entries').select('task_id, duration_minutes').or('ended_at.not.is.null,is_manual.eq.true');
      return data || [];
    },
  });

  const { data: sopsList = [] } = useQuery({
    queryKey: ['sops-list-for-tasks'],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase.from('sops').select('id, sop_id, name, estimated_time').order('name');
      return (data || []) as { id: string; sop_id: string; name: string; estimated_time: number | null }[];
    },
  });

  // Populate form when editing
  useEffect(() => {
    if (open) {
      if (editingTask) {
        setName(editingTask.name); setStatus(editingTask.status); setPriority(editingTask.priority);
        setDeadline(editingTask.deadline ? parseISO(editingTask.deadline) : undefined);
        setAssignedTo(editingTask.assigned_to || ''); setDepartment(editingTask.department || '');
        setProjectId(editingTask.project_id || ''); setClientId(editingTask.client_id || ''); setNotes(editingTask.notes || '');
        setParentTaskId(editingTask.parent_task_id || '');
        setIsSubtask(!!editingTask.parent_task_id);
        setRecurrenceType(editingTask.recurrence_type || '');
        setRecurrenceEnd(editingTask.recurrence_end ? parseISO(editingTask.recurrence_end) : undefined);
        setRecurrenceIntervalDays(editingTask.recurrence_interval_days != null ? String(editingTask.recurrence_interval_days) : '');
        setEstimatedTime(editingTask.estimated_time != null ? String(editingTask.estimated_time) : '');
        setSopId(editingTask.sop_id || '');
        setScheduledTime(editingTask.scheduled_time || '');
        const deps = taskDependencies.filter(d => d.task_id === editingTask.id).map(d => d.depends_on_task_id);
        setDependsOnIds(deps);
      } else {
        setName(''); setStatus('por_comecar'); setPriority('alta');
        setDeadline(defaultDeadline || undefined); setAssignedTo(''); setDepartment(''); setProjectId(defaultProjectId || ''); setClientId(defaultClientId || ''); setNotes('');
        setParentTaskId(''); setDependsOnIds([]); setIsSubtask(false); setRecurrenceType(''); setRecurrenceEnd(undefined);
        setRecurrenceIntervalDays(''); setEstimatedTime(''); setScheduledTime(''); setSopId('');
      }
    }
  }, [open, editingTask]);

  // Similarity search — auto-fill estimated_time from historical average
  const [suggestion, setSuggestion] = useState<{ taskName: string; avgHours: number } | null>(null);
  const [suggestionDismissed, setSuggestionDismissed] = useState(false);

  function normalize(s: string) { return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim(); }

  function findSimilarTasks(input: string) {
    if (!input || input.length < 3 || editingTask) return;
    const norm = normalize(input);
    const taskTimeMap: Record<string, number[]> = {};
    allTimeEntries.forEach(e => {
      if (!e.task_id || !e.duration_minutes) return;
      if (!taskTimeMap[e.task_id]) taskTimeMap[e.task_id] = [];
      taskTimeMap[e.task_id].push(e.duration_minutes);
    });
    // Aggregate times across ALL matching tasks (not just the first one)
    let totalMinutes = 0;
    let totalEntries = 0;
    let matchedName = '';
    for (const t of allTasks) {
      if (!taskTimeMap[t.id]) continue;
      const tn = normalize(t.name);
      if (tn === norm || tn.includes(norm) || norm.includes(tn)) {
        const times = taskTimeMap[t.id];
        totalMinutes += times.reduce((s, v) => s + v, 0);
        totalEntries += times.length;
        if (!matchedName) matchedName = t.name;
      }
    }
    if (totalEntries > 0) {
      const avgHours = Math.round((totalMinutes / totalEntries / 60) * 10) / 10;
      if (avgHours > 0) {
        setSuggestion({ taskName: matchedName, avgHours });
        // Auto-fill estimated time
        setEstimatedTime(String(avgHours));
        return;
      }
    }
    setSuggestion(null);
  }

  function handleNameChange(val: string) { setName(val); setSuggestionDismissed(false); findSimilarTasks(val); }

  // Capacity warning
  const capacityWarning = useMemo(() => {
    if (!assignedTo || !estimatedTime || !deadline) return null;
    const estHours = parseFloat(estimatedTime);
    if (isNaN(estHours) || estHours <= 0) return null;
    const member = teamMembers.find(m => m.profile_id === assignedTo && m.status === 'ativo');
    if (!member) return null;
    const weeklyHours = Number(member.expected_weekly_hours || 40);
    const wStart = startOfWeek(deadline, { weekStartsOn: 1 });
    const wEnd = endOfWeek(deadline, { weekStartsOn: 1 });
    let committedHours = 0;
    allTasks.forEach(t => {
      if (t.assigned_to !== assignedTo || isTaskDone(t)) return;
      if (editingTask && t.id === editingTask.id) return;
      if (!t.deadline) return;
      const td = parseISO(t.deadline);
      if (td >= wStart && td <= wEnd && t.estimated_time) committedHours += Number(t.estimated_time);
    });
    const totalAfter = committedHours + estHours;
    const occupancy = Math.round((totalAfter / weeklyHours) * 100);
    const memberName = member.full_name || profiles.find(p => p.id === assignedTo)?.full_name || 'Membro';
    if (occupancy >= 80) return { memberName, occupancy };
    return null;
  }, [assignedTo, estimatedTime, deadline, allTasks, teamMembers, profiles, editingTask]);

  const today = startOfDay(new Date());
  const isOverdue = (task: any) => isTaskOverdue(task, today);
  const isDoneAfterDeadline = (task: any) => {
    if (!isTaskDone(task) || !task?.deadline) return false;
    const completedAt = task.updated_at ? parseISO(task.updated_at) : null;
    return completedAt && isBefore(parseISO(task.deadline), startOfDay(completedAt));
  };
  const getProfileName = (id: string | null) => {
    if (!id) return '—';
    return profiles.find(p => p.id === id)?.full_name || '—';
  };

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
      if (_dependsOnIds !== undefined) {
        await supabase.from('task_dependencies').delete().eq('task_id', taskId);
        if (_dependsOnIds.length > 0) {
          const rows = _dependsOnIds.map((depId: string) => ({ task_id: taskId, depends_on_task_id: depId }));
          await supabase.from('task_dependencies').insert(rows);
        }
      }
      return { taskId, newStatus: taskPayload.status, prevStatus: _prevStatus };
    },
    onSuccess: async (result) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['task-dependencies'] });
      queryClient.invalidateQueries({ queryKey: ['unified-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['tasks-for-deps'] });
      toast.success(editingTask ? 'Tarefa atualizada' : 'Tarefa criada');
      if (assignedTo && assignedTo !== user?.id) {
        const wasReassigned = editingTask && editingTask.assigned_to !== assignedTo;
        const isNew = !editingTask;
        if (isNew || wasReassigned) {
          sendNotification({ userId: assignedTo, type: 'task', title: `Tarefa atribuída: ${name}`, message: deadline ? `Prazo: ${format(deadline, 'dd/MM/yyyy')}` : undefined, link: '/tarefas' });
        }
      }
      if (result && result.newStatus === 'a_fazer' && result.prevStatus !== 'a_fazer') {
        // Auto-start timer
        const taskName = allTasks.find(t => t.id === result.taskId)?.name || name;
        await globalStartTimer(result.taskId, taskName);
        toast.success('Timer iniciado automaticamente! ▶️');
        onOpenChange(false);
      } else {
        onOpenChange(false);
      }
      onSuccess?.();
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
      queryClient.invalidateQueries({ queryKey: ['unified-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
      toast.success('Tarefa eliminada');
      onOpenChange(false);
      onSuccess?.();
    },
  });

  function handleSave() {
    const taskSchema = z.object({
      name: z.string().min(1, 'Preenche o nome da tarefa'),
      deadline: z.date({ required_error: 'Seleciona um prazo' }),
      parentTaskId: isSubtask ? z.string().min(1, 'Seleciona a tarefa principal').refine(v => v !== 'none', 'Seleciona a tarefa principal') : z.string().optional(),
    });
    const validation = taskSchema.safeParse({ name: name.trim(), deadline, parentTaskId });
    if (!validation.success) {
      toast.error(validation.error.errors[0].message);
      return;
    }
    const isChangingToDone = status === 'done' && editingTask?.status !== 'done';
    const deadlineDate = startOfDay(deadline!);
    if (isChangingToDone && isBefore(deadlineDate, startOfDay(new Date())) && !notes?.trim()) {
      toast.error('Esta tarefa está atrasada. Indica nas notas o motivo do atraso antes de concluir.'); return;
    }

    let finalAssignedTo = assignedTo || null;
    let originalAssignee: string | null = null;
    if (finalAssignedTo && deadline) {
      const deadlineStr = format(deadline, 'yyyy-MM-dd');
      const coverage = findCoverageForMemberOnDate(absenceCoverages, finalAssignedTo, deadlineStr, teamMembers as any);
      if (coverage) {
        const absentMember = teamMembers.find(m => m.id === coverage.member_id);
        const absentName = absentMember?.full_name || 'Membro';
        if (coverage.substitute_id) {
          const sub = teamMembers.find(m => m.id === coverage.substitute_id);
          if (sub?.profile_id) {
            originalAssignee = finalAssignedTo;
            finalAssignedTo = sub.profile_id;
            toast.info(`${absentName} está ausente. Tarefa atribuída a ${sub.full_name}.`, { duration: 8000 });
            sendNotification({ userId: sub.profile_id, type: 'task', title: `Tarefa reatribuída: ${name.trim()}`, message: `${absentName} está ausente.`, link: '/tarefas' });
          }
        } else {
          toast.warning(`${absentName} está ausente mas não tem substituto.`, { duration: 8000 });
        }
      }
    }

    const payload: any = {
      name: name.trim(), status, priority,
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
      recurrence_interval_days: recurrenceType === 'personalizado' && recurrenceIntervalDays ? parseInt(recurrenceIntervalDays) : null,
      estimated_time: estimatedTime ? parseFloat(estimatedTime) : null,
      sop_id: sopId || null,
      scheduled_time: scheduledTime || null,
      _dependsOnIds: dependsOnIds,
      _prevStatus: editingTask?.status || null,
    };
    if (isChangingToDone) payload.updated_at = new Date().toISOString();
    upsertTask.mutate(payload);
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTask ? 'Editar Tarefa' : 'Nova Tarefa'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label>Nome da tarefa *</Label>
              <Input value={name} onChange={e => handleNameChange(e.target.value)} placeholder="Nome da tarefa" />
              {!editingTask && suggestion && !suggestionDismissed && (
                <div className="mt-2 rounded-md border border-border bg-muted/30 p-3 space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Tarefa similar: <strong className="text-foreground">{suggestion.taskName}</strong>. Tempo médio: <strong className="text-foreground">{suggestion.avgHours}h</strong>.
                  </p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={() => { setEstimatedTime(String(suggestion.avgHours)); setSuggestionDismissed(true); }}>Aplicar</Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setSuggestionDismissed(true)}>Ignorar</Button>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TASK_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Prioridade</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PRIORITIES.map(p => <SelectItem key={p.value} value={p.value}><Badge variant="outline" className={cn('text-xs border', p.color)}>{p.label}</Badge></SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Prazo *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !deadline && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {deadline ? format(deadline, 'PPP', { locale: pt }) : 'Selecionar data'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={deadline} onSelect={setDeadline} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> Hora (opcional)</Label>
                <Input type="time" value={scheduledTime} onChange={e => setScheduledTime(e.target.value)} placeholder="HH:MM" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="flex items-center gap-1.5"><Repeat className="h-3.5 w-3.5" /> Recorrência</Label>
                <Select value={recurrenceType || 'none'} onValueChange={v => setRecurrenceType(v === 'none' ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="Não se repete" /></SelectTrigger>
                  <SelectContent>{RECURRENCE_OPTIONS.map(o => <SelectItem key={o.value || 'none'} value={o.value || 'none'}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {recurrenceType === 'personalizado' && (
                <div>
                  <Label>A cada X dias</Label>
                  <Input type="number" min="1" max="365" value={recurrenceIntervalDays} onChange={e => setRecurrenceIntervalDays(e.target.value)} placeholder="Ex: 3" />
                </div>
              )}
              {recurrenceType && recurrenceType !== 'personalizado' && (
                <div>
                  <Label>Repetir até</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !recurrenceEnd && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {recurrenceEnd ? format(recurrenceEnd, 'PPP', { locale: pt }) : 'Sem limite'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={recurrenceEnd} onSelect={setRecurrenceEnd} initialFocus className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                </div>
              )}
            </div>
            {recurrenceType === 'personalizado' && (
              <div>
                <Label>Repetir até</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !recurrenceEnd && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {recurrenceEnd ? format(recurrenceEnd, 'PPP', { locale: pt }) : 'Sem limite'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={recurrenceEnd} onSelect={setRecurrenceEnd} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Responsável</Label>
                <Select value={assignedTo} onValueChange={setAssignedTo}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>{profiles.map(p => <SelectItem key={p.id} value={p.id}>{p.full_name || 'Sem nome'}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Departamento</Label>
                <Select value={department} onValueChange={setDepartment}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>{PROCESS_DEPARTMENTS.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            {editingTask?.original_assignee && (
              <div className="text-xs text-muted-foreground">Responsável original: {profiles.find(p => p.id === editingTask.original_assignee)?.full_name || '—'}</div>
            )}

            <div>
              <Label>Projeto associado</Label>
              <Select value={projectId} onValueChange={v => { setProjectId(v); if (v && v !== 'none') { const proj = projects.find(p => p.id === v); if (proj?.client_id) setClientId(proj.client_id); } }}>
                <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Cliente associado</Label>
              <Select value={clientId || 'none'} onValueChange={v => setClientId(v === 'none' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" /> Processo (SOP) associado</Label>
              <Select value={sopId || 'none'} onValueChange={v => {
                const newSopId = v === 'none' ? '' : v;
                setSopId(newSopId);
                if (newSopId) {
                  const sop = sopsList.find(s => s.id === newSopId);
                  if (sop?.estimated_time != null) {
                    setEstimatedTime(String(sop.estimated_time));
                  }
                }
              }}>
                <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {sopsList.map(s => <SelectItem key={s.id} value={s.id}>{s.sop_id ? `${s.sop_id} — ` : ''}{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Subtask toggle */}
            <div className="flex items-center gap-2">
              <Checkbox id="is-subtask-dialog" checked={isSubtask} onCheckedChange={checked => { setIsSubtask(!!checked); if (!checked) { setParentTaskId(''); setDependsOnIds([]); } }} />
              <Label htmlFor="is-subtask-dialog" className="text-sm cursor-pointer">Esta é uma subtarefa?</Label>
            </div>

            {isSubtask && (
              <div className="space-y-4 pl-4 border-l-2 border-primary/20">
                <div>
                  <Label className="flex items-center gap-1.5"><GitBranch className="h-3.5 w-3.5" /> Tarefa principal</Label>
                  <Select value={parentTaskId} onValueChange={setParentTaskId}>
                    <SelectTrigger><SelectValue placeholder="Selecionar tarefa principal" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhuma</SelectItem>
                      {allTasks.filter(t => t.id !== editingTask?.id && !t.parent_task_id).map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="flex items-center gap-1.5"><Link2 className="h-3.5 w-3.5" /> Depende de</Label>
                  <Select value="" onValueChange={val => { if (val && !dependsOnIds.includes(val)) setDependsOnIds(prev => [...prev, val]); }}>
                    <SelectTrigger><SelectValue placeholder="Adicionar dependência..." /></SelectTrigger>
                    <SelectContent>{allTasks.filter(t => t.id !== editingTask?.id && !dependsOnIds.includes(t.id)).map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                  </Select>
                  {dependsOnIds.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {dependsOnIds.map(depId => {
                        const depTask = allTasks.find(t => t.id === depId);
                        if (!depTask) return null;
                        const depStatus = getStatusInfo(depTask.status);
                        return (
                          <div key={depId} className="flex items-center gap-2 p-2 rounded-md bg-muted/30 border border-border/50 text-sm">
                            <span className="truncate flex-1">{depTask.name}</span>
                            <Badge variant="outline" className={cn('text-[10px] shrink-0', depStatus.color)}>{depStatus.label}</Badge>
                            <span className="text-[10px] text-muted-foreground shrink-0">{getProfileName(depTask.assigned_to)}</span>
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 shrink-0" onClick={() => setDependsOnIds(prev => prev.filter(id => id !== depId))}>×</Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Dependency warnings */}
            {editingTask && dependsOnIds.length > 0 && (() => {
              const blockers = dependsOnIds.map(depId => allTasks.find(t => t.id === depId)).filter(t => t && !isTaskDone(t));
              if (blockers.length === 0) return null;
              return (
                <div className="rounded-md border border-warning/30 bg-warning/15 p-3 space-y-1.5">
                  <p className="text-sm font-medium text-warning flex items-center gap-1.5"><Link2 className="h-4 w-4" /> Dependências pendentes</p>
                  {blockers.map(dep => dep && (
                    <p key={dep.id} className="text-xs text-warning">
                      Pendente: <strong>"{dep.name}"</strong> — <Badge variant="outline" className={cn('text-[9px] px-1 py-0 ml-1', getStatusInfo(dep.status).color)}>{getStatusInfo(dep.status).label}</Badge>
                    </p>
                  ))}
                </div>
              );
            })()}

            {/* Subtasks of this task */}
            {editingTask && (() => {
              const subtasks = allTasks.filter(t => t.parent_task_id === editingTask.id);
              if (subtasks.length === 0) return null;
              return (
                <div>
                  <Label className="flex items-center gap-1.5 mb-2"><GitBranch className="h-3.5 w-3.5" /> Sub-tarefas ({subtasks.length})</Label>
                  <div className="space-y-1">
                    {subtasks.map(st => (
                      <div key={st.id} className="flex items-center gap-2 p-2 rounded-md bg-muted/20 border border-border/40 text-sm">
                        <span className="truncate flex-1">{st.name}</span>
                        <Badge variant="outline" className={cn('text-[10px] shrink-0', getStatusInfo(st.status).color)}>{getStatusInfo(st.status).label}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {editingTask && isDoneAfterDeadline(editingTask) && (
              <div className="rounded-md border border-destructive/50 bg-destructive/5 p-3 space-y-1">
                <p className="text-sm font-medium text-destructive flex items-center gap-1.5"><AlertTriangle className="h-4 w-4" /> Concluída após o prazo.</p>
                <p className="text-xs text-destructive/80">Indica nas notas o motivo do atraso.</p>
              </div>
            )}

            {editingTask && isOverdue(editingTask) && (
              <div className="rounded-md border border-destructive/50 bg-destructive/5 p-3">
                <p className="text-sm font-medium text-destructive flex items-center gap-1.5"><AlertTriangle className="h-4 w-4" /> Esta tarefa está atrasada.</p>
              </div>
            )}

            {editingTask && <TaskTimeTracker taskId={editingTask.id} />}

            <div>
              <Label className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> Tempo Estimado (horas)</Label>
              <Input type="number" min="0" step="0.5" value={estimatedTime} onChange={e => setEstimatedTime(e.target.value)} placeholder="Ex: 2.5" />
            </div>

            {capacityWarning && (
              <div className={cn("rounded-md border p-3", capacityWarning.occupancy > 100 ? "border-destructive/50 bg-destructive/5" : "border-warning/30 bg-warning/15")}>
                <p className={cn("text-sm flex items-center gap-1.5", capacityWarning.occupancy > 100 ? "text-destructive font-medium" : "text-warning")}>
                  <AlertTriangle className="h-4 w-4" />
                  <strong>{capacityWarning.memberName}</strong> ficará com {capacityWarning.occupancy}% de ocupação esta semana.
                </p>
              </div>
            )}

            <div>
              <Label>Notas</Label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notas..." rows={3}
                className={cn(editingTask && isDoneAfterDeadline(editingTask) && !notes?.trim() && 'border-destructive ring-destructive/30 ring-2')} />
            </div>

            {editingTask?.status === 'done' && (
              <div>
                <Label>Data real de conclusão</Label>
                <p className={cn("text-sm mt-1 font-medium", isDoneAfterDeadline(editingTask) ? 'text-destructive' : 'text-foreground')}>
                  {format(parseISO(editingTask.updated_at), "d 'de' MMMM 'de' yyyy, HH:mm", { locale: pt })}
                </p>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button onClick={handleSave} className="flex-1" disabled={upsertTask.isPending}>
                {editingTask ? 'Guardar' : 'Criar Tarefa'}
              </Button>
              {editingTask && isOwner && (
                <Button variant="destructive" aria-label="Alerta" size="icon" onClick={() => deleteTask.mutate(editingTask.id)}>
                  <AlertTriangle className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
