import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Calendar } from '@/components/ui/calendar';
import { pt } from 'date-fns/locale';
import { DepartmentBadge } from '@/components/shared/DepartmentBadge';
import { useTeamPhotos } from '@/hooks/useTeamPhotos';
import { useQuery as useRQ } from '@tanstack/react-query';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Plus, FileText, Filter, SlidersHorizontal, LayoutGrid, List as ListIcon, Table as TableIcon,
  Pencil, Trash2, Save, ChevronDown, ChevronRight,
} from 'lucide-react';
import { format, parseISO, startOfDay, isWithinInterval, startOfWeek, endOfWeek, isToday, isBefore } from 'date-fns';
import { cn } from '@/lib/utils';
import { TaskFormDialog } from '@/components/tasks/TaskFormDialog';
import { useMyTasks, useProjects } from './secretaria-shared';
import { EmptyHint } from '@/components/ui/loading-skeletons';
import {
  isTaskDone, isTaskOpen, isTaskOverdue, countOverdue,
  getTaskStatusInfo, getTaskPriorityInfo, TASK_STATUSES, TASK_PRIORITIES,
} from '@/lib/taskStatus';
import {
  useSecretariaCustomViews, ALL_COLUMNS, DEFAULT_COLUMNS,
  type ViewScope, type ViewLayout, type ViewColumn, type ViewGroupBy,
  type ViewSort, type ViewFilters, type CustomView,
} from '@/hooks/useSecretariaCustomViews';

type Scope = 'today' | 'week' | 'all';

interface Props {
  scope?: Scope;
}

const today = startOfDay(new Date());
const weekStart = startOfWeek(today, { weekStartsOn: 1 });
const weekEnd = endOfWeek(today, { weekStartsOn: 1 });

function inScope(t: any, scope: Scope): boolean {
  if (scope === 'all') return true;
  if (t.deadline) {
    const d = parseISO(t.deadline);
    if (isBefore(d, today) && !isTaskDone(t)) return true;
    if (scope === 'today') return isToday(d);
    if (scope === 'week') return isWithinInterval(d, { start: weekStart, end: weekEnd });
  }
  return false;
}

/** Built-in views (always visible, can't be edited/deleted). */
type BuiltIn = {
  id: string; name: string;
  filters: ViewFilters; layout: ViewLayout; columns: ViewColumn[];
  group_by: ViewGroupBy; sort_by: ViewSort;
};

const BUILTINS: BuiltIn[] = [
  {
    id: '__todo', name: 'To Do',
    filters: { completion: 'pending' },
    layout: 'table', columns: DEFAULT_COLUMNS, group_by: 'none', sort_by: 'deadline_asc',
  },
  {
    id: '__atrasadas', name: 'Atrasadas',
    filters: { completion: 'pending', deadlineWindow: 'overdue' },
    layout: 'table', columns: DEFAULT_COLUMNS, group_by: 'none', sort_by: 'deadline_asc',
  },
  {
    id: '__concluidas', name: 'Concluídas',
    filters: { completion: 'done' },
    layout: 'table', columns: ['task', 'priority', 'deadline', 'project'], group_by: 'none', sort_by: 'recent',
  },
];

const PRIORITY_RANK: Record<string, number> = { alta: 0, media: 1, baixa: 2 };

