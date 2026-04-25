import { useState } from 'react';
import { buildPaymentMethodOptions } from '@/lib/paymentMethods';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Trash2, RefreshCw } from 'lucide-react';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import type { Expense, useFinancialData } from '@/hooks/useFinancialData';
import { useBusinessSetupPaymentMethods } from '@/hooks/useBusinessSetup';
import { EXP_STATUS } from './expenseDetail/constants';
import { useExpenseForm } from './expenseDetail/useExpenseForm';
import { ExpenseFormFields } from './expenseDetail/ExpenseFormFields';
import { EntityIconPicker } from '@/components/entity-icon';

interface Props {
  expense: Expense | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fin: ReturnType<typeof useFinancialData>;
}

export function ExpenseDetailSheet({ expense, open, onOpenChange, fin }: Props) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data: setupPM } = useBusinessSetupPaymentMethods();
  const paymentMethods = buildPaymentMethodOptions(setupPM);

  const { form, setForm, saving, handleSave, handleDelete } = useExpenseForm({
    expense, open, fin, onClose: () => onOpenChange(false),
  });

  if (!expense) return null;

  const statusInfo = EXP_STATUS.find(s => s.value === form.status) || EXP_STATUS[0];
  const expenseId = (expense as Expense & { expense_id?: string }).expense_id;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-3">
            <EntityIconPicker
              icon={form.icon}
              onChange={(next) => setForm(f => ({ ...f, icon: next }))}
              bucket="entity-icons"
              pathPrefix={`expenses/${expense.id}`}
              className="h-10 w-10"
              emojiClassName="text-2xl"
              variant="rounded"
            />
            <span className="font-mono text-sm text-muted-foreground">{expenseId}</span>
            {form.source_type && (
              <Badge variant="secondary" className="text-[10px]">
                {form.source_type === 'subscription' ? 'Subscrição' : form.source_type === 'contract' ? 'Contrato' : form.source_type === 'rule' ? 'Recorrente' : form.source_type}
              </Badge>
            )}
            {form.is_recurring && (
              <Badge variant="outline" className="text-[10px] gap-1">
                <RefreshCw className="h-2.5 w-2.5" /> Recorrente
              </Badge>
            )}
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-5 mt-6">
          <div className={`rounded-lg px-4 py-3 ${statusInfo.cls}`}>
            <p className="text-xs opacity-70 mb-1">Status</p>
            <Select value={form.status || 'por_pagar'} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
              <SelectTrigger className="h-auto border-0 bg-transparent p-0 shadow-none focus:ring-0 font-semibold text-base [&>svg]:ml-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXP_STATUS.map(s => (
                  <SelectItem key={s.value} value={s.value}>
                    <Badge variant="outline" className={`${s.cls} text-xs`}>{s.label}</Badge>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <ExpenseFormFields form={form} setForm={setForm} paymentMethods={paymentMethods} />

          <div className="flex gap-2">
            <Button className="flex-1" onClick={handleSave} disabled={saving}>
              {saving ? 'A guardar...' : 'Guardar alterações'}
            </Button>
            <Button variant="destructive" aria-label="Eliminar" size="icon" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </SheetContent>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Eliminar despesa?"
        description={form.is_recurring ? 'Esta despesa é recorrente — eliminar também remove todas as ocorrências geradas. Esta ação não pode ser desfeita.' : 'Esta ação não pode ser desfeita.'}
        confirmLabel="Eliminar"
        onConfirm={handleDelete}
      />
    </Sheet>
  );
}