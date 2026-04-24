import type { Expense } from '@/hooks/useFinancialData';

export type TrimSale = {
  invoice_total: number;
  base_value: number;
  sale_month: number | null;
  sale_year: number | null;
  product?: string | null;
  client?: string | null;
};

export type TrimExpense = Expense;

export interface QuarterDef {
  label: string;
  range: string;
  months: number[];
}

export interface NamedValue {
  name: string;
  value: number;
}

export interface QuarterData {
  label: string;
  range: string;
  entradas: number;
  saidas: number;
  resultado: number;
  margem: number;
  ivaCobrado: number;
  ivaPago: number;
  ivaBalanco: number;
  ss: number;
  clients: number;
  categories: NamedValue[];
  products: NamedValue[];
  numSales: number;
  numExpenses: number;
}

export interface QuarterTotals {
  entradas: number;
  saidas: number;
  resultado: number;
  margem: number;
  ivaCobrado: number;
  ivaPago: number;
  ivaBalanco: number;
  ss: number;
}

export const QUARTERS: QuarterDef[] = [
  { label: 'T1', range: 'Jan — Mar', months: [1, 2, 3] },
  { label: 'T2', range: 'Abr — Jun', months: [4, 5, 6] },
  { label: 'T3', range: 'Jul — Set', months: [7, 8, 9] },
  { label: 'T4', range: 'Out — Dez', months: [10, 11, 12] },
];

export const ML = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export const PIE_COLORS = ['hsl(var(--primary))', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#6366f1'];
