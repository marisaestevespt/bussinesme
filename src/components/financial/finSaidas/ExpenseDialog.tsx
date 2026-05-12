import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Switch } from '@/components/ui/switch';
import { CalendarIcon, RefreshCw, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { calcMonthlyEquivalent } from '@/hooks/useFinancialData';
import { formatEuro } from '@/lib/formatting';
import { CategorySelect } from '../CategorySelect';
import { SupplierSelect } from '../SupplierSelect';
import { InvoiceUpload } from '../InvoiceUpload';
import { VatPreview } from '../VatPreview';
import { EXP_STATUS, VAT_OPTIONS, LOCATIONS, PERIODICITIES } from './constants';
import type { ExpenseFormState, SupplierSelectOption } from '../types';
import { buildExpenseFileName, useSupplierName } from '../expenseFileName';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: ExpenseFormState;
  setForm: React.Dispatch<React.SetStateAction<ExpenseFormState>>;
  ivaExempt: boolean;
  paymentMethods: { value: string; label: string }[];
  onSupplierChange: (supplierId: string | null, supplier?: SupplierSelectOption) => void;
  onSave: () => void | Promise<void>;
  onRequestDelete: () => void;
}

export function ExpenseDialog({ open, onOpenChange, form, setForm, ivaExempt, paymentMethods, onSupplierChange, onSave, onRequestDelete }: Props) {
  const { data: supplierName } = useSupplierName(form.supplier_id || null);
  const suggestedFileName = buildExpenseFileName({
    expenseDate: form.expense_date,
    supplierName,
    expenseName: form.expense_name || form.description,
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{form.id ? 'Editar Despesa' : 'Nova Despesa'}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Status</Label>
            <Select value={form.status || 'por_pagar'} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{EXP_STATUS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Data</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start", !form.expense_date && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {form.expense_date ? format(form.expense_date instanceof Date ? form.expense_date : new Date(form.expense_date), 'dd/MM/yyyy') : 'Selecionar'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={form.expense_date instanceof Date ? form.expense_date : form.expense_date ? new Date(form.expense_date) : undefined} onSelect={d => setForm(f => ({ ...f, expense_date: d }))} className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>
          <div><Label>Descrição</Label><Input value={form.description || ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
          <div><Label>Fornecedor</Label>
            <SupplierSelect value={form.supplier_id || null} onValueChange={onSupplierChange} />
          </div>
          <div><Label>Categoria</Label>
            <CategorySelect type="expense" value={form.category || 'outro'} onValueChange={v => setForm(f => ({ ...f, category: v }))} />
          </div>
          {ivaExempt ? (
            <div>
              <Label>Valor Total Pago (€)</Label>
              <Input
                type="number"
                step="0.01"
                value={form.base_value || ''}
                onChange={e => setForm(f => ({ ...f, base_value: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Estás isenta de IVA — não consegues deduzir, por isso indica o valor total pago (IVA incluído).
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 py-1">
                <Switch checked={form.includes_vat || false} onCheckedChange={v => setForm(f => ({ ...f, includes_vat: v }))} />
                <Label className="text-sm font-normal">Valor inclui IVA</Label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>{form.includes_vat ? 'Valor Total c/ IVA (€)' : 'Valor Base (€)'}</Label><Input type="number" step="0.01" value={form.base_value || ''} onChange={e => setForm(f => ({ ...f, base_value: e.target.value }))} /></div>
                <div><Label>IVA (%)</Label>
                  <Select value={String(form.vat_rate ?? 23)} onValueChange={v => setForm(f => ({ ...f, vat_rate: parseInt(v) }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{VAT_OPTIONS.map(v => <SelectItem key={v} value={String(v)}>{v}%</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <VatPreview
                value={form.base_value}
                vatRate={form.vat_rate ?? 23}
                includesVat={!!form.includes_vat}
              />
            </>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Localização</Label>
              <Select value={form.location || 'portugal'} onValueChange={v => setForm(f => ({ ...f, location: v, ...(v !== 'portugal' ? { vat_rate: 0 } : {}) }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{LOCATIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Método Pagamento</Label>
              <Select value={form.payment_method || '__none__'} onValueChange={v => setForm(f => ({ ...f, payment_method: v === '__none__' ? '' : v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">—</SelectItem>
                  {paymentMethods.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="rounded-lg border border-border p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-muted-foreground" />
                <Label className="text-sm font-normal">Despesa recorrente</Label>
              </div>
              <Switch checked={form.is_recurring || false} onCheckedChange={v => setForm(f => ({ ...f, is_recurring: v }))} />
            </div>
            {form.is_recurring && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Periodicidade</Label>
                    <Select value={form.periodicity || 'mensal'} onValueChange={v => setForm(f => ({ ...f, periodicity: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{PERIODICITIES.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Dia de pagamento</Label>
                    <Select value={String(form.recurrence_day || '')} onValueChange={v => setForm(f => ({ ...f, recurrence_day: v ? parseInt(v) : null }))}>
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                          <SelectItem key={d} value={String(d)}>Dia {d}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {form.base_value && parseFloat(String(form.base_value)) > 0 && form.periodicity !== 'mensal' && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Equivalente mensal: {formatEuro(calcMonthlyEquivalent(parseFloat(String(form.base_value)) || 0, form.periodicity || 'mensal'))}
                  </p>
                )}
              </div>
            )}
          </div>
          <InvoiceUpload
            documents={Array.isArray(form.documents) ? form.documents : []}
            onChange={docs => setForm(f => ({ ...f, documents: docs }))}
            suggestedName={suggestedFileName}
          />
          <div className="flex gap-2">
            <Button className="flex-1" onClick={onSave}>Guardar</Button>
            {form.id && <Button variant="destructive" aria-label="Eliminar" size="icon" onClick={onRequestDelete}><Trash2 className="h-4 w-4" /></Button>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
