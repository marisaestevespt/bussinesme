import { useState, useMemo, useEffect } from 'react';
import { useSectorConfig } from '@/hooks/useSectorConfig';
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
import { TASK_STATUSES, PRIORITIES, getStatusInfo, getPriorityInfo, getDeptInfo } from '@/components/tasks/TaskTable';
import { useDepartmentColors } from '@/hooks/useDepartmentColors';
import { PROCESS_DEPARTMENTS } from '@/lib/departments';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useTeamPhotos } from '@/hooks/useTeamPhotos';
import { CalendarIcon, AlertTriangle, Clock, Repeat, GitBranch, Link2, Play, FileText } from 'lucide-react';
import { User, Building, FolderOpen, Briefcase, Hash, Flag, ListTodo } from 'lucide-react';
import {
  EntitySection,
  EntityProperties,
  EntityProperty,
  inlineInputClass,
  inlineTriggerClass,
} from '@/components/layout/entity';
import { cn } from '@/lib/utils';
import { format, parseISO, isBefore, startOfDay, startOfWeek, endOfWeek } from 'date-fns';
import { pt } from 'date-fns/locale';
import { toast } from 'sonner';
import { isTaskDone, isTaskOverdue } from '@/lib/taskStatus';
import { useOffDates, findOffRange } from '@/hooks/useOffDates';
import { requireConfirm, confirmDestructive } from '@/lib/confirmDestructive';

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
  const { getPhotoUrl } = useTeamPhotos();
  const { getBadgeClass: getDeptBadgeClass } = useDepartmentColors();
  const sectorConfig = useSectorConfig();

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
  const [estimatedTime, setEstimatedTime] = useState('');
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
      const { data } = await supabase.from('projects').select('id, name, client_id, client_name').is('archived_at', null);
      return data || [];
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients-list-simple'],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase.from('clients').select('id, full_name').eq('status', 'ativo').order('full_name');
      return data || [];
    },
  });

  const { data: allTasks = [] } = useQuery({
    queryKey: ['tasks-for-deps'],
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase.from('tasks').select('id,name,status,priority,deadline,assigned_to,parent_task_id,estimated_minutes').order('created_at', { ascending: false }).limit(500);
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
        setEstimatedTime(editingTask.estimated_minutes != null ? String(editingTask.estimated_minutes / 60) : '');
        setSopId(editingTask.sop_id || '');
        const deps = taskDependencies.filter(d => d.task_id === editingTask.id).map(d => d.depends_on_task_id);
        setDependsOnIds(deps);
      } else {
        setName(''); setStatus('por_comecar'); setPriority('alta');
        setDeadline(defaultDeadline || undefined); setAssignedTo(''); setDepartment(''); setProjectId(defaultProjectId || ''); setClientId(defaultClientId || ''); setNotes('');
        setParentTaskId(''); setDependsOnIds([]); setIsSubtask(false);
        setEstimatedTime(''); setSopId('');
      }
    }
  }, [open, editingTask]);

  // Similarity search — auto-fill estimated_time from historical average
  const [suggestion, setSuggestion] = useState<{ taskName: string; avgHours: number; sampleCount: number; confidence: string } | null>(null);
  const [suggestionDismissed, setSuggestionDismissed] = useState(false);

  useEffect(() => {
    if (!open || editingTask || suggestionDismissed || name.trim().length < 3) {
      setSuggestion(null);
      return;
    }
    const timer = setTimeout(async () => {
      const { data } = await supabase.rpc('suggest_task_estimate', {
        _name: name.trim(),
        _sop_id: sopId || null,
        _project_id: projectId || defaultProjectId || null,
        _deliverable_template_id: null,
      });
      const row = Array.isArray(data) ? data[0] : null;
      if (!row?.avg_minutes) {
        setSuggestion(null);
        return;
      }
      const avgHours = Math.round((Number(row.avg_minutes) / 60) * 10) / 10;
      setSuggestion({ taskName: row.matched_task_name || name.trim(), avgHours, sampleCount: row.sample_count || 1, confidence: row.confidence || 'baixa' });
      setEstimatedTime(String(avgHours));
    }, 450);
    return () => clearTimeout(timer);
  }, [open, editingTask, suggestionDismissed, name, sopId, projectId, defaultProjectId]);

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
      if (td >= wStart && td <= wEnd && t.estimated_minutes) committedHours += Number(t.estimated_minutes) / 60;
    });
    const totalAfter = committedHours + estHours;
    const occupancy = Math.round((totalAfter / weeklyHours) * 100);
    const memberName = member.full_name || profiles.find(p => p.id === assignedTo)?.full_name || 'Membro';
    if (occupancy >= 80) return { memberName, occupancy };
    return null;
  }, [assignedTo, estimatedTime, deadline, allTasks, teamMembers, profiles, editingTask]);

  const today = startOfDay(new Date());
  const isOverdue = (task: any) => isTaskOverdue(task, today);

  // Soft warning if the task deadline lands on a global "Off" day
  const { data: offRanges } = useOffDates();
  const offWarning = useMemo(() => findOffRange(offRanges, deadline), [offRanges, deadline]);
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
          sendNotification({ userId: assignedTo, type: 'task', title: `Tarefa atribuída: ${name}`, message: deadline ? `Prazo: ${format(deadline, 'dd/MM/yyyy')}` : undefined, link: '/hub/tarefas' });
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
      await requireConfirm();
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
            sendNotification({ userId: sub.profile_id, type: 'task', title: `Tarefa reatribuída: ${name.trim()}`, message: `${absentName} está ausente.`, link: '/hub/tarefas' });
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
      estimated_minutes: estimatedTime ? Math.round(parseFloat(estimatedTime) * 60) : null,
      sop_id: sopId || null,
      _dependsOnIds: dependsOnIds,
      _prevStatus: editingTask?.status || null,
    };
    if (isChangingToDone) payload.updated_at = new Date().toISOString();
    upsertTask.mutate(payload);
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl w-[95vw] max-h-[92vh] overflow-y-auto p-0 gap-0">
          {/* ── Header ─────────────────────────────────────────── */}
          <DialogHeader className="px-8 pt-6 pb-5 border-b border-border/40 shrink-0 space-y-2">
            <DialogTitle className="sr-only">{editingTask ? name || 'Editar tarefa' : 'Nova tarefa'}</DialogTitle>
            <Input
              value={name}
              onChange={e => { setName(e.target.value); setSuggestionDismissed(false); }}
              placeholder={editingTask ? 'Nome da tarefa' : 'Nova tarefa sem nome'}
              className="h-auto !text-[23px] font-semibold border-0 shadow-none focus-visible:ring-0 px-0 py-1 placeholder:text-muted-foreground/40"
            />
            {editingTask && isOverdue(editingTask) && (
              <Badge variant="destructive" className="gap-1 w-fit text-[10px] font-medium uppercase tracking-wide">
                <AlertTriangle className="h-3 w-3" />
                Atrasada
              </Badge>
            )}
          </DialogHeader>

          <div className="px-8 py-7 space-y-8">
            {/* Sugestão de tarefa similar */}
            {!editingTask && suggestion && !suggestionDismissed && (
              <div className="rounded-md border border-border/60 bg-muted/30 p-3 space-y-2">
                <p className="text-sm">
                  Tarefa similar: <strong>{suggestion.taskName}</strong>. Tempo médio: <strong>{suggestion.avgHours}h</strong>.
                </p>
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={() => { setEstimatedTime(String(suggestion.avgHours)); setSuggestionDismissed(true); }}>Aplicar</Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setSuggestionDismissed(true)}>Ignorar</Button>
                </div>
              </div>
            )}

            {/* ── Propriedades principais (Notion-style) ─────── */}
            <EntityProperties>
              <EntityProperty icon={ListTodo} label="Status">
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className={cn(inlineTriggerClass, getStatusInfo(status).color)}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_STATUSES.map(s => (
                      <SelectItem key={s.value} value={s.value}>
                        <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded border text-xs', s.color)}>{s.label}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </EntityProperty>
              <EntityProperty icon={Flag} label="Prioridade">
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger className={cn(inlineTriggerClass, getPriorityInfo(priority).color)}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map(p => (
                      <SelectItem key={p.value} value={p.value}>
                        <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded border text-xs', p.color)}>{p.label}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </EntityProperty>
              <EntityProperty icon={CalendarIcon} label="Prazo">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" className={cn(inlineTriggerClass, 'w-full justify-start font-normal', !deadline && 'text-muted-foreground')}>
                      {deadline ? format(deadline, 'PPP', { locale: pt }) : 'Selecionar data'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={deadline} onSelect={setDeadline} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </EntityProperty>
              <EntityProperty icon={User} label="Responsável">
                <Select value={assignedTo} onValueChange={setAssignedTo}>
                  <SelectTrigger className={inlineTriggerClass}>
                    {assignedTo ? (() => {
                      const p = profiles.find((x: any) => x.id === assignedTo);
                      const name = p?.full_name || 'Sem nome';
                      const photo = getPhotoUrl(p as any);
                      return (
                        <div className="flex items-center gap-2">
                          <Avatar className="h-5 w-5">
                            {photo && <AvatarImage src={photo} />}
                            <AvatarFallback className="text-[9px] font-semibold">
                              {name.split(/\s+/).map((s: string) => s[0]).slice(0, 2).join('').toUpperCase() || '?'}
                            </AvatarFallback>
                          </Avatar>
                          <span>{name}</span>
                        </div>
                      );
                    })() : <SelectValue placeholder="—" />}
                  </SelectTrigger>
                  <SelectContent>
                    {profiles.map((p: any) => {
                      const photo = getPhotoUrl(p);
                      const name = p.full_name || 'Sem nome';
                      return (
                        <SelectItem key={p.id} value={p.id}>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-5 w-5">
                              {photo && <AvatarImage src={photo} />}
                              <AvatarFallback className="text-[9px] font-semibold">
                                {name.split(/\s+/).map((s: string) => s[0]).slice(0, 2).join('').toUpperCase() || '?'}
                              </AvatarFallback>
                            </Avatar>
                            <span>{name}</span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </EntityProperty>
              <EntityProperty icon={Building} label="Departamento">
                <Select value={department} onValueChange={setDepartment}>
                  <SelectTrigger className={cn(inlineTriggerClass, department && getDeptBadgeClass(department))}>
                    {department ? (
                      <span className="inline-flex items-center gap-1">
                        <span>{getDeptInfo(department)?.icon}</span>
                        <span>{getDeptInfo(department)?.label}</span>
                      </span>
                    ) : (
                      <SelectValue placeholder="—" />
                    )}
                  </SelectTrigger>
                  <SelectContent>
                    {PROCESS_DEPARTMENTS.map(d => (
                      <SelectItem key={d.value} value={d.value}>
                        <span className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-xs', getDeptBadgeClass(d.value))}>
                          <span>{d.icon}</span>
                          <span>{d.label}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </EntityProperty>
              <EntityProperty icon={FolderOpen} label={sectorConfig.t('projeto')}>
                <Select value={projectId || 'none'} onValueChange={v => { setProjectId(v === 'none' ? '' : v); if (v && v !== 'none') { const proj = projects.find(p => p.id === v); if (proj?.client_id) setClientId(proj.client_id); } }}>
                  <SelectTrigger className={inlineTriggerClass}><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </EntityProperty>
              <EntityProperty icon={Briefcase} label={sectorConfig.t('cliente')}>
                <Select value={clientId || 'none'} onValueChange={v => setClientId(v === 'none' ? '' : v)}>
                  <SelectTrigger className={inlineTriggerClass}><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </EntityProperty>
              <EntityProperty icon={FileText} label="Processo (SOP)">
                <Select value={sopId || 'none'} onValueChange={v => {
                  const newSopId = v === 'none' ? '' : v;
                  setSopId(newSopId);
                  if (newSopId) {
                    const sop = sopsList.find(s => s.id === newSopId);
                    if (sop?.estimated_time != null) setEstimatedTime(String(sop.estimated_time));
                  }
                }}>
                  <SelectTrigger className={inlineTriggerClass}><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {sopsList.map(s => <SelectItem key={s.id} value={s.id}>{s.sop_id ? `${s.sop_id} — ` : ''}{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </EntityProperty>
              {editingTask?.original_assignee && (
                <EntityProperty icon={User} label="Resp. original">
                  <span className="text-sm text-muted-foreground">{profiles.find(p => p.id === editingTask.original_assignee)?.full_name || '—'}</span>
                </EntityProperty>
              )}
            </EntityProperties>

            {/* Recorrência removida — usar Rotinas para tarefas recorrentes */}

            {/* ── Hierarquia ─────────────────────────────────── */}
            <EntitySection
              title="Hierarquia"
              icon={GitBranch}
              compact
              action={
                <div className="flex items-center gap-2">
                  <Checkbox id="is-subtask-dialog" checked={isSubtask} onCheckedChange={checked => { setIsSubtask(!!checked); if (!checked) { setParentTaskId(''); setDependsOnIds([]); } }} />
                  <Label htmlFor="is-subtask-dialog" className="text-sm cursor-pointer text-muted-foreground">É subtarefa</Label>
                </div>
              }
            >
              {isSubtask ? (
                <EntityProperties>
                  <EntityProperty icon={GitBranch} label="Tarefa principal">
                    <Select value={parentTaskId || 'none'} onValueChange={v => setParentTaskId(v === 'none' ? '' : v)}>
                      <SelectTrigger className={inlineTriggerClass}><SelectValue placeholder="Selecionar" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhuma</SelectItem>
                        {allTasks.filter(t => t.id !== editingTask?.id && !t.parent_task_id).map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </EntityProperty>
                  <EntityProperty icon={Link2} label="Depende de">
                    <Select value="" onValueChange={val => { if (val && !dependsOnIds.includes(val)) setDependsOnIds(prev => [...prev, val]); }}>
                      <SelectTrigger className={inlineTriggerClass}><SelectValue placeholder="Adicionar dependência…" /></SelectTrigger>
                      <SelectContent>{allTasks.filter(t => t.id !== editingTask?.id && !dependsOnIds.includes(t.id)).map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </EntityProperty>
                </EntityProperties>
              ) : (
                <p className="text-sm text-muted-foreground">Marca "É subtarefa" para associar a uma tarefa principal e dependências.</p>
              )}

              {isSubtask && dependsOnIds.length > 0 && (
                <div className="mt-3 space-y-1">
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
            </EntitySection>

            {/* Dependency warnings */}
            {editingTask && dependsOnIds.length > 0 && (() => {
              const blockers = dependsOnIds.map(depId => allTasks.find(t => t.id === depId)).filter(t => t && !isTaskDone(t));
              if (blockers.length === 0) return null;
              return (
                <div className="rounded-md border border-warning/30 bg-warning/15 p-3 space-y-2">
                  <p className="text-sm font-medium text-warning flex items-center gap-2"><Link2 className="h-4 w-4" /> Dependências pendentes</p>
                  {blockers.map(dep => dep && (
                    <p key={dep.id} className="text-xs text-warning">
                      Pendente: <strong>"{dep.name}"</strong> — <Badge variant="outline" className={cn('text-[9px] px-1 py-0 ml-1', getStatusInfo(dep.status).color)}>{getStatusInfo(dep.status).label}</Badge>
                    </p>
                  ))}
                </div>
              );
            })()}

            {/* Subtarefas desta tarefa */}
            {editingTask && (() => {
              const subtasks = allTasks.filter(t => t.parent_task_id === editingTask.id);
              if (subtasks.length === 0) return null;
              return (
                <EntitySection title={`Sub-tarefas (${subtasks.length})`} icon={GitBranch} compact>
                  <div className="space-y-1">
                    {subtasks.map(st => (
                      <div key={st.id} className="flex items-center gap-2 p-2 rounded-md bg-muted/20 border border-border/40 text-sm">
                        <span className="truncate flex-1">{st.name}</span>
                        <Badge variant="outline" className={cn('text-[10px] shrink-0', getStatusInfo(st.status).color)}>{getStatusInfo(st.status).label}</Badge>
                      </div>
                    ))}
                  </div>
                </EntitySection>
              );
            })()}

            {editingTask && isDoneAfterDeadline(editingTask) && (
              <div className="rounded-md border border-destructive/50 bg-destructive/5 p-3 space-y-1">
                <p className="text-sm font-medium text-destructive flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Concluída após o prazo.</p>
                <p className="text-xs text-destructive/80">Indica nas notas o motivo do atraso.</p>
              </div>
            )}

            {/* ── Tempo ──────────────────────────────────────── */}
            <EntitySection title="Tempo" icon={Clock} compact>
              <EntityProperties>
                <EntityProperty icon={Hash} label="Tempo estimado">
                  <div className="flex items-center gap-2 w-full">
                    <Input
                      type="number"
                      min="0"
                      step="0.5"
                      value={estimatedTime}
                      onChange={e => setEstimatedTime(e.target.value)}
                      placeholder="0"
                      className={cn(inlineInputClass, 'w-20')}
                    />
                    <span className="text-xs text-muted-foreground">h</span>
                  </div>
                </EntityProperty>
                {editingTask && (
                  <EntityProperty icon={Clock} label="Tempo investido">
                    <TaskTimeTracker taskId={editingTask.id} compact />
                  </EntityProperty>
                )}
              </EntityProperties>
            </EntitySection>

            {capacityWarning && (
              <div className={cn('rounded-md border p-3', capacityWarning.occupancy > 100 ? 'border-destructive/50 bg-destructive/5' : 'border-warning/30 bg-warning/15')}>
                <p className={cn('text-sm flex items-center gap-2', capacityWarning.occupancy > 100 ? 'text-destructive font-medium' : 'text-warning')}>
                  <AlertTriangle className="h-4 w-4" />
                  <strong>{capacityWarning.memberName}</strong> ficará com {capacityWarning.occupancy}% de ocupação esta semana.
                </p>
              </div>
            )}

            {offWarning && (
              <div className="rounded-md border border-warning/30 bg-warning/15 p-3">
                <p className="text-sm flex items-center gap-2 text-warning">
                  <AlertTriangle className="h-4 w-4" />
                  Aviso: este prazo cai num período <strong>Off ({offWarning.title})</strong>. A tarefa pode ser criada à mesma.
                </p>
              </div>
            )}

            {/* ── Notas ──────────────────────────────────────── */}
            <EntitySection title="Notas" icon={FileText} compact>
              <Textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Adicionar notas, contexto, links…"
                rows={5}
                className={cn('resize-none', editingTask && isDoneAfterDeadline(editingTask) && !notes?.trim() && 'border-destructive ring-destructive/30 ring-2')}
              />
              {editingTask?.status === 'done' && (
                <div className="text-xs mt-2">
                  <span className="text-muted-foreground">Data real de conclusão: </span>
                  <span className={cn('font-medium', isDoneAfterDeadline(editingTask) ? 'text-destructive' : 'text-foreground')}>
                    {format(parseISO(editingTask.updated_at), "d 'de' MMMM 'de' yyyy, HH:mm", { locale: pt })}
                  </span>
                </div>
              )}
            </EntitySection>
          </div>

          {/* ── Footer ───────────────────────────────────────── */}
          <div className="px-8 py-4 border-t border-border/40 bg-background flex items-center justify-between gap-2 sticky bottom-0">
            <div>
              {editingTask && isOwner && (
                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => deleteTask.mutate(editingTask.id)}>
                  Eliminar
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={upsertTask.isPending}>
                {editingTask ? 'Guardar alterações' : 'Criar tarefa'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
