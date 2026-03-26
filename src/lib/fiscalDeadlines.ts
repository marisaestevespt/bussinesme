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
  category: 'ss' | 'iva' | 'irs';
}

const MONTH_NAMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

export interface FiscalConfig {
  taxIvaRegime: string; // 'isento' | 'trimestral' | 'mensal'
  taxIrsRegime: string; // 'simplificado' | 'contabilidade_organizada'
  ssExempt: boolean;
  ivaExempt: boolean;
}

export function computeFiscalDeadlines(year: number, config: FiscalConfig): FiscalDeadline[] {
  const deadlines: FiscalDeadline[] = [];

  // ── Segurança Social (monthly, day 20 of next month) ──
  if (!config.ssExempt && config.taxIrsRegime !== 'contabilidade_organizada') {
    for (let m = 1; m <= 12; m++) {
      const nextMonth = m === 12 ? 1 : m + 1;
      const nextYear = m === 12 ? year + 1 : year;
      const raw = new Date(nextYear, nextMonth - 1, 20);
      const adjusted = adjustToPrevBusinessDay(raw);
      deadlines.push({
        key: `ss-${year}-${m}`,
        name: `Pagamento SS — ${MONTH_NAMES[m - 1]} ${year}`,
        date: fmtDate(adjusted),
        rawDate: fmtDate(raw),
        category: 'ss',
      });
    }
  }

  // ── IVA Trimestral ──
  if (!config.ivaExempt && config.taxIvaRegime === 'trimestral' && config.taxIrsRegime !== 'contabilidade_organizada') {
    const quarters = [
      { q: 1, label: '1º Trim (Jan-Mar)', deadlineMonth: 5, deadlineYear: year },
      { q: 2, label: '2º Trim (Abr-Jun)', deadlineMonth: 8, deadlineYear: year },
      { q: 3, label: '3º Trim (Jul-Set)', deadlineMonth: 11, deadlineYear: year },
      { q: 4, label: '4º Trim (Out-Dez)', deadlineMonth: 2, deadlineYear: year + 1 },
    ];
    for (const q of quarters) {
      const raw = lastDayOfMonth(q.deadlineYear, q.deadlineMonth);
      const adjusted = adjustToPrevBusinessDay(raw);
      deadlines.push({
        key: `iva-q${q.q}-${year}`,
        name: `IVA ${q.label} ${year}`,
        date: fmtDate(adjusted),
        rawDate: fmtDate(raw),
        category: 'iva',
      });
    }
  }

  // ── IVA Mensal ──
  if (!config.ivaExempt && config.taxIvaRegime === 'mensal' && config.taxIrsRegime !== 'contabilidade_organizada') {
    for (let m = 1; m <= 12; m++) {
      const nextMonth = m === 12 ? 1 : m + 1;
      const nextYear = m === 12 ? year + 1 : year;
      const raw = new Date(nextYear, nextMonth - 1, 20);
      const adjusted = adjustToPrevBusinessDay(raw);
      deadlines.push({
        key: `iva-m${m}-${year}`,
        name: `IVA — ${MONTH_NAMES[m - 1]} ${year}`,
        date: fmtDate(adjusted),
        rawDate: fmtDate(raw),
        category: 'iva',
      });
    }
  }

  // ── IRS/IRC (simplified regime) ──
  if (config.taxIrsRegime === 'simplificado') {
    const raw = new Date(year + 1, 5, 30); // June 30 of next year
    const adjusted = adjustToPrevBusinessDay(raw);
    deadlines.push({
      key: `irs-${year}`,
      name: `Entrega IRS — Ano ${year}`,
      date: fmtDate(adjusted),
      rawDate: fmtDate(raw),
      category: 'irs',
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
