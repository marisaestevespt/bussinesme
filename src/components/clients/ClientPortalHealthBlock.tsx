import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Activity, CheckCircle2, AlertCircle, AlertTriangle } from 'lucide-react';
import { format, parseISO, differenceInDays } from 'date-fns';
import { pt } from 'date-fns/locale';

interface Health {
  portal_active: boolean;
  has_account_manager: boolean;
  last_login_at: string | null;
  pending_requests: number;
  pending_feedback: number;
  overdue_recolhas: number;
}

type Tone = 'good' | 'warn' | 'bad';
const TONE_STYLES: Record<Tone, string> = {
  good: 'bg-success/10 text-success border-success/30',
  warn: 'bg-warning/10 text-warning border-warning/30',
  bad: 'bg-destructive/10 text-destructive border-destructive/30',
};
const TONE_ICONS: Record<Tone, typeof CheckCircle2> = {
  good: CheckCircle2,
  warn: AlertTriangle,
  bad: AlertCircle,
};

function Indicator({ label, value, tone }: { label: string; value: string; tone: Tone }) {
  const Icon = TONE_ICONS[tone];
  return (
    <div className={`rounded-lg border px-3 py-2 ${TONE_STYLES[tone]}`}>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide font-medium mb-0.5 opacity-80">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  );
}

export function ClientPortalHealthBlock({ clientId }: { clientId: string }) {
  const [health, setHealth] = useState<Health | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data, error } = await supabase.rpc('get_client_portal_health', { _client_id: clientId });
      if (alive) {
        if (!error && data) setHealth(data as unknown as Health);
        setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [clientId]);

  if (loading) {
    return (
      <Card className="hq-card p-5">
        <p className="text-xs text-muted-foreground">A carregar saúde do portal…</p>
      </Card>
    );
  }
  if (!health) return null;

  const lastLoginTone: Tone = (() => {
    if (!health.last_login_at) return 'bad';
    const days = differenceInDays(new Date(), parseISO(health.last_login_at));
    if (days < 7) return 'good';
    if (days <= 30) return 'warn';
    return 'bad';
  })();
  const lastLoginLabel = health.last_login_at
    ? format(parseISO(health.last_login_at), "d MMM yyyy", { locale: pt })
    : 'Nunca';

  const reqTone: Tone = health.pending_requests === 0 ? 'good' : health.pending_requests <= 2 ? 'warn' : 'bad';
  const fbTone: Tone = health.pending_feedback === 0 ? 'good' : health.pending_feedback === 1 ? 'warn' : 'bad';
  const recTone: Tone = health.overdue_recolhas === 0 ? 'good' : health.overdue_recolhas === 1 ? 'warn' : 'bad';

  return (
    <Card className="hq-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Activity className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-medium">Saúde do portal</h3>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        <Indicator label="Portal" value={health.portal_active ? 'Ativo' : 'Inativo'} tone={health.portal_active ? 'good' : 'bad'} />
        <Indicator label="Account manager" value={health.has_account_manager ? 'Atribuído' : 'Sem AM'} tone={health.has_account_manager ? 'good' : 'bad'} />
        <Indicator label="Último acesso" value={lastLoginLabel} tone={lastLoginTone} />
        <Indicator label="Pedidos pendentes" value={String(health.pending_requests)} tone={reqTone} />
        <Indicator label="Feedback por responder" value={String(health.pending_feedback)} tone={fbTone} />
        <Indicator label="Recolhas em atraso" value={String(health.overdue_recolhas)} tone={recTone} />
      </div>
    </Card>
  );
}