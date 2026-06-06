export const BUSINESS_BRAND_FALLBACK_HSL = '347 66% 15%';   /* #3f0d18 */
export const BUSINESS_ACCENT_FALLBACK_HSL = '356 28% 45%';  /* #955357 */
export const BUSINESS_TEXT_FALLBACK_HSL = '202 96% 11%';    /* #012235 */

type PortalBrandingLike = {
  primary_color?: string | null;
  accent_color?: string | null;
  text_color?: string | null;
};

const HSL_TRIPLET = /^\s*\d+(?:\.\d+)?\s+\d+(?:\.\d+)?%\s+\d+(?:\.\d+)?%\s*$/;

export function normalizeHslTriplet(value: string | null | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed && HSL_TRIPLET.test(trimmed) ? trimmed : fallback;
}

export function normalizePortalBranding<T extends PortalBrandingLike | null | undefined>(branding: T): NonNullable<T> & {
  primary_color: string;
  accent_color: string;
  text_color: string;
} {
  const safeBranding = (branding ?? {}) as NonNullable<T>;

  return {
    ...safeBranding,
    primary_color: normalizeHslTriplet(safeBranding.primary_color, BUSINESS_BRAND_FALLBACK_HSL),
    accent_color: normalizeHslTriplet(safeBranding.accent_color, BUSINESS_ACCENT_FALLBACK_HSL),
    text_color: normalizeHslTriplet(safeBranding.text_color, BUSINESS_TEXT_FALLBACK_HSL),
  };
}

export function portalCssColor(hsl: string): string {
  return `hsl(${normalizeHslTriplet(hsl, BUSINESS_BRAND_FALLBACK_HSL)})`;
}

export function portalCssColorAlpha(hsl: string, alpha: number): string {
  return `hsl(${normalizeHslTriplet(hsl, BUSINESS_BRAND_FALLBACK_HSL)} / ${alpha})`;
}