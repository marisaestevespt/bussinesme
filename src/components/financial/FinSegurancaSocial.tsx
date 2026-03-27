import { useMemo, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Save, Info } from 'lucide-react';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import type { useFinancialData } from '@/hooks/useFinancialData';
import type { Expense } from '@/hooks/useFinancialData';
import { FinDocumentsUpload, type FinDocItem } from './FinDocumentsUpload';

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

const SS_EMPLOYER_RATE = 0.2375; // 23.75%
const SS_EMPLOYEE_RATE = 0.11;   // 11%
const SS_INDEPENDENTE_RATE = 0.214; // 21.4%
const SS_RENDIMENTO_RELEVANTE = 0.70; // 70% of revenue

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
  const yearSales = useMemo(() =>
    sales.filter(sl => sl.sale_year === currentYear),
    [sales, currentYear]
  );

  const independenteData = useMemo(() => {
    // Group sales by quarter for declaration-based calculation
    const quarters = [
      { q: 1, months: [1, 2, 3], appliesTo: [7, 8, 9] },    // Q1 declaration → Jul-Sep contributions
      { q: 2, months: [4, 5, 6], appliesTo: [10, 11, 12] },  // Q2 declaration → Oct-Dec
      { q: 3, months: [7, 8, 9], appliesTo: [1, 2, 3] },     // Q3 declaration → Jan-Mar (+1 year)
      { q: 4, months: [10, 11, 12], appliesTo: [4, 5, 6] },   // Q4 declaration → Apr-Jun (+1 year)
    ];

    // Revenue by quarter
    const revenueByQuarter: Record<number, number> = {};
    quarters.forEach(q => {
      revenueByQuarter[q.q] = yearSales
        .filter(sl => q.months.includes(sl.sale_month || 0))
        .reduce((s, v) => s + v.invoice_total, 0);
    });

    // For each month, find which quarter's declaration applies
    // Simplified: use previous quarter's revenue to estimate contribution
    return Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;

      // Find which quarter's revenue applies to this month
      let quarterRevenue = 0;
      // Months 1-3 come from Q3 of previous year (we don't have that data easily, estimate from Q4 of prev or Q1 current)
      // Months 4-6 come from Q4 of previous year
      // Months 7-9 come from Q1 of current year
      // Months 10-12 come from Q2 of current year
      if (m >= 7 && m <= 9) quarterRevenue = revenueByQuarter[1] || 0;
      else if (m >= 10 && m <= 12) quarterRevenue = revenueByQuarter[2] || 0;
      else if (m >= 1 && m <= 3) quarterRevenue = revenueByQuarter[3] || 0; // Q3 prev year - estimate with Q1
      else if (m >= 4 && m <= 6) quarterRevenue = revenueByQuarter[4] || 0; // Q4 prev year - estimate with Q2

      // If no data for the applied quarter, estimate from average of available quarters
      if (quarterRevenue === 0) {
        const totalYearRevenue = Object.values(revenueByQuarter).reduce((s, v) => s + v, 0);
        quarterRevenue = totalYearRevenue / 4;
      }

      const rendimentoRelevante = quarterRevenue * SS_RENDIMENTO_RELEVANTE;
      const baseIncidencia = Math.round(rendimentoRelevante / 3 * 100) / 100;
      const contribution = Math.round(baseIncidencia * SS_INDEPENDENTE_RATE * 100) / 100;

      // Apply minimum (€20) if there's any revenue
      const finalContribution = baseIncidencia > 0 ? Math.max(20, contribution) : 0;

      const paid = ssExpenses.find(e => e.expense_month === m && e.description?.toLowerCase().includes('independente'));

      return {
        month: m,
        quarterRevenue,
        rendimentoRelevante,
        baseIncidencia,
        contribution: finalContribution,
        paid: paid?.total_with_vat ?? 0,
        isPaid: (paid?.total_with_vat ?? 0) > 0,
      };
    });
  }, [yearSales, ssExpenses, currentYear]);

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
      const totalGross = monthPayroll.reduce((s: number, p: any) => s + (p.gross_salary || 0), 0);
      const ssEmployer = Math.round(totalGross * SS_EMPLOYER_RATE * 100) / 100;
      const ssEmployee = Math.round(totalGross * SS_EMPLOYEE_RATE * 100) / 100;
      const totalSS = ssEmployer + ssEmployee;

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
        status: 'pago',
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
        status: 'pago',
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
      const newStatus = existing.status === 'pago' ? 'por_pagar' : 'pago';
      await fin.upsertExpense.mutateAsync({
        id: existing.id,
        status: newStatus,
      } as any);
      toast.success(newStatus === 'pago' ? `Marcada como paga` : `Marcada como pendente`);
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

  return (
    <div className="space-y-6 mt-4">
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
  );
}

// ── Independente Section ──
function IndependenteSection({ data, currentYear, onSave, onToggle }: {
  data: { month: number; quarterRevenue: number; rendimentoRelevante: number; baseIncidencia: number; contribution: number; paid: number; isPaid: boolean }[];
  currentYear: number;
  onSave: (month: number, value: number) => Promise<void>;
  onToggle: (month: number) => Promise<void>;
}) {
  const total = data.reduce((s, d) => s + d.contribution, 0);

  return (
    <div className="space-y-4">
      <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-800">
        <CardContent className="pt-4 flex gap-2">
          <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
          <div className="text-sm text-muted-foreground space-y-1">
            <p><strong>Como funciona:</strong> A contribuição é calculada com base na declaração trimestral de rendimentos.</p>
            <p>Faturação do trimestre × 70% = Rendimento relevante → ÷ 3 = Base mensal → × 21,4% = Contribuição mensal.</p>
            <p>Mínimo: €20/mês. Pagamento entre dia 10 e 20 de cada mês. Podes ajustar ±25% na declaração.</p>
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
              {data.map(d => (
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
                      <TableCell className="text-right text-muted-foreground">{d.quarterRevenue > 0 ? fmt(d.quarterRevenue) : '—'}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{d.rendimentoRelevante > 0 ? fmt(d.rendimentoRelevante) : '—'}</TableCell>
                      <TableCell className="text-right">{d.baseIncidencia > 0 ? fmt(d.baseIncidencia) : '—'}</TableCell>
                    </>
                  }
                />
              ))}
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
      <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-800">
        <CardContent className="pt-4 flex gap-2">
          <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
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
          className={isPaid ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-red-50 hover:text-red-700 hover:border-red-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:hover:bg-red-900/20 dark:hover:text-red-400 h-7 text-xs' : 'h-7 text-xs'}
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
