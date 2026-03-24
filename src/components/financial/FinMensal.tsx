import { useMemo, useState } from 'react';
import { FinancialHealthSection } from './FinancialHealthSection';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Plus, CalendarIcon, Check, FileText } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { useFinancialData } from '@/hooks/useFinancialData';
import type { Expense, Subscription, PayrollEntry, ContractorEntry, FinancialDocument } from '@/hooks/useFinancialData';
import { InvoiceUpload } from './InvoiceUpload';
import { CategorySelect } from './CategorySelect';
import { useFinancialCategories } from '@/hooks/useFinancialCategories';
const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

const VAT_RATES = [0, 6, 13, 23];
const LOCATIONS = ['portugal', 'ue', 'fora_ue'];
const LOC_LABELS: Record<string, string> = { portugal: 'Portugal', ue: 'União Europeia', fora_ue: 'Fora da UE' };

type Sale = { invoice_total: number; base_value: number; sale_month: number | null; sale_year: number | null; product?: string | null; client?: string | null; description?: string | null; status?: string };

interface Props {
  sales: Sale[];
  expenses: Expense[];
  subscriptions: Subscription[];
  payrollData: PayrollEntry[];
  contractorsData: ContractorEntry[];
  documents: FinancialDocument[];
  currentYear: number;
  fin: ReturnType<typeof useFinancialData>;
}

const fmt = (v: number) => v.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

