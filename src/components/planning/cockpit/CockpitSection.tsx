import { useState, useEffect, ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  storageKey: string;
  icon?: ReactNode;
  title: string;
  subtitle?: string;
  badge?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
  rightSlot?: ReactNode;
}

export function CockpitSection({
  storageKey, icon, title, subtitle, badge, defaultOpen = true, children, rightSlot,
}: Props) {
  const fullKey = `cockpit-collapsed:${storageKey}`;
  const [open, setOpen] = useState<boolean>(() => {
    try {
      const v = localStorage.getItem(fullKey);
      if (v === null) return defaultOpen;
      return v !== '1';
    } catch { return defaultOpen; }
  });

  useEffect(() => {
    try { localStorage.setItem(fullKey, open ? '0' : '1'); } catch { /* noop */ }
  }, [open, fullKey]);

  return (
    <section className="hq-card overflow-hidden">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-border/50">
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className="flex items-center gap-3 flex-1 text-left group"
        >
          {icon && (
            <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              {icon}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold truncate">{title}</h3>
              {badge}
            </div>
            {subtitle && <p className="text-xs text-muted-foreground truncate">{subtitle}</p>}
          </div>
          <ChevronDown className={cn(
            'h-4 w-4 text-muted-foreground transition-transform shrink-0',
            open && 'rotate-180',
          )} />
        </button>
        {rightSlot && <div onClick={(e) => e.stopPropagation()}>{rightSlot}</div>}
      </header>
      {open && <div className="p-4">{children}</div>}
    </section>
  );
}