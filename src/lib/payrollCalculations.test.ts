import { describe, it, expect } from 'vitest';
import {
  vatBreakdown,
  computeSalary,
  computeSsIndependente,
  computeSsPatronalForMonth,
  buildIndependenteQuarterMap,
  SS_EMPLOYEE_RATE,
  SS_EMPLOYER_RATE,
  SS_INDEPENDENTE_MIN_MONTHLY,
} from './payrollCalculations';

describe('vatBreakdown', () => {
  it('adds VAT when amount excludes VAT', () => {
    const r = vatBreakdown(100, 23, false);
    expect(r.baseValue).toBe(100);
    expect(r.totalWithVat).toBe(123);
    expect(r.vatAmount).toBe(23);
  });

  it('extracts base when amount includes VAT', () => {
    const r = vatBreakdown(123, 23, true);
    expect(r.baseValue).toBe(100);
    expect(r.totalWithVat).toBe(123);
    expect(r.vatAmount).toBe(23);
  });

  it('handles 0% VAT', () => {
    const r = vatBreakdown(50, 0, false);
    expect(r.vatAmount).toBe(0);
    expect(r.totalWithVat).toBe(50);
  });
});

describe('computeSalary', () => {
  it('computes gross/SS/net for 1000€ with 0% IRS', () => {
    const r = computeSalary(1000, 0);
    expect(r.ssEmployee).toBe(110);
    expect(r.ssEmployer).toBe(237.5);
    expect(r.netSalary).toBe(890);
    expect(r.totalCost).toBe(1237.5);
  });

  it('applies IRS withholding correctly', () => {
    const r = computeSalary(2000, 15);
    expect(r.withholdingValue).toBe(300);
    expect(r.netSalary).toBe(2000 - 300 - 2000 * SS_EMPLOYEE_RATE);
  });

  it('uses correct rate constants', () => {
    expect(SS_EMPLOYEE_RATE).toBe(0.11);
    expect(SS_EMPLOYER_RATE).toBe(0.2375);
  });
});

describe('computeSsIndependente', () => {
  it('returns 0 when revenue is 0', () => {
    expect(computeSsIndependente(0).contribution).toBe(0);
  });

  it('applies minimum contribution when raw is below floor', () => {
    const r = computeSsIndependente(100); // 70 → 23.33 base → 4.99 raw
    expect(r.contribution).toBe(SS_INDEPENDENTE_MIN_MONTHLY);
  });

  it('computes 21.4% of monthly base for normal revenue', () => {
    const r = computeSsIndependente(3000); // 2100 rendimento, 700 base, 149.80 contrib
    expect(r.rendimentoRelevante).toBe(2100);
    expect(r.baseIncidencia).toBe(700);
    expect(r.contribution).toBe(149.8);
  });
});

describe('computeSsPatronalForMonth', () => {
  it('sums gross and applies both rates', () => {
    const r = computeSsPatronalForMonth([{ gross_salary: 1000 }, { gross_salary: 2000 }]);
    expect(r.totalGross).toBe(3000);
    expect(r.ssEmployer).toBe(712.5);
    expect(r.ssEmployee).toBe(330);
    expect(r.totalSS).toBe(1042.5);
  });

  it('handles empty list', () => {
    expect(computeSsPatronalForMonth([]).totalSS).toBe(0);
  });
});

describe('buildIndependenteQuarterMap', () => {
  it('maps Jan-Mar to Q4 of previous year', () => {
    const map = buildIndependenteQuarterMap(2026);
    const q1 = map.find(m => m.months.includes(1))!;
    expect(q1.srcYear).toBe(2025);
    expect(q1.srcQ).toBe(4);
    expect(q1.declMonth).toBe('Janeiro');
  });

  it('keeps Q2-Q4 within same year', () => {
    const map = buildIndependenteQuarterMap(2026);
    const q4 = map.find(m => m.months.includes(10))!;
    expect(q4.srcYear).toBe(2026);
    expect(q4.srcQ).toBe(3);
  });
});
