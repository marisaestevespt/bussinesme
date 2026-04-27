import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { CalendarIcon } from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface CalendarEvent {
  title: string;
  startDate: string; // ISO string
  endDate?: string | null; // ISO string
  notes?: string | null;
  meetingUrl?: string | null;
  /** When provided, exports the full recurring series instead of just this occurrence. */
  recurrence?: {
    frequency: 'diaria' | 'semanal' | 'quinzenal' | 'mensal' | string;
    endDate?: string | null; // ISO date or datetime
  } | null;
}

export function AddToCalendarButtons({ event }: { event: CalendarEvent }) {
  const title = encodeURIComponent(event.title);
  const startDate = parseISO(event.startDate);
  const endDate = event.endDate ? parseISO(event.endDate) : new Date(startDate.getTime() + 60 * 60 * 1000);
  const details = encodeURIComponent([event.notes, event.meetingUrl].filter(Boolean).join('\n'));
  const location = event.meetingUrl ? encodeURIComponent(event.meetingUrl) : '';

  const toGoogleFormat = (d: Date) => format(d, "yyyyMMdd'T'HHmmss");
  const toICSFormat = (d: Date) => format(d, "yyyyMMdd'T'HHmmss");

  // Build RRULE if event is recurring
  const buildRRule = (): string | null => {
    if (!event.recurrence) return null;
    const freqMap: Record<string, { freq: string; interval?: number }> = {
      diaria: { freq: 'DAILY' },
      semanal: { freq: 'WEEKLY' },
      quinzenal: { freq: 'WEEKLY', interval: 2 },
      mensal: { freq: 'MONTHLY' },
    };
    const cfg = freqMap[event.recurrence.frequency];
    if (!cfg) return null;
    const parts = [`FREQ=${cfg.freq}`];
    if (cfg.interval) parts.push(`INTERVAL=${cfg.interval}`);
    if (event.recurrence.endDate) {
      const until = parseISO(event.recurrence.endDate);
      // UNTIL must be in UTC with Z suffix
      parts.push(`UNTIL=${format(until, "yyyyMMdd'T'235959'Z'")}`);
    }
    return parts.join(';');
  };
  const rrule = buildRRule();

  const googleUrl =
    `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}` +
    `&dates=${toGoogleFormat(startDate)}/${toGoogleFormat(endDate)}` +
    `&details=${details}&location=${location}` +
    (rrule ? `&recur=${encodeURIComponent('RRULE:' + rrule)}` : '');
  const outlookUrl = `https://outlook.live.com/calendar/0/action/compose?subject=${title}&startdt=${startDate.toISOString()}&enddt=${endDate.toISOString()}&body=${details}&location=${location}`;

  const downloadICS = () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Lovable//Calendar//PT',
      'BEGIN:VEVENT',
      `DTSTART:${toICSFormat(startDate)}`,
      `DTEND:${toICSFormat(endDate)}`,
      `SUMMARY:${event.title}`,
      rrule ? `RRULE:${rrule}` : '',
      event.notes ? `DESCRIPTION:${event.notes.replace(/\n/g, '\\n')}` : '',
      event.meetingUrl ? `URL:${event.meetingUrl}` : '',
      event.meetingUrl ? `LOCATION:${event.meetingUrl}` : '',
      'END:VEVENT',
      'END:VCALENDAR',
    ].filter(Boolean).join('\r\n');

    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${event.title.replace(/[^a-zA-Z0-9]/g, '_')}.ics`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-2 pt-1">
      <Label className="text-xs font-semibold flex items-center gap-2">
        <CalendarIcon className="h-3.5 w-3.5" /> Adicionar ao calendário
        {rrule && <span className="text-[10px] font-normal text-muted-foreground">(série completa)</span>}
      </Label>
      <div className="flex flex-wrap gap-2">
        <a href={googleUrl} target="_blank" rel="noopener noreferrer">
          <Button variant="outline" size="sm" className="h-7 text-xs gap-2">📅 Google Calendar</Button>
        </a>
        <Button variant="outline" size="sm" className="h-7 text-xs gap-2" onClick={downloadICS}>🍎 Apple Calendar (.ics)</Button>
        <a href={outlookUrl} target="_blank" rel="noopener noreferrer">
          <Button variant="outline" size="sm" className="h-7 text-xs gap-2">📧 Outlook</Button>
        </a>
      </div>
    </div>
  );
}
