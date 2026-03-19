import { useMemo, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Save } from 'lucide-react';
import { toast } from 'sonner';
import type { useFinancialData } from '@/hooks/useFinancialData';
import type { Expense } from '@/hooks/useFinancialData';
import { FinDocumentsUpload, type FinDocItem } from './FinDocumentsUpload';

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const QUARTERS = [
  { label: 'T1 (Jan–Mar)', months: [1, 2, 3] },
  { label: 'T2 (Abr–Jun)', months: [4, 5, 6] },
  { label: 'T3 (Jul–Set)', months: [7, 8, 9] },
  { label: 'T4 (Out–Dez)', months: [10, 11, 12] },
];

const SS_RATE = 0.214; // 21.4%
const RELEVANT_INCOME_FACTOR = 0.70; // 70% do rendimento bruto

const fmt = (v: number) => v.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

interface Props {
  fin: ReturnType<typeof useFinancialData>;
  expenses: Expense[];
  currentYear: number;
  sales: { invoice_total: number; sale_month: number | null; sale_year: number | null }[];
}

export function FinSegurancaSocial({ fin, expenses, currentYear, sales }: Props) {
  // Actual SS payments from expenses
  const ssExpenses = useMemo(() =>
    expenses.filter(e => e.category === 'seguranca_social' && e.expense_year === currentYear),
    [expenses, currentYear]
  );

  // Calculate quarterly income from sales
  const quarterlyIncome = useMemo(() => {
    return QUARTERS.map((q, qi) => {
      const income = sales
        .filter(s => s.sale_year === currentYear && s.sale_month && q.months.includes(s.sale_month))
        .reduce((sum, s) => sum + s.invoice_total, 0);
      return income;
    });
  }, [sales, currentYear]);

  // SS contributions are based on PREVIOUS quarter's income
  // T1 income → T2/T3/T4 contributions paid from April onwards (next quarter)
  // In practice: quarterly declaration → next quarter's monthly payments
  const quarterlyPredictions = useMemo(() => {
    return QUARTERS.map((q, qi) => {
      // Income from the previous quarter determines this quarter's contributions
      const prevQuarterIncome = qi > 0 ? quarterlyIncome[qi - 1] : 0;
      const relevantIncome = prevQuarterIncome * RELEVANT_INCOME_FACTOR;
      const monthlyContribution = Math.round(relevantIncome / 3 * SS_RATE * 100) / 100;
      const quarterTotal = monthlyContribution * 3;

      // Actual payments for this quarter's months
      const actualPayments = q.months.map(m => {
        const paid = ssExpenses.find(e => e.expense_month === m);
        return { month: m, predicted: monthlyContribution, paid: paid?.total_with_vat ?? 0, expenseEntry: paid };
      });

      return {
        ...q,
        quarterIndex: qi,
        prevQuarterIncome: prevQuarterIncome,
        relevantIncome,
        monthlyContribution,
        quarterTotal,
        actualPayments,
        totalPaid: actualPayments.reduce((s, p) => s + p.paid, 0),
      };
    });
  }, [quarterlyIncome, ssExpenses]);

  const totalPrevisto = quarterlyPredictions.reduce((s, q) => s + q.quarterTotal, 0);
  const totalPago = quarterlyPredictions.reduce((s, q) => s + q.totalPaid, 0);

  // Manual override for quarterly income (for future quarters or corrections)
  const [overrides, setOverrides] = useState<Record<number, string>>({});

  const handleSavePayment = async (month: number, value: number) => {
    const existing = ssExpenses.find(e => e.expense_month === month);
    const dateStr = `${currentYear}-${String(month).padStart(2, '0')}-15`;

    if (existing) {
      await fin.upsertExpense.mutateAsync({
        id: existing.id,
        total_with_vat: value,
        base_value: value,
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
            <p className="text-xs text-muted-foreground">Total Previsto ({currentYear})</p>
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
            <p className={`text-lg font-bold ${totalPrevisto - totalPago > 0 ? 'text-amber-600' : 'text-green-600'}`}>
              {fmt(Math.max(0, totalPrevisto - totalPago))}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Taxa Aplicada</p>
            <p className="text-lg font-bold">21,4%</p>
            <p className="text-[10px] text-muted-foreground">sobre 70% do rendimento</p>
          </CardContent>
        </Card>
      </div>

      {/* Info */}
      <Card>
        <CardContent className="pt-4">
          <p className="text-xs text-muted-foreground leading-relaxed">
            <strong>Como funciona:</strong> A contribuição de cada trimestre é calculada sobre 70% do rendimento bruto
            do trimestre anterior (rendimento relevante). Taxa: 21,4%. O rendimento do T1 determina as contribuições do T2, e assim por diante.
          </p>
        </CardContent>
      </Card>

      {/* Quarterly breakdown */}
      {quarterlyPredictions.map((q) => (
        <Card key={q.quarterIndex}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center justify-between">
              <span>{q.label}</span>
              {q.quarterIndex > 0 && (
                <span className="text-xs font-normal text-muted-foreground">
                  Rendimento T{q.quarterIndex} (base): {fmt(q.prevQuarterIncome)} → Relevante (70%): {fmt(q.relevantIncome)}
                </span>
              )}
              {q.quarterIndex === 0 && (
                <span className="text-xs font-normal text-muted-foreground">
                  Base: rendimento T4 do ano anterior
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mês</TableHead>
                  <TableHead className="text-right">Previsto</TableHead>
                  <TableHead className="text-right">Pago</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="w-[160px]">Registar Pagamento</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {q.actualPayments.map((p) => (
                  <PaymentRow
                    key={p.month}
                    month={p.month}
                    predicted={p.predicted}
                    paid={p.paid}
                    isPaid={p.paid > 0}
                    onSave={handleSavePayment}
                  />
                ))}
                <TableRow className="border-t-2 font-semibold">
                  <TableCell>Total {q.label.split(' ')[0]}</TableCell>
                  <TableCell className="text-right">{fmt(q.quarterTotal)}</TableCell>
                  <TableCell className="text-right">{fmt(q.totalPaid)}</TableCell>
                  <TableCell colSpan={3} />
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}

      {/* Documentos */}
      <FinDocumentsUpload
        title={`Declarações de Segurança Social — ${currentYear}`}
        documents={ssDocuments}
        onUpdate={handleDocsUpdate}
      />
    </div>
  );
}

function PaymentRow({ month, predicted, paid, isPaid, onSave }: {
  month: number; predicted: number; paid: number; isPaid: boolean;
  onSave: (month: number, value: number) => Promise<void>;
}) {
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const val = parseFloat(value) || predicted;
    setSaving(true);
    await onSave(month, val);
    setValue('');
    setSaving(false);
  };

  return (
    <TableRow>
      <TableCell className="font-medium">{String(month).padStart(2, '0')} {MONTHS[month - 1]}</TableCell>
      <TableCell className="text-right">{predicted > 0 ? fmt(predicted) : '—'}</TableCell>
      <TableCell className="text-right">{isPaid ? fmt(paid) : '—'}</TableCell>
      <TableCell>
        {isPaid
          ? <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Pago</Badge>
          : <Badge variant="outline" className="text-muted-foreground">Pendente</Badge>
        }
      </TableCell>
      <TableCell>
        <Input
          type="number"
          placeholder={predicted > 0 ? String(predicted) : '0.00'}
          value={value}
          onChange={e => setValue(e.target.value)}
          className="h-8 text-sm"
        />
      </TableCell>
      <TableCell>
        <Button size="sm" variant="ghost" disabled={saving} onClick={handleSave}>
          <Save className="h-3.5 w-3.5" />
        </Button>
      </TableCell>
    </TableRow>
  );
}
