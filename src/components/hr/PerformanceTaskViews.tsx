import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { AlertTriangle, GripVertical, Plus, Pencil, Trash2, CheckCircle } from 'lucide-react';
import { format, parseISO, differenceInDays, startOfDay, isBefore } from 'date-fns';
import { cn } from '@/lib/utils';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type Task = {
  id: string;
  name: string;
  assigned_to: string | null;
  deadline: string | null;
  priority: string | null;
  status: string;
  project_id: string | null;
  estimated_time: number | null;
};

type Member = {
  id: string;
  full_name: string;
  profile_id: string | null;
  expected_weekly_hours: number | null;
  status: string;
};

type Profile = { id: string; full_name: string | null };
type Project = { id: string; name: string };

function useTaskViewData() {
  const members = useQuery({
    queryKey: ['perf-members'],
    queryFn: async () => {
      const { data } = await supabase.from('team_members').select('id, full_name, profile_id, expected_weekly_hours, status').eq('status', 'ativo').order('full_name');
      return (data || []) as Member[];
    },
  });

  const tasks = useQuery({
    queryKey: ['perf-tasks'],
    queryFn: async () => {
      const { data } = await supabase.from('tasks').select('id, name, assigned_to, deadline, priority, status, project_id, estimated_time').not('status', 'in', '(concluida,done)');
      return (data || []) as Task[];
    },
  });

  const profiles = useQuery({
    queryKey: ['perf-profiles'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, full_name');
      return (data || []) as Profile[];
    },
  });

  const projects = useQuery({
    queryKey: ['perf-projects'],
    queryFn: async () => {
      const { data } = await supabase.from('projects').select('id, name');
      return (data || []) as Project[];
    },
  });

  return {
    members: members.data || [],
    tasks: tasks.data || [],
    profiles: profiles.data || [],
    projects: projects.data || [],
    isLoading: members.isLoading || tasks.isLoading,
  };
}

const STATUS_OPTIONS = [
  { value: 'por_comecar', label: 'Por começar' },
  { value: 'a_fazer', label: 'A fazer' },
  { value: 'em_curso', label: 'Em curso' },
  { value: 'aguarda_feedback', label: 'Aguarda feedback' },
  { value: 'para_aprovacao', label: 'Para aprovação' },
  { value: 'concluida', label: 'Concluída' },
];

const statusLabel = (s: string) => {
  const m: Record<string, string> = {
    por_comecar: 'Por começar', a_fazer: 'A fazer', em_curso: 'Em curso',
    aguarda_feedback: 'Aguarda', para_aprovacao: 'Aprovação',
    precisa_alteracoes: 'Alterações', done: 'Done', concluida: 'Concluída',
  };
  return m[s] || s;
};

function PriorityBadge({ p }: { p: string | null }) {
  if (p === 'alta') return <Badge variant="destructive" className="text-[10px]">Prioridade 1</Badge>;
  if (p === 'media') return <Badge className="text-[10px] bg-amber-100 text-amber-700 border border-amber-300" variant="outline">Prioridade 2</Badge>;
  if (p === 'baixa') return <Badge variant="secondary" className="text-[10px]">Prioridade 3</Badge>;
  return <span className="text-xs text-muted-foreground">—</span>;
}

