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
    <div className="flex items-center justify-between border-b border-border pb-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
        {subtitle && (
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {showAccessButton && (
        <PageAccessButton pagePath={location.pathname} pageTitle={title} />
      )}
    </div>
  );
}
