import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SYSTEM_FONT_DISPLAY, SYSTEM_FONT_BODY, SYSTEM_FONT_MONO } from '@/lib/modules';
import { BUSINESS_ACCENT_FALLBACK_HSL, BUSINESS_BRAND_FALLBACK_HSL, BUSINESS_TEXT_FALLBACK_HSL, normalizeHslTriplet } from '@/lib/portalBranding';
import type { Tables } from '@/integrations/supabase/types';

type BusinessSettings = Tables<'business_settings'>;

interface BusinessSettingsContextType {
  settings: BusinessSettings | null;
  loading: boolean;
  isSetupComplete: boolean;
  refetch: () => Promise<void>;
}

const BusinessSettingsContext = createContext<BusinessSettingsContextType | undefined>(undefined);

/** Parse "H S% L%" HSL string to relative luminance (0–1) */
function hslLuminance(hsl: string): number {
  const parts = hsl.split(' ').map(p => parseFloat(p));
  if (parts.length < 3) return 0;
  const h = parts[0], s = parts[1] / 100, l = parts[2] / 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
  };
  const lin = (c: number) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return 0.2126 * lin(f(0)) + 0.7152 * lin(f(8)) + 0.0722 * lin(f(4));
}

/** Returns a contrasting foreground HSL for the given background HSL */
function contrastForeground(bgHsl: string): string {
  return hslLuminance(bgHsl) > 0.4 ? '222 47% 11%' : '210 40% 98%';
}

function applyTheme(settings: BusinessSettings) {
  // Business settings are the source of truth for brand colors. Apply them even
  // when the system typography/theme switch is enabled so `.dark` can never
  // fall back to the coral default on public/client-facing routes.
  const useSystem = settings.use_system_theme ?? true;
  const root = document.documentElement;
  const primary = normalizeHslTriplet(settings.primary_color, BUSINESS_BRAND_FALLBACK_HSL);
  const secondary = normalizeHslTriplet(settings.secondary_color, '43 36% 86%');
  const background = normalizeHslTriplet(settings.background_color, '33 43% 96%');
  const text = normalizeHslTriplet(settings.text_color, BUSINESS_TEXT_FALLBACK_HSL);
  const accentColor = normalizeHslTriplet(settings.accent_color || settings.secondary_color, BUSINESS_ACCENT_FALLBACK_HSL);

  root.style.setProperty('--primary', primary);
  root.style.setProperty('--primary-foreground', contrastForeground(primary));
  root.style.setProperty('--brand-primary', primary);
  root.style.setProperty('--secondary', secondary);
  root.style.setProperty('--secondary-foreground', contrastForeground(secondary));
  root.style.setProperty('--brand-secondary', secondary);
  root.style.setProperty('--background', background);
  root.style.setProperty('--foreground', text);
  root.style.setProperty('--card-foreground', text);
  root.style.setProperty('--popover-foreground', text);
  root.style.setProperty('--accent', accentColor);
  root.style.setProperty('--accent-foreground', contrastForeground(accentColor));
  root.style.setProperty('--ring', primary);
  root.style.setProperty('--sidebar-primary', primary);
  root.style.setProperty('--sidebar-primary-foreground', contrastForeground(primary));
  root.style.setProperty('--gradient-accent', primary);

  if (useSystem) {
    root.style.setProperty('--font-display', `'${SYSTEM_FONT_DISPLAY}'`);
    root.style.setProperty('--font-body', `'${SYSTEM_FONT_BODY}'`);
    root.style.setProperty('--font-mono', `'${SYSTEM_FONT_MONO}'`);
  } else {
    root.style.setProperty('--font-display', `'${settings.font_display}'`);
    root.style.setProperty('--font-body', `'${settings.font_body}'`);
    root.style.setProperty('--font-mono', `'${(settings as any).font_mono || SYSTEM_FONT_MONO}'`);
  }
}

export function BusinessSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<BusinessSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const loadedForUserRef = useRef<string | null>(null);
  const settingsRef = useRef<BusinessSettings | null>(null);

  const fetchSettings = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    const { data } = await supabase
      .from('business_settings')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (data) {
      settingsRef.current = data;
      setSettings(data);
      applyTheme(data);
    } else {
      settingsRef.current = null;
      setSettings(null);
    }
    setLoading(false);
  }, []);

  // Single source of truth: fetch on initial session or genuinely new sign-in.
  // Supabase can emit SIGNED_IN again when a browser tab regains focus; do not
  // show the global loader then, otherwise the whole app remounts and loses scroll.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const userId = session?.user?.id ?? null;

      if (event === 'INITIAL_SESSION') {
        loadedForUserRef.current = userId;
        fetchSettings(true);
      }

      if (event === 'SIGNED_IN') {
        const isNewUser = !!userId && userId !== loadedForUserRef.current;
        loadedForUserRef.current = userId;

        if (isNewUser || !settingsRef.current) {
          fetchSettings(isNewUser);
        }
      }

      if (event === 'SIGNED_OUT') {
        loadedForUserRef.current = null;
        settingsRef.current = null;
        setSettings(null);
        setLoading(false);
      }
    });
    return () => subscription.unsubscribe();
  }, [fetchSettings]);

  return (
    <BusinessSettingsContext.Provider
      value={{
        settings,
        loading,
        isSetupComplete: !!settings,
        refetch: fetchSettings,
      }}
    >
      {children}
    </BusinessSettingsContext.Provider>
  );
}

export function useBusinessSettings() {
  const context = useContext(BusinessSettingsContext);
  if (!context) throw new Error('useBusinessSettings must be used within BusinessSettingsProvider');
  return context;
}
