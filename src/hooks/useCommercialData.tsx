import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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
  });

  const productGoals = useQuery({
    queryKey: [...key, 'products'],
    queryFn: async () => {
      const { data } = await supabase.from('commercial_product_goals').select('*').eq('year', year).order('sort_order');
      return data || [];
    },
  });

  const quarterlyGoals = useQuery({
    queryKey: [...key, 'quarterly'],
    queryFn: async () => {
      const { data } = await supabase.from('commercial_quarterly_goals').select('*').eq('year', year).order('quarter');
      return data || [];
    },
  });

  const monthlyGoals = useQuery({
    queryKey: [...key, 'monthly'],
    queryFn: async () => {
      const { data } = await supabase.from('commercial_monthly_goals').select('*').eq('year', year).order('month');
      return data || [];
    },
  });

  const sales = useQuery({
    queryKey: [...key, 'sales'],
    queryFn: async () => {
      const { data } = await supabase.from('commercial_sales').select('*').eq('sale_year', year).order('payment_date', { ascending: false });
      return data || [];
    },
  });

  const allSales = useQuery({
    queryKey: ['commercial', 'all-sales'],
    queryFn: async () => {
      const { data } = await supabase.from('commercial_sales').select('*').order('payment_date', { ascending: false });
      return data || [];
    },
  });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ['commercial'] });
  };

  // Upsert annual goal
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
    },
    onSuccess: invalidateAll,
    onError: () => toast.error('Erro ao guardar meta anual'),
  });

  // Upsert product goal
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

  // Upsert quarterly goal
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

  // Upsert monthly goal
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
    },
    onSuccess: invalidateAll,
  });

  // Upsert sale
  const upsertSale = useMutation({
    mutationFn: async (sale: any) => {
      const payDate = sale.payment_date ? new Date(sale.payment_date) : null;
      const saleMonth = payDate ? payDate.getMonth() + 1 : null;
      const saleQuarter = saleMonth ? Math.ceil(saleMonth / 3) : null;
      const saleYear = payDate ? payDate.getFullYear() : null;

      const record = {
        ...sale,
        sale_month: saleMonth,
        sale_quarter: saleQuarter,
        sale_year: saleYear,
      };

      if (sale.id) {
        const { error } = await supabase.from('commercial_sales').update(record).eq('id', sale.id);
        if (error) throw error;
      } else {
        // Generate sale_id
        const { data: countData } = await supabase.from('commercial_sales').select('id').eq('sale_year', saleYear || currentYear);
        const nextNum = ((countData?.length || 0) + 1).toString().padStart(2, '0');
        record.sale_id = `V${saleYear || currentYear}-${nextNum}`;
        delete record.id;
        const { error } = await supabase.from('commercial_sales').insert(record);
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

  // Computed values — all sales count for commercial goals/charts
  const annualGoalAmount = Number(annualGoal.data?.goal_amount || 0);
  const yearSales = sales.data || [];
  const totalInvoiced = yearSales.reduce((s, v) => s + Number(v.invoice_total || 0), 0);
  const progressPct = annualGoalAmount > 0 ? (totalInvoiced / annualGoalAmount) * 100 : 0;
  const currentMonthSales = yearSales.filter(v => v.sale_month === currentMonth);
  const currentMonthTotal = currentMonthSales.reduce((s, v) => s + Number(v.invoice_total || 0), 0);

  // Monthly totals for charts
  const monthlyTotals = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    return yearSales.filter(v => v.sale_month === m).reduce((s, v) => s + Number(v.invoice_total || 0), 0);
  });

  // Validation: monthly goals sum vs annual
  const monthlyGoalsSum = (monthlyGoals.data || []).reduce((s, m) => s + Number(m.goal_amount || 0), 0);
  const monthlyMismatch = annualGoalAmount > 0 && monthlyGoalsSum < annualGoalAmount - 0.01;

  // Quarter totals from sales (only counted statuses)
  const quarterTotals = [1, 2, 3, 4].map(q =>
    countedSales.filter(v => v.sale_quarter === q).reduce((s, v) => s + Number(v.invoice_total || 0), 0)
  );

  // Product totals from sales (only counted statuses)
  const productTotals = (productGoals.data || []).map(pg => ({
    ...pg,
    totalInvoiced: countedSales.filter(v => v.product === pg.product_name).reduce((s, v) => s + Number(v.invoice_total || 0), 0),
  }));

  return {
    annualGoal, productGoals, quarterlyGoals, monthlyGoals, sales, allSales,
    upsertAnnualGoal, upsertProductGoal, deleteProductGoal, upsertQuarterlyGoal, upsertMonthlyGoal,
    upsertSale, deleteSale,
    annualGoalAmount, totalInvoiced, progressPct, currentMonthTotal, currentMonthSales,
    monthlyTotals, monthlyGoalsSum, monthlyMismatch, quarterTotals, productTotals,
    year, currentMonth,
  };
}
