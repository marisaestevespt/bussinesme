/**
 * Centralized PT-PT formatting helpers.
 *
 * Always use these helpers for currency, numbers, percentages, and dates so
 * the entire app shares the same locale, separators, and decimal precision.
 *
 * Examples:
 *   formatEuro(1234.5)     → "1 234,50 €"
 *   formatEuro(1234.5, 0)  → "1 235 €"
 *   formatNumber(1234.5)   → "1 234,50"
 *   formatInt(1234)        → "1 234"
 *   formatPercent(0.273)   → "27%"
 *   formatDatePt(date)     → "22/04/2026"
 */

import { format as dfFormat, parseISO, isValid } from 'date-fns';
import { pt } from 'date-fns/locale';

export const PT_LOCALE = 'pt-PT';

/* ─────────── Numbers / Currency ─────────── */

/** Coerces an unknown value into a finite number. Falls back to 0. */
function toNumber(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Formats a number with PT-PT separators. Defaults to 2 fraction digits. */
export function formatNumber(value: unknown, fractionDigits: number = 2): string {
  return toNumber(value).toLocaleString(PT_LOCALE, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

/** Formats an integer (0 fraction digits). */
export function formatInt(value: unknown): string {
  return toNumber(value).toLocaleString(PT_LOCALE, { maximumFractionDigits: 0 });
}

/** Formats a value as Euros. Defaults to 2 fraction digits + " €" suffix. */
export function formatEuro(value: unknown, fractionDigits: number = 2): string {
  return `${formatNumber(value, fractionDigits)} €`;
}

/** Compact Euro for KPI cards: integer + "€" with no space (e.g. "1 234€"). */
export function formatEuroCompact(value: unknown): string {
  return `${formatInt(value)}€`;
}

/**
 * Formats a percentage. Pass either a fraction (0–1) or already-multiplied (0–100).
 * Default behaviour assumes the value is already a percent (0–100).
 */
export function formatPercent(value: unknown, fractionDigits: number = 0): string {
  return `${toNumber(value).toLocaleString(PT_LOCALE, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })}%`;
}

/* ─────────── Dates ─────────── */

function coerceDate(value: Date | string | number | null | undefined): Date | null {
  if (value == null) return null;
  if (value instanceof Date) return isValid(value) ? value : null;
  if (typeof value === 'number') {
    const d = new Date(value);
    return isValid(d) ? d : null;
  }
  if (typeof value === 'string') {
    if (value.trim() === '') return null;
    try {
      const d = parseISO(value);
      if (isValid(d)) return d;
    } catch {}
    const d = new Date(value);
    return isValid(d) ? d : null;
  }
  return null;
}

/** dd/MM/yyyy. Returns "—" for null/invalid. */
export function formatDatePt(value: Date | string | number | null | undefined): string {
  const d = coerceDate(value);
  return d ? dfFormat(d, 'dd/MM/yyyy', { locale: pt }) : '—';
}

/** dd/MM/yyyy HH:mm. Returns "—" for null/invalid. */
export function formatDateTimePt(value: Date | string | number | null | undefined): string {
  const d = coerceDate(value);
  return d ? dfFormat(d, 'dd/MM/yyyy HH:mm', { locale: pt }) : '—';
}

/** Short month label in PT (e.g. "jan", "fev"). */
export function formatMonthShortPt(value: Date | string | number): string {
  const d = coerceDate(value);
  return d ? dfFormat(d, 'MMM', { locale: pt }).replace('.', '').toLowerCase() : '';
}

/** Long month + year (e.g. "Abril 2026"). */
export function formatMonthYearPt(value: Date | string | number): string {
  const d = coerceDate(value);
  return d ? dfFormat(d, "MMMM yyyy", { locale: pt }) : '';
}

/** Custom pattern with PT locale. */
export function formatPt(value: Date | string | number, pattern: string): string {
  const d = coerceDate(value);
  return d ? dfFormat(d, pattern, { locale: pt }) : '';
}
