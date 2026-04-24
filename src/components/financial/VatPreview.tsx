import { vatBreakdown } from '@/lib/payrollCalculations';
import { formatEuro } from '@/lib/formatting';

/**
 * Preview line shown under the value/IVA inputs in expense forms.
 *
 * Single source of truth — replaces 3 previously inlined formulas in
 * FinSaidas, finMensal/SaidasSection and ExpenseDetailSheet.
 *
 * - When `includesVat` is true, `value` is treated as total c/ IVA and we
 *   show base + IVA extracted from it.
 * - When false, `value` is treated as base value and we show total c/ IVA + IVA.
 *
 * Returns null when the inputs are not enough to compute (no value or 0% VAT).
 */
export function VatPreview({
  value,
  vatRate,
  includesVat,
}: {
  value: string | number | null | undefined;
  vatRate: number | string | null | undefined;
  includesVat: boolean;
}) {
  const amount = typeof value === 'number' ? value : parseFloat(String(value ?? ''));
  const rate = typeof vatRate === 'number' ? vatRate : parseInt(String(vatRate ?? '23'));
  if (!Number.isFinite(amount) || amount <= 0 || !Number.isFinite(rate) || rate <= 0) return null;

  const b = vatBreakdown(amount, rate, includesVat);

  return (
    <p className="text-xs text-muted-foreground">
      {includesVat
        ? `Base: ${formatEuro(b.baseValue)} · IVA: ${formatEuro(b.vatAmount)}`
        : `Total c/ IVA: ${formatEuro(b.totalWithVat)} · IVA: ${formatEuro(b.vatAmount)}`}
    </p>
  );
}