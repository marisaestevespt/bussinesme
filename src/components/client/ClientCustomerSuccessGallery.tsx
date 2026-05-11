import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Star, ChevronRight } from 'lucide-react';
import { ClientFeedbackSection } from './ClientFeedbackSection';
import { ClientCustomerSuccess } from './ClientCustomerSuccess';

interface Props {
  clientId: string | undefined;
  clientName: string;
  productName: string | null;
  startDate: string | null;
  isNew: boolean;
}

type TileKey = 'feedback' | 'nps' | null;

export function ClientCustomerSuccessGallery({ clientId, clientName, productName, startDate, isNew }: Props) {
  const [open, setOpen] = useState<TileKey>(null);

  // ── Summary queries ───────────────────────────────────────────
  const { data: feedbackCount = 0 } = useQuery({
    queryKey: ['cs-summary-feedback', clientId],
    enabled: !!clientId,
    queryFn: async () => {
      if (!clientId) return 0;
      const { count: manualCount } = await (supabase.from('client_feedback' as any) as any)
        .select('id', { count: 'exact', head: true })
        .eq('client_id', clientId);
      const { data: portal } = await (supabase.from('client_portals' as any) as any)
        .select('id').eq('client_id', clientId).maybeSingle();
      let portalCount = 0;
      if (portal?.id) {
        const { count } = await (supabase.from('portal_feedback' as any) as any)
          .select('id', { count: 'exact', head: true }).eq('portal_id', portal.id);
        portalCount = count || 0;
      }
      return (manualCount || 0) + portalCount;
    },
  });

  const { data: npsSummary } = useQuery({
    queryKey: ['cs-summary-nps', clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data } = await (supabase.from('client_nps_records' as any) as any)
        .select('status,nps_score').eq('client_id', clientId);
      const list = (data || []) as any[];
      const done = list.filter(r => r.status === 'feito' && r.nps_score != null);
      const avg = done.length ? (done.reduce((s, r) => s + Number(r.nps_score), 0) / done.length).toFixed(1) : '—';
      const pending = list.filter(r => r.status !== 'feito').length;
      return { total: list.length, done: done.length, pending, avg };
    },
  });

  const tiles = [
    {
      key: 'feedback' as const,
      title: 'Feedback Recebido',
      icon: MessageSquare,
      gradient: 'from-accent-violet/20 via-accent-violet/10 to-transparent',
      accent: 'border-l-accent-violet',
      iconBg: 'bg-accent-violet/15 text-accent-violet',
      stats: [
        { label: 'Total', value: String(feedbackCount) },
      ],
      caption: feedbackCount === 0 ? 'Sem feedback registado' : `${feedbackCount} registo(s) recebido(s)`,
    },
    {
      key: 'nps' as const,
      title: 'Recolha de NPS',
      icon: Star,
      gradient: 'from-primary/20 via-primary/10 to-transparent',
      accent: 'border-l-primary',
      iconBg: 'bg-primary/15 text-primary',
      stats: [
        { label: 'Média', value: npsSummary?.avg ?? '—' },
        { label: 'Recolhidos', value: String(npsSummary?.done ?? 0) },
        { label: 'Pendentes', value: String(npsSummary?.pending ?? 0) },
      ],
      caption: !productName ? 'Associa um produto para ativar' : `${npsSummary?.total ?? 0} datas planeadas`,
    },
  ];

  const dialogTitle =
    open === 'feedback' ? 'Feedback Recebido' :
    open === 'nps' ? 'Recolha de NPS' : '';

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map(tile => {
          const Icon = tile.icon;
          return (
            <button
              key={tile.key}
              type="button"
              onClick={() => setOpen(tile.key)}
              className={`group text-left relative rounded-xl border border-l-4 ${tile.accent} bg-gradient-to-br ${tile.gradient} bg-card p-5 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all`}
            >
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className={`h-11 w-11 rounded-lg flex items-center justify-center ${tile.iconBg}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
              </div>
              <h3 className="text-base font-semibold mb-3">{tile.title}</h3>
              <div className="flex flex-wrap gap-3 mb-3">
                {tile.stats.map(s => (
                  <div key={s.label} className="flex flex-col">
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{s.label}</span>
                    <span className="text-xl font-bold leading-tight">{s.value}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">{tile.caption}</p>
            </button>
          );
        })}
      </div>

      <Dialog open={open !== null} onOpenChange={v => !v && setOpen(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
          </DialogHeader>
          <div className="mt-2">
            {open === 'feedback' && (
              <ClientFeedbackSection clientId={clientId} clientName={clientName} />
            )}
            {open === 'nps' && !isNew && clientId && (
              <ClientCustomerSuccess
                clientId={clientId}
                clientName={clientName}
                productName={productName}
                startDate={startDate}
                onlySection="nps"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
