import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, ArrowLeft } from 'lucide-react';

const MONTH_NAMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

interface Props {
  monthIdx: number; // 0-based
  year: number;
  onBack: () => void;
  onChangeMonth: (monthIdx: number, year: number) => void;
}

/** Month navigation header for analysis detail views with cross-year support */
export function MonthNavHeader({ monthIdx, year, onBack, onChangeMonth }: Props) {
  const goPrev = () => {
    if (monthIdx === 0) {
      onChangeMonth(11, year - 1);
    } else {
      onChangeMonth(monthIdx - 1, year);
    }
  };

  const goNext = () => {
    if (monthIdx === 11) {
      onChangeMonth(0, year + 1);
    } else {
      onChangeMonth(monthIdx + 1, year);
    }
  };

  return (
    <div className="space-y-3">
      <Button variant="ghost" size="sm" onClick={onBack} className="gap-1">
        <ArrowLeft className="h-4 w-4" /> Voltar à galeria
      </Button>
      <div className="flex items-center justify-center gap-4">
        <Button variant="outline" aria-label="Anterior" size="icon" onClick={goPrev}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-xl font-bold min-w-[200px] text-center">
          {MONTH_NAMES[monthIdx]} {year}
        </h2>
        <Button variant="outline" aria-label="Seguinte" size="icon" onClick={goNext}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
