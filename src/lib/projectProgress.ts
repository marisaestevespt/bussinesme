/**
 * Centralized project progress / deliverable status utilities.
 *
 * Historical inconsistency: deliverables use 'concluido' OR 'concluida' OR 'entregue';
 * phases use 'concluida'. This module normalises everything.
 */

export const DELIVERABLE_DONE_STATUSES = ['concluido', 'concluida', 'entregue', 'completed', 'done'] as const;
export const DELIVERABLE_IN_PROGRESS_STATUSES = ['em_progresso', 'em_curso', 'in_progress'] as const;
export const DELIVERABLE_PENDING_STATUSES = ['pendente', 'todo', 'pending'] as const;

export const PHASE_DONE_STATUSES = ['concluida', 'concluido', 'completed', 'done'] as const;
export const PHASE_IN_PROGRESS_STATUSES = ['em_curso', 'em_progresso', 'in_progress'] as const;

export const PROJECT_DONE_STATUSES = ['concluido', 'concluida', 'completed', 'done'] as const;

/* ---------- Display info (single source of truth for badges & dropdowns) ---------- */

/**
 * Canonical deliverable statuses with labels & colors.
 * Matches the values written by the DB triggers `sync_task_status_to_deliverable`
 * and `update_project_progress`.
 */
export const DELIVERABLE_STATUSES = [
  { value: 'pendente',         label: 'Pendente',         color: 'bg-muted text-muted-foreground border-border' },
  { value: 'em_progresso',     label: 'Em progresso',     color: 'bg-info/15 text-info border-info/30' },
  { value: 'aguarda_cliente',  label: 'Aguarda cliente',  color: 'bg-warning/15 text-warning border-warning/30' },
  { value: 'concluido',        label: 'Concluído',        color: 'bg-success/15 text-success border-success/30' },
] as const;

export type DeliverableStatus = typeof DELIVERABLE_STATUSES[number]['value'];

export function getDeliverableStatusInfo(value: string | null | undefined) {
  return DELIVERABLE_STATUSES.find(s => s.value === value)
      || { value: value || 'pendente', label: value || 'Pendente', color: 'bg-muted text-muted-foreground border-border' };
}

/**
 * Canonical phase statuses with labels & colors.
 * Matches the values written by `update_project_progress` and project_phases UI.
 */
export const PHASE_STATUSES = [
  { value: 'pendente',  label: 'Pendente',  color: 'bg-muted text-muted-foreground border-border' },
  { value: 'em_curso',  label: 'Em curso',  color: 'bg-info/15 text-info border-info/30' },
  { value: 'concluida', label: 'Concluída', color: 'bg-success/15 text-success border-success/30' },
] as const;

export type PhaseStatus = typeof PHASE_STATUSES[number]['value'];

export function getPhaseStatusInfo(value: string | null | undefined) {
  return PHASE_STATUSES.find(s => s.value === value)
      || { value: value || 'pendente', label: value || 'Pendente', color: 'bg-muted text-muted-foreground border-border' };
}

export interface DeliverableLike {
  status?: string | null;
  phase_id?: string | null;
  project_id?: string | null;
}

export interface PhaseLike {
  status?: string | null;
  project_id?: string | null;
  id?: string | null;
}

export interface ProjectLike {
  id?: string | null;
  status?: string | null;
}

/* ---------- predicates ---------- */

export function isDeliverableDone(d: DeliverableLike | null | undefined): boolean {
  return !!d?.status && (DELIVERABLE_DONE_STATUSES as readonly string[]).includes(d.status);
}

export function isDeliverableInProgress(d: DeliverableLike | null | undefined): boolean {
  return !!d?.status && (DELIVERABLE_IN_PROGRESS_STATUSES as readonly string[]).includes(d.status);
}

export function isPhaseDone(p: PhaseLike | null | undefined): boolean {
  return !!p?.status && (PHASE_DONE_STATUSES as readonly string[]).includes(p.status);
}

export function isPhaseInProgress(p: PhaseLike | null | undefined): boolean {
  return !!p?.status && (PHASE_IN_PROGRESS_STATUSES as readonly string[]).includes(p.status);
}

export function isProjectDone(p: ProjectLike | null | undefined): boolean {
  return !!p?.status && (PROJECT_DONE_STATUSES as readonly string[]).includes(p.status);
}

/* ---------- counters ---------- */

export function countDoneDeliverables(deliverables: DeliverableLike[]): number {
  return deliverables.filter(isDeliverableDone).length;
}

export function countDonePhases(phases: PhaseLike[]): number {
  return phases.filter(isPhaseDone).length;
}

/* ---------- progress percent ---------- */