function applyFilters(tasks: any[], f: ViewFilters): any[] {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const inSevenDays = format(new Date(Date.now() + 7 * 24 * 3600 * 1000), 'yyyy-MM-dd');
  return tasks.filter(t => {
    if (f.completion === 'pending' && isTaskDone(t)) return false;
    if (f.completion === 'done' && !isTaskDone(t)) return false;
    if (f.statuses?.length && !f.statuses.includes(t.status)) return false;
    if (f.priorities?.length && !f.priorities.includes(t.priority || '')) return false;
    if (f.projectIds?.length && !f.projectIds.includes(t.project_id || '')) return false;
    if (f.search) {
      const s = f.search.toLowerCase();
      if (!String(t.name || '').toLowerCase().includes(s)) return false;
    }
    if (f.deadlineWindow && f.deadlineWindow !== 'all') {
      const d = t.deadline as string | null;
      if (f.deadlineWindow === 'no_deadline') {
        if (d) return false;
      } else if (!d) return false;
      else if (f.deadlineWindow === 'overdue' && !(d < todayStr)) return false;
      else if (f.deadlineWindow === 'today' && d !== todayStr) return false;
      else if (f.deadlineWindow === 'week' && !(d >= todayStr && d <= inSevenDays)) return false;
    }
    return true;
  });
}

function sortTasks(tasks: any[], sort: ViewSort): any[] {
  const copy = [...tasks];
  const cmp = (a: any, b: any) => {
    switch (sort) {
      case 'deadline_asc': return (a.deadline || '\uFFFF').localeCompare(b.deadline || '\uFFFF');
      case 'deadline_desc': return (b.deadline || '').localeCompare(a.deadline || '');
      case 'priority_desc': return (PRIORITY_RANK[a.priority] ?? 99) - (PRIORITY_RANK[b.priority] ?? 99);
      case 'priority_asc': return (PRIORITY_RANK[b.priority] ?? -1) - (PRIORITY_RANK[a.priority] ?? -1);
      case 'name_asc': return String(a.name || '').localeCompare(String(b.name || ''));
      case 'name_desc': return String(b.name || '').localeCompare(String(a.name || ''));
      case 'recent': return (b.updated_at || '').localeCompare(a.updated_at || '');
    }
  };
  return copy.sort(cmp);
}

function groupTasks(tasks: any[], by: ViewGroupBy, projectName: (id: string | null) => string): { key: string; label: string; items: any[] }[] {
  if (by === 'none') return [{ key: 'all', label: '', items: tasks }];
  const map = new Map<string, any[]>();
  for (const t of tasks) {
    let key = '__none__';
    let label = 'Sem categoria';
    if (by === 'status') { key = t.status || '__none__'; label = getTaskStatusInfo(t.status).label; }
    else if (by === 'priority') { key = t.priority || '__none__'; label = t.priority ? getTaskPriorityInfo(t.priority).label : 'Sem prioridade'; }
    else if (by === 'project') { key = t.project_id || '__none__'; label = projectName(t.project_id) || 'Sem projeto'; }
    else if (by === 'deadline') {
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      if (!t.deadline) { key = '__sem__'; label = 'Sem prazo'; }
      else if (t.deadline < todayStr) { key = 'atrasado'; label = 'Em atraso'; }
      else if (t.deadline === todayStr) { key = 'hoje'; label = 'Hoje'; }
      else { key = 'futuro'; label = 'Próximos'; }
    }
    if (!map.has(key)) map.set(key, []);
    (map.get(key) as any[]).push(t);
    (map.get(key) as any).label = label;
  }
  return Array.from(map.entries()).map(([key, items]) => ({ key, label: (items as any).label || key, items }));
}

// ──────────────────────────────────────────────────────────────────────────────

interface ResolvedView {
  id: string;
  name: string;
  layout: ViewLayout;
  columns: ViewColumn[];
  filters: ViewFilters;
  group_by: ViewGroupBy;
  sort_by: ViewSort;
  isBuiltIn: boolean;
}

function builtinToView(b: BuiltIn): ResolvedView {
  return { ...b, isBuiltIn: true };
}
function customToView(c: CustomView): ResolvedView {
  return {
    id: c.id, name: c.name,
    layout: c.layout, columns: c.columns?.length ? c.columns : DEFAULT_COLUMNS,
    filters: c.filters || {}, group_by: c.group_by, sort_by: c.sort_by,
    isBuiltIn: false,
  };
}

