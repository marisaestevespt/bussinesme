import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle, FolderKanban, Clock, ListTodo } from 'lucide-react';
import { Link } from 'react-router-dom';

function healthTone(progress: number, deadline?: string) {
  if (deadline) {
    const d = new Date(deadline);
    if (d < new Date() && progress < 100) return 'bg-red-500';
  }
  if (progress >= 70) return 'bg-emerald-500';
  if (progress >= 30) return 'bg-amber-500';
  return 'bg-red-500';
}

export function BlockOperacao({ year, month }: { year: number; month: number }) {
  const { data, isLoading } = useQuery({
    queryKey: ['cockpit-operacao', year, month],
    queryFn: async () => {
      const start = `${year}-${String(month).padStart(2,'0')}-01`;
      const endDay = new Date(year, month, 0).getDate();
      const end = `${year}-${String(month).padStart(2,'0')}-${String(endDay).padStart(2,'0')}`;
      const todayISO = new Date().toISOString().slice(0,10);

      const [projects, deliverables, tasks, members, time, clients] = await Promise.all([
        supabase.from('projects').select('id, name, status, deadline, progress, client_id').neq('status', 'concluido').neq('status', 'arquivado'),
        supabase.from('project_deliverables').select('id, name, deadline, completed_at, project_id').gte('deadline', start).lte('deadline', end),
        supabase.from('tasks').select('id, name, status, priority, deadline, department, assigned_to, project_id, client_id').gte('deadline', start).lte('deadline', end),
        supabase.from('team_members').select('id, name, status').eq('status', 'ativo'),
        supabase.from('task_time_entries').select('task_id, user_id, duration_minutes, started_at').gte('started_at', start).lte('started_at', end + 'T23:59:59'),
        supabase.from('clients').select('id, full_name'),
      ]);

      const allTasks = tasks.data || [];
      const overdue = allTasks.filter((t: any) => t.status !== 'done' && t.deadline && t.deadline < todayISO);
      const done = allTasks.filter((t: any) => t.status === 'done');
      const active = allTasks.filter((t: any) => t.status !== 'done');
      const completionPct = allTasks.length > 0 ? (done.length / allTasks.length) * 100 : 0;
      const delivered = (deliverables.data || []).filter((d: any) => d.completed_at && d.completed_at >= start && d.completed_at <= end + 'T23:59:59');

      // Hours by member, by department, by client
      const taskById = new Map(allTasks.map((t: any) => [t.id, t]));
      const hoursByMember: Record<string, number> = {};
      const hoursByDept: Record<string, number> = {};
      const hoursByClient: Record<string, number> = {};
      let totalHours = 0;
      (time.data || []).forEach((e: any) => {
        const h = (Number(e.duration_minutes) || 0) / 60;
        totalHours += h;
        hoursByMember[e.user_id] = (hoursByMember[e.user_id] || 0) + h;
        const t: any = taskById.get(e.task_id);
        if (t?.department) hoursByDept[t.department] = (hoursByDept[t.department] || 0) + h;
        if (t?.client_id) hoursByClient[t.client_id] = (hoursByClient[t.client_id] || 0) + h;
      });

      const overloaded = (members.data || []).filter((m: any) => (hoursByMember[m.id] || 0) > 144).length;
      const clientById = new Map((clients.data || []).map((c: any) => [c.id, c.full_name]));

      const topClients = Object.entries(hoursByClient).map(([id, h]) => ({ id, name: clientById.get(id) || 'Sem cliente', hours: h })).sort((a, b) => b.hours - a.hours).slice(0, 6);
      const topDepts = Object.entries(hoursByDept).map(([d, h]) => ({ name: d, hours: h })).sort((a, b) => b.hours - a.hours);

      return {
        projects: projects.data || [],
        deliveredCount: delivered.length, deliverableCount: (deliverables.data || []).length,
        tasksTotal: allTasks.length, done: done.length, active: active.length, overdue,
        completionPct,
        members: members.data || [], hoursByMember, totalHours, overloaded,
        topClients, topDepts,
      };
    },
    staleTime: 60_000,
  });

  if (isLoading || !data) return <div className="text-xs text-muted-foreground">A carregar…</div>;

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Link to="/hub/projetos" className="hq-surface-sunken rounded-lg p-3 hover:bg-accent/40 hq-transition block">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1"><FolderKanban className="h-3 w-3" />Projetos ativos</div>
          <div className="text-lg font-semibold tabular-nums">{data.projects.length}</div>
        </Link>
        <Link to="/hub/projetos?tab=entregas" className="hq-surface-sunken rounded-lg p-3 hover:bg-accent/40 hq-transition block">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Entregas no mês</div>
          <div className="text-lg font-semibold tabular-nums">{data.deliveredCount}<span className="text-sm font-normal text-muted-foreground">/{data.deliverableCount}</span></div>
        </Link>
        <Link to="/hub/tarefas" className="hq-surface-sunken rounded-lg p-3 hover:bg-accent/40 hq-transition block">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1"><ListTodo className="h-3 w-3" />Tarefas concluídas</div>
          <div className="text-lg font-semibold tabular-nums">{data.done}<span className="text-sm font-normal text-muted-foreground">/{data.tasksTotal}</span></div>
          <Progress value={data.completionPct} className="h-1 mt-1" />
        </Link>
        <Link to="/hub/equipa" className="hq-surface-sunken rounded-lg p-3 hover:bg-accent/40 hq-transition block">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />Horas registadas</div>
          <div className="text-lg font-semibold tabular-nums">{data.totalHours.toFixed(0)}h</div>
          {data.overloaded > 0 && <div className="text-[10px] text-red-600 mt-0.5">{data.overloaded} membro(s) em sobrecarga</div>}
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Capacidade */}
        <div className="hq-surface-sunken rounded-lg p-3 space-y-2">
          <div className="text-xs font-medium">Capacidade da equipa</div>
          <ul className="space-y-1.5 max-h-44 overflow-auto pr-1">
            {data.members.map((m: any) => {
              const hours = data.hoursByMember[m.id] || 0;
              const pct = Math.min(100, (hours / 160) * 100);
              return (
                <li key={m.id} className="text-xs space-y-0.5">
                  <Link to={`/hub/equipa/${m.id}`} className="block hover:bg-accent/40 rounded px-1 py-0.5 hq-transition">
                    <div className="flex justify-between"><span className="truncate">{m.name}</span><span className="tabular-nums text-muted-foreground">{hours.toFixed(0)}h</span></div>
                    <Progress value={pct} className="h-1" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Distribuição por departamento */}
        <div className="hq-surface-sunken rounded-lg p-3 space-y-2">
          <div className="text-xs font-medium">Horas por departamento</div>
          {data.topDepts.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sem registos</p>
          ) : (
            <ul className="space-y-1.5">
              {data.topDepts.map((d: any) => {
                const pct = data.totalHours > 0 ? (d.hours / data.totalHours) * 100 : 0;
                return (
                  <li key={d.name} className="text-xs space-y-0.5">
                    <Link to={`/hub/tarefas?dept=${encodeURIComponent(d.name)}`} className="block hover:bg-accent/40 rounded px-1 py-0.5 hq-transition">
                      <div className="flex justify-between"><span className="truncate capitalize">{d.name}</span><span className="tabular-nums text-muted-foreground">{d.hours.toFixed(0)}h · {Math.round(pct)}%</span></div>
                      <Progress value={pct} className="h-1" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Horas por cliente */}
        <div className="hq-surface-sunken rounded-lg p-3 space-y-2">
          <div className="text-xs font-medium">Horas por cliente (top 6)</div>
          {data.topClients.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sem registos</p>
          ) : (
            <ul className="space-y-1">
              {data.topClients.map((c: any) => (
                <li key={c.id}>
                  <Link to={c.id && c.id !== 'undefined' ? `/hub/clientes/${c.id}` : '/hub/clientes'} className="flex items-center gap-2 text-xs hover:bg-accent/40 rounded px-1 py-0.5 hq-transition">
                    <span className="truncate flex-1">{c.name}</span>
                    <span className="tabular-nums text-muted-foreground">{c.hours.toFixed(1)}h</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Tarefas atrasadas */}
        <div className="hq-surface-sunken rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-xs font-medium flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
              Tarefas atrasadas ({data.overdue.length})
            </div>
            <Link to="/hub/tarefas" className="text-[10px] text-primary hover:underline">Ver todas →</Link>
          </div>
          {data.overdue.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nada atrasado.</p>
          ) : (
            <ul className="space-y-1 max-h-40 overflow-auto pr-1">
              {data.overdue.slice(0, 8).map((t: any) => (
                <li key={t.id}>
                  <Link to={t.project_id ? `/hub/projetos/${t.project_id}` : '/hub/tarefas'} className="flex items-center gap-2 text-xs hover:bg-accent/40 rounded px-1 py-0.5 hq-transition">
                    <Badge variant="outline" className="text-[9px] px-1 py-0">{t.priority || '—'}</Badge>
                    <span className="truncate flex-1">{t.name}</span>
                    <span className="tabular-nums text-red-600">{t.deadline}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
