/**
 * Canonical source of truth for SOP / Processo statuses.
 * UI components MUST import from here. Do not redefine status lists locally.
 */

export type SopStatus =
  | 'para_criar'
  | 'em_criacao'
  | 'ativo'
  | 'em_revisao'
  | 'off';

export interface SopStatusInfo {
  value: SopStatus;
  label: string;
  /** Tailwind classes for badges (background + text + border). */
  color: string;
}

export const SOP_STATUSES: SopStatusInfo[] = [
  { value: 'para_criar', label: 'Para criar', color: 'bg-muted text-muted-foreground' },
  { value: 'em_criacao', label: 'Em criação', color: 'bg-warning/15 text-warning border-warning/30' },
  { value: 'ativo', label: 'Ativo', color: 'bg-success/15 text-success border-success/30' },
  { value: 'em_revisao', label: 'Em revisão', color: 'bg-info/15 text-info border-info/30' },
  { value: 'off', label: 'Off', color: 'bg-destructive/15 text-destructive border-destructive/30' },
];

const SOP_STATUS_MAP: Record<string, SopStatusInfo> = SOP_STATUSES.reduce(
  (acc, s) => ({ ...acc, [s.value]: s }),
  {} as Record<string, SopStatusInfo>,
);

/** Returns the canonical info for a SOP status, falling back to "para_criar". */
export function getSopStatusInfo(status?: string | null): SopStatusInfo {
  if (!status) return SOP_STATUSES[0];
  return SOP_STATUS_MAP[status] ?? SOP_STATUSES[0];
}

/** Returns the human-readable label for a SOP status. */
export function getSopStatusLabel(status?: string | null): string {
  return getSopStatusInfo(status).label;
}

/** Returns the badge color classes for a SOP status. */
export function getSopStatusColor(status?: string | null): string {
  return getSopStatusInfo(status).color;
}

/** Default status for newly-created SOPs. */
export const DEFAULT_SOP_STATUS: SopStatus = 'para_criar';
