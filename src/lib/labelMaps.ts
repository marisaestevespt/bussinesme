/**
 * Centralized label maps for enum-like values used across the UI.
 *
 * Single source of truth for:
 *  - Expense locations (Portugal / UE / Fora UE)
 *  - Sale sources (com fallback para legacy values em BD)
 *  - Planning areas
 *  - Fiscal regimes (IVA / IRS)
 *
 * For domain-specific lists already centralized elsewhere, prefer those:
 *  - Contract types & statuses → `useTeamData.tsx` (CONTRACT_TYPES, CONTRACT_STATUSES)
 *  - Task statuses & priorities → `secretaria-shared.ts` (STATUS_LABELS, PRIORITY_LABELS)
 *  - Expense categories → `lib/financialCategories.ts`
 *  - CRM stages → `useCrmStages.tsx` (BD-backed)
 */

// ─── Expense locations ─────────────────────────────────────────
export const EXPENSE_LOCATIONS = [
  { value: 'portugal', label: 'Portugal' },
  { value: 'ue', label: 'União Europeia' },
  { value: 'fora_ue', label: 'Fora da UE' },
] as const;

const LOCATION_LABEL_MAP: Record<string, string> = Object.fromEntries(
  EXPENSE_LOCATIONS.map(l => [l.value, l.label])
);

/** Short variants for compact contexts (e.g. exports, table headers). */
const LOCATION_SHORT_LABEL_MAP: Record<string, string> = {
  portugal: 'Portugal', ue: 'UE', fora_ue: 'Fora UE',
};

export function locationLabel(value: string | null | undefined, short = false): string {
  if (!value) return '—';
  const map = short ? LOCATION_SHORT_LABEL_MAP : LOCATION_LABEL_MAP;
  return map[value] || value;
}

// ─── Sale sources ──────────────────────────────────────────────
export const DEFAULT_SALE_SOURCES = [
  'Instagram',
  'Sessão de Diagnóstico',
  'Recomendação',
  'Orgânico',
  'Outro',
] as const;

/** Map of historical/legacy keys stored in BD that should display nicely. */
const SALE_SOURCE_LEGACY_MAP: Record<string, string> = {
  lead: 'Lead (CRM)',
  projeto: 'Projeto existente',
};

export function saleSourceLabel(value: string | null | undefined): string {
  if (!value) return '—';
  return SALE_SOURCE_LEGACY_MAP[value] || value;
}

/** Build the dropdown options merging defaults + custom (DB) + any legacy values present. */
export function buildSaleSourceOptions(customSources: string[] = []): string[] {
  return Array.from(new Set([...DEFAULT_SALE_SOURCES, ...customSources]));
}

// ─── Planning areas ────────────────────────────────────────────
export const PLANNING_AREAS = [
  { value: 'financeiro', label: 'Financeiro' },
  { value: 'comercial', label: 'Comercial' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'operacao', label: 'Operação' },
  { value: 'equipa', label: 'Equipa' },
  { value: 'inovacao', label: 'Inovação' },
  { value: 'outro', label: 'Outro' },
] as const;

const PLANNING_AREA_LABEL_MAP: Record<string, string> = Object.fromEntries(
  PLANNING_AREAS.map(a => [a.value, a.label])
);

export function planningAreaLabel(value: string | null | undefined): string {
  if (!value) return '—';
  return PLANNING_AREA_LABEL_MAP[value] || value;
}

// ─── Fiscal regimes ────────────────────────────────────────────
export const REGIME_IVA_LABELS: Record<string, string> = {
  isento: 'Isento (art. 53.º)',
  trimestral: 'Trimestral',
  mensal: 'Mensal',
};

export const REGIME_IRS_LABELS: Record<string, string> = {
  simplificado: 'Simplificado',
  contabilidade_organizada: 'Contabilidade Organizada',
};

export function regimeIvaLabel(value: string | null | undefined): string {
  if (!value) return '';
  return REGIME_IVA_LABELS[value] || value;
}

export function regimeIrsLabel(value: string | null | undefined): string {
  if (!value) return '';
  return REGIME_IRS_LABELS[value] || value;
}
