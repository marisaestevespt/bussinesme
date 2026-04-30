import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, ArrowRight } from 'lucide-react';

interface Props {
  /** Ocupação geral da equipa em % (mês corrente). */
  overallUsage: number;
}

/**
 * Cruza dois sinais para sugerir contratação:
 *  - Ocupação atual da equipa
 *  - Nº de projetos ativos com desvio > 25% face ao tempo previsto
 *
 * Severidades:
 *  - Sinal duplo (ocupação > 85% E ≥2 projetos a estourar): destaque forte
 *  - Só desvio (≥2 projetos a estourar): aviso moderado
 *  - Só ocupação alta: já tratado pelo card de ocupação geral, não duplicamos aqui
 */
export function HiringSignalAlert({ overallUsage }: Props) {
  const { data } = useQuery({
    queryKey: ['capacity-hiring-signal'],
    queryFn: async () => {
      const { data: projects } = await supabase
        .from('projects')
        .select('id')
        .not('status', 'in', '(concluido,cancelado)')
        .is('archived_at', null)
        .limit(200);
      if (!projects?.length) return { overBudget: 0 };
      const ids = projects.map((p: any) => p.id);

      const [{ data: deliverables }, { data: tasks }] = await Promise.all([
        supabase
          .from('project_deliverables')
          .select('project_id, estimated_minutes')
          .in('project_id', ids),
        supabase
          .from('tasks')
          .select('id, project_id, estimated_minutes, deliverable_id')
          .in('project_id', ids),
      ]);

      const taskIds = (tasks || []).map((t: any) => t.id);
      const { data: timeEntries } = taskIds.length
        ? await supabase
            .from('task_time_entries')
            .select('task_id, duration_minutes, ended_at, is_manual')
            .in('task_id', taskIds)
        : { data: [] };

      const realByTask = new Map<string, number>();
      (timeEntries || []).forEach((e: any) => {
        if (e.ended_at || e.is_manual) {
          realByTask.set(e.task_id, (realByTask.get(e.task_id) || 0) + (e.duration_minutes || 0));
        }
      });

      let overBudget = 0;
      for (const p of projects) {
        const projDeliv = (deliverables || []).filter((d: any) => d.project_id === p.id);
        const projTasks = (tasks || []).filter((t: any) => t.project_id === p.id);
        const standalone = projTasks.filter((t: any) => !t.deliverable_id);
        const estimated =
          projDeliv.reduce((s: number, d: any) => s + (d.estimated_minutes || 0), 0) +
          standalone.reduce((s: number, t: any) => s + (t.estimated_minutes || 0), 0);
        if (estimated <= 0) continue;
        const real = projTasks.reduce((s: number, t: any) => s + (realByTask.get(t.id) || 0), 0);
        const variance = ((real - estimated) / estimated) * 100;
        if (variance > 25) overBudget += 1;
      }
      return { overBudget };
    },
  });

  const overBudget = data?.overBudget ?? 0;
  const varianceAlert = overBudget >= 2;
  if (!varianceAlert) return null;

  const doubleSignal = overallUsage > 85;

  return (
    <Alert
      className={
        doubleSignal
          ? 'border-destructive/50 bg-destructive/5'
          : 'border-warning/40 bg-warning/5'
      }
    >
      <AlertTriangle
        className={`h-4 w-4 ${doubleSignal ? 'text-destructive' : 'text-warning'}`}
      />
      <AlertTitle className={doubleSignal ? 'text-destructive' : 'text-warning'}>
        {doubleSignal ? 'Sinal duplo: considera contratar' : 'Projetos a custar mais do que o previsto'}
      </AlertTitle>
      <AlertDescription className="text-sm space-y-2">
        <p>
          {doubleSignal ? (
            <>
              A equipa está a <strong>{overallUsage}%</strong> da capacidade <em>e</em> tens{' '}
              <strong>{overBudget} projetos</strong> a estourar o tempo previsto em mais de 25%. É um
              sinal forte de que falta capacidade — vale a pena ponderar reforço de equipa.
            </>
          ) : (
            <>
              Tens <strong>{overBudget} projetos ativos</strong> a estourar o tempo previsto em mais
              de 25%. A ocupação geral ainda não está alta, mas convém rever estimativas e
              redistribuir trabalho.
            </>
          )}
        </p>
        <Link
          to="/hub/operacao?tab=analise"
          className="inline-flex items-center gap-1 text-xs font-medium underline-offset-2 hover:underline"
        >
          Ver detalhe na Análise de Operação <ArrowRight className="h-3 w-3" />
        </Link>
      </AlertDescription>
    </Alert>
  );
}