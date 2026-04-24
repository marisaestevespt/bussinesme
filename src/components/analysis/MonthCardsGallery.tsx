import { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Shared monthly-cards gallery used by ClientesAnalise and ComercialAnalise.
 * Renders a 4-col grid of 12 cards. Each page provides the body via renderBody.
 */
export interface MonthCardsGalleryProps<T> {
  months: T[];
  year: number;
  /** Returns the localized label shown on top of each card. Defaults to (m as any).name. */
  getLabel?: (m: T, idx: number) => string;
  renderBody: (m: T, idx: number) => ReactNode;
  onSelectMonth: (idx: number) => void;
}

export function MonthCardsGallery<T>({
  months,
  year,
  getLabel,
  renderBody,
  onSelectMonth,
}: MonthCardsGalleryProps<T>) {
  const now = new Date();
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {months.map((m, idx) => {
        const isCurrent = now.getMonth() === idx && now.getFullYear() === year;
        const label = getLabel ? getLabel(m, idx) : ((m as any)?.name ?? '');
        return (
          <Card
            key={idx}
            className={cn(
              'cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group',
              isCurrent && 'ring-2 ring-primary'
            )}
            onClick={() => onSelectMonth(idx)}
          >
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm">{label}</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              {renderBody(m, idx)}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}