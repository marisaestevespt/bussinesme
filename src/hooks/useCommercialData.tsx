import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { PAGE_SIZE, flattenInfiniteData, type InfinitePageResult } from '@/hooks/useInfiniteSupabaseQuery';

import { supabase } from '@/integrations/supabase/client';
import { excludeCancelled, cleanPayload } from '@/lib/utils';
import { toast } from 'sonner';
import type { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';

type CommercialSale = Tables<'commercial_sales'>;
type AnnualGoal = Tables<'commercial_annual_goals'>;
type ProductGoal = Tables<'commercial_product_goals'>;
type QuarterlyGoal = Tables<'commercial_quarterly_goals'>;
type MonthlyGoal = Tables<'commercial_monthly_goals'>;

// cleanPayload imported from utils

const currentYear = new Date().getFullYear();
const currentMonth = new Date().getMonth() + 1;

export function useCommercialData(year = currentYear) {
  const qc = useQueryClient();
  const key = ['commercial', year];

  const annualGoal = useQuery({
    queryKey: [...key, 'annual'],
    queryFn: async () => {
      const { data } = await supabase.from('commercial_annual_goals').select('*').eq('year', year).maybeSingle();
      return data;
    },
    staleTime: 2 * 60 * 1000,
  });

  const productGoals = useQuery({
    queryKey: [...key, 'products'],
    queryFn: async () => {
      const { data } = await supabase.from('commercial_product_goals').select('*').eq('year', year).order('sort_order');
      return data || [];
    },
    staleTime: 2 * 60 * 1000,
  });

  const quarterlyGoals = useQuery({
    queryKey: [...key, 'quarterly'],
    queryFn: async () => {
      const { data } = await supabase.from('commercial_quarterly_goals').select('*').eq('year', year).order('quarter');
      return data || [];
    },
    staleTime: 2 * 60 * 1000,
  });

  const monthlyGoals = useQuery({
    queryKey: [...key, 'monthly'],
    queryFn: async () => {
      const { data } = await supabase.from('commercial_monthly_goals').select('*').eq('year', year).order('month');
      return data || [];
    },
    staleTime: 2 * 60 * 1000,
  });

  const sales = useQuery({
    queryKey: [...key, 'sales'],
    queryFn: async () => {
      const { data } = await supabase.from('commercial_sales')
        .select('id,sale_id,client,product,base_value,invoice_total,payment_date,status,sale_month,sale_quarter,sale_year,source,description,documents,project_id,created_at')
        .eq('sale_year', year).order('payment_date', { ascending: false });
      return data || [];
    },
    staleTime: 2 * 60 * 1000,
  });

  const allSalesQuery = useInfiniteQuery<InfinitePageResult<CommercialSale>>({
    queryKey: ['commercial', 'all-sales'],
    initialPageParam: 0,
    queryFn: async ({ pageParam = 0 }) => {
      const from = (pageParam as number) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data } = await supabase.from('commercial_sales').select('*', { count: 'exact' }).order('payment_date', { ascending: false }).range(from, to);
      return { data: data || [], count: null, nextPage: (data?.length ?? 0) === PAGE_SIZE ? (pageParam as number) + 1 : undefined };
    },
    getNextPageParam: (last) => last.nextPage,
  });

  const allSales = {
    ...allSalesQuery,
    data: flattenInfiniteData(allSalesQuery.data?.pages),
  };

  // Auto-status updates moved to daily-status-update edge function (cron)

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ['commercial'] });
    qc.invalidateQueries({ queryKey: ['planning'] });
  };

  const MONTH_NAMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

  const getOrCreateCommercialObjective = async (): Promise<string> => {
    const { data: existing } = await supabase
      .from('executive_objectives')
      .select('id')
      .eq('year', year)
      .eq('area', 'comercial')
      .eq('value_source', 'commercial')
      .maybeSingle();
    if (existing) return existing.id;
    const { data: created, error } = await supabase
      .from('executive_objectives')
      .insert({
        year, title: 'Meta Comercial Anual', area: 'comercial',
        objective_type: 'quantitativo', measurement_type: 'acumulativo',
        target_unit: '€', value_source: 'commercial', status: 'em_curso',
      } satisfies TablesInsert<'executive_objectives'>)
      .select('id')
      .single();
    if (error) throw error;
    return created.id;
  };

  const syncAnnualToPlanning = async (goalAmount: number) => {
    try {
      const objId = await getOrCreateCommercialObjective();
      await supabase.from('executive_objectives')
        .update({ target_value: goalAmount } satisfies TablesUpdate<'executive_objectives'>)
        .eq('id', objId);
    } catch (e) { console.error('Sync annual→planning failed', e); }
  };

  const syncMonthlyToPlanning = async (month: number, goalAmount: number) => {
    try {
      const objId = await getOrCreateCommercialObjective();
      const period = MONTH_NAMES[month - 1];
      const { data: existing } = await supabase
        .from('planning_goals')
        .select('id')
        .eq('objective_id', objId)
        .eq('period', period)
        .eq('year', year)
        .maybeSingle();
      if (existing) {
        await supabase.from('planning_goals').update({ target_value: String(goalAmount) } satisfies TablesUpdate<'planning_goals'>).eq('id', existing.id);
      } else {
        await supabase.from('planning_goals').insert({
          objective_id: objId, period, period_type: 'mensal', year,
          target_value: String(goalAmount), status: 'por_iniciar',
        } satisfies TablesInsert<'planning_goals'>);
      }
    } catch (e) { console.error('Sync monthly→planning failed', e); }
  };

  const upsertAnnualGoal = useMutation({
    mutationFn: async (goalAmount: number) => {
      const existing = annualGoal.data;
      if (existing) {
        const { error } = await supabase.from('commercial_annual_goals').update({ goal_amount: goalAmount }).eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('commercial_annual_goals').insert({ year, goal_amount: goalAmount });
        if (error) throw error;
      }
      await syncAnnualToPlanning(goalAmount);
    },
    onSuccess: invalidateAll,
    onError: () => toast.error('Erro ao guardar meta anual'),
  });

  const upsertProductGoal = useMutation({
    mutationFn: async (pg: { id?: string; product_name: string; goal_amount: number; intention?: string; sort_order?: number }) => {
      if (pg.id) {
        const { error } = await supabase.from('commercial_product_goals').update({
          product_name: pg.product_name, goal_amount: pg.goal_amount, intention: pg.intention,
        }).eq('id', pg.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('commercial_product_goals').insert({
          year, product_name: pg.product_name, goal_amount: pg.goal_amount, intention: pg.intention, sort_order: pg.sort_order || 0,
        });
        if (error) throw error;
      }
    },
    onSuccess: invalidateAll,
    onError: () => toast.error('Erro ao guardar meta por produto'),
  });

  const deleteProductGoal = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('commercial_product_goals').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidateAll,
  });

  const upsertQuarterlyGoal = useMutation({
    mutationFn: async (qg: { quarter: number; goal_amount: number }) => {
      const existing = (quarterlyGoals.data || []).find(q => q.quarter === qg.quarter);
      if (existing) {
        const { error } = await supabase.from('commercial_quarterly_goals').update({ goal_amount: qg.goal_amount }).eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('commercial_quarterly_goals').insert({ year, quarter: qg.quarter, goal_amount: qg.goal_amount });
        if (error) throw error;
      }
    },
    onSuccess: invalidateAll,
  });

  const upsertMonthlyGoal = useMutation({
    mutationFn: async (mg: { month: number; goal_amount: number }) => {
      const existing = (monthlyGoals.data || []).find(m => m.month === mg.month);
      if (existing) {
        const { error } = await supabase.from('commercial_monthly_goals').update({ goal_amount: mg.goal_amount }).eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('commercial_monthly_goals').insert({ year, month: mg.month, goal_amount: mg.goal_amount });
        if (error) throw error;
      }
      await syncMonthlyToPlanning(mg.month, mg.goal_amount);
    },
    onSuccess: invalidateAll,
  });

  const upsertSale = useMutation({
    mutationFn: async (raw: Partial<CommercialSale> & { sale_id?: string }) => {
      const sale = cleanPayload(raw);
      const payDate = sale.payment_date ? new Date(sale.payment_date) : null;
      const saleMonth = payDate ? payDate.getMonth() + 1 : null;
      const saleQuarter = saleMonth ? Math.ceil(saleMonth / 3) : null;
      const saleYear = payDate ? payDate.getFullYear() : null;

      // Always resolve product_id from the current product name so the
      // relational link is preserved even if the product is renamed later.
      const productId = await resolveProductId((sale as any).product as string | null);

      const record = {
        ...sale,
        sale_month: saleMonth,
        sale_quarter: saleQuarter,
        sale_year: saleYear,
        product_id: productId,
      };

      if (sale.id) {
        const { error } = await supabase.from('commercial_sales').update(record as TablesUpdate<'commercial_sales'>).eq('id', sale.id);
        if (error) throw error;
      } else {
        const { data: countData } = await supabase.from('commercial_sales').select('id').eq('sale_year', saleYear || currentYear);
        const nextNum = ((countData?.length || 0) + 1).toString().padStart(2, '0');
        const insertRecord = {
          ...record,
          sale_id: `V${saleYear || currentYear}-${nextNum}`,
        };
        delete (insertRecord as Record<string, unknown>).id;
        const { error } = await supabase.from('commercial_sales').insert(insertRecord as TablesInsert<'commercial_sales'>);
        if (error) throw error;
      }
    },
    onSuccess: invalidateAll,
    onError: () => toast.error('Erro ao guardar venda'),
  });

  const deleteSale = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('commercial_sales').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidateAll,
  });

  // Computed values
  const annualGoalAmount = Number(annualGoal.data?.goal_amount || 0);
  const yearSales = excludeCancelled(sales.data || []);
  const totalInvoiced = yearSales.reduce((s, v) => s + Number(v.invoice_total || 0), 0);
  const progressPct = annualGoalAmount > 0 ? (totalInvoiced / annualGoalAmount) * 100 : 0;
  const currentMonthSales = yearSales.filter(v => v.sale_month === currentMonth);
  const currentMonthTotal = currentMonthSales.reduce((s, v) => s + Number(v.invoice_total || 0), 0);

  const monthlyTotals = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    return yearSales.filter(v => v.sale_month === m).reduce((s, v) => s + Number(v.invoice_total || 0), 0);
  });

  const monthlyGoalsSum = (monthlyGoals.data || []).reduce((s, m) => s + Number(m.goal_amount || 0), 0);
  const monthlyMismatch = annualGoalAmount > 0 && monthlyGoalsSum < annualGoalAmount - 0.01;

  const quarterTotals = [1, 2, 3, 4].map(q =>
    yearSales.filter(v => v.sale_quarter === q).reduce((s, v) => s + Number(v.invoice_total || 0), 0)
  );

  const normalize = (s: string) => s.toLowerCase().trim().replace(/\s+/g, ' ');
  const productTotals = (productGoals.data || []).map(pg => {
    const goalName = normalize(pg.product_name);
    return {
      ...pg,
      totalInvoiced: yearSales
        .filter(v => {
          const saleName = normalize(v.product || '');
          if (!saleName) return false;
          return saleName === goalName
            || saleName.includes(goalName)
            || goalName.includes(saleName)
            || saleName.replace(/s\b/g, '') === goalName.replace(/s\b/g, '');
        })
        .reduce((s, v) => s + Number(v.invoice_total || 0), 0),
    };
  });

  return {
    annualGoal, productGoals, quarterlyGoals, monthlyGoals, sales, allSales,
    upsertAnnualGoal, upsertProductGoal, deleteProductGoal, upsertQuarterlyGoal, upsertMonthlyGoal,
    upsertSale, deleteSale,
    annualGoalAmount, totalInvoiced, progressPct, currentMonthTotal, currentMonthSales,
    monthlyTotals, monthlyGoalsSum, monthlyMismatch, quarterTotals, productTotals,
    year, currentMonth,
  };
}
