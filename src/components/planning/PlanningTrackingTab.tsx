import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';
import { VALUE_SOURCES, CADENCES } from '@/hooks/usePlanningData';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export function PlanningTrackingTab({ planning }: { planning: any }) {
  const allMetrics = planning.allMetrics;
  const allHistory = planning.metricHistory.data || [];
  const objectives = planning.allObjectives;

  const [editMetric, setEditMetric] = useState<any>(null);
  const [editForm, setEditForm] = useState<any>({});

  useEffect(() => {
    if (editMetric) {
      setEditForm({
        name: editMetric.name || '',
        cadence: editMetric.cadence || 'mensal',
        source: editMetric.source || 'manual',
        current_value: editMetric.current_value || '',
        target_value: editMetric.target_value || '',
        target_unit: editMetric.target_unit || '',
        green_threshold: editMetric.green_threshold ?? 90,
        yellow_threshold: editMetric.yellow_threshold ?? 60,
      });
    }
  }, [editMetric]);

  const handleSaveEdit = () => {
    if (!editMetric) return;
    planning.upsertMetric.mutate({
      id: editMetric.id,
      objective_id: editMetric.objective_id,
      ...editForm,
      target_value: editForm.target_value ? Number(editForm.target_value) : null,
      green_threshold: Number(editForm.green_threshold),
      yellow_threshold: Number(editForm.yellow_threshold),
    });
    setEditMetric(null);
  };

  const getObjectiveName = (id: string) => objectives.find((o: any) => o.id === id)?.title || '—';
  const getObjectiveArea = (id: string) => objectives.find((o: any) => o.id === id)?.area || '';

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
    if (trend === 'up') return <TrendingUp className="h-4 w-4 text-success" />;
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
                <Badge variant="outline" className="text-[10px] border-warning text-warning">Vence hoje</Badge>
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
                <TableHead>Objetivo</TableHead><TableHead>Métrica</TableHead><TableHead>Cadência</TableHead><TableHead>Valor atual</TableHead><TableHead>Objetivo</TableHead><TableHead>Última atualiz.</TableHead><TableHead>Tendência</TableHead>
              </TableRow></TableHeader>
              <TableBody>{allMetrics.map((m: any) => {
                const overdue = planning.isMetricOverdue(m);
                const autoVal = m.source !== 'manual' ? planning.getAutoValue(m.source) : null;
                const displayVal = m.source === 'manual' ? m.current_value : autoVal;
                return (
                  <TableRow key={m.id} className={`cursor-pointer hover:bg-muted/60 ${overdue ? 'bg-destructive/15' : ''}`} onClick={() => setEditMetric(m)}>
                    <TableCell className="text-xs">{getObjectiveName(m.objective_id)}</TableCell>
                    <TableCell className="text-sm font-medium">{m.name}</TableCell>
                    <TableCell className="text-xs">{CADENCES.find(c => c.value === m.cadence)?.label || m.cadence}</TableCell>
                    <TableCell className="text-xs">{displayVal != null ? Number(displayVal).toLocaleString() : '—'}</TableCell>
                    <TableCell className="text-xs">{m.target_value ? `${Number(m.target_value).toLocaleString()} ${m.target_unit || ''}` : '—'}</TableCell>
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

      {/* Edit Metric Dialog */}
      <Dialog open={!!editMetric} onOpenChange={v => { if (!v) setEditMetric(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Editar Métrica</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome</Label><Input value={editForm.name || ''} onChange={e => setEditForm((p: any) => ({ ...p, name: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Valor objetivo</Label><Input type="number" value={editForm.target_value || ''} onChange={e => setEditForm((p: any) => ({ ...p, target_value: e.target.value }))} /></div>
              <div><Label>Unidade</Label><Input value={editForm.target_unit || ''} onChange={e => setEditForm((p: any) => ({ ...p, target_unit: e.target.value }))} /></div>
            </div>
            {editForm.source === 'manual' && (
              <div><Label>Valor atual</Label><Input type="number" value={editForm.current_value || ''} onChange={e => setEditForm((p: any) => ({ ...p, current_value: e.target.value }))} /></div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div><Label>% "No caminho"</Label><Input type="number" value={editForm.green_threshold ?? ''} onChange={e => setEditForm((p: any) => ({ ...p, green_threshold: e.target.value }))} /></div>
              <div><Label>% "Atenção"</Label><Input type="number" value={editForm.yellow_threshold ?? ''} onChange={e => setEditForm((p: any) => ({ ...p, yellow_threshold: e.target.value }))} /></div>
            </div>
            <div><Label>Cadência</Label>
              <Select value={editForm.cadence || 'mensal'} onValueChange={v => setEditForm((p: any) => ({ ...p, cadence: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CADENCES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Fonte</Label>
              <Select value={editForm.source || 'manual'} onValueChange={v => setEditForm((p: any) => ({ ...p, source: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{VALUE_SOURCES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button className="w-full" onClick={handleSaveEdit}>Guardar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
