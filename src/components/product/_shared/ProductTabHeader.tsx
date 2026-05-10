import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  icon: LucideIcon | React.ElementType;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}

/**
 * Standard hero header for a product tab. Replaces ad-hoc headers in each
 * section so all 9 product tabs share the exact same top-of-page rhythm.
 */
export function ProductTabHeader({ icon: Icon, title, description, actions, className }: Props) {
  return (
    <header className={cn('flex items-start gap-4 pb-5 mb-6 border-b border-border/60', className)}>
      <div className="rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 p-3 ring-1 ring-primary/20 shrink-0">
        <Icon className="h-6 w-6 text-primary" strokeWidth={1.75} />
      </div>
      <div className="min-w-0 flex-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
        {description && (
          <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{description}</p>
        )}
      </div>
      {actions && <div className="shrink-0 flex items-center gap-2">{actions}</div>}
    </header>
  );
}