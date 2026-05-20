import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { PAGE_SIZE, flattenInfiniteData, getInfiniteCount, type InfinitePageResult } from '@/hooks/useInfiniteSupabaseQuery';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';
import { normalizeUnpaidExpenseStatus } from '@/lib/expenseStatus';
import { computeSalary } from '@/lib/payrollCalculations';
import { logAudit } from '@/lib/auditLog';
import { requireConfirm, confirmDestructive } from '@/lib/confirmDestructive';

export type Expense = Tables<'financial_expenses'>;
export type FinancialDocument = Tables<'financial_documents'>;
export type PayrollEntry = Tables<'financial_payroll'>;
export type ContractorEntry = Tables<'financial_contractors'>;

// Recurring expense = unified model replacing old subscriptions
export type RecurringExpense = Expense & {
  expense_name: string | null;
  periodicity: string | null;
  monthly_equivalent: number;
  renewal_date: string | null;
};

const MONTH_LABELS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

const normalizeExpenseRecord = <T extends Expense>(expense: T): T => ({
  ...expense,
  status: normalizeUnpaidExpenseStatus(expense.status, expense.expense_date),
});

export function calcMonthlyEquivalent(value: number, periodicity: string): number {
  switch (periodicity) {
    case 'semanal': return Math.round(value * 4.33 * 100) / 100;
    case 'mensal': return value;
    case 'bimestral': return Math.round(value / 2 * 100) / 100;
    case 'trimestral': return Math.round(value / 3 * 100) / 100;
    case 'semestral': return Math.round(value / 6 * 100) / 100;
    case 'anual': return Math.round(value / 12 * 100) / 100;
    default: return value;
  }
}

export function getSubscriptionOccurrences(
  startDate: string | null,
  periodicity: string,
  month: number,
  year: number
): number {
  if (!startDate) return 0;
  const start = new Date(startDate + 'T00:00:00');
  const startYear = start.getFullYear();
  const startMonth = start.getMonth() + 1;

  if (year < startYear || (year === startYear && month < startMonth)) return 0;

  const monthsDiff = (year - startYear) * 12 + (month - startMonth);

  switch (periodicity) {
    case 'semanal': return 4;
    case 'mensal': return 1;
    case 'bimestral': return monthsDiff % 2 === 0 ? 1 : 0;
    case 'trimestral': return monthsDiff % 3 === 0 ? 1 : 0;
    case 'semestral': return monthsDiff % 6 === 0 ? 1 : 0;
    case 'anual': return monthsDiff % 12 === 0 ? 1 : 0;
    default: return 1;
  }
}

export function getRecurringAnchorDate(subscription: Pick<RecurringExpense, 'renewal_date' | 'expense_date'>): string | null {
  return subscription.renewal_date || subscription.expense_date || null;
}

export interface FinancialDataOptions {
  /** Enable expenses query (default true) */
  expenses?: boolean;
  /** Enable recurring expenses query (default true) */
  recurring?: boolean;
  /** Enable documents query (default true) */
  documents?: boolean;
  /** Enable payroll query (default true) */
  payroll?: boolean;
  /** Enable contractors query (default true) */
  contractors?: boolean;
}

const EMPTY_EXPENSES: Expense[] = [];
const EMPTY_RECURRING: RecurringExpense[] = [];
const EMPTY_DOCUMENTS: FinancialDocument[] = [];
const EMPTY_PAYROLL: PayrollEntry[] = [];
const EMPTY_CONTRACTORS: ContractorEntry[] = [];

