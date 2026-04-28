import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

import type { Json } from '@/integrations/supabase/types';

type ProductColorRow = { id: string; name: string; branding: Json | null; calendar_color: string | null };

function readPrimaryColor(branding: Json | null): unknown {
  if (branding && typeof branding === 'object' && !Array.isArray(branding)) {
    return (branding as Record<string, Json>).primary_color;
  }
  return undefined;
}

const PRODUCT_FALLBACK_PALETTE = [
  'hsl(173 58% 34%)',
  'hsl(217 60% 45%)',
  'hsl(334 55% 46%)',
  'hsl(42 76% 40%)',
  'hsl(145 45% 36%)',
  'hsl(28 76% 42%)',
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
      const { data, error } = await supabase.from('products').select('id, name, branding, calendar_color');
      if (error) throw error;
      const map = new Map<string, string>();
      for (const p of (data ?? []) as ProductColorRow[]) {
        // Prioridade: calendar_color (dedicada) → branding.primary_color → fallback determinístico
        const raw = p.calendar_color ?? readPrimaryColor(p.branding);
        const color = normalizeBrandColor(raw, `${p.id}:${p.name}`);
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
        .select('id, name, branding, calendar_color')
        .order('name');
      if (error) throw error;
      const items: ProductBrand[] = [];
      for (const p of (data ?? []) as ProductColorRow[]) {
        const raw = p.calendar_color ?? readPrimaryColor(p.branding);
        const color = normalizeBrandColor(raw, `${p.id}:${p.name}`);
        items.push({ id: p.id, name: p.name, color });
      }
      return items;
    },
  });
}

/** Maps client.id → current product (id and name).
 *  Used to recover the product/brand colour for events that only carry the
 *  client (e.g. meetings created without picking a product). Without this
 *  map, any meeting with a client but no `product_id` would lose the
 *  product-specific colour and fall back to a generic palette. */
export interface ClientProduct { product_id: string | null; product_name: string | null; }
export function useClientProductMap() {
  return useQuery({
    queryKey: ['client-product-map'],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, full_name, current_product_id, current_product');
      if (error) throw error;
      const byId = new Map<string, ClientProduct>();
      const byName = new Map<string, ClientProduct>();
      for (const c of (data ?? []) as { id: string; full_name: string | null; current_product_id: string | null; current_product: string | null }[]) {
        const entry: ClientProduct = { product_id: c.current_product_id, product_name: c.current_product };
        byId.set(c.id, entry);
        if (c.full_name) byName.set(c.full_name.trim().toLocaleLowerCase('pt-PT'), entry);
      }
      return { byId, byName };
    },
  });
}