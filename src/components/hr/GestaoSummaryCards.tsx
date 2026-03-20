import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { FolderKanban, AlertTriangle, CheckSquare, Flame } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO, startOfWeek, endOfWeek, isBefore, startOfDay } from 'date-fns';
import { toast } from 'sonner';

const ACTIVE_PROJECT_STATUSES = ['ativo', 'em_curso', 'em_progresso', 'in_progress'];
const DONE_TASK_STATUSES = ['concluida', 'done'];

function useGestaoSummary() {
  const today = startOfDay(new Date());
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 });

  const projects = useQuery({
    queryKey: ['gestao-summary-projects'],
    queryFn: async () => {
      const { data } = await supabase.from('projects').select('id, name, status');
      return data || [];
    },
  });

  const tasks = useQuery({
    queryKey: ['gestao-summary-tasks'],
    queryFn: async () => {
      const { data } = await supabase.from('tasks').select('id, name, status, deadline, assigned_to, project_id, priority, estimated_time');
      return data || [];
    },
  });

  const contents = useQuery({
    queryKey: ['gestao-summary-contents'],
    queryFn: async () => {
      const { data } = await supabase.from('content_items').select('id, title, status, scheduled_at, assigned_to');
      return data || [];
    },
  });

  const members = useQuery({
    queryKey: ['gestao-summary-members'],
    queryFn: async () => {
      const { data } = await supabase.from('team_members').select('id, full_name, profile_id, expected_weekly_hours, status').eq('status', 'ativo');
      return data || [];
    },
  });

  const timeEntries = useQuery({
    queryKey: ['gestao-summary-time', format(weekStart, 'yyyy-MM-dd')],
    queryFn: async () => {
      const { data } = await supabase.from('time_entries').select('id, member_id, duration, entry_date')
        .gte('entry_date', format(weekStart, 'yyyy-MM-dd'))
        .lte('entry_date', format(weekEnd, 'yyyy-MM-dd'));
      return data || [];
    },
  });

  const profiles = useQuery({
    queryKey: ['gestao-summary-profiles'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, full_name');
      return data || [];
    },
  });

  // 1. Active projects
  const activeProjects = useMemo(() => {
    return (projects.data || []).filter(p => ACTIVE_PROJECT_STATUSES.includes(p.status));
  }, [projects.data]);

  // 2. Overdue items
  const overdueItems = useMemo(() => {
    const items: { id: string; name: string; type: string; deadline: string; assigned_to: string | null; daysOverdue: number }[] = [];

    (tasks.data || []).forEach(t => {
      if (t.deadline && !DONE_TASK_STATUSES.includes(t.status) && isBefore(parseISO(t.deadline), today)) {
        items.push({
          id: t.id, name: t.name, type: 'Tarefa', deadline: t.deadline,
          assigned_to: t.assigned_to,
          daysOverdue: Math.ceil((today.getTime() - parseISO(t.deadline).getTime()) / (1000 * 60 * 60 * 24)),
        });
      }
    });

    (contents.data || []).forEach(c => {
      if (c.scheduled_at && !DONE_TASK_STATUSES.includes(c.status) && c.status !== 'publicado' && isBefore(parseISO(c.scheduled_at), today)) {
        items.push({
          id: c.id, name: c.title, type: 'Conteúdo', deadline: c.scheduled_at,
          assigned_to: c.assigned_to,
          daysOverdue: Math.ceil((today.getTime() - parseISO(c.scheduled_at).getTime()) / (1000 * 60 * 60 * 24)),
        });
      }
    });

    return items.sort((a, b) => b.daysOverdue - a.daysOverdue);
  }, [tasks.data, contents.data, today]);

  // 3. Tasks this week (done vs planned)
  const weeklyTasks = useMemo(() => {
    const allTasks = tasks.data || [];
    // Tasks updated to done this week (approximation: done tasks with deadline this week or recently updated)
    const doneThisWeek = allTasks.filter(t =>
      DONE_TASK_STATUSES.includes(t.status) &&
      t.deadline &&
      parseISO(t.deadline) >= weekStart &&
      parseISO(t.deadline) <= weekEnd
    );
    // Planned = tasks with deadline this week
    const plannedThisWeek = allTasks.filter(t =>
      t.deadline &&
      parseISO(t.deadline) >= weekStart &&
      parseISO(t.deadline) <= weekEnd
    );
    return { done: doneThisWeek.length, planned: plannedThisWeek.length };
  }, [tasks.data, weekStart, weekEnd]);

  // 4. Overloaded members
  const overloadedMembers = useMemo(() => {
    const membersList = members.data || [];
    const entries = timeEntries.data || [];

    return membersList.map(m => {
      const weeklyHours = m.expected_weekly_hours || 40;
      const memberEntries = entries.filter(e => e.member_id === m.id);
      const hoursWorked = memberEntries.reduce((s, e) => s + Number(e.duration || 0), 0);
      const activeTasks = (tasks.data || []).filter(t => {
        const prof = (members.data || []).find(x => x.id === m.id);
        return t.assigned_to === prof?.profile_id && !DONE_TASK_STATUSES.includes(t.status);
      }).length;
      const estimatedHours = (tasks.data || []).filter(t => {
        const prof = (members.data || []).find(x => x.id === m.id);
        return t.assigned_to === prof?.profile_id && !DONE_TASK_STATUSES.includes(t.status);
      }).reduce((s, t) => s + (t.estimated_time || 0), 0) / 60;
      const occupancy = weeklyHours > 0 ? (estimatedHours / (weeklyHours * 4.33)) * 100 : 0;
      const isOverloaded = occupancy > 100 || activeTasks > 15;
      return { ...m, hoursWorked, activeTasks, estimatedHours, occupancy, isOverloaded };
    }).filter(m => m.isOverloaded);
  }, [members.data, timeEntries.data, tasks.data]);

  const profileName = (pid: string | null) => (profiles.data || []).find(p => p.id === pid)?.full_name || '—';

  return {
    activeProjects,
    overdueItems,
    weeklyTasks,
    overloadedMembers,
    profileName,
    isLoading: projects.isLoading || tasks.isLoading,
  };
}

