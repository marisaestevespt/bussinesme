/**
 * Canonical financial category definitions (single source of truth).
 *
 * Aligns with:
 *  - The expense form options in `useFinancialCategories.tsx`
 *  - The actual `category` values stored in `financial_expenses`
 *
 * Use `expenseLabel(value)` everywhere instead of redefining local maps.
 */

export interface ExpenseCategoryDef {
  value: string;
  label: string;
  /** Excluded from "biggest/smallest expense" insights (fiscal obligations or catch-all). */
  isFiscalOrGeneric?: boolean;
}

export const EXPENSE_CATEGORIES: ExpenseCategoryDef[] = [
  { value: 'pessoal', label: 'Pessoal' },
  { value: 'freelancer', label: 'Freelancer' },
  { value: 'campanha', label: 'Campanha' },
  { value: 'ferramenta', label: 'Ferramenta' },
  { value: 'formacao', label: 'Formação' },
  { value: 'servico_contratado', label: 'Serviço Contratado' },
  { value: 'plataformas', label: 'Plataformas' },
  { value: 'prestadores', label: 'Prestadores' },
  { value: 'ordenados', label: 'Ordenados', isFiscalOrGeneric: true },
  { value: 'seguranca_social', label: 'Segurança Social', isFiscalOrGeneric: true },
  { value: 'impostos', label: 'Impostos', isFiscalOrGeneric: true },
  { value: 'outro', label: 'Outro', isFiscalOrGeneric: true },
];

const EXPENSE_LABEL_MAP: Record<string, string> = Object.fromEntries(
  EXPENSE_CATEGORIES.map(c => [c.value, c.label])
);

/** Categories excluded from analytical insights (biggest/smallest expense cards). */
export const EXPENSE_INSIGHT_EXCLUDED: Set<string> = new Set(
  EXPENSE_CATEGORIES.filter(c => c.isFiscalOrGeneric).map(c => c.value)
);

/**
 * Convert a category key (e.g. `formacao`) to its display label (e.g. `Formação`).
 * Falls back to the raw key if unknown — useful for forward-compatibility with custom categories.
 */
export function expenseLabel(key: string | null | undefined): string {
  if (!key) return '—';
  return EXPENSE_LABEL_MAP[key] || key;
}
