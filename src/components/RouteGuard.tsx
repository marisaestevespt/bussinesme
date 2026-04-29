import { ReactNode, useEffect } from 'react';
import { useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useImpersonation } from '@/contexts/ImpersonationContext';
import { usePermissions } from '@/hooks/usePermissions';
import { InlineLoader } from '@/components/ui/loading-skeletons';
import { toast } from 'sonner';

/**
 * Maps a pathname to the module key that protects it. Unknown paths are
 * treated as public-within-app (no module restriction). Owner-only sections
 * (executive room + definições) are flagged separately.
 */
function resolveAccess(pathname: string): { moduleKey?: string; ownerOnly?: boolean } {
  // Always allowed for any authenticated user
  if (
    pathname === '/' ||
    pathname === '/secretaria' ||
    pathname === '/hub-equipa' ||
    pathname === '/comeca-aqui' ||
    pathname === '/ajuda' ||
    pathname.startsWith('/portal/') ||
    pathname === '/reset-password'
  ) return {};

  // Owner-only areas
  if (pathname.startsWith('/executive')) return { ownerOnly: true };
  if (pathname === '/definicoes') return { ownerOnly: true };
  if (pathname.startsWith('/admin/')) return { ownerOnly: true };

  // Hub modules: /hub/<module>/...
  const hubMatch = pathname.match(/^\/hub\/([^/]+)/);
  if (hubMatch) {
    const seg = hubMatch[1];
    // Map URL segment → module key (most match 1:1)
    const map: Record<string, string> = {
      'agenda': 'agenda',
      'reunioes': 'reunioes',
      'processos': 'processos',
      'projetos': 'projetos',
      'tarefas': 'tarefas',
      'acessos': 'acessos',
      'mural': 'mural',
      'biblioteca': 'biblioteca',
      'marketing': 'marketing',
      'financeiro': 'financeiro',
      'comercial': 'comercial',
      'clientes': 'clientes',
      'equipa': 'equipa',
      'operacao': 'operacao',
      'produtos': 'produtos',
      'recursos-humanos': 'recursos-humanos',
      'administrativo': 'administrativo',
    };
    return { moduleKey: map[seg] || seg };
  }

  // Legacy /tarefas
  if (pathname === '/tarefas') return { moduleKey: 'tarefas' };

  return {};
}

export function RouteGuard({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { isOwner } = useAuth();
  const { impersonating } = useImpersonation();
  const { canAccess, hasPageAccess, loading } = usePermissions();

  const { moduleKey, ownerOnly } = resolveAccess(location.pathname);

  const isUnrestrictedOwner = isOwner && !impersonating;
  const denied = !isUnrestrictedOwner && !loading && (
    !!ownerOnly ||
    (!!moduleKey && !canAccess(moduleKey as any) && !hasPageAccess(location.pathname))
  );

  useEffect(() => {
    if (denied) {
      toast.error('Sem acesso', {
        description: impersonating
          ? 'Este membro não tem acesso a esta página.'
          : 'Não tens permissão para aceder a esta página.',
      });
    }
  }, [denied, impersonating]);

  if (isUnrestrictedOwner) return <>{children}</>;
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <InlineLoader />
      </div>
    );
  }
  if (denied) return <Navigate to="/secretaria" replace />;
  return <>{children}</>;
}