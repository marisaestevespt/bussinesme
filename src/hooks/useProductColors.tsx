import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

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
      const { data, error } = await supabase.from('products').select('id, branding');
      if (error) throw error;
      const map = new Map<string, string>();
      for (const p of (data ?? []) as { id: string; branding: any }[]) {
        const raw = p?.branding?.primary_color;
        if (!raw || typeof raw !== 'string') continue;
        const trimmed = raw.trim();
        if (!trimmed) continue;
        const isHslTriplet = /^\d+\s+\d+%\s+\d+%$/.test(trimmed);
        map.set(p.id, isHslTriplet ? `hsl(${trimmed})` : trimmed);
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
      const items: ProductBrand[] = [];
      const FALLBACK = 'hsl(var(--muted-foreground))';
      for (const p of (data ?? []) as { id: string; name: string; branding: any }[]) {
        const raw = p?.branding?.primary_color;
        let color = FALLBACK;
        if (raw && typeof raw === 'string') {
          const trimmed = raw.trim();
          if (trimmed) {
            const isHslTriplet = /^\d+\s+\d+%\s+\d+%$/.test(trimmed);
            color = isHslTriplet ? `hsl(${trimmed})` : trimmed;
          }
        }
        items.push({ id: p.id, name: p.name, color });
      }
      return items;
    },
  });
}