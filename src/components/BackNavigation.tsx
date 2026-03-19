import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Home } from 'lucide-react';

interface BackNavigationProps {
  /** The parent/module route (e.g. '/hub/marketing') */
  parentRoute: string;
  /** Label for the parent button (e.g. 'Marketing') */
  parentLabel: string;
  /** Optional: use a callback instead of history.back() */
  onBack?: () => void;
}

export function BackNavigation({ parentRoute, parentLabel, onBack }: BackNavigationProps) {
  const navigate = useNavigate();

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="sm"
        className="gap-1.5 text-muted-foreground hover:text-foreground"
        onClick={onBack || (() => navigate(-1))}
      >
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="gap-1.5 text-muted-foreground hover:text-foreground"
        onClick={() => navigate(parentRoute)}
      >
        <Home className="h-3.5 w-3.5" /> {parentLabel}
      </Button>
    </div>
  );
}
