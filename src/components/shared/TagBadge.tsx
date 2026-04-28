import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DEPARTMENT_COLOR_PALETTE } from '@/lib/departmentColorPalette';
import { useDepartmentColors } from '@/hooks/useDepartmentColors';
import { useAuth } from '@/hooks/useAuth';

interface Props {
  /** Logical category, e.g. "marketing_channel" or "marketing_format". */
  scope: string;
  /** Stable identifier within the scope (e.g. channel name, format value). */
  value: string;
  /** What to render inside the badge. */
  label: React.ReactNode;
  className?: string;
  readOnly?: boolean;
  stopPropagation?: boolean;
}

/**
 * Generic Notion-style tag badge with inline color picker.
 * Reuses the department_colors store with namespaced keys ("scope:value").
 */
export function TagBadge({ scope, value, label, className, readOnly, stopPropagation }: Props) {
  const storeKey = `${scope}:${value}`;
  const { getBadgeClass, getColorKey, setColor } = useDepartmentColors();
  const { isAdminOrOwner } = useAuth();
  const canEdit = !readOnly && isAdminOrOwner;
  const [open, setOpen] = useState(false);

  const badgeClass = getBadgeClass(storeKey);
  const currentKey = getColorKey(storeKey);

  if (!canEdit) {
    return (
      <Badge variant="outline" className={cn('text-xs', badgeClass, className)}>
        {label}
      </Badge>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => { if (stopPropagation) e.stopPropagation(); }}
          onPointerDown={(e) => { if (stopPropagation) e.stopPropagation(); }}
          className="focus:outline-none"
          title="Clica para mudar a cor desta etiqueta"
        >
          <Badge variant="outline" className={cn('text-xs cursor-pointer', badgeClass, className)}>
            {label}
          </Badge>
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-56 p-2"
        align="start"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2 px-1">
          Cor
        </div>
        <div className="flex flex-col gap-0.5 max-h-72 overflow-y-auto">
          {DEPARTMENT_COLOR_PALETTE.map(c => (
            <button
              key={c.key}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setColor(storeKey, c.key);
                setOpen(false);
              }}
              className="flex items-center justify-between gap-2 px-2 py-1.5 rounded hover:bg-muted/60 text-sm"
            >
              <div className="flex items-center gap-2">
                <span className={cn('h-3.5 w-3.5 rounded-sm border border-border/50', c.swatchClass)} />
                <span>{c.label}</span>
              </div>
              {currentKey === c.key && <Check className="h-3.5 w-3.5 text-foreground" />}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}