import { describe, it, expect } from 'vitest';
import {
  ivaPagoOf,
  ivaDeduzirOf,
  computeVatForExpenses,
  computeVatForSales,
  computeVatBalance,
  filterByMonth,
} from './vatCalculations';

type ExpenseLike = {
  total_with_vat?: number;
  base_value?: number;
  vat_deductible_amount?: number;
  expense_year?: number;
  expense_month?: number;
};
type SaleLike = {
  invoice_total?: number | null;
  base_value?: number;
  sale_year?: number;
  sale_month?: number;
};

describe('ivaPagoOf', () => {
  it('returns total - base', () => {
    expect(ivaPagoOf({ total_with_vat: 123, base_value: 100 } as ExpenseLike as never)).toBe(23);
  });
  it('clamps to 0 when negative', () => {
    expect(ivaPagoOf({ total_with_vat: 80, base_value: 100 } as ExpenseLike as never)).toBe(0);
  });
  it('handles missing fields', () => {
    expect(ivaPagoOf({} as ExpenseLike as never)).toBe(0);
  });
});

describe('ivaDeduzirOf', () => {
  it('uses explicit deductible amount', () => {
    expect(ivaDeduzirOf({ total_with_vat: 123, base_value: 100, vat_deductible_amount: 10 } as ExpenseLike as never)).toBe(10);
  });
  it('falls back to full IVA when not specified', () => {
    expect(ivaDeduzirOf({ total_with_vat: 123, base_value: 100 } as ExpenseLike as never)).toBe(23);
  });
});

describe('computeVatBalance', () => {
  it('balances IVA cobrado against IVA deduzir', () => {
    const sales: SaleLike[] = [{ invoice_total: 1230, base_value: 1000 }];
    const expenses: ExpenseLike[] = [{ total_with_vat: 246, base_value: 200 }];
    const r = computeVatBalance(sales as never, expenses as never);
    expect(r.ivaCobrado).toBe(230);
    expect(r.ivaDeduzir).toBe(46);
    expect(r.balanco).toBe(184);
  });

  it('returns negative balance when expenses VAT exceeds sales VAT', () => {
    const r = computeVatBalance(
      [{ invoice_total: 100, base_value: 100 }] as SaleLike[] as never,
      [{ total_with_vat: 246, base_value: 200 }] as ExpenseLike[] as never,
    );
    expect(r.balanco).toBe(-46);
  });
});

describe('computeVatForExpenses aggregates', () => {
  it('uses the net cost after deductible VAT for totalBase', () => {
    const r = computeVatForExpenses([
      { total_with_vat: 123, base_value: 100 },
      { total_with_vat: 49.2, base_value: 40, vat_deductible_amount: 0 },
    ] as ExpenseLike[] as never);

    expect(r.totalSaidas).toBe(172.2);
    expect(r.totalBase).toBe(149.2);
    expect(r.ivaPago).toBe(32.2);
    expect(r.ivaDeduzir).toBe(23);
  });
});

describe('filterByMonth', () => {
  it('filters sales by year+month', () => {
    const sales: SaleLike[] = [
      { sale_year: 2026, sale_month: 1 },
      { sale_year: 2026, sale_month: 2 },
      { sale_year: 2025, sale_month: 1 },
    ];
    expect(filterByMonth(sales as never, 2026, 1)).toHaveLength(1);
  });

  it('filters expenses by expense_year/month', () => {
    const exp: ExpenseLike[] = [
      { expense_year: 2026, expense_month: 3 },
      { expense_year: 2026, expense_month: 4 },
    ];
    expect(filterByMonth(exp as never, 2026, 3)).toHaveLength(1);
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
