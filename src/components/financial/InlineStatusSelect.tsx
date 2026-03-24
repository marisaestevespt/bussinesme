import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { ENTRY_STATUSES, getEntryStatusBadge } from './EntryDetailSheet';

const EXPENSE_STATUSES = [
  { value: 'pendente', label: 'Pendente', cls: 'bg-amber-100 text-amber-800' },
  { value: 'pago', label: 'Pago', cls: 'bg-green-100 text-green-800' },
] as const;

function getExpenseStatusBadge(status: string) {
  const found = EXPENSE_STATUSES.find(s => s.value === status);
  return found || { value: status, label: status, cls: 'bg-muted text-muted-foreground' };
}

interface EntryStatusSelectProps {
  saleId: string;
  currentStatus: string;
}

export function EntryStatusSelect({ saleId, currentStatus }: EntryStatusSelectProps) {
  const qc = useQueryClient();
  const sb = getEntryStatusBadge(currentStatus);

  const handleChange = async (value: string) => {
    const { error } = await supabase.from('commercial_sales').update({ status: value }).eq('id', saleId);
    if (error) { toast.error('Erro ao atualizar status'); return; }
    qc.invalidateQueries({ queryKey: ['commercial'] });
    toast.success('Status atualizado');
  };

  return (
    <Select value={currentStatus} onValueChange={handleChange}>
      <SelectTrigger className="h-7 w-auto min-w-[140px] border-0 bg-transparent p-0 shadow-none focus:ring-0 [&>svg]:ml-1 [&>svg]:h-3 [&>svg]:w-3 [&>svg]:text-muted-foreground" onClick={e => e.stopPropagation()}>
        <Badge variant="outline" className={sb.cls}>{sb.label}</Badge>
      </SelectTrigger>
      <SelectContent onClick={e => e.stopPropagation()}>
        {ENTRY_STATUSES.map(s => (
          <SelectItem key={s.value} value={s.value}>
            <Badge variant="outline" className={`${s.cls} text-xs`}>{s.label}</Badge>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

interface ExpenseStatusSelectProps {
  expenseId: string;
  currentStatus: string;
  onUpdate: (id: string, status: string) => Promise<void>;
}

export function ExpenseStatusSelect({ expenseId, currentStatus, onUpdate }: ExpenseStatusSelectProps) {
  const sb = getExpenseStatusBadge(currentStatus);

  const handleChange = async (value: string) => {
    await onUpdate(expenseId, value);
    toast.success('Status atualizado');
  };

  return (
    <Select value={currentStatus} onValueChange={handleChange}>
      <SelectTrigger className="h-7 w-auto min-w-[100px] border-0 bg-transparent p-0 shadow-none focus:ring-0 [&>svg]:ml-1 [&>svg]:h-3 [&>svg]:w-3 [&>svg]:text-muted-foreground" onClick={e => e.stopPropagation()}>
        <Badge variant="outline" className={sb.cls}>{sb.label}</Badge>
      </SelectTrigger>
      <SelectContent onClick={e => e.stopPropagation()}>
        {EXPENSE_STATUSES.map(s => (
          <SelectItem key={s.value} value={s.value}>
            <Badge variant="outline" className={`${s.cls} text-xs`}>{s.label}</Badge>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
