import { useMemo } from 'react';
import { useDepartmentKpis } from '@/hooks/useDepartmentKpis';
import { useDepartmentKpiMonthly } from '@/hooks/useDepartmentKpiMonthly';
import { useKpiAutoValue } from '@/hooks/useKpiAutoValue';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Gauge, Zap } from 'lucide-react';
import { InlineEditableText } from '@/components/ui/inline-editable-text';
import { VALUE_SOURCES } from '@/hooks/usePlanningData';

interface Props {
  area: string;
  year: number;
  month: number;
}

export function KPRsInline({ area, year, month }: Props) {
  const { list: kpis } = useDepartmentKpis(area);
  const kpiIds = useMemo(() => kpis.map((k) => k.id), [kpis]);
  const { list: rows, upsert } = useDepartmentKpiMonthly(year, kpiIds);
  const { resolve } = useKpiAutoValue(year, month);

  const byKpi = useMemo(() => {
    const m = new Map<string, (typeof rows)[number]>();
    rows.filter((r) => r.month === month).forEach((r) => m.set(r.kpi_id, r));
    return m;
  }, [rows, month]);

  if (kpis.length === 0) return null;

  return (
    <div className="rounded-md border border-border/60 bg-muted/10 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/30">
        <Gauge className="h-3.5 w-3.5 text-primary" />
        <span className="text-[11px] font-semibold uppercase tracking-wider">Indicadores (KPRs)</span>
        <Badge variant="outline" className="text-[9px]">{kpis.length}</Badge>
      </div>
      <div className="grid grid-cols-[1fr_90px_90px_70px_1.5fr] gap-2 px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-medium border-t border-border/40">
        <span>KPR</span>
        <span className="text-right">Meta</span>
        <span className="text-right">Valor</span>
        <span className="text-right">Δ</span>
        <span>Análise</span>
      </div>
      <div className="divide-y divide-border/40">
        {kpis.map((k) => {
          const row = byKpi.get(k.id);
          const target = row?.target_value;
          const isManual = !k.value_source || k.value_source === 'manual';
          const auto = isManual ? null : resolve(k);
          const actual = isManual ? row?.actual_value ?? null : auto;
          let delta: { txt: string; tone: string } | null = null;
          if (target != null && actual != null && Number(target) > 0) {
            const diff = ((Number(actual) - Number(target)) / Number(target)) * 100;
            delta = {
              txt: `${diff >= 0 ? '+' : ''}${diff.toFixed(0)}%`,
              tone: diff >= 0 ? 'text-emerald-600' : 'text-amber-600',
            };
          }
          const sourceLabel = VALUE_SOURCES.find((s) => s.value === k.value_source)?.label;
          return (
            <div key={k.id} className="grid grid-cols-[1fr_90px_90px_70px_1.5fr] gap-2 px-3 py-2 items-center">
              <div className="min-w-0">
                <div className="text-xs truncate">{k.name}</div>
                <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                  {!isManual && <Zap className="h-2.5 w-2.5" />}
                  <span className="truncate">{!isManual ? sourceLabel : k.unit || 'manual'}</span>
                </div>
              </div>
              <Input
                type="number"
                defaultValue={target ?? ''}
                onBlur={(e) => {
                  const v = e.target.value === '' ? null : Number(e.target.value);
                  if (v !== (target ?? null)) {
                    upsert.mutate({ kpi_id: k.id, year, month, target_value: v, actual_value: row?.actual_value ?? null });
                  }
                }}
                className="h-7 text-xs text-right tabular-nums"
                placeholder="—"
              />
              {isManual ? (
                <Input
                  type="number"
                  defaultValue={row?.actual_value ?? ''}
                  onBlur={(e) => {
                    const v = e.target.value === '' ? null : Number(e.target.value);
                    if (v !== (row?.actual_value ?? null)) {
                      upsert.mutate({ kpi_id: k.id, year, month, actual_value: v, target_value: target ?? null });
                    }
                  }}
                  className="h-7 text-xs text-right tabular-nums"
                  placeholder="—"
                />
              ) : (
                <div className="h-7 px-2 flex items-center justify-end text-xs tabular-nums text-foreground bg-muted/20 rounded">
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
                      target_value: target ?? null,
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