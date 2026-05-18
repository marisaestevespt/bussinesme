import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Download } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { useFinancialData } from '@/hooks/useFinancialData';
import { calcMonthlyEquivalent } from '@/hooks/useFinancialData';
import { useFinancialCategories } from '@/hooks/useFinancialCategories';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { useBusinessSetupPaymentMethods } from '@/hooks/useBusinessSetup';
import { buildPaymentMethodOptions } from '@/lib/paymentMethods';
import { exportCsv } from '@/lib/exportCsv';
import { exportPdf } from '@/lib/exportPdf';
import { formatEuro } from '@/lib/formatting';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import type {
  ExpenseFormState,
  SupplierSelectOption,
  BusinessSettingsLike,
} from './types';
import { ExpensesTable } from './finSaidas/ExpensesTable';
import { ExpenseDialog } from './finSaidas/ExpenseDialog';
import type { SaidasFilter } from './finSaidas/constants';

interface Props { fin: ReturnType<typeof useFinancialData>; currentYear: number; }

export function FinSaidas({ fin, currentYear }: Props) {
  const { settings } = useBusinessSettings();
  const ivaExempt = (settings as BusinessSettingsLike | null)?.iva_exempt === true;
  const { getCategoryLabel } = useFinancialCategories();
  const allExpenses = fin.expenses.data || [];
  const [filter, setFilter] = useState<SaidasFilter>('year');
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentQuarter = Math.ceil(currentMonth / 3);

  const { data: suppliers = [] } = useQuery<SupplierSelectOption[]>({
    queryKey: ['suppliers-list-vat'],
    queryFn: async () => {
      const { data } = await supabase.from('suppliers').select('id, name, default_vat_rate, payment_method, category').eq('is_active', true);
      return (data || []) as SupplierSelectOption[];
    },
  });
  const { data: setupPM } = useBusinessSetupPaymentMethods();
  const paymentMethods = buildPaymentMethodOptions(setupPM);

  const expenses = allExpenses.filter(e => {
    if (filter === 'all') return true;
    if (filter === 'recurring') return e.is_recurring === true;
    if (filter === 'year') return e.expense_year === currentYear;
    if (filter === 'quarter') return e.expense_year === currentYear && e.expense_quarter === currentQuarter;
    if (filter === 'month') return e.expense_year === currentYear && e.expense_month === currentMonth;
    return true;
  }).sort((a, b) => (a.expense_date || '').localeCompare(b.expense_date || ''));

  const recurringExpenses = allExpenses.filter(e => e.is_recurring === true && e.status !== 'cancelado');
  const totalMonthlyRecurring = recurringExpenses.reduce((s, e) => s + (e.monthly_equivalent || 0), 0);

  const [expOpen, setExpOpen] = useState(false);
  const [expForm, setExpForm] = useState<ExpenseFormState>({});
  const [confirmDelete, setConfirmDelete] = useState(false);

  const openNewExpense = () => {
    setExpForm({ status: 'pendente', category: 'outro', vat_rate: ivaExempt ? 0 : 23, location: 'portugal', base_value: '', description: '', includes_vat: false, supplier_id: null, is_recurring: false, periodicity: 'mensal', payment_method: '' });
    setExpOpen(true);
  };

  const handleSupplierChange = (supplierId: string | null, supplier?: SupplierSelectOption) => {
    setExpForm(f => {
      const updates: ExpenseFormState = { ...f, supplier_id: supplierId };
      const s = supplier || (supplierId ? suppliers.find(s => s.id === supplierId) : null);
      if (s) {
        if (s.default_vat_rate != null) updates.vat_rate = s.default_vat_rate;
        if (s.payment_method) updates.payment_method = s.payment_method;
        if (s.category) updates.category = s.category;
      }
      return updates;
    });
  };

  const saveExpense = async () => {
    if (!expForm.payment_method) {
      toast.error('Seleciona o método de pagamento');
      return;
    }
    const inputValue = parseFloat(String(expForm.base_value ?? '')) || 0;
    const vat = ivaExempt ? 0 : (parseFloat(String(expForm.vat_rate ?? '')) || 0);
    let base: number, total: number;
    if (ivaExempt) {
      base = inputValue; total = inputValue;
    } else if (expForm.includes_vat) {
      total = inputValue;
      base = Math.round(inputValue / (1 + vat / 100) * 100) / 100;
    } else {
      base = inputValue;
      total = Math.round(base * (1 + vat / 100) * 100) / 100;
    }
    const d = expForm.expense_date;
    const date = d ? (typeof d === 'string' ? d : format(d, 'yyyy-MM-dd')) : null;
    const month = date ? parseInt(date.slice(5, 7)) : null;
    const quarter = month ? Math.ceil(month / 3) : null;
    const year = date ? parseInt(date.slice(0, 4)) : null;

    let effectiveStatus = expForm.status;
    if (!expForm.id && month && year) {
      const isCurrentOrPast = year < now.getFullYear() || (year === now.getFullYear() && month <= currentMonth);
      const isFuture = year > now.getFullYear() || (year === now.getFullYear() && month > currentMonth);
      if (effectiveStatus === 'pendente' && isFuture) effectiveStatus = 'por_pagar';
      if (effectiveStatus === 'por_pagar' && isCurrentOrPast) effectiveStatus = 'pendente';
    }

    const isRecurring = expForm.is_recurring || false;
    const periodicity = isRecurring ? (expForm.periodicity || 'mensal') : null;
    const monthlyEquivalent = isRecurring ? calcMonthlyEquivalent(base, periodicity || 'mensal') : 0;

    await fin.upsertExpense.mutateAsync({
      ...(expForm.id ? { id: expForm.id } : {}),
      status: effectiveStatus,
      // Regras (is_recurring=true) são templates: nunca têm data/mês/ano (evita duplicação).
      expense_date: isRecurring ? null : date,
      description: expForm.description || null,
      expense_name: isRecurring ? (expForm.description || null) : null,
      category: expForm.category,
      base_value: base,
      vat_rate: vat,
      total_with_vat: total,
      location: expForm.location,
      documents: expForm.documents || [],
      expense_month: isRecurring ? null : month,
      expense_quarter: isRecurring ? null : quarter,
      expense_year: isRecurring ? null : year,
      supplier_id: expForm.supplier_id || null,
      payment_method: expForm.payment_method || null,
      is_recurring: isRecurring,
      periodicity,
      monthly_equivalent: monthlyEquivalent,
      recurrence_day: isRecurring ? (expForm.recurrence_day || null) : null,
      source_type: isRecurring ? 'rule' : 'manual',
      source_id: isRecurring ? (expForm.id || null) : null,
    });
    if (isRecurring) fin.recurringExpenses.refetch();
    setExpOpen(false);
    toast.success('Despesa guardada');
  };

  const handleExportCsv = () => {
    const headers = ['ID', 'Data', 'Descrição', 'Categoria', 'Valor Base', 'IVA %', 'Total c/ IVA', 'Localização', 'Recorrente', 'Periodicidade'];
    const rows = expenses.map(e => [e.expense_id, e.expense_date || '', e.description || '', e.category, e.base_value, e.vat_rate, e.total_with_vat, e.location, e.is_recurring ? 'Sim' : 'Não', e.periodicity || '']);
    exportCsv(`saidas_${currentYear}.csv`, headers, rows);
    toast.success('CSV exportado');
  };

  return (
    <div className="space-y-8 mt-4">
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            {([['all', 'Todos'], ['month', 'Este mês'], ['quarter', 'Este trimestre'], ['year', 'Este ano'], ['recurring', 'Recorrentes']] as const).map(([k, l]) => (
              <Button key={k} variant={filter === k ? 'default' : 'outline'} size="sm" onClick={() => setFilter(k as SaidasFilter)}>{l}</Button>
            ))}
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={handleExportCsv}><Download className="h-3.5 w-3.5 mr-1" /> CSV</Button>
            <Button size="sm" variant="outline" onClick={() => { exportPdf(`Saídas — ${currentYear}`, 'fin-saidas-export'); toast.success('PDF a gerar...'); }}><Download className="h-3.5 w-3.5 mr-1" /> PDF</Button>
            <Button size="sm" onClick={openNewExpense}><Plus className="h-4 w-4 mr-1" /> Nova Despesa</Button>
          </div>
        </div>

        {filter === 'recurring' && totalMonthlyRecurring > 0 && (
          <Card className="mb-4">
            <CardContent className="py-3 px-4 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Custo mensal estimado (recorrentes ativas)</span>
              <span className="font-semibold">{formatEuro(totalMonthlyRecurring)}</span>
            </CardContent>
          </Card>
        )}

        <ExpensesTable
          expenses={expenses}
          loading={fin.expenses.isLoading}
          filter={filter}
          ivaExempt={ivaExempt}
          getCategoryLabel={getCategoryLabel}
          onOpenNew={openNewExpense}
          onEdit={(form) => { setExpForm(form); setExpOpen(true); }}
        />
      </div>

      <ExpenseDialog
        open={expOpen}
        onOpenChange={setExpOpen}
        form={expForm}
        setForm={setExpForm}
        ivaExempt={ivaExempt}
        paymentMethods={paymentMethods}
        onSupplierChange={handleSupplierChange}
        onSave={saveExpense}
        onRequestDelete={() => setConfirmDelete(true)}
      />

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Eliminar despesa?"
        description={expForm.is_recurring ? 'Esta despesa é recorrente — eliminar também remove todas as ocorrências geradas. Esta ação não pode ser desfeita.' : 'Esta ação não pode ser desfeita.'}
        confirmLabel="Eliminar"
        onConfirm={async () => {
          if (expForm.id) await fin.deleteExpense.mutateAsync(expForm.id);
          setConfirmDelete(false);
          setExpOpen(false);
          toast.success('Eliminada');
        }}
      />
    </div>
  );
}
