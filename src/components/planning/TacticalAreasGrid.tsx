import { useMemo } from 'react';
import { useTacticalAreas, useMembersByDepartment, useProjectsByDepartmentInRange } from '@/hooks/useTacticalAreas';
import { TacticalAreaCard } from './TacticalAreaCard';
import { Card, CardContent } from '@/components/ui/card';

interface Props {
  /** All goals from usePlanningData */
  goals: any[];
  /** Month names that compose the period (e.g. ['Abril','Maio','Junho']) */
  periodMonths: string[];
  /** Date range used to fetch projects whose deadline falls inside it */
  rangeStart: Date;
  rangeEnd: Date;
  /** Optional comparison: another period to compare progress against */
  compareTo?: { months: string[]; label: string } | null;
  onSelectGoal?: (goal: any) => void;
}

/** Maps DEPARTMENTS keys → planning area keys (PLAN_AREAS) when they differ */
const DEPT_TO_PLAN_AREA: Record<string, string> = {
  'recursos-humanos': 'equipa',
  'produtos': 'produto',
  'admin': 'outro',
};

function planAreaKeyFor(deptKey: string): string {
  return DEPT_TO_PLAN_AREA[deptKey] || deptKey;
}

function pct(arr: any[]): number {
  if (!arr.length) return 0;
  const achieved = arr.filter((g) => g.status === 'atingido').length;
  return Math.round((achieved / arr.length) * 100);
}

export function TacticalAreasGrid({ goals, periodMonths, rangeStart, rangeEnd, compareTo, onSelectGoal }: Props) {
  const { data: areas = [] } = useTacticalAreas();
  const { data: membersByDept = {} } = useMembersByDepartment();
  const { data: projectsByDept = {} } = useProjectsByDepartmentInRange(rangeStart, rangeEnd);

  const periodGoals = useMemo(
    () => goals.filter((g: any) => periodMonths.includes(g.period)),
    [goals, periodMonths]
  );
  const compareGoals = useMemo(
    () => (compareTo ? goals.filter((g: any) => compareTo.months.includes(g.period)) : []),
    [goals, compareTo]
  );

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
        const planKey = planAreaKeyFor(area.key);
        const areaGoals = periodGoals.filter((g: any) => g.area === planKey || g.area === area.key);
        const areaInitiatives = projectsByDept[area.key] || [];
        const areaProgress = pct(areaGoals);
        const responsibles = membersByDept[area.key] || [];

        let comparison: { previousPct: number; previousLabel: string } | null = null;
        if (compareTo) {
          const prevAreaGoals = compareGoals.filter((g: any) => g.area === planKey || g.area === area.key);
          comparison = { previousPct: pct(prevAreaGoals), previousLabel: compareTo.label };
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