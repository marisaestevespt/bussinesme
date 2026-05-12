import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { CategorySelect } from '../CategorySelect';
import { SupplierSelect } from '../SupplierSelect';
import { VatPreview } from '../VatPreview';
import { InvoiceUpload } from '../InvoiceUpload';
import type { ExpenseFormState } from '../types';
import { VAT_OPTIONS, LOCATIONS } from './constants';
import { buildExpenseFileName, useSupplierName } from '../expenseFileName';

interface PMOption { value: string; label: string; }

interface Props {
  form: ExpenseFormState;
  setForm: React.Dispatch<React.SetStateAction<ExpenseFormState>>;
  paymentMethods: PMOption[];
}

export function ExpenseFormFields({ form, setForm, paymentMethods }: Props) {
  const update = (patch: Partial<ExpenseFormState>) => setForm(f => ({ ...f, ...patch }));
  const { data: supplierName } = useSupplierName(form.supplier_id || null);
  const suggestedFileName = buildExpenseFileName({
    expenseDate: form.expense_date,
    supplierName,
    expenseName: form.expense_name || form.description,
  });

  return (
    <>
      <div>
        <Label>Data</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn('w-full justify-start', !form.expense_date && 'text-muted-foreground')}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              {form.expense_date ? format(form.expense_date instanceof Date ? form.expense_date : new Date(form.expense_date), 'dd/MM/yyyy') : 'Selecionar'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={form.expense_date instanceof Date ? form.expense_date : undefined} onSelect={d => update({ expense_date: d })} className="p-3 pointer-events-auto" />
          </PopoverContent>
        </Popover>
      </div>

      <div>
        <Label>Descrição</Label>
        <Input value={form.description || ''} onChange={e => update({ description: e.target.value })} />
      </div>

      <div>
        <Label>Categoria</Label>
        <CategorySelect type="expense" value={form.category || 'outro'} onValueChange={v => update({ category: v })} />
      </div>

      <div>
        <Label>Departamento <span className="text-muted-foreground font-normal">(opcional)</span></Label>
        <Select value={form.department || ''} onValueChange={v => update({ department: v === '__none__' ? '' : v })}>
          <SelectTrigger><SelectValue placeholder="Sem departamento" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Sem departamento</SelectItem>
            <SelectItem value="marketing">Marketing</SelectItem>
            <SelectItem value="comercial">Comercial</SelectItem>
            <SelectItem value="clientes">Clientes</SelectItem>
            <SelectItem value="financeiro">Contabilidade</SelectItem>
            <SelectItem value="operacao">Operação</SelectItem>
            <SelectItem value="produtos">Produtos</SelectItem>
            <SelectItem value="recursos-humanos">Recursos Humanos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2 py-1">
        <Switch checked={form.includes_vat || false} onCheckedChange={v => update({ includes_vat: v })} />
        <Label className="text-sm font-normal">Valor inclui IVA</Label>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>{form.includes_vat ? 'Valor Total c/ IVA (€)' : 'Valor Base (€)'}</Label>
          <Input type="number" step="0.01" value={form.base_value || ''} onChange={e => update({ base_value: e.target.value })} />
        </div>
        <div>
          <Label>IVA (%)</Label>
          <Select value={String(form.vat_rate ?? 23)} onValueChange={v => update({ vat_rate: parseInt(v) })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{VAT_OPTIONS.map(v => <SelectItem key={v} value={String(v)}>{v}%</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      <VatPreview value={form.base_value} vatRate={form.vat_rate ?? 23} includesVat={!!form.includes_vat} />

      <div>
        <Label>Fornecedor <span className="text-muted-foreground font-normal">(opcional)</span></Label>
        <SupplierSelect
          value={form.supplier_id || null}
          onValueChange={(v, supplier) => {
            const updates: Partial<ExpenseFormState> = { supplier_id: v };
            if (supplier) {
              if (supplier.default_vat_rate != null) updates.vat_rate = supplier.default_vat_rate;
              if (supplier.payment_method) updates.payment_method = supplier.payment_method;
              if (supplier.category) updates.category = supplier.category;
            }
            update(updates);
          }}
        />
      </div>

      <div>
        <Label>Método de Pagamento <span className="text-muted-foreground font-normal">(opcional)</span></Label>
        <Select value={form.payment_method || '__none__'} onValueChange={v => update({ payment_method: v === '__none__' ? '' : v })}>
          <SelectTrigger><SelectValue placeholder="Sem método" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Sem método</SelectItem>
            {paymentMethods.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2 py-1">
        <Switch checked={form.is_recurring || false} onCheckedChange={v => update({ is_recurring: v })} />
        <Label className="text-sm font-normal">Despesa recorrente</Label>
      </div>
      {form.is_recurring && (
        <div>
          <Label>Periodicidade</Label>
          <Select value={form.periodicity || 'mensal'} onValueChange={v => update({ periodicity: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="mensal">Mensal</SelectItem>
              <SelectItem value="trimestral">Trimestral</SelectItem>
              <SelectItem value="semestral">Semestral</SelectItem>
              <SelectItem value="anual">Anual</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      <div>
        <Label>Localização</Label>
        <Select value={form.location || 'portugal'} onValueChange={v => update({ location: v, ...(v !== 'portugal' ? { vat_rate: 0 } : {}) })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{LOCATIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <InvoiceUpload
        documents={Array.isArray(form.documents) ? form.documents : []}
        onChange={docs => update({ documents: docs })}
        label="Ficheiros (faturas, comprovativos, recibos)"
        suggestedName={suggestedFileName}
      />

      {(form.category === 'marketing' || form.department === 'marketing' || (form.description || '').toLowerCase().includes('meta') || (form.description || '').toLowerCase().includes('ads')) && (
        <InvoiceUpload
          documents={Array.isArray(form.meta_ads_docs) ? form.meta_ads_docs : []}
          onChange={docs => update({ meta_ads_docs: docs })}
          label="Relatório Meta Ads (opcional)"
          suggestedName={suggestedFileName ? `${suggestedFileName}_MetaAds` : undefined}
        />
      )}
    </>
  );
}