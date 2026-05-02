import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { resolvePublicPortal } from '@/lib/portalAccess';

type RpcFn = (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;

export interface PortalBranding {
  business_name?: string | null;
  primary_color?: string | null;   // HSL like "351 56% 28%"
  accent_color?: string | null;
  text_color?: string | null;
  font_display?: string | null;
  font_body?: string | null;
  logo_url?: string | null;
  welcome_text?: string | null;
  login_title?: string | null;
  login_subtitle?: string | null;
  hero_image_url?: string | null;
  hero_title?: string | null;
  hero_subtitle?: string | null;
  client_first_name?: string | null;
  client_name?: string | null;
  product_name?: string | null;
}

export function usePortalBranding(token: string | undefined | null) {
  const [branding, setBranding] = useState<PortalBranding | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!token) { setLoading(false); return; }
    (async () => {
      const rpc = (supabase.rpc as unknown) as RpcFn;
      try {
        const portal = await resolvePublicPortal(token, (fn, args) => rpc(fn, args));
        const realToken = portal?.token ?? token;
        const { data } = await rpc('get_portal_branding', { _token: realToken });
        if (!cancelled) {
          setBranding((data || {}) as PortalBranding);
          setLoading(false);
        }
      } catch (e) {
        // swallow — fallbacks handled in component
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  // Inject font CSS variables on the document so any Tailwind class using
  // var(--font-display) / var(--font-body) picks them up automatically.
  useEffect(() => {
    if (!branding) return;
    const root = document.documentElement;
    if (branding.font_display) root.style.setProperty('--font-display', `"${branding.font_display}", sans-serif`);
    if (branding.font_body) root.style.setProperty('--font-body', `"${branding.font_body}", sans-serif`);
    return () => {
      root.style.removeProperty('--font-display');
      root.style.removeProperty('--font-body');
    };
  }, [branding?.font_display, branding?.font_body]);

  return { branding, loading };
}
