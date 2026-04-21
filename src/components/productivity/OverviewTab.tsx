import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, AlertTriangle, CheckSquare, Flame } from 'lucide-react';
import { startOfWeek, endOfWeek, startOfDay, parseISO, isBefore } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { cn } from '@/lib/utils';
import { getDateRange, catLabel, PIE_COLORS, DONE_STATUSES } from './productivity-constants';

export function OverviewTab({ entries, members, tasks }: { entries: any[]; members: any[]; tasks: any[] }) {
  const { start, end } = getDateRange('week');
  const now = new Date();
  const today = startOfDay(now);
  const weekEntries = entries.filter(e => {
    const d = new Date(e.entry_date);
    return d >= start && d <= end;
  });

  const totalHours = weekEntries.reduce((s, e) => s + Number(e.duration || 0), 0);
  const clientHours = weekEntries.filter(e => e.client_id).reduce((s, e) => s + Number(e.duration || 0), 0);
  const internalHours = totalHours - clientHours;

  const hoursByMember: Record<string, number> = {};
  weekEntries.forEach(e => {
    const mid = e.member_id || 'unknown';
    hoursByMember[mid] = (hoursByMember[mid] || 0) + Number(e.duration || 0);
  });

  const topMemberId = Object.entries(hoursByMember).sort((a, b) => b[1] - a[1])[0]?.[0];
  const topMember = members.find(m => m.id === topMemberId);

  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

  const overdueTasks = useMemo(() =>
    (tasks || []).filter(t => t.deadline && !DONE_STATUSES.includes(t.status) && isBefore(parseISO(t.deadline), today)),
    [tasks, today]
  );

  const weeklyTasksDone = useMemo(() =>
    (tasks || []).filter(t => DONE_STATUSES.includes(t.status) && t.deadline && parseISO(t.deadline) >= weekStart && parseISO(t.deadline) <= weekEnd).length,
    [tasks, weekStart, weekEnd]
  );
  const weeklyTasksPlanned = useMemo(() =>
    (tasks || []).filter(t => t.deadline && parseISO(t.deadline) >= weekStart && parseISO(t.deadline) <= weekEnd).length,
    [tasks, weekStart, weekEnd]
  );
  const taskRatio = weeklyTasksPlanned > 0 ? Math.round((weeklyTasksDone / weeklyTasksPlanned) * 100) : weeklyTasksDone > 0 ? 100 : 0;

  const activeMembers = members.filter(m => m.status === 'ativo' || m.status === 'prestador');
  const overloadedCount = useMemo(() => {
    return activeMembers.filter(m => {
      const weeklyH = Number(m.expected_weekly_hours || 40);
      const mEntries = weekEntries.filter(e => e.member_id === m.id);
      const worked = mEntries.reduce((s: number, e: any) => s + Number(e.duration || 0), 0);
      return weeklyH > 0 && (worked / weeklyH) > 1.1;
    }).length;
  }, [activeMembers, weekEntries]);

  const barData = members.filter(m => m.status === 'ativo').map(m => ({
    name: m.full_name?.split(' ')[0] || 'N/A',
    horas: Number((hoursByMember[m.id] || 0).toFixed(1)),
  }));

  const catDist: Record<string, number> = {};
  weekEntries.forEach(e => {
    const c = e.category || 'outro';
    catDist[c] = (catDist[c] || 0) + Number(e.duration || 0);
  });
  const pieData = Object.entries(catDist).map(([key, val]) => ({ name: catLabel(key), value: Number(val.toFixed(1)) }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="border-l-4 border-l-primary">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">Horas (semana)</p>
                <p className="text-2xl font-bold mt-0.5">{totalHours.toFixed(1)}h</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{clientHours.toFixed(1)}h cliente · {internalHours.toFixed(1)}h interno</p>
              </div>
              <div className="p-2 rounded-lg bg-primary/10"><Clock className="h-4 w-4 text-primary" /></div>
            </div>
          </CardContent>
        </Card>

        <Card className={cn("border-l-4", overdueTasks.length > 0 ? "border-l-destructive" : "border-l-emerald-500")}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">Em Atraso</p>
                <p className={cn("text-2xl font-bold mt-0.5", overdueTasks.length > 0 ? 'text-destructive' : 'text-success')}>
                  {overdueTasks.length}
                </p>
                {overdueTasks.length > 0
                  ? <p className="text-[11px] text-destructive mt-0.5">tarefas/conteúdos atrasados</p>
                  : <p className="text-[11px] text-success mt-0.5">Tudo em dia 🎉</p>
                }
              </div>
              <div className={cn("p-2 rounded-lg", overdueTasks.length > 0 ? 'bg-destructive/10' : 'bg-emerald-500/10')}>
                <AlertTriangle className={cn("h-4 w-4", overdueTasks.length > 0 ? 'text-destructive' : 'text-success')} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">Tarefas da Semana</p>
                <div className="flex items-baseline gap-1.5 mt-0.5">
                  <p className="text-2xl font-bold">{weeklyTasksDone}</p>
                  <span className="text-sm text-muted-foreground">/ {weeklyTasksPlanned}</span>
                </div>
              </div>
              <div className="p-2 rounded-lg bg-blue-500/10"><CheckSquare className="h-4 w-4 text-info" /></div>
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${Math.min(taskRatio, 100)}%` }} />
            </div>
          </CardContent>
        </Card>

        <Card className={cn("border-l-4", overloadedCount > 0 ? "border-l-amber-500" : "border-l-emerald-500")}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">Sobrecarga</p>
                <p className={cn("text-2xl font-bold mt-0.5", overloadedCount > 0 ? 'text-warning' : 'text-success')}>
                  {overloadedCount > 0 ? `${overloadedCount} alerta${overloadedCount > 1 ? 's' : ''}` : 'OK'}
                </p>
                {overloadedCount > 0
                  ? <p className="text-[11px] text-warning mt-0.5">membros acima de 110%</p>
                  : <p className="text-[11px] text-success mt-0.5">Equipa equilibrada ✓</p>
                }
              </div>
              <div className={cn("p-2 rounded-lg", overloadedCount > 0 ? 'bg-amber-500/10' : 'bg-emerald-500/10')}>
                <Flame className={cn("h-4 w-4", overloadedCount > 0 ? 'text-warning' : 'text-success')} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Horas por membro (semana)</CardTitle></CardHeader>
          <CardContent className="h-64">
            {barData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData}><XAxis dataKey="name" fontSize={12} /><YAxis fontSize={12} /><Tooltip /><Bar dataKey="horas" fill="hsl(var(--primary))" radius={[4,4,0,0]} /></BarChart>
              </ResponsiveContainer>
            ) : <p className="text-sm text-muted-foreground text-center pt-20">Sem dados</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Distribuição por categoria</CardTitle></CardHeader>
          <CardContent className="h-64">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart><Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} label={({ name, value }) => `${name}: ${value}h`}>
                  {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie><Legend /></PieChart>
              </ResponsiveContainer>
            ) : <p className="text-sm text-muted-foreground text-center pt-20">Sem dados</p>}
          </CardContent>
        </Card>
      </div>

      {topMember && (
        <Card className="bg-gradient-to-r from-primary/5 to-transparent border-primary/20">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
              {topMember.full_name?.charAt(0)}
            </div>
            <div>
              <p className="text-sm font-medium">{topMember.full_name} — mais horas esta semana</p>
              <p className="text-xs text-muted-foreground">{(hoursByMember[topMemberId] || 0).toFixed(1)}h registadas</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
