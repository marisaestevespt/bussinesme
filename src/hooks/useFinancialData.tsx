import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type Expense = {
  id: string;
  expense_id: string;
  status: string;
  expense_date: string | null;
  description: string | null;
  category: string;
  base_value: number;
  vat_rate: number;
  total_with_vat: number;
  location: string;
  documents: any;
  expense_month: number | null;
  expense_quarter: number | null;
  expense_year: number | null;
  source_type: string | null;
  source_id: string | null;
  created_at: string;
};

export type Subscription = {
  id: string;
  platform_name: string;
  category: string;
  value: number;
  periodicity: string;
  monthly_equivalent: number;
  location: string;
  start_date: string | null;
  renewal_date: string | null;
  status: string;
  notes: string | null;
  created_at: string;
};

export type FinancialDocument = {
  id: string;
  title: string;
  doc_type: string;
  period_start: string | null;
  period_end: string | null;
  period_month: number | null;
  period_year: number | null;
  due_date: string | null;
  status: string;
  document_url: string | null;
  document_name: string | null;
  notes: string | null;
  created_at: string;
};

export type PayrollEntry = {
  id: string;
  profile_id: string | null;
  collaborator_name: string;
  month: number;
  year: number;
  gross_salary: number;
  withholding_rate: number;
  withholding_value: number;
  ss_employee: number;
  ss_employer: number;
  net_salary: number;
  total_cost: number;
  status: string;
  expense_id: string | null;
  created_at: string;
};

export type ContractorEntry = {
  id: string;
  contractor_name: string;
  month: number;
  year: number;
  service: string | null;
  value: number;
  location: string;
  documents: any;
  status: string;
  expense_id: string | null;
  created_at: string;
};

const MONTH_LABELS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

export function calcMonthlyEquivalent(value: number, periodicity: string): number {
  switch (periodicity) {
    case 'semanal': return Math.round(value * 4.33 * 100) / 100;
    case 'mensal': return value;
    case 'trimestral': return Math.round(value / 3 * 100) / 100;
    case 'semestral': return Math.round(value / 6 * 100) / 100;
    case 'anual': return Math.round(value / 12 * 100) / 100;
    default: return value;
  }
}

