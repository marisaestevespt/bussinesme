import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useUnifiedResponsibilities } from '@/hooks/useUnifiedResponsibilities';
import { TaskCustomViews } from './TaskCustomViews';
import { useMyMeetings, useMyTimeEntries, useMonthRoutineTasks } from './secretaria-shared';
import { RoutineMonthCard } from './SecretariaRotinas';
import { format, parseISO, isWithinInterval, startOfWeek, endOfWeek, startOfDay } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { WeekView } from '@/components/agenda/AppleCalendarViews';
import { useMyAgendaEvents } from '@/hooks/useMyAgendaEvents';

const today = startOfDay(new Date());
const weekStart = startOfWeek(today, { weekStartsOn: 1 });
const weekEnd = endOfWeek(today, { weekStartsOn: 1 });

export default function SecretariaSemana() {
  const navigate = useNavigate();
  const meetings = useMyMeetings();
  const timeEntries = useMyTimeEntries();
  const routineTasks = useMonthRoutineTasks();
  const unified = useUnifiedResponsibilities();
  const { events: weekAgendaEvents, types: sourceTypes } = useMyAgendaEvents({
    from: format(weekStart, 'yyyy-MM-dd'),
    to: format(weekEnd, 'yyyy-MM-dd'),
  });

  const weekMeetings = useMemo(() => (meetings.data || []).filter((m: any) => isWithinInterval(parseISO(m.date_time), { start: weekStart, end: weekEnd })), [meetings.data]);
  const weekTime = useMemo(() => (timeEntries.data || []).filter((e: any) => {
    if (!e.entry_date) return false;
    const d = parseISO(e.entry_date);
    return isWithinInterval(d, { start: weekStart, end: weekEnd });
  }), [timeEntries.data]);
  const weekHours = useMemo(() => weekTime.reduce((sum: number, e: any) => sum + (e.duration || 0), 0), [weekTime]);

  const handleEventClick = (ev: any) => {
    if (ev._isMeeting && ev._meetingId) navigate(`/hub/reunioes/${ev._meetingId}`);
    else if (String(ev.id || '').startsWith('sales_')) navigate('/hub/comercial');
    else navigate('/hub/agenda');
  };

  return (
    <div className="space-y-6">
      <RoutineMonthCard tasks={routineTasks.data || []} />

      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Tarefas esta semana</p><p className="text-2xl font-bold">{unified.weekItems.length}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Reuniões esta semana</p><p className="text-2xl font-bold">{weekMeetings.length}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Horas registadas</p><p className="text-2xl font-bold">{weekHours.toFixed(1)}h</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium">Calendário Semanal</CardTitle>
        </CardHeader>
        <CardContent>
          <WeekView
            current={today}
            events={weekAgendaEvents}
            types={sourceTypes}
            onEventClick={handleEventClick}
          />
          <div className="flex flex-wrap gap-3 mt-4 pt-3 border-t border-border/60 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-blue-500" /> Reunião</span>
            <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-violet-500" /> Projeto</span>
            <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-primary" /> Tarefa</span>
          </div>
        </CardContent>
      </Card>

      <TaskCustomViews
        scope="week"
        items={unified.weekItems}
        defaultTitle="Tarefas desta semana"
        defaultDeadline={format(endOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd')}
      />
    </div>
  );
}
