import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, subWeeks } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const PERIOD_FILTERS = [
  { value: 'week', label: 'Esta semana' },
  { value: 'month', label: 'Este mês' },
  { value: 'quarter', label: 'Este trimestre' },
  { value: 'year', label: 'Este ano' },
];

function getDateRange(period: string) {
  const now = new Date();
  switch (period) {
    case 'week': return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
    case 'month': return { start: startOfMonth(now), end: endOfMonth(now) };
    case 'quarter': return { start: startOfQuarter(now), end: endOfQuarter(now) };
    case 'year': return { start: startOfYear(now), end: endOfYear(now) };
    default: return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
  }
}

function weeksInPeriod(period: string) {
  const { start, end } = getDateRange(period);
  return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000)));
}

function useSharedData() {
  const members = useQuery({
    queryKey: ['team', 'members'],
    queryFn: async () => {
      const { data } = await supabase.from('team_members').select('*').order('full_name');
      return (data || []) as any[];
    },
  });
  const entries = useQuery({
    queryKey: ['time_entries'],
    queryFn: async () => {
      const { data } = await supabase.from('time_entries').select('*').order('entry_date', { ascending: false });
      return (data || []) as any[];
    },
  });
  const tasks = useQuery({
    queryKey: ['tasks_list'],
    queryFn: async () => {
      const { data } = await supabase.from('tasks').select('id, name, assigned_to, project_id, department, estimated_time, deadline, status, priority');
      return (data || []) as any[];
    },
  });
  return { members: members.data || [], entries: entries.data || [], tasks: tasks.data || [] };
}