export function useFinancialData() {
  const qc = useQueryClient();

  const expenses = useQuery({
    queryKey: ['financial-expenses'],
    queryFn: async () => {
      const { data, error } = await supabase.from('financial_expenses').select('*').order('expense_date', { ascending: false });
      if (error) throw error;
      return (data || []) as Expense[];
    },
  });

  const subscriptions = useQuery({
    queryKey: ['financial-subscriptions'],
    queryFn: async () => {
      const { data, error } = await supabase.from('financial_subscriptions').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as Subscription[];
    },
  });

  const documents = useQuery({
    queryKey: ['financial-documents'],
    queryFn: async () => {
      const { data, error } = await supabase.from('financial_documents').select('*').order('due_date', { ascending: true });
      if (error) throw error;
      return (data || []) as FinancialDocument[];
    },
  });

  const payroll = useQuery({
    queryKey: ['financial-payroll'],
    queryFn: async () => {
      const { data, error } = await supabase.from('financial_payroll').select('*').order('year', { ascending: false }).order('month', { ascending: false });
      if (error) throw error;
      return (data || []) as PayrollEntry[];
    },
  });

  const contractors = useQuery({
    queryKey: ['financial-contractors'],
    queryFn: async () => {
      const { data, error } = await supabase.from('financial_contractors').select('*').order('year', { ascending: false }).order('month', { ascending: false });
      if (error) throw error;
      return (data || []) as ContractorEntry[];
    },
  });

  const upsertExpense = useMutation({
    mutationFn: async (exp: Partial<Expense> & { description?: string }) => {
      if (exp.id) {
        const { error } = await supabase.from('financial_expenses').update(exp as any).eq('id', exp.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('financial_expenses').insert(exp as any);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['financial-expenses'] }),
    onError: () => toast.error('Erro ao guardar despesa'),
  });

  const deleteExpense = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('financial_expenses').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['financial-expenses'] }),
  });

  const upsertSubscription = useMutation({
    mutationFn: async (sub: Partial<Subscription> & { platform_name: string }) => {
      const monthly = calcMonthlyEquivalent(sub.value || 0, sub.periodicity || 'mensal');
      const record = { ...sub, monthly_equivalent: monthly };
      if (sub.id) {
        const { error } = await supabase.from('financial_subscriptions').update(record as any).eq('id', sub.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('financial_subscriptions').insert(record as any);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['financial-subscriptions'] }),
    onError: () => toast.error('Erro ao guardar subscrição'),
  });

  const deleteSubscription = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('financial_subscriptions').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['financial-subscriptions'] }),
  });

  const upsertDocument = useMutation({
    mutationFn: async (doc: Partial<FinancialDocument> & { title: string }) => {
      if (doc.id) {
        const { error } = await supabase.from('financial_documents').update(doc as any).eq('id', doc.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('financial_documents').insert(doc as any);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['financial-documents'] }),
    onError: () => toast.error('Erro ao guardar documento'),
  });

  const deleteDocument = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('financial_documents').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['financial-documents'] }),
  });

  const upsertPayroll = useMutation({
    mutationFn: async (entry: Partial<PayrollEntry> & { collaborator_name: string; month: number; year: number }) => {
      // Calculate derived fields
      const gross = entry.gross_salary || 0;
      const whRate = entry.withholding_rate || 0;
      const whValue = Math.round(gross * whRate / 100 * 100) / 100;
      const ssEmp = Math.round(gross * 0.11 * 100) / 100;
      const ssEr = Math.round(gross * 0.2375 * 100) / 100;
      const net = Math.round((gross - whValue - ssEmp) * 100) / 100;
      const totalCost = Math.round((gross + ssEr) * 100) / 100;
      const record = { ...entry, withholding_value: whValue, ss_employee: ssEmp, ss_employer: ssEr, net_salary: net, total_cost: totalCost };
      
      if (entry.id) {
        const { error } = await supabase.from('financial_payroll').update(record as any).eq('id', entry.id);
        if (error) throw error;
        // Update linked expense
        if (entry.expense_id) {
          await supabase.from('financial_expenses').update({
            base_value: totalCost, total_with_vat: totalCost, status: entry.status === 'pago' ? 'pago' : 'por_pagar',
          }).eq('id', entry.expense_id);
        }
      } else {
        // Create expense first
        const expMonth = entry.month;
        const expQuarter = Math.ceil(expMonth / 3);
        const { data: expData, error: expError } = await supabase.from('financial_expenses').insert({
          status: 'por_pagar',
          expense_date: `${entry.year}-${String(entry.month).padStart(2, '0')}-01`,
          description: `Salário — ${entry.collaborator_name} — ${MONTH_LABELS[entry.month - 1]} ${entry.year}`,
          category: 'pessoal',
          base_value: totalCost,
          vat_rate: 0,
          total_with_vat: totalCost,
          location: 'portugal',
          expense_month: expMonth,
          expense_quarter: expQuarter,
          expense_year: entry.year,
          source_type: 'payroll',
        } as any).select('id').single();
        if (expError) throw expError;
        const { error } = await supabase.from('financial_payroll').insert({ ...record, expense_id: expData.id } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['financial-payroll'] });
      qc.invalidateQueries({ queryKey: ['financial-expenses'] });
    },
    onError: () => toast.error('Erro ao guardar registo'),
  });

  const deletePayroll = useMutation({
    mutationFn: async (entry: PayrollEntry) => {
      if (entry.expense_id) await supabase.from('financial_expenses').delete().eq('id', entry.expense_id);
      const { error } = await supabase.from('financial_payroll').delete().eq('id', entry.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['financial-payroll'] });
      qc.invalidateQueries({ queryKey: ['financial-expenses'] });
    },
  });

  const upsertContractor = useMutation({
    mutationFn: async (entry: Partial<ContractorEntry> & { contractor_name: string; month: number; year: number }) => {
      if (entry.id) {
        const { error } = await supabase.from('financial_contractors').update(entry as any).eq('id', entry.id);
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
        } as any).select('id').single();
        if (expError) throw expError;
        const { error } = await supabase.from('financial_contractors').insert({ ...entry, expense_id: expData.id } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['financial-contractors'] });
      qc.invalidateQueries({ queryKey: ['financial-expenses'] });
    },
    onError: () => toast.error('Erro ao guardar prestador'),
  });

  const deleteContractor = useMutation({
    mutationFn: async (entry: ContractorEntry) => {
      if (entry.expense_id) await supabase.from('financial_expenses').delete().eq('id', entry.expense_id);
      const { error } = await supabase.from('financial_contractors').delete().eq('id', entry.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['financial-contractors'] });
      qc.invalidateQueries({ queryKey: ['financial-expenses'] });
    },
  });

  return {
    expenses, subscriptions, documents, payroll, contractors,
    upsertExpense, deleteExpense,
    upsertSubscription, deleteSubscription,
    upsertDocument, deleteDocument,
    upsertPayroll, deletePayroll,
    upsertContractor, deleteContractor,
  };
}
