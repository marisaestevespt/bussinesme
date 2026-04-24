import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Plus, CalendarIcon, Trash2, RefreshCw, Download, Copy } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Switch } from '@/components/ui/switch';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { useFinancialData } from '@/hooks/useFinancialData';
import { type Expense, calcMonthlyEquivalent } from '@/hooks/useFinancialData';
import { InvoiceUpload, type DocEntry } from './InvoiceUpload';
import { CategorySelect } from './CategorySelect';
import { useFinancialCategories } from '@/hooks/useFinancialCategories';
import { SupplierSelect } from './SupplierSelect';
import { useQuery } from '@tanstack/react-query';
import { buildPaymentMethodOptions } from '@/lib/paymentMethods';
import { supabase } from '@/integrations/supabase/client';
import { exportCsv } from '@/lib/exportCsv';
import { exportPdf } from '@/lib/exportPdf';
import { TableSkeleton, EmptyState } from '@/components/ui/loading-skeletons';
import { Receipt } from 'lucide-react';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { VatDeductibleCell } from './VatDeductibleCell';
import { formatEuro } from '@/lib/formatting';

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
const PERIODICITIES = [
  { value: 'semanal', label: 'Semanal' },
  { value: 'mensal', label: 'Mensal' },
  { value: 'bimestral', label: 'Bimestral' },
  { value: 'trimestral', label: 'Trimestral' },
  { value: 'semestral', label: 'Semestral' },
  { value: 'anual', label: 'Anual' },
];

interface Props { fin: ReturnType<typeof useFinancialData>; currentYear: number; }
type Filter = 'all' | 'month' | 'quarter' | 'year' | 'recurring';

