import { useMemo } from 'react';
import { sumRevenue } from '@/lib/salesCalculations';
import { expenseLabel } from '@/lib/financialCategories';
import type { TrimSale, TrimExpense, QuarterData, QuarterTotals, NamedValue, QuarterDef } from './types';
import { ML, QUARTERS } from './types';

export function useTrimestralData(sales: TrimSale[], expenses: TrimExpense[], currentYear: number, selectedQ: string) {
  const yearSales = useMemo(() => sales.filter(s => s.sale_year === currentYear), [sales, currentYear]);
  const yearExpenses = useMemo(() => expenses.filter(e => e.expense_year === currentYear), [expenses, currentYear]);

  const data = useMemo<QuarterData[]>(() => {
    return QUARTERS.map(q => {
      const qSales = yearSales.filter(s => q.months.includes(s.sale_month || 0));
      const qExpenses = yearExpenses.filter(e => q.months.includes(e.expense_month || 0));
      const entCom = sumRevenue(qSales);
      const entBase = qSales.reduce((s, v) => s + v.base_value, 0);
      const saiCom = qExpenses.reduce((s, v) => s + v.total_with_vat, 0);
      const saiBase = qExpenses.reduce((s, v) => s + v.base_value, 0);
      const ent = entBase;
      const sai = saiBase;
      const resultado = ent - sai;
      const margem = ent > 0 ? Math.round(resultado / ent * 10000) / 100 : 0;
      const ivaCobrado = entCom - entBase;
      const ivaPago = saiCom - saiBase;
      const ivaBalanco = ivaCobrado - ivaPago;
      const ss = qExpenses.filter(e => e.category === 'seguranca_social').reduce((s, v) => s + v.total_with_vat, 0);
      const clientSet = new Set<string>();
      qSales.forEach(s => { if (s.client) clientSet.add(s.client); });

      const byCat = new Map<string, number>();
      qExpenses.forEach(e => {
        const cat = e.category || 'outro';
        byCat.set(cat, (byCat.get(cat) || 0) + e.base_value);
      });
      const categories: NamedValue[] = [...byCat.entries()].sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));

      const byProd = new Map<string, number>();
      qSales.forEach(s => {
        const name = s.product || 'Sem produto';
        byProd.set(name, (byProd.get(name) || 0) + s.base_value);
      });
      const products: NamedValue[] = [...byProd.entries()].sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));

      return { label: q.label, range: q.range, entradas: ent, saidas: sai, resultado, margem, ivaCobrado, ivaPago, ivaBalanco, ss, clients: clientSet.size, categories, products, numSales: qSales.length, numExpenses: qExpenses.length };
    });
  }, [yearSales, yearExpenses]);

  const totals = useMemo<QuarterTotals>(() => {
    const ent = data.reduce((s, d) => s + d.entradas, 0);
    const sai = data.reduce((s, d) => s + d.saidas, 0);
    const res = ent - sai;
    return {
      entradas: ent, saidas: sai, resultado: res,
      margem: ent > 0 ? Math.round(res / ent * 10000) / 100 : 0,
      ivaCobrado: data.reduce((s, d) => s + d.ivaCobrado, 0),
      ivaPago: data.reduce((s, d) => s + d.ivaPago, 0),
      ivaBalanco: data.reduce((s, d) => s + d.ivaBalanco, 0),
      ss: data.reduce((s, d) => s + d.ss, 0),
    };
  }, [data]);

  const monthlyData = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const ent = yearSales.filter(s => s.sale_month === m).reduce((s, v) => s + v.base_value, 0);
      const sai = yearExpenses.filter(e => e.expense_month === m).reduce((s, v) => s + v.base_value, 0);
      return { mes: ML[i], entradas: ent, saidas: sai, resultado: ent - sai };
    });
  }, [yearSales, yearExpenses]);

  const allCategories = useMemo<NamedValue[]>(() => {
    const byCat = new Map<string, number>();
    yearExpenses.forEach(e => {
      const cat = expenseLabel(e.category || 'outro');
      byCat.set(cat, (byCat.get(cat) || 0) + e.base_value);
    });
    return [...byCat.entries()].sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));
  }, [yearExpenses]);

  const allProducts = useMemo<NamedValue[]>(() => {
    const byProd = new Map<string, number>();
    yearSales.forEach(s => {
      const name = s.product || 'Sem produto';
      byProd.set(name, (byProd.get(name) || 0) + s.base_value);
    });
    return [...byProd.entries()].sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));
  }, [yearSales]);

  const selectedData = selectedQ === 'todos' ? null : data.find(d => d.label === selectedQ) || null;
  const selectedQDef: QuarterDef | null = selectedQ === 'todos' ? null : QUARTERS.find(q => q.label === selectedQ) || null;

  const selectedMonthlyData = useMemo(() => {
    if (!selectedQDef) return [];
    return selectedQDef.months.map(m => {
      const entCom = sumRevenue(yearSales.filter(s => s.sale_month === m));
      const entBase = yearSales.filter(s => s.sale_month === m).reduce((s, v) => s + v.base_value, 0);
      const saiCom = yearExpenses.filter(e => e.expense_month === m).reduce((s, v) => s + v.total_with_vat, 0);
      const saiBase = yearExpenses.filter(e => e.expense_month === m).reduce((s, v) => s + v.base_value, 0);
      return { mes: ML[m - 1], entradas: entBase, saidas: saiBase, resultado: entBase - saiBase, ivaCobrado: entCom - entBase, ivaPago: saiCom - saiBase };
    });
  }, [selectedQDef, yearSales, yearExpenses]);

  const filteredProducts = useMemo<NamedValue[]>(() => {
    if (!selectedQDef) return allProducts;
    const byProd = new Map<string, number>();
    yearSales.filter(s => selectedQDef.months.includes(s.sale_month || 0)).forEach(s => {
      const name = s.product || 'Sem produto';
      byProd.set(name, (byProd.get(name) || 0) + s.base_value);
    });
    return [...byProd.entries()].sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));
  }, [selectedQDef, yearSales, allProducts]);

  const filteredCategories = useMemo<NamedValue[]>(() => {
    if (!selectedQDef) return allCategories;
    const byCat = new Map<string, number>();
    yearExpenses.filter(e => selectedQDef.months.includes(e.expense_month || 0)).forEach(e => {
      const cat = expenseLabel(e.category || 'outro');
      byCat.set(cat, (byCat.get(cat) || 0) + e.base_value);
    });
    return [...byCat.entries()].sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));
  }, [selectedQDef, yearExpenses, allCategories]);

  const bestQuarter = data.reduce((best, d) => d.resultado > best.resultado ? d : best, data[0]);
  const worstQuarter = data.reduce((worst, d) => d.resultado < worst.resultado ? d : worst, data[0]);

  return { data, totals, monthlyData, allCategories, allProducts, selectedData, selectedQDef, selectedMonthlyData, filteredProducts, filteredCategories, bestQuarter, worstQuarter };
}
