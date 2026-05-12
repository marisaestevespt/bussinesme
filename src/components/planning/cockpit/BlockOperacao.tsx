import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { AlertTriangle, FolderKanban, Clock, ListTodo, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

const PROJECT_STATUS_TONE: Record<string, string> = {
  em_curso: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30',
  bloqueado: 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30',
  pausado: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
  planeado: 'bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30',
};

const PRIORITY_TONE: Record<string, string> = {
  alta: 'text-red-600 dark:text-red-400',
  media: 'text-amber-600 dark:text-amber-400',
  baixa: 'text-muted-foreground',
};

export function BlockOperacao({ year, month }: { year: number; month: number }) {
  const [projectSearch, setProjectSearch] = useState('');
  const [taskSearch, setTaskSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['cockpit-operacao', year, month],
    queryFn: async () => {
      const start = `${year}-${String(month).padStart(2,'0')}-01`;
      const endDay = new Date(year, month, 0).getDate();
      const end = `${year}-${String(month).padStart(2,'0')}-${String(endDay).padStart(2,'0')}`;
      const todayISO = new Date().toISOString().slice(0,10);

      const [projects, deliverables, tasks, members, time, clients] = await Promise.all([
        supabase.from('projects').select('id, name, status, deadline, progress, client_id, type').neq('status', 'concluido').neq('status', 'arquivado'),
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

      const taskById = new Map(allTasks.map((t: any) => [t.id, t]));
      const hoursByMember: Record<string, number> = {};
      const hoursByDept: Record<string, number> = {};
      const hoursByClient: Record<string, number> = {};
      const hoursByProject: Record<string, number> = {};
      let totalHours = 0;
      (time.data || []).forEach((e: any) => {
        const h = (Number(e.duration_minutes) || 0) / 60;
        totalHours += h;
        hoursByMember[e.user_id] = (hoursByMember[e.user_id] || 0) + h;
        const t: any = taskById.get(e.task_id);
        if (t?.department) hoursByDept[t.department] = (hoursByDept[t.department] || 0) + h;
        if (t?.client_id) hoursByClient[t.client_id] = (hoursByClient[t.client_id] || 0) + h;
        if (t?.project_id) hoursByProject[t.project_id] = (hoursByProject[t.project_id] || 0) + h;
      });

      const overloaded = (members.data || []).filter((m: any) => (hoursByMember[m.id] || 0) > 144).length;
      const clientById = new Map((clients.data || []).map((c: any) => [c.id, c.full_name]));
      const memberById = new Map((members.data || []).map((m: any) => [m.id, m.name]));

      const overdueByProject: Record<string, number> = {};
      const tasksByProject: Record<string, number> = {};
      allTasks.forEach((t: any) => {
        if (t.project_id) {
          tasksByProject[t.project_id] = (tasksByProject[t.project_id] || 0) + 1;
          if (t.status !== 'done' && t.deadline && t.deadline < todayISO) {
            overdueByProject[t.project_id] = (overdueByProject[t.project_id] || 0) + 1;
          }
        }
      });

      const enrichedProjects = (projects.data || []).map((p: any) => ({
        ...p,
        client: clientById.get(p.client_id) || null,
        hours: hoursByProject[p.id] || 0,
        overdue: overdueByProject[p.id] || 0,
        taskCount: tasksByProject[p.id] || 0,
      })).sort((a: any, b: any) => (b.overdue - a.overdue) || ((a.deadline || '').localeCompare(b.deadline || '')));

      const enrichedOverdue = overdue.map((t: any) => ({
        ...t,
        assignee: memberById.get(t.assigned_to) || null,
        client: clientById.get(t.client_id) || null,
      })).sort((a: any, b: any) => (a.deadline || '').localeCompare(b.deadline || ''));

      const topClients = Object.entries(hoursByClient).map(([id, h]) => ({ id, name: clientById.get(id) || 'Sem cliente', hours: h })).sort((a, b) => b.hours - a.hours).slice(0, 8);
      const topDepts = Object.entries(hoursByDept).map(([d, h]) => ({ name: d, hours: h })).sort((a, b) => b.hours - a.hours);

      return {
        projects: enrichedProjects,
        deliveredCount: delivered.length, deliverableCount: (deliverables.data || []).length,
        tasksTotal: allTasks.length, done: done.length, active: active.length,
        overdue: enrichedOverdue, completionPct,
        members: members.data || [], hoursByMember, totalHours, overloaded,
        topClients, topDepts,
      };
    },
    staleTime: 60_000,
  });

  const filteredProjects = useMemo(() => {
    if (!data) return [];
    if (!projectSearch) return data.projects;
    const q = projectSearch.toLowerCase();
    return data.projects.filter((p: any) =>
      p.name?.toLowerCase().includes(q) || p.client?.toLowerCase().includes(q),
    );
  }, [data, projectSearch]);

  const filteredOverdue = useMemo(() => {
    if (!data) return [];
    if (!taskSearch) return data.overdue;
    const q = taskSearch.toLowerCase();
    return data.overdue.filter((t: any) =>
      t.name?.toLowerCase().includes(q) || t.assignee?.toLowerCase().includes(q) || t.client?.toLowerCase().includes(q),
    );
  }, [data, taskSearch]);

  if (isLoading || !data) return <div className="text-xs text-muted-foreground">A carregar…</div>;

  return (
    <div className="space-y-4">
      {/* KPIs compactos */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {[
          { label: 'Projetos ativos', value: data.projects.length, icon: FolderKanban, href: '/hub/projetos' },
          { label: 'Entregas no mês', value: `${data.deliveredCount}/${data.deliverableCount}`, href: '/hub/projetos?tab=entregas' },
          { label: 'Tarefas concluídas', value: `${data.done}/${data.tasksTotal}`, icon: ListTodo, href: '/hub/tarefas', sub: `${Math.round(data.completionPct)}%` },
          { label: 'Horas registadas', value: `${data.totalHours.toFixed(0)}h`, icon: Clock, href: '/hub/equipa', sub: data.overloaded > 0 ? `${data.overloaded} em sobrecarga` : undefined, alert: data.overloaded > 0 },
        ].map((k: any, i) => (
          <Link key={i} to={k.href} className="hq-surface-sunken rounded-lg p-2.5 hover:bg-accent/40 hq-transition block" target="_blank" rel="noopener noreferrer">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
              {k.icon && <k.icon className="h-3 w-3" />}
              {k.label}
            </div>
            <div className="text-lg font-semibold tabular-nums">{k.value}</div>
            {k.sub && <div className={cn('text-[10px] mt-0.5', k.alert ? 'text-red-600' : 'text-muted-foreground')}>{k.sub}</div>}
          </Link>
        ))}
      </div>

      {/* TABELA — Projetos ativos */}
      <div className="hq-surface-sunken rounded-lg overflow-hidden">
        <div className="flex items-center justify-between gap-3 p-3 border-b border-border/40">
          <div className="flex items-center gap-2">
            <FolderKanban className="h-4 w-4 text-muted-foreground" />
            <div className="text-sm font-semibold">Projetos ativos</div>
            <Badge variant="outline" className="text-[10px]">{filteredProjects.length}</Badge>
          </div>
          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={projectSearch}
              onChange={(e) => setProjectSearch(e.target.value)}
              placeholder="Procurar projeto…"
              className="h-8 w-56 pl-7 text-xs"
            />
          </div>
        </div>
        <div className="overflow-auto max-h-[400px]">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-xs sticky top-0 z-10">
              <tr>
                <th className="text-left font-medium px-3 py-2">Projeto</th>
                <th className="text-left font-medium px-3 py-2">Cliente</th>
                <th className="text-left font-medium px-3 py-2">Status</th>
                <th className="text-right font-medium px-3 py-2">Deadline</th>
                <th className="text-left font-medium px-3 py-2 w-32">Progresso</th>
                <th className="text-right font-medium px-3 py-2">Horas (mês)</th>
                <th className="text-right font-medium px-3 py-2">Tarefas</th>
                <th className="text-right font-medium px-3 py-2">Atrasadas</th>
              </tr>
            </thead>
            <tbody>
              {filteredProjects.length === 0 ? (
                <tr><td colSpan={8} className="text-center text-muted-foreground py-8 text-xs">Sem projetos.</td></tr>
              ) : filteredProjects.map((p: any) => {
                const overdueDeadline = p.deadline && p.deadline < new Date().toISOString().slice(0,10);
                return (
                  <tr key={p.id} className="border-t border-border/40 hover:bg-accent/30 hq-transition">
                    <td className="px-3 py-2 font-medium">
                      <Link to={`/hub/projetos/${p.id}`} className="hover:underline truncate block max-w-[240px]" target="_blank" rel="noopener noreferrer">{p.name}</Link>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground truncate max-w-[160px]">{p.client || '—'}</td>
                    <td className="px-3 py-2">
                      <Badge variant="outline" className={cn('text-[10px] capitalize', PROJECT_STATUS_TONE[p.status] || '')}>
                        {(p.status || '—').replace('_', ' ')}
                      </Badge>
                    </td>
                    <td className={cn('px-3 py-2 text-right tabular-nums text-xs', overdueDeadline && 'text-red-600 font-medium')}>{p.deadline || '—'}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary" style={{ width: `${p.progress || 0}%` }} />
                        </div>
                        <span className="text-[10px] text-muted-foreground tabular-nums w-8 text-right">{p.progress || 0}%</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{p.hours.toFixed(0)}h</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{p.taskCount}</td>
                    <td className={cn('px-3 py-2 text-right tabular-nums', p.overdue > 0 && 'text-red-600 font-medium')}>{p.overdue || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* TABELA — Tarefas atrasadas */}
      <div className="hq-surface-sunken rounded-lg overflow-hidden">
        <div className="flex items-center justify-between gap-3 p-3 border-b border-border/40">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            <div className="text-sm font-semibold">Tarefas atrasadas</div>
            <Badge variant="outline" className="text-[10px]">{filteredOverdue.length}</Badge>
          </div>
          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={taskSearch}
              onChange={(e) => setTaskSearch(e.target.value)}
              placeholder="Procurar tarefa…"
              className="h-8 w-56 pl-7 text-xs"
            />
          </div>
        </div>
        {filteredOverdue.length === 0 ? (
          <p className="text-xs text-muted-foreground p-6 text-center">Nada atrasado.</p>
        ) : (
          <div className="overflow-auto max-h-[360px]">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-muted-foreground text-xs sticky top-0 z-10">
                <tr>
                  <th className="text-left font-medium px-3 py-2">Tarefa</th>
                  <th className="text-left font-medium px-3 py-2">Responsável</th>
                  <th className="text-left font-medium px-3 py-2">Cliente</th>
                  <th className="text-left font-medium px-3 py-2">Departamento</th>
                  <th className="text-left font-medium px-3 py-2">Prioridade</th>
                  <th className="text-right font-medium px-3 py-2">Deadline</th>
                </tr>
              </thead>
              <tbody>
                {filteredOverdue.map((t: any) => {
                  const days = Math.floor((Date.now() - new Date(t.deadline).getTime()) / 86400000);
                  return (
                    <tr key={t.id} className="border-t border-border/40 hover:bg-accent/30 hq-transition">
                      <td className="px-3 py-2 font-medium">
                        <Link to={t.project_id ? `/hub/projetos/${t.project_id}` : '/hub/tarefas'} className="hover:underline truncate block max-w-[260px]" target="_blank" rel="noopener noreferrer">{t.name}</Link>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground truncate max-w-[140px]">{t.assignee || '—'}</td>
                      <td className="px-3 py-2 text-muted-foreground truncate max-w-[140px]">{t.client || '—'}</td>
                      <td className="px-3 py-2 text-muted-foreground capitalize">{t.department || '—'}</td>
                      <td className={cn('px-3 py-2 capitalize', PRIORITY_TONE[t.priority] || '')}>{t.priority || '—'}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-xs text-red-600">
                        {t.deadline} <span className="text-muted-foreground">({days}d)</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Análise — capacidade, depts, clientes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="hq-surface-sunken rounded-lg overflow-hidden">
          <div className="p-3 border-b border-border/40 text-sm font-semibold">Capacidade da equipa</div>
          <div className="p-3 max-h-64 overflow-auto">
            <ul className="space-y-2">
              {data.members.map((m: any) => {
                const hours = data.hoursByMember[m.id] || 0;
                const pct = Math.min(100, (hours / 160) * 100);
                const overload = hours > 144;
                return (
                  <li key={m.id} className="text-xs space-y-1">
                    <Link to={`/hub/equipa/${m.id}`} className="block hover:bg-accent/30 rounded px-1 py-0.5" target="_blank" rel="noopener noreferrer">
                      <div className="flex justify-between">
                        <span className="truncate">{m.name}</span>
                        <span className={cn('tabular-nums', overload ? 'text-red-600 font-medium' : 'text-muted-foreground')}>{hours.toFixed(0)}h</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className={cn('h-full', overload ? 'bg-red-500' : pct > 80 ? 'bg-amber-500' : 'bg-primary')} style={{ width: `${pct}%` }} />
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        <div className="hq-surface-sunken rounded-lg overflow-hidden">
          <div className="p-3 border-b border-border/40 text-sm font-semibold">Horas por departamento</div>
          <div className="p-3 max-h-64 overflow-auto">
            {data.topDepts.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sem registos</p>
            ) : (
              <ul className="space-y-2">
                {data.topDepts.map((d: any) => {
                  const pct = data.totalHours > 0 ? (d.hours / data.totalHours) * 100 : 0;
                  return (
                    <li key={d.name} className="text-xs space-y-1">
                      <Link to={`/hub/tarefas?dept=${encodeURIComponent(d.name)}`} className="block hover:bg-accent/30 rounded px-1 py-0.5" target="_blank" rel="noopener noreferrer">
                        <div className="flex justify-between">
                          <span className="truncate capitalize">{d.name}</span>
                          <span className="tabular-nums text-muted-foreground">{d.hours.toFixed(0)}h · {Math.round(pct)}%</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <div className="hq-surface-sunken rounded-lg overflow-hidden">
          <div className="p-3 border-b border-border/40 text-sm font-semibold">Horas por cliente (top 8)</div>
          <div className="p-3 max-h-64 overflow-auto">
            {data.topClients.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sem registos</p>
            ) : (
              <ul className="space-y-1">
                {data.topClients.map((c: any) => (
                  <li key={c.id}>
                    <Link to={c.id && c.id !== 'undefined' ? `/hub/clientes/${c.id}` : '/hub/clientes'} className="flex items-center gap-2 text-xs hover:bg-accent/30 rounded px-1 py-1 hq-transition" target="_blank" rel="noopener noreferrer">
                      <span className="truncate flex-1">{c.name}</span>
                      <span className="tabular-nums text-muted-foreground">{c.hours.toFixed(1)}h</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
