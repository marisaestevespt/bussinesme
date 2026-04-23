import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useUnifiedResponsibilities } from '@/hooks/useUnifiedResponsibilities';
import { UnifiedResponsibilitiesList } from '@/components/UnifiedResponsibilitiesList';
import { useMyMeetings, useMyTimeEntries, useMonthRoutineTasks } from './secretaria-shared';
import { RoutineMonthCard } from './SecretariaRotinas';
import { format, parseISO, isToday, isWithinInterval, startOfWeek, endOfWeek, eachDayOfInterval, startOfDay } from 'date-fns';
import { pt } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const today = startOfDay(new Date());
const weekStart = startOfWeek(today, { weekStartsOn: 1 });
const weekEnd = endOfWeek(today, { weekStartsOn: 1 });

export default function SecretariaSemana() {
  const meetings = useMyMeetings();
  const timeEntries = useMyTimeEntries();
  const routineTasks = useMonthRoutineTasks();
  const unified = useUnifiedResponsibilities();

  const weekMeetings = useMemo(() => (meetings.data || []).filter((m: any) => isWithinInterval(parseISO(m.date_time), { start: weekStart, end: weekEnd })), [meetings.data]);
  const weekTime = useMemo(() => (timeEntries.data || []).filter((e: any) => {
    if (!e.entry_date) return false;
    const d = parseISO(e.entry_date);
    return isWithinInterval(d, { start: weekStart, end: weekEnd });
  }), [timeEntries.data]);
  const weekHours = useMemo(() => weekTime.reduce((sum: number, e: any) => sum + (e.duration || 0), 0), [weekTime]);

  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  return (
    <div className="space-y-6">
      <RoutineMonthCard tasks={routineTasks.data || []} />

      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Tarefas esta semana</p><p className="text-2xl font-bold">{unified.weekItems.length}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Reuniões esta semana</p><p className="text-2xl font-bold">{weekMeetings.length}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Horas registadas</p><p className="text-2xl font-bold">{weekHours.toFixed(1)}h</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base font-medium">Calendário Semanal</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
            {weekDays.map(day => {
              const dayKey = format(day, 'yyyy-MM-dd');
              const dayItems = unified.weekItems.filter(i => i.date && i.date.startsWith(dayKey));
              return (
                <div key={dayKey} className={cn('rounded-lg border p-3 min-h-[180px] flex flex-col gap-1.5', isToday(day) && 'border-primary bg-primary/5')}>
                  <p className="text-sm font-semibold mb-1 capitalize">{format(day, 'EEE d', { locale: pt })}</p>
                  {dayItems.length === 0 && <p className="text-xs text-muted-foreground italic">Sem itens</p>}
                  {dayItems.map(i => (
                    <div key={i.id} className="text-xs leading-snug text-foreground bg-muted/40 rounded px-1.5 py-1 break-words" title={i.title}>
                      <span className="mr-1">{i.source === 'reuniao' ? '📅' : i.source === 'projeto' ? '📦' : '📋'}</span>
                      {i.title}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <UnifiedResponsibilitiesList
        items={unified.weekItems}
        title="Tarefas desta semana"
        defaultDeadline={format(endOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd')}
      />
    </div>
  );
}
