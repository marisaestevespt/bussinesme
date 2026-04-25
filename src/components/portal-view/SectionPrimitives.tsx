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
  <div className="flex items-center gap-2 mb-3">
    {Icon && <Icon className="h-5 w-5 text-muted-foreground" />}
    <h2 className="text-lg font-semibold tracking-tight">{children}</h2>
  </div>
);