/**
 * Canonical source of truth for Client statuses.
 * UI components and queries MUST import from here. Do not redefine status
 * lists, badge maps, or filter arrays locally.
 */

export type ClientStatus =
  | 'em_onboarding'
  | 'ativo'
  | 'pausado'
  | 'altura_renovacao'
  | 'em_offboarding'
  | 'terminado';

export interface ClientStatusInfo {
  value: ClientStatus;
  label: string;
  /** Tailwind classes for badges. */
  color: string;
}

export const CLIENT_STATUSES: ClientStatusInfo[] = [
  { value: 'em_onboarding',   label: 'Em onboarding',       color: 'bg-info/15 text-info' },
  { value: 'ativo',           label: 'Ativo',               color: 'bg-success/15 text-success' },
  { value: 'pausado',         label: 'Pausado',             color: 'bg-warning/15 text-warning' },
  { value: 'altura_renovacao',label: 'Altura de renovação', color: 'bg-warning/15 text-warning' },
  { value: 'em_offboarding',  label: 'Em offboarding',      color: 'bg-destructive/15 text-destructive' },
  { value: 'terminado',       label: 'Terminado',           color: 'bg-destructive/15 text-destructive' },
];

const CLIENT_STATUS_MAP: Record<string, ClientStatusInfo> = CLIENT_STATUSES.reduce(
  (acc, s) => ({ ...acc, [s.value]: s }),
  {} as Record<string, ClientStatusInfo>,
);

export function getClientStatusInfo(status?: string | null): ClientStatusInfo {
  if (!status) return CLIENT_STATUSES[0];
  return CLIENT_STATUS_MAP[status] ?? { value: status as ClientStatus, label: status, color: 'bg-muted text-muted-foreground' };
}

export function getClientStatusLabel(status?: string | null): string {
  return getClientStatusInfo(status).label;
}

export function getClientStatusColor(status?: string | null): string {
  return getClientStatusInfo(status).color;
}

/** Statuses considered active (cliente ainda está em curso, em qualquer fase). */
export const ACTIVE_CLIENT_STATUSES: ClientStatus[] = [
  'em_onboarding',
  'ativo',
  'pausado',
  'altura_renovacao',
  'em_offboarding',
];

/** Statuses considered "ainda gera receita recorrente" (MRR base). */
export const MRR_CLIENT_STATUSES: ClientStatus[] = ['ativo', 'em_onboarding'];

/** Statuses arquivados (cliente já saiu). */
export const ARCHIVED_CLIENT_STATUSES: ClientStatus[] = ['terminado'];

export function isActiveClientStatus(status?: string | null): boolean {
  return !!status && (ACTIVE_CLIENT_STATUSES as string[]).includes(status);
}
export function isArchivedClientStatus(status?: string | null): boolean {
  return !!status && (ARCHIVED_CLIENT_STATUSES as string[]).includes(status);
}
export function isMrrClientStatus(status?: string | null): boolean {
  return !!status && (MRR_CLIENT_STATUSES as string[]).includes(status);
}

/** Default status for newly-created clients. */
export const DEFAULT_CLIENT_STATUS: ClientStatus = 'em_onboarding';

/** Backwards-compatible options array (just value/label) for selects. */
export const CLIENT_STATUS_OPTIONS = CLIENT_STATUSES.map(s => ({ value: s.value, label: s.label }));
