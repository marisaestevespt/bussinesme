import { describe, it, expect } from 'vitest';
import {
  getAutoExpenseStatus,
  normalizeUnpaidExpenseStatus,
  isPaidExpenseStatus,
  PAID_EXPENSE_STATUSES,
  OPEN_EXPENSE_STATUSES,
} from './expenseStatus';

describe('isPaidExpenseStatus', () => {
  it('returns true for paid statuses', () => {
    expect(isPaidExpenseStatus('pago_falta_fatura')).toBe(true);
    expect(isPaidExpenseStatus('tudo_ok')).toBe(true);
  });
  it('returns false for unpaid statuses', () => {
    expect(isPaidExpenseStatus('por_pagar')).toBe(false);
    expect(isPaidExpenseStatus('pendente')).toBe(false);
    expect(isPaidExpenseStatus('em_atraso')).toBe(false);
    expect(isPaidExpenseStatus(null)).toBe(false);
    expect(isPaidExpenseStatus(undefined)).toBe(false);
  });
});

describe('getAutoExpenseStatus', () => {
  const april2026 = new Date(2026, 3, 15); // April 15, 2026

  it('returns pendente for current month', () => {
    expect(getAutoExpenseStatus('2026-04-18', april2026)).toBe('pendente');
    expect(getAutoExpenseStatus('2026-04-01', april2026)).toBe('pendente');
  });

  it('returns pendente for past months', () => {
    expect(getAutoExpenseStatus('2026-03-15', april2026)).toBe('pendente');
    expect(getAutoExpenseStatus('2025-12-01', april2026)).toBe('pendente');
  });

  it('returns por_pagar for future months', () => {
    expect(getAutoExpenseStatus('2026-05-01', april2026)).toBe('por_pagar');
    expect(getAutoExpenseStatus('2026-12-15', april2026)).toBe('por_pagar');
    expect(getAutoExpenseStatus('2027-01-01', april2026)).toBe('por_pagar');
  });

  it('returns por_pagar for null/invalid dates', () => {
    expect(getAutoExpenseStatus(null, april2026)).toBe('por_pagar');
    expect(getAutoExpenseStatus(undefined, april2026)).toBe('por_pagar');
    expect(getAutoExpenseStatus('invalid', april2026)).toBe('por_pagar');
  });
});

describe('normalizeUnpaidExpenseStatus', () => {
  const april2026 = new Date(2026, 3, 15);
  const origNow = Date.now;
  
  beforeEach(() => {
    // Mock Date.now so getAutoExpenseStatus uses our date
    vi.useFakeTimers();
    vi.setSystemTime(april2026);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('recalculates for null status', () => {
    expect(normalizeUnpaidExpenseStatus(null, '2026-04-18')).toBe('pendente');
    expect(normalizeUnpaidExpenseStatus(null, '2026-06-01')).toBe('por_pagar');
  });

  it('recalculates for open statuses', () => {
    // April expense wrongly set to por_pagar should become pendente
    expect(normalizeUnpaidExpenseStatus('por_pagar', '2026-04-18')).toBe('pendente');
    // Future expense wrongly set to pendente should become por_pagar
    expect(normalizeUnpaidExpenseStatus('pendente', '2026-06-01')).toBe('por_pagar');
  });

  it('preserves paid statuses regardless of date', () => {
    expect(normalizeUnpaidExpenseStatus('tudo_ok', '2026-06-01')).toBe('tudo_ok');
    expect(normalizeUnpaidExpenseStatus('pago_falta_fatura', '2026-04-18')).toBe('pago_falta_fatura');
  });

  it('preserves cancelado status', () => {
    expect(normalizeUnpaidExpenseStatus('cancelado', '2026-04-18')).toBe('cancelado');
  });
});
