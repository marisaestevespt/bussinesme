import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { format, isToday, subMonths, addMonths } from 'date-fns';
import { pt } from 'date-fns/locale';
import { isTaskDone } from '@/lib/taskStatus';

interface CalendarViewProps {
  calMonth: Date;
  setCalMonth: (d: Date) => void;
  calDays: Date[];
  firstDayOffset: number;
  tasksByDate: Record<string, any[]>;
  isOverdue: (t: any) => boolean;
  onTaskClick: (t: any) => void;
}

export function CalendarView({
  calMonth, setCalMonth, calDays, firstDayOffset, tasksByDate, isOverdue, onTaskClick,
}: CalendarViewProps) {
  const weekDays = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={() => setCalMonth(subMonths(calMonth, 1))}>← Anterior</Button>
        <h2 className="text-lg font-semibold capitalize">
          {format(calMonth, 'MMMM yyyy', { locale: pt })}
        </h2>
        <Button variant="outline" size="sm" onClick={() => setCalMonth(addMonths(calMonth, 1))}>Próximo →</Button>
      </div>

      <div className="grid grid-cols-7 border rounded-lg overflow-hidden">
        {weekDays.map(d => (
          <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2 bg-muted/50 border-b">
            {d}
          </div>
        ))}
        {Array.from({ length: firstDayOffset }).map((_, i) => (
          <div key={`empty-${i}`} className="min-h-[80px] border-b border-r bg-muted/20" />
        ))}
        {calDays.map(day => {
          const key = format(day, 'yyyy-MM-dd');
          const dayTasks = tasksByDate[key] || [];
          const isToday_ = isToday(day);

          return (
            <div key={key} className={cn("min-h-[80px] border-b border-r p-1", isToday_ && 'bg-primary/5')}>
              <span className={cn("text-xs font-medium", isToday_ && 'text-primary font-bold')}>
                {format(day, 'd')}
              </span>
              <div className="space-y-0.5 mt-0.5">
                {dayTasks.slice(0, 3).map(t => (
                  <div
                    key={t.id}
                    onClick={() => onTaskClick(t)}
                    className={cn(
                      "text-[10px] leading-tight px-1 py-0.5 rounded cursor-pointer truncate",
                      isOverdue(t)
                        ? 'bg-destructive/10 text-destructive'
                        : isTaskDone(t)
                          ? 'bg-success/15 text-success'
                          : 'bg-primary/10 text-primary'
                    )}
                  >
                    {t.name}
                  </div>
                ))}
                {dayTasks.length > 3 && (
                  <span className="text-[10px] text-muted-foreground">+{dayTasks.length - 3}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
