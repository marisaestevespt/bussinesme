/**
 * Centralized PROJECT status logic.
 * Single source of truth for the `projects` table status badges, dropdowns,
 * and helper filters across every page (Projetos, ProjetoDetail, Secretaria,
 * Operação, HubEquipa, Planning, etc.).
 */

import { isBefore, parseISO, startOfDay } from 'date-fns';

export type ProjectStatusValue =
  | 'em_onboarding'
  | 'em_ideia'
  | 'em_curso'
  | 'em_pausa'
  | 'em_revisao'
  | 'concluido'
  | 'cancelado'
  | 'arquivo'
  | 'agendado';

export interface ProjectStatusInfo {
  value: ProjectStatusValue;
  label: string;
  color: string; // tailwind classes for badge
  dot: string;   // tailwind class for dot indicator
}

export const PROJECT_STATUSES: ProjectStatusInfo[] = [
  { value: 'em_ideia',      label: 'Em ideia',      color: 'bg-muted text-muted-foreground border-border', dot: 'bg-muted-foreground' },
  { value: 'em_onboarding', label: 'Em onboarding', color: 'bg-info/15 text-info border-info/30', dot: 'bg-info' },
  { value: 'agendado',      label: 'Agendado',      color: 'bg-accent-violet/15 text-accent-violet border-accent-violet/30', dot: 'bg-accent-violet' },
  { value: 'em_curso',      label: 'Em curso',      color: 'bg-info/15 text-info border-info/30',          dot: 'bg-info' },
  { value: 'em_pausa',      label: 'Em pausa',      color: 'bg-warning/15 text-warning border-warning/30', dot: 'bg-warning' },
  { value: 'em_revisao',    label: 'Em revisão',    color: 'bg-accent-violet/15 text-accent-violet border-accent-violet/30', dot: 'bg-accent-violet' },
  { value: 'concluido',     label: 'Concluído',     color: 'bg-success/15 text-success border-success/30', dot: 'bg-success' },
  { value: 'cancelado',     label: 'Cancelado',     color: 'bg-destructive/15 text-destructive border-destructive/30', dot: 'bg-destructive' },
  { value: 'arquivo',       label: 'Arquivo',       color: 'bg-muted text-muted-foreground border-border', dot: 'bg-muted-foreground' },
];

export function getProjectStatusInfo(v: string | null | undefined): ProjectStatusInfo {
  return PROJECT_STATUSES.find(s => s.value === v) || PROJECT_STATUSES[0]; // default: em_ideia
}

/** Statuses that mean the project is finished and shouldn't show in active lists. */
export const PROJECT_TERMINAL_STATUSES: ProjectStatusValue[] = ['concluido', 'cancelado', 'arquivo'];
/** Statuses that mean the project is currently being worked on. */
export const PROJECT_ACTIVE_STATUSES: ProjectStatusValue[] = ['em_onboarding', 'em_curso', 'em_pausa', 'em_revisao'];

export function isProjectActive(p: { status?: string | null } | null | undefined): boolean {
  if (!p?.status) return false;
  return (PROJECT_ACTIVE_STATUSES as string[]).includes(p.status);
}
export function isProjectDone(p: { status?: string | null } | null | undefined): boolean {
  if (!p?.status) return false;
  return p.status === 'concluido';
}
export function isProjectTerminal(p: { status?: string | null } | null | undefined): boolean {
  if (!p?.status) return false;
  return (PROJECT_TERMINAL_STATUSES as string[]).includes(p.status);
}

/**
 * Returns true when the project's deadline is in the past and the project
 * is still active (i.e. not concluido / cancelado / arquivo). Compares
 * against the start of the provided "now" (defaults to today) to avoid
 * timezone-induced false positives.
 */
export function isProjectOverdue(
  p: { status?: string | null; deadline?: string | null } | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!p?.deadline) return false;
  if (isProjectTerminal(p)) return false;
  try {
    return isBefore(parseISO(p.deadline), startOfDay(now));
  } catch {
    return false;
  }
}
