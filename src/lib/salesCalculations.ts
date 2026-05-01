/**
 * Centralized sales / revenue calculations.
 *
 * Single source of truth for revenue aggregation across:
 *   - Financial views (FinMensal, FinEntradas, FinIVA, FinTrimestral)
 *   - Commercial views (CommercialOverview, ComercialAnalise, ProductSalesTab)
 *   - Client analytics (ClienteDetail, ClientesAnalise)
 *
 * Why this exists: 30+ files independently called `Number(s.invoice_total || 0)`
 * with subtle variations (some used `base_value` fallback, some skipped
 * cancelled, some forgot status filtering). Centralize here.
 */

export interface SaleLike {
  invoice_total?: number | null;
  base_value?: number | null;
  status?: string | null;
  sale_year?: number | null;
  sale_month?: number | null;
  product?: string | null;
  product_id?: string | null;
  client?: string | null;
}

/**
 * Canonical revenue value for a single sale (with VAT).
 * Falls back to base_value if invoice_total is missing (legacy rows).
 */
export function saleRevenue(sale: SaleLike): number {
  const total = Number(sale?.invoice_total || 0);
  if (total > 0) return total;
  return Number(sale?.base_value || 0);
}

/** Canonical base value (without VAT) for a sale. */
export function saleBase(sale: SaleLike): number {
  return Number(sale?.base_value || 0);
}

/** VAT amount (€) for a single sale. */
export function saleVat(sale: SaleLike): number {
  return saleRevenue(sale) - saleBase(sale);
}

/** Sum revenue across a list. */
export function sumRevenue(sales: SaleLike[]): number {
  return sales.reduce((acc, s) => acc + saleRevenue(s), 0);
}

/** Sum base values across a list. */
export function sumBase(sales: SaleLike[]): number {
  return sales.reduce((acc, s) => acc + saleBase(s), 0);
}

/** Sum VAT collected across a list. */
export function sumVat(sales: SaleLike[]): number {
  return sales.reduce((acc, s) => acc + saleVat(s), 0);
}

/** Filter sales by a given year. */
export function salesInYear<T extends SaleLike>(sales: T[], year: number): T[] {
  return sales.filter(s => s.sale_year === year);
}

/** Filter sales by year + month. */
export function salesInMonth<T extends SaleLike>(sales: T[], year: number, month: number): T[] {
  return sales.filter(s => s.sale_year === year && s.sale_month === month);
}

/** Filter sales by year + quarter (1..4). */
export function salesInQuarter<T extends SaleLike>(sales: T[], year: number, quarter: number): T[] {
  const start = (quarter - 1) * 3 + 1;
  const end = start + 2;
  return sales.filter(s =>
    s.sale_year === year && s.sale_month != null && s.sale_month >= start && s.sale_month <= end
  );
}

/** Average ticket = revenue / count (rounded to nearest €). */
export function averageTicket(sales: SaleLike[]): number {
  if (sales.length === 0) return 0;
  return Math.round(sumRevenue(sales) / sales.length);
}

/** Group revenue by an arbitrary key (e.g. product, client, month). */
export function revenueGroupedBy<T extends SaleLike>(
  sales: T[],
  keyFn: (s: T) => string | null | undefined,
  fallbackKey = 'Sem categoria',
): Map<string, number> {
  const map = new Map<string, number>();
  sales.forEach(s => {
    const k = keyFn(s) || fallbackKey;
    map.set(k, (map.get(k) || 0) + saleRevenue(s));
  });
  return map;
}

/** Count of paid sales (tudo_ok or pago_falta_fatura). */
export function paidSales<T extends SaleLike>(sales: T[]): T[] {
  return sales.filter(s => s.status === 'tudo_ok' || s.status === 'pago_falta_fatura' || s.status === 'pago');
}

/** Count of pending sales (anything not paid and not cancelled). */
export function pendingSales<T extends SaleLike>(sales: T[]): T[] {
  return sales.filter(s =>
    s.status !== 'tudo_ok' &&
    s.status !== 'pago_falta_fatura' &&
    s.status !== 'pago' &&
    s.status !== 'cancelada' &&
    s.status !== 'cancelado'
  );
}
