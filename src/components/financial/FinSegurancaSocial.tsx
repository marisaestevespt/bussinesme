import { useMemo, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Save, Info, Download } from 'lucide-react';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import type { useFinancialData } from '@/hooks/useFinancialData';
import type { Expense } from '@/hooks/useFinancialData';
import { FinDocumentsUpload, type FinDocItem } from './FinDocumentsUpload';
import { exportCsv } from '@/lib/exportCsv';
import { exportPdf } from '@/lib/exportPdf';
import {
  computeSsIndependente,
  computeSsPatronalForMonth,
  buildIndependenteQuarterMap,
  SS_EMPLOYER_RATE,
  SS_EMPLOYEE_RATE,
  SS_INDEPENDENTE_RATE,
  SS_RENDIMENTO_RELEVANTE,
} from '@/lib/payrollCalculations';

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

const fmt = (v: number) => v.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

interface Props {
  fin: ReturnType<typeof useFinancialData>;
  expenses: Expense[];
  currentYear: number;
  sales: { invoice_total: number; base_value: number; sale_month: number | null; sale_year: number | null }[];
}

type Sale = Props['sales'][number];

export function FinSegurancaSocial({ fin, expenses, currentYear, sales }: Props) {
  const { settings } = useBusinessSettings();
  const s = settings as any;
  const ssType: string = s?.ss_type || 'independente';
  const showIndependente = ssType === 'independente' || ssType === 'ambos';
  const showPatronal = ssType === 'entidade_patronal' || ssType === 'ambos';
  const defaultTab = ssType === 'entidade_patronal' ? 'patronal' : 'independente';

  // Fetch active member contracts with contrato_trabalho only
  const { data: contracts = [] } = useQuery({
    queryKey: ['member-contracts-ss', currentYear],
    queryFn: async () => {
      const { data } = await supabase
        .from('member_contracts')
        .select('*, team_members(id, full_name)')
        .eq('contract_type', 'contrato_trabalho')
        .in('status', ['ativo']);
      return data || [];
    },
    enabled: showPatronal,
  });

  // Payroll entries for the year
  const { data: payrollEntries = [] } = useQuery({
    queryKey: ['financial-payroll-ss', currentYear],
    queryFn: async () => {
      const { data } = await supabase
        .from('financial_payroll')
        .select('*')
        .eq('year', currentYear);
      return data || [];
    },
    enabled: showPatronal,
  });

  // SS expenses from financial_expenses
  const ssExpenses = useMemo(() =>
    expenses.filter(e => e.category === 'seguranca_social' && e.expense_year === currentYear),
    [expenses, currentYear]
  );

  // ── Independente calculations ──
  // Need both current and previous year sales for quarter mapping
  const prevYear = currentYear - 1;

  const salesByQuarter = useMemo(() => {
    // Build a map: "YYYY-Q" -> total revenue
    const map: Record<string, number> = {};
    sales.forEach(sl => {
      if (!sl.sale_month || !sl.sale_year) return;
      const q = Math.ceil(sl.sale_month / 3);
      const key = `${sl.sale_year}-Q${q}`;
      map[key] = (map[key] || 0) + sl.invoice_total;
    });
    return map;
  }, [sales]);

  const QUARTER_MAP = useMemo(() => buildIndependenteQuarterMap(currentYear), [currentYear]);

  const independenteData = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const mapping = QUARTER_MAP.find(qm => qm.months.includes(m))!;
      const key = `${mapping.srcYear}-Q${mapping.srcQ}`;
      const quarterRevenue = salesByQuarter[key] || 0;
      const hasData = key in salesByQuarter;

      const calc = computeSsIndependente(quarterRevenue);

      const paid = ssExpenses.find(e => e.expense_month === m && e.description?.toLowerCase().includes('independente'));

      return {
        month: m,
        quarterRevenue: calc.quarterRevenue,
        rendimentoRelevante: calc.rendimentoRelevante,
        baseIncidencia: calc.baseIncidencia,
        contribution: calc.contribution,
        paid: paid?.total_with_vat ?? 0,
        isPaid: (paid?.total_with_vat ?? 0) > 0,
        hasData,
        srcLabel: mapping.srcLabel,
        declMonth: mapping.declMonth,
        declYear: mapping.declYear,
      };
    });
  }, [salesByQuarter, ssExpenses, QUARTER_MAP]);

  // ── Patronal calculations ──
  const contractMemberIds = useMemo(() => new Set(contracts.map((c: any) => c.member_id)), [contracts]);

  const relevantPayroll = useMemo(() =>
    payrollEntries.filter((p: any) => {
      const memberName = (p as any).collaborator_name || '';
      return contracts.some((c: any) => (c.team_members as any)?.full_name === memberName);
    }),
    [payrollEntries, contracts]
  );

  const patronalData = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const monthPayroll = relevantPayroll.filter((p: any) => p.month === m);
      const { totalGross, ssEmployer, ssEmployee, totalSS } = computeSsPatronalForMonth(monthPayroll);

      const paid = ssExpenses.find(e => e.expense_month === m && !e.description?.toLowerCase().includes('independente'));

      return {
        month: m,
        totalGross,
        ssEmployer,
        ssEmployee,
        totalSS,
        paid: paid?.total_with_vat ?? 0,
        isPaid: (paid?.total_with_vat ?? 0) > 0,
        expenseEntry: paid,
      };
    });
  }, [relevantPayroll, ssExpenses]);

  // ── Save handlers ──
  const handleSavePayment = async (month: number, value: number, type: 'independente' | 'patronal') => {
    const prefix = type === 'independente' ? 'SS Independente' : 'Segurança Social';
    const existing = ssExpenses.find(e =>
      e.expense_month === month &&
      (type === 'independente' ? e.description?.toLowerCase().includes('independente') : !e.description?.toLowerCase().includes('independente'))
    );
    const dateStr = `${currentYear}-${String(month).padStart(2, '0')}-15`;

    if (existing) {
      await fin.upsertExpense.mutateAsync({
        id: existing.id,
        total_with_vat: value,
        base_value: value,
        status: 'pago_falta_fatura',
        description: `${prefix} — ${MONTHS[month - 1]} ${currentYear}`,
      } as any);
    } else if (value > 0) {
      await fin.upsertExpense.mutateAsync({
        description: `${prefix} — ${MONTHS[month - 1]} ${currentYear}`,
        category: 'seguranca_social',
        base_value: value,
        vat_rate: 0,
        total_with_vat: value,
        location: 'portugal',
        expense_date: dateStr,
        expense_month: month,
        expense_quarter: Math.ceil(month / 3),
        expense_year: currentYear,
        status: 'pago_falta_fatura',
      } as any);
    }
    toast.success(`${prefix} de ${MONTHS[month - 1]} guardada`);
  };

  const handleTogglePayment = async (month: number, type: 'independente' | 'patronal') => {
    const existing = ssExpenses.find(e =>
      e.expense_month === month &&
      (type === 'independente' ? e.description?.toLowerCase().includes('independente') : !e.description?.toLowerCase().includes('independente'))
    );
    if (existing) {
      const newStatus = ['pago_falta_fatura', 'tudo_ok'].includes(existing.status) ? 'por_pagar' : 'pago_falta_fatura';
      await fin.upsertExpense.mutateAsync({
        id: existing.id,
        status: newStatus,
      } as any);
      toast.success(newStatus === 'pago_falta_fatura' ? `Marcada como paga` : `Marcada como pendente`);
    }
  };

  // SS documents
  const ssDoc = useMemo(() => {
    const doc = (fin.documents.data || []).find(d => d.doc_type === 'ss_declarations' && d.period_year === currentYear);
    return doc;
  }, [fin.documents.data, currentYear]);

  const ssDocuments: FinDocItem[] = useMemo(() => {
    if (!ssDoc?.notes) return [];
    try { return JSON.parse(ssDoc.notes); } catch { return []; }
  }, [ssDoc]);

  const handleDocsUpdate = useCallback(async (docs: FinDocItem[]) => {
    await fin.upsertDocument.mutateAsync({
      ...(ssDoc ? { id: ssDoc.id } : {}),
      title: `Declarações SS ${currentYear}`,
      doc_type: 'ss_declarations',
      period_year: currentYear,
      notes: JSON.stringify(docs),
      status: 'ativo',
    });
  }, [ssDoc, currentYear, fin]);

  // Totals
  const totalIndPrevisto = independenteData.reduce((s, d) => s + d.contribution, 0);
  const totalIndPago = independenteData.reduce((s, d) => s + d.paid, 0);
  const totalPatPrevisto = patronalData.reduce((s, d) => s + d.ssEmployer, 0);
  const totalPatPago = patronalData.reduce((s, d) => s + d.paid, 0);

  const hasBothTabs = showIndependente && showPatronal;

  const handleExportCsv = () => {
    if (showIndependente) {
      const headers = ['Mês', 'Rendimento Trimestre', 'Rend. Relevante (70%)', 'SS Prevista', 'SS Paga'];
      const rows = independenteData.map(d => [MONTHS[d.month - 1], d.quarterRevenue, d.rendimentoRelevante, d.contribution, d.paid]);
      exportCsv(`ss_independente_${currentYear}.csv`, headers, rows);
    }
    if (showPatronal) {
      const headers = ['Mês', 'Salário Bruto', 'SS Entidade', 'SS Trabalhador', 'SS Total', 'SS Paga'];
      const rows = patronalData.map(d => [MONTHS[d.month - 1], d.totalGross, d.ssEmployer, d.ssEmployee, d.totalSS, d.paid]);
      exportCsv(`ss_patronal_${currentYear}.csv`, headers, rows);
    }
    toast.success('CSV exportado');
  };

  return (
    <div className="space-y-6 mt-4">
      <div className="flex items-center justify-end gap-2">
        <Button size="sm" variant="outline" onClick={handleExportCsv}><Download className="h-3.5 w-3.5 mr-1" /> CSV</Button>
        <Button size="sm" variant="outline" onClick={() => { exportPdf(`Segurança Social — ${currentYear}`, 'fin-ss-export'); toast.success('PDF a gerar...'); }}><Download className="h-3.5 w-3.5 mr-1" /> PDF</Button>
      </div>
      <div id="fin-ss-export">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {showIndependente && (
          <>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">SS Independente Prevista</p>
                <p className="text-lg font-bold">{fmt(totalIndPrevisto)}</p>
                <p className="text-[10px] text-muted-foreground">21,4% s/ 70% faturação</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">SS Independente Paga</p>
                <p className="text-lg font-bold">{fmt(totalIndPago)}</p>
              </CardContent>
            </Card>
          </>
        )}
        {showPatronal && (
          <>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">SS Patronal Prevista</p>
                <p className="text-lg font-bold">{fmt(totalPatPrevisto)}</p>
                <p className="text-[10px] text-muted-foreground">23,75% s/ salários brutos</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">SS Patronal Paga</p>
                <p className="text-lg font-bold">{fmt(totalPatPago)}</p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {hasBothTabs ? (
        <Tabs defaultValue={defaultTab}>
          <TabsList>
            <TabsTrigger value="independente">Independente / ENI</TabsTrigger>
            <TabsTrigger value="patronal">Patronal</TabsTrigger>
          </TabsList>
          <TabsContent value="independente">
            <IndependenteSection
              data={independenteData}
              currentYear={currentYear}
              onSave={(m, v) => handleSavePayment(m, v, 'independente')}
              onToggle={(m) => handleTogglePayment(m, 'independente')}
            />
          </TabsContent>
          <TabsContent value="patronal">
            <PatronalSection
              data={patronalData}
              contracts={contracts}
              currentYear={currentYear}
              onSave={(m, v) => handleSavePayment(m, v, 'patronal')}
              onToggle={(m) => handleTogglePayment(m, 'patronal')}
            />
          </TabsContent>
        </Tabs>
      ) : showIndependente ? (
        <IndependenteSection
          data={independenteData}
          currentYear={currentYear}
          onSave={(m, v) => handleSavePayment(m, v, 'independente')}
          onToggle={(m) => handleTogglePayment(m, 'independente')}
        />
      ) : (
        <PatronalSection
          data={patronalData}
          contracts={contracts}
          currentYear={currentYear}
          onSave={(m, v) => handleSavePayment(m, v, 'patronal')}
          onToggle={(m) => handleTogglePayment(m, 'patronal')}
        />
      )}

      {/* Documentos */}
      <FinDocumentsUpload
        title={`Declarações de Segurança Social — ${currentYear}`}
        documents={ssDocuments}
        onUpdate={handleDocsUpdate}
      />
      </div>
    </div>
  );
}

// ── Independente Section ──
function IndependenteSection({ data, currentYear, onSave, onToggle }: {
  data: { month: number; quarterRevenue: number; rendimentoRelevante: number; baseIncidencia: number; contribution: number; paid: number; isPaid: boolean; hasData: boolean; srcLabel: string; declMonth: string; declYear: number }[];
  currentYear: number;
  onSave: (month: number, value: number) => Promise<void>;
  onToggle: (month: number) => Promise<void>;
}) {
  const total = data.reduce((s, d) => s + d.contribution, 0);

  // Group months by their source quarter for visual clarity
  const quarterGroups = [
    { label: 'Jan — Mar', months: [1, 2, 3] },
    { label: 'Abr — Jun', months: [4, 5, 6] },
    { label: 'Jul — Set', months: [7, 8, 9] },
    { label: 'Out — Dez', months: [10, 11, 12] },
  ];

  return (
    <div className="space-y-4">
      <Card className="border-info/30 bg-info/15/50 dark:bg-blue-950/20 dark:border-blue-800">
        <CardContent className="pt-4 flex gap-2">
          <Info className="h-4 w-4 text-info shrink-0 mt-0.5" />
          <div className="text-sm text-muted-foreground space-y-1">
            <p><strong>Como funciona:</strong> Declaras a faturação do trimestre → essa declaração define a contribuição do mês da declaração + 2 meses seguintes.</p>
            <p>Faturação × 70% = Rendimento relevante → ÷ 3 = Base mensal → × 21,4% = Contribuição. Mínimo: contribuição mínima mensal.</p>
            <p className="text-xs">Declaração: Jan (Out-Dez anterior) · Abr (Jan-Mar) · Jul (Abr-Jun) · Out (Jul-Set). Pagamento: dia 10-20 do mês seguinte.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Contribuições Independente — {currentYear}</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mês</TableHead>
                <TableHead className="text-right">Fat. Trimestre</TableHead>
                <TableHead className="text-right">Rend. Relevante</TableHead>
                <TableHead className="text-right">Base Mensal</TableHead>
                <TableHead className="text-right">Contribuição</TableHead>
                <TableHead className="text-right">Pago</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-[140px]">Registar</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {quarterGroups.map((group) => {
                const groupData = data.filter(d => group.months.includes(d.month));
                return (
                  <>
                    {/* Quarter header row */}
                    <TableRow key={`header-${group.label}`} className="border-t-2 bg-muted/30">
                      <TableCell colSpan={9} className="py-1.5">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-semibold text-foreground">{group.label}</span>
                          <span className="text-muted-foreground">— Base: {groupData[0].srcLabel}</span>
                          <span className="text-muted-foreground">· Declaração: {groupData[0].declMonth} {groupData[0].declYear}</span>
                          {!groupData[0].hasData && (
                            <Badge variant="outline" className="text-[10px] bg-warning/15 text-warning border-warning/30 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-700">
                              Sem dados de faturação
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                    {groupData.map(d => (
                      <PaymentRow
                        key={d.month}
                        month={d.month}
                        predicted={d.contribution}
                        paid={d.paid}
                        isPaid={d.isPaid}
                        onSave={onSave}
                        onToggle={onToggle}
                        extraCells={
                          <>
                            <TableCell className="text-right text-muted-foreground">{d.hasData && d.quarterRevenue > 0 ? fmt(d.quarterRevenue) : '—'}</TableCell>
                            <TableCell className="text-right text-muted-foreground">{d.hasData && d.rendimentoRelevante > 0 ? fmt(d.rendimentoRelevante) : '—'}</TableCell>
                            <TableCell className="text-right">{d.hasData && d.baseIncidencia > 0 ? fmt(d.baseIncidencia) : '—'}</TableCell>
                          </>
                        }
                      />
                    ))}
                  </>
                );
              })}
              <TableRow className="border-t-2 font-semibold">
                <TableCell>Total</TableCell>
                <TableCell colSpan={3} />
                <TableCell className="text-right">{fmt(total)}</TableCell>
                <TableCell className="text-right">{fmt(data.reduce((s, d) => s + d.paid, 0))}</TableCell>
                <TableCell colSpan={3} />
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Patronal Section ──
function PatronalSection({ data, contracts, currentYear, onSave, onToggle }: {
  data: { month: number; totalGross: number; ssEmployer: number; ssEmployee: number; totalSS: number; paid: number; isPaid: boolean }[];
  contracts: any[];
  currentYear: number;
  onSave: (month: number, value: number) => Promise<void>;
  onToggle: (month: number) => Promise<void>;
}) {
  const totalPrevisto = data.reduce((s, d) => s + d.ssEmployer, 0);
  const totalGrossAnual = data.reduce((s, d) => s + d.totalGross, 0);

  return (
    <div className="space-y-4">
      <Card className="border-info/30 bg-info/15/50 dark:bg-blue-950/20 dark:border-blue-800">
        <CardContent className="pt-4 flex gap-2">
          <Info className="h-4 w-4 text-info shrink-0 mt-0.5" />
          <p className="text-sm text-muted-foreground">
            <strong>Como funciona:</strong> A contribuição é calculada sobre o salário bruto dos membros com <strong>contrato de trabalho</strong>.
            Taxa patronal: 23,75%. Taxa do trabalhador: 11%. Prestadores de serviços não estão incluídos.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Contribuições Patronais — {currentYear}</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mês</TableHead>
                <TableHead className="text-right">Salário Bruto</TableHead>
                <TableHead className="text-right">SS Patronal (23,75%)</TableHead>
                <TableHead className="text-right">Pago</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-[140px]">Registar</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map(d => (
                <PaymentRow
                  key={d.month}
                  month={d.month}
                  predicted={d.ssEmployer}
                  paid={d.paid}
                  isPaid={d.isPaid}
                  onSave={onSave}
                  onToggle={onToggle}
                  extraCells={
                    <>
                      <TableCell className="text-right text-muted-foreground">{d.totalGross > 0 ? fmt(d.totalGross) : '—'}</TableCell>
                    </>
                  }
                />
              ))}
              <TableRow className="border-t-2 font-semibold">
                <TableCell>Total</TableCell>
                <TableCell className="text-right">{fmt(totalGrossAnual)}</TableCell>
                <TableCell className="text-right">{fmt(totalPrevisto)}</TableCell>
                <TableCell className="text-right">{fmt(data.reduce((s, d) => s + d.paid, 0))}</TableCell>
                <TableCell colSpan={3} />
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Per member breakdown */}
      {contracts.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Por Colaborador</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead className="text-right">Salário Bruto</TableHead>
                  <TableHead className="text-right">SS Patronal / mês</TableHead>
                  <TableHead className="text-right">SS Trabalhador / mês</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contracts.map((c: any) => {
                  const gross = c.monthly_value || 0;
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{(c.team_members as any)?.full_name || '—'}</TableCell>
                      <TableCell className="text-right">{fmt(gross)}</TableCell>
                      <TableCell className="text-right">{fmt(Math.round(gross * SS_EMPLOYER_RATE * 100) / 100)}</TableCell>
                      <TableCell className="text-right">{fmt(Math.round(gross * SS_EMPLOYEE_RATE * 100) / 100)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Shared Payment Row ──
function PaymentRow({ month, predicted, paid, isPaid, onSave, onToggle, extraCells }: {
  month: number; predicted: number; paid: number; isPaid: boolean;
  onSave: (month: number, value: number) => Promise<void>;
  onToggle: (month: number) => Promise<void>;
  extraCells?: React.ReactNode;
}) {
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);

  const handleSave = async () => {
    const val = parseFloat(value) || predicted;
    if (val <= 0) return;
    setSaving(true);
    await onSave(month, val);
    setValue('');
    setSaving(false);
  };

  const handleToggle = async () => {
    setToggling(true);
    if (!isPaid) {
      const val = parseFloat(value) || predicted;
      if (val > 0) {
        await onSave(month, val);
        setValue('');
      }
    } else {
      await onToggle(month);
    }
    setToggling(false);
  };

  return (
    <TableRow>
      <TableCell className="font-medium">{String(month).padStart(2, '0')} {MONTHS[month - 1]}</TableCell>
      {extraCells}
      <TableCell className="text-right">{predicted > 0 ? fmt(predicted) : '—'}</TableCell>
      <TableCell className="text-right">{isPaid ? fmt(paid) : '—'}</TableCell>
      <TableCell>
        <Button
          size="sm"
          variant={isPaid ? 'outline' : 'default'}
          disabled={toggling}
          onClick={handleToggle}
          className={isPaid ? 'bg-success/15 text-success border-success/30 hover:bg-destructive/15 hover:text-destructive hover:border-destructive/30 dark:bg-emerald-900/20 dark:text-emerald-400 dark:hover:bg-red-900/20 dark:hover:text-red-400 h-7 text-xs' : 'h-7 text-xs'}
        >
          {isPaid ? 'Pago ✓' : 'Confirmar'}
        </Button>
      </TableCell>
      <TableCell>
        {!isPaid && (
          <Input
            type="number"
            placeholder={predicted > 0 ? String(predicted) : '0.00'}
            value={value}
            onChange={e => setValue(e.target.value)}
            className="h-8 text-sm"
          />
        )}
      </TableCell>
      <TableCell>
        {!isPaid && value && (
          <Button size="sm" variant="ghost" disabled={saving} onClick={handleSave}>
            <Save className="h-3.5 w-3.5" />
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}
