import { supabase } from '@/integrations/supabase/client';

// In-memory cache: product name -> product id.
// Cleared automatically every 5 minutes to stay fresh after renames.
const cache = new Map<string, string | null>();
let lastClear = Date.now();
const TTL_MS = 5 * 60 * 1000;

function maybeClear() {
  if (Date.now() - lastClear > TTL_MS) {
    cache.clear();
    lastClear = Date.now();
  }
}

/**
 * Resolve a product UUID from its current name.
 * Returns null if the name is empty or no product matches.
 * Uses a short-lived in-memory cache for performance.
 *
 * Use whenever inserting/updating a row that has a `product_id` FK
 * so the relational link is the source of truth (the DB triggers
 * keep `product_name` text columns in sync automatically).
 */
export async function resolveProductId(name?: string | null): Promise<string | null> {
  if (!name || !name.trim()) return null;
  maybeClear();
  const key = name.trim();
  if (cache.has(key)) return cache.get(key) ?? null;

  const { data } = await supabase
    .from('products')
    .select('id')
    .eq('name', key)
    .maybeSingle();

  const id = data?.id ?? null;
  cache.set(key, id);
  return id;
}

/** Force-clear the resolver cache (e.g. after creating/renaming a product). */
export function clearProductResolverCache() {
  cache.clear();
  lastClear = Date.now();
}