export function FinSaidas({ fin, currentYear }: Props) {
  const { settings } = useBusinessSettings();
  const ivaExempt = (settings as any)?.iva_exempt === true;
  const { getCategoryLabel } = useFinancialCategories();
  const allExpenses = fin.expenses.data || [];
  const [filter, setFilter] = useState<Filter>('year');
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentQuarter = Math.ceil(currentMonth / 3);

  // Suppliers for auto-VAT
  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers-list-vat'],
    queryFn: async () => {
      const { data } = await supabase.from('suppliers').select('id, name, default_vat_rate').eq('is_active', true);
      return data || [];
    },
  });
  const { data: setupPM } = useQuery({
    queryKey: ['business-setup-payment-methods'],
    queryFn: async () => {
      const { data } = await supabase.from('business_setup').select('payment_methods').limit(1).single();
      return (data?.payment_methods as any[] || []).filter((m: any) => m.label?.trim());
    },
  });
  const paymentMethods = buildPaymentMethodOptions(setupPM);

  const expenses = allExpenses.filter(e => {
    if (filter === 'all') return true;
    if (filter === 'recurring') return (e as any).is_recurring === true;
    if (filter === 'year') return e.expense_year === currentYear;
    if (filter === 'quarter') return e.expense_year === currentYear && e.expense_quarter === currentQuarter;
    if (filter === 'month') return e.expense_year === currentYear && e.expense_month === currentMonth;
    return true;
  }).sort((a, b) => {
    const da = a.expense_date || '';
    const db = b.expense_date || '';
    return da.localeCompare(db);
  });

  // Summary for recurring
  const recurringExpenses = allExpenses.filter(e => (e as any).is_recurring === true && e.status !== 'cancelado');
  const totalMonthlyRecurring = recurringExpenses.reduce((s, e) => s + ((e as any).monthly_equivalent || 0), 0);

  // --- Expense Dialog ---
  const [expOpen, setExpOpen] = useState(false);
  const [expForm, setExpForm] = useState<any>({});

  const openNewExpense = () => {
    setExpForm({ status: 'pendente', category: 'outro', vat_rate: ivaExempt ? 0 : 23, location: 'portugal', base_value: '', description: '', includes_vat: false, supplier_id: null, is_recurring: false, periodicity: 'mensal', payment_method: '' });
    setExpOpen(true);
  };

  // Auto-fill VAT + payment method from supplier
  const handleSupplierChange = (supplierId: string | null, supplier?: any) => {
    setExpForm((f: any) => {
      const updates: any = { ...f, supplier_id: supplierId };
      const s = supplier || (supplierId ? suppliers.find((s: any) => s.id === supplierId) : null);
      if (s) {
        if (s.default_vat_rate != null) updates.vat_rate = s.default_vat_rate;
        if (s.payment_method) updates.payment_method = s.payment_method;
        if (s.category) updates.category = s.category;
      }
      return updates;
    });
  };

  const saveExpense = async () => {
    const inputValue = parseFloat(expForm.base_value) || 0;
    // When IVA-exempt, the user pays the gross amount and cannot deduct IVA → store base = total
    const vat = ivaExempt ? 0 : (parseFloat(expForm.vat_rate) || 0);
    let base: number, total: number;
    if (ivaExempt) {
      // Treat the entered value as the real cost (with IVA included as cost)
      base = inputValue;
      total = inputValue;
    } else if (expForm.includes_vat) {
      total = inputValue;
      base = Math.round(inputValue / (1 + vat / 100) * 100) / 100;
    } else {
      base = inputValue;
      total = Math.round(base * (1 + vat / 100) * 100) / 100;
    }
    const d = expForm.expense_date;
    const date = d ? (typeof d === 'string' ? d : format(d, 'yyyy-MM-dd')) : null;
    const month = date ? parseInt(date.slice(5, 7)) : null;
    const quarter = month ? Math.ceil(month / 3) : null;
    const year = date ? parseInt(date.slice(0, 4)) : null;

    // Auto-set status based on date: current month → pendente, future → por_pagar
    // Only for new expenses (no id) or if user hasn't manually changed from defaults
    let effectiveStatus = expForm.status;
    if (!expForm.id && month && year) {
      const isCurrentOrPast = year < now.getFullYear() || (year === now.getFullYear() && month <= currentMonth);
      const isFuture = year > now.getFullYear() || (year === now.getFullYear() && month > currentMonth);
      if (effectiveStatus === 'pendente' && isFuture) effectiveStatus = 'por_pagar';
      if (effectiveStatus === 'por_pagar' && isCurrentOrPast) effectiveStatus = 'pendente';
    }

    const isRecurring = expForm.is_recurring || false;
    const periodicity = isRecurring ? (expForm.periodicity || 'mensal') : null;
    const monthlyEquivalent = isRecurring ? calcMonthlyEquivalent(base, periodicity || 'mensal') : 0;

    await fin.upsertExpense.mutateAsync({
      ...(expForm.id ? { id: expForm.id } : {}),
      status: effectiveStatus,
      expense_date: date,
      description: expForm.description || null,
      expense_name: isRecurring ? (expForm.description || null) : null,
      category: expForm.category,
      base_value: base,
      vat_rate: vat,
      total_with_vat: total,
      location: expForm.location,
      documents: expForm.documents || [],
      expense_month: month,
      expense_quarter: quarter,
      expense_year: year,
      supplier_id: expForm.supplier_id || null,
      payment_method: expForm.payment_method || null,
      is_recurring: isRecurring,
      periodicity,
      monthly_equivalent: monthlyEquivalent,
      recurrence_day: isRecurring ? (expForm.recurrence_day || null) : null,
      source_type: isRecurring ? 'rule' : 'manual',
      source_id: isRecurring ? (expForm.id || null) : null,
    } as any);
    if (isRecurring) {
      fin.recurringExpenses.refetch();
    }
    setExpOpen(false);
    toast.success('Despesa guardada');
  };


  return (
    <div className="space-y-8 mt-4">
      {/* DESPESAS */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            {([['all', 'Todos'], ['month', 'Este mês'], ['quarter', 'Este trimestre'], ['year', 'Este ano'], ['recurring', 'Recorrentes']] as const).map(([k, l]) => (
              <Button key={k} variant={filter === k ? 'default' : 'outline'} size="sm" onClick={() => setFilter(k as Filter)}>{l}</Button>
            ))}
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => {
              const headers = ['ID', 'Data', 'Descrição', 'Categoria', 'Valor Base', 'IVA %', 'Total c/ IVA', 'Localização', 'Recorrente', 'Periodicidade'];
              const rows = expenses.map(e => [e.expense_id, e.expense_date || '', e.description || '', e.category, e.base_value, e.vat_rate, e.total_with_vat, e.location, (e as any).is_recurring ? 'Sim' : 'Não', (e as any).periodicity || '']);
              exportCsv(`saidas_${currentYear}.csv`, headers, rows);
              toast.success('CSV exportado');
            }}><Download className="h-3.5 w-3.5 mr-1" /> CSV</Button>
            <Button size="sm" variant="outline" onClick={() => { exportPdf(`Saídas — ${currentYear}`, 'fin-saidas-export'); toast.success('PDF a gerar...'); }}><Download className="h-3.5 w-3.5 mr-1" /> PDF</Button>
            <Button size="sm" onClick={openNewExpense}><Plus className="h-4 w-4 mr-1" /> Nova Despesa</Button>
          </div>
        </div>

        {filter === 'recurring' && totalMonthlyRecurring > 0 && (
          <Card className="mb-4">
            <CardContent className="py-3 px-4 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Custo mensal estimado (recorrentes ativas)</span>
              <span className="font-semibold">{formatEuro(totalMonthlyRecurring)}</span>
            </CardContent>
          </Card>
        )}

        {fin.expenses.isLoading ? (
          <TableSkeleton columns={10} rows={6} />
        ) : (
        <Card id="fin-saidas-export">
          <CardContent className="p-0">
            {expenses.length === 0 ? (
              <EmptyState
                icon={Receipt}
                title="Sem despesas"
                description={filter === 'recurring' ? 'Não existem despesas recorrentes registadas.' : 'Ainda não foram registadas despesas para este período.'}
                action={<Button size="sm" onClick={openNewExpense}><Plus className="h-4 w-4 mr-1" /> Nova Despesa</Button>}
              />
            ) : (
            <Table>
              <TableHeader>
                <TableRow>
                   <TableHead>Status</TableHead>
                  <TableHead>ID</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-right">Valor Base</TableHead>
                  <TableHead>IVA</TableHead>
                  <TableHead className="text-right">Total c/ IVA</TableHead>
                  {!ivaExempt && <TableHead className="text-right">IVA a Deduzir</TableHead>}
                  <TableHead>Localização</TableHead>
                  {filter === 'recurring' ? <TableHead>Periodicidade</TableHead> : <TableHead>Mês</TableHead>}
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.map(e => (
                  <TableRow key={e.id} className="cursor-pointer hover:bg-muted/50" onClick={() => {
                    setExpForm({ ...e, expense_date: e.expense_date ? new Date(e.expense_date + 'T00:00:00') : undefined, base_value: e.total_with_vat.toString(), includes_vat: true, periodicity: (e as any).periodicity || 'mensal' });
                    setExpOpen(true);
                  }}>
                    <TableCell><Badge variant="outline" className={EXP_STATUS.find(s => s.value === e.status)?.cls || 'bg-muted text-muted-foreground'}>{EXP_STATUS.find(s => s.value === e.status)?.label || e.status}</Badge></TableCell>
                    <TableCell className="font-mono text-xs">{e.expense_id}</TableCell>
                    <TableCell>{e.expense_date || '—'}</TableCell>
                    <TableCell className="truncate max-w-[200px]">
                      {e.description || '—'}
                      {(e as any).is_recurring && <RefreshCw className="inline h-3 w-3 ml-1 text-muted-foreground" />}
                    </TableCell>
                    <TableCell>{getCategoryLabel('expense', e.category)}</TableCell>
                    <TableCell className="text-right">{formatEuro(e.base_value)}</TableCell>
                    <TableCell>{e.vat_rate}%</TableCell>
                    <TableCell className="text-right font-medium">{formatEuro(e.total_with_vat)}</TableCell>
                    {!ivaExempt && (
                      <TableCell className="text-right" onClick={ev => ev.stopPropagation()}>
                        <VatDeductibleCell expense={e as any} />
                      </TableCell>
                    )}
                    <TableCell>{LOCATIONS.find(l => l.value === e.location)?.label || e.location}</TableCell>
                    {filter === 'recurring'
                      ? <TableCell>{PERIODICITIES.find(p => p.value === (e as any).periodicity)?.label || '—'}</TableCell>
                      : <TableCell>{e.expense_month || '—'}</TableCell>
                    }
                    <TableCell onClick={ev => ev.stopPropagation()}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" aria-label="Copiar" size="icon" className="h-7 w-7" onClick={() => {
                            const { id, expense_id, created_at, updated_at, ...rest } = e as any;
                            setExpForm({ ...rest, expense_date: e.expense_date ? new Date(e.expense_date + 'T00:00:00') : undefined, base_value: e.total_with_vat.toString(), includes_vat: true, status: 'pendente', periodicity: (e as any).periodicity || 'mensal' });
                            setExpOpen(true);
                          }}>
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Duplicar</TooltipContent>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            )}
          </CardContent>
        </Card>
        )}
      </div>


      {/* EXPENSE DIALOG */}
      <Dialog open={expOpen} onOpenChange={setExpOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{expForm.id ? 'Editar Despesa' : 'Nova Despesa'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Status</Label>
              <Select value={expForm.status || 'por_pagar'} onValueChange={v => setExpForm((f: any) => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{EXP_STATUS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Data</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start", !expForm.expense_date && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {expForm.expense_date ? format(expForm.expense_date instanceof Date ? expForm.expense_date : new Date(expForm.expense_date), 'dd/MM/yyyy') : 'Selecionar'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={expForm.expense_date instanceof Date ? expForm.expense_date : expForm.expense_date ? new Date(expForm.expense_date) : undefined} onSelect={d => setExpForm((f: any) => ({ ...f, expense_date: d }))} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            <div><Label>Descrição</Label><Input value={expForm.description || ''} onChange={e => setExpForm((f: any) => ({ ...f, description: e.target.value }))} /></div>
            <div><Label>Fornecedor</Label>
              <SupplierSelect value={expForm.supplier_id || null} onValueChange={handleSupplierChange} />
            </div>
            <div><Label>Categoria</Label>
              <CategorySelect type="expense" value={expForm.category || 'outro'} onValueChange={v => setExpForm((f: any) => ({ ...f, category: v }))} />
            </div>
            {ivaExempt ? (
              <div>
                <Label>Valor Total Pago (€)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={expForm.base_value || ''}
                  onChange={e => setExpForm((f: any) => ({ ...f, base_value: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Estás isenta de IVA — não consegues deduzir, por isso indica o valor total pago (IVA incluído).
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 py-1">
                  <Switch checked={expForm.includes_vat || false} onCheckedChange={v => setExpForm((f: any) => ({ ...f, includes_vat: v }))} />
                  <Label className="text-sm font-normal">Valor inclui IVA</Label>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>{expForm.includes_vat ? 'Valor Total c/ IVA (€)' : 'Valor Base (€)'}</Label><Input type="number" step="0.01" value={expForm.base_value || ''} onChange={e => setExpForm((f: any) => ({ ...f, base_value: e.target.value }))} /></div>
                  <div><Label>IVA (%)</Label>
                    <Select value={String(expForm.vat_rate ?? 23)} onValueChange={v => setExpForm((f: any) => ({ ...f, vat_rate: parseInt(v) }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{VAT_OPTIONS.map(v => <SelectItem key={v} value={String(v)}>{v}%</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                {expForm.base_value && parseFloat(expForm.base_value) > 0 && (expForm.vat_rate ?? 23) > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {expForm.includes_vat
                      ? `Base: ${(parseFloat(expForm.base_value) / (1 + (expForm.vat_rate ?? 23) / 100)).toFixed(2)} € · IVA: ${(parseFloat(expForm.base_value) - parseFloat(expForm.base_value) / (1 + (expForm.vat_rate ?? 23) / 100)).toFixed(2)} €`
                      : `Total c/ IVA: ${(parseFloat(expForm.base_value) * (1 + (expForm.vat_rate ?? 23) / 100)).toFixed(2)} € · IVA: ${(parseFloat(expForm.base_value) * (expForm.vat_rate ?? 23) / 100).toFixed(2)} €`
                    }
                  </p>
                )}
              </>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Localização</Label>
                <Select value={expForm.location || 'portugal'} onValueChange={v => setExpForm((f: any) => ({ ...f, location: v, ...(v !== 'portugal' ? { vat_rate: 0 } : {}) }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{LOCATIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Método Pagamento</Label>
                <Select value={expForm.payment_method || '__none__'} onValueChange={v => setExpForm((f: any) => ({ ...f, payment_method: v === '__none__' ? '' : v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">—</SelectItem>
                    {paymentMethods.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {/* Recurring */}
            <div className="rounded-lg border border-border p-3 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-normal">Despesa recorrente</Label>
                </div>
                <Switch checked={expForm.is_recurring || false} onCheckedChange={v => setExpForm((f: any) => ({ ...f, is_recurring: v }))} />
              </div>
              {expForm.is_recurring && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Periodicidade</Label>
                      <Select value={expForm.periodicity || 'mensal'} onValueChange={v => setExpForm((f: any) => ({ ...f, periodicity: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{PERIODICITIES.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Dia de pagamento</Label>
                      <Select value={String(expForm.recurrence_day || '')} onValueChange={v => setExpForm((f: any) => ({ ...f, recurrence_day: v ? parseInt(v) : null }))}>
                        <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                            <SelectItem key={d} value={String(d)}>Dia {d}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {expForm.base_value && parseFloat(expForm.base_value) > 0 && expForm.periodicity !== 'mensal' && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Equivalente mensal: {formatEuro(calcMonthlyEquivalent(parseFloat(expForm.base_value) || 0, expForm.periodicity || 'mensal'))}
                    </p>
                  )}
                </div>
              )}
            </div>
            <InvoiceUpload
              documents={Array.isArray(expForm.documents) ? expForm.documents : []}
              onChange={docs => setExpForm((f: any) => ({ ...f, documents: docs }))}
            />
            <div className="flex gap-2">
              <Button className="flex-1" onClick={saveExpense}>Guardar</Button>
              {expForm.id && <Button variant="destructive" aria-label="Eliminar" size="icon" onClick={async () => { await fin.deleteExpense.mutateAsync(expForm.id); setExpOpen(false); toast.success('Eliminada'); }}><Trash2 className="h-4 w-4" /></Button>}
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
