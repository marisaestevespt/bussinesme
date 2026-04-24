import type { TablesInsert } from '@/integrations/supabase/types';
import type { RecurringExpense } from '@/hooks/useFinancialData';
import { MONTHS, getSubscriptionDueDate } from './helpers';

export type ExpenseInsert = TablesInsert<'financial_expenses'>;

export interface ContractLike {
  id: string;
  member_id?: string | null;
  monthly_value?: number | null;
  payment_day?: number | null;
  contract_type?: string | null;
  team_members?: { full_name?: string | null } | null;
}

/** Builds a financial expense payload for a recurring subscription. */
export function buildSubscriptionExpense(
  sub: RecurringExpense,
  month: number,
  year: number,
  status: string,
): ExpenseInsert {
  const subName = sub.expense_name || sub.description || '';
  const dateStr = getSubscriptionDueDate(sub, month, year);
  return {
    description: `${subName} — ${MONTHS[month - 1]} ${year}`,
    category: sub.category || 'outro',
    base_value: sub.base_value,
    vat_rate: sub.vat_rate || 0,
    total_with_vat: sub.total_with_vat,
    location: sub.location,
    expense_date: dateStr,
    expense_month: month,
    expense_quarter: Math.ceil(month / 3),
    expense_year: year,
    status,
    source_type: 'subscription',
    source_id: sub.id,
    parent_expense_id: sub.id,
    supplier_id: sub.supplier_id,
    payment_method: sub.payment_method,
  };
}

/** Builds a financial expense payload for a member contract payment. */
export function buildContractExpense(
  contract: ContractLike,
  month: number,
  year: number,
  status: string,
): ExpenseInsert {
  const memberName = contract.team_members?.full_name || '—';
  const value = contract.monthly_value || 0;
  const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(contract.payment_day || 15).padStart(2, '0')}`;
  const ctype = contract.contract_type || 'outro';
  const category = ctype === 'contrato_trabalho' || ctype === 'outro' ? 'ordenados' : 'prestadores';
  return {
    description: `${memberName} — ${MONTHS[month - 1]} ${year}`,
    category,
    base_value: value,
    vat_rate: 0,
    total_with_vat: value,
    location: 'portugal',
    expense_date: dateStr,
    expense_month: month,
    expense_quarter: Math.ceil(month / 3),
    expense_year: year,
    status,
    source_type: 'contract',
    source_id: contract.id,
  };
}
