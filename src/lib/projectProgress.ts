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
