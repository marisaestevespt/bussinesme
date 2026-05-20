import { Fragment, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Gauge, Plus, Pencil, Trash2, Save, X, TrendingUp, TrendingDown } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, Tooltip as RTooltip } from 'recharts';
import { useDepartmentKpis, type DepartmentKpi } from '@/hooks/useDepartmentKpis';
import { useDepartmentKpiMonthly } from '@/hooks/useDepartmentKpiMonthly';
import { VALUE_SOURCES } from '@/hooks/usePlanningData';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SourceFilterFields } from './SourceFilterFields';
import { Zap } from 'lucide-react';
import { confirmDestructive } from '@/lib/confirmDestructive';
import { cn } from '@/lib/utils';

const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

interface Props {
  department: string;
  departmentLabel?: string;
  year: number;
}

function fmt(v: number | null | undefined, unit?: string | null) {
  if (v == null || isNaN(Number(v))) return '—';
  const n = Number(v);
  const s = Math.abs(n) >= 1000 ? n.toLocaleString('pt-PT') : String(n);
  return unit ? `${s} ${unit}` : s;
}

export function DepartmentKpiDashboard({ department, departmentLabel, year }: Props) {
  const { list: kpis, upsert: upsertKpi, remove: removeKpi } = useDepartmentKpis(department);
  const kpiIds = useMemo(() => kpis.map(k => k.id), [kpis]);
  const { list: monthly, upsert: upsertMonthly } = useDepartmentKpiMonthly(year, kpiIds);

  const [addingKpi, setAddingKpi] = useState(false);
  const [editingKpi, setEditingKpi] = useState<string | null>(null);
  const [cellDraft, setCellDraft] = useState<Record<string, string>>({});
  const [analysisDraft, setAnalysisDraft] = useState<Record<string, string>>({});

  // Index monthly rows: kpi_id -> month -> row
  const monthlyIdx = useMemo(() => {
    const idx: Record<string, Record<number, typeof monthly[number]>> = {};
    monthly.forEach(m => {
      if (!idx[m.kpi_id]) idx[m.kpi_id] = {};
      idx[m.kpi_id][m.month] = m;
    });
    return idx;
  }, [monthly]);

  const saveCell = (kpi: DepartmentKpi, month: number, field: 'target_value' | 'actual_value', raw: string) => {
    const existing = monthlyIdx[kpi.id]?.[month];
    const num = raw === '' ? null : Number(raw);
    if (raw !== '' && isNaN(num as number)) return;
    upsertMonthly.mutate({
      kpi_id: kpi.id,
      year,
      month,
      target_value: field === 'target_value' ? num : (existing?.target_value ?? null),
      actual_value: field === 'actual_value' ? num : (existing?.actual_value ?? null),
      analysis: existing?.analysis ?? null,
    });
  };

  const saveAnalysis = (kpi: DepartmentKpi, month: number, text: string) => {
    const existing = monthlyIdx[kpi.id]?.[month];
    upsertMonthly.mutate({
      kpi_id: kpi.id,
      year,
      month,
      target_value: existing?.target_value ?? null,
      actual_value: existing?.actual_value ?? null,
      analysis: text || null,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <Gauge className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-base font-semibold">KPIs do departamento — {year}</h2>
            <p className="text-xs text-muted-foreground">
              Métricas permanentes{departmentLabel ? ` para ${departmentLabel}` : ''}. Edita os valores mês a mês.
            </p>
          </div>
        </div>
        {!addingKpi && (
          <Button size="sm" variant="outline" onClick={() => setAddingKpi(true)}>
            <Plus className="h-4 w-4 mr-1" /> Novo KPI
          </Button>
        )}
      </div>

      {addingKpi && (
        <KpiForm
          initial={{ department }}
          onCancel={() => setAddingKpi(false)}
          onSave={(payload) => upsertKpi.mutate(payload, { onSuccess: () => setAddingKpi(false) })}
        />
      )}

      {kpis.length === 0 && !addingKpi ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
          Ainda sem KPIs. Cria o primeiro para começar a medir.
        </CardContent></Card>
      ) : (
        <>
          {/* Hero cards com sparklines */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {kpis.map((k) => {
              const months = monthlyIdx[k.id] || {};
              const series = MONTHS.map((_, i) => {
                const m = months[i + 1];
                return { m: MONTHS[i], actual: m?.actual_value != null ? Number(m.actual_value) : null, target: m?.target_value != null ? Number(m.target_value) : null };
              });
              const actuals = series.map(s => s.actual).filter((v): v is number => v != null);
              const ytdActual = actuals.reduce((a, b) => a + b, 0);
              const targets = series.map(s => s.target).filter((v): v is number => v != null);
              const ytdTarget = targets.reduce((a, b) => a + b, 0);
              const pct = ytdTarget > 0 ? Math.round((ytdActual / ytdTarget) * 100) : 0;
              const lastVal = actuals[actuals.length - 1];
              const prevVal = actuals[actuals.length - 2];
              const trend = lastVal != null && prevVal != null ? (lastVal >= prevVal ? 'up' : 'down') : null;

              return (
                <Card key={k.id} className="hq-card">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-sm leading-snug truncate">{k.name}</p>
                        {k.description && <p className="text-[11px] text-muted-foreground line-clamp-1">{k.description}</p>}
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0">
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditingKpi(k.id)} aria-label="Editar">
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          size="icon" variant="ghost" className="h-6 w-6 text-destructive"
                          onClick={async () => {
                            if (await confirmDestructive({ title: 'Remover KPI?', description: 'Esta ação não pode ser desfeita.' })) {
                              removeKpi.mutate(k.id);
                            }
                          }}
                          aria-label="Remover"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-2xl font-bold tabular-nums">{fmt(ytdActual, k.unit)}</span>
                      {ytdTarget > 0 && (
                        <span className="text-[11px] text-muted-foreground tabular-nums">/ {fmt(ytdTarget, k.unit)} YTD</span>
                      )}
                      {trend && (
                        trend === 'up'
                          ? <TrendingUp className="h-3.5 w-3.5 text-emerald-500 ml-auto" />
                          : <TrendingDown className="h-3.5 w-3.5 text-rose-500 ml-auto" />
                      )}
                    </div>
                    {ytdTarget > 0 && <Progress value={Math.min(100, pct)} className="h-1.5" />}
                    <div className="h-12 -mx-1">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={series}>
                          <RTooltip
                            cursor={{ stroke: 'hsl(var(--border))' }}
                            contentStyle={{ fontSize: 11, padding: 4, background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))' }}
                            formatter={(v: number) => fmt(v, k.unit)}
                          />
                          <Line type="monotone" dataKey="actual" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} connectNulls />
                          <Line type="monotone" dataKey="target" stroke="hsl(var(--muted-foreground))" strokeWidth={1} strokeDasharray="3 3" dot={false} connectNulls />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {editingKpi && (() => {
            const k = kpis.find(x => x.id === editingKpi);
            if (!k) return null;
            return (
              <KpiForm
                initial={k}
                onCancel={() => setEditingKpi(null)}
                onSave={(payload) => upsertKpi.mutate(payload, { onSuccess: () => setEditingKpi(null) })}
              />
            );
          })()}

          {/* Tabela mensal */}
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="text-left px-3 py-2 sticky left-0 bg-muted/40 z-10 min-w-[180px]">KPI</th>
                    <th className="text-center px-2 py-2 text-[10px] uppercase tracking-wider text-muted-foreground">Tipo</th>
                    {MONTHS.map((m) => (
                      <th key={m} className="text-center px-2 py-2 text-[10px] uppercase tracking-wider text-muted-foreground min-w-[64px]">{m}</th>
                    ))}
                    <th className="text-left px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground min-w-[200px]">Análise</th>
                  </tr>
                </thead>
                <tbody>
                  {kpis.map((k) => {
                    const months = monthlyIdx[k.id] || {};
                    // Análise: pegamos do mês atual ou último com dados
                    const currentMonth = new Date().getMonth() + 1;
                    const focusMonth = months[currentMonth] ? currentMonth :
                      Math.max(0, ...Object.keys(months).map(Number)) || currentMonth;
                    const focusRow = months[focusMonth];
                    const draftKey = `${k.id}:${focusMonth}`;
                    const analysisVal = analysisDraft[draftKey] ?? focusRow?.analysis ?? '';

                    return (
                      <Fragment key={k.id}>
                        {/* Linha META */}
                        <tr className="border-t border-border/40">
                          <td className="px-3 py-1.5 sticky left-0 bg-background z-10" rowSpan={2}>
                            <p className="font-medium text-sm">{k.name}</p>
                            {k.unit && <p className="text-[10px] text-muted-foreground">{k.unit}</p>}
                          </td>
                          <td className="px-2 py-1.5 text-center text-[10px] text-muted-foreground">Meta</td>
                          {MONTHS.map((_, i) => {
                            const m = i + 1;
                            const key = `${k.id}:${m}:t`;
                            const row = months[m];
                            const val = cellDraft[key] ?? (row?.target_value != null ? String(row.target_value) : '');
                            return (
                              <td key={m} className="px-1 py-0.5">
                                <Input
                                  className="h-7 text-xs text-center px-1 tabular-nums"
                                  value={val}
                                  onChange={(e) => setCellDraft({ ...cellDraft, [key]: e.target.value })}
                                  onBlur={(e) => {
                                    const v = e.target.value;
                                    const prev = row?.target_value != null ? String(row.target_value) : '';
                                    if (v !== prev) saveCell(k, m, 'target_value', v);
                                  }}
                                />
                              </td>
                            );
                          })}
                          <td className="px-3 py-1.5" rowSpan={2}>
                            <Textarea
                              className="text-xs min-h-[3.5rem]"
                              rows={2}
                              placeholder={focusRow?.auto_analysis || 'Análise…'}
                              value={analysisVal}
                              onChange={(e) => setAnalysisDraft({ ...analysisDraft, [draftKey]: e.target.value })}
                              onBlur={(e) => {
                                const prev = focusRow?.analysis ?? '';
                                if (e.target.value !== prev) saveAnalysis(k, focusMonth, e.target.value);
                              }}
                            />
                            {focusRow?.auto_analysis && (
                              <Badge variant="outline" className="text-[9px] mt-1">{MONTHS[focusMonth-1]}: {focusRow.auto_analysis}</Badge>
                            )}
                          </td>
                        </tr>
                        {/* Linha REAL */}
                        <tr className="border-b border-border/40 bg-muted/10">
                          <td className="px-2 py-1.5 text-center text-[10px] text-muted-foreground">Real</td>
                          {MONTHS.map((_, i) => {
                            const m = i + 1;
                            const key = `${k.id}:${m}:a`;
                            const row = months[m];
                            const val = cellDraft[key] ?? (row?.actual_value != null ? String(row.actual_value) : '');
                            const t = row?.target_value;
                            const a = row?.actual_value;
                            const ok = t != null && a != null && Number(a) >= Number(t);
                            const bad = t != null && a != null && Number(a) < Number(t);
                            return (
                              <td key={m} className="px-1 py-0.5">
                                <Input
                                  className={cn(
                                    'h-7 text-xs text-center px-1 tabular-nums font-medium',
                                    ok && 'text-emerald-600',
                                    bad && 'text-rose-600',
                                  )}
                                  value={val}
                                  onChange={(e) => setCellDraft({ ...cellDraft, [key]: e.target.value })}
                                  onBlur={(e) => {
                                    const v = e.target.value;
                                    const prev = row?.actual_value != null ? String(row.actual_value) : '';
                                    if (v !== prev) saveCell(k, m, 'actual_value', v);
                                  }}
                                />
                              </td>
                            );
                          })}
                        </tr>
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function KpiForm({
  initial,
  onCancel,
  onSave,
}: {
  initial: Partial<DepartmentKpi> & { department: string };
  onCancel: () => void;
  onSave: (payload: Partial<DepartmentKpi> & { department: string; name: string }) => void;
}) {
  const [name, setName] = useState(initial.name || '');
  const [description, setDescription] = useState(initial.description || '');
  const [unit, setUnit] = useState(initial.unit || '');
  const [valueSource, setValueSource] = useState<string>(initial.value_source || 'manual');
  const [sourceFilter, setSourceFilter] = useState<Record<string, string>>(
    (initial.source_filter as Record<string, string>) || {},
  );

  const submit = () => {
    if (!name.trim()) return;
    onSave({
      id: initial.id,
      department: initial.department,
      name: name.trim(),
      description: description || null,
      unit: unit || null,
      value_source: valueSource,
      source_filter: sourceFilter,
      is_active: true,
    });
  };

  return (
    <div className="rounded-lg border border-border/60 bg-muted/30 p-4 space-y-3">
      <div className="grid gap-2 sm:grid-cols-[2fr_1fr]">
        <div>
          <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Nome *</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: NPS, Taxa de conversão" />
        </div>
        <div>
          <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Unidade</label>
          <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="%, €, pontos…" />
        </div>
      </div>
      <div>
        <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Descrição</label>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Como medimos e porquê" />
      </div>
      <div className="space-y-2 rounded border border-border/40 bg-background p-3">
        <div className="flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5 text-primary" />
          <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Fonte do valor atual</label>
        </div>
        <Select value={valueSource} onValueChange={(v) => { setValueSource(v); setSourceFilter({}); }}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {VALUE_SOURCES.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {VALUE_SOURCES.find((s) => s.value === valueSource)?.desc && (
          <p className="text-[10px] text-muted-foreground">
            {VALUE_SOURCES.find((s) => s.value === valueSource)?.desc}
          </p>
        )}
        <SourceFilterFields source={valueSource} sourceFilter={sourceFilter} onChange={setSourceFilter} />
      </div>
      <div className="flex items-center justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onCancel}>
          <X className="h-3.5 w-3.5 mr-1" /> Cancelar
        </Button>
        <Button size="sm" onClick={submit} disabled={!name.trim()}>
          <Save className="h-3.5 w-3.5 mr-1" /> Guardar
        </Button>
      </div>
    </div>
  );
}