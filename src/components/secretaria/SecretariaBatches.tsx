import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChevronDown, Clock, Layers, Target, AlertTriangle, CalendarPlus, Loader2, Play, X, Check, SkipForward } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { format, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';
import { useMyTasks } from '@/components/secretaria/secretaria-shared';
import { isTaskOpen, getTaskPriorityInfo } from '@/lib/taskStatus';
import { cn } from '@/lib/utils';

type GroupKey = 'cliente' | 'projeto' | 'area';

interface Batch {
  key: string;
  label: string;
  scopeType: GroupKey;
  scopeId: string | null; // null = "Sem contexto"
  tasks: any[];           // user's open tasks in this scope
  totalMinutes: number;
  earliestDeadline: string | null;
  contextHref?: string;
}

const DEFAULT_MINUTES_PER_TASK = 30;

function estimateMinutes(t: any): number {
  if (typeof t.estimated_minutes === 'number' && t.estimated_minutes > 0) return t.estimated_minutes;
  if (typeof t.estimated_time === 'number' && t.estimated_time > 0) return Math.round(t.estimated_time * 60);
  return DEFAULT_MINUTES_PER_TASK;
}

function formatDuration(mins: number): string {
  if (mins < 60) return `${mins}min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${h}h`;
}

export default function SecretariaBatches() {
  const navigate = useNavigate();
  const tasksQ = useMyTasks();
  const [groupBy, setGroupBy] = useState<GroupKey>('cliente');
  const [activeSession, setActiveSession] = useState<Batch | null>(null);

  // Open tasks only
  const openTasks = useMemo(
    () => (tasksQ.data || []).filter((t: any) => isTaskOpen(t)),
    [tasksQ.data]
  );

  // Lookup maps for client/project labels
  const clientIds = useMemo(
    () => Array.from(new Set(openTasks.map((t: any) => t.client_id).filter(Boolean))) as string[],
    [openTasks]
  );
  const projectIds = useMemo(
    () => Array.from(new Set(openTasks.map((t: any) => t.project_id).filter(Boolean))) as string[],
    [openTasks]
  );

  const clientsQ = useQuery({
    queryKey: ['batches-clients', clientIds.sort().join(',')],
    enabled: clientIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from('clients').select('id, full_name').in('id', clientIds);
      const map: Record<string, string> = {};
      (data || []).forEach((c: any) => { map[c.id] = c.full_name; });
      return map;
    },
  });

  const projectsQ = useQuery({
    queryKey: ['batches-projects', projectIds.sort().join(',')],
    enabled: projectIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from('projects').select('id, name').in('id', projectIds);
      const map: Record<string, string> = {};
      (data || []).forEach((p: any) => { map[p.id] = p.name; });
      return map;
    },
  });

  // Build batches based on grouping
  const batches: Batch[] = useMemo(() => {
    const map = new Map<string, Batch>();
    const clients = clientsQ.data || {};
    const projects = projectsQ.data || {};

    for (const t of openTasks) {
      let key = '__sem_contexto__';
      let label = 'Sem contexto';
      let href: string | undefined;
      let scopeId: string | null = null;

      if (groupBy === 'cliente') {
        if (t.client_id) {
          key = `c:${t.client_id}`;
          label = clients[t.client_id] || 'Cliente';
          href = `/hub/clientes/${t.client_id}`;
          scopeId = t.client_id;
        } else {
          key = '__sem_cliente__';
          label = 'Sem cliente';
        }
      } else if (groupBy === 'projeto') {
        if (t.project_id) {
          key = `p:${t.project_id}`;
          label = projects[t.project_id] || 'Projeto';
          href = `/hub/projetos/${t.project_id}`;
          scopeId = t.project_id;
        } else {
          key = '__sem_projeto__';
          label = 'Sem projeto';
        }
      } else {
        key = `a:${t.department || '__sem__'}`;
        label = t.department
          ? t.department.charAt(0).toUpperCase() + t.department.slice(1)
          : 'Sem área';
        scopeId = t.department || null;
      }

      let batch = map.get(key);
      if (!batch) {
        batch = { key, label, scopeType: groupBy, scopeId, tasks: [], totalMinutes: 0, earliestDeadline: null, contextHref: href };
        map.set(key, batch);
      }
      batch.tasks.push(t);
      batch.totalMinutes += estimateMinutes(t);
      if (t.deadline) {
        if (!batch.earliestDeadline || t.deadline < batch.earliestDeadline) {
          batch.earliestDeadline = t.deadline;
        }
      }
    }

    // Sort: by earliest deadline first, fallback by size desc
    return Array.from(map.values()).sort((a, b) => {
      if (a.earliestDeadline && b.earliestDeadline) {
        return a.earliestDeadline.localeCompare(b.earliestDeadline);
      }
      if (a.earliestDeadline) return -1;
      if (b.earliestDeadline) return 1;
      return b.tasks.length - a.tasks.length;
    });
  }, [openTasks, groupBy, clientsQ.data, projectsQ.data]);

  const totalContexts = batches.length;
  const totalTasks = openTasks.length;
  const fragmented = totalContexts >= 5 && totalTasks >= 8;

  function scheduleBlock(batch: Batch) {
    // Suggest next free hour (today 9h or now+1h, whichever later)
    const now = new Date();
    const start = new Date(now);
    start.setMinutes(0, 0, 0);
    start.setHours(start.getHours() + 1);
    const end = new Date(start.getTime() + batch.totalMinutes * 60 * 1000);

    const params = new URLSearchParams({
      title: `🎯 Foco: ${batch.label} (${batch.tasks.length} tarefas)`,
      start: start.toISOString(),
      end: end.toISOString(),
      type: 'foco',
    });
    navigate(`/hub/agenda?${params.toString()}`);
  }

  if (tasksQ.isLoading) {
    return <div className="text-sm text-muted-foreground">A carregar batches…</div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Layers className="h-5 w-5 text-primary" />
          Modo Foco — Batching
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Escolhe um contexto e entra em sessão de deep-work — uma tarefa de cada vez, sem distrações.
        </p>
      </div>

      {/* Fragmentation alert */}
      {fragmented && (
        <Card className="border-warning/40 bg-warning/5">
          <CardContent className="flex items-start gap-3 py-3">
            <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
            <div className="text-sm">
              <strong>Dia fragmentado:</strong> tens {totalTasks} tarefas espalhadas por {totalContexts} contextos diferentes. Considera fazer batching para ganhar foco.
            </div>
          </CardContent>
        </Card>
      )}

      {/* Group selector */}
      <Tabs value={groupBy} onValueChange={(v) => setGroupBy(v as GroupKey)}>
        <TabsList>
          <TabsTrigger value="cliente">Por Cliente</TabsTrigger>
          <TabsTrigger value="projeto">Por Projeto</TabsTrigger>
          <TabsTrigger value="area">Por Área</TabsTrigger>
        </TabsList>

        <TabsContent value={groupBy} className="mt-4 space-y-3">
          {batches.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                Sem tarefas em aberto para agrupar. 🎉
              </CardContent>
            </Card>
          ) : (
            batches.map((batch) => (
              <BatchCard
                key={batch.key}
                batch={batch}
                onSchedule={() => scheduleBlock(batch)}
                onStartSession={() => setActiveSession(batch)}
              />
            ))
          )}
        </TabsContent>
      </Tabs>

      <FocusSessionDialog
        batch={activeSession}
        open={!!activeSession}
        onClose={() => setActiveSession(null)}
      />
    </div>
  );
}

