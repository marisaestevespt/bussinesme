import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const PRODUCT_FALLBACK_PALETTE = [
  'hsl(173 58% 34%)',
  'hsl(217 60% 45%)',
  'hsl(334 55% 46%)',
  'hsl(42 76% 40%)',
  'hsl(145 45% 36%)',
  'hsl(263 46% 50%)',
  'hsl(12 65% 47%)',
  'hsl(191 60% 36%)',
];

const normalizeProductKey = (value?: string | null) => value?.trim().toLocaleLowerCase('pt-PT') ?? '';

function fallbackProductColor(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return PRODUCT_FALLBACK_PALETTE[hash % PRODUCT_FALLBACK_PALETTE.length];
}

function hexToHsl(hex: string) {
  const value = hex.replace('#', '').trim();
  const normalized = value.length === 3
    ? value.split('').map(char => char + char).join('')
    : value;
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return null;
  const r = parseInt(normalized.slice(0, 2), 16) / 255;
  const g = parseInt(normalized.slice(2, 4), 16) / 255;
  const b = parseInt(normalized.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  const d = max - min;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (max === r) h = 60 * (((g - b) / d) % 6);
    else if (max === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
  }
  return `${Math.round((h + 360) % 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

function normalizeBrandColor(raw: unknown, seed: string) {
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (/^hsl\(.*\)$/i.test(trimmed)) return trimmed;
    if (/^\d+\s+\d+%\s+\d+%$/.test(trimmed)) return `hsl(${trimmed})`;
    if (/^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(trimmed)) {
      const hsl = hexToHsl(trimmed);
      if (hsl) return `hsl(${hsl})`;
    }
  }
  return fallbackProductColor(seed);
}

export function getProductColorFromMap(
  colors: Map<string, string> | undefined,
  productId?: string | null,
  productName?: string | null,
) {
  return (productId ? colors?.get(productId) : undefined)
    ?? (productName ? colors?.get(`name:${normalizeProductKey(productName)}`) : undefined);
}

/**
 * Map of product_id → primary brand colour (hex or `hsl(...)`). Used to colour
 * product-linked events with the product's own branding instead of the
 * generic event-type colour. Shared across Agenda pages and personal views.
 */
export function useProductColors() {
  return useQuery({
    queryKey: ['product-brand-colors'],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.from('products').select('id, name, branding');
      if (error) throw error;
      const map = new Map<string, string>();
      for (const p of (data ?? []) as { id: string; name: string; branding: any }[]) {
        const color = normalizeBrandColor(p?.branding?.primary_color, `${p.id}:${p.name}`);
        map.set(p.id, color);
        map.set(`name:${normalizeProductKey(p.name)}`, color);
      }
      return map;
    },
  });
}

export interface ProductBrand { id: string; name: string; color: string; }

/** List ALL active products for the agenda calendar sidebar.
 *  Products without a brand colour fall back to a neutral design-system colour. */
export function useProductBrands() {
  return useQuery({
    queryKey: ['product-brand-list'],
    staleTime: 10 * 60 * 1000,
    queryFn: async (): Promise<ProductBrand[]> => {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, branding')
        .order('name');
      if (error) throw error;
      for (const p of (data ?? []) as { id: string; name: string; branding: any }[]) {
        const color = normalizeBrandColor(p?.branding?.primary_color, `${p.id}:${p.name}`);
        items.push({ id: p.id, name: p.name, color });
      }
      return items;
    },
  });
}