import { describe, it, expect } from 'vitest';
import {
  ivaPagoOf,
  ivaDeduzirOf,
  computeVatForExpenses,
  computeVatForSales,
  computeVatBalance,
  filterByMonth,
} from './vatCalculations';

describe('ivaPagoOf', () => {
  it('returns total - base', () => {
    expect(ivaPagoOf({ total_with_vat: 123, base_value: 100 } as any)).toBe(23);
  });
  it('clamps to 0 when negative', () => {
    expect(ivaPagoOf({ total_with_vat: 80, base_value: 100 } as any)).toBe(0);
  });
  it('handles missing fields', () => {
    expect(ivaPagoOf({} as any)).toBe(0);
  });
});

describe('ivaDeduzirOf', () => {
  it('uses explicit deductible amount', () => {
    expect(ivaDeduzirOf({ total_with_vat: 123, base_value: 100, vat_deductible_amount: 10 } as any)).toBe(10);
  });
  it('falls back to full IVA when not specified', () => {
    expect(ivaDeduzirOf({ total_with_vat: 123, base_value: 100 } as any)).toBe(23);
  });
});

describe('computeVatBalance', () => {
  it('balances IVA cobrado against IVA deduzir', () => {
    const sales = [{ invoice_total: 1230, base_value: 1000 }];
    const expenses = [{ total_with_vat: 246, base_value: 200 } as any];
    const r = computeVatBalance(sales, expenses);
    expect(r.ivaCobrado).toBe(230);
    expect(r.ivaDeduzir).toBe(46);
    expect(r.balanco).toBe(184);
  });

  it('returns negative balance when expenses VAT exceeds sales VAT', () => {
    const r = computeVatBalance(
      [{ invoice_total: 100, base_value: 100 }],
      [{ total_with_vat: 246, base_value: 200 } as any],
    );
    expect(r.balanco).toBe(-46);
  });
});

describe('filterByMonth', () => {
  it('filters sales by year+month', () => {
    const sales = [
      { sale_year: 2026, sale_month: 1 },
      { sale_year: 2026, sale_month: 2 },
      { sale_year: 2025, sale_month: 1 },
    ];
    expect(filterByMonth(sales as any, 2026, 1)).toHaveLength(1);
  });

  it('filters expenses by expense_year/month', () => {
    const exp = [
      { expense_year: 2026, expense_month: 3 },
      { expense_year: 2026, expense_month: 4 },
    ];
    expect(filterByMonth(exp as any, 2026, 3)).toHaveLength(1);
  });
});

describe('computeVatForSales aggregates', () => {
  it('sums entradas and computes IVA cobrado', () => {
    const r = computeVatForSales([
      { invoice_total: 123, base_value: 100 },
      { invoice_total: 246, base_value: 200 },
    ]);
    expect(r.totalEntradas).toBe(369);
    expect(r.totalBase).toBe(300);
    expect(r.ivaCobrado).toBe(69);
  });
});
