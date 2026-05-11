import { PageAccessButton } from './PageAccessButton';
import { useLocation } from 'react-router-dom';
import { DepartmentLinks, type DepartmentKey } from '@/components/shared/DepartmentLinks';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  showAccessButton?: boolean;
  department?: DepartmentKey;
  eyebrow?: string;
}

export function PageHeader({ title, subtitle, showAccessButton = true, department, eyebrow }: PageHeaderProps) {
  const location = useLocation();

  // Derive an eyebrow from the route if none provided, so every page gets the editorial label
  const segs = location.pathname.split('/').filter(Boolean);
  const autoEyebrow = (segs[0] || 'lirah').replace(/-/g, ' ');
  const eyebrowText = eyebrow ?? autoEyebrow;

  return (
    <div className="relative -mx-4 sm:-mx-8 mb-2 px-4 sm:px-8 py-3 sm:py-4 overflow-hidden border-b-2 border-primary/25 hq-linen">
      {/* Left edge accent bar — bordô tab */}
      <div className="absolute left-0 top-3 bottom-3 w-[4px] bg-primary" />

      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="font-typewriter text-[10px] uppercase tracking-[0.32em] text-primary/70 mb-1">
            {eyebrowText}
          </div>
          <h1 className="font-display italic text-xl sm:text-2xl text-foreground leading-[1.05] truncate">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1 text-xs text-muted-foreground hidden sm:block max-w-2xl">
              <span className="font-display italic text-primary/70 mr-1.5">✦</span>
              {subtitle}
            </p>
          )}
          {department && (
            <div className="mt-2">
              <DepartmentLinks department={department} variant="inline" />
            </div>
          )}
        </div>
        {showAccessButton && (
          <PageAccessButton pagePath={location.pathname} pageTitle={title} />
        )}
      </div>
    </div>
  );
}
