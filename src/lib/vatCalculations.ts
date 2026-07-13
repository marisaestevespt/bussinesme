import type { Expense } from '@/hooks/useFinancialData';

type SaleLike = {
  invoice_total: number;
  base_value: number;
  sale_year?: number | null;
  sale_month?: number | null;
};

type ExpenseLike = Pick<Expense, 'total_with_vat' | 'base_value'> & {
  vat_deductible_amount?: number | null;
  expense_year?: number | null;
  expense_month?: number | null;
  location?: string | null;
};

export type ExpenseTotalsLike = ExpenseLike;

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * IVA pago numa única despesa (total - base, nunca negativo).
 */
export function ivaPagoOf(expense: ExpenseLike): number {
  return Math.max(0, (expense.total_with_vat || 0) - (expense.base_value || 0));
}

/**
 * IVA dedutível numa única despesa.
 * Se vat_deductible_amount estiver definido, usa esse valor.
 * Caso contrário, assume 100% do IVA pago.
 */
export function ivaDeduzirOf(expense: ExpenseLike): number {
  const ded = expense.vat_deductible_amount;
  if (ded != null && !isNaN(Number(ded))) return Number(ded);
  return ivaPagoOf(expense);
}

/**
 * Totais de IVA para um conjunto de despesas.
 */
export function computeVatForExpenses(expenses: ExpenseLike[]) {
  let totalSaidas = 0;
  let totalBase = 0;
  let ivaPago = 0;
  let ivaDeduzir = 0;
  for (const e of expenses) {
    totalSaidas += e.total_with_vat || 0;
    totalBase += e.base_value || 0;
    ivaPago += ivaPagoOf(e);
    ivaDeduzir += ivaDeduzirOf(e);
  }
  return {
    totalSaidas: r2(totalSaidas),
    totalBase: r2(totalBase),
    ivaPago: r2(ivaPago),
    ivaDeduzir: r2(ivaDeduzir),
  };
}

/**
 * IVA cobrado num conjunto de vendas (invoice_total - base_value).
 */
export function computeVatForSales(sales: SaleLike[]) {
  let totalEntradas = 0;
  let totalBase = 0;
  for (const s of sales) {
    totalEntradas += s.invoice_total || 0;
    totalBase += s.base_value || 0;
  }
  return {
    totalEntradas: r2(totalEntradas),
    totalBase: r2(totalBase),
    ivaCobrado: r2(totalEntradas - totalBase),
  };
}

/**
 * Balanço de IVA = IVA Cobrado − IVA a Deduzir.
 * Positivo: a entregar ao Estado.
 * Negativo: a recuperar.
 */
export function computeVatBalance(sales: SaleLike[], expenses: ExpenseLike[]) {
  const { ivaCobrado } = computeVatForSales(sales);
  const { ivaPago, ivaDeduzir } = computeVatForExpenses(expenses);
  return {
    ivaCobrado,
    ivaPago,
    ivaDeduzir,
    balanco: r2(ivaCobrado - ivaDeduzir),
  };
}

/**
 * Filtra vendas/despesas por (ano, mês).
 */
export function filterByMonth<T extends { sale_year?: number | null; sale_month?: number | null } | { expense_year?: number | null; expense_month?: number | null }>(
  items: T[],
  year: number,
  month: number,
): T[] {
  return items.filter((it) => {
    const r = it as { sale_year?: number | null; sale_month?: number | null; expense_year?: number | null; expense_month?: number | null };
    const y = r.sale_year ?? r.expense_year;
    const mo = r.sale_month ?? r.expense_month;
    return y === year && mo === month;
  });
}
