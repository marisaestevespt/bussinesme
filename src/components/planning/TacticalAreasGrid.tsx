import { useMemo } from 'react';
import { useTacticalAreas, useMembersByDepartment, useProjectsByDepartmentInRange } from '@/hooks/useTacticalAreas';
import { TacticalAreaCard } from './TacticalAreaCard';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { buildObjectiveAreaIndex, goalBelongsToDepartment } from '@/lib/planningAreaFilters';

interface Props {
  /** All goals from usePlanningData */
  goals: any[];
  /** All objectives from usePlanningData, used as the source of truth for each goal's department. */
  objectives?: any[];
  /** Month names that compose the period (e.g. ['Abril','Maio','Junho']) */
  periodMonths: string[];
  isLoading?: boolean;
  /** Date range used to fetch projects whose deadline falls inside it */
  rangeStart: Date;
  rangeEnd: Date;
  /** Optional comparison: another period to compare progress against */
  compareTo?: { months: string[]; label: string } | null;
  onSelectGoal?: (goal: any) => void;
  /** Optional planning data so we can compute progress using auto sources. */
  planning?: any;
}

function fallbackPct(arr: any[]): number {
  if (!arr.length) return 0;
  const achieved = arr.filter((g) => g.status === 'atingido').length;
  return Math.round((achieved / arr.length) * 100);
}

/** Compute progress using planning.goalAutoValue when available, falls back to status-based pct. */
function computeAreaProgress(areaGoals: any[], objectives: any[], planning: any): number {
  if (!areaGoals.length) return 0;
  if (!planning?.goalAutoValue) return fallbackPct(areaGoals);
  const pcts = areaGoals.map((g) => {
    if (g.status === 'atingido') return 100;
    const target = Number(g.target_value || 0);
    if (target <= 0) return 0;
    const linkedObj = g.objective_id ? objectives.find((o: any) => o.id === g.objective_id) : null;
    const autoVal = linkedObj ? Number(planning.goalAutoValue(linkedObj, g.period ?? '') ?? 0) : 0;
    const actual = autoVal > 0 ? autoVal : Number(g.actual_value || 0);
    return Math.min(Math.round((actual / target) * 100), 100);
  });
  return Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length);
}

export function TacticalAreasGrid({ goals, objectives = [], periodMonths, rangeStart, rangeEnd, compareTo, onSelectGoal, isLoading = false, planning }: Props) {
  const { data: areas = [], isLoading: loadingAreas } = useTacticalAreas();
  const { data: membersByDept = {} } = useMembersByDepartment();
  const { data: projectsByDept = {} } = useProjectsByDepartmentInRange(rangeStart, rangeEnd);
  const goalAreaById = useMemo(() => buildObjectiveAreaIndex(objectives), [objectives]);

  const periodGoals = useMemo(
    () => goals.filter((g: any) => periodMonths.includes(g.period)),
    [goals, periodMonths]
  );
  const compareGoals = useMemo(
    () => (compareTo ? goals.filter((g: any) => compareTo.months.includes(g.period)) : []),
    [goals, compareTo]
  );

  if (loadingAreas || isLoading) {
    return <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-48 w-full" />)}</div>;
  }

  if (!areas.length) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Nenhuma área tática configurada.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {areas.map((area) => {
        const areaGoals = periodGoals.filter((g: any) => goalBelongsToDepartment(g, goalAreaById, area.key));
        const areaInitiatives = projectsByDept[area.key] || [];
        const areaProgress = computeAreaProgress(areaGoals, objectives, planning);
        const responsibles = membersByDept[area.key] || [];

        let comparison: { previousPct: number; previousLabel: string } | null = null;
        if (compareTo) {
          const prevAreaGoals = compareGoals.filter((g: any) => goalBelongsToDepartment(g, goalAreaById, area.key));
          comparison = { previousPct: computeAreaProgress(prevAreaGoals, objectives, planning), previousLabel: compareTo.label };
        }

        return (
          <TacticalAreaCard
            key={area.key}
            area={area}
            responsibles={responsibles}
            goals={areaGoals}
            initiatives={areaInitiatives}
            progress={areaProgress}
            comparison={comparison}
            onSelectGoal={onSelectGoal}
          />
        );
      })}
    </div>
  );
}