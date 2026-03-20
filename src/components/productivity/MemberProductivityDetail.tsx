import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { ArrowLeft, AlertTriangle, ChevronLeft, ChevronRight, CalendarIcon, Clock, CheckCircle2, Users } from 'lucide-react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addWeeks, subWeeks, eachDayOfInterval, parseISO, isSameDay, isAfter, isBefore, startOfDay, subDays, addDays } from 'date-fns';
import { pt } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { cn } from '@/lib/utils';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { sendNotification } from '@/hooks/useNotifications';
import { useAuth } from '@/hooks/useAuth';

type MemberRow = {
  id: string;
  name: string;
  monthlyAvailable: number;
  committedHours: number;
  freeHours: number;
  occupancy: number;
  capacityStatus: 'green' | 'amber' | 'red';
};

type Props = {
  member: any; // team_member record
  memberRow: MemberRow;
  allMembers: any[];
  allTasks: any[];
  allEntries: any[];
  allProjects: any[];
  allProfiles: any[];
  onBack: () => void;
};

const statusColors: Record<string, string> = { green: 'text-emerald-600', amber: 'text-amber-500', red: 'text-destructive' };
const statusBg: Record<string, string> = { green: 'bg-emerald-500', amber: 'bg-amber-400', red: 'bg-red-500' };

function formatMinutes(m: number) { return m >= 60 ? `${Math.floor(m / 60)}h${m % 60 > 0 ? ` ${m % 60}m` : ''}` : `${m}m`; }

