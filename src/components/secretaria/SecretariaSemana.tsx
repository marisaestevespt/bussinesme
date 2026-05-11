import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, Calendar as CalendarIcon, ChevronDown, ChevronRight, ListTodo, Users, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { useUnifiedResponsibilities } from '@/hooks/useUnifiedResponsibilities';
import { MyTasksTable } from './MyTasksTable';
import { useMyMeetings, useMyTimeEntries, useMonthRoutineTasks } from './secretaria-shared';
import { RoutineMonthCard } from './SecretariaRotinas';
import { format, parseISO, isWithinInterval, startOfWeek, endOfWeek, startOfDay, isToday } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useMyAgendaEvents } from '@/hooks/useMyAgendaEvents';
import { AgendaCalendarView } from '@/components/agenda/AgendaCalendarView';
import { useAutoCalendarLabels } from '@/hooks/useAutoCalendarLabels';
import { StatCard } from '@/components/editorial';

const today = startOfDay(new Date());
const weekStart = startOfWeek(today, { weekStartsOn: 1 });
const weekEnd = endOfWeek(today, { weekStartsOn: 1 });

export default function SecretariaSemana() {
  const navigate = useNavigate();
  const [cursor, setCursor] = useState<Date>(today);
  const [showAgenda, setShowAgenda] = useState(false);
  const meetings = useMyMeetings();
  const timeEntries = useMyTimeEntries();
  const routineTasks = useMonthRoutineTasks();
  const unified = useUnifiedResponsibilities();
  const { events, types, typeItems, autoTypeItems, productItems, isEventVisible } = useMyAgendaEvents(
    {
      from: format(new Date(cursor.getFullYear(), 0, 1), 'yyyy-MM-dd'),
      to: format(new Date(cursor.getFullYear(), 11, 31), 'yyyy-MM-dd'),
    },
    cursor,
  );
  const { rename: renameAutoLabel } = useAutoCalendarLabels();

  const weekMeetings = useMemo(() => (meetings.data || []).filter((m: any) => isWithinInterval(parseISO(m.date_time), { start: weekStart, end: weekEnd })), [meetings.data]);
  const weekTime = useMemo(() => (timeEntries.data || []).filter((e: any) => {
    if (!e.entry_date) return false;
    const d = parseISO(e.entry_date);
    return isWithinInterval(d, { start: weekStart, end: weekEnd });
  }), [timeEntries.data]);
  const weekHours = useMemo(() => weekTime.reduce((sum: number, e: any) => sum + (e.duration || 0), 0), [weekTime]);

  const handleEventClick = (ev: any) => {
    if (ev._isMeeting && ev._meetingId) navigate(`/hub/reunioes/${ev._meetingId}`);
    else if (ev._isSalesAction || String(ev.id || '').startsWith('sales_')) navigate('/hub/comercial');
    else navigate('/hub/agenda');
  };

  return (
    <div className="space-y-6">
      <RoutineMonthCard tasks={routineTasks.data || []} />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-5">
        <StatCard tone="primary" size="sm" value={unified.weekItems.length} label={<><ListTodo className="h-3 w-3 inline mr-1.5 -mt-0.5" />tarefas esta semana</>} />
        <StatCard tone="mocha" size="sm" value={weekMeetings.length} label={<><Users className="h-3 w-3 inline mr-1.5 -mt-0.5" />reuniões esta semana</>} />
        <StatCard tone="gold" size="sm" value={`${weekHours.toFixed(1)}h`} label={<><Clock className="h-3 w-3 inline mr-1.5 -mt-0.5" />horas registadas</>} />
      </div>

      <Card>
        <CardContent className="p-0">
          <Button
            variant="ghost"
            onClick={() => setShowAgenda((v) => !v)}
            className="w-full justify-between rounded-none px-4 py-3 h-auto"
          >
            <span className="flex items-center gap-2 text-sm font-medium">
              <CalendarIcon className="h-4 w-4" /> Ver agenda de negócio
            </span>
            {showAgenda ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
          {showAgenda && (
            <div className="border-t">
              <AgendaCalendarView
                storageKey="agenda-secretaria-semana"
                cursor={cursor}
                onCursorChange={setCursor}
                events={events}
                types={types}
                typeItems={typeItems}
                autoTypeItems={autoTypeItems}
                productItems={productItems}
                isEventVisible={isEventVisible}
                onEventClick={handleEventClick}
                defaultMode="week"
                onAutoItemRename={(id, name) => {
                  const key = id === 'meta:meeting' ? 'meeting'
                            : id === 'meta:sales'   ? 'sales'
                            : id === 'meta:feriado' ? 'feriado' : null;
                  if (key) renameAutoLabel(key, name);
                }}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <MyTasksTable scope="week" />

      {(() => {
        const conteudosSemana = unified.weekItems.filter((i: any) => i.source === 'conteudo');
        if (conteudosSemana.length === 0) return null;
        return (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <FileText className="h-4 w-4" /> Conteúdos desta semana ({conteudosSemana.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {conteudosSemana.map((c: any) => {
                const d = c.date ? parseISO(c.date.split('T')[0]) : null;
                const overdue = d && d < today && !isToday(d);
                return (
                  <Link
                    key={c.id}
                    to={`/hub/marketing/conteudos/${c.sourceId}`}
                    className="flex items-center justify-between p-2 rounded-lg border hover:bg-accent hq-transition"
                  >
                    <span className="text-sm truncate">{c.title}</span>
                    <Badge variant={overdue ? 'destructive' : 'outline'} className="text-[10px] shrink-0">
                      {d ? format(d, 'dd/MM') : '—'}
                    </Badge>
                  </Link>
                );
              })}
            </CardContent>
          </Card>
        );
      })()}
    </div>
  );
}