export function MyTasksTable({ scope = 'all' }: Props) {
  const tasks = useMyTasks();
  const allProjects = useProjects();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const dbScope: ViewScope = scope === 'all' ? 'tasks' : scope;
  const { views: customViews, create, update, remove } = useSecretariaCustomViews(dbScope);

  const allViews: ResolvedView[] = useMemo(() => [
    ...BUILTINS.map(builtinToView),
    ...customViews.map(customToView),
  ], [customViews]);

  const [activeId, setActiveId] = useState<string>('__todo');
  const active = useMemo(() => allViews.find(v => v.id === activeId) || allViews[0], [allViews, activeId]);

  const [editTaskId, setEditTaskId] = useState<string | null>(null);
  const [showNewTask, setShowNewTask] = useState(false);
  const [editingViewId, setEditingViewId] = useState<string | null>(null); // open editor for this view ('new' for new)

  const editTask = useQuery({
    queryKey: ['edit-task-my-tasks-table', editTaskId],
    enabled: !!editTaskId,
    queryFn: async () => {
      const { data } = await supabase.from('tasks').select('*').eq('id', editTaskId!).maybeSingle();
      return data;
    },
  });

  const projectName = (id: string | null) => allProjects.data?.find(p => p.id === id)?.name || '';

  const scoped = useMemo(() => (tasks.data || []).filter(t => inScope(t, scope)), [tasks.data, scope]);
  const filtered = useMemo(() => {
    if (!active) return scoped;
    return sortTasks(applyFilters(scoped, active.filters), active.sort_by);
  }, [scoped, active]);

  const overdueCount = countOverdue(scoped, today);

  const markDone = async (id: string) => {
    await supabase.from('tasks').update({ status: 'done', updated_at: new Date().toISOString() }).eq('id', id);
    qc.invalidateQueries({ queryKey: ['my-tasks'] });
    toast.success('Tarefa concluída');
  };

  const updateTask = async (id: string, patch: Record<string, any>) => {
    const { error } = await supabase.from('tasks')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) { toast.error('Erro ao atualizar'); return; }
    qc.invalidateQueries({ queryKey: ['my-tasks'] });
    qc.invalidateQueries({ queryKey: ['unified-tasks'] });
  };

  if (!active) return null;

  return (
    <div className="space-y-4">
      {/* Toolbar: views + actions */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-2 flex-wrap">
          {allViews.map(v => {
            const isActive = v.id === active.id;
            const showOverdueBadge = v.id === '__atrasadas' && overdueCount > 0;
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => setActiveId(v.id)}
                className={cn(
                  'inline-flex items-center gap-2 rounded-full px-3 h-8 text-xs font-medium border transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background text-foreground/80 border-border hover:border-foreground/40',
                )}
              >
                {v.name}
                {showOverdueBadge && (
                  <Badge variant="destructive" className="h-4 px-1 text-[10px]">{overdueCount}</Badge>
                )}
                {!v.isBuiltIn && isActive && (
                  <Pencil
                    className="h-3 w-3 ml-0.5 opacity-70 hover:opacity-100"
                    onClick={(e) => { e.stopPropagation(); setEditingViewId(v.id); }}
                  />
                )}
              </button>
            );
          })}
          <Button
            variant="outline" size="sm"
            className="h-8 rounded-full px-3 gap-1 text-xs"
            onClick={() => setEditingViewId('new')}
          >
            <Plus className="h-3.5 w-3.5" /> Vista
          </Button>
        </div>
        <Button size="sm" onClick={() => setShowNewTask(true)}>
          <Plus className="h-4 w-4 mr-1" /> Nova Tarefa
        </Button>
      </div>

      {/* Render layout */}
      {active.layout === 'table' && (
        <TableLayout
          tasks={filtered} columns={active.columns} groupBy={active.group_by}
          showCheckbox={active.filters.completion !== 'done'}
          projectName={projectName}
          onRowClick={setEditTaskId}
          onMarkDone={markDone}
          onUpdateTask={updateTask}
          onContentClick={(cid) => navigate(`/hub/marketing/conteudos/${cid}`)}
        />
      )}
      {active.layout === 'list' && (
        <ListLayout
          tasks={filtered} groupBy={active.group_by} projectName={projectName}
          onItemClick={setEditTaskId}
        />
      )}
      {active.layout === 'board' && (
        <BoardLayout
          tasks={filtered} groupBy={active.group_by === 'none' ? 'status' : active.group_by}
          projectName={projectName} onItemClick={setEditTaskId}
        />
      )}

      {/* Dialogs */}
      <TaskFormDialog
        open={!!editTaskId}
        onOpenChange={(open) => { if (!open) setEditTaskId(null); }}
        editingTask={editTask.data ?? undefined}
        onSuccess={() => {
          setEditTaskId(null);
          qc.invalidateQueries({ queryKey: ['my-tasks'] });
          qc.invalidateQueries({ queryKey: ['unified-tasks'] });
        }}
      />
      <TaskFormDialog
        open={showNewTask}
        onOpenChange={setShowNewTask}
        onSuccess={() => {
          setShowNewTask(false);
          qc.invalidateQueries({ queryKey: ['my-tasks'] });
          qc.invalidateQueries({ queryKey: ['unified-tasks'] });
        }}
      />
      {editingViewId && (
        <ViewEditorDialog
          open={!!editingViewId}
          onClose={() => setEditingViewId(null)}
          existing={editingViewId !== 'new' ? customViews.find(v => v.id === editingViewId) : undefined}
          projects={allProjects.data || []}
          onSave={async (payload) => {
            if (editingViewId === 'new') {
              const created = await create.mutateAsync(payload);
              setActiveId(created.id);
            } else {
              await update.mutateAsync({ id: editingViewId, ...payload });
            }
            setEditingViewId(null);
          }}
          onDelete={editingViewId !== 'new' ? async () => {
            await remove.mutateAsync(editingViewId);
            setActiveId('__todo');
            setEditingViewId(null);
          } : undefined}
        />
      )}
    </div>
  );
}

