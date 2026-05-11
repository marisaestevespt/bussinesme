import * as React from 'react';

export const SectionCard = ({
  children, className = '', onClick, style,
}: { children: React.ReactNode; className?: string; onClick?: () => void; style?: React.CSSProperties }) => (
  <div
    className={`bg-white border border-[hsl(var(--border))]/60 transition-shadow hover:shadow-[0_10px_30px_-12px_rgba(109,46,70,0.08)] ${className}`}
    onClick={onClick}
    style={{ borderRadius: 4, ...style }}
  >
    {children}
  </div>
);

export const SectionTitle = ({
  children, icon: Icon,
}: { children: React.ReactNode; icon?: any }) => (
  <div className="flex items-center gap-3 mb-5 pb-3 border-b border-[hsl(var(--border))]/40">
    {Icon && <Icon className="h-4 w-4 text-primary/70" strokeWidth={1.5} />}
    <span className="text-[10px] tracking-[0.3em] uppercase font-semibold text-primary/60 flex-1">
      {children}
    </span>
    <div className="h-[1px] w-8 bg-primary/20" />
  </div>
);