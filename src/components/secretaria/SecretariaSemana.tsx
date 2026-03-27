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
        <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Calendário Semanal</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-2">
            {weekDays.map(day => {
              const dayKey = format(day, 'yyyy-MM-dd');
              const dayItems = unified.weekItems.filter(i => i.date && i.date.startsWith(dayKey));
              return (
                <div key={dayKey} className={cn('rounded-lg border p-2 min-h-[80px]', isToday(day) && 'border-primary bg-primary/5')}>
                  <p className="text-xs font-medium mb-1">{format(day, 'EEE d', { locale: pt })}</p>
                  {dayItems.slice(0, 4).map(i => (
                    <p key={i.id} className="text-[10px] truncate text-foreground">
                      {i.source === 'reuniao' ? '📅' : i.source === 'projeto' ? '📦' : '📋'} {i.title.length > 20 ? i.title.slice(0, 20) + '…' : i.title}
                    </p>
                  ))}
                  {dayItems.length > 4 && <p className="text-[10px] text-muted-foreground">+{dayItems.length - 4} mais</p>}
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
