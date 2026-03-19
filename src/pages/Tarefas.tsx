import { useState, useMemo } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { ViewTabs } from '@/components/ViewTabs';
import { useUserViews, type DefaultView } from '@/hooks/useUserViews';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Plus, CalendarIcon, ListTodo, AlertTriangle, Clock, CalendarDays, List, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format, isPast, isToday, startOfDay, isBefore, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths } from 'date-fns';
import { pt } from 'date-fns/locale';

// ─── Constants ──────────────────────────────────────────────────

const TASK_STATUSES = [
  { value: 'por_comecar', label: 'Por começar', color: 'bg-muted text-muted-foreground' },
  { value: 'a_fazer', label: 'A fazer', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  { value: 'aguarda_feedback', label: 'Aguarda Feedback', color: 'bg-amber-100 text-amber-800 border-amber-200' },
  { value: 'para_aprovacao', label: 'Para Aprovação', color: 'bg-purple-100 text-purple-800 border-purple-200' },
  { value: 'precisa_alteracoes', label: 'Precisa de Alterações', color: 'bg-orange-100 text-orange-800 border-orange-200' },
  { value: 'done', label: 'Done', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
];

const PRIORITIES = [
  { value: 'alta', label: 'Prioridade 1', color: 'bg-red-100 text-red-700 border-red-300' },
  { value: 'media', label: 'Prioridade 2', color: 'bg-amber-100 text-amber-700 border-amber-300' },
  { value: 'baixa', label: 'Prioridade 3', color: 'bg-slate-100 text-slate-500 border-slate-300' },
];

const TASK_DEPARTMENTS = [
  { value: 'administrativo', label: 'Administrativo', color: 'bg-slate-100 text-slate-700 border-slate-200' },
  { value: 'marketing', label: 'Marketing e Branding', color: 'bg-pink-100 text-pink-700 border-pink-200' },
  { value: 'financeiro', label: 'Financeiro', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { value: 'comercial', label: 'Comercial e Vendas', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  { value: 'clientes', label: 'Clientes', color: 'bg-cyan-100 text-cyan-700 border-cyan-200' },
  { value: 'equipa', label: 'Equipa', color: 'bg-rose-100 text-rose-700 border-rose-200' },
  { value: 'operacao', label: 'Operação', color: 'bg-violet-100 text-violet-700 border-violet-200' },
];

type View = 'todo' | 'atrasadas' | 'proximas' | 'calendario' | 'responsavel' | 'todas';

const DEFAULT_VIEWS: DefaultView[] = [
  { key: 'todo', label: 'To Do', icon: <ListTodo className="h-4 w-4" />, isDefault: true },
  { key: 'atrasadas', label: 'Atrasadas', icon: <AlertTriangle className="h-4 w-4" />, isDefault: true },
  { key: 'proximas', label: 'Próximas Tarefas', icon: <Clock className="h-4 w-4" />, isDefault: true },
  { key: 'responsavel', label: 'Por Responsável', icon: <Users className="h-4 w-4" />, isDefault: true },
  { key: 'calendario', label: 'Calendário', icon: <CalendarDays className="h-4 w-4" />, isDefault: true },
  { key: 'todas', label: 'Todas as Tarefas', icon: <List className="h-4 w-4" />, isDefault: true },
];

function getStatusInfo(val: string) {
  return TASK_STATUSES.find(s => s.value === val) || TASK_STATUSES[0];
}
function getPriorityInfo(val: string) {
  return PRIORITIES.find(p => p.value === val) || PRIORITIES[2];
}
function getDeptInfo(val: string) {
  return TASK_DEPARTMENTS.find(d => d.value === val);
}

// ─── Main Page ──────────────────────────────────────────────────

export default function TarefasPage() {
  const { user, isOwner } = useAuth();
  const queryClient = useQueryClient();
  const { allViews, addView, renameView, deleteView } = useUserViews('tarefas', DEFAULT_VIEWS);
  const [view, setView] = useState<string>('todo');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<any>(null);
  const [calMonth, setCalMonth] = useState(new Date());

  // Form state
  const [name, setName] = useState('');
  const [status, setStatus] = useState('por_comecar');
  const [priority, setPriority] = useState('prioridade_1');
  const [deadline, setDeadline] = useState<Date | undefined>();
  const [assignedTo, setAssignedTo] = useState('');
  const [department, setDepartment] = useState('');
  const [projectId, setProjectId] = useState('');
  const [notes, setNotes] = useState('');

  // Queries
  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks'],
    queryFn: async () => {
      const { data, error } = await supabase.from('tasks').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, full_name, avatar_url');
      return data || [];
    },
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects-list'],
    queryFn: async () => {
      const { data } = await supabase.from('projects').select('id, name');
      return data || [];
    },
  });

  // Mutations
  const upsertTask = useMutation({
    mutationFn: async (payload: any) => {
      if (editingTask) {
        const updateData: any = { ...payload };
        // Auto-fill completed_at when status changes to done
        if (payload.status === 'done' && editingTask.status !== 'done') {
          updateData.updated_at = new Date().toISOString();
        }
        const { error } = await supabase.from('tasks').update(updateData).eq('id', editingTask.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('tasks').insert({ ...payload, created_by: user?.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success(editingTask ? 'Tarefa atualizada' : 'Tarefa criada');
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
      toast.success('Tarefa eliminada');
      closeDialog();
    },
  });

  function openNew() {
    setEditingTask(null);
    setName(''); setStatus('por_comecar'); setPriority('alta');
    setDeadline(undefined); setAssignedTo(''); setDepartment(''); setProjectId(''); setNotes('');
    setDialogOpen(true);
  }

  function openEdit(task: any) {
    setEditingTask(task);
    setName(task.name); setStatus(task.status); setPriority(task.priority);
    setDeadline(task.deadline ? parseISO(task.deadline) : undefined);
    setAssignedTo(task.assigned_to || ''); setDepartment(task.department || '');
    setProjectId(task.project_id || ''); setNotes(task.notes || '');
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditingTask(null);
  }

  function handleSave() {
    if (!name.trim() || !deadline) {
      toast.error('Preenche o nome e o prazo');
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
    const payload: any = {
      name: name.trim(),
      status,
      priority,
      deadline: format(deadline, 'yyyy-MM-dd'),
      assigned_to: assignedTo || null,
      department: department || null,
      project_id: projectId && projectId !== 'none' ? projectId : null,
      notes: notes || null,
    };
    if (isChangingToDone) {
      payload.updated_at = new Date().toISOString();
    }
    upsertTask.mutate(payload);
  }

  // ─── Filters ──────────────────────────────────────────────────
  const today = startOfDay(new Date());

  const filteredTasks = useMemo(() => {
    switch (view) {
      case 'todo':
        return tasks.filter(t => t.status !== 'done');
      case 'atrasadas':
        return tasks.filter(t => t.status !== 'done' && t.deadline && isBefore(parseISO(t.deadline), today));
      case 'proximas':
        return tasks.filter(t => t.status !== 'done' && t.deadline && !isBefore(parseISO(t.deadline), today));
      case 'todas':
      case 'calendario':
      default:
        return tasks;
    }
  }, [tasks, view, today]);

  // Helpers
  const isOverdue = (task: any) => task.status !== 'done' && task.deadline && isBefore(parseISO(task.deadline), today);
  const isDoneAfterDeadline = (task: any) => {
    if (task.status !== 'done' || !task.deadline) return false;
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

  const tasksByDate = useMemo(() => {
    const map: Record<string, any[]> = {};
    tasks.forEach(t => {
      if (!t.deadline) return;
      const key = t.deadline;
      if (!map[key]) map[key] = [];
      map[key].push(t);
    });
    return map;
  }, [tasks]);

  // ─── Render ───────────────────────────────────────────────────
  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Tarefas</h1>
          <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Nova Tarefa</Button>
        </div>

        {/* View switcher */}
        <ViewTabs
          views={allViews}
          activeKey={view}
          onSelect={setView}
          onAdd={(label) => addView(label)}
          onRename={(id, label) => renameView({ id, label })}
          onDelete={(id) => { if (view.startsWith('custom_')) setView('todo'); deleteView(id); }}
        />

        {/* Content */}
        {view === 'calendario' ? (
          <CalendarView
            calMonth={calMonth}
            setCalMonth={setCalMonth}
            calDays={calDays}
            firstDayOffset={firstDayOffset}
            tasksByDate={tasksByDate}
            isOverdue={isOverdue}
            onTaskClick={openEdit}
          />
        ) : view === 'responsavel' ? (
          <ResponsavelView
            tasks={tasks.filter(t => t.status !== 'done')}
            profiles={profiles}
            isOverdue={isOverdue}
            isDoneAfterDeadline={isDoneAfterDeadline}
            getProfileName={getProfileName}
            getProjectName={getProjectName}
            onTaskClick={openEdit}
          />
        ) : (
          <TaskTable
            tasks={filteredTasks}
            isOverdue={isOverdue}
            isDoneAfterDeadline={isDoneAfterDeadline}
            getProfileName={getProfileName}
            getProjectName={getProjectName}
            onTaskClick={openEdit}
          />
        )}
      </div>

      {/* Task Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTask ? 'Editar Tarefa' : 'Nova Tarefa'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            <div>
              <Label>Nome da tarefa *</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Nome da tarefa" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TASK_STATUSES.map(s => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Prioridade</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map(p => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

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

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Responsável</Label>
                <Select value={assignedTo} onValueChange={setAssignedTo}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>
                    {profiles.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.full_name || 'Sem nome'}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Departamento</Label>
                <Select value={department} onValueChange={setDepartment}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>
                    {TASK_DEPARTMENTS.map(d => (
                      <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Projeto associado</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {projects.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Done after deadline warning */}
            {editingTask && isDoneAfterDeadline(editingTask) && (
              <div className="rounded-md border border-destructive/50 bg-destructive/5 p-3 space-y-1">
                <p className="text-sm font-medium text-destructive flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4" /> Esta tarefa foi concluída após o prazo.
                </p>
                <p className="text-xs text-destructive/80">Indica nas notas o motivo do atraso.</p>
              </div>
            )}

            {/* Overdue warning for non-done tasks */}
            {editingTask && isOverdue(editingTask) && (
              <div className="rounded-md border border-destructive/50 bg-destructive/5 p-3">
                <p className="text-sm font-medium text-destructive flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4" /> Esta tarefa está atrasada.
                </p>
              </div>
            )}

            <div>
              <Label>Notas</Label>
              <Textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Notas..."
                rows={3}
                className={cn(
                  editingTask && isDoneAfterDeadline(editingTask) && !notes?.trim() &&
                  'border-destructive ring-destructive/30 ring-2'
                )}
              />
            </div>

            {/* Completion date (read-only) */}
            {editingTask?.status === 'done' && (
              <div>
                <Label>Data real de conclusão</Label>
                <p className={cn(
                  "text-sm mt-1 font-medium",
                  isDoneAfterDeadline(editingTask) ? 'text-destructive' : 'text-foreground'
                )}>
                  {format(parseISO(editingTask.updated_at), "d 'de' MMMM 'de' yyyy, HH:mm", { locale: pt })}
                </p>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button onClick={handleSave} className="flex-1" disabled={upsertTask.isPending}>
                {editingTask ? 'Guardar' : 'Criar Tarefa'}
              </Button>
              {editingTask && isOwner && (
                <Button variant="destructive" size="icon" onClick={() => deleteTask.mutate(editingTask.id)}>
                  <AlertTriangle className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

// ─── Task Table ─────────────────────────────────────────────────

function TaskTable({
  tasks, isOverdue, isDoneAfterDeadline, getProfileName, getProjectName, onTaskClick,
}: {
  tasks: any[];
  isOverdue: (t: any) => boolean;
  isDoneAfterDeadline: (t: any) => boolean;
  getProfileName: (id: string | null) => string;
  getProjectName: (id: string | null) => string;
  onTaskClick: (t: any) => void;
}) {
  if (!tasks.length) {
    return <div className="text-center py-12 text-muted-foreground">Sem tarefas nesta vista.</div>;
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tarefa</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Prioridade</TableHead>
            <TableHead>Prazo</TableHead>
            <TableHead>Responsável</TableHead>
            <TableHead>Departamento</TableHead>
            <TableHead>Projeto</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.map(task => {
            const overdue = isOverdue(task);
            const lateComplete = isDoneAfterDeadline(task);
            const statusInfo = getStatusInfo(task.status);
            const priorityInfo = getPriorityInfo(task.priority);
            const deptInfo = getDeptInfo(task.department);

            return (
              <TableRow
                key={task.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => onTaskClick(task)}
              >
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{task.name}</span>
                    {overdue && <AlertTriangle className="h-3.5 w-3.5 text-destructive" />}
                    {lateComplete && <AlertTriangle className="h-3.5 w-3.5 text-destructive" />}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={cn('text-xs', statusInfo.color)}>
                    {statusInfo.label}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={cn('text-xs', priorityInfo.color)}>
                    {priorityInfo.label}
                  </Badge>
                </TableCell>
                <TableCell>
                  <span className={cn('text-sm', (overdue || lateComplete) && 'text-destructive font-semibold')}>
                    {task.deadline ? format(parseISO(task.deadline), 'dd/MM/yyyy') : '—'}
                  </span>
                </TableCell>
                <TableCell className="text-sm">{getProfileName(task.assigned_to)}</TableCell>
                <TableCell>
                  {deptInfo ? (
                    <Badge variant="outline" className={cn('text-xs', deptInfo.color)}>{deptInfo.label}</Badge>
                  ) : '—'}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{getProjectName(task.project_id) || '—'}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

// ─── Calendar View ──────────────────────────────────────────────

function CalendarView({
  calMonth, setCalMonth, calDays, firstDayOffset, tasksByDate, isOverdue, onTaskClick,
}: {
  calMonth: Date;
  setCalMonth: (d: Date) => void;
  calDays: Date[];
  firstDayOffset: number;
  tasksByDate: Record<string, any[]>;
  isOverdue: (t: any) => boolean;
  onTaskClick: (t: any) => void;
}) {
  const weekDays = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={() => setCalMonth(subMonths(calMonth, 1))}>← Anterior</Button>
        <h2 className="text-lg font-semibold capitalize">
          {format(calMonth, 'MMMM yyyy', { locale: pt })}
        </h2>
        <Button variant="outline" size="sm" onClick={() => setCalMonth(addMonths(calMonth, 1))}>Próximo →</Button>
      </div>

      <div className="grid grid-cols-7 border rounded-lg overflow-hidden">
        {weekDays.map(d => (
          <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2 bg-muted/50 border-b">
            {d}
          </div>
        ))}
        {Array.from({ length: firstDayOffset }).map((_, i) => (
          <div key={`empty-${i}`} className="min-h-[80px] border-b border-r bg-muted/20" />
        ))}
        {calDays.map(day => {
          const key = format(day, 'yyyy-MM-dd');
          const dayTasks = tasksByDate[key] || [];
          const isToday_ = isToday(day);

          return (
            <div key={key} className={cn("min-h-[80px] border-b border-r p-1", isToday_ && 'bg-primary/5')}>
              <span className={cn("text-xs font-medium", isToday_ && 'text-primary font-bold')}>
                {format(day, 'd')}
              </span>
              <div className="space-y-0.5 mt-0.5">
                {dayTasks.slice(0, 3).map(t => (
                  <div
                    key={t.id}
                    onClick={() => onTaskClick(t)}
                    className={cn(
                      "text-[10px] leading-tight px-1 py-0.5 rounded cursor-pointer truncate",
                      isOverdue(t)
                        ? 'bg-destructive/10 text-destructive'
                        : t.status === 'done'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-primary/10 text-primary'
                    )}
                  >
                    {t.name}
                  </div>
                ))}
                {dayTasks.length > 3 && (
                  <span className="text-[10px] text-muted-foreground">+{dayTasks.length - 3}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Responsável View ───────────────────────────────────────────

function ResponsavelView({
  tasks, profiles, isOverdue, isDoneAfterDeadline, getProfileName, getProjectName, onTaskClick,
}: {
  tasks: any[];
  profiles: any[];
  isOverdue: (t: any) => boolean;
  isDoneAfterDeadline: (t: any) => boolean;
  getProfileName: (id: string | null) => string;
  getProjectName: (id: string | null) => string;
  onTaskClick: (t: any) => void;
}) {
  const grouped = useMemo(() => {
    const map: Record<string, any[]> = {};
    tasks.forEach(t => {
      const key = t.assigned_to || '__unassigned';
      if (!map[key]) map[key] = [];
      map[key].push(t);
    });
    return map;
  }, [tasks]);

  const sortedKeys = Object.keys(grouped).sort((a, b) => {
    if (a === '__unassigned') return 1;
    if (b === '__unassigned') return -1;
    return getProfileName(a).localeCompare(getProfileName(b));
  });

  if (!tasks.length) {
    return <div className="text-center py-12 text-muted-foreground">Sem tarefas atribuídas.</div>;
  }

  return (
    <div className="space-y-6">
      {sortedKeys.map(key => {
        const personTasks = grouped[key];
        const personName = key === '__unassigned' ? 'Sem responsável' : getProfileName(key);

        return (
          <div key={key} className="space-y-2">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground">{personName}</h3>
              <Badge variant="secondary" className="text-xs">{personTasks.length}</Badge>
            </div>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tarefa</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Prioridade</TableHead>
                    <TableHead>Prazo</TableHead>
                    <TableHead>Departamento</TableHead>
                    <TableHead>Projeto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {personTasks.map(task => {
                    const overdue = isOverdue(task);
                    const statusInfo = getStatusInfo(task.status);
                    const priorityInfo = getPriorityInfo(task.priority);
                    const deptInfo = getDeptInfo(task.department);

                    return (
                      <TableRow key={task.id} className="cursor-pointer hover:bg-muted/50" onClick={() => onTaskClick(task)}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{task.name}</span>
                            {overdue && <AlertTriangle className="h-3.5 w-3.5 text-destructive" />}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn('text-xs', statusInfo.color)}>{statusInfo.label}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn('text-xs', priorityInfo.color)}>{priorityInfo.label}</Badge>
                        </TableCell>
                        <TableCell>
                          <span className={cn('text-sm', overdue && 'text-destructive font-semibold')}>
                            {task.deadline ? format(parseISO(task.deadline), 'dd/MM/yyyy') : '—'}
                          </span>
                        </TableCell>
                        <TableCell>
                          {deptInfo ? <Badge variant="outline" className={cn('text-xs', deptInfo.color)}>{deptInfo.label}</Badge> : '—'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{getProjectName(task.project_id) || '—'}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        );
      })}
    </div>
  );
}
