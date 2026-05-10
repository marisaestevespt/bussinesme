import { useState, useMemo } from 'react';
import { useSectorConfig } from '@/hooks/useSectorConfig';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Search, CalendarIcon, Clock, TrendingUp, User, Repeat } from 'lucide-react';
import { format, parseISO, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, isWithinInterval } from 'date-fns';
import { pt } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { isTaskDone } from '@/lib/taskStatus';

// ─── Fuzzy normalizer ───────────────────────────────────────
function normalize(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/s$/g, '').trim();
}

function fuzzyMatch(a: string, b: string) {
  const na = normalize(a);
  const nb = normalize(b);
  return na.includes(nb) || nb.includes(na);
}

function countSimilar(taskName: string, allTasks: any[]) {
  const norm = normalize(taskName);
  return allTasks.filter(t => isTaskDone(t) && fuzzyMatch(t.name, taskName)).length;
}

const PERIOD_OPTIONS = [
  { value: 'all', label: 'Todos' },
  { value: 'week', label: 'Esta semana' },
  { value: 'month', label: 'Este mês' },
  { value: 'quarter', label: 'Este trimestre' },
  { value: 'year', label: 'Este ano' },
  { value: 'custom', label: 'Personalizado' },
];

type Props = {
  tasks: any[];
  profiles: { id: string; full_name: string | null }[];
  projects: { id: string; name: string }[];
  timeEntries: { task_id: string; duration_minutes: number }[];
};

