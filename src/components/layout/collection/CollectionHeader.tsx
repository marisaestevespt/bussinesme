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
        <div className="eyebrow mb-1">Coleção</div>
        <div className="flex items-center gap-2">
          {Icon && <Icon className="h-5 w-5 text-primary/70" strokeWidth={1.5} />}
          <h1 className="font-display italic text-3xl md:text-4xl leading-tight text-foreground">{title}</h1>
          {count !== undefined && (
            <span className="font-typewriter text-[10px] uppercase tracking-[0.18em] rounded-sm border border-primary/30 bg-secondary/40 px-2 py-0.5 text-primary/70">
              {count}
            </span>
          )}
        </div>
        {description && <p className="font-display italic text-primary/60">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}