export function MemberProductivityDetail({ member, memberRow, allMembers, allTasks, allEntries, allProjects, allProfiles, onBack }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const profileName = (pid: string | null) => allProfiles.find(p => p.id === pid)?.full_name || '—';
  const projectName = (pid: string | null) => allProjects.find(p => p.id === pid)?.name || '—';

  // Member's tasks (matched by profile_id)
  const memberTasks = useMemo(() =>
    allTasks.filter(t => t.assigned_to === member.profile_id),
    [allTasks, member.profile_id]
  );

  // Member's time entries
  const memberEntries = useMemo(() =>
    allEntries.filter(e => e.member_id === member.id),
    [allEntries, member.id]
  );

  const weeklyHours = Number(member.expected_weekly_hours || 40);
  const dailyHours = weeklyHours / 5;

  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5">
        <ArrowLeft className="h-4 w-4" /> Voltar à tabela
      </Button>

      <Card>
        <CardContent className="p-4 flex flex-wrap items-center gap-6">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
            {member.full_name?.charAt(0) || '?'}
          </div>
          <div className="flex-1 min-w-[200px]">
            <h2 className="text-lg font-semibold">{member.full_name}</h2>
            <p className="text-sm text-muted-foreground">{member.role_title || '—'} · {member.department || '—'}</p>
          </div>
          <div className="flex flex-wrap gap-4 text-center">
            <div><p className="text-xs text-muted-foreground">Disponíveis/mês</p><p className="text-lg font-bold">{memberRow.monthlyAvailable}h</p></div>
            <div><p className="text-xs text-muted-foreground">Comprometidas</p><p className="text-lg font-bold">{memberRow.committedHours}h</p></div>
            <div><p className="text-xs text-muted-foreground">Livres</p><p className={cn("text-lg font-bold", memberRow.freeHours < 0 && 'text-destructive')}>{memberRow.freeHours}h</p></div>
            <div>
              <p className="text-xs text-muted-foreground">Ocupação</p>
              <div className="flex items-center gap-1.5">
                <span className={cn("inline-block h-2.5 w-2.5 rounded-full", statusBg[memberRow.capacityStatus])} />
                <span className={cn("text-lg font-bold", statusColors[memberRow.capacityStatus])}>{memberRow.occupancy}%</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="by-day">Por Dia</TabsTrigger>
          <TabsTrigger value="by-week">Por Semana</TabsTrigger>
          <TabsTrigger value="tasks">Tarefas</TabsTrigger>
          <TabsTrigger value="reassign">Reatribuição</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab memberTasks={memberTasks} memberEntries={memberEntries} weeklyHours={weeklyHours} dailyHours={dailyHours} profileName={profileName} projectName={projectName} />
        </TabsContent>
        <TabsContent value="by-day">
          <ByDayTab memberTasks={memberTasks} dailyHours={dailyHours} projectName={projectName} />
        </TabsContent>
        <TabsContent value="by-week">
          <ByWeekTab memberTasks={memberTasks} memberEntries={memberEntries} weeklyHours={weeklyHours} projectName={projectName} />
        </TabsContent>
        <TabsContent value="tasks">
          <TasksTab memberTasks={memberTasks} dailyHours={dailyHours} profileName={profileName} projectName={projectName} qc={qc} />
        </TabsContent>
        <TabsContent value="reassign">
          <ReassignTab member={member} memberTasks={memberTasks} allMembers={allMembers} allTasks={allTasks} allEntries={allEntries} profileName={profileName} projectName={projectName} weeklyHours={weeklyHours} qc={qc} userId={user?.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ─── TAB 1: VISÃO GERAL ─── */
function OverviewTab({ memberTasks, memberEntries, weeklyHours, dailyHours, profileName, projectName }: any) {
  const [period, setPeriod] = useState<'week' | 'month'>('month');
  const now = new Date();
  const range = period === 'week'
    ? { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) }
    : { start: startOfMonth(now), end: endOfMonth(now) };

  const periodEntries = memberEntries.filter((e: any) => {
    const d = new Date(e.entry_date);
    return d >= range.start && d <= range.end;
  });
  const periodTasks = memberTasks.filter((t: any) => {
    if (!t.deadline) return false;
    const d = parseISO(t.deadline);
    return d >= range.start && d <= range.end;
  });

  const totalReal = periodEntries.reduce((s: number, e: any) => s + Number(e.duration || 0), 0);
  const totalEstimated = periodTasks.reduce((s: number, t: any) => s + Number(t.estimated_time || 0), 0);
  const expectedHours = period === 'week' ? weeklyHours : weeklyHours * 4.33;
  const freeHours = Math.round((expectedHours - totalEstimated) * 10) / 10;
  const doneTasks = periodTasks.filter((t: any) => t.status === 'done').length;
  const overdueTasks = memberTasks.filter((t: any) => t.deadline && t.status !== 'done' && isBefore(parseISO(t.deadline), startOfDay(now)));
  const noEstimate = memberTasks.filter((t: any) => t.status !== 'done' && !t.estimated_time);

  // Bar chart last 14 days
  const days14 = eachDayOfInterval({ start: subDays(now, 13), end: now });
  const chartData = days14.map(day => {
    const dayStr = format(day, 'yyyy-MM-dd');
    const est = memberTasks.filter((t: any) => t.deadline === dayStr).reduce((s: number, t: any) => s + Number(t.estimated_time || 0), 0);
    const real = memberEntries.filter((e: any) => e.entry_date === dayStr).reduce((s: number, e: any) => s + Number(e.duration || 0), 0);
    return { day: format(day, 'dd/MM'), estimadas: Number((est / 60).toFixed(1)), reais: Number(real.toFixed(1)) };
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button size="sm" variant={period === 'week' ? 'default' : 'outline'} onClick={() => setPeriod('week')}>Esta semana</Button>
        <Button size="sm" variant={period === 'month' ? 'default' : 'outline'} onClick={() => setPeriod('month')}>Este mês</Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Horas registadas</p><p className="text-xl font-bold">{totalReal.toFixed(1)}h</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Horas estimadas</p><p className="text-xl font-bold">{formatMinutes(totalEstimated)}</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Horas livres</p><p className={cn("text-xl font-bold", freeHours < 0 && 'text-destructive')}>{freeHours.toFixed(1)}h</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Concluídas</p><p className="text-xl font-bold">{doneTasks}</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Em atraso</p><p className="text-xl font-bold flex items-center gap-1">{overdueTasks.length}{overdueTasks.length > 0 && <Badge variant="destructive" className="text-[10px] px-1">{overdueTasks.length}</Badge>}</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Sem estimativa</p><p className="text-xl font-bold flex items-center gap-1">{noEstimate.length}{noEstimate.length > 0 && <Badge variant="secondary" className="text-[10px] px-1 bg-amber-100 text-amber-700">{noEstimate.length}</Badge>}</p></CardContent></Card>
      </div>

      {/* Chart */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Horas estimadas vs reais (14 dias)</CardTitle></CardHeader>
        <CardContent className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <XAxis dataKey="day" fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip />
              <Legend />
              <Bar dataKey="estimadas" fill="hsl(var(--muted-foreground))" radius={[3,3,0,0]} />
              <Bar dataKey="reais" fill="hsl(var(--primary))" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Alerts */}
      {(memberRow_occupancy_gt100(memberTasks, weeklyHours) || overdueTasks.length > 0 || noEstimate.length > 0) && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-destructive" /> Alertas ativos</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {overdueTasks.length > 0 && (
              <div>
                <p className="font-medium text-destructive">Tarefas em atraso ({overdueTasks.length})</p>
                <ul className="list-disc pl-5 text-muted-foreground">
                  {overdueTasks.slice(0, 5).map((t: any) => <li key={t.id}>{t.name} — {t.deadline ? format(parseISO(t.deadline), 'dd/MM') : ''}</li>)}
                </ul>
              </div>
            )}
            {noEstimate.length > 0 && (
              <div>
                <p className="font-medium text-amber-600">Tarefas sem tempo estimado ({noEstimate.length})</p>
                <p className="text-xs text-muted-foreground">Estas tarefas não estão a contar para o cálculo de capacidade.</p>
                <ul className="list-disc pl-5 text-muted-foreground">
                  {noEstimate.slice(0, 5).map((t: any) => <li key={t.id}>{t.name}</li>)}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function memberRow_occupancy_gt100(_tasks: any[], _wh: number) { return false; } // placeholder

/* ─── TAB 2: POR DIA ─── */
function ByDayTab({ memberTasks, dailyHours, projectName }: any) {
  const [weekOffset, setWeekOffset] = useState(0);
  const now = new Date();
  const ws = startOfWeek(addWeeks(now, weekOffset), { weekStartsOn: 1 });
  const we = endOfWeek(ws, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: ws, end: we }).filter(d => d.getDay() !== 0 && d.getDay() !== 6);

  const statusLabel = (s: string) => {
    const m: Record<string, string> = { por_comecar: 'Por começar', a_fazer: 'A fazer', done: 'Done', aguarda_feedback: 'Aguarda', para_aprovacao: 'Aprovação', precisa_alteracoes: 'Alterações' };
    return m[s] || s;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setWeekOffset(o => o - 1)}><ChevronLeft className="h-4 w-4" /></Button>
        <span className="text-sm font-medium">{format(ws, "d MMM", { locale: pt })} — {format(we, "d MMM yyyy", { locale: pt })}</span>
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setWeekOffset(o => o + 1)}><ChevronRight className="h-4 w-4" /></Button>
        {weekOffset !== 0 && <Button variant="ghost" size="sm" onClick={() => setWeekOffset(0)}>Hoje</Button>}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {days.map(day => {
          const dayStr = format(day, 'yyyy-MM-dd');
          const dayTasks = memberTasks.filter((t: any) => t.deadline === dayStr);
          const totalEst = dayTasks.reduce((s: number, t: any) => s + Number(t.estimated_time || 0), 0);
          const estHours = totalEst / 60;
          const pct = dailyHours > 0 ? (estHours / dailyHours) * 100 : 0;
          const color = pct > 100 ? 'border-destructive/50 bg-destructive/5' : pct >= 80 ? 'border-amber-300 bg-amber-50 dark:bg-amber-950/20' : '';

          return (
            <Card key={dayStr} className={cn("overflow-hidden", color)}>
              <CardContent className="p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium">{format(day, 'EEE, d MMM', { locale: pt })}</p>
                  <Badge variant={pct > 100 ? 'destructive' : pct >= 80 ? 'secondary' : 'outline'} className="text-[10px]">{estHours.toFixed(1)}h / {dailyHours.toFixed(1)}h</Badge>
                </div>
                <Progress value={Math.min(pct, 100)} className="h-1.5" />
                {dayTasks.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Sem tarefas</p>
                ) : dayTasks.map((t: any) => (
                  <div key={t.id} className="text-xs border rounded p-1.5 space-y-0.5 cursor-pointer hover:bg-muted/50">
                    <p className="font-medium truncate">{t.name}</p>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      {t.estimated_time && <span>{formatMinutes(t.estimated_time)}</span>}
                      <span>{statusLabel(t.status)}</span>
                      {t.project_id && <span className="truncate">{projectName(t.project_id)}</span>}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

/* ─── TAB 3: POR SEMANA ─── */
function ByWeekTab({ memberTasks, memberEntries, weeklyHours, projectName }: any) {
  const [offset, setOffset] = useState(0);
  const now = new Date();

  const weeks = Array.from({ length: 8 }, (_, i) => {
    const idx = i - 4 + offset;
    const ws = startOfWeek(addWeeks(now, idx), { weekStartsOn: 1 });
    const we = endOfWeek(ws, { weekStartsOn: 1 });
    return { ws, we, label: `${format(ws, 'dd/MM')} → ${format(we, 'dd/MM')}`, isCurrent: idx === 0 };
  });

  const statusLabel = (s: string) => {
    const m: Record<string, string> = { por_comecar: 'Por começar', a_fazer: 'A fazer', done: 'Done', aguarda_feedback: 'Aguarda', para_aprovacao: 'Aprovação', precisa_alteracoes: 'Alterações' };
    return m[s] || s;
  };

  // Trend: last 4 weeks average
  const last4 = Array.from({ length: 4 }, (_, i) => {
    const ws = startOfWeek(subWeeks(now, 3 - i), { weekStartsOn: 1 });
    const we = endOfWeek(ws, { weekStartsOn: 1 });
    const real = memberEntries.filter((e: any) => { const d = new Date(e.entry_date); return d >= ws && d <= we; }).reduce((s: number, e: any) => s + Number(e.duration || 0), 0);
    const est = memberTasks.filter((t: any) => { if (!t.deadline) return false; const d = parseISO(t.deadline); return d >= ws && d <= we; }).reduce((s: number, t: any) => s + Number(t.estimated_time || 0), 0);
    return { real, est };
  });
  const avgReal = last4.reduce((s, w) => s + w.real, 0) / 4;
  const avgEst = last4.reduce((s, w) => s + w.est, 0) / 4;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setOffset(o => o - 4)}><ChevronLeft className="h-4 w-4" /></Button>
        <span className="text-sm font-medium">Semanas visíveis</span>
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setOffset(o => o + 4)}><ChevronRight className="h-4 w-4" /></Button>
        {offset !== 0 && <Button variant="ghost" size="sm" onClick={() => setOffset(0)}>Atual</Button>}
      </div>

      <div className="space-y-3">
        {weeks.map((w, i) => {
          const wTasks = memberTasks.filter((t: any) => { if (!t.deadline) return false; const d = parseISO(t.deadline); return d >= w.ws && d <= w.we; });
          const totalEst = wTasks.reduce((s: number, t: any) => s + Number(t.estimated_time || 0), 0);
          const estH = totalEst / 60;
          const real = memberEntries.filter((e: any) => { const d = new Date(e.entry_date); return d >= w.ws && d <= w.we; }).reduce((s: number, e: any) => s + Number(e.duration || 0), 0);
          const pct = weeklyHours > 0 ? (estH / weeklyHours) * 100 : 0;
          const color = pct > 100 ? 'border-destructive/30' : pct >= 80 ? 'border-amber-300' : '';

          return (
            <Card key={i} className={cn(w.isCurrent && 'ring-2 ring-primary/30', color)}>
              <CardContent className="p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{w.label} {w.isCurrent && <Badge variant="outline" className="text-[10px] ml-2">Atual</Badge>}</p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>Estimado: {estH.toFixed(1)}h</span>
                    <span>Real: {real.toFixed(1)}h</span>
                    <span>Disponível: {weeklyHours}h</span>
                    <Badge variant={pct > 100 ? 'destructive' : pct >= 80 ? 'secondary' : 'outline'} className="text-[10px]">{pct.toFixed(0)}%</Badge>
                  </div>
                </div>
                {wTasks.length > 0 && (
                  <div className="grid gap-1">
                    {wTasks.slice(0, 5).map((t: any) => (
                      <div key={t.id} className="text-xs flex items-center gap-2 border rounded px-2 py-1">
                        <span className="font-medium truncate flex-1">{t.name}</span>
                        {t.estimated_time && <span className="text-muted-foreground">{formatMinutes(t.estimated_time)}</span>}
                        <span className="text-muted-foreground">{statusLabel(t.status)}</span>
                        {t.deadline && <span className="text-muted-foreground">{format(parseISO(t.deadline), 'dd/MM')}</span>}
                      </div>
                    ))}
                    {wTasks.length > 5 && <p className="text-xs text-muted-foreground">+{wTasks.length - 5} tarefas</p>}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground italic">
        Nas últimas 4 semanas, este membro trabalhou em média {avgReal.toFixed(1)}h por semana, com {formatMinutes(Math.round(avgEst / 4))} estimadas.
      </p>
    </div>
  );
}

/* ─── TAB 4: TAREFAS ─── */
function TasksTab({ memberTasks, dailyHours, profileName, projectName, qc }: any) {
  const [filter, setFilter] = useState('all');
  const [rescheduleId, setRescheduleId] = useState<string | null>(null);
  const [newDeadline, setNewDeadline] = useState<Date | undefined>();
  const now = new Date();

  const filtered = useMemo(() => {
    let list = [...memberTasks];
    const ws = startOfWeek(now, { weekStartsOn: 1 });
    const we = endOfWeek(now, { weekStartsOn: 1 });
    const ms = startOfMonth(now);
    const me = endOfMonth(now);

    switch (filter) {
      case 'overdue': list = list.filter((t: any) => t.deadline && t.status !== 'done' && isBefore(parseISO(t.deadline), startOfDay(now))); break;
      case 'week': list = list.filter((t: any) => t.deadline && parseISO(t.deadline) >= ws && parseISO(t.deadline) <= we); break;
      case 'month': list = list.filter((t: any) => t.deadline && parseISO(t.deadline) >= ms && parseISO(t.deadline) <= me); break;
      case 'no_estimate': list = list.filter((t: any) => !t.estimated_time && t.status !== 'done'); break;
    }
    return list.sort((a: any, b: any) => (a.deadline || '9999').localeCompare(b.deadline || '9999'));
  }, [memberTasks, filter]);

  const updateDeadline = useMutation({
    mutationFn: async ({ id, deadline }: { id: string; deadline: string }) => {
      const { error } = await supabase.from('tasks').update({ deadline }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tasks_list'] }); toast.success('Data atualizada'); setRescheduleId(null); },
    onError: () => toast.error('Erro ao atualizar'),
  });

  const priorityLabel = (v: string) => ({ alta: 'P1', media: 'P2', baixa: 'P3' }[v] || v);
  const statusLabel = (s: string) => {
    const m: Record<string, string> = { por_comecar: 'Por começar', a_fazer: 'A fazer', done: 'Done', aguarda_feedback: 'Aguarda', para_aprovacao: 'Aprovação', precisa_alteracoes: 'Alterações' };
    return m[s] || s;
  };

  const FILTERS = [
    { value: 'all', label: 'Todas' },
    { value: 'overdue', label: 'Em atraso' },
    { value: 'week', label: 'Esta semana' },
    { value: 'month', label: 'Este mês' },
    { value: 'no_estimate', label: 'Sem estimativa' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {FILTERS.map(f => (
          <Button key={f.value} size="sm" variant={filter === f.value ? 'default' : 'outline'} onClick={() => setFilter(f.value)}>{f.label}</Button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Tarefa</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Prioridade</TableHead>
              <TableHead>Data limite</TableHead>
              <TableHead className="text-right">Estimado</TableHead>
              <TableHead>Projeto</TableHead>
              <TableHead className="w-[100px]"></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8 text-sm">Nenhuma tarefa encontrada</TableCell></TableRow>
              ) : filtered.map((t: any) => {
                const overdue = t.deadline && t.status !== 'done' && isBefore(parseISO(t.deadline), startOfDay(now));
                return (
                  <TableRow key={t.id} className={cn(overdue && 'bg-destructive/5')}>
                    <TableCell className="font-medium text-sm max-w-[200px] truncate">{t.name}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px]">{statusLabel(t.status)}</Badge></TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px]">{priorityLabel(t.priority)}</Badge></TableCell>
                    <TableCell className={cn("text-sm", overdue && 'text-destructive')}>{t.deadline ? format(parseISO(t.deadline), 'dd/MM/yyyy') : '—'}</TableCell>
                    <TableCell className="text-sm text-right">{t.estimated_time ? formatMinutes(t.estimated_time) : <span className="text-amber-500 text-xs">Sem est.</span>}</TableCell>
                    <TableCell className="text-sm text-muted-foreground truncate">{t.project_id ? projectName(t.project_id) : '—'}</TableCell>
                    <TableCell>
                      <Popover open={rescheduleId === t.id} onOpenChange={open => { if (open) { setRescheduleId(t.id); setNewDeadline(t.deadline ? parseISO(t.deadline) : undefined); } else setRescheduleId(null); }}>
                        <PopoverTrigger asChild><Button variant="ghost" size="sm" className="text-xs h-7"><CalendarIcon className="h-3 w-3 mr-1" />Reagendar</Button></PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="end">
                          <Calendar mode="single" selected={newDeadline} onSelect={d => { if (d) { updateDeadline.mutate({ id: t.id, deadline: format(d, 'yyyy-MM-dd') }); } }} />
                        </PopoverContent>
                      </Popover>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

/* ─── TAB 5: REATRIBUIÇÃO ─── */
function ReassignTab({ member, memberTasks, allMembers, allTasks, allEntries, profileName, projectName, weeklyHours, qc, userId }: any) {
  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);
  const [selectedMember, setSelectedMember] = useState<string | null>(null);
  const now = new Date();

  // Candidate tasks: overdue + overloaded weeks
  const candidates = useMemo(() => {
    const overdue = memberTasks.filter((t: any) => t.deadline && t.status !== 'done' && isBefore(parseISO(t.deadline), startOfDay(now)));
    const future = memberTasks.filter((t: any) => t.deadline && t.status !== 'done' && !isBefore(parseISO(t.deadline), startOfDay(now)));
    const overloaded = future; // simplified: show all non-done future tasks as candidates
    const all = [...overdue, ...overloaded];
    const unique = Array.from(new Map(all.map(t => [t.id, t])).values());
    return unique.sort((a: any, b: any) => (a.deadline || '9999').localeCompare(b.deadline || '9999'));
  }, [memberTasks]);

  // Available members with capacity
  const available = useMemo(() => {
    const ws = startOfWeek(now, { weekStartsOn: 1 });
    const we = endOfWeek(now, { weekStartsOn: 1 });
    const ms = startOfMonth(now);
    const me = endOfMonth(now);

    return allMembers
      .filter((m: any) => m.id !== member.id && m.status === 'ativo')
      .map((m: any) => {
        const mWeekly = Number(m.expected_weekly_hours || 40);
        const mMonthly = mWeekly * 4.33;
        const mTasks = allTasks.filter((t: any) => t.assigned_to === m.profile_id && t.status !== 'done');
        const weekTasks = mTasks.filter((t: any) => t.deadline && parseISO(t.deadline) >= ws && parseISO(t.deadline) <= we);
        const monthTasks = mTasks.filter((t: any) => t.deadline && parseISO(t.deadline) >= ms && parseISO(t.deadline) <= me);
        const weekEst = weekTasks.reduce((s: number, t: any) => s + Number(t.estimated_time || 0), 0) / 60;
        const monthEst = monthTasks.reduce((s: number, t: any) => s + Number(t.estimated_time || 0), 0) / 60;
        const freeWeek = Math.round((mWeekly - weekEst) * 10) / 10;
        const freeMonth = Math.round((mMonthly - monthEst) * 10) / 10;
        const occ = mMonthly > 0 ? Math.round((monthEst / mMonthly) * 100) : 0;
        const isOwner = (m.role_title || '').toLowerCase().match(/owner|fundador|ceo/);
        const sameDept = m.department === member.department;
        const sortKey = sameDept ? 0 : isOwner ? 2 : 1;
        return { ...m, freeWeek, freeMonth, occ, isOwner: !!isOwner, sameDept, sortKey };
      })
      .sort((a: any, b: any) => a.sortKey - b.sortKey || b.freeMonth - a.freeMonth);
  }, [allMembers, allTasks, member]);

  const toggleTask = (id: string) => setSelectedTasks(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const reassign = useMutation({
    mutationFn: async () => {
      const target = available.find((m: any) => m.id === selectedMember);
      if (!target || selectedTasks.length === 0) return;
      for (const tid of selectedTasks) {
        const task = memberTasks.find((t: any) => t.id === tid);
        const { error } = await supabase.from('tasks').update({
          assigned_to: target.profile_id,
          original_assignee: task?.assigned_to || null,
        }).eq('id', tid);
        if (error) throw error;
        // Notify
        if (target.profile_id && userId) {
          await sendNotification(target.profile_id, `Foi-te reatribuída a tarefa: ${task?.name || 'Tarefa'}`, userId);
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks_list'] });
      toast.success(`${selectedTasks.length} tarefa(s) reatribuída(s)`);
      setSelectedTasks([]);
      setSelectedMember(null);
    },
    onError: () => toast.error('Erro ao reatribuir'),
  });

  const selectedMemberObj = available.find((m: any) => m.id === selectedMember);

  const statusLabel = (s: string) => {
    const m: Record<string, string> = { por_comecar: 'Por começar', a_fazer: 'A fazer', done: 'Done', aguarda_feedback: 'Aguarda', para_aprovacao: 'Aprovação', precisa_alteracoes: 'Alterações' };
    return m[s] || s;
  };

  return (
    <div className="space-y-6">
      {/* Candidate tasks */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Tarefas candidatas a reatribuição</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead className="w-[40px]"></TableHead>
              <TableHead>Tarefa</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Data limite</TableHead>
              <TableHead className="text-right">Estimado</TableHead>
              <TableHead>Projeto</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {candidates.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6 text-sm">Sem tarefas candidatas</TableCell></TableRow>
              ) : candidates.map((t: any) => {
                const overdue = t.deadline && t.status !== 'done' && isBefore(parseISO(t.deadline), startOfDay(now));
                return (
                  <TableRow key={t.id} className={cn(selectedTasks.includes(t.id) && 'bg-primary/5')}>
                    <TableCell><Checkbox checked={selectedTasks.includes(t.id)} onCheckedChange={() => toggleTask(t.id)} /></TableCell>
                    <TableCell className="font-medium text-sm truncate">{t.name}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px]">{statusLabel(t.status)}</Badge></TableCell>
                    <TableCell className={cn("text-sm", overdue && 'text-destructive')}>{t.deadline ? format(parseISO(t.deadline), 'dd/MM') : '—'}</TableCell>
                    <TableCell className="text-sm text-right">{t.estimated_time ? formatMinutes(t.estimated_time) : '—'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{t.project_id ? projectName(t.project_id) : '—'}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Available members */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Membros disponíveis</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Membro</TableHead>
              <TableHead>Função</TableHead>
              <TableHead className="text-right">Livres (semana)</TableHead>
              <TableHead className="text-right">Livres (mês)</TableHead>
              <TableHead className="text-right">Ocupação</TableHead>
              <TableHead>Dept.</TableHead>
              <TableHead className="w-[40px]"></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {available.map((m: any) => (
                <TableRow
                  key={m.id}
                  className={cn("cursor-pointer", selectedMember === m.id && 'bg-primary/10')}
                  onClick={() => setSelectedMember(m.id)}
                >
                  <TableCell className="text-sm font-medium">{m.full_name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{m.role_title || '—'}</TableCell>
                  <TableCell className={cn("text-sm text-right", m.freeWeek < 0 && 'text-destructive')}>{m.freeWeek}h</TableCell>
                  <TableCell className={cn("text-sm text-right", m.freeMonth < 0 && 'text-destructive')}>{m.freeMonth}h</TableCell>
                  <TableCell className="text-sm text-right">{m.occ}%</TableCell>
                  <TableCell className="flex items-center gap-1">
                    {m.sameDept && <Badge variant="secondary" className="text-[10px]">{m.department}</Badge>}
                    {m.isOwner && <Badge variant="outline" className="text-[10px]">Owner</Badge>}
                    {!m.sameDept && !m.isOwner && <span className="text-xs text-muted-foreground">{m.department || '—'}</span>}
                  </TableCell>
                  <TableCell>
                    {selectedMember === m.id && <CheckCircle2 className="h-4 w-4 text-primary" />}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Reassign button */}
      <div className="flex items-center justify-end gap-3">
        {selectedTasks.length > 0 && selectedMemberObj && (
          <p className="text-sm text-muted-foreground">{selectedTasks.length} tarefa(s) → {selectedMemberObj.full_name}</p>
        )}
        <Button
          disabled={selectedTasks.length === 0 || !selectedMember || reassign.isPending}
          onClick={() => reassign.mutate()}
        >
          Reatribuir selecionadas{selectedMemberObj ? ` para ${selectedMemberObj.full_name?.split(' ')[0]}` : ''}
        </Button>
      </div>
    </div>
  );
}
