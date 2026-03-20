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
  const [submitting, setSubmitting] = useState(false);
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

  const handleSubmit = async () => {
    if (!email.trim()) return;
    if (!client || client.email?.toLowerCase() !== email.trim().toLowerCase()) {
      toast.error('Email não reconhecido.');
      return;
    }

    setSubmitting(true);

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
          <div className="space-y-2">
            <Label>Email</Label>
            <Input
              type="email"
              placeholder="o.teu@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            />
          </div>
          <Button className="w-full" disabled={submitting} onClick={handleSubmit}>
            {submitting ? 'A aceder...' : 'Aceder'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
