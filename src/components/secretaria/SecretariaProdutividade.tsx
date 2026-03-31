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
  const normalizedTimerTask = timerTask && timerTask !== 'none' ? timerTask : null;
  const normalizedTimerProject = timerProject && timerProject !== 'none' ? timerProject : null;
  const canStartTimer = !!normalizedTimerTask && !timerRunning;

  useEffect(() => {
    if (timerRunning && timerStart) {
      intervalRef.current = setInterval(() => {
        setTimerElapsed(differenceInSeconds(new Date(), timerStart));
      }, 1000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
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
    if (durationHours < 0.01) { toast.error('Duração mínima: 1 minuto'); return; }
    const { error } = await supabase.from('time_entries').insert({
      member_id: teamMember.data?.id ?? null,
      entry_date: format(new Date(), 'yyyy-MM-dd'),
      duration: durationHours,
      category: timerCategory,
      description: timerDesc || null,
      project_id: normalizedTimerProject,
      task_id: normalizedTimerTask,
    });
    if (error) { toast.error('Erro ao guardar registo'); return; }
    setTimerRunning(false); setTimerStart(null); setTimerElapsed(0);
    setTimerDesc(''); setTimerProject(''); setTimerTask(''); setTimerCategory('interno');
    qc.invalidateQueries({ queryKey: ['my-time-entries'] });
    toast.success('Tempo registado');
  };
...
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
            <Input
              placeholder="Descrição..."
              value={timerDesc}
              onChange={e => setTimerDesc(e.target.value)}
              className="max-w-[200px]"
              disabled={timerRunning}
            />
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
            {weekCompletedTasks.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma.</p>}
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
            {monthCompletedTasks.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma.</p>}
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
