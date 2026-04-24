import type { RecurringExpense } from '@/hooks/useFinancialData';
import { getSubscriptionOccurrences } from '@/hooks/useFinancialData';

export const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
export const VAT_RATES = [0, 6, 13, 23];

/**
 * Short labels used in payroll table rows.
 * Long labels live in `useTeamData.CONTRACT_TYPES` and are used in forms / detail views.
 */
export const CONTRACT_TYPE_LABELS: Record<string, string> = {
  contrato_trabalho: 'Colaborador',
  contrato_prestacao: 'Prestador',
  prestacao_servicos: 'Prestador', // legacy alias
  acordo: 'Acordo',
  outro: 'Ordenado',
};

export function parseDateString(value: string | null | undefined) {
  if (!value) return null;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

export function getSubscriptionDueDate(subscription: RecurringExpense, month: number, year: number) {
  const startDate = parseDateString(subscription.expense_date);
  const fallbackDay = startDate?.getDate() ?? 15;
  const targetDay = subscription.recurrence_day || fallbackDay;
  const lastDayOfMonth = new Date(year, month, 0).getDate();
  const safeDay = Math.min(targetDay, lastDayOfMonth);

  return `${year}-${String(month).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`;
}

export function canRenderSubscriptionForMonth(subscription: RecurringExpense, month: number, year: number) {
  if (subscription.status === 'cancelado' || !subscription.periodicity) return false;
  if (getSubscriptionOccurrences(subscription.expense_date, subscription.periodicity, month, year) <= 0) return false;

  if (!subscription.recurrence_end_date) return true;

  return getSubscriptionDueDate(subscription, month, year) <= subscription.recurrence_end_date;
}

export type Sale = { invoice_total: number; base_value: number; sale_month: number | null; sale_year: number | null; product?: string | null; client?: string | null; description?: string | null; status?: string };