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

  const monthProgress = useMemo(
    () => MONTHS.map((name) => planning.getPeriodProgress([name])),
    [planning]
  );

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
                    <p className="text-[10px] text-muted-foreground">{progress}% • {itemCount} {itemCount === 1 ? 'meta' : 'metas'}</p>
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
