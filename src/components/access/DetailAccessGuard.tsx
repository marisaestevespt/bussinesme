import { ReactNode } from 'react';
import { Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useDetailAccess } from '@/hooks/useDetailAccess';
import { InlineLoader } from '@/components/ui/loading-skeletons';
import { AppLayout } from '@/components/AppLayout';

interface Props {
  entity: 'meeting' | 'client';
  id: string | null | undefined;
  children: ReactNode;
}

/**
 * Bloqueia o conteúdo do detalhe quando o utilizador não tem permissão para o abrir.
 * Owner/Admin nunca veem o bloqueio.
 */
export function DetailAccessGuard({ entity, id, children }: Props) {
  const navigate = useNavigate();
  const { data: canOpen, isLoading } = useDetailAccess(entity, id);

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex h-[60vh] items-center justify-center">
          <InlineLoader />
        </div>
      </AppLayout>
    );
  }

  if (!canOpen) {
    const label = entity === 'meeting' ? 'reunião' : 'cliente';
    return (
      <AppLayout>
        <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <Lock className="h-8 w-8 text-muted-foreground" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-semibold">Sem acesso a este detalhe</h2>
          <p className="text-sm text-muted-foreground">
            Não tens permissão para abrir esta {label}. Pede ao responsável para te
            adicionar como participante ou contacta um administrador.
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate(-1)}>
          Voltar
        </Button>
        </div>
      </AppLayout>
    );
  }

  return <>{children}</>;
}