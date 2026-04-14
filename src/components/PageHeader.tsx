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
    <div className="relative -mx-4 sm:-mx-8 px-4 sm:px-8 py-8 overflow-hidden">
      {/* Subtle gradient background */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(135deg, hsl(var(--gradient-start)) 0%, hsl(var(--gradient-end)) 70%)`,
        }}
      />

      {/* Decorative accent orb */}
      <div
        className="absolute -top-12 -right-12 w-48 h-48 rounded-full opacity-[0.04] blur-3xl"
        style={{ background: `hsl(var(--gradient-accent))` }}
      />

      {/* Bottom border with gradient */}
      <div
        className="absolute bottom-0 left-0 right-0 h-px"
        style={{
          background: `linear-gradient(90deg, transparent 0%, hsl(var(--primary) / 0.15) 50%, transparent 100%)`,
        }}
      />

      <div className="relative flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
          {subtitle && (
            <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>
          )}
        </div>
        {showAccessButton && (
          <PageAccessButton pagePath={location.pathname} pageTitle={title} />
        )}
      </div>
    </div>
  );
}