export function FinMensal({ sales, expenses, subscriptions, fin, currentYear }: Props) {
  const { getCategoryLabel } = useFinancialCategories();
  const currentMonth = new Date().getMonth() + 1;
  const [month, setMonth] = useState(currentMonth.toString());
  const m = parseInt(month);

  const monthSales = useMemo(() => sales.filter(s => s.sale_year === currentYear && s.sale_month === m), [sales, currentYear, m]);
  const monthExpenses = useMemo(() => expenses.filter(e => e.expense_year === currentYear && e.expense_month === m), [expenses, currentYear, m]);

  // Active subscriptions that apply to this month
  const activeSubs = useMemo(() => {
    return (subscriptions || []).filter(s => s.status === 'ativo');
  }, [subscriptions]);

  // Check which subs already have a confirmed expense for this month
  const subExpenseMap = useMemo(() => {
    const map = new Map<string, Expense>();
    monthExpenses.forEach(e => {
      if (e.source_type === 'subscription' && e.source_id) {
        map.set(e.source_id, e);
      }
    });
    return map;
  }, [monthExpenses]);

  // Include subscription costs in totals
  const subsTotalThisMonth = activeSubs.reduce((s, sub) => s + sub.monthly_equivalent, 0);

  const totalEntradas = monthSales.reduce((s, v) => s + v.invoice_total, 0);
  const totalBaseEntradas = monthSales.reduce((s, v) => s + v.base_value, 0);
  const ivaCobrado = totalEntradas - totalBaseEntradas;

  const totalSaidas = monthExpenses.reduce((s, v) => s + v.total_with_vat, 0);
  const totalBaseSaidas = monthExpenses.reduce((s, v) => s + v.base_value, 0);
  const ivaPago = totalSaidas - totalBaseSaidas;

  const ivaBalanco = ivaCobrado - ivaPago;

  const resultado = totalEntradas - totalSaidas;
  const margem = totalEntradas > 0 ? Math.round(resultado / totalEntradas * 10000) / 100 : 0;

  // SS value for this month (stored as expense with category 'seguranca_social')
  const ssExpense = useMemo(() => monthExpenses.find(e => e.category === 'seguranca_social'), [monthExpenses]);
  const [ssValue, setSsValue] = useState('');
  const [ssEditing, setSsEditing] = useState(false);
  
  // Sync SS value when month changes
  useMemo(() => {
    setSsValue(ssExpense ? String(ssExpense.total_with_vat) : '');
    setSsEditing(false);
  }, [ssExpense, m]);

  // Sale dialog
  const [saleOpen, setSaleOpen] = useState(false);
  const [saleForm, setSaleForm] = useState({ description: '', product: '', client: '', base_value: '', invoice_total: '' });

  const saveSale = async () => {
    if (!saleForm.invoice_total) { toast.error('Valor é obrigatório'); return; }
    const q = Math.ceil(m / 3);
    const { error } = await supabase.from('commercial_sales').insert({
      sale_id: `V${currentYear}-${String(Date.now()).slice(-4)}`,
      description: saleForm.description || null,
      product: saleForm.product || null,
      client: saleForm.client || null,
      base_value: parseFloat(saleForm.base_value) || 0,
      invoice_total: parseFloat(saleForm.invoice_total) || 0,
      sale_month: m,
      sale_quarter: q,
      sale_year: currentYear,
      status: 'pago',
    });
    if (error) { toast.error('Erro ao guardar entrada'); return; }
    toast.success('Entrada adicionada');
    setSaleOpen(false);
    setSaleForm({ description: '', product: '', client: '', base_value: '', invoice_total: '' });
    // Refetch via window reload is crude; use queryClient instead
    window.location.reload();
  };

  // Expense dialog
  const [expOpen, setExpOpen] = useState(false);
  const [expForm, setExpForm] = useState<any>({ description: '', category: 'outro', base_value: '', vat_rate: '23', location: 'portugal', documents: [], includes_vat: false });

  const saveExpense = async () => {
    if (!expForm.base_value) { toast.error('Valor é obrigatório'); return; }
    const inputValue = parseFloat(expForm.base_value) || 0;
    const vat = parseInt(expForm.vat_rate) || 0;
    let base: number, total: number;
    if (expForm.includes_vat) {
      total = inputValue;
      base = Math.round(inputValue / (1 + vat / 100) * 100) / 100;
    } else {
      base = inputValue;
      total = Math.round(base * (1 + vat / 100) * 100) / 100;
    }
    const dateStr = `${currentYear}-${String(m).padStart(2, '0')}-15`;
    await fin.upsertExpense.mutateAsync({
      description: expForm.description || null,
      category: expForm.category,
      base_value: base,
      vat_rate: vat,
      total_with_vat: total,
      location: expForm.location,
      documents: expForm.documents || [],
      expense_date: dateStr,
      expense_month: m,
      expense_quarter: Math.ceil(m / 3),
      expense_year: currentYear,
      status: 'por_pagar',
    } as any);
    toast.success('Saída adicionada');
    setExpOpen(false);
    setExpForm({ description: '', category: 'outro', base_value: '', vat_rate: '23', location: 'portugal', documents: [], includes_vat: false });
  };

  return (
    <div className="space-y-6 mt-4">
      <div className="flex items-center gap-3">
        <Select value={month} onValueChange={setMonth}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>{MONTHS.map((label, i) => <SelectItem key={i} value={String(i + 1)}>{String(i + 1).padStart(2, '0')} {label}</SelectItem>)}</SelectContent>
        </Select>
        <span className="text-muted-foreground text-sm">{currentYear}</span>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Entradas</p><p className="text-lg font-bold text-green-600">{fmt(totalEntradas)}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Saídas</p><p className="text-lg font-bold text-red-600">{fmt(totalSaidas)}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Balanço</p><p className={`text-lg font-bold ${resultado >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmt(resultado)}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Margem</p><p className={`text-lg font-bold ${margem >= 0 ? 'text-green-600' : 'text-red-600'}`}>{margem}%</p></CardContent></Card>
      </div>

      {/* Entradas */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Entradas</CardTitle>
          <Button size="sm" variant="outline" onClick={() => setSaleOpen(true)}><Plus className="h-3.5 w-3.5 mr-1" /> Nova Entrada</Button>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead className="whitespace-nowrap">ID</TableHead><TableHead>Descrição</TableHead><TableHead>Produto</TableHead><TableHead>Cliente</TableHead><TableHead>Origem</TableHead><TableHead className="text-right whitespace-nowrap">Base (€)</TableHead><TableHead className="text-right whitespace-nowrap">Fatura Total</TableHead><TableHead>Pagamento</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {monthSales.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-6">Sem entradas</TableCell></TableRow>
              ) : monthSales.map((s: any, i) => (
                <TableRow key={i}>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{s.sale_id || '—'}</TableCell>
                  <TableCell>{s.description || '—'}</TableCell>
                  <TableCell>{s.product || '—'}</TableCell>
                  <TableCell>{s.client || '—'}</TableCell>
                  <TableCell>{s.source || '—'}</TableCell>
                  <TableCell className="text-right">{fmt(s.base_value)}</TableCell>
                  <TableCell className="text-right">{fmt(s.invoice_total)}</TableCell>
                  <TableCell className="whitespace-nowrap">{s.payment_date || '—'}</TableCell>
                  <TableCell><Badge variant="outline">{s.status}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Saídas */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Saídas</CardTitle>
          <div className="flex items-center gap-2">
            {/* SS inline — compact when already saved */}
            {ssExpense && !ssEditing ? (
              <Badge variant="outline" className="text-[10px] text-muted-foreground cursor-pointer hover:bg-muted" onClick={() => setSsEditing(true)}>SS: {fmt(ssExpense.total_with_vat)}</Badge>
            ) : (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-muted-foreground whitespace-nowrap">SS</span>
                <Input
                  type="number"
                  placeholder="0.00"
                  className="h-7 w-20 text-xs"
                  value={ssValue}
                  onChange={e => setSsValue(e.target.value)}
                />
                <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={async () => {
                  const val = parseFloat(ssValue) || 0;
                  if (val <= 0 && !ssExpense) return;
                  const dateStr = `${currentYear}-${String(m).padStart(2, '0')}-15`;
                  if (ssExpense) {
                    await fin.upsertExpense.mutateAsync({ id: ssExpense.id, total_with_vat: val, base_value: val, description: `Segurança Social — ${MONTHS[m - 1]} ${currentYear}` } as any);
                  } else {
                    await fin.upsertExpense.mutateAsync({
                      description: `Segurança Social — ${MONTHS[m - 1]} ${currentYear}`,
                      category: 'seguranca_social',
                      base_value: val,
                      vat_rate: 0,
                      total_with_vat: val,
                      location: 'portugal',
                      expense_date: dateStr,
                      expense_month: m,
                      expense_quarter: Math.ceil(m / 3),
                      expense_year: currentYear,
                      status: 'pago',
                    } as any);
                  }
                  setSsEditing(false);
                  toast.success('Segurança Social guardada');
                }}>
                  <Check className="h-3 w-3" />
                </Button>
              </div>
            )}
            <Button size="sm" variant="outline" onClick={() => setExpOpen(true)}><Plus className="h-3.5 w-3.5 mr-1" /> Nova Saída</Button>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead className="whitespace-nowrap">ID</TableHead><TableHead>Descrição</TableHead><TableHead>Categoria</TableHead><TableHead>Localização</TableHead><TableHead className="text-right whitespace-nowrap">Base (€)</TableHead><TableHead className="text-right whitespace-nowrap">IVA %</TableHead><TableHead className="text-right whitespace-nowrap">Total c/ IVA</TableHead><TableHead>Data</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {monthExpenses.filter(e => e.source_type !== 'subscription').map(e => (
                <TableRow key={e.id}>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{(e as any).expense_id || '—'}</TableCell>
                  <TableCell>{e.description || '—'}</TableCell>
                  <TableCell>{getCategoryLabel('expense', e.category)}</TableCell>
                  <TableCell>{(e as any).location === 'portugal' ? 'Portugal' : (e as any).location === 'ue' ? 'UE' : (e as any).location === 'fora_ue' ? 'Fora UE' : (e as any).location || '—'}</TableCell>
                  <TableCell className="text-right">{fmt(e.base_value)}</TableCell>
                  <TableCell className="text-right">{(e as any).vat_rate ?? 0}%</TableCell>
                  <TableCell className="text-right">{fmt(e.total_with_vat)}</TableCell>
                  <TableCell className="whitespace-nowrap">{(e as any).expense_date || '—'}</TableCell>
                  <TableCell><Badge variant="outline">{e.status}</Badge></TableCell>
                </TableRow>
              ))}
              {activeSubs.map(sub => {
                const linkedExpense = subExpenseMap.get(sub.id);
                const isPaid = !!linkedExpense && linkedExpense.status === 'pago';
                return (
                  <SubRow
                    key={sub.id}
                    sub={sub}
                    linkedExpense={linkedExpense}
                    isPaid={isPaid}
                    month={m}
                    currentYear={currentYear}
                    fin={fin}
                  />
                );
              })}
              {monthExpenses.filter(e => e.source_type !== 'subscription').length === 0 && activeSubs.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Sem saídas</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* IVA Balance */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Balanço IVA</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div><p className="text-muted-foreground">IVA Cobrado (vendas)</p><p className="font-semibold">{fmt(ivaCobrado)}</p></div>
            <div><p className="text-muted-foreground">IVA Pago (despesas)</p><p className="font-semibold">{fmt(ivaPago)}</p></div>
            <div>
              <p className="text-muted-foreground">Balanço</p>
              <p className={`font-semibold ${ivaBalanco > 0 ? 'text-amber-600' : ivaBalanco < 0 ? 'text-green-600' : ''}`}>
                {fmt(ivaBalanco)}
                {ivaBalanco > 0 && <Badge variant="outline" className="ml-2 bg-amber-100 text-amber-800 text-[10px]">A entregar</Badge>}
                {ivaBalanco < 0 && <Badge variant="outline" className="ml-2 bg-green-100 text-green-800 text-[10px]">A recuperar</Badge>}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>


      {/* Saúde Financeira */}
      <FinancialHealthSection sales={monthSales} allSales={sales} currentYear={currentYear} month={m} />

      <Dialog open={saleOpen} onOpenChange={setSaleOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nova Entrada — {MONTHS[m - 1]} {currentYear}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Descrição</Label><Input value={saleForm.description} onChange={e => setSaleForm(f => ({ ...f, description: e.target.value }))} /></div>
            <div><Label>Produto</Label><Input value={saleForm.product} onChange={e => setSaleForm(f => ({ ...f, product: e.target.value }))} /></div>
            <div><Label>Cliente</Label><Input value={saleForm.client} onChange={e => setSaleForm(f => ({ ...f, client: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Valor Base (€)</Label><Input type="number" value={saleForm.base_value} onChange={e => setSaleForm(f => ({ ...f, base_value: e.target.value }))} /></div>
              <div><Label>Fatura Total (€)</Label><Input type="number" value={saleForm.invoice_total} onChange={e => setSaleForm(f => ({ ...f, invoice_total: e.target.value }))} /></div>
            </div>
            <Button className="w-full" onClick={saveSale}>Guardar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* New Expense Dialog */}
      <Dialog open={expOpen} onOpenChange={setExpOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nova Saída — {MONTHS[m - 1]} {currentYear}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Descrição</Label><Input value={expForm.description} onChange={e => setExpForm((f: any) => ({ ...f, description: e.target.value }))} /></div>
            <div><Label>Categoria</Label>
              <CategorySelect type="expense" value={expForm.category} onValueChange={v => setExpForm((f: any) => ({ ...f, category: v }))} />
            </div>
            <div className="flex items-center gap-2 py-1">
              <Switch checked={expForm.includes_vat || false} onCheckedChange={v => setExpForm((f: any) => ({ ...f, includes_vat: v }))} />
              <Label className="text-sm font-normal">Valor inclui IVA</Label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{expForm.includes_vat ? 'Valor Total c/ IVA (€)' : 'Valor Base (€)'}</Label><Input type="number" value={expForm.base_value} onChange={e => setExpForm((f: any) => ({ ...f, base_value: e.target.value }))} /></div>
              <div><Label>IVA (%)</Label>
                <Select value={expForm.vat_rate} onValueChange={v => setExpForm((f: any) => ({ ...f, vat_rate: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{VAT_RATES.map(r => <SelectItem key={r} value={String(r)}>{r}%</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            {expForm.base_value && parseFloat(expForm.base_value) > 0 && parseInt(expForm.vat_rate) > 0 && (
              <p className="text-xs text-muted-foreground">
                {expForm.includes_vat
                  ? `Base: ${(parseFloat(expForm.base_value) / (1 + parseInt(expForm.vat_rate) / 100)).toFixed(2)} € · IVA: ${(parseFloat(expForm.base_value) - parseFloat(expForm.base_value) / (1 + parseInt(expForm.vat_rate) / 100)).toFixed(2)} €`
                  : `Total c/ IVA: ${(parseFloat(expForm.base_value) * (1 + parseInt(expForm.vat_rate) / 100)).toFixed(2)} € · IVA: ${(parseFloat(expForm.base_value) * parseInt(expForm.vat_rate) / 100).toFixed(2)} €`
                }
              </p>
            )}
            <div><Label>Localização</Label>
              <Select value={expForm.location} onValueChange={v => setExpForm((f: any) => ({ ...f, location: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{LOCATIONS.map(l => <SelectItem key={l} value={l}>{LOC_LABELS[l]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <InvoiceUpload
              documents={Array.isArray(expForm.documents) ? expForm.documents : []}
              onChange={docs => setExpForm((f: any) => ({ ...f, documents: docs }))}
            />
            <Button className="w-full" onClick={saveExpense}>Guardar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SubRow({ sub, linkedExpense, isPaid, month, currentYear, fin }: {
  sub: Subscription;
  linkedExpense: Expense | undefined;
  isPaid: boolean;
  month: number;
  currentYear: number;
  fin: ReturnType<typeof useFinancialData>;
}) {
  const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const [confirming, setConfirming] = useState(false);

  const handleConfirm = async () => {
    setConfirming(true);
    const dateStr = `${currentYear}-${String(month).padStart(2, '0')}-15`;
    if (linkedExpense) {
      // Toggle status
      await fin.upsertExpense.mutateAsync({
        id: linkedExpense.id,
        status: isPaid ? 'por_pagar' : 'pago',
      } as any);
    } else {
      // Create expense linked to this subscription
      await fin.upsertExpense.mutateAsync({
        description: `${sub.platform_name} — ${MONTHS[month - 1]} ${currentYear}`,
        category: 'ferramenta',
        base_value: sub.monthly_equivalent,
        vat_rate: 0,
        total_with_vat: sub.monthly_equivalent,
        location: sub.location,
        expense_date: dateStr,
        expense_month: month,
        expense_quarter: Math.ceil(month / 3),
        expense_year: currentYear,
        status: 'pago',
        source_type: 'subscription',
        source_id: sub.id,
      } as any);
    }
    setConfirming(false);
    toast.success(isPaid ? 'Marcado como pendente' : 'Confirmado como pago');
  };

  // Invoice upload for this subscription expense
  const handleDocsChange = async (docs: any[]) => {
    if (linkedExpense) {
      await fin.upsertExpense.mutateAsync({
        id: linkedExpense.id,
        documents: docs,
      } as any);
      toast.success('Fatura atualizada');
    }
  };

  const docs = linkedExpense?.documents;
  const docCount = Array.isArray(docs) ? docs.length : 0;

  return (
    <TableRow>
      <TableCell className="font-medium">{sub.platform_name}</TableCell>
      <TableCell>Subscrição</TableCell>
      <TableCell className="text-right">{fmt(sub.monthly_equivalent)}</TableCell>
      <TableCell>
        {isPaid
          ? <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Pago</Badge>
          : <Badge variant="outline" className="text-muted-foreground">Pendente</Badge>
        }
      </TableCell>
      <TableCell>
        <Button
          size="sm"
          variant={isPaid ? 'ghost' : 'default'}
          disabled={confirming}
          onClick={handleConfirm}
          className="text-xs"
        >
          <Check className="h-3.5 w-3.5 mr-1" />
          {isPaid ? 'Desfazer' : 'Confirmar'}
        </Button>
      </TableCell>
    </TableRow>
  );
}
