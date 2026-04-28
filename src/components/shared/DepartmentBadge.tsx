import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getDept } from '@/lib/departments';
import { DEPARTMENT_COLOR_PALETTE } from '@/lib/departmentColorPalette';
import { useDepartmentColors } from '@/hooks/useDepartmentColors';
import { useUserRole } from '@/hooks/useUserRole';

interface Props {
  department: string;
  className?: string;
  /** When true, force-disable picker (e.g. inside read-only contexts). */
  readOnly?: boolean;
  /** Stop click propagation (useful inside clickable rows). */
  stopPropagation?: boolean;
}

/**
 * Notion-style department badge with inline color picker.
 * Click opens a palette popover (admins/owner only). Color choice is global.
 */
export function DepartmentBadge({ department, className, readOnly, stopPropagation }: Props) {
  const dept = getDept(department);
  const { getBadgeClass, getColorKey, setColor } = useDepartmentColors();
  const { role } = useUserRole();
  const canEdit = !readOnly && (role === 'owner' || role === 'admin');
  const [open, setOpen] = useState(false);

  if (!dept) return <span className="text-muted-foreground text-xs">—</span>;

  const badgeClass = getBadgeClass(department);
  const currentKey = getColorKey(department);

  const badge = (
    <Badge
      variant="outline"
      className={cn('text-xs cursor-pointer', badgeClass, className)}
    >
      {dept.icon} {dept.label}
    </Badge>
  );

  if (!canEdit) {
    return (
      <Badge variant="outline" className={cn('text-xs', badgeClass, className)}>
        {dept.icon} {dept.label}
      </Badge>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => { if (stopPropagation) { e.stopPropagation(); } }}
          onPointerDown={(e) => { if (stopPropagation) e.stopPropagation(); }}
          className="focus:outline-none"
          title="Clica para mudar a cor deste departamento"
        >
          {badge}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-56 p-2"
        align="start"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2 px-1">
          Cor — {dept.label}
        </div>
        <div className="flex flex-col gap-0.5 max-h-72 overflow-y-auto">
          {DEPARTMENT_COLOR_PALETTE.map(c => (
            <button
              key={c.key}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setColor(department, c.key);
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