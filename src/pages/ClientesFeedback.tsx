import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BackNavigation } from '@/components/BackNavigation';
import { format, parseISO } from 'date-fns';
import { EmptyHint } from '@/components/ui/loading-skeletons';
import { useSectorConfig } from '@/hooks/useSectorConfig';

export default function ClientesFeedbackPage() {
  const navigate = useNavigate();
  const sectorConfig = useSectorConfig();

  // All manual feedback with client name
  const { data: manualFeedback = [] } = useQuery({
    queryKey: ['all_client_feedback'],
    queryFn: async () => {
      const { data, error } = await (supabase.from('client_feedback' as any) as any)
        .select('*, clients!client_feedback_client_id_fkey(id, full_name)')
        .order('submitted_at', { ascending: false });
      if (error) throw error;
      return (data || []).map((f: any) => ({
        ...f,
        source: f.source || 'manual',
        client_name: f.clients?.full_name || '—',
        client_db_id: f.clients?.id,
      })) as any[];
    },
  });

  // All portal feedback with client name (through portals)
  const { data: portalFeedback = [] } = useQuery({
    queryKey: ['all_portal_feedback'],
    queryFn: async () => {
      const { data, error } = await (supabase.from('portal_feedback' as any) as any)
        .select('*, client_portals!portal_feedback_portal_id_fkey(client_id, clients!client_portals_client_id_fkey(id, full_name))')
        .order('submitted_at', { ascending: false });
      if (error) throw error;
      return (data || []).map((f: any) => ({
        ...f,
        source: 'portal',
        client_name: f.client_portals?.clients?.full_name || '—',
        client_db_id: f.client_portals?.clients?.id || f.client_portals?.client_id,
      })) as any[];
    },
  });

  const allFeedback = [
    ...manualFeedback,
    ...portalFeedback,
  ].sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime());

  return (
    <AppLayout>
      <PageHeader title="Todos os Feedbacks" />
      <div className="space-y-6 pt-6">
        <BackNavigation parentRoute="/hub/clientes" parentLabel={sectorConfig.t('clientes')} />

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Feedbacks de todos os clientes</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="bg-primary text-primary-foreground px-4 py-2 font-medium text-xs grid grid-cols-[1fr_2fr_120px_100px] gap-2">
              <span>Cliente</span>
              <span>Feedback</span>
              <span>Data</span>
              <span>Origem</span>
            </div>
            {allFeedback.length === 0 ? (
              <EmptyHint>Sem feedbacks registados</EmptyHint>
            ) : (
              allFeedback.map((f: any) => (
                <div
                  key={`${f.source}-${f.id}`}
                  className="px-4 py-2.5 text-xs grid grid-cols-[1fr_2fr_120px_100px] gap-2 border-b hover:bg-muted/50 cursor-pointer items-center"
                  onClick={() => f.client_db_id && navigate(`/hub/clientes/${f.client_db_id}`)}
                >
                  <span className="font-medium truncate">{f.client_name}</span>
                  <span className="truncate">{f.content}</span>
                  <span className="text-muted-foreground">{format(parseISO(f.submitted_at), 'dd/MM/yyyy HH:mm')}</span>
                  <span>
                    <Badge variant="outline" className="text-[10px]">
                      {f.source === 'portal' ? 'Portal' : 'Manual'}
                    </Badge>
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
