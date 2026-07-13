import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Expense, RecurringExpense } from '@/hooks/useFinancialData';
import { canRenderSubscriptionForMonth, getSubscriptionDueDate } from './finMensal/helpers';

interface ContractRow {
  id: string;
  member_id: string | null;
  monthly_value: number | null;
  payment_day: number | null;
  contract_type: string | null;
  team_members?: { full_name?: string | null } | null;
}

/**
 * Projects unmaterialized recurring subscription & member-contract expenses for
 * every month of a given year, so annual/quarterly views mirror the same totals
 * that FinMensal shows (real materialized rows + projections for months not yet
 * touched by the daily materialization cron).
 *
 * Dedup: skips any month/rule already present in `materializedExpenses` via
 * `parent_expense_id` or `source_id` with matching `source_type`.
 */
export function useProjectedRecurringExpenses(year: number, materializedExpenses: Expense[]): Expense[] {
  const { data: recurring = [] } = useQuery({
    queryKey: ['recurring-rules-projection'],
    queryFn: async () => {
      const { data } = await supabase
        .from('financial_expenses')
        .select('*, suppliers(is_active, paused_until)')
        .eq('is_recurring', true);
      return (data || []) as unknown as RecurringExpense[];
    },
    staleTime: 60_000,
  });

  const { data: contracts = [] } = useQuery({
    queryKey: ['active-contracts-projection'],
    queryFn: async () => {
      const { data } = await supabase
        .from('member_contracts')
        .select('id, member_id, monthly_value, payment_day, contract_type, team_members(full_name)')
        .in('status', ['ativo'])
        .not('contract_type', 'in', '(contrato_prestacao,prestacao_servicos)');
      const rows = (data || []) as ContractRow[];
      const memberIds = rows.map(c => c.member_id).filter(Boolean) as string[];
      if (memberIds.length === 0) return rows;
      const { data: sups } = await supabase
        .from('suppliers')
        .select('member_id')
        .in('member_id', memberIds)
        .eq('is_active', true);
      const supMemberIds = new Set((sups || []).map(s => s.member_id));
      return rows.filter(c => !supMemberIds.has(c.member_id));
    },
    staleTime: 60_000,
  });

  return useMemo<Expense[]>(() => {
    const materializedKeys = new Set<string>();
    materializedExpenses.forEach(e => {
      if (e.expense_year !== year || e.expense_month == null) return;
      if (e.parent_expense_id) materializedKeys.add(`${e.expense_month}-${e.parent_expense_id}`);
      if ((e.source_type === 'subscription' || e.source_type === 'contract') && e.source_id) {
        materializedKeys.add(`${e.expense_month}-${e.source_id}`);
      }
    });

    const projected: Expense[] = [];
    for (let m = 1; m <= 12; m++) {
      recurring.forEach(sub => {
        if (!canRenderSubscriptionForMonth(sub, m, year)) return;
        if (materializedKeys.has(`${m}-${sub.id}`)) return;
        const dateStr = getSubscriptionDueDate(sub, m, year);
        projected.push({
          ...(sub as unknown as Expense),
          id: `projected-sub-${sub.id}-${m}-${year}`,
          expense_date: dateStr,
          expense_month: m,
          expense_year: year,
          expense_quarter: Math.ceil(m / 3),
          source_type: 'subscription',
          source_id: sub.id,
          parent_expense_id: sub.id,
          is_recurring: false,
        } as Expense);
      });

      contracts.forEach(contract => {
        if (materializedKeys.has(`${m}-${contract.id}`)) return;
        const value = Number(contract.monthly_value || 0);
        if (value <= 0) return;
        const ctype = contract.contract_type || 'outro';
        const category = ctype === 'contrato_trabalho' || ctype === 'outro' ? 'ordenados' : 'prestadores';
        const day = Math.min(contract.payment_day || 15, new Date(year, m, 0).getDate());
        const dateStr = `${year}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        projected.push({
          id: `projected-contract-${contract.id}-${m}-${year}`,
          base_value: value,
          total_with_vat: value,
          vat_rate: 0,
          vat_deductible_amount: 0,
          category,
          expense_date: dateStr,
          expense_month: m,
          expense_year: year,
          expense_quarter: Math.ceil(m / 3),
          status: 'pendente',
          source_type: 'contract',
          source_id: contract.id,
          description: `${contract.team_members?.full_name || '—'}`,
        } as unknown as Expense);
      });
    }
    return projected;
  }, [recurring, contracts, materializedExpenses, year]);
}