/**
 * Centralized financial health math.
 *
 * Unifies: recurring-product detection, MRR calculation, revenue concentration,
 * and gained/lost recurring revenue (churn). All callers should use these helpers
 * instead of duplicating `product_type === 'servico_mensal'` logic inline.
 */

/** Product types considered "recurring" (monthly retainer-like). */
export const RECURRING_PRODUCT_TYPES = ['servico_mensal'] as const;

/**
 * Re-export from canonical clientStatus module to avoid drift.
 * The previous local list incorrectly included 'cancelado' and 'concluido'
 * which are project statuses, not client statuses.
 */
import { MRR_CLIENT_STATUSES, ARCHIVED_CLIENT_STATUSES } from './clientStatus';

/** Client statuses considered "active" for MRR purposes. */
export const ACTIVE_CLIENT_STATUSES = MRR_CLIENT_STATUSES;

/** Client statuses that mean the client lifecycle has ended. */
export const TERMINATED_CLIENT_STATUSES = ARCHIVED_CLIENT_STATUSES;

/** Threshold above which a single client's revenue share triggers a concentration alert. */
export const CONCENTRATION_ALERT_PCT = 30;

export type ProductLike = {
  id?: string;
  name?: string | null;
  product_type?: string | null;
  ticket?: string | number | null;
};

export type ClientLike = {
  status?: string | null;
  current_product?: string | null;
  start_date?: string | null;
  end_of_cycle?: string | null;
};

export type SaleLike = {
  invoice_total?: number | string | null;
  base_value?: number | string | null;
  client?: string | null;
};

/** Parses a product ticket string ("350", "350,00", "350.00 €") into a number. Returns 0 when invalid. */
export function parseTicket(raw: string | number | null | undefined): number {
  if (raw == null) return 0;
  if (typeof raw === 'number') return isFinite(raw) ? raw : 0;
  const cleaned = String(raw).replace(/[^\d.,-]/g, '').replace(',', '.');
  const n = parseFloat(cleaned);
  return isFinite(n) ? n : 0;
}

/** True when the product is a recurring service. */
export function isRecurringProduct(p: ProductLike | null | undefined): boolean {
  if (!p?.product_type) return false;
  return (RECURRING_PRODUCT_TYPES as readonly string[]).includes(p.product_type);
}

/** True when the client status is considered active. */
export function isActiveClient(c: ClientLike | null | undefined): boolean {
  if (!c?.status) return false;
  return (ACTIVE_CLIENT_STATUSES as readonly string[]).includes(c.status);
}

/** True when the client lifecycle has ended (terminado / cancelado / concluido). */
export function isTerminatedClient(c: ClientLike | null | undefined): boolean {
  if (!c?.status) return false;
  return (TERMINATED_CLIENT_STATUSES as readonly string[]).includes(c.status);
}

/** Builds a name → ticket map for recurring products. */
export function recurringProductTickets(products: ProductLike[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const p of products) {
    if (!p.name || !isRecurringProduct(p)) continue;
    map.set(p.name, parseTicket(p.ticket));
  }
  return map;
}

/** Returns the recurring ticket value for a client based on its current_product, or 0. */
export function clientRecurringTicket(
  client: ClientLike,
  recurringMap: Map<string, number>,
): number {
  if (!client.current_product) return 0;
  return recurringMap.get(client.current_product) || 0;
}

/**
 * MRR = sum of recurring product tickets for currently active clients.
 * Returns total + count of contributing clients.
 */
export function calculateMRR(
  clients: ClientLike[],
  products: ProductLike[],
): { total: number; count: number } {
  const recurringMap = recurringProductTickets(products);
  const recurringNames = new Set(recurringMap.keys());
  const contributing = clients.filter(
    c => isActiveClient(c) && c.current_product && recurringNames.has(c.current_product),
  );
  const total = contributing.reduce(
    (sum, c) => sum + clientRecurringTicket(c, recurringMap),
    0,
  );
  return { total, count: contributing.length };
}

