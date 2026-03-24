import { useState, useMemo } from 'react';
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
import { Plus, CalendarIcon, Trash2, AlertTriangle } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { format, parseISO, differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { useFinancialData } from '@/hooks/useFinancialData';
import { calcMonthlyEquivalent, type Expense, type Subscription } from '@/hooks/useFinancialData';
import { InvoiceUpload, type DocEntry } from './InvoiceUpload';
import { CategorySelect } from './CategorySelect';
import { useFinancialCategories } from '@/hooks/useFinancialCategories';

const EXP_STATUS = [
  { value: 'por_pagar', label: 'Por Pagar' },
  { value: 'pago', label: 'Pago' },
  { value: 'cancelado', label: 'Cancelado' },
];

const VAT_OPTIONS = [0, 6, 13, 23];
const LOCATIONS = [
  { value: 'portugal', label: 'Portugal' },
  { value: 'ue', label: 'União Europeia' },
  { value: 'fora_ue', label: 'Fora da UE' },
];

interface Props { fin: ReturnType<typeof useFinancialData>; }

const fmt = (v: number) => v.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
const FULL = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

export function FinSaidas({ fin }: Props) {
  const { expenseCategories, subscriptionCategories, getCategoryLabel } = useFinancialCategories();
  const expenses = fin.expenses.data || [];
  const subscriptions = fin.subscriptions.data || [];
  const payrollData = fin.payroll.data || [];
  const contractorsData = fin.contractors.data || [];
  const currentYear = new Date().getFullYear();

  // --- Expense Dialog ---
  const [expOpen, setExpOpen] = useState(false);
  const [expForm, setExpForm] = useState<any>({});

  const openNewExpense = () => {
    setExpForm({ status: 'por_pagar', category: 'outro', vat_rate: 23, location: 'portugal', base_value: '', description: '', includes_vat: false });
    setExpOpen(true);
  };

  const saveExpense = async () => {
    const inputValue = parseFloat(expForm.base_value) || 0;
    const vat = parseFloat(expForm.vat_rate) || 0;
    let base: number, total: number;
    if (expForm.includes_vat) {
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
    await fin.upsertExpense.mutateAsync({
      ...(expForm.id ? { id: expForm.id } : {}),
      status: expForm.status,
      expense_date: date,
      description: expForm.description || null,
      category: expForm.category,
      base_value: base,
      vat_rate: vat,
      total_with_vat: total,
      location: expForm.location,
      documents: expForm.documents || [],
      expense_month: month,
      expense_quarter: quarter,
      expense_year: year,
    });
    setExpOpen(false);
    toast.success('Despesa guardada');
  };

  const activeSubs = subscriptions.filter(s => s.status === 'ativo');
  const totalMonthly = activeSubs.reduce((s, sub) => s + sub.monthly_equivalent, 0);

  // Previsibilidade mensal
  const predictability = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const subsTotal = totalMonthly;
      const pessoal = payrollData.filter(p => p.year === currentYear && p.month === m).reduce((s, v) => s + v.total_cost, 0);
      const prest = contractorsData.filter(c => c.year === currentYear && c.month === m).reduce((s, v) => s + v.value, 0);
      // Check for renewals this month
      const renewals = subscriptions.filter(s => {
        if (!s.renewal_date || s.status !== 'ativo') return false;
        const rd = parseISO(s.renewal_date);
        return rd.getMonth() + 1 === m;
      });
      return { mes: FULL[i], subs: subsTotal, pessoal, prestadores: prest, total: Math.round((subsTotal + pessoal + prest) * 100) / 100, renewals };
    });
  }, [totalMonthly, payrollData, contractorsData, subscriptions, currentYear]);

  const today = new Date();

  return (
    <div className="space-y-8 mt-4">
      {/* DESPESAS */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">Despesas</h3>
          <Button size="sm" onClick={openNewExpense}><Plus className="h-4 w-4 mr-1" /> Nova Despesa</Button>
        </div>
        <Card>
          <CardContent className="p-0">
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
                  <TableHead>Localização</TableHead>
                  <TableHead>Mês</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.length === 0 ? (
                  <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">Sem despesas</TableCell></TableRow>
                ) : expenses.map(e => (
                  <TableRow key={e.id} className="cursor-pointer hover:bg-muted/50" onClick={() => {
                    setExpForm({ ...e, expense_date: e.expense_date ? new Date(e.expense_date + 'T00:00:00') : undefined, base_value: e.base_value.toString() });
                    setExpOpen(true);
                  }}>
                    <TableCell><Badge variant="outline" className={e.status === 'pago' ? 'bg-green-100 text-green-800' : e.status === 'cancelado' ? 'bg-muted text-muted-foreground' : 'bg-amber-100 text-amber-800'}>{EXP_STATUS.find(s => s.value === e.status)?.label || e.status}</Badge></TableCell>
                    <TableCell className="font-mono text-xs">{e.expense_id}</TableCell>
                    <TableCell>{e.expense_date || '—'}</TableCell>
                    <TableCell className="truncate max-w-[200px]">{e.description || '—'}</TableCell>
                    <TableCell>{getCategoryLabel('expense', e.category)}</TableCell>
                    <TableCell className="text-right">{fmt(e.base_value)}</TableCell>
                    <TableCell>{e.vat_rate}%</TableCell>
                    <TableCell className="text-right font-medium">{fmt(e.total_with_vat)}</TableCell>
                    <TableCell>{LOCATIONS.find(l => l.value === e.location)?.label || e.location}</TableCell>
                    <TableCell>{e.expense_month || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>


      {/* PREVISIBILIDADE */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Previsibilidade Mensal</h3>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mês</TableHead>
                  <TableHead className="text-right">Subscrições (€)</TableHead>
                  <TableHead className="text-right">Pessoal Fixo (€)</TableHead>
                  <TableHead className="text-right">Prestadores (€)</TableHead>
                  <TableHead className="text-right">Total Previsto (€)</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {predictability.map((p, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{p.mes}</TableCell>
                    <TableCell className="text-right">{fmt(p.subs)}</TableCell>
                    <TableCell className="text-right">{fmt(p.pessoal)}</TableCell>
                    <TableCell className="text-right">{fmt(p.prestadores)}</TableCell>
                    <TableCell className="text-right font-medium">{fmt(p.total)}</TableCell>
                    <TableCell>
                      {p.renewals.length > 0 && <Badge variant="outline" className="bg-amber-100 text-amber-800 text-xs">{p.renewals.length} renovação(ões)</Badge>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
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
            <div><Label>Categoria</Label>
              <CategorySelect type="expense" value={expForm.category || 'outro'} onValueChange={v => setExpForm((f: any) => ({ ...f, category: v }))} />
            </div>
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
            <div><Label>Localização</Label>
              <Select value={expForm.location || 'portugal'} onValueChange={v => setExpForm((f: any) => ({ ...f, location: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{LOCATIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <InvoiceUpload
              documents={Array.isArray(expForm.documents) ? expForm.documents : []}
              onChange={docs => setExpForm((f: any) => ({ ...f, documents: docs }))}
            />
            <div className="flex gap-2">
              <Button className="flex-1" onClick={saveExpense}>Guardar</Button>
              {expForm.id && <Button variant="destructive" size="icon" onClick={async () => { await fin.deleteExpense.mutateAsync(expForm.id); setExpOpen(false); toast.success('Eliminada'); }}><Trash2 className="h-4 w-4" /></Button>}
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
