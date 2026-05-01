import type { RecurringExpense } from '@/hooks/useFinancialData';
import { getRecurringAnchorDate, getSubscriptionOccurrences } from '@/hooks/useFinancialData';

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
  const startDate = parseDateString(getRecurringAnchorDate(subscription));
  const fallbackDay = startDate?.getDate() ?? 15;
  const targetDay = subscription.recurrence_day || fallbackDay;
  const lastDayOfMonth = new Date(year, month, 0).getDate();
  const safeDay = Math.min(targetDay, lastDayOfMonth);

  return `${year}-${String(month).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`;
}

export function canRenderSubscriptionForMonth(subscription: RecurringExpense, month: number, year: number) {
  if (subscription.status === 'cancelado' || !subscription.periodicity) return false;
  if (getSubscriptionOccurrences(getRecurringAnchorDate(subscription), subscription.periodicity, month, year) <= 0) return false;

  // Pausa temporária — ocultar enquanto a data de retoma ainda for futura
  // relativamente ao último dia do mês a renderizar.
  // Permite que o sistema mostre/materialize automaticamente quando o mês alvo
  // já é igual ou posterior ao paused_until.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pausedUntil = (subscription as any).paused_until as string | null | undefined;
  const monthEnd = `${year}-${String(month).padStart(2, '0')}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`;
  if (pausedUntil && monthEnd < pausedUntil) return false;

  // Verificar também o estado do FORNECEDOR — se o fornecedor está pausado ou
  // inativo, não devemos renderizar nem materializar despesas para esta regra.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supplier = (subscription as any).suppliers as { is_active?: boolean; paused_until?: string | null } | null | undefined;
  if (supplier) {
    if (supplier.is_active === false) return false;
    if (supplier.paused_until && monthEnd < supplier.paused_until) return false;
  }

  if (!subscription.recurrence_end_date) return true;

  return getSubscriptionDueDate(subscription, month, year) <= subscription.recurrence_end_date;
}

export type Sale = { invoice_total: number; base_value: number; sale_month: number | null; sale_year: number | null; product?: string | null; client?: string | null; description?: string | null; status?: string };