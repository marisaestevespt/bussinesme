import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CollectionEmptyProps {
  icon?: LucideIcon | React.ElementType;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

/**
 * Canonical empty state for collection pages. Soft, centered, optional CTA.
 * See mem://design/empty-states for tone guidelines.
 */
export function CollectionEmpty({ icon: Icon, title, description, action, className }: CollectionEmptyProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border/60 px-6 py-12 text-center', className)}>
      {Icon && (
        <div className="rounded-full bg-muted p-3 text-muted-foreground">
          <Icon className="h-5 w-5" strokeWidth={1.5} />
        </div>
      )}
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">{title}</h3>
        {description && <p className="max-w-sm text-xs text-muted-foreground">{description}</p>}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}