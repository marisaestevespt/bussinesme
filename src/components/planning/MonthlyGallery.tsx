import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, endOfMonth } from 'date-fns';
import { MonthDetailView } from './MonthDetailView';
import { EmptyHint } from '@/components/ui/loading-skeletons';

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function monthRange(monthIdx: number, year: number) {
  const start = new Date(year, monthIdx, 1);
  const end = endOfMonth(start);
  return { start, end, label: `01/${String(monthIdx + 1).padStart(2, '0')} → ${format(end, 'dd/MM')}` };
}

interface Props {
  planning: any;
  year: number;
}

export function MonthlyGallery({ planning, year }: Props) {
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const goals = planning.allGoals || [];
  const objectives = planning.allObjectives || [];

  const monthProgress = useMemo(() => {
    return MONTHS.map((name) => {
      const monthGoals = goals.filter((g: any) => g.period === name);
      if (monthGoals.length === 0) return { pct: 0, count: 0 };

      const goalPcts = monthGoals.map((g: any) => {
        if (g.status === 'atingido') return 100;
        const target = Number(g.target_value || 0);
        if (target <= 0) return 0;
        // Try auto-computed value first (e.g. commercial sales via linked objective), fall back to manual actual_value
        const linkedObj = g.objective_id ? objectives.find((o: any) => o.id === g.objective_id) : null;
        const autoVal = linkedObj && planning.goalAutoValue
          ? Number(planning.goalAutoValue(linkedObj, name) ?? 0)
          : 0;
        const actual = autoVal > 0 ? autoVal : Number(g.actual_value || 0);
        return Math.min(Math.round((actual / target) * 100), 100);
      });
      const avg = Math.round(goalPcts.reduce((a: number, b: number) => a + b, 0) / goalPcts.length);
      return { pct: avg, count: monthGoals.length };
    });
  }, [goals, planning]);

  if (selectedMonth !== null) {
    return (
      <MonthDetailView
        monthIdx={selectedMonth}
        year={year}
        planning={planning}
        onBack={() => setSelectedMonth(null)}
      />
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {MONTHS.map((name, idx) => {
        const range = monthRange(idx, year);
        const { pct: progress, count: itemCount } = monthProgress[idx];
        const isCurrent = new Date().getMonth() === idx && new Date().getFullYear() === year;
        const goalCount = itemCount;

        return (
          <Card
            key={idx}
            className={cn(
              'cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group',
              isCurrent && 'ring-2 ring-primary'
            )}
            onClick={() => setSelectedMonth(idx)}
          >
            <CardContent className="p-4 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm">{name}</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <p className="text-[11px] text-muted-foreground">{range.label}</p>
              <div className="mt-auto pt-2 space-y-1 min-h-[2.25rem]">
                {goalCount > 0 ? (
                  <>
                    <Progress value={progress} className="h-1.5" />
                    <p className="text-[10px] text-muted-foreground">{progress}% concluído ({itemCount} {itemCount === 1 ? 'meta' : 'metas'})</p>
                  </>
                ) : (
                  <p className="text-[10px] text-muted-foreground italic">Sem metas definidas</p>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
