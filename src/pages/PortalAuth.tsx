import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import type { Portal } from '@/hooks/usePortalData';

const sb = (table: string) => supabase.from(table as any) as any;

export default function PortalAuthPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [portal, setPortal] = useState<Portal | null>(null);
  const [client, setClient] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [code, setCode] = useState('');
  const [sending, setSending] = useState(false);
  const [settings, setSettings] = useState<any>(null);

  useEffect(() => {
    loadPortal();
    loadSettings();
  }, [token]);

  // Check existing session
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
    const { data: portalData } = await sb('client_portals').select('*').eq('token', token).maybeSingle();
    if (!portalData) { setLoading(false); return; }
    setPortal(portalData);

    const { data: clientData } = await sb('clients').select('*').eq('id', portalData.client_id).maybeSingle();
    setClient(clientData);
    setLoading(false);
  };

  const handleEmailSubmit = async () => {
    if (!email.trim()) return;
    if (!client || client.email?.toLowerCase() !== email.trim().toLowerCase()) {
      toast.error('Email não reconhecido.');
      return;
    }

    setSending(true);
    // Generate OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    await sb('portal_otp').insert({
      client_id: client.id,
      email: email.trim().toLowerCase(),
      code: otpCode,
      expires_at: expiresAt,
    });

    // For now, since Twilio isn't configured, show a toast with the code for testing
    // In production, this would send an SMS via edge function
    toast.success(`Código de acesso enviado! (Teste: ${otpCode})`, { duration: 15000 });

    setStep('code');
    setSending(false);
  };

  const handleCodeSubmit = async () => {
    if (!code.trim() || code.length !== 6) { toast.error('Introduz o código de 6 dígitos'); return; }

    const { data: otpRecord } = await sb('portal_otp')
      .select('*')
      .eq('client_id', client.id)
      .eq('code', code.trim())
      .eq('used', false)
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!otpRecord) {
      toast.error('Código inválido ou expirado.');
      return;
    }

    // Mark as used
    await sb('portal_otp').update({ used: true }).eq('id', otpRecord.id);

    // Update last visit
    await sb('client_portals').update({ last_visit_at: new Date().toISOString() }).eq('id', portal!.id);

    // Create session
    localStorage.setItem(`portal_session_${portal!.id}`, JSON.stringify({
      portal_id: portal!.id,
      client_id: client.id,
      timestamp: Date.now(),
    }));

    navigate(`/portal/${token}/view`, { replace: true });
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!portal) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">Portal não encontrado.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!portal.is_active) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">Este portal não está disponível.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const primaryColor = settings?.primary_color || 'hsl(var(--primary))';
  const logoUrl = settings?.logo_url;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-3">
          {logoUrl && <img src={logoUrl} alt="Logo" className="h-12 mx-auto object-contain" />}
          <CardTitle className="text-lg">Acesso ao Portal</CardTitle>
          <p className="text-sm text-muted-foreground">Introduz o teu email para acederes ao teu espaço.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === 'email' ? (
            <>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  placeholder="o.teu@email.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleEmailSubmit()}
                />
              </div>
              <Button className="w-full" disabled={sending} onClick={handleEmailSubmit}>
                {sending ? 'A enviar...' : 'Enviar código de acesso'}
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground text-center">
                Enviámos um código para o teu telemóvel. Introduz abaixo:
              </p>
              <div className="space-y-2">
                <Label>Código de acesso</Label>
                <Input
                  type="text"
                  maxLength={6}
                  placeholder="000000"
                  value={code}
                  onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                  onKeyDown={e => e.key === 'Enter' && handleCodeSubmit()}
                  className="text-center text-2xl tracking-[0.5em] font-mono"
                />
              </div>
              <Button className="w-full" onClick={handleCodeSubmit}>Validar</Button>
              <Button variant="ghost" className="w-full text-xs" onClick={() => { setStep('email'); setCode(''); }}>
                Voltar
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
