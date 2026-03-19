import { useMemo, useState } from 'react';
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
import { Plus, CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { useFinancialData } from '@/hooks/useFinancialData';
import type { Expense, Subscription, PayrollEntry, ContractorEntry, FinancialDocument } from '@/hooks/useFinancialData';

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

const CATEGORIES = ['pessoal', 'freelancer', 'campanha', 'ferramenta', 'formacao', 'servico_contratado', 'outro'];
const CAT_LABELS: Record<string, string> = { pessoal: 'Pessoal', freelancer: 'Freelancer', campanha: 'Campanha', ferramenta: 'Ferramenta', formacao: 'Formação', servico_contratado: 'Serviço Contratado', outro: 'Outro' };
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

export function FinMensal({ sales, expenses, fin, currentYear }: Props) {
  const currentMonth = new Date().getMonth() + 1;
  const [month, setMonth] = useState(currentMonth.toString());
  const m = parseInt(month);

  const monthSales = useMemo(() => sales.filter(s => s.sale_year === currentYear && s.sale_month === m), [sales, currentYear, m]);
  const monthExpenses = useMemo(() => expenses.filter(e => e.expense_year === currentYear && e.expense_month === m), [expenses, currentYear, m]);

  const totalEntradas = monthSales.reduce((s, v) => s + v.invoice_total, 0);
  const totalSaidas = monthExpenses.reduce((s, v) => s + v.total_with_vat, 0);
  const resultado = totalEntradas - totalSaidas;
  const margem = totalEntradas > 0 ? Math.round(resultado / totalEntradas * 10000) / 100 : 0;

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
  const [expForm, setExpForm] = useState<any>({ description: '', category: 'outro', base_value: '', vat_rate: '23', location: 'portugal' });

  const saveExpense = async () => {
    if (!expForm.base_value) { toast.error('Valor base é obrigatório'); return; }
    const base = parseFloat(expForm.base_value) || 0;
    const vat = parseInt(expForm.vat_rate) || 0;
    const total = Math.round(base * (1 + vat / 100) * 100) / 100;
    const dateStr = `${currentYear}-${String(m).padStart(2, '0')}-15`;
    await fin.upsertExpense.mutateAsync({
      description: expForm.description || null,
      category: expForm.category,
      base_value: base,
      vat_rate: vat,
      total_with_vat: total,
      location: expForm.location,
      expense_date: dateStr,
      expense_month: m,
      expense_quarter: Math.ceil(m / 3),
      expense_year: currentYear,
      status: 'por_pagar',
    } as any);
    toast.success('Saída adicionada');
    setExpOpen(false);
    setExpForm({ description: '', category: 'outro', base_value: '', vat_rate: '23', location: 'portugal' });
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
          <CardTitle className="text-sm">Entradas — {MONTHS[m - 1]}</CardTitle>
          <Button size="sm" variant="outline" onClick={() => setSaleOpen(true)}><Plus className="h-3.5 w-3.5 mr-1" /> Nova Entrada</Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Descrição</TableHead><TableHead>Produto</TableHead><TableHead>Cliente</TableHead><TableHead className="text-right">Fatura Total</TableHead></TableRow></TableHeader>
            <TableBody>
              {monthSales.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Sem entradas</TableCell></TableRow>
              ) : monthSales.map((s, i) => (
                <TableRow key={i}><TableCell>{(s as any).description || '—'}</TableCell><TableCell>{(s as any).product || '—'}</TableCell><TableCell>{(s as any).client || '—'}</TableCell><TableCell className="text-right">{fmt(s.invoice_total)}</TableCell></TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Saídas */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Saídas — {MONTHS[m - 1]}</CardTitle>
          <Button size="sm" variant="outline" onClick={() => setExpOpen(true)}><Plus className="h-3.5 w-3.5 mr-1" /> Nova Saída</Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>ID</TableHead><TableHead>Descrição</TableHead><TableHead>Categoria</TableHead><TableHead className="text-right">Total c/ IVA</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {monthExpenses.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Sem saídas</TableCell></TableRow>
              ) : monthExpenses.map(e => (
                <TableRow key={e.id}><TableCell className="font-mono text-xs">{e.expense_id}</TableCell><TableCell>{e.description || '—'}</TableCell><TableCell>{CAT_LABELS[e.category] || e.category}</TableCell><TableCell className="text-right">{fmt(e.total_with_vat)}</TableCell><TableCell><Badge variant="outline">{e.status}</Badge></TableCell></TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* New Sale Dialog */}
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
              <Select value={expForm.category} onValueChange={v => setExpForm((f: any) => ({ ...f, category: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{CAT_LABELS[c]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Valor Base (€)</Label><Input type="number" value={expForm.base_value} onChange={e => setExpForm((f: any) => ({ ...f, base_value: e.target.value }))} /></div>
              <div><Label>IVA (%)</Label>
                <Select value={expForm.vat_rate} onValueChange={v => setExpForm((f: any) => ({ ...f, vat_rate: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{VAT_RATES.map(r => <SelectItem key={r} value={String(r)}>{r}%</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Localização</Label>
              <Select value={expForm.location} onValueChange={v => setExpForm((f: any) => ({ ...f, location: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{LOCATIONS.map(l => <SelectItem key={l} value={l}>{LOC_LABELS[l]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button className="w-full" onClick={saveExpense}>Guardar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
