import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ExternalLink, Plus, CreditCard, Loader2, Gift } from 'lucide-react';
import { format, parseISO, addMonths, setDate } from 'date-fns';
import { pt } from 'date-fns/locale';
import { SaleDetailDialog } from '@/components/commercial/SaleDetailDialog';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

interface Props {
  projectId: string;
  projectName: string;
  clientName: string | null;
  clientId: string | undefined;
  productName?: string | null;
  startDate?: string | null;
  onNewMeeting: () => void;
}

const PAYMENT_METHODS = [
  { value: 'pagamento_total', label: 'Pagamento Total' },
  { value: 'entrada_prestacoes', label: 'Entrada + Prestações' },
  { value: 'prestacoes', label: 'Prestações' },
  { value: 'avenca_mensal', label: 'Avença Mensal' },
  { value: 'subscricao', label: 'Subscrição' },
];

const SUBSCRIPTION_PERIODICITIES = [
  { value: 'mensal', label: 'Mensal' },
  { value: 'bimestral', label: 'Bimestral' },
  { value: 'trimestral', label: 'Trimestral' },
  { value: 'semestral', label: 'Semestral' },
  { value: 'anual', label: 'Anual' },
];

const SALE_STATUSES: Record<string, { label: string; color: string }> = {
  aguarda_pagamento: { label: 'Aguarda Pagamento', color: 'bg-warning/10 text-warning' },
  pago: { label: 'Pago', color: 'bg-success/10 text-success' },
  em_atraso: { label: 'Em Atraso', color: 'bg-destructive/10 text-destructive' },
  cancelado: { label: 'Cancelado', color: 'bg-muted text-muted-foreground' },
};

