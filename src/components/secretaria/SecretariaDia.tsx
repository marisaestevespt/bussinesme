import { useMemo } from 'react';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, CalendarClock, AlertTriangle, Users, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useUnifiedResponsibilities } from '@/hooks/useUnifiedResponsibilities';
import { MyTasksTable } from './MyTasksTable';
import { useMyMeetings, useMyTimeEntries, useMonthRoutineTasks } from './secretaria-shared';
import { RoutineMonthCard } from './SecretariaRotinas';
import { isToday, parseISO } from 'date-fns';
import { StatCard } from '@/components/editorial';

export default function SecretariaDia() {
  const meetings = useMyMeetings();
  const timeEntries = useMyTimeEntries();
  const routineTasks = useMonthRoutineTasks();
  const unified = useUnifiedResponsibilities();
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const todayMeetings = useMemo(() => (meetings.data || []).filter((m: any) => isToday(parseISO(m.date_time))), [meetings.data]);
  const todayTime = useMemo(() => (timeEntries.data || []).filter((e: any) => e.entry_date === todayStr), [timeEntries.data, todayStr]);
  const todayHours = useMemo(() => todayTime.reduce((sum: number, e: any) => sum + (e.duration || 0), 0), [todayTime]);

  return (
    <div className="space-y-6">
      <RoutineMonthCard tasks={routineTasks.data || []} />

      {(() => {
        const todayOnlyCount = unified.todayItems.filter((i: any) => {
          if (!i.date) return false;
          const d = parseISO(i.date.split('T')[0]);
          return isToday(d);
        }).length;
        const overdueCount = unified.todayItems.length - todayOnlyCount;
        return (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-5">
            <StatCard tone="primary" size="sm" value={todayOnlyCount} label={<><CalendarClock className="h-3 w-3 inline mr-1.5 -mt-0.5" />prazo hoje</>} />
            <StatCard tone="destructive" size="sm" value={overdueCount} label={<><AlertTriangle className="h-3 w-3 inline mr-1.5 -mt-0.5" />em atraso</>} />
            <StatCard tone="mocha" size="sm" value={todayMeetings.length} label={<><Users className="h-3 w-3 inline mr-1.5 -mt-0.5" />reuniões hoje</>} />
            <StatCard tone="gold" size="sm" value={`${todayHours.toFixed(1)}h`} label={<><Clock className="h-3 w-3 inline mr-1.5 -mt-0.5" />tempo registado</>} />
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
    </div>
  );
}
