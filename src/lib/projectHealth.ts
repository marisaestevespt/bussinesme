import { differenceInDays } from 'date-fns';
import { isTaskOverdue, type TaskLike } from '@/lib/taskStatus';

type ProjectTask = TaskLike & { project_id?: string | null };

export type ProjectHealth = 'green' | 'yellow' | 'red';

export interface ProjectHealthInput {
  id: string;
  type?: string | null;
  task_mode?: string | null;
  task_modes?: string[] | null;
  project_mode?: string | null;
  deadline?: string | null;
  start_date?: string | null;
  created_at?: string | null;
  progress?: number | null;
}

export interface ProjectHealthResult {
  health: ProjectHealth;
  /** Effective progress used for the calculation (0–100), or null when not applicable. */
  prog: number | null;
  /** Number of overdue tasks belonging to this project. */
  overdueCount: number;
  /** Days remaining until project deadline (null when no deadline / overdue-only mode). */
  daysLeft: number | null;
  /** Expected progress at "today" given start_date → deadline (null when not applicable). */
  expectedProg: number | null;
  /** True when this project uses the simplified overdue-only health rule. */
  useOverdueOnly: boolean;
  /** Human-readable reason for the current health status (PT). */
  reason: string;
}

/**
 * Centralised project-health calculation, shared by the Operação dashboard
 * and the project detail page. Keep this in sync — do not duplicate the rule.
 */
export function computeProjectHealth(
  project: ProjectHealthInput,
  tasks: ProjectTask[],
  today: Date,
  progressOverride?: number | null,
): ProjectHealthResult {
  const modes = project.task_modes && project.task_modes.length > 0
    ? project.task_modes
    : (project.task_mode ? [project.task_mode] : []);
  // Considera "tarefas livres" sempre que esse modo estiver ativo (mesmo combinado com fases/recorrentes).
  const isTarefasLivres = modes.includes('tarefas_livres') && !modes.includes('fases');
  const isRecorrenteMensal =
    project.type === 'cliente_servico_mensal' && project.project_mode === 'recorrente';
  const useOverdueOnly = isTarefasLivres || isRecorrenteMensal;

  const projectTasks = tasks.filter(t => t.project_id === project.id);
  const overdueTasks = projectTasks.filter(t => isTaskOverdue(t, today));
  const overdueCount = overdueTasks.length;

  const prog = useOverdueOnly
    ? null
    : (progressOverride ?? project.progress ?? 0);

  let daysLeft: number | null = null;
  let expectedProg: number | null = null;
  let health: ProjectHealth = 'green';
  let reason = 'Sem atrasos.';

  if (useOverdueOnly) {
    if (overdueCount > 0) {
      health = 'red';
      reason = `${overdueCount} tarefa${overdueCount === 1 ? '' : 's'} em atraso.`;
    } else {
      reason = isRecorrenteMensal
        ? 'Avença em curso, sem tarefas em atraso.'
        : 'Sem tarefas em atraso.';
    }
  } else if (prog !== null) {
    if (project.deadline) {
      daysLeft = differenceInDays(new Date(project.deadline), today);
      const startRef = new Date(project.start_date || project.created_at || today);
      const totalSpan = Math.max(1, differenceInDays(new Date(project.deadline), startRef));
      expectedProg = Math.max(
        0,
        Math.min(100, (differenceInDays(today, startRef) / totalSpan) * 100),
      );

      if (prog < expectedProg - 25 || (daysLeft <= 3 && prog < 80)) {
        health = 'red';
        reason =
          daysLeft <= 3 && prog < 80
            ? `Faltam ${Math.max(daysLeft, 0)} dia${daysLeft === 1 ? '' : 's'} e progresso em ${Math.round(prog)}%.`
            : `Atrasado >25pp face ao esperado (${Math.round(prog)}% vs ${Math.round(expectedProg)}%).`;
      } else if (prog < expectedProg - 10 || (daysLeft <= 7 && prog < 60)) {
        health = 'yellow';
        reason =
          daysLeft <= 7 && prog < 60
            ? `Faltam ${Math.max(daysLeft, 0)} dia${daysLeft === 1 ? '' : 's'} e progresso em ${Math.round(prog)}%.`
            : `Ligeiramente atrasado (${Math.round(prog)}% vs ${Math.round(expectedProg)}% esperado).`;
      } else {
        reason = `No bom caminho (${Math.round(prog)}% vs ${Math.round(expectedProg)}% esperado).`;
      }
    }
    if (
      prog === 0 &&
      differenceInDays(today, new Date(project.start_date || project.created_at || today)) > 7
    ) {
      health = 'red';
      reason = 'Sem progresso há mais de 7 dias desde o arranque.';
    }
  }

  // Overdue tasks always degrade health, even on deadline-driven projects.
  if (overdueCount > 0 && health === 'green') {
    health = 'yellow';
    reason = `${overdueCount} tarefa${overdueCount === 1 ? '' : 's'} em atraso.`;
  }

  return {
    health,
    prog,
    overdueCount,
    daysLeft,
    expectedProg,
    useOverdueOnly,
    reason,
  };
}

export const HEALTH_LABEL: Record<ProjectHealth, string> = {
  green: 'Em dia',
  yellow: 'Atenção',
  red: 'Em risco',
};