import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const SEMESTERS = [
  { label: '1º Semestre', months: ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho'], range: '01/01 → 30/06' },
  { label: '2º Semestre', months: ['Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'], range: '01/07 → 31/12' },
];

interface Props {
  planning: any;
  year: number;
}

export function SemesterGallery({ planning, year }: Props) {
  const goals = planning.allGoals || [];

  const semesterData = useMemo(() => {
    return SEMESTERS.map((s, idx) => {
      const sGoals = goals.filter((g: any) => s.months.includes(g.period));
      const total = sGoals.length;
      const achieved = sGoals.filter((g: any) => g.status === 'atingido').length;
      const progress = total > 0 ? Math.round((achieved / total) * 100) : 0;
      const currentSemester = new Date().getMonth() < 6 ? 0 : 1;
      const isCurrent = currentSemester === idx && new Date().getFullYear() === year;
      return { ...s, total, achieved, progress, isCurrent };
    });
  }, [goals, year]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {semesterData.map((s, idx) => (
        <Card
          key={idx}
          className={cn(
            'transition-all duration-200 hover:shadow-md hover:-translate-y-0.5',
            s.isCurrent && 'ring-2 ring-primary'
          )}
        >
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">{s.label}</h3>
              {s.isCurrent && <Badge variant="secondary" className="text-[10px]">Atual</Badge>}
            </div>
            <p className="text-xs text-muted-foreground">{s.range}</p>
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{s.achieved}/{s.total} metas</span>
                <span>{s.progress}%</span>
              </div>
              <Progress value={s.progress} className="h-2" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
