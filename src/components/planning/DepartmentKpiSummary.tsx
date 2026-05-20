import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Gauge, Zap, ArrowRight } from 'lucide-react';
import { useDepartmentKpis } from '@/hooks/useDepartmentKpis';
import { useDepartmentKpiMonthly } from '@/hooks/useDepartmentKpiMonthly';
import { useKpiAutoValue } from '@/hooks/useKpiAutoValue';

interface Props {
  department: string;
  /** Optional href to open the dept planning page (default /executive/planeamento/[dept]) */
  detailHref?: string;
}

/**
 * Compact horizontal chips showing target vs actual (current month) for a
 * department's KPRs. Used at the top of operational hubs.
 */
export function DepartmentKpiSummary({ department, detailHref }: Props) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const { list: kpis } = useDepartmentKpis(department);
  const kpiIds = useMemo(() => kpis.map((k) => k.id), [kpis]);
  const { list: rows } = useDepartmentKpiMonthly(year, kpiIds);
  const { resolve } = useKpiAutoValue(year, month);

  if (kpis.length === 0) return null;

  const monthRows = new Map(rows.filter((r) => r.month === month).map((r) => [r.kpi_id, r]));
  const href = detailHref ?? `/executive/planeamento/${department}`;

  return (
    <div className="flex items-center gap-2 flex-wrap rounded-md border border-border/60 bg-muted/10 px-3 py-2">
      <Gauge className="h-3.5 w-3.5 text-primary shrink-0" />
      <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mr-1">KPRs mês</span>
      {kpis.slice(0, 8).map((k) => {
        const row = monthRows.get(k.id);
        const target = row?.target_value ?? null;
        const isManual = !k.value_source || k.value_source === 'manual';
        const auto = isManual ? null : resolve(k);
        const actual = isManual ? row?.actual_value ?? null : auto;
        let toneCls = 'text-muted-foreground';
        if (target != null && actual != null && Number(target) > 0) {
          const diff = ((Number(actual) - Number(target)) / Number(target)) * 100;
          toneCls = diff >= 0 ? 'text-emerald-600' : 'text-amber-600';
        }
        return (
          <div
            key={k.id}
            className="inline-flex items-center gap-1.5 rounded border border-border/40 bg-background px-2 py-1 text-[11px]"
            title={k.description || k.name}
          >
            {!isManual && <Zap className="h-2.5 w-2.5 text-primary" />}
            <span className="font-medium truncate max-w-[140px]">{k.name}</span>
            <span className={`tabular-nums ${toneCls}`}>
              {actual != null ? Number(actual).toLocaleString('pt-PT') : '—'}
              {target != null && (
                <span className="text-muted-foreground"> / {Number(target).toLocaleString('pt-PT')}</span>
              )}
            </span>
          </div>
        );
      })}
      <Link
        to={href}
        className="ml-auto inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
      >
        Ver detalhe <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  );
}