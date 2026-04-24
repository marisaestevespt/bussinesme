import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import type { Expense } from '@/hooks/useFinancialData';
import { ivaDeduzirOf, ivaPagoOf } from '@/lib/vatCalculations';
import { formatEuro } from '@/lib/formatting';

interface Props {
  expense: Pick<Expense, 'id' | 'total_with_vat' | 'base_value'> & {
    vat_deductible_amount?: number | null;
  };
  /** Optional: invalidate additional query keys after save. */
  invalidateKeys?: readonly (readonly unknown[])[];
  align?: 'left' | 'right';
}

/**
 * Editable inline cell for vat_deductible_amount.
 * Shows current deductible (or full IVA paid if not set) and lets the user override.
 */
export function VatDeductibleCell({ expense, invalidateKeys, align = 'right' }: Props) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');

  const ivaPago = ivaPagoOf(expense);
  const ded = expense.vat_deductible_amount;
  const display = ivaDeduzirOf(expense);
  const isCustom = ded != null;

  const startEditing = () => {
    setValue(isCustom ? String(ded) : ivaPago.toFixed(2));
    setEditing(true);
  };

  const save = async () => {
    const parsed = value === '' ? null : parseFloat(value);
    const finalValue =
      parsed === null || isNaN(parsed) ? null : Math.max(0, Math.min(parsed, ivaPago));
    const { error } = await supabase
      .from('financial_expenses')
      .update({ vat_deductible_amount: finalValue } as any)
      .eq('id', expense.id);
    if (error) toast.error('Erro ao guardar');
    else {
      toast.success('IVA dedutível atualizado');
      qc.invalidateQueries({ queryKey: ['financial-expenses'] });
      invalidateKeys?.forEach(k => qc.invalidateQueries({ queryKey: k as any }));
    }
    setEditing(false);
  };

  if (editing) {
    return (
      <Input
        type="number"
        step="0.01"
        autoFocus
        value={value}
        onChange={ev => setValue(ev.target.value)}
        onBlur={save}
        onKeyDown={ev => {
          if (ev.key === 'Enter') (ev.target as HTMLInputElement).blur();
          if (ev.key === 'Escape') setEditing(false);
        }}
        className={`h-7 w-24 text-xs ${align === 'right' ? 'text-right ml-auto' : ''}`}
      />
    );
  }

  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 hover:text-primary group"
      onClick={startEditing}
    >
      <span className={isCustom ? 'font-medium text-primary' : 'text-muted-foreground'}>
        {formatEuro(display)}
      </span>
      <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-60" />
    </button>
  );
}
