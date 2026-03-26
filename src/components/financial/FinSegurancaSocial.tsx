import { useMemo, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Save } from 'lucide-react';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { useFinancialData } from '@/hooks/useFinancialData';
import type { Expense } from '@/hooks/useFinancialData';
import { FinDocumentsUpload, type FinDocItem } from './FinDocumentsUpload';

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

const SS_EMPLOYER_RATE = 0.2375; // 23.75%
const SS_EMPLOYEE_RATE = 0.11;   // 11%

const fmt = (v: number) => v.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

interface Props {
  fin: ReturnType<typeof useFinancialData>;
  expenses: Expense[];
  currentYear: number;
  sales: { invoice_total: number; sale_month: number | null; sale_year: number | null }[];
}

export function FinSegurancaSocial({ fin, expenses, currentYear, sales }: Props) {
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
  });

  // Payroll entries for the year (only contrato_trabalho members)
  const { data: payrollEntries = [] } = useQuery({
    queryKey: ['financial-payroll-ss', currentYear],
    queryFn: async () => {
      const { data } = await supabase
        .from('financial_payroll')
        .select('*')
        .eq('year', currentYear);
      return data || [];
    },
  });

  // SS expenses from financial_expenses
  const ssExpenses = useMemo(() =>
    expenses.filter(e => e.category === 'seguranca_social' && e.expense_year === currentYear),
    [expenses, currentYear]
  );

  // Get contract member IDs (only contrato_trabalho)
  const contractMemberIds = useMemo(() => new Set(contracts.map((c: any) => c.member_id)), [contracts]);

  // Filter payroll to only contrato_trabalho members
  const relevantPayroll = useMemo(() =>
    payrollEntries.filter((p: any) => {
      // Match by collaborator name to contract members
      const memberName = (p as any).collaborator_name || '';
      return contracts.some((c: any) => (c.team_members as any)?.full_name === memberName);
    }),
    [payrollEntries, contracts]
  );

  // Monthly SS breakdown based on actual payroll
  const monthlyData = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const monthPayroll = relevantPayroll.filter((p: any) => p.month === m);
      const totalGross = monthPayroll.reduce((s: number, p: any) => s + (p.gross_salary || 0), 0);
      const ssEmployer = Math.round(totalGross * SS_EMPLOYER_RATE * 100) / 100;
      const ssEmployee = Math.round(totalGross * SS_EMPLOYEE_RATE * 100) / 100;
      const totalSS = ssEmployer + ssEmployee;

      // Actual SS payment from expenses
      const paid = ssExpenses.find(e => e.expense_month === m);

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

  const totalPrevisto = monthlyData.reduce((s, d) => s + d.ssEmployer, 0);
  const totalPago = monthlyData.reduce((s, d) => s + d.paid, 0);
  const totalGrossAnual = monthlyData.reduce((s, d) => s + d.totalGross, 0);

  const handleSavePayment = async (month: number, value: number) => {
    const existing = ssExpenses.find(e => e.expense_month === month);
    const dateStr = `${currentYear}-${String(month).padStart(2, '0')}-15`;

    if (existing) {
      await fin.upsertExpense.mutateAsync({
        id: existing.id,
        total_with_vat: value,
        base_value: value,
        status: 'pago',
        description: `Segurança Social — ${MONTHS[month - 1]} ${currentYear}`,
      } as any);
    } else if (value > 0) {
      await fin.upsertExpense.mutateAsync({
        description: `Segurança Social — ${MONTHS[month - 1]} ${currentYear}`,
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
    toast.success(`SS de ${MONTHS[month - 1]} guardada`);
  };

  const handleTogglePayment = async (month: number) => {
    const existing = ssExpenses.find(e => e.expense_month === month);
    if (existing) {
      const newStatus = existing.status === 'pago' ? 'por_pagar' : 'pago';
      await fin.upsertExpense.mutateAsync({
        id: existing.id,
        status: newStatus,
      } as any);
      toast.success(newStatus === 'pago' ? `SS de ${MONTHS[month - 1]} marcada como paga` : `SS de ${MONTHS[month - 1]} marcada como pendente`);
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

  return (
    <div className="space-y-6 mt-4">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">SS Patronal Prevista ({currentYear})</p>
            <p className="text-lg font-bold">{fmt(totalPrevisto)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Total Pago</p>
            <p className="text-lg font-bold">{fmt(totalPago)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Em Falta</p>
            <p className={`text-lg font-bold ${totalPrevisto - totalPago > 0 ? 'text-warning' : 'text-success'}`}>
              {fmt(Math.max(0, totalPrevisto - totalPago))}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Colaboradores c/ CT</p>
            <p className="text-lg font-bold">{contracts.length}</p>
            <p className="text-[10px] text-muted-foreground">Contrato de trabalho</p>
          </CardContent>
        </Card>
      </div>

      {/* Info */}
      <Card>
        <CardContent className="pt-4">
          <p className="text-xs text-muted-foreground leading-relaxed">
            <strong>Como funciona:</strong> A contribuição é calculada sobre o salário bruto dos membros com <strong>contrato de trabalho</strong>.
            Taxa patronal: 23,75%. Taxa do trabalhador: 11%. Prestadores de serviços não estão incluídos.
          </p>
        </CardContent>
      </Card>

      {/* Monthly breakdown */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Detalhe Mensal — {currentYear}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mês</TableHead>
                <TableHead className="text-right">Salário Bruto</TableHead>
                <TableHead className="text-right">SS Patronal (23,75%)</TableHead>
                <TableHead className="text-right">Pago</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-[160px]">Registar Pagamento</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {monthlyData.map(d => (
                <PaymentRow
                  key={d.month}
                  month={d.month}
                  grossSalary={d.totalGross}
                  predicted={d.ssEmployer}
                  paid={d.paid}
                  isPaid={d.isPaid}
                  onSave={handleSavePayment}
                  onToggle={handleTogglePayment}
                />
              ))}
              <TableRow className="border-t-2 font-semibold">
                <TableCell>Total</TableCell>
                <TableCell className="text-right">{fmt(totalGrossAnual)}</TableCell>
                <TableCell className="text-right">{fmt(totalPrevisto)}</TableCell>
                <TableCell className="text-right">{fmt(totalPago)}</TableCell>
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

      {/* Documentos */}
      <FinDocumentsUpload
        title={`Declarações de Segurança Social — ${currentYear}`}
        documents={ssDocuments}
        onUpdate={handleDocsUpdate}
      />
    </div>
  );
}

function PaymentRow({ month, grossSalary, predicted, paid, isPaid, onSave, onToggle }: {
  month: number; grossSalary: number; predicted: number; paid: number; isPaid: boolean;
  onSave: (month: number, value: number) => Promise<void>;
  onToggle: (month: number) => Promise<void>;
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
      <TableCell className="text-right text-muted-foreground">{grossSalary > 0 ? fmt(grossSalary) : '—'}</TableCell>
      <TableCell className="text-right">{predicted > 0 ? fmt(predicted) : '—'}</TableCell>
      <TableCell className="text-right">{isPaid ? fmt(paid) : '—'}</TableCell>
      <TableCell>
        <Button
          size="sm"
          variant={isPaid ? 'outline' : 'default'}
          disabled={toggling}
          onClick={handleToggle}
          className={isPaid ? 'bg-success/10 text-success border-success/20 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/20 h-7 text-xs' : 'h-7 text-xs'}
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
