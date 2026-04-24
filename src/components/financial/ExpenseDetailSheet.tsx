import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { buildPaymentMethodOptions } from '@/lib/paymentMethods';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { CalendarIcon, Trash2, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { InvoiceUpload, type DocEntry } from './InvoiceUpload';
import { CategorySelect } from './CategorySelect';
import { SupplierSelect } from './SupplierSelect';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import type { Expense } from '@/hooks/useFinancialData';
import type { useFinancialData } from '@/hooks/useFinancialData';

const EXP_STATUS = [
  { value: 'por_pagar', label: 'Por Pagar', cls: 'bg-muted text-muted-foreground' },
  { value: 'pendente', label: 'Pendente', cls: 'bg-warning/10 text-warning' },
  { value: 'em_atraso', label: 'Em Atraso', cls: 'bg-destructive/10 text-destructive' },
  { value: 'pago_falta_fatura', label: 'Pago, Falta Fatura', cls: 'bg-info/10 text-info' },
  { value: 'tudo_ok', label: 'Tudo OK', cls: 'bg-success/10 text-success' },
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
  const [saving, setSaving] = useState(false);
  const { data: setupPM } = useQuery({
    queryKey: ['business-setup-payment-methods'],
    queryFn: async () => {
      const { data } = await supabase.from('business_setup').select('payment_methods').limit(1).single();
      return (data?.payment_methods as any[] || []).filter((m: any) => m.label?.trim());
    },
  });
  const paymentMethods = buildPaymentMethodOptions(setupPM);

  useEffect(() => {
    if (!expense || !open) return;

    const allDocs = Array.isArray(expense.documents) ? expense.documents : [];
    const regularDocs = (allDocs as any[]).filter((d: any) => d.type !== 'meta_ads');
    const metaDocs = (allDocs as any[]).filter((d: any) => d.type === 'meta_ads');

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
      documents: regularDocs,
      meta_ads_docs: metaDocs.map((d: any) => ({ name: d.name, url: d.url })),
      includes_vat: false,
      source_type: expense.source_type,
      source_id: expense.source_id,
      department: expense.department || '',
      supplier_id: expense.supplier_id || null,
      is_recurring: (expense as any).is_recurring || false,
      periodicity: (expense as any).periodicity || 'mensal',
      monthly_equivalent: (expense as any).monthly_equivalent || 0,
      payment_method: (expense as any).payment_method || '',
      expense_name: (expense as any).expense_name || '',
    });
  }, [expense, open]);

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

    // Merge regular docs + meta ads docs (tagged)
    const regularDocs = form.documents || [];
    const metaDocs = (form.meta_ads_docs || []).map((d: any) => ({ ...d, type: 'meta_ads' }));
    const allDocs = [...regularDocs, ...metaDocs];

    const isRecurring = form.is_recurring || false;
    const periodicity = isRecurring ? (form.periodicity || 'mensal') : null;
    const periodicityMultipliers: Record<string, number> = { mensal: 1, trimestral: 3, semestral: 6, anual: 12 };
    const monthlyEquivalent = isRecurring ? Math.round(total / (periodicityMultipliers[periodicity || 'mensal'] || 1) * 100) / 100 : 0;

    // Auto-upgrade status: if has documents and status is "pago_falta_fatura", set to "tudo_ok"
    const autoStatus = (form.status === 'pago_falta_fatura' && regularDocs.length > 0) ? 'tudo_ok' : form.status;

    await fin.upsertExpense.mutateAsync({
      id: form.id,
      status: autoStatus,
      expense_date: date,
      description: form.description || null,
      category: form.category,
      base_value: base,
      vat_rate: vat,
      total_with_vat: total,
      location: form.location,
      documents: allDocs,
      expense_month: month,
      expense_quarter: quarter,
      expense_year: year,
      department: form.department || null,
      supplier_id: form.supplier_id || null,
      is_recurring: isRecurring,
      periodicity,
      monthly_equivalent: monthlyEquivalent,
      payment_method: form.payment_method || null,
      expense_name: form.expense_name || null,
      source_type: isRecurring ? 'rule' : (form.source_type || 'manual'),
    } as any);

    // Sync document to member_payments when expense is linked to a contract
    if (form.source_type === 'contract' && form.source_id) {
      try {
        const docUrl = regularDocs.length > 0 ? regularDocs[0].url : null;
        const { data: contract } = await supabase
          .from('member_contracts')
          .select('member_id')
          .eq('id', form.source_id)
          .maybeSingle();
        if (contract?.member_id && month && year) {
          await supabase
            .from('member_payments')
            .update({ document_url: docUrl })
            .eq('member_id', contract.member_id)
            .eq('month', month)
            .eq('year', year);
        }
      } catch {
        // Non-critical — don't block save
      }
    }

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

          {/* Department (optional) */}
          <div>
            <Label>Departamento <span className="text-muted-foreground font-normal">(opcional)</span></Label>
            <Select value={form.department || ''} onValueChange={v => setForm((f: any) => ({ ...f, department: v === '__none__' ? '' : v }))}>
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

          {/* Supplier */}
          <div>
            <Label>Fornecedor <span className="text-muted-foreground font-normal">(opcional)</span></Label>
            <SupplierSelect
              value={form.supplier_id || null}
              onValueChange={(v, supplier) => {
                const updates: any = { supplier_id: v };
                if (supplier) {
                  if (supplier.default_vat_rate != null) updates.vat_rate = supplier.default_vat_rate;
                  if (supplier.payment_method) updates.payment_method = supplier.payment_method;
                  if (supplier.category) updates.category = supplier.category;
                }
                setForm((f: any) => ({ ...f, ...updates }));
              }}
            />
          </div>

          {/* Payment Method */}
          <div>
            <Label>Método de Pagamento <span className="text-muted-foreground font-normal">(opcional)</span></Label>
            <Select value={form.payment_method || '__none__'} onValueChange={v => setForm((f: any) => ({ ...f, payment_method: v === '__none__' ? '' : v }))}>
              <SelectTrigger><SelectValue placeholder="Sem método" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Sem método</SelectItem>
                {paymentMethods.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {/* Recurring */}
          <div className="flex items-center gap-2 py-1">
            <Switch checked={form.is_recurring || false} onCheckedChange={v => setForm((f: any) => ({ ...f, is_recurring: v }))} />
            <Label className="text-sm font-normal">Despesa recorrente</Label>
          </div>
          {form.is_recurring && (
            <div>
              <Label>Periodicidade</Label>
              <Select value={form.periodicity || 'mensal'} onValueChange={v => setForm((f: any) => ({ ...f, periodicity: v }))}>
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

          {/* Location */}
          <div>
            <Label>Localização</Label>
            <Select value={form.location || 'portugal'} onValueChange={v => setForm((f: any) => ({ ...f, location: v, ...(v !== 'portugal' ? { vat_rate: 0 } : {}) }))}>
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

          {/* Meta Ads Report — shown for marketing expenses */}
          {(form.category === 'marketing' || form.department === 'marketing' || (form.description || '').toLowerCase().includes('meta') || (form.description || '').toLowerCase().includes('ads')) && (
            <InvoiceUpload
              documents={Array.isArray(form.meta_ads_docs) ? form.meta_ads_docs : []}
              onChange={docs => setForm((f: any) => ({ ...f, meta_ads_docs: docs }))}
              label="Relatório Meta Ads (opcional)"
            />
          )}

          {/* Actions */}
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