/* ─── Task Edit Dialog ─── */
function TaskEditDialog({
  open, onClose, task, profiles, projects, members
}: {
  open: boolean;
  onClose: () => void;
  task: Partial<Task> | null;
  profiles: Profile[];
  projects: Project[];
  members: Member[];
}) {
  const qc = useQueryClient();
  const isNew = !task?.id;
  const [form, setForm] = useState({
    name: task?.name || '',
    assigned_to: task?.assigned_to || '',
    deadline: task?.deadline || '',
    priority: task?.priority || '',
    status: task?.status || 'por_comecar',
    project_id: task?.project_id || '',
    estimated_time: task?.estimated_time ? String(task.estimated_time) : '',
  });
  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name,
        assigned_to: form.assigned_to || null,
        deadline: form.deadline || null,
        priority: form.priority || null,
        status: form.status,
        project_id: form.project_id || null,
        estimated_time: form.estimated_time ? parseInt(form.estimated_time) : null,
      };
      if (isNew) {
        const { error } = await supabase.from('tasks').insert(payload);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('tasks').update(payload).eq('id', task!.id!);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['perf-tasks'] });
      toast.success(isNew ? 'Tarefa criada' : 'Tarefa atualizada');
      onClose();
    },
    onError: () => toast.error('Erro ao guardar tarefa'),
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isNew ? 'Nova Tarefa' : 'Editar Tarefa'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">Nome *</label>
            <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Nome da tarefa" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted-foreground">Responsável</label>
              <Select value={form.assigned_to} onValueChange={v => set('assigned_to', v)}>
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>
                  {profiles.map(p => <SelectItem key={p.id} value={p.id}>{p.full_name || 'Sem nome'}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Projeto</label>
              <Select value={form.project_id} onValueChange={v => set('project_id', v)}>
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>
                  {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-xs text-muted-foreground">Data limite</label>
              <Input type="date" value={form.deadline} onChange={e => set('deadline', e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Prioridade</label>
              <Select value={form.priority} onValueChange={v => set('priority', v)}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="alta">Prioridade 1</SelectItem>
                  <SelectItem value="media">Prioridade 2</SelectItem>
                  <SelectItem value="baixa">Prioridade 3</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Status</label>
              <Select value={form.status} onValueChange={v => set('status', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Tempo estimado (min)</label>
            <Input type="number" value={form.estimated_time} onChange={e => set('estimated_time', e.target.value)} placeholder="Ex: 60" />
          </div>
          <Button className="w-full" disabled={!form.name.trim()} onClick={() => save.mutate()}>
            {isNew ? 'Criar Tarefa' : 'Guardar Alterações'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Task actions hook ─── */
function useTaskActions() {
  const qc = useQueryClient();

  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tasks').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['perf-tasks'] });
      toast.success('Tarefa eliminada');
    },
    onError: () => toast.error('Erro ao eliminar'),
  });

  const markDone = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tasks').update({ status: 'concluida' }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['perf-tasks'] });
      toast.success('Tarefa concluída');
    },
  });

  return { deleteTask, markDone };
}

/* ─── TAB 1: Tarefas por Membro (Kanban) ─── */
export function TasksByMemberKanban() {
  const { members, tasks, profiles, projects, isLoading } = useTaskViewData();
  const { deleteTask, markDone } = useTaskActions();
  const qc = useQueryClient();
  const [filterProject, setFilterProject] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [dragTask, setDragTask] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<Partial<Task> | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const filteredTasks = useMemo(() => {
    let t = tasks;
    if (filterProject !== 'all') t = t.filter(x => x.project_id === filterProject);
    if (filterStatus !== 'all') t = t.filter(x => x.status === filterStatus);
    if (filterPriority !== 'all') t = t.filter(x => x.priority === filterPriority);
    return t;
  }, [tasks, filterProject, filterStatus, filterPriority]);

  const projectName = (pid: string | null) => projects.find(p => p.id === pid)?.name || '—';

  const memberColumns = useMemo(() => {
    return members.map(m => {
      const memberTasks = filteredTasks.filter(t => t.assigned_to === m.profile_id);
      const totalActive = tasks.filter(t => t.assigned_to === m.profile_id).length;
      const weeklyHours = m.expected_weekly_hours || 40;
      const monthlyCapacity = Math.round(weeklyHours * 4.33);
      const estimatedHours = tasks
        .filter(t => t.assigned_to === m.profile_id)
        .reduce((s, t) => s + (t.estimated_time || 0), 0) / 60;
      const occupancy = monthlyCapacity > 0 ? (estimatedHours / monthlyCapacity) * 100 : 0;
      const loadColor = occupancy > 100 ? 'text-destructive' : occupancy >= 80 ? 'text-amber-500' : 'text-emerald-600';
      const loadBg = occupancy > 100 ? 'bg-destructive/10' : occupancy >= 80 ? 'bg-amber-50 dark:bg-amber-950/20' : 'bg-emerald-50 dark:bg-emerald-950/20';

      return { member: m, tasks: memberTasks, totalActive, occupancy, loadColor, loadBg };
    });
  }, [members, filteredTasks, tasks]);

  async function handleDrop(taskId: string, targetProfileId: string | null) {
    if (!targetProfileId) return;
    const { error } = await supabase.from('tasks').update({ assigned_to: targetProfileId }).eq('id', taskId);
    if (error) { toast.error('Erro ao reatribuir'); return; }
    toast.success('Tarefa reatribuída');
    qc.invalidateQueries({ queryKey: ['perf-tasks'] });
    setDragTask(null);
  }

  function openNew(profileId?: string | null) {
    setEditingTask({ assigned_to: profileId || undefined } as any);
    setDialogOpen(true);
  }

  function openEdit(task: Task) {
    setEditingTask(task);
    setDialogOpen(true);
  }

  if (isLoading) return <p className="text-sm text-muted-foreground">A carregar...</p>;

  return (
    <div className="space-y-4">
      {/* Filters + New Task */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <Select value={filterProject} onValueChange={setFilterProject}>
            <SelectTrigger className="w-44 h-8 text-xs"><SelectValue placeholder="Projeto" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os projetos</SelectItem>
              {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="por_comecar">Por começar</SelectItem>
              <SelectItem value="a_fazer">A fazer</SelectItem>
              <SelectItem value="em_curso">Em curso</SelectItem>
              <SelectItem value="aguarda_feedback">Aguarda</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterPriority} onValueChange={setFilterPriority}>
            <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="Prioridade" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="alta">Prioridade 1</SelectItem>
              <SelectItem value="media">Prioridade 2</SelectItem>
              <SelectItem value="baixa">Prioridade 3</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" onClick={() => openNew()}>
          <Plus className="h-4 w-4 mr-1" /> Nova Tarefa
        </Button>
      </div>

      {/* Kanban */}
      <ScrollArea className="w-full">
        <div className="flex gap-3 pb-4" style={{ minWidth: memberColumns.length * 260 }}>
          {memberColumns.map(col => (
            <div
              key={col.member.id}
              className="w-[250px] shrink-0"
              onDragOver={e => e.preventDefault()}
              onDrop={() => dragTask && handleDrop(dragTask, col.member.profile_id)}
            >
              <Card className={cn('h-full', col.loadBg)}>
                <CardHeader className="p-3 pb-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold truncate">{col.member.full_name}</h4>
                    <Badge variant="outline" className="text-[10px] shrink-0">{col.totalActive}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className={cn('text-[11px] font-medium', col.loadColor)}>
                      {col.occupancy.toFixed(0)}% ocupação
                    </p>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => openNew(col.member.profile_id)}>
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-2 pt-0 space-y-1.5 max-h-[400px] overflow-y-auto">
                  {col.tasks.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-4">Sem tarefas</p>
                  )}
                  {col.tasks.map(t => (
                    <div
                      key={t.id}
                      draggable
                      onDragStart={() => setDragTask(t.id)}
                      onDragEnd={() => setDragTask(null)}
                      className="bg-card border rounded-md p-2 space-y-1 cursor-grab active:cursor-grabbing hover:shadow-sm transition-shadow group"
                    >
                      <div className="flex items-start justify-between gap-1">
                        <p className="text-xs font-medium truncate flex-1 cursor-pointer hover:text-primary" onClick={() => openEdit(t)}>{t.name}</p>
                        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <button className="p-0.5 rounded hover:bg-accent" onClick={() => markDone.mutate(t.id)} title="Concluir">
                            <CheckCircle className="h-3 w-3 text-emerald-600" />
                          </button>
                          <button className="p-0.5 rounded hover:bg-accent" onClick={() => openEdit(t)} title="Editar">
                            <Pencil className="h-3 w-3 text-muted-foreground" />
                          </button>
                          <button className="p-0.5 rounded hover:bg-destructive/10" onClick={() => deleteTask.mutate(t.id)} title="Eliminar">
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <PriorityBadge p={t.priority} />
                        <span className="text-[10px] text-muted-foreground">{statusLabel(t.status)}</span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                        <span>{t.deadline ? format(parseISO(t.deadline), 'dd/MM') : 'Sem data'}</span>
                        {t.project_id && <span className="truncate max-w-[100px]">{projectName(t.project_id)}</span>}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {dialogOpen && (
        <TaskEditDialog
          open={dialogOpen}
          onClose={() => { setDialogOpen(false); setEditingTask(null); }}
          task={editingTask}
          profiles={profiles}
          projects={projects}
          members={members}
        />
      )}
    </div>
  );
}

/* ─── TAB 2: Por Prioridade ─── */
export function TasksByPriority() {
  const { members, tasks, profiles, projects, isLoading } = useTaskViewData();
  const { deleteTask, markDone } = useTaskActions();
  const [filterMember, setFilterMember] = useState('all');
  const [editingTask, setEditingTask] = useState<Partial<Task> | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const filtered = useMemo(() => {
    let t = tasks;
    if (filterMember !== 'all') {
      const m = members.find(x => x.id === filterMember);
      if (m?.profile_id) t = t.filter(x => x.assigned_to === m.profile_id);
    }
    return t;
  }, [tasks, filterMember, members]);

  const p1 = filtered.filter(t => t.priority === 'alta').sort((a, b) => (a.deadline || '').localeCompare(b.deadline || ''));
  const p2 = filtered.filter(t => t.priority === 'media').sort((a, b) => (a.deadline || '').localeCompare(b.deadline || ''));
  const p3 = filtered.filter(t => t.priority === 'baixa' || !t.priority).sort((a, b) => (a.deadline || '').localeCompare(b.deadline || ''));

  const profileName = (pid: string | null) => profiles.find(p => p.id === pid)?.full_name || '—';
  const projectName = (pid: string | null) => projects.find(p => p.id === pid)?.name || '—';

  if (isLoading) return <p className="text-sm text-muted-foreground">A carregar...</p>;

  const renderGroup = (label: string, items: Task[], variant: 'destructive' | 'secondary') => (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Badge variant={variant} className="text-xs">{label}</Badge>
        <span className="text-xs text-muted-foreground">{items.length} tarefas</span>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tarefa</TableHead>
                <TableHead>Membro</TableHead>
                <TableHead>Projeto</TableHead>
                <TableHead>Data limite</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-6">Sem tarefas</TableCell></TableRow>
              ) : items.map(t => (
                <TableRow key={t.id} className="group cursor-pointer hover:bg-accent/50" onClick={() => { setEditingTask(t); setDialogOpen(true); }}>
                  <TableCell className="text-sm font-medium">{t.name}</TableCell>
                  <TableCell className="text-sm">{profileName(t.assigned_to)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{projectName(t.project_id)}</TableCell>
                  <TableCell className="text-sm">{t.deadline ? format(parseISO(t.deadline), 'dd/MM/yyyy') : '—'}</TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px]">{statusLabel(t.status)}</Badge></TableCell>
                  <TableCell>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                      <button className="p-1 rounded hover:bg-accent" onClick={() => markDone.mutate(t.id)} title="Concluir">
                        <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                      </button>
                      <button className="p-1 rounded hover:bg-destructive/10" onClick={() => deleteTask.mutate(t.id)} title="Eliminar">
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <Select value={filterMember} onValueChange={setFilterMember}>
          <SelectTrigger className="w-48 h-8 text-xs"><SelectValue placeholder="Membro" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os membros</SelectItem>
            {members.map(m => <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button size="sm" onClick={() => { setEditingTask({}); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Nova Tarefa
        </Button>
      </div>
      {renderGroup('Prioridade 1', p1, 'destructive')}
      {renderGroup('Prioridade 2', p2, 'secondary')}
      {renderGroup('Prioridade 3', p3, 'outline')}

      {dialogOpen && (
        <TaskEditDialog
          open={dialogOpen}
          onClose={() => { setDialogOpen(false); setEditingTask(null); }}
          task={editingTask}
          profiles={profiles}
          projects={projects}
          members={members}
        />
      )}
    </div>
  );
}

/* ─── TAB 3: Em Atraso ─── */
export function OverdueTasks() {
  const { members, tasks, profiles, projects, isLoading } = useTaskViewData();
  const { deleteTask, markDone } = useTaskActions();
  const today = startOfDay(new Date());
  const [editingTask, setEditingTask] = useState<Partial<Task> | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const overdue = useMemo(() => {
    return tasks
      .filter(t => t.deadline && isBefore(parseISO(t.deadline), today))
      .map(t => ({
        ...t,
        daysOverdue: differenceInDays(today, parseISO(t.deadline!)),
        memberName: profiles.find(p => p.id === t.assigned_to)?.full_name || '—',
        projectName: projects.find(p => p.id === t.project_id)?.name || '—',
        memberId: members.find(m => m.profile_id === t.assigned_to)?.id || '',
      }))
      .sort((a, b) => b.daysOverdue - a.daysOverdue);
  }, [tasks, today, profiles, projects, members]);

  // Group by member
  const grouped = useMemo(() => {
    const map: Record<string, typeof overdue> = {};
    overdue.forEach(t => {
      const key = t.memberName;
      if (!map[key]) map[key] = [];
      map[key].push(t);
    });
    return Object.entries(map).sort((a, b) => b[1].length - a[1].length);
  }, [overdue]);

  if (isLoading) return <p className="text-sm text-muted-foreground">A carregar...</p>;

  if (overdue.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-sm text-muted-foreground">Sem tarefas em atraso 🎉</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          <span className="text-sm font-medium">{overdue.length} tarefas em atraso</span>
        </div>
      </div>

      {grouped.map(([memberName, memberTasks]) => (
        <div key={memberName} className="space-y-2">
          <h4 className="text-sm font-semibold">{memberName} <span className="text-muted-foreground font-normal">({memberTasks.length})</span></h4>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tarefa</TableHead>
                    <TableHead>Data limite</TableHead>
                    <TableHead>Dias em atraso</TableHead>
                    <TableHead>Projeto</TableHead>
                    <TableHead className="w-[100px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {memberTasks.map(t => (
                    <TableRow key={t.id} className="bg-destructive/5 group cursor-pointer hover:bg-destructive/10" onClick={() => { setEditingTask(t); setDialogOpen(true); }}>
                      <TableCell className="text-sm font-medium">{t.name}</TableCell>
                      <TableCell className="text-sm">{format(parseISO(t.deadline!), 'dd/MM/yyyy')}</TableCell>
                      <TableCell>
                        <Badge variant="destructive" className="text-[10px]">{t.daysOverdue}d</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{t.projectName}</TableCell>
                      <TableCell>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                          <button className="p-1 rounded hover:bg-accent" onClick={() => markDone.mutate(t.id)} title="Concluir">
                            <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                          </button>
                          <button className="p-1 rounded hover:bg-destructive/10" onClick={() => deleteTask.mutate(t.id)} title="Eliminar">
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      ))}

      {dialogOpen && (
        <TaskEditDialog
          open={dialogOpen}
          onClose={() => { setDialogOpen(false); setEditingTask(null); }}
          task={editingTask}
          profiles={profiles}
          projects={projects}
          members={members}
        />
      )}
    </div>
  );
}
