import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface CollectionHeaderProps {
  title: string;
  description?: string;
  icon?: LucideIcon | React.ElementType;
  /** Counter shown next to the title (e.g. number of items). */
  count?: number | string;
  /** Right-aligned actions (typically a "+ New" button). */
  actions?: React.ReactNode;
  className?: string;
}

/**
 * Canonical header for collection / gallery / list pages. Notion-style:
 * large title, muted description, optional count chip, right-aligned actions.
 */
export function CollectionHeader({
  title,
  description,
  icon: Icon,
  count,
  actions,
  className,
}: CollectionHeaderProps) {
  return (
    <header className={cn('flex flex-col gap-3 md:flex-row md:items-end md:justify-between', className)}>
      <div className="min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />}
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {count !== undefined && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {count}
            </span>
          )}
        </div>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}