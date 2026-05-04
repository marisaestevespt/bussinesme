import { useMemo } from 'react';
import { useState } from 'react';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Layers, Eye, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useUnifiedResponsibilities } from '@/hooks/useUnifiedResponsibilities';
import { MyTasksTable } from './MyTasksTable';
import { useMyMeetings, useMyTimeEntries, useMonthRoutineTasks } from './secretaria-shared';
import { RoutineMonthCard } from './SecretariaRotinas';
import { isToday, parseISO } from 'date-fns';
import SecretariaBatches from './SecretariaBatches';

export default function SecretariaDia() {
  const meetings = useMyMeetings();
  const timeEntries = useMyTimeEntries();
  const routineTasks = useMonthRoutineTasks();
  const unified = useUnifiedResponsibilities();
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const todayMeetings = useMemo(() => (meetings.data || []).filter((m: any) => isToday(parseISO(m.date_time))), [meetings.data]);
  const todayTime = useMemo(() => (timeEntries.data || []).filter((e: any) => e.entry_date === todayStr), [timeEntries.data, todayStr]);
  const todayHours = useMemo(() => todayTime.reduce((sum: number, e: any) => sum + (e.duration || 0), 0), [todayTime]);
  const [focusMode, setFocusMode] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <Button
          variant={focusMode ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFocusMode((v) => !v)}
          className="gap-2"
        >
          {focusMode ? <Eye className="h-4 w-4" /> : <Layers className="h-4 w-4" />}
          {focusMode ? 'Voltar à vista normal' : 'Modo Foco (Batching)'}
        </Button>
      </div>

      {focusMode ? (
        <SecretariaBatches />
      ) : (
        <>
      <RoutineMonthCard tasks={routineTasks.data || []} />

      {(() => {
        const todayOnlyCount = unified.todayItems.filter((i: any) => {
          if (!i.date) return false;
          const d = parseISO(i.date.split('T')[0]);
          return isToday(d);
        }).length;
        const overdueCount = unified.todayItems.length - todayOnlyCount;
        return (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Prazo hoje</p><p className="text-2xl font-bold">{todayOnlyCount}</p></CardContent></Card>
            <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Em atraso</p><p className="text-2xl font-bold text-destructive">{overdueCount}</p></CardContent></Card>
            <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Reuniões hoje</p><p className="text-2xl font-bold">{todayMeetings.length}</p></CardContent></Card>
            <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Tempo registado</p><p className="text-2xl font-bold">{todayHours.toFixed(1)}h</p></CardContent></Card>
          </div>
        );
      })()}

      <MyTasksTable scope="today" />

      {(() => {
        const conteudosDia = unified.todayItems.filter((i: any) => i.source === 'conteudo');
        if (conteudosDia.length === 0) return null;
        return (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <FileText className="h-4 w-4" /> Conteúdos para hoje / em atraso ({conteudosDia.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {conteudosDia.map((c: any) => {
                const d = c.date ? parseISO(c.date.split('T')[0]) : null;
                const overdue = d && !isToday(d);
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
        </>
      )}
    </div>
  );
}
