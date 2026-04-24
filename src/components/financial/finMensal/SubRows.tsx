import { useState } from 'react';
import { TableRow, TableCell } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { useFinancialData, Expense, RecurringExpense } from '@/hooks/useFinancialData';
import type { useQueryClient } from '@tanstack/react-query';
import { ExpenseStatusSelect } from '../InlineStatusSelect';
import { formatEuro } from '@/lib/formatting';
import { locationLabel } from '@/lib/labelMaps';
import { MONTHS, CONTRACT_TYPE_LABELS, getSubscriptionDueDate, canRenderSubscriptionForMonth } from './helpers';

export function SubRow({ sub, linkedExpense, month, currentYear, fin, onExpenseClick, getCategoryLabel }: {
  sub: RecurringExpense;
  linkedExpense: Expense | undefined;
  month: number;
  currentYear: number;
  fin: ReturnType<typeof useFinancialData>;
  onExpenseClick?: () => void;
  getCategoryLabel: (type: string, value: string) => string;
}) {
  const [, setConfirming] = useState(false);

  const vatRate = sub.vat_rate || 0;
  const displayBase = linkedExpense ? linkedExpense.base_value : sub.base_value;
  const displayTotal = linkedExpense ? linkedExpense.total_with_vat : sub.total_with_vat;
  const projectedExpenseDate = getSubscriptionDueDate(sub, month, currentYear);
  const isCurrentMonth = month === new Date().getMonth() + 1 && currentYear === new Date().getFullYear();
  const defaultStatus = isCurrentMonth ? 'pendente' : 'por_pagar';
  const currentStatus = linkedExpense?.status || defaultStatus;
  const subName = sub.expense_name || sub.description || '';
  const expenseId = linkedExpense ? (linkedExpense as any).expense_id || 'A gerar' : 'A gerar';
  const category = linkedExpense?.category || sub.category || 'outro';
  const expenseDate = linkedExpense ? (linkedExpense as any).expense_date || '—' : projectedExpenseDate;

  const handleStatusChange = async (_id: string, newStatus: string) => {
    setConfirming(true);
    const dateStr = projectedExpenseDate;
    if (linkedExpense) {
      await fin.upsertExpense.mutateAsync({ id: linkedExpense.id, status: newStatus } as any);
    } else {
      if (!canRenderSubscriptionForMonth(sub, month, currentYear)) {
        setConfirming(false);
        toast.error('Esse pagamento já está fora do período do contrato.');
        return;
      }

      await fin.upsertExpense.mutateAsync({
        description: `${subName} — ${MONTHS[month - 1]} ${currentYear}`,
        category: sub.category || 'plataformas', base_value: sub.base_value, vat_rate: vatRate, total_with_vat: sub.total_with_vat,
        location: sub.location, expense_date: dateStr, expense_month: month,
        expense_quarter: Math.ceil(month / 3), expense_year: currentYear,
        status: newStatus, source_type: 'subscription', source_id: sub.id,
        parent_expense_id: sub.id,
        supplier_id: sub.supplier_id,
        payment_method: sub.payment_method,
      } as any);
    }
    setConfirming(false);
  };

  return (
    <TableRow className={cn(!['pago_falta_fatura', 'tudo_ok'].includes(currentStatus) ? 'bg-muted/30' : '', 'cursor-pointer hover:bg-muted/50')} onClick={onExpenseClick}>
      <TableCell onClick={e => e.stopPropagation()}>
        <ExpenseStatusSelect expenseId={linkedExpense?.id || `sub-${sub.id}`} currentStatus={currentStatus} onUpdate={handleStatusChange} />
      </TableCell>
      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{expenseId}</TableCell>
      <TableCell className="whitespace-nowrap">{expenseDate}</TableCell>
      <TableCell>{linkedExpense?.description || subName}</TableCell>
      <TableCell>{getCategoryLabel('expense', category)}</TableCell>
      <TableCell>{locationLabel(linkedExpense ? ((linkedExpense as any).location || sub.location) : sub.location)}</TableCell>
      <TableCell className="text-right">{formatEuro(displayBase)}</TableCell>
      <TableCell className="text-right">{vatRate}%</TableCell>
      <TableCell className="text-right">{formatEuro(displayTotal)}</TableCell>
    </TableRow>
  );
}

