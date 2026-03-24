import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { CalendarIcon, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { InvoiceUpload, type DocEntry } from './InvoiceUpload';
import { CategorySelect } from './CategorySelect';
import type { Expense } from '@/hooks/useFinancialData';
import type { useFinancialData } from '@/hooks/useFinancialData';

const EXP_STATUS = [
  { value: 'por_pagar', label: 'Por Pagar', cls: 'bg-amber-100 text-amber-800' },
  { value: 'pago', label: 'Pago', cls: 'bg-green-100 text-green-800' },
  { value: 'cancelado', label: 'Cancelado', cls: 'bg-muted text-muted-foreground' },
];

const VAT_OPTIONS = [0, 6, 13, 23];
const LOCATIONS = [
  { value: 'portugal', label: 'Portugal' },
  { value: 'ue', label: 'União Europeia' },
  { value: 'fora_ue', label: 'Fora da UE' },
];

interface Props {
  expense: Expense | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fin: ReturnType<typeof useFinancialData>;
}

export function ExpenseDetailSheet({ expense, open, onOpenChange, fin }: Props) {
  const [form, setForm] = useState<any>({});
  const [lastId, setLastId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Sync form when expense changes
  if (expense && expense.id !== lastId) {
    setLastId(expense.id);
    setForm({
      id: expense.id,
      status: expense.status || 'por_pagar',
      expense_date: expense.expense_date ? new Date(expense.expense_date + 'T00:00:00') : undefined,
      description: expense.description || '',
      category: expense.category || 'outro',
      base_value: String(expense.base_value),
      vat_rate: expense.vat_rate ?? 23,
      total_with_vat: expense.total_with_vat,
      location: expense.location || 'portugal',
      documents: Array.isArray(expense.documents) ? expense.documents : [],
      includes_vat: false,
      source_type: expense.source_type,
      source_id: expense.source_id,
    });
  }

  if (!expense) return null;

  const statusInfo = EXP_STATUS.find(s => s.value === form.status) || EXP_STATUS[0];

  const handleSave = async () => {
    setSaving(true);
    const inputValue = parseFloat(form.base_value) || 0;
    const vat = form.vat_rate ?? 23;
    let base: number, total: number;
    if (form.includes_vat) {
      total = inputValue;
      base = Math.round(inputValue / (1 + vat / 100) * 100) / 100;
    } else {
      base = inputValue;
      total = Math.round(base * (1 + vat / 100) * 100) / 100;
    }
    const d = form.expense_date;
    const date = d ? (d instanceof Date ? format(d, 'yyyy-MM-dd') : d) : null;
    const month = date ? parseInt(date.slice(5, 7)) : null;
    const quarter = month ? Math.ceil(month / 3) : null;
    const year = date ? parseInt(date.slice(0, 4)) : null;

    await fin.upsertExpense.mutateAsync({
      id: form.id,
      status: form.status,
      expense_date: date,
      description: form.description || null,
      category: form.category,
      base_value: base,
      vat_rate: vat,
      total_with_vat: total,
      location: form.location,
      documents: form.documents || [],
      expense_month: month,
      expense_quarter: quarter,
      expense_year: year,
    } as any);
    toast.success('Despesa atualizada');
    setSaving(false);
    onOpenChange(false);
  };

  const handleDelete = async () => {
    await fin.deleteExpense.mutateAsync(form.id);
    toast.success('Despesa eliminada');
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <span className="font-mono text-sm text-muted-foreground">{(expense as any).expense_id}</span>
            {form.source_type && (
              <Badge variant="secondary" className="text-[10px]">
                {form.source_type === 'subscription' ? 'Subscrição' : form.source_type === 'contract' ? 'Contrato' : form.source_type}
              </Badge>
            )}
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-5 mt-6">
          {/* Status */}
          <div className={`rounded-lg px-4 py-3 ${statusInfo.cls}`}>
            <p className="text-xs opacity-70 mb-1">Status</p>
            <Select value={form.status || 'por_pagar'} onValueChange={v => setForm((f: any) => ({ ...f, status: v }))}>
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

          {/* Date */}
          <div>
            <Label>Data</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start", !form.expense_date && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {form.expense_date ? format(form.expense_date instanceof Date ? form.expense_date : new Date(form.expense_date), 'dd/MM/yyyy') : 'Selecionar'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={form.expense_date instanceof Date ? form.expense_date : undefined} onSelect={d => setForm((f: any) => ({ ...f, expense_date: d }))} className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>

          {/* Description */}
          <div>
            <Label>Descrição</Label>
            <Input value={form.description || ''} onChange={e => setForm((f: any) => ({ ...f, description: e.target.value }))} />
          </div>

          {/* Category */}
          <div>
            <Label>Categoria</Label>
            <CategorySelect type="expense" value={form.category || 'outro'} onValueChange={v => setForm((f: any) => ({ ...f, category: v }))} />
          </div>

          {/* VAT toggle + values */}
          <div className="flex items-center gap-2 py-1">
            <Switch checked={form.includes_vat || false} onCheckedChange={v => setForm((f: any) => ({ ...f, includes_vat: v }))} />
            <Label className="text-sm font-normal">Valor inclui IVA</Label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{form.includes_vat ? 'Valor Total c/ IVA (€)' : 'Valor Base (€)'}</Label>
              <Input type="number" step="0.01" value={form.base_value || ''} onChange={e => setForm((f: any) => ({ ...f, base_value: e.target.value }))} />
            </div>
            <div>
              <Label>IVA (%)</Label>
              <Select value={String(form.vat_rate ?? 23)} onValueChange={v => setForm((f: any) => ({ ...f, vat_rate: parseInt(v) }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{VAT_OPTIONS.map(v => <SelectItem key={v} value={String(v)}>{v}%</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          {form.base_value && parseFloat(form.base_value) > 0 && (form.vat_rate ?? 23) > 0 && (
            <p className="text-xs text-muted-foreground">
              {form.includes_vat
                ? `Base: ${(parseFloat(form.base_value) / (1 + (form.vat_rate ?? 23) / 100)).toFixed(2)} € · IVA: ${(parseFloat(form.base_value) - parseFloat(form.base_value) / (1 + (form.vat_rate ?? 23) / 100)).toFixed(2)} €`
                : `Total c/ IVA: ${(parseFloat(form.base_value) * (1 + (form.vat_rate ?? 23) / 100)).toFixed(2)} € · IVA: ${(parseFloat(form.base_value) * (form.vat_rate ?? 23) / 100).toFixed(2)} €`
              }
            </p>
          )}

          {/* Location */}
          <div>
            <Label>Localização</Label>
            <Select value={form.location || 'portugal'} onValueChange={v => setForm((f: any) => ({ ...f, location: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{LOCATIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          {/* Documents */}
          <InvoiceUpload
            documents={Array.isArray(form.documents) ? form.documents : []}
            onChange={docs => setForm((f: any) => ({ ...f, documents: docs }))}
            label="Ficheiros (faturas, comprovativos, recibos)"
          />

          {/* Actions */}
          <div className="flex gap-2">
            <Button className="flex-1" onClick={handleSave} disabled={saving}>
              {saving ? 'A guardar...' : 'Guardar alterações'}
            </Button>
            <Button variant="destructive" size="icon" onClick={handleDelete}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
