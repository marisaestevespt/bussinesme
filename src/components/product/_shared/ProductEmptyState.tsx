import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  icon: LucideIcon | React.ElementType;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  /** Compact variant for use inside small cards. */
  compact?: boolean;
}

/**
 * Standard empty state for any product subsection. Centered icon + title +
 * one-line description + optional CTA. Replaces the ~15 ad-hoc empty states.
 */
export function ProductEmptyState({ icon: Icon, title, description, action, className, compact }: Props) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center rounded-lg border border-dashed border-border/60 bg-muted/20',
        compact ? 'py-6 px-4 gap-2' : 'py-10 px-6 gap-3',
        className,
      )}
    >
      <span
        className={cn(
          'inline-flex items-center justify-center rounded-full bg-muted/60 text-muted-foreground',
          compact ? 'h-9 w-9' : 'h-12 w-12',
        )}
      >
        <Icon className={cn(compact ? 'h-4 w-4' : 'h-5 w-5')} strokeWidth={1.75} />
      </span>
      <div className="space-y-1 max-w-sm">
        <p className={cn('font-medium text-foreground', compact ? 'text-sm' : 'text-base')}>{title}</p>
        {description && (
          <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
        )}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}