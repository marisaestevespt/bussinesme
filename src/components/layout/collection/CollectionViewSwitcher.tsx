import { LayoutGrid, List, Kanban, Calendar as CalendarIcon, LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export type CollectionView = 'grid' | 'list' | 'board' | 'calendar';

const ICONS: Record<CollectionView, LucideIcon> = {
  grid: LayoutGrid,
  list: List,
  board: Kanban,
  calendar: CalendarIcon,
};

const LABELS: Record<CollectionView, string> = {
  grid: 'Galeria',
  list: 'Lista',
  board: 'Quadro',
  calendar: 'Calendário',
};

interface CollectionViewSwitcherProps {
  value: CollectionView;
  onChange: (view: CollectionView) => void;
  /** Subset of views to expose. Defaults to ['grid','list']. */
  views?: CollectionView[];
  className?: string;
}

/**
 * Compact icon-only segmented control to switch between collection views.
 * Sits on the right of CollectionToolbar.
 */
export function CollectionViewSwitcher({
  value,
  onChange,
  views = ['grid', 'list'],
  className,
}: CollectionViewSwitcherProps) {
  return (
    <div className={cn('inline-flex items-center rounded-full bg-muted/50 p-0.5', className)}>
      {views.map((v) => {
        const Icon = ICONS[v];
        const active = value === v;
        return (
          <Button
            key={v}
            type="button"
            variant="ghost"
            size="sm"
            aria-label={LABELS[v]}
            onClick={() => onChange(v)}
            className={cn(
              'h-7 w-7 rounded-full p-0 text-muted-foreground hover:text-foreground',
              active && 'bg-background text-foreground shadow-sm hover:bg-background',
            )}
          >
            <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
          </Button>
        );
      })}
    </div>
  );
}