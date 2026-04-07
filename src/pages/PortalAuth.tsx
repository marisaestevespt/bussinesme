import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import type { Portal } from '@/hooks/usePortalData';
import { Mail, ArrowRight } from 'lucide-react';

const sb = (table: string) => supabase.from(table as any) as any;

export default function PortalAuthPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [portal, setPortal] = useState<Portal | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [settings, setSettings] = useState<any>(null);

  useEffect(() => {
    loadPortal();
    loadSettings();
  }, [token]);

  useEffect(() => {
    if (portal) {
      const session = localStorage.getItem(`portal_session_${portal.id}`);
      if (session) {
        try {
          const parsed = JSON.parse(session);
          const elapsed = Date.now() - parsed.timestamp;
          if (elapsed < 24 * 60 * 60 * 1000) {
            navigate(`/portal/${token}/view`, { replace: true });
            return;
          }
          localStorage.removeItem(`portal_session_${portal.id}`);
        } catch {}
      }
    }
  }, [portal, token, navigate]);

  const loadSettings = async () => {
    const { data } = await supabase.from('business_settings').select('*').limit(1).maybeSingle();
    setSettings(data);
  };

  const loadPortal = async () => {
    if (!token) return;
    // Try as UUID token first, then as slug
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token);
    let portalData: any = null;
    if (isUUID) {
      const { data } = await sb('client_portals').select('*').eq('token', token).maybeSingle();
      portalData = data;
    }
    if (!portalData) {
      // Try slug
      const { data } = await sb('client_portals').select('*').eq('slug', token).eq('is_active', true).maybeSingle();
      portalData = data;
    }
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

    const { data: emailAllowed, error: emailCheckError } = await (supabase as any).rpc('portal_email_allowed', {
      _token: portal.token,
      _email: inputEmail,
    });

    if (emailCheckError) {
      toast.error('Erro ao validar email. Tenta novamente.');
      return;
    }

    if (!emailAllowed) {
      toast.error('Email não reconhecido.');
      return;
    }

    setSubmitting(true);
    const now = new Date().toISOString();
    await sb('client_portals').update({ last_visit_at: now }).eq('id', portal.id);
    await sb('portal_visits').insert({ portal_id: portal.id, email: inputEmail, visited_at: now });
    localStorage.setItem(
      `portal_session_${portal.id}`,
      JSON.stringify({
        portal_id: portal.id,
        client_id: portal.client_id,
        timestamp: Date.now(),
      }),
    );
    navigate(`/portal/${token}/view`, { replace: true });
  };

  const rawColor = settings?.primary_color || '12 76% 52%';
  const pc = `hsl(${rawColor})`;          // solid color
  const pcAlpha = (a: number) => `hsl(${rawColor} / ${a})`; // with alpha
  const logoUrl = settings?.logo_url;
  const businessName = settings?.business_name || '';
  const welcomeText = settings?.welcome_text || `Bem-vinda ao teu espaço pessoal${businessName ? ` com a ${businessName}` : ''}.`;
  const loginBgUrl = settings?.login_bg_url;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: `linear-gradient(135deg, ${pcAlpha(0.1)} 0%, ${pcAlpha(0.03)} 50%, #fef7f0 100%)` }}>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: `${pcAlpha(0.25)}`, borderTopColor: 'transparent' }} />
      </div>
    );
  }

  if (!portal) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: `linear-gradient(135deg, ${pcAlpha(0.1)} 0%, ${pcAlpha(0.03)} 50%, #fef7f0 100%)` }}>
        <div className="w-full max-w-md mx-4 bg-white rounded-2xl shadow-lg p-8 text-center">
          <p className="text-sm text-muted-foreground">Portal não encontrado.</p>
        </div>
      </div>
    );
  }

  if (!portal.is_active) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: `linear-gradient(135deg, ${pcAlpha(0.1)} 0%, ${pcAlpha(0.03)} 50%, #fef7f0 100%)` }}>
        <div className="w-full max-w-md mx-4 bg-white rounded-2xl shadow-lg p-8 text-center">
          <p className="text-sm text-muted-foreground">Este portal não está disponível de momento.</p>
        </div>
      </div>
    );
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
          <h2 className="text-3xl font-bold text-white leading-tight" style={{ fontFamily: 'var(--font-display, "Plus Jakarta Sans", sans-serif)' }}>
            O teu espaço. <br />A tua jornada.
          </h2>
          <p className="text-white/80 text-sm leading-relaxed">
            Acompanha tudo o que está a acontecer, consulta materiais e mantém-te sempre a par.
          </p>
        </div>
      </div>

      {/* Right login panel */}
      <div
        className="flex-1 flex items-center justify-center p-6 sm:p-12"
        style={{ background: `linear-gradient(180deg, #fefcfa 0%, ${pcAlpha(0.05)} 100%)` }}
      >
        <div className="w-full max-w-sm space-y-8">
          {/* Mobile logo */}
          <div className="lg:hidden text-center">
            {logoUrl && <img src={logoUrl} alt="Logo" className="h-10 mx-auto object-contain mb-4" />}
          </div>

          <div className="space-y-2 text-center lg:text-left">
            <h1
              className="text-2xl font-bold tracking-tight"
              style={{ color: pc, fontFamily: 'var(--font-display, "Plus Jakarta Sans", sans-serif)' }}
            >
              Olá! 👋
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
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                className="pl-10 h-12 rounded-xl border-border/60 bg-white shadow-sm focus-visible:ring-2 focus-visible:ring-offset-0"
                style={{ '--tw-ring-color': `${pcAlpha(0.25)}` } as any}
              />
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

          <p className="text-center text-[11px] text-muted-foreground/60">
            Acesso exclusivo para clientes{businessName ? ` da ${businessName}` : ''}.
          </p>
        </div>
      </div>
    </div>
  );
}
