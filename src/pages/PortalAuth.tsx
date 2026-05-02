import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Mail, ArrowRight, ShieldCheck, AlertCircle } from 'lucide-react';
import { usePortalBranding } from '@/hooks/usePortalBranding';
import { resolvePublicPortal, type PublicPortal } from '@/lib/portalAccess';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { BUSINESS_BRAND_FALLBACK_HSL, portalCssColorAlpha } from '@/lib/portalBranding';

const sb = (table: string) => supabase.from(table as any) as any;

export default function PortalAuthPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [portal, setPortal] = useState<PublicPortal | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const { branding, loading: brandingLoading } = usePortalBranding(token);
  const settings = branding;

  useDocumentTitle(`${settings?.business_name || 'Portal'} · Acesso ao Portal`);

  // Portal is always rendered in light mode. Without this, devices in dark
  // mode would inherit the dark `--primary` (coral) and the brand color would
  // briefly flash orange before branding loads.
  useEffect(() => {
    const root = document.documentElement;
    const hadDark = root.classList.contains('dark');
    root.classList.remove('dark');
    return () => {
      if (hadDark) root.classList.add('dark');
    };
  }, []);

  useEffect(() => {
    loadPortal();
  }, [token]);

  useEffect(() => {
    if (portal) {
      const session = localStorage.getItem(`portal_session_${portal.id}`);
      if (session) {
        try {
          const parsed = JSON.parse(session);
          const elapsed = Date.now() - parsed.timestamp;
          if (elapsed < 24 * 60 * 60 * 1000) {
            // Log the returning visit (server-side via RPC, contorna RLS)
            const email = parsed.email || '';
            (supabase as any).rpc('portal_record_visit', { _token: portal.token, _email: email || null }).then(() => {});
            navigate(`/portal/${token}/view`, { replace: true });
            return;
          }
          localStorage.removeItem(`portal_session_${portal.id}`);
        } catch {}
      }
    }
  }, [portal, token, navigate]);

  const loadPortal = async () => {
    if (!token) return;
    const portalData = await resolvePublicPortal(token, (fn, args) => (supabase as any).rpc(fn, args));
    if (!portalData) {
      setLoading(false);
      return;
    }
    setPortal(portalData);
    setLoading(false);
  };

  const handleSubmit = async () => {
    if (!email.trim() || !token || !portal) return;
    const inputEmail = email.trim().toLowerCase();
    setEmailError(null);

    const { data: emailAllowed, error: emailCheckError } = await (supabase as any).rpc('portal_email_allowed', {
      _token: portal.token,
      _email: inputEmail,
    });

    if (emailCheckError) {
      setEmailError('Não foi possível validar agora. Tenta novamente.');
      return;
    }

    if (!emailAllowed) {
      setEmailError('Este email não tem acesso a este portal.');
      return;
    }

    setSubmitting(true);
    await (supabase as any).rpc('portal_record_visit', { _token: portal.token, _email: inputEmail });
    localStorage.setItem(
      `portal_session_${portal.id}`,
      JSON.stringify({
        portal_id: portal.id,
        client_id: portal.client_id,
        email: inputEmail,
        timestamp: Date.now(),
      }),
    );
    navigate(`/portal/${token}/view`, { replace: true });
  };

  // Never read `--primary` from the DOM here: the main app can temporarily run
  // in dark mode, where `--primary` is coral. Portal branding must come only
  // from get_portal_branding, with the business bordeaux as the sole fallback.
  const rawColor = settings?.primary_color || BUSINESS_BRAND_FALLBACK_HSL;
  const pc = `hsl(${rawColor})`;          // solid color
  const pcAlpha = (a: number) => portalCssColorAlpha(rawColor, a); // with alpha
  const logoUrl = settings?.logo_url;
  const businessName = settings?.business_name || '';
  const firstName = settings?.client_first_name || '';
  const productName = settings?.product_name || '';
  const welcomeText = settings?.welcome_text
    || (productName
      ? `Acesso ao acompanhamento ${productName}${businessName ? ` · ${businessName}` : ''}.`
      : `O teu espaço de acompanhamento${businessName ? ` com a ${businessName}` : ''}.`);
  const loginBgUrl = settings?.hero_image_url;
  const heroTitle = settings?.hero_title
    || (firstName ? `Olá, ${firstName}.` : 'Bem-vindo.');
  const heroSubtitle = settings?.hero_subtitle
    || (productName ? productName : 'O teu espaço de acompanhamento.');
  const loginTitle = settings?.login_title
    || (firstName ? `Olá, ${firstName}` : 'Aceder ao portal');
  const loginSubtitle = settings?.login_subtitle;
  const fontDisplay = settings?.font_display ? `"${settings.font_display}", sans-serif` : 'var(--font-display, "Plus Jakarta Sans", sans-serif)';

  const ErrorShell = ({ title, message }: { title: string; message: string }) => (
    <div className="flex min-h-screen items-center justify-center p-6" style={{ background: `linear-gradient(135deg, ${pcAlpha(0.08)} 0%, ${pcAlpha(0.02)} 50%, #fafafa 100%)` }}>
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8 text-center space-y-4">
        {logoUrl ? (
          <img src={logoUrl} alt={businessName || 'Logo'} className="h-10 mx-auto object-contain" />
        ) : (
          <div className="h-10 w-10 mx-auto rounded-full flex items-center justify-center" style={{ backgroundColor: pcAlpha(0.12) }}>
            <AlertCircle className="h-5 w-5" style={{ color: pc }} />
          </div>
        )}
        <div className="space-y-1">
          <h1 className="text-lg font-semibold" style={{ fontFamily: fontDisplay, color: pc }}>{title}</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">{message}</p>
        </div>
        {businessName && (
          <p className="text-[11px] text-muted-foreground/60 pt-2 border-t">
            Em caso de dúvida, contacta a equipa {businessName}.
          </p>
        )}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: '#fafafa' }}>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: `${pcAlpha(0.25)}`, borderTopColor: 'transparent' }} />
      </div>
    );
  }

  if (!portal) {
    return <ErrorShell title="Portal não encontrado" message="Verifica o link que recebeste. Se o problema persistir, fala com a tua equipa de gestão." />;
  }

  if (!portal.is_active) {
    return <ErrorShell title="Portal indisponível" message="Este portal está temporariamente fechado. Vai estar disponível novamente em breve." />;
  }

  return (
    <div className="flex min-h-screen">
      {/* Left decorative panel — hidden on mobile */}
      <div
        className="hidden lg:flex lg:w-1/2 relative items-end p-12"
        style={{
          background: loginBgUrl
            ? `url(${loginBgUrl}) center/cover no-repeat`
            : `linear-gradient(160deg, ${pc} 0%, ${pcAlpha(0.8)} 40%, ${pcAlpha(0.6)} 100%)`,
        }}
      >
        {loginBgUrl && (
          <div className="absolute inset-0" style={{ background: `linear-gradient(to top, ${pc} 0%, ${pcAlpha(0.75)} 40%, ${pcAlpha(0.45)} 100%)` }} />
        )}
        <div className="relative z-10 space-y-4 max-w-md">
          {logoUrl && <img src={logoUrl} alt="Logo" className="h-10 object-contain brightness-0 invert" />}
          <h2 className="text-2xl sm:text-3xl font-bold text-white leading-tight" style={{ fontFamily: fontDisplay }}>
            {heroTitle} <br />{heroSubtitle}
          </h2>
          {loginSubtitle && (
            <p className="text-white/80 text-sm leading-relaxed">{loginSubtitle}</p>
          )}
        </div>
      </div>

      {/* Right login panel */}
      <div
        className="flex-1 flex items-center justify-center p-6 sm:p-12"
        style={{ background: `linear-gradient(180deg, #ffffff 0%, ${pcAlpha(0.04)} 100%)` }}
      >
        <div className="w-full max-w-sm space-y-8">
          {/* Mobile logo */}
          <div className="lg:hidden text-center">
            {logoUrl && <img src={logoUrl} alt="Logo" className="h-10 mx-auto object-contain mb-4" />}
          </div>

          <div className="space-y-2 text-center lg:text-left">
            <h1
              className="text-2xl font-bold tracking-tight"
              style={{ color: pc, fontFamily: fontDisplay }}
            >
              {loginTitle}
            </h1>
            <p className="text-muted-foreground text-sm leading-relaxed">{welcomeText}</p>
          </div>

          <div className="space-y-4">
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="email"
                placeholder="O teu email"
                value={email}
                onChange={e => { setEmail(e.target.value); if (emailError) setEmailError(null); }}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                className={`pl-10 h-12 rounded-xl bg-white shadow-sm focus-visible:ring-2 focus-visible:ring-offset-0 ${emailError ? 'border-destructive/60' : 'border-border/60'}`}
                style={{ '--tw-ring-color': `${pcAlpha(0.25)}` } as any}
              />
              {emailError && (
                <p className="mt-2 text-xs text-destructive flex items-center gap-1.5">
                  <AlertCircle className="h-3 w-3 shrink-0" />
                  {emailError}
                </p>
              )}
            </div>
            <Button
              className="w-full h-12 rounded-xl text-sm font-semibold shadow-md transition-all hover:shadow-lg active:scale-[0.98] text-white"
              style={{ backgroundColor: pc }}
              disabled={submitting || !email.trim()}
              onClick={handleSubmit}
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  A aceder...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  Aceder ao meu espaço
                  <ArrowRight className="h-4 w-4" />
                </span>
              )}
            </Button>
          </div>

          <div className="space-y-2 pt-2">
            <p className="text-center text-[11px] text-muted-foreground/60">
              Acesso exclusivo para clientes{businessName ? ` da ${businessName}` : ''}.
            </p>
            <p className="text-center text-[10px] text-muted-foreground/50 flex items-center justify-center gap-1">
              <ShieldCheck className="h-3 w-3" />
              Acesso seguro · Lyrata
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