export function ProjectGestaoTab({ projectId, projectName, clientName, clientId, productName, startDate, onNewMeeting }: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);

  // ─── Payment config form state ─────────────────────────────────
  const [payMethod, setPayMethod] = useState<string>('');
  const [totalValue, setTotalValue] = useState('');
  const [entradaValue, setEntradaValue] = useState('');
  const [numPrestacoes, setNumPrestacoes] = useState('');
  const [payDay, setPayDay] = useState('');
  const [numMeses, setNumMeses] = useState('');
  const [avencaValue, setAvencaValue] = useState('');
  const [subscricaoValue, setSubscricaoValue] = useState('');
  const [subscricaoPeriodicity, setSubscricaoPeriodicity] = useState('mensal');

  // ─── Client data (payment_method + start_date) ─────────────────
  const { data: clientData } = useQuery({
    queryKey: ['client-gestao', clientId, clientName],
    queryFn: async () => {
      if (clientId) {
        const { data } = await supabase.from('clients').select('id, payment_method, start_date, current_product').eq('id', clientId).maybeSingle();
        return data;
      }
      if (clientName) {
        const { data } = await supabase.from('clients').select('id, payment_method, start_date, current_product').eq('full_name', clientName).maybeSingle();
        return data;
      }
      return null;
    },
    enabled: !!clientId || !!clientName,
  });

  const resolvedClientId = clientData?.id || clientId;
  const billingStartDate = startDate || clientData?.start_date;
  const lastAutoGenerateKeyRef = useRef<string | null>(null);

  // Sync payMethod from DB
  useEffect(() => {
    if (clientData?.payment_method && !payMethod) {
      setPayMethod(clientData.payment_method);
    }
  }, [clientData?.payment_method]);

  // ─── Project sales ────────────────────────────────────────────
  const qc = useQueryClient();
  const salesKey = ['project-sales', projectId];
  const { data: projectSales = [] } = useQuery({
    queryKey: salesKey,
    queryFn: async () => {
      const { data } = await supabase
        .from('commercial_sales')
        .select('*')
        .eq('project_id', projectId)
        .order('payment_date', { ascending: true });
      return data || [];
    },
  });

  // Also get client sales NOT linked to any project (legacy)
  const { data: unlinkedClientSales = [] } = useQuery({
    queryKey: ['unlinked-client-sales', clientName, projectId],
    queryFn: async () => {
      if (!clientName) return [];
      const { data } = await supabase
        .from('commercial_sales')
        .select('*')
        .eq('client', clientName)
        .is('project_id', null)
        .order('payment_date', { ascending: true });
      return data || [];
    },
    enabled: !!clientName,
  });

  const allSales = useMemo(() => {
    return [...projectSales, ...unlinkedClientSales].sort((a, b) => {
      const da = a.payment_date || '';
      const db = b.payment_date || '';
      return da.localeCompare(db);
    });
  }, [projectSales, unlinkedClientSales]);

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

  const { data: clientMeetings = [] } = useQuery({
    queryKey: ['client-meetings-project', clientId, clientName],
    queryFn: async () => {
      if (!clientId && !clientName) return [];
      let query = supabase
        .from('meetings')
        .select('id, title, date_time, status, meeting_url, meeting_participants(profile_id, profiles:profiles(full_name))')
        .is('project_id', null)
        .order('date_time', { ascending: false });
      if (clientId) query = query.eq('client_id', clientId);
      else if (clientName) query = query.eq('client_name', clientName);
      const { data } = await query;
      return data || [];
    },
    enabled: !!clientId || !!clientName,
  });

  const allMeetings = [...meetings, ...clientMeetings].sort((a, b) =>
    new Date(b.date_time).getTime() - new Date(a.date_time).getTime()
  );

  const MEETING_STATUSES: Record<string, { label: string; color: string }> = {
    por_confirmar: { label: 'Por confirmar', color: 'hsl(var(--warning))' },
    marcada: { label: 'Marcada', color: 'hsl(var(--primary))' },
    confirmada: { label: 'Confirmada', color: 'hsl(var(--success))' },
    terminada: { label: 'Terminada', color: 'hsl(var(--muted-foreground))' },
    cancelada: { label: 'Cancelada', color: 'hsl(var(--destructive))' },
  };

  // ─── Update payment method on client ──────────────────────────
  const updatePaymentMethod = useMutation({
    mutationFn: async (method: string) => {
      if (!resolvedClientId) throw new Error('no client');
      await supabase.from('clients').update({ payment_method: method }).eq('id', resolvedClientId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client-gestao', clientId, clientName] });
    },
  });

  // ─── Generate sales entries ───────────────────────────────────
  const generateSales = useMutation({
    mutationFn: async () => {
      if (!billingStartDate) throw new Error('Projeto sem data de início definida');
      const start = parseISO(billingStartDate);
      const currentMonthStart = new Date();
      currentMonthStart.setDate(1);
      currentMonthStart.setHours(0, 0, 0, 0);
      const entries: any[] = [];
      const product = productName || clientData?.current_product || '';
      const client = clientName || '';
      const year = new Date().getFullYear();
      let saleCounter = 0;
      const genSaleId = () => { saleCounter++; return `V${year}-${Date.now()}-${saleCounter}`; };

      if (payMethod === 'pagamento_total') {
        const val = parseFloat(totalValue);
        if (!val || val <= 0) throw new Error('Valor inválido');
        entries.push({
          sale_id: genSaleId(),
          status: 'aguarda_pagamento',
          payment_date: format(start, 'yyyy-MM-dd'),
          description: `Pagamento Total — ${product}`,
          base_value: val,
          invoice_total: val,
          product,
          client,
          source: 'projeto',
          project_id: projectId,
          sale_month: start.getMonth() + 1,
          sale_year: start.getFullYear(),
          sale_quarter: Math.ceil((start.getMonth() + 1) / 3),
          created_by: user?.id || null,
        });
      } else if (payMethod === 'entrada_prestacoes') {
        const total = parseFloat(totalValue);
        const entrada = parseFloat(entradaValue);
        const nPrest = parseInt(numPrestacoes);
        const day = parseInt(payDay);
        if (!total || !entrada || !nPrest || !day) throw new Error('Preencha todos os campos');
        if (entrada >= total) throw new Error('Valor de entrada deve ser inferior ao total');

        // Entrada
        entries.push({
          sale_id: genSaleId(),
          status: 'aguarda_pagamento',
          payment_date: format(start, 'yyyy-MM-dd'),
          description: `Entrada — ${product}`,
          base_value: entrada,
          invoice_total: entrada,
          product,
          client,
          source: 'projeto',
          project_id: projectId,
          sale_month: start.getMonth() + 1,
          sale_year: start.getFullYear(),
          sale_quarter: Math.ceil((start.getMonth() + 1) / 3),
          created_by: user?.id || null,
        });

        // Prestações
        const restante = total - entrada;
        const valorPrestacao = Math.round((restante / nPrest) * 100) / 100;
        for (let i = 0; i < nPrest; i++) {
          const prestDate = setDate(addMonths(start, i + 1), day);
          entries.push({
            sale_id: genSaleId(),
            status: 'aguarda_pagamento',
            payment_date: format(prestDate, 'yyyy-MM-dd'),
            description: `Prestação ${i + 1}/${nPrest} — ${product}`,
            base_value: i === nPrest - 1 ? Math.round((restante - valorPrestacao * (nPrest - 1)) * 100) / 100 : valorPrestacao,
            invoice_total: i === nPrest - 1 ? Math.round((restante - valorPrestacao * (nPrest - 1)) * 100) / 100 : valorPrestacao,
            product,
            client,
            source: 'projeto',
            project_id: projectId,
            sale_month: prestDate.getMonth() + 1,
            sale_year: prestDate.getFullYear(),
            sale_quarter: Math.ceil((prestDate.getMonth() + 1) / 3),
            created_by: user?.id || null,
          });
        }
      } else if (payMethod === 'prestacoes') {
        const total = parseFloat(totalValue);
        const nPrest = parseInt(numPrestacoes);
        const day = parseInt(payDay);
        if (!total || !nPrest || !day) throw new Error('Preencha todos os campos');

        const valorPrestacao = Math.round((total / nPrest) * 100) / 100;
        for (let i = 0; i < nPrest; i++) {
          const prestDate = i === 0 ? start : setDate(addMonths(start, i), day);
          entries.push({
            sale_id: genSaleId(),
            status: 'aguarda_pagamento',
            payment_date: format(prestDate, 'yyyy-MM-dd'),
            description: `Prestação ${i + 1}/${nPrest} — ${product}`,
            base_value: i === nPrest - 1 ? Math.round((total - valorPrestacao * (nPrest - 1)) * 100) / 100 : valorPrestacao,
            invoice_total: i === nPrest - 1 ? Math.round((total - valorPrestacao * (nPrest - 1)) * 100) / 100 : valorPrestacao,
            product,
            client,
            source: 'projeto',
            project_id: projectId,
            sale_month: prestDate.getMonth() + 1,
            sale_year: prestDate.getFullYear(),
            sale_quarter: Math.ceil((prestDate.getMonth() + 1) / 3),
            created_by: user?.id || null,
          });
        }
      } else if (payMethod === 'avenca_mensal') {
        const meses = parseInt(numMeses);
        const day = parseInt(payDay);
        const valor = parseFloat(avencaValue);
        if (!meses || !day || !valor) throw new Error('Preencha todos os campos');

        for (let i = 0; i < meses; i++) {
          const avDate = i === 0 ? start : setDate(addMonths(start, i), day);
          entries.push({
            sale_id: genSaleId(),
            status: 'aguarda_pagamento',
            payment_date: format(avDate, 'yyyy-MM-dd'),
            description: `Avença Mensal ${i + 1}/${meses} — ${product}`,
            base_value: valor,
            invoice_total: valor,
            product,
            client,
            source: 'projeto',
            project_id: projectId,
            sale_month: avDate.getMonth() + 1,
            sale_year: avDate.getFullYear(),
            sale_quarter: Math.ceil((avDate.getMonth() + 1) / 3),
            created_by: user?.id || null,
          });
        }
      }

      if (entries.length === 0) throw new Error('Nenhuma entrada gerada');

      const { error } = await supabase.from('commercial_sales').insert(entries);
      if (error) throw error;

      // Update client payment_method
      if (resolvedClientId) {
        await supabase.from('clients').update({ payment_method: payMethod }).eq('id', resolvedClientId);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: salesKey });
      qc.invalidateQueries({ queryKey: ['client-gestao'] });
      toast.success('Pagamentos gerados com sucesso!');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Erro ao gerar pagamentos');
    },
  });

  const hasExistingProjectSales = projectSales.length > 0;

  // ─── Auto-generate payments when all fields are filled ────────
  const canAutoGenerate = !hasExistingProjectSales && !!clientStartDate && !!payMethod && !generateSales.isPending;

  useEffect(() => {
    if (!canAutoGenerate) return;
    let ready = false;
    if (payMethod === 'pagamento_total' && parseFloat(totalValue) > 0) ready = true;
    if (payMethod === 'entrada_prestacoes' && parseFloat(totalValue) > 0 && parseFloat(entradaValue) > 0 && parseInt(numPrestacoes) > 0 && parseInt(payDay) > 0 && parseFloat(entradaValue) < parseFloat(totalValue)) ready = true;
    if (payMethod === 'prestacoes' && parseFloat(totalValue) > 0 && parseInt(numPrestacoes) > 0 && parseInt(payDay) > 0) ready = true;
    if (payMethod === 'avenca_mensal' && parseInt(numMeses) > 0 && parseInt(payDay) > 0 && parseFloat(avencaValue) > 0) ready = true;
    if (ready) {
      // Small delay so user can finish typing
      const timer = setTimeout(() => generateSales.mutate(), 1200);
      return () => clearTimeout(timer);
    }
  }, [payMethod, totalValue, entradaValue, numPrestacoes, payDay, numMeses, avencaValue, canAutoGenerate]);

  return (
    <div className="space-y-6">
      {/* Forma de Pagamento + Gerador */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><CreditCard className="h-4 w-4" /> Forma de Pagamento</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select
            value={payMethod}
            onValueChange={v => {
              setPayMethod(v);
              updatePaymentMethod.mutate(v);
            }}
            disabled={!resolvedClientId}
          >
            <SelectTrigger className="w-72">
              <SelectValue placeholder={resolvedClientId ? 'Selecionar forma...' : 'Associe um cliente ao projeto'} />
            </SelectTrigger>
            <SelectContent>
              {PAYMENT_METHODS.map(m => (
                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Dynamic fields per method */}
          {payMethod === 'pagamento_total' && (
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Valor Total s/ IVA (€)</Label><Input type="number" value={totalValue} onChange={e => setTotalValue(e.target.value)} placeholder="0.00" /></div>
              <div className="flex items-end">
                <Button onClick={() => generateSales.mutate()} disabled={generateSales.isPending || !totalValue || hasExistingProjectSales} className="gap-1.5">
                  {generateSales.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Gerar Pagamento
                </Button>
              </div>
            </div>
          )}

          {payMethod === 'entrada_prestacoes' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Valor Total s/ IVA (€)</Label><Input type="number" value={totalValue} onChange={e => setTotalValue(e.target.value)} placeholder="0.00" /></div>
                <div><Label className="text-xs">Valor da Entrada (€)</Label><Input type="number" value={entradaValue} onChange={e => setEntradaValue(e.target.value)} placeholder="0.00" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Nº de Prestações</Label><Input type="number" value={numPrestacoes} onChange={e => setNumPrestacoes(e.target.value)} placeholder="3" /></div>
                <div><Label className="text-xs">Dia de Pagamento</Label><Input type="number" value={payDay} onChange={e => setPayDay(e.target.value)} placeholder="1" min="1" max="28" /></div>
              </div>
              {totalValue && entradaValue && numPrestacoes && (
                <p className="text-xs text-muted-foreground">
                  Entrada: {parseFloat(entradaValue).toFixed(2)}€ + {numPrestacoes}x de {((parseFloat(totalValue) - parseFloat(entradaValue)) / parseInt(numPrestacoes)).toFixed(2)}€
                </p>
              )}
              <Button onClick={() => generateSales.mutate()} disabled={generateSales.isPending || !totalValue || !entradaValue || !numPrestacoes || !payDay || hasExistingProjectSales} className="gap-1.5">
                {generateSales.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Gerar Pagamentos
              </Button>
            </div>
          )}

          {payMethod === 'prestacoes' && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div><Label className="text-xs">Valor Total s/ IVA (€)</Label><Input type="number" value={totalValue} onChange={e => setTotalValue(e.target.value)} placeholder="0.00" /></div>
                <div><Label className="text-xs">Nº de Prestações</Label><Input type="number" value={numPrestacoes} onChange={e => setNumPrestacoes(e.target.value)} placeholder="3" /></div>
                <div><Label className="text-xs">Dia de Pagamento</Label><Input type="number" value={payDay} onChange={e => setPayDay(e.target.value)} placeholder="1" min="1" max="28" /></div>
              </div>
              {totalValue && numPrestacoes && (
                <p className="text-xs text-muted-foreground">
                  {numPrestacoes}x de {(parseFloat(totalValue) / parseInt(numPrestacoes)).toFixed(2)}€
                </p>
              )}
              <Button onClick={() => generateSales.mutate()} disabled={generateSales.isPending || !totalValue || !numPrestacoes || !payDay || hasExistingProjectSales} className="gap-1.5">
                {generateSales.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Gerar Pagamentos
              </Button>
            </div>
          )}

          {payMethod === 'avenca_mensal' && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div><Label className="text-xs">Nº de Meses</Label><Input type="number" value={numMeses} onChange={e => setNumMeses(e.target.value)} placeholder="12" /></div>
                <div><Label className="text-xs">Dia de Pagamento</Label><Input type="number" value={payDay} onChange={e => setPayDay(e.target.value)} placeholder="1" min="1" max="28" /></div>
                <div><Label className="text-xs">Valor Mensal s/ IVA (€)</Label><Input type="number" value={avencaValue} onChange={e => setAvencaValue(e.target.value)} placeholder="0.00" /></div>
              </div>
              {numMeses && avencaValue && (
                <p className="text-xs text-muted-foreground">
                  {numMeses}x de {parseFloat(avencaValue).toFixed(2)}€ = Total: {(parseInt(numMeses) * parseFloat(avencaValue)).toFixed(2)}€
                </p>
              )}
              <Button onClick={() => generateSales.mutate()} disabled={generateSales.isPending || !numMeses || !payDay || !avencaValue || hasExistingProjectSales} className="gap-1.5">
                {generateSales.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Gerar Pagamentos
              </Button>
            </div>
          )}

          {payMethod === 'subscricao' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Valor da Subscrição s/ IVA (€)</Label><Input type="number" value={subscricaoValue} onChange={e => setSubscricaoValue(e.target.value)} placeholder="0.00" /></div>
                <div><Label className="text-xs">Periodicidade</Label>
                  <Select value={subscricaoPeriodicity} onValueChange={setSubscricaoPeriodicity}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SUBSCRIPTION_PERIODICITIES.map(p => (
                        <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {subscricaoValue && parseFloat(subscricaoValue) > 0 && (
                <p className="text-xs text-muted-foreground">
                  {SUBSCRIPTION_PERIODICITIES.find(p => p.value === subscricaoPeriodicity)?.label}: {parseFloat(subscricaoValue).toFixed(2)}€
                </p>
              )}
            </div>
          )}

          {hasExistingProjectSales && (
            <p className="text-xs text-muted-foreground">⚠️ Já existem pagamentos gerados para este projeto. Elimine-os primeiro para gerar novos.</p>
          )}

          {!clientStartDate && payMethod && (
            <p className="text-xs text-destructive">⚠️ O cliente não tem data de início definida. Defina-a na ficha do cliente para gerar pagamentos.</p>
          )}
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
          {allSales.length === 0 ? (
            <p className="text-center text-muted-foreground py-6 text-sm">Sem pagamentos associados</p>
          ) : (
            allSales.map((s: any) => {
              const si = SALE_STATUSES[s.status] || { label: s.status, color: '' };
              return (
                <div
                  key={s.id}
                  className="px-4 py-2 text-xs grid grid-cols-6 gap-2 border-b items-center cursor-pointer hover:bg-muted/50"
                  onClick={() => setSelectedSaleId(s.id)}
                >
                  <span><Badge variant="outline" className={`text-[10px] ${si.color}`}>{si.label}</Badge></span>
                  <span>{s.payment_date ? format(parseISO(s.payment_date), 'dd/MM/yyyy') : '—'}</span>
                  <span className="truncate">{s.description || '—'}{s.is_special_offer && <Gift className="inline h-3 w-3 ml-1 text-amber-500" />}</span>
                  <span>{Number(s.base_value).toFixed(2)}€</span>
                  <span>{Number(s.invoice_total).toFixed(2)}€</span>
                  <span className="truncate">{s.product || '—'}</span>
                </div>
              );
            })
          )}
          {allSales.length > 0 && (
            <div className="px-4 py-3 text-xs font-medium border-t flex justify-between">
              <span>Total: {allSales.length} pagamento(s)</span>
              <span>Valor total: {allSales.reduce((s: number, p: any) => s + Number(p.invoice_total || 0), 0).toFixed(2)}€</span>
            </div>
          )}
        </CardContent>
      </Card>

      <SaleDetailDialog saleId={selectedSaleId} open={!!selectedSaleId} onOpenChange={o => { if (!o) setSelectedSaleId(null); }} />

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
              const ms = MEETING_STATUSES[m.status] || { label: m.status, color: 'hsl(var(--muted-foreground))' };
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
