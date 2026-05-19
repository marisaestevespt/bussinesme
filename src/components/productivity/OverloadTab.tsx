import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { startOfWeek, endOfWeek, subWeeks, format } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function OverloadTab({ entries, members, tasks }: { entries: any[]; members: any[]; tasks: any[] }) {
  const profilesQ = useQuery({
    queryKey: ['profiles_lookup'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, full_name');
      return (data || []) as any[];
    },
  });
  const resolveAssignee = (id?: string | null) => {
    if (!id) return '—';
    const p = profilesQ.data?.find((x: any) => x.id === id);
    if (p?.full_name) return p.full_name;
    const m = members.find((x: any) => x.id === id || x.profile_id === id);
    return m?.full_name || '—';
  };

  const taskTime: Record<string, { hours: number; count: number }> = {};
  entries.forEach(e => {
    if (!e.task_id) return;
    if (!taskTime[e.task_id]) taskTime[e.task_id] = { hours: 0, count: 0 };
    taskTime[e.task_id].hours += Number(e.duration || 0);
    taskTime[e.task_id].count += 1;
  });

  const taskRows = Object.entries(taskTime)
    .map(([tid, data]) => {
      const task = tasks.find(t => t.id === tid);
      return { tid, name: task?.name || 'Tarefa desconhecida', assigned: task?.assigned_to, department: task?.department, ...data };
    })
    .sort((a, b) => b.hours - a.hours)
    .slice(0, 20);

  const now = new Date();
  const weekRanges = Array.from({ length: 4 }, (_, i) => {
    const ws = startOfWeek(subWeeks(now, 3 - i), { weekStartsOn: 1 });
    const we = endOfWeek(ws, { weekStartsOn: 1 });
    return { start: ws, end: we, label: `${format(ws, 'dd/MM')} → ${format(we, 'dd/MM')}` };
  });

  const memberOverload = members.map(m => {
    const expected = Number(m.expected_weekly_hours || 40);
    const weeklyPcts = weekRanges.map(w => {
      const wEntries = entries.filter(e => { const d = new Date(e.entry_date); return e.member_id === m.id && d >= w.start && d <= w.end; });
      const hours = wEntries.reduce((s, e) => s + Number(e.duration || 0), 0);
      return expected > 0 ? (hours / expected) * 100 : 0;
    });
    const trend = weeklyPcts[3] - weeklyPcts[0];
    const trendLabel = Math.abs(trend) < 5 ? 'Estável' : trend > 0 ? 'A aumentar' : 'A diminuir';
    return { ...m, weeklyPcts, trendLabel };
  });

  const pctColor = (pct: number) => pct >= 120 ? 'text-destructive font-semibold' : pct >= 110 ? 'text-warning font-medium' : 'text-success';

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
                  <TableCell className="text-sm text-muted-foreground">{resolveAssignee(r.assigned)}</TableCell>
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
              {weekRanges.map((w, i) => <TableHead key={i} className="text-center">{w.label}</TableHead>)}
              <TableHead>Tendência</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {memberOverload.map(m => (
                <TableRow key={m.id}>
                  <TableCell className="text-sm font-medium">{m.full_name}</TableCell>
                  {m.weeklyPcts.map((pct, i) => (
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
