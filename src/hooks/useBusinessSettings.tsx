import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';

type BusinessSettings = Tables<'business_settings'>;

interface BusinessSettingsContextType {
  settings: BusinessSettings | null;
  loading: boolean;
  isSetupComplete: boolean;
  refetch: () => Promise<void>;
}

const BusinessSettingsContext = createContext<BusinessSettingsContextType | undefined>(undefined);

function applyTheme(settings: BusinessSettings) {
  const root = document.documentElement;
  root.style.setProperty('--primary', settings.primary_color);
  root.style.setProperty('--brand-primary', settings.primary_color);
  root.style.setProperty('--secondary', settings.secondary_color);
  root.style.setProperty('--brand-secondary', settings.secondary_color);
  root.style.setProperty('--background', settings.background_color);
  root.style.setProperty('--foreground', settings.text_color);
  root.style.setProperty('--card-foreground', settings.text_color);
  root.style.setProperty('--popover-foreground', settings.text_color);
  root.style.setProperty('--accent', (settings as any).accent_color || settings.secondary_color);
  root.style.setProperty('--font-display', `'${settings.font_display}'`);
  root.style.setProperty('--font-body', `'${settings.font_body}'`);
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
