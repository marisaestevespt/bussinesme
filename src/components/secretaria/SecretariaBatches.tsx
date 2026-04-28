import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChevronDown, Clock, Layers, Target, AlertTriangle, CalendarPlus, Loader2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';
import { useMyTasks } from '@/components/secretaria/secretaria-shared';
import { isTaskOpen } from '@/lib/taskStatus';
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
          Blocos de Foco (Batching)
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Agrupa tarefas semelhantes em blocos contínuos para reduzir custo de troca de contexto.
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
              <BatchCard key={batch.key} batch={batch} onSchedule={() => scheduleBlock(batch)} />
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function BatchCard({ batch, onSchedule }: { batch: Batch; onSchedule: () => void }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <Card className="hq-card hq-transition">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="h-4 w-4 text-primary shrink-0" />
              <span className="truncate">{batch.label}</span>
            </CardTitle>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <Badge variant="secondary" className="text-[10px]">
                {batch.tasks.length} {batch.tasks.length === 1 ? 'tarefa' : 'tarefas'}
              </Badge>
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
          <Button size="sm" onClick={onSchedule} className="gap-1.5">
            <CalendarPlus className="h-3.5 w-3.5" />
            Agendar bloco
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <Collapsible open={open} onOpenChange={setOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 px-2">
              <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />
              {open ? 'Esconder tarefas' : 'Ver tarefas'}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 space-y-1">
            {batch.tasks.map((t) => (
              <button
                key={t.id}
                onClick={() => navigate(`/hub/tarefas?task=${t.id}`)}
                className="w-full flex items-center justify-between gap-2 text-left text-sm rounded-md px-2 py-1.5 hover:bg-muted/60 transition-colors"
              >
                <span className="truncate">{t.name}</span>
                <div className="flex items-center gap-2 shrink-0">
                  {t.priority && (
                    <Badge variant="outline" className="text-[9px] py-0 px-1.5">
                      {t.priority === 'alta' ? 'P1' : t.priority === 'media' ? 'P2' : 'P3'}
                    </Badge>
                  )}
                  {t.deadline && (
                    <span className="text-[10px] text-muted-foreground">
                      {format(parseISO(t.deadline), 'd MMM', { locale: pt })}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}