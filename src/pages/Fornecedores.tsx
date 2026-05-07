import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { BackNavigation } from '@/components/BackNavigation';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2, RefreshCw, CalendarClock, Pencil, Check, X, Ban } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getAutoExpenseStatus, isPaidExpenseStatus, normalizeUnpaidExpenseStatus } from '@/lib/expenseStatus';
import { buildPaymentMethodOptions } from '@/lib/paymentMethods';
import { useBusinessSetupPaymentMethods } from '@/hooks/useBusinessSetup';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { formatEuro } from '@/lib/formatting';
import { DEPARTMENTS } from '@/lib/departments';

const EU_NIF_PREFIXES = ['AT', 'BE', 'BG', 'CY', 'CZ', 'DE', 'DK', 'EE', 'EL', 'ES', 'FI', 'FR', 'HR', 'HU', 'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PL', 'RO', 'SE', 'SI', 'SK'];

/** Detect supplier location from NIF prefix */
function detectLocationFromNif(nif: string): { location: string; vat: number } {
  const clean = (nif || '').replace(/\s/g, '').toUpperCase();
  if (!clean) return { location: 'portugal', vat: 23 };
  // Portuguese NIF: starts with PT or is purely numeric (9 digits)
  if (clean.startsWith('PT') || /^\d{9}$/.test(clean)) return { location: 'portugal', vat: 23 };
  const prefix = clean.slice(0, 2);
  if (EU_NIF_PREFIXES.includes(prefix)) return { location: 'ue', vat: 0 };
  return { location: 'fora_ue', vat: 0 };
}

const LOCATIONS = [
  { value: 'portugal', label: 'Portugal' },
  { value: 'ue', label: 'União Europeia' },
  { value: 'fora_ue', label: 'Fora da UE' },
];


const PERIODICITIES = [
  { value: 'semanal', label: 'Semanal' },
  { value: 'mensal', label: 'Mensal' },
  { value: 'bimestral', label: 'Bimestral' },
  { value: 'trimestral', label: 'Trimestral' },
  { value: 'semestral', label: 'Semestral' },
  { value: 'anual', label: 'Anual' },
];

const calcMonthlyEquivalent = (base: number, periodicity: string) => {
  const map: Record<string, number> = { semanal: 52/12, mensal: 1, bimestral: 1/2, trimestral: 1/3, semestral: 1/6, anual: 1/12 };
  return Math.round(base * (map[periodicity] || 1) * 100) / 100;
};

const INDEFINITE_PAUSE_DATE = '2999-12-31';

const isPausedUntilActive = (pausedUntil?: string | null) =>
  !!pausedUntil && pausedUntil > new Date().toISOString().slice(0, 10);

const getSupplierStatusLabel = (supplier: { is_active?: boolean | null; paused_until?: string | null }) => {
  const pausedUntil = supplier.paused_until;

  if (!supplier.is_active) return 'Inativo';
  if (pausedUntil === INDEFINITE_PAUSE_DATE) return 'Pausado ∞';
  if (isPausedUntilActive(pausedUntil)) return `Pausado até ${pausedUntil}`;
  return 'Ativo';
};
/**
 * Simple date generator: from firstPaymentDate, step by periodicity, until endDate.
 * No guessing — uses exactly the dates the user provides.
 */