function PriorityBadge({ priority }: { priority?: string | null }) {
  if (!priority) return <Badge variant="outline" className="text-[10px] py-0 px-1.5">—</Badge>;
  const info = getTaskPriorityInfo(priority);
  return (
    <Badge variant="outline" className={cn('text-[10px] py-0 px-1.5 border', info.color)}>
      {info.short}
    </Badge>
  );
}

function PriorityCounts({ tasks }: { tasks: any[] }) {
  const counts = { alta: 0, media: 0, baixa: 0 } as Record<string, number>;
  for (const t of tasks) {
    const p = (t.priority as string) || 'media';
    if (counts[p] != null) counts[p]++;
  }
  const items: Array<{ key: string; n: number }> = [
    { key: 'alta', n: counts.alta },
    { key: 'media', n: counts.media },
    { key: 'baixa', n: counts.baixa },
  ].filter((x) => x.n > 0);
  if (items.length === 0) return null;
  return (
    <div className="flex items-center gap-1">
      {items.map((it) => {
        const info = getTaskPriorityInfo(it.key);
        return (
          <Badge
            key={it.key}
            variant="outline"
            className={cn('text-[10px] py-0 px-1.5 border gap-1', info.color)}
            title={info.label}
          >
            {info.short} · {it.n}
          </Badge>
        );
      })}
    </div>
  );
}

