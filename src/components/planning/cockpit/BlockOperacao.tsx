import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

function healthTone(progress: number, deadline?: string) {
  if (deadline) {
    const d = new Date(deadline);
    const now = new Date();
    if (d < now && progress < 100) return 'bg-red-500';
  }
  if (progress >= 70) return 'bg-emerald-500';
  if (progress >= 30) return 'bg-amber-500';
  return 'bg-red-500';
}

export function BlockOperacao({ year, month }: { year: number; month: number }) {
  const { data } = useQuery({
    queryKey: ['cockpit-operacao', year, month],
    queryFn: async () => {
      const start = `${year}-${String(month).padStart(2,'0')}-01`;
      const endDay = new Date(year, month, 0).getDate();
      const end = `${year}-${String(month).padStart(2,'0')}-${String(endDay).padStart(2,'0')}`;

      const [projects, time, routines, tasks, members] = await Promise.all([
        supabase.from('projects').select('id, name, status, deadline, progress').neq('status', 'concluido').neq('status', 'arquivado'),
        supabase.from('time_entries').select('duration, assigned_to, entry_year, entry_month').eq('entry_year', year).eq('entry_month', month),
        supabase.from('routines').select('id, name, frequency'),
        supabase.from('tasks').select('id, name, status, priority, deadline').in('priority', ['P1','P2']).gte('deadline', start).lte('deadline', end),
        supabase.from('team_members').select('id, name, status').eq('status', 'ativo'),
      ]);

      const activeProjects = (projects.data || []).filter((p: any) =>
        !p.deadline || (p.deadline >= start)
      );

      // Capacity simple: assume 160h/month per active member
      const memberHours: Record<string, number> = {};
      (time.data || []).forEach((t: any) => {
        const k = t.assigned_to || 'unknown';
        memberHours[k] = (memberHours[k] || 0) + (Number(t.duration) || 0) / 60;
      });
      const overloaded = (members.data || []).filter((m: any) => (memberHours[m.id] || 0) > 144).length; // >90% of 160h

      const tasksByStatus = {
        a_fazer: (tasks.data || []).filter((t: any) => ['por_comecar','to_do','todo'].includes(t.status)).length,
        em_curso: (tasks.data || []).filter((t: any) => ['in_progress','em_curso'].includes(t.status)).length,
        concluidas: (tasks.data || []).filter((t: any) => t.status === 'done').length,
        atrasadas: (tasks.data || []).filter((t: any) => t.status !== 'done' && t.deadline && t.deadline < new Date().toISOString().slice(0,10)).length,
      };

      return {
        projects: activeProjects,
        memberHours,
        members: members.data || [],
        overloaded,
        routines: routines.data || [],
        tasks: tasks.data || [],
        tasksByStatus,
      };
    },
    staleTime: 60_000,
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {/* Projetos */}
      <div className="hq-surface-sunken rounded-lg p-3 space-y-2">
        <div className="text-xs font-medium text-muted-foreground">Projetos ativos ({data?.projects.length ?? 0})</div>
        <ul className="space-y-1.5 max-h-40 overflow-auto pr-1">
          {(data?.projects || []).slice(0, 6).map((p: any) => (
            <li key={p.id} className="text-xs flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${healthTone(p.progress || 0, p.deadline)}`} />
              <span className="flex-1 truncate">{p.name}</span>
              <span className="tabular-nums text-muted-foreground">{p.progress || 0}%</span>
            </li>
          ))}
          {(data?.projects.length ?? 0) === 0 && <p className="text-xs text-muted-foreground">Sem projetos ativos</p>}
        </ul>
      </div>

      {/* Capacidade */}
      <div className="hq-surface-sunken rounded-lg p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-xs font-medium text-muted-foreground">Capacidade da equipa</div>
          {data && data.overloaded > 0 && <Badge variant="destructive" className="text-[10px]">{data.overloaded} sobrecarga</Badge>}
        </div>
        <ul className="space-y-1.5 max-h-40 overflow-auto pr-1">
          {(data?.members || []).slice(0, 6).map((m: any) => {
            const hours = data!.memberHours[m.id] || 0;
            const pct = Math.min(100, (hours / 160) * 100);
            return (
              <li key={m.id} className="text-xs space-y-0.5">
                <div className="flex justify-between"><span className="truncate">{m.name}</span><span className="tabular-nums text-muted-foreground">{hours.toFixed(0)}h</span></div>
                <Progress value={pct} className="h-1" />
              </li>
            );
          })}
        </ul>
      </div>

      {/* Rotinas */}
      <div className="hq-surface-sunken rounded-lg p-3 space-y-2">
        <div className="text-xs font-medium text-muted-foreground">Rotinas ativas ({data?.routines.length ?? 0})</div>
        <ul className="space-y-1 max-h-40 overflow-auto pr-1">
          {(data?.routines || []).slice(0, 6).map((r: any) => (
            <li key={r.id} className="text-xs flex items-center gap-2">
              <Badge variant="outline" className="text-[10px] px-1 py-0">{r.frequency || '—'}</Badge>
              <span className="truncate">{r.name}</span>
            </li>
          ))}
          {(data?.routines.length ?? 0) === 0 && <p className="text-xs text-muted-foreground">Sem rotinas</p>}
        </ul>
      </div>

      {/* Tarefas prioritárias */}
      <div className="hq-surface-sunken rounded-lg p-3 space-y-2">
        <div className="text-xs font-medium text-muted-foreground">Tarefas P1/P2</div>
        <div className="grid grid-cols-4 gap-1 text-center">
          <div><div className="text-base font-semibold tabular-nums">{data?.tasksByStatus.a_fazer ?? 0}</div><div className="text-[10px] text-muted-foreground">A fazer</div></div>
          <div><div className="text-base font-semibold tabular-nums">{data?.tasksByStatus.em_curso ?? 0}</div><div className="text-[10px] text-muted-foreground">Em curso</div></div>
          <div><div className="text-base font-semibold tabular-nums text-emerald-600">{data?.tasksByStatus.concluidas ?? 0}</div><div className="text-[10px] text-muted-foreground">Concluídas</div></div>
          <div><div className="text-base font-semibold tabular-nums text-red-600">{data?.tasksByStatus.atrasadas ?? 0}</div><div className="text-[10px] text-muted-foreground">Atrasadas</div></div>
        </div>
      </div>
    </div>
  );
}