import { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { ENTRY_STATUSES, getEntryStatusBadge, getEffectiveEntryStatus } from './EntryDetailSheet';

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
  paymentDate?: string | null;
  hasDocuments?: boolean;
}

export function EntryStatusSelect({ saleId, currentStatus, paymentDate, hasDocuments = false }: EntryStatusSelectProps) {
  const qc = useQueryClient();
  const effectiveStatus = getEffectiveEntryStatus(currentStatus, paymentDate ?? null);
  const sb = getEntryStatusBadge(effectiveStatus);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const doUpdate = async (value: string) => {
    const { error } = await supabase.from('commercial_sales').update({ status: value }).eq('id', saleId);
    if (error) { toast.error('Erro ao atualizar status'); return; }
    qc.invalidateQueries({ queryKey: ['commercial'] });
    toast.success('Status atualizado');
  };

  const handleChange = (value: string) => {
    if (value === 'tudo_ok' && !hasDocuments) {
      setConfirmOpen(true);
    } else {
      doUpdate(value);
    }
  };

  return (
    <>
      <Select value={effectiveStatus} onValueChange={handleChange}>
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

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent onClick={e => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Nenhuma fatura anexada</AlertDialogTitle>
            <AlertDialogDescription>
              Nenhuma fatura está anexada a esta transação. De certeza que pretende finalizar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => doUpdate('tudo_ok')}>Sim, finalizar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

interface ExpenseStatusSelectProps {
  expenseId: string;
  currentStatus: string;
  onUpdate: (id: string, status: string) => Promise<void>;
  hasDocuments?: boolean;
}

export function ExpenseStatusSelect({ expenseId, currentStatus, onUpdate, hasDocuments = false }: ExpenseStatusSelectProps) {
  const sb = getExpenseStatusBadge(currentStatus);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);

  const doUpdate = async (value: string) => {
    await onUpdate(expenseId, value);
    toast.success('Status atualizado');
    if (value === 'pago' && !hasDocuments) {
      toast.warning('Fatura em falta — lembra-te de anexar a fatura a esta despesa.', { duration: 5000 });
    }
  };

  const handleChange = async (value: string) => {
    await doUpdate(value);
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
