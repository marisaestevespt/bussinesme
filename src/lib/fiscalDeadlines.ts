/**
 * Fiscal deadline calculation for Portuguese tax obligations.
 * Adjusts deadlines that fall on weekends or Portuguese national holidays
 * to the previous business day.
 */

const PT_FIXED_HOLIDAYS = [
  [1, 1], [4, 25], [5, 1], [6, 10], [8, 15], [10, 5], [11, 1], [12, 1], [12, 8], [12, 25],
] as const;

function isWeekend(d: Date): boolean {
  const day = d.getDay();
  return day === 0 || day === 6;
}

function isPortugueseHoliday(d: Date): boolean {
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return PT_FIXED_HOLIDAYS.some(([hm, hd]) => hm === m && hd === day);
}

function isNonBusiness(d: Date): boolean {
  return isWeekend(d) || isPortugueseHoliday(d);
}

/** Move to previous business day if non-business */
function adjustToPrevBusinessDay(d: Date): Date {
  const result = new Date(d);
  while (isNonBusiness(result)) {
    result.setDate(result.getDate() - 1);
  }
  return result;
}

function lastDayOfMonth(year: number, month: number): Date {
  return new Date(year, month, 0); // month is 1-indexed here, so month=5 gives May 31
}

function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export interface FiscalDeadline {
  key: string;
  name: string;
  date: string; // yyyy-MM-dd (adjusted)
  rawDate: string; // yyyy-MM-dd (original before adjustment)
  category: 'ss' | 'iva';
  deadline_type: 'declaracao' | 'pagamento';
}

const MONTH_NAMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

export interface FiscalConfig {
  taxIvaRegime: string; // 'isento' | 'trimestral' | 'mensal'
  taxIrsRegime: string; // 'simplificado' | 'contabilidade_organizada'
  ssExempt: boolean;
  ivaExempt: boolean;
  ivaExemptionEndDate?: string | null; // yyyy-MM-dd — when IVA exemption ended
  ssExemptionEndDate?: string | null;  // yyyy-MM-dd — when SS exemption ended
  hasAccountant?: boolean; // If true, SS and IVA deadlines are hidden (accountant handles them)
}

/** Check if a deadline date is after the exemption end date */
function isAfterExemptionEnd(deadlineDate: string, exemptionEndDate?: string | null): boolean {
  if (!exemptionEndDate) return true; // No end date = never was exempt, show all
  return deadlineDate >= exemptionEndDate;
}