/**
 * Fetch ALL items related to the scope (not just user's open tasks):
 * - tasks (any assignee, any status)
 * - meetings (linked via project_id or client_id)
 * - project deliverables (when scope = projeto)
 */
function useScopeFullContext(batch: Batch, enabled: boolean) {
  return useQuery({
    queryKey: ['batch-scope', batch.scopeType, batch.scopeId],
    enabled: enabled && !!batch.scopeId,
    queryFn: async () => {
      const out: { tasks: any[]; meetings: any[]; deliverables: any[] } = { tasks: [], meetings: [], deliverables: [] };

      // Tasks
      let tQ = supabase.from('tasks').select('id, name, status, priority, deadline, assigned_to, project_id, client_id, department').order('deadline', { nullsFirst: false } as any);
      if (batch.scopeType === 'cliente') tQ = tQ.eq('client_id', batch.scopeId!);
      else if (batch.scopeType === 'projeto') tQ = tQ.eq('project_id', batch.scopeId!);
      else tQ = tQ.eq('department', batch.scopeId!);
      const { data: tasks } = await tQ;
      out.tasks = tasks || [];

      // Meetings (only meaningful for cliente / projeto)
      if (batch.scopeType === 'cliente') {
        const { data: meets } = await supabase.from('meetings').select('id, title, date_time, status').eq('client_id', batch.scopeId!).order('date_time', { ascending: false }).limit(50);
        out.meetings = meets || [];
      } else if (batch.scopeType === 'projeto') {
        const { data: meets } = await supabase.from('meetings').select('id, title, date_time, status').eq('project_id', batch.scopeId!).order('date_time', { ascending: false }).limit(50);
        out.meetings = meets || [];

        // Deliverables for project
        const { data: phases } = await supabase.from('project_phases').select('id, name').eq('project_id', batch.scopeId!);
        const phaseIds = (phases || []).map((p: any) => p.id);
        if (phaseIds.length > 0) {
          const { data: dels } = await supabase.from('project_deliverables').select('id, name, status, planned_end, phase_id').in('phase_id', phaseIds).order('sort_order');
          const phaseMap: Record<string, string> = {};
          (phases || []).forEach((p: any) => { phaseMap[p.id] = p.name; });
          out.deliverables = (dels || []).map((d: any) => ({ ...d, phase_name: phaseMap[d.phase_id] }));
        }
      }

      return out;
    },
  });
}

