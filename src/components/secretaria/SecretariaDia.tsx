import { useMemo } from 'react';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useUnifiedResponsibilities } from '@/hooks/useUnifiedResponsibilities';
import { UnifiedResponsibilitiesList } from '@/components/UnifiedResponsibilitiesList';
import { useMyMeetings, useMyTimeEntries, useMonthRoutineTasks } from './secretaria-shared';
import { RoutineMonthCard } from './SecretariaRotinas';
import { isToday, parseISO } from 'date-fns';
import { DayView } from '@/components/agenda/AppleCalendarViews';
import { unifiedItemToAgendaEvent, buildSourceTypes } from './secretaria-agenda-mappers';
import { useNavigate } from 'react-router-dom';
import { useProductColors } from '@/hooks/useProductColors';
import { useGlobalAgendaContext } from '@/hooks/useGlobalAgendaContext';
import { isSameDay, parseISO as parseIsoDate } from 'date-fns';

export default function SecretariaDia() {
  const navigate = useNavigate();
  const meetings = useMyMeetings();
  const timeEntries = useMyTimeEntries();
  const routineTasks = useMonthRoutineTasks();
  const unified = useUnifiedResponsibilities();
  const { data: productColors } = useProductColors();
  const { data: globalContext = [] } = useGlobalAgendaContext();

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const todayMeetings = useMemo(() => (meetings.data || []).filter((m: any) => isToday(parseISO(m.date_time))), [meetings.data]);
  const todayTime = useMemo(() => (timeEntries.data || []).filter((e: any) => e.entry_date === todayStr), [timeEntries.data, todayStr]);
  const todayHours = useMemo(() => todayTime.reduce((sum: number, e: any) => sum + (e.duration || 0), 0), [todayTime]);

  const dayAgendaEvents = useMemo(
    () => {
      const own = unified.todayItems
        .map(i => unifiedItemToAgendaEvent(i, productColors))
        .filter((e): e is NonNullable<typeof e> => !!e);
      const today = new Date();
      const ctx = globalContext.filter(ev => {
        try {
          const s = parseIsoDate(ev.start_date);
          const e = parseIsoDate(ev.end_date || ev.start_date);
          return s <= today && today <= new Date(e.getTime() + 86400000) || isSameDay(s, today);
        } catch { return false; }
      });
      return [...ctx, ...own];
    },
    [unified.todayItems, productColors, globalContext]
  );
  const sourceTypes = useMemo(buildSourceTypes, []);

  const handleEventClick = (ev: any) => {
    const src = ev._source;
    if (src === 'reuniao') navigate('/hub/reunioes');
    else if (src === 'projeto' || src === 'marco') navigate('/hub/projetos');
    else if (src === 'crm' || src === 'acao_venda') navigate('/hub/comercial');
    else if (src === 'conteudo') navigate('/hub/conteudos');
    else navigate('/hub/tarefas');
  };

  return (
    <div className="space-y-6">
      <RoutineMonthCard tasks={routineTasks.data || []} />

      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Tarefas para hoje</p><p className="text-2xl font-bold">{unified.todayItems.length}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Reuniões hoje</p><p className="text-2xl font-bold">{todayMeetings.length}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Tempo registado</p><p className="text-2xl font-bold">{todayHours.toFixed(1)}h</p></CardContent></Card>
      </div>

      <DayView
        current={new Date()}
        events={dayAgendaEvents}
        types={sourceTypes}
        onEventClick={handleEventClick}
      />

      <UnifiedResponsibilitiesList
        items={unified.todayItems}
        title="Tarefas para hoje"
        defaultDeadline={todayStr}
      />

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
