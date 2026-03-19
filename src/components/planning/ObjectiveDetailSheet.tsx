import { useState, useEffect } from 'react';
import { Dialog as FullDialog, DialogContent as FullDialogContent, DialogHeader as FullDialogHeader, DialogTitle as FullDialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2, Save, ListTodo, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { planAreaLabel, planStatusLabel, PLAN_AREAS, PLAN_STATUSES, VALUE_SOURCES, CADENCES, ACTION_STATUSES } from '@/hooks/usePlanningData';
import { useTeamData } from '@/hooks/useTeamData';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';

export function ObjectiveDetailSheet({ open, onClose, objective, planning }: any) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<any>({});

  const obj = objective ? (planning.allObjectives.find((o: any) => o.id === objective.id) || objective) : null;

  useEffect(() => {
    if (obj) {
      setForm({
        title: obj.title || '', description: obj.description || '', area: obj.area || 'outro',
        status: obj.status || 'por_iniciar', deadline: obj.deadline || '',
        objective_type: obj.objective_type || 'quantitativo', target_value: obj.target_value || '',
        target_unit: obj.target_unit || '€', current_value: obj.current_value || '',
        value_source: obj.value_source || 'manual',
      });
      setEditing(false);
    }
  }, [obj?.id, obj?.updated_at]);

  if (!obj) return null;

  const prog = planning.objectiveProgress(obj);
  const currentVal = planning.objectiveCurrentValue(obj);
  const objCriteria = (planning.criteria.data || []).filter((c: any) => c.objective_id === obj.id);
  const objGoals = planning.allGoals.filter((g: any) => g.objective_id === obj.id);
  const objMetrics = planning.allMetrics.filter((m: any) => m.objective_id === obj.id);
  const objActions = planning.allActions.filter((a: any) => a.objective_id === obj.id);
  const set = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));

  useEffect(() => {
    if (obj) {
      setForm({
        title: obj.title || '', description: obj.description || '', area: obj.area || 'outro',
        status: obj.status || 'por_iniciar', deadline: obj.deadline || '',
        objective_type: obj.objective_type || 'quantitativo', target_value: obj.target_value || '',
        target_unit: obj.target_unit || '€', current_value: obj.current_value || '',
        value_source: obj.value_source || 'manual',
      });
      setEditing(false);
    }
  }, [obj?.id, obj?.updated_at]);

  const handleSaveHeader = () => {
    planning.upsertObjective.mutate({ id: obj.id, ...form });
    setEditing(false);
  };

  return (
    <FullDialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <FullDialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <FullDialogHeader>
          <div className="flex items-start justify-between gap-2">
            {editing ? (
              <Input className="text-lg font-semibold" value={form.title} onChange={e => set('title', e.target.value)} />
            ) : (
              <FullDialogTitle className="text-lg">{obj.title}</FullDialogTitle>
            )}
            <div className="flex gap-1 shrink-0">
              {editing ? (
                <Button size="sm" onClick={handleSaveHeader}><Save className="h-3 w-3 mr-1" /> Guardar</Button>
              ) : (
                <Button size="sm" variant="outline" onClick={() => setEditing(true)}>Editar</Button>
              )}
            </div>
          </div>
        </FullDialogHeader>

        <div className="space-y-6 mt-4">
          {/* Editable header */}
          {editing ? (
            <div className="space-y-3 rounded-lg border p-4">
              <div><Label>Descrição</Label><Textarea value={form.description} onChange={e => set('description', e.target.value)} rows={2} /></div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div><Label>Área</Label>
                  <Select value={form.area} onValueChange={v => set('area', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{PLAN_AREAS.map(a => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Tipo</Label>
                  <Select value={form.objective_type} onValueChange={v => set('objective_type', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="quantitativo">Quantitativo</SelectItem>
                      <SelectItem value="qualitativo">Qualitativo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Status</Label>
                  <Select value={form.status} onValueChange={v => set('status', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{PLAN_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Data limite</Label><Input type="date" value={form.deadline} onChange={e => set('deadline', e.target.value)} /></div>
              </div>
              {form.objective_type === 'quantitativo' && (
                <div className="grid grid-cols-3 gap-3">
                  <div><Label>Valor alvo</Label><Input type="number" value={form.target_value} onChange={e => set('target_value', e.target.value)} /></div>
                  <div><Label>Unidade</Label><Input value={form.target_unit} onChange={e => set('target_unit', e.target.value)} /></div>
                  <div><Label>Fonte</Label>
                    <Select value={form.value_source || 'manual'} onValueChange={v => set('value_source', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{VALUE_SOURCES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  {form.value_source === 'manual' && (
                    <div><Label>Valor atual</Label><Input type="number" value={form.current_value} onChange={e => set('current_value', e.target.value)} /></div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <>
              {obj.description && <p className="text-sm text-muted-foreground">{obj.description}</p>}
              <div className="flex gap-2 flex-wrap">
                <Badge variant="outline">{planAreaLabel(obj.area)}</Badge>
                <Badge variant="outline">{obj.objective_type === 'quantitativo' ? 'Quantitativo' : 'Qualitativo'}</Badge>
                <Badge variant={obj.status === 'atingido' ? 'default' : 'secondary'}>{planStatusLabel(obj.status)}</Badge>
                {obj.deadline && <Badge variant="outline">Até {obj.deadline}</Badge>}
              </div>
            </>
          )}

          {/* Progress */}
          <div>
            <div className="flex justify-between text-sm mb-1"><span>Progresso</span><span>{prog}%</span></div>
            <Progress value={prog} className="h-2.5" />
          </div>

          {/* Quantitative details */}
          {obj.objective_type === 'quantitativo' && !editing && (
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Valor alvo</p>
                <p className="text-lg font-bold">{obj.target_value ? `${Number(obj.target_value).toLocaleString()} ${obj.target_unit || ''}` : '—'}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Valor atual</p>
                <p className="text-lg font-bold">{currentVal != null ? `${Number(currentVal).toLocaleString()} ${obj.target_unit || ''}` : '—'}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Fonte</p>
                <p className="text-sm font-medium">{VALUE_SOURCES.find(s => s.value === obj.value_source)?.label || 'Manual'}</p>
              </div>
            </div>
          )}

          {/* Qualitative criteria */}
          {obj.objective_type === 'qualitativo' && (
            <CriteriaSection objectiveId={obj.id} criteria={objCriteria} planning={planning} />
          )}

          <Separator />
          <GoalsSection objectiveId={obj.id} goals={objGoals} planning={planning} />
          <Separator />
          <MetricsSection objectiveId={obj.id} metrics={objMetrics} planning={planning} />
          <Separator />
          <ActionsSection objectiveId={obj.id} actions={objActions} planning={planning} />
        </div>
      </FullDialogContent>
    </FullDialog>
  );
}

// ─── Criteria (Qualitative) ─────────────
function CriteriaSection({ objectiveId, criteria, planning }: any) {
  const [newCrit, setNewCrit] = useState('');
  return (
    <div>
      <h3 className="text-sm font-semibold mb-2">Critérios de Sucesso</h3>
      <div className="flex gap-2 mb-2">
        <Input className="h-8 text-sm" placeholder="Novo critério..." value={newCrit} onChange={e => setNewCrit(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && newCrit.trim()) { planning.upsertCriterion.mutate({ objective_id: objectiveId, description: newCrit.trim() }); setNewCrit(''); }}} />
        <Button size="sm" variant="ghost" className="h-8" onClick={() => { if (newCrit.trim()) { planning.upsertCriterion.mutate({ objective_id: objectiveId, description: newCrit.trim() }); setNewCrit(''); }}}><Plus className="h-4 w-4" /></Button>
      </div>
      {criteria.map((c: any) => (
        <div key={c.id} className="flex items-center gap-2 py-1 group">
          <Checkbox checked={c.completed} onCheckedChange={v => planning.upsertCriterion.mutate({ id: c.id, completed: !!v })} />
          <span className={`text-sm flex-1 ${c.completed ? 'line-through text-muted-foreground' : ''}`}>{c.description}</span>
          <button onClick={() => planning.deleteCriterion.mutate(c.id)} className="opacity-0 group-hover:opacity-100"><Trash2 className="h-3 w-3 text-muted-foreground" /></button>
        </div>
      ))}
      {criteria.length === 0 && <p className="text-xs text-muted-foreground">Sem critérios definidos</p>}
    </div>
  );
}

// ─── Goals ─────────────
const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const QUARTER_MAP: Record<string, string[]> = {
  'T1': ['Janeiro', 'Fevereiro', 'Março'],
  'T2': ['Abril', 'Maio', 'Junho'],
  'T3': ['Julho', 'Agosto', 'Setembro'],
  'T4': ['Outubro', 'Novembro', 'Dezembro'],
};

function GoalsSection({ objectiveId, goals, planning }: any) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ period: 'Janeiro', target_value: '', actual_value: '', status: 'por_iniciar' });

  const monthlyGoals = goals.filter((g: any) => MONTHS.includes(g.period));

  // Auto-compute quarterly summaries from monthly goals
  const quarterlyRows = Object.entries(QUARTER_MAP).map(([quarter, months]) => {
    const monthGoals = monthlyGoals.filter((g: any) => months.includes(g.period));
    if (monthGoals.length === 0) return null;
    const targetSum = monthGoals.reduce((s: number, g: any) => s + Number(g.target_value || 0), 0);
    const actualSum = monthGoals.reduce((s: number, g: any) => s + Number(g.actual_value || 0), 0);
    const allDone = monthGoals.length === 3 && monthGoals.every((g: any) => g.status === 'atingido');
    const anyStarted = monthGoals.some((g: any) => g.status === 'em_curso' || g.status === 'atingido');
    return {
      period: quarter,
      target_value: targetSum,
      actual_value: actualSum,
      deviation: actualSum - targetSum,
      status: allDone ? 'atingido' : anyStarted ? 'em_curso' : 'por_iniciar',
      isQuarter: true,
      count: monthGoals.length,
    };
  }).filter(Boolean);

  const handleSave = () => {
    planning.upsertGoal.mutate({ ...form, objective_id: objectiveId });
    setDialogOpen(false);
    setForm({ period: 'Janeiro', target_value: '', actual_value: '', status: 'por_iniciar' });
  };

  // Sort monthly + quarterly together
  const periodOrder = [...MONTHS, 'T1', 'T2', 'T3', 'T4'];
  const allRows = [
    ...monthlyGoals.map((g: any) => ({ ...g, isQuarter: false })),
    ...quarterlyRows,
  ].sort((a: any, b: any) => {
    // Show Q after its months: T1 after Março, T2 after Junho, etc
    const idxA = a.isQuarter
      ? MONTHS.indexOf(QUARTER_MAP[a.period]?.[2] || '') + 0.5
      : MONTHS.indexOf(a.period);
    const idxB = b.isQuarter
      ? MONTHS.indexOf(QUARTER_MAP[b.period]?.[2] || '') + 0.5
      : MONTHS.indexOf(b.period);
    return idxA - idxB;
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold">Desdobramento em Metas</h3>
        <Button size="sm" variant="outline" onClick={() => setDialogOpen(true)}><Plus className="h-3 w-3 mr-1" /> Nova Meta Mensal</Button>
      </div>
      {allRows.length === 0 ? <p className="text-xs text-muted-foreground">Sem metas associadas. Defina metas mensais e os trimestres serão calculados automaticamente.</p> : (
        <Table>
          <TableHeader><TableRow>
            <TableHead>Período</TableHead><TableHead>Valor alvo</TableHead><TableHead>Valor real</TableHead><TableHead>Desvio</TableHead><TableHead>Status</TableHead><TableHead></TableHead>
          </TableRow></TableHeader>
          <TableBody>{allRows.map((g: any) => {
            const dev = g.isQuarter ? g.deviation : (g.actual_value && g.target_value ? (Number(g.actual_value) - Number(g.target_value)) : null);
            const hasDeviation = dev !== null && dev < 0;
            return (
              <TableRow key={g.isQuarter ? g.period : g.id} className={`${g.isQuarter ? 'bg-muted/40 font-medium' : ''} ${hasDeviation ? 'bg-red-50/50' : ''}`}>
                <TableCell className="text-sm">
                  {g.isQuarter && <Badge variant="outline" className="text-[10px] mr-1">Auto</Badge>}
                  {g.period}
                </TableCell>
                <TableCell className="text-xs">{g.target_value || '—'}</TableCell>
                <TableCell className="text-xs">{g.actual_value || '—'}</TableCell>
                <TableCell className={`text-xs ${hasDeviation ? 'text-destructive font-medium' : ''}`}>{dev != null ? (dev >= 0 ? `+${dev}` : dev) : '—'}</TableCell>
                <TableCell><Badge variant={g.status === 'atingido' ? 'default' : 'secondary'} className="text-[10px]">{planStatusLabel(g.status)}</Badge></TableCell>
                <TableCell>
                  {!g.isQuarter && (
                    <button onClick={(e) => { e.stopPropagation(); planning.deleteGoal.mutate(g.id); }}><Trash2 className="h-3 w-3 text-muted-foreground" /></button>
                  )}
                </TableCell>
              </TableRow>
            );
          })}</TableBody>
        </Table>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nova Meta Mensal</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Mês</Label>
              <Select value={form.period} onValueChange={v => setForm(p => ({ ...p, period: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{MONTHS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Valor alvo</Label><Input value={form.target_value} onChange={e => setForm(p => ({ ...p, target_value: e.target.value }))} /></div>
              <div><Label>Valor real</Label><Input value={form.actual_value} onChange={e => setForm(p => ({ ...p, actual_value: e.target.value }))} /></div>
            </div>
            <Button className="w-full" onClick={handleSave}>Guardar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Metrics ─────────────
function MetricsSection({ objectiveId, metrics, planning }: any) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [historyMetric, setHistoryMetric] = useState<any>(null);
  const [recordDialog, setRecordDialog] = useState(false);
  const [form, setForm] = useState({ name: '', cadence: 'mensal', source: 'manual' });
  const [recordForm, setRecordForm] = useState({ value: '', notes: '', recorded_at: format(new Date(), 'yyyy-MM-dd') });

  const handleSave = () => {
    planning.upsertMetric.mutate({ ...form, objective_id: objectiveId });
    setDialogOpen(false);
    setForm({ name: '', cadence: 'mensal', source: 'manual' });
  };

  const handleRecord = () => {
    if (!historyMetric) return;
    planning.addMetricRecord.mutate({ metric_id: historyMetric.id, value: Number(recordForm.value), notes: recordForm.notes, recorded_at: recordForm.recorded_at });
    setRecordDialog(false);
    setRecordForm({ value: '', notes: '', recorded_at: format(new Date(), 'yyyy-MM-dd') });
  };

  const allHistory = planning.metricHistory.data || [];

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold">Métricas de Acompanhamento</h3>
        <Button size="sm" variant="outline" onClick={() => setDialogOpen(true)}><Plus className="h-3 w-3 mr-1" /> Nova Métrica</Button>
      </div>
      {metrics.length === 0 ? <p className="text-xs text-muted-foreground">Sem métricas definidas</p> : (
        <Table>
          <TableHeader><TableRow>
            <TableHead>Métrica</TableHead><TableHead>Cadência</TableHead><TableHead>Fonte</TableHead><TableHead>Valor atual</TableHead><TableHead>Última atualiz.</TableHead><TableHead></TableHead>
          </TableRow></TableHeader>
          <TableBody>{metrics.map((m: any) => {
            const overdue = planning.isMetricOverdue(m);
            const dueToday = planning.isMetricDueToday(m);
            const autoVal = m.source !== 'manual' ? planning.getAutoValue(m.source) : null;
            const displayVal = m.source === 'manual' ? m.current_value : autoVal;
            return (
              <TableRow key={m.id} className={overdue ? 'bg-red-50' : dueToday ? 'bg-amber-50' : ''}>
                <TableCell className="text-sm font-medium cursor-pointer hover:underline" onClick={() => setHistoryMetric(m)}>{m.name}</TableCell>
                <TableCell className="text-xs">{CADENCES.find(c => c.value === m.cadence)?.label || m.cadence}</TableCell>
                <TableCell className="text-xs">{VALUE_SOURCES.find(s => s.value === m.source)?.label || m.source}</TableCell>
                <TableCell className="text-xs">{displayVal != null ? Number(displayVal).toLocaleString() : '—'}</TableCell>
                <TableCell className="text-xs">{m.last_updated_at ? new Date(m.last_updated_at).toLocaleDateString('pt-PT') : '—'}</TableCell>
                <TableCell>
                  <button onClick={() => planning.deleteMetric.mutate(m.id)}><Trash2 className="h-3 w-3 text-muted-foreground" /></button>
                </TableCell>
              </TableRow>
            );
          })}</TableBody>
        </Table>
      )}

      {/* Trend charts */}
      {metrics.length > 0 && metrics.map((m: any) => {
        const records = allHistory.filter((r: any) => r.metric_id === m.id);
        if (records.length < 2) return null;
        return (
          <div key={m.id} className="mt-4">
            <p className="text-xs font-medium mb-1">{m.name} — Tendência</p>
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

      {/* New metric dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nova Métrica</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome</Label><Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></div>
            <div><Label>Cadência</Label>
              <Select value={form.cadence} onValueChange={v => setForm(p => ({ ...p, cadence: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CADENCES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Fonte</Label>
              <Select value={form.source} onValueChange={v => setForm(p => ({ ...p, source: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{VALUE_SOURCES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button className="w-full" onClick={handleSave} disabled={!form.name.trim()}>Guardar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* History sheet */}
      {historyMetric && (
        <Dialog open={!!historyMetric} onOpenChange={v => { if (!v) setHistoryMetric(null); }}>
          <DialogContent>
            <DialogHeader><DialogTitle>Histórico — {historyMetric.name}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              {historyMetric.source === 'manual' && (
                <Button size="sm" variant="outline" onClick={() => setRecordDialog(true)}><Plus className="h-3 w-3 mr-1" /> Registar Valor</Button>
              )}
              <Table>
                <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Valor</TableHead><TableHead>Notas</TableHead></TableRow></TableHeader>
                <TableBody>
                  {allHistory.filter((r: any) => r.metric_id === historyMetric.id).map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs">{r.recorded_at}</TableCell>
                      <TableCell className="text-xs">{Number(r.value).toLocaleString()}</TableCell>
                      <TableCell className="text-xs">{r.notes || '—'}</TableCell>
                    </TableRow>
                  ))}
                  {allHistory.filter((r: any) => r.metric_id === historyMetric.id).length === 0 && (
                    <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground text-xs py-4">Sem registos</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Record value dialog */}
      <Dialog open={recordDialog} onOpenChange={setRecordDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Registar Valor</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Data</Label><Input type="date" value={recordForm.recorded_at} onChange={e => setRecordForm(p => ({ ...p, recorded_at: e.target.value }))} /></div>
            <div><Label>Valor</Label><Input type="number" value={recordForm.value} onChange={e => setRecordForm(p => ({ ...p, value: e.target.value }))} /></div>
            <div><Label>Notas</Label><Input value={recordForm.notes} onChange={e => setRecordForm(p => ({ ...p, notes: e.target.value }))} /></div>
            <Button className="w-full" onClick={handleRecord} disabled={!recordForm.value}>Guardar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Actions ─────────────
function ActionsSection({ objectiveId, actions, planning }: any) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ description: '', action_type: 'simples', status: 'por_fazer', deadline: '', responsible_id: '' });
  const { members } = useTeamData();
  const teamMembers = members.data || [];

  const handleSave = () => {
    planning.upsertAction.mutate({ ...form, objective_id: objectiveId });
    setDialogOpen(false);
    setForm({ description: '', action_type: 'simples', status: 'por_fazer', deadline: '', responsible_id: '' });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold">Ações</h3>
        <Button size="sm" variant="outline" onClick={() => setDialogOpen(true)}><Plus className="h-3 w-3 mr-1" /> Nova Ação</Button>
      </div>
      {actions.length === 0 ? <p className="text-xs text-muted-foreground">Sem ações definidas</p> : (
        <Table>
          <TableHeader><TableRow>
            <TableHead>Descrição</TableHead><TableHead>Tipo</TableHead><TableHead>Status</TableHead><TableHead>Deadline</TableHead><TableHead></TableHead>
          </TableRow></TableHeader>
          <TableBody>{actions.map((a: any) => (
            <TableRow key={a.id}>
              <TableCell className="text-sm">{a.description}</TableCell>
              <TableCell className="text-xs">{a.action_type === 'tarefa' ? 'Tarefa' : 'Ação Simples'}</TableCell>
              <TableCell><Badge variant={a.status === 'feito' ? 'default' : 'secondary'} className="text-[10px]">{planStatusLabel(a.status)}</Badge></TableCell>
              <TableCell className="text-xs">{a.deadline || '—'}</TableCell>
              <TableCell className="flex gap-1">
                {a.action_type !== 'tarefa' && !a.task_id && (
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => planning.convertActionToTask.mutate(a)}>
                    <ListTodo className="h-3 w-3 mr-1" /> Converter em Tarefa
                  </Button>
                )}
                {a.task_id && <Badge variant="outline" className="text-[10px]">Tarefa criada</Badge>}
                <button onClick={() => planning.deleteAction.mutate(a.id)}><Trash2 className="h-3 w-3 text-muted-foreground" /></button>
              </TableCell>
            </TableRow>
          ))}</TableBody>
        </Table>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nova Ação</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Descrição</Label><Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={2} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Tipo</Label>
                <Select value={form.action_type} onValueChange={v => setForm(p => ({ ...p, action_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="simples">Ação Simples</SelectItem>
                    <SelectItem value="tarefa">Tarefa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ACTION_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Data limite</Label><Input type="date" value={form.deadline} onChange={e => setForm(p => ({ ...p, deadline: e.target.value }))} /></div>
              <div><Label>Responsável</Label>
                <Select value={form.responsible_id || '_none'} onValueChange={v => setForm(p => ({ ...p, responsible_id: v === '_none' ? '' : v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Sem responsável</SelectItem>
                    {teamMembers.map((m: any) => <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button className="w-full" onClick={handleSave} disabled={!form.description.trim()}>Guardar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
