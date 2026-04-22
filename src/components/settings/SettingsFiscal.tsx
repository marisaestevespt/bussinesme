import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Save, Receipt, Info, Building2, Users, BookOpen, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { BusinessLegalDocs } from './BusinessLegalDocs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export function SettingsFiscal() {
  const { settings, refetch } = useBusinessSettings();
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);

  // Business setup (NIF, CAE, CIRS)
  const { data: setupData } = useQuery({
    queryKey: ['business-setup'],
    queryFn: async () => {
      const { data } = await supabase.from('business_setup' as any).select('*').maybeSingle();
      return data as any;
    },
  });
  const [nif, setNif] = useState('');
  const [caePrincipal, setCaePrincipal] = useState('');
  const [caeSecundarios, setCaeSecundarios] = useState('');
  const [cirsCode, setCirsCode] = useState('');
  const [niss, setNiss] = useState('');

  useEffect(() => {
    if (!setupData) return;
    setNif(setupData.nif || '');
    setCaePrincipal(setupData.cae_principal || '');
    setCaeSecundarios(setupData.cae_secundarios || '');
    setCirsCode(setupData.cirs_code || '');
    setNiss(setupData.niss || '');
  }, [setupData]);

  const [businessType, setBusinessType] = useState('eni');
  const [ivaRegime, setIvaRegime] = useState('trimestral');
  const [irsRegime, setIrsRegime] = useState('simplificado');
  const [ssType, setSsType] = useState('independente');
  const [teamType, setTeamType] = useState('externa');
  const [hasAccountant, setHasAccountant] = useState(false);
  const [accountantType, setAccountantType] = useState('externo');
  const [accountantMemberId, setAccountantMemberId] = useState<string | null>(null);
  const [activityStartDate, setActivityStartDate] = useState<Date | undefined>();
  const [ssExempt, setSsExempt] = useState(false);
  const [ivaExempt, setIvaExempt] = useState(false);
  const [ivaExemptionEndDate, setIvaExemptionEndDate] = useState<Date | undefined>();
  const [ssExemptionEndDate, setSsExemptionEndDate] = useState<Date | undefined>();

  // Dialog state for capturing the effective date when switching exemption OFF
  const [endDateDialog, setEndDateDialog] = useState<null | 'iva' | 'ss'>(null);
  const [endDateDraft, setEndDateDraft] = useState<Date | undefined>(new Date());

  // Team members for internal accountant picker
  const { data: teamMembers } = useQuery({
    queryKey: ['team-members-fiscal'],
    queryFn: async () => {
      const { data } = await supabase.from('team_members').select('id, full_name').eq('status', 'active').order('full_name');
      return data || [];
    },
  });

  useEffect(() => {
    if (!settings) return;
    const s = settings as any;
    setBusinessType(s.business_type || 'eni');
    setIvaRegime(s.tax_iva_regime || 'trimestral');
    setIrsRegime(s.tax_irs_regime || 'simplificado');
    setSsType(s.ss_type || 'independente');
    setTeamType(s.team_type || 'externa');
    setHasAccountant(s.has_accountant ?? false);
    setAccountantType(s.accountant_type || 'externo');
    setAccountantMemberId(s.accountant_member_id || null);
    setActivityStartDate(s.activity_start_date ? new Date(s.activity_start_date + 'T00:00:00') : undefined);
    setSsExempt(s.ss_exempt ?? false);
    setIvaExempt(s.iva_exempt ?? false);
    setIvaExemptionEndDate(s.iva_exemption_end_date ? new Date(s.iva_exemption_end_date + 'T00:00:00') : undefined);
    setSsExemptionEndDate(s.ss_exemption_end_date ? new Date(s.ss_exemption_end_date + 'T00:00:00') : undefined);
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
          accountant_type: hasAccountant ? accountantType : 'externo',
          accountant_member_id: hasAccountant && accountantType === 'interno' ? accountantMemberId : null,
          activity_start_date: activityStartDate ? format(activityStartDate, 'yyyy-MM-dd') : null,
          ss_exempt: ssExempt,
          iva_exempt: ivaExempt,
          iva_exemption_end_date: ivaExemptionEndDate ? format(ivaExemptionEndDate, 'yyyy-MM-dd') : null,
          ss_exemption_end_date: ssExemptionEndDate ? format(ssExemptionEndDate, 'yyyy-MM-dd') : null,
        } as any)
        .eq('id', settings.id);
      if (error) throw error;

      // Save business_setup fields (NIF, CAE, CIRS)
      const setupPayload = { nif, cae_principal: caePrincipal, cae_secundarios: caeSecundarios, cirs_code: cirsCode, niss };
      if (setupData?.id) {
        const { error: e2 } = await supabase.from('business_setup' as any).update(setupPayload).eq('id', setupData.id);
        if (e2) throw e2;
      } else {
        const { error: e2 } = await supabase.from('business_setup' as any).insert(setupPayload);
        if (e2) throw e2;
      }

      toast.success('Definições fiscais atualizadas!');
      await refetch();
      qc.invalidateQueries({ queryKey: ['business-setup'] });
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
      <div id="sec-tipo-negocio" className="space-y-4 scroll-mt-24">
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

          <BusinessLegalDocs />
        </div>
      </div>

      <Separator />

      {/* IDENTIFICAÇÃO FISCAL */}
      <div id="sec-identificacao-fiscal" className="space-y-4 scroll-mt-24">
        <div className="flex items-center gap-2 text-foreground">
          <FileText className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
          <h2 className="text-sm font-semibold tracking-tight uppercase">Identificação Fiscal</h2>
        </div>
        <div className="rounded-lg border bg-card p-5 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">NIF</Label>
              <Input value={nif} onChange={e => setNif(e.target.value)} placeholder="Número de identificação fiscal" />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">NISS</Label>
              <Input value={niss} onChange={e => setNiss(e.target.value)} placeholder="Número de Identificação da Segurança Social" />
              <p className="text-xs text-muted-foreground">11 dígitos, atribuído pela Segurança Social.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Código(s) CIRS</Label>
              <Input value={cirsCode} onChange={e => setCirsCode(e.target.value)} placeholder="Ex: 1519, 6201 (separados por vírgula)" />
              <p className="text-xs text-muted-foreground">Código(s) da atividade no Código do IRS (tabela do art. 151.º). Separa por vírgula se tiveres mais do que um.</p>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">CAE Principal</Label>
              <Input value={caePrincipal} onChange={e => setCaePrincipal(e.target.value)} placeholder="Ex: 62010" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">CAEs Secundários</Label>
              <Input value={caeSecundarios} onChange={e => setCaeSecundarios(e.target.value)} placeholder="Separados por vírgula" />
            </div>
          </div>
        </div>
      </div>

      <Separator />

      {/* CONFIGURAÇÃO FISCAL */}
      <div id="sec-config-fiscal" className="space-y-4 scroll-mt-24">
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
            <Switch
              checked={ivaExempt}
              onCheckedChange={(v) => {
                if (v) {
                  // Voltou a ser isento → limpa data efetiva
                  setIvaExempt(true);
                  setIvaExemptionEndDate(undefined);
                } else {
                  // Perdeu a isenção → pergunta a partir de quando
                  setEndDateDraft(ivaExemptionEndDate || new Date());
                  setEndDateDialog('iva');
                }
              }}
            />
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
            <Switch
              checked={ssExempt}
              onCheckedChange={(v) => {
                if (v) {
                  setSsExempt(true);
                  setSsExemptionEndDate(undefined);
                } else {
                  setEndDateDraft(ssExemptionEndDate || new Date());
                  setEndDateDialog('ss');
                }
              }}
            />
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
            <div className="rounded-md border border-warning/30 bg-warning/15/50 dark:bg-amber-950/20 dark:border-amber-800 p-4 text-sm text-muted-foreground flex gap-2">
              <Info className="h-4 w-4 text-warning shrink-0 mt-0.5" />
              <span>Empresa com contabilidade organizada obrigatória. O contabilista trata de todas as declarações fiscais.</span>
            </div>
          )}

          {/* Contabilidade organizada info for ENI */}
          {businessType === 'eni' && isContabOrganizada && (
            <div className="rounded-md border border-warning/30 bg-warning/15/50 dark:bg-amber-950/20 dark:border-amber-800 p-4 text-sm text-muted-foreground flex gap-2">
              <Info className="h-4 w-4 text-warning shrink-0 mt-0.5" />
              <span>Em contabilidade organizada, o IVA e a Segurança Social são geridos pelo contabilista. Essas páginas ficam em modo de guia informativo.</span>
            </div>
          )}
        </div>
      </div>

      <Separator />

      {/* CONTABILISTA & EQUIPA */}
      <div id="sec-contabilista-equipa" className="space-y-4 scroll-mt-24">
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

          {/* Accountant type - only when has accountant */}
          {hasAccountant && (
            <>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Tipo de contabilista</Label>
                <Select value={accountantType} onValueChange={setAccountantType}>
                  <SelectTrigger className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="externo">Externo (gabinete de contabilidade)</SelectItem>
                    <SelectItem value="interno">Interno (membro da equipa)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {accountantType === 'externo'
                    ? 'Contabilista externo trata das declarações fiscais. Tarefas de declaração não são criadas.'
                    : 'Contabilista é membro da equipa. Tarefas de declaração são atribuídas a esta pessoa.'}
                </p>
              </div>

              {accountantType === 'interno' && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Contabilista (membro)</Label>
                  <Select value={accountantMemberId || 'none'} onValueChange={v => setAccountantMemberId(v === 'none' ? null : v)}>
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Selecionar membro..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— Nenhum —</SelectItem>
                      {(teamMembers || []).map(m => (
                        <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">As tarefas de declaração fiscal serão atribuídas a este membro.</p>
                </div>
              )}
            </>
          )}

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

      {/* Dialog: a partir de quando deixou de ser isento */}
      <Dialog open={endDateDialog !== null} onOpenChange={(open) => { if (!open) setEndDateDialog(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {endDateDialog === 'iva' ? 'Perda de isenção de IVA' : 'Perda de isenção de Segurança Social'}
            </DialogTitle>
            <DialogDescription>
              A partir de que data deixaste de estar isento? Esta data é usada para calcular obrigações fiscais a partir do momento certo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label className="text-sm font-medium">Data efetiva</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn('w-full justify-start text-left font-normal h-11', !endDateDraft && 'text-muted-foreground')}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {endDateDraft ? format(endDateDraft, 'dd/MM/yyyy') : 'Selecionar data'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={endDateDraft}
                  onSelect={setEndDateDraft}
                  initialFocus
                  className={cn('p-3 pointer-events-auto')}
                />
              </PopoverContent>
            </Popover>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEndDateDialog(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (!endDateDraft) {
                  toast.error('Indica a data efetiva.');
                  return;
                }
                if (endDateDialog === 'iva') {
                  setIvaExempt(false);
                  setIvaExemptionEndDate(endDateDraft);
                } else if (endDateDialog === 'ss') {
                  setSsExempt(false);
                  setSsExemptionEndDate(endDateDraft);
                }
                setEndDateDialog(null);
              }}
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
