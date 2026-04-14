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
    <div className="relative -mx-4 sm:-mx-8 px-4 sm:px-8 py-8 overflow-hidden rounded-b-2xl" style={{ background: 'linear-gradient(135deg, hsl(var(--gradient-start)), hsl(var(--gradient-end)))' }}>
      {/* Decorative warm glow */}
      <div className="absolute top-1/2 left-1/3 w-64 h-64 rounded-full -translate-y-1/2 opacity-30 blur-3xl" style={{ background: 'hsl(var(--primary) / 0.15)' }} />

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
