/**
 * Centralized payroll, social security and contractor VAT calculations.
 *
 * Single source of truth for Portuguese fiscal rules used across:
 *  - FinPayroll (overview)
 *  - FinSegurancaSocial (SS calculations)
 *  - FinMensal (monthly salary cells)
 *  - useMemberSave (contract creation -> auto expenses)
 *  - exportContabilista (Excel export)
 *
 * If a tax rate or formula changes, change it HERE — never inline.
 */

// ─── Portuguese tax rates (2026) ──────────────────────────────
export const SS_EMPLOYER_RATE = 0.2375;   // 23.75% — entidade patronal
export const SS_EMPLOYEE_RATE = 0.11;     // 11%    — trabalhador
export const SS_INDEPENDENTE_RATE = 0.214; // 21.4% — independente / ENI
export const SS_RENDIMENTO_RELEVANTE = 0.70; // 70% da faturação considerada rendimento relevante
export const SS_INDEPENDENTE_MIN_MONTHLY = 20; // contribuição mínima mensal (€)

export const VAT_DEFAULT_RATE = 23; // %

// ─── Rounding helper ──────────────────────────────────────────
const r2 = (v: number) => Math.round(v * 100) / 100;

// ─── VAT (used for contractors / prestadores de serviços) ─────
export interface VatBreakdown {
  baseValue: number;
  vatRate: number;
  vatAmount: number;
  totalWithVat: number;
}

/**
 * Build a VAT breakdown given a single monetary input.
 * @param amount monetary input
 * @param vatRate percent (e.g. 23)
 * @param amountIncludesVat true if `amount` already contains VAT
 */
export function vatBreakdown(amount: number, vatRate = VAT_DEFAULT_RATE, amountIncludesVat = false): VatBreakdown {
  const rate = vatRate / 100;
  if (amountIncludesVat) {
    const baseValue = r2(amount / (1 + rate));
    return { baseValue, vatRate, vatAmount: r2(amount - baseValue), totalWithVat: r2(amount) };
  }
  const totalWithVat = r2(amount * (1 + rate));
  return { baseValue: r2(amount), vatRate, vatAmount: r2(totalWithVat - amount), totalWithVat };
}

// ─── Salary breakdown (contrato_trabalho) ─────────────────────
export interface SalaryBreakdown {
  grossSalary: number;
  withholdingRate: number;   // %
  withholdingValue: number;  // €
  ssEmployee: number;        // 11% * gross
  ssEmployer: number;        // 23.75% * gross
  netSalary: number;         // gross - withholding - ssEmployee
  totalCost: number;         // gross + ssEmployer (custo para a empresa)
}

/**
 * Compute full salary breakdown for an employee (contrato de trabalho).
 * @param grossSalary salário bruto mensal
 * @param withholdingRate IRS retention rate (%) — defaults to 0
 */
export function computeSalary(grossSalary: number, withholdingRate = 0): SalaryBreakdown {
  const gross = r2(grossSalary);
  const wRate = withholdingRate || 0;
  const withholdingValue = r2(gross * (wRate / 100));
  const ssEmployee = r2(gross * SS_EMPLOYEE_RATE);
  const ssEmployer = r2(gross * SS_EMPLOYER_RATE);
  const netSalary = r2(gross - withholdingValue - ssEmployee);
  const totalCost = r2(gross + ssEmployer);
  return {
    grossSalary: gross,
    withholdingRate: wRate,
    withholdingValue,
    ssEmployee,
    ssEmployer,
    netSalary,
    totalCost,
  };
}

// ─── SS Independente ──────────────────────────────────────────
export interface IndependenteContribution {
  quarterRevenue: number;
  rendimentoRelevante: number; // 70% of revenue
  baseIncidencia: number;      // base mensal (rendimento relevante / 3)
  contribution: number;         // monthly contribution (with min applied)
}

/**
 * Compute the monthly SS contribution for an independent worker
 * given the quarter's revenue used as basis.
 *
 * Mínimo: SS_INDEPENDENTE_MIN_MONTHLY € quando há base > 0.
 */
export function computeSsIndependente(quarterRevenue: number): IndependenteContribution {
  const rendimentoRelevante = r2(quarterRevenue * SS_RENDIMENTO_RELEVANTE);
  const baseIncidencia = r2(rendimentoRelevante / 3);
  const raw = r2(baseIncidencia * SS_INDEPENDENTE_RATE);
  const contribution = baseIncidencia > 0 ? Math.max(SS_INDEPENDENTE_MIN_MONTHLY, raw) : 0;
  return { quarterRevenue: r2(quarterRevenue), rendimentoRelevante, baseIncidencia, contribution };
}

/**
 * Quarter mapping for SS Independente declarations.
 *
 * Rendimentos de  | Declaração em       | Contribuição aplica-se a
 * Jan-Mar (Q1)    | Abril               | Abr, Mai, Jun
 * Abr-Jun (Q2)    | Julho               | Jul, Ago, Set
 * Jul-Set (Q3)    | Outubro             | Out, Nov, Dez
 * Out-Dez (Q4)    | Janeiro (ano+1)     | Jan, Fev, Mar (ano+1)
 */
export interface IndependenteQuarterMapping {
  months: number[];
  srcYear: number;
  srcQ: number;
  declMonth: string;
  declYear: number;
  srcLabel: string;
}

export function buildIndependenteQuarterMap(currentYear: number): IndependenteQuarterMapping[] {
  const prev = currentYear - 1;
  return [
    { months: [1, 2, 3],    srcYear: prev,        srcQ: 4, declMonth: 'Janeiro',  declYear: currentYear, srcLabel: `Out-Dez ${prev}` },
    { months: [4, 5, 6],    srcYear: currentYear, srcQ: 1, declMonth: 'Abril',    declYear: currentYear, srcLabel: `Jan-Mar ${currentYear}` },
    { months: [7, 8, 9],    srcYear: currentYear, srcQ: 2, declMonth: 'Julho',    declYear: currentYear, srcLabel: `Abr-Jun ${currentYear}` },
    { months: [10, 11, 12], srcYear: currentYear, srcQ: 3, declMonth: 'Outubro',  declYear: currentYear, srcLabel: `Jul-Set ${currentYear}` },
  ];
}

// ─── SS Patronal (mensal) ─────────────────────────────────────
export interface PatronalMonth {
  totalGross: number;
  ssEmployer: number;
  ssEmployee: number;
  totalSS: number;
}

/**
 * Sum SS contributions for a list of payroll entries (one month).
 * Each entry must expose `gross_salary`.
 */
export function computeSsPatronalForMonth(payrollEntries: { gross_salary?: number | null }[]): PatronalMonth {
  const totalGross = r2(payrollEntries.reduce((s, p) => s + (p.gross_salary || 0), 0));
  const ssEmployer = r2(totalGross * SS_EMPLOYER_RATE);
  const ssEmployee = r2(totalGross * SS_EMPLOYEE_RATE);
  return { totalGross, ssEmployer, ssEmployee, totalSS: r2(ssEmployer + ssEmployee) };
}
