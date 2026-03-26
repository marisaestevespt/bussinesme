import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ExternalLink, Plus, CreditCard } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';
import { EntryDetailSheet } from '@/components/financial/EntryDetailSheet';
import { toast } from 'sonner';

interface Props {
  projectId: string;
  projectName: string;
  clientName: string | null;
  clientId: string | undefined;
  onNewMeeting: () => void;
}

const PAYMENT_METHODS = [
  { value: 'pagamento_total', label: 'Pagamento Total' },
  { value: 'entrada_prestacoes', label: 'Pagamento Entrada + Prestações' },
  { value: 'prestacoes', label: 'Pagamento Prestações' },
  { value: 'avenca_mensal', label: 'Pagamento Avença Mensal' },
];

export function ProjectGestaoTab({ projectId, projectName, clientName, clientId, onNewMeeting }: Props) {
  const navigate = useNavigate();
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const [paymentSheetOpen, setPaymentSheetOpen] = useState(false);

  // ─── Payments (commercial_sales by client name) ────────────────
  const { data: clientSales = [] } = useQuery({
    queryKey: ['commercial-sales', 'client', clientName],
    queryFn: async () => {
      if (!clientName) return [];
      const { data } = await supabase
        .from('commercial_sales')
        .select('*')
        .eq('client', clientName)
        .order('payment_date', { ascending: false });
      return data || [];
    },
    enabled: !!clientName,
  });

  // ─── Meetings ─────────────────────────────────────────────────
  const { data: meetings = [] } = useQuery({
    queryKey: ['project-meetings', projectId],
    queryFn: async () => {
      const { data } = await supabase
        .from('meetings')
        .select('id, title, date_time, status, meeting_url, meeting_participants(profile_id, profiles:profiles(full_name))')
        .eq('project_id', projectId)
        .order('date_time', { ascending: false });
      return data || [];
    },
  });

  // Also get client meetings (by client_id or client_name)
  const { data: clientMeetings = [] } = useQuery({
    queryKey: ['client-meetings-project', clientId, clientName],
    queryFn: async () => {
      if (!clientId && !clientName) return [];
      let query = supabase
        .from('meetings')
        .select('id, title, date_time, status, meeting_url, meeting_participants(profile_id, profiles:profiles(full_name))')
        .is('project_id', null)
        .order('date_time', { ascending: false });
      
      if (clientId) {
        query = query.eq('client_id', clientId);
      } else if (clientName) {
        query = query.eq('client_name', clientName);
      }
      
      const { data } = await query;
      return data || [];
    },
    enabled: !!clientId || !!clientName,
  });

  const allMeetings = [...meetings, ...clientMeetings].sort((a, b) => 
    new Date(b.date_time).getTime() - new Date(a.date_time).getTime()
  );

  const MEETING_STATUSES: Record<string, { label: string; color: string }> = {
    por_confirmar: { label: 'Por confirmar', color: '#f59e0b' },
    marcada: { label: 'Marcada', color: '#3b82f6' },
    confirmada: { label: 'Confirmada', color: '#10b981' },
    terminada: { label: 'Terminada', color: '#6b7280' },
    cancelada: { label: 'Cancelada', color: '#ef4444' },
  };

  // ─── Client payment method ─────────────────────────────────────
  const { data: clientData } = useQuery({
    queryKey: ['client-payment-method', clientId, clientName],
    queryFn: async () => {
      if (clientId) {
        const { data } = await supabase.from('clients').select('id, payment_method').eq('id', clientId).maybeSingle();
        return data;
      }
      if (clientName) {
        const { data } = await supabase.from('clients').select('id, payment_method').eq('full_name', clientName).maybeSingle();
        return data;
      }
      return null;
    },
    enabled: !!clientId || !!clientName,
  });

  const resolvedClientId = clientData?.id || clientId;

  const qc = useQueryClient();
  const updatePaymentMethod = useMutation({
    mutationFn: async (method: string) => {
      if (!resolvedClientId) throw new Error('Cliente não associado ao projeto');
      await supabase.from('clients').update({ payment_method: method }).eq('id', resolvedClientId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client-payment-method', clientId, clientName] });
      toast.success('Forma de pagamento atualizada');
    },
    onError: () => {
      toast.error('Não foi possível atualizar a forma de pagamento');
    },
  });

  return (
    <div className="space-y-6">
      {/* Forma de Pagamento */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><CreditCard className="h-4 w-4" /> Forma de Pagamento</CardTitle>
        </CardHeader>
        <CardContent>
          <Select
            value={clientData?.payment_method || undefined}
            onValueChange={v => updatePaymentMethod.mutate(v)}
            disabled={!resolvedClientId || updatePaymentMethod.isPending}
          >
            <SelectTrigger className="w-64">
              <SelectValue placeholder={resolvedClientId ? 'Selecionar método...' : 'Associe um cliente ao projeto'} />
            </SelectTrigger>
            <SelectContent>
              {PAYMENT_METHODS.map(m => (
                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Pagamentos */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Pagamentos</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="bg-primary text-primary-foreground px-4 py-2 font-medium text-xs grid grid-cols-6 gap-2">
            <span>Status</span>
            <span>Data</span>
            <span>Descrição</span>
            <span>Valor Base</span>
            <span>Fatura</span>
            <span>Produto</span>
          </div>
          {clientSales.length === 0 ? (
            <p className="text-center text-muted-foreground py-6 text-sm">Sem pagamentos associados</p>
          ) : (
            clientSales.map((s: any) => (
              <div
                key={s.id}
                className="px-4 py-2 text-xs grid grid-cols-6 gap-2 border-b items-center cursor-pointer hover:bg-muted/50"
                onClick={() => { setSelectedPayment(s); setPaymentSheetOpen(true); }}
              >
                <span>{s.status}</span>
                <span>{s.payment_date || '—'}</span>
                <span className="truncate">{s.description || '—'}</span>
                <span>{Number(s.base_value).toFixed(2)}€</span>
                <span>{Number(s.invoice_total).toFixed(2)}€</span>
                <span className="truncate">{s.product || '—'}</span>
              </div>
            ))
          )}
          {clientSales.length > 0 && (
            <div className="px-4 py-3 text-xs font-medium border-t flex justify-between">
              <span>Total: {clientSales.length} pagamento(s)</span>
              <span>Valor total: {clientSales.reduce((s: number, p: any) => s + Number(p.invoice_total || 0), 0).toFixed(2)}€</span>
            </div>
          )}
        </CardContent>
      </Card>

      <EntryDetailSheet sale={selectedPayment} open={paymentSheetOpen} onOpenChange={setPaymentSheetOpen} />

      {/* Reuniões */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Reuniões</CardTitle>
          <Button size="sm" variant="outline" onClick={onNewMeeting}>
            <Plus className="h-3 w-3 mr-1" />Nova Reunião
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="bg-primary text-primary-foreground px-4 py-2 font-medium text-xs grid grid-cols-4 gap-2">
            <span>Status</span>
            <span>Data & Hora</span>
            <span>Reunião</span>
            <span>Participantes</span>
          </div>
          {allMeetings.length === 0 ? (
            <p className="text-center text-muted-foreground py-6 text-sm">Sem reuniões associadas</p>
          ) : (
            allMeetings.map((m: any) => {
              const ms = MEETING_STATUSES[m.status] || { label: m.status, color: '#6b7280' };
              return (
                <div
                  key={m.id}
                  className="px-4 py-2 text-xs grid grid-cols-4 gap-2 border-b items-center cursor-pointer hover:bg-muted/50"
                  onClick={() => navigate(`/hub/reunioes/${m.id}`)}
                >
                  <span>
                    <span
                      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap"
                      style={{ backgroundColor: `${ms.color}20`, color: ms.color }}
                    >
                      {ms.label}
                    </span>
                  </span>
                  <span>{m.date_time ? format(parseISO(m.date_time), "dd MMM yyyy 'às' HH:mm", { locale: pt }) : '—'}</span>
                  <span className="font-medium truncate">{m.title}</span>
                  <span className="truncate text-muted-foreground">
                    {m.meeting_participants?.map((p: any) => p.profiles?.full_name).filter(Boolean).join(', ') || '—'}
                  </span>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
