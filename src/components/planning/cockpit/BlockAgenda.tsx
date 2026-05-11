import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

const WEEK_DAYS = ['S','T','Q','Q','S','S','D']; // Mon..Sun (PT)

function startOfMonthGrid(year: number, month: number) {
  const first = new Date(year, month - 1, 1);
  const offset = (first.getDay() + 6) % 7; // Mon=0
  const start = new Date(first);
  start.setDate(first.getDate() - offset);
  return start;
}

export function BlockAgenda({ year, month }: { year: number; month: number }) {
  const [openDay, setOpenDay] = useState<string | null>(null);

  const startISO = `${year}-${String(month).padStart(2,'0')}-01`;
  const endDay = new Date(year, month, 0).getDate();
  const endISO = `${year}-${String(month).padStart(2,'0')}-${String(endDay).padStart(2,'0')}`;

  const { data } = useQuery({
    queryKey: ['cockpit-agenda', year, month],
    queryFn: async () => {
      const [events, meetings, tasks] = await Promise.all([
        supabase.from('events').select('id,title,start_date,end_date').gte('start_date', startISO).lte('start_date', endISO + 'T23:59:59'),
        supabase.from('meetings').select('id,title,date_time').gte('date_time', startISO).lte('date_time', endISO + 'T23:59:59'),
        supabase.from('tasks').select('id,name,deadline,priority').gte('deadline', startISO).lte('deadline', endISO),
      ]);
      return {
        events: events.data || [],
        meetings: meetings.data || [],
        tasks: tasks.data || [],
      };
    },
    staleTime: 60_000,
  });

  const byDay = useMemo(() => {
    const map = new Map<string, { events: any[]; meetings: any[]; tasks: any[] }>();
    const push = (key: string, bucket: 'events'|'meetings'|'tasks', item: any) => {
      if (!map.has(key)) map.set(key, { events: [], meetings: [], tasks: [] });
      map.get(key)![bucket].push(item);
    };
    (data?.events || []).forEach((e: any) => push((e.start_date || '').slice(0,10), 'events', e));
    (data?.meetings || []).forEach((m: any) => push((m.date_time || '').slice(0,10), 'meetings', m));
    (data?.tasks || []).forEach((t: any) => push((t.deadline || '').slice(0,10), 'tasks', t));
    return map;
  }, [data]);

  const grid: Date[] = [];
  const start = startOfMonthGrid(year, month);
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    grid.push(d);
  }

  const today = new Date();
  const isToday = (d: Date) => d.toDateString() === today.toDateString();
  const isSameMonth = (d: Date) => d.getMonth() === month - 1;

  const dayDetail = openDay ? byDay.get(openDay) : null;

  return (
    <>
      <div className="grid grid-cols-7 gap-1 text-[10px] text-muted-foreground mb-1 px-1">
        {WEEK_DAYS.map((d, i) => <div key={i} className="text-center">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {grid.map((d, i) => {
          const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
          const dayData = byDay.get(key);
          const count = (dayData?.events.length || 0) + (dayData?.meetings.length || 0) + (dayData?.tasks.length || 0);
          return (
            <button
              key={i}
              onClick={() => setOpenDay(key)}
              className={cn(
                'aspect-square rounded-md p-1 text-left text-[11px] border transition-colors',
                isSameMonth(d) ? 'bg-background border-border/60' : 'bg-muted/30 border-transparent text-muted-foreground/50',
                isToday(d) && 'ring-2 ring-primary/40',
                'hover:bg-accent',
              )}
            >
              <div className="font-medium tabular-nums">{d.getDate()}</div>
              {count > 0 && (
                <div className="mt-0.5 flex flex-wrap gap-0.5">
                  {(dayData?.events.length ?? 0) > 0 && <span className="h-1 w-1 rounded-full bg-blue-500" />}
                  {(dayData?.meetings.length ?? 0) > 0 && <span className="h-1 w-1 rounded-full bg-emerald-500" />}
                  {(dayData?.tasks.length ?? 0) > 0 && <span className="h-1 w-1 rounded-full bg-amber-500" />}
                </div>
              )}
            </button>
          );
        })}
      </div>

      <Sheet open={!!openDay} onOpenChange={(o) => !o && setOpenDay(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{openDay ? new Date(openDay).toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' }) : ''}</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-4 text-sm">
            {dayDetail?.events.length ? (
              <div>
                <div className="text-xs uppercase text-muted-foreground mb-1">Eventos</div>
                <ul className="space-y-1">{dayDetail.events.map((e: any) => <li key={e.id}>• {e.title}</li>)}</ul>
              </div>
            ) : null}
            {dayDetail?.meetings.length ? (
              <div>
                <div className="text-xs uppercase text-muted-foreground mb-1">Reuniões</div>
                <ul className="space-y-1">{dayDetail.meetings.map((m: any) => <li key={m.id}>• {m.title}</li>)}</ul>
              </div>
            ) : null}
            {dayDetail?.tasks.length ? (
              <div>
                <div className="text-xs uppercase text-muted-foreground mb-1">Tarefas com deadline</div>
                <ul className="space-y-1">{dayDetail.tasks.map((t: any) => <li key={t.id}>• {t.name}</li>)}</ul>
              </div>
            ) : null}
            {!dayDetail && <p className="text-muted-foreground">Sem registos neste dia.</p>}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}