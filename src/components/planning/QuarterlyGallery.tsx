import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

const QUARTERS = [
  { label: '1º Trimestre', months: ['Janeiro', 'Fevereiro', 'Março'], range: '01/01 → 31/03' },
  { label: '2º Trimestre', months: ['Abril', 'Maio', 'Junho'], range: '01/04 → 30/06' },
  { label: '3º Trimestre', months: ['Julho', 'Agosto', 'Setembro'], range: '01/07 → 30/09' },
  { label: '4º Trimestre', months: ['Outubro', 'Novembro', 'Dezembro'], range: '01/10 → 31/12' },
];

interface Props {
  planning: any;
  year: number;
}

export function QuarterlyGallery({ planning, year }: Props) {
  const goals = planning.allGoals || [];

  const quarterData = useMemo(() => {
    return QUARTERS.map((q, idx) => {
      const qGoals = goals.filter((g: any) => q.months.includes(g.period));
      const total = qGoals.length;
      const achieved = qGoals.filter((g: any) => g.status === 'atingido').length;
      const progress = total > 0 ? Math.round((achieved / total) * 100) : 0;
      const currentQuarter = Math.floor(new Date().getMonth() / 3);
      const isCurrent = currentQuarter === idx && new Date().getFullYear() === year;
      return { ...q, total, achieved, progress, isCurrent };
    });
  }, [goals, year]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {quarterData.map((q, idx) => (
        <Card
          key={idx}
          className={cn(
            'transition-all duration-200 hover:shadow-md hover:-translate-y-0.5',
            q.isCurrent && 'ring-2 ring-primary'
          )}
        >
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">{q.label}</h3>
              {q.isCurrent && <Badge variant="secondary" className="text-[10px]">Atual</Badge>}
            </div>
            <p className="text-xs text-muted-foreground">{q.range}</p>
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{q.achieved}/{q.total} metas</span>
                <span>{q.progress}%</span>
              </div>
              <Progress value={q.progress} className="h-2" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
