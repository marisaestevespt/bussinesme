import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { useFinancialData } from '@/hooks/useFinancialData';
import { useCommercialData } from '@/hooks/useCommercialData';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { computeFiscalDeadlines, getDeadlineStatus, type FiscalConfig, type FiscalDeadline } from '@/lib/fiscalDeadlines';
import { excludeCancelled } from '@/lib/utils';
import { exportCsv } from '@/lib/exportCsv';
import { exportPdf } from '@/lib/exportPdf';
import { CalendarCheck, CheckSquare, Download, FileSpreadsheet, Info, AlertTriangle, Clock, ListPlus } from 'lucide-react';
import { format } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

const fmt = (v: number) => v.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
const ML = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

interface Props {
  currentYear: number;
}

export function FinContabilidade({ currentYear }: Props) {
  const { settings } = useBusinessSettings();
  const { user } = useAuth();
  const fin = useFinancialData();
  const com = useCommercialData(currentYear);
  const [creatingTask, setCreatingTask] = useState<string | null>(null);
  const qc = useQueryClient();

  // Export state
  const [exportPeriod, setExportPeriod] = useState<'month' | 'quarter' | 'year' | 'custom'>('month');
  const [exportMonth, setExportMonth] = useState(new Date().getMonth() + 1);
  const [exportQuarter, setExportQuarter] = useState(Math.ceil((new Date().getMonth() + 1) / 3));
  const [exportStartDate, setExportStartDate] = useState<Date | undefined>();
  const [exportEndDate, setExportEndDate] = useState<Date | undefined>();

  const s = settings as any;
  const fiscalConfig: FiscalConfig = {
    taxIvaRegime: s?.tax_iva_regime || 'trimestral',
    taxIrsRegime: s?.tax_irs_regime || 'simplificado',
    ssExempt: s?.ss_exempt ?? false,
    ivaExempt: s?.iva_exempt ?? false,
    hasAccountant: s?.has_accountant ?? false,
  };

  const isContabOrganizada = fiscalConfig.taxIrsRegime === 'contabilidade_organizada';
  const hasAccountant = s?.has_accountant ?? false;
  const accountantMemberId = s?.accountant_member_id || null;

  // Get the accountant's profile. has_accountant is kept in sync with accountant_member_id by a DB trigger.
  const { data: accountantMember } = useQuery({
    queryKey: ['accountant-member', accountantMemberId],
    enabled: !!accountantMemberId,
    queryFn: async () => {
      const { data } = await supabase.from('team_members').select('id, full_name, profile_id').eq('id', accountantMemberId).maybeSingle();
      return data;
    },
  });

  const deadlines = useMemo(() => {
    // computeFiscalDeadlines now hides SS/IVA when hasAccountant=true; only IRS remains.
    return computeFiscalDeadlines(currentYear, fiscalConfig)
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [currentYear, fiscalConfig]);

  // Fiscal deadline completions
  const { data: completions = [] } = useQuery({
    queryKey: ['fiscal-deadline-completions', currentYear],
    queryFn: async () => {
      const { data } = await supabase.from('fiscal_deadline_completions' as any).select('*').eq('year', currentYear);
      return (data || []) as unknown as { id: string; deadline_key: string; year: number; completed_by: string }[];
    },
  });

  // IRS is also tracked in fiscal_monthly_checks (used by the Mensal page).
  // Mirror that state here so a tick on either page reflects on both.
  const { data: irsMonthlyChecks = [] } = useQuery({
    queryKey: ['fiscal-monthly-checks-irs', currentYear],
    queryFn: async () => {
      const { data } = await supabase
        .from('fiscal_monthly_checks')
        .select('*')
        .eq('year', currentYear)
        .in('check_key', ['irs_start']);
      return data || [];
    },
  });
  const irsDoneAnnual = useMemo(
    () => irsMonthlyChecks.some((c: any) => c.check_key === 'irs_start' && c.checked),
    [irsMonthlyChecks],
  );

  const completedKeys = useMemo(() => {
    const set = new Set(completions.map(c => c.deadline_key));
    if (irsDoneAnnual) {
      // IRS deadlines in this year (e.g. irs-start-YYYY, irs-end-YYYY)
      set.add(`irs-start-${currentYear}`);
      set.add(`irs-end-${currentYear}`);
      // Some deadlines are computed for the *previous* year's tax campaign
      set.add(`irs-start-${currentYear - 1}`);
      set.add(`irs-end-${currentYear - 1}`);
    }
    return set;
  }, [completions, irsDoneAnnual, currentYear]);

  const toggleDeadlineCompletion = useMutation({
    mutationFn: async (dl: FiscalDeadline) => {
      if (!user) throw new Error('Not authenticated');
      // IRS rows mirror to fiscal_monthly_checks so the Mensal page stays in sync.
      if (dl.category === 'irs') {
        const existingMonthly = irsMonthlyChecks.find((c: any) => c.check_key === 'irs_start');
        const nowChecked = !irsDoneAnnual;
        if (existingMonthly) {
          await supabase
            .from('fiscal_monthly_checks')
            .update({ checked: nowChecked, checked_at: nowChecked ? new Date().toISOString() : null })
            .eq('id', (existingMonthly as any).id);
        } else if (nowChecked) {
          await supabase
            .from('fiscal_monthly_checks')
            .insert({ year: currentYear, month: 4, check_key: 'irs_start', checked: true, checked_at: new Date().toISOString() });
        }
        return;
      }
      const existing = completions.find(c => c.deadline_key === dl.key);
      if (existing) {
        await supabase.from('fiscal_deadline_completions' as any).delete().eq('id', existing.id);
      } else {
        await supabase.from('fiscal_deadline_completions' as any).insert({ deadline_key: dl.key, year: currentYear, completed_by: user.id });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fiscal-deadline-completions', currentYear] });
      qc.invalidateQueries({ queryKey: ['fiscal-monthly-checks-irs', currentYear] });
      qc.invalidateQueries({ queryKey: ['fiscal-checks-annual', currentYear] });
    },
    onError: () => toast.error('Erro ao atualizar estado'),
  });

  const todayStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  const handleCreateTask = async (dl: FiscalDeadline) => {
    if (!user) return;
    setCreatingTask(dl.key);
    try {
      // Check for duplicate
      const { data: existing } = await supabase
        .from('tasks')
        .select('id')
        .eq('name', dl.name)
        .limit(1);
      if (existing && existing.length > 0) {
        toast.info('Já existe uma tarefa com este nome.');
        return;
      }

      // Assignment: declarations go to the accountant if linked; payments and everything else → owner.
      let assignedTo = user.id;
      if (dl.deadline_type === 'declaracao' && hasAccountant && accountantMember?.profile_id) {
        assignedTo = accountantMember.profile_id;
      }

      await supabase.from('tasks').insert({
        name: dl.name,
        status: 'por_comecar',
        priority: 'alta',
        deadline: dl.date,
        department: 'contabilidade',
        created_by: user.id,
        assigned_to: assignedTo,
        tag: 'Fiscal',
      });
      toast.success('Tarefa criada!');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao criar tarefa');
    } finally {
      setCreatingTask(null);
    }
  };

  // ── Export logic ──
  const sales = excludeCancelled(com.sales.data || []);
  const expenses = excludeCancelled(fin.expenses.data || []);
  const documents = fin.documents.data || [];

  const getExportRange = (): { startMonth: number; endMonth: number; label: string } => {
    switch (exportPeriod) {
      case 'month': return { startMonth: exportMonth, endMonth: exportMonth, label: `${ML[exportMonth - 1]} ${currentYear}` };
      case 'quarter': {
        const s = (exportQuarter - 1) * 3 + 1;
        return { startMonth: s, endMonth: s + 2, label: `T${exportQuarter} ${currentYear}` };
      }
      case 'year': return { startMonth: 1, endMonth: 12, label: `Ano ${currentYear}` };
      default: return { startMonth: 1, endMonth: 12, label: `Personalizado` };
    }
  };

  const getFilteredData = () => {
    const range = getExportRange();
    if (exportPeriod === 'custom' && exportStartDate && exportEndDate) {
      const startStr = format(exportStartDate, 'yyyy-MM-dd');
      const endStr = format(exportEndDate, 'yyyy-MM-dd');
      return {
        label: `${format(exportStartDate, 'dd/MM/yyyy')} — ${format(exportEndDate, 'dd/MM/yyyy')}`,
        filteredSales: sales.filter(s => s.payment_date && s.payment_date >= startStr && s.payment_date <= endStr),
        filteredExpenses: expenses.filter(e => e.expense_date && e.expense_date >= startStr && e.expense_date <= endStr),
        filteredDocs: documents.filter(d => d.period_start != null && d.period_start >= startStr && d.period_start <= endStr),
      };
    }
    return {
      label: range.label,
      filteredSales: sales.filter(s => s.sale_year === currentYear && s.sale_month && s.sale_month >= range.startMonth && s.sale_month <= range.endMonth),
      filteredExpenses: expenses.filter(e => e.expense_year === currentYear && e.expense_month && e.expense_month >= range.startMonth && e.expense_month <= range.endMonth),
      filteredDocs: documents.filter(d => {
        return d.period_year === currentYear && d.period_month != null && d.period_month >= range.startMonth && d.period_month <= range.endMonth;
      }),
    };
  };

  const handleExportExcel = () => {
    const { label, filteredSales, filteredExpenses, filteredDocs } = getFilteredData();
    const businessName = settings?.business_name || 'Negócio';

    // Entradas sheet — with client data
    const salesHeaders = ['Data', 'Descrição', 'Produto', 'Cliente', 'NIF Cliente', 'Valor s/IVA', 'IVA', 'Valor c/IVA', 'Nº Documento'];
    const salesRows = filteredSales.map((s: any) => [
      s.payment_date || '', s.description || '', s.product || '', s.client || '', s.client_nif || '', s.base_value, s.invoice_total - s.base_value, s.invoice_total, s.sale_id,
    ]);

    // Saídas sheet — with location (PT/UE/Fora UE)
    const LOC_EXPORT: Record<string, string> = { portugal: 'Portugal', ue: 'UE', fora_ue: 'Fora UE' };
    const expHeaders = ['Data', 'Descrição', 'Categoria', 'Fornecedor', 'Localização', 'Valor s/IVA', 'IVA (%)', 'IVA (€)', 'Valor c/IVA', 'Departamento', 'Nº Documento'];
    const expRows = filteredExpenses.map((e: any) => [
      e.expense_date || '', e.description || '', e.category || '', e.supplier_name || '', LOC_EXPORT[e.location] || e.location || '', e.base_value, e.vat_rate ?? 0, e.total_with_vat - e.base_value, e.total_with_vat, e.department || '', e.expense_id,
    ]);

    const totalEnt = filteredSales.reduce((s, v) => s + v.invoice_total, 0);
    const totalSai = filteredExpenses.reduce((s, v) => s + v.total_with_vat, 0);

    const pad = (arr: any[], len: number) => [...arr, ...Array(Math.max(0, len - arr.length)).fill('')];
    const colCount = Math.max(salesHeaders.length, expHeaders.length) + 1;

    const allHeaders = ['Secção', ...expHeaders]; // use wider headers
    const allRows: (string | number)[][] = [
      pad(['RESUMO', businessName], colCount),
      pad(['', 'Período', label], colCount),
      pad(['', 'Total Entradas', '', '', '', fmt(totalEnt)], colCount),
      pad(['', 'Total Saídas', '', '', '', fmt(totalSai)], colCount),
      pad(['', 'Resultado', '', '', '', fmt(totalEnt - totalSai)], colCount),
      pad([], colCount),
      pad(['ENTRADAS', ...salesHeaders], colCount),
      ...salesRows.map(r => pad(['', ...r], colCount)),
      pad([], colCount),
      ['SAÍDAS', ...expHeaders],
      ...expRows.map(r => ['', ...r]),
    ];

    // Bank statements + Meta Ads docs
    const bankDocs = filteredDocs.filter(d => (d as any).doc_type === 'extrato_bancario');
    const metaDocs = filteredDocs.filter(d => (d as any).doc_type === 'meta_ads_report');
    const otherDocs = filteredDocs.filter(d => (d as any).doc_type !== 'extrato_bancario' && (d as any).doc_type !== 'meta_ads_report');

    if (bankDocs.length > 0) {
      allRows.push(pad([], colCount));
      allRows.push(pad(['EXTRATOS BANCÁRIOS', 'Nome', 'Mês', 'URL'], colCount));
      bankDocs.forEach(d => allRows.push(pad(['', d.document_name || d.title || '', `${(d as any).period_month}/${(d as any).period_year}`, (d as any).document_url || ''], colCount)));
    }
    if (metaDocs.length > 0) {
      allRows.push(pad([], colCount));
      allRows.push(pad(['RELATÓRIOS META ADS', 'Nome', 'Mês', 'URL'], colCount));
      metaDocs.forEach(d => allRows.push(pad(['', d.document_name || d.title || '', `${(d as any).period_month}/${(d as any).period_year}`, (d as any).document_url || ''], colCount)));
    }
    if (otherDocs.length > 0) {
      allRows.push(pad([], colCount));
      allRows.push(pad(['DOCUMENTOS', 'Nome', 'Data'], colCount));
      otherDocs.forEach(d => allRows.push(pad(['', d.document_name || d.title || '', d.period_start || ''], colCount)));
    }

    exportCsv(`contabilidade_${label.replace(/\s/g, '_')}.csv`, allHeaders, allRows);
    toast.success('Excel exportado!');
  };

  const handleExportPdf = () => {
    exportPdf(`Contabilidade — ${getExportRange().label}`, 'contabilidade-export-area');
    toast.success('PDF a gerar...');
  };

  const { label: exportLabel, filteredSales, filteredExpenses, filteredDocs } = getFilteredData();
  const totalEnt = filteredSales.reduce((s, v) => s + v.invoice_total, 0);
  const totalSai = filteredExpenses.reduce((s, v) => s + v.total_with_vat, 0);

  return (
    <div className="space-y-8">
      {/* ── Prazos Fiscais ── */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <CalendarCheck className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold tracking-tight uppercase">Prazos Fiscais — {currentYear}</h2>
        </div>

        {isContabOrganizada ? (
          <Card className="border-warning/30 bg-warning/15/50 dark:bg-amber-950/20 dark:border-amber-800">
            <CardContent className="pt-4 flex gap-2">
              <Info className="h-4 w-4 text-warning shrink-0 mt-0.5" />
              <p className="text-sm text-muted-foreground">Em contabilidade organizada, os prazos fiscais são geridos pelo teu contabilista.</p>
            </CardContent>
          </Card>
        ) : deadlines.length === 0 ? (
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Sem prazos fiscais activos. Configura o regime fiscal nas Definições.</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Prazo</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Data Limite</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Atribuído a</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deadlines.map(dl => {
                    const isCompleted = completedKeys.has(dl.key);
                    const status = isCompleted ? 'done' : getDeadlineStatus(dl.date, todayStr);
                    const assigneeName = hasAccountant && accountantMember?.full_name
                      ? accountantMember.full_name
                      : 'Owner';
                    return (
                      <TableRow key={dl.key} className={isCompleted ? 'opacity-60' : ''}>
                        <TableCell className="font-medium">{dl.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px]">
                            {dl.deadline_type === 'pagamento' ? 'Pagamento' : 'Declaração'}
                          </Badge>
                        </TableCell>
                        <TableCell>{new Date(dl.date + 'T00:00:00').toLocaleDateString('pt-PT')}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Checkbox
                              checked={isCompleted}
                              onCheckedChange={() => toggleDeadlineCompletion.mutate(dl)}
                            />
                            {status === 'done' && <Badge className="bg-success/10 text-success gap-1"><CheckSquare className="h-3 w-3" /> Concluído</Badge>}
                            {status === 'overdue' && <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" /> Em atraso</Badge>}
                            {status === 'soon' && <Badge className="bg-warning/15 text-warning dark:bg-amber-900/30 dark:text-amber-400 gap-1"><Clock className="h-3 w-3" /> Próximo</Badge>}
                            {status === 'upcoming' && <Badge variant="secondary" className="gap-1">Por vir</Badge>}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{assigneeName}</TableCell>
                        <TableCell className="text-right">
                          {!isCompleted && (
                            <Button
                              size="icon"
                              variant="ghost"
                              disabled={creatingTask === dl.key}
                              onClick={() => handleCreateTask(dl)}
                              title="Criar tarefa"
                              aria-label="Criar tarefa"
                              className="h-8 w-8"
                            >
                              <ListPlus className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ── Exportar para Contabilista ── */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Download className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold tracking-tight uppercase">Exportar para Contabilista</h2>
        </div>

        <Card>
          <CardContent className="pt-5 space-y-4">
            <div className="flex flex-wrap gap-3 items-end">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Período</Label>
                <Select value={exportPeriod} onValueChange={(v: any) => setExportPeriod(v)}>
                  <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="month">Mês</SelectItem>
                    <SelectItem value="quarter">Trimestre</SelectItem>
                    <SelectItem value="year">Ano</SelectItem>
                    <SelectItem value="custom">Personalizado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {exportPeriod === 'month' && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Mês</Label>
                  <Select value={String(exportMonth)} onValueChange={v => setExportMonth(Number(v))}>
                    <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ML.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {exportPeriod === 'quarter' && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Trimestre</Label>
                  <Select value={String(exportQuarter)} onValueChange={v => setExportQuarter(Number(v))}>
                    <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">T1 (Jan-Mar)</SelectItem>
                      <SelectItem value="2">T2 (Abr-Jun)</SelectItem>
                      <SelectItem value="3">T3 (Jul-Set)</SelectItem>
                      <SelectItem value="4">T4 (Out-Dez)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {exportPeriod === 'custom' && (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Início</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn('w-36 justify-start text-left font-normal', !exportStartDate && 'text-muted-foreground')}>
                          <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                          {exportStartDate ? format(exportStartDate, 'dd/MM/yyyy') : 'De'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={exportStartDate} onSelect={setExportStartDate} initialFocus className="p-3 pointer-events-auto" />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Fim</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn('w-36 justify-start text-left font-normal', !exportEndDate && 'text-muted-foreground')}>
                          <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                          {exportEndDate ? format(exportEndDate, 'dd/MM/yyyy') : 'Até'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={exportEndDate} onSelect={setExportEndDate} initialFocus className="p-3 pointer-events-auto" />
                      </PopoverContent>
                    </Popover>
                  </div>
                </>
              )}

              <Button variant="outline" onClick={handleExportPdf} className="gap-1.5">
                <Download className="h-3.5 w-3.5" /> Exportar PDF
              </Button>
              <Button variant="outline" onClick={handleExportExcel} className="gap-1.5">
                <FileSpreadsheet className="h-3.5 w-3.5" /> Exportar Excel
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Hidden export area for PDF */}
        <div id="contabilidade-export-area" className="hidden print:block">
          <h2 className="text-lg font-bold mb-2">{settings?.business_name || 'Negócio'}</h2>
          <p className="text-sm text-muted-foreground mb-4">Período: {exportLabel}</p>

          <h3 className="font-semibold mt-4 mb-2">Resumo</h3>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div><p className="text-xs text-muted-foreground">Total Entradas</p><p className="font-bold">{fmt(totalEnt)}</p></div>
            <div><p className="text-xs text-muted-foreground">Total Saídas</p><p className="font-bold">{fmt(totalSai)}</p></div>
            <div><p className="text-xs text-muted-foreground">Resultado</p><p className="font-bold">{fmt(totalEnt - totalSai)}</p></div>
          </div>

          <h3 className="font-semibold mt-4 mb-2">Entradas</h3>
          <table className="w-full text-xs">
            <thead><tr><th>Data</th><th>Descrição</th><th>Valor s/IVA</th><th>IVA</th><th>Valor c/IVA</th><th>Nº Doc</th></tr></thead>
            <tbody>
              {filteredSales.map(s => (
                <tr key={s.id}><td>{s.payment_date}</td><td>{s.description || s.client}</td><td className="text-right">{fmt(s.base_value)}</td><td className="text-right">{fmt(s.invoice_total - s.base_value)}</td><td className="text-right">{fmt(s.invoice_total)}</td><td>{s.sale_id}</td></tr>
              ))}
            </tbody>
          </table>

          <h3 className="font-semibold mt-4 mb-2">Saídas</h3>
          <table className="w-full text-xs">
            <thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Valor s/IVA</th><th>IVA</th><th>Valor c/IVA</th><th>Nº Doc</th></tr></thead>
            <tbody>
              {filteredExpenses.map(e => (
                <tr key={e.id}><td>{e.expense_date}</td><td>{e.description}</td><td>{e.category}</td><td className="text-right">{fmt(e.base_value)}</td><td className="text-right">{fmt(e.total_with_vat - e.base_value)}</td><td className="text-right">{fmt(e.total_with_vat)}</td><td>{e.expense_id}</td></tr>
              ))}
            </tbody>
          </table>

          {filteredDocs.length > 0 && (
            <>
              <h3 className="font-semibold mt-4 mb-2">Documentos</h3>
              <table className="w-full text-xs">
                <thead><tr><th>Nome</th><th>Data</th></tr></thead>
                <tbody>
                  {filteredDocs.map(d => (<tr key={d.id}><td>{d.document_name || d.title}</td><td>{d.period_start}</td></tr>))}
                </tbody>
              </table>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn('text-sm font-medium', className)}>{children}</span>;
}