function BatchCard({ batch, onSchedule, onStartSession }: { batch: Batch; onSchedule: () => void; onStartSession: () => void }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const fullCtx = useScopeFullContext(batch, open);

  const allTasks = fullCtx.data?.tasks || batch.tasks;
  const meetings = fullCtx.data?.meetings || [];
  const deliverables = fullCtx.data?.deliverables || [];

  return (
    <Card className="hq-card hq-transition">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="h-4 w-4 text-primary shrink-0" />
              {batch.contextHref ? (
                <button
                  className="truncate hover:underline text-left"
                  onClick={() => navigate(batch.contextHref!)}
                >
                  {batch.label}
                </button>
              ) : (
                <span className="truncate">{batch.label}</span>
              )}
            </CardTitle>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <Badge variant="secondary" className="text-[10px]">
                {batch.tasks.length} {batch.tasks.length === 1 ? 'tarefa minha' : 'tarefas minhas'}
              </Badge>
              <PriorityCounts tasks={batch.tasks} />
              <Badge variant="outline" className="text-[10px] gap-1">
                <Clock className="h-3 w-3" />
                {formatDuration(batch.totalMinutes)}
              </Badge>
              {batch.earliestDeadline && (
                <Badge variant="outline" className="text-[10px]">
                  Próxima: {format(parseISO(batch.earliestDeadline), 'd MMM', { locale: pt })}
                </Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={onSchedule} className="gap-1.5">
              <CalendarPlus className="h-3.5 w-3.5" />
              Agendar
            </Button>
            <Button size="sm" onClick={onStartSession} className="gap-1.5">
              <Play className="h-3.5 w-3.5" />
              Iniciar sessão
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <Collapsible open={open} onOpenChange={setOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 px-2">
              <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />
              {open ? 'Esconder contexto' : 'Expandir tudo deste contexto'}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3 space-y-4">
            {fullCtx.isLoading ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground py-3">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                A carregar contexto completo…
              </div>
            ) : (
              <>
                {/* Tasks table */}
                <div>
                  <p className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wide">
                    Tarefas ({allTasks.length})
                  </p>
                  {allTasks.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">Sem tarefas.</p>
                  ) : (
                    <div className="rounded-md border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">Tarefa</TableHead>
                            <TableHead className="text-xs w-20">Estado</TableHead>
                            <TableHead className="text-xs w-16">Prio</TableHead>
                            <TableHead className="text-xs w-24">Deadline</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {allTasks.map((t: any) => (
                            <TableRow
                              key={t.id}
                              className="cursor-pointer"
                              onClick={() => navigate(`/hub/tarefas?task=${t.id}`)}
                            >
                              <TableCell className="text-sm font-medium">{t.name}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-[10px]">
                                  {t.status || '—'}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <PriorityBadge priority={t.priority} />
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {t.deadline ? format(parseISO(t.deadline), 'd MMM yyyy', { locale: pt }) : '—'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>

                {/* Meetings */}
                {meetings.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wide">
                      Reuniões ({meetings.length})
                    </p>
                    <div className="rounded-md border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">Título</TableHead>
                            <TableHead className="text-xs w-32">Data</TableHead>
                            <TableHead className="text-xs w-24">Estado</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {meetings.map((m: any) => (
                            <TableRow
                              key={m.id}
                              className="cursor-pointer"
                              onClick={() => navigate(`/hub/reunioes/${m.id}`)}
                            >
                              <TableCell className="text-sm font-medium">{m.title}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {m.date_time ? format(parseISO(m.date_time), 'd MMM yyyy HH:mm', { locale: pt }) : '—'}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-[10px]">{m.status || '—'}</Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                {/* Deliverables (project scope) */}
                {deliverables.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wide">
                      Entregas ({deliverables.length})
                    </p>
                    <div className="rounded-md border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">Entrega</TableHead>
                            <TableHead className="text-xs w-32">Fase</TableHead>
                            <TableHead className="text-xs w-24">Estado</TableHead>
                            <TableHead className="text-xs w-24">Data</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {deliverables.map((d: any) => (
                            <TableRow key={d.id}>
                              <TableCell className="text-sm font-medium">{d.name}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">{d.phase_name || '—'}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-[10px]">{d.status || '—'}</Badge>
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {d.planned_end ? format(parseISO(d.planned_end), 'd MMM', { locale: pt }) : '—'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </>
            )}
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}

/**
 * Fullscreen deep-work session: shows ONE task at a time from the batch.
 * Actions: Concluir | Saltar | Sair. Progress bar no topo.
 */
function FocusSessionDialog({
  batch,
  open,
  onClose,
}: {
  batch: Batch | null;
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [idx, setIdx] = useState(0);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [skippedIds, setSkippedIds] = useState<Set<string>>(new Set());

  // Reset when opening a new batch
  useEffect(() => {
    setIdx(0);
    setCompletedIds(new Set());
    setSkippedIds(new Set());
  }, [batch?.key]);

  const tasks = batch?.tasks || [];
  const total = tasks.length;
  const current = tasks[idx];

  async function markDone(taskId: string) {
    const { error } = await supabase
      .from('tasks')
      .update({ status: 'done' } as any)
      .eq('id', taskId);
    if (error) {
      console.error(error);
      toast.error('Não foi possível marcar como concluída');
      return;
    }
    setCompletedIds((s) => new Set(s).add(taskId));
    // Invalidate all task-related queries so tables/KPIs/deliverables refresh
    queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
    queryClient.invalidateQueries({ queryKey: ['unified-responsibilities'] });
    queryClient.invalidateQueries({ queryKey: ['batch-scope'] });
    queryClient.invalidateQueries({ queryKey: ['project-deliverables'] });
    next();
  }

  function skip(taskId: string) {
    setSkippedIds((s) => new Set(s).add(taskId));
    next();
  }

  function next() {
    if (idx + 1 < total) setIdx(idx + 1);
    else setIdx(total); // finished
  }

  if (!batch) return null;
  const finished = idx >= total;
  const progressPct = total > 0 ? Math.round(((completedIds.size + skippedIds.size) / total) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3 border-b">
          <div className="flex items-center gap-2 min-w-0">
            <Target className="h-4 w-4 text-primary shrink-0" />
            <span className="text-sm font-semibold truncate">{batch.label}</span>
            <Badge variant="secondary" className="text-[10px]">
              {Math.min(idx + 1, total)} / {total}
            </Badge>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <Progress value={progressPct} className="h-1 rounded-none" />

        {/* Body */}
        <div className="px-6 py-10 min-h-[280px] flex flex-col items-center justify-center text-center">
          {finished ? (
            <div className="space-y-3">
              <div className="text-4xl">🎯</div>
              <h3 className="text-xl font-semibold">Sessão concluída</h3>
              <p className="text-sm text-muted-foreground">
                {completedIds.size} concluídas · {skippedIds.size} saltadas
              </p>
              <Button onClick={onClose} className="mt-4">Fechar</Button>
            </div>
          ) : current ? (
            <div className="space-y-4 w-full">
              <p className="eyebrow">A trabalhar em</p>
              <h3 className="text-2xl font-semibold leading-tight">{current.name}</h3>
              <div className="flex items-center justify-center gap-2 flex-wrap">
                <PriorityBadge priority={current.priority} />
                {current.deadline && (
                  <Badge variant="outline" className="text-[10px]">
                    Deadline: {format(parseISO(current.deadline), 'd MMM', { locale: pt })}
                  </Badge>
                )}
                <Badge variant="outline" className="text-[10px] gap-1">
                  <Clock className="h-3 w-3" />
                  ~{formatDuration(estimateMinutes(current))}
                </Badge>
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer actions */}
        {!finished && current && (
          <div className="flex items-center justify-between gap-2 px-6 py-3 border-t bg-muted/30">
            <Button variant="ghost" size="sm" onClick={() => skip(current.id)} className="gap-1.5">
              <SkipForward className="h-4 w-4" />
              Saltar
            </Button>
            <Button size="sm" onClick={() => markDone(current.id)} className="gap-1.5">
              <Check className="h-4 w-4" />
              Concluir e seguir
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}