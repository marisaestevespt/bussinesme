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
}

export function AddToCalendarButtons({ event }: { event: CalendarEvent }) {
  const title = encodeURIComponent(event.title);
  const startDate = parseISO(event.startDate);
  const endDate = event.endDate ? parseISO(event.endDate) : new Date(startDate.getTime() + 60 * 60 * 1000);
  const details = encodeURIComponent([event.notes, event.meetingUrl].filter(Boolean).join('\n'));
  const location = event.meetingUrl ? encodeURIComponent(event.meetingUrl) : '';

  const toGoogleFormat = (d: Date) => format(d, "yyyyMMdd'T'HHmmss");
  const toICSFormat = (d: Date) => format(d, "yyyyMMdd'T'HHmmss");

  const googleUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${toGoogleFormat(startDate)}/${toGoogleFormat(endDate)}&details=${details}&location=${location}`;
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
      <Label className="text-xs font-semibold flex items-center gap-2"><CalendarIcon className="h-3.5 w-3.5" /> Adicionar ao calendário</Label>
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
