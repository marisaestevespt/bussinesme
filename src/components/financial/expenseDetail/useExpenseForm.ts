import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { useFinancialData, Expense } from '@/hooks/useFinancialData';
import type { DocEntry } from '../InvoiceUpload';
import type { ExpenseFormState } from '../types';
import { PERIODICITY_MULTIPLIERS } from './constants';

interface Args {
  expense: Expense | null;
  open: boolean;
  fin: ReturnType<typeof useFinancialData>;
  onClose: () => void;
}

export function useExpenseForm({ expense, open, fin, onClose }: Args) {
  const [form, setForm] = useState<ExpenseFormState>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!expense || !open) return;
    const allDocs = (Array.isArray(expense.documents) ? expense.documents : []) as DocEntry[];
    const regularDocs = allDocs.filter(d => (d as DocEntry & { type?: string }).type !== 'meta_ads');
    const metaDocs = allDocs.filter(d => (d as DocEntry & { type?: string }).type === 'meta_ads');

    setForm({
      id: expense.id,
      status: expense.status || 'por_pagar',
      expense_date: expense.expense_date ? new Date(expense.expense_date + 'T00:00:00') : undefined,
      description: expense.description || '',
      category: expense.category || 'outro',
      base_value: String(expense.base_value),
      vat_rate: expense.vat_rate ?? 23,
      location: expense.location || 'portugal',
      documents: regularDocs,
      meta_ads_docs: metaDocs.map(d => ({ name: d.name, url: d.url })),
      includes_vat: false,
      source_type: expense.source_type ?? null,
      department: expense.department || '',
      supplier_id: expense.supplier_id || null,
      is_recurring: expense.is_recurring || false,
      periodicity: expense.periodicity || 'mensal',
      monthly_equivalent: expense.monthly_equivalent || 0,
      payment_method: expense.payment_method || '',
      expense_name: expense.expense_name || '',
      icon: (expense as Expense & { icon?: unknown }).icon ?? null,
    });
  }, [expense, open]);

  const handleSave = async () => {
    setSaving(true);
    const inputValue = parseFloat(String(form.base_value ?? '')) || 0;
    const vat = Number(form.vat_rate ?? 23);
    let base: number, total: number;
    if (form.includes_vat) {
      total = inputValue;
      base = Math.round(inputValue / (1 + vat / 100) * 100) / 100;
    } else {
      base = inputValue;
      total = Math.round(base * (1 + vat / 100) * 100) / 100;
    }
    const d = form.expense_date;
    const date = d ? (d instanceof Date ? format(d, 'yyyy-MM-dd') : d) : null;
    const month = date ? parseInt(date.slice(5, 7)) : null;
    const quarter = month ? Math.ceil(month / 3) : null;
    const year = date ? parseInt(date.slice(0, 4)) : null;

    const regularDocs = form.documents || [];
    const metaDocs = (form.meta_ads_docs || []).map(d => ({ ...d, type: 'meta_ads' }));
    const allDocs = [...regularDocs, ...metaDocs];

    const isRecurring = form.is_recurring || false;
    const periodicity = isRecurring ? (form.periodicity || 'mensal') : null;
    const monthlyEquivalent = isRecurring
      ? Math.round(total / (PERIODICITY_MULTIPLIERS[periodicity || 'mensal'] || 1) * 100) / 100
      : 0;

    const autoStatus = (form.status === 'pago_falta_fatura' && regularDocs.length > 0) ? 'tudo_ok' : form.status;

    await fin.upsertExpense.mutateAsync({
      id: form.id,
      status: autoStatus,
      expense_date: date,
      description: form.description || null,
      category: form.category,
      base_value: base,
      vat_rate: vat,
      total_with_vat: total,
      location: form.location,
      documents: allDocs,
      expense_month: month,
      expense_quarter: quarter,
      expense_year: year,
      department: form.department || null,
      supplier_id: form.supplier_id || null,
      is_recurring: isRecurring,
      periodicity,
      monthly_equivalent: monthlyEquivalent,
      payment_method: form.payment_method || null,
      expense_name: form.expense_name || null,
      source_type: isRecurring ? 'rule' : (form.source_type || 'manual'),
      icon: (form.icon as never) ?? null,
    });

    if (form.source_type === 'contract' && form.source_id) {
      try {
        const docUrl = regularDocs.length > 0 ? regularDocs[0].url : null;
        const { data: contract } = await supabase
          .from('member_contracts')
          .select('member_id')
          .eq('id', form.source_id)
          .maybeSingle();
        if (contract?.member_id && month && year) {
          await supabase
            .from('member_payments')
            .update({ document_url: docUrl })
            .eq('member_id', contract.member_id)
            .eq('month', month)
            .eq('year', year);
        }
      } catch {
        // Non-critical
      }
    }

    toast.success('Despesa atualizada');
    setSaving(false);
    onClose();
  };

  const handleDelete = async () => {
    if (!form.id) return;
    await fin.deleteExpense.mutateAsync(form.id);
    toast.success('Despesa eliminada');
    onClose();
  };

  return { form, setForm, saving, handleSave, handleDelete };
}