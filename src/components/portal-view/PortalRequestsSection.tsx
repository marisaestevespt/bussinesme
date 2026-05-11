import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';
import { Send, Inbox, CheckCircle2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { SectionCard, SectionTitle } from './SectionPrimitives';
import { EmptyHint } from '@/components/ui/loading-skeletons';

export interface PortalRequest {
  id: string;
  title: string;
  message: string | null;
  status: 'novo' | 'em_curso' | 'resolvido' | string;
  source: 'portal' | 'team' | string;
  resolved_at: string | null;
  created_at: string;
}

interface Props {
  requests: PortalRequest[];
  setRequests: React.Dispatch<React.SetStateAction<PortalRequest[]>>;
  portalToken: string;
  pc: string;
}

const statusMeta = (s: string) => {
  if (s === 'resolvido') return { label: 'Resolvido', icon: CheckCircle2, cls: 'border-emerald-500/30 text-emerald-700 dark:text-emerald-400' };
  if (s === 'em_curso') return { label: 'Em curso', icon: Clock, cls: 'border-amber-500/30 text-amber-700 dark:text-amber-400' };
  return { label: 'Novo', icon: Inbox, cls: 'border-sky-500/30 text-sky-700 dark:text-sky-400' };
};

export function PortalRequestsSection({ requests, setRequests, portalToken, pc }: Props) {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    const t = title.trim();
    if (!t) { toast.error('Adiciona um assunto.'); return; }
    setSubmitting(true);
    const { data, error } = await (
      supabase as unknown as { rpc: (f: string, a: unknown) => Promise<{ data: unknown; error: { message: string } | null }> }
    ).rpc('portal_create_client_request', { _token: portalToken, _title: t, _message: message.trim() || null });
    setSubmitting(false);
    if (error) { toast.error('Erro ao enviar: ' + error.message); return; }
    const newId = (data as string) || crypto.randomUUID();
    setRequests((prev) => [
      { id: newId, title: t, message: message.trim() || null, status: 'novo', source: 'portal', resolved_at: null, created_at: new Date().toISOString() },
      ...prev,
    ]);
    setTitle(''); setMessage('');
    toast.success('Pedido enviado ✓');
  };

  return (
    <div className="space-y-5">
      <SectionTitle icon={Inbox}>Pedidos</SectionTitle>

      <SectionCard className="p-5 space-y-3">
        <p className="text-xs text-muted-foreground">Tens uma dúvida ou precisas de algo? Envia aqui que tratamos.</p>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Assunto" className="text-sm" />
        <Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Detalhes (opcional)" className="text-sm min-h-[80px]" />
        <div className="flex justify-end">
          <Button size="sm" disabled={submitting} onClick={submit} className="text-white" style={{ backgroundColor: pc }}>
            <Send className="h-3.5 w-3.5 mr-1.5" /> Enviar pedido
          </Button>
        </div>
      </SectionCard>

      {requests.length === 0 ? (
        <SectionCard className="p-8 text-center">
          <Inbox className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
          <EmptyHint>Sem pedidos enviados.</EmptyHint>
        </SectionCard>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => {
            const meta = statusMeta(r.status);
            return (
              <SectionCard key={r.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{r.title}</p>
                    {r.message && <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{r.message}</p>}
                    <p className="text-[10px] text-muted-foreground/70 mt-2">
                      {format(parseISO(r.created_at), "d MMM yyyy · HH:mm", { locale: pt })}
                    </p>
                  </div>
                  <Badge variant="outline" className={`text-[10px] shrink-0 ${meta.cls}`}>{meta.label}</Badge>
                </div>
              </SectionCard>
            );
          })}
        </div>
      )}
    </div>
  );
}