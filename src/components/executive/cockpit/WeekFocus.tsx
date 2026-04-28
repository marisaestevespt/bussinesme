import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CalendarCheck, CalendarDays, Target, Flame, ChevronRight, AlertCircle, FolderKanban } from 'lucide-react';
import { format, isToday, isTomorrow, isThisWeek, parseISO, startOfWeek, endOfWeek, isWithinInterval } from 'date-fns';
import { pt } from 'date-fns/locale';
import { usePlanningData, planStatusLabel } from '@/hooks/usePlanningData';
import type { useCeoCockpit } from '@/hooks/useCeoCockpit';
import { isTaskOpen } from '@/lib/taskStatus';
import { EmptyHint } from '@/components/ui/loading-skeletons';

type Derived = NonNullable<ReturnType<typeof useCeoCockpit>['derived']>;

const MONTH_NAMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const PRIORITY_RANK: Record<string, number> = { urgente: 0, alta: 1, media: 2, baixa: 3 };

function formatMeetingDay(d: Date): string {
  if (isToday(d)) return 'Hoje';
  if (isTomorrow(d)) return 'Amanhã';
  return format(d, "d MMM", { locale: pt });
}

export function WeekFocus({ derived }: { derived: Derived }) {
  const now = new Date();
  const currentMonthName = MONTH_NAMES[now.getMonth()];
  const planning = usePlanningData(now.getFullYear());

  const monthGoals = planning.allGoals.filter(g => g.period === currentMonthName);

  // Top 5 priorities this week (priority + deadline this week)
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const topTasks = derived.tasks
    .filter((t: any) => isTaskOpen(t) && t.deadline)
    .filter((t: any) => isWithinInterval(parseISO(t.deadline), { start: weekStart, end: weekEnd }))
    .sort((a: any, b: any) => {
      const pa = PRIORITY_RANK[a.priority] ?? 9;
      const pb = PRIORITY_RANK[b.priority] ?? 9;
      if (pa !== pb) return pa - pb;
      return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
    })
    .slice(0, 5);

  // Upcoming meetings (this week, not done)
  const upcomingMeetings = derived.meetings
    .filter((m: any) => m.status !== 'terminada' && m.date_time && new Date(m.date_time) >= now)
    .filter((m: any) => isThisWeek(new Date(m.date_time), { weekStartsOn: 1 }))
    .slice(0, 5);

  // Projetos a vencer esta semana ou já atrasados
  const focusProjects = (derived.projects || [])
    .filter((p: any) => ['em_curso', 'em_revisao', 'em_pausa'].includes(p.status))
    .map((p: any) => {
      const deadline = p.deadline ? parseISO(p.deadline) : null;
      const overdue = !!deadline && deadline < now;
      const dueWeek = !!deadline && isWithinInterval(deadline, { start: weekStart, end: weekEnd });
      return { ...p, deadline, overdue, dueWeek };
    })
    .filter((p: any) => p.overdue || p.dueWeek)
    .sort((a: any, b: any) => {
      if (a.overdue && !b.overdue) return -1;
      if (!a.overdue && b.overdue) return 1;
      return (a.deadline?.getTime() ?? 0) - (b.deadline?.getTime() ?? 0);
    })
    .slice(0, 5);

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Foco da semana</h2>
        <Link to="/executive/weekly-align" className="text-xs text-primary hover:underline">Ver Weekly Align →</Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        {/* Metas do mês */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" /> Metas de {currentMonthName}
              {monthGoals.length > 0 && <Badge variant="outline" className="text-[10px] ml-auto">{monthGoals.length}</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {monthGoals.length === 0 ? (
              <div className="space-y-2 py-4 text-center">
                <Target className="h-6 w-6 mx-auto text-muted-foreground/40" />
                <EmptyHint>Sem metas para este mês</EmptyHint>
                <Link to="/executive/planeamento" className="text-xs text-primary hover:underline">Definir metas →</Link>
              </div>
            ) : monthGoals.slice(0, 5).map((g: any) => {
              const obj = planning.allObjectives.find((o: any) => o.id === g.objective_id);
              const dev = g.actual_value && g.target_value
                ? Number(g.actual_value) - Number(g.target_value)
                : null;
              return (
                <Link key={g.id} to="/executive/planeamento" className="block py-1.5 border-b last:border-0 hover:bg-muted/30 -mx-2 px-2 rounded transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium truncate">{obj?.title || '—'}</span>
                    <Badge variant={g.status === 'atingido' ? 'default' : 'secondary'} className="text-[9px] shrink-0">
                      {planStatusLabel(g.status)}
                    </Badge>
                  </div>
                  <div className="flex gap-2 text-[10px] text-muted-foreground mt-0.5">
                    <span>Alvo {g.target_value || '—'}</span>
                    <span>Real {g.actual_value || '—'}</span>
                    {dev != null && (
                      <span className={dev < 0 ? 'text-destructive font-medium' : 'text-success font-medium'}>
                        {dev >= 0 ? `+${dev}` : dev}
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </CardContent>
        </Card>

        {/* Top tarefas da semana */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Flame className="h-4 w-4 text-warning" /> Top prioridades
              {topTasks.length > 0 && <Badge variant="outline" className="text-[10px] ml-auto">{topTasks.length}</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {topTasks.length === 0 ? (
              <div className="py-4 text-center">
                <EmptyHint>Sem tarefas prioritárias esta semana</EmptyHint>
              </div>
            ) : topTasks.map((t: any) => (
              <Link key={t.id} to="/hub/tarefas" className="flex items-start gap-2 py-1 hover:bg-muted/30 -mx-2 px-2 rounded transition-colors">
                <div className={`mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 ${
                  t.priority === 'urgente' ? 'bg-destructive' :
                  t.priority === 'alta' ? 'bg-warning' :
                  t.priority === 'media' ? 'bg-info' : 'bg-muted-foreground'
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{t.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {format(parseISO(t.deadline), "EEE d MMM", { locale: pt })}
                  </p>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>

        {/* Reuniões da semana */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-info" /> Reuniões
              {upcomingMeetings.length > 0 && <Badge variant="outline" className="text-[10px] ml-auto">{upcomingMeetings.length}</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {upcomingMeetings.length === 0 ? (
              <div className="py-4 text-center">
                <EmptyHint>Sem reuniões esta semana</EmptyHint>
              </div>
            ) : upcomingMeetings.map((m: any) => {
              const dt = new Date(m.date_time);
              const needsConfirm = m.status === 'por_confirmar' || m.status === 'por_organizar';
              return (
                <Link key={m.id} to={`/hub/reunioes/${m.id}`} className="flex items-start gap-2 py-1 hover:bg-muted/30 -mx-2 px-2 rounded transition-colors">
                  <CalendarCheck className="h-3.5 w-3.5 text-info mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{m.title || 'Reunião'}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {formatMeetingDay(dt)} · {format(dt, 'HH:mm')}
                      {m.client_name && ` · ${m.client_name}`}
                    </p>
                  </div>
                  {needsConfirm && (
                    <AlertCircle className="h-3.5 w-3.5 text-warning shrink-0 mt-0.5" />
                  )}
                </Link>
              );
            })}
          </CardContent>
        </Card>

        {/* Projetos da semana */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <FolderKanban className="h-4 w-4 text-accent-violet" /> Projetos
              {focusProjects.length > 0 && <Badge variant="outline" className="text-[10px] ml-auto">{focusProjects.length}</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {focusProjects.length === 0 ? (
              <div className="py-4 text-center">
                <EmptyHint>Sem projetos críticos esta semana</EmptyHint>
              </div>
            ) : focusProjects.map((p: any) => (
              <Link key={p.id} to={`/hub/projetos/${p.id}`} className="flex items-start gap-2 py-1 hover:bg-muted/30 -mx-2 px-2 rounded transition-colors">
                <div className={`mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 ${p.overdue ? 'bg-destructive' : 'bg-warning'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{p.name}</p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {p.deadline ? format(p.deadline, "d MMM", { locale: pt }) : '—'}
                    {p.overdue && ' · atrasado'}
                    {p.client_name && ` · ${p.client_name}`}
                  </p>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}