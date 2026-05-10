import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Copy, ExternalLink, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { useAllPortals } from '@/hooks/usePortalData';
import { useClients } from '@/hooks/useClients';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {InlineLoader, EmptyHint } from '@/components/ui/loading-skeletons';
import { BackNavigation } from '@/components/BackNavigation';
import { useSectorConfig } from '@/hooks/useSectorConfig';

const sb = (t: string) => supabase.from(t as any) as any;

export default function PortalClientesPage() {
  const navigate = useNavigate();
  const { data: portals = [], isLoading } = useAllPortals();
  const sectorConfig = useSectorConfig();
  const { clients } = useClients();
  const clientsList = clients.data || [];
  const qc = useQueryClient();

  // Fetch latest visit per portal, grouped by whether it's a client email
  const portalIds = portals.map(p => p.id);
  const { data: visits = [] } = useQuery({
    queryKey: ['portal_visits', portalIds],
    queryFn: async () => {
      if (!portalIds.length) return [];
      const { data, error } = await sb('portal_visits')
        .select('portal_id, email, visited_at')
        .in('portal_id', portalIds)
        .order('visited_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data || []) as { portal_id: string; email: string; visited_at: string }[];
    },
    enabled: portalIds.length > 0,
  });

  const getClient = (clientId: string) => clientsList.find(c => c.id === clientId);

  // Build a map: portalId -> { clientVisit, anyVisit }
  const visitMap = new Map<string, { clientEmail: string | null; clientVisitAt: string | null; lastVisitAt: string | null; lastVisitEmail: string | null }>();
  portals.forEach(p => {
    const client = getClient(p.client_id);
    const clientEmail = client?.email?.toLowerCase() || null;
    const portalVisits = visits.filter(v => v.portal_id === p.id);
    const lastVisit = portalVisits[0] || null;
    const clientVisit = clientEmail ? portalVisits.find(v => v.email.toLowerCase() === clientEmail) : null;
    visitMap.set(p.id, {
      clientEmail,
      clientVisitAt: clientVisit?.visited_at || null,
      lastVisitAt: lastVisit?.visited_at || null,
      lastVisitEmail: lastVisit?.email || null,
    });
  });

  const toggleActive = async (portalId: string, current: boolean) => {
    await sb('client_portals').update({ is_active: !current }).eq('id', portalId);
    qc.invalidateQueries({ queryKey: ['all_portals'] });
  };

  return (
    <AppLayout>
      <PageHeader title="Portal de Clientes" />
      <div className="space-y-6 pt-6">
        <BackNavigation parentRoute="/hub/clientes" parentLabel={sectorConfig.t('clientes')} />

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <div className="min-w-[960px]">
              <div className="bg-primary text-primary-foreground px-4 py-2.5 font-medium text-xs grid grid-cols-8 gap-2">
                <span>Cliente</span>
                <span>Data de Início</span>
                <span>Fim de Ciclo</span>
                <span>Tipo</span>
                <span>Link</span>
                <span>Estado</span>
                <span>Visita Cliente</span>
                <span>Última Visita</span>
              </div>
              {isLoading ? (
              <InlineLoader />
            ) : portals.length === 0 ? (
              <EmptyHint>Sem portais criados</EmptyHint>
            ) : (
              portals.map(p => {
                const client = getClient(p.client_id);
                const portalUrl = `${window.location.origin}/portal/${p.token}`;
                const vm = visitMap.get(p.id);
                return (
                  <div key={p.id} className="px-4 py-2.5 text-sm grid grid-cols-8 gap-2 border-b hover:bg-muted/50 items-center">
                    <span
                      className="truncate font-medium cursor-pointer hover:underline"
                      onClick={() => navigate(`/hub/clientes/${p.client_id}`)}
                    >
                      {client?.full_name || '—'}
                    </span>
                    <span className="text-xs">{client?.start_date ? format(parseISO(client.start_date), 'dd/MM/yyyy') : '—'}</span>
                    <span className="text-xs">{client?.end_of_cycle ? format(parseISO(client.end_of_cycle), 'dd/MM/yyyy') : '—'}</span>
                    <span>
                      {p.portal_type === 'projeto_unico' ? (
                        <Badge
                          variant="outline"
                          className="text-[10px] bg-primary/10 text-primary border-primary/30"
                        >
                          Projeto Único
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="text-[10px] bg-success/10 text-success border-success/30"
                        >
                          Serviço Mensal
                        </Badge>
                      )}
                    </span>
                    <span className="flex items-center gap-1">
                      <Button variant="outline" size="sm" className="h-6 text-[10px] gap-1" onClick={() => { navigator.clipboard.writeText(portalUrl); toast.success('Link copiado'); }}>
                        <Copy className="h-3 w-3" />Copiar
                      </Button>
                      <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1" asChild>
                        <a href={`/portal/${p.token}/view`} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3 w-3" />Abrir</a>
                      </Button>
                    </span>
                    <span>
                      <Switch checked={p.is_active} onCheckedChange={() => toggleActive(p.id, p.is_active)} />
                    </span>
                    {/* Client-specific visit */}
                    <span className="text-xs">
                      {vm?.clientVisitAt ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="flex items-center gap-1 text-success">
                              <Eye className="h-3 w-3" />
                              {format(parseISO(vm.clientVisitAt), 'dd/MM/yyyy HH:mm')}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>{vm.clientEmail}</TooltipContent>
                        </Tooltip>
                      ) : (
                        <span className="text-muted-foreground">Ainda não acedeu</span>
                      )}
                    </span>
                    {/* Last visit (anyone) */}
                    <span className="text-xs text-muted-foreground">
                      {vm?.lastVisitAt ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span>{format(parseISO(vm.lastVisitAt), 'dd/MM/yyyy HH:mm')}</span>
                          </TooltipTrigger>
                          <TooltipContent>{vm.lastVisitEmail}</TooltipContent>
                        </Tooltip>
                      ) : (
                        '—'
                      )}
                    </span>
                  </div>
                );
              })
            )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}