export function useFinancialData(options?: FinancialDataOptions) {
  const qc = useQueryClient();
  // Force active queries to refetch immediately (not just mark stale)
  const invalidate = (key: string) => qc.invalidateQueries({ queryKey: [key], refetchType: 'active' });

  const enableExpenses = options?.expenses !== false;
  const enableRecurring = options?.recurring !== false;
  const enableDocuments = options?.documents !== false;
  const enablePayroll = options?.payroll !== false;
  const enableContractors = options?.contractors !== false;

  const expensesQuery = useInfiniteQuery<InfinitePageResult<Expense>>({
    queryKey: ['financial-expenses'],
    initialPageParam: 0,
    queryFn: async ({ pageParam = 0 }) => {
      const from = (pageParam as number) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data, error, count } = await supabase
        .from('financial_expenses')
        .select('*', { count: 'exact' })
        .or('source_type.is.null,source_type.neq.rule')
        .order('expense_date', { ascending: false })
        .range(from, to);
      if (error) throw error;
      const normalizedData = ((data || []) as Expense[]).map(normalizeExpenseRecord);
      return { data: normalizedData, count, nextPage: (data?.length ?? 0) === PAGE_SIZE ? (pageParam as number) + 1 : undefined };
    },
    getNextPageParam: (last) => last.nextPage,
    staleTime: 2 * 60 * 1000,
    enabled: enableExpenses,
  });

  const expenses = {
    ...expensesQuery,
    data: enableExpenses ? flattenInfiniteData(expensesQuery.data?.pages) : EMPTY_EXPENSES,
    totalCount: enableExpenses ? getInfiniteCount(expensesQuery.data?.pages) : 0,
  };

  useEffect(() => {
    if (!enableExpenses || !expensesQuery.hasNextPage || expensesQuery.isFetchingNextPage) return;
    expensesQuery.fetchNextPage();
  }, [enableExpenses, expensesQuery.hasNextPage, expensesQuery.isFetchingNextPage, expensesQuery.fetchNextPage]);

  const recurringExpensesQuery = useQuery({
    queryKey: ['recurring-expenses'],
    queryFn: async () => {
      const { data, error } = await supabase.from('financial_expenses')
        .select('*, suppliers:supplier_id(id, is_active, paused_until)')
        .eq('is_recurring', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return ((data || []) as RecurringExpense[]).map(normalizeExpenseRecord);
    },
    staleTime: 2 * 60 * 1000,
    enabled: enableRecurring,
  });

  const recurringExpenses = {
    ...recurringExpensesQuery,
    data: enableRecurring ? recurringExpensesQuery.data : EMPTY_RECURRING,
  };

  const documents = useQuery({
    queryKey: ['financial-documents'],
    queryFn: async () => {
      const { data, error } = await supabase.from('financial_documents')
        .select('id,title,doc_type,due_date,status,document_name,document_url,notes,period_month,period_year,period_start,period_end,created_at')
        .order('due_date', { ascending: true });
      if (error) throw error;
      return (data || []) as FinancialDocument[];
    },
    staleTime: 2 * 60 * 1000,
    enabled: enableDocuments,
  });

  const payroll = useQuery({
    queryKey: ['financial-payroll'],
    queryFn: async () => {
      const { data, error } = await supabase.from('financial_payroll')
        .select('id,collaborator_name,month,year,gross_salary,net_salary,total_cost,withholding_rate,withholding_value,ss_employee,ss_employer,status,expense_id,created_at')
        .order('year', { ascending: false }).order('month', { ascending: false });
      if (error) throw error;
      return (data || []) as PayrollEntry[];
    },
    staleTime: 2 * 60 * 1000,
    enabled: enablePayroll,
  });

  const contractors = useQuery({
    queryKey: ['financial-contractors'],
    queryFn: async () => {
      const { data, error } = await supabase.from('financial_contractors')
        .select('id,contractor_name,month,year,value,status,location,expense_id,created_at')
        .order('year', { ascending: false }).order('month', { ascending: false });
      if (error) throw error;
      return (data || []) as ContractorEntry[];
    },
    staleTime: 2 * 60 * 1000,
    enabled: enableContractors,
  });

  const upsertExpense = useMutation({
    mutationFn: async (exp: Partial<Expense> & { description?: string }) => {
      const shouldNormalizeStatus = (!exp.id && !exp.status) || exp.status === 'por_pagar' || exp.status === 'pendente';
      let payload: Partial<Expense> & { description?: string } = { ...exp };

      if (shouldNormalizeStatus) {
        let expenseDate = exp.expense_date;

        if (!expenseDate && exp.id) {
          const { data, error } = await supabase
            .from('financial_expenses')
            .select('expense_date')
            .eq('id', exp.id)
            .maybeSingle();

          if (error) throw error;
          expenseDate = data?.expense_date ?? null;
        }

        payload = {
          ...exp,
          status: normalizeUnpaidExpenseStatus(exp.status, expenseDate),
        };
      }

      if (payload.id) {
        const { error } = await supabase.from('financial_expenses').update(payload as TablesUpdate<'financial_expenses'>).eq('id', payload.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('financial_expenses').insert(payload as TablesInsert<'financial_expenses'>);
        if (error) throw error;
      }
    },
    onSuccess: () => invalidate('financial-expenses'),
    onError: () => toast.error('Erro ao guardar despesa'),
  });

  const deleteExpense = useMutation({
    mutationFn: async (id: string) => {
      await requireConfirm();
      const { data: snap } = await supabase
        .from('financial_expenses')
        .select('expense_name, description, total_with_vat, expense_id, source_type, source_id, parent_expense_id')
        .eq('id', id)
        .maybeSingle();

      if (snap?.source_id && (snap.source_type === 'contract' || snap.source_type === 'subscription')) {
        const { error } = await supabase.from('financial_expenses').update({
          status: 'tudo_ok',
          description: `Oculto — ${snap.expense_name || snap.description || snap.expense_id || 'pagamento mensal'}`,
          base_value: 0,
          vat_rate: 0,
          total_with_vat: 0,
          vat_deductible_amount: 0,
        } satisfies TablesUpdate<'financial_expenses'>).eq('id', id);
        if (error) throw error;
        logAudit('cancelled', 'financial_expense', id, { name: snap.expense_name, total: snap.total_with_vat, expense_id: snap.expense_id, source_type: snap.source_type });
        return;
      }

      await supabase.from('financial_expenses').delete().eq('parent_expense_id', id);
      const { error } = await supabase.from('financial_expenses').delete().eq('id', id);
      if (error) throw error;
      logAudit('deleted', 'financial_expense', id, { name: snap?.expense_name, total: snap?.total_with_vat, expense_id: snap?.expense_id });
    },
    onSuccess: () => invalidate('financial-expenses'),
  });

  const upsertDocument = useMutation({
    mutationFn: async (doc: Partial<FinancialDocument> & { title: string }) => {
      if (doc.id) {
        const { error } = await supabase.from('financial_documents').update(doc as TablesUpdate<'financial_documents'>).eq('id', doc.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('financial_documents').insert(doc as TablesInsert<'financial_documents'>);
        if (error) throw error;
      }
    },
    onSuccess: () => invalidate('financial-documents'),
    onError: () => toast.error('Erro ao guardar documento'),
  });

  const deleteDocument = useMutation({
    mutationFn: async (id: string) => {
      await requireConfirm();
      const { error } = await supabase.from('financial_documents').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => invalidate('financial-documents'),
  });

  const upsertPayroll = useMutation({
    mutationFn: async (entry: Partial<PayrollEntry> & { collaborator_name: string; month: number; year: number }) => {
      const breakdown = computeSalary(entry.gross_salary || 0, entry.withholding_rate || 0);
      const record = {
        ...entry,
        withholding_value: breakdown.withholdingValue,
        ss_employee: breakdown.ssEmployee,
        ss_employer: breakdown.ssEmployer,
        net_salary: breakdown.netSalary,
        total_cost: breakdown.totalCost,
      };
      
      if (entry.id) {
        const { error } = await supabase.from('financial_payroll').update(record as TablesUpdate<'financial_payroll'>).eq('id', entry.id);
        if (error) throw error;
        if (entry.expense_id) {
          await supabase.from('financial_expenses').update({
            base_value: breakdown.totalCost, total_with_vat: breakdown.totalCost, status: entry.status === 'pago' ? 'pago' : 'por_pagar',
          }).eq('id', entry.expense_id);
        }
      } else {
        const expMonth = entry.month;
        const expQuarter = Math.ceil(expMonth / 3);
        const { data: expData, error: expError } = await supabase.from('financial_expenses').insert({
          status: 'por_pagar',
          expense_date: `${entry.year}-${String(entry.month).padStart(2, '0')}-01`,
          description: `Salário — ${entry.collaborator_name} — ${MONTH_LABELS[entry.month - 1]} ${entry.year}`,
          category: 'pessoal',
          base_value: breakdown.totalCost,
          vat_rate: 0,
          total_with_vat: breakdown.totalCost,
          location: 'portugal',
          expense_month: expMonth,
          expense_quarter: expQuarter,
          expense_year: entry.year,
          source_type: 'payroll',
        } satisfies TablesInsert<'financial_expenses'>).select('id').single();
        if (expError) throw expError;
        const { error } = await supabase.from('financial_payroll').insert({ ...record, expense_id: expData.id } as TablesInsert<'financial_payroll'>);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      invalidate('financial-payroll');
      invalidate('financial-expenses');
    },
    onError: () => toast.error('Erro ao guardar registo'),
  });

  const deletePayroll = useMutation({
    mutationFn: async (entry: PayrollEntry) => {
      await requireConfirm();
      if (entry.expense_id) await supabase.from('financial_expenses').delete().eq('id', entry.expense_id);
      const { error } = await supabase.from('financial_payroll').delete().eq('id', entry.id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate('financial-payroll');
      invalidate('financial-expenses');
    },
  });

  const upsertContractor = useMutation({
    mutationFn: async (entry: Partial<ContractorEntry> & { contractor_name: string; month: number; year: number }) => {
      if (entry.id) {
        const { error } = await supabase.from('financial_contractors').update(entry as TablesUpdate<'financial_contractors'>).eq('id', entry.id);
        if (error) throw error;
        if (entry.expense_id) {
          await supabase.from('financial_expenses').update({
            base_value: entry.value || 0, total_with_vat: entry.value || 0, status: entry.status === 'pago' ? 'pago' : 'por_pagar',
            location: entry.location || 'portugal',
          }).eq('id', entry.expense_id);
        }
      } else {
        const expMonth = entry.month;
        const expQuarter = Math.ceil(expMonth / 3);
        const { data: expData, error: expError } = await supabase.from('financial_expenses').insert({
          status: 'por_pagar',
          expense_date: `${entry.year}-${String(entry.month).padStart(2, '0')}-01`,
          description: `Prestador — ${entry.contractor_name} — ${MONTH_LABELS[entry.month - 1]} ${entry.year}`,
          category: 'freelancer',
          base_value: entry.value || 0,
          vat_rate: 0,
          total_with_vat: entry.value || 0,
          location: entry.location || 'portugal',
          expense_month: expMonth,
          expense_quarter: expQuarter,
          expense_year: entry.year,
          source_type: 'contractor',
        } satisfies TablesInsert<'financial_expenses'>).select('id').single();
        if (expError) throw expError;
        const { error } = await supabase.from('financial_contractors').insert({ ...entry, expense_id: expData.id } as TablesInsert<'financial_contractors'>);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      invalidate('financial-contractors');
      invalidate('financial-expenses');
    },
    onError: () => toast.error('Erro ao guardar prestador'),
  });

  const deleteContractor = useMutation({
    mutationFn: async (entry: ContractorEntry) => {
      await requireConfirm();
      if (entry.expense_id) await supabase.from('financial_expenses').delete().eq('id', entry.expense_id);
      const { error } = await supabase.from('financial_contractors').delete().eq('id', entry.id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate('financial-contractors');
      invalidate('financial-expenses');
    },
  });

  const upsertRecurringExpense = useMutation({
    mutationFn: async (rec: Partial<Expense> & { expense_name: string; periodicity: string; base_value: number }) => {
      const monthly = calcMonthlyEquivalent(rec.base_value, rec.periodicity);
      const record = { ...rec, is_recurring: true, monthly_equivalent: monthly };
      if (rec.id) {
        const { error } = await supabase.from('financial_expenses').update(record as TablesUpdate<'financial_expenses'>).eq('id', rec.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('financial_expenses').insert(record as TablesInsert<'financial_expenses'>);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      invalidate('recurring-expenses');
      invalidate('financial-expenses');
    },
    onError: () => toast.error('Erro ao guardar despesa recorrente'),
  });

  const deleteRecurringExpense = useMutation({
    mutationFn: async (id: string) => {
      await requireConfirm();
      await supabase.from('financial_expenses').delete().eq('parent_expense_id', id);
      const { error } = await supabase.from('financial_expenses').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate('recurring-expenses');
      invalidate('financial-expenses');
    },
  });

  return {
    expenses, recurringExpenses, documents, payroll, contractors,
    upsertExpense, deleteExpense,
    upsertRecurringExpense, deleteRecurringExpense,
    upsertDocument, deleteDocument,
    upsertPayroll, deletePayroll,
    upsertContractor, deleteContractor,
  };
}
