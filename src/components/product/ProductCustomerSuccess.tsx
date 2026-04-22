import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useTeamData } from '@/hooks/useTeamData';
import { useNavigate } from 'react-router-dom';
import { format, differenceInDays, isPast, isFuture } from 'date-fns';
import { pt } from 'date-fns/locale';
import { AlertTriangle, CheckCircle2, Clock, User } from 'lucide-react';
import { daysUntilRenewal, DEFAULT_RENEWAL_WINDOW_DAYS } from '@/lib/clientLifecycle';

const NPS_STATUS_OPTIONS = [
  { value: 'por_fazer', label: 'Por fazer' },
  { value: 'feito', label: 'Feito' },
  { value: 'em_atraso', label: 'Em atraso' },
];

const CLIENT_STATUS_LABELS: Record<string, { label: string; className: string }> = {
  ativo: { label: 'Ativo', className: 'bg-success/15 text-success' },
  em_onboarding: { label: 'Em Onboarding', className: 'bg-info/15 text-info' },
  em_pausa: { label: 'Em Pausa', className: 'bg-warning/15 text-warning' },
  churned: { label: 'Churned', className: 'bg-destructive/15 text-destructive' },
  concluido: { label: 'Concluído', className: 'bg-muted text-muted-foreground' },
};

interface Props {
  productId: string;
  productName: string;
  isOwner: boolean;
}

