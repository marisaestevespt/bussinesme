import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { subMonths, subDays, differenceInMonths, parseISO, format, startOfMonth, endOfMonth, subWeeks, startOfWeek, endOfWeek } from 'date-fns';
import { calculateMRR, isRecurringProduct, parseTicket } from '@/lib/financialHealth';

export type MetricPeriod = 'last_month' | 'last_quarter' | 'last_year' | 'all_time';

function periodRange(period: MetricPeriod): { start: string; end: string } {
  const now = new Date();
  const end = format(now, 'yyyy-MM-dd');
  switch (period) {
    case 'last_month': return { start: format(subMonths(now, 1), 'yyyy-MM-dd'), end };
    case 'last_quarter': return { start: format(subMonths(now, 3), 'yyyy-MM-dd'), end };
    case 'last_year': return { start: format(subMonths(now, 12), 'yyyy-MM-dd'), end };
    case 'all_time': return { start: '2000-01-01', end };
  }
}

function prevPeriodRange(period: MetricPeriod): { start: string; end: string } {
  const now = new Date();
  switch (period) {
    case 'last_month': {
      const s = subMonths(now, 2);
      return { start: format(s, 'yyyy-MM-dd'), end: format(subMonths(now, 1), 'yyyy-MM-dd') };
    }
    case 'last_quarter': {
      const s = subMonths(now, 6);
      return { start: format(s, 'yyyy-MM-dd'), end: format(subMonths(now, 3), 'yyyy-MM-dd') };
    }
    case 'last_year': {
      const s = subMonths(now, 24);
      return { start: format(s, 'yyyy-MM-dd'), end: format(subMonths(now, 12), 'yyyy-MM-dd') };
    }
    case 'all_time': return { start: '2000-01-01', end: '2000-01-01' };
  }
}

export interface StrategicMetrics {
  mrr: number;
  mrrPrev: number | null;
  ltv: number;
  ltvEstimated: boolean;
  cac: number;
  churnRate: number;
  churnRatePrev: number | null;
  ltvCacRatio: number;
  avgRetentionMonths: number;
  avgRetentionEstimated: boolean;
  avgNps: number | null;
  newClientsCount: number;
  lostClientsCount: number;
  isLoading: boolean;
}

