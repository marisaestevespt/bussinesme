import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Copy, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { useAllPortals } from '@/hooks/usePortalData';
import { useClients } from '@/hooks/useClients';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { BackNavigation } from '@/components/BackNavigation';

export default function PortalClientesPage() {
  const navigate = useNavigate();
  const { data: portals = [], isLoading } = useAllPortals();
  const { clients } = useClients();
  const clientsList = clients.data || [];
  const qc = useQueryClient();

  const getClient = (clientId: string) => clientsList.find(c => c.id === clientId);

  const toggleActive = async (portalId: string, current: boolean) => {
    await (supabase.from('client_portals' as any) as any).update({ is_active: !current }).eq('id', portalId);
    qc.invalidateQueries({ queryKey: ['all_portals'] });
  };

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3">
          <BackNavigation parentRoute="/hub/clientes" parentLabel="Clientes" />
          <PageHeader title="Portal de Clientes" />
        </div>

        <Card>
          <CardContent className="p-0">
            <div className="bg-primary text-primary-foreground px-4 py-2.5 font-medium text-xs grid grid-cols-7 gap-2">
              <span>Cliente</span>
              <span>Data de Início</span>
              <span>Fim de Ciclo</span>
              <span>Tipo</span>
              <span>Link</span>
              <span>Estado</span>
              <span>Última Visita</span>
            </div>
            {isLoading ? (
              <p className="text-center text-muted-foreground py-8 text-sm">A carregar...</p>
            ) : portals.length === 0 ? (
              <p className="text-center text-muted-foreground py-12 text-sm">Sem portais criados</p>
            ) : (
              portals.map(p => {
                const client = getClient(p.client_id);
                const portalUrl = `${window.location.origin}/portal/${p.token}`;
                return (
                  <div key={p.id} className="px-4 py-2.5 text-sm grid grid-cols-7 gap-2 border-b hover:bg-muted/50 items-center">
                    <span
                      className="truncate font-medium cursor-pointer hover:underline"
                      onClick={() => navigate(`/hub/clientes/${p.client_id}`)}
                    >
                      {client?.full_name || '—'}
                    </span>
                    <span className="text-xs">{client?.start_date ? format(parseISO(client.start_date), 'dd/MM/yyyy') : '—'}</span>
                    <span className="text-xs">{client?.end_of_cycle ? format(parseISO(client.end_of_cycle), 'dd/MM/yyyy') : '—'}</span>
                    <span>
                      <Badge variant="outline" className="text-[10px]">
                        {p.portal_type === 'projeto_unico' ? 'Projeto Único' : 'Produto Mensal'}
                      </Badge>
                    </span>
                    <span className="flex items-center gap-1">
                      <Button variant="outline" size="sm" className="h-6 text-[10px] gap-1" onClick={() => { navigator.clipboard.writeText(portalUrl); toast.success('Link copiado'); }}>
                        <Copy className="h-3 w-3" />Copiar
                      </Button>
                      <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1" onClick={() => navigate(`/portal/${p.token}/view`)}>
                        <ExternalLink className="h-3 w-3" />Abrir
                      </Button>
                    </span>
                    <span>
                      <Switch checked={p.is_active} onCheckedChange={() => toggleActive(p.id, p.is_active)} />
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {p.last_visit_at ? format(parseISO(p.last_visit_at), 'dd/MM/yyyy HH:mm') : '—'}
                    </span>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
