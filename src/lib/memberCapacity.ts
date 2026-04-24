/**
 * Centralized member capacity & workload math.
 *
 * Unifies: weekly→monthly conversion, occupation %, overload thresholds,
 * and aggregate team capacity calculations.
 *
 * Always use these helpers — never inline `* 4.33` or `> 0.85` checks.
 */

/** Average weeks per month (4.33 = 52/12). */
export const WEEKS_PER_MONTH = 4.33;

/** Default contracted weekly hours when not explicitly set. */
export const DEFAULT_WEEKLY_HOURS = 40;

/** Above this monthly occupation ratio a member is considered "overloaded". */
export const OVERLOAD_THRESHOLD = 0.85;

/** Above this weekly occupation ratio a member is considered "over capacity". */
export const WEEKLY_OVER_CAPACITY_THRESHOLD = 1.1;

/** Statuses considered active for capacity calculations. */
export const ACTIVE_MEMBER_STATUSES = ['ativo'] as const;

export type MemberLike = {
  id?: string;
  status?: string | null;
  /** Preferred field. */
  expected_weekly_hours?: number | string | null;
  /** Legacy alias used by some hooks. */
  weekly_hours?: number | string | null;
};

export type TimeEntryLike = {
  member_id?: string | null;
  duration?: number | string | null;
};

/** Returns true when the member is active or a prestador. */
export function isActiveMember(m: MemberLike | null | undefined): boolean {
  if (!m?.status) return false;
  return (ACTIVE_MEMBER_STATUSES as readonly string[]).includes(m.status);
}

/** Filters a list down to active/prestador members. */
export function filterActiveMembers<T extends MemberLike>(members: T[]): T[] {
  return members.filter(isActiveMember);
}

/** Reads the weekly hours from either canonical field, with fallback. */
export function weeklyHours(m: MemberLike | null | undefined, fallback: number = DEFAULT_WEEKLY_HOURS): number {
  const v = Number(m?.expected_weekly_hours ?? m?.weekly_hours ?? 0);
  return v > 0 ? v : fallback;
}

/** Same as weeklyHours but returns 0 (not the fallback) when missing — for sum aggregations. */
export function weeklyHoursStrict(m: MemberLike | null | undefined): number {
  return Number(m?.expected_weekly_hours ?? m?.weekly_hours ?? 0) || 0;
}

/** Monthly capacity (weekly hours × 4.33). */
export function monthlyCapacity(m: MemberLike | null | undefined, fallback: number = DEFAULT_WEEKLY_HOURS): number {
  return weeklyHours(m, fallback) * WEEKS_PER_MONTH;
}

/** Monthly capacity using strict 0 fallback — used for team-wide sums. */
export function monthlyCapacityStrict(m: MemberLike | null | undefined): number {
  return weeklyHoursStrict(m) * WEEKS_PER_MONTH;
}

/** Sum of duration across a list of time entries. */
export function sumDuration(entries: TimeEntryLike[]): number {
  return entries.reduce((s, e) => s + (Number(e.duration) || 0), 0);
}

/** Sum of duration filtered by member id. */
export function sumDurationForMember(entries: TimeEntryLike[], memberId: string): number {
  return sumDuration(entries.filter(e => e.member_id === memberId));
}

/** Occupation ratio (0–∞). Returns 0 when capacity is 0. */
export function occupationRatio(usedHours: number, capacityHours: number): number {
  return capacityHours > 0 ? usedHours / capacityHours : 0;
}

/** Occupation percentage (0–∞, rounded). */
export function occupationPercent(usedHours: number, capacityHours: number): number {
  return Math.round(occupationRatio(usedHours, capacityHours) * 100);
}

/** True when a member's monthly occupation exceeds OVERLOAD_THRESHOLD (default 85%). */
export function isMonthlyOverloaded(
  m: MemberLike,
  monthEntries: TimeEntryLike[],
  threshold: number = OVERLOAD_THRESHOLD,
): boolean {
  if (!m.id) return false;
  const cap = monthlyCapacity(m);
  if (cap <= 0) return false;
  const used = sumDurationForMember(monthEntries, m.id);
  return used / cap > threshold;
}

/** True when a member's weekly worked hours exceed WEEKLY_OVER_CAPACITY_THRESHOLD (default 110%). */
export function isWeeklyOverloaded(
  m: MemberLike,
  weekEntries: TimeEntryLike[],
  threshold: number = WEEKLY_OVER_CAPACITY_THRESHOLD,
): boolean {
  if (!m.id) return false;
  const wh = weeklyHours(m);
  if (wh <= 0) return false;
  const used = sumDurationForMember(weekEntries, m.id);
  return used / wh > threshold;
}

/** Aggregate capacity stats for a team over a month. */
export type TeamCapacitySummary = {
  pct: number;
  totalCapacity: number;
  totalUsed: number;
  overloadedCount: number;
  total: number;
};

export function teamMonthlyCapacitySummary(
  members: MemberLike[],
  monthEntries: TimeEntryLike[],
  threshold: number = OVERLOAD_THRESHOLD,
): TeamCapacitySummary | null {
  const active = filterActiveMembers(members);
  if (active.length === 0) return null;
  const totalCapacity = active.reduce((s, m) => s + monthlyCapacity(m), 0);
  const totalUsed = sumDuration(monthEntries);
  const pct = occupationPercent(totalUsed, totalCapacity);
  const overloadedCount = active.reduce(
    (n, m) => n + (isMonthlyOverloaded(m, monthEntries, threshold) ? 1 : 0),
    0,
  );
  return {
    pct,
    totalCapacity: Math.round(totalCapacity),
    totalUsed: Math.round(totalUsed),
    overloadedCount,
    total: active.length,
  };
}
