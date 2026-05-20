import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Compass, ArrowRight } from 'lucide-react';
import { useDepartmentKpis } from '@/hooks/useDepartmentKpis';
import { useDepartmentKpiMonthly } from '@/hooks/useDepartmentKpiMonthly';
import { useKpiAutoValue } from '@/hooks/useKpiAutoValue';

interface Props {
  department: string;
  /** Optional href to override the default planning route */
  detailHref?: string;
}

/**
 * Slim banner shown at the top of operational hubs that gives a one-line
 * pulse for the area's KPRs (this month) and a clear CTA to the dedicated
 * planning & analysis page. Replaces the previous chip-row to reduce noise
 * and create a single, unambiguous entry point for planning work.
 */
export function DepartmentKpiSummary({ department, detailHref }: Props) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const { list: kpis } = useDepartmentKpis(department);
  const kpiIds = useMemo(() => kpis.map((k) => k.id), [kpis]);
  const { list: rows } = useDepartmentKpiMonthly(year, kpiIds);
  const { resolve } = useKpiAutoValue(year, month);

  const href = detailHref ?? `/planeamento/dep/${department}`;

  // Compute pulse: how many KPRs are on/above target this month
  const { onTrack, total } = useMemo(() => {
    const monthRows = new Map(rows.filter((r) => r.month === month).map((r) => [r.kpi_id, r]));
    let on = 0;
    let counted = 0;
    kpis.forEach((k) => {
      const row = monthRows.get(k.id);
      const target = row?.target_value;
      const isManual = !k.value_source || k.value_source === 'manual';
      const actual = isManual ? row?.actual_value : resolve(k);
      if (target != null && actual != null && Number(target) > 0) {
        counted += 1;
        if (Number(actual) >= Number(target)) on += 1;
      }
    });
    return { onTrack: on, total: counted };
  }, [kpis, rows, month, resolve]);

  // Always render the CTA so members know where to plan, even with no KPRs yet
  const noKprs = kpis.length === 0;
  const noMeasured = !noKprs && total === 0;

  let pulseText: string;
  let toneCls = 'text-muted-foreground';
  if (noKprs) {
    pulseText = 'Define os indicadores desta área para acompanhares o progresso.';
  } else if (noMeasured) {
    pulseText = `${kpis.length} ${kpis.length === 1 ? 'indicador definido' : 'indicadores definidos'} · sem metas/valores este mês`;
  } else {
    pulseText = `${onTrack}/${total} no caminho este mês`;
    toneCls = onTrack === total ? 'text-emerald-600' : onTrack >= total / 2 ? 'text-foreground' : 'text-amber-600';
  }

  return (
    <Link
      to={href}
      className="group flex items-center gap-3 rounded-lg border border-border/60 bg-muted/10 px-4 py-2.5 hover:bg-muted/30 hover:border-border hq-transition"
    >
      <Compass className="h-4 w-4 text-primary shrink-0" />
      <div className="flex-1 min-w-0 flex items-baseline gap-2 flex-wrap">
        <span className="text-[11px] uppercase tracking-wider font-semibold">Planeamento &amp; Análise</span>
        <span className={`text-xs ${toneCls} truncate`}>{pulseText}</span>
      </div>
      <span className="inline-flex items-center gap-1 text-xs text-primary font-medium shrink-0">
        Abrir <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 hq-transition" />
      </span>
    </Link>
  );
}