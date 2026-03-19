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

const PERIODICITIES = [
  { value: 'semanal', label: 'Semanal' },
  { value: 'mensal', label: 'Mensal' },
  { value: 'trimestral', label: 'Trimestral' },
  { value: 'semestral', label: 'Semestral' },
  { value: 'anual', label: 'Anual' },
];

const SUB_STATUS = [
  { value: 'ativo', label: 'Ativo' },
  { value: 'pausado', label: 'Pausado' },
  { value: 'cancelado', label: 'Cancelado' },
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

  // --- Subscription Dialog ---
  const [subOpen, setSubOpen] = useState(false);
  const [subForm, setSubForm] = useState<any>({});

  const openNewSub = () => {
    setSubForm({ category: 'outro', periodicity: 'mensal', location: 'portugal', status: 'ativo', value: '', platform_name: '', vat_rate: 0, includes_vat: false });
    setSubOpen(true);
  };

  const saveSub = async () => {
    if (!subForm.platform_name?.trim()) { toast.error('Nome é obrigatório'); return; }
    const inputVal = parseFloat(subForm.value) || 0;
    const vatRate = parseInt(subForm.vat_rate) || 0;
    let val = inputVal;
    // If includes_vat, the stored "value" should be the total (with VAT) as entered
    // monthly_equivalent is computed from value by calcMonthlyEquivalent
    await fin.upsertSubscription.mutateAsync({
      ...(subForm.id ? { id: subForm.id } : {}),
      platform_name: subForm.platform_name,
      category: subForm.category,
      value: val,
      periodicity: subForm.periodicity,
      location: subForm.location,
      start_date: subForm.start_date ? (typeof subForm.start_date === 'string' ? subForm.start_date : format(subForm.start_date, 'yyyy-MM-dd')) : null,
      renewal_date: subForm.renewal_date ? (typeof subForm.renewal_date === 'string' ? subForm.renewal_date : format(subForm.renewal_date, 'yyyy-MM-dd')) : null,
      status: subForm.status,
      notes: subForm.notes || null,
      documents: subForm.documents || [],
      vat_rate: vatRate,
      includes_vat: !!subForm.includes_vat,
    });
    setSubOpen(false);
    toast.success('Subscrição guardada');
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
                  <TableHead>ID</TableHead>
                  <TableHead>Status</TableHead>
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
                    <TableCell className="font-mono text-xs">{e.expense_id}</TableCell>
                    <TableCell><Badge variant="outline" className={e.status === 'pago' ? 'bg-green-100 text-green-800' : e.status === 'cancelado' ? 'bg-muted text-muted-foreground' : 'bg-amber-100 text-amber-800'}>{EXP_STATUS.find(s => s.value === e.status)?.label || e.status}</Badge></TableCell>
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

      {/* SUBSCRIPTIONS */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">Plataformas & Subscrições</h3>
          <Button size="sm" onClick={openNewSub}><Plus className="h-4 w-4 mr-1" /> Nova Plataforma</Button>
        </div>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Plataforma</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Periodicidade</TableHead>
                  <TableHead className="text-right">Custo Mensal</TableHead>
                  <TableHead>Localização</TableHead>
                  <TableHead>Renovação</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subscriptions.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Sem subscrições</TableCell></TableRow>
                ) : subscriptions.map(s => {
                  const renewalWarning = s.renewal_date && s.status === 'ativo' && differenceInDays(parseISO(s.renewal_date), today) <= 30 && differenceInDays(parseISO(s.renewal_date), today) >= 0;
                  return (
                    <TableRow key={s.id} className="cursor-pointer hover:bg-muted/50" onClick={() => {
                      setSubForm({ ...s, value: s.value.toString(), start_date: s.start_date ? new Date(s.start_date + 'T00:00:00') : undefined, renewal_date: s.renewal_date ? new Date(s.renewal_date + 'T00:00:00') : undefined });
                      setSubOpen(true);
                    }}>
                      <TableCell className="font-medium">{s.platform_name}</TableCell>
                      <TableCell>{getCategoryLabel('subscription', s.category)}</TableCell>
                      <TableCell className="text-right">{fmt(s.value)}</TableCell>
                      <TableCell>{PERIODICITIES.find(p => p.value === s.periodicity)?.label || s.periodicity}</TableCell>
                      <TableCell className="text-right font-medium">{fmt(s.monthly_equivalent)}</TableCell>
                      <TableCell>{LOCATIONS.find(l => l.value === s.location)?.label || s.location}</TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1">
                          {s.renewal_date || '—'}
                          {renewalWarning && <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />}
                        </span>
                      </TableCell>
                      <TableCell><Badge variant="outline" className={s.status === 'ativo' ? 'bg-green-100 text-green-800' : s.status === 'pausado' ? 'bg-amber-100 text-amber-800' : 'bg-muted text-muted-foreground'}>{SUB_STATUS.find(st => st.value === s.status)?.label || s.status}</Badge></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <p className="text-sm text-muted-foreground mt-2">Total fixo em plataformas por mês: <strong className="text-foreground">{fmt(totalMonthly)}</strong></p>
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

      {/* SUBSCRIPTION DIALOG */}
      <Dialog open={subOpen} onOpenChange={setSubOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{subForm.id ? 'Editar Subscrição' : 'Nova Plataforma'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome da Plataforma</Label><Input value={subForm.platform_name || ''} onChange={e => setSubForm((f: any) => ({ ...f, platform_name: e.target.value }))} /></div>
            <div><Label>Categoria</Label>
              <CategorySelect type="subscription" value={subForm.category || 'outro'} onValueChange={v => setSubForm((f: any) => ({ ...f, category: v }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Valor (€)</Label><Input type="number" step="0.01" value={subForm.value || ''} onChange={e => setSubForm((f: any) => ({ ...f, value: e.target.value }))} /></div>
              <div><Label>Periodicidade</Label>
                <Select value={subForm.periodicity || 'mensal'} onValueChange={v => setSubForm((f: any) => ({ ...f, periodicity: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PERIODICITIES.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Localização</Label>
              <Select value={subForm.location || 'portugal'} onValueChange={v => setSubForm((f: any) => ({ ...f, location: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{LOCATIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Data de Início</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start", !subForm.start_date && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {subForm.start_date ? format(subForm.start_date instanceof Date ? subForm.start_date : new Date(subForm.start_date), 'dd/MM/yyyy') : 'Selecionar'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={subForm.start_date instanceof Date ? subForm.start_date : undefined} onSelect={d => setSubForm((f: any) => ({ ...f, start_date: d }))} className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
              <div><Label>Data de Renovação</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start", !subForm.renewal_date && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {subForm.renewal_date ? format(subForm.renewal_date instanceof Date ? subForm.renewal_date : new Date(subForm.renewal_date), 'dd/MM/yyyy') : 'Selecionar'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={subForm.renewal_date instanceof Date ? subForm.renewal_date : undefined} onSelect={d => setSubForm((f: any) => ({ ...f, renewal_date: d }))} className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <div><Label>Status</Label>
              <Select value={subForm.status || 'ativo'} onValueChange={v => setSubForm((f: any) => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{SUB_STATUS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Notas</Label><Input value={subForm.notes || ''} onChange={e => setSubForm((f: any) => ({ ...f, notes: e.target.value }))} /></div>
            <InvoiceUpload
              documents={Array.isArray(subForm.documents) ? subForm.documents : []}
              onChange={docs => setSubForm((f: any) => ({ ...f, documents: docs }))}
            />
            <div className="flex gap-2">
              <Button className="flex-1" onClick={saveSub}>Guardar</Button>
              {subForm.id && <Button variant="destructive" size="icon" onClick={async () => { await fin.deleteSubscription.mutateAsync(subForm.id); setSubOpen(false); toast.success('Eliminada'); }}><Trash2 className="h-4 w-4" /></Button>}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
