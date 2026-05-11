import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ExternalLink, FolderOpen } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';
import { getStatusInfo, getTypeInfo } from '@/pages/Projetos';
import { EmptyHint } from '@/components/ui/loading-skeletons';

interface ProjectRow {
  id: string;
  name: string;
  type: string | null;
  status: string | null;
  deadline: string | null;
  client_id: string | null;
  client_name: string | null;
  progress: number | null;
}

export function ProductProjectsSection({ productId, productName, mode = 'all' }: { productId: string; productName: string; mode?: 'client' | 'internal' | 'all' }) {
  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['product-projects', productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name, type, status, deadline, client_id, client_name, progress')
        .eq('product_id', productId)
        .is('archived_at', null)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map((p: any) => ({
        id: p.id, name: p.name, type: p.type, status: p.status,
        deadline: p.deadline, client_id: p.client_id,
        client_name: p.client_name ?? null, progress: p.progress,
      })) as ProjectRow[];
    },
    enabled: !!productId,
  });

  const clientProjects = projects.filter(p => !!p.client_id);
  const internalProjects = projects.filter(p => !p.client_id);

  const renderRow = (p: ProjectRow) => {
    const statusI = getStatusInfo(p.status || '');
    const typeI = getTypeInfo(p.type || '');
    return (
      <Link
        key={p.id}
        to={`/hub/projetos/${p.id}`}
        className="flex items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2.5 hover:bg-muted/50 hq-transition group"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium truncate">{p.name}</span>
            {p.client_name && <span className="text-xs text-muted-foreground">· {p.client_name}</span>}
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {typeI && <Badge variant="outline" className="text-[10px] h-4 px-1.5">{typeI.label}</Badge>}
            {statusI && <Badge className={`${statusI.color} border-0 text-[10px] h-4 px-1.5`}>{statusI.label}</Badge>}
            {p.deadline && (
              <span className="text-[11px] text-muted-foreground">
                até {format(parseISO(p.deadline), "d MMM yyyy", { locale: pt })}
              </span>
            )}
            {typeof p.progress === 'number' && p.progress > 0 && (
              <span className="text-[11px] text-muted-foreground">{p.progress}%</span>
            )}
          </div>
        </div>
        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 hq-transition shrink-0" />
      </Link>
    );
  };

  return (
    <div className="space-y-4">
      {(mode === 'all' || mode === 'client') && (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FolderOpen className="h-4 w-4 text-primary" />
            Projetos de Cliente
            <Badge variant="secondary" className="ml-1">{clientProjects.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">A carregar…</p>
          ) : clientProjects.length === 0 ? (
            <EmptyHint>Sem projetos de cliente associados a {productName}.</EmptyHint>
          ) : (
            <div className="space-y-2">{clientProjects.map(renderRow)}</div>
          )}
        </CardContent>
      </Card>
      )}

      {(mode === 'all' || mode === 'internal') && (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FolderOpen className="h-4 w-4 text-primary" />
            Projetos Internos
            <Badge variant="secondary" className="ml-1">{internalProjects.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">A carregar…</p>
          ) : internalProjects.length === 0 ? (
            <EmptyHint>Sem projetos internos (R&D, melhorias, lançamentos) associados.</EmptyHint>
          ) : (
            <div className="space-y-2">{internalProjects.map(renderRow)}</div>
          )}
        </CardContent>
      </Card>
      )}

      <div className="flex justify-end">
        <Button asChild variant="outline" size="sm">
          <Link to={`/hub/projetos?product_id=${productId}`}>
            Ver todos no módulo Projetos <ExternalLink className="h-3 w-3 ml-1" />
          </Link>
        </Button>
      </div>
    </div>
  );
}