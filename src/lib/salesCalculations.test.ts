import { describe, it, expect } from 'vitest';
import {
  saleRevenue,
  saleBase,
  saleVat,
  sumRevenue,
  sumVat,
  salesInYear,
  salesInMonth,
  salesInQuarter,
} from './salesCalculations';

type SaleLike = {
  invoice_total?: number | null;
  base_value?: number;
  sale_year?: number;
  sale_month?: number;
};

describe('saleRevenue', () => {
  it('uses invoice_total when present', () => {
    expect(saleRevenue({ invoice_total: 123, base_value: 100 })).toBe(123);
  });
  it('falls back to base_value when invoice_total is missing', () => {
    expect(saleRevenue({ invoice_total: null, base_value: 100 })).toBe(100);
  });
  it('returns 0 for empty sale', () => {
    expect(saleRevenue({} as SaleLike as never)).toBe(0);
  });
});

describe('saleVat', () => {
  it('returns invoice - base', () => {
    expect(saleVat({ invoice_total: 123, base_value: 100 })).toBe(23);
  });
});

describe('aggregations', () => {
  const sales = [
    { invoice_total: 123, base_value: 100, sale_year: 2026, sale_month: 1 },
    { invoice_total: 246, base_value: 200, sale_year: 2026, sale_month: 4 },
    { invoice_total: 100, base_value: 100, sale_year: 2025, sale_month: 6 },
  ];

  it('sumRevenue + sumVat', () => {
    expect(sumRevenue(sales)).toBe(469);
    expect(sumVat(sales)).toBe(69);
  });

  it('salesInYear', () => {
    expect(salesInYear(sales, 2026)).toHaveLength(2);
  });

  it('salesInMonth', () => {
    expect(salesInMonth(sales, 2026, 1)).toHaveLength(1);
  });

  it('salesInQuarter Q1 = Jan-Mar', () => {
    expect(salesInQuarter(sales, 2026, 1)).toHaveLength(1);
  });

  it('salesInQuarter Q2 = Abr-Jun', () => {
    expect(salesInQuarter(sales, 2026, 2)).toHaveLength(1);
  });
});

describe('saleBase', () => {
  it('returns 0 when missing', () => {
    expect(saleBase({} as SaleLike as never)).toBe(0);
  });
});
