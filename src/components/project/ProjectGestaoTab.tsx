import { useState, useEffect, useMemo, useRef, useCallback, useLayoutEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ExternalLink, Plus, CreditCard, Loader2, Gift, Calendar, Video, Pencil, Check, Save } from 'lucide-react';
import { format, parseISO, addMonths, setDate } from 'date-fns';
import { pt } from 'date-fns/locale';
import { SaleDetailDialog } from '@/components/commercial/SaleDetailDialog';
import { SaleFormDialog } from '@/components/commercial/SaleFormDialog';
import { useCommercialData } from '@/hooks/useCommercialData';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { sumRevenue } from '@/lib/salesCalculations';
import { MEETING_STATUSES as CANON_MEETING_STATUSES_FOR_GESTAO } from '@/lib/meetingStatus';
import { buildPaymentEntries } from '@/lib/paymentGenerator';
import { ProjectBudgetCard } from '@/components/project/ProjectBudgetCard';

interface Props {
  projectId: string;
  projectName: string;
  clientName: string | null;
  clientId: string | undefined;
  productName?: string | null;
  startDate?: string | null;
  deadline?: string | null;
  projectPaymentMethod?: string | null;
  projectPaymentConfig?: Record<string, any> | null;
  onNewMeeting: () => void;
  onUpdateProject?: (field: string, value: any) => void;
}

const PAYMENT_FORMS = [
  { value: 'pagamento_total', label: 'Pagamento Total' },
  { value: 'entrada_prestacoes', label: 'Entrada + Prestações' },
  { value: 'prestacoes', label: 'Prestações' },
  { value: 'avenca_mensal', label: 'Avença Mensal' },
  { value: 'subscricao', label: 'Subscrição' },
];

import { PAYMENT_METHOD_OPTIONS } from '@/lib/salesConstants';

const SUBSCRIPTION_PERIODICITIES = [
  { value: 'mensal', label: 'Mensal' },
  { value: 'bimestral', label: 'Bimestral' },
  { value: 'trimestral', label: 'Trimestral' },
  { value: 'semestral', label: 'Semestral' },
  { value: 'anual', label: 'Anual' },
];

import { getSaleStatusInfo } from '@/lib/saleStatus';
import { EmptyHint } from '@/components/ui/loading-skeletons';

