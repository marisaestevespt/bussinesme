import { useState, useMemo, useCallback, useEffect } from 'react';
import { useKpiSettings } from '@/hooks/useKpiSettings';
import { YearSelector } from '@/components/YearSelector';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { BackNavigation } from '@/components/BackNavigation';
import { MonthCardsGallery } from '@/components/analysis/MonthCardsGallery';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ChevronLeft, ChevronRight, Users, UserPlus, UserMinus, Package, DollarSign, RefreshCw, Target, Star, ArrowLeft } from 'lucide-react';
import { MonthNavHeader } from '@/components/MonthNavHeader';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useClients } from '@/hooks/useClients';
import { useCommercialData } from '@/hooks/useCommercialData';
import { differenceInDays, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { sumRevenue } from '@/lib/salesCalculations';
import { isDeliverableDone } from '@/lib/projectProgress';
import { formatInt } from '@/lib/formatting';
import { useSectorConfig } from '@/hooks/useSectorConfig';
import { EmptyHint } from '@/components/ui/loading-skeletons';
import { StatCard } from '@/components/editorial';

const MONTH_NAMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

function KpiCard({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: any; color?: string }) {
  // Map legacy color prop to StatCard tone
  const tone = color?.includes('destructive') ? 'destructive'
    : color?.includes('success') ? 'success'
    : color?.includes('warning') ? 'warning'
    : 'primary';
  return (
    <StatCard
      tone={tone}
      size="sm"
      value={value}
      label={<><Icon className="h-3 w-3 inline mr-1.5 -mt-0.5" />{label}</>}
    />
  );
}

type HealthColor = 'green' | 'yellow' | 'red';

const HEALTH_STYLES: Record<HealthColor, string> = {
  green: 'bg-success',
  yellow: 'bg-warning',
  red: 'bg-destructive',
};

const STATUS_LABEL: Record<string, string> = {
  em_onboarding: 'Onboarding',
  ativo: 'Ativo',
  pausado: 'Pausado',
  altura_renovacao: 'Renovação',
  terminado: 'Terminado',
};

function MonthDetail({ monthIdx, year, onBack, onChangeMonth }: { monthIdx: number; year: number; onBack: () => void; onChangeMonth: (m: number, y: number) => void }) {
  const month = monthIdx + 1;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isKpiEnabled, isAreaEnabled } = useKpiSettings();

  const { clients: clientsQ } = useClients();
  const clientsData = clientsQ.data || [];
  const { sales: salesQ } = useCommercialData(year);
  const salesData = salesQ.data || [];

  // NPS records
  const npsQ = useQuery({
    queryKey: ['client_nps_all'],
    queryFn: async () => {
      const { data } = await supabase.from('client_nps_records').select('*').order('actual_date', { ascending: false });
      return data || [];
    },
  });
  const allNps = npsQ.data || [];

  // Milestones
  const milestonesQ = useQuery({
    queryKey: ['client_milestones_all'],
    queryFn: async () => {
      const { data } = await supabase.from('client_milestones').select('*');
      return data || [];
    },
  });
  const allMilestones = milestonesQ.data || [];

  // Qualitative
  const analysisQ = useQuery({
    queryKey: ['clients_analysis', month, year],
    queryFn: async () => {
      const { data } = await (supabase.from('clients_monthly_analysis' as any) as any)
        .select('*').eq('month', month).eq('year', year).maybeSingle();
      return data as any;
    },
  });

  const [qualData, setQualData] = useState<Record<string, string>>({});
  useEffect(() => {
    if (analysisQ.data) {
      setQualData({
        portfolio_notes: analysisQ.data.portfolio_notes || '',
        what_went_well: analysisQ.data.what_went_well || '',
        what_went_wrong: analysisQ.data.what_went_wrong || '',
      });
    } else {
      setQualData({ portfolio_notes: '', what_went_well: '', what_went_wrong: '' });
    }
  }, [analysisQ.data]);

  const saveField = useCallback(async (field: string) => {
    const value = qualData[field] ?? '';
    const existing = analysisQ.data;
    if (existing?.id) {
      await (supabase.from('clients_monthly_analysis' as any) as any).update({ [field]: value || null }).eq('id', existing.id);
    } else {
      await (supabase.from('clients_monthly_analysis' as any) as any).insert({ month, year, [field]: value || null });
    }
    qc.invalidateQueries({ queryKey: ['clients_analysis', month, year] });
  }, [qualData, analysisQ.data, month, year, qc]);

  // ─── KPIs ───
  const activeClients = clientsData.filter(c => c.status === 'ativo' || c.status === 'em_onboarding');
  const newClients = clientsData.filter(c => {
    if (!c.start_date) return false;
    const d = new Date(c.start_date);
    return d.getMonth() + 1 === month && d.getFullYear() === year;
  });

  const churnClients = clientsData.filter(c => {
    if (!c.updated_at || c.status !== 'terminado' || c.is_legacy) return false;
    const d = new Date(c.updated_at);
    return d.getMonth() + 1 === month && d.getFullYear() === year;
  });

  const onboardingClients = clientsData.filter(c => c.status === 'em_onboarding');

  const monthSales = salesData.filter(s => s.sale_month === month);
  const monthRevenue = sumRevenue(monthSales);
  const avgValuePerClient = activeClients.length > 0 ? Math.round(monthRevenue / activeClients.length) : 0;

  const renewalClients = clientsData.filter(c => {
    if (!c.updated_at) return false;
    const d = new Date(c.updated_at);
    return d.getMonth() + 1 === month && d.getFullYear() === year;
  });
  const renewedCount = renewalClients.filter(c => c.status === 'ativo').length;
  const renewalBase = renewalClients.filter(c => c.status === 'ativo' || c.status === 'altura_renovacao' || c.status === 'terminado').length;
  const renewalRate = renewalBase > 0 ? Math.round((renewedCount / renewalBase) * 100) : 0;

  // Milestones in month
  const monthMilestonesExpected = allMilestones.filter(m => {
    if (!m.expected_date) return false;
    const d = new Date(m.expected_date);
    return d.getMonth() + 1 === month && d.getFullYear() === year;
  });
  const monthMilestonesDone = monthMilestonesExpected.filter(isDeliverableDone);

  // ─── NPS (global, not filtered by month) ───
  const latestNpsByClient = useMemo(() => {
    const map = new Map<string, number>();
    // allNps already sorted by actual_date desc
    for (const nps of allNps) {
      if (nps.nps_score != null && !map.has(nps.client_id)) {
        map.set(nps.client_id, nps.nps_score);
      }
    }
    return map;
  }, [allNps]);

  const activeClientIds = new Set(activeClients.map(c => c.id));
  const activeNps = useMemo(() => {
    const entries: number[] = [];
    latestNpsByClient.forEach((score, clientId) => {
      if (activeClientIds.has(clientId)) entries.push(score);
    });
    return entries;
  }, [latestNpsByClient, activeClientIds]);

  const avgNps = activeNps.length > 0 ? (activeNps.reduce((a, b) => a + b, 0) / activeNps.length).toFixed(1) : '—';
  const promoters = activeNps.filter(s => s >= 9).length;
  const passives = activeNps.filter(s => s >= 7 && s <= 8).length;
  const detractors = activeNps.filter(s => s <= 6).length;

  // ─── Distribution by product ───
  const byProduct = useMemo(() => {
    const map: Record<string, number> = {};
    activeClients.forEach(c => {
      const p = c.current_product || 'Sem produto';
      map[p] = (map[p] || 0) + 1;
    });
    return Object.entries(map).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  }, [activeClients]);

  // ─── Health semaphore ───
  const today = new Date();
  const healthList = useMemo(() => {
    return activeClients.map(c => {
      const clientNps = latestNpsByClient.get(c.id);
      const lastNpsDate = allNps.find(n => n.client_id === c.id && n.nps_score != null)?.actual_date;
      const daysSinceNps = lastNpsDate ? differenceInDays(today, parseISO(lastNpsDate)) : null;
      const overdueMilestones = allMilestones.filter(m => m.client_id === c.id && m.status !== 'concluido' && m.expected_date && parseISO(m.expected_date) < today);
      const endCycleDays = c.end_of_cycle ? differenceInDays(parseISO(c.end_of_cycle), today) : null;

      let color: HealthColor = 'green';
      const reasons: string[] = [];
      if (clientNps != null && clientNps <= 6) {
        color = 'red';
        reasons.push(`NPS detrator (${clientNps})`);
      } else if ((daysSinceNps != null && daysSinceNps > 90) || overdueMilestones.length > 0 || (endCycleDays != null && endCycleDays <= 30)) {
        color = 'yellow';
        if (endCycleDays != null && endCycleDays <= 30) reasons.push(`Renovação em ${endCycleDays}d`);
        if (overdueMilestones.length > 0) reasons.push(`${overdueMilestones.length} entrega(s) em atraso`);
        if (daysSinceNps != null && daysSinceNps > 90) reasons.push(`NPS desatualizado (${daysSinceNps}d)`);
      } else {
        reasons.push('Tudo em dia');
      }

      return { client: c, color, endCycleDays, reason: reasons.join(' · ') };
    }).sort((a, b) => {
      const order: Record<HealthColor, number> = { red: 0, yellow: 1, green: 2 };
      return order[a.color] - order[b.color];
    });
  }, [activeClients, latestNpsByClient, allNps, allMilestones, today]);

  return (
    <div className="space-y-6 pt-6">
      <MonthNavHeader monthIdx={monthIdx} year={year} onBack={onBack} onChangeMonth={onChangeMonth} />

      {/* KPIs */}
      {isAreaEnabled('clientes') && (
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">KPIs do Mês</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
          {isKpiEnabled('clientes', 'novos_clientes') && <KpiCard label="Clientes ativos" value={activeClients.length} icon={Users} />}
          {isKpiEnabled('clientes', 'novos_clientes') && <KpiCard label="Novos clientes" value={newClients.length} icon={UserPlus} />}
          {isKpiEnabled('clientes', 'churn') && <KpiCard label="Churn" value={churnClients.length} icon={UserMinus} color={churnClients.length > 0 ? 'text-destructive' : undefined} />}
          {isKpiEnabled('clientes', 'novos_clientes') && <KpiCard label="Em onboarding" value={onboardingClients.length} icon={Users} />}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-5 mt-5">
          {isKpiEnabled('clientes', 'novos_clientes') && <KpiCard label="Valor médio / cliente" value={`${formatInt(avgValuePerClient)} €`} icon={DollarSign} />}
          {isKpiEnabled('clientes', 'taxa_renovacao') && <KpiCard label="Taxa de renovação" value={`${renewalRate}%`} icon={RefreshCw} />}
          {isKpiEnabled('clientes', 'marcos_atingidos') && <KpiCard label="Marcos atingidos" value={`${monthMilestonesDone.length} / ${monthMilestonesExpected.length}`} icon={Target} />}
        </div>
      </div>
      )}

      {/* NPS */}
      {isAreaEnabled('clientes') && isKpiEnabled('clientes', 'nps_medio') && (
      <Card className="border-secondary bg-background">
        <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">NPS Médio Atual</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-bold">{avgNps}</span>
            <span className="text-sm text-muted-foreground">{activeNps.length} / {activeClients.length} clientes com NPS</span>
          </div>
          <div className="flex gap-4 text-sm">
            <span className="text-success font-medium">Promotores (9-10): {promoters}</span>
            <span className="text-warning font-medium">Neutros (7-8): {passives}</span>
            <span className="text-destructive font-medium">Detratores (0-6): {detractors}</span>
          </div>
        </CardContent>
      </Card>
      )}

      {/* Health */}
      {isAreaEnabled('clientes') && isKpiEnabled('clientes', 'saude_carteira') && (
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Saúde da Relação com Clientes</h3>
        <Card className="border-secondary bg-background">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <div className="min-w-[760px]">
                <div className="bg-muted px-4 py-2 text-xs font-medium grid grid-cols-6 gap-2">
                  <span>Cliente</span><span>Produto</span><span>Status</span><span>Saúde</span><span>Razão</span><span>Fim de Ciclo</span>
                </div>
                {healthList.length === 0 ? (
                  <EmptyHint>Sem clientes ativos</EmptyHint>
                ) : healthList.map(({ client: c, color, reason }) => (
                  <div
                    key={c.id}
                    className="px-4 py-2.5 text-sm grid grid-cols-6 gap-2 border-b hover:bg-muted/50 cursor-pointer items-center"
                    onClick={() => navigate(`/hub/clientes/${c.id}`)}
                  >
                    <span className="truncate font-medium">{c.full_name}</span>
                    <span className="truncate text-muted-foreground">{c.current_product || '—'}</span>
                    <span className="text-muted-foreground">{STATUS_LABEL[c.status] || c.status}</span>
                    <span><div className={cn('h-3 w-3 rounded-full', HEALTH_STYLES[color])} /></span>
                    <span className="text-xs text-muted-foreground truncate">{reason}</span>
                    <span className="text-muted-foreground">{c.end_of_cycle ? new Date(c.end_of_cycle).toLocaleDateString('pt-PT') : '—'}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      )}

      {/* Distribution by product */}
      {byProduct.length > 0 && (
        <Card className="border-secondary bg-background">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Distribuição por Produto</CardTitle></CardHeader>
          <CardContent className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byProduct} layout="vertical" margin={{ left: 100 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={95} />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <Separator />

      {/* Qualitative */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Análise Qualitativa</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {([
            { key: 'portfolio_notes', label: 'Notas sobre a carteira do mês' },
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
export default function ClientesAnalisePage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const sectorConfig = useSectorConfig();
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);

  const { clients: clientsQ } = useClients();
  const clientsData = clientsQ.data || [];

  // NPS for annual
  const npsQ = useQuery({
    queryKey: ['client_nps_all'],
    queryFn: async () => {
      const { data } = await supabase.from('client_nps_records').select('*').order('actual_date', { ascending: false });
      return data || [];
    },
  });
  const allNps = npsQ.data || [];

  // Milestones for health
  const milestonesQ = useQuery({
    queryKey: ['client_milestones_all'],
    queryFn: async () => {
      const { data } = await supabase.from('client_milestones').select('*');
      return data || [];
    },
  });
  const allMilestones = milestonesQ.data || [];

  // ─── Annual summary ───
  const annualSummary = useMemo(() => {
    const activeClients = clientsData.filter(c => c.status === 'ativo' || c.status === 'em_onboarding');
    const newClients = clientsData.filter(c => {
      if (!c.start_date) return false;
      return new Date(c.start_date).getFullYear() === year;
    }).length;
    const churn = clientsData.filter(c => {
      if (!c.updated_at || c.status !== 'terminado' || c.is_legacy) return false;
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
    const activeIds = new Set(activeClients.map(c => c.id));
    const npsMap = new Map<string, number>();
    for (const n of allNps) {
      if (n.nps_score != null && !npsMap.has(n.client_id) && activeIds.has(n.client_id)) {
        npsMap.set(n.client_id, n.nps_score);
      }
    }
    const npsScores = Array.from(npsMap.values());
    const avgNps = npsScores.length > 0 ? (npsScores.reduce((a, b) => a + b, 0) / npsScores.length).toFixed(1) : '—';

    // Distribution by product
    const byProduct: { name: string; count: number }[] = [];
    const prodMap: Record<string, number> = {};
    activeClients.forEach(c => { const p = c.current_product || 'Sem produto'; prodMap[p] = (prodMap[p] || 0) + 1; });
    Object.entries(prodMap).sort((a, b) => b[1] - a[1]).forEach(([name, count]) => byProduct.push({ name, count }));

    // Health semaphore counts + detailed list
    const today = new Date();
    let green = 0, yellow = 0, red = 0;
    const healthList: { client: typeof activeClients[number]; color: 'green' | 'yellow' | 'red'; reason: string; endCycleDays: number | null }[] = [];
    activeClients.forEach(c => {
      const clientNps = npsMap.get(c.id);
      const lastNpsDate = allNps.find(n => n.client_id === c.id && n.nps_score != null)?.actual_date;
      const daysSinceNps = lastNpsDate ? differenceInDays(today, parseISO(lastNpsDate)) : null;
      const overdue = allMilestones.filter(m => m.client_id === c.id && m.status !== 'concluido' && m.expected_date && parseISO(m.expected_date) < today);
      const endCycleDays = c.end_of_cycle ? differenceInDays(parseISO(c.end_of_cycle), today) : null;

      let color: 'green' | 'yellow' | 'red' = 'green';
      const reasons: string[] = [];
      if (clientNps != null && clientNps <= 6) {
        color = 'red';
        reasons.push(`NPS detrator (${clientNps})`);
        red++;
      } else if ((daysSinceNps != null && daysSinceNps > 90) || overdue.length > 0 || (endCycleDays != null && endCycleDays <= 30)) {
        color = 'yellow';
        if (endCycleDays != null && endCycleDays <= 30) reasons.push(`Renovação em ${endCycleDays}d`);
        if (daysSinceNps != null && daysSinceNps > 90) reasons.push(`NPS desatualizado (${daysSinceNps}d)`);
        if (overdue.length > 0) reasons.push(`${overdue.length} marco(s) em atraso`);
        yellow++;
      } else {
        reasons.push('Tudo em dia');
        green++;
      }
      healthList.push({ client: c, color, reason: reasons.join(' · '), endCycleDays });
    });
    healthList.sort((a, b) => {
      const order = { red: 0, yellow: 1, green: 2 } as const;
      return order[a.color] - order[b.color];
    });

    return { activeCount: activeClients.length, newClients, churn, renewalRate, avgNps, byProduct, green, yellow, red, healthList };
  }, [clientsData, year, allNps, allMilestones]);

  const monthSummaries = useMemo(() => {
    return MONTH_NAMES.map((name, idx) => {
      const m = idx + 1;
      const newClients = clientsData.filter(c => {
        if (!c.start_date) return false;
        const d = new Date(c.start_date);
        return d.getMonth() + 1 === m && d.getFullYear() === year;
      }).length;
      const churn = clientsData.filter(c => {
        if (!c.updated_at || c.status !== 'terminado' || c.is_legacy) return false;
        const d = new Date(c.updated_at);
        return d.getMonth() + 1 === m && d.getFullYear() === year;
      }).length;
      const active = clientsData.filter(c => c.status === 'ativo' || c.status === 'em_onboarding').length;
      return { name, newClients, churn, active };
    });
  }, [clientsData, year]);

  if (selectedMonth !== null) {
    return (
      <AppLayout>
        <PageHeader title="Análise de Clientes" subtitle="Análise mensal da carteira de clientes." />
        <div className="space-y-6 pt-6">
          <BackNavigation parentRoute="/hub/clientes" parentLabel={sectorConfig.t('clientes')} />
          <MonthDetail monthIdx={selectedMonth} year={year} onBack={() => setSelectedMonth(null)} onChangeMonth={(m, y) => { setSelectedMonth(m); setYear(y); }} />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageHeader title="Análise de Clientes" subtitle="Análise mensal da carteira de clientes." />
      <div className="space-y-6 pt-6">
        <BackNavigation parentRoute="/hub/clientes" parentLabel={sectorConfig.t('clientes')} />

        <YearSelector year={year} onChange={setYear} />

        {/* Month cards */}
        <MonthCardsGallery
          months={monthSummaries}
          year={year}
          onSelectMonth={setSelectedMonth}
          renderBody={(m) => (
            <div className="flex gap-3 text-xs text-muted-foreground">
              <span className="text-success font-medium">+{m.newClients} novos</span>
              {m.churn > 0 && <span className="text-destructive font-medium">-{m.churn} churn</span>}
            </div>
          )}
        />

        <Separator />

        {/* ─── Annual Summary ─── */}
        <div className="space-y-4">
          <h3 className="text-base font-semibold">Resumo {year}</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-5">
            <KpiCard label="Clientes ativos" value={annualSummary.activeCount} icon={Users} />
            <KpiCard label="Novos clientes" value={annualSummary.newClients} icon={UserPlus} />
            <KpiCard label="Churn total" value={annualSummary.churn} icon={UserMinus} color={annualSummary.churn > 0 ? 'text-destructive' : undefined} />
            <KpiCard label="Taxa de renovação" value={`${annualSummary.renewalRate}%`} icon={RefreshCw} />
            <KpiCard label="NPS médio atual" value={annualSummary.avgNps} icon={Star} />
          </div>

          {/* Health */}
          <Card className="border-secondary bg-background">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold">Saúde da Relação com Clientes</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              <div className="flex gap-6 text-sm">
                <div className="flex items-center gap-2"><div className="h-3 w-3 rounded-full bg-success" /><span className="font-medium">{annualSummary.green} Verde</span></div>
                <div className="flex items-center gap-2"><div className="h-3 w-3 rounded-full bg-warning" /><span className="font-medium">{annualSummary.yellow} Amarelo</span></div>
                <div className="flex items-center gap-2"><div className="h-3 w-3 rounded-full bg-destructive" /><span className="font-medium">{annualSummary.red} Vermelho</span></div>
              </div>
              {annualSummary.healthList.length > 0 && (
                <div className="overflow-x-auto -mx-4">
                  <div className="min-w-[760px]">
                    <div className="bg-muted px-4 py-2 text-xs font-medium grid grid-cols-6 gap-2">
                      <span>Cliente</span><span>Produto</span><span>Status</span><span>Saúde</span><span>Razão</span><span>Fim de Ciclo</span>
                    </div>
                    {annualSummary.healthList.map(({ client: c, color, reason }) => (
                      <div
                        key={c.id}
                        className="px-4 py-2.5 text-sm grid grid-cols-6 gap-2 border-b hover:bg-muted/50 cursor-pointer items-center"
                        onClick={() => navigate(`/hub/clientes/${c.id}`)}
                      >
                        <span className="truncate font-medium">{c.full_name}</span>
                        <span className="truncate text-muted-foreground">{c.current_product || '—'}</span>
                        <span className="text-muted-foreground">{STATUS_LABEL[c.status] || c.status}</span>
                        <span><div className={cn('h-3 w-3 rounded-full', HEALTH_STYLES[color])} /></span>
                        <span className="text-xs text-muted-foreground truncate">{reason}</span>
                        <span className="text-muted-foreground">{c.end_of_cycle ? new Date(c.end_of_cycle).toLocaleDateString('pt-PT') : '—'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Distribution by product */}
          {annualSummary.byProduct.length > 0 && (
            <Card className="border-secondary bg-background">
              <CardHeader className="pb-2 pt-4 px-4"><CardTitle className="text-sm font-semibold">Distribuição por Produto</CardTitle></CardHeader>
              <CardContent className="px-4 pb-4 space-y-2">
                {annualSummary.byProduct.map(p => (
                  <div key={p.name} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{p.name}</span>
                    <span className="font-medium">{p.count} clientes</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