/**
 * Forecast for an upcoming month: sum of recurring tickets for clients still
 * active by that month's end (no end_of_cycle, or end_of_cycle after monthEnd).
 */
export function forecastRecurringRevenue(
  clients: ClientLike[],
  products: ProductLike[],
  monthEnd: Date,
): { total: number; count: number } {
  const recurringMap = recurringProductTickets(products);
  const recurringNames = new Set(recurringMap.keys());
  // Mês previsto = [primeiro dia, último dia]. Incluímos clientes cujo ciclo
  // ainda esteja ativo em qualquer dia do mês (end_of_cycle >= monthStart),
  // porque mesmo terminando a meio do mês a mensalidade desse mês é cobrada.
  const monthStart = new Date(monthEnd.getFullYear(), monthEnd.getMonth(), 1);
  const contributing = clients.filter(c => {
    if (!isActiveClient(c) || !c.current_product) return false;
    if (!recurringNames.has(c.current_product)) return false;
    if (c.end_of_cycle) {
      try {
        return new Date(c.end_of_cycle) >= monthStart;
      } catch {
        return true;
      }
    }
    return true;
  });
  const total = contributing.reduce(
    (sum, c) => sum + clientRecurringTicket(c, recurringMap),
    0,
  );
  return { total, count: contributing.length };
}

/**
 * Revenue churn for a given month window: gained vs lost recurring revenue.
 * - lostClients: terminated and end_of_cycle within window
 * - gainedClients: active and start_date within window
 */
export function recurringChurn(
  clients: ClientLike[],
  products: ProductLike[],
  monthStart: Date,
  monthEnd: Date,
): {
  lostRevenue: number;
  lostCount: number;
  gainedRevenue: number;
  gainedCount: number;
  net: number;
} {
  const recurringMap = recurringProductTickets(products);
  const inWindow = (raw: string) => {
    try {
      const d = new Date(raw);
      return d >= monthStart && d <= monthEnd;
    } catch {
      return false;
    }
  };

  const lostClients = clients.filter(
    c => c.status === 'terminado' && c.end_of_cycle && inWindow(c.end_of_cycle),
  );
  const newClients = clients.filter(
    c => isActiveClient(c) && c.start_date && inWindow(c.start_date),
  );

  const lostRevenue = lostClients.reduce(
    (sum, c) => sum + clientRecurringTicket(c, recurringMap),
    0,
  );
  const gainedRevenue = newClients.reduce(
    (sum, c) => sum + clientRecurringTicket(c, recurringMap),
    0,
  );

  return {
    lostRevenue,
    lostCount: lostClients.length,
    gainedRevenue,
    gainedCount: newClients.length,
    net: gainedRevenue - lostRevenue,
  };
}

/**
 * Revenue concentration by client. Returns sorted entries (desc) and alerts
 * for clients above CONCENTRATION_ALERT_PCT.
 */
export type ConcentrationEntry = { name: string; value: number; pct: number };

export function revenueConcentration(
  sales: SaleLike[],
  alertThresholdPct: number = CONCENTRATION_ALERT_PCT,
): {
  total: number;
  entries: ConcentrationEntry[];
  topClients: ConcentrationEntry[];
  alerts: ConcentrationEntry[];
} {
  const saleBase = (sale: SaleLike) => Number(sale.base_value) || 0;
  const totalRevenue = sales.reduce((s, sale) => s + saleBase(sale), 0);
  if (totalRevenue === 0) {
    return { total: 0, entries: [], topClients: [], alerts: [] };
  }

  const byClient = new Map<string, number>();
  for (const sale of sales) {
    const name = sale.client || 'Sem cliente';
    byClient.set(name, (byClient.get(name) || 0) + saleBase(sale));
  }

  const entries: ConcentrationEntry[] = [...byClient.entries()]
    .map(([name, value]) => ({ name, value, pct: (value / totalRevenue) * 100 }))
    .sort((a, b) => b.value - a.value);

  return {
    total: totalRevenue,
    entries,
    topClients: entries.slice(0, 3),
    alerts: entries.filter(c => c.pct > alertThresholdPct),
  };
}
