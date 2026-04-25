import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { isTaskDone, isTaskOverdue, countDone } from '@/lib/taskStatus';

interface RoutinesSectionProps {
  thisWeekRoutines: any[];
  prevWeekRoutines: any[];
}

export function RoutinesSection({ thisWeekRoutines, prevWeekRoutines }: RoutinesSectionProps) {
  const navigate = useNavigate();

  const thisWeekDone = countDone(thisWeekRoutines);
  const prevWeekDone = countDone(prevWeekRoutines);
  const prevWeekTotal = prevWeekRoutines.length;

  const RoutineTable = ({ tasks, showStatus }: { tasks: any[]; showStatus?: boolean }) => (
    <Card>
      <CardContent className="p-0">
        {tasks.length === 0 ? (
          <EmptyHint>Sem rotinas</EmptyHint>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Rotina</TableHead>
                <TableHead>Função</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Responsável</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map((t: any) => {
                const isDone = isTaskDone(t);
                const isLate = isTaskOverdue(t);
                const routineInfo = t.planning_routines as any;

                return (
                  <TableRow
                    key={t.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate('/hub/tarefas')}
                  >
                    <TableCell>
                      {isDone ? (
                        <Badge variant="outline" className="text-[10px] bg-success/15 text-success border-success/30 dark:bg-success/20 dark:text-success">Feita</Badge>
                      ) : isLate ? (
                        <Badge variant="outline" className="text-[10px] bg-destructive/10 text-destructive border-destructive/30">Em falta</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">Por fazer</Badge>
                      )}
                    </TableCell>
                    <TableCell className={cn('text-sm', isDone && 'line-through text-muted-foreground')}>{t.name}</TableCell>
                    <TableCell className="text-xs">{routineInfo?.role_function || '—'}</TableCell>
                    <TableCell className="text-xs">{t.deadline ? format(parseISO(t.deadline), 'd MMM', { locale: pt }) : '—'}</TableCell>
                    <TableCell className="text-xs">{(t.profiles as any)?.full_name || '—'}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <h2 className="text-base font-semibold">7 // Rotinas</h2>
        <span className="text-xs text-muted-foreground">
          Esta semana: {thisWeekDone}/{thisWeekRoutines.length}
          {prevWeekTotal > 0 && ` · Semana anterior: ${prevWeekDone}/${prevWeekTotal}`}
        </span>
      </div>
      <Tabs defaultValue="esta_semana">
        <TabsList>
          <TabsTrigger value="esta_semana">Esta semana ({thisWeekRoutines.length})</TabsTrigger>
          <TabsTrigger value="semana_anterior">
            Semana anterior ({prevWeekTotal})
            {prevWeekTotal > 0 && prevWeekDone < prevWeekTotal && (
              <Badge variant="destructive" className="text-[9px] ml-1.5">{prevWeekTotal - prevWeekDone} em falta</Badge>
            )}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="esta_semana">
          <RoutineTable tasks={thisWeekRoutines} />
        </TabsContent>
        <TabsContent value="semana_anterior">
          <RoutineTable tasks={prevWeekRoutines} showStatus />
        </TabsContent>
      </Tabs>
    </section>
  );
}
