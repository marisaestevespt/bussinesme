import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface EntitySectionProps {
  title: string;
  icon?: LucideIcon | React.ElementType;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** Use a smaller title — for sub-sections inside a tab. */
  compact?: boolean;
}

/**
 * Canonical "section" inside a detail page tab. Notion-style: no card chrome,
 * just a title + optional icon + optional action, separated by a hairline.
 */
export function EntitySection({ title, icon: Icon, description, action, children, className, compact }: EntitySectionProps) {
  return (
    <section className={cn('hq-card rounded-md p-5 md:p-6 space-y-4', className)}>
      <header className="flex items-end justify-between gap-3 pb-3 border-b-2 border-primary/25">
        <div className="flex items-center gap-2 min-w-0">
          {Icon && (
            <span className="inline-flex items-center justify-center h-7 w-7 rounded-sm bg-primary/10 border border-primary/30 shrink-0">
              <Icon className="h-4 w-4 text-primary" strokeWidth={1.75} />
            </span>
          )}
          <div className="min-w-0">
            <h2 className={cn('font-display italic text-foreground truncate leading-tight', compact ? 'text-lg' : 'text-xl md:text-2xl')}>{title}</h2>
            {description && <p className="text-xs text-muted-foreground truncate mt-0.5"><span className="font-display italic text-primary/60 mr-1">✦</span>{description}</p>}
          </div>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </header>
      <div>{children}</div>
    </section>
  );
}