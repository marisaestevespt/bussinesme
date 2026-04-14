import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

// ─── Note box ──────────────────────────────────────────────────
export function NoteBox({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg p-3 text-xs leading-relaxed bg-accent/10 border-l-[3px] border-accent text-foreground">
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
  info: 'border-l-[3px] border-info bg-info/5',
  success: 'border-l-[3px] border-success bg-success/5',
  warning: 'border-l-[3px] border-warning bg-warning/5',
  accent: 'border-l-[3px] border-accent bg-accent/5',
  muted: 'border-l-[3px] border-muted-foreground/30 bg-muted/30',
  destructive: 'border-l-[3px] border-destructive bg-destructive/5',
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
  info: 'bg-info/10 text-info',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  accent: 'bg-accent-foreground/15 text-accent-foreground',
  muted: 'bg-muted text-muted-foreground',
  destructive: 'bg-destructive/10 text-destructive',
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
    <section id={id}>
      <h3 className="text-xl sm:text-2xl font-semibold text-foreground leading-tight mb-2">{title}</h3>
      <div className="w-10 h-0.5 bg-primary mb-4" />
      {subtitle && (
        <p className="text-sm text-muted-foreground leading-relaxed mb-5 max-w-[680px]">{subtitle}</p>
      )}
      {children}
    </section>
  );
}
