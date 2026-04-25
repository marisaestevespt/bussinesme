import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface EntityPropertiesProps {
  children: React.ReactNode;
  className?: string;
}

/** Notion-style properties container. Each child should be an <EntityProperty />. */
export function EntityProperties({ children, className }: EntityPropertiesProps) {
  return (
    <div className={cn('rounded-lg border border-border/60 bg-card', className)}>
      <div className="px-4 py-2 divide-y divide-border/50">{children}</div>
    </div>
  );
}

interface EntityPropertyProps {
  icon?: LucideIcon | React.ElementType;
  label: string;
  children: React.ReactNode;
  /** Use a wider label column for long labels. */
  wide?: boolean;
}

/**
 * Single Notion-style property row: icon + label | value (any input/select/text).
 *
 * Tip: wrap inputs/selects in this component without borders/shadow — the borderless
 * style is achieved via parent context, but you can also pass any custom child.
 */
export function EntityProperty({ icon: Icon, label, children, wide }: EntityPropertyProps) {
  return (
    <div
      className={cn(
        'grid items-center py-1 first:pt-0 last:pb-0',
        wide ? 'grid-cols-[180px_1fr]' : 'grid-cols-[150px_1fr]',
      )}
    >
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {Icon && <Icon className="h-4 w-4 shrink-0" strokeWidth={1.5} />}
        <span>{label}</span>
      </div>
      <div className="text-sm text-foreground min-h-[32px] flex items-center">{children}</div>
    </div>
  );
}

/** Helper class for inline (borderless) inputs/selects to use inside EntityProperty. */
export const inlineInputClass =
  'h-8 border-0 bg-transparent shadow-none px-2 -ml-2 hover:bg-muted/60 focus-visible:ring-0 focus-visible:ring-offset-0 focus:bg-muted/40 rounded-md';
export const inlineTriggerClass =
  'h-8 border-0 bg-transparent shadow-none px-2 -ml-2 hover:bg-muted/60 focus:ring-0 focus:ring-offset-0 [&>svg]:opacity-50';