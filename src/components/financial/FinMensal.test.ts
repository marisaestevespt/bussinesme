import { describe, it, expect } from 'vitest';

interface SubscriptionLike {
  expense_date?: string | null;
  renewal_date?: string | null;
  periodicity?: string | null;
  status?: string | null;
  recurrence_end_date?: string | null;
  recurrence_day?: number | null;
}

// Inline the pure functions from FinMensal to test them
function parseDateString(value: string | null | undefined) {
  if (!value) return null;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function getSubscriptionDueDate(subscription: SubscriptionLike, month: number, year: number) {
  const startDate = parseDateString(subscription.renewal_date || subscription.expense_date);
  const fallbackDay = startDate?.getDate() ?? 15;
  const targetDay = subscription.recurrence_day || fallbackDay;
  const lastDayOfMonth = new Date(year, month, 0).getDate();
  const safeDay = Math.min(targetDay, lastDayOfMonth);
  return `${year}-${String(month).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`;
}

// Simplified getSubscriptionOccurrences for test
function getSubscriptionOccurrences(startDate: string | null, periodicity: string, month: number, year: number) {
  if (!startDate) return 0;
  const start = new Date(startDate + 'T00:00:00');
  const startYear = start.getFullYear();
  const startMonth = start.getMonth() + 1;
  if (year < startYear || (year === startYear && month < startMonth)) return 0;
  const monthsDiff = (year - startYear) * 12 + (month - startMonth);
  switch (periodicity) {
    case 'mensal': return 1;
    case 'trimestral': return monthsDiff % 3 === 0 ? 1 : 0;
    case 'anual': return monthsDiff % 12 === 0 ? 1 : 0;
    default: return 1;
  }
}

function canRenderSubscriptionForMonth(subscription: SubscriptionLike, month: number, year: number) {
  if (subscription.status === 'cancelado' || !subscription.periodicity) return false;
  if (getSubscriptionOccurrences(subscription.renewal_date || subscription.expense_date || null, subscription.periodicity, month, year) <= 0) return false;
  if (!subscription.recurrence_end_date) return true;
  return getSubscriptionDueDate(subscription, month, year) <= subscription.recurrence_end_date;
}

describe('canRenderSubscriptionForMonth', () => {
  const activeSub = {
    expense_date: '2026-04-18',
    periodicity: 'mensal',
    status: 'por_pagar',
    recurrence_end_date: null,
    recurrence_day: null,
  };

  it('renders for current and future months when no end date', () => {
    expect(canRenderSubscriptionForMonth(activeSub, 4, 2026)).toBe(true);
    expect(canRenderSubscriptionForMonth(activeSub, 5, 2026)).toBe(true);
    expect(canRenderSubscriptionForMonth(activeSub, 12, 2026)).toBe(true);
  });

  it('does NOT render for months before start', () => {
    expect(canRenderSubscriptionForMonth(activeSub, 3, 2026)).toBe(false);
  });

  it('does NOT render when status is cancelado', () => {
    const cancelled = { ...activeSub, status: 'cancelado' };
    expect(canRenderSubscriptionForMonth(cancelled, 4, 2026)).toBe(false);
    expect(canRenderSubscriptionForMonth(cancelled, 5, 2026)).toBe(false);
  });

  it('respects contract end date', () => {
    const withEnd = { ...activeSub, recurrence_end_date: '2026-11-13' };
    expect(canRenderSubscriptionForMonth(withEnd, 4, 2026)).toBe(true);
    expect(canRenderSubscriptionForMonth(withEnd, 10, 2026)).toBe(true);
    // Nov due date is 18th but contract ends 13th → hidden
    expect(canRenderSubscriptionForMonth(withEnd, 11, 2026)).toBe(false);
    expect(canRenderSubscriptionForMonth(withEnd, 12, 2026)).toBe(false);
  });

  it('does NOT render when periodicity is null', () => {
    const noPeriod = { ...activeSub, periodicity: null };
    expect(canRenderSubscriptionForMonth(noPeriod, 4, 2026)).toBe(false);
  });

  it('uses renewal_date as the annual anchor for template rules', () => {
    const annualRule = {
      expense_date: null,
      renewal_date: '2026-01-13',
      periodicity: 'anual',
      status: 'por_pagar',
      recurrence_end_date: null,
      recurrence_day: null,
    };
    expect(canRenderSubscriptionForMonth(annualRule, 1, 2026)).toBe(true);
    expect(canRenderSubscriptionForMonth(annualRule, 5, 2026)).toBe(false);
    expect(canRenderSubscriptionForMonth(annualRule, 1, 2027)).toBe(true);
  });

  it('reactivation: new rule with active status renders again', () => {
    // After cancelling, user creates a new rule starting June
    const reactivated = {
      expense_date: '2026-06-01',
      periodicity: 'mensal',
      status: 'por_pagar',
      recurrence_end_date: null,
      recurrence_day: null,
    };
    // Old cancelled rule doesn't render
    const cancelled = { ...activeSub, status: 'cancelado' };
    expect(canRenderSubscriptionForMonth(cancelled, 6, 2026)).toBe(false);
    // New active rule renders
    expect(canRenderSubscriptionForMonth(reactivated, 6, 2026)).toBe(true);
    expect(canRenderSubscriptionForMonth(reactivated, 7, 2026)).toBe(true);
  });
});

describe('getSubscriptionDueDate', () => {
  it('uses recurrence_day when set', () => {
    const sub = { expense_date: '2026-04-18', recurrence_day: 5 };
    expect(getSubscriptionDueDate(sub, 5, 2026)).toBe('2026-05-05');
  });

  it('falls back to expense_date day when no recurrence_day', () => {
    const sub = { expense_date: '2026-04-18', recurrence_day: null };
    expect(getSubscriptionDueDate(sub, 5, 2026)).toBe('2026-05-18');
  });

  it('caps day to last day of short months (Feb)', () => {
    const sub = { expense_date: '2026-01-31', recurrence_day: null };
    expect(getSubscriptionDueDate(sub, 2, 2026)).toBe('2026-02-28');
  });
});
