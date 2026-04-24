import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  computeSsIndependente,
  computeSsPatronalForMonth,
  buildIndependenteQuarterMap,
} from '@/lib/payrollCalculations';
import type { useFinancialData, Expense } from '@/hooks/useFinancialData';
import type { SSContract, SSPayrollEntry, IndependenteRow, PatronalRow, SSPaymentType } from './types';
import { SS_MONTHS } from './types';
import { toast } from 'sonner';

interface SaleLike {
  invoice_total: number;
  base_value: number;
  sale_month: number | null;
  sale_year: number | null;
}

interface UseSSDataParams {
  fin: ReturnType<typeof useFinancialData>;
  expenses: Expense[];
  currentYear: number;
  sales: SaleLike[];
  showIndependente: boolean;
  showPatronal: boolean;
}

export function useSSData({ fin, expenses, currentYear, sales, showIndependente, showPatronal }: UseSSDataParams) {
  const { data: contracts = [] } = useQuery<SSContract[]>({
    queryKey: ['member-contracts-ss', currentYear],
    queryFn: async () => {
      const { data } = await supabase
        .from('member_contracts')
        .select('*, team_members(id, full_name)')
        .eq('contract_type', 'contrato_trabalho')
        .in('status', ['ativo']);
      return (data as unknown as SSContract[]) || [];
    },
    enabled: showPatronal,
  });

  const { data: payrollEntries = [] } = useQuery<SSPayrollEntry[]>({
    queryKey: ['financial-payroll-ss', currentYear],
    queryFn: async () => {
      const { data } = await supabase
        .from('financial_payroll')
        .select('*')
        .eq('year', currentYear);
      return (data as unknown as SSPayrollEntry[]) || [];
    },
    enabled: showPatronal,
  });

  const ssExpenses = useMemo(() =>
    expenses.filter(e => e.category === 'seguranca_social' && e.expense_year === currentYear),
    [expenses, currentYear]
  );

  const salesByQuarter = useMemo(() => {
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

  const independenteData = useMemo<IndependenteRow[]>(() => {
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

  const relevantPayroll = useMemo(() =>
    payrollEntries.filter(p => {
      const memberName = p.collaborator_name || '';
      return contracts.some(c => c.team_members?.full_name === memberName);
    }),
    [payrollEntries, contracts]
  );

  const patronalData = useMemo<PatronalRow[]>(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const monthPayroll = relevantPayroll.filter(p => p.month === m);
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
      };
    });
  }, [relevantPayroll, ssExpenses]);

  const handleSavePayment = async (month: number, value: number, type: SSPaymentType) => {
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
        description: `${prefix} — ${SS_MONTHS[month - 1]} ${currentYear}`,
      } as never);
    } else if (value > 0) {
      await fin.upsertExpense.mutateAsync({
        description: `${prefix} — ${SS_MONTHS[month - 1]} ${currentYear}`,
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
      } as never);
    }
    toast.success(`${prefix} de ${SS_MONTHS[month - 1]} guardada`);
  };

  const handleTogglePayment = async (month: number, type: SSPaymentType) => {
    const existing = ssExpenses.find(e =>
      e.expense_month === month &&
      (type === 'independente' ? e.description?.toLowerCase().includes('independente') : !e.description?.toLowerCase().includes('independente'))
    );
    if (existing) {
      const newStatus = ['pago_falta_fatura', 'tudo_ok'].includes(existing.status) ? 'por_pagar' : 'pago_falta_fatura';
      await fin.upsertExpense.mutateAsync({
        id: existing.id,
        status: newStatus,
      } as never);
      toast.success(newStatus === 'pago_falta_fatura' ? `Marcada como paga` : `Marcada como pendente`);
    }
  };

  return {
    contracts,
    independenteData,
    patronalData,
    handleSavePayment,
    handleTogglePayment,
  };
}
