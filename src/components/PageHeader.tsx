import { PageAccessButton } from './PageAccessButton';
import { useLocation } from 'react-router-dom';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  showAccessButton?: boolean;
}

export function PageHeader({ title, subtitle, showAccessButton = true }: PageHeaderProps) {
  const location = useLocation();

  return (
    <div className="relative -mx-4 sm:-mx-8 px-4 sm:px-8 py-5 sm:py-8 overflow-hidden border-b border-border/60">
      {/* Warm tinted background */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(135deg, hsl(var(--primary) / 0.10) 0%, hsl(var(--primary) / 0.04) 50%, hsl(var(--gradient-end)) 100%)`,
        }}
      />

      {/* Decorative accent orb — hidden on mobile to avoid visual noise */}
      <div
        className="hidden sm:block absolute -top-8 -right-8 w-56 h-56 rounded-full opacity-[0.10] blur-3xl"
        style={{ background: `hsl(var(--gradient-accent))` }}
      />

      {/* Left edge accent bar */}
      <div
        className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full"
        style={{ background: `hsl(var(--primary) / 0.35)` }}
      />

      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground truncate">{title}</h1>
          {subtitle && (
            <p className="mt-1 sm:mt-1.5 text-xs sm:text-sm text-muted-foreground hidden sm:block">{subtitle}</p>
          )}
        </div>
        {showAccessButton && (
          <PageAccessButton pagePath={location.pathname} pageTitle={title} />
        )}
      </div>
    </div>
  );
}
