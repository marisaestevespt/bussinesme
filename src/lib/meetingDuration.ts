/** Returns the meeting's effective duration in minutes for display/calculations.
 *  Prefers the actual time (post-meeting), then planned, then the legacy field. */
export function effectiveMeetingMinutes(m: {
  actual_duration_minutes?: number | null;
  planned_duration_minutes?: number | null;
  duration_minutes?: number | null;
}): number {
  return (
    Number(m.actual_duration_minutes) ||
    Number(m.planned_duration_minutes) ||
    Number(m.duration_minutes) ||
    0
  );
}

/** True when both planned and actual exist so we can render a deviation badge. */
export function meetingDeviation(m: {
  actual_duration_minutes?: number | null;
  planned_duration_minutes?: number | null;
}): { delta: number; pct: number } | null {
  const planned = Number(m.planned_duration_minutes) || 0;
  const actual = Number(m.actual_duration_minutes) || 0;
  if (!planned || !actual) return null;
  const delta = actual - planned;
  return { delta, pct: Math.round((delta / planned) * 100) };
}
