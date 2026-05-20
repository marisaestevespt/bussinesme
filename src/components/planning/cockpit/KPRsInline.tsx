import { useMemo, useState } from 'react';
import { useDepartmentKpis } from '@/hooks/useDepartmentKpis';
import { useDepartmentKpiMonthly } from '@/hooks/useDepartmentKpiMonthly';
import { useKpiAutoValueRange, quarterRange } from '@/hooks/useKpiAutoValue';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Gauge, Zap } from 'lucide-react';
import { InlineEditableText } from '@/components/ui/inline-editable-text';
import { VALUE_SOURCES } from '@/hooks/usePlanningData';

type Period = 'month' | 'quarter' | 'year';

interface Props {
  area: string;
  year: number;
  month: number;
  /** Default visible period; user can toggle in the header */
  period?: Period;
  /** Hide the toggle (e.g., annual cockpit forces 'year') */
  lockPeriod?: boolean;
}

export function KPRsInline({ area, year, month, period: initialPeriod = 'month', lockPeriod = false }: Props) {
  const [period, setPeriod] = useState<Period>(initialPeriod);
  const { list: kpis } = useDepartmentKpis(area);
  const kpiIds = useMemo(() => kpis.map((k) => k.id), [kpis]);
  const { list: rows, upsert } = useDepartmentKpiMonthly(year, kpiIds);

  const quarter = Math.ceil(month / 3);
  const [qStart, qEnd] = quarterRange(quarter);
  const range: [number, number] =
    period === 'month' ? [month, month] : period === 'quarter' ? [qStart, qEnd] : [1, 12];
  const { resolve } = useKpiAutoValueRange(year, range[0], range[1]);

  const byKpi = useMemo(() => {
    const m = new Map<string, (typeof rows)[number]>();
    rows.filter((r) => r.month === month).forEach((r) => m.set(r.kpi_id, r));
    return m;
  }, [rows, month]);

  // Aggregated actuals for manual KPRs (sum of monthly actuals across the period range)
  const aggManualActual = useMemo(() => {
    const agg = new Map<string, number | null>();
    kpis.forEach((k) => {
      const sum = rows
        .filter((r) => r.kpi_id === k.id && r.month >= range[0] && r.month <= range[1])
        .reduce<number | null>((s, r) => {
          if (r.actual_value == null) return s;
          return (s ?? 0) + Number(r.actual_value);
        }, null);
      agg.set(k.id, sum);
    });
    return agg;
  }, [kpis, rows, range]);

  const periodLabel = period === 'month' ? 'Mensal' : period === 'quarter' ? `T${quarter}` : 'Anual';

  if (kpis.length === 0) return null;

  return (
    <div className="rounded-md border border-border/60 bg-muted/10 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/30">
        <Gauge className="h-3.5 w-3.5 text-primary" />
        <span className="text-[11px] font-semibold uppercase tracking-wider">Indicadores (KPRs)</span>
        <Badge variant="outline" className="text-[9px]">{kpis.length}</Badge>
        {!lockPeriod && (
          <div className="ml-auto inline-flex rounded-md border border-border/60 overflow-hidden text-[10px]">
            {(['month','quarter','year'] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-2 py-0.5 ${period === p ? 'bg-primary/10 text-primary font-semibold' : 'text-muted-foreground hover:bg-muted/50'}`}
              >
                {p === 'month' ? 'M' : p === 'quarter' ? `T${quarter}` : 'A'}
              </button>
            ))}
          </div>
        )}
        {lockPeriod && (
          <span className="ml-auto text-[10px] text-muted-foreground">{periodLabel}</span>
        )}
      </div>
      <div className="grid grid-cols-[1fr_90px_90px_70px_1.5fr] gap-2 px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-medium border-t border-border/40">
        <span>KPR</span>
        <span className="text-right">Meta {periodLabel}</span>
        <span className="text-right">Real</span>
        <span className="text-right">Δ</span>
        <span>Análise</span>
      </div>
      <div className="divide-y divide-border/40">
        {kpis.map((k) => {
          const row = byKpi.get(k.id);
          const monthlyTarget = row?.target_value ?? null;
          const target =
            period === 'month'
              ? monthlyTarget
              : period === 'quarter'
                ? (k.quarterly_target ?? null)
                : (k.annual_target ?? null);
          const isManual = !k.value_source || k.value_source === 'manual';
          const auto = isManual ? null : resolve(k);
          const actual = isManual
            ? (period === 'month' ? (row?.actual_value ?? null) : (aggManualActual.get(k.id) ?? null))
            : auto;
          let delta: { txt: string; tone: string } | null = null;
          if (target != null && actual != null && Number(target) > 0) {
            const diff = ((Number(actual) - Number(target)) / Number(target)) * 100;
            delta = {
              txt: `${diff >= 0 ? '+' : ''}${diff.toFixed(0)}%`,
              tone: diff >= 0 ? 'text-emerald-600' : 'text-amber-600',
            };
          }
          const sourceLabel = VALUE_SOURCES.find((s) => s.value === k.value_source)?.label;
          const targetEditable = period === 'month';
          return (
            <div key={k.id} className="grid grid-cols-[1fr_90px_90px_70px_1.5fr] gap-2 px-3 py-2 items-center">
              <div className="min-w-0">
                <div className="text-xs truncate">{k.name}</div>
                <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                  {!isManual && <Zap className="h-2.5 w-2.5" />}
                  <span className="truncate">{!isManual ? sourceLabel : k.unit || 'manual'}</span>
                </div>
              </div>
              {targetEditable ? (
                <Input
                  type="number"
                  defaultValue={target ?? ''}
                  onBlur={(e) => {
                    const v = e.target.value === '' ? null : Number(e.target.value);
                    if (v !== (monthlyTarget ?? null)) {
                      upsert.mutate({ kpi_id: k.id, year, month, target_value: v, actual_value: row?.actual_value ?? null });
                    }
                  }}
                  className="h-7 text-xs text-right tabular-nums border-0 bg-transparent shadow-none px-1 focus-visible:ring-1 focus-visible:ring-ring/40 hover:bg-muted/40"
                  placeholder="—"
                />
              ) : (
                <div className="h-7 px-2 flex items-center justify-end text-xs tabular-nums text-muted-foreground">
                  {target != null ? Number(target).toLocaleString('pt-PT') : '—'}
                </div>
              )}
              {isManual && period === 'month' ? (
                <Input
                  type="number"
                  defaultValue={row?.actual_value ?? ''}
                  onBlur={(e) => {
                    const v = e.target.value === '' ? null : Number(e.target.value);
                    if (v !== (row?.actual_value ?? null)) {
                      upsert.mutate({ kpi_id: k.id, year, month, actual_value: v, target_value: monthlyTarget ?? null });
                    }
                  }}
                  className={cn(
                    'h-7 text-xs text-right tabular-nums font-medium border-0 bg-transparent shadow-none px-1',
                    'focus-visible:ring-1 focus-visible:ring-ring/40 hover:bg-muted/40',
                  )}
                  placeholder="—"
                />
              ) : (
                <div className="h-7 px-2 flex items-center justify-end text-xs tabular-nums font-medium text-foreground">
                  {actual != null ? Number(actual).toLocaleString('pt-PT') : '—'}
                </div>
              )}
              <div className={`text-[11px] text-right tabular-nums ${delta?.tone || 'text-muted-foreground'}`}>
                {delta?.txt || '—'}
              </div>
              <div className="min-w-0">
                <InlineEditableText
                  value={row?.analysis || ''}
                  emptyText={row?.auto_analysis || 'Adicionar análise…'}
                  placeholder={row?.auto_analysis || 'Porquê? Que ação tomar?'}
                  multiline
                  rows={1}
                  onSave={(v) =>
                    upsert.mutate({
                      kpi_id: k.id,
                      year,
                      month,
                      analysis: v,
                      target_value: monthlyTarget ?? null,
                      actual_value: row?.actual_value ?? null,
                    })
                  }
                  displayClassName="text-[11px] text-muted-foreground"
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}