/** Generic ratio→percent (rounded, clamped 0–100). Returns 0 for empty inputs. */
export function percent(done: number, total: number): number {
  if (!total || total <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((done / total) * 100)));
}

/** Progress (0–100) from a list of deliverables. */
export function deliverableProgress(deliverables: DeliverableLike[]): number {
  if (!deliverables.length) return 0;
  return percent(countDoneDeliverables(deliverables), deliverables.length);
}

/** Progress (0–100) from a list of phases. */
export function phaseProgress(phases: PhaseLike[]): number {
  if (!phases.length) return 0;
  return percent(countDonePhases(phases), phases.length);
}

/**
 * Project progress: prefers deliverables, falls back to phases, then to 0.
 * Pass empty arrays for sources you don't have.
 */
export function projectProgress(
  deliverables: DeliverableLike[],
  phases: PhaseLike[] = [],
): number {
  if (deliverables.length > 0) return deliverableProgress(deliverables);
  if (phases.length > 0) return phaseProgress(phases);
  return 0;
}

/** Human label like "3/8 entregas" or "2/5 fases". */
export function progressLabel(
  deliverables: DeliverableLike[],
  phases: PhaseLike[] = [],
  labels: { deliverables?: string; phases?: string } = {},
): string {
  const dLabel = labels.deliverables ?? 'entregas';
  const pLabel = labels.phases ?? 'fases';
  if (deliverables.length > 0) {
    return `${countDoneDeliverables(deliverables)}/${deliverables.length} ${dLabel}`;
  }
  if (phases.length > 0) {
    return `${countDonePhases(phases)}/${phases.length} ${pLabel}`;
  }
  return `0/0 ${dLabel}`;
}

/** True when all deliverables exist and all are done. */
export function isPhaseComplete(phaseDeliverables: DeliverableLike[]): boolean {
  return phaseDeliverables.length > 0 && phaseDeliverables.every(isDeliverableDone);
}

/* ---------- Unified per-project progress (single source of truth) ---------- */

export interface MonthlyTaskLike {
  id?: string | null;
  status?: string | null;
}

export interface MonthlyOccurrenceLike {
  status?: string | null;
  linked_task_id?: string | null;
}

export interface MonthlyCycleProgressSource {
  phases?: PhaseLike[];
  occurrences?: MonthlyOccurrenceLike[];
  tasks?: MonthlyTaskLike[];
}

export interface ProjectProgressInput {
  type?: string | null;
  project_mode?: string | null;
  task_mode?: string | null;
}

/**
 * Single source of truth for a project's "real progress" (0–100).
 * Used by ProjetoDetail (badge + persisted progress) AND by Operação
 * (saúde dos projetos card + project lists). Keep both call sites in sync —
 * never recompute progress with a different rule.
 *
 * Order of precedence:
 *   1. Recorrente mensal → tasks of the current month
 *   2. Deliverables (all, not just open ones)
 *   3. Phases (all)
 *   4. 0
 *
 * `monthlyDoneFn` is a function that, for a recurring monthly project,
 * returns { done, total } for the current month tasks. Pass `null` from
 * call sites that don't compute monthly tasks (Operação) — they will fall
 * through to deliverables/phases, which is still coherent because the
 * health rule for recurring monthly projects is "overdue-only" anyway.
 */
export function computeProjectProgressFromSources(
  project: ProjectProgressInput,
  deliverables: DeliverableLike[],
  phases: PhaseLike[],
  monthlyDoneFn?: (() => { done: number; total: number }) | null,
): number {
  const isRecorrenteMensal =
    project.type === 'cliente_servico_mensal' && project.project_mode === 'recorrente';

  if (isRecorrenteMensal && monthlyDoneFn) {
    const { done, total } = monthlyDoneFn();
    return percent(done, total);
  }

  if (deliverables.length > 0) return deliverableProgress(deliverables);
  if (phases.length > 0) return phaseProgress(phases);
  return 0;
}

export function computeMonthlyCycleProgress({
  phases = [],
  occurrences = [],
  tasks = [],
}: MonthlyCycleProgressSource): { done: number; total: number; pct: number; standaloneTasks: MonthlyTaskLike[] } {
  const linkedTaskIds = new Set(occurrences.map(o => o.linked_task_id).filter(Boolean) as string[]);
  const standaloneTasks = tasks.filter(t => !t.id || !linkedTaskIds.has(t.id));
  const done =
    occurrences.filter(o => o.status === 'concluida').length +
    phases.filter(isPhaseDone).length +
    standaloneTasks.filter(t => {
      if (!t.status) return false;
      return ['concluida', 'concluido', 'completed', 'done'].includes(t.status);
    }).length;
  const total = occurrences.length + phases.length + standaloneTasks.length;
  return { done, total, pct: percent(done, total), standaloneTasks };
}
