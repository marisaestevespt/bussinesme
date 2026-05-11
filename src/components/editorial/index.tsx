import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Editorial primitives — vintage/editorial design language for Lirah.
 * These are the "signature gestures" that distinguish the app from generic SaaS.
 */

// ─── Eyebrow ───────────────────────────────────────────────
// Small caps tracking-wide label that sits above sections (like "ESTRUTURAÇÃO E OPERAÇÃO" in refs).
export function Eyebrow({
  children,
  className,
  tone = 'mocha',
}: {
  children: React.ReactNode;
  className?: string;
  tone?: 'mocha' | 'primary' | 'muted';
}) {
  const toneCls =
    tone === 'primary'
      ? 'text-primary'
      : tone === 'muted'
        ? 'text-muted-foreground'
        : 'text-[hsl(var(--brand-mocha))]';
  return (
    <div
      className={cn(
        'font-typewriter text-[10px] uppercase tracking-[0.22em]',
        toneCls,
        className,
      )}
    >
      {children}
    </div>
  );
}

// ─── SerifDivider ───────────────────────────────────────────────
// Horizontal rule with a serif italic word/symbol in the centre — replaces <hr>.
export function SerifDivider({
  children,
  symbol = '✦',
  className,
}: {
  children?: React.ReactNode;
  symbol?: string;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center gap-4 my-6', className)}>
      <div className="flex-1 h-px bg-border" />
      <div className="flex items-center gap-3 text-muted-foreground/70">
        <span className="text-[10px]">{symbol}</span>
        {children && (
          <span className="hq-display-italic text-sm text-foreground/70">{children}</span>
        )}
        <span className="text-[10px]">{symbol}</span>
      </div>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

// ─── SpeechBubble ───────────────────────────────────────────────
// Mostarda speech bubble with typewriter content — like the "comigo não funciona" ref.
export function SpeechBubble({
  children,
  className,
  variant = 'gold',
  tail = 'bottom-left',
}: {
  children: React.ReactNode;
  className?: string;
  variant?: 'gold' | 'primary' | 'cream';
  tail?: 'bottom-left' | 'bottom-right' | 'none';
}) {
  const bg =
    variant === 'primary'
      ? 'bg-primary text-primary-foreground'
      : variant === 'cream'
        ? 'bg-card text-foreground border border-primary/40'
        : 'bg-[hsl(var(--brand-gold)/0.85)] text-[hsl(26_40%_18%)]';
  const tailColor =
    variant === 'primary'
      ? 'border-t-primary'
      : variant === 'cream'
        ? 'border-t-card'
        : 'border-t-[hsl(var(--brand-gold)/0.85)]';
  return (
    <div className={cn('relative inline-block rounded-md px-4 py-2.5 font-typewriter text-sm', bg, className)}>
      {children}
      {tail !== 'none' && (
        <span
          className={cn(
            'absolute -bottom-2 w-0 h-0 border-l-[10px] border-r-[10px] border-t-[10px] border-l-transparent border-r-transparent',
            tailColor,
            tail === 'bottom-left' ? 'left-6' : 'right-6',
          )}
        />
      )}
    </div>
  );
}

// ─── EarCard ───────────────────────────────────────────────
// Card with a small bordô tag sticking out of the top-left corner (like "4/8" in refs).
export function EarCard({
  ear,
  children,
  className,
  onClick,
}: {
  ear?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <div className="relative">
      {ear && (
        <div className="absolute -top-2 -left-1 z-10 px-2 py-0.5 bg-primary text-primary-foreground font-typewriter text-[10px] uppercase tracking-widest rounded-sm shadow-sm">
          {ear}
        </div>
      )}
      <div
        onClick={onClick}
        className={cn(
          'rounded-md bg-card border border-border transition-colors',
          onClick && 'cursor-pointer hover:border-primary/40',
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}

// ─── BigKpi ───────────────────────────────────────────────
// Huge serif number with typewriter caption — editorial KPI display.
export function BigKpi({
  value,
  label,
  hint,
  onClick,
  align = 'left',
  className,
}: {
  value: React.ReactNode;
  label: React.ReactNode;
  hint?: React.ReactNode;
  onClick?: () => void;
  align?: 'left' | 'center';
  className?: string;
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'group',
        onClick && 'cursor-pointer',
        align === 'center' && 'text-center',
        className,
      )}
    >
      <Eyebrow>{label}</Eyebrow>
      <div className="font-display text-6xl sm:text-7xl leading-none mt-2 text-foreground group-hover:text-primary transition-colors tabular-nums">
        {value}
      </div>
      {hint && <div className="font-typewriter text-[11px] text-muted-foreground mt-2">{hint}</div>}
    </div>
  );
}

// ─── Highlight ───────────────────────────────────────────────
// Inline bordô marker-style highlight (like "realidade dura" in refs).
export function Highlight({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn('hq-underline-accent', className)}>{children}</span>;
}

// ─── DisplayItalic ───────────────────────────────────────────────
// Italic Cormorant accent for names / emphasised words inside headings.
export function DisplayItalic({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn('hq-display-italic', className)}>{children}</span>;
}