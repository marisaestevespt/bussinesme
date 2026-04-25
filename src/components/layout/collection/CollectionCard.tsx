import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface CollectionCardProps {
  title: string;
  description?: string;
  icon?: LucideIcon | React.ElementType;
  /** Small label rendered above the title (e.g. category, type). */
  eyebrow?: string;
  /** Right-side status chip / badge. */
  status?: React.ReactNode;
  /** Bottom metadata row (icons + text). */
  meta?: React.ReactNode;
  /** Optional cover image or media. */
  cover?: React.ReactNode;
  onClick?: () => void;
  /** Render as <a> for native nav semantics. */
  href?: string;
  className?: string;
  children?: React.ReactNode;
}

/**
 * Canonical card for items inside a CollectionGrid. Hover-lift, soft border,
 * consistent padding. Slot-based — pages don't compose ad-hoc layouts.
 */
export function CollectionCard({
  title,
  description,
  icon: Icon,
  eyebrow,
  status,
  meta,
  cover,
  onClick,
  href,
  className,
  children,
}: CollectionCardProps) {
  const Wrapper: any = href ? 'a' : 'div';
  const interactive = Boolean(onClick || href);
  return (
    <Wrapper
      href={href}
      onClick={onClick}
      className={cn(
        'group flex flex-col overflow-hidden rounded-xl border border-border/60 bg-card text-card-foreground transition-all',
        interactive && 'cursor-pointer hover:border-border hover:shadow-sm',
        className,
      )}
    >
      {cover && <div className="relative aspect-[16/9] overflow-hidden bg-muted">{cover}</div>}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1 space-y-0.5">
            {eyebrow && (
              <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{eyebrow}</div>
            )}
            <div className="flex items-center gap-2">
              {Icon && <Icon className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.5} />}
              <h3 className="truncate text-sm font-semibold leading-tight">{title}</h3>
            </div>
            {description && (
              <p className="line-clamp-2 text-xs text-muted-foreground">{description}</p>
            )}
          </div>
          {status && <div className="shrink-0">{status}</div>}
        </div>
        {children && <div className="text-sm">{children}</div>}
        {meta && (
          <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-2 text-xs text-muted-foreground">
            {meta}
          </div>
        )}
      </div>
    </Wrapper>
  );
}