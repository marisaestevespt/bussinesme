import { HorizonsView } from './HorizonsView';

interface Props {
  planning: any;
  year: number;
  stats: { totalObjs: number; achieved: number; inProgress: number; avgProgress: number; deviationCount: number };
}

export function PlanningOverviewView({ planning, year, stats }: Props) {
  return (
    <div className="space-y-6">
      {/* Horizontes do ano (cascata anuais → mini-metas) */}
      <HorizonsView planning={planning} year={year} />
    </div>
  );
}