/* ─── Tempo por Membro (shared) ─── */
export function ByMemberTabShared() {
  const { members, entries } = useSharedData();
  const [period, setPeriod] = useState('month');
  const { start, end } = getDateRange(period);
  const weeks = weeksInPeriod(period);

  const filtered = entries.filter(e => {
    const d = new Date(e.entry_date);
    return d >= start && d <= end;
  });

  const rows = members.map(m => {
    const mEntries = filtered.filter(e => e.member_id === m.id);
    const hours = mEntries.reduce((s: number, e: any) => s + Number(e.duration || 0), 0);
    const expected = Number(m.expected_weekly_hours || 40) * weeks;
    const diff = hours - expected;
    const pct = expected > 0 ? (hours / expected) * 100 : 0;
    return { ...m, hours, expected, diff, pct };
  });

  const chartData = rows.map(r => ({
    name: r.full_name?.split(' ')[0] || 'N/A',
    esperadas: Number(r.expected.toFixed(1)),
    registadas: Number(r.hours.toFixed(1)),
  }));

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {PERIOD_FILTERS.map(f => (
          <Button key={f.value} size="sm" variant={period === f.value ? 'default' : 'outline'} onClick={() => setPeriod(f.value)}>{f.label}</Button>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Membro</TableHead><TableHead>Função</TableHead><TableHead className="text-right">Esperadas</TableHead><TableHead className="text-right">Registadas</TableHead><TableHead className="text-right">Diferença</TableHead><TableHead className="text-right">Ocupação</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {rows.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm font-medium">{r.full_name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{r.role_title || '—'}</TableCell>
                    <TableCell className="text-sm text-right">{r.expected.toFixed(0)}h</TableCell>
                    <TableCell className="text-sm text-right">{r.hours.toFixed(1)}h</TableCell>
                    <TableCell className={`text-sm text-right ${r.diff > 0 ? 'text-destructive' : r.diff < -5 ? 'text-amber-500' : ''}`}>{r.diff > 0 ? '+' : ''}{r.diff.toFixed(1)}h</TableCell>
                    <TableCell className="text-right">
                      <Badge variant={r.pct > 110 ? 'destructive' : r.pct > 90 ? 'default' : 'secondary'} className="text-xs">{r.pct.toFixed(0)}%</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Esperadas vs Registadas</CardTitle></CardHeader>
          <CardContent className="h-72">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical">
                  <XAxis type="number" fontSize={12} />
                  <YAxis type="category" dataKey="name" fontSize={12} width={70} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="esperadas" fill="hsl(var(--muted-foreground))" radius={[0,4,4,0]} />
                  <Bar dataKey="registadas" fill="hsl(var(--primary))" radius={[0,4,4,0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-sm text-muted-foreground text-center pt-20">Sem dados</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ─── Tarefas & Sobrecarga (shared) ─── */
export function OverloadTabShared() {
  const { members, entries, tasks } = useSharedData();
  const now = new Date();

  const taskTime: Record<string, { hours: number; count: number }> = {};
  entries.forEach(e => {
    if (!e.task_id) return;
    if (!taskTime[e.task_id]) taskTime[e.task_id] = { hours: 0, count: 0 };
    taskTime[e.task_id].hours += Number(e.duration || 0);
    taskTime[e.task_id].count += 1;
  });

  const taskRows = Object.entries(taskTime)
    .map(([tid, data]) => {
      const task = tasks.find((t: any) => t.id === tid);
      return { tid, name: task?.name || 'Tarefa desconhecida', assigned: task?.assigned_to, department: task?.department, ...data };
    })
    .sort((a, b) => b.hours - a.hours)
    .slice(0, 20);

  const weekRanges = Array.from({ length: 4 }, (_, i) => {
    const ws = startOfWeek(subWeeks(now, 3 - i), { weekStartsOn: 1 });
    const we = endOfWeek(ws, { weekStartsOn: 1 });
    return { start: ws, end: we, label: `${format(ws, 'dd/MM')} → ${format(we, 'dd/MM')}` };
  });

  const memberOverload = members.map(m => {
    const expected = Number(m.expected_weekly_hours || 40);
    const weeklyPcts = weekRanges.map(w => {
      const wEntries = entries.filter(e => {
        const d = new Date(e.entry_date);
        return e.member_id === m.id && d >= w.start && d <= w.end;
      });
      const hours = wEntries.reduce((s: number, e: any) => s + Number(e.duration || 0), 0);
      return expected > 0 ? (hours / expected) * 100 : 0;
    });
    const trend = weeklyPcts[3] - weeklyPcts[0];
    const trendLabel = Math.abs(trend) < 5 ? 'Estável' : trend > 0 ? 'A aumentar' : 'A diminuir';
    return { ...m, weeklyPcts, trendLabel };
  });

  const pctColor = (pct: number) => pct >= 120 ? 'text-destructive font-semibold' : pct >= 110 ? 'text-amber-500 font-medium' : 'text-emerald-600';

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Tarefas que consomem mais tempo</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Tarefa</TableHead><TableHead>Responsável</TableHead><TableHead>Departamento</TableHead><TableHead className="text-right">Tempo total</TableHead><TableHead className="text-right">Registos</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {taskRows.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">Sem dados de tempo em tarefas</TableCell></TableRow>
              ) : taskRows.map(r => (
                <TableRow key={r.tid}>
                  <TableCell className="text-sm font-medium">{r.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.assigned || '—'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.department || '—'}</TableCell>
                  <TableCell className="text-sm text-right">{r.hours.toFixed(1)}h</TableCell>
                  <TableCell className="text-sm text-right">{r.count}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Análise de sobrecarga (últimas 4 semanas)</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Membro</TableHead>
              {weekRanges.map((w, i) => <TableHead key={i} className="text-center text-xs">{w.label}</TableHead>)}
              <TableHead>Tendência</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {memberOverload.map(m => (
                <TableRow key={m.id}>
                  <TableCell className="text-sm font-medium">{m.full_name}</TableCell>
                  {m.weeklyPcts.map((pct: number, i: number) => (
                    <TableCell key={i} className={`text-center text-sm ${pctColor(pct)}`}>{pct.toFixed(0)}%</TableCell>
                  ))}
                  <TableCell><Badge variant="secondary" className="text-xs">{m.trendLabel}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
