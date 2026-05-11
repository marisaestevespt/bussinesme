/**
 * Centralized task status logic.
 *
 * Historical reasons made the system use BOTH 'done' and 'concluida' for completed tasks
 * (originally tasks vs. weekly_align_tasks). Same with 'todo'/'pendente' and 'in_progress'/'em_curso'.
 * Always use these helpers — never compare status strings inline.
 */

import { isBefore, parseISO, startOfDay } from 'date-fns';

export type TaskLike = {
  id?: string;
  status?: string | null;
  deadline?: string | null;
  due_date?: string | null;
  assigned_to?: string | null;
  completed_at?: string | null;
};

/**
 * CANONICAL task statuses — the single source of truth for the `tasks` table UI
 * (matches the values used on the Tarefas page and TaskFormDialog).
 */
export const TASK_STATUSES = [
  { value: 'por_comecar', label: 'Por começar', color: 'bg-muted text-muted-foreground' },
  { value: 'a_fazer', label: 'A fazer', color: 'bg-info/15 text-info border-info/30' },
  { value: 'aguarda_feedback', label: 'Aguarda feedback cliente', color: 'bg-warning/15 text-warning border-warning/30' },
  { value: 'para_aprovacao', label: 'Para aprovação (interna)', color: 'bg-primary/15 text-primary border-primary/30' },
  { value: 'precisa_alteracoes', label: 'Precisa de alterações', color: 'bg-destructive/15 text-destructive border-destructive/30' },
  { value: 'done', label: 'Feito', color: 'bg-success/15 text-success border-success/30' },
] as const;

export const TASK_DONE = 'done' as const;
export const TASK_TODO = 'por_comecar' as const;

export function getTaskStatusInfo(value: string | null | undefined) {
  return TASK_STATUSES.find(s => s.value === value) || TASK_STATUSES[0];
}

/**
 * CANONICAL task priorities.
 * Stored values in DB: 'alta' | 'media' | 'baixa'. Displayed as P1 / P2 / P3.
 */
export const TASK_PRIORITIES = [
  { value: 'alta',  label: 'Prioridade 1', short: 'P1', color: 'bg-destructive/15 text-destructive border-destructive/30' },
  { value: 'media', label: 'Prioridade 2', short: 'P2', color: 'bg-warning/15 text-warning border-warning/30' },
  { value: 'baixa', label: 'Prioridade 3', short: 'P3', color: 'bg-muted text-muted-foreground border-border' },
] as const;

export function getTaskPriorityInfo(value: string | null | undefined) {
  return TASK_PRIORITIES.find(p => p.value === value) || TASK_PRIORITIES[2];
}

/** Status values that mean "completed". */
export const DONE_STATUSES = ['done', 'concluida', 'concluído', 'concluido', 'completed'] as const;

/** Status values that mean "in progress / active work". */
export const IN_PROGRESS_STATUSES = ['in_progress', 'em_curso', 'a_decorrer'] as const;

/** Status values that mean "not yet started". */
export const TODO_STATUSES = ['todo', 'pendente', 'por_fazer'] as const;

/** Returns true when the task is completed (any of the historical "done" labels). */
export function isTaskDone(task: TaskLike | null | undefined): boolean {
  if (!task?.status) return false;
  return (DONE_STATUSES as readonly string[]).includes(task.status);
}

/** Returns true when the task is actively being worked on. */
export function isTaskInProgress(task: TaskLike | null | undefined): boolean {
  if (!task?.status) return false;
  return (IN_PROGRESS_STATUSES as readonly string[]).includes(task.status);
}

/** Returns true when the task hasn't been started yet. */
export function isTaskTodo(task: TaskLike | null | undefined): boolean {
  if (!task?.status) return false;
  return (TODO_STATUSES as readonly string[]).includes(task.status);
}

/** Returns true when the task is not done (todo or in_progress, anything pending). */
export function isTaskOpen(task: TaskLike | null | undefined): boolean {
  return !isTaskDone(task);
}

/**
 * Returns true when the task has a deadline in the past and is not yet done.
 * Compares against the start of the provided "now" (defaults to today).
 */
export function isTaskOverdue(task: TaskLike | null | undefined, now: Date = new Date()): boolean {
  if (!task) return false;
  if (isTaskDone(task)) return false;
  const deadlineStr = task.deadline || task.due_date;
  if (!deadlineStr) return false;
  try {
    return isBefore(parseISO(deadlineStr), startOfDay(now));
  } catch {
    return false;
  }
}

/* ---------- Aggregators ---------- */

export function filterDone<T extends TaskLike>(tasks: T[]): T[] {
  return tasks.filter(isTaskDone);
}

export function filterOpen<T extends TaskLike>(tasks: T[]): T[] {
  return tasks.filter(isTaskOpen);
}

export function filterOverdue<T extends TaskLike>(tasks: T[], now: Date = new Date()): T[] {
  return tasks.filter(t => isTaskOverdue(t, now));
}

export function countDone(tasks: TaskLike[]): number {
  return tasks.reduce((n, t) => n + (isTaskDone(t) ? 1 : 0), 0);
}

export function countOpen(tasks: TaskLike[]): number {
  return tasks.reduce((n, t) => n + (isTaskOpen(t) ? 1 : 0), 0);
}

export function countOverdue(tasks: TaskLike[], now: Date = new Date()): number {
  return tasks.reduce((n, t) => n + (isTaskOverdue(t, now) ? 1 : 0), 0);
}

/** Completion ratio (0–1) for a list of tasks. Returns 0 when empty. */
export function completionRatio(tasks: TaskLike[]): number {
  if (tasks.length === 0) return 0;
  return countDone(tasks) / tasks.length;
}

/** Completion percentage (0–100, rounded). */
export function completionPercent(tasks: TaskLike[]): number {
  return Math.round(completionRatio(tasks) * 100);
}
