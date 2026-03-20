import { useState, useMemo, useCallback, useEffect } from 'react';
import { YearSelector } from '@/components/YearSelector';
import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { BackNavigation } from '@/components/BackNavigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ChevronLeft, ChevronRight, Users, Phone, CalendarCheck, FileText, TrendingUp, Clock, UserMinus, DollarSign, UserPlus, RefreshCw, AlertTriangle, ArrowLeft } from 'lucide-react';
import { MonthNavHeader } from '@/components/MonthNavHeader';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCrmData } from '@/hooks/useCrmData';
import { useCommercialData } from '@/hooks/useCommercialData';
import { useClients } from '@/hooks/useClients';
import { differenceInDays, parseISO, endOfMonth, format } from 'date-fns';
import { cn } from '@/lib/utils';

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

  const { allLeads } = useCrmData();
  const { sales: salesQ, annualGoalAmount, totalInvoiced, monthlyGoals } = useCommercialData(year);
  const { clients: clientsQ } = useClients();

  const leads = allLeads || [];
  const salesData = salesQ.data || [];
  const clientsData = clientsQ.data || [];

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
  const monthRevenue = monthSales.reduce((s, v) => s + Number(v.invoice_total || 0), 0);
  const monthlyGoalAmount = (monthlyGoals.data || []).find(g => g.month === month)?.goal_amount || 0;
  const monthProgressPct = monthlyGoalAmount > 0 ? Math.min((monthRevenue / monthlyGoalAmount) * 100, 100) : 0;
  const yearProgressPct = annualGoalAmount > 0 ? Math.min((totalInvoiced / annualGoalAmount) * 100, 100) : 0;
  const ticketMedio = monthSales.length > 0 ? Math.round(monthRevenue / monthSales.length) : 0;
  const pipelineValue = useMemo(() =>
    leads.filter(l => l.status !== 'ganho' && l.status !== 'perdido').reduce((s, l) => s + Number(l.estimated_value || 0), 0),
    [leads]
  );
  const revenueByProduct = useMemo(() => {
    const map: Record<string, number> = {};
    monthSales.forEach(s => { const p = s.product || 'Sem produto'; map[p] = (map[p] || 0) + Number(s.invoice_total || 0); });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [monthSales]);

  // ─── Client KPIs ───
  const newClientsMonth = clientsData.filter(c => {
    if (!c.start_date) return false;
    const d = new Date(c.start_date);
    return d.getMonth() + 1 === month && d.getFullYear() === year;
  }).length;
  const clientsRenewal = clientsData.filter(c => c.status === 'altura_renovacao').length;
  const churnMonth = renewalClients.filter(c => c.status === 'terminado').length;

  const fmt = (n: number) => n.toLocaleString('pt-PT', { maximumFractionDigits: 0 });
  const fmtEur = (n: number) => `${fmt(n)} €`;

  return (
    <div className="space-y-6">
      <MonthNavHeader monthIdx={monthIdx} year={year} onBack={onBack} onChangeMonth={onChangeMonth} />

      {/* CRM Operational */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">KPIs Operacionais do CRM</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiCard label="Leads novas" value={monthLeads.length} icon={Users} />
          <KpiCard label="Follow-ups feitos" value={followUpsDone} icon={Phone} />
          <KpiCard label="Contactos realizados" value={contactedLeads} icon={Phone} />
          <KpiCard label="Sessões agendadas" value={sessionsScheduled} icon={CalendarCheck} />
          <KpiCard label="Propostas enviadas" value={proposalsSent} icon={FileText} />
          <KpiCard label="Taxa de resposta" value={`${responseRate}%`} icon={TrendingUp} />
        </div>
      </div>

      {/* Conversion */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">KPIs de Conversão</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard label="Taxa de conversão global" value={`${conversionRate}%`} icon={TrendingUp} />
          <KpiCard label="Tempo médio no pipeline" value={avgPipelineDays !== null ? `${avgPipelineDays} dias` : '—'} icon={Clock} />
          <KpiCard label="Leads perdidas" value={lossesInMonth.length} icon={UserMinus} color={lossesInMonth.length > 0 ? 'text-destructive' : undefined} />
          <KpiCard label="Taxa de renovação" value={`${renewalRate}%`} icon={RefreshCw} />
        </div>
      </div>

      {/* Financial */}
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
          <KpiCard label="Ticket médio" value={fmtEur(ticketMedio)} icon={DollarSign} />
          <KpiCard label="Pipeline activo" value={fmtEur(pipelineValue)} icon={TrendingUp} />
        </div>
        {revenueByProduct.length > 0 && (
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

      {/* Clients */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">KPIs de Clientes</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <KpiCard label="Novos clientes" value={newClientsMonth} icon={UserPlus} />
          <KpiCard label="Em renovação" value={clientsRenewal} icon={RefreshCw} />
          <KpiCard label="Renovações confirmadas" value={renewedCount} icon={RefreshCw} color="text-emerald-600" />
          <KpiCard label="Renovações perdidas" value={churnMonth} icon={UserMinus} color={churnMonth > 0 ? 'text-destructive' : undefined} />
          <KpiCard label="Churn do mês" value={churnMonth} icon={AlertTriangle} color={churnMonth > 0 ? 'text-destructive' : undefined} />
        </div>
      </div>

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

  const { sales: salesQ, monthlyGoals } = useCommercialData(year);
  const salesData = salesQ.data || [];

  // Summary per month for gallery cards
  const monthSummaries = useMemo(() => {
    return MONTH_NAMES.map((name, idx) => {
      const m = idx + 1;
      const mSales = salesData.filter(s => s.sale_month === m);
      const revenue = mSales.reduce((s, v) => s + Number(v.invoice_total || 0), 0);
      const goalAmount = (monthlyGoals.data || []).find(g => g.month === m)?.goal_amount || 0;
      const pct = goalAmount > 0 ? Math.min(Math.round((revenue / goalAmount) * 100), 100) : 0;
      return { name, revenue, goalAmount, pct, salesCount: mSales.length };
    });
  }, [salesData, monthlyGoals.data]);

  const fmt = (n: number) => n.toLocaleString('pt-PT', { maximumFractionDigits: 0 });

  if (selectedMonth !== null) {
    return (
      <AppLayout>
        <div className="p-6 space-y-6">
          <BackNavigation parentRoute="/hub/comercial" parentLabel="Comercial" />
          <PageHeader title="Análise Comercial" subtitle="Análise mensal do desempenho comercial." />
          <MonthDetail monthIdx={selectedMonth} year={year} onBack={() => setSelectedMonth(null)} onChangeMonth={(m, y) => { setSelectedMonth(m); setYear(y); }} />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <BackNavigation parentRoute="/hub/comercial" parentLabel="Comercial" />
        <PageHeader title="Análise Comercial" subtitle="Análise mensal do desempenho comercial." />

        {/* Year selector */}
        <div className="flex items-center justify-center gap-4">
          <Button variant="outline" size="icon" onClick={() => setYear(y => y - 1)}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="text-lg font-semibold">{year}</span>
          <Button variant="outline" size="icon" onClick={() => setYear(y => y + 1)}><ChevronRight className="h-4 w-4" /></Button>
        </div>

        {/* Month gallery */}
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
                  <p className="text-lg font-bold">{fmt(m.revenue)} €</p>
                  {m.goalAmount > 0 ? (
                    <div className="space-y-1">
                      <Progress value={m.pct} className="h-1.5" />
                      <p className="text-[10px] text-muted-foreground">{m.pct}% da meta • {m.salesCount} vendas</p>
                    </div>
                  ) : (
                    <p className="text-[10px] text-muted-foreground">{m.salesCount} vendas</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}
