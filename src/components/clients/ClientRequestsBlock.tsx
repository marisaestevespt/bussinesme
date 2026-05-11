import { useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';
import { Inbox, CheckCircle2, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { EntitySection } from '@/components/entity/EntityLayout';
import { toast } from 'sonner';

interface Request {
  id: string;
  title: string;
  message: string | null;
  status: string;
  source: string;
  created_at: string;
  resolved_at: string | null;
}

const STATUS_OPTIONS = [
  { value: 'novo', label: 'Novo' },
  { value: 'em_curso', label: 'Em curso' },
  { value: 'resolvido', label: 'Resolvido' },
];

const statusBadge = (s: string) => {
  if (s === 'resolvido') return { label: 'Resolvido', cls: 'border-emerald-500/30 text-emerald-700 dark:text-emerald-400' };
  if (s === 'em_curso') return { label: 'Em curso', cls: 'border-amber-500/30 text-amber-700 dark:text-amber-400' };
  return { label: 'Novo', cls: 'border-sky-500/30 text-sky-700 dark:text-sky-400' };
};

export function ClientRequestsBlock({ clientId }: { clientId: string }) {
  const [items, setItems] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('client_requests' as any)
        .select('id, title, message, status, source, created_at, resolved_at')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });
      if (!cancelled) {
        setItems((data as any[]) || []);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [clientId]);

  const updateStatus = async (id: string, status: string) => {
    const patch: Record<string, unknown> = { status };
    if (status === 'resolvido') patch.resolved_at = new Date().toISOString();
    else patch.resolved_at = null;
    const { error } = await supabase.from('client_requests' as any).update(patch as any).eq('id', id);
    if (error) { toast.error('Erro: ' + error.message); return; }
    setItems((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } as Request : r)));
  };

  return (
    <EntitySection title="Pedidos do Cliente" icon={Inbox}>
      {loading ? (
        <p className="text-xs text-muted-foreground">A carregar…</p>
      ) : items.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">Sem pedidos enviados pelo portal.</p>
      ) : (
        <div className="space-y-2">
          {items.map((r) => {
            const meta = statusBadge(r.status);
            return (
              <div key={r.id} className="rounded-lg border bg-card p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold truncate">{r.title}</p>
                      <Badge variant="outline" className={`text-[10px] ${meta.cls}`}>{meta.label}</Badge>
                      {r.source === 'portal' && (
                        <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">do portal</Badge>
                      )}
                    </div>
                    {r.message && <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{r.message}</p>}
                    <p className="text-[10px] text-muted-foreground/70 mt-1">
                      {format(parseISO(r.created_at), "d MMM yyyy · HH:mm", { locale: pt })}
                    </p>
                  </div>
                  <Select value={r.status} onValueChange={(v) => updateStatus(r.id, v)}>
                    <SelectTrigger className="h-7 w-32 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </EntitySection>
  );
}