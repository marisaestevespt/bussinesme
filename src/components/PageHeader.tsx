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
    <div className="relative -mx-4 sm:-mx-8 bg-primary px-4 sm:px-8 py-6 overflow-hidden">
      {/* Decorative shapes */}
      <div className="absolute top-0 right-0 w-48 h-48 rounded-full bg-primary-foreground/5 -translate-y-1/2 translate-x-1/4" />
      <div className="absolute bottom-0 left-1/3 w-32 h-32 rounded-full bg-primary-foreground/5 translate-y-1/2" />

      <div className="relative flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-primary-foreground">{title}</h1>
          {subtitle && (
            <p className="mt-1.5 text-sm text-primary-foreground/70">{subtitle}</p>
          )}
        </div>
        {showAccessButton && (
          <PageAccessButton pagePath={location.pathname} pageTitle={title} />
        )}
      </div>
    </div>
  );
}