export function GestaoSummaryCards() {
  const { activeProjects, overdueItems, weeklyTasks, overloadedMembers, profileName, isLoading } = useGestaoSummary();
  const [overdueOpen, setOverdueOpen] = useState(false);
  const [overloadOpen, setOverloadOpen] = useState(false);
  const [editingOverdue, setEditingOverdue] = useState<any>(null);
  const qc = useQueryClient();

  const updateDeadline = useMutation({
    mutationFn: async ({ id, type, newDate }: { id: string; type: string; newDate: string }) => {
      if (type === 'Tarefa') {
        const { error } = await supabase.from('tasks').update({ deadline: newDate }).eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('content_items').update({ scheduled_at: newDate }).eq('id', id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gestao-summary-tasks'] });
      qc.invalidateQueries({ queryKey: ['gestao-summary-contents'] });
      qc.invalidateQueries({ queryKey: ['perf-tasks'] });
      toast.success('Data atualizada');
      setEditingOverdue(null);
    },
    onError: () => toast.error('Erro ao atualizar'),
  });

  const markDone = useMutation({
    mutationFn: async ({ id, type }: { id: string; type: string }) => {
      if (type === 'Tarefa') {
        const { error } = await supabase.from('tasks').update({ status: 'concluida' }).eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('content_items').update({ status: 'publicado' }).eq('id', id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gestao-summary-tasks'] });
      qc.invalidateQueries({ queryKey: ['gestao-summary-contents'] });
      qc.invalidateQueries({ queryKey: ['perf-tasks'] });
      toast.success('Marcado como concluído');
    },
  });

  if (isLoading) return null;

  const taskRatio = weeklyTasks.planned > 0
    ? Math.round((weeklyTasks.done / weeklyTasks.planned) * 100)
    : weeklyTasks.done > 0 ? 100 : 0;

  const hasOverdue = overdueItems.length > 0;
  const hasOverloaded = overloadedMembers.length > 0;

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Active Projects */}
        <Card className="border-l-4 border-l-primary/60">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Projetos Ativos</p>
                <p className="text-2xl font-bold mt-1">{activeProjects.length}</p>
              </div>
              <div className="p-2 rounded-md bg-primary/10">
                <FolderKanban className="h-4 w-4 text-primary" />
              </div>
            </div>
            {activeProjects.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {activeProjects.slice(0, 3).map(p => (
                  <Badge key={p.id} variant="secondary" className="text-[10px]">{p.name}</Badge>
                ))}
                {activeProjects.length > 3 && <Badge variant="outline" className="text-[10px]">+{activeProjects.length - 3}</Badge>}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Overdue */}
        <Card
          className={`border-l-4 cursor-pointer transition-colors ${hasOverdue ? 'border-l-destructive hover:bg-destructive/5' : 'border-l-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/10'}`}
          onClick={() => hasOverdue && setOverdueOpen(true)}
        >
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Entregas em Atraso</p>
                <p className={`text-2xl font-bold mt-1 ${hasOverdue ? 'text-destructive' : 'text-emerald-600'}`}>
                  {overdueItems.length}
                </p>
              </div>
              <div className={`p-2 rounded-md ${hasOverdue ? 'bg-destructive/10' : 'bg-emerald-500/10'}`}>
                <AlertTriangle className={`h-4 w-4 ${hasOverdue ? 'text-destructive' : 'text-emerald-600'}`} />
              </div>
            </div>
            {hasOverdue ? (
              <p className="text-xs text-destructive mt-2 font-medium">Clica para ver e resolver →</p>
            ) : (
              <p className="text-xs text-emerald-600 mt-2">Tudo em dia 🎉</p>
            )}
          </CardContent>
        </Card>

        {/* Weekly Tasks */}
        <Card className="border-l-4 border-l-blue-500/60">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Tarefas da Semana</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <p className="text-2xl font-bold">{weeklyTasks.done}</p>
                  <span className="text-sm text-muted-foreground">/ {weeklyTasks.planned} planeadas</span>
                </div>
              </div>
              <div className="p-2 rounded-md bg-blue-500/10">
                <CheckSquare className="h-4 w-4 text-blue-600" />
              </div>
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-blue-500 transition-all"
                style={{ width: `${Math.min(taskRatio, 100)}%` }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">{taskRatio}% concluído</p>
          </CardContent>
        </Card>

        {/* Overloaded */}
        <Card
          className={`border-l-4 cursor-pointer transition-colors ${hasOverloaded ? 'border-l-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/10' : 'border-l-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/10'}`}
          onClick={() => hasOverloaded && setOverloadOpen(true)}
        >
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Sobrecarga</p>
                <p className={`text-2xl font-bold mt-1 ${hasOverloaded ? 'text-amber-600' : 'text-emerald-600'}`}>
                  {hasOverloaded ? `${overloadedMembers.length} alerta${overloadedMembers.length > 1 ? 's' : ''}` : 'OK'}
                </p>
              </div>
              <div className={`p-2 rounded-md ${hasOverloaded ? 'bg-amber-500/10' : 'bg-emerald-500/10'}`}>
                <Flame className={`h-4 w-4 ${hasOverloaded ? 'text-amber-600' : 'text-emerald-600'}`} />
              </div>
            </div>
            {hasOverloaded ? (
              <div className="mt-2 space-y-1">
                {overloadedMembers.slice(0, 2).map(m => (
                  <p key={m.id} className="text-xs text-amber-700 dark:text-amber-400 truncate">⚠ {m.full_name} — {m.occupancy.toFixed(0)}% ocupação</p>
                ))}
                {overloadedMembers.length > 2 && <p className="text-[10px] text-muted-foreground">+{overloadedMembers.length - 2} mais</p>}
              </div>
            ) : (
              <p className="text-xs text-emerald-600 mt-2">Equipa equilibrada ✓</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Overdue Detail Dialog */}
      <Dialog open={overdueOpen} onOpenChange={setOverdueOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-destructive" /> Entregas em Atraso ({overdueItems.length})</DialogTitle></DialogHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead>Data limite</TableHead>
                <TableHead>Atraso</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {overdueItems.map(item => (
                <TableRow key={`${item.type}-${item.id}`}>
                  <TableCell><Badge variant={item.type === 'Tarefa' ? 'secondary' : 'outline'} className="text-[10px]">{item.type}</Badge></TableCell>
                  <TableCell className="text-sm font-medium max-w-[200px] truncate">{item.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{profileName(item.assigned_to)}</TableCell>
                  <TableCell>
                    {editingOverdue?.id === item.id ? (
                      <div className="flex items-center gap-1">
                        <Input
                          type="date"
                          className="h-7 w-36 text-xs"
                          defaultValue={item.deadline}
                          onBlur={e => {
                            if (e.target.value && e.target.value !== item.deadline) {
                              updateDeadline.mutate({ id: item.id, type: item.type, newDate: e.target.value });
                            } else {
                              setEditingOverdue(null);
                            }
                          }}
                          autoFocus
                        />
                      </div>
                    ) : (
                      <button
                        className="text-sm hover:text-primary hover:underline"
                        onClick={() => setEditingOverdue(item)}
                      >
                        {format(parseISO(item.deadline), 'dd/MM/yyyy')}
                      </button>
                    )}
                  </TableCell>
                  <TableCell><Badge variant="destructive" className="text-[10px]">{item.daysOverdue}d</Badge></TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setEditingOverdue(item)}>Nova data</Button>
                      <Button variant="ghost" size="sm" className="h-7 text-xs text-emerald-600" onClick={() => markDone.mutate({ id: item.id, type: item.type })}>Concluir</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>

      {/* Overload Detail Dialog */}
      <Dialog open={overloadOpen} onOpenChange={setOverloadOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Flame className="h-4 w-4 text-amber-600" /> Membros Sobrecarregados</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {overloadedMembers.map(m => (
              <Card key={m.id}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold">{m.full_name}</h4>
                    <Badge variant="destructive" className="text-[10px]">{m.occupancy.toFixed(0)}% ocupação</Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">Tarefas ativas</span>
                      <p className="font-medium">{m.activeTasks}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Horas estimadas</span>
                      <p className="font-medium">{m.estimatedHours.toFixed(1)}h</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Horas esta semana</span>
                      <p className="font-medium">{m.hoursWorked.toFixed(1)}h</p>
                    </div>
                  </div>
                  <p className="text-xs text-amber-600">Considere redistribuir tarefas ou ajustar prazos.</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