export function ContractRow({ contract, linkedExpense, month, currentYear, fin, qc, onExpenseClick }: {
  contract: any;
  linkedExpense: Expense | undefined;
  month: number;
  currentYear: number;
  fin: ReturnType<typeof useFinancialData>;
  qc: ReturnType<typeof useQueryClient>;
  onExpenseClick?: () => void;
}) {
  const [, setConfirming] = useState(false);
  const memberName = contract.team_members?.full_name || '—';
  const value = contract.monthly_value || 0;
  const contractType = contract.contract_type || 'outro';
  const isCurrentMonth = month === new Date().getMonth() + 1 && currentYear === new Date().getFullYear();
  const defaultStatus = isCurrentMonth ? 'pendente' : 'por_pagar';
  const currentStatus = linkedExpense?.status || defaultStatus;

  const handleStatusChange = async (_id: string, newStatus: string) => {
    setConfirming(true);
    const dateStr = `${currentYear}-${String(month).padStart(2, '0')}-${String(contract.payment_day || 15).padStart(2, '0')}`;
    if (linkedExpense) {
      await fin.upsertExpense.mutateAsync({ id: linkedExpense.id, status: newStatus } as any);
      await supabase.from('member_payments').update({ status: newStatus }).eq('member_id', contract.member_id).eq('month', month).eq('year', currentYear).eq('payment_type', contractType);
    } else {
      await fin.upsertExpense.mutateAsync({
        description: `${memberName} — ${MONTHS[month - 1]} ${currentYear}`,
        category: (contractType === 'contrato_trabalho' || contractType === 'outro') ? 'ordenados' : 'prestadores',
        base_value: value, vat_rate: 0, total_with_vat: value, location: 'portugal',
        expense_date: dateStr, expense_month: month, expense_quarter: Math.ceil(month / 3),
        expense_year: currentYear, status: newStatus, source_type: 'contract', source_id: contract.id,
      } as any);
      await supabase.from('member_payments').insert({
        member_id: contract.member_id, month, year: currentYear,
        gross_value: value, net_value: value, payment_type: contractType, status: newStatus,
      });
    }
    qc.invalidateQueries({ queryKey: ['my-payments'] });
    setConfirming(false);
  };

  const expenseId = linkedExpense ? (linkedExpense as any).expense_id || 'A gerar' : 'A gerar';
  const description = linkedExpense?.description || `Pagamento — ${memberName} — ${String(month).padStart(2, '0')}/${currentYear}`;
  const categoryLabel = contractType === 'contrato_prestacao' || contractType === 'prestacao_servicos' ? 'Prestadores' : 'Ordenados';
  const location = linkedExpense ? locationLabel((linkedExpense as any).location || 'portugal') : 'Portugal';
  const baseValue = linkedExpense?.base_value ?? value;
  const vatRate = (linkedExpense as any)?.vat_rate ?? 0;
  const totalWithVat = linkedExpense?.total_with_vat ?? value;
  const expenseDate = linkedExpense ? (linkedExpense as any).expense_date || '—' : `${currentYear}-${String(month).padStart(2, '0')}-${String(contract.payment_day || 15).padStart(2, '0')}`;

  return (
    <TableRow className={cn(!['pago_falta_fatura', 'tudo_ok'].includes(currentStatus) ? 'bg-muted/30' : '', 'cursor-pointer hover:bg-muted/50')} onClick={onExpenseClick}>
      <TableCell onClick={e => e.stopPropagation()}>
        <ExpenseStatusSelect expenseId={linkedExpense?.id || `contract-${contract.id}`} currentStatus={currentStatus} onUpdate={handleStatusChange} />
      </TableCell>
      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{expenseId}</TableCell>
      <TableCell className="whitespace-nowrap">{expenseDate}</TableCell>
      <TableCell>{description}</TableCell>
      <TableCell>{categoryLabel}</TableCell>
      <TableCell>{location}</TableCell>
      <TableCell className="text-right">{formatEuro(baseValue)}</TableCell>
      <TableCell className="text-right">{vatRate}%</TableCell>
      <TableCell className="text-right">{formatEuro(totalWithVat)}</TableCell>
    </TableRow>
  );
}