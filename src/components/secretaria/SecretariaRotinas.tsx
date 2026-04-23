import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckSquare, Square, RotateCw } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';
import { isTaskDone, isTaskOpen } from '@/lib/taskStatus';

export function RoutineMonthCard({ tasks: routineTasks }: { tasks: any[] }) {
  const navigate = useNavigate();
  const done = routineTasks.filter(isTaskDone);
  const todo = routineTasks.filter(isTaskOpen);

  if (routineTasks.length === 0) return null;

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <RotateCw className="h-4 w-4 text-primary" /> Rotinas do Mês
          <Badge variant="secondary" className="ml-auto text-xs">{done.length} de {routineTasks.length} feitas</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {todo.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Por fazer</p>
            {todo.map(t => (
              <div key={t.id} className="flex items-center gap-2 p-2 rounded-md bg-background border cursor-pointer hover:shadow-sm transition-shadow" onClick={() => navigate('/hub/tarefas')}>
                <Square className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-sm flex-1 truncate">{t.name}</span>
                {t.deadline && <span className="text-[10px] text-muted-foreground shrink-0">{format(parseISO(t.deadline), 'd MMM', { locale: pt })}</span>}
              </div>
            ))}
          </div>
        )}
        {done.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Feitas</p>
            {done.map(t => (
              <div key={t.id} className="flex items-center gap-2 p-2 rounded-md bg-background/50 border border-border/50 cursor-pointer" onClick={() => navigate('/hub/tarefas')}>
                <CheckSquare className="h-3.5 w-3.5 text-success shrink-0" />
                <span className="text-sm flex-1 truncate line-through text-muted-foreground">{t.name}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
