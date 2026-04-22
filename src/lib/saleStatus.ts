/**
 * Canonical source of truth for sale / financial entry statuses.
 * Used by commercial_sales rows across financial entries and project payments.
 */

export const SALE_STATUSES = [
  { value: 'aguarda_pagamento', label: 'Aguarda Pagamento', cls: 'bg-muted text-muted-foreground border-muted', color: 'bg-muted text-muted-foreground border-muted' },
  { value: 'por_pagar',         label: 'Por Pagar',          cls: 'bg-muted text-muted-foreground border-muted', color: 'bg-muted text-muted-foreground border-muted' },
  { value: 'pendente',          label: 'Pendente',           cls: 'bg-warning/10 text-warning border-warning/30', color: 'bg-warning/15 text-warning border-warning/30' },
  { value: 'em_atraso',         label: 'Em Atraso',          cls: 'bg-destructive/10 text-destructive border-destructive/30', color: 'bg-destructive/15 text-destructive border-destructive/30' },
  { value: 'pago_falta_fatura', label: 'Pago, Falta Fatura', cls: 'bg-info/10 text-info border-info/30', color: 'bg-info/15 text-info border-info/30' },
  { value: 'pago',              label: 'Pago',               cls: 'bg-success/10 text-success border-success/30', color: 'bg-success/15 text-success border-success/30' },
  { value: 'tudo_ok',           label: 'Tudo OK',            cls: 'bg-success/10 text-success border-success/30', color: 'bg-success/15 text-success border-success/30' },
  { value: 'cancelado',         label: 'Cancelado',          cls: 'bg-muted text-muted-foreground border-muted', color: 'bg-muted text-muted-foreground border-muted' },
] as const;

export type SaleStatus = typeof SALE_STATUSES[number]['value'];

export const PAID_SALE_STATUSES: SaleStatus[] = ['pago', 'tudo_ok'];
export const PENDING_SALE_STATUSES: SaleStatus[] = ['aguarda_pagamento', 'por_pagar', 'pendente', 'pago_falta_fatura'];
export const OVERDUE_SALE_STATUSES: SaleStatus[] = ['em_atraso'];

export function getSaleStatusInfo(status: string) {
  return SALE_STATUSES.find(s => s.value === status)
      || { value: status, label: status, cls: 'bg-muted text-muted-foreground border-muted', color: 'bg-muted text-muted-foreground border-muted' };
}

/** Returns the effective status, auto-upgrading to 'em_atraso' when overdue */
export function getEffectiveSaleStatus(status: string, paymentDate: string | null): string {
  if ((status === 'por_pagar' || status === 'pendente' || status === 'aguarda_pagamento') && paymentDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(paymentDate);
    due.setHours(0, 0, 0, 0);
    if (due < today) return 'em_atraso';
  }
  return status;
}
