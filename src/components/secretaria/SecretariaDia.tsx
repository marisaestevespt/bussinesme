import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useUnifiedResponsibilities } from '@/hooks/useUnifiedResponsibilities';
import { MyTasksTable } from './MyTasksTable';
import { useMyMeetings, useMyTimeEntries, useMonthRoutineTasks } from './secretaria-shared';
import { RoutineMonthCard } from './SecretariaRotinas';
import { isToday, parseISO } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useMyAgendaEvents } from '@/hooks/useMyAgendaEvents';
import { AgendaCalendarView } from '@/components/agenda/AgendaCalendarView';

export default function SecretariaDia() {
  const navigate = useNavigate();
  const [cursor, setCursor] = useState<Date>(new Date());
  const meetings = useMyMeetings();
  const timeEntries = useMyTimeEntries();
  const routineTasks = useMonthRoutineTasks();
  const unified = useUnifiedResponsibilities();
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const { events, types, typeItems, productItems, isEventVisible } = useMyAgendaEvents(
    { from: format(new Date(cursor.getFullYear(), 0, 1), 'yyyy-MM-dd'), to: format(new Date(cursor.getFullYear(), 11, 31), 'yyyy-MM-dd') },
    cursor,
  );
  const todayMeetings = useMemo(() => (meetings.data || []).filter((m: any) => isToday(parseISO(m.date_time))), [meetings.data]);
  const todayTime = useMemo(() => (timeEntries.data || []).filter((e: any) => e.entry_date === todayStr), [timeEntries.data, todayStr]);
  const todayHours = useMemo(() => todayTime.reduce((sum: number, e: any) => sum + (e.duration || 0), 0), [todayTime]);

  const handleEventClick = (ev: any) => {
    if (ev._isMeeting && ev._meetingId) navigate(`/hub/reunioes/${ev._meetingId}`);
    else if (ev._isSalesAction || String(ev.id || '').startsWith('sales_')) navigate('/hub/comercial');
    else navigate('/hub/agenda');
  };

  return (
    <div className="space-y-6">
      <RoutineMonthCard tasks={routineTasks.data || []} />

      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Tarefas para hoje</p><p className="text-2xl font-bold">{unified.todayItems.length}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Reuniões hoje</p><p className="text-2xl font-bold">{todayMeetings.length}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Tempo registado</p><p className="text-2xl font-bold">{todayHours.toFixed(1)}h</p></CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <AgendaCalendarView
            storageKey="agenda-secretaria-dia"
            cursor={cursor}
            onCursorChange={setCursor}
            events={events}
            types={types}
            typeItems={typeItems}
            productItems={productItems}
            isEventVisible={isEventVisible}
            onEventClick={handleEventClick}
            defaultMode="day"
          />
        </CardContent>
      </Card>

      <MyTasksTable scope="today" />

      {todayTime.length > 0 && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Tempo Registado Hoje</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {todayTime.map((e: any) => (
              <div key={e.id} className="flex items-center justify-between p-2 rounded-lg border">
                <div className="flex-1 min-w-0">
                  <p className="text-sm">{e.description || 'Sem descrição'}</p>
                  {e.category && <Badge variant="outline" className="text-[10px] mt-0.5">{e.category}</Badge>}
                </div>
                <span className="text-sm font-medium">{(e.duration || 0).toFixed(1)}h</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
