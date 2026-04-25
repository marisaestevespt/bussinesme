import * as React from 'react';

export const SectionCard = ({
  children, className = '', onClick, style,
}: { children: React.ReactNode; className?: string; onClick?: () => void; style?: React.CSSProperties }) => (
  <div
    className={`bg-white rounded-2xl border border-border/40 shadow-sm hover:shadow-md transition-shadow ${className}`}
    onClick={onClick}
    style={style}
  >
    {children}
  </div>
);

export const SectionTitle = ({
  children, icon: Icon,
}: { children: React.ReactNode; icon?: any }) => (
  <div className="flex items-center gap-2.5 mb-4">
    {Icon && <div className="p-2 rounded-xl bg-primary/10"><Icon className="h-4 w-4 text-primary" /></div>}
    <h2 className="text-lg font-bold tracking-tight" style={{ fontFamily: 'var(--font-display, "Plus Jakarta Sans", sans-serif)' }}>{children}</h2>
  </div>
);