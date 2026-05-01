import { useState, useMemo, useEffect } from 'react';
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
  /** Mês inicial 0-11 a abrir directamente em modo detalhe (e.g. via ?mes=4). */
  initialMonth?: number | null;
  /** Notifica o pai quando o mês selecionado muda (para sincronizar URL). */
  onMonthChange?: (monthIdx: number | null) => void;
}

export function MonthlyGallery({ planning, year, initialMonth = null, onMonthChange }: Props) {
  const [selectedMonth, setSelectedMonth] = useState<number | null>(initialMonth);

  // Reage a mudanças externas (e.g. utilizador navega via banner para outro mês)
  useEffect(() => { setSelectedMonth(initialMonth); }, [initialMonth]);

  const updateSelected = (m: number | null) => {
    setSelectedMonth(m);
    onMonthChange?.(m);
  };

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
        onBack={() => updateSelected(null)}
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
            onClick={() => updateSelected(idx)}
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