export function computeFiscalDeadlines(year: number, config: FiscalConfig): FiscalDeadline[] {
  const deadlines: FiscalDeadline[] = [];

  const push = (dl: FiscalDeadline, exemptionEnd?: string | null) => {
    if (isAfterExemptionEnd(dl.date, exemptionEnd)) deadlines.push(dl);
  };

  const makeDl = (key: string, name: string, rawDate: Date, category: FiscalDeadline['category'], deadline_type: FiscalDeadline['deadline_type'] = 'declaracao'): FiscalDeadline => {
    const adjusted = adjustToPrevBusinessDay(rawDate);
    return { key, name, date: fmtDate(adjusted), rawDate: fmtDate(rawDate), category, deadline_type };
  };

  // ── Segurança Social (monthly — payment until day 20 of next month) ──
  // Always shown unless exempt or in contabilidade organizada (accountant handles fully).
  if (!config.ssExempt && config.taxIrsRegime !== 'contabilidade_organizada') {
    for (let m = 1; m <= 12; m++) {
      const nm = m === 12 ? 1 : m + 1;
      const ny = m === 12 ? year + 1 : year;
      push(
        makeDl(`ss-${year}-${m}`, `SS Pagamento — ${MONTH_NAMES[m - 1]} ${year} (até dia 20/${nm})`, new Date(ny, nm - 1, 20), 'ss', 'pagamento'),
        config.ssExemptionEndDate,
      );
    }

    // SS Declaração Trimestral (independentes) — entrega até ao último dia do mês seguinte ao trimestre.
    // Q4 ano-1 → Janeiro | Q1 → Abril | Q2 → Julho | Q3 → Outubro
    const ssQuarters = [
      { q: 4, label: '4º Trim (Out-Dez)', refYear: year - 1, declMonth: 1,  declYear: year },
      { q: 1, label: '1º Trim (Jan-Mar)', refYear: year,     declMonth: 4,  declYear: year },
      { q: 2, label: '2º Trim (Abr-Jun)', refYear: year,     declMonth: 7,  declYear: year },
      { q: 3, label: '3º Trim (Jul-Set)', refYear: year,     declMonth: 10, declYear: year },
    ];
    for (const q of ssQuarters) {
      const last = lastDayOfMonth(q.declYear, q.declMonth);
      push(
        makeDl(
          `ss-decl-q${q.q}-${q.refYear}`,
          `SS Declaração Trimestral ${q.label} ${q.refYear} (até ${last.getDate()}/${q.declMonth})`,
          last,
          'ss',
          'declaracao',
        ),
        config.ssExemptionEndDate,
      );
    }
  }

  // ── IVA Trimestral (declaration day 20, payment day 25 of 2nd month after quarter) ──
  if (!config.ivaExempt && config.taxIvaRegime === 'trimestral' && config.taxIrsRegime !== 'contabilidade_organizada') {
    const quarters = [
      { q: 1, label: '1º Trim (Jan-Mar)', dm: 5, dy: year },
      { q: 2, label: '2º Trim (Abr-Jun)', dm: 8, dy: year },
      { q: 3, label: '3º Trim (Jul-Set)', dm: 11, dy: year },
      { q: 4, label: '4º Trim (Out-Dez)', dm: 2, dy: year + 1 },
    ];
    for (const q of quarters) {
      // Declaration — until day 20
      push(
        makeDl(`iva-decl-q${q.q}-${year}`, `IVA Declaração ${q.label} ${year} (até dia 20/${q.dm})`, new Date(q.dy, q.dm - 1, 20), 'iva', 'declaracao'),
        config.ivaExemptionEndDate,
      );
      // Payment — until day 25
      push(
        makeDl(`iva-pay-q${q.q}-${year}`, `IVA Pagamento ${q.label} ${year} (até dia 25/${q.dm})`, new Date(q.dy, q.dm - 1, 25), 'iva', 'pagamento'),
        config.ivaExemptionEndDate,
      );
    }
  }

  // ── IVA Mensal (declaration day 20, payment day 25 of 2nd month after) ──
  if (!config.ivaExempt && config.taxIvaRegime === 'mensal' && config.taxIrsRegime !== 'contabilidade_organizada') {
    for (let m = 1; m <= 12; m++) {
      // Declaration & payment fall in m+2 (e.g., Jan IVA due in March)
      const declMonth = ((m - 1 + 2) % 12) + 1;
      const declYear = m + 2 > 12 ? year + 1 : year;
      push(
        makeDl(`iva-decl-m${m}-${year}`, `IVA Declaração — ${MONTH_NAMES[m - 1]} ${year} (até dia 20/${declMonth})`, new Date(declYear, declMonth - 1, 20), 'iva', 'declaracao'),
        config.ivaExemptionEndDate,
      );
      push(
        makeDl(`iva-pay-m${m}-${year}`, `IVA Pagamento — ${MONTH_NAMES[m - 1]} ${year} (até dia 25/${declMonth})`, new Date(declYear, declMonth - 1, 25), 'iva', 'pagamento'),
        config.ivaExemptionEndDate,
      );
    }
  }

  // ── IRS (simplified regime — April 1 to June 30 of next year) ──
  if (config.taxIrsRegime === 'simplificado') {
    // Submission opens April 1, deadline June 30
    const rawStart = new Date(year + 1, 3, 1); // April 1
    const rawEnd = new Date(year + 1, 5, 30);  // June 30
    const adjustedEnd = adjustToPrevBusinessDay(rawEnd);
    deadlines.push({
      key: `irs-start-${year}`,
      name: `IRS ${year} — Início da entrega (1 de Abril)`,
      date: fmtDate(rawStart),
      rawDate: fmtDate(rawStart),
      category: 'irs',
      deadline_type: 'declaracao',
    });
    deadlines.push({
      key: `irs-end-${year}`,
      name: `IRS ${year} — Prazo final (30 de Junho)`,
      date: fmtDate(adjustedEnd),
      rawDate: fmtDate(rawEnd),
      category: 'irs',
      deadline_type: 'declaracao',
    });
  }

  return deadlines.sort((a, b) => a.date.localeCompare(b.date));
}

export function getDeadlineStatus(deadlineDate: string, today: string): 'upcoming' | 'soon' | 'overdue' {
  if (deadlineDate < today) return 'overdue';
  const d = new Date(deadlineDate + 'T00:00:00');
  const t = new Date(today + 'T00:00:00');
  const diffDays = Math.ceil((d.getTime() - t.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays <= 15) return 'soon';
  return 'upcoming';
}
