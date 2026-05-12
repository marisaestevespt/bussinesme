import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Mail, Save, Plus, X, Loader2 } from 'lucide-react';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

export interface WelcomeClientEmailSettingsData {
  intro_text: string;
  next_steps: string[];
  support_hours: string;
  whatsapp_number: string;
  whatsapp_message: string;
}

export const DEFAULT_WELCOME_CLIENT_EMAIL_SETTINGS: WelcomeClientEmailSettingsData = {
  intro_text: 'Estamos muito felizes por te ter connosco! A partir de agora vamos trabalhar juntos para alcançar os teus objetivos.',
  next_steps: [
    'Aceder ao Portal do Cliente e explorar o teu espaço',
    'Responder ao briefing inicial',
    'Confirmar a data da reunião de kickoff',
  ],
  support_hours: 'Segunda a Sexta, 9h-18h',
  whatsapp_number: '+351913544824',
  whatsapp_message: 'Olá! Sou cliente e gostaria de tirar uma dúvida.',
};

export function WelcomeClientEmailSettings({ onPreviewChange }: { onPreviewChange?: (data: WelcomeClientEmailSettingsData) => void }) {
  const { settings } = useBusinessSettings();
  const queryClient = useQueryClient();
  const [data, setData] = useState<WelcomeClientEmailSettingsData>(DEFAULT_WELCOME_CLIENT_EMAIL_SETTINGS);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const stored = settings?.welcome_client_email_settings;
    if (stored) {
      setData({
        intro_text: stored.intro_text ?? DEFAULT_WELCOME_CLIENT_EMAIL_SETTINGS.intro_text,
        next_steps: Array.isArray(stored.next_steps) ? stored.next_steps : DEFAULT_WELCOME_CLIENT_EMAIL_SETTINGS.next_steps,
        support_hours: stored.support_hours ?? DEFAULT_WELCOME_CLIENT_EMAIL_SETTINGS.support_hours,
        whatsapp_number: stored.whatsapp_number ?? DEFAULT_WELCOME_CLIENT_EMAIL_SETTINGS.whatsapp_number,
        whatsapp_message: stored.whatsapp_message ?? DEFAULT_WELCOME_CLIENT_EMAIL_SETTINGS.whatsapp_message,
      });
    }
  }, [settings]);

  useEffect(() => {
    onPreviewChange?.(data);
  }, [data, onPreviewChange]);

  const update = <K extends keyof WelcomeClientEmailSettingsData>(key: K, value: WelcomeClientEmailSettingsData[K]) => {
    setData((d) => ({ ...d, [key]: value }));
  };

  const updateStep = (i: number, value: string) => {
    setData((d) => ({ ...d, next_steps: d.next_steps.map((s, idx) => (idx === i ? value : s)) }));
  };
  const addStep = () => setData((d) => ({ ...d, next_steps: [...d.next_steps, ''] }));
  const removeStep = (i: number) => setData((d) => ({ ...d, next_steps: d.next_steps.filter((_, idx) => idx !== i) }));

  const save = async () => {
    if (!settings?.id) return;
    setSaving(true);
    try {
      const cleaned = { ...data, next_steps: data.next_steps.map((s) => s.trim()).filter(Boolean) };
      const { error } = await supabase
        .from('business_settings')
        .update({ welcome_client_email_settings: cleaned } as any)
        .eq('id', settings.id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['business-settings'] });
      toast.success('Definições guardadas');
    } catch (e: any) {
      toast.error(e.message || 'Erro a guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Mail className="h-4 w-4 text-primary" />
          Email de Boas-vindas a Cliente
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Personaliza o conteúdo do email enviado quando dás boas-vindas a um novo cliente e partilhas o acesso ao Portal.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label className="text-xs font-medium">Texto de introdução</Label>
          <Textarea
            rows={4}
            value={data.intro_text}
            onChange={(e) => update('intro_text', e.target.value)}
            placeholder="Mensagem de boas-vindas ao cliente"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-medium">Próximos passos</Label>
          <div className="space-y-2">
            {data.next_steps.map((step, i) => (
              <div key={i} className="flex gap-2 items-center">
                <span className="text-xs text-muted-foreground w-5">{i + 1}.</span>
                <Input
                  value={step}
                  onChange={(e) => updateStep(i, e.target.value)}
                  placeholder={`Passo ${i + 1}`}
                />
                <Button size="icon" variant="ghost" onClick={() => removeStep(i)} aria-label="Remover">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
          <Button size="sm" variant="outline" onClick={addStep} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />Adicionar passo
          </Button>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-xs font-medium">Horário de atendimento</Label>
            <Input
              value={data.support_hours}
              onChange={(e) => update('support_hours', e.target.value)}
              placeholder="Ex: Seg-Sex, 9h-18h"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-medium">Número de WhatsApp</Label>
            <Input
              value={data.whatsapp_number}
              onChange={(e) => update('whatsapp_number', e.target.value)}
              placeholder="+351913544824"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-medium">Mensagem pré-preenchida no WhatsApp (opcional)</Label>
          <Input
            value={data.whatsapp_message}
            onChange={(e) => update('whatsapp_message', e.target.value)}
            placeholder="Olá! Sou cliente e gostaria de tirar uma dúvida."
          />
        </div>

        <div className="pt-3 border-t">
          <Button onClick={save} disabled={saving} size="sm" className="gap-2">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {saving ? 'A guardar...' : 'Guardar'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
