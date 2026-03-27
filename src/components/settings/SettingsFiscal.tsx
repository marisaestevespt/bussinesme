import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { toast } from 'sonner';
import { Save, Receipt, Info, Building2, Users, BookOpen } from 'lucide-react';
import { format } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';

export function SettingsFiscal() {
  const { settings, refetch } = useBusinessSettings();
  const [saving, setSaving] = useState(false);

  const [businessType, setBusinessType] = useState('eni');
  const [ivaRegime, setIvaRegime] = useState('trimestral');
  const [irsRegime, setIrsRegime] = useState('simplificado');
  const [ssType, setSsType] = useState('independente');
  const [teamType, setTeamType] = useState('externa');
  const [hasAccountant, setHasAccountant] = useState(false);
  const [activityStartDate, setActivityStartDate] = useState<Date | undefined>();
  const [ssExempt, setSsExempt] = useState(false);
  const [ivaExempt, setIvaExempt] = useState(false);

  useEffect(() => {
    if (!settings) return;
    const s = settings as any;
    setBusinessType(s.business_type || 'eni');
    setIvaRegime(s.tax_iva_regime || 'trimestral');
    setIrsRegime(s.tax_irs_regime || 'simplificado');
    setSsType(s.ss_type || 'independente');
    setTeamType(s.team_type || 'externa');
    setHasAccountant(s.has_accountant ?? false);
    setActivityStartDate(s.activity_start_date ? new Date(s.activity_start_date + 'T00:00:00') : undefined);
    setSsExempt(s.ss_exempt ?? false);
    setIvaExempt(s.iva_exempt ?? false);
  }, [settings]);

  const monthsActive = useMemo(() => {
    if (!activityStartDate) return null;
    const now = new Date();
    return (now.getFullYear() - activityStartDate.getFullYear()) * 12 + (now.getMonth() - activityStartDate.getMonth());
  }, [activityStartDate]);

  const isFirstYear = monthsActive !== null && monthsActive < 12;
  const isSecondYearPlus = monthsActive !== null && monthsActive >= 12;

  // When business type is Empresa, force contabilidade organizada
  const effectiveIrsRegime = businessType === 'empresa' ? 'contabilidade_organizada' : irsRegime;
  const isContabOrganizada = effectiveIrsRegime === 'contabilidade_organizada';

  // Auto-guidance text
  const exemptionGuide = useMemo(() => {
    if (businessType !== 'eni') return null;
    if (isFirstYear) {
      return 'No 1.º ano de atividade, estás isento de IVA e Segurança Social por defeito. Podes desativar as isenções se optares por não beneficiar delas.';
    }
    if (isSecondYearPlus) {
      return 'A partir do 2.º ano, continuas isento de IVA (salvo se optares por não ser). A Segurança Social passa a ser obrigatória.';
    }
    return null;
  }, [businessType, isFirstYear, isSecondYearPlus]);

  // When business type changes to empresa
  useEffect(() => {
    if (businessType === 'empresa') {
      setHasAccountant(true);
    }
  }, [businessType]);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('business_settings')
        .update({
          business_type: businessType,
          tax_iva_regime: ivaRegime,
          tax_irs_regime: businessType === 'empresa' ? 'contabilidade_organizada' : irsRegime,
          ss_type: ssType,
          team_type: teamType,
          has_accountant: hasAccountant,
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
      {/* TIPO DE NEGÓCIO */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-foreground">
          <Building2 className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
          <h2 className="text-sm font-semibold tracking-tight uppercase">Tipo de Negócio</h2>
        </div>
        <div className="rounded-lg border bg-card p-5 space-y-5">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Tipo de entidade</Label>
            <Select value={businessType} onValueChange={setBusinessType}>
              <SelectTrigger className="h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="eni">Empresário em Nome Individual (ENI)</SelectItem>
                <SelectItem value="empresa">Empresa (Sociedade)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {businessType === 'eni'
                ? 'Atividade exercida em nome pessoal. Pode optar por regime simplificado ou contabilidade organizada.'
                : 'Sociedade com personalidade jurídica própria. Obrigatoriamente com contabilidade organizada e contabilista certificado.'}
            </p>
          </div>

          {/* Activity start date */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Data de início de atividade</Label>
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
            {monthsActive !== null && (
              <p className="text-xs text-muted-foreground">
                {isFirstYear
                  ? `1.º ano de atividade (${monthsActive} meses)`
                  : `${Math.floor(monthsActive / 12)} ano(s) e ${monthsActive % 12} meses de atividade`}
              </p>
            )}
          </div>

          {exemptionGuide && (
            <div className="rounded-md border border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-800 p-4 text-sm text-muted-foreground flex gap-2">
              <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
              <span>{exemptionGuide}</span>
            </div>
          )}
        </div>
      </div>

      <Separator />

      {/* CONFIGURAÇÃO FISCAL */}
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
                <SelectItem value="isento">Isento (art. 53.º)</SelectItem>
                <SelectItem value="trimestral">Trimestral</SelectItem>
                <SelectItem value="mensal">Mensal</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* IVA Exempt toggle */}
          <div className="flex items-center justify-between py-2">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Isento de IVA</Label>
              <p className="text-xs text-muted-foreground">
                {ivaRegime === 'isento'
                  ? 'Ativo por defeito (regime isento art. 53.º)'
                  : isFirstYear
                    ? 'No 1.º ano, podes beneficiar de isenção de IVA'
                    : 'Ativar se tiveres isenção de IVA'}
              </p>
            </div>
            <Switch checked={ivaExempt} onCheckedChange={setIvaExempt} />
          </div>

          {/* SS Exempt toggle */}
          <div className="flex items-center justify-between py-2">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Isento de Segurança Social</Label>
              <p className="text-xs text-muted-foreground">
                {isFirstYear
                  ? 'No 1.º ano, tens isenção automática de SS (12 meses)'
                  : 'Ativar se estiveres isento de Segurança Social'}
              </p>
            </div>
            <Switch checked={ssExempt} onCheckedChange={setSsExempt} />
          </div>

          {/* SS Type — only if not exempt */}
          {!ssExempt && (
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
          )}

          {/* IRS Regime — only for ENI */}
          {businessType === 'eni' && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Regime de contabilidade</Label>
              <Select value={irsRegime} onValueChange={setIrsRegime}>
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="simplificado">Regime simplificado</SelectItem>
                  <SelectItem value="contabilidade_organizada">Contabilidade organizada</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {irsRegime === 'simplificado'
                  ? 'Podes gerir tudo sozinho(a) ou ter um contabilista para apoio mensal.'
                  : 'Obrigatoriamente com contabilista certificado que trata de todas as declarações.'}
              </p>
            </div>
          )}

          {businessType === 'empresa' && (
            <div className="rounded-md border border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-800 p-4 text-sm text-muted-foreground flex gap-2">
              <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <span>Empresa com contabilidade organizada obrigatória. O contabilista trata de todas as declarações fiscais.</span>
            </div>
          )}

          {/* Contabilidade organizada info for ENI */}
          {businessType === 'eni' && isContabOrganizada && (
            <div className="rounded-md border border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-800 p-4 text-sm text-muted-foreground flex gap-2">
              <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <span>Em contabilidade organizada, o IVA e a Segurança Social são geridos pelo contabilista. Essas páginas ficam em modo de guia informativo.</span>
            </div>
          )}
        </div>
      </div>

      <Separator />

      {/* CONTABILISTA & EQUIPA */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-foreground">
          <Users className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
          <h2 className="text-sm font-semibold tracking-tight uppercase">Equipa & Contabilista</h2>
        </div>
        <div className="rounded-lg border bg-card p-5 space-y-5">
          {/* Has accountant */}
          <div className="flex items-center justify-between py-2">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Tem contabilista</Label>
              <p className="text-xs text-muted-foreground">
                {businessType === 'empresa'
                  ? 'Obrigatório para empresas com contabilidade organizada'
                  : isContabOrganizada
                    ? 'Obrigatório em contabilidade organizada'
                    : 'Contabilista contratado para avença mensal'}
              </p>
            </div>
            <Switch
              checked={hasAccountant}
              onCheckedChange={setHasAccountant}
              disabled={isContabOrganizada}
            />
          </div>

          {/* Team type */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Tipo de equipa</Label>
            <Select value={teamType} onValueChange={setTeamType}>
              <SelectTrigger className="h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="externa">Só equipa externa (prestadores de serviços)</SelectItem>
                <SelectItem value="interna">Só equipa interna (contratos de trabalho)</SelectItem>
                <SelectItem value="ambas">Equipa interna e externa</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {teamType === 'externa'
                ? 'Sem contratos de trabalho — não existem ordenados, apenas pagamentos de serviços.'
                : teamType === 'interna'
                  ? 'Equipa com contratos de trabalho — inclui processamento de ordenados.'
                  : 'Equipa mista com contratos de trabalho e prestadores de serviços.'}
            </p>
          </div>
        </div>
      </div>

      <Button onClick={handleSave} disabled={saving} className="gap-2">
        <Save className="h-4 w-4" />
        {saving ? 'A guardar...' : 'Guardar definições fiscais'}
      </Button>
    </div>
  );
}
