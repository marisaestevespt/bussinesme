import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { format, parseISO, isToday, isSameDay, startOfDay, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, addDays, addMonths, subMonths, getDaysInMonth, getDay } from 'date-fns';
import { pt } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useMonthRoutineTasks } from './secretaria-shared';
import { RoutineMonthCard } from './SecretariaRotinas';

interface AgendaItem {
  id: string;
  title: string;
  type: 'event' | 'task' | 'meeting';
  startDate: Date;
  endDate: Date;
  time: string;
  isMultiDay: boolean;
}

export default function SecretariaAgenda() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [calView, setCalView] = useState<'mes' | 'semana'>('mes');
  const [weekOffset, setWeekOffset] = useState(0);
  const routineTasks = useMonthRoutineTasks();

  // Resolver profile.id (as tarefas usam assigned_to=profile.id, não user.id)
  const profileQuery = useQuery({
    queryKey: ['agenda-profile-id', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id').eq('user_id', user!.id).maybeSingle();
      return data?.id as string | undefined;
    },
  });
  const profileId = profileQuery.data;

  const mStart = startOfMonth(currentMonth);
  const mEnd = endOfMonth(currentMonth);
  const mStartStr = format(mStart, 'yyyy-MM-dd');
  const mEndStr = format(mEnd, 'yyyy-MM-dd');

  const weekViewStart = useMemo(() => startOfWeek(addDays(new Date(), weekOffset * 7), { weekStartsOn: 1 }), [weekOffset]);
  const weekViewEnd = useMemo(() => endOfWeek(weekViewStart, { weekStartsOn: 1 }), [weekViewStart]);
  const weekDays = useMemo(() => eachDayOfInterval({ start: weekViewStart, end: weekViewEnd }), [weekViewStart, weekViewEnd]);

  const fetchStart = calView === 'semana' ? format(weekViewStart, 'yyyy-MM-dd') : mStartStr;
  const fetchEnd = calView === 'semana' ? format(weekViewEnd, 'yyyy-MM-dd') : mEndStr;

  const myEvents = useQuery({
    queryKey: ['agenda-events', user?.id, profileId, fetchStart, fetchEnd],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data: participations } = await supabase.from('event_members').select('event_id').eq('profile_id', user!.id);
      const { data: createdEvents } = await supabase.from('events').select('*').eq('created_by', user!.id).lte('start_date', fetchEnd + 'T23:59:59').or(`end_date.gte.${fetchStart},end_date.is.null,start_date.gte.${fetchStart}`);
      const participantIds = participations?.map(p => p.event_id) || [];
      let participantEvents: any[] = [];
      if (participantIds.length > 0) {
        const { data } = await supabase.from('events').select('*').in('id', participantIds).lte('start_date', fetchEnd + 'T23:59:59').or(`end_date.gte.${fetchStart},end_date.is.null,start_date.gte.${fetchStart}`);
        participantEvents = data || [];
      }

      // Reuniões (meetings): tanto criadas pelo user como em que é participante (via profile.id)
      const meetingProfileIds = [user!.id, profileId].filter(Boolean) as string[];
      const { data: meetingParts } = await supabase
        .from('meeting_participants').select('meeting_id').in('profile_id', meetingProfileIds);
      const meetingIds = Array.from(new Set((meetingParts || []).map(p => p.meeting_id)));

      const meetingResults: any[] = [];
      if (meetingIds.length > 0) {
        const { data } = await supabase
          .from('meetings').select('*')
          .in('id', meetingIds)
          .gte('date_time', fetchStart + 'T00:00:00')
          .lte('date_time', fetchEnd + 'T23:59:59');
        meetingResults.push(...(data || []));
      }
      const { data: createdMeetings } = await supabase
        .from('meetings').select('*')
        .eq('created_by', user!.id)
        .gte('date_time', fetchStart + 'T00:00:00')
        .lte('date_time', fetchEnd + 'T23:59:59');
      meetingResults.push(...(createdMeetings || []));

      // Normalizar meetings para o formato de event (start_date / end_date / title)
      const normalizedMeetings = meetingResults.map((m: any) => ({
        id: `meeting-${m.id}`,
        _meetingId: m.id,
        title: m.title || 'Reunião',
        start_date: m.date_time,
        end_date: m.date_time,
        _isMeeting: true,
      }));

      const all = [...(createdEvents || []), ...participantEvents, ...normalizedMeetings];
      return Array.from(new Map(all.map(e => [e.id, e])).values());
    },
  });

  const myAgendaTasks = useQuery({
    queryKey: ['agenda-tasks', user?.id, profileId, fetchStart, fetchEnd],
    enabled: !!user?.id && !!profileId,
    queryFn: async () => {
      // Aceita tarefas atribuídas tanto via user.id (legado) como via profile.id
      const ids = [user!.id, profileId!].filter(Boolean) as string[];
      const { data } = await supabase
        .from('tasks')
        .select('*')
        .in('assigned_to', ids)
        .not('deadline', 'is', null)
        .gte('deadline', fetchStart)
        .lte('deadline', fetchEnd + 'T23:59:59');
      return data || [];
    },
  });

  const agendaItems: AgendaItem[] = useMemo(() => {
    const events = (myEvents.data || []).map(e => {
      const start = parseISO(e.start_date);
      const end = e.end_date ? parseISO(e.end_date) : start;
      return {
        id: e.id, title: e.title,
        type: ((e as any)._isMeeting ? 'meeting' : 'event') as any,
        startDate: start, endDate: end, time: format(start, 'HH:mm'),
        isMultiDay: startOfDay(start).getTime() !== startOfDay(end).getTime(),
      };
    });
    const tasks = (myAgendaTasks.data || []).map(t => {
      const d = parseISO(t.deadline);
      return { id: t.id, title: t.name, type: 'task' as const, startDate: d, endDate: d, time: '', isMultiDay: false };
    });
    return [...events, ...tasks];
  }, [myEvents.data, myAgendaTasks.data]);

  const goPrev = () => {
    if (calView === 'semana') setWeekOffset(w => w - 1);
    else setCurrentMonth(prev => subMonths(prev, 1));
  };
  const goNext = () => {
    if (calView === 'semana') setWeekOffset(w => w + 1);
    else setCurrentMonth(prev => addMonths(prev, 1));
  };

  const daysInMonth = getDaysInMonth(currentMonth);
  const firstDayOfWeek = (getDay(mStart) + 6) % 7;
  const monthDays = Array.from({ length: daysInMonth }, (_, i) => new Date(currentMonth.getFullYear(), currentMonth.getMonth(), i + 1));

  const getSingleDayItems = (day: Date) => agendaItems.filter(item => !item.isMultiDay && isSameDay(startOfDay(item.startDate), startOfDay(day)));

  const computeMultiDayRows = (daysRow: Date[]) => {
    const firstDay = startOfDay(daysRow[0]);
    const lastDay = startOfDay(daysRow[daysRow.length - 1]);
    const items = agendaItems.filter(item => item.isMultiDay && startOfDay(item.startDate) <= lastDay && startOfDay(item.endDate) >= firstDay);
    const rows: { item: AgendaItem; startCol: number; span: number }[][] = [];
    for (const item of items) {
      const barStart = startOfDay(item.startDate) < firstDay ? firstDay : startOfDay(item.startDate);
      const barEnd = startOfDay(item.endDate) > lastDay ? lastDay : startOfDay(item.endDate);
      const startCol = daysRow.findIndex(d => isSameDay(d, barStart));
      const endCol = daysRow.findIndex(d => isSameDay(d, barEnd));
      if (startCol === -1 || endCol === -1) continue;
      const span = endCol - startCol + 1;
      const entry = { item, startCol, span };
      let placed = false;
      for (const row of rows) {
        const conflicts = row.some(e => !(entry.startCol >= e.startCol + e.span || entry.startCol + entry.span <= e.startCol));
        if (!conflicts) { row.push(entry); placed = true; break; }
      }
      if (!placed) rows.push([entry]);
    }
    return rows;
  };

  const monthWeekRows = useMemo(() => {
    const allCells: (Date | null)[] = [...Array.from({ length: firstDayOfWeek }, () => null), ...monthDays];
    while (allCells.length % 7 !== 0) allCells.push(null);
    const rows: (Date | null)[][] = [];
    for (let i = 0; i < allCells.length; i += 7) rows.push(allCells.slice(i, i + 7));
    return rows;
  }, [firstDayOfWeek, monthDays]);

  const handleItemClick = (item: AgendaItem) => {
    if ((item.type as any) === 'meeting') navigate('/hub/reunioes');
    else if (item.type === 'event') navigate('/hub/agenda');
    else navigate('/hub/tarefas');
  };

  const headerLabel = calView === 'semana'
    ? `${format(weekViewStart, 'd MMM', { locale: pt })} — ${format(weekViewEnd, 'd MMM yyyy', { locale: pt })}`
    : format(currentMonth, 'MMMM yyyy', { locale: pt });

  return (
    <div className="space-y-6">
      <RoutineMonthCard tasks={routineTasks.data || []} />

      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          <Button variant={calView === 'mes' ? 'default' : 'outline'} size="sm" onClick={() => setCalView('mes')}>Mês</Button>
          <Button variant={calView === 'semana' ? 'default' : 'outline'} size="sm" onClick={() => setCalView('semana')}>Semana</Button>
        </div>
        <div className="flex items-center gap-4">
          <Button variant="outline" aria-label="Anterior" size="icon" className="h-8 w-8" onClick={goPrev}><ChevronLeft className="h-4 w-4" /></Button>
          <h2 className="text-lg font-bold min-w-[220px] text-center capitalize">{headerLabel}</h2>
          <Button variant="outline" aria-label="Seguinte" size="icon" className="h-8 w-8" onClick={goNext}><ChevronRight className="h-4 w-4" /></Button>
        </div>
        <div className="w-[100px]" />
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-7 gap-2 mb-2">
            {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map(d => (
              <div key={d} className="text-center text-sm font-semibold text-muted-foreground py-1">{d}</div>
            ))}
          </div>

          {calView === 'mes' ? (
            <div className="space-y-0">
              {monthWeekRows.map((weekRow, rowIdx) => {
                const validDays = weekRow.map(d => d || new Date(0));
                const multiDayRows = computeMultiDayRows(validDays);
                return (
                  <div key={rowIdx}>
                    {multiDayRows.length > 0 && (
                      <div className="grid grid-cols-7 gap-2">
                        {multiDayRows.map((row, rIdx) => (
                          <div key={rIdx} className="col-span-7 grid grid-cols-7 gap-2" style={{ marginBottom: '3px' }}>
                            {row.map(entry => (
                              <div key={entry.item.id} className="bg-primary/20 text-primary text-xs font-medium px-2 py-1 rounded-md truncate cursor-pointer hover:bg-primary/30 transition-colors" style={{ gridColumn: `${entry.startCol + 1} / span ${entry.span}` }} onClick={() => handleItemClick(entry.item)}>
                                {entry.item.title}
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="grid grid-cols-7 gap-2 mb-2">
                      {weekRow.map((day, colIdx) => {
                        if (!day) return <div key={`empty-${rowIdx}-${colIdx}`} className="min-h-[130px]" />;
                        const singleItems = getSingleDayItems(day);
                        const isCurrentDay = isToday(day);
                        return (
                          <div key={day.getDate()} className={cn('min-h-[130px] rounded-lg border p-2 transition-colors', isCurrentDay && 'border-primary bg-primary/5')}>
                            <p className={cn('text-sm font-semibold mb-1.5', isCurrentDay && 'text-primary font-bold')}>{day.getDate()}</p>
                            <div className="space-y-1">
                              {singleItems.slice(0, 4).map(item => (
                                <div key={`${item.type}-${item.id}`} className={cn('text-xs px-1.5 py-1 rounded truncate cursor-pointer transition-opacity hover:opacity-80', item.type === 'event' ? 'bg-primary/15 text-primary' : 'bg-secondary/30 text-secondary-foreground')} onClick={() => handleItemClick(item)} title={item.title}>
                                  {item.time ? `${item.time} ` : ''}{item.title}
                                </div>
                              ))}
                              {singleItems.length > 4 && <p className="text-xs text-muted-foreground pl-1">+{singleItems.length - 4} mais</p>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div>
              {(() => {
                const multiDayRows = computeMultiDayRows(weekDays);
                return multiDayRows.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-2 mb-2">
                    {multiDayRows.map((row, rIdx) => (
                      <div key={rIdx} className="col-span-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-2" style={{ marginBottom: '3px' }}>
                        {row.map(entry => (
                          <div key={entry.item.id} className="bg-primary/20 text-primary text-xs font-medium px-2 py-1 rounded-md truncate cursor-pointer hover:bg-primary/30 transition-colors lg:[grid-column:var(--col)]" style={{ ['--col' as any]: `${entry.startCol + 1} / span ${entry.span}` }} onClick={() => handleItemClick(entry.item)}>
                            {entry.item.title}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                ) : null;
              })()}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
                {weekDays.map(day => {
                  const singleItems = getSingleDayItems(day);
                  const isCurrentDay = isToday(day);
                  return (
                    <div key={format(day, 'yyyy-MM-dd')} className={cn('min-h-[260px] rounded-lg border p-3 transition-colors flex flex-col', isCurrentDay && 'border-primary bg-primary/5')}>
                      <p className={cn('text-sm font-semibold mb-2 capitalize', isCurrentDay && 'text-primary font-bold')}>{format(day, 'EEE d', { locale: pt })}</p>
                      <div className="space-y-1.5 flex-1">
                        {singleItems.length === 0 && <p className="text-xs text-muted-foreground italic">Sem itens</p>}
                        {singleItems.map(item => (
                          <div key={`${item.type}-${item.id}`} className={cn('text-xs px-2 py-1.5 rounded cursor-pointer transition-opacity hover:opacity-80 break-words leading-snug', item.type === 'event' ? 'bg-primary/15 text-primary' : 'bg-secondary/30 text-secondary-foreground')} onClick={() => handleItemClick(item)} title={item.title}>
                            {item.time ? `${item.time} ` : ''}{item.title}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
