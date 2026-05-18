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
  // Regra única: a saúde reflete apenas atrasos concretos.
  // - 1+ tarefa em atraso → 🔴 Em risco
  // - Prazo do projeto ultrapassado e ainda não concluído → 🔴 Em risco
  // - Sem nada em atraso → 🟢 Em dia
  // (Sem "ritmo esperado" — projetos podem avançar ao seu próprio tempo.)
  const projectTasks = tasks.filter(t => t.project_id === project.id);
  const overdueTasks = projectTasks.filter(t => isTaskOverdue(t, today));
  const overdueCount = overdueTasks.length;

  const prog = progressOverride ?? project.progress ?? 0;
  const daysLeft = project.deadline
    ? differenceInDays(new Date(project.deadline), today)
    : null;
  const projectDeadlineOverdue =
    daysLeft !== null && daysLeft < 0 && prog < 100;

  let health: ProjectHealth = 'green';
  let reason = 'Sem atrasos.';

  if (overdueCount > 0) {
    health = 'red';
    reason = `${overdueCount} tarefa${overdueCount === 1 ? '' : 's'} em atraso.`;
  } else if (projectDeadlineOverdue) {
    health = 'red';
    reason = `Prazo ultrapassado há ${Math.abs(daysLeft!)} dia${Math.abs(daysLeft!) === 1 ? '' : 's'}.`;
  }

  return {
    health,
    prog,
    overdueCount,
    daysLeft,
    expectedProg: null,
    useOverdueOnly: true,
    reason,
  };
}

export const HEALTH_LABEL: Record<ProjectHealth, string> = {
  green: 'Em dia',
  yellow: 'Atenção',
  red: 'Em risco',
};