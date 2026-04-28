import { useMemo, useState } from 'react';
import { endOfMonth } from 'date-fns';
import {
  useTacticalAreas,
  useMembersByDepartment,
  useProjectsByDepartmentInRange,
  type TacticalArea,
} from '@/hooks/useTacticalAreas';
import { AreaTimelineRow, type AreaPeriodCell } from './AreaTimelineRow';
import { AreaPeriodDetail } from './AreaPeriodDetail';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

const MONTHS = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
];

const QUARTERS = [
  { key: 'T1', label: 'T1', months: [0,1,2], monthNames: ['Janeiro','Fevereiro','Março'] },
  { key: 'T2', label: 'T2', months: [3,4,5], monthNames: ['Abril','Maio','Junho'] },
  { key: 'T3', label: 'T3', months: [6,7,8], monthNames: ['Julho','Agosto','Setembro'] },
  { key: 'T4', label: 'T4', months: [9,10,11], monthNames: ['Outubro','Novembro','Dezembro'] },
];

const SEMESTERS = [
  { key: 'S1', label: 'S1', months: [0,1,2,3,4,5], monthNames: ['Janeiro','Fevereiro','Março','Abril','Maio','Junho'] },
  { key: 'S2', label: 'S2', months: [6,7,8,9,10,11], monthNames: ['Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'] },
];

const DEPT_TO_PLAN_AREA: Record<string, string> = {
  'recursos-humanos': 'equipa',
  'produtos': 'produto',
  'admin': 'outro',
};
const planAreaKeyFor = (k: string) => DEPT_TO_PLAN_AREA[k] || k;

interface Props {
  planning: any;
  year: number;
  view: 'trimestral' | 'semestral';
}

export function TacticalByAreaView({ planning, year, view }: Props) {
  const periods = view === 'trimestral' ? QUARTERS : SEMESTERS;
  const [selected, setSelected] = useState<{ areaKey: string; periodKey: string } | null>(null);

  const { data: areas = [], isLoading: loadingAreas } = useTacticalAreas();
  const { data: membersByDept = {} } = useMembersByDepartment();

  // For projects, we fetch the whole year once and filter per period in-memory.
  const yearStart = new Date(year, 0, 1);
  const yearEnd = endOfMonth(new Date(year, 11, 1));
  const { data: projectsByDept = {} } = useProjectsByDepartmentInRange(yearStart, yearEnd);

  const goals = planning.allGoals || [];
  const objectives = planning.allObjectives || [];

  const today = new Date();
  const currentMonth = today.getFullYear() === year ? today.getMonth() : -1;

  if (loadingAreas) {
    return <div className="space-y-3">{[1,2,3,4].map((i) => <Skeleton key={i} className="h-28 w-full" />)}</div>;
  }

  if (!areas.length) {
    return (
      <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
        Nenhuma área tática configurada.
      </CardContent></Card>
    );
  }

  // Drill-down view
  if (selected) {
    const area = areas.find((a) => a.key === selected.areaKey);
    const period = periods.find((p) => p.key === selected.periodKey);
    if (!area || !period) {
      setSelected(null);
      return null;
    }
    const planKey = planAreaKeyFor(area.key);
    const periodGoals = goals.filter(
      (g: any) => period.monthNames.includes(g.period) && (g.area === planKey || g.area === area.key),
    );
    const allInits = projectsByDept[area.key] || [];
    const periodStart = new Date(year, period.months[0], 1);
    const periodEnd = endOfMonth(new Date(year, period.months[period.months.length - 1], 1));
    const periodInits = allInits.filter((p: any) => {
      if (!p.deadline) return false;
      const d = new Date(p.deadline);
      return d >= periodStart && d <= periodEnd;
    });
    const responsibles = membersByDept[area.key] || [];
    const monthLabels = period.monthNames.map((m) => m.slice(0, 3)).join('/');

    return (
      <AreaPeriodDetail
        area={area}
        responsibles={responsibles}
        periodLabel={`${period.label} — ${monthLabels} ${year}`}
        quarter={view === 'trimestral' ? Number(period.key.replace('T', '')) : undefined}
        semester={view === 'semestral' ? Number(period.key.replace('S', '')) : undefined}
        year={year}
        goals={periodGoals}
        initiatives={periodInits}
        planning={planning}
        objectives={objectives}
        onBack={() => setSelected(null)}
      />
    );
  }

  // Main: list of areas with timeline rows
  return (
    <div className="space-y-3">
      {areas.map((area: TacticalArea) => {
        const planKey = planAreaKeyFor(area.key);
        const responsibles = membersByDept[area.key] || [];
        const allAreaGoals = goals.filter((g: any) => g.area === planKey || g.area === area.key);
        const allAreaInits = projectsByDept[area.key] || [];

        const cells: AreaPeriodCell[] = periods.map((p) => {
          const periodGoals = allAreaGoals.filter((g: any) => p.monthNames.includes(g.period));
          const periodStart = new Date(year, p.months[0], 1);
          const periodEnd = endOfMonth(new Date(year, p.months[p.months.length - 1], 1));
          const periodInits = allAreaInits.filter((pr: any) => {
            if (!pr.deadline) return false;
            const d = new Date(pr.deadline);
            return d >= periodStart && d <= periodEnd;
          });
          const achieved = periodGoals.filter((g: any) => g.status === 'atingido').length;
          const progress = periodGoals.length ? Math.round((achieved / periodGoals.length) * 100) : 0;
          const isCurrent = p.months.includes(currentMonth);
          return {
            key: p.key,
            label: p.label,
            fullLabel: p.label,
            progress,
            goalsCount: periodGoals.length,
            initiativesCount: periodInits.length,
            isCurrent,
          };
        });

        const yearAchieved = allAreaGoals.filter((g: any) => g.status === 'atingido').length;
        const yearProgress = allAreaGoals.length ? Math.round((yearAchieved / allAreaGoals.length) * 100) : 0;

        return (
          <AreaTimelineRow
            key={area.key}
            area={area}
            responsibles={responsibles}
            cells={cells}
            totalProgress={yearProgress}
            onSelectCell={(cellKey) => setSelected({ areaKey: area.key, periodKey: cellKey })}
          />
        );
      })}
    </div>
  );
}