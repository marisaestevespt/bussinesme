import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { TrendingUp, TrendingDown, AlertTriangle, Clock, Activity, Sparkles } from 'lucide-react';
import { EmptyHint, InlineLoader } from '@/components/ui/loading-skeletons';

function formatHours(min: number): string {
  if (!min || min < 0) return '0h';
  const h = min / 60;
  if (h < 10) return `${h.toFixed(1)}h`;
  return `${Math.round(h)}h`;
}

interface ProjectHealth {
  id: string;
  name: string;
  client_name: string | null;
  status: string;
  estimated_minutes: number;
  real_minutes: number;
  task_count: number;
  tasks_with_estimate: number;
  variance_pct: number | null;
}

export function OperacaoAnaliseTab() {
  const { data: projectHealths = [], isLoading } = useQuery<ProjectHealth[]>({
    queryKey: ['operacao-analise-projects'],
    queryFn: async () => {
      const { data: projects } = await supabase
        .from('projects')
        .select('id, name, status, client_id, clients!projects_client_id_fkey(full_name)')
        .not('status', 'in', '(concluido,cancelado)')
        .is('archived_at', null)
        .limit(200);
      if (!projects?.length) return [];
      const projectIds = projects.map((p: any) => p.id);

      const { data: deliverables } = await supabase
        .from('project_deliverables')
        .select('id, project_id, estimated_minutes')
        .in('project_id', projectIds);

      const { data: tasks } = await supabase
        .from('tasks')
        .select('id, project_id, estimated_minutes, deliverable_id')
        .in('project_id', projectIds);

      const taskIds = (tasks || []).map((t: any) => t.id);
      const { data: timeEntries } = taskIds.length
        ? await supabase
            .from('task_time_entries')
            .select('task_id, duration_minutes, ended_at, is_manual')
            .in('task_id', taskIds)
        : { data: [] };

      const realByTask = new Map<string, number>();
      (timeEntries || []).forEach((e: any) => {
        if (e.ended_at || e.is_manual) {
          realByTask.set(e.task_id, (realByTask.get(e.task_id) || 0) + (e.duration_minutes || 0));
        }
      });

      return projects.map((p: any) => {
        const projDeliv = (deliverables || []).filter((d: any) => d.project_id === p.id);
        const projTasks = (tasks || []).filter((t: any) => t.project_id === p.id);
        const estFromDeliv = projDeliv.reduce((s: number, d: any) => s + (d.estimated_minutes || 0), 0);
        const standaloneTasks = projTasks.filter((t: any) => !t.deliverable_id);
        const estFromStandalone = standaloneTasks.reduce((s: number, t: any) => s + (t.estimated_minutes || 0), 0);
        const estimated = estFromDeliv + estFromStandalone;
        const real = projTasks.reduce((s: number, t: any) => s + (realByTask.get(t.id) || 0), 0);
        const tasksWithEstimate = projTasks.filter((t: any) => (t.estimated_minutes || 0) > 0).length;
        const variance_pct = estimated > 0 ? ((real - estimated) / estimated) * 100 : null;
        return {
          id: p.id,
          name: p.name,
          client_name: (p.clients as any)?.full_name || null,
          status: p.status,
          estimated_minutes: estimated,
          real_minutes: real,
          task_count: projTasks.length,
          tasks_with_estimate: tasksWithEstimate,
          variance_pct,
        };
      });
    },
  });

  const { withData, problematic, capacityAlert } = useMemo(() => {
    const withData = projectHealths.filter(p => p.estimated_minutes > 0 || p.real_minutes > 0);
    const problematic = withData
      .filter(p => p.variance_pct != null && p.variance_pct > 10)
      .sort((a, b) => (b.variance_pct || 0) - (a.variance_pct || 0))
      .slice(0, 5);
    const overBudgetCount = withData.filter(p => (p.variance_pct ?? 0) > 25).length;
    return {
      withData,
      problematic,
      capacityAlert: overBudgetCount >= 2,
    };
  }, [projectHealths]);

  return (
    <div className="space-y-6">
      {capacityAlert && (
        <Alert className="border-warning/40 bg-warning/5">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <AlertTitle className="text-warning">Sinal de capacidade</AlertTitle>
          <AlertDescription className="text-sm">
            Tens projetos consecutivos a estourar o tempo previsto em mais de 25%. Pode ser hora de
            rever as estimativas, redistribuir trabalho — ou considerar contratar.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground flex items-center gap-2">
              <Activity className="h-3.5 w-3.5" /> Projetos ativos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{projectHealths.length}</p>
            <p className="text-[11px] text-muted-foreground">{withData.length} com dados de tempo</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground flex items-center gap-2">
              <Clock className="h-3.5 w-3.5" /> Total horas previstas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatHours(withData.reduce((s, p) => s + p.estimated_minutes, 0))}
            </p>
            <p className="text-[11px] text-muted-foreground">
              Real: {formatHours(withData.reduce((s, p) => s + p.real_minutes, 0))}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="h-3.5 w-3.5" /> Projetos em estouro
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-destructive">{problematic.length}</p>
            <p className="text-[11px] text-muted-foreground">Acima de 10% do previsto</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-destructive" /> Top projetos a estourar horas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <InlineLoader />
          ) : problematic.length === 0 ? (
            <EmptyHint>
              Tudo dentro do previsto. {withData.length === 0 && '(Define tempo estimado nas entregas dos teus produtos para começar a ver dados aqui.)'}
            </EmptyHint>
          ) : (
            <div className="space-y-3">
              {problematic.map(p => {
                const variance = p.variance_pct || 0;
                const severity = variance > 50 ? 'destructive' : variance > 25 ? 'warning' : 'default';
                return (
                  <Link
                    key={p.id}
                    to={`/hub/projetos/${p.id}`}
                    className="block rounded-lg border p-3 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{p.name}</p>
                        {p.client_name && (
                          <p className="text-[11px] text-muted-foreground truncate">{p.client_name}</p>
                        )}
                      </div>
                      <Badge
                        variant={severity === 'destructive' ? 'destructive' : 'outline'}
                        className={severity === 'warning' ? 'border-warning text-warning' : ''}
                      >
                        +{Math.round(variance)}%
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground tabular-nums">
                      <span>Previsto: {formatHours(p.estimated_minutes)}</span>
                      <span>Real: <span className="text-foreground font-medium">{formatHours(p.real_minutes)}</span></span>
                    </div>
                    <Progress
                      value={Math.min(100, (p.real_minutes / Math.max(1, p.estimated_minutes)) * 100)}
                      className="h-1.5 mt-2"
                    />
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="h-4 w-4" /> Saúde de horas dos projetos ativos
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <InlineLoader />
          ) : withData.length === 0 ? (
            <div className="text-center py-8 space-y-2">
              <Sparkles className="h-8 w-8 mx-auto text-muted-foreground/40" />
              <EmptyHint>Ainda não há dados de tempo para analisar.</EmptyHint>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                Define o tempo estimado nas entregas dos teus produtos. Quando os projetos arrancam,
                esse tempo acompanha as tarefas e podes comparar com o tempo real registado pelos timers.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-2 font-medium">Projeto</th>
                    <th className="py-2 px-2 font-medium text-right">Previsto</th>
                    <th className="py-2 px-2 font-medium text-right">Real</th>
                    <th className="py-2 px-2 font-medium text-right">Desvio</th>
                    <th className="py-2 pl-2 font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {withData
                    .slice()
                    .sort((a, b) => (b.variance_pct ?? -999) - (a.variance_pct ?? -999))
                    .map(p => {
                      const variance = p.variance_pct;
                      const color =
                        variance == null
                          ? 'text-muted-foreground'
                          : variance > 25
                          ? 'text-destructive font-semibold'
                          : variance > 10
                          ? 'text-warning'
                          : variance < -10
                          ? 'text-success'
                          : 'text-muted-foreground';
                      return (
                        <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="py-2 pr-2">
                            <Link to={`/hub/projetos/${p.id}`} className="hover:text-primary">
                              <div className="font-medium">{p.name}</div>
                              {p.client_name && (
                                <div className="text-[10px] text-muted-foreground">{p.client_name}</div>
                              )}
                            </Link>
                          </td>
                          <td className="py-2 px-2 text-right tabular-nums">
                            {p.estimated_minutes > 0 ? formatHours(p.estimated_minutes) : '—'}
                          </td>
                          <td className="py-2 px-2 text-right tabular-nums">
                            {p.real_minutes > 0 ? formatHours(p.real_minutes) : '—'}
                          </td>
                          <td className={`py-2 px-2 text-right tabular-nums ${color}`}>
                            {variance == null ? '—' : `${variance >= 0 ? '+' : ''}${Math.round(variance)}%`}
                          </td>
                          <td className="py-2 pl-2">
                            <Badge variant="outline" className="text-[9px]">{p.status}</Badge>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-dashed">
        <CardContent className="py-6 text-center space-y-2">
          <Sparkles className="h-6 w-6 mx-auto text-muted-foreground/40" />
          <p className="text-xs text-muted-foreground">
            Próximas análises: rentabilidade real por projeto, eficiência por membro, tendências trimestrais.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
