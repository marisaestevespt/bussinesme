import { addDays, addWeeks, addMonths, format, isSameDay, parseISO, setDate as setDateFns } from 'date-fns';

type AnyEvent = {
  id: string;
  start_date: string;
  end_date: string | null;
  recurrence_type: string | null;
  recurrence_end: string | null;
  [key: string]: unknown;
};

/**
 * Expand recurring events into individual occurrences inside [rangeStart, rangeEnd].
 * Mirrors the implementation that lives privately in src/pages/Agenda.tsx so other
 * surfaces (Secretaria) can render the same expansion.
 */
export function expandRecurringEvents<T extends AnyEvent>(events: T[], rangeStart: Date, rangeEnd: Date): T[] {
  const result: T[] = [];
  const recEndFallback = rangeEnd;

  for (const ev of events) {
    const start = parseISO(ev.start_date);
    if (!ev.recurrence_type) {
      result.push(ev);
      continue;
    }

    const recEnd = ev.recurrence_end ? parseISO(ev.recurrence_end) : recEndFallback;
    const hours = start.getHours();
    const minutes = start.getMinutes();
    let cursor = new Date(start);

    const maxOccurrences = 366;
    let count = 0;

    while (cursor <= recEnd && cursor <= rangeEnd && count < maxOccurrences) {
      if (cursor >= rangeStart || isSameDay(cursor, rangeStart)) {
        const occurrenceDate = new Date(cursor);
        occurrenceDate.setHours(hours, minutes, 0, 0);
        result.push({
          ...ev,
          id: `${ev.id}_${format(cursor, 'yyyy-MM-dd')}`,
          start_date: occurrenceDate.toISOString(),
          end_date: null,
        });
      }

      count++;
      switch (ev.recurrence_type) {
        case 'diario':
          cursor = addDays(cursor, 1);
          break;
        case 'semanal':
          cursor = addWeeks(cursor, 1);
          break;
        case 'quinzenal':
          cursor = addWeeks(cursor, 2);
          break;
        case 'mensal':
          cursor = addMonths(cursor, 1);
          break;
        case 'mensal_primeiro':
          cursor = addMonths(cursor, 1);
          cursor = setDateFns(cursor, 1);
          break;
        default:
          count = maxOccurrences;
      }
    }
  }
  return result;
}