export function HistoricoView({ tasks, profiles, projects, timeEntries }: Props) {
  const sectorConfig = useSectorConfig();
  const [search, setSearch] = useState('');
  const [filterResponsible, setFilterResponsible] = useState('');
  const [filterProject, setFilterProject] = useState('');
  const [filterPeriod, setFilterPeriod] = useState('all');
  const [customStart, setCustomStart] = useState<Date>();
  const [customEnd, setCustomEnd] = useState<Date>();
  const [selectedTask, setSelectedTask] = useState<any>(null);

  // All completed tasks
  const doneTasks = useMemo(() =>
    tasks.filter(isTaskDone).sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || '')),
    [tasks]
  );

  // Time entries map: task_id -> total minutes
  const timeMap = useMemo(() => {
    const map: Record<string, number> = {};
    timeEntries.forEach(e => {
      if (!e.task_id || !e.duration_minutes) return;
      map[e.task_id] = (map[e.task_id] || 0) + e.duration_minutes;
    });
    return map;
  }, [timeEntries]);

  // Period filter interval
  const periodInterval = useMemo(() => {
    const now = new Date();
    switch (filterPeriod) {
      case 'week': return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
      case 'month': return { start: startOfMonth(now), end: endOfMonth(now) };
      case 'quarter': return { start: startOfQuarter(now), end: endOfQuarter(now) };
      case 'year': return { start: startOfYear(now), end: endOfYear(now) };
      case 'custom': return customStart && customEnd ? { start: customStart, end: customEnd } : null;
      default: return null;
    }
  }, [filterPeriod, customStart, customEnd]);

  // Filtered tasks
  const filtered = useMemo(() => {
    let result = doneTasks;

    // Period
    if (periodInterval) {
      result = result.filter(t => {
        if (!t.updated_at) return false;
        try {
          return isWithinInterval(parseISO(t.updated_at), periodInterval);
        } catch { return false; }
      });
    }

    // Responsible
    if (filterResponsible) result = result.filter(t => t.assigned_to === filterResponsible);

    // Project
    if (filterProject) result = result.filter(t => t.project_id === filterProject);

    // Search (fuzzy)
    if (search.trim()) {
      result = result.filter(t => fuzzyMatch(t.name, search));
    }

    return result;
  }, [doneTasks, periodInterval, filterResponsible, filterProject, search]);

  // ─── Stats ───────────────────────────────────────────────────
  const stats = useMemo(() => {
    if (filtered.length === 0) return null;

    // Most time-consuming (avg real time)
    const taskTimeAvg: Record<string, { total: number; count: number; name: string }> = {};
    filtered.forEach(t => {
      const real = timeMap[t.id] || 0;
      if (real <= 0) return;
      const key = normalize(t.name);
      if (!taskTimeAvg[key]) taskTimeAvg[key] = { total: 0, count: 0, name: t.name };
      taskTimeAvg[key].total += real;
      taskTimeAvg[key].count++;
    });
    const slowest = Object.values(taskTimeAvg).sort((a, b) => (b.total / b.count) - (a.total / a.count))[0];

    // Most frequent
    const freqMap: Record<string, { count: number; name: string }> = {};
    filtered.forEach(t => {
      const key = normalize(t.name);
      if (!freqMap[key]) freqMap[key] = { count: 0, name: t.name };
      freqMap[key].count++;
    });
    const mostFrequent = Object.values(freqMap).sort((a, b) => b.count - a.count)[0];

    // Top performer
    const memberCount: Record<string, number> = {};
    filtered.forEach(t => { if (t.assigned_to) memberCount[t.assigned_to] = (memberCount[t.assigned_to] || 0) + 1; });
    const topMemberId = Object.entries(memberCount).sort((a, b) => b[1] - a[1])[0];

    // Average time per task
    let totalTime = 0; let tasksWithTime = 0;
    filtered.forEach(t => {
      const real = timeMap[t.id] || 0;
      if (real > 0) { totalTime += real; tasksWithTime++; }
    });

    return {
      slowest: slowest ? { name: slowest.name, avg: Math.round(slowest.total / slowest.count) } : null,
      mostFrequent: mostFrequent ? { name: mostFrequent.name, count: mostFrequent.count } : null,
      topMember: topMemberId ? { id: topMemberId[0], count: topMemberId[1] } : null,
      avgTime: tasksWithTime > 0 ? Math.round(totalTime / tasksWithTime) : 0,
    };
  }, [filtered, timeMap]);

  const getProfileName = (id: string | null) => profiles.find(p => p.id === id)?.full_name || '—';
  const getProjectName = (id: string | null) => projects.find(p => p.id === id)?.name || '—';

  const formatMinutes = (mins: number) => {
    if (mins <= 0) return '—';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  return (
    <div className="space-y-4">
      {/* Search & Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar tarefas..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <Select value={filterResponsible} onValueChange={v => setFilterResponsible(v === '_all' ? '' : v)}>
          <SelectTrigger className="h-9 w-[160px] text-xs"><SelectValue placeholder="Responsável" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">Todos</SelectItem>
            {profiles.map(p => <SelectItem key={p.id} value={p.id}>{p.full_name || '—'}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterProject} onValueChange={v => setFilterProject(v === '_all' ? '' : v)}>
          <SelectTrigger className="h-9 w-[160px] text-xs"><SelectValue placeholder={sectorConfig.t('projeto')} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">Todos</SelectItem>
            {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterPeriod} onValueChange={setFilterPeriod}>
          <SelectTrigger className="h-9 w-[160px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {PERIOD_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>

        {filterPeriod === 'custom' && (
          <div className="flex gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn('text-xs', !customStart && 'text-muted-foreground')}>
                  <CalendarIcon className="h-3.5 w-3.5 mr-1" />
                  {customStart ? format(customStart, 'dd/MM/yy') : 'Início'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={customStart} onSelect={setCustomStart} initialFocus className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn('text-xs', !customEnd && 'text-muted-foreground')}>
                  <CalendarIcon className="h-3.5 w-3.5 mr-1" />
                  {customEnd ? format(customEnd, 'dd/MM/yy') : 'Fim'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={customEnd} onSelect={setCustomEnd} initialFocus className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>
        )}
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
                <Clock className="h-4 w-4 text-destructive" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] uppercase text-muted-foreground font-medium">Mais demorada</p>
                <p className="text-sm font-semibold truncate">{stats.slowest?.name || '—'}</p>
                <p className="text-xs text-muted-foreground">{stats.slowest ? formatMinutes(stats.slowest.avg) + ' média' : '—'}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Repeat className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] uppercase text-muted-foreground font-medium">Mais frequente</p>
                <p className="text-sm font-semibold truncate">{stats.mostFrequent?.name || '—'}</p>
                <p className="text-xs text-muted-foreground">{stats.mostFrequent ? `${stats.mostFrequent.count}×` : '—'}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-accent/50 flex items-center justify-center shrink-0">
                <User className="h-4 w-4 text-foreground" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] uppercase text-muted-foreground font-medium">Top performer</p>
                <p className="text-sm font-semibold truncate">{stats.topMember ? getProfileName(stats.topMember.id) : '—'}</p>
                <p className="text-xs text-muted-foreground">{stats.topMember ? `${stats.topMember.count} concluídas` : '—'}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                <TrendingUp className="h-4 w-4 text-foreground" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] uppercase text-muted-foreground font-medium">Tempo médio</p>
                <p className="text-sm font-semibold">{stats.avgTime > 0 ? formatMinutes(stats.avgTime) : '—'}</p>
                <p className="text-xs text-muted-foreground">por tarefa</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tarefa</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead>Resp. original</TableHead>
                <TableHead>Projeto</TableHead>
                <TableHead>Criação</TableHead>
                <TableHead>Conclusão</TableHead>
                <TableHead className="text-right">Estimado</TableHead>
                <TableHead className="text-right">Real</TableHead>
                <TableHead className="text-right">Diferença</TableHead>
                <TableHead className="text-center">Nº vezes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                    Nenhuma tarefa concluída encontrada.
                  </TableCell>
                </TableRow>
              )}
              {filtered.map(t => {
                const realMin = timeMap[t.id] || 0;
                const estMin = t.estimated_time ? Math.round(t.estimated_time * 60) : 0;
                const diff = realMin > 0 && estMin > 0 ? realMin - estMin : null;
                const timesCount = countSimilar(t.name, tasks);

                return (
                  <TableRow key={t.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedTask(t)}>
                    <TableCell className="font-medium max-w-[200px] truncate">{t.name}</TableCell>
                    <TableCell className="text-sm">{getProfileName(t.assigned_to)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{t.original_assignee ? getProfileName(t.original_assignee) : '—'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{t.project_id ? getProjectName(t.project_id) : '—'}</TableCell>
                    <TableCell className="text-sm">{format(parseISO(t.created_at), 'dd/MM/yyyy')}</TableCell>
                    <TableCell className="text-sm">{t.updated_at ? format(parseISO(t.updated_at), 'dd/MM/yyyy') : '—'}</TableCell>
                    <TableCell className="text-right text-sm">{estMin > 0 ? formatMinutes(estMin) : '—'}</TableCell>
                    <TableCell className="text-right text-sm">{realMin > 0 ? formatMinutes(realMin) : '—'}</TableCell>
                    <TableCell className="text-right text-sm">
                      {diff !== null ? (
                        <span className={cn(diff <= 0 ? 'text-success' : 'text-destructive', 'font-medium')}>
                          {diff <= 0 ? '' : '+'}{formatMinutes(Math.abs(diff))}
                        </span>
                      ) : '—'}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary" className="text-xs">{timesCount}</Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Read-only task detail */}
      <Dialog open={!!selectedTask} onOpenChange={() => setSelectedTask(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalhe da Tarefa (Histórico)</DialogTitle>
          </DialogHeader>
          {selectedTask && (
            <div className="space-y-3 text-sm">
              <div>
                <span className="text-muted-foreground text-xs">Nome</span>
                <p className="font-medium">{selectedTask.name}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-muted-foreground text-xs">Responsável</span>
                  <p>{getProfileName(selectedTask.assigned_to)}</p>
                </div>
                {selectedTask.original_assignee && (
                  <div>
                    <span className="text-muted-foreground text-xs">Responsável original</span>
                    <p>{getProfileName(selectedTask.original_assignee)}</p>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-muted-foreground text-xs">Projeto</span>
                  <p>{selectedTask.project_id ? getProjectName(selectedTask.project_id) : '—'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs">Departamento</span>
                  <p>{selectedTask.department || '—'}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-muted-foreground text-xs">Data de criação</span>
                  <p>{format(parseISO(selectedTask.created_at), 'dd/MM/yyyy')}</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs">Data de conclusão</span>
                  <p>{selectedTask.updated_at ? format(parseISO(selectedTask.updated_at), 'dd/MM/yyyy') : '—'}</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <span className="text-muted-foreground text-xs">Tempo estimado</span>
                  <p>{selectedTask.estimated_time ? formatMinutes(Math.round(selectedTask.estimated_time * 60)) : '—'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs">Tempo real</span>
                  <p>{timeMap[selectedTask.id] ? formatMinutes(timeMap[selectedTask.id]) : '—'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs">Diferença</span>
                  {(() => {
                    const real = timeMap[selectedTask.id] || 0;
                    const est = selectedTask.estimated_time ? Math.round(selectedTask.estimated_time * 60) : 0;
                    if (!real || !est) return <p>—</p>;
                    const d = real - est;
                    return <p className={cn(d <= 0 ? 'text-success' : 'text-destructive', 'font-medium')}>
                      {d <= 0 ? '' : '+'}{formatMinutes(Math.abs(d))}
                    </p>;
                  })()}
                </div>
              </div>
              {selectedTask.notes && (
                <div>
                  <span className="text-muted-foreground text-xs">Notas</span>
                  <p className="whitespace-pre-wrap">{selectedTask.notes}</p>
                </div>
              )}
              <div>
                <span className="text-muted-foreground text-xs">Nº de vezes feita</span>
                <p>{countSimilar(selectedTask.name, tasks)}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
