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

  const heroDisplayName = firstName ? `Olá, ${firstName}.` : (heroTitle || 'Bem-vindo.');
  const heroQuote = settings?.hero_subtitle || welcomeText;

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 sm:p-8"
      style={{ background: '#FBF8F3' }}
    >
      <div
        className="max-w-5xl w-full grid grid-cols-12 bg-white overflow-hidden"
        style={{
          borderRadius: 4,
          border: `1px solid ${pcAlpha(0.1)}`,
          boxShadow: `0 10px 50px -12px ${pcAlpha(0.08)}`,
        }}
      >
        {/* Editorial section */}
        <div
          className="col-span-12 md:col-span-7 p-8 md:p-16 flex flex-col justify-between border-b md:border-b-0 md:border-r relative overflow-hidden"
          style={{ borderColor: pcAlpha(0.1), minHeight: 'min(620px, 90vh)' }}
        >
          {loginBgUrl && (
            <>
              <div
                className="absolute inset-0"
                style={{ background: `url(${loginBgUrl}) center/cover no-repeat`, opacity: 0.18 }}
              />
              <div
                className="absolute inset-0"
                style={{ background: `linear-gradient(to bottom, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0.85) 100%)` }}
              />
            </>
          )}
          <div className="relative z-10 space-y-10 md:space-y-14">
            <div className="flex items-center gap-4">
              {logoUrl ? (
                <img src={logoUrl} alt={businessName || 'Logo'} className="h-7 object-contain" />
              ) : (
                <div className="h-[1px] w-8" style={{ background: pcAlpha(0.3) }} />
              )}
              <span className="text-[10px] tracking-[0.3em] uppercase font-semibold" style={{ color: pcAlpha(0.6) }}>
                Portal de Acesso
              </span>
            </div>

            <div className="max-w-md">
              <h1
                className="text-5xl sm:text-6xl md:text-7xl leading-[0.9] tracking-tight mb-8"
                style={{ color: pc, fontFamily: fontDisplay }}
              >
                {heroDisplayName}
              </h1>
              {heroSubtitle && heroSubtitle !== heroDisplayName && (
                <p
                  className="text-lg md:text-xl leading-snug mb-6"
                  style={{ color: pcAlpha(0.85), fontFamily: fontDisplay }}
                >
                  {heroSubtitle}
                </p>
              )}
              {heroQuote && (
                <p className="text-sm sm:text-base leading-relaxed italic font-light" style={{ color: pcAlpha(0.75) }}>
                  <span
                    className="float-left text-5xl leading-[0.8] mr-2 mt-1 not-italic font-normal"
                    style={{ color: pc, fontFamily: fontDisplay }}
                  >
                    {(heroQuote.trim()[0] || 'A').toUpperCase()}
                  </span>
                  {heroQuote.trim().slice(1)}
                </p>
              )}
            </div>

            <div className="flex gap-2 flex-wrap">
              <span className="px-3 py-1 rounded-full text-[10px] uppercase tracking-wider" style={{ border: `1px solid ${pcAlpha(0.2)}`, color: pcAlpha(0.7) }}>
                Exclusivo
              </span>
              <span className="px-3 py-1 rounded-full text-[10px] uppercase tracking-wider" style={{ border: `1px solid ${pcAlpha(0.2)}`, color: pcAlpha(0.7) }}>
                Seguro
              </span>
              {productName && (
                <span className="px-3 py-1 rounded-full text-[10px] uppercase tracking-wider" style={{ border: `1px solid ${pcAlpha(0.2)}`, color: pcAlpha(0.7) }}>
                  {productName}
                </span>
              )}
            </div>
          </div>

          <div className="relative z-10 mt-12 flex items-baseline gap-4">
            <span className="text-[10px] font-medium uppercase tracking-[0.2em]" style={{ color: pcAlpha(0.4) }}>
              {businessName || 'Portal'}
            </span>
            <div className="h-[1px] flex-grow" style={{ background: pcAlpha(0.08) }} />
            <span className="text-[10px] font-medium uppercase tracking-[0.2em]" style={{ color: pcAlpha(0.4) }}>
              © {new Date().getFullYear()}
            </span>
          </div>
        </div>

        {/* Auth form section */}
        <div
          className="col-span-12 md:col-span-5 p-8 md:p-12 flex flex-col justify-center"
          style={{ background: `linear-gradient(180deg, #FBF8F3 0%, ${pcAlpha(0.04)} 100%)` }}
        >
          <div className="max-w-xs mx-auto w-full space-y-10">
            <div className="space-y-2">
              <h2 className="text-2xl sm:text-3xl font-medium" style={{ color: pc, fontFamily: fontDisplay }}>
                {loginTitle}
              </h2>
              <p className="text-xs leading-relaxed" style={{ color: pcAlpha(0.6) }}>
                {loginSubtitle || 'Insere o teu email para aceder ao teu espaço.'}
              </p>
            </div>

            <div className="space-y-6">
              <div>
                <label className="text-[10px] uppercase tracking-[0.2em] font-semibold block mb-2" style={{ color: pcAlpha(0.5) }}>
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: pcAlpha(0.4) }} />
                  <input
                    type="email"
                    placeholder="nome@empresa.com"
                    value={email}
                    onChange={e => { setEmail(e.target.value); if (emailError) setEmailError(null); }}
                    onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                    className="w-full h-12 pl-7 bg-transparent border-0 border-b text-base focus:outline-none transition-all placeholder:text-[#6D2E46]/30"
                    style={{
                      borderBottomColor: emailError ? 'hsl(var(--destructive))' : pcAlpha(0.2),
                      color: pc,
                      fontFamily: fontDisplay,
                    }}
                    onFocus={e => { e.currentTarget.style.borderBottomColor = pc; }}
                    onBlur={e => { e.currentTarget.style.borderBottomColor = emailError ? 'hsl(var(--destructive))' : pcAlpha(0.2); }}
                  />
                </div>
                {emailError && (
                  <p className="mt-2 text-xs text-destructive flex items-center gap-1.5">
                    <AlertCircle className="h-3 w-3 shrink-0" />
                    {emailError}
                  </p>
                )}
              </div>

              <div className="space-y-4">
                <button
                  className="w-full py-4 text-[11px] font-semibold tracking-[0.25em] uppercase transition-all disabled:opacity-50 flex items-center justify-center gap-2 group"
                  style={{ backgroundColor: pc, color: '#FBF8F3', boxShadow: `0 8px 20px -8px ${pcAlpha(0.4)}` }}
                  disabled={submitting || !email.trim()}
                  onClick={handleSubmit}
                >
                  {submitting ? (
                    <>
                      <span className="h-3 w-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      A aceder
                    </>
                  ) : (
                    <>
                      Entrar no Portal
                      <ArrowRight className="h-3 w-3 transform group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="pt-8 border-t space-y-3" style={{ borderColor: pcAlpha(0.05) }}>
              <p className="text-[9px] leading-normal uppercase tracking-widest" style={{ color: pcAlpha(0.4) }}>
                Acesso exclusivo para clientes{businessName ? ` da ${businessName}` : ''}.
              </p>
              <p className="text-[9px] uppercase tracking-widest flex items-center gap-1" style={{ color: pcAlpha(0.35) }}>
                <ShieldCheck className="h-3 w-3" />
                Acesso seguro · Lyrata
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
