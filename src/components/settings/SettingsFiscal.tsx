import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { toast } from 'sonner';
import { Save, Receipt, Info } from 'lucide-react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export function SettingsFiscal() {
  const { settings, refetch } = useBusinessSettings();
  const [saving, setSaving] = useState(false);

  const [ivaRegime, setIvaRegime] = useState('trimestral');
  const [irsRegime, setIrsRegime] = useState('simplificado');
  const [ssType, setSsType] = useState('independente');
  const [activityStartDate, setActivityStartDate] = useState<Date | undefined>();
  const [ssExempt, setSsExempt] = useState(false);
  const [ivaExempt, setIvaExempt] = useState(false);

  useEffect(() => {
    if (!settings) return;
    const s = settings as any;
    setIvaRegime(s.tax_iva_regime || 'trimestral');
    setIrsRegime(s.tax_irs_regime || 'simplificado');
    setSsType(s.ss_type || 'independente');
    setActivityStartDate(s.activity_start_date ? new Date(s.activity_start_date + 'T00:00:00') : undefined);
    setSsExempt(s.ss_exempt ?? false);
    setIvaExempt(s.iva_exempt ?? false);
  }, [settings]);

  // Auto-calculate defaults when activity_start_date changes
  const lessThan12Months = useMemo(() => {
    if (!activityStartDate) return false;
    const now = new Date();
    const diff = (now.getFullYear() - activityStartDate.getFullYear()) * 12 + (now.getMonth() - activityStartDate.getMonth());
    return diff < 12;
  }, [activityStartDate]);

  // Auto-set exempt defaults on regime / date change (only if user hasn't touched them)
  useEffect(() => {
    if (ivaRegime === 'isento') setIvaExempt(true);
  }, [ivaRegime]);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('business_settings')
        .update({
          tax_iva_regime: ivaRegime,
          tax_irs_regime: irsRegime,
          ss_type: ssType,
          activity_start_date: activityStartDate ? format(activityStartDate, 'yyyy-MM-dd') : null,
          ss_exempt: ssExempt,
          iva_exempt: ivaExempt,
        } as any)
        .eq('id', settings.id);
      if (error) throw error;
      toast.success('Definições fiscais atualizadas!');
      await refetch();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao guardar.');
    } finally {
      setSaving(false);
    }
  };

  if (!settings) return null;

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-foreground">
          <Receipt className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
          <h2 className="text-sm font-semibold tracking-tight uppercase">Configuração Fiscal</h2>
        </div>
        <div className="rounded-lg border bg-card p-5 space-y-5">
          {/* IVA Regime */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Regime de IVA</Label>
            <Select value={ivaRegime} onValueChange={setIvaRegime}>
              <SelectTrigger className="h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="isento">Isento (art. 53º)</SelectItem>
                <SelectItem value="trimestral">Trimestral</SelectItem>
                <SelectItem value="mensal">Mensal</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* SS Type */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Tipo de contribuinte SS</Label>
            <Select value={ssType} onValueChange={setSsType}>
              <SelectTrigger className="h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="independente">Trabalhador independente / ENI</SelectItem>
                <SelectItem value="entidade_patronal">Entidade patronal (com empregados)</SelectItem>
                <SelectItem value="ambos">Ambos (independente + patronal)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {ssType === 'independente' && 'Taxa de 21,4% sobre 70% da faturação (rendimento relevante). Baseado na declaração trimestral.'}
              {ssType === 'entidade_patronal' && 'Taxa patronal de 23,75% + 11% trabalhador sobre salários brutos de contratos de trabalho.'}
              {ssType === 'ambos' && 'Contribuições como independente (21,4% s/ 70% faturação) + contribuições patronais sobre salários.'}
            </p>
          </div>

          {/* IRS Regime */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Regime de IRS</Label>
            <Select value={irsRegime} onValueChange={setIrsRegime}>
              <SelectTrigger className="h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="simplificado">Simplificado</SelectItem>
                <SelectItem value="contabilidade_organizada">Contabilidade organizada</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Activity start date */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Data de início de actividade</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn('w-full justify-start text-left font-normal h-11', !activityStartDate && 'text-muted-foreground')}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {activityStartDate ? format(activityStartDate, 'dd/MM/yyyy') : 'Selecionar data'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={activityStartDate}
                  onSelect={setActivityStartDate}
                  initialFocus
                  className={cn('p-3 pointer-events-auto')}
                />
              </PopoverContent>
            </Popover>
            {lessThan12Months && (
              <p className="text-xs text-amber-600 flex items-center gap-1">
                <Info className="h-3 w-3" /> Início de actividade há menos de 12 meses
              </p>
            )}
          </div>

          {/* SS Exempt toggle */}
          <div className="flex items-center justify-between py-2">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Isento de Segurança Social</Label>
              <p className="text-xs text-muted-foreground">
                {lessThan12Months ? 'Activo por defeito (início < 12 meses)' : 'Ativar se estiveres isento de SS'}
              </p>
            </div>
            <Switch checked={ssExempt} onCheckedChange={setSsExempt} />
          </div>

          {/* IVA Exempt toggle */}
          <div className="flex items-center justify-between py-2">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Isento de IVA</Label>
              <p className="text-xs text-muted-foreground">
                {ivaRegime === 'isento' ? 'Activo por defeito (regime isento)' : 'Ativar se tiveres isenção de IVA'}
              </p>
            </div>
            <Switch checked={ivaExempt} onCheckedChange={setIvaExempt} />
          </div>

          {/* Contabilidade organizada info */}
          {irsRegime === 'contabilidade_organizada' && (
            <div className="rounded-md border border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-800 p-4 text-sm text-muted-foreground flex gap-2">
              <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <span>Em contabilidade organizada, os prazos fiscais são geridos pelo teu contabilista. As páginas de IVA e Segurança Social ficam desactivadas.</span>
            </div>
          )}
        </div>
      </div>

      <Button onClick={handleSave} disabled={saving} className="gap-2">
        <Save className="h-4 w-4" />
        {saving ? 'A guardar...' : 'Guardar definições fiscais'}
      </Button>
    </div>
  );
}
