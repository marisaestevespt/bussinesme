import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getPaletteColor } from '@/lib/departmentColorPalette';
import { DEPARTMENT_COLOR_PALETTE } from '@/lib/departmentColorPalette';

// Deterministic auto-color fallback: hash the key into the palette
// (skipping 'gray' so default values still look distinct).
const AUTO_PALETTE = DEPARTMENT_COLOR_PALETTE.filter(c => c.key !== 'gray');
function autoColorKey(deptValue: string): string {
  let h = 0;
  for (let i = 0; i < deptValue.length; i++) {
    h = (h * 31 + deptValue.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(h) % AUTO_PALETTE.length;
  return AUTO_PALETTE[idx].key;
}

type ColorMap = Record<string, string>; // department_value -> color_key

let cache: ColorMap | null = null;
const listeners = new Set<(m: ColorMap) => void>();

async function fetchAll(): Promise<ColorMap> {
  const { data, error } = await supabase
    .from('department_colors')
    .select('department_value, color_key');
  if (error) {
    console.error('[useDepartmentColors] fetch failed', error);
    return {};
  }
  const map: ColorMap = {};
  (data || []).forEach((r) => { map[r.department_value] = r.color_key; });
  return map;
}

function notify(m: ColorMap) {
  cache = m;
  listeners.forEach(l => l(m));
}

export function useDepartmentColors() {
  const [colors, setColors] = useState<ColorMap>(cache || {});
  const [loading, setLoading] = useState(!cache);

  useEffect(() => {
    listeners.add(setColors);
    if (!cache) {
      fetchAll().then(m => { notify(m); setLoading(false); });
    } else {
      setLoading(false);
    }
    return () => { listeners.delete(setColors); };
  }, []);

  const getBadgeClass = useCallback((deptValue: string, fallback?: string) => {
    const key = colors[deptValue];
    if (!key) return fallback || getPaletteColor(autoColorKey(deptValue)).badgeClass;
    return getPaletteColor(key).badgeClass;
  }, [colors]);

  const getColorKey = useCallback((deptValue: string) => colors[deptValue] || autoColorKey(deptValue), [colors]);

  const setColor = useCallback(async (deptValue: string, colorKey: string) => {
    // Optimistic update
    const next = { ...(cache || {}), [deptValue]: colorKey };
    notify(next);
    const { error } = await supabase
      .from('department_colors')
      .upsert({ department_value: deptValue, color_key: colorKey }, { onConflict: 'department_value' });
    if (error) {
      console.error('[useDepartmentColors] update failed', error);
      // Re-fetch to revert
      const fresh = await fetchAll();
      notify(fresh);
    }
  }, []);

  return { colors, loading, getBadgeClass, getColorKey, setColor };
}