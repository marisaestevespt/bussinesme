import { useMemo } from 'react';
import { EXPENSE_INSIGHT_EXCLUDED, expenseLabel } from '@/lib/financialCategories';
import { ML } from './sections';

interface SaleLike {
  invoice_total: number;
  base_value: number;
  sale_month: number | null;
  sale_year: number | null;
  product?: string | null;
  client?: string | null;
}

interface ExpenseLike {
  total_with_vat: number;
  base_value: number;
  expense_month: number | null;
  expense_year: number | null;
  category: string | null;
}

const QUARTERS = [
  { label: 'T1', months: [1, 2, 3] },
  { label: 'T2', months: [4, 5, 6] },
  { label: 'T3', months: [7, 8, 9] },
  { label: 'T4', months: [10, 11, 12] },
];

export function useOverviewData(sales: SaleLike[], expenses: ExpenseLike[], year: number) {
  const yearSales = useMemo(() => sales.filter(s => s.sale_year === year), [sales, year]);
  const yearExpenses = useMemo(() => expenses.filter(e => e.expense_year === year), [expenses, year]);

  // Totais sem IVA (base): a contabilidade interna ignora IVA.
  const totalEntradas = yearSales.reduce((s, v) => s + v.base_value, 0);
  const totalSaidas = yearExpenses.reduce((s, v) => s + v.base_value, 0);
  const totalRevenueWithVat = yearSales.reduce((s, v) => s + (v.invoice_total ?? v.base_value), 0);
  const totalExpensesWithVat = yearExpenses.reduce((s, v) => s + v.total_with_vat, 0);
  const resultado = totalEntradas - totalSaidas;
  const margem = totalEntradas > 0 ? Math.round(resultado / totalEntradas * 10000) / 100 : 0;

  const ivaCobrado = totalRevenueWithVat - totalEntradas;
  const ivaPago = totalExpensesWithVat - totalSaidas;
  const ivaBalanco = Math.round((ivaCobrado - ivaPago) * 100) / 100;

  const productInsights = useMemo(() => {
    const byProduct = new Map<string, number>();
    yearSales.forEach(s => {
      const name = s.product || 'Sem produto';
      byProduct.set(name, (byProduct.get(name) || 0) + s.base_value);
    });
    const sorted = [...byProduct.entries()].sort((a, b) => b[1] - a[1]);
    return {
      best: sorted.length > 0 ? { name: sorted[0][0], value: sorted[0][1] } : null,
      worst: sorted.length > 1 ? { name: sorted[sorted.length - 1][0], value: sorted[sorted.length - 1][1] } : null,
    };
  }, [yearSales]);

  const clientsInYear = useMemo(() => {
    const set = new Set<string>();
    yearSales.forEach(s => { if (s.client) set.add(s.client); });
    return set.size;
  }, [yearSales]);

  const categoryInsights = useMemo(() => {
    const byCat = new Map<string, number>();
    yearExpenses.forEach(e => {
      const cat = e.category;
      if (!cat || EXPENSE_INSIGHT_EXCLUDED.has(cat)) return;
      byCat.set(cat, (byCat.get(cat) || 0) + e.base_value);
    });
    const sorted = [...byCat.entries()].sort((a, b) => b[1] - a[1]);
    return {
      biggest: sorted.length > 0 ? { name: sorted[0][0], value: sorted[0][1] } : null,
      smallest: sorted.length > 1 ? { name: sorted[sorted.length - 1][0], value: sorted[sorted.length - 1][1] } : null,
    };
  }, [yearExpenses]);

  const monthlyData = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const monthSales = yearSales.filter(s => s.sale_month === m);
      const monthExp = yearExpenses.filter(e => e.expense_month === m);
      const entBase = monthSales.reduce((s, v) => s + v.base_value, 0);
      const saiBase = monthExp.reduce((s, v) => s + v.base_value, 0);
      const entVat = monthSales.reduce((s, v) => s + (v.invoice_total ?? v.base_value), 0);
      const saiVat = monthExp.reduce((s, v) => s + v.total_with_vat, 0);
      return { mes: ML[i], entradas: entBase, saidas: saiBase, resultado: entBase - saiBase, ivaCobrado: entVat - entBase, ivaPago: saiVat - saiBase };
    });
  }, [yearSales, yearExpenses]);

  const productPieData = useMemo(() => {
    const byProduct = new Map<string, number>();
    yearSales.forEach(s => {
      const name = s.product || 'Sem produto';
      byProduct.set(name, (byProduct.get(name) || 0) + s.base_value);
    });
    return [...byProduct.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [yearSales]);

  const categoryPieData = useMemo(() => {
    const byCat = new Map<string, number>();
    yearExpenses.forEach(e => {
      const cat = expenseLabel(e.category || 'outro');
      byCat.set(cat, (byCat.get(cat) || 0) + e.base_value);
    });
    return [...byCat.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [yearExpenses]);

  const quarterlyData = useMemo(() => {
    return QUARTERS.map(q => {
      const ent = yearSales.filter(s => q.months.includes(s.sale_month || 0)).reduce((s, v) => s + v.base_value, 0);
      const sai = yearExpenses.filter(e => q.months.includes(e.expense_month || 0)).reduce((s, v) => s + v.base_value, 0);
      const res = ent - sai;
      return { label: q.label, entradas: ent, saidas: sai, resultado: res, margem: ent > 0 ? Math.round(res / ent * 10000) / 100 : 0 };
    });
  }, [yearSales, yearExpenses]);

  const bestMonth = useMemo(() => {
    let best = monthlyData[0];
    monthlyData.forEach(d => { if (d.resultado > best.resultado) best = d; });
    return best;
  }, [monthlyData]);

  const worstMonth = useMemo(() => {
    let worst = monthlyData[0];
    monthlyData.forEach(d => { if (d.resultado < worst.resultado) worst = d; });
    return worst;
  }, [monthlyData]);

  return {
    yearSales, yearExpenses,
    totalEntradas, totalSaidas, resultado, margem,
    ivaCobrado, ivaPago, ivaBalanco,
    productInsights, categoryInsights, clientsInYear,
    monthlyData, productPieData, categoryPieData, quarterlyData,
    bestMonth, worstMonth,
    avgEntradas: totalEntradas / 12,
    avgSaidas: totalSaidas / 12,
  };
}