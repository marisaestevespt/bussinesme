import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const MONTHS = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
];
const QUARTER_MONTHS: Record<string, string[]> = {
  T1: ['Janeiro','Fevereiro','Março'],
  T2: ['Abril','Maio','Junho'],
  T3: ['Julho','Agosto','Setembro'],
  T4: ['Outubro','Novembro','Dezembro'],
};
/**
 * Cascade strip shown under an annual objective: Anual → T1..T4.
 * Reads target from planning_goals (if defined for that period) and the actual
 * from monthly goals aggregated for the period (and falls back to
 * `planning.goalAutoValue` so it stays in sync with auto-tracked sources).
 */
export function ObjectiveCascadeRow({ objective, planning }: { objective: any; planning: any }) {
  const goals: any[] = useMemo(
    () => (planning.allGoals || []).filter((g: any) => g.objective_id === objective.id),
    [planning.allGoals, objective.id],
  );

  const annualTarget = Number(objective.target_value || 0) || null;
  const annualActual = useMemo(() => {
    // Sum monthly actuals (auto if available) for the year
    let sum = 0; let any = false;
    MONTHS.forEach((m) => {
      const mg = goals.find((g: any) => g.period === m);
      const auto = typeof planning.goalAutoValue === 'function'
        ? Number(planning.goalAutoValue(objective, m) ?? 0)
        : 0;
      const v = auto > 0 ? auto : Number(mg?.actual_value || 0);
      if (mg || auto > 0) any = true;
      sum += v;
    });
    return any ? sum : null;
  }, [goals, objective, planning]);

  const aggregateFor = (months: string[]) => {
    let target = 0; let actual = 0; let any = false;
    months.forEach((m) => {
      const mg = goals.find((g: any) => g.period === m);
      if (mg) any = true;
      target += Number(mg?.target_value || 0);
      const auto = typeof planning.goalAutoValue === 'function'
        ? Number(planning.goalAutoValue(objective, m) ?? 0)
        : 0;
      actual += auto > 0 ? auto : Number(mg?.actual_value || 0);
    });
    return any ? { target, actual } : null;
  };

  const pickPeriodOverride = (key: string) => {
    const direct = goals.find((g: any) => g.period === key);
    if (!direct) return null;
    return { target: Number(direct.target_value || 0), actual: Number(direct.actual_value || 0) };
  };

  const fmt = (v: number | null | undefined) => {
    if (v == null) return '—';
    if (v >= 1000) return v.toLocaleString('pt-PT', { maximumFractionDigits: 0 });
    return String(Math.round(v * 100) / 100);
  };
  const unit = objective.target_unit ? ` ${objective.target_unit}` : '';

  // Hide cascade for qualitative objectives or with no target signal at all
  if (objective.objective_type !== 'quantitativo') return null;
  if (!annualTarget && !annualActual && goals.length === 0) return null;

  const Cell = ({ label, target, actual }: { label: string; target: number | null; actual: number | null }) => {
    const empty = target == null && actual == null;
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={`flex flex-col items-center justify-center min-w-[44px] px-1.5 py-1 rounded-md border ${empty ? 'border-dashed bg-transparent text-muted-foreground/60' : 'bg-muted/30 border-border'}`}>
              <span className="text-[9px] font-semibold uppercase tracking-wider opacity-70">{label}</span>
              <span className="text-[10px] tabular-nums">{fmt(actual)}<span className="opacity-50">/{fmt(target)}</span></span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <div className="text-[11px]">
              <div className="font-semibold">{label}</div>
              <div>Meta: {fmt(target)}{unit}</div>
              <div>Real: {fmt(actual)}{unit}</div>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  const quarters = ['T1','T2','T3','T4'].map((k) => {
    const override = pickPeriodOverride(k);
    const agg = aggregateFor(QUARTER_MONTHS[k]);
    return { key: k, target: override?.target ?? agg?.target ?? null, actual: agg?.actual ?? override?.actual ?? null };
  });

  return (
    <div className="border-t bg-muted/10 px-3 py-2 space-y-1.5" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center gap-1.5">
        <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4">ANO</Badge>
        <span className="text-[10px] tabular-nums">
          {fmt(annualActual)}<span className="opacity-50">/{fmt(annualTarget)}</span>{unit}
        </span>
      </div>
      <div className="flex items-center gap-1 flex-wrap">
        {quarters.map((q) => <Cell key={q.key} label={q.key} target={q.target} actual={q.actual} />)}
      </div>
    </div>
  );
}