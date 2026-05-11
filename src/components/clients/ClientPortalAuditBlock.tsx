import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Activity, MessageSquare, Inbox, LogIn, Download, ClipboardList } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';

interface AuditEntry {
  id: string;
  action: string;
  metadata: Record<string, any>;
  created_at: string;
}

const ACTION_META: Record<string, { label: string; icon: typeof Activity }> = {
  'portal.session.created': { label: 'Iniciou sessão no portal', icon: LogIn },
  'portal.request.created': { label: 'Enviou um pedido', icon: Inbox },
  'portal.meeting_prep.created': { label: 'Adicionou tópico a reunião', icon: ClipboardList },
  'portal.feedback.submitted': { label: 'Submeteu feedback', icon: MessageSquare },
  'portal.document.downloaded': { label: 'Descarregou documento', icon: Download },
};

export function ClientPortalAuditBlock({ clientId }: { clientId: string }) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data, error } = await supabase.rpc('get_client_portal_audit', { _client_id: clientId });
      if (alive) {
        if (!error) setEntries((data as AuditEntry[]) || []);
        setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [clientId]);

  return (
    <Card className="hq-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Activity className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-medium">Auditoria do portal</h3>
        <span className="text-xs text-muted-foreground ml-auto">Últimos 50 eventos</span>
      </div>
      {loading ? (
        <p className="text-xs text-muted-foreground">A carregar…</p>
      ) : entries.length === 0 ? (
        <p className="text-xs text-muted-foreground">Sem atividade registada.</p>
      ) : (
        <ul className="space-y-2 max-h-96 overflow-y-auto">
          {entries.map((e) => {
            const meta = ACTION_META[e.action] || { label: e.action, icon: Activity };
            const Icon = meta.icon;
            const detail = e.metadata?.file_name || e.metadata?.title || e.metadata?.author_label || e.metadata?.category;
            return (
              <li key={e.id} className="flex items-start gap-3 text-xs py-2 border-b border-border/40 last:border-0">
                <Icon className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{meta.label}</p>
                  {detail && <p className="text-muted-foreground truncate">{detail}</p>}
                </div>
                <span className="text-muted-foreground whitespace-nowrap">
                  {format(parseISO(e.created_at), "d MMM HH:mm", { locale: pt })}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}