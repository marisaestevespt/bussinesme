import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShieldAlert, Send, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SafetyState {
  email_test_mode: boolean;
  email_test_redirect: string;
  email_send_to_clients_enabled: boolean;
}

export function EmailSafetyPanel() {
  const [state, setState] = useState<SafetyState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('business_setup')
      .select('id, email_test_mode, email_test_redirect, email_send_to_clients_enabled')
      .limit(1)
      .maybeSingle();
    if (data) {
      setState({
        email_test_mode: data.email_test_mode ?? true,
        email_test_redirect: data.email_test_redirect ?? 'info@marisaesteves.pt',
        email_send_to_clients_enabled: data.email_send_to_clients_enabled ?? false,
      });
    }
    setLoading(false);
  }

  async function save(patch: Partial<SafetyState>) {
    if (!state) return;
    setSaving(true);
    const next = { ...state, ...patch };
    setState(next);
    const { data: row } = await supabase.from('business_setup').select('id').limit(1).maybeSingle();
    if (!row) {
      toast.error('Setup do negócio não encontrado');
      setSaving(false);
      return;
    }
    const { error } = await supabase
      .from('business_setup')
      .update(patch)
      .eq('id', row.id);
    setSaving(false);
    if (error) {
      toast.error('Erro a guardar', { description: error.message });
      void load();
    } else {
      toast.success('Definições guardadas');
    }
  }

  async function sendTest() {
    if (!state) return;
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        'send-transactional-email',
        {
          body: {
            templateName: 'payment-reminder',
            recipientEmail: state.email_test_redirect,
            idempotencyKey: `manual-test-${Date.now()}`,
            templateData: {
              clientName: 'Cliente Teste',
              productName: 'Serviço Teste',
              amount: '100',
              dueDate: '01/01/2030',
              daysUntil: 3,
              businessName: 'Lyrata',
            },
          },
        },
      );
      if (error) throw error;
      const ok = (data as any)?.success !== false;
      if (ok) {
        toast.success('Email de teste enfileirado', {
          description: `Vai aparecer em ${state.email_test_redirect} dentro de minutos (depende da fila e do DNS estar verificado).`,
        });
      } else {
        toast.warning('Resposta inesperada', {
          description: JSON.stringify(data),
        });
      }
    } catch (err: any) {
      toast.error('Falhou o envio', { description: err?.message || String(err) });
    } finally {
      setTesting(false);
    }
  }

  if (loading || !state) {
    return (
      <Card>
        <CardContent className="py-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> A carregar definições de segurança…
        </CardContent>
      </Card>
    );
  }

  const liveAndOpen = !state.email_test_mode && state.email_send_to_clients_enabled;

  return (
    <Card className="border-amber-300/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldAlert className="h-4 w-4 text-amber-600" />
          Segurança de envios
          {state.email_test_mode && (
            <Badge variant="outline" className="ml-2 border-amber-500 text-amber-700">
              MODO TESTE
            </Badge>
          )}
          {liveAndOpen && (
            <Badge variant="destructive" className="ml-2">LIVE — envia a clientes</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <Label className="text-sm font-medium">Modo de teste global</Label>
            <p className="text-xs text-muted-foreground">
              Quando ativo, TODOS os emails (lembretes, faturas, digests, confirmações)
              são redirecionados para o endereço abaixo. O destinatário original aparece
              no assunto entre [TESTE → ...].
            </p>
          </div>
          <Switch
            checked={state.email_test_mode}
            disabled={saving}
            onCheckedChange={(v) => save({ email_test_mode: v })}
          />
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Endereço para onde redirecionar emails de teste</Label>
          <Input
            type="email"
            value={state.email_test_redirect}
            onChange={(e) => setState({ ...state, email_test_redirect: e.target.value })}
            onBlur={() => save({ email_test_redirect: state.email_test_redirect })}
            disabled={saving}
          />
        </div>

        <div className="flex items-start justify-between gap-4 pt-2 border-t">
          <div className="space-y-1">
            <Label className="text-sm font-medium">Permitir envios a clientes (Live)</Label>
            <p className="text-xs text-muted-foreground">
              Quando o modo de teste está desligado, este interruptor controla se emails
              destinados a clientes (lembretes de pagamento, faturas, offboarding) saem
              de facto. Mantém desligado até estares 100% pronto.
            </p>
          </div>
          <Switch
            checked={state.email_send_to_clients_enabled}
            disabled={saving || state.email_test_mode}
            onCheckedChange={(v) => save({ email_send_to_clients_enabled: v })}
          />
        </div>

        <div className="pt-2 border-t">
          <Button onClick={sendTest} disabled={testing} variant="outline" className="gap-2">
            {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Enviar email de teste para {state.email_test_redirect}
          </Button>
          <p className="text-[11px] text-muted-foreground mt-2">
            Os emails só chegam de facto à caixa de entrada quando o domínio
            <span className="font-mono"> notify.lyrata.pt </span> estiver verificado em
            Cloud → Emails. Até lá ficam na fila.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
