import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Home } from 'lucide-react';
import { useParentNavigation } from '@/hooks/useParentNavigation';

interface BackNavigationProps {
  /** Override: The parent/module route (e.g. '/hub/marketing'). Auto-derived if omitted. */
  parentRoute?: string;
  /** Override: Label for the parent button. Auto-derived if omitted. */
  parentLabel?: string;
  /** Optional: use a callback instead of history.back() */
  onBack?: () => void;
}

export function BackNavigation({ parentRoute, parentLabel, onBack }: BackNavigationProps) {
  const navigate = useNavigate();
  const auto = useParentNavigation();

  const route = parentRoute || auto?.parentRoute;
  const label = parentLabel || auto?.parentLabel;

  // If no parent could be determined, don't render
  if (!route || !label) return null;

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="sm"
        className="gap-2 text-muted-foreground hover:text-foreground"
        onClick={onBack || (() => navigate(-1))}
      >
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="gap-2 text-muted-foreground hover:text-foreground"
        onClick={() => navigate(route)}
      >
        <Home className="h-3.5 w-3.5" /> {label}
      </Button>
    </div>
  );
}
