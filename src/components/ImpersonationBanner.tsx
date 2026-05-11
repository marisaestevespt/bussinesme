import { Eye, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useImpersonation } from '@/contexts/ImpersonationContext';

export function ImpersonationBanner() {
  const { impersonating, stopImpersonation } = useImpersonation();
  if (!impersonating) return null;

  return (
    <div className="sticky top-0 z-50 w-full bg-warning/95 text-warning border-b border-warning/40 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
        <div className="flex items-center gap-2 min-w-0">
          <Eye className="h-4 w-4 shrink-0" />
          <span className="truncate">
            A pré-visualizar como <strong>{impersonating.full_name}</strong>
            {impersonating.role_title && <span className="opacity-80"> · {impersonating.role_title}</span>}
            <span className="opacity-70"> · modo só de leitura</span>
          </span>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-7 bg-white/80 hover:bg-white border-warning/40"
          onClick={() => stopImpersonation()}
        >
          <X className="h-3 w-3 mr-1" /> Sair
        </Button>
      </div>
    </div>
  );
}
