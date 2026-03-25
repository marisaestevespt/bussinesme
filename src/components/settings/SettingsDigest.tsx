import { useState, useEffect } from 'react';
import { useDigestSettings } from '@/hooks/useDigestSettings';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Loader2, Mail } from 'lucide-react';
import { toast } from 'sonner';

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
};

export function SettingsDigest() {
  const { settings, isLoading, update, ownerDefaultSections } = useDigestSettings(true);
  const [enabled, setEnabled] = useState(false);
  const [sendTime, setSendTime] = useState('08:00');
  const [sections, setSections] = useState<Record<string, boolean>>(ownerDefaultSections);

  useEffect(() => {
    if (settings) {
      setEnabled(settings.enabled);
      setSendTime(settings.send_time?.substring(0, 5) || '08:00');
      setSections({ ...ownerDefaultSections, ...(settings.sections || {}) });
    }
  }, [settings]);

  const handleToggleEnabled = async (val: boolean) => {
    setEnabled(val);
    try {
      await update({ enabled: val, sections });
      toast.success(val ? 'Resumo diário activado' : 'Resumo diário desactivado');
    } catch {
      toast.error('Erro ao guardar');
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
      toast.error('Erro ao guardar');
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
          <Mail className="h-4 w-4" />
          Briefing Diário do Negócio
        </h3>
        <p className="text-sm text-muted-foreground">
          Recebe todas as manhãs tudo o que vai acontecer no dia no negócio.
        </p>
      </div>

      <div className="flex items-center justify-between">
        <Label htmlFor="digest-enabled" className="text-sm font-medium">
          Activar briefing diário do negócio
        </Label>
        <Switch
          id="digest-enabled"
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

          <Separator />

          <div className="space-y-4">
            <Label className="text-sm font-medium">O que incluir no resumo</Label>
            <div className="space-y-3">
              {Object.entries(OWNER_SECTION_LABELS).map(([key, label]) => (
                <div key={key} className="flex items-center justify-between">
                  <Label htmlFor={`section-${key}`} className="text-sm text-foreground">
                    {label}
                  </Label>
                  <Switch
                    id={`section-${key}`}
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
