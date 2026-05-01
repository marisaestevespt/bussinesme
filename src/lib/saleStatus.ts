/**
 * Canonical source of truth for sale / financial entry statuses.
 * Used by commercial_sales rows across financial entries and project payments.
 */

export const SALE_STATUSES = [
  { value: 'aguarda_pagamento', label: 'Aguarda Pagamento', cls: 'bg-muted text-muted-foreground border-muted', color: 'bg-muted text-muted-foreground border-muted' },
  { value: 'em_atraso',         label: 'Em Atraso',          cls: 'bg-destructive/10 text-destructive border-destructive/30', color: 'bg-destructive/15 text-destructive border-destructive/30' },
  { value: 'pago_falta_fatura', label: 'Pago, Falta Fatura', cls: 'bg-info/10 text-info border-info/30', color: 'bg-info/15 text-info border-info/30' },
  { value: 'tudo_ok',           label: 'Tudo OK',            cls: 'bg-success/10 text-success border-success/30', color: 'bg-success/15 text-success border-success/30' },
  { value: 'cancelado',         label: 'Cancelado',          cls: 'bg-muted text-muted-foreground border-muted', color: 'bg-muted text-muted-foreground border-muted' },
] as const;

export type SaleStatus = typeof SALE_STATUSES[number]['value'];

export const PAID_SALE_STATUSES: SaleStatus[] = ['tudo_ok', 'pago_falta_fatura'];
export const PENDING_SALE_STATUSES: SaleStatus[] = ['aguarda_pagamento'];
export const OVERDUE_SALE_STATUSES: SaleStatus[] = ['em_atraso'];

/** Legacy → canonical status map. Apply when reading rows that may still hold old values. */
const LEGACY_STATUS_MAP: Record<string, SaleStatus> = {
  por_pagar: 'aguarda_pagamento',
  pendente: 'aguarda_pagamento',
  pago: 'tudo_ok',
  cancelada: 'cancelado',
  anulado: 'cancelado',
};

export function normalizeSaleStatus(status: string | null | undefined): string {
  if (!status) return 'aguarda_pagamento';
  return LEGACY_STATUS_MAP[status] ?? status;
}

export function getSaleStatusInfo(status: string) {
  const canonical = normalizeSaleStatus(status);
  return SALE_STATUSES.find(s => s.value === canonical)
      || { value: status, label: status, cls: 'bg-muted text-muted-foreground border-muted', color: 'bg-muted text-muted-foreground border-muted' };
}

/** Returns the effective status, auto-upgrading to 'em_atraso' when overdue */
export function getEffectiveSaleStatus(status: string, paymentDate: string | null): string {
  const canonical = normalizeSaleStatus(status);
  if (canonical === 'aguarda_pagamento' && paymentDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(paymentDate);
    due.setHours(0, 0, 0, 0);
    if (due < today) return 'em_atraso';
  }
  return canonical;
}
