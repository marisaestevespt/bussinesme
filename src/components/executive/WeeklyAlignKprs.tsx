import { useMemo } from 'react';
import { useDepartmentKpis } from '@/hooks/useDepartmentKpis';
import { useDepartmentKpiMonthly } from '@/hooks/useDepartmentKpiMonthly';
import { useKpiAutoValue } from '@/hooks/useKpiAutoValue';
import { Gauge, Zap, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const AREAS = ['comercial','marketing','financeiro','clientes','operacao','equipa','produtos'] as const;
const LABELS: Record<string, string> = {
  comercial: 'Comercial',
  marketing: 'Marketing',
  financeiro: 'Financeiro',
  clientes: 'Clientes',
  operacao: 'Operação',
  equipa: 'Equipa',
  produtos: 'Produtos',
};

export function WeeklyAlignKprs({ year, month }: { year: number; month: number }) {
  const { list: kpis } = useDepartmentKpis();
  const ids = useMemo(() => kpis.map((k) => k.id), [kpis]);
  const { list: rows } = useDepartmentKpiMonthly(year, ids);
  const { resolve } = useKpiAutoValue(year, month);

  if (kpis.length === 0) return null;
  const monthRows = new Map(rows.filter((r) => r.month === month).map((r) => [r.kpi_id, r]));

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Gauge className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold uppercase tracking-wider">KPRs em foco — mês corrente</h3>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {AREAS.map((area) => {
          const areaKpis = kpis.filter((k) => k.department === area);
          if (areaKpis.length === 0) return null;
          return (
            <div key={area} className="rounded-md border border-border/60 bg-muted/10 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider">{LABELS[area]}</span>
                <Link to={`/executive/planeamento/${area}`} className="text-[10px] text-primary inline-flex items-center gap-1 hover:underline">
                  detalhe <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
              <div className="space-y-1.5">
                {areaKpis.map((k) => {
                  const row = monthRows.get(k.id);
                  const target = row?.target_value ?? null;
                  const isManual = !k.value_source || k.value_source === 'manual';
                  const auto = isManual ? null : resolve(k);
                  const actual = isManual ? row?.actual_value ?? null : auto;
                  let tone = 'text-muted-foreground';
                  let pct: string | null = null;
                  if (target != null && actual != null && Number(target) > 0) {
                    const diff = ((Number(actual) - Number(target)) / Number(target)) * 100;
                    tone = diff >= 0 ? 'text-emerald-600' : 'text-amber-600';
                    pct = `${diff >= 0 ? '+' : ''}${diff.toFixed(0)}%`;
                  }
                  return (
                    <div key={k.id} className="flex items-center justify-between gap-2 text-[11px]">
                      <div className="min-w-0 flex items-center gap-1">
                        {!isManual && <Zap className="h-2.5 w-2.5 text-primary shrink-0" />}
                        <span className="truncate">{k.name}</span>
                      </div>
                      <div className="tabular-nums shrink-0 flex items-center gap-2">
                        <span className={tone}>
                          {actual != null ? Number(actual).toLocaleString('pt-PT') : '—'}
                          {target != null && (
                            <span className="text-muted-foreground"> / {Number(target).toLocaleString('pt-PT')}</span>
                          )}
                        </span>
                        {pct && <span className={`text-[10px] ${tone}`}>{pct}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}