export function ProductCustomerSuccess({ productId, productName, isOwner }: Props) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { members } = useTeamData();
  const teamMembers = members.data || [];

  // ---- NPS Config ----
  const { data: npsConfig } = useQuery({
    queryKey: ['product-nps-config', productId],
    queryFn: async () => {
      const { data } = await supabase
        .from('product_nps_config' as any)
        .select('*')
        .eq('product_id', productId)
        .maybeSingle();
      return data as any;
    },
  });

  const [configForm, setConfigForm] = useState<any>(null);
  const effectiveConfig = configForm ?? npsConfig;

  if (npsConfig && !configForm) {
    setTimeout(() => setConfigForm(npsConfig), 0);
  }

  const saveConfig = useMutation({
    mutationFn: async () => {
      const payload = {
        product_id: productId,
        cadence_days: effectiveConfig?.cadence_days || 30,
        collection_message: effectiveConfig?.collection_message || '',
        responsible_id: effectiveConfig?.responsible_id || null,
        nps_form_url: effectiveConfig?.nps_form_url || null,
      };
      if (effectiveConfig?.id) {
        const { error } = await supabase.from('product_nps_config' as any).update(payload).eq('id', effectiveConfig.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('product_nps_config' as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['product-nps-config', productId] });
      toast.success('Configuração NPS guardada');
    },
    onError: () => toast.error('Erro ao guardar configuração'),
  });

  // ---- NPS Records (read-only) ----
  const { data: npsRecords = [] } = useQuery({
    queryKey: ['product-nps-records', productId],
    queryFn: async () => {
      const { data } = await supabase
        .from('product_nps_records' as any)
        .select('*')
        .eq('product_id', productId)
        .order('collection_date', { ascending: false });
      return (data || []) as any[];
    },
  });

  // ---- Clients of this product ----
  const { data: productClients = [] } = useQuery({
    queryKey: ['product-clients-cs', productName],
    queryFn: async () => {
      if (!productName) return [];
      const { data } = await supabase
        .from('clients')
        .select('id, full_name, status, start_date, end_of_cycle, email')
        .eq('current_product', productName)
        .order('end_of_cycle', { ascending: true, nullsFirst: false });
      return (data || []) as any[];
    },
    enabled: !!productName,
  });

  const avgNps = npsRecords.length > 0
    ? (npsRecords.reduce((s: number, r: any) => s + Number(r.nps_score || 0), 0) / npsRecords.length).toFixed(1)
    : '—';

  const getMemberName = (id: string | null) => {
    if (!id) return '—';
    const m = teamMembers.find((t: any) => t.id === id);
    return m?.full_name || '—';
  };

  const statusBadge = (status: string) => {
    const opt = NPS_STATUS_OPTIONS.find(o => o.value === status);
    const label = opt?.label || status;
    const cls = status === 'feito'
      ? 'bg-success/15 text-success'
      : status === 'em_atraso'
        ? 'bg-destructive/15 text-destructive'
        : 'bg-warning/15 text-warning';
    return <Badge variant="outline" className={cls}>{label}</Badge>;
  };

  const getRenewalInfo = (endOfCycle: string | null) => {
    if (!endOfCycle) return { label: 'Sem data definida', icon: <Clock className="h-3.5 w-3.5 text-muted-foreground" />, className: 'text-muted-foreground' };
    const days = daysUntilRenewal({ end_of_cycle: endOfCycle }) ?? 0;
    if (days < 0) {
      return { label: `Expirou há ${Math.abs(days)} dias`, icon: <AlertTriangle className="h-3.5 w-3.5 text-destructive" />, className: 'text-destructive font-medium' };
    }
    if (days <= DEFAULT_RENEWAL_WINDOW_DAYS) {
      return { label: `Faltam ${days} dias`, icon: <AlertTriangle className="h-3.5 w-3.5 text-warning" />, className: 'text-warning font-medium' };
    }
    return { label: `Faltam ${days} dias`, icon: <CheckCircle2 className="h-3.5 w-3.5 text-success" />, className: 'text-success' };
  };

  const activeClients = productClients.filter((c: any) => c.status === 'ativo' || c.status === 'em_onboarding');

  return (
    <div className="space-y-6">
      {/* NPS History */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Histórico de NPS deste Produto</CardTitle>
            <div className="text-sm font-medium">
              Média NPS: <span className="text-lg font-bold text-primary">{avgNps}</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {npsRecords.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Sem registos de NPS. Os registos são criados nas fichas de cliente.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Data de recolha</TableHead>
                  <TableHead>NPS (0-10)</TableHead>
                  <TableHead>Notas</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {npsRecords.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.client_name}</TableCell>
                    <TableCell>{r.collection_date ? format(new Date(r.collection_date), 'dd/MM/yyyy') : '—'}</TableCell>
                    <TableCell>
                      <span className={`font-bold ${Number(r.nps_score) >= 9 ? 'text-success' : Number(r.nps_score) >= 7 ? 'text-warning' : 'text-destructive'}`}>
                        {r.nps_score}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{r.notes || '—'}</TableCell>
                    <TableCell>{statusBadge(r.status)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Client Renewal Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4" />
              Clientes — Visão de Renovação
            </CardTitle>
            <div className="text-sm text-muted-foreground">
              {activeClients.length} cliente{activeClients.length !== 1 ? 's' : ''} ativo{activeClients.length !== 1 ? 's' : ''}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {productClients.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Nenhum cliente associado a este produto.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Data de Início</TableHead>
                  <TableHead>Data de Renovação</TableHead>
                  <TableHead>Tempo até Renovação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {productClients.map((c: any) => {
                  const renewal = getRenewalInfo(c.end_of_cycle);
                  const st = CLIENT_STATUS_LABELS[c.status] || { label: c.status, className: 'bg-muted text-muted-foreground' };
                  return (
                    <TableRow
                      key={c.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/hub/clientes/${c.id}`)}
                    >
                      <TableCell className="font-medium">{c.full_name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={st.className}>{st.label}</Badge>
                      </TableCell>
                      <TableCell>
                        {c.start_date ? format(new Date(c.start_date), 'dd/MM/yyyy') : '—'}
                      </TableCell>
                      <TableCell>
                        {c.end_of_cycle ? format(new Date(c.end_of_cycle), 'dd/MM/yyyy') : '—'}
                      </TableCell>
                      <TableCell>
                        <div className={`flex items-center gap-1.5 ${renewal.className}`}>
                          {renewal.icon}
                          <span className="text-sm">{renewal.label}</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
