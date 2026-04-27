/**
 * Centralized MEETING status logic.
 * Single source of truth for the `meetings` table status badges, dropdowns,
 * and helper filters across every page (Reunioes, ReuniaoDetail,
 * ReunioesSubPage, ProjectGestaoTab, Secretaria, Hub Equipa, etc.).
 */

export type MeetingStatusValue =
  | 'por_organizar'
  | 'por_confirmar'
  | 'confirmada'
  | 'realizada'
  | 'terminada'
  | 'cancelada';

export interface MeetingStatusInfo {
  value: MeetingStatusValue;
  label: string;
  color: string;     // tailwind classes for badge
  dotColor: string;  // hsl token for charts/timeline dots
}

export const MEETING_STATUSES: MeetingStatusInfo[] = [
  { value: 'por_confirmar', label: 'Por confirmar', color: 'bg-warning/15 text-warning border-warning/30',           dotColor: 'hsl(var(--warning))' },
  { value: 'confirmada',    label: 'Confirmada',    color: 'bg-success/15 text-success border-success/30',           dotColor: 'hsl(var(--success))' },
  { value: 'por_organizar', label: 'Por organizar', color: 'bg-info/15 text-info border-info/30',                    dotColor: 'hsl(var(--info))' },
  { value: 'realizada',     label: 'Realizada',     color: 'bg-accent-violet/15 text-accent-violet border-accent-violet/30', dotColor: 'hsl(var(--accent-violet))' },
  { value: 'terminada',     label: 'Terminada',     color: 'bg-muted text-muted-foreground border-border',           dotColor: 'hsl(var(--muted-foreground))' },
  { value: 'cancelada',     label: 'Cancelada',     color: 'bg-destructive/15 text-destructive border-destructive/30', dotColor: 'hsl(var(--destructive))' },
];

export function getMeetingStatusInfo(v: string | null | undefined): MeetingStatusInfo {
  return MEETING_STATUSES.find(s => s.value === v) || MEETING_STATUSES[0];
}

/** Statuses that count toward "completed meetings" (productivity, KPIs).
 *  `por_organizar` é pós-reunião (já aconteceu) → conta como realizada. */
export const MEETING_DONE_STATUSES: MeetingStatusValue[] = ['por_organizar', 'realizada', 'terminada'];
/** Statuses that mean the meeting is upcoming and needs action. */
export const MEETING_PENDING_STATUSES: MeetingStatusValue[] = ['por_confirmar', 'confirmada'];

export function isMeetingDone(m: { status?: string | null } | null | undefined): boolean {
  if (!m?.status) return false;
  return (MEETING_DONE_STATUSES as string[]).includes(m.status);
}
export function isMeetingPending(m: { status?: string | null } | null | undefined): boolean {
  if (!m?.status) return false;
  return (MEETING_PENDING_STATUSES as string[]).includes(m.status);
}
