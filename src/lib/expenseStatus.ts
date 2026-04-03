export const PAID_EXPENSE_STATUSES = ['pago_falta_fatura', 'tudo_ok'] as const;

export const OPEN_EXPENSE_STATUSES = ['por_pagar', 'pendente', 'em_atraso'] as const;

export function isPaidExpenseStatus(status?: string | null) {
  return !!status && PAID_EXPENSE_STATUSES.includes(status as (typeof PAID_EXPENSE_STATUSES)[number]);
}

export function getAutoExpenseStatus(date: string | Date | null | undefined, now = new Date()) {
  if (!date) return 'por_pagar';

  const parsed = typeof date === 'string'
    ? new Date(`${date}T00:00:00`)
    : date;

  if (!(parsed instanceof Date) || Number.isNaN(parsed.getTime())) {
    return 'por_pagar';
  }

  const targetYear = parsed.getFullYear();
  const targetMonth = parsed.getMonth() + 1;
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  return targetYear < currentYear || (targetYear === currentYear && targetMonth <= currentMonth)
    ? 'pendente'
    : 'por_pagar';
}

export function normalizeUnpaidExpenseStatus(status: string | null | undefined, date: string | Date | null | undefined) {
  if (!status || OPEN_EXPENSE_STATUSES.includes(status as (typeof OPEN_EXPENSE_STATUSES)[number])) {
    return getAutoExpenseStatus(date);
  }

  return status;
}