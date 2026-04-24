import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Calendar, Plus, Trash2, RefreshCw, X } from 'lucide-react';

interface GAccount {
  id: string;
  email: string;
  domain: string;
  display_name: string | null;
  is_active: boolean;
  last_sync_at: string | null;
  last_sync_error: string | null;
}

export function SettingsGoogleCalendar() {
  const [accounts, setAccounts] = useState<GAccount[]>([]);
  const [allowedDomains, setAllowedDomains] = useState<string[]>([]);
  const [newDomain, setNewDomain] = useState('');
  const [loading, setLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: accs }, { data: settings }] = await Promise.all([
      supabase.from('google_calendar_accounts').select('*').order('created_at', { ascending: false }),
      supabase.from('google_calendar_settings').select('allowed_domains').limit(1).maybeSingle(),
    ]);
    setAccounts((accs as any) ?? []);
    setAllowedDomains((settings?.allowed_domains as string[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // Detectar retorno do callback
    const params = new URLSearchParams(window.location.search);
    const success = params.get('gcal_success');
    const err = params.get('gcal_error');
    if (success) {
      toast.success(`Conta ${success} ligada`);
      window.history.replaceState({}, '', window.location.pathname);
    } else if (err) {
      const dom = params.get('domain');
      toast.error(dom ? `Domínio ${dom} não autorizado` : `Erro a ligar conta: ${err}`);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const connect = async () => {
    setConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke('google-oauth-init', {
        body: { return_to: '/definicoes' },
      });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (e: any) {
      toast.error(`Não foi possível iniciar a ligação: ${e.message}`);
      setConnecting(false);
    }
  };

  const disconnect = async (id: string, email: string) => {
    if (!confirm(`Desligar ${email}?`)) return;
    const { error } = await supabase.from('google_calendar_accounts').delete().eq('id', id);
    if (error) return toast.error(`Erro: ${error.message}`);
    toast.success('Conta desligada');
    load();
  };

  const addDomain = async () => {
    const d = newDomain.trim().toLowerCase().replace(/^@/, '');
    if (!d) return;
    if (allowedDomains.includes(d)) return toast.info('Domínio já existe');
    const next = [...allowedDomains, d];
    const { data: existing } = await supabase.from('google_calendar_settings').select('id').limit(1).maybeSingle();
    const { error } = existing
      ? await supabase.from('google_calendar_settings').update({ allowed_domains: next }).eq('id', existing.id)
      : await supabase.from('google_calendar_settings').insert({ allowed_domains: next });
    if (error) return toast.error(`Erro: ${error.message}`);
    setAllowedDomains(next);
    setNewDomain('');
    toast.success(`Domínio ${d} adicionado`);
  };

  const removeDomain = async (d: string) => {
    const next = allowedDomains.filter(x => x !== d);
    const { data: existing } = await supabase.from('google_calendar_settings').select('id').limit(1).maybeSingle();
    if (!existing) return;
    const { error } = await supabase.from('google_calendar_settings').update({ allowed_domains: next }).eq('id', existing.id);
    if (error) return toast.error(`Erro: ${error.message}`);
    setAllowedDomains(next);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Contas Google ligadas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Liga contas Google para sincronizar eventos do Lyrata com o Google Calendar e
            permitir que membros e clientes recebam convites automaticamente.
          </p>

          <Button onClick={connect} disabled={connecting}>
            <Plus className="h-4 w-4 mr-2" />
            {connecting ? 'A redirecionar…' : 'Ligar nova conta Google'}
          </Button>

          {loading ? (
            <div className="text-sm text-muted-foreground">A carregar…</div>
          ) : accounts.length === 0 ? (
            <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              Nenhuma conta ligada ainda.
            </div>
          ) : (
            <div className="space-y-2">
              {accounts.map(a => (
                <div key={a.id} className="flex items-center justify-between rounded-md border p-3">
                  <div className="space-y-1">
                    <div className="font-medium text-sm">{a.display_name || a.email}</div>
                    <div className="text-xs text-muted-foreground">{a.email}</div>
                    {a.last_sync_error && (
                      <div className="text-xs text-destructive">⚠ {a.last_sync_error}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={a.is_active ? 'default' : 'secondary'}>
                      {a.is_active ? 'Ativa' : 'Inativa'}
                    </Badge>
                    <Button variant="ghost" size="icon" onClick={() => disconnect(a.id, a.email)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Domínios permitidos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Restringe quais domínios de email podem ligar uma conta Google. Deixa vazio para
            permitir qualquer domínio.
          </p>
          <div className="flex gap-2">
            <Input
              placeholder="ex: marisaesteves.pt"
              value={newDomain}
              onChange={e => setNewDomain(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addDomain()}
            />
            <Button onClick={addDomain}>
              <Plus className="h-4 w-4 mr-2" /> Adicionar
            </Button>
          </div>
          {allowedDomains.length === 0 ? (
            <div className="text-sm text-muted-foreground italic">
              Sem restrição — qualquer domínio Google é aceite.
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {allowedDomains.map(d => (
                <Badge key={d} variant="secondary" className="gap-1">
                  {d}
                  <button onClick={() => removeDomain(d)} className="ml-1 hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}