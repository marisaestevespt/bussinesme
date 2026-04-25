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
    <section className={cn('space-y-3', className)}>
      <header className="flex items-end justify-between gap-3 pb-2 border-b border-border/40">
        <div className="flex items-center gap-2 min-w-0">
          {Icon && <Icon className={cn(compact ? 'h-4 w-4' : 'h-4 w-4', 'text-muted-foreground shrink-0')} strokeWidth={1.5} />}
          <div className="min-w-0">
            <h2 className={cn('font-semibold tracking-tight truncate', compact ? 'text-sm' : 'text-base')}>{title}</h2>
            {description && <p className="text-xs text-muted-foreground truncate">{description}</p>}
          </div>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </header>
      <div>{children}</div>
    </section>
  );
}