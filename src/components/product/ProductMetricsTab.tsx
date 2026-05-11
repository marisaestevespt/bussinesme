import { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { YearSelector } from '@/components/YearSelector';
import { MonthNavHeader } from '@/components/MonthNavHeader';
import { TrendingUp, TrendingDown, Users, UserPlus, UserMinus, DollarSign, RefreshCw, Star, BarChart3, Minus, ChevronRight, Wallet, Percent } from 'lucide-react';
import { differenceInDays, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { sumRevenue } from '@/lib/salesCalculations';
import { formatInt } from '@/lib/formatting';
import { EmptyHint } from '@/components/ui/loading-skeletons';

const MONTH_NAMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

interface Props {
  productId: string;
  productName: string;
  isOwner: boolean;
}

// ─── Auto KPI card ───
function AutoKpiCard({ label, value, prevValue, icon: Icon, suffix, color }: {
  label: string; value: number | string; prevValue?: number | null; icon: any; suffix?: string; color?: string;
}) {
  const numValue = typeof value === 'number' ? value : parseFloat(value);
  const diff = prevValue != null && !isNaN(numValue) ? numValue - prevValue : null;

  return (
    <Card className="border-secondary bg-background">
      <CardContent className="p-4 flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <p className={`text-xl font-bold ${color || 'text-foreground'}`}>
            {typeof value === 'number' ? value.toLocaleString('pt-PT') : value}{suffix || ''}
          </p>
          <p className="text-xs text-muted-foreground truncate">{label}</p>
        </div>
        {diff != null && diff !== 0 && (
          <div className={cn('flex items-center gap-0.5 text-xs font-medium', diff > 0 ? 'text-success' : 'text-destructive')}>
            {diff > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {diff > 0 ? '+' : ''}{diff.toLocaleString('pt-PT')}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Goal indicator color ───
function goalColor(value: number | null, goal: number | null): string {
  if (goal == null || goal <= 0) return 'bg-muted text-muted-foreground';
  if (value == null) return 'bg-muted text-muted-foreground';
  const pct = (value / goal) * 100;
  if (pct >= 100) return 'bg-success/15 text-success dark:bg-success/20 dark:text-success';
  if (pct >= 70) return 'bg-warning/15 text-warning dark:bg-warning/20 dark:text-warning';
  return 'bg-destructive/15 text-destructive dark:bg-destructive/20 dark:text-destructive';
}

type HealthColor = 'green' | 'yellow' | 'red';

// ════════════════════════════════════════
// Month Detail View
// ════════════════════════════════════════
function MonthDetail({ productId, productName, isOwner, monthIdx, year, onBack, onChangeMonth }: Props & {
  monthIdx: number; year: number; onBack: () => void; onChangeMonth: (m: number, y: number) => void;
}) {
  const month = monthIdx + 1;
  const navigate = useNavigate();
  const qc = useQueryClient();

  // ─── Data queries ───
  const { data: salesData = [] } = useQuery({
    queryKey: ['product-metrics-sales', productId, year],
    queryFn: async () => {
      const { data } = await supabase.from('commercial_sales').select('*').eq('product_id', productId).eq('sale_year', year);
      return data || [];
    },
    enabled: !!productId,
  });

  const { data: prevYearSales = [] } = useQuery({
    queryKey: ['product-metrics-sales-prev', productId, year - 1],
    queryFn: async () => {
      const { data } = await supabase.from('commercial_sales').select('*').eq('product_id', productId).eq('sale_year', year - 1);
      return data || [];
    },
    enabled: !!productId,
  });

  const { data: clientsData = [] } = useQuery({
    queryKey: ['product-metrics-clients', productId, productName],
    queryFn: async () => {
      const query = supabase.from('clients').select('*');
      const { data } = productId
        ? await query.eq('current_product_id', productId)
        : await query.eq('current_product', productName);
      return data || [];
    },
    enabled: !!(productId || productName),
  });

  const { data: npsRecords = [] } = useQuery({
    queryKey: ['product-metrics-nps', productId, productName],
    queryFn: async () => {
      const { data } = await supabase.from('client_nps_records')
        .select('*, clients!client_nps_records_client_id_fkey(full_name, current_product, current_product_id, id)')
        .order('actual_date', { ascending: false });
      return (data || []).filter((n: any) =>
        productId ? n.clients?.current_product_id === productId : n.clients?.current_product === productName
      ) as any[];
    },
    enabled: !!(productId || productName),
  });

  const { data: milestones = [] } = useQuery({
    queryKey: ['product-metrics-milestones', productId, productName],
    queryFn: async () => {
      const { data } = await supabase.from('client_milestones')
        .select('*, clients!client_milestones_client_id_fkey(full_name, current_product, current_product_id, id)')
        .order('expected_date');
      return (data || []).filter((m: any) =>
        productId ? m.clients?.current_product_id === productId : m.clients?.current_product === productName
      ) as any[];
    },
    enabled: !!(productId || productName),
  });

  const { data: kpis = [] } = useQuery({
    queryKey: ['product-kpis', productId],
    queryFn: async () => {
      const { data } = await supabase.from('product_kpis' as any).select('*').eq('product_id', productId).eq('active', true).order('sort_order');
      return (data || []) as any[];
    },
  });

  const { data: kpiValues = [] } = useQuery({
    queryKey: ['product-kpi-values', productId, month, year],
    queryFn: async () => {
      const { data } = await supabase.from('product_kpi_values' as any).select('*').eq('product_id', productId).eq('month', month).eq('year', year);
      return (data || []) as any[];
    },
  });

  const { data: analysis } = useQuery({
    queryKey: ['product-metrics-analysis', productId, month, year],
    queryFn: async () => {
      const { data } = await supabase.from('product_metrics_analysis' as any).select('*').eq('product_id', productId).eq('month', month).eq('year', year).maybeSingle();
      return data as any;
    },
  });

  // ─── Direct costs (for liquidez calc) ───
  const { data: productCosts = [] } = useQuery({
    queryKey: ['product-metrics-costs', productId],
    queryFn: async () => {
      const { data } = await supabase.from('product_costs').select('*').eq('product_id', productId).is('scenario_id', null);
      return data || [];
    },
    enabled: !!productId,
  });

  // ─── Auto KPI calculations ───
  const monthSales = salesData.filter(s => s.sale_month === month);
  const prevMonthSales = month > 1
    ? salesData.filter(s => s.sale_month === month - 1)
    : prevYearSales.filter(s => s.sale_month === 12);

  const monthRevenue = sumRevenue(monthSales);
  const prevMonthRevenue = sumRevenue(prevMonthSales);

  const activeClients = clientsData.filter(c => c.status === 'ativo' || c.status === 'em_onboarding');
  const newClients = clientsData.filter(c => {
    if (!c.start_date) return false;
    const d = new Date(c.start_date);
    return d.getMonth() + 1 === month && d.getFullYear() === year;
  });
  const prevNewClients = clientsData.filter(c => {
    if (!c.start_date) return false;
    const d = new Date(c.start_date);
    if (month > 1) return d.getMonth() + 1 === month - 1 && d.getFullYear() === year;
    return d.getMonth() + 1 === 12 && d.getFullYear() === year - 1;
  });

  const churnClients = clientsData.filter(c => {
    if (!c.updated_at || c.status !== 'terminado') return false;
    const d = new Date(c.updated_at);
    return d.getMonth() + 1 === month && d.getFullYear() === year;
  });

  const renewalClients = clientsData.filter(c => {
    if (!c.updated_at) return false;
    const d = new Date(c.updated_at);
    return d.getMonth() + 1 === month && d.getFullYear() === year;
  });
  const renewedCount = renewalClients.filter(c => c.status === 'ativo').length;
  const renewalBase = renewalClients.filter(c => ['ativo', 'altura_renovacao', 'terminado'].includes(c.status)).length;
  const renewalRate = renewalBase > 0 ? Math.round((renewedCount / renewalBase) * 100) : 0;

  const ticketMedio = monthSales.length > 0 ? Math.round(monthRevenue / monthSales.length) : 0;
  const prevTicketMedio = prevMonthSales.length > 0 ? Math.round(prevMonthRevenue / prevMonthSales.length) : null;

  const yearRevenue = sumRevenue(salesData);

  // ─── Liquidez: custo direto mensal e YTD ───
  const monthlyCostFor = useCallback((salesCount: number) => {
    let total = 0;
    for (const c of productCosts as any[]) {
      const v = Number(c.cost_value || 0);
      if (c.cost_type === 'recorrente') {
        if (c.recurrence === 'anual') total += v / 12;
        else total += v; // mensal (default)
      } else if (c.cost_type === 'por_venda') {
        total += v * salesCount;
      } else if (c.cost_type === 'horas') {
        const h = Number(c.hours || 0);
        const rate = Number(c.hourly_rate || 0);
        // tratamos como custo recorrente mensal (horas alocadas/mês)
        total += h * rate;
      }
      // one_off: não entra no custo mensal recorrente
    }
    return total;
  }, [productCosts]);

  const monthDirectCost = monthlyCostFor(monthSales.length);
  const monthGrossMargin = monthRevenue - monthDirectCost;
  const monthMarginPct = monthRevenue > 0 ? (monthGrossMargin / monthRevenue) * 100 : null;

  // YTD: soma de custos mensais até ao mês atual + custos por_venda × vendas YTD
  const ytdSalesCount = salesData.filter(s => (s.sale_month ?? 0) <= month).length;
  let ytdDirectCost = 0;
  for (const c of productCosts as any[]) {
    const v = Number(c.cost_value || 0);
    if (c.cost_type === 'recorrente') {
      ytdDirectCost += (c.recurrence === 'anual' ? v / 12 : v) * month;
    } else if (c.cost_type === 'por_venda') {
      ytdDirectCost += v * ytdSalesCount;
    } else if (c.cost_type === 'horas') {
      ytdDirectCost += Number(c.hours || 0) * Number(c.hourly_rate || 0) * month;
    }
  }
  const ytdRevenue = sumRevenue(salesData.filter(s => (s.sale_month ?? 0) <= month));
  const ytdGrossMargin = ytdRevenue - ytdDirectCost;
  const ytdMarginPct = ytdRevenue > 0 ? (ytdGrossMargin / ytdRevenue) * 100 : null;

  // NPS - latest per client (not filtered by month)
  const latestNpsByClient = useMemo(() => {
    const map = new Map<string, number>();
    for (const nps of npsRecords) {
      if (nps.nps_score != null && nps.clients?.id && !map.has(nps.clients.id)) {
        map.set(nps.clients.id, nps.nps_score);
      }
    }
    return map;
  }, [npsRecords]);

  const activeClientIds = new Set(activeClients.map(c => c.id));
  const activeNpsScores = useMemo(() => {
    const scores: number[] = [];
    latestNpsByClient.forEach((score, clientId) => {
      if (activeClientIds.has(clientId)) scores.push(score);
    });
    return scores;
  }, [latestNpsByClient, activeClientIds]);

  const avgNps = activeNpsScores.length > 0
    ? (activeNpsScores.reduce((a, b) => a + b, 0) / activeNpsScores.length).toFixed(1)
    : '—';

  // ─── Auto source value resolver for custom KPIs ───
  const getAutoValue = (autoSource: string): number | null => {
    switch (autoSource) {
      case 'vendas_count': return monthSales.length;
      case 'vendas_valor': return monthRevenue;
      case 'novos_clientes': return newClients.length;
      case 'clientes_ativos': return activeClients.length;
      case 'churn': return churnClients.length;
      case 'taxa_renovacao': return renewalRate;
      case 'nps_medio': return activeNpsScores.length > 0 ? parseFloat(avgNps) : null;
      case 'ticket_medio': return ticketMedio;
      default: return null;
    }
  };

  // ─── KPI values state for manual inputs ───
  const [manualValues, setManualValues] = useState<Record<string, string>>({});
  useEffect(() => {
    const map: Record<string, string> = {};
    kpiValues.forEach((v: any) => {
      map[v.kpi_id] = v.value != null ? String(v.value) : '';
    });
    setManualValues(map);
  }, [kpiValues]);

  const saveKpiValue = useCallback(async (kpiId: string) => {
    const rawValue = manualValues[kpiId];
    const numValue = rawValue ? Number(rawValue) : null;
    const existing = kpiValues.find((v: any) => v.kpi_id === kpiId);
    if (existing) {
      await supabase.from('product_kpi_values' as any).update({ value: numValue }).eq('id', existing.id);
    } else {
      await supabase.from('product_kpi_values' as any).insert({
        product_id: productId, kpi_id: kpiId, month, year, value: numValue,
      });
    }
    qc.invalidateQueries({ queryKey: ['product-kpi-values', productId, month, year] });
  }, [manualValues, kpiValues, productId, month, year, qc]);

  // ─── Qualitative analysis ───
  const [qualData, setQualData] = useState<Record<string, string>>({});
  useEffect(() => {
    if (analysis) {
      setQualData({
        what_went_well: analysis.what_went_well || '',
        what_went_wrong: analysis.what_went_wrong || '',
        notes: analysis.notes || '',
      });
    } else {
      setQualData({ what_went_well: '', what_went_wrong: '', notes: '' });
    }
  }, [analysis]);

  const saveQualField = useCallback(async (field: string) => {
    const value = qualData[field] ?? '';
    if (analysis?.id) {
      await supabase.from('product_metrics_analysis' as any).update({ [field]: value || null }).eq('id', analysis.id);
    } else {
      await supabase.from('product_metrics_analysis' as any).insert({ product_id: productId, month, year, [field]: value || null });
    }
    qc.invalidateQueries({ queryKey: ['product-metrics-analysis', productId, month, year] });
  }, [qualData, analysis, productId, month, year, qc]);

  // ─── Client health ───
  const today = new Date();
  const healthList = useMemo(() => {
    return activeClients.map(c => {
      const clientNps = latestNpsByClient.get(c.id);
      const lastNpsDate = npsRecords.find(n => n.clients?.id === c.id && n.nps_score != null)?.actual_date;
      const daysSinceNps = lastNpsDate ? differenceInDays(today, parseISO(lastNpsDate)) : 999;
      const overdueMilestones = milestones.filter(m => m.client_id === c.id && m.status !== 'concluido' && m.expected_date && parseISO(m.expected_date) < today);
      const endCycleDays = c.end_of_cycle ? differenceInDays(parseISO(c.end_of_cycle), today) : 999;

      let color: HealthColor = 'green';
      if (endCycleDays <= 30 || (clientNps != null && clientNps <= 6)) color = 'red';
      else if (daysSinceNps > 90 || overdueMilestones.length > 0) color = 'yellow';

      return { client: c, color, endCycleDays, lastNps: clientNps ?? null, lastNpsDate };
    }).sort((a, b) => {
      const order: Record<HealthColor, number> = { red: 0, yellow: 1, green: 2 };
      return order[a.color] - order[b.color];
    });
  }, [activeClients, latestNpsByClient, npsRecords, milestones, today]);

  const HEALTH_STYLES: Record<HealthColor, string> = {
    green: 'bg-success',
    yellow: 'bg-warning',
    red: 'bg-destructive',
  };
  return (
    <div className="space-y-8">
      <MonthNavHeader monthIdx={monthIdx} year={year} onBack={onBack} onChangeMonth={onChangeMonth} />

      {/* ─── Auto KPI cards ─── */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">KPIs Base</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <AutoKpiCard label="Vendas do mês" value={monthSales.length} prevValue={prevMonthSales.length} icon={BarChart3} />
          <AutoKpiCard label="Faturação do mês" value={`${formatInt(monthRevenue)} €`} prevValue={prevMonthRevenue} icon={DollarSign} />
          <AutoKpiCard label="Novos clientes" value={newClients.length} prevValue={prevNewClients.length} icon={UserPlus} />
          <AutoKpiCard label="Clientes ativos" value={activeClients.length} icon={Users} />
          <AutoKpiCard label="Churn" value={churnClients.length} icon={UserMinus} color={churnClients.length > 0 ? 'text-destructive' : undefined} />
          <AutoKpiCard label="Taxa de renovação" value={`${renewalRate}%`} icon={RefreshCw} />
          <AutoKpiCard label="NPS médio atual" value={avgNps} icon={Star} />
          <AutoKpiCard label="Ticket médio" value={`${formatInt(ticketMedio)} €`} prevValue={prevTicketMedio} icon={DollarSign} />
        </div>
        <div className="mt-3">
          <AutoKpiCard label="Receita acumulada do ano" value={`${formatInt(yearRevenue)} €`} icon={TrendingUp} />
        </div>
      </div>

      {/* ─── Liquidez (Receita − Custos diretos) ─── */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-1">Liquidez do produto</h3>
        <p className="text-xs text-muted-foreground mb-3">
          Margem bruta = receita − custos diretos do produto (recorrentes, por venda e horas alocadas). Custos one-off não entram.
          {productCosts.length === 0 && ' Adiciona custos em "Contabilidade & Pricing → Custos & Margens" para ativar.'}
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <AutoKpiCard label="Custos diretos do mês" value={`${formatInt(monthDirectCost)} €`} icon={Wallet} />
          <AutoKpiCard
            label="Margem bruta do mês"
            value={`${formatInt(monthGrossMargin)} €`}
            icon={DollarSign}
            color={monthGrossMargin >= 0 ? 'text-success' : 'text-destructive'}
          />
          <AutoKpiCard
            label="Margem % do mês"
            value={monthMarginPct != null ? `${monthMarginPct.toFixed(1)}%` : '—'}
            icon={Percent}
            color={monthMarginPct != null && monthMarginPct >= 0 ? 'text-success' : 'text-destructive'}
          />
          <AutoKpiCard
            label="Margem bruta YTD"
            value={`${formatInt(ytdGrossMargin)} € ${ytdMarginPct != null ? `(${ytdMarginPct.toFixed(0)}%)` : ''}`}
            icon={TrendingUp}
            color={ytdGrossMargin >= 0 ? 'text-success' : 'text-destructive'}
          />
        </div>
      </div>

      {/* ─── Custom KPIs ─── */}
      {kpis.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">KPIs Personalizados</h3>
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left p-3 font-medium text-muted-foreground">KPI</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">Meta</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">Valor</th>
                    <th className="text-center p-3 font-medium text-muted-foreground w-16">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {kpis.map((kpi: any) => {
                    const isAuto = kpi.source === 'automatico';
                    const autoVal = isAuto ? getAutoValue(kpi.auto_source) : null;
                    const manualVal = manualValues[kpi.id];
                    const displayValue = isAuto ? autoVal : (manualVal ? Number(manualVal) : null);
                    const goalVal = kpi.monthly_goal != null ? Number(kpi.monthly_goal) : null;

                    return (
                      <tr key={kpi.id} className="border-b last:border-0">
                        <td className="p-3 font-medium text-foreground">{kpi.name}</td>
                        <td className="p-3 text-right text-muted-foreground">
                          {goalVal != null ? (
                            kpi.kpi_type === 'monetario' ? `${formatInt(goalVal)} €` : kpi.kpi_type === 'percentagem' ? `${goalVal}%` : formatInt(goalVal)
                          ) : '—'}
                        </td>
                        <td className="p-3 text-right">
                          {isAuto ? (
                            <span className="font-medium">
                              {autoVal != null ? (
                                kpi.kpi_type === 'monetario' ? `${formatInt(autoVal)} €` : kpi.kpi_type === 'percentagem' ? `${autoVal}%` : formatInt(autoVal)
                              ) : '—'}
                            </span>
                          ) : (
                            <Input
                              type="number"
                              className="h-8 w-24 text-right ml-auto"
                              value={manualVal || ''}
                              onChange={e => setManualValues(prev => ({ ...prev, [kpi.id]: e.target.value }))}
                              onBlur={() => saveKpiValue(kpi.id)}
                              placeholder="—"
                            />
                          )}
                        </td>
                        <td className="p-3 text-center">
                          <div className={cn('inline-block h-3 w-3 rounded-full', goalColor(displayValue, goalVal))} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      <Separator />

      {/* ─── Client Health ─── */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Saúde dos Clientes — {productName}</h3>
        <Card>
          <CardContent className="p-0">
            <div className="bg-muted px-4 py-2 text-xs font-medium grid grid-cols-5 gap-2">
              <span>Cliente</span><span>Status</span><span>Fim de Ciclo</span><span>Último NPS</span><span>Saúde</span>
            </div>
            {healthList.length === 0 ? (
              <EmptyHint>Nenhum cliente ativo com este produto.</EmptyHint>
            ) : healthList.map(({ client: c, color, lastNps }) => (
              <div
                key={c.id}
                className="px-4 py-2.5 text-sm grid grid-cols-5 gap-2 border-b hover:bg-muted/50 cursor-pointer items-center"
                onClick={() => navigate(`/hub/clientes/${c.id}`)}
              >
                <span className="truncate font-medium">{c.full_name}</span>
                <span className="text-muted-foreground capitalize">{c.status?.replace(/_/g, ' ')}</span>
                <span className="text-muted-foreground">{c.end_of_cycle ? new Date(c.end_of_cycle).toLocaleDateString('pt-PT') : '—'}</span>
                <span className="text-muted-foreground">{lastNps != null ? lastNps : '—'}</span>
                <span><div className={cn('h-3 w-3 rounded-full', HEALTH_STYLES[color])} /></span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* ─── Qualitative ─── */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Análise Qualitativa</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {([
            { key: 'what_went_well', label: 'O que correu bem' },
            { key: 'what_went_wrong', label: 'O que correu mal' },
            { key: 'notes', label: 'Notas livres' },
          ] as const).map(f => (
            <div key={f.key} className="space-y-1">
              <label className="text-sm font-medium">{f.label}</label>
              <Textarea
                className="min-h-[100px]"
                value={qualData[f.key] || ''}
                onChange={e => setQualData(prev => ({ ...prev, [f.key]: e.target.value }))}
                onBlur={() => saveQualField(f.key)}
                placeholder={f.label}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════
// Gallery (main export)
// ════════════════════════════════════════
export function ProductMetricsTab({ productId, productName, isOwner }: Props) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);

  // Sales for gallery summary + annual
  const { data: salesData = [] } = useQuery({
    queryKey: ['product-metrics-sales', productId, year],
    queryFn: async () => {
      const { data } = await supabase.from('commercial_sales').select('*').eq('product_id', productId).eq('sale_year', year);
      return data || [];
    },
    enabled: !!productId,
  });

  const { data: clientsData = [] } = useQuery({
    queryKey: ['product-metrics-clients-annual', productId, productName],
    queryFn: async () => {
      const query = supabase.from('clients').select('*');
      const { data } = productId
        ? await query.eq('current_product_id', productId)
        : await query.eq('current_product', productName);
      return data || [];
    },
    enabled: !!(productId || productName),
  });

  const { data: npsRecords = [] } = useQuery({
    queryKey: ['product-metrics-nps-annual', productId, productName],
    queryFn: async () => {
      const { data } = await supabase.from('client_nps_records')
        .select('*, clients!client_nps_records_client_id_fkey(full_name, current_product, current_product_id, id)')
        .order('actual_date', { ascending: false });
      return (data || []).filter((n: any) =>
        productId ? n.clients?.current_product_id === productId : n.clients?.current_product === productName
      ) as any[];
    },
    enabled: !!(productId || productName),
  });

  // KPIs + values for annual
  const { data: kpis = [] } = useQuery({
    queryKey: ['product-kpis', productId],
    queryFn: async () => {
      const { data } = await supabase.from('product_kpis' as any).select('*').eq('product_id', productId).eq('active', true).order('sort_order');
      return (data || []) as any[];
    },
  });

  const { data: allKpiValues = [] } = useQuery({
    queryKey: ['product-kpi-values-year', productId, year],
    queryFn: async () => {
      const { data } = await supabase.from('product_kpi_values' as any).select('*').eq('product_id', productId).eq('year', year);
      return (data || []) as any[];
    },
  });

  // ─── Annual summary ───
  const annualSummary = useMemo(() => {
    const totalRevenue = sumRevenue(salesData);
    const totalSales = salesData.length;
    const ticketMedio = totalSales > 0 ? Math.round(totalRevenue / totalSales) : 0;

    const newClients = clientsData.filter(c => {
      if (!c.start_date) return false;
      return new Date(c.start_date).getFullYear() === year;
    }).length;

    const churn = clientsData.filter(c => {
      if (!c.updated_at || c.status !== 'terminado') return false;
      return new Date(c.updated_at).getFullYear() === year;
    }).length;

    const renewalClients = clientsData.filter(c => {
      if (!c.updated_at) return false;
      return new Date(c.updated_at).getFullYear() === year;
    });
    const renewed = renewalClients.filter(c => c.status === 'ativo').length;
    const renewalBase = renewalClients.filter(c => ['ativo', 'altura_renovacao', 'terminado'].includes(c.status)).length;
    const renewalRate = renewalBase > 0 ? Math.round((renewed / renewalBase) * 100) : 0;

    // NPS
    const activeClients = clientsData.filter(c => c.status === 'ativo' || c.status === 'em_onboarding');
    const activeIds = new Set(activeClients.map(c => c.id));
    const npsMap = new Map<string, number>();
    for (const n of npsRecords) {
      if (n.nps_score != null && n.clients?.id && !npsMap.has(n.clients.id) && activeIds.has(n.clients.id)) {
        npsMap.set(n.clients.id, n.nps_score);
      }
    }
    const npsScores = Array.from(npsMap.values());
    const avgNps = npsScores.length > 0 ? (npsScores.reduce((a, b) => a + b, 0) / npsScores.length).toFixed(1) : '—';

    // Custom KPI annual aggregation
    const kpiAnnual = kpis.map((kpi: any) => {
      const vals = allKpiValues.filter((v: any) => v.kpi_id === kpi.id && v.value != null).map((v: any) => Number(v.value));
      let annualValue: number | null = null;
      if (vals.length > 0) {
        annualValue = kpi.kpi_type === 'percentagem'
          ? parseFloat((vals.reduce((a: number, b: number) => a + b, 0) / vals.length).toFixed(1))
          : vals.reduce((a: number, b: number) => a + b, 0);
      }
      const annualGoal = kpi.monthly_goal != null
        ? kpi.kpi_type === 'percentagem' ? Number(kpi.monthly_goal) : Number(kpi.monthly_goal) * 12
        : null;
      return { name: kpi.name, kpiType: kpi.kpi_type, value: annualValue, goal: annualGoal };
    });

    return { totalRevenue, totalSales, ticketMedio, newClients, churn, renewalRate, avgNps, kpiAnnual };
  }, [salesData, clientsData, year, npsRecords, kpis, allKpiValues]);

  const monthSummaries = useMemo(() => {
    return MONTH_NAMES.map((name, idx) => {
      const m = idx + 1;
      const mSales = salesData.filter(s => s.sale_month === m);
      const revenue = sumRevenue(mSales);
      return { name, revenue, salesCount: mSales.length };
    });
  }, [salesData]);
  const fmtEur = (n: number) => `${formatInt(n)} €`;

  if (selectedMonth !== null) {
    return (
      <MonthDetail
        productId={productId}
        productName={productName}
        isOwner={isOwner}
        monthIdx={selectedMonth}
        year={year}
        onBack={() => setSelectedMonth(null)}
        onChangeMonth={(m, y) => { setSelectedMonth(m); setYear(y); }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <YearSelector year={year} onChange={setYear} />

      {/* ─── Annual Summary ─── */}
      <div className="space-y-4">
        <h3 className="text-base font-semibold">Resumo {year}</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <AutoKpiCard label="Receita total" value={fmtEur(annualSummary.totalRevenue)} icon={DollarSign} />
          <AutoKpiCard label="Total de vendas" value={annualSummary.totalSales} icon={BarChart3} />
          <AutoKpiCard label="Ticket médio anual" value={fmtEur(annualSummary.ticketMedio)} icon={DollarSign} />
          <AutoKpiCard label="Novos clientes" value={annualSummary.newClients} icon={UserPlus} />
          <AutoKpiCard label="Churn total" value={annualSummary.churn} icon={UserMinus} color={annualSummary.churn > 0 ? 'text-destructive' : undefined} />
          <AutoKpiCard label="Taxa de renovação" value={`${annualSummary.renewalRate}%`} icon={RefreshCw} />
          <AutoKpiCard label="NPS médio atual" value={annualSummary.avgNps} icon={Star} />
        </div>

        {/* Custom KPI annual */}
        {annualSummary.kpiAnnual.length > 0 && (
          <Card>
            <CardHeader className="pb-2 pt-4 px-4"><CardTitle className="text-sm font-semibold">KPIs Personalizados — Anual</CardTitle></CardHeader>
            <CardContent className="px-4 pb-4 space-y-2">
              {annualSummary.kpiAnnual.map((k, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{k.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">
                      {k.value != null ? (
                        k.kpiType === 'monetario' ? fmtEur(k.value) : k.kpiType === 'percentagem' ? `${k.value}%` : formatInt(k.value)
                      ) : '—'}
                    </span>
                    {k.goal != null && (
                      <span className="text-xs text-muted-foreground">/ {k.kpiType === 'monetario' ? fmtEur(k.goal) : k.kpiType === 'percentagem' ? `${k.goal}%` : formatInt(k.goal)}</span>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      <Separator />

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {monthSummaries.map((m, idx) => {
          const isCurrent = now.getMonth() === idx && now.getFullYear() === year;
          return (
            <Card
              key={idx}
              className={cn(
                'cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group',
                isCurrent && 'ring-2 ring-primary'
              )}
              onClick={() => setSelectedMonth(idx)}
            >
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm">{m.name}</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <p className="text-lg font-bold">{formatInt(m.revenue)} €</p>
                <p className="text-[10px] text-muted-foreground">{m.salesCount} vendas</p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
