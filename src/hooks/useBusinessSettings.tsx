import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SYSTEM_FONT_DISPLAY, SYSTEM_FONT_BODY } from '@/lib/modules';
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
  // If using system theme, only apply fonts — CSS tokens handle colors
  const useSystem = (settings as any).use_system_theme ?? true;
  const root = document.documentElement;

  if (!useSystem) {
    root.style.setProperty('--primary', settings.primary_color);
    root.style.setProperty('--primary-foreground', contrastForeground(settings.primary_color));
    root.style.setProperty('--brand-primary', settings.primary_color);
    root.style.setProperty('--secondary', settings.secondary_color);
    root.style.setProperty('--secondary-foreground', contrastForeground(settings.secondary_color));
    root.style.setProperty('--brand-secondary', settings.secondary_color);
    root.style.setProperty('--background', settings.background_color);
    root.style.setProperty('--foreground', settings.text_color);
    root.style.setProperty('--card-foreground', settings.text_color);
    root.style.setProperty('--popover-foreground', settings.text_color);
    const accentColor = settings.accent_color || settings.secondary_color;
    root.style.setProperty('--accent', accentColor);
    root.style.setProperty('--accent-foreground', contrastForeground(accentColor));
    root.style.setProperty('--sidebar-primary', settings.primary_color);
    root.style.setProperty('--sidebar-primary-foreground', contrastForeground(settings.primary_color));
  }

  if (useSystem) {
    root.style.setProperty('--font-display', `'${SYSTEM_FONT_DISPLAY}'`);
    root.style.setProperty('--font-body', `'${SYSTEM_FONT_BODY}'`);
  } else {
    root.style.setProperty('--font-display', `'${settings.font_display}'`);
    root.style.setProperty('--font-body', `'${settings.font_body}'`);
  }
}

export function BusinessSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<BusinessSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    const { data } = await supabase
      .from('business_settings')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (data) {
      setSettings(data);
      applyTheme(data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Re-fetch on auth state change (settings are gated by RLS to authenticated users)
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
        fetchSettings();
      }
      if (event === 'SIGNED_OUT') {
        setSettings(null);
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