function generateBillingDates(
  firstPaymentDate: string,
  endDate: string,
  periodicity: string,
): { year: number; month: number; day: number }[] {
  const first = new Date(firstPaymentDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');
  const results: { year: number; month: number; day: number }[] = [];

  const periodMonths: Record<string, number> = {
    semanal: 1, mensal: 1, bimestral: 2, trimestral: 3, semestral: 6, anual: 12,
  };
  const step = periodMonths[periodicity] || 1;
  const dayOfMonth = first.getDate();

  let cursor = new Date(first);
  while (cursor <= end) {
    results.push({ year: cursor.getFullYear(), month: cursor.getMonth() + 1, day: cursor.getDate() });
    // Advance by step months, keeping the same day
    const nextMonth = cursor.getMonth() + step;
    cursor = new Date(cursor.getFullYear(), nextMonth, Math.min(dayOfMonth, 28));
  }
  return results;
}

/** Count for preview */
function countOccurrences(firstPaymentDate: string, endDate: string, periodicity: string): number {
  if (!firstPaymentDate || !endDate) return 0;
  return generateBillingDates(firstPaymentDate, endDate, periodicity).length;
}

/** Generate individual expense rows from firstPaymentDate to endDate */
async function generateExpensesForPeriod(
  supplierId: string,
  name: string,
  baseValue: number,
  vatRate: number,
  periodicity: string,
  paymentMethod: string | null,
  category: string,
  firstPaymentDate: string,
  endDate: string,
  parentExpenseId: string,
  descriptionTemplate?: string | null,
  location?: string,
) {
  const dates = generateBillingDates(firstPaymentDate, endDate, periodicity);
  const valuePerOccurrence = periodicity === 'semanal' ? Math.round(baseValue * (52/12) * 100) / 100 : baseValue;
  const total = Math.round(valuePerOccurrence * (1 + vatRate / 100) * 100) / 100;

  const rows = dates.map(o => {
    const month = String(o.month).padStart(2, '0');
    const desc = descriptionTemplate
      ? descriptionTemplate.replace('{nome}', name).replace('{mes}', month).replace('{ano}', String(o.year))
      : name;
    return {
      description: desc,
      expense_name: name,
      supplier_id: supplierId,
      base_value: valuePerOccurrence,
      vat_rate: vatRate,
      total_with_vat: total,
      category,
      status: getAutoExpenseStatus(`${o.year}-${month}-${String(o.day).padStart(2, '0')}`),
      location: location || 'portugal',
      is_recurring: false,
      parent_expense_id: parentExpenseId,
      payment_method: paymentMethod,
      expense_date: `${o.year}-${month}-${String(o.day).padStart(2, '0')}`,
      expense_month: o.month,
      expense_quarter: Math.ceil(o.month / 3),
      expense_year: o.year,
      source_type: 'subscription',
      source_id: parentExpenseId,
    };
  });

  if (rows.length > 0) {
    const { error } = await supabase.from('financial_expenses').insert(rows as any);
    if (error) throw error;
  }
  return rows.length;
}

export default function FornecedoresPage() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [searchParams, setSearchParams] = useSearchParams();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({});
  const [renewDialog, setRenewDialog] = useState(false);
  const [renewForm, setRenewForm] = useState<any>({});
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [expenseEdit, setExpenseEdit] = useState<any>({});
  const [autoOpened, setAutoOpened] = useState(false);
  const [cancelDialog, setCancelDialog] = useState<{ supplierId: string; adjustValue: string; showAdjust: boolean } | null>(null);

  // Dynamic payment methods from business setup
  const { data: setupPaymentMethods } = useBusinessSetupPaymentMethods();
  const paymentMethods = buildPaymentMethodOptions(setupPaymentMethods);
  const getPaymentLabel = (val: string) => paymentMethods.find(m => m.value === val)?.label || val || '—';

  // Expenses for the currently selected supplier
  const { data: supplierExpenses = [] } = useQuery({
    queryKey: ['supplier-expenses', selectedSupplierId],
    enabled: !!selectedSupplierId,
    queryFn: async () => {
      const { data } = await supabase
        .from('financial_expenses')
        .select('id,description,expense_name,expense_date,expense_id,base_value,vat_rate,total_with_vat,status,source_type,is_recurring,category,payment_method,documents,location,expense_month,expense_quarter,expense_year,periodicity')
        .eq('supplier_id', selectedSupplierId!)
        .order('expense_date', { ascending: true });
      return (data || []).map((expense) => ({
        ...expense,
        status: normalizeUnpaidExpenseStatus(expense.status, expense.expense_date),
      }));
    },
  });

  // Cancel recurrence: mark rule as cancelled + delete future (and optionally current month) unpaid expenses
  const cancelRecurrence = useMutation({
    mutationFn: async ({ supplierId, includeCurrentMonth, adjustedValue }: { supplierId: string; includeCurrentMonth: boolean; adjustedValue?: number }) => {
      const { data: rules } = await supabase.from('financial_expenses')
        .select('id, vat_rate')
        .eq('supplier_id', supplierId)
        .eq('is_recurring', true);
      
      if (!rules || rules.length === 0) {
        toast.error('Sem despesa recorrente associada');
        return;
      }

      const ruleIds = rules.map(r => r.id);

      await supabase.from('financial_expenses')
        .update({ status: 'cancelado' } as any)
        .in('id', ruleIds);

      const now = new Date();
      const currentYr = now.getFullYear();
      const currentMo = now.getMonth() + 1;

      const { data: childExpenses } = await supabase.from('financial_expenses')
        .select('id, status, expense_date, expense_month, expense_year')
        .eq('supplier_id', supplierId)
        .eq('is_recurring', false)
        .in('parent_expense_id', ruleIds);

      const toDelete: any[] = [];
      let currentMonthExpenseId: string | null = null;

      (childExpenses || []).forEach((e) => {
        if (isPaidExpenseStatus(e.status)) return;
        const eYear = e.expense_year || parseInt((e.expense_date || '').slice(0, 4));
        const eMonth = e.expense_month || parseInt((e.expense_date || '').slice(5, 7));
        if (eYear > currentYr || (eYear === currentYr && eMonth > currentMo)) {
          toDelete.push(e);
        } else if (includeCurrentMonth && eYear === currentYr && eMonth === currentMo) {
          toDelete.push(e);
        } else if (!includeCurrentMonth && eYear === currentYr && eMonth === currentMo) {
          currentMonthExpenseId = e.id;
        }
      });

      if (toDelete.length > 0) {
        await supabase.from('financial_expenses')
          .delete()
          .in('id', toDelete.map(e => e.id));
      }

      // Adjust current month expense value if requested
      if (!includeCurrentMonth && adjustedValue != null && adjustedValue > 0 && currentMonthExpenseId) {
        const vatRate = rules[0]?.vat_rate || 0;
        const newTotal = Math.round(adjustedValue * (1 + vatRate / 100) * 100) / 100;
        await supabase.from('financial_expenses')
          .update({ base_value: adjustedValue, total_with_vat: newTotal } as any)
          .eq('id', currentMonthExpenseId);
      }

      return toDelete.length;
    },
    onSuccess: (count) => {
      invalidateAll();
      setCancelDialog(null);
      toast.success(`Recorrência cancelada${count ? ` — ${count} despesas eliminadas` : ''}`);
    },
    onError: () => toast.error('Erro ao cancelar recorrência'),
  });

  // When supplier expenses load, auto-populate recurring expense fields if a rule exists
  useEffect(() => {
    if (!selectedSupplierId || !open) return;
    const recurringRule = supplierExpenses.find((e) => e.is_recurring && e.source_type === 'rule' && e.status !== 'cancelado');
    if (recurringRule) {
      setForm((f: any) => {
        // Only populate if not already set (avoid overwriting user edits)
        if (f._recurringLoaded === selectedSupplierId) return f;
        return {
          ...f,
          create_recurring: false, // keep toggle off — it's for creating NEW, not editing
          _recurringLoaded: selectedSupplierId,
          _existingRecurring: {
              id: recurringRule.id,
              value: recurringRule.base_value,
              total: recurringRule.total_with_vat,
              periodicity: recurringRule.periodicity || 'mensal',
              vat_rate: recurringRule.vat_rate,
              category: recurringRule.category,
              includes_vat: false,
            },
            // Pre-fill editable fields from rule
            edit_recurring_value: String(recurringRule.base_value),
            edit_recurring_vat: recurringRule.vat_rate,
            edit_recurring_periodicity: recurringRule.periodicity || 'mensal',
            edit_recurring_includes_vat: false,
        };
      });
    }
  }, [supplierExpenses, selectedSupplierId, open]);


  const updateExpense = useMutation({
    mutationFn: async (exp: any) => {
      const base = parseFloat(exp.base_value) || 0;
      const vat = exp.vat_rate ?? 23;
      const total = Math.round(base * (1 + vat / 100) * 100) / 100;
      const expenseDate = exp.expense_date || new Date().toISOString().slice(0, 10);
      const expenseMonth = parseInt(expenseDate.slice(5, 7));
      const expenseYear = parseInt(expenseDate.slice(0, 4));
      const expenseQuarter = Math.ceil(expenseMonth / 3);
      const status = normalizeUnpaidExpenseStatus(exp.status, expenseDate);

      const { error } = await supabase.from('financial_expenses').update({
        status,
        expense_date: expenseDate,
        base_value: base,
        vat_rate: vat,
        total_with_vat: total,
        description: exp.description,
        category: exp.category,
        expense_month: expenseMonth,
        expense_quarter: expenseQuarter,
        expense_year: expenseYear,
      }).eq('id', exp.id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAll();
      setEditingExpenseId(null);
      toast.success('Despesa atualizada');
    },
    onError: () => toast.error('Erro ao atualizar despesa'),
  });

  const deleteExpense = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('financial_expenses').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAll();
      toast.success('Despesa eliminada');
    },
    onError: () => toast.error('Erro ao eliminar despesa'),
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers-all'],
    queryFn: async () => {
      const { data } = await supabase.from('suppliers').select('*').order('name');
      return data || [];
    },
  });

  // Auto-open supplier from query param (?open=supplierId)
  useEffect(() => {
    if (autoOpened || suppliers.length === 0) return;
    const openId = searchParams.get('open');
    if (openId) {
      const supplier = suppliers.find((s) => s.id === openId);
      if (supplier) {
        setForm({ ...supplier, create_recurring: false });
        setSelectedSupplierId(supplier.id);
        setOpen(true);
        setAutoOpened(true);
        searchParams.delete('open');
        setSearchParams(searchParams, { replace: true });
      }
    }
  }, [suppliers, autoOpened, searchParams]);

  const { data: expenseCounts = {} } = useQuery({
    queryKey: ['supplier-expense-counts'],
    queryFn: async () => {
      const { data } = await supabase
        .from('financial_expenses')
        .select('supplier_id')
        .not('supplier_id', 'is', null);
      const counts: Record<string, number> = {};
      (data || []).forEach((e) => {
        counts[e.supplier_id] = (counts[e.supplier_id] || 0) + 1;
      });
      return counts;
    },
  });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ['suppliers-all'] });
    qc.invalidateQueries({ queryKey: ['suppliers-list'] });
    qc.invalidateQueries({ queryKey: ['suppliers-list-vat'] });
    qc.invalidateQueries({ queryKey: ['suppliers-setup-fin'] });
    qc.invalidateQueries({ queryKey: ['suppliers-id-name-map'] });
    qc.invalidateQueries({ queryKey: ['suppliers-export-contabilista'] });
    qc.invalidateQueries({ queryKey: ['financial-expenses'] });
    qc.invalidateQueries({ queryKey: ['recurring-expenses'] });
    qc.invalidateQueries({ queryKey: ['supplier-expense-counts'] });
    qc.invalidateQueries({ queryKey: ['supplier-expenses'] });
  };

  const upsert = useMutation({
    mutationFn: async () => {
      if (!form.name?.trim()) return;
      const record = {
        name: form.name,
        nif: form.nif || null,
        email: form.email || null,
        phone: form.phone || null,
        address: form.address || null,
        website: form.website || null,
        iban: form.iban || null,
        payment_method: form.payment_method || 'transferencia',
        category: form.category || 'outro',
        department: form.department || null,
        notes: form.notes || null,
        is_active: form.is_active ?? true,
        default_vat_rate: form.default_vat_rate ?? 23,
        location: form.location || 'portugal',
        contract_start_date: form.contract_start_date || null,
        contract_end_date: form.contract_end_date || null,
        documents: form.documents || [],
        expense_description_template: form.expense_description_template || null,
        paused_until: form.paused_until || null,
      };

      let supplierId = form.id;
      if (form.id) {
        const { error: supplierError } = await supabase.from('suppliers').update(record as any).eq('id', form.id);
        if (supplierError) throw supplierError;

        const { error: paymentMethodSyncError } = await supabase
          .from('financial_expenses')
          .update({ payment_method: record.payment_method || null } as any)
          .eq('supplier_id', form.id);
        if (paymentMethodSyncError) throw paymentMethodSyncError;

        // ── Limpeza ao pausar / desativar ──
        // Se o fornecedor passa a estar pausado (paused_until definido) ou inativo,
        // apaga as despesas FUTURAS ainda "por_pagar" para evitar pagamentos previstos
        // que já não fazem sentido. Mantém intactas: pagas, parciais e passadas (histórico).
        const isPausedNow = !!record.paused_until || record.is_active === false;
        if (isPausedNow) {
          const todayStr = new Date().toISOString().slice(0, 10);
          // Filtros: só "por_pagar", só não-recorrentes (não apagar a regra-mãe),
          // e só com expense_date >= hoje (não toca em histórico).
          const { data: toDelete } = await supabase
            .from('financial_expenses')
            .select('id')
            .eq('supplier_id', form.id)
            .eq('status', 'por_pagar')
            .eq('is_recurring', false)
            .gte('expense_date', todayStr);
          if (toDelete && toDelete.length > 0) {
            const ids = toDelete.map(d => d.id);
            const { error: delErr } = await supabase
              .from('financial_expenses')
              .delete()
              .in('id', ids);
            if (delErr) throw delErr;
            toast.success(`${ids.length} despesa${ids.length !== 1 ? 's' : ''} futura${ids.length !== 1 ? 's' : ''} por pagar removida${ids.length !== 1 ? 's' : ''}`);
          }
        }

        // Cascade location/VAT changes to all existing expenses for this supplier
        const newLocation = form.location || 'portugal';
        const newVat = form.default_vat_rate ?? 23;
        const { data: existingExps } = await supabase
          .from('financial_expenses')
          .select('id, expense_month, expense_year, base_value, vat_rate, total_with_vat, location')
          .eq('supplier_id', form.id);

        if (existingExps && existingExps.length > 0) {
          for (const exp of existingExps) {
            const updates: Record<string, any> = {};

            // Cascade location & VAT — keep base_value (real cost without VAT) and recalculate total_with_vat.
            // This is the correct fiscal behaviour: when a supplier changes from PT 23% to UE 0%,
            // the base cost stays the same and the total simply equals the base (no VAT applied).
            if (exp.location !== newLocation || exp.vat_rate !== newVat) {
              updates.location = newLocation;
              updates.vat_rate = newVat;
              const base = exp.base_value ?? 0;
              updates.total_with_vat = Math.round(base * (1 + newVat / 100) * 100) / 100;
            }

            // Update description template if set
            if (form.expense_description_template?.trim()) {
              const month = String(exp.expense_month).padStart(2, '0');
              updates.description = form.expense_description_template
                .replace('{mes}', month)
                .replace('{ano}', String(exp.expense_year))
                .replace('{nome}', form.name);
            }

            if (Object.keys(updates).length > 0) {
              await supabase.from('financial_expenses').update(updates as any).eq('id', exp.id);
            }
          }
        }
      } else {
        const { data } = await supabase.from('suppliers').insert(record as any).select('id').single();
        supplierId = data?.id;
      }

      // Create recurring expense rule + optionally generate individual monthly expenses
      if (form.create_recurring && supplierId && form.recurring_value) {
        const inputValue = parseFloat(form.recurring_value) || 0;
        const vat = form.recurring_vat_rate ?? form.default_vat_rate ?? 23;
        let base: number, total: number;
        if (form.recurring_includes_vat) {
          total = inputValue;
          base = Math.round(inputValue / (1 + vat / 100) * 100) / 100;
        } else {
          base = inputValue;
          total = Math.round(base * (1 + vat / 100) * 100) / 100;
        }
        const periodicity = form.recurring_periodicity || 'mensal';
        const firstPayment = form.first_payment_date || form.contract_start_date;

        // Create parent recurring expense (the rule)
        const { data: parentData, error: parentErr } = await supabase.from('financial_expenses').insert({
          description: form.name,
          expense_name: form.name,
          supplier_id: supplierId,
          base_value: base,
          vat_rate: vat,
          total_with_vat: total,
          category: form.category || 'outro',
          status: 'por_pagar',
          location: form.location || 'portugal',
          is_recurring: true,
          periodicity,
          monthly_equivalent: calcMonthlyEquivalent(base, periodicity),
          recurrence_day: form.recurring_day || null,
          renewal_date: firstPayment || null,
          payment_method: form.payment_method || null,
          // Regra é template puro: NUNCA tem mês/ano/data — só os filhos têm.
          // Evita duplicação com as despesas materializadas. Trigger DB também force this.
          expense_date: null,
          expense_month: null,
          expense_quarter: null,
          expense_year: null,
          recurrence_end_date: form.contract_end_date || null,
          source_type: 'rule',
        } as any).select('id').single();
        if (parentErr) throw parentErr;

        // Generate individual expenses
        const endDate = form.contract_end_date;
        if (firstPayment && endDate) {
          const count = await generateExpensesForPeriod(
            supplierId, form.name, base, vat, periodicity,
            form.payment_method || null, form.category || 'outro',
            firstPayment, endDate,
            parentData.id, form.expense_description_template,
            form.location || 'portugal'
          );
          toast.success(`${count} despesas geradas`);
        } else if (firstPayment) {
          // No end date — generate just the first expense so it appears in the monthly view
          const firstDate = new Date(firstPayment + 'T00:00:00');
          const fMonth = firstDate.getMonth() + 1;
          const fYear = firstDate.getFullYear();
          const desc = form.expense_description_template
            ? form.expense_description_template.replace('{nome}', form.name).replace('{mes}', String(fMonth).padStart(2, '0')).replace('{ano}', String(fYear))
            : form.name;
          await supabase.from('financial_expenses').insert({
            description: desc,
            expense_name: form.name,
            supplier_id: supplierId,
            base_value: base,
            vat_rate: vat,
            total_with_vat: total,
            category: form.category || 'outro',
            status: getAutoExpenseStatus(firstPayment),
            location: form.location || 'portugal',
            is_recurring: false,
            parent_expense_id: parentData.id,
            payment_method: form.payment_method || null,
            expense_date: firstPayment,
            expense_month: fMonth,
            expense_quarter: Math.ceil(fMonth / 3),
            expense_year: fYear,
            source_type: 'subscription',
            source_id: parentData.id,
          } as any);
          toast.success('Regra recorrente criada com 1ª despesa');
        } else {
          toast.success('Regra recorrente criada');
        }
      }

      // Update existing recurring rule + cascade to unpaid child expenses
      if (form._existingRecurring?.id && form.edit_recurring_value) {
        const ruleId = form._existingRecurring.id;
        const inputVal = parseFloat(form.edit_recurring_value) || 0;
        const editVat = form.edit_recurring_vat ?? form.default_vat_rate ?? 23;
        let ruleBase: number, ruleTotal: number;
        if (form.edit_recurring_includes_vat) {
          ruleTotal = inputVal;
          ruleBase = editVat > 0 ? Math.round(inputVal / (1 + editVat / 100) * 100) / 100 : inputVal;
        } else {
          ruleBase = inputVal;
          ruleTotal = Math.round(ruleBase * (1 + editVat / 100) * 100) / 100;
        }
        const editPeriodicity = form.edit_recurring_periodicity || 'mensal';
        const editMonthly = calcMonthlyEquivalent(ruleBase, editPeriodicity);

        // Update the parent rule
        await supabase.from('financial_expenses').update({
          base_value: ruleBase,
          vat_rate: editVat,
          total_with_vat: ruleTotal,
          periodicity: editPeriodicity,
          monthly_equivalent: editMonthly,
          renewal_date: form.first_payment_date || form.contract_start_date || form._existingRecurring.renewal_date || null,
          location: form.location || 'portugal',
          category: form.category || 'outro',
          payment_method: form.payment_method || null,
        } as any).eq('id', ruleId);

        // Cascade to unpaid child expenses
        const { data: children } = await supabase
          .from('financial_expenses')
          .select('id, status, expense_month, expense_year')
          .eq('parent_expense_id', ruleId);
        if (children) {
          for (const child of children) {
            if (isPaidExpenseStatus(child.status)) continue; // don't touch already paid
            const updates: Record<string, any> = {
              base_value: ruleBase,
              vat_rate: editVat,
              total_with_vat: ruleTotal,
              location: form.location || 'portugal',
              category: form.category || 'outro',
              payment_method: form.payment_method || null,
            };
            if (form.expense_description_template?.trim()) {
              updates.description = form.expense_description_template
                .replace('{mes}', String(child.expense_month).padStart(2, '0'))
                .replace('{ano}', String(child.expense_year))
                .replace('{nome}', form.name);
            }
            await supabase.from('financial_expenses').update(updates as any).eq('id', child.id);
          }
          const updated = children.filter(c => !isPaidExpenseStatus(c.status)).length;
          if (updated > 0) toast.success(`${updated} despesas atualizadas`);
        }
      }
    },
    onSuccess: () => {
      invalidateAll();
      toast.success('Fornecedor guardado');
      setOpen(false);
    },
    onError: (err: any) => {
      console.error('Supplier save error:', err);
      toast.error(`Erro ao guardar fornecedor: ${err.message || 'Erro desconhecido'}`);
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      // Delete child expenses (generated from recurring rules)
      await supabase.from('financial_expenses').delete().eq('supplier_id', id);
      // Delete legacy subscriptions referencing this supplier
      await supabase.from('financial_subscriptions').delete().eq('supplier_id', id);
      // Now delete the supplier itself
      const { error } = await supabase.from('suppliers').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAll();
      toast.success('Fornecedor eliminado');
      setOpen(false);
    },
    onError: (err: any) => toast.error(`Erro ao eliminar: ${err.message}`),
  });

  // Renewal mutation
  const renewContract = useMutation({
    mutationFn: async () => {
      const supplierId = renewForm.supplier_id;
      const newEnd = renewForm.new_end_date;
      if (!supplierId || !newEnd) return;

      // Get existing recurring expense (parent)
      const { data: parentExpenses } = await supabase.from('financial_expenses')
        .select('*')
        .eq('supplier_id', supplierId)
        .eq('is_recurring', true)
        .limit(1);
      
      const parent = parentExpenses?.[0];
      if (!parent) { toast.error('Sem despesa recorrente associada'); return; }

      // Old end date = new start for generating expenses
      const oldEnd = renewForm.old_end_date;
      const generationStart = new Date(oldEnd + 'T00:00:00');
      generationStart.setMonth(generationStart.getMonth() + 1);
      const genStartStr = generationStart.toISOString().slice(0, 10);

      // Update parent expense end date
      await supabase.from('financial_expenses')
        .update({ recurrence_end_date: newEnd } as any)
        .eq('id', parent.id);

      // Update supplier contract dates
      const history = Array.isArray(renewForm.renewal_history) ? renewForm.renewal_history : [];
      history.push({
        date: new Date().toISOString().slice(0, 10),
        old_end: oldEnd,
        new_end: newEnd,
        notes: renewForm.renewal_notes || '',
      });

      await supabase.from('suppliers').update({
        contract_end_date: newEnd,
        last_renewal_date: new Date().toISOString().slice(0, 10),
        renewal_history: history,
      } as any).eq('id', supplierId);

      // Generate new expenses
      const count = await generateExpensesForPeriod(
        supplierId,
        parent.expense_name || parent.description || '',
        Number(parent.base_value),
        Number(parent.vat_rate),
        parent.periodicity || 'mensal',
        parent.payment_method,
        parent.category,
        genStartStr,
        newEnd,
        parent.id,
        undefined,
        parent.location || 'portugal'
      );
      toast.success(`Contrato renovado — ${count} novas despesas geradas`);
    },
    onSuccess: () => {
      invalidateAll();
      setRenewDialog(false);
      setOpen(false);
    },
  });

  const openRenewalDialog = () => {
    setRenewForm({
      supplier_id: form.id,
      old_end_date: form.contract_end_date || '',
      new_end_date: '',
      renewal_notes: '',
      renewal_history: form.renewal_history || [],
    });
    setRenewDialog(true);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <BackNavigation />
        <PageHeader title="Fornecedores" />
        <div className="flex justify-end">
          <Button size="sm" onClick={() => { setForm({ is_active: true, payment_method: 'transferencia', default_vat_rate: 23 }); setSelectedSupplierId(null); setOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Novo Fornecedor
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>NIF</TableHead>
                  <TableHead>Pagamento</TableHead>
                  <TableHead>Contrato</TableHead>
                  <TableHead className="text-right">Despesas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {suppliers.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Sem fornecedores</TableCell></TableRow>
                ) : suppliers.map((s) => (
                  <TableRow key={s.id} className="cursor-pointer hover:bg-muted/50" onClick={() => { setForm({ ...s, create_recurring: false }); setSelectedSupplierId(s.id); setOpen(true); }}>
                    <TableCell>
                      {(() => {
                        const pu = (s as any).paused_until as string | null;
                        const pausedActive = isPausedUntilActive(pu);
                        const isIndefinite = pu === INDEFINITE_PAUSE_DATE;
                        if (!s.is_active) return <Badge variant="outline" className="bg-muted text-muted-foreground">Inativo</Badge>;
                        if (isIndefinite) return <Badge variant="outline" className="bg-warning/10 text-warning">Pausado ∞</Badge>;
                        if (pausedActive) return <Badge variant="outline" className="bg-warning/10 text-warning">Pausado até {pu}</Badge>;
                        return <Badge variant="outline" className="bg-success/10 text-success">Ativo</Badge>;
                      })()}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{s.name}</div>
                      {s.nif && <div className="text-xs text-muted-foreground">{s.nif}</div>}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{s.nif || '—'}</TableCell>
                    <TableCell><Badge variant="outline">{getPaymentLabel(s.payment_method)}</Badge></TableCell>
                    <TableCell className="text-muted-foreground">
                      {s.contract_start_date && s.contract_end_date 
                        ? `${s.contract_start_date} → ${s.contract_end_date}`
                        : '—'}
                    </TableCell>
                    <TableCell className="text-right">{(expenseCounts as any)[s.id] || 0}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{form.id ? 'Editar Fornecedor' : 'Novo Fornecedor'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div><Label>Nome *</Label><Input value={form.name || ''} onChange={e => setForm((f: any) => ({ ...f, name: e.target.value }))} /></div>
              <div><Label>NIF</Label><Input value={form.nif || ''} onChange={e => {
                const nif = e.target.value;
                const detected = detectLocationFromNif(nif);
                setForm((f: any) => ({ ...f, nif, location: detected.location, default_vat_rate: detected.vat }));
              }} /></div>
              <div><Label>Email</Label><Input value={form.email || ''} onChange={e => setForm((f: any) => ({ ...f, email: e.target.value }))} /></div>
              <div><Label>Telefone</Label><Input value={form.phone || ''} onChange={e => setForm((f: any) => ({ ...f, phone: e.target.value }))} /></div>
              <div><Label>IBAN</Label><Input value={form.iban || ''} onChange={e => setForm((f: any) => ({ ...f, iban: e.target.value }))} placeholder="PT50..." /></div>
              <div><Label>Método de Pagamento</Label>
                <Select value={form.payment_method || 'transferencia'} onValueChange={v => setForm((f: any) => ({ ...f, payment_method: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{paymentMethods.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Categoria</Label>
                <Select value={form.category || 'outro'} onValueChange={v => setForm((f: any) => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['ferramentas', 'marketing', 'pessoal', 'escritorio', 'freelancer', 'formacao', 'viagens', 'outro'].map(c => (
                      <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Departamento</Label>
                <Select value={form.department || '__none__'} onValueChange={v => setForm((f: any) => ({ ...f, department: v === '__none__' ? null : v }))}>
                  <SelectTrigger><SelectValue placeholder="Sem departamento" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sem departamento</SelectItem>
                    {DEPARTMENTS.map(d => (
                      <SelectItem key={d.value} value={d.value}>{d.icon} {d.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">Será aplicado às despesas futuras geradas para este fornecedor.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Localização</Label>
                  <Select value={form.location || 'portugal'} onValueChange={v => setForm((f: any) => ({ ...f, location: v, default_vat_rate: v !== 'portugal' ? 0 : (f.default_vat_rate || 23) }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{LOCATIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Taxa IVA padrão (%)</Label>
                  <Select value={String(form.default_vat_rate ?? 23)} onValueChange={v => setForm((f: any) => ({ ...f, default_vat_rate: parseInt(v) }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[0, 6, 13, 23].map(v => <SelectItem key={v} value={String(v)}>{v}%</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Status & Pause */}
              <div className="rounded-lg border border-border p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CalendarClock className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <Label className="text-sm font-medium">Estado & Pausa</Label>
                      <p className="text-xs text-muted-foreground">{getSupplierStatusLabel(form)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={(form.is_active ?? true) && !isPausedUntilActive(form.paused_until)}
                      onCheckedChange={v => setForm((f: any) => ({ ...f, is_active: v, paused_until: v ? null : f.paused_until }))}
                    />
                    <Label className="text-xs font-normal">{getSupplierStatusLabel(form)}</Label>
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Pausar despesas recorrentes</Label>
                  {(() => {
                    const isIndefinite = form.paused_until === INDEFINITE_PAUSE_DATE;
                    const hasDate = !!form.paused_until && !isIndefinite;
                    return (
                      <>
                        <div className="flex flex-wrap gap-2 items-center">
                          <Input
                            type="date"
                            className="w-44"
                            value={hasDate ? form.paused_until : ''}
                            min={new Date().toISOString().slice(0, 10)}
                            disabled={isIndefinite}
                            onChange={e => setForm((f: any) => ({ ...f, paused_until: e.target.value || null }))}
                          />
                          <Button
                            type="button"
                            variant={isIndefinite ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setForm((f: any) => ({
                              ...f,
                              paused_until: isIndefinite ? null : INDEFINITE_PAUSE_DATE,
                            }))}
                          >
                            {isIndefinite ? '✓ Pausado indefinidamente' : 'Pausar indefinidamente'}
                          </Button>
                          {form.paused_until && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setForm((f: any) => ({ ...f, paused_until: null }))}
                            >
                              Retomar agora
                            </Button>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {isIndefinite
                            ? 'Pausado sem data de retoma. Não serão geradas despesas até clicares em "Retomar agora". O histórico fica intacto.'
                            : hasDate
                            ? `Não serão geradas novas despesas até ${form.paused_until}. O sistema retoma automaticamente nessa data.`
                            : 'Escolhe uma data se sabes quando voltas, ou "Pausar indefinidamente" se não sabes.'}
                        </p>
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Contract dates */}
              <div className="rounded-lg border border-border p-3 space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <CalendarClock className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-medium">Contrato</Label>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-xs">Início</Label><Input type="date" value={form.contract_start_date || ''} onChange={e => setForm((f: any) => ({ ...f, contract_start_date: e.target.value }))} /></div>
                  <div><Label className="text-xs">Fim</Label><Input type="date" value={form.contract_end_date || ''} onChange={e => setForm((f: any) => ({ ...f, contract_end_date: e.target.value }))} /></div>
                </div>
                {form.id && form.contract_end_date && (
                  <Button type="button" variant="outline" size="sm" className="w-full" onClick={openRenewalDialog}>
                    <RefreshCw className="h-3.5 w-3.5 mr-1" /> Renovar Contrato
                  </Button>
                )}
                {form.id && supplierExpenses.some((e) => e.is_recurring && e.source_type === 'rule' && e.status !== 'cancelado') && (
                  <Button type="button" variant="outline" size="sm" className="w-full text-destructive hover:text-destructive" onClick={() => setCancelDialog({ supplierId: form.id, adjustValue: '', showAdjust: false })}>
                    <Ban className="h-3.5 w-3.5 mr-1" /> Cancelar Recorrência
                  </Button>
                )}
                {form.last_renewal_date && (
                  <p className="text-xs text-muted-foreground">Última renovação: {form.last_renewal_date}</p>
                )}
              </div>

              <div><Label>Morada</Label><Input value={form.address || ''} onChange={e => setForm((f: any) => ({ ...f, address: e.target.value }))} /></div>
              <div><Label>Website</Label><Input value={form.website || ''} onChange={e => setForm((f: any) => ({ ...f, website: e.target.value }))} /></div>
              <div><Label>Notas</Label><Textarea value={form.notes || ''} onChange={e => setForm((f: any) => ({ ...f, notes: e.target.value }))} rows={3} /></div>
              <div>
                <Label>Descrição das transações</Label>
                <Input
                  value={form.expense_description_template || ''}
                  onChange={e => setForm((f: any) => ({ ...f, expense_description_template: e.target.value }))}
                  placeholder={`Ex: Pagamento — ${form.name || 'Fornecedor'} — {mes}/{ano}`}
                />
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Usa <code className="bg-muted px-1 rounded">{'{nome}'}</code>, <code className="bg-muted px-1 rounded">{'{mes}'}</code> e <code className="bg-muted px-1 rounded">{'{ano}'}</code> como variáveis. Ao guardar, atualiza todas as despesas existentes.
                </p>
              </div>

              {/* Existing recurring expense summary */}
              {form._existingRecurring && (
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-3">
                  <div className="flex items-center gap-2">
                    <RefreshCw className="h-4 w-4 text-primary" />
                    <Label className="text-sm font-medium">Despesa recorrente ativa</Label>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label className="text-xs">{form.edit_recurring_includes_vat ? 'Valor c/ IVA (€)' : 'Valor base (€)'}</Label>
                      <Input type="number" step="0.01" value={form.edit_recurring_value || ''} onChange={e => setForm((f: any) => ({ ...f, edit_recurring_value: e.target.value }))} />
                    </div>
                    <div><Label className="text-xs">Periodicidade</Label>
                      <Select value={form.edit_recurring_periodicity || 'mensal'} onValueChange={v => setForm((f: any) => ({ ...f, edit_recurring_periodicity: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{PERIODICITIES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label className="text-xs">IVA (%)</Label>
                      <Select value={String(form.edit_recurring_vat ?? form.default_vat_rate ?? 23)} onValueChange={v => setForm((f: any) => ({ ...f, edit_recurring_vat: parseInt(v) }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{[0, 6, 13, 23].map(v => <SelectItem key={v} value={String(v)}>{v}%</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2 pt-5">
                      <Switch checked={form.edit_recurring_includes_vat || false} onCheckedChange={v => setForm((f: any) => ({ ...f, edit_recurring_includes_vat: v }))} />
                      <Label className="text-xs font-normal">Valor inclui IVA</Label>
                    </div>
                  </div>
                  {form.edit_recurring_value && parseFloat(form.edit_recurring_value) > 0 && (() => {
                    const val = parseFloat(form.edit_recurring_value);
                    const vatRate = form.edit_recurring_vat ?? form.default_vat_rate ?? 23;
                    if (form.edit_recurring_includes_vat) {
                      const baseCalc = vatRate > 0 ? Math.round(val / (1 + vatRate / 100) * 100) / 100 : val;
                      const ivaCalc = Math.round((val - baseCalc) * 100) / 100;
                      return <p className="text-xs text-muted-foreground">Base: {formatEuro(baseCalc)} · IVA: {formatEuro(ivaCalc)} · Equiv. mensal: {formatEuro(calcMonthlyEquivalent(baseCalc, form.edit_recurring_periodicity || 'mensal'))}</p>;
                    } else {
                      const totalCalc = Math.round(val * (1 + vatRate / 100) * 100) / 100;
                      const ivaCalc = Math.round(val * vatRate / 100 * 100) / 100;
                      return <p className="text-xs text-muted-foreground">Total c/ IVA: {formatEuro(totalCalc)} · IVA: {formatEuro(ivaCalc)} · Equiv. mensal: {formatEuro(calcMonthlyEquivalent(val, form.edit_recurring_periodicity || 'mensal'))}</p>;
                    }
                  })()}
                  <p className="text-[10px] text-muted-foreground">Ao guardar, as despesas por pagar deste fornecedor serão atualizadas com os novos valores.</p>
                </div>
              )}

              {/* Recurring expense link — create NEW recurring */}
              <div className="rounded-lg border border-border p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <RefreshCw className="h-4 w-4 text-muted-foreground" />
                    <Label className="text-sm font-normal">{form._existingRecurring ? 'Criar nova despesa recorrente' : 'Criar despesa recorrente'}</Label>
                  </div>
                  <Switch checked={form.create_recurring || false} onCheckedChange={v => setForm((f: any) => ({ ...f, create_recurring: v }))} />
                </div>
                {form.create_recurring && (
                  <div className="space-y-3">
                    {!form.contract_start_date && !form.first_payment_date ? (
                      <p className="text-xs text-muted-foreground">💡 Sem datas de contrato — será criada apenas a regra recorrente. Adiciona uma data de 1º pagamento para gerar despesas individuais.</p>
                    ) : null}
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label className="text-xs">{form.recurring_includes_vat ? 'Valor c/ IVA (€)' : 'Valor base (€)'}</Label><Input type="number" step="0.01" value={form.recurring_value || ''} onChange={e => setForm((f: any) => ({ ...f, recurring_value: e.target.value }))} /></div>
                      <div><Label className="text-xs">Periodicidade</Label>
                        <Select value={form.recurring_periodicity || 'mensal'} onValueChange={v => setForm((f: any) => ({ ...f, recurring_periodicity: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{PERIODICITIES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label className="text-xs">IVA (%)</Label>
                        <Select value={String(form.recurring_vat_rate ?? form.default_vat_rate ?? 23)} onValueChange={v => setForm((f: any) => ({ ...f, recurring_vat_rate: parseInt(v) }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{[0, 6, 13, 23].map(v => <SelectItem key={v} value={String(v)}>{v}%</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center gap-2 pt-5">
                        <Switch checked={form.recurring_includes_vat || false} onCheckedChange={v => setForm((f: any) => ({ ...f, recurring_includes_vat: v }))} />
                        <Label className="text-xs font-normal">Valor inclui IVA</Label>
                      </div>
                    </div>
                    {form.recurring_value && parseFloat(form.recurring_value) > 0 && (() => {
                      const val = parseFloat(form.recurring_value);
                      const vatRate = form.recurring_vat_rate ?? form.default_vat_rate ?? 23;
                      if (form.recurring_includes_vat) {
                        const baseCalc = Math.round(val / (1 + vatRate / 100) * 100) / 100;
                        const ivaCalc = Math.round((val - baseCalc) * 100) / 100;
                        return <p className="text-xs text-muted-foreground">Base: {formatEuro(baseCalc)} · IVA: {formatEuro(ivaCalc)}</p>;
                      } else {
                        const totalCalc = Math.round(val * (1 + vatRate / 100) * 100) / 100;
                        const ivaCalc = Math.round(val * vatRate / 100 * 100) / 100;
                        return <p className="text-xs text-muted-foreground">Total c/ IVA: {formatEuro(totalCalc)} · IVA: {formatEuro(ivaCalc)}</p>;
                      }
                    })()}
                    {form.recurring_value && parseFloat(form.recurring_value) > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Equivalente mensal: {formatEuro(calcMonthlyEquivalent(
                          form.recurring_includes_vat
                            ? Math.round(parseFloat(form.recurring_value) / (1 + (form.recurring_vat_rate ?? form.default_vat_rate ?? 23) / 100) * 100) / 100
                            : parseFloat(form.recurring_value),
                          form.recurring_periodicity || 'mensal'
                        ))}
                      </p>
                    )}
                    {form.contract_end_date && (form.first_payment_date || form.contract_start_date) && form.recurring_value && (
                      <p className="text-xs text-muted-foreground">
                        Serão geradas {countOccurrences(form.first_payment_date || form.contract_start_date, form.contract_end_date, form.recurring_periodicity || 'mensal')} despesas
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Documents */}
              <div className="space-y-2">
                <Label>Documentos / Contratos</Label>
                {form.documents && Array.isArray(form.documents) && form.documents.length > 0 && (
                  <div className="space-y-1">
                    {form.documents.map((doc, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <a href={doc.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate flex-1">{doc.name}</a>
                        <Button variant="ghost" aria-label="Eliminar" size="icon" className="h-6 w-6" onClick={() => {
                          setForm((f: any) => ({ ...f, documents: (f.documents || []).filter((_, idx) => idx !== i) }));
                        }}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                      </div>
                    ))}
                  </div>
                )}
                <Input
                  type="file"
                  className="text-xs"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const path = `suppliers/${form.id || 'new'}/${Date.now()}_${file.name}`;
                    const { error: uploadErr } = await supabase.storage.from('financial-files').upload(path, file);
                    if (uploadErr) { toast.error('Erro ao carregar ficheiro'); return; }
                    const { data: urlData } = supabase.storage.from('financial-files').getPublicUrl(path);
                    const docs = Array.isArray(form.documents) ? form.documents : [];
                    setForm((f: any) => ({ ...f, documents: [...docs, { name: file.name, url: urlData.publicUrl }] }));
                    toast.success('Ficheiro carregado!');
                  }}
                />
              </div>

              {/* Renewal history */}
              {form.renewal_history && Array.isArray(form.renewal_history) && form.renewal_history.length > 0 && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Histórico de renovações</Label>
                  {form.renewal_history.map((r, i) => (
                    <div key={i} className="text-xs text-muted-foreground border-l-2 border-border pl-2">
                      {r.date}: {r.old_end} → {r.new_end} {r.notes && `— ${r.notes}`}
                    </div>
                  ))}
                </div>
              )}

              {/* Existing expenses for this supplier */}
              {form.id && supplierExpenses.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">
                      Despesas associadas ({supplierExpenses.filter((e) => e.source_type !== 'rule').length})
                    </Label>
                    <div className="flex gap-3 text-[11px] text-muted-foreground">
                      <span>Pago: {formatEuro(supplierExpenses.filter((e) => e.source_type !== 'rule' && isPaidExpenseStatus(e.status)).reduce((s: number, e: any) => s + (e.total_with_vat || 0), 0))}</span>
                      <span>Pendente: {formatEuro(supplierExpenses.filter((e) => e.source_type !== 'rule' && !isPaidExpenseStatus(e.status) && e.status !== 'cancelado').reduce((s: number, e: any) => s + (e.total_with_vat || 0), 0))}</span>
                    </div>
                  </div>
                  <div className="max-h-64 overflow-y-auto space-y-1 border rounded-md p-2">
                    {supplierExpenses.filter((e) => e.source_type !== 'rule').map((exp) => {
                      const isEditing = editingExpenseId === exp.id;
                      if (isEditing) {
                        const totalPreview = Math.round((parseFloat(expenseEdit.base_value) || 0) * (1 + (expenseEdit.vat_rate ?? 23) / 100) * 100) / 100;
                        return (
                          <div key={exp.id} className="border rounded-lg p-4 space-y-3 bg-muted/20">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">Editar Transação</span>
                              <Badge variant="outline" className="text-[10px]">{exp.expense_id || exp.id.slice(0, 8)}</Badge>
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                              <div>
                                <Label className="text-[10px]">Data</Label>
                                <Input type="date" className="h-8 text-xs" value={expenseEdit.expense_date || ''} onChange={e => setExpenseEdit((f: any) => ({ ...f, expense_date: e.target.value }))} />
                              </div>
                              <div>
                                <Label className="text-[10px]">Status</Label>
                                <Select value={expenseEdit.status || 'por_pagar'} onValueChange={v => setExpenseEdit((f: any) => ({ ...f, status: v }))}>
                                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="por_pagar">Por Pagar</SelectItem>
                                    <SelectItem value="pendente">Pendente</SelectItem>
                                    <SelectItem value="em_atraso">Em Atraso</SelectItem>
                                    <SelectItem value="pago_falta_fatura">Pago, Falta Fatura</SelectItem>
                                    <SelectItem value="tudo_ok">Tudo OK</SelectItem>
                                    <SelectItem value="cancelado">Cancelado</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label className="text-[10px]">Categoria</Label>
                                <Select value={expenseEdit.category || 'outro'} onValueChange={v => setExpenseEdit((f: any) => ({ ...f, category: v }))}>
                                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    {['ferramentas', 'marketing', 'pessoal', 'escritorio', 'freelancer', 'formacao', 'viagens', 'outro'].map(c => (
                                      <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                              <div>
                                <Label className="text-[10px]">Valor base (€)</Label>
                                <Input type="number" step="0.01" className="h-8 text-xs" value={expenseEdit.base_value || ''} onChange={e => setExpenseEdit((f: any) => ({ ...f, base_value: e.target.value }))} />
                              </div>
                              <div>
                                <Label className="text-[10px]">IVA (%)</Label>
                                <Select value={String(expenseEdit.vat_rate ?? 23)} onValueChange={v => setExpenseEdit((f: any) => ({ ...f, vat_rate: parseInt(v) }))}>
                                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    {[0, 6, 13, 23].map(v => <SelectItem key={v} value={String(v)}>{v}%</SelectItem>)}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label className="text-[10px]">Total c/ IVA</Label>
                                <div className="h-8 flex items-center text-xs font-medium">{formatEuro(totalPreview)}</div>
                              </div>
                            </div>
                            <div>
                              <Label className="text-[10px]">Descrição</Label>
                              <Input className="h-8 text-xs" value={expenseEdit.description || ''} onChange={e => setExpenseEdit((f: any) => ({ ...f, description: e.target.value }))} />
                            </div>
                            <div className="grid grid-cols-3 gap-3 text-[10px] text-muted-foreground">
                              <span>Mês: {exp.expense_month || '—'}</span>
                              <span>Trimestre: T{exp.expense_quarter || '—'}</span>
                              <span>Ano: {exp.expense_year || '—'}</span>
                            </div>
                            {exp.payment_method && (
                              <div className="text-[10px] text-muted-foreground">Método: {getPaymentLabel(exp.payment_method)}</div>
                            )}
                            <div className="flex gap-2 justify-end pt-1">
                              <Button size="sm" variant="outline" className="h-7 px-3 text-xs" onClick={() => setEditingExpenseId(null)}>
                                <X className="h-3 w-3 mr-1" /> Cancelar
                              </Button>
                              <Button size="sm" variant="destructive" className="h-7 px-3 text-xs" onClick={async () => {
                                const ok = await confirm({
                                  title: 'Eliminar despesa?',
                                  description: `Despesa de ${exp.expense_date}: ${exp.description || 'sem descrição'}.`,
                                  confirmText: 'Eliminar',
                                  variant: 'destructive',
                                });
                                if (ok) { deleteExpense.mutate(exp.id); setEditingExpenseId(null); }
                              }}>
                                <Trash2 className="h-3 w-3 mr-1" /> Eliminar
                              </Button>
                              <Button size="sm" className="h-7 px-3 text-xs" onClick={() => updateExpense.mutate(expenseEdit)}>
                                <Check className="h-3 w-3 mr-1" /> Guardar
                              </Button>
                            </div>
                          </div>
                        );
                      }
                      return (
                        <div key={exp.id} className="flex items-center justify-between text-xs py-1.5 border-b last:border-0 group hover:bg-muted/30 rounded px-1 cursor-pointer"
                          onClick={() => {
                            setEditingExpenseId(exp.id);
                            setExpenseEdit({ ...exp, base_value: String(exp.base_value) });
                          }}
                        >
                          <div className="flex-1 min-w-0 flex items-center gap-2">
                            <span className="text-muted-foreground shrink-0">{exp.expense_date}</span>
                            <span className="truncate">{exp.description}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-muted-foreground">{formatEuro(exp.base_value || 0)}</span>
                            <span className="font-medium">{formatEuro(exp.total_with_vat || 0)}</span>
                            <Badge
                              variant="outline"
                              className={`cursor-pointer ${isPaidExpenseStatus(exp.status) ? 'bg-success/10 text-success' : exp.status === 'cancelado' ? 'bg-muted text-muted-foreground' : exp.status === 'em_atraso' ? 'bg-destructive/10 text-destructive' : 'bg-warning/10 text-warning'}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                const next = isPaidExpenseStatus(exp.status) ? getAutoExpenseStatus(exp.expense_date) : 'pago_falta_fatura';
                                updateExpense.mutate({ ...exp, status: next });
                              }}
                            >
                              {exp.status === 'tudo_ok' ? 'Tudo OK' : exp.status === 'pago_falta_fatura' ? 'Pago' : exp.status === 'cancelado' ? 'Cancelado' : exp.status === 'em_atraso' ? 'Em Atraso' : exp.status === 'pendente' ? 'Pendente' : 'Por pagar'}
                            </Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <Button className="flex-1" onClick={() => upsert.mutate()} disabled={!form.name?.trim()}>Guardar</Button>
                {form.id && (
                  <Button variant="destructive" size="icon" aria-label="Eliminar fornecedor" onClick={async () => {
                    const ok = await confirm({
                      title: 'Eliminar fornecedor?',
                      description: `"${form.name}" e todas as despesas associadas serão removidos permanentemente.`,
                      confirmText: 'Eliminar',
                      variant: 'destructive',
                    });
                    if (ok) remove.mutate(form.id);
                  }}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Renewal dialog */}
        <Dialog open={renewDialog} onOpenChange={setRenewDialog}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Renovar Contrato</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Contrato atual termina a <strong>{renewForm.old_end_date}</strong>. Define a nova data de fim para gerar as despesas do novo período.
              </p>
              <div>
                <Label>Nova data de fim</Label>
                <Input type="date" value={renewForm.new_end_date || ''} onChange={e => setRenewForm((f: any) => ({ ...f, new_end_date: e.target.value }))} />
              </div>
              <div>
                <Label>Notas (opcional)</Label>
                <Input value={renewForm.renewal_notes || ''} onChange={e => setRenewForm((f: any) => ({ ...f, renewal_notes: e.target.value }))} placeholder="Ex: renovado por mais 12 meses" />
              </div>
              {renewForm.new_end_date && renewForm.old_end_date && (
                <p className="text-xs text-muted-foreground">
                  Novas despesas serão geradas de {renewForm.old_end_date} até {renewForm.new_end_date}
                </p>
              )}
              <Button className="w-full" onClick={() => renewContract.mutate()} disabled={!renewForm.new_end_date}>
                <RefreshCw className="h-4 w-4 mr-1" /> Confirmar Renovação
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Cancel recurrence dialog */}
        <Dialog open={!!cancelDialog} onOpenChange={(v) => !v && setCancelDialog(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Cancelar Recorrência</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                A recorrência será cancelada e todas as despesas futuras não pagas serão eliminadas.
              </p>
              <p className="text-sm font-medium">A despesa deste mês deve ser mantida ou eliminada?</p>
              
              {cancelDialog?.showAdjust && (
                <div className="space-y-2 rounded-md border border-border p-3">
                  <Label className="text-xs">Ajustar valor base deste mês (€)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Deixar vazio para manter o valor atual"
                    value={cancelDialog.adjustValue}
                    onChange={e => setCancelDialog(prev => prev ? { ...prev, adjustValue: e.target.value } : null)}
                  />
                  <p className="text-[10px] text-muted-foreground">Útil para acertos ou última parcela parcial</p>
                </div>
              )}

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => {
                  if (cancelDialog && !cancelDialog.showAdjust) {
                    setCancelDialog(prev => prev ? { ...prev, showAdjust: true } : null);
                  } else if (cancelDialog) {
                    const adj = cancelDialog.adjustValue ? parseFloat(cancelDialog.adjustValue) : undefined;
                    cancelRecurrence.mutate({ supplierId: cancelDialog.supplierId, includeCurrentMonth: false, adjustedValue: adj });
                  }
                }}>
                  {cancelDialog?.showAdjust ? 'Confirmar e manter' : 'Manter este mês'}
                </Button>
                <Button variant="destructive" className="flex-1" onClick={() => {
                  if (cancelDialog) cancelRecurrence.mutate({ supplierId: cancelDialog.supplierId, includeCurrentMonth: true });
                }}>
                  Eliminar também
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
