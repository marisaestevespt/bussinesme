import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Trash2 } from 'lucide-react';
import { planStatusLabel, PERIODS, GOAL_STATUSES, MEASUREMENT_TYPES } from '@/hooks/usePlanningData';
import { planningAreaLabel } from '@/lib/labelMaps';
import { buildObjectiveAreaIndex, goalBelongsToPlanArea, planningAreaMatches } from '@/lib/planningAreaFilters';

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

const QUARTER_MAP: Record<string, string[]> = {
  T1: ['Janeiro', 'Fevereiro', 'Março'],
  T2: ['Abril', 'Maio', 'Junho'],
  T3: ['Julho', 'Agosto', 'Setembro'],
  T4: ['Outubro', 'Novembro', 'Dezembro'],
};

const SEMESTER_MAP: Record<string, string[]> = {
  S1: ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho'],
  S2: ['Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'],
};

// Check if a month period has already ended (approximate: month index < current month)
function isPeriodEnded(period: string): boolean {
  const idx = MONTHS.indexOf(period);
  if (idx === -1) return false;
  return idx < new Date().getMonth();
}

export type GoalsViewMode = 'mensal' | 'trimestral' | 'semestral' | 'metas';

export function PlanningGoalsTab({ planning, viewMode = 'mensal', areaFilter }: { planning: any; viewMode?: GoalsViewMode; areaFilter?: string }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editGoal, setEditGoal] = useState<any>(null);
  const [filter, setFilter] = useState('todos');
  const [form, setForm] = useState({ objective_id: '', period: 'Janeiro', target_value: '', actual_value: '', status: 'por_iniciar', objective_type: 'quantitativo', measurement_type: 'acumulativo', deviation_decision: '' });

  const allGoals = planning.allGoals;
  const objectives = planning.allObjectives;
  const loadingPlanning = planning.goals?.isLoading || planning.objectives?.isLoading;
  const goalAreaById = useMemo(() => buildObjectiveAreaIndex(objectives), [objectives]);
  const visibleGoals = useMemo(
    () => (areaFilter ? allGoals.filter((g: any) => goalBelongsToPlanArea(g, goalAreaById, areaFilter)) : allGoals),
    [allGoals, areaFilter, goalAreaById],
  );

  useEffect(() => {
    if (editGoal) {
      setForm({
        objective_id: editGoal.objective_id || '',
        period: editGoal.period || 'Janeiro',
        target_value: editGoal.target_value || '',
        actual_value: editGoal.actual_value || '',
        status: editGoal.status || 'por_iniciar',
        objective_type: editGoal.objective_type || 'quantitativo',
        measurement_type: editGoal.measurement_type || 'acumulativo',
        deviation_decision: editGoal.deviation_decision || '',
      });
    }
  }, [editGoal]);

  const handleSave = () => {
    planning.upsertGoal.mutate(editGoal ? { id: editGoal.id, ...form } : form);
    setDialogOpen(false);
    setEditGoal(null);
    setForm({ objective_id: '', period: 'Janeiro', target_value: '', actual_value: '', status: 'por_iniciar', objective_type: 'quantitativo', measurement_type: 'acumulativo', deviation_decision: '' });
  };

  const openNew = () => {
    setEditGoal(null);
    setForm({ objective_id: '', period: 'Janeiro', target_value: '', actual_value: '', status: 'por_iniciar', objective_type: 'quantitativo', measurement_type: 'acumulativo' });
    setDialogOpen(true);
  };

  const openEdit = (g: any) => {
    setEditGoal(g);
    setDialogOpen(true);
  };

  const getObjectiveName = (id: string) => objectives.find((o: any) => o.id === id)?.title || '—';

  const getObjectiveArea = (id: string) => {
    const obj = objectives.find((o: any) => o.id === id);
    if (!obj) return null;
    return planningAreaLabel(obj.area);
  };

  const getObjectiveDeadline = (id: string) => objectives.find((o: any) => o.id === id)?.deadline || null;

  // Monthly goals only
  const monthlyGoals = useMemo(() => visibleGoals.filter((g: any) => MONTHS.includes(g.period)), [visibleGoals]);

  // Build aggregated rows for a period map (quarters or semesters)
  const buildAggregatedRows = (periodMap: Record<string, string[]>) => {
    const byObj: Record<string, any[]> = {};
    monthlyGoals.forEach((g: any) => {
      const key = g.objective_id || 'sem_objetivo';
      if (!byObj[key]) byObj[key] = [];
      byObj[key].push(g);
    });

    const result: Record<string, any[]> = {};
    for (const [objId, goals] of Object.entries(byObj)) {
      result[objId] = Object.entries(periodMap).map(([periodLabel, months]) => {
        const matching = goals.filter((g: any) => months.includes(g.period));
        const targetSum = matching.reduce((s: number, g: any) => s + Number(g.target_value || 0), 0);
        const actualSum = matching.reduce((s: number, g: any) => s + Number(g.actual_value || 0), 0);
        const allDone = matching.length > 0 && matching.every((g: any) => g.status === 'atingido');
        const anyStarted = matching.some((g: any) => g.status === 'em_curso' || g.status === 'atingido');
        const allMonthsEnded = months.every(isPeriodEnded);
        return {
          period: periodLabel,
          objective_id: objId,
          target_value: targetSum || null,
          actual_value: actualSum || null,
          status: allDone ? 'atingido' : anyStarted ? 'em_curso' : 'por_iniciar',
          isAggregated: true,
          periodEnded: allMonthsEnded,
        };
      }).filter(r => r.target_value || r.actual_value); // only show rows with data
    }
    return result;
  };

  // Group monthly goals by objective
  const monthlyByObj = useMemo(() => {
    const map: Record<string, any[]> = {};
    monthlyGoals.forEach((g: any) => {
      const key = g.objective_id || 'sem_objetivo';
      if (!map[key]) map[key] = [];
      map[key].push(g);
    });
    return map;
  }, [monthlyGoals]);

  const quarterlyByObj = useMemo(() => buildAggregatedRows(QUARTER_MAP), [monthlyGoals]);
  const semesterByObj = useMemo(() => buildAggregatedRows(SEMESTER_MAP), [monthlyGoals]);

  // "Detalhe" view uses filters
  const filteredGoals = useMemo(() => {
    let g = visibleGoals;
    if (filter === 'com_desvio') g = g.filter((x: any) => x.actual_value && x.target_value && Number(x.actual_value) < Number(x.target_value));
    if (filter === 'atingidas') g = g.filter((x: any) => x.status === 'atingido');
    if (filter === 'por_iniciar') g = g.filter((x: any) => x.status === 'por_iniciar');
    return g;
  }, [visibleGoals, filter]);

  const detailGrouped = useMemo(() => {
    const map: Record<string, any[]> = {};
    filteredGoals.forEach((g: any) => {
      const key = g.objective_id || 'sem_objetivo';
      if (!map[key]) map[key] = [];
      map[key].push(g);
    });
    return map;
  }, [filteredGoals]);

  const sortByPeriod = (a: any, b: any) => {
    const order = [...MONTHS, 'T1', 'T2', 'T3', 'T4', 'S1', 'S2'];
    return order.indexOf(a.period) - order.indexOf(b.period);
  };

  const renderRow = (g: any, opts: { clickable: boolean; showDelete: boolean }) => {
    const dev = g.actual_value && g.target_value ? (Number(g.actual_value) - Number(g.target_value)) : null;
    const hasDeviation = dev !== null && dev < 0 && (g.isAggregated ? g.periodEnded : isPeriodEnded(g.period));
    const area = getObjectiveArea(g.objective_id);
    const deadline = getObjectiveDeadline(g.objective_id);
    const autoStatus = !g.isAggregated ? planning.computeGoalStatus(g) : g.status;
    return (
      <TableRow
 key={g.id || g.period}
 className={`${opts.clickable ? 'cursor-pointer hover:bg-muted/60' : ''} ${g.isAggregated ? 'bg-muted/30' : ''} ${hasDeviation ? 'bg-destructive/5' : ''}`}
 onClick={() => opts.clickable && openEdit(g)}
      >
        <TableCell className="text-sm">
          {g.period}
        </TableCell>
        <TableCell className="">{area ? <Badge variant="outline" className="text-[10px]">{area}</Badge> : '—'}</TableCell>
        <TableCell className="">{deadline || '—'}</TableCell>
        <TableCell className="">{g.target_value || '—'}</TableCell>
        <TableCell className="">{g.actual_value || '—'}</TableCell>
        <TableCell className={` ${hasDeviation ? 'text-destructive font-medium' : ''}`}>
          {dev != null ? (dev >= 0 ? `+${dev}` : dev) : '—'}
        </TableCell>
        <TableCell>
          <Badge variant={autoStatus === 'atingido' ? 'default' : autoStatus === 'nao_atingido' ? 'destructive' : 'secondary'} className="text-[10px]">
            {planStatusLabel(autoStatus)}
          </Badge>
          {hasDeviation && autoStatus !== 'atingido' && <Badge variant="destructive" className="text-[9px] ml-1">Desvio</Badge>}
          {autoStatus !== g.status && !g.isAggregated && <span className="text-[9px] text-muted-foreground ml-1">(auto)</span>}
        </TableCell>
        {opts.showDelete && (
          <TableCell>
            {!g.isAggregated && (
              <button onClick={e => { e.stopPropagation(); planning.deleteGoal.mutate(g.id); }}>
                <Trash2 className="h-3 w-3 text-muted-foreground" />
              </button>
            )}
          </TableCell>
        )}
      </TableRow>
    );
  };

  const renderGroupedTable = (grouped: Record<string, any[]>, opts: { clickable: boolean; showDelete: boolean }) => {
    const entries = Object.entries(grouped).filter(([, goals]) => goals.length > 0);
    if (entries.length === 0) {
      return (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
          Sem metas registadas para esta vista.
        </CardContent></Card>
      );
    }
    return entries.map(([objId, goals]) => (
      <Card key={objId}>
        <CardContent className="p-4">
          <h3 className="text-sm font-semibold mb-2">{objId === 'sem_objetivo' ? 'Sem objetivo' : getObjectiveName(objId)}</h3>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Período</TableHead><TableHead>Área</TableHead><TableHead>Prazo</TableHead>
              <TableHead>Valor alvo</TableHead><TableHead>Valor real</TableHead><TableHead>Desvio</TableHead>
              <TableHead>Status</TableHead>{opts.showDelete && <TableHead></TableHead>}
            </TableRow></TableHeader>
            <TableBody>
              {(goals as any[]).sort(sortByPeriod).map(g => renderRow(g, opts))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    ));
  };

  if (loadingPlanning) {
    return <div className="space-y-3 mt-4">{[1, 2].map((i) => <Skeleton key={i} className="h-28 w-full" />)}</div>;
  }

  return (
    <div className="space-y-4 mt-4">
      {/* Nova Meta + filters for 'metas' view */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        {viewMode === 'metas' ? (
          <div className="flex gap-2">
            {['todos', 'com_desvio', 'atingidas', 'por_iniciar'].map(f => (
              <Button key={f} size="sm" variant={filter === f ? 'default' : 'outline'} onClick={() => setFilter(f)} className="text-xs h-7">
                {f === 'todos' ? 'Todos' : f === 'com_desvio' ? 'Com desvio' : f === 'atingidas' ? 'Atingidas' : 'Por iniciar'}
              </Button>
            ))}
          </div>
        ) : <div />}
        <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Nova Meta</Button>
      </div>

      {/* Render view */}
      {viewMode === 'mensal' && renderGroupedTable(monthlyByObj, { clickable: true, showDelete: true })}
      {viewMode === 'trimestral' && renderGroupedTable(quarterlyByObj, { clickable: false, showDelete: false })}
      {viewMode === 'semestral' && renderGroupedTable(semesterByObj, { clickable: false, showDelete: false })}
      {viewMode === 'metas' && renderGroupedTable(detailGrouped, { clickable: true, showDelete: true })}

      {/* Create / Edit Goal Dialog */}
      <Dialog open={dialogOpen} onOpenChange={v => { if (!v) { setDialogOpen(false); setEditGoal(null); } else setDialogOpen(true); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editGoal ? 'Editar Meta' : 'Nova Meta'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Objetivo Anual</Label>
              <Select value={form.objective_id || '_none'} onValueChange={v => setForm(p => ({ ...p, objective_id: v === '_none' ? '' : v }))}>
                <SelectTrigger><SelectValue placeholder="Selecionar objetivo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Sem objetivo</SelectItem>
                  {(areaFilter ? objectives.filter((o: any) => planningAreaMatches(o.area, areaFilter)) : objectives).map((o: any) => <SelectItem key={o.id} value={o.id}>{o.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Período</Label>
              <Select value={form.period} onValueChange={v => setForm(p => ({ ...p, period: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PERIODS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Tipo</Label>
                <Select value={form.objective_type} onValueChange={v => setForm(p => ({ ...p, objective_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="quantitativo">Quantitativo</SelectItem>
                    <SelectItem value="qualitativo">Qualitativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.objective_type === 'quantitativo' && (
                <div><Label>Medição</Label>
                  <Select value={form.measurement_type} onValueChange={v => setForm(p => ({ ...p, measurement_type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{MEASUREMENT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
            </div>
            {form.objective_type === 'quantitativo' && (
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Valor alvo</Label><Input value={form.target_value} onChange={e => setForm(p => ({ ...p, target_value: e.target.value }))} /></div>
                <div><Label>Valor real</Label><Input value={form.actual_value} onChange={e => setForm(p => ({ ...p, actual_value: e.target.value }))} /></div>
              </div>
            )}
            <div><Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{GOAL_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {(form.status === 'em_risco' || form.status === 'nao_atingido') && (
              <div>
                <Label>Decisão / contexto do desvio</Label>
                <Textarea
                  value={form.deviation_decision || ''}
                  onChange={e => setForm(p => ({ ...p, deviation_decision: e.target.value }))}
                  rows={3}
                  placeholder="O que vai ser feito por causa deste desvio?"
                />
              </div>
            )}
            <Button className="w-full" onClick={handleSave} disabled={!form.objective_id}>Guardar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
