import { Button } from '@/components/ui/button';
import { BackNavigation } from '@/components/BackNavigation';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

export interface EntityAction {
  label: string;
  icon?: React.ElementType;
  onClick: () => void;
  variant?: 'default' | 'outline' | 'ghost' | 'destructive';
  disabled?: boolean;
  loading?: boolean;
  hideLabelOnMobile?: boolean;
}

interface EntityTopBarProps {
  backTo: string;
  backLabel: string;
  primaryAction?: EntityAction;
  secondaryActions?: EntityAction[];
}

/**
 * Canonical top bar for all entity detail pages.
 * Layout: [Back] ... [secondary actions] [primary action]
 */
export function EntityTopBar({ backTo, backLabel, primaryAction, secondaryActions = [] }: EntityTopBarProps) {
  const renderAction = (action: EntityAction, key: string | number, isPrimary = false) => {
    const Icon = action.loading ? Loader2 : action.icon;
    const variant = action.variant || (isPrimary ? 'default' : 'outline');
    const isDestructive = action.variant === 'destructive';
    return (
      <Button
        key={key}
        size="sm"
        variant={isDestructive ? 'outline' : variant}
        className={cn(isDestructive && 'text-destructive hover:text-destructive')}
        onClick={action.onClick}
        disabled={action.disabled || action.loading}
      >
        {Icon && <Icon className={cn('h-4 w-4', action.label && 'mr-1', action.loading && 'animate-spin')} />}
        <span className={cn(action.hideLabelOnMobile && 'hidden sm:inline')}>{action.label}</span>
      </Button>
    );
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <BackNavigation parentRoute={backTo} parentLabel={backLabel} />
      <div className="flex-1" />
      {secondaryActions.map((a, i) => renderAction(a, `s-${i}`))}
      {primaryAction && renderAction(primaryAction, 'primary', true)}
    </div>
  );
}