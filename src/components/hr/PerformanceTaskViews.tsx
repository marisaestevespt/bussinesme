import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { AlertTriangle, GripVertical } from 'lucide-react';
import { format, parseISO, differenceInDays, startOfDay, isBefore } from 'date-fns';
import { cn } from '@/lib/utils';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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

const statusLabel = (s: string) => {
  const m: Record<string, string> = {
    por_comecar: 'Por começar', a_fazer: 'A fazer', em_curso: 'Em curso',
    aguarda_feedback: 'Aguarda', para_aprovacao: 'Aprovação',
    precisa_alteracoes: 'Alterações', done: 'Done', concluida: 'Concluída',
  };
  return m[s] || s;
};

function PriorityBadge({ p }: { p: string | null }) {
  if (p === 'P1') return <Badge variant="destructive" className="text-[10px]">P1</Badge>;
  if (p === 'P2') return <Badge variant="secondary" className="text-[10px]">P2</Badge>;
  return <span className="text-xs text-muted-foreground">—</span>;
}

/* ─── TAB 1: Tarefas por Membro (Kanban) ─── */
export function TasksByMemberKanban() {
  const { members, tasks, profiles, projects, isLoading } = useTaskViewData();
  const qc = useQueryClient();
  const [filterProject, setFilterProject] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [dragTask, setDragTask] = useState<string | null>(null);

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

  if (isLoading) return <p className="text-sm text-muted-foreground">A carregar...</p>;

  return (
    <div className="space-y-4">
      {/* Filters */}
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
            <SelectItem value="P1">P1</SelectItem>
            <SelectItem value="P2">P2</SelectItem>
          </SelectContent>
        </Select>
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
                  <p className={cn('text-[11px] font-medium', col.loadColor)}>
                    {col.occupancy.toFixed(0)}% ocupação
                  </p>
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
                      className="bg-card border rounded-md p-2 space-y-1 cursor-grab active:cursor-grabbing hover:shadow-sm transition-shadow"
                    >
                      <p className="text-xs font-medium truncate">{t.name}</p>
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
    </div>
  );
}

/* ─── TAB 2: Por Prioridade ─── */
export function TasksByPriority() {
  const { members, tasks, profiles, projects, isLoading } = useTaskViewData();
  const [filterMember, setFilterMember] = useState('all');

  const filtered = useMemo(() => {
    let t = tasks;
    if (filterMember !== 'all') {
      const m = members.find(x => x.id === filterMember);
      if (m?.profile_id) t = t.filter(x => x.assigned_to === m.profile_id);
    }
    return t;
  }, [tasks, filterMember, members]);

  const p1 = filtered.filter(t => t.priority === 'P1').sort((a, b) => (a.deadline || '').localeCompare(b.deadline || ''));
  const p2 = filtered.filter(t => t.priority === 'P2' || !t.priority).sort((a, b) => (a.deadline || '').localeCompare(b.deadline || ''));

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
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-6">Sem tarefas</TableCell></TableRow>
              ) : items.map(t => (
                <TableRow key={t.id}>
                  <TableCell className="text-sm font-medium">{t.name}</TableCell>
                  <TableCell className="text-sm">{profileName(t.assigned_to)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{projectName(t.project_id)}</TableCell>
                  <TableCell className="text-sm">{t.deadline ? format(parseISO(t.deadline), 'dd/MM/yyyy') : '—'}</TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px]">{statusLabel(t.status)}</Badge></TableCell>
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
      <div className="flex gap-2">
        <Select value={filterMember} onValueChange={setFilterMember}>
          <SelectTrigger className="w-48 h-8 text-xs"><SelectValue placeholder="Membro" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os membros</SelectItem>
            {members.map(m => <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {renderGroup('P1 — Críticas', p1, 'destructive')}
      {renderGroup('P2 — Normais', p2, 'secondary')}
    </div>
  );
}

/* ─── TAB 3: Em Atraso ─── */
export function OverdueTasks() {
  const { members, tasks, profiles, projects, isLoading } = useTaskViewData();
  const today = startOfDay(new Date());

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
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-destructive" />
        <span className="text-sm font-medium">{overdue.length} tarefas em atraso</span>
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {memberTasks.map(t => (
                    <TableRow key={t.id} className="bg-destructive/5">
                      <TableCell className="text-sm font-medium">{t.name}</TableCell>
                      <TableCell className="text-sm">{format(parseISO(t.deadline!), 'dd/MM/yyyy')}</TableCell>
                      <TableCell>
                        <Badge variant="destructive" className="text-[10px]">{t.daysOverdue}d</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{t.projectName}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      ))}
    </div>
  );
}
