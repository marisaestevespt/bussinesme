import { useState, useEffect } from 'react';
import { useDigestSettings } from '@/hooks/useDigestSettings';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Loader2, Mail, Moon, Send } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

const OWNER_SECTION_LABELS: Record<string, string> = {
  reunioes_dia: 'Reuniões do dia',
  tarefas_equipa_hoje: 'Tarefas da equipa para hoje',
  tarefas_atraso: 'Tarefas em atraso (equipa)',
  followups_leads: 'Follow-ups de leads pendentes',
  aniversarios: 'Aniversários (equipa e clientes)',
  renovacoes_clientes: 'Renovações de clientes próximas',
  rotinas_dia: 'Rotinas do dia — feitas vs por fazer',
  vendas_hoje: 'Vendas registadas hoje',
  leads_novas: 'Leads novas no CRM',
  nps_recebidos: 'NPS recebidos',
  pagamentos_recebidos: 'Pagamentos recebidos hoje',
  projetos_fechados: 'Projetos fechados hoje',
  projetos_novos: 'Projetos criados hoje',
  tempo_trabalhado: 'Tempo trabalhado hoje (equipa)',
  resumo_membros: 'Resumo de cada membro',
  prazos_fiscais: 'Prazos fiscais próximos ou em atraso',
};

const OWNER_EOD_SECTION_LABELS: Record<string, string> = {
  tarefas_concluidas_equipa: 'Tarefas concluídas hoje (equipa)',
  rotinas_progresso: 'Progresso das rotinas do dia',
  tempo_trabalhado: 'Tempo trabalhado hoje (equipa)',
  vendas_hoje: 'Vendas do dia',
  pagamentos_recebidos: 'Pagamentos recebidos',
  projetos_fechados: 'Projetos fechados hoje',
  tarefas_atraso: 'Tarefas que ficaram em atraso',
};

export function SettingsDigest() {
  return (
    <div className="space-y-10">
      <DigestSection
        type="morning"
        icon={<Mail className="h-4 w-4" />}
        title="Briefing da Manhã"
        description="Recebe todas as manhãs tudo o que vai acontecer no dia no negócio."
        sectionLabels={OWNER_SECTION_LABELS}
        defaultTime="08:00"
      />
      <Separator />
      <DigestSection
        type="eod"
        icon={<Moon className="h-4 w-4" />}
        title="Wrap-up de Fim de Dia"
        description="Recebe ao fim do dia um resumo do que foi feito, concluído e o que ficou pendente."
        sectionLabels={OWNER_EOD_SECTION_LABELS}
        defaultTime="18:30"
      />
    </div>
  );
}

function DigestSection({
  type,
  icon,
  title,
  description,
  sectionLabels,
  defaultTime,
}: {
  type: 'morning' | 'eod';
  icon: React.ReactNode;
  title: string;
  description: string;
  sectionLabels: Record<string, string>;
  defaultTime: string;
}) {
  const { settings, isLoading, update, defaultSections } = useDigestSettings(true, type);
  const [enabled, setEnabled] = useState(false);
  const [sendTime, setSendTime] = useState(defaultTime);
  const [sections, setSections] = useState<Record<string, boolean>>(defaultSections);

  useEffect(() => {
    if (settings) {
      setEnabled(settings.enabled);
      setSendTime(settings.send_time?.substring(0, 5) || defaultTime);
      setSections({ ...defaultSections, ...(settings.sections || {}) });
    }
  }, [settings]);

  const handleToggleEnabled = async (val: boolean) => {
    setEnabled(val);
    try {
      await update({ enabled: val, sections, send_time: sendTime + ':00' });
      toast.success(val ? `${title} activado` : `${title} desactivado`);
    } catch {
      toast.error('Não consegui guardar a preferências de digest. Tenta novamente.');
      setEnabled(!val);
    }
  };

  const handleTimeChange = async (val: string) => {
    setSendTime(val);
    try {
      await update({ send_time: val + ':00' });
    } catch {
      toast.error('Erro ao guardar hora');
    }
  };

  const handleSectionToggle = async (key: string, val: boolean) => {
    const next = { ...sections, [key]: val };
    setSections(next);
    try {
      await update({ sections: next });
    } catch {
      toast.error('Não consegui guardar a preferências de digest. Tenta novamente.');
    }
  };

  const [sendingTest, setSendingTest] = useState(false);
  const handleSendNow = async () => {
    setSendingTest(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-digest', {
        body: { test: true, digestType: type },
      });
      if (error) throw error;
      const result = data as any;
      const first = result?.results?.[0];
      if (first && first.sent === false) {
        toast.error(`Falhou: ${first.error || 'erro desconhecido'}`);
      } else if (result?.processed > 0) {
        toast.success('Digest enviado! Verifica o email em alguns segundos.');
      } else {
        toast.message(result?.message || 'Sem digest para enviar');
      }
    } catch (err: any) {
      toast.error(`Erro: ${err?.message || 'falhou o envio'}`);
    } finally {
      setSendingTest(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h3 className="text-base font-semibold flex items-center gap-2">
          {icon}
          {title}
        </h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      <div className="flex items-center justify-between">
        <Label htmlFor={`digest-enabled-${type}`} className="text-sm font-medium">
          Activar {title.toLowerCase()}
        </Label>
        <Switch
          id={`digest-enabled-${type}`}
          checked={enabled}
          onCheckedChange={handleToggleEnabled}
        />
      </div>

      {enabled && (
        <>
          <Separator />

          <div className="space-y-3">
            <Label className="text-sm font-medium">Hora de envio</Label>
            <Input
              type="time"
              value={sendTime}
              onChange={e => handleTimeChange(e.target.value)}
              className="w-32"
            />
            <p className="text-xs text-muted-foreground">
              O resumo é enviado diariamente à hora configurada.
            </p>
          </div>

          <div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSendNow}
              disabled={sendingTest}
            >
              {sendingTest ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Enviar digest agora (teste)
            </Button>
          </div>

          <Separator />

          <div className="space-y-4">
            <Label className="text-sm font-medium">O que incluir no resumo</Label>
            <div className="space-y-3">
              {Object.entries(sectionLabels).map(([key, label]) => (
                <div key={key} className="flex items-center justify-between">
                  <Label htmlFor={`section-${type}-${key}`} className="text-sm text-foreground">
                    {label}
                  </Label>
                  <Switch
                    id={`section-${type}-${key}`}
                    checked={sections[key] ?? true}
                    onCheckedChange={(val) => handleSectionToggle(key, val)}
                  />
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
