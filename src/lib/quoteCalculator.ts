/**
 * Pure calculation lib for product quotes.
 * Used by QuoteCalculator UI and (potentially) server triggers.
 */

export type DriverInput = {
  id?: string | null;
  name: string;
  unit?: string | null;
  unit_price: number;
  qty: number;
};

export type ComplexityLevel = {
  key: string;
  label: string;
  multiplier: number;
};

export type VolumeDiscount = {
  /** Subtotal threshold (after multiplier) at/above which this discount applies. */
  min_subtotal: number;
  discount_pct: number;
};

export type QuoteResult = {
  drivers_subtotal: number;
  base_with_drivers: number;
  multiplier: number;
  after_multiplier: number;
  applied_discount_pct: number;
  total: number;
};

export function pickVolumeDiscount(
  subtotal: number,
  discounts: VolumeDiscount[],
): VolumeDiscount | null {
  if (!Array.isArray(discounts) || discounts.length === 0) return null;
  const eligible = discounts
    .filter((d) => Number(d?.min_subtotal) <= subtotal)
    .sort((a, b) => Number(b.min_subtotal) - Number(a.min_subtotal));
  return eligible[0] ?? null;
}

export function computeQuote(opts: {
  basePrice?: number;
  drivers: DriverInput[];
  complexity?: ComplexityLevel | null;
  volumeDiscounts?: VolumeDiscount[];
  manualDiscountPct?: number;
}): QuoteResult {
  const base = Number(opts.basePrice ?? 0) || 0;
  const driversSubtotal = (opts.drivers || []).reduce(
    (acc, d) => acc + (Number(d.unit_price) || 0) * (Number(d.qty) || 0),
    0,
  );
  const baseWithDrivers = base + driversSubtotal;
  const multiplier = Number(opts.complexity?.multiplier ?? 1) || 1;
  const afterMultiplier = baseWithDrivers * multiplier;

  const auto = pickVolumeDiscount(afterMultiplier, opts.volumeDiscounts ?? []);
  const manual = Number(opts.manualDiscountPct ?? 0) || 0;
  const appliedDiscountPct = Math.max(auto?.discount_pct ?? 0, manual);

  const total = afterMultiplier * (1 - appliedDiscountPct / 100);

  return {
    drivers_subtotal: driversSubtotal,
    base_with_drivers: baseWithDrivers,
    multiplier,
    after_multiplier: afterMultiplier,
    applied_discount_pct: appliedDiscountPct,
    total,
  };
}

export function formatEuro(n: number): string {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(n || 0);
}