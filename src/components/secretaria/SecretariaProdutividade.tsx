import { useState, useMemo, useEffect, useRef } from 'react';
import { exportProductivityReport } from '@/lib/exportProductivityReport';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Clock, Play, Square, CalendarIcon, Trash2, FileDown } from 'lucide-react';
import { format, parseISO, isBefore, isWithinInterval, startOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, addDays, differenceInSeconds } from 'date-fns';
import { pt } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { useMyTasks, useMyTimeEntries, useMyTeamMember, useMyMeetings, useProjects, TIME_CATEGORIES, formatTimer } from './secretaria-shared';
import { isTaskDone, isTaskOpen, isTaskOverdue } from '@/lib/taskStatus';
import { EmptyHint } from '@/components/ui/loading-skeletons';

const today = startOfDay(new Date());
const weekStart = startOfWeek(today, { weekStartsOn: 1 });
const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
const monthStart = startOfMonth(today);
const monthEnd = endOfMonth(today);

export default function SecretariaProdutividade() {
  const tasks = useMyTasks();
  const timeEntries = useMyTimeEntries();
  const teamMember = useMyTeamMember();
  const allProjects = useProjects();
  const qc = useQueryClient();

  const [period, setPeriod] = useState<'week' | 'month' | 'custom'>('week');
  const [customFrom, setCustomFrom] = useState<Date | undefined>(undefined);
  const [customTo, setCustomTo] = useState<Date | undefined>(undefined);

  const [timerRunning, setTimerRunning] = useState(false);
  const [timerStart, setTimerStart] = useState<Date | null>(null);
  const [timerElapsed, setTimerElapsed] = useState(0);
  const [timerDesc, setTimerDesc] = useState('');
  const [timerProject, setTimerProject] = useState('');
  const [timerTask, setTimerTask] = useState('');
  const [timerCategory, setTimerCategory] = useState('interno');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const normalizedTimerTask = timerTask || null;
  const normalizedTimerProject = timerProject && timerProject !== 'none' ? timerProject : null;
  const canStartTimer = !!normalizedTimerTask && !timerRunning;

  useEffect(() => {
    if (timerRunning && timerStart) {
      intervalRef.current = setInterval(() => {
        setTimerElapsed(differenceInSeconds(new Date(), timerStart));
      }, 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [timerRunning, timerStart]);

  const startTimer = () => {
    if (!normalizedTimerTask) {
      toast.error('Seleciona uma tarefa para iniciar o timer');
      return;
    }

    setTimerStart(new Date());
    setTimerRunning(true);
    setTimerElapsed(0);
  };

  const stopTimer = async () => {
    if (!timerStart || !normalizedTimerTask) return;

    const durationHours = Math.round((timerElapsed / 3600) * 100) / 100;
    if (durationHours < 0.01) {
      toast.error('Duração mínima: 1 minuto');
      return;
    }

    const { error } = await supabase.from('time_entries').insert({
      member_id: teamMember.data?.id ?? null,
      entry_date: format(new Date(), 'yyyy-MM-dd'),
      duration: durationHours,
      category: timerCategory,
      description: timerDesc || null,
      project_id: normalizedTimerProject,
      task_id: normalizedTimerTask,
    });

    if (error) {
      toast.error('Erro ao guardar registo');
      return;
    }

    setTimerRunning(false);
    setTimerStart(null);
    setTimerElapsed(0);
    setTimerDesc('');
    setTimerProject('');
    setTimerTask('');
    setTimerCategory('interno');
    qc.invalidateQueries({ queryKey: ['my-time-entries'] });
    toast.success('Tempo registado');
  };

  const periodStart = period === 'week' ? weekStart : period === 'month' ? monthStart : (customFrom ? startOfDay(customFrom) : weekStart);
  const periodEnd = period === 'week' ? weekEnd : period === 'month' ? monthEnd : (customTo ? startOfDay(customTo) : weekEnd);

  const myMeetings = useMyMeetings();

  const allTimeEntries = useMemo(() => {
    const raw = timeEntries.data || [];
    const memberId = teamMember.data?.id;
    if (!memberId) return raw;

    const meetingEntries: any[] = [];
    const now = new Date();
    (myMeetings.data || []).forEach((meeting: any) => {
      const minutes = meeting.actual_duration_minutes ?? meeting.planned_duration_minutes ?? meeting.duration_minutes;
      if (!minutes || minutes <= 0) return;
      if (meeting.status === 'por_confirmar') return;
      // Apenas reuniões já decorridas contam como horas registadas
      const meetingDate = new Date(meeting.date_time);
      if (meetingDate > now) return;

      const durationHours = Number((minutes / 60).toFixed(2));
      const entryDate = format(new Date(meeting.date_time), 'yyyy-MM-dd');

      meetingEntries.push({
        id: `meeting-${meeting.id}`,
        entry_date: entryDate,
        member_id: memberId,
        duration: durationHours,
        category: 'reuniao',
        client_id: meeting.client_id || null,
        project_id: meeting.project_id || null,
        task_id: null,
        description: `Reunião: ${meeting.title}`,
        _isMeeting: true,
      });
    });

    return [...raw, ...meetingEntries];
  }, [timeEntries.data, myMeetings.data, teamMember.data?.id]);

  const allTasks = tasks.data || [];

  const periodEntries = useMemo(() => allTimeEntries.filter((e: any) => {
    const d = parseISO(e.entry_date);
    return isWithinInterval(d, { start: periodStart, end: periodEnd });
  }), [allTimeEntries, periodStart, periodEnd]);

  const totalHours = periodEntries.reduce((s: number, e: any) => s + Number(e.duration || 0), 0);

  // Horas previstas no período: reuniões futuras + tempo estimado de tarefas abertas com deadline no período
  const plannedHours = useMemo(() => {
    const now = new Date();
    let total = 0;

    (myMeetings.data || []).forEach((meeting: any) => {
      const minutes = meeting.planned_duration_minutes ?? meeting.duration_minutes;
      if (!minutes || minutes <= 0) return;
      if (meeting.status === 'por_confirmar' || meeting.status === 'cancelada') return;
      const md = new Date(meeting.date_time);
      if (md <= now) return;
      if (!isWithinInterval(md, { start: periodStart, end: periodEnd })) return;
      total += minutes / 60;
    });

    (tasks.data || []).forEach((t: any) => {
      if (isTaskDone(t)) return;
      if (!t.deadline) return;
      const d = parseISO(t.deadline);
      if (!isWithinInterval(d, { start: periodStart, end: periodEnd })) return;
      const est = Number(t.estimated_time || 0);
      if (est > 0) total += est;
    });

    return total;
  }, [myMeetings.data, tasks.data, periodStart, periodEnd]);

  // Variância previsto vs real
  const variancePct = plannedHours > 0
    ? Math.round(((totalHours - plannedHours) / plannedHours) * 100)
    : null;
  const varianceLabel = variancePct === null
    ? null
    : variancePct === 0
      ? 'No alvo'
      : variancePct > 0
        ? `+${variancePct}% acima do previsto`
        : `${variancePct}% abaixo do previsto`;
  const varianceTone = variancePct === null
    ? 'text-muted-foreground'
    : Math.abs(variancePct) <= 10
      ? 'text-success'
      : Math.abs(variancePct) <= 25
        ? 'text-warning'
        : 'text-destructive';
  const progressPct = plannedHours > 0
    ? Math.min(100, Math.round((totalHours / plannedHours) * 100))
    : 0;

  const completedTasks = useMemo(() => allTasks.filter((t: any) => isTaskDone(t) && t.updated_at && isWithinInterval(parseISO(t.updated_at), { start: periodStart, end: periodEnd })), [allTasks, periodStart, periodEnd]);
  const overdueTasks = allTasks.filter((t: any) => isTaskOverdue(t, today));

  const daysInPeriod = period === 'week' ? 5 : Math.max(1, Math.ceil((periodEnd.getTime() - periodStart.getTime()) / 86400000));
  const avgPerDay = daysInPeriod > 0 ? Math.round((totalHours / daysInPeriod) * 10) / 10 : 0;

  const top3Tasks = useMemo(() => {
    const taskTimeMap: Record<string, { name: string; hours: number }> = {};
    periodEntries.forEach((e: any) => {
      if (!e.task_id) return;
      const task = allTasks.find((t: any) => t.id === e.task_id);
      if (!task) return;
      if (!taskTimeMap[e.task_id]) taskTimeMap[e.task_id] = { name: task.name, hours: 0 };
      taskTimeMap[e.task_id].hours += Number(e.duration || 0);
    });
    return Object.values(taskTimeMap).sort((a, b) => b.hours - a.hours).slice(0, 3);
  }, [periodEntries, allTasks]);

  const weekEntries = useMemo(() => allTimeEntries.filter((e: any) => {
    const d = parseISO(e.entry_date);
    return isWithinInterval(d, { start: weekStart, end: weekEnd });
  }), [allTimeEntries]);
  const weekTotalHours = weekEntries.reduce((s: number, e: any) => s + Number(e.duration || 0), 0);

  const chartData = useMemo(() => {
    const days = eachDayOfInterval({ start: addDays(today, -6), end: today });
    return days.map(d => {
      const key = format(d, 'yyyy-MM-dd');
      const hours = allTimeEntries.filter((e: any) => e.entry_date === key).reduce((s: number, e: any) => s + Number(e.duration || 0), 0);
      return { day: format(d, 'EEE', { locale: pt }), hours: Math.round(hours * 10) / 10 };
    });
  }, [allTimeEntries]);

  const expectedDaily = teamMember.data?.expected_weekly_hours ? Number(teamMember.data.expected_weekly_hours) / 5 : 8;

  const weekCompletedTasks = useMemo(() => allTasks.filter((t: any) => isTaskDone(t) && t.updated_at && isWithinInterval(parseISO(t.updated_at), { start: weekStart, end: weekEnd })), [allTasks]);
  const monthCompletedTasks = useMemo(() => allTasks.filter((t: any) => isTaskDone(t) && t.updated_at && isWithinInterval(parseISO(t.updated_at), { start: monthStart, end: monthEnd })), [allTasks]);

  const deleteEntry = async (id: string) => {
    if (id.startsWith('meeting-')) {
      toast.error('Reuniões não podem ser eliminadas aqui');
      return;
    }
    await supabase.from('time_entries').delete().eq('id', id);
    qc.invalidateQueries({ queryKey: ['my-time-entries'] });
    toast.success('Registo eliminado');
  };

  const openTasks = useMemo(() => allTasks.filter(isTaskOpen), [allTasks]);

  return (
    <div className="space-y-6 mt-4">
      <div className="flex flex-wrap items-end gap-2">
        <Button variant="outline" size="sm" className="ml-auto" onClick={() => {
          const periodLabel = period === 'week' ? 'Esta semana' : period === 'month' ? 'Este mês' : `${customFrom ? format(customFrom, 'dd/MM/yyyy') : '?'} — ${customTo ? format(customTo, 'dd/MM/yyyy') : '?'}`;
          exportProductivityReport({
            memberName: teamMember.data?.full_name || 'Membro',
            periodLabel,
            periodStart,
            periodEnd,
            entries: periodEntries,
            tasks: allTasks,
            completedTasks,
            overdueTasks,
            projects: allProjects.data || [],
            expectedDailyHours: expectedDaily,
          });
        }}>
          <FileDown className="h-4 w-4 mr-1" /> Exportar PDF
        </Button>
        <Button variant={period === 'week' ? 'default' : 'outline'} size="sm" onClick={() => setPeriod('week')}>Esta semana</Button>
        <Button variant={period === 'month' ? 'default' : 'outline'} size="sm" onClick={() => setPeriod('month')}>Este mês</Button>
        <Button variant={period === 'custom' ? 'default' : 'outline'} size="sm" onClick={() => setPeriod('custom')}>Personalizado</Button>
        {period === 'custom' && (
          <div className="flex items-center gap-2 ml-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn('w-[130px] justify-start text-left font-normal', !customFrom && 'text-muted-foreground')}>
                  <CalendarIcon className="mr-1 h-3.5 w-3.5" />
                  {customFrom ? format(customFrom, 'dd/MM/yyyy') : 'De...'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={customFrom} onSelect={setCustomFrom} initialFocus className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
            <span className="text-xs text-muted-foreground">—</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn('w-[130px] justify-start text-left font-normal', !customTo && 'text-muted-foreground')}>
                  <CalendarIcon className="mr-1 h-3.5 w-3.5" />
                  {customTo ? format(customTo, 'dd/MM/yyyy') : 'Até...'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={customTo} onSelect={setCustomTo} initialFocus className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">Horas registadas</p>
          <p className="text-2xl font-bold">{Math.round(totalHours * 10) / 10}h</p>
          {varianceLabel && (
            <p className={cn('text-[10px] mt-1 font-medium', varianceTone)}>{varianceLabel}</p>
          )}
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">Horas previstas</p>
          <p className="text-2xl font-bold text-primary">{Math.round(plannedHours * 10) / 10}h</p>
          {plannedHours > 0 ? (
            <div className="mt-2 space-y-1">
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    variancePct !== null && variancePct > 25 ? 'bg-destructive' : variancePct !== null && variancePct > 10 ? 'bg-warning' : 'bg-primary'
                  )}
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <p className="text-[10px] text-muted-foreground">Reuniões + tarefas planeadas</p>
            </div>
          ) : (
            <p className="text-[10px] text-muted-foreground mt-1">Reuniões + tarefas planeadas</p>
          )}
        </CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Tarefas concluídas</p><p className="text-2xl font-bold">{completedTasks.length}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Tarefas em atraso</p><p className="text-2xl font-bold text-destructive">{overdueTasks.length}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Média horas/dia</p><p className="text-2xl font-bold">{avgPerDay}h</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">🏆 Top 3 — Tarefas mais demoradas no período</CardTitle></CardHeader>
        <CardContent>
          {top3Tasks.length === 0 ? (
            <EmptyHint>Sem registos de tempo associados a tarefas neste período.</EmptyHint>
          ) : (
            <div className="space-y-3">
              {top3Tasks.map((t, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className={cn('h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0', i === 0 ? 'bg-warning/15 text-warning' : i === 1 ? 'bg-muted text-muted-foreground' : 'bg-warning/15 text-warning')}>{i + 1}</div>
                  <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{t.name}</p></div>
                  <span className="text-sm font-bold tabular-nums">{Math.round(t.hours * 10) / 10}h</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm font-medium flex items-center gap-2"><Clock className="h-4 w-4" /> Time Tracker</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex items-center gap-3">
              <span className="font-mono text-2xl font-bold tabular-nums">{formatTimer(timerElapsed)}</span>
              {!timerRunning ? (
                <Button size="sm" onClick={startTimer} disabled={!canStartTimer}><Play className="h-4 w-4 mr-1" /> Iniciar</Button>
              ) : (
                <Button size="sm" variant="destructive" onClick={stopTimer}><Square className="h-4 w-4 mr-1" /> Parar</Button>
              )}
            </div>
            <Input placeholder="Descrição..." value={timerDesc} onChange={e => setTimerDesc(e.target.value)} className="max-w-[200px]" disabled={timerRunning} />
            <Select value={timerCategory} onValueChange={setTimerCategory} disabled={timerRunning}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>{TIME_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={timerProject} onValueChange={setTimerProject} disabled={timerRunning}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Projeto..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum</SelectItem>
                {(allProjects.data || []).map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={timerTask} onValueChange={setTimerTask} disabled={timerRunning}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Tarefa obrigatória..." /></SelectTrigger>
              <SelectContent>
                {openTasks.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Histórico de tempo — esta semana ({Math.round(weekTotalHours * 10) / 10}h)</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Descrição</TableHead><TableHead>Categoria</TableHead><TableHead>Duração</TableHead><TableHead className="w-10" /></TableRow></TableHeader>
            <TableBody>
              {weekEntries.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-4">Sem registos.</TableCell></TableRow>}
              {weekEntries.map((e: any) => (
                <TableRow key={e.id}>
                  <TableCell className="text-sm">{format(parseISO(e.entry_date), 'dd/MM')}</TableCell>
                  <TableCell className="text-sm">{e.description || '—'}</TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px] capitalize">{e.category}</Badge></TableCell>
                  <TableCell className="text-sm font-medium">{Number(e.duration).toFixed(1)}h</TableCell>
                  <TableCell><Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => deleteEntry(e.id)}><Trash2 className="h-3.5 w-3.5 text-muted-foreground" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Concluídas esta semana ({weekCompletedTasks.length})</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {weekCompletedTasks.length === 0 && <EmptyHint>Nenhuma.</EmptyHint>}
            {weekCompletedTasks.map((t: any) => (
              <div key={t.id} className="flex items-center justify-between text-sm">
                <span>{t.name}</span>
                <span className="text-xs text-muted-foreground">{t.updated_at ? format(parseISO(t.updated_at), 'dd/MM') : ''}</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Concluídas este mês ({monthCompletedTasks.length})</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {monthCompletedTasks.length === 0 && <EmptyHint>Nenhuma.</EmptyHint>}
            {monthCompletedTasks.slice(0, 15).map((t: any) => (
              <div key={t.id} className="flex items-center justify-between text-sm">
                <span>{t.name}</span>
                <span className="text-xs text-muted-foreground">{t.updated_at ? format(parseISO(t.updated_at), 'dd/MM') : ''}</span>
              </div>
            ))}
            {monthCompletedTasks.length > 15 && <p className="text-xs text-muted-foreground">+{monthCompletedTasks.length - 15} mais</p>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Horas — últimos 7 dias</CardTitle></CardHeader>
        <CardContent className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <XAxis dataKey="day" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <ReferenceLine y={expectedDaily} stroke="hsl(var(--primary))" strokeDasharray="3 3" label={{ value: `${expectedDaily}h`, position: 'right', fontSize: 10 }} />
              <Bar dataKey="hours" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
