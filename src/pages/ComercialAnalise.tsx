import { useState, useMemo, useCallback, useEffect, Fragment } from 'react';
import { useKpiSettings } from '@/hooks/useKpiSettings';
import { YearSelector } from '@/components/YearSelector';
import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { BackNavigation } from '@/components/BackNavigation';
import { MonthCardsGallery } from '@/components/analysis/MonthCardsGallery';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ChevronLeft, ChevronRight, Users, Phone, CalendarCheck, FileText, TrendingUp, Clock, UserMinus, DollarSign, UserPlus, RefreshCw, AlertTriangle, ArrowLeft, ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { MonthNavHeader } from '@/components/MonthNavHeader';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCrmData } from '@/hooks/useCrmData';
import { useCommercialData } from '@/hooks/useCommercialData';
import { useClients } from '@/hooks/useClients';
import { differenceInDays, parseISO, endOfMonth, format } from 'date-fns';
import { cn } from '@/lib/utils';
import { sumRevenue, salesInMonth, revenueGroupedBy, averageTicket } from '@/lib/salesCalculations';
import { formatInt } from '@/lib/formatting';

const MONTH_NAMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

function KpiCard({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: any; color?: string }) {
  return (
    <Card className="border-secondary bg-background">
      <CardContent className="p-4 flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="min-w-0">
          <p className={`text-xl font-bold ${color || 'text-foreground'}`}>{value}</p>
          <p className="text-xs text-muted-foreground truncate">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function MonthDetail({ monthIdx, year, onBack, onChangeMonth }: { monthIdx: number; year: number; onBack: () => void; onChangeMonth: (m: number, y: number) => void }) {
  const month = monthIdx + 1;
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { isKpiEnabled, isAreaEnabled } = useKpiSettings();

  const { allLeads } = useCrmData();
  const { sales: salesQ, annualGoalAmount, totalInvoiced, monthlyGoals } = useCommercialData(year);
  const { clients: clientsQ } = useClients();
  const { sales: prevYearSalesQ } = useCommercialData(year - 1);

  const leads = allLeads || [];
  const salesData = salesQ.data || [];
  const clientsData = clientsQ.data || [];
  const prevYearSalesData = prevYearSalesQ.data || [];

  // Qualitative analysis
  const analysisQ = useQuery({
    queryKey: ['commercial_analysis', month, year],
    queryFn: async () => {
      const { data } = await (supabase.from('commercial_monthly_analysis' as any) as any)
        .select('*').eq('month', month).eq('year', year).maybeSingle();
      return data as any;
    },
  });

  const [qualData, setQualData] = useState<Record<string, string>>({});
  useEffect(() => {
    if (analysisQ.data) {
      setQualData({
        main_objections: analysisQ.data.main_objections || '',
        active_actions_results: analysisQ.data.active_actions_results || '',
        what_went_well: analysisQ.data.what_went_well || '',
        what_went_wrong: analysisQ.data.what_went_wrong || '',
      });
    } else {
      setQualData({ main_objections: '', active_actions_results: '', what_went_well: '', what_went_wrong: '' });
    }
  }, [analysisQ.data]);

  const saveField = useCallback(async (field: string) => {
    const value = qualData[field] ?? '';
    const existing = analysisQ.data;
    if (existing?.id) {
      await (supabase.from('commercial_monthly_analysis' as any) as any).update({ [field]: value || null }).eq('id', existing.id);
    } else {
      await (supabase.from('commercial_monthly_analysis' as any) as any).insert({ month, year, [field]: value || null });
    }
    qc.invalidateQueries({ queryKey: ['commercial_analysis', month, year] });
  }, [qualData, analysisQ.data, month, year, qc]);

  // ─── CRM KPIs ───
  const monthLeads = useMemo(() => leads.filter(l => {
    const d = new Date(l.created_at);
    return d.getMonth() + 1 === month && d.getFullYear() === year;
  }), [leads, month, year]);

  const interactionsQ = useQuery({
    queryKey: ['crm', 'interactions_month', month, year],
    queryFn: async () => {
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const endMonth = month === 12 ? 1 : month + 1;
      const endYear = month === 12 ? year + 1 : year;
      const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;
      const { data } = await supabase.from('crm_interactions').select('*')
        .gte('interaction_date', startDate).lt('interaction_date', endDate);
      return data || [];
    },
  });
  const monthInteractions = interactionsQ.data || [];
  const followUpsDone = monthInteractions.length;
  const contactedLeads = useMemo(() => new Set(monthInteractions.map((i: any) => i.lead_id)).size, [monthInteractions]);

  const leadsInMonth = useMemo(() => leads.filter(l => {
    const d = new Date(l.updated_at);
    return d.getMonth() + 1 === month && d.getFullYear() === year;
  }), [leads, month, year]);

  const sessionsScheduled = leadsInMonth.filter(l => l.status === 'sessao_agendada').length;
  const proposalsSent = leadsInMonth.filter(l => l.status === 'proposta_enviada').length;
  const responseRate = contactedLeads > 0 ? Math.round((monthInteractions.filter((i: any) => i.interaction_type === 'reuniao' || i.interaction_type === 'chamada').length / contactedLeads) * 100) : 0;

  // ─── Conversion KPIs ───
  const winsInMonth = leadsInMonth.filter(l => l.status === 'ganho');
  const lossesInMonth = leadsInMonth.filter(l => l.status === 'perdido');
  const activeInMonth = leads.filter(l => {
    const d = new Date(l.created_at);
    return d.getFullYear() === year && d.getMonth() + 1 <= month && l.status !== 'perdido';
  });
  const conversionRate = activeInMonth.length > 0 ? Math.round((winsInMonth.length / activeInMonth.length) * 100) : 0;
  const avgPipelineDays = useMemo(() => {
    if (winsInMonth.length === 0) return null;
    const total = winsInMonth.reduce((sum, l) => sum + differenceInDays(parseISO(l.updated_at), parseISO(l.created_at)), 0);
    return Math.round(total / winsInMonth.length);
  }, [winsInMonth]);

  const renewalClients = clientsData.filter(c => {
    if (!c.updated_at) return false;
    const d = new Date(c.updated_at);
    return d.getMonth() + 1 === month && d.getFullYear() === year;
  });
  const renewedCount = renewalClients.filter(c => c.status === 'ativo').length;
  const renewalBaseCount = renewalClients.filter(c => c.status === 'ativo' || c.status === 'altura_renovacao' || c.status === 'terminado').length;
  const renewalRate = renewalBaseCount > 0 ? Math.round((renewedCount / renewalBaseCount) * 100) : 0;

  // ─── Financial KPIs ───
  const monthSales = salesData.filter(s => s.sale_month === month);
  const monthRevenue = sumRevenue(monthSales);
  const monthlyGoalAmount = (monthlyGoals.data || []).find(g => g.month === month)?.goal_amount || 0;
  const monthProgressPct = monthlyGoalAmount > 0 ? Math.min((monthRevenue / monthlyGoalAmount) * 100, 100) : 0;
  const yearProgressPct = annualGoalAmount > 0 ? Math.min((totalInvoiced / annualGoalAmount) * 100, 100) : 0;
  const ticketMedio = averageTicket(monthSales);
  const pipelineValue = useMemo(() =>
    leads.filter(l => l.status !== 'ganho' && l.status !== 'perdido').reduce((s, l) => s + Number(l.estimated_value || 0), 0),
    [leads]
  );
  const revenueByProduct = useMemo(() => {
    const map = revenueGroupedBy(monthSales, s => s.product, 'Sem produto');
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [monthSales]);

  // ─── Client KPIs ───
  const newClientsMonth = clientsData.filter(c => {
    if (!c.start_date) return false;
    const d = new Date(c.start_date);
    return d.getMonth() + 1 === month && d.getFullYear() === year;
  }).length;
  const clientsRenewal = clientsData.filter(c => c.status === 'altura_renovacao').length;
  const churnMonth = renewalClients.filter(c => c.status === 'terminado').length;

  // ─── Products query ───
  const productsQ = useQuery({
    queryKey: ['products-active'],
    queryFn: async () => {
      const { data } = await supabase.from('products').select('*').eq('status', 'vendas_ativas');
      return data || [];
    },
  });
  const npsQ = useQuery({
    queryKey: ['all-nps-records'],
    queryFn: async () => {
      const { data } = await supabase.from('client_nps_records').select('*, clients!client_nps_records_client_id_fkey(full_name, current_product, current_product_id, id)').order('actual_date', { ascending: false });
      return data || [];
    },
  });

  // ─── Product comparative data ───
  type SortKey = 'revenue' | 'sales' | 'ticket' | 'active' | 'new' | 'churn' | 'renewal' | 'nps' | 'product';
  const [sortKey, setSortKey] = useState<SortKey>('revenue');
  const [sortAsc, setSortAsc] = useState(false);

  const productRows = useMemo(() => {
    const activeProducts = productsQ.data || [];
    if (activeProducts.length === 0) return [];

    return activeProducts.map(p => {
      const pSales = monthSales.filter(s => (s as any).product_id === p.id);
      const pRevenue = sumRevenue(pSales);
      const pCount = pSales.length;
      const pTicket = averageTicket(pSales);

      const pClients = clientsData.filter(c =>
        (c as any).current_product_id ? (c as any).current_product_id === p.id : c.current_product === p.name
      );
      const pActive = pClients.filter(c => c.status === 'ativo' || c.status === 'em_onboarding').length;
      const pNew = pClients.filter(c => {
        if (!c.start_date) return false;
        const d = new Date(c.start_date);
        return d.getMonth() + 1 === month && d.getFullYear() === year;
      }).length;
      const pChurn = pClients.filter(c => {
        if (!c.updated_at || c.status !== 'terminado') return false;
        const d = new Date(c.updated_at);
        return d.getMonth() + 1 === month && d.getFullYear() === year;
      }).length;

      // Renewal rate
      const pRenewals = pClients.filter(c => {
        if (!c.updated_at) return false;
        const d = new Date(c.updated_at);
        return d.getMonth() + 1 === month && d.getFullYear() === year;
      });
      const pRenewed = pRenewals.filter(c => c.status === 'ativo').length;
      const pRenBase = pRenewals.filter(c => ['ativo', 'altura_renovacao', 'terminado'].includes(c.status)).length;
      const pRenRate = pRenBase > 0 ? Math.round((pRenewed / pRenBase) * 100) : null;

      // NPS - latest per client for this product
      const allNps = (npsQ.data || []) as any[];
      const seen = new Set<string>();
      const scores: number[] = [];
      for (const n of allNps) {
        const matchesProduct = n.clients?.current_product_id
          ? n.clients.current_product_id === p.id
          : n.clients?.current_product === p.name;
        if (n.nps_score != null && matchesProduct && n.clients?.id && !seen.has(n.clients.id)) {
          seen.add(n.clients.id);
          scores.push(n.nps_score);
        }
      }
      const pNps = scores.length > 0 ? parseFloat((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)) : null;

      // Trend vs same month last year
      const prevRevenue = sumRevenue(prevYearSalesData.filter(s => (s as any).product_id === p.id && s.sale_month === month));
      const hasPrev = prevYearSalesData.some(s => (s as any).product_id === p.id && s.sale_month === month);
      const trend: 'up' | 'down' | 'none' = !hasPrev ? 'none' : pRevenue > prevRevenue ? 'up' : pRevenue < prevRevenue ? 'down' : 'none';

      return { id: p.id, product: p.name, revenue: pRevenue, sales: pCount, ticket: pTicket, active: pActive, new: pNew, churn: pChurn, renewal: pRenRate, nps: pNps, trend };
    });
  }, [productsQ.data, monthSales, clientsData, month, year, npsQ.data, prevYearSalesData]);

  const sortedRows = useMemo(() => {
    const rows = [...productRows];
    rows.sort((a, b) => {
      const av = sortKey === 'product' ? a.product : (a[sortKey] ?? -1);
      const bv = sortKey === 'product' ? b.product : (b[sortKey] ?? -1);
      if (typeof av === 'string' && typeof bv === 'string') return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortAsc ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
    return rows;
  }, [productRows, sortKey, sortAsc]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(v => !v);
    else { setSortKey(key); setSortAsc(false); }
  };

  const totals = useMemo(() => ({
    revenue: productRows.reduce((s, r) => s + r.revenue, 0),
    sales: productRows.reduce((s, r) => s + r.sales, 0),
    new: productRows.reduce((s, r) => s + r.new, 0),
    churn: productRows.reduce((s, r) => s + r.churn, 0),
  }), [productRows]);
  const fmtEur = (n: number) => `${formatInt(n)} €`;

  return (
    <div className="space-y-6">
      <MonthNavHeader monthIdx={monthIdx} year={year} onBack={onBack} onChangeMonth={onChangeMonth} />

      {/* CRM Operational */}
      {isAreaEnabled('comercial') && (isKpiEnabled('comercial', 'leads_novas') || isKpiEnabled('comercial', 'followups_realizados')) && (
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">KPIs Operacionais do CRM</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {isKpiEnabled('comercial', 'leads_novas') && <KpiCard label="Leads novas" value={monthLeads.length} icon={Users} />}
          {isKpiEnabled('comercial', 'followups_realizados') && <KpiCard label="Follow-ups feitos" value={followUpsDone} icon={Phone} />}
          {isKpiEnabled('comercial', 'followups_realizados') && <KpiCard label="Contactos realizados" value={contactedLeads} icon={Phone} />}
          {isKpiEnabled('comercial', 'followups_realizados') && <KpiCard label="Sessões agendadas" value={sessionsScheduled} icon={CalendarCheck} />}
          {isKpiEnabled('comercial', 'followups_realizados') && <KpiCard label="Propostas enviadas" value={proposalsSent} icon={FileText} />}
          {isKpiEnabled('comercial', 'taxa_conversao') && <KpiCard label="Taxa de resposta" value={`${responseRate}%`} icon={TrendingUp} />}
        </div>
      </div>
      )}

      {/* Conversion */}
      {isAreaEnabled('comercial') && (isKpiEnabled('comercial', 'taxa_conversao') || isKpiEnabled('comercial', 'tempo_medio_pipeline') || isKpiEnabled('comercial', 'taxa_renovacao')) && (
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">KPIs de Conversão</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {isKpiEnabled('comercial', 'taxa_conversao') && <KpiCard label="Taxa de conversão global" value={`${conversionRate}%`} icon={TrendingUp} />}
          {isKpiEnabled('comercial', 'tempo_medio_pipeline') && <KpiCard label="Tempo médio no pipeline" value={avgPipelineDays !== null ? `${avgPipelineDays} dias` : '—'} icon={Clock} />}
          {isKpiEnabled('comercial', 'taxa_conversao') && <KpiCard label="Leads perdidas" value={lossesInMonth.length} icon={UserMinus} color={lossesInMonth.length > 0 ? 'text-destructive' : undefined} />}
          {isKpiEnabled('comercial', 'taxa_renovacao') && <KpiCard label="Taxa de renovação" value={`${renewalRate}%`} icon={RefreshCw} />}
        </div>
      </div>
      )}

      {/* Financial */}
      {isAreaEnabled('comercial') && isKpiEnabled('comercial', 'receita_vs_meta') && (
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">KPIs Financeiros</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="border-secondary bg-background">
            <CardContent className="p-4 space-y-2">
              <div className="flex justify-between items-baseline">
                <p className="text-xs text-muted-foreground">Faturação do mês</p>
                <p className="text-lg font-bold">{fmtEur(monthRevenue)}</p>
              </div>
              {monthlyGoalAmount > 0 && (
                <>
                  <Progress value={monthProgressPct} className="h-2" />
                  <p className="text-xs text-muted-foreground text-right">{Math.round(monthProgressPct)}% da meta ({fmtEur(monthlyGoalAmount)})</p>
                </>
              )}
            </CardContent>
          </Card>
          <Card className="border-secondary bg-background">
            <CardContent className="p-4 space-y-2">
              <div className="flex justify-between items-baseline">
                <p className="text-xs text-muted-foreground">Faturação acumulada do ano</p>
                <p className="text-lg font-bold">{fmtEur(totalInvoiced)}</p>
              </div>
              {annualGoalAmount > 0 && (
                <>
                  <Progress value={yearProgressPct} className="h-2" />
                  <p className="text-xs text-muted-foreground text-right">{Math.round(yearProgressPct)}% da meta ({fmtEur(annualGoalAmount)})</p>
                </>
              )}
            </CardContent>
          </Card>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-3">
          {isKpiEnabled('comercial', 'ticket_medio') && <KpiCard label="Ticket médio" value={fmtEur(ticketMedio)} icon={DollarSign} />}
          <KpiCard label="Pipeline activo" value={fmtEur(pipelineValue)} icon={TrendingUp} />
        </div>
        {isKpiEnabled('comercial', 'comparativo_produtos') && revenueByProduct.length > 0 && (
          <Card className="border-secondary bg-background mt-3">
            <CardHeader className="pb-2 pt-4 px-4"><CardTitle className="text-sm font-semibold">Receita por Produto</CardTitle></CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="space-y-2">
                {revenueByProduct.map(([product, total]) => (
                  <div key={product} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{product}</span>
                    <span className="font-medium">{fmtEur(total)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
      )}

      {/* Clients */}
      {isAreaEnabled('comercial') && (
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">KPIs de Clientes</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <KpiCard label="Novos clientes" value={newClientsMonth} icon={UserPlus} />
          <KpiCard label="Em renovação" value={clientsRenewal} icon={RefreshCw} />
          <KpiCard label="Renovações confirmadas" value={renewedCount} icon={RefreshCw} color="text-success" />
          <KpiCard label="Renovações perdidas" value={churnMonth} icon={UserMinus} color={churnMonth > 0 ? 'text-destructive' : undefined} />
          <KpiCard label="Churn do mês" value={churnMonth} icon={AlertTriangle} color={churnMonth > 0 ? 'text-destructive' : undefined} />
        </div>
      </div>
      )}

      {/* Product Comparative */}
      {isAreaEnabled('comercial') && isKpiEnabled('comercial', 'comparativo_produtos') && (
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Comparativo de Produtos</h3>
        {sortedRows.length === 0 ? (
          <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">Sem produtos com vendas ativas.</CardContent></Card>
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    {([
                      { key: 'product' as SortKey, label: 'Produto' },
                      { key: 'revenue' as SortKey, label: 'Receita' },
                      { key: 'sales' as SortKey, label: 'Vendas' },
                      { key: 'ticket' as SortKey, label: 'Ticket médio' },
                      { key: 'active' as SortKey, label: 'Ativos' },
                      { key: 'new' as SortKey, label: 'Novos' },
                      { key: 'churn' as SortKey, label: 'Churn' },
                      { key: 'renewal' as SortKey, label: 'Renovação' },
                      { key: 'nps' as SortKey, label: 'NPS' },
                    ]).map(col => (
                      <th
                        key={col.key}
                        className={cn(
                          'p-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground select-none whitespace-nowrap',
                          col.key === 'product' ? 'text-left' : 'text-right'
                        )}
                        onClick={() => toggleSort(col.key)}
                      >
                        <span className="inline-flex items-center gap-1">
                          {col.label}
                          {sortKey === col.key && (sortAsc ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                        </span>
                      </th>
                    ))}
                    <th className="p-3 font-medium text-muted-foreground text-center whitespace-nowrap">Tendência</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedRows.map(r => (
                    <tr key={r.id} className="border-b last:border-0 hover:bg-muted/50 cursor-pointer" onClick={() => navigate(`/hub/produtos/${r.id}`)}>
                      <td className="p-3 font-medium text-primary hover:underline">{r.product}</td>
                      <td className="p-3 text-right">{fmtEur(r.revenue)}</td>
                      <td className="p-3 text-right">{r.sales}</td>
                      <td className="p-3 text-right">{fmtEur(r.ticket)}</td>
                      <td className="p-3 text-right">{r.active}</td>
                      <td className="p-3 text-right">{r.new}</td>
                      <td className="p-3 text-right">{r.churn > 0 ? <span className="text-destructive">{r.churn}</span> : r.churn}</td>
                      <td className="p-3 text-right">{r.renewal != null ? `${r.renewal}%` : '—'}</td>
                      <td className="p-3 text-right">{r.nps != null ? r.nps : '—'}</td>
                      <td className="p-3 text-center">
                        {r.trend === 'up' && <ArrowUp className="h-4 w-4 text-success inline" />}
                        {r.trend === 'down' && <ArrowDown className="h-4 w-4 text-destructive inline" />}
                        {r.trend === 'none' && <Minus className="h-4 w-4 text-muted-foreground inline" />}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t bg-muted/30 font-semibold">
                    <td className="p-3">Total</td>
                    <td className="p-3 text-right">{fmtEur(totals.revenue)}</td>
                    <td className="p-3 text-right">{totals.sales}</td>
                    <td className="p-3 text-right" />
                    <td className="p-3 text-right" />
                    <td className="p-3 text-right">{totals.new}</td>
                    <td className="p-3 text-right">{totals.churn}</td>
                    <td className="p-3 text-right" />
                    <td className="p-3 text-right" />
                    <td className="p-3" />
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>
        )}
      </div>
      )}
      <Separator />

      {/* Qualitative */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Análise Qualitativa</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {([
            { key: 'main_objections', label: 'Principais objeções encontradas' },
            { key: 'active_actions_results', label: 'Ações comerciais activas e resultado percebido' },
            { key: 'what_went_well', label: 'O que correu bem' },
            { key: 'what_went_wrong', label: 'O que correu mal' },
          ] as const).map(f => (
            <div key={f.key} className="space-y-1">
              <label className="text-sm font-medium">{f.label}</label>
              <Textarea
                className="min-h-[100px]"
                value={qualData[f.key] || ''}
                onChange={e => setQualData(prev => ({ ...prev, [f.key]: e.target.value }))}
                onBlur={() => saveField(f.key)}
                placeholder={f.label}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Gallery ───
export default function ComercialAnalisePage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);

  const { sales: salesQ, monthlyGoals, annualGoalAmount, totalInvoiced } = useCommercialData(year);
  const salesData = salesQ.data || [];
  const { clients: clientsQ } = useClients();
  const clientsData = clientsQ.data || [];
  const { allLeads } = useCrmData();
  const leads = allLeads || [];

  // NPS for annual summary
  const npsAnnualQ = useQuery({
    queryKey: ['all-nps-annual'],
    queryFn: async () => {
      const { data } = await supabase.from('client_nps_records').select('client_id, nps_score, actual_date').order('actual_date', { ascending: false });
      return data || [];
    },
  });

  // Products for annual comparative
  const productsQ = useQuery({
    queryKey: ['products-active'],
    queryFn: async () => {
      const { data } = await supabase.from('products').select('id, name').eq('status', 'vendas_ativas');
      return data || [];
    },
  });

  // ─── Annual summary ───
  const annualSummary = useMemo(() => {
    const totalSales = salesData.length;
    const totalRevenue = sumRevenue(salesData);
    const ticketMedio = averageTicket(salesData);

    const newClients = clientsData.filter(c => {
      if (!c.start_date) return false;
      const d = new Date(c.start_date);
      return d.getFullYear() === year;
    }).length;

    const churn = clientsData.filter(c => {
      if (!c.updated_at || c.status !== 'terminado') return false;
      const d = new Date(c.updated_at);
      return d.getFullYear() === year;
    }).length;

    const renewalClients = clientsData.filter(c => {
      if (!c.updated_at) return false;
      const d = new Date(c.updated_at);
      return d.getFullYear() === year;
    });
    const renewed = renewalClients.filter(c => c.status === 'ativo').length;
    const renewalBase = renewalClients.filter(c => ['ativo', 'altura_renovacao', 'terminado'].includes(c.status)).length;
    const renewalRate = renewalBase > 0 ? Math.round((renewed / renewalBase) * 100) : 0;

    // NPS - latest per active client
    const activeClients = clientsData.filter(c => c.status === 'ativo' || c.status === 'em_onboarding');
    const activeIds = new Set(activeClients.map(c => c.id));
    const npsMap = new Map<string, number>();
    for (const n of (npsAnnualQ.data || []) as any[]) {
      if (n.nps_score != null && !npsMap.has(n.client_id) && activeIds.has(n.client_id)) {
        npsMap.set(n.client_id, n.nps_score);
      }
    }
    const npsScores = Array.from(npsMap.values());
    const avgNps = npsScores.length > 0 ? (npsScores.reduce((a, b) => a + b, 0) / npsScores.length).toFixed(1) : '—';

    // Leads
    const yearLeads = leads.filter(l => new Date(l.created_at).getFullYear() === year);
    const yearWins = yearLeads.filter(l => l.status === 'ganho');
    const conversionRate = yearLeads.length > 0 ? Math.round((yearWins.length / yearLeads.length) * 100) : 0;

    // Revenue by product
    const prodMap = revenueGroupedBy(salesData, s => s.product, 'Sem produto');
    const revenueByProduct = Array.from(prodMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, revenue]) => ({ name, revenue }));

    return { totalRevenue, totalSales, ticketMedio, newClients, churn, renewalRate, avgNps, leadsCount: yearLeads.length, conversionRate, revenueByProduct };
  }, [salesData, clientsData, leads, year, npsAnnualQ.data]);

  // Summary per month for gallery cards
  const monthSummaries = useMemo(() => {
    return MONTH_NAMES.map((name, idx) => {
      const m = idx + 1;
      const mSales = salesData.filter(s => s.sale_month === m);
      const revenue = sumRevenue(mSales);
      const goalAmount = (monthlyGoals.data || []).find(g => g.month === m)?.goal_amount || 0;
      const pct = goalAmount > 0 ? Math.min(Math.round((revenue / goalAmount) * 100), 100) : 0;
      return { name, revenue, goalAmount, pct, salesCount: mSales.length };
    });
  }, [salesData, monthlyGoals.data]);
  const fmtEur = (n: number) => `${formatInt(n)} €`;
  const yearProgressPct = annualGoalAmount > 0 ? Math.min(Math.round((annualSummary.totalRevenue / annualGoalAmount) * 100), 100) : 0;

  if (selectedMonth !== null) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <BackNavigation parentRoute="/hub/comercial" parentLabel="Comercial" />
          <PageHeader title="Análise Comercial" subtitle="Análise mensal do desempenho comercial." />
          <MonthDetail monthIdx={selectedMonth} year={year} onBack={() => setSelectedMonth(null)} onChangeMonth={(m, y) => { setSelectedMonth(m); setYear(y); }} />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <BackNavigation parentRoute="/hub/comercial" parentLabel="Comercial" />
        <PageHeader title="Análise Comercial" subtitle="Análise mensal do desempenho comercial." />

        {/* Year selector */}
        <YearSelector year={year} onChange={setYear} />

        {/* ─── Annual Summary ─── */}
        <div className="space-y-4">
          <h3 className="text-base font-semibold">Resumo {year}</h3>

          {/* Revenue vs goal */}
          {annualGoalAmount > 0 && (
            <Card className="border-secondary bg-background">
              <CardContent className="p-4 space-y-2">
                <div className="flex justify-between items-baseline">
                  <span className="text-sm text-muted-foreground">Receita total vs meta anual</span>
                  <span className="text-lg font-bold">{fmtEur(annualSummary.totalRevenue)} / {fmtEur(annualGoalAmount)}</span>
                </div>
                <Progress value={yearProgressPct} className="h-2" />
                <p className="text-xs text-muted-foreground text-right">{yearProgressPct}%</p>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
            <KpiCard label="Receita total" value={fmtEur(annualSummary.totalRevenue)} icon={DollarSign} />
            <KpiCard label="Total de vendas" value={annualSummary.totalSales} icon={TrendingUp} />
            <KpiCard label="Ticket médio anual" value={fmtEur(annualSummary.ticketMedio)} icon={DollarSign} />
            <KpiCard label="Novos clientes" value={annualSummary.newClients} icon={UserPlus} />
            <KpiCard label="Churn total" value={annualSummary.churn} icon={UserMinus} color={annualSummary.churn > 0 ? 'text-destructive' : undefined} />
            <KpiCard label="Taxa de renovação" value={`${annualSummary.renewalRate}%`} icon={RefreshCw} />
            <KpiCard label="NPS médio atual" value={annualSummary.avgNps} icon={AlertTriangle} />
            <KpiCard label="Leads novas" value={annualSummary.leadsCount} icon={Users} />
            <KpiCard label="Taxa de conversão" value={`${annualSummary.conversionRate}%`} icon={TrendingUp} />
          </div>

          {/* Revenue by product */}
          {annualSummary.revenueByProduct.length > 0 && (
            <Card className="border-secondary bg-background">
              <CardHeader className="pb-2 pt-4 px-4"><CardTitle className="text-sm font-semibold">Receita por Produto — {year}</CardTitle></CardHeader>
              <CardContent className="px-4 pb-4 space-y-2">
                {annualSummary.revenueByProduct.map(p => (
                  <div key={p.name} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{p.name}</span>
                    <span className="font-medium">{fmtEur(p.revenue)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        <Separator />

        {/* Month gallery */}
        <MonthCardsGallery
          months={monthSummaries}
          year={year}
          onSelectMonth={setSelectedMonth}
          renderBody={(m) => (
            <>
              <p className="text-lg font-bold">{formatInt(m.revenue)} €</p>
              {m.goalAmount > 0 ? (
                <div className="space-y-1">
                  <Progress value={m.pct} className="h-1.5" />
                  <p className="text-[10px] text-muted-foreground">{m.pct}% da meta • {m.salesCount} vendas</p>
                </div>
              ) : (
                <p className="text-[10px] text-muted-foreground">{m.salesCount} vendas</p>
              )}
            </>
          )}
        />
      </div>
    </AppLayout>
  );
}
