import { describe, it, expect } from 'vitest';
import { getSubscriptionOccurrences } from './useFinancialData';

describe('getSubscriptionOccurrences', () => {
  it('returns 0 for null start date', () => {
    expect(getSubscriptionOccurrences(null, 'mensal', 4, 2026)).toBe(0);
  });

  it('returns 0 for months before start', () => {
    expect(getSubscriptionOccurrences('2026-04-01', 'mensal', 3, 2026)).toBe(0);
    expect(getSubscriptionOccurrences('2026-04-01', 'mensal', 12, 2025)).toBe(0);
  });

  it('mensal: returns 1 for every month from start', () => {
    expect(getSubscriptionOccurrences('2026-04-01', 'mensal', 4, 2026)).toBe(1);
    expect(getSubscriptionOccurrences('2026-04-01', 'mensal', 5, 2026)).toBe(1);
    expect(getSubscriptionOccurrences('2026-04-01', 'mensal', 12, 2026)).toBe(1);
    expect(getSubscriptionOccurrences('2026-04-01', 'mensal', 1, 2027)).toBe(1);
  });

  it('trimestral: returns 1 every 3 months from start', () => {
    expect(getSubscriptionOccurrences('2026-01-01', 'trimestral', 1, 2026)).toBe(1);
    expect(getSubscriptionOccurrences('2026-01-01', 'trimestral', 2, 2026)).toBe(0);
    expect(getSubscriptionOccurrences('2026-01-01', 'trimestral', 4, 2026)).toBe(1);
    expect(getSubscriptionOccurrences('2026-01-01', 'trimestral', 7, 2026)).toBe(1);
  });

  it('anual: returns 1 only on anniversary month', () => {
    expect(getSubscriptionOccurrences('2026-04-01', 'anual', 4, 2026)).toBe(1);
    expect(getSubscriptionOccurrences('2026-04-01', 'anual', 5, 2026)).toBe(0);
    expect(getSubscriptionOccurrences('2026-04-01', 'anual', 4, 2027)).toBe(1);
  });

  it('semestral: returns 1 every 6 months', () => {
    expect(getSubscriptionOccurrences('2026-01-01', 'semestral', 1, 2026)).toBe(1);
    expect(getSubscriptionOccurrences('2026-01-01', 'semestral', 3, 2026)).toBe(0);
    expect(getSubscriptionOccurrences('2026-01-01', 'semestral', 7, 2026)).toBe(1);
  });
});
