import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Calendar as CalIcon, Users as UsersIcon, ListTodo, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';

const WEEK_DAYS = ['S','T','Q','Q','S','S','D']; // Mon..Sun (PT)

function startOfMonthGrid(year: number, month: number) {
  const first = new Date(year, month - 1, 1);
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(first.getDate() - offset);
  return start;
}

type AgendaItem = {
  id: string;
  date: string;
  kind: 'event' | 'meeting' | 'task' | 'deliverable';
  title: string;
  meta?: string;
  href?: string;
};

const KIND_LABEL: Record<string, string> = {
  event: 'Evento',
  meeting: 'Reunião',
  task: 'Tarefa',
  deliverable: 'Entrega',
};
const KIND_DOT: Record<string, string> = {
  event: 'bg-blue-500',
  meeting: 'bg-emerald-500',
  task: 'bg-amber-500',
  deliverable: 'bg-violet-500',
};
const KIND_ICON: Record<string, any> = {
  event: CalIcon,
  meeting: UsersIcon,
  task: ListTodo,
  deliverable: Package,
};

export function BlockAgenda({ year, month }: { year: number; month: number }) {
  const [openDay, setOpenDay] = useState<string | null>(null);

  const startISO = `${year}-${String(month).padStart(2,'0')}-01`;
  const endDay = new Date(year, month, 0).getDate();
  const endISO = `${year}-${String(month).padStart(2,'0')}-${String(endDay).padStart(2,'0')}`;

  const { data } = useQuery({
    queryKey: ['cockpit-agenda', year, month],
    queryFn: async () => {
      const [events, meetings, tasks, deliverables] = await Promise.all([
        supabase.from('events').select('id,title,start_date').gte('start_date', startISO).lte('start_date', endISO + 'T23:59:59'),
        supabase.from('meetings').select('id,title,date_time').gte('date_time', startISO).lte('date_time', endISO + 'T23:59:59'),
        supabase.from('tasks').select('id,name,deadline,priority').gte('deadline', startISO).lte('deadline', endISO),
        supabase.from('project_deliverables').select('id,name,deadline,project_id').gte('deadline', startISO).lte('deadline', endISO),
      ]);
      const items: AgendaItem[] = [
        ...(events.data || []).map((e: any) => ({ id: 'e'+e.id, date: (e.start_date||'').slice(0,10), kind: 'event' as const, title: e.title, href: '/hub/agenda' })),
        ...(meetings.data || []).map((m: any) => ({ id: 'm'+m.id, date: (m.date_time||'').slice(0,10), kind: 'meeting' as const, title: m.title, meta: (m.date_time||'').slice(11,16), href: `/hub/reunioes/${m.id}` })),
        ...(tasks.data || []).map((t: any) => ({ id: 't'+t.id, date: t.deadline, kind: 'task' as const, title: t.name, meta: t.priority, href: '/hub/tarefas' })),
        ...(deliverables.data || []).map((d: any) => ({ id: 'd'+d.id, date: d.deadline, kind: 'deliverable' as const, title: d.name, href: d.project_id ? `/hub/projetos/${d.project_id}` : undefined })),
      ].filter(i => i.date);
      return items;
    },
    staleTime: 60_000,
  });

  const items = data || [];

  const byDay = useMemo(() => {
    const map = new Map<string, AgendaItem[]>();
    items.forEach(i => {
      const arr = map.get(i.date) || [];
      arr.push(i);
      map.set(i.date, arr);
    });
    return map;
  }, [items]);

  const todayISO = new Date().toISOString().slice(0,10);
  const upcoming = useMemo(
    () => items.filter(i => i.date >= todayISO).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 12),
    [items, todayISO]
  );

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
  const dayDetail = openDay ? byDay.get(openDay) || [] : [];

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
        {/* Mini calendário */}
        <div>
          <div className="grid grid-cols-7 gap-1 text-[10px] text-muted-foreground mb-1 px-1">
            {WEEK_DAYS.map((d, i) => <div key={i} className="text-center">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {grid.map((d, i) => {
              const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
              const dayData = byDay.get(key) || [];
              const kinds = new Set(dayData.map(x => x.kind));
              return (
                <button
                  key={i}
                  onClick={() => dayData.length && setOpenDay(key)}
                  className={cn(
                    'aspect-square rounded-md p-1 text-left text-[11px] border transition-colors',
                    isSameMonth(d) ? 'bg-background border-border/60' : 'bg-muted/30 border-transparent text-muted-foreground/50',
                    isToday(d) && 'ring-2 ring-primary/40',
                    dayData.length > 0 && 'hover:bg-accent cursor-pointer',
                  )}
                >
                  <div className="font-medium tabular-nums">{d.getDate()}</div>
                  {kinds.size > 0 && (
                    <div className="mt-0.5 flex flex-wrap gap-0.5">
                      {[...kinds].map(k => <span key={k} className={cn('h-1 w-1 rounded-full', KIND_DOT[k])} />)}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex items-center gap-3 text-[10px] text-muted-foreground flex-wrap">
            {Object.entries(KIND_LABEL).map(([k, label]) => (
              <span key={k} className="inline-flex items-center gap-1">
                <span className={cn('h-1.5 w-1.5 rounded-full', KIND_DOT[k])} />{label}
              </span>
            ))}
          </div>
        </div>

        {/* Próximos */}
        <div className="hq-surface-sunken rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-xs font-medium text-muted-foreground">Próximos no mês</div>
            <span className="text-[10px] text-muted-foreground">{upcoming.length} de {items.length}</span>
          </div>
          {upcoming.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nada agendado.</p>
          ) : (
            <ul className="space-y-1.5 max-h-72 overflow-auto pr-1">
              {upcoming.map(i => {
                const Icon = KIND_ICON[i.kind];
                const date = new Date(i.date);
                const dayLabel = date.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' });
                const content = (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="tabular-nums text-muted-foreground w-12 shrink-0">{dayLabel}</span>
                    <Icon className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="truncate flex-1">{i.title}</span>
                    {i.meta && <Badge variant="outline" className="text-[9px] px-1 py-0">{i.meta}</Badge>}
                  </div>
                );
                return (
                  <li key={i.id} className="rounded-md hover:bg-background/60 px-1 py-0.5">
                    {i.href ? <Link to={i.href}>{content}</Link> : content}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <Sheet open={!!openDay} onOpenChange={(o) => !o && setOpenDay(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{openDay ? new Date(openDay).toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' }) : ''}</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-2 text-sm">
            {dayDetail.map(i => {
              const Icon = KIND_ICON[i.kind];
              return (
                <div key={i.id} className="flex items-start gap-2 p-2 rounded border">
                  <Icon className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div className="flex-1">
                    <div className="text-xs text-muted-foreground">{KIND_LABEL[i.kind]}{i.meta ? ` · ${i.meta}` : ''}</div>
                    <div className="font-medium">{i.title}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
