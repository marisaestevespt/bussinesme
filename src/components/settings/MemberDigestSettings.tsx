import { useState, useEffect } from 'react';
import { useDigestSettings } from '@/hooks/useDigestSettings';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Mail } from 'lucide-react';
import { toast } from 'sonner';

const MEMBER_SECTION_LABELS: Record<string, string> = {
  tarefas_hoje: 'Tarefas para hoje',
  tarefas_atraso: 'Tarefas em atraso',
  reunioes_hoje: 'Reuniões de hoje',
  followups_leads: 'Follow-ups de leads pendentes',
  aniversarios: 'Aniversários (equipa e clientes)',
  renovacoes_clientes: 'Renovações de clientes próximas',
  rotinas: 'Rotinas do dia',
  tarefas_concluidas: 'Tarefas concluídas no período',
  tempo_registado: 'Tempo registado',
};

const DAYS_OF_WEEK = [
  { value: '1', label: 'Segunda-feira' },
  { value: '2', label: 'Terça-feira' },
  { value: '3', label: 'Quarta-feira' },
  { value: '4', label: 'Quinta-feira' },
  { value: '5', label: 'Sexta-feira' },
  { value: '6', label: 'Sábado' },
  { value: '7', label: 'Domingo' },
];

export function MemberDigestSettings() {
  const { settings, isLoading, update, memberDefaultSections } = useDigestSettings(false);
  const [enabled, setEnabled] = useState(false);
  const [frequency, setFrequency] = useState<'diario' | 'semanal' | 'mensal'>('diario');
  const [sendTime, setSendTime] = useState('08:00');
  const [dayOfWeek, setDayOfWeek] = useState<number | null>(1);
  const [dayOfMonth, setDayOfMonth] = useState<number | null>(1);
  const [sections, setSections] = useState<Record<string, boolean>>(memberDefaultSections);

  useEffect(() => {
    if (settings) {
      setEnabled(settings.enabled);
      setFrequency(settings.frequency || 'diario');
      setSendTime(settings.send_time?.substring(0, 5) || '08:00');
      setDayOfWeek(settings.send_day_of_week ?? 1);
      setDayOfMonth(settings.send_day_of_month ?? 1);
      setSections({ ...memberDefaultSections, ...(settings.sections || {}) });
    }
  }, [settings]);

  const handleToggleEnabled = async (val: boolean) => {
    setEnabled(val);
    try {
      await update({ enabled: val, frequency, sections });
      toast.success(val ? 'Resumo pessoal activado' : 'Resumo pessoal desactivado');
    } catch {
      toast.error('Não consegui guardar a preferências de digest. Tenta novamente.');
      setEnabled(!val);
    }
  };

  const handleFrequencyChange = async (val: 'diario' | 'semanal' | 'mensal') => {
    setFrequency(val);
    try {
      await update({
        frequency: val,
        send_day_of_week: val === 'semanal' ? (dayOfWeek ?? 1) : null,
        send_day_of_month: val === 'mensal' ? (dayOfMonth ?? 1) : null,
      });
    } catch {
      toast.error('Não consegui guardar a preferências de digest. Tenta novamente.');
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

  const handleDayOfWeekChange = async (val: string) => {
    const num = parseInt(val);
    setDayOfWeek(num);
    try {
      await update({ send_day_of_week: num });
    } catch {
      toast.error('Não consegui guardar a preferências de digest. Tenta novamente.');
    }
  };

  const handleDayOfMonthChange = async (val: string) => {
    const num = parseInt(val);
    setDayOfMonth(num);
    try {
      await update({ send_day_of_month: num });
    } catch {
      toast.error('Não consegui guardar a preferências de digest. Tenta novamente.');
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Mail className="h-4 w-4 text-primary" />
          Briefing diário por email
        </CardTitle>
        <p className="text-xs text-muted-foreground">Recebe todas as manhãs um resumo do que tens para o dia</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <Label htmlFor="member-digest-enabled" className="text-sm">
            Receber briefing diário por email
          </Label>
          <Switch
            id="member-digest-enabled"
            checked={enabled}
            onCheckedChange={handleToggleEnabled}
          />
        </div>

        {enabled && (
          <>
            <Separator />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-medium">Frequência</Label>
                <Select value={frequency} onValueChange={handleFrequencyChange}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="diario">Diário</SelectItem>
                    <SelectItem value="semanal">Semanal</SelectItem>
                    <SelectItem value="mensal">Mensal</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-medium">Hora de envio</Label>
                <Input
                  type="time"
                  value={sendTime}
                  onChange={e => handleTimeChange(e.target.value)}
                  className="h-8 text-sm w-28"
                />
              </div>

              {frequency === 'semanal' && (
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Dia da semana</Label>
                  <Select value={String(dayOfWeek ?? 1)} onValueChange={handleDayOfWeekChange}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DAYS_OF_WEEK.map(d => (
                        <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {frequency === 'mensal' && (
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Dia do mês</Label>
                  <Select value={String(dayOfMonth ?? 1)} onValueChange={handleDayOfMonthChange}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 31 }, (_, i) => (
                        <SelectItem key={i + 1} value={String(i + 1)}>Dia {i + 1}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <Separator />

            <div className="space-y-3">
              <Label className="text-xs font-medium">O que incluir</Label>
              {Object.entries(MEMBER_SECTION_LABELS).map(([key, label]) => (
                <div key={key} className="flex items-center justify-between">
                  <Label htmlFor={`member-section-${key}`} className="text-sm text-foreground">
                    {label}
                  </Label>
                  <Switch
                    id={`member-section-${key}`}
                    checked={sections[key] ?? true}
                    onCheckedChange={(val) => handleSectionToggle(key, val)}
                  />
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
