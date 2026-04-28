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
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

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
  /** Default 'trimestral'. The view also has an internal toggle so the user can switch. */
  defaultView?: 'trimestral' | 'semestral';
}

export function TacticalByAreaView({ planning, year, defaultView = 'trimestral' }: Props) {
  const [view, setView] = useState<'trimestral' | 'semestral'>(defaultView);
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

  // Goal area lives on the linked objective, not on the goal itself.
  // Build an index objectiveId → area so we can filter goals by department.
  const goalAreaById = useMemo(() => {
    const m = new Map<string, string>();
    for (const o of objectives as any[]) if (o?.id && o?.area) m.set(o.id, o.area);
    return m;
  }, [objectives]);

  const goalArea = (g: any): string | undefined => {
    if (g?.area) return g.area; // future-proof if column is added
    return g?.objective_id ? goalAreaById.get(g.objective_id) : undefined;
  };

  // Compute progress for a set of goals using the same logic as planning.getPeriodProgress:
  // - 'atingido' counts as 100%
  // - otherwise, actual_value (or auto from linked objective) ÷ target_value, capped at 100
  const computeProgress = (gs: any[]): { pct: number; achieved: number } => {
    if (!gs.length) return { pct: 0, achieved: 0 };
    let achieved = 0;
    const pcts = gs.map((g) => {
      if (g.status === 'atingido') { achieved++; return 100; }
      const target = Number(g.target_value || 0);
      if (target <= 0) return 0;
      const actual = Number(g.actual_value || 0);
      const pct = Math.min(Math.round((actual / target) * 100), 100);
      if (pct >= 100) achieved++;
      return pct;
    });
    const avg = Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length);
    return { pct: avg, achieved };
  };

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
      (g: any) => {
        if (!period.monthNames.includes(g.period)) return false;
        const a = goalArea(g);
        return a === planKey || a === area.key;
      },
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
      <div className="flex items-center justify-end">
        <ToggleGroup
          type="single"
          value={view}
          onValueChange={(v) => v && setView(v as 'trimestral' | 'semestral')}
          size="sm"
          variant="outline"
        >
          <ToggleGroupItem value="trimestral" className="text-xs h-7 px-3">Trimestre</ToggleGroupItem>
          <ToggleGroupItem value="semestral" className="text-xs h-7 px-3">Semestre</ToggleGroupItem>
        </ToggleGroup>
      </div>
      {areas.map((area: TacticalArea) => {
        const planKey = planAreaKeyFor(area.key);
        const responsibles = membersByDept[area.key] || [];
        const allAreaGoals = goals.filter((g: any) => {
          const a = goalArea(g);
          return a === planKey || a === area.key;
        });
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