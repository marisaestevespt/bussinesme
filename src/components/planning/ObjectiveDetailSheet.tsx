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
import { Plus, Trash2, Save, ListTodo, TrendingUp, TrendingDown, Minus, Sparkles } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { SourceFilterFields, getSourceFilters } from './SourceFilterFields';
import { planAreaLabel, planStatusLabel, PLAN_AREAS, PLAN_STATUSES, VALUE_SOURCES, CADENCES, ACTION_STATUSES, GOAL_STATUSES, MEASUREMENT_TYPES } from '@/hooks/usePlanningData';
import { useTeamData } from '@/hooks/useTeamData';
import { useProducts } from '@/hooks/useProducts';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';
import { EmptyHint } from '@/components/ui/loading-skeletons';

export function ObjectiveDetailSheet({ open, onClose, objective, planning }: any) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<any>({});
  const { products } = useProducts();
  const productsList = products.data || [];

  const obj = objective ? (planning.allObjectives.find((o: any) => o.id === objective.id) || objective) : null;

  const getProductName = (productId: string | null) => {
    if (!productId) return null;
    return productsList.find((p: any) => p.id === productId)?.name || null;
  };

  useEffect(() => {
    if (obj) {
      setForm({
        title: obj.title || '', description: obj.description || '', area: obj.area || 'geral',
        status: obj.status || 'por_iniciar', deadline: obj.deadline || '',
        objective_type: obj.objective_type || 'quantitativo', target_value: obj.target_value || '',
        target_unit: obj.target_unit || '€', current_value: obj.current_value || '',
        value_source: obj.value_source || 'manual', product_id: obj.product_id || '',
        measurement_type: obj.measurement_type || 'acumulativo',
        primary_metric_id: obj.primary_metric_id || '',
        source_filter: obj.source_filter || {},
        contribui_visao_5_anos: !!obj.contribui_visao_5_anos,
      });
      setEditing(false);
    }
  }, [obj?.id, obj?.updated_at]);

  if (!obj) return null;

  const objProductName = getProductName(obj.product_id);
  const prog = planning.objectiveProgress({ ...obj, product_name: objProductName });
  const currentVal = planning.objectiveCurrentValue({ ...obj, product_name: objProductName });
  const objCriteria = (planning.criteria.data || []).filter((c: any) => c.objective_id === obj.id);
  const objGoals = planning.allGoals.filter((g: any) => g.objective_id === obj.id);
  const objMetrics = planning.allMetrics.filter((m: any) => m.objective_id === obj.id);
  const objActions = planning.allActions.filter((a: any) => a.objective_id === obj.id);
  const set = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));

  const handleSaveHeader = () => {
    planning.upsertObjective.mutate({
      id: obj.id, ...form,
      product_id: form.product_id || null,
      primary_metric_id: form.primary_metric_id || null,
      source_filter: Object.keys(form.source_filter || {}).length > 0 ? form.source_filter : null,
    });
    setEditing(false);
  };

  return (
    <FullDialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <FullDialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <FullDialogHeader>
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1">
              {editing ? (
                <Input className="text-lg font-semibold" value={form.title} onChange={e => set('title', e.target.value)} />
              ) : (
                <FullDialogTitle className="text-lg">{obj.title}</FullDialogTitle>
              )}
              {!editing && obj.deadline && (
                <p className="text-sm text-muted-foreground">Prazo: {obj.deadline}</p>
              )}
            </div>
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
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Tipo de medição</Label>
                      <Select value={form.measurement_type || 'acumulativo'} onValueChange={v => set('measurement_type', v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{MEASUREMENT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div><Label>Valor alvo</Label><Input type="number" value={form.target_value} onChange={e => set('target_value', e.target.value)} /></div>
                    <div><Label>Unidade</Label><Input value={form.target_unit} onChange={e => set('target_unit', e.target.value)} /></div>
                    <div><Label>Fonte</Label>
                      <Select value={form.value_source || 'manual'} onValueChange={v => { set('value_source', v); set('source_filter', {}); }}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{VALUE_SOURCES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                      </Select>
                      {VALUE_SOURCES.find(s => s.value === form.value_source)?.desc && (
                        <p className="text-[10px] text-muted-foreground mt-1">{VALUE_SOURCES.find(s => s.value === form.value_source)?.desc}</p>
                      )}
                    </div>
                    {form.value_source === 'manual' && (
                      <div><Label>Valor atual</Label><Input type="number" value={form.current_value} onChange={e => set('current_value', e.target.value)} /></div>
                    )}
                    {form.value_source === 'metrica' && (
                      <div className="col-span-3">
                        <Label>Métrica principal</Label>
                        <Select value={form.primary_metric_id || 'none'} onValueChange={v => set('primary_metric_id', v === 'none' ? '' : v)}>
                          <SelectTrigger><SelectValue placeholder="Selecionar métrica" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Nenhuma</SelectItem>
                            {objMetrics.map((m: any) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground mt-1">O progresso será calculado a partir do valor atual desta métrica.</p>
                      </div>
                    )}
                    {(form.value_source === 'bd_vendas' || form.value_source === 'bd_crm') && (
                      <div><Label>Produto associado</Label>
                        <Select value={form.product_id || 'none'} onValueChange={v => set('product_id', v === 'none' ? '' : v)}>
                          <SelectTrigger><SelectValue placeholder="Todos os produtos" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Todos os produtos</SelectItem>
                            {productsList.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    {getSourceFilters(form.value_source).length > 0 && (
                      <div className="col-span-3">
                        <Label className="text-xs text-muted-foreground">Filtros (opcional)</Label>
                        <SourceFilterFields
                          source={form.value_source}
                          sourceFilter={form.source_filter || {}}
                          onChange={sf => set('source_filter', sf)}
                        />
                      </div>
                    )}
                  </div>
                </>
              )}
              <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/20">
                <div className="space-y-0.5">
                  <Label className="flex items-center gap-1.5 text-sm">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                    Contribui para a visão a 5 anos?
                  </Label>
                  <p className="text-[11px] text-muted-foreground">Marca este objetivo como pilar do plano de longo prazo.</p>
                </div>
                <Switch
                  checked={!!form.contribui_visao_5_anos}
                  onCheckedChange={(v) => set('contribui_visao_5_anos', v)}
                />
              </div>
            </div>
          ) : (
            <>
              {obj.description && <p className="text-sm text-muted-foreground">{obj.description}</p>}
              <div className="flex gap-2 flex-wrap">
                <Badge variant="outline">{planAreaLabel(obj.area)}</Badge>
                <Badge variant="outline">{obj.objective_type === 'quantitativo' ? 'Quantitativo' : 'Qualitativo'}</Badge>
                {obj.objective_type === 'quantitativo' && (
                  <Badge variant="outline">{MEASUREMENT_TYPES.find(t => t.value === obj.measurement_type)?.label || 'Acumulativo'}</Badge>
                )}
                <Badge variant={obj.status === 'atingido' ? 'default' : 'secondary'}>{planStatusLabel(obj.status)}</Badge>
                {obj.contribui_visao_5_anos && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge className="gap-1 bg-primary/10 text-primary border border-primary/30 hover:bg-primary/15">
                          <Sparkles className="h-3 w-3" /> Visão 5 anos
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>Este objetivo contribui para a tua visão a 5 anos.</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
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
                {obj.product_id && objProductName && (
                  <p className="text-xs text-muted-foreground mt-1">Produto: {objProductName}</p>
                )}
              </div>
            </div>
          )}

          {/* Qualitative criteria */}
          {obj.objective_type === 'qualitativo' && (
            <CriteriaSection objectiveId={obj.id} criteria={objCriteria} planning={planning} />
          )}

          <Separator />
          <GoalsSection objectiveId={obj.id} goals={objGoals} planning={planning} parentObjective={obj} />
          <Separator />
          <MetricsSection objectiveId={obj.id} metrics={objMetrics} planning={planning} productsList={productsList} getProductName={getProductName} />
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
      {criteria.length === 0 && <EmptyHint>Sem critérios definidos</EmptyHint>}
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

function GoalsSection({ objectiveId, goals, planning, parentObjective }: any) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ period: 'Janeiro', target_value: '', actual_value: '', status: 'por_iniciar' });

  const [editGoal, setEditGoal] = useState<any>(null);
  const [editForm, setEditForm] = useState({ period: 'Janeiro', target_value: '', actual_value: '', status: 'por_iniciar' });

  const isAutoSource = parentObjective?.value_source && parentObjective.value_source !== 'manual' && parentObjective.value_source !== 'metrica';
  const sourceLabel = VALUE_SOURCES.find(s => s.value === parentObjective?.value_source)?.label;

  useEffect(() => {
    if (editGoal) {
      setEditForm({
        period: editGoal.period || 'Janeiro',
        target_value: editGoal.target_value || '',
        actual_value: editGoal.actual_value || '',
        status: editGoal.status || 'por_iniciar',
      });
    }
  }, [editGoal]);

  const monthlyGoals = goals.filter((g: any) => MONTHS.includes(g.period));

  // Auto-calculate actual values from parent objective source
  const getGoalActual = (g: any) => {
    if (isAutoSource) {
      const auto = planning.goalAutoValue(parentObjective, g.period);
      return auto != null ? auto : g.actual_value;
    }
    return g.actual_value;
  };

  const quarterlyRows = Object.entries(QUARTER_MAP).map(([quarter, months]) => {
    const monthGoals = monthlyGoals.filter((g: any) => months.includes(g.period));
    if (monthGoals.length === 0) return null;
    const targetSum = monthGoals.reduce((s: number, g: any) => s + Number(g.target_value || 0), 0);
    const actualSum = monthGoals.reduce((s: number, g: any) => s + Number(getGoalActual(g) || 0), 0);
    const allDone = monthGoals.length === 3 && monthGoals.every((g: any) => g.status === 'atingido');
    const anyStarted = monthGoals.some((g: any) => g.status === 'em_curso' || g.status === 'atingido');
    return {
      period: quarter, target_value: targetSum, actual_value: actualSum, deviation: actualSum - targetSum,
      status: allDone ? 'atingido' : anyStarted ? 'em_curso' : 'por_iniciar', isQuarter: true, count: monthGoals.length,
    };
  }).filter(Boolean);

  const handleSave = () => {
    if (editGoal) {
      planning.upsertGoal.mutate({ id: editGoal.id, objective_id: objectiveId, ...editForm });
    } else {
      planning.upsertGoal.mutate({ ...form, objective_id: objectiveId });
    }
    setDialogOpen(false);
    setEditGoal(null);
    setForm({ period: 'Janeiro', target_value: '', actual_value: '', status: 'por_iniciar' });
  };

  const openNew = () => { setEditGoal(null); setForm({ period: 'Janeiro', target_value: '', actual_value: '', status: 'por_iniciar' }); setDialogOpen(true); };
  const openEdit = (g: any) => { setEditGoal(g); setDialogOpen(true); };

  const allRows = [
    ...monthlyGoals.map((g: any) => ({ ...g, isQuarter: false })),
    ...quarterlyRows,
  ].sort((a: any, b: any) => {
    const idxA = a.isQuarter ? MONTHS.indexOf(QUARTER_MAP[a.period]?.[2] || '') + 0.5 : MONTHS.indexOf(a.period);
    const idxB = b.isQuarter ? MONTHS.indexOf(QUARTER_MAP[b.period]?.[2] || '') + 0.5 : MONTHS.indexOf(b.period);
    return idxA - idxB;
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="text-sm font-semibold">Desdobramento em Metas</h3>
          {isAutoSource && (
            <p className="text-[10px] text-muted-foreground">Valores reais calculados automaticamente via {sourceLabel}</p>
          )}
        </div>
        <Button size="sm" variant="outline" onClick={openNew}><Plus className="h-3 w-3 mr-1" /> Nova Meta Mensal</Button>
      </div>
      {allRows.length === 0 ? <EmptyHint>Sem metas associadas. Defina metas mensais e os trimestres serão calculados automaticamente.</EmptyHint> : (
        <Table>
          <TableHeader><TableRow>
            <TableHead>Período</TableHead><TableHead>Valor alvo</TableHead><TableHead>Valor real</TableHead><TableHead>Desvio</TableHead><TableHead>Status</TableHead><TableHead></TableHead>
          </TableRow></TableHeader>
          <TableBody>{allRows.map((g: any) => {
            const actualVal = g.isQuarter ? g.actual_value : getGoalActual(g);
            const dev = actualVal != null && g.target_value ? (Number(actualVal) - Number(g.target_value)) : null;
            const hasDeviation = dev !== null && dev < 0;
            const goalWithActual = { ...g, actual_value: actualVal };
            const autoStatus = !g.isQuarter ? planning.computeGoalStatus(goalWithActual) : g.status;
            return (
              <TableRow key={g.isQuarter ? g.period : g.id} className={`${!g.isQuarter ? 'cursor-pointer hover:bg-muted/60' : ''} ${g.isQuarter ? 'bg-muted/40 font-medium' : ''} ${hasDeviation ? 'bg-destructive/5' : ''}`} onClick={() => { if (!g.isQuarter) openEdit(g); }}>
                <TableCell className="text-sm">{g.period}</TableCell>
                <TableCell className="">{g.target_value || '—'}</TableCell>
                <TableCell className="">
                  {actualVal != null ? Number(actualVal).toLocaleString('pt-PT') : '—'}
                  {isAutoSource && !g.isQuarter && actualVal != null && <span className="text-[9px] text-muted-foreground ml-1">(auto)</span>}
                </TableCell>
                <TableCell className={` ${hasDeviation ? 'text-destructive font-medium' : ''}`}>{dev != null ? (dev >= 0 ? `+${dev}` : dev) : '—'}</TableCell>
                <TableCell>
                  <Badge variant={autoStatus === 'atingido' ? 'default' : autoStatus === 'nao_atingido' ? 'destructive' : 'secondary'} className="text-[10px]">{planStatusLabel(autoStatus)}</Badge>
                  {autoStatus !== g.status && !g.isQuarter && <span className="text-[9px] text-muted-foreground ml-1">(auto)</span>}
                </TableCell>
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

      <Dialog open={dialogOpen} onOpenChange={v => { if (!v) { setDialogOpen(false); setEditGoal(null); } else setDialogOpen(true); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editGoal ? 'Editar Meta' : 'Nova Meta Mensal'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Mês</Label>
              <Select value={editGoal ? editForm.period : form.period} onValueChange={v => editGoal ? setEditForm(p => ({ ...p, period: v })) : setForm(p => ({ ...p, period: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{MONTHS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className={isAutoSource ? '' : 'grid grid-cols-2 gap-3'}>
              <div><Label>Valor alvo</Label><Input value={editGoal ? editForm.target_value : form.target_value} onChange={e => editGoal ? setEditForm(p => ({ ...p, target_value: e.target.value })) : setForm(p => ({ ...p, target_value: e.target.value }))} /></div>
              {!isAutoSource && (
                <div><Label>Valor real</Label><Input value={editGoal ? editForm.actual_value : form.actual_value} onChange={e => editGoal ? setEditForm(p => ({ ...p, actual_value: e.target.value })) : setForm(p => ({ ...p, actual_value: e.target.value }))} /></div>
              )}
            </div>
            {isAutoSource && (
              <p className="text-xs text-muted-foreground">O valor real é calculado automaticamente a partir de: {sourceLabel}</p>
            )}
            <div><Label>Status</Label>
              <Select value={editGoal ? editForm.status : form.status} onValueChange={v => editGoal ? setEditForm(p => ({ ...p, status: v })) : setForm(p => ({ ...p, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{GOAL_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button className="w-full" onClick={handleSave}>Guardar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Metrics ─────────────
function MetricsSection({ objectiveId, metrics, planning, productsList, getProductName }: any) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [historyMetric, setHistoryMetric] = useState<any>(null);
  const [recordDialog, setRecordDialog] = useState(false);
  const [editMetric, setEditMetric] = useState<any>(null);
  const [form, setForm] = useState({ name: '', cadence: 'mensal', source: 'manual', target_value: '', target_unit: '', green_threshold: '90', yellow_threshold: '60', product_id: '', measurement_type: 'acumulativo' });
  const [editForm, setEditForm] = useState<any>({});
  const [recordForm, setRecordForm] = useState({ value: '', notes: '', recorded_at: format(new Date(), 'yyyy-MM-dd') });

  useEffect(() => {
    if (editMetric) {
      setEditForm({
        name: editMetric.name || '', cadence: editMetric.cadence || 'mensal', source: editMetric.source || 'manual',
        current_value: editMetric.current_value || '', target_value: editMetric.target_value || '',
        target_unit: editMetric.target_unit || '', green_threshold: editMetric.green_threshold ?? 90,
        yellow_threshold: editMetric.yellow_threshold ?? 60, product_id: editMetric.product_id || '',
        measurement_type: editMetric.measurement_type || 'acumulativo',
      });
    }
  }, [editMetric]);

  const getMetricStatus = (m: any) => {
    const metricProductName = getProductName(m.product_id);
    const autoVal = m.source !== 'manual' ? planning.getAutoValue(m.source, metricProductName) : null;
    const current = m.source === 'manual' ? Number(m.current_value || 0) : Number(autoVal || 0);
    const target = Number(m.target_value || 0);
    if (!target) return 'neutral';
    const pct = (current / target) * 100;
    if (pct >= (m.green_threshold ?? 90)) return 'green';
    if (pct >= (m.yellow_threshold ?? 60)) return 'yellow';
    return 'red';
  };

  const handleSaveNew = () => {
    planning.upsertMetric.mutate({ ...form, product_id: form.product_id || null, measurement_type: form.measurement_type || 'acumulativo', target_value: form.target_value ? Number(form.target_value) : null, green_threshold: Number(form.green_threshold), yellow_threshold: Number(form.yellow_threshold), objective_id: objectiveId });
    setDialogOpen(false);
    setForm({ name: '', cadence: 'mensal', source: 'manual', target_value: '', target_unit: '', green_threshold: '90', yellow_threshold: '60', product_id: '', measurement_type: 'acumulativo' });
  };

  const handleSaveEdit = () => {
    if (!editMetric) return;
    planning.upsertMetric.mutate({
      id: editMetric.id, objective_id: objectiveId, ...editForm,
      product_id: editForm.product_id || null,
      measurement_type: editForm.measurement_type || 'acumulativo',
      target_value: editForm.target_value ? Number(editForm.target_value) : null,
      green_threshold: Number(editForm.green_threshold), yellow_threshold: Number(editForm.yellow_threshold),
    });
    setEditMetric(null);
  };

  const handleRecord = () => {
    if (!historyMetric) return;
    planning.addMetricRecord.mutate({ metric_id: historyMetric.id, value: Number(recordForm.value), notes: recordForm.notes, recorded_at: recordForm.recorded_at });
    setRecordDialog(false);
    setRecordForm({ value: '', notes: '', recorded_at: format(new Date(), 'yyyy-MM-dd') });
  };

  const allHistory = planning.metricHistory.data || [];
  const statusColors: Record<string, string> = { green: 'bg-success', yellow: 'bg-warning', red: 'bg-destructive', neutral: 'bg-muted' };
  const statusLabels: Record<string, string> = { green: 'No caminho', yellow: 'Atenção', red: 'Em risco', neutral: 'Sem objetivo' };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold">Métricas de Acompanhamento</h3>
        <Button size="sm" variant="outline" onClick={() => setDialogOpen(true)}><Plus className="h-3 w-3 mr-1" /> Nova Métrica</Button>
      </div>
      {metrics.length === 0 ? <EmptyHint>Sem métricas definidas</EmptyHint> : (
        <Table>
          <TableHeader><TableRow>
            <TableHead>Métrica</TableHead><TableHead>Cadência</TableHead><TableHead>Valor atual</TableHead><TableHead>Objetivo</TableHead><TableHead>Estado</TableHead><TableHead>Última atualiz.</TableHead><TableHead></TableHead>
          </TableRow></TableHeader>
          <TableBody>{metrics.map((m: any) => {
            const overdue = planning.isMetricOverdue(m);
            const dueToday = planning.isMetricDueToday(m);
            const metricProductName = getProductName(m.product_id);
            const autoVal = m.source !== 'manual' ? planning.getAutoValue(m.source, metricProductName) : null;
            const displayVal = m.source === 'manual' ? m.current_value : autoVal;
            const status = getMetricStatus(m);
            return (
              <TableRow key={m.id} className={`cursor-pointer hover:bg-muted/60 ${overdue ? 'bg-destructive/15' : dueToday ? 'bg-warning/15' : ''}`} onClick={() => setEditMetric(m)}>
                <TableCell className="text-sm font-medium">{m.name}</TableCell>
                <TableCell className="">{CADENCES.find(c => c.value === m.cadence)?.label || m.cadence}</TableCell>
                <TableCell className="">{displayVal != null ? `${Number(displayVal).toLocaleString()} ${m.target_unit || ''}` : '—'}</TableCell>
                <TableCell className="">{m.target_value ? `${Number(m.target_value).toLocaleString()} ${m.target_unit || ''}` : '—'}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className={`inline-block h-2.5 w-2.5 rounded-full ${statusColors[status]}`} />
                    <span className="text-xs">{statusLabels[status]}</span>
                  </div>
                </TableCell>
                <TableCell className="">{m.last_updated_at ? new Date(m.last_updated_at).toLocaleDateString('pt-PT') : '—'}</TableCell>
                <TableCell className="flex gap-1">
                  <button className="text-muted-foreground hover:text-foreground" onClick={e => { e.stopPropagation(); setHistoryMetric(m); }} title="Histórico"><TrendingUp className="h-3 w-3" /></button>
                  <button onClick={e => { e.stopPropagation(); planning.deleteMetric.mutate(m.id); }}><Trash2 className="h-3 w-3 text-muted-foreground" /></button>
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
        const chartData = records.map((r: any) => ({ date: r.recorded_at, value: Number(r.value), ...(m.target_value ? { target: Number(m.target_value) } : {}) }));
        return (
          <div key={m.id} className="mt-4">
            <p className="text-xs font-medium mb-1">{m.name} — Tendência {m.target_value ? `(objetivo: ${Number(m.target_value).toLocaleString()} ${m.target_unit || ''})` : ''}</p>
            <ResponsiveContainer width="100%" height={120}>
              <LineChart data={chartData}>
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} width={40} />
                <Tooltip />
                <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                {m.target_value && <Line type="monotone" dataKey="target" stroke="hsl(var(--destructive))" strokeWidth={1} strokeDasharray="4 4" dot={false} />}
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
            <div><Label>Tipo de medição</Label>
              <Select value={form.measurement_type || 'acumulativo'} onValueChange={v => setForm(p => ({ ...p, measurement_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{MEASUREMENT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                {form.measurement_type === 'progressivo'
                  ? 'Valor absoluto atual (ex: seguidores, clientes ativos)'
                  : 'Soma de registos no período (ex: faturação, vendas)'}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Valor objetivo</Label><Input type="number" value={form.target_value} onChange={e => setForm(p => ({ ...p, target_value: e.target.value }))} /></div>
              <div><Label>Unidade</Label><Input value={form.target_unit} onChange={e => setForm(p => ({ ...p, target_unit: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>% "No caminho"</Label><Input type="number" value={form.green_threshold} onChange={e => setForm(p => ({ ...p, green_threshold: e.target.value }))} /></div>
              <div><Label>% "Atenção"</Label><Input type="number" value={form.yellow_threshold} onChange={e => setForm(p => ({ ...p, yellow_threshold: e.target.value }))} /></div>
            </div>
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
            {(form.source === 'bd_vendas' || form.source === 'bd_crm') && (
              <div><Label>Produto associado</Label>
                <Select value={form.product_id || 'none'} onValueChange={v => setForm(p => ({ ...p, product_id: v === 'none' ? '' : v }))}>
                  <SelectTrigger><SelectValue placeholder="Todos os produtos" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Todos os produtos</SelectItem>
                    {productsList.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button className="w-full" onClick={handleSaveNew} disabled={!form.name.trim()}>Guardar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit metric dialog */}
      <Dialog open={!!editMetric} onOpenChange={v => { if (!v) setEditMetric(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Editar Métrica</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome</Label><Input value={editForm.name || ''} onChange={e => setEditForm((p: any) => ({ ...p, name: e.target.value }))} /></div>
            <div><Label>Tipo de medição</Label>
              <Select value={editForm.measurement_type || 'acumulativo'} onValueChange={v => setEditForm((p: any) => ({ ...p, measurement_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{MEASUREMENT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                {editForm.measurement_type === 'progressivo'
                  ? 'Valor absoluto atual (ex: seguidores, clientes ativos)'
                  : 'Soma de registos no período (ex: faturação, vendas)'}
              </p>
            </div>
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
            {(editForm.source === 'bd_vendas' || editForm.source === 'bd_crm') && (
              <div><Label>Produto associado</Label>
                <Select value={editForm.product_id || 'none'} onValueChange={v => setEditForm((p: any) => ({ ...p, product_id: v === 'none' ? '' : v }))}>
                  <SelectTrigger><SelectValue placeholder="Todos os produtos" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Todos os produtos</SelectItem>
                    {productsList.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button className="w-full" onClick={handleSaveEdit}>Guardar</Button>
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
                      <TableCell className="">{r.recorded_at}</TableCell>
                      <TableCell className="">{Number(r.value).toLocaleString()}</TableCell>
                      <TableCell className="">{r.notes || '—'}</TableCell>
                    </TableRow>
                  ))}
                  {allHistory.filter((r: any) => r.metric_id === historyMetric.id).length === 0 && (
                    <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-4">Sem registos</TableCell></TableRow>
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
  const [editAction, setEditAction] = useState<any>(null);
  const [form, setForm] = useState({ description: '', action_type: 'simples', status: 'por_fazer', deadline: '', responsible_id: '' });
  const [editForm, setEditForm] = useState<any>({});
  const { members } = useTeamData({ members: true });
  const teamMembers = members.data || [];

  useEffect(() => {
    if (editAction) {
      setEditForm({
        description: editAction.description || '', action_type: editAction.action_type || 'simples',
        status: editAction.status || 'por_fazer', deadline: editAction.deadline || '',
        responsible_id: editAction.responsible_id || '',
      });
    }
  }, [editAction]);

  const handleSaveNew = () => {
    planning.upsertAction.mutate({ ...form, objective_id: objectiveId });
    setDialogOpen(false);
    setForm({ description: '', action_type: 'simples', status: 'por_fazer', deadline: '', responsible_id: '' });
  };

  const handleSaveEdit = () => {
    if (!editAction) return;
    planning.upsertAction.mutate({ id: editAction.id, objective_id: objectiveId, ...editForm });
    setEditAction(null);
  };

  const openNew = () => { setEditAction(null); setForm({ description: '', action_type: 'simples', status: 'por_fazer', deadline: '', responsible_id: '' }); setDialogOpen(true); };
  const openEdit = (a: any) => { setEditAction(a); };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold">Ações</h3>
        <Button size="sm" variant="outline" onClick={openNew}><Plus className="h-3 w-3 mr-1" /> Nova Ação</Button>
      </div>
      {actions.length === 0 ? <EmptyHint>Sem ações definidas</EmptyHint> : (
        <Table>
          <TableHeader><TableRow>
            <TableHead>Descrição</TableHead><TableHead>Tipo</TableHead><TableHead>Status</TableHead><TableHead>Deadline</TableHead><TableHead></TableHead>
          </TableRow></TableHeader>
          <TableBody>{actions.map((a: any) => (
            <TableRow key={a.id} className="cursor-pointer hover:bg-muted/60" onClick={() => openEdit(a)}>
              <TableCell className="text-sm">{a.description}</TableCell>
              <TableCell className="">{a.action_type === 'tarefa' ? 'Tarefa' : 'Ação Simples'}</TableCell>
              <TableCell><Badge variant={a.status === 'feito' ? 'default' : 'secondary'} className="text-[10px]">{planStatusLabel(a.status)}</Badge></TableCell>
              <TableCell className="">{a.deadline || '—'}</TableCell>
              <TableCell className="flex gap-1">
                {a.action_type !== 'tarefa' && !a.task_id && (
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={e => { e.stopPropagation(); planning.convertActionToTask.mutate(a); }}>
                    <ListTodo className="h-3 w-3 mr-1" /> Tarefa
                  </Button>
                )}
                {a.task_id && <Badge variant="outline" className="text-[10px]">Tarefa criada</Badge>}
                <button onClick={e => { e.stopPropagation(); planning.deleteAction.mutate(a.id); }}><Trash2 className="h-3 w-3 text-muted-foreground" /></button>
              </TableCell>
            </TableRow>
          ))}</TableBody>
        </Table>
      )}

      {/* New Action dialog */}
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
            <Button className="w-full" onClick={handleSaveNew} disabled={!form.description.trim()}>Guardar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Action dialog */}
      <Dialog open={!!editAction} onOpenChange={v => { if (!v) setEditAction(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Editar Ação</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Descrição</Label><Textarea value={editForm.description || ''} onChange={e => setEditForm((p: any) => ({ ...p, description: e.target.value }))} rows={2} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Tipo</Label>
                <Select value={editForm.action_type || 'simples'} onValueChange={v => setEditForm((p: any) => ({ ...p, action_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="simples">Ação Simples</SelectItem>
                    <SelectItem value="tarefa">Tarefa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Status</Label>
                <Select value={editForm.status || 'por_fazer'} onValueChange={v => setEditForm((p: any) => ({ ...p, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ACTION_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Data limite</Label><Input type="date" value={editForm.deadline || ''} onChange={e => setEditForm((p: any) => ({ ...p, deadline: e.target.value }))} /></div>
              <div><Label>Responsável</Label>
                <Select value={editForm.responsible_id || '_none'} onValueChange={v => setEditForm((p: any) => ({ ...p, responsible_id: v === '_none' ? '' : v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Sem responsável</SelectItem>
                    {teamMembers.map((m: any) => <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button className="w-full" onClick={handleSaveEdit}>Guardar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
