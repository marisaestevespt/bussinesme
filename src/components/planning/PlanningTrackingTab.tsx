import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';
import { VALUE_SOURCES, CADENCES } from '@/hooks/usePlanningData';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export function PlanningTrackingTab({ planning }: { planning: any }) {
  const allMetrics = planning.allMetrics;
  const allHistory = planning.metricHistory.data || [];
  const objectives = planning.allObjectives;

  const getObjectiveName = (id: string) => objectives.find((o: any) => o.id === id)?.title || '—';
  const getObjectiveArea = (id: string) => objectives.find((o: any) => o.id === id)?.area || '';

  // Overdue alerts
  const overdueMetrics = useMemo(() =>
    allMetrics.filter((m: any) => planning.isMetricOverdue(m)),
    [allMetrics]
  );

  const dueTodayMetrics = useMemo(() =>
    allMetrics.filter((m: any) => planning.isMetricDueToday(m) && !planning.isMetricOverdue(m)),
    [allMetrics]
  );

  const getDaysOverdue = (m: any) => {
    if (!m.last_updated_at) return '—';
    const diff = Math.floor((new Date().getTime() - new Date(m.last_updated_at).getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  // Group metrics by area
  const metricsByArea = useMemo(() => {
    const map: Record<string, any[]> = {};
    allMetrics.forEach((m: any) => {
      const area = getObjectiveArea(m.objective_id) || 'outro';
      if (!map[area]) map[area] = [];
      map[area].push(m);
    });
    return map;
  }, [allMetrics, objectives]);

  const TrendIcon = ({ metricId }: { metricId: string }) => {
    const trend = planning.getMetricTrend(metricId);
    if (trend === 'up') return <TrendingUp className="h-4 w-4 text-green-600" />;
    if (trend === 'down') return <TrendingDown className="h-4 w-4 text-destructive" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <div className="space-y-6 mt-4">
      {/* Alerts block */}
      {(overdueMetrics.length > 0 || dueTodayMetrics.length > 0) && (
        <Card className="border-destructive/30">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <h3 className="text-sm font-semibold">Alertas de Métricas</h3>
            </div>
            {overdueMetrics.map((m: any) => (
              <div key={m.id} className="flex items-center gap-3 py-1 text-sm">
                <Badge variant="destructive" className="text-[10px]">Em atraso</Badge>
                <span className="font-medium">{m.name}</span>
                <span className="text-xs text-muted-foreground">({getObjectiveName(m.objective_id)})</span>
                <span className="text-xs text-muted-foreground ml-auto">Última: {m.last_updated_at ? new Date(m.last_updated_at).toLocaleDateString('pt-PT') : 'nunca'}</span>
                <span className="text-xs text-destructive font-medium">{getDaysOverdue(m)} dias</span>
              </div>
            ))}
            {dueTodayMetrics.map((m: any) => (
              <div key={m.id} className="flex items-center gap-3 py-1 text-sm">
                <Badge variant="outline" className="text-[10px] border-amber-500 text-amber-700">Vence hoje</Badge>
                <span className="font-medium">{m.name}</span>
                <span className="text-xs text-muted-foreground">({getObjectiveName(m.objective_id)})</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* All metrics table */}
      {allMetrics.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
          Sem métricas definidas. Adicione métricas a partir dos objetivos.
        </CardContent></Card>
      ) : (
        <Card>
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold mb-3">Métricas Ativas</h3>
            <Table>
              <TableHeader><TableRow>
                <TableHead>Objetivo</TableHead><TableHead>Métrica</TableHead><TableHead>Cadência</TableHead><TableHead>Valor atual</TableHead><TableHead>Última atualiz.</TableHead><TableHead>Tendência</TableHead>
              </TableRow></TableHeader>
              <TableBody>{allMetrics.map((m: any) => {
                const overdue = planning.isMetricOverdue(m);
                const autoVal = m.source !== 'manual' ? planning.getAutoValue(m.source) : null;
                const displayVal = m.source === 'manual' ? m.current_value : autoVal;
                return (
                  <TableRow key={m.id} className={overdue ? 'bg-red-50' : ''}>
                    <TableCell className="text-xs">{getObjectiveName(m.objective_id)}</TableCell>
                    <TableCell className="text-sm font-medium">{m.name}</TableCell>
                    <TableCell className="text-xs">{CADENCES.find(c => c.value === m.cadence)?.label || m.cadence}</TableCell>
                    <TableCell className="text-xs">{displayVal != null ? Number(displayVal).toLocaleString() : '—'}</TableCell>
                    <TableCell className="text-xs">{m.last_updated_at ? new Date(m.last_updated_at).toLocaleDateString('pt-PT') : '—'}</TableCell>
                    <TableCell><TrendIcon metricId={m.id} /></TableCell>
                  </TableRow>
                );
              })}</TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Charts grouped by area */}
      {Object.entries(metricsByArea).map(([area, metrics]) => {
        const metricsWithHistory = (metrics as any[]).filter(m => allHistory.some((r: any) => r.metric_id === m.id));
        if (metricsWithHistory.length === 0) return null;
        return (
          <Card key={area}>
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold mb-3">Tendências — {area.charAt(0).toUpperCase() + area.slice(1)}</h3>
              <div className="space-y-4">
                {metricsWithHistory.map((m: any) => {
                  const records = allHistory.filter((r: any) => r.metric_id === m.id);
                  return (
                    <div key={m.id}>
                      <p className="text-xs font-medium mb-1">{m.name}</p>
                      <ResponsiveContainer width="100%" height={120}>
                        <LineChart data={records.map((r: any) => ({ date: r.recorded_at, value: Number(r.value) }))}>
                          <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                          <YAxis tick={{ fontSize: 10 }} width={40} />
                          <Tooltip />
                          <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