export function ProjectGestaoTab({ projectId, projectName, clientName, clientId, productName, startDate, deadline, projectPaymentMethod, projectPaymentConfig, onNewMeeting, onUpdateProject }: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
  const [manualEntryOpen, setManualEntryOpen] = useState(false);
  // ─── Payment config form state ─────────────────────────────────
  const [payMethod, setPayMethod] = useState<string>(projectPaymentMethod || '');
  const [totalValue, setTotalValue] = useState(projectPaymentConfig?.totalValue || '');
  const [entradaValue, setEntradaValue] = useState(projectPaymentConfig?.entradaValue || '');
  const [numPrestacoes, setNumPrestacoes] = useState(projectPaymentConfig?.numPrestacoes || '');
  const [payDay, setPayDay] = useState(projectPaymentConfig?.payDay || '');
  const [numMeses, setNumMeses] = useState(projectPaymentConfig?.numMeses || '');
  const [avencaValue, setAvencaValue] = useState(projectPaymentConfig?.avencaValue || '');
  const [subscricaoValue, setSubscricaoValue] = useState(projectPaymentConfig?.subscricaoValue || '');
  const [subscricaoPeriodicity, setSubscricaoPeriodicity] = useState(projectPaymentConfig?.subscricaoPeriodicity || 'mensal');
  const [paymentMethodType, setPaymentMethodType] = useState(projectPaymentConfig?.paymentMethodType || '');
  const [entradaPaymentMethod, setEntradaPaymentMethod] = useState(projectPaymentConfig?.entradaPaymentMethod || '');
  const [prestacoesPaymentMethod, setPrestacoesPaymentMethod] = useState(projectPaymentConfig?.prestacoesPaymentMethod || '');
  // Lock state: start locked if a payment method is already configured
  const [paymentLocked, setPaymentLocked] = useState(!!projectPaymentMethod);

  // ─── Client data (start_date) ─────────────────────────────────
  const { data: clientData } = useQuery({
    queryKey: ['client-gestao', clientId, clientName],
    queryFn: async () => {
      if (clientId) {
        const { data } = await supabase.from('clients').select('id, start_date, current_product').eq('id', clientId).maybeSingle();
        return data;
      }
      if (clientName) {
        const { data } = await supabase.from('clients').select('id, start_date, current_product').eq('full_name', clientName).maybeSingle();
        return data;
      }
      return null;
    },
    enabled: !!clientId || !!clientName,
  });

  const resolvedClientId = clientData?.id || clientId;
  const billingStartDate = startDate || clientData?.start_date;
  const comData = useCommercialData();

  const { data: productsList } = useQuery({
    queryKey: ['products-gestao'],
    queryFn: async () => {
      const { data } = await supabase.from('products').select('name, vat_rate');
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });
  const productNamesList = useMemo(() => (productsList || []).map(p => p.name), [productsList]);

  // Auto-calculate numMeses from start_date + deadline for avença_mensal
  useEffect(() => {
    if (billingStartDate && deadline && (payMethod === 'avenca_mensal')) {
      const s = parseISO(billingStartDate);
      const e = parseISO(deadline);
      const diffMonths = (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth());
      if (diffMonths > 0) {
        setNumMeses(String(diffMonths));
      }
    }
  }, [billingStartDate, deadline, payMethod]);

  // Auto-prefill totalValue from project budget (set by accepted quote)
  useQuery({
    queryKey: ['project-budget-prefill', projectId],
    queryFn: async () => {
      const { data } = await supabase.from('projects').select('budget').eq('id', projectId).maybeSingle();
      if (data?.budget && !totalValue) {
        setTotalValue(String(data.budget));
      }
      return data;
    },
  });

  // Sync payMethod from project
  useEffect(() => {
    if (projectPaymentMethod && !payMethod) {
      setPayMethod(projectPaymentMethod);
    }
  }, [projectPaymentMethod, payMethod]);

  const paymentConfig = useMemo(
    () => ({
      totalValue,
      entradaValue,
      numPrestacoes,
      payDay,
      numMeses,
      avencaValue,
      subscricaoValue,
      subscricaoPeriodicity,
      paymentMethodType,
      entradaPaymentMethod,
      prestacoesPaymentMethod,
    }),
    [
      totalValue,
      entradaValue,
      numPrestacoes,
      payDay,
      numMeses,
      avencaValue,
      subscricaoValue,
      subscricaoPeriodicity,
      paymentMethodType,
      entradaPaymentMethod,
      prestacoesPaymentMethod,
    ],
  );

  const handleSavePaymentConfig = () => {
    if (onUpdateProject) {
      onUpdateProject('payment_method', payMethod || null);
      onUpdateProject('payment_config', paymentConfig);
    }
    setPaymentLocked(true);
  };

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

  // ─── Helper: resolve payment method for a generated entry ─────
  const getMethodForEntry = (isEntrada: boolean) => {
    if (payMethod === 'entrada_prestacoes') {
      return isEntrada ? (entradaPaymentMethod || paymentMethodType || null) : (prestacoesPaymentMethod || paymentMethodType || null);
    }
    return paymentMethodType || null;
  };

  // ─── Generate sales entries ───────────────────────────────────
  const generateSales = useMutation({
    mutationFn: async () => {
      if (!billingStartDate) throw new Error('Projeto sem data de início definida');
      const product = productName || clientData?.current_product || '';
      const client = clientName || '';
      const vatRate = Number((productsList || []).find(p => p.name === product)?.vat_rate) || 0;

      const upcomingEntries = buildPaymentEntries({
        payMethod,
        startDate: billingStartDate,
        deadline: deadline || null,
        totalValue, entradaValue, numPrestacoes, payDay, numMeses, avencaValue,
        paymentMethodType, entradaPaymentMethod, prestacoesPaymentMethod,
        product, client,
        projectId,
        vatRate,
        createdBy: user?.id || null,
        filterFromCurrentMonth: true,
      });
      if (upcomingEntries.length === 0) {
        throw new Error('Não existem pagamentos por gerar a partir deste mês');
      }

      // Attach client_id so DB trigger doesn't wipe the client text
      const enriched = upcomingEntries.map(e => ({
        ...e,
        client_id: resolvedClientId || null,
      }));
      const { error } = await supabase.from('commercial_sales').insert(enriched);
      if (error) throw error;

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

  const regenerateSales = useMutation({
    mutationFn: async () => {
      // Only delete pending sales — preserve paid/cancelled ones
      const { error: delErr } = await supabase
        .from('commercial_sales')
        .delete()
        .eq('project_id', projectId)
        .eq('source', 'projeto')
        .in('status', ['aguarda_pagamento', 'em_atraso']);
      if (delErr) throw delErr;
      // Then generate new ones (generateSales already filters to upcoming months)
      await generateSales.mutateAsync();
    },
    onError: (err: any) => {
      toast.error(err.message || 'Erro ao regenerar pagamentos');
    },
  });

  const hasExistingProjectSales = projectSales.length > 0;

  // Manual-only payment generation — no auto-generate

  return (
    <div className="space-y-6">
      {/* Valor contratado / orçamento de origem */}
      <ProjectBudgetCard projectId={projectId} clientId={clientId || null} />

      {/* Forma de Pagamento + Gerador */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-3 bg-muted/30 border-b flex flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <CreditCard className="h-4 w-4 text-primary" />
            </div>
            <CardTitle className="text-base">Forma de Pagamento</CardTitle>
          </div>
          {payMethod && paymentLocked && (
            <Button size="sm" variant="outline" onClick={() => setPaymentLocked(false)} className="gap-2">
              <Pencil className="h-3.5 w-3.5" /> Editar
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          {/* ─── LOCKED: read-only summary ─── */}
          {paymentLocked && payMethod ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">{PAYMENT_FORMS.find(f => f.value === payMethod)?.label || payMethod}</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1 text-sm">
                {payMethod !== 'entrada_prestacoes' && paymentMethodType && (
                  <div><span className="text-muted-foreground">Método:</span> {PAYMENT_METHOD_OPTIONS.find(m => m.value === paymentMethodType)?.label}</div>
                )}
                {payMethod === 'entrada_prestacoes' && entradaPaymentMethod && (
                  <div><span className="text-muted-foreground">Método entrada:</span> {PAYMENT_METHOD_OPTIONS.find(m => m.value === entradaPaymentMethod)?.label}</div>
                )}
                {payMethod === 'entrada_prestacoes' && prestacoesPaymentMethod && (
                  <div><span className="text-muted-foreground">Método prestações:</span> {PAYMENT_METHOD_OPTIONS.find(m => m.value === prestacoesPaymentMethod)?.label}</div>
                )}
                {totalValue && <div><span className="text-muted-foreground">Valor total:</span> {parseFloat(totalValue).toFixed(2)}€</div>}
                {entradaValue && payMethod === 'entrada_prestacoes' && <div><span className="text-muted-foreground">Entrada:</span> {parseFloat(entradaValue).toFixed(2)}€</div>}
                {numPrestacoes && (payMethod === 'entrada_prestacoes' || payMethod === 'prestacoes') && <div><span className="text-muted-foreground">Prestações:</span> {numPrestacoes}x</div>}
                {payDay && <div><span className="text-muted-foreground">Dia pagamento:</span> {payDay}</div>}
                {numMeses && payMethod === 'avenca_mensal' && <div><span className="text-muted-foreground">Meses:</span> {numMeses}</div>}
                {avencaValue && payMethod === 'avenca_mensal' && <div><span className="text-muted-foreground">Valor mensal:</span> {parseFloat(avencaValue).toFixed(2)}€</div>}
                {subscricaoValue && payMethod === 'subscricao' && <div><span className="text-muted-foreground">Subscrição:</span> {parseFloat(subscricaoValue).toFixed(2)}€</div>}
                {payMethod === 'subscricao' && <div><span className="text-muted-foreground">Periodicidade:</span> {SUBSCRIPTION_PERIODICITIES.find(p => p.value === subscricaoPeriodicity)?.label}</div>}
              </div>

            </div>
          ) : (
            /* ─── UNLOCKED: editable form ─── */
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Forma de Pagamento</Label>
                  <Select
                    value={payMethod}
                    onValueChange={setPayMethod}
                    disabled={!resolvedClientId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={resolvedClientId ? 'Selecionar forma...' : 'Associe um cliente ao projeto'} />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_FORMS.map(m => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {payMethod && payMethod !== 'entrada_prestacoes' && (
                  <div>
                    <Label className="text-xs">Método de Pagamento</Label>
                    <Select value={paymentMethodType} onValueChange={setPaymentMethodType}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecionar método..." />
                      </SelectTrigger>
                      <SelectContent>
                        {PAYMENT_METHOD_OPTIONS.map(m => (
                          <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {payMethod === 'entrada_prestacoes' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Método — Entrada</Label>
                    <Select value={entradaPaymentMethod} onValueChange={setEntradaPaymentMethod}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecionar método..." />
                      </SelectTrigger>
                      <SelectContent>
                        {PAYMENT_METHOD_OPTIONS.map(m => (
                          <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Método — Prestações</Label>
                    <Select value={prestacoesPaymentMethod} onValueChange={setPrestacoesPaymentMethod}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecionar método..." />
                      </SelectTrigger>
                      <SelectContent>
                        {PAYMENT_METHOD_OPTIONS.map(m => (
                          <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {/* Dynamic fields per method */}
              {payMethod === 'pagamento_total' && (
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-xs">Valor Total s/ IVA (€)</Label><Input type="number" value={totalValue} onChange={e => setTotalValue(e.target.value)} placeholder="0.00" /></div>
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

              {payMethod && (
                <div className="flex items-center gap-3 pt-2">
                  <Button onClick={handleSavePaymentConfig} className="gap-2">
                    <Save className="h-4 w-4" /> Guardar Configuração
                  </Button>
                  {!hasExistingProjectSales && (
                    <Button variant="outline" onClick={() => generateSales.mutate()} disabled={generateSales.isPending} className="gap-2">
                      {generateSales.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                      Gerar Pagamentos
                    </Button>
                  )}
                  {hasExistingProjectSales && (
                    <Button variant="outline" onClick={() => regenerateSales.mutate()} disabled={regenerateSales.isPending || generateSales.isPending} className="gap-2">
                      {regenerateSales.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                      Regenerar Pagamentos
                    </Button>
                  )}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Pagamentos */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-3 bg-muted/30 border-b flex flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <CreditCard className="h-4 w-4 text-primary" />
            </div>
            <CardTitle className="text-base">Pagamentos</CardTitle>
          </div>
          <Button size="sm" variant="outline" onClick={() => setManualEntryOpen(true)}>
            <Plus className="h-3 w-3 mr-1" />Nova Entrada
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="bg-primary text-primary-foreground px-4 py-2.5 font-medium text-xs grid grid-cols-7 gap-2">
            <span>Status</span>
            <span>Data</span>
            <span>Descrição</span>
            <span>Valor Base</span>
            <span>Fatura</span>
            <span>Método</span>
            <span>Produto</span>
          </div>
          {allSales.length === 0 ? (
            <EmptyHint>Sem pagamentos associados</EmptyHint>
          ) : (
            allSales.map((s: any) => {
              const si = getSaleStatusInfo(s.status);
              const methodLabel = PAYMENT_METHOD_OPTIONS.find(m => m.value === s.payment_method)?.label;
              return (
                <div
                  key={s.id}
                  className="px-4 py-2.5 text-sm grid grid-cols-7 gap-2 border-b items-center cursor-pointer hover:bg-muted/50"
                  onClick={() => setSelectedSaleId(s.id)}
                >
                  <span><Badge className={`text-[11px] font-semibold px-2.5 py-0.5 ${si.color}`}>{si.label}</Badge></span>
                  <span>{s.payment_date ? format(parseISO(s.payment_date), 'dd/MM/yyyy') : '—'}</span>
                  <span className="truncate">{s.description || '—'}{s.is_special_offer && <Gift className="inline h-3 w-3 ml-1 text-warning" />}</span>
                  <span>{Number(s.base_value).toFixed(2)}€</span>
                  <span>{Number(s.invoice_total).toFixed(2)}€</span>
                  <span className="truncate text-muted-foreground">{methodLabel || '—'}</span>
                  <span className="truncate">{s.product || '—'}</span>
                </div>
              );
            })
          )}
          {allSales.length > 0 && (
            <div className="px-4 py-3 text-xs font-medium border-t flex justify-between">
              <span>Total: {allSales.length} pagamento(s)</span>
              <span>Valor total: {sumRevenue(allSales).toFixed(2)}€</span>
            </div>
          )}
        </CardContent>
      </Card>

      <SaleDetailDialog saleId={selectedSaleId} open={!!selectedSaleId} onOpenChange={o => { if (!o) setSelectedSaleId(null); }} />
      <SaleFormDialog
        open={manualEntryOpen}
        onOpenChange={setManualEntryOpen}
        products={productNamesList || []}
        initialData={{ client: clientName, product: productName, source: 'projeto', project_id: projectId, status: 'aguarda_pagamento' }}
        onSave={(sale) => { comData.upsertSale.mutate(sale); setManualEntryOpen(false); }}
      />

    </div>
  );
}
