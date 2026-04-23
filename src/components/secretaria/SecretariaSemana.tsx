import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useUnifiedResponsibilities } from '@/hooks/useUnifiedResponsibilities';
import { UnifiedResponsibilitiesList } from '@/components/UnifiedResponsibilitiesList';
import { useMyMeetings, useMyTimeEntries, useMonthRoutineTasks } from './secretaria-shared';
import { RoutineMonthCard } from './SecretariaRotinas';
import { format, parseISO, isToday, isWithinInterval, startOfWeek, endOfWeek, eachDayOfInterval, startOfDay } from 'date-fns';
import { pt } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

const priorityStyles: Record<string, { label: string; className: string }> = {
  urgent:    { label: 'Urgente', className: 'bg-destructive text-destructive-foreground border-transparent' },
  high:      { label: 'Alta',    className: 'bg-destructive/15 text-destructive border-destructive/30' },
  medium:    { label: 'Média',   className: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30' },
  low:       { label: 'Baixa',   className: 'bg-muted text-muted-foreground border-border' },
};

const sourceMeta: Record<string, { icon: string; label: string; dot: string }> = {
  reuniao: { icon: '📅', label: 'Reunião', dot: 'bg-blue-500' },
  projeto: { icon: '📦', label: 'Projeto', dot: 'bg-violet-500' },
  tarefa:  { icon: '✓',  label: 'Tarefa',  dot: 'bg-primary' },
};

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
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium">Calendário Semanal</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
            {weekDays.map(day => {
              const dayKey = format(day, 'yyyy-MM-dd');
              const dayItems = unified.weekItems.filter(i => i.date && i.date.startsWith(dayKey));
              const isCurrent = isToday(day);
              return (
                <div
                  key={dayKey}
                  className={cn(
                    'rounded-xl border bg-card p-3 min-h-[200px] flex flex-col gap-2 transition-colors',
                    isCurrent && 'border-primary ring-2 ring-primary/30 bg-primary/5'
                  )}
                >
                  <div className="flex items-baseline justify-between mb-1 pb-2 border-b border-border/60">
                    <p className={cn('text-xs font-medium uppercase tracking-wide capitalize', isCurrent ? 'text-primary' : 'text-muted-foreground')}>
                      {format(day, 'EEEE', { locale: pt })}
                    </p>
                    <p className={cn('text-lg font-bold leading-none', isCurrent && 'text-primary')}>
                      {format(day, 'd')}
                    </p>
                  </div>
                  {dayItems.length === 0 && (
                    <p className="text-xs text-muted-foreground/70 italic mt-2">Sem itens</p>
                  )}
                  <div className="flex flex-col gap-1.5">
                    {dayItems.map(i => {
                      const meta = sourceMeta[i.source as string] ?? sourceMeta.tarefa;
                      const prio = i.priority ? priorityStyles[i.priority] : null;
                      return (
                        <div
                          key={i.id}
                          className="text-xs leading-snug text-foreground bg-muted/50 hover:bg-muted rounded-md px-2 py-1.5 break-words border-l-2 border-border"
                          style={{ borderLeftColor: 'hsl(var(--border))' }}
                          title={i.title}
                        >
                          <div className="flex items-start gap-1.5">
                            <span className={cn('inline-block w-1.5 h-1.5 rounded-full mt-1.5 shrink-0', meta.dot)} aria-hidden />
                            <span className="flex-1 font-medium">{i.title}</span>
                          </div>
                          {prio && (
                            <Badge
                              variant="outline"
                              className={cn('mt-1.5 ml-3 text-[10px] px-1.5 py-0 h-4 font-medium', prio.className)}
                            >
                              {prio.label}
                            </Badge>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-3 mt-4 pt-3 border-t border-border/60 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-blue-500" /> Reunião</span>
            <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-violet-500" /> Projeto</span>
            <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-primary" /> Tarefa</span>
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
