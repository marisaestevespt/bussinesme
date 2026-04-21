import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Props {
  year: number;
  onChange: (year: number) => void;
}

export function YearSelector({ year, onChange }: Props) {
  return (
    <div className="flex items-center justify-center gap-4">
      <Button variant="outline" aria-label="Anterior" size="icon" onClick={() => onChange(year - 1)}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="text-lg font-semibold">{year}</span>
      <Button variant="outline" aria-label="Seguinte" size="icon" onClick={() => onChange(year + 1)}>
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
