/**
 * Portuguese national holidays (feriados nacionais).
 * Includes fixed holidays and Easter-dependent movable holidays.
 */

// ─── Easter calculation (Anonymous Gregorian algorithm) ──────

function computeEaster(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3 = March, 4 = April
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function addDaysToDate(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

// ─── Holiday definitions ────────────────────────────────────────

export interface Holiday {
  date: Date;
  name: string;
  dateStr: string; // yyyy-MM-dd
}

function fmt(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Returns all Portuguese national holidays for a given year.
 */
export function getPortugueseHolidays(year: number): Holiday[] {
  const easter = computeEaster(year);

  const fixed: [number, number, string][] = [
    [1, 1, 'Ano Novo'],
    [4, 25, 'Dia da Liberdade'],
    [5, 1, 'Dia do Trabalhador'],
    [6, 10, 'Dia de Portugal'],
    [8, 15, 'Assunção de Nossa Senhora'],
    [10, 5, 'Implantação da República'],
    [11, 1, 'Dia de Todos os Santos'],
    [12, 1, 'Restauração da Independência'],
    [12, 8, 'Imaculada Conceição'],
    [12, 25, 'Natal'],
  ];

  const holidays: Holiday[] = fixed.map(([month, day, name]) => {
    const date = new Date(year, month - 1, day);
    return { date, name, dateStr: fmt(date) };
  });

  // Movable holidays (Easter-dependent)
  const carnival = addDaysToDate(easter, -47); // Terça-feira de Carnaval
  const goodFriday = addDaysToDate(easter, -2); // Sexta-feira Santa
  const corpusChristi = addDaysToDate(easter, 60); // Corpo de Deus

  holidays.push(
    { date: carnival, name: 'Carnaval', dateStr: fmt(carnival) },
    { date: goodFriday, name: 'Sexta-feira Santa', dateStr: fmt(goodFriday) },
    { date: easter, name: 'Domingo de Páscoa', dateStr: fmt(easter) },
    { date: corpusChristi, name: 'Corpo de Deus', dateStr: fmt(corpusChristi) },
  );

  return holidays.sort((a, b) => a.date.getTime() - b.date.getTime());
}

/**
 * Returns a Set of date strings (yyyy-MM-dd) for quick lookup.
 */
export function getHolidaySet(year: number): Set<string> {
  return new Set(getPortugueseHolidays(year).map(h => h.dateStr));
}

/**
 * Check if a given date is a Portuguese holiday.
 */
export function isHoliday(date: Date): boolean {
  const year = date.getFullYear();
  const holidays = getHolidaySet(year);
  return holidays.has(fmt(date));
}

/**
 * Check if a date is a non-business day (weekend or holiday).
 */
export function isNonBusinessDay(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6 || isHoliday(date);
}

/**
 * Adjusts a date to the previous business day if it falls on a weekend or holiday.
 */
export function adjustToBusinessDay(date: Date): Date {
  let d = new Date(date);
  while (isNonBusinessDay(d)) {
    d = addDaysToDate(d, -1);
  }
  return d;
}

/**
 * Add N business days to a date, skipping weekends and Portuguese holidays.
 * Negative values subtract business days.
 */
export function addBusinessDays(from: Date, days: number): Date {
  let d = new Date(from);
  const step = days >= 0 ? 1 : -1;
  let remaining = Math.abs(days);
  while (remaining > 0) {
    d = addDaysToDate(d, step);
    if (!isNonBusinessDay(d)) remaining--;
  }
  return d;
}