export function useStrategicMetrics(period: MetricPeriod): StrategicMetrics {
  const range = periodRange(period);
  const prevRange = prevPeriodRange(period);

  // All clients
  const { data: allClients = [], isLoading: cl } = useQuery({
    queryKey: ['strat-clients'],
    queryFn: async () => {
      const { data } = await supabase.from('clients').select('id, status, start_date, end_of_cycle, current_product');
      return data || [];
    },
  });

  // Products (for ticket & type)
  const { data: products = [], isLoading: pl } = useQuery({
    queryKey: ['strat-products'],
    queryFn: async () => {
      const { data } = await supabase.from('products').select('id, name, ticket, product_type');
      return (data || []) as { id: string; name: string; ticket: string | null; product_type: string | null }[];
    },
  });

  // Expenses in period (for CAC)
  const { data: expenses = [], isLoading: el } = useQuery({
    queryKey: ['strat-expenses', range.start, range.end],
    queryFn: async () => {
      const { data } = await supabase.from('financial_expenses').select('total_with_vat, category, department').gte('expense_date', range.start).lte('expense_date', range.end);
      return data || [];
    },
  });

  // NPS last 90 days
  const nps90Start = format(subDays(new Date(), 90), 'yyyy-MM-dd');
  const { data: npsRecords = [], isLoading: nl } = useQuery({
    queryKey: ['strat-nps-90'],
    queryFn: async () => {
      const { data } = await supabase.from('client_nps_records').select('nps_score').gte('actual_date', nps90Start).not('nps_score', 'is', null);
      return data || [];
    },
  });

  return useMemo(() => {
    const isLoading = cl || pl || el || nl;

    // Active clients
    const activeClients = allClients.filter(c => c.status === 'ativo' || c.status === 'em_onboarding');

    // MRR: sum of ticket for active clients with servico_mensal product
    const productByName = new Map(products.map(p => [p.name, p]));
    const productById = new Map(products.map(p => [p.id, p]));

    const mrr = calculateMRR(activeClients, products).total;

    // Retention: average months between start_date and end_of_cycle for terminated clients
    const terminatedClients = allClients.filter(c =>
      (c.status === 'terminado' || c.status === 'cancelado' || c.status === 'concluido') &&
      c.start_date && c.end_of_cycle
    );

    let avgRetentionMonths = 12;
    let avgRetentionEstimated = true;
    if (terminatedClients.length >= 3) {
      const totalMonths = terminatedClients.reduce((sum, c) => {
        const months = differenceInMonths(parseISO(c.end_of_cycle!), parseISO(c.start_date!));
        return sum + Math.max(months, 1);
      }, 0);
      avgRetentionMonths = Math.round((totalMonths / terminatedClients.length) * 10) / 10;
      avgRetentionEstimated = false;
    }

    // Average ticket of active clients
    let totalTicket = 0;
    let ticketCount = 0;
    activeClients.forEach(c => {
      const prod = c.current_product ? (productByName.get(c.current_product) || null) : null;
      if (prod) {
        const t = parseFloat(prod.ticket || '0') || 0;
        if (t > 0) { totalTicket += t; ticketCount++; }
      }
    });
    const avgTicket = ticketCount > 0 ? totalTicket / ticketCount : 0;

    // LTV
    const ltv = avgTicket * avgRetentionMonths;
    const ltvEstimated = avgRetentionEstimated;

    // CAC: expenses with department = 'marketing' or 'comercial'
    const cacExpenses = expenses.reduce((sum, e: any) => {
      const dept = (e.department || '').toLowerCase();
      if (dept === 'marketing' || dept === 'comercial') {
        return sum + (Number(e.total_with_vat) || 0);
      }
      return sum;
    }, 0);

    const newClientsInPeriod = allClients.filter(c =>
      c.start_date && c.start_date >= range.start && c.start_date <= range.end
    );
    const newClientsCount = newClientsInPeriod.length;
    const cac = newClientsCount > 0 ? cacExpenses / newClientsCount : 0;

    // Churn rate: clients that became terminated in period / active at start of period
    const lostInPeriod = allClients.filter(c =>
      (c.status === 'terminado' || c.status === 'cancelado' || c.status === 'concluido') &&
      c.end_of_cycle && c.end_of_cycle >= range.start && c.end_of_cycle <= range.end
    );
    const lostClientsCount = lostInPeriod.length;

    // Active at start of period: clients whose start_date < period start and (no end or end >= period start)
    const activeAtStart = allClients.filter(c =>
      c.start_date && c.start_date < range.start &&
      (!c.end_of_cycle || c.end_of_cycle >= range.start)
    );
    const churnRate = activeAtStart.length > 0 ? (lostClientsCount / activeAtStart.length) * 100 : 0;

    // Previous period churn
    let churnRatePrev: number | null = null;
    if (period !== 'all_time') {
      const lostInPrev = allClients.filter(c =>
        (c.status === 'terminado' || c.status === 'cancelado' || c.status === 'concluido') &&
        c.end_of_cycle && c.end_of_cycle >= prevRange.start && c.end_of_cycle < prevRange.end
      );
      const activeAtPrevStart = allClients.filter(c =>
        c.start_date && c.start_date < prevRange.start &&
        (!c.end_of_cycle || c.end_of_cycle >= prevRange.start)
      );
      churnRatePrev = activeAtPrevStart.length > 0 ? (lostInPrev.length / activeAtPrevStart.length) * 100 : 0;
    }

    // LTV/CAC
    const ltvCacRatio = cac > 0 ? ltv / cac : 0;

    // NPS
    const npsScores = npsRecords.map(r => Number(r.nps_score)).filter(n => !isNaN(n));
    const avgNps = npsScores.length > 0 ? Math.round((npsScores.reduce((s, v) => s + v, 0) / npsScores.length) * 10) / 10 : null;

    // MRR prev (approximate: count clients active at prev period end with servico_mensal)
    let mrrPrev: number | null = null;
    if (period !== 'all_time') {
      mrrPrev = 0;
      allClients.forEach(c => {
        const wasActive = c.start_date && c.start_date <= prevRange.end &&
          (!c.end_of_cycle || c.end_of_cycle > prevRange.end) &&
          (c.status === 'ativo' || c.status === 'em_onboarding' || c.status === 'terminado' || c.status === 'cancelado' || c.status === 'concluido');
        if (wasActive) {
          const prod = c.current_product ? (productByName.get(c.current_product) || null) : null;
          if (prod && isRecurringProduct(prod)) {
            mrrPrev! += parseTicket(prod.ticket);
          }
        }
      });
    }

    return {
      mrr, mrrPrev, ltv, ltvEstimated, cac, churnRate, churnRatePrev,
      ltvCacRatio, avgRetentionMonths, avgRetentionEstimated, avgNps,
      newClientsCount, lostClientsCount, isLoading,
    };
  }, [allClients, products, expenses, npsRecords, range, prevRange, period, cl, pl, el, nl]);
}

// Weekly variant for Weekly Align
export function useWeeklyStrategicMetrics() {
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const prevWeekStart = subWeeks(weekStart, 1);
  const prevWeekEnd = endOfWeek(prevWeekStart, { weekStartsOn: 1 });

  const weekStartStr = format(weekStart, 'yyyy-MM-dd');
  const weekEndStr = format(weekEnd, 'yyyy-MM-dd');
  const prevWeekStartStr = format(prevWeekStart, 'yyyy-MM-dd');
  const prevWeekEndStr = format(prevWeekEnd, 'yyyy-MM-dd');

  const current = useStrategicMetrics('last_month');

  // New clients this week
  const { data: newThisWeek = [] } = useQuery({
    queryKey: ['strat-new-clients-week', weekStartStr],
    queryFn: async () => {
      const { data } = await supabase.from('clients').select('id').gte('start_date', weekStartStr).lte('start_date', weekEndStr);
      return data || [];
    },
  });

  // Lost clients this week
  const { data: lostThisWeek = [] } = useQuery({
    queryKey: ['strat-lost-clients-week', weekStartStr],
    queryFn: async () => {
      // Only 'terminado' is a real archived client status (cancelado/concluido are project statuses).
      const { data } = await supabase.from('clients').select('id').eq('status', 'terminado').gte('end_of_cycle', weekStartStr).lte('end_of_cycle', weekEndStr);
      return data || [];
    },
  });

  return {
    mrr: current.mrr,
    mrrPrev: current.mrrPrev,
    churnWeek: lostThisWeek.length,
    newClientsWeek: newThisWeek.length,
    ltvCacRatio: current.ltvCacRatio,
    isLoading: current.isLoading,
  };
}
