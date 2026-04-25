import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Convert empty strings to null in a payload object */
export function cleanPayload<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k, v === '' ? null : v])
  ) as T;
}

/** cleanPayload + strip timestamp keys (created_at, updated_at) */
export function cleanPayloadStrip<T extends Record<string, unknown>>(obj: T): T {
  const STRIP = ['created_at', 'updated_at'];
  return Object.fromEntries(
    Object.entries(obj)
      .filter(([k]) => !STRIP.includes(k))
      .map(([k, v]) => [k, v === '' ? null : v])
  ) as T;
}

/** Statuses that should be excluded from financial calculations */
const CANCELLED_STATUSES = ['cancelado', 'cancelada'];

/** Filter out cancelled records from financial calculations */
export function excludeCancelled<T extends { status: string }>(items: T[]): T[] {
  return items.filter(i => !CANCELLED_STATUSES.includes(i.status));
}

/**
 * Canonical initials helper used across avatars, list icons and fallback chips.
 * - Strips non-alphanumeric noise.
 * - Uses the first letter of the first two meaningful words.
 * - Falls back to the first two characters when there is only one word.
 * - Returns empty string when no usable input is provided so callers can
 *   render their own placeholder.
 */
export function getInitials(name?: string | null): string {
  if (!name) return '';
  const words = name
    .trim()
    .split(/\s+/)
    .map(w => w.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter(Boolean);
  if (words.length === 0) return '';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}
