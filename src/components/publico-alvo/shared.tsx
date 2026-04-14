import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

// ─── Note box ──────────────────────────────────────────────────
export function NoteBox({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg p-3 text-xs leading-relaxed bg-accent/10 border-l-[3px] border-accent text-accent-foreground">
      {children}
    </div>
  );
}

// ─── Quote block ───────────────────────────────────────────────
export function Quote({ children }: { children: ReactNode }) {
  return (
    <p className="text-xs italic text-muted-foreground/80 mt-1.5 pl-3 border-l-2 border-border">
      {children}
    </p>
  );
}

// ─── Accent card with left border ──────────────────────────────
const ACCENT_STYLES = {
  coral: 'border-l-[3px] border-primary bg-primary/5',
  blue: 'border-l-[3px] border-blue-500 bg-blue-50/50 dark:bg-blue-950/20',
  green: 'border-l-[3px] border-green-600 bg-green-50/50 dark:bg-green-950/20',
  amber: 'border-l-[3px] border-amber-500 bg-amber-50/50 dark:bg-amber-950/20',
  purple: 'border-l-[3px] border-purple-500 bg-purple-50/50 dark:bg-purple-950/20',
  teal: 'border-l-[3px] border-teal-600 bg-teal-50/50 dark:bg-teal-950/20',
  red: 'border-l-[3px] border-destructive bg-destructive/5',
  gray: 'border-l-[3px] border-muted-foreground/30 bg-muted/30',
} as const;

export type AccentColor = keyof typeof ACCENT_STYLES;

export function AccentCard({
  color,
  title,
  children,
  className,
}: {
  color: AccentColor;
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn('overflow-hidden', ACCENT_STYLES[color], className)}>
      <CardContent className="p-4">
        {title && <p className="text-xs font-semibold text-foreground mb-2">{title}</p>}
        {children}
      </CardContent>
    </Card>
  );
}

// ─── Small info card ───────────────────────────────────────────
export function InfoCard({ title, text }: { title: string; text: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground mb-2">{title}</p>
        <p className="text-xs text-foreground leading-relaxed">{text}</p>
      </CardContent>
    </Card>
  );
}

// ─── Tag / Badge ───────────────────────────────────────────────
const TAG_STYLES = {
  coral: 'bg-primary/10 text-primary',
  blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  green: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  purple: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  teal: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
  gray: 'bg-muted text-muted-foreground',
  red: 'bg-destructive/10 text-destructive',
} as const;

export function Tag({ color, children }: { color: AccentColor; children: ReactNode }) {
  return (
    <span className={cn('inline-block text-[10px] font-medium px-2 py-0.5 rounded', TAG_STYLES[color])}>
      {children}
    </span>
  );
}

// ─── Section wrapper ───────────────────────────────────────────
export function Section({
  id,
  num,
  label,
  title,
  subtitle,
  children,
}: {
  id: string;
  num: string;
  label: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <p className="text-[10px] uppercase tracking-[2.5px] font-medium text-primary mb-1.5">
        {num} · {label}
      </p>
      <h3 className="text-xl sm:text-2xl font-semibold text-foreground leading-tight mb-2">{title}</h3>
      <div className="w-10 h-0.5 bg-primary mb-4" />
      {subtitle && (
        <p className="text-sm text-muted-foreground leading-relaxed mb-5 max-w-[680px]">{subtitle}</p>
      )}
      {children}
    </section>
  );
}