// ─── Layouts ──────────────────────────────────────────────────────────────────

function TableLayout({
  tasks, columns, groupBy, showCheckbox, projectName, onRowClick, onMarkDone, onUpdateTask, onContentClick,
}: {
  tasks: any[]; columns: ViewColumn[]; groupBy: ViewGroupBy;
  showCheckbox: boolean; projectName: (id: string | null) => string;
  onRowClick: (id: string) => void; onMarkDone: (id: string) => void;
  onUpdateTask: (id: string, patch: Record<string, any>) => void;
  onContentClick: (cid: string) => void;
}) {
  const groups = useMemo(() => groupTasks(tasks, groupBy, projectName), [tasks, groupBy, projectName]);
  const totalCols = (showCheckbox ? 1 : 0) + columns.length;
  const { getPhotoUrl } = useTeamPhotos();
  // Lightweight profiles list for inline assignee picker
  const profilesQ = useRQ({
    queryKey: ['profiles-mini'],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, full_name, avatar_url, user_id');
      return data || [];
    },
  });
  const profiles = profilesQ.data || [];
  const getInitials = (name?: string | null) => {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '?';
  };
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {showCheckbox && <TableHead className="w-10" />}
          {columns.map(c => (
            <TableHead key={c}>{ALL_COLUMNS.find(x => x.key === c)?.label}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {tasks.length === 0 && (
          <TableRow><TableCell colSpan={totalCols} className="text-center text-muted-foreground py-8">Sem tarefas.</TableCell></TableRow>
        )}
        {groups.map(g => (
          <>
            {groupBy !== 'none' && (
              <TableRow key={`g-${g.key}`} className="bg-muted/30 hover:bg-muted/30">
                <TableCell colSpan={totalCols} className="py-2 font-semibold text-foreground/80">
                  {g.label} <span className="text-muted-foreground tabular-nums">· {g.items.length}</span>
                </TableCell>
              </TableRow>
            )}
            {g.items.map((t: any) => {
              const si = getTaskStatusInfo(t.status);
              const pi = getTaskPriorityInfo(t.priority);
              const stop = (e: React.SyntheticEvent) => { e.stopPropagation(); };
              const overdue = isTaskOverdue(t);
              const responsibleProfile = profiles.find(p => p.id === t.assigned_to);
              const responsibleName = responsibleProfile?.full_name || '';
              const responsiblePhoto = getPhotoUrl(responsibleProfile || (t.assigned_to ? { id: t.assigned_to, full_name: responsibleName } : null));
              return (
                <TableRow key={t.id} className="cursor-pointer hover:bg-muted/50" onClick={() => onRowClick(t.id)}>
                  {showCheckbox && (
                    <TableCell><Checkbox checked={false} onCheckedChange={() => onMarkDone(t.id)} onClick={(e) => e.stopPropagation()} /></TableCell>
                  )}
                  {columns.map(c => {
                    if (c === 'task') return (
                      <TableCell key={c} className="font-medium">
                        <div className="flex items-center gap-2">
                          {t.name}
                          {t.content_id && (
                            <Button variant="ghost" aria-label="Documento" size="icon" className="h-6 w-6 shrink-0"
                              onClick={(e) => { e.stopPropagation(); onContentClick(t.content_id); }}>
                              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    );
                    if (c === 'status') return (
                      <TableCell key={c} onClick={stop} onPointerDown={stop}>
                        <Select value={t.status} onValueChange={(v) => v !== t.status && onUpdateTask(t.id, { status: v })}>
                          <SelectTrigger className={cn('h-7 px-2 text-xs gap-1 border-0 bg-transparent hover:bg-muted/60 focus:ring-0 focus:ring-offset-0 w-fit min-w-max [&>span]:whitespace-nowrap', si.color)}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TASK_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    );
                    if (c === 'priority') return (
                      <TableCell key={c} onClick={stop} onPointerDown={stop}>
                        <Select value={t.priority} onValueChange={(v) => v !== t.priority && onUpdateTask(t.id, { priority: v })}>
                          <SelectTrigger className={cn('h-7 px-2 text-xs gap-1 border-0 bg-transparent hover:bg-muted/60 focus:ring-0 focus:ring-offset-0 w-fit min-w-max [&>span]:whitespace-nowrap', pi.color)}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TASK_PRIORITIES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    );
                    if (c === 'deadline') return (
                      <TableCell key={c} onClick={stop} onPointerDown={stop}>
                        <Popover>
                          <PopoverTrigger asChild>
                            <button type="button" className={cn('text-sm px-2 py-1 rounded hover:bg-muted/60 transition-colors', overdue && 'text-destructive font-semibold')}>
                              {t.deadline ? format(parseISO(t.deadline), 'dd/MM/yyyy') : '—'}
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              locale={pt}
                              selected={t.deadline ? parseISO(t.deadline) : undefined}
                              onSelect={(d) => { if (d) onUpdateTask(t.id, { deadline: format(d, 'yyyy-MM-dd') }); }}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </TableCell>
                    );
                    if (c === 'responsavel') return (
                      <TableCell key={c} onClick={stop} onPointerDown={stop}>
                        <Select
                          value={t.assigned_to || '_none'}
                          onValueChange={(v) => onUpdateTask(t.id, { assigned_to: v === '_none' ? null : v })}
                        >
                          <SelectTrigger className="h-8 px-1.5 gap-2 border-0 bg-transparent hover:bg-muted/60 focus:ring-0 focus:ring-offset-0 w-fit min-w-max [&>span]:whitespace-nowrap [&>svg]:opacity-0 [&>svg]:group-hover:opacity-100">
                            <div className="flex items-center gap-2">
                              <Avatar className="h-6 w-6">
                                <AvatarImage src={responsiblePhoto || undefined} />
                                <AvatarFallback className="text-[10px] font-semibold">{getInitials(responsibleName)}</AvatarFallback>
                              </Avatar>
                              <span className="text-sm whitespace-nowrap">{responsibleName || 'Sem responsável'}</span>
                            </div>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_none">Sem responsável</SelectItem>
                            {profiles.filter(p => p.full_name).map(p => (
                              <SelectItem key={p.id} value={p.id}>
                                <div className="flex items-center gap-2">
                                  <Avatar className="h-5 w-5">
                                    <AvatarImage src={getPhotoUrl(p) || undefined} />
                                    <AvatarFallback className="text-[9px] font-semibold">{getInitials(p.full_name)}</AvatarFallback>
                                  </Avatar>
                                  <span>{p.full_name}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    );
                    if (c === 'department') return (
                      <TableCell key={c} onClick={stop} onPointerDown={stop}>
                        {t.department ? <DepartmentBadge department={t.department} stopPropagation /> : <span className="text-muted-foreground text-xs">—</span>}
                      </TableCell>
                    );
                    if (c === 'project') return <TableCell key={c} className="text-sm text-muted-foreground">{projectName(t.project_id)}</TableCell>;
                    return null;
                  })}
                </TableRow>
              );
            })}
          </>
        ))}
      </TableBody>
    </Table>
  );
}

function ListLayout({ tasks, groupBy, projectName, onItemClick }: {
  tasks: any[]; groupBy: ViewGroupBy; projectName: (id: string | null) => string;
  onItemClick: (id: string) => void;
}) {
  const groups = useMemo(() => groupTasks(tasks, groupBy, projectName), [tasks, groupBy, projectName]);
  if (tasks.length === 0) return <EmptyHint>Sem tarefas.</EmptyHint>;
  return (
    <div className="space-y-3">
      {groups.map(g => (
        <div key={g.key} className="space-y-2">
          {groupBy !== 'none' && (
            <div className="flex items-center gap-2 px-1 text-xs font-semibold text-foreground/80">
              {g.label} <span className="text-muted-foreground tabular-nums">· {g.items.length}</span>
            </div>
          )}
          {g.items.map((t: any) => {
            const si = getTaskStatusInfo(t.status);
            const pi = getTaskPriorityInfo(t.priority);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onItemClick(t.id)}
                className="w-full text-left rounded-xl border bg-card p-3 hover:shadow-card transition-shadow flex items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className={cn('text-sm font-medium truncate', isTaskDone(t) && 'line-through text-muted-foreground')}>{t.name}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {projectName(t.project_id) || 'Sem projeto'}
                    {t.deadline && <> · {format(parseISO(t.deadline), 'dd/MM/yyyy')}</>}
                  </div>
                </div>
                <Badge variant="outline" className={cn('text-[10px] shrink-0', pi.color)}>{pi.short}</Badge>
                <Badge variant="outline" className={cn('text-[10px] shrink-0', si.color)}>{si.label}</Badge>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function BoardLayout({ tasks, groupBy, projectName, onItemClick }: {
  tasks: any[]; groupBy: ViewGroupBy; projectName: (id: string | null) => string;
  onItemClick: (id: string) => void;
}) {
  const groups = useMemo(() => groupTasks(tasks, groupBy, projectName), [tasks, groupBy, projectName]);
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {groups.map(g => (
        <div key={g.key} className="rounded-2xl bg-muted/30 p-3 flex flex-col min-h-[160px]">
          <div className="flex items-center justify-between px-1 pb-3">
            <span className="text-xs font-semibold text-foreground/90 truncate">{g.label}</span>
            <span className="text-[11px] font-medium text-muted-foreground tabular-nums">{g.items.length}</span>
          </div>
          <div className="flex-1 space-y-2 max-h-[60vh] overflow-y-auto">
            {g.items.length === 0 && <p className="text-xs text-muted-foreground/70 text-center py-4">—</p>}
            {g.items.map((t: any) => {
              const pi = getTaskPriorityInfo(t.priority);
              return (
                <div key={t.id} onClick={() => onItemClick(t.id)}
                  className="rounded-xl bg-background p-2.5 shadow-card hover:shadow-elevated transition-shadow cursor-pointer">
                  <div className={cn('text-sm font-medium', isTaskDone(t) && 'line-through text-muted-foreground')}>{t.name}</div>
                  <div className="flex items-center justify-between mt-1.5 gap-2">
                    <Badge variant="outline" className={cn('text-[10px]', pi.color)}>{pi.short}</Badge>
                    {t.deadline && <span className="text-[10px] text-muted-foreground">{format(parseISO(t.deadline), 'dd/MM')}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── View editor ──────────────────────────────────────────────────────────────

function ViewEditorDialog({
  open, onClose, existing, projects, onSave, onDelete,
}: {
  open: boolean; onClose: () => void;
  existing?: CustomView; projects: { id: string; name: string }[];
  onSave: (v: { name: string; layout: ViewLayout; columns: ViewColumn[]; filters: ViewFilters; group_by: ViewGroupBy; sort_by: ViewSort }) => Promise<void>;
  onDelete?: () => Promise<void>;
}) {
  const [name, setName] = useState(existing?.name || '');
  const [layout, setLayout] = useState<ViewLayout>(existing?.layout || 'table');
  const [columns, setColumns] = useState<ViewColumn[]>(existing?.columns?.length ? existing.columns : DEFAULT_COLUMNS);
  const [groupBy, setGroupBy] = useState<ViewGroupBy>(existing?.group_by || 'none');
  const [sortBy, setSortBy] = useState<ViewSort>(existing?.sort_by || 'deadline_asc');
  const [filters, setFilters] = useState<ViewFilters>(existing?.filters || {});

  const toggleCol = (c: ViewColumn) => {
    setColumns(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
  };
  const toggleArr = <T extends string>(arr: T[] | undefined, v: T): T[] => {
    const cur = arr || [];
    return cur.includes(v) ? cur.filter(x => x !== v) : [...cur, v];
  };

  const submit = async () => {
    if (!name.trim()) { toast.error('Dá um nome à vista'); return; }
    if (columns.length === 0) { toast.error('Escolhe pelo menos uma coluna'); return; }
    await onSave({ name: name.trim(), layout, columns, filters, group_by: groupBy, sort_by: sortBy });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{existing ? 'Editar vista' : 'Nova vista personalizada'}</DialogTitle>
          <DialogDescription>Personaliza layout, colunas, filtros e ordenação.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Urgentes do projeto X" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Layout</Label>
              <Select value={layout} onValueChange={(v) => setLayout(v as ViewLayout)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="table">Tabela</SelectItem>
                  <SelectItem value="list">Lista</SelectItem>
                  <SelectItem value="board">Board (Kanban)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Agrupar por</Label>
              <Select value={groupBy} onValueChange={(v) => setGroupBy(v as ViewGroupBy)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem agrupamento</SelectItem>
                  <SelectItem value="status">Status</SelectItem>
                  <SelectItem value="priority">Prioridade</SelectItem>
                  <SelectItem value="project">Projeto</SelectItem>
                  <SelectItem value="deadline">Prazo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Ordenar por</Label>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as ViewSort)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="deadline_asc">Prazo (mais próximo)</SelectItem>
                <SelectItem value="deadline_desc">Prazo (mais distante)</SelectItem>
                <SelectItem value="priority_desc">Prioridade (mais alta primeiro)</SelectItem>
                <SelectItem value="priority_asc">Prioridade (mais baixa primeiro)</SelectItem>
                <SelectItem value="name_asc">Nome (A→Z)</SelectItem>
                <SelectItem value="name_desc">Nome (Z→A)</SelectItem>
                <SelectItem value="recent">Mais recente</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {layout === 'table' && (
            <div className="space-y-2">
              <Label>Colunas visíveis</Label>
              <div className="flex flex-wrap gap-2">
                {ALL_COLUMNS.map(c => {
                  const active = columns.includes(c.key);
                  return (
                    <button key={c.key} type="button" onClick={() => toggleCol(c.key)}
                      className={cn('text-xs rounded-full px-3 py-1 border transition-colors',
                        active ? 'bg-primary text-primary-foreground border-primary'
                               : 'bg-background text-foreground/80 border-border hover:border-foreground/40')}>
                      {c.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="border-t pt-4 space-y-4">
            <Label className="text-sm font-semibold">Filtros</Label>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Pesquisar no nome</Label>
              <Input value={filters.search || ''} onChange={(e) => setFilters({ ...filters, search: e.target.value })} placeholder="texto a procurar..." />
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Estado de conclusão</Label>
              <div className="flex flex-wrap gap-2">
                {([
                  { v: 'all', l: 'Tudo' },
                  { v: 'pending', l: 'Pendentes' },
                  { v: 'done', l: 'Feitas' },
                ] as const).map(opt => {
                  const cur = filters.completion || 'all';
                  const active = cur === opt.v;
                  return (
                    <button key={opt.v} type="button"
                      onClick={() => setFilters({ ...filters, completion: opt.v })}
                      className={cn('text-xs rounded-full px-3 py-1 border transition-colors',
                        active ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border hover:border-foreground/40')}>
                      {opt.l}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Status</Label>
              <div className="flex flex-wrap gap-2">
                {TASK_STATUSES.map(s => {
                  const active = filters.statuses?.includes(s.value);
                  return (
                    <button key={s.value} type="button"
                      onClick={() => setFilters({ ...filters, statuses: toggleArr(filters.statuses, s.value) })}
                      className={cn('text-xs rounded-full px-3 py-1 border transition-colors',
                        active ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border hover:border-foreground/40')}>
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Prioridade</Label>
              <div className="flex flex-wrap gap-2">
                {TASK_PRIORITIES.map(p => {
                  const active = filters.priorities?.includes(p.value);
                  return (
                    <button key={p.value} type="button"
                      onClick={() => setFilters({ ...filters, priorities: toggleArr(filters.priorities, p.value) })}
                      className={cn('text-xs rounded-full px-3 py-1 border transition-colors',
                        active ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border hover:border-foreground/40')}>
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Prazo</Label>
              <div className="flex flex-wrap gap-2">
                {([
                  { v: 'all', l: 'Qualquer' },
                  { v: 'overdue', l: 'Atrasadas' },
                  { v: 'today', l: 'Hoje' },
                  { v: 'week', l: 'Próx. 7 dias' },
                  { v: 'no_deadline', l: 'Sem prazo' },
                ] as const).map(opt => {
                  const cur = filters.deadlineWindow || 'all';
                  const active = cur === opt.v;
                  return (
                    <button key={opt.v} type="button"
                      onClick={() => setFilters({ ...filters, deadlineWindow: opt.v })}
                      className={cn('text-xs rounded-full px-3 py-1 border transition-colors',
                        active ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border hover:border-foreground/40')}>
                      {opt.l}
                    </button>
                  );
                })}
              </div>
            </div>

            {projects.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Projetos</Label>
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                  {projects.map(p => {
                    const active = filters.projectIds?.includes(p.id);
                    return (
                      <button key={p.id} type="button"
                        onClick={() => setFilters({ ...filters, projectIds: toggleArr(filters.projectIds, p.id) })}
                        className={cn('text-xs rounded-full px-3 py-1 border transition-colors',
                          active ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border hover:border-foreground/40')}>
                        {p.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between gap-2 sm:justify-between">
          {onDelete ? (
            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={onDelete}>
              <Trash2 className="h-4 w-4 mr-1" /> Apagar vista
            </Button>
          ) : <div />}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={submit}><Save className="h-4 w-4 mr-1" /> Guardar</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}