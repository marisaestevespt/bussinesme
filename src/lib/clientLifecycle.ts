/**
 * Centralized client lifecycle logic.
 *
 * Canonical helpers to compute "days until renewal", urgency buckets,
 * and renewal-window filters. Always use these — never reimplement the math
 * inline. Default urgency window is 30 days (was inconsistently 30/60/90 across files).
 */

import { differenceInDays, parseISO, isPast } from 'date-fns';

/** Default window (in days) used to flag a client as "near end of cycle". */
export const DEFAULT_RENEWAL_WINDOW_DAYS = 30;
/** Critical window (in days) used to flag a client as "urgent". */
export const URGENT_RENEWAL_WINDOW_DAYS = 7;

export type ClientLike = {
  id?: string;
  full_name?: string | null;
  status?: string | null;
  start_date?: string | null;
  end_of_cycle?: string | null;
};

/** Statuses considered "terminated" (offboarded) — should be excluded from renewal alerts. */
export const TERMINATED_STATUSES = ['terminado', 'cancelado', 'concluido'] as const;

export function isTerminated(client: ClientLike | null | undefined): boolean {
  if (!client?.status) return false;
  return (TERMINATED_STATUSES as readonly string[]).includes(client.status);
}

/**
 * Days remaining until end of cycle. Returns null when no date is set.
 * Negative values mean the cycle already expired.
 */
export function daysUntilRenewal(
  client: ClientLike | null | undefined,
  now: Date = new Date(),
): number | null {
  const eoc = client?.end_of_cycle;
  if (!eoc) return null;
  try {
    return differenceInDays(parseISO(eoc), now);
  } catch {
    return null;
  }
}

/** True when end_of_cycle is in the past. */
export function isExpired(client: ClientLike | null | undefined, now: Date = new Date()): boolean {
  const eoc = client?.end_of_cycle;
  if (!eoc) return false;
  try {
    const d = parseISO(eoc);
    return d < now;
  } catch {
    return false;
  }
}

/**
 * True when the client is active (not terminated) and end_of_cycle is within
 * the renewal window (default 30 days, including past-due).
 */
export function isNearEndOfCycle(
  client: ClientLike | null | undefined,
  windowDays: number = DEFAULT_RENEWAL_WINDOW_DAYS,
  now: Date = new Date(),
): boolean {
  if (!client || isTerminated(client)) return false;
  const days = daysUntilRenewal(client, now);
  if (days === null) return false;
  return days <= windowDays;
}

/**
 * Same as isNearEndOfCycle but excludes already-expired (negative days).
 * Useful for "upcoming renewals in the next X days" widgets.
 */
export function isUpcomingRenewal(
  client: ClientLike | null | undefined,
  windowDays: number = DEFAULT_RENEWAL_WINDOW_DAYS,
  now: Date = new Date(),
): boolean {
  if (!client || isTerminated(client)) return false;
  const days = daysUntilRenewal(client, now);
  if (days === null) return false;
  return days >= 0 && days <= windowDays;
}

export type RenewalUrgency = 'expired' | 'urgent' | 'soon' | 'comfortable' | 'none';

/**
 * Bucket a single client by renewal urgency.
 * - expired: end_of_cycle in the past
 * - urgent: ≤ 7 days
 * - soon: ≤ 30 days
 * - comfortable: > 30 days
 * - none: no end_of_cycle date
 */
export function renewalUrgency(
  client: ClientLike | null | undefined,
  now: Date = new Date(),
): RenewalUrgency {
  const days = daysUntilRenewal(client, now);
  if (days === null) return 'none';
  if (days < 0) return 'expired';
  if (days <= URGENT_RENEWAL_WINDOW_DAYS) return 'urgent';
  if (days <= DEFAULT_RENEWAL_WINDOW_DAYS) return 'soon';
  return 'comfortable';
}

/* ---------- List helpers ---------- */

/** Filter active (non-terminated) clients with renewal due within `windowDays`. */
export function filterNearEndOfCycle<T extends ClientLike>(
  clients: T[],
  windowDays: number = DEFAULT_RENEWAL_WINDOW_DAYS,
  now: Date = new Date(),
): T[] {
  return clients.filter(c => isNearEndOfCycle(c, windowDays, now));
}

/** Filter clients whose end_of_cycle is in the future and within `windowDays`. */
export function filterUpcomingRenewals<T extends ClientLike>(
  clients: T[],
  windowDays: number = DEFAULT_RENEWAL_WINDOW_DAYS,
  now: Date = new Date(),
): T[] {
  return clients.filter(c => isUpcomingRenewal(c, windowDays, now));
}

/** Group clients by their renewal urgency bucket. */
export function categorizeByRenewalUrgency<T extends ClientLike>(
  clients: T[],
  now: Date = new Date(),
): Record<RenewalUrgency, T[]> {
  const buckets: Record<RenewalUrgency, T[]> = {
    expired: [], urgent: [], soon: [], comfortable: [], none: [],
  };
  clients.forEach(c => buckets[renewalUrgency(c, now)].push(c));
  return buckets;
}
