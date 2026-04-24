import { cn } from '@/lib/utils';

export interface LegendItem {
  label: string;
  color: string; // hex or hsl(var(--...))
}

/**
 * Apple/Google-style legend strip — small color dots + labels under the toolbar.
 * Hidden when there are no items.
 */
export function AgendaLegend({
  items,
  className,
}: {
  items: LegendItem[];
  className?: string;
}) {
  if (!items.length) return null;
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-x-3 gap-y-1.5 mb-3 text-[11px] text-muted-foreground',
        className,
      )}
      aria-label="Legenda de cores"
    >
      {items.map(it => (
        <span key={it.label} className="inline-flex items-center gap-1.5">
          <span
            className="inline-block h-2 w-2 rounded-full shrink-0"
            style={{ backgroundColor: it.color }}
            aria-hidden
          />
          <span className="truncate">{it.label}</span>
        </span>
      ))}
    </div>
  );
}