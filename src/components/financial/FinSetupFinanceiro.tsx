import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
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
import { Switch } from '@/components/ui/switch';
import { Plus, CalendarIcon, Trash2, Truck } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import type { useFinancialData } from '@/hooks/useFinancialData';
import { calcMonthlyEquivalent } from '@/hooks/useFinancialData';

import { CategorySelect } from './CategorySelect';
import { SupplierSelect } from './SupplierSelect';
import { useFinancialCategories } from '@/hooks/useFinancialCategories';

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
const REC_STATUS = [
  { value: 'por_pagar', label: 'Ativo' },
  { value: 'cancelado', label: 'Cancelado' },
];

const fmt = (v: number) => v.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

const PAYMENT_LABELS: Record<string, string> = {
  mbway: 'MB WAY',
  transferencia: 'Transferência',
  cartao: 'Cartão',
  paypal: 'PayPal',
  stripe: 'Stripe',
  numerario: 'Numerário',
  debito_direto: 'Débito Direto',
  outro: 'Outro',
};

interface Props {
  fin: ReturnType<typeof useFinancialData>;
}

export function FinSetupFinanceiro({ fin }: Props) {
  const navigate = useNavigate();
  const { getCategoryLabel } = useFinancialCategories();
  const recurringExpenses = fin.recurringExpenses.data || [];

  // Products with payment methods
  const { data: products = [] } = useQuery({
    queryKey: ['products-setup-fin'],
    queryFn: async () => {
      const { data } = await supabase
        .from('products')
        .select('id, name, ticket, vat_rate, status')
        .order('name');
      return (data || []) as { id: string; name: string; ticket: string | null; vat_rate: string | null; status: string }[];
    },
  });

  const { data: paymentMethods = [] } = useQuery({
    queryKey: ['all-product-payment-methods'],
    queryFn: async () => {
      const { data } = await supabase
        .from('product_payment_methods' as any)
        .select('product_id, payment_method');
      return (data || []) as unknown as { product_id: string; payment_method: string }[];
    },
  });

  const getPaymentMethodsForProduct = (productId: string) =>
    paymentMethods.filter(pm => pm.product_id === productId).map(pm => PAYMENT_LABELS[pm.payment_method] || pm.payment_method);

  const computeTicketWithVat = (ticket: string | null, vatRate: string | null) => {
    const t = parseFloat(ticket || '0') || 0;
    const v = parseFloat(vatRate || '0') || 0;
    return t * (1 + v / 100);
  };

  // --- Recurring Expense Dialog ---
  const [subOpen, setSubOpen] = useState(false);
  const [subForm, setSubForm] = useState<any>({});

  const openNew = () => {
    setSubForm({ category: 'plataformas', periodicity: 'mensal', location: 'portugal', status: 'por_pagar', base_value: '', expense_name: '', vat_rate: 0, includes_vat: false, supplier_id: null });
    setSubOpen(true);
  };

  const saveSub = async () => {
    if (!subForm.expense_name?.trim()) { toast.error('Nome é obrigatório'); return; }
    const val = parseFloat(subForm.base_value) || 0;
    const vatRate = parseInt(subForm.vat_rate) || 0;
    let baseValue: number, totalWithVat: number;
    if (subForm.includes_vat) {
      totalWithVat = val;
      baseValue = Math.round(val / (1 + vatRate / 100) * 100) / 100;
    } else {
      baseValue = val;
      totalWithVat = Math.round(val * (1 + vatRate / 100) * 100) / 100;
    }
    const startDate = subForm.start_date
      ? (typeof subForm.start_date === 'string' ? subForm.start_date : format(subForm.start_date, 'yyyy-MM-dd'))
      : format(new Date(), 'yyyy-MM-dd');

    await fin.upsertRecurringExpense.mutateAsync({
      ...(subForm.id ? { id: subForm.id } : {}),
      expense_name: subForm.expense_name,
      description: subForm.expense_name,
      category: subForm.category,
      base_value: baseValue,
      total_with_vat: totalWithVat,
      vat_rate: vatRate,
      periodicity: subForm.periodicity,
      location: subForm.location,
      expense_date: startDate,
      status: subForm.status,
      supplier_id: subForm.supplier_id || null,
      source_type: 'subscription',
    } as any);
    setSubOpen(false);
    toast.success('Despesa recorrente guardada');
  };

  const activeRecs = recurringExpenses.filter(s => s.status !== 'cancelado');
  const totalMonthly = activeRecs.reduce((s, sub) => s + (sub.monthly_equivalent || 0), 0);

  return (
    <div className="space-y-8">
      {/* FORNECEDORES */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Fornecedores</h3>
        <Button size="sm" variant="outline" onClick={() => navigate('/hub/financeiro/fornecedores')}>
          <Truck className="h-4 w-4 mr-1" /> Gerir Fornecedores
        </Button>
      </div>

      {/* PRODUTOS */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Produtos — Visão Financeira</h3>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Ticket s/ IVA</TableHead>
                  <TableHead className="text-right">IVA</TableHead>
                  <TableHead className="text-right">Ticket c/ IVA</TableHead>
                  <TableHead>Formas de Pagamento</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Sem produtos</TableCell></TableRow>
                ) : products.map(p => {
                  const ticket = parseFloat(p.ticket || '0') || 0;
                  const vat = parseFloat(p.vat_rate || '0') || 0;
                  const ticketWithVat = computeTicketWithVat(p.ticket, p.vat_rate);
                  const methods = getPaymentMethodsForProduct(p.id);
                  return (
                    <TableRow key={p.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/hub/produtos/${p.id}`)}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={p.status === 'vendas_ativas' ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground'}>
                          {p.status === 'vendas_ativas' ? 'Vendas Ativas' : p.status === 'a_criar' ? 'A Criar' : p.status === 'em_ideia' ? 'Em Ideia' : 'Off'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{ticket > 0 ? fmt(ticket) : '—'}</TableCell>
                      <TableCell className="text-right">{vat > 0 ? `${vat}%` : '—'}</TableCell>
                      <TableCell className="text-right font-medium">{ticket > 0 ? fmt(ticketWithVat) : '—'}</TableCell>
                      <TableCell>
                        {methods.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {methods.map(m => <Badge key={m} variant="secondary" className="text-xs">{m}</Badge>)}
                          </div>
                        ) : <span className="text-muted-foreground text-xs">—</span>}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* RECURRING EXPENSES (ex-subscriptions) */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-lg font-semibold">Despesas Recorrentes</h3>
            {totalMonthly > 0 && <p className="text-sm text-muted-foreground">Custo mensal estimado: {fmt(totalMonthly)}</p>}
          </div>
          <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Nova Despesa Recorrente</Button>
        </div>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-right">Valor Base</TableHead>
                  <TableHead>Periodicidade</TableHead>
                  <TableHead className="text-right">Custo Mensal</TableHead>
                  <TableHead>Localização</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recurringExpenses.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Sem despesas recorrentes</TableCell></TableRow>
                ) : recurringExpenses.map(s => (
                  <TableRow key={s.id} className="cursor-pointer hover:bg-muted/50" onClick={() => {
                    setSubForm({
                      ...s,
                      base_value: String(s.base_value),
                      expense_name: s.expense_name || s.description,
                      start_date: s.expense_date ? new Date(s.expense_date + 'T00:00:00') : undefined,
                      includes_vat: false,
                    });
                    setSubOpen(true);
                  }}>
                    <TableCell className="font-medium">{s.expense_name || s.description}</TableCell>
                    <TableCell>{getCategoryLabel('expense', s.category)}</TableCell>
                    <TableCell className="text-right">{fmt(s.base_value)}</TableCell>
                    <TableCell>{PERIODICITIES.find(p => p.value === s.periodicity)?.label || s.periodicity || '—'}</TableCell>
                    <TableCell className="text-right font-medium">{fmt(s.monthly_equivalent || 0)}</TableCell>
                    <TableCell>{LOCATIONS.find(l => l.value === s.location)?.label || s.location}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={s.status !== 'cancelado' ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}>
                        {s.status !== 'cancelado' ? 'Ativo' : 'Cancelado'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* RECURRING EXPENSE DIALOG */}
      <Dialog open={subOpen} onOpenChange={setSubOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{subForm.id ? 'Editar Despesa Recorrente' : 'Nova Despesa Recorrente'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome</Label><Input value={subForm.expense_name || ''} onChange={e => setSubForm((f: any) => ({ ...f, expense_name: e.target.value }))} /></div>
            <div><Label>Fornecedor</Label>
              <SupplierSelect value={subForm.supplier_id || null} onValueChange={v => setSubForm((f: any) => ({ ...f, supplier_id: v }))} />
            </div>
            <div><Label>Categoria</Label>
              <CategorySelect type="expense" value={subForm.category || 'plataformas'} onValueChange={v => setSubForm((f: any) => ({ ...f, category: v }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Status</Label>
                <Select value={subForm.status || 'por_pagar'} onValueChange={v => setSubForm((f: any) => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{REC_STATUS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
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
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>{subForm.includes_vat ? 'Valor c/ IVA (€)' : 'Valor (€)'}</Label><Input type="number" step="0.01" value={subForm.base_value || ''} onChange={e => setSubForm((f: any) => ({ ...f, base_value: e.target.value }))} /></div>
              <div><Label>IVA (%)</Label>
                <Select value={String(subForm.vat_rate ?? 0)} onValueChange={v => setSubForm((f: any) => ({ ...f, vat_rate: parseInt(v) }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{VAT_OPTIONS.map(v => <SelectItem key={v} value={String(v)}>{v}%</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Periodicidade</Label>
                <Select value={subForm.periodicity || 'mensal'} onValueChange={v => setSubForm((f: any) => ({ ...f, periodicity: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PERIODICITIES.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-2 py-1">
              <Switch checked={subForm.includes_vat || false} onCheckedChange={v => setSubForm((f: any) => ({ ...f, includes_vat: v }))} />
              <Label className="text-sm font-normal">Valor inclui IVA</Label>
            </div>
            {subForm.base_value && parseFloat(subForm.base_value) > 0 && (subForm.vat_rate ?? 0) > 0 && (
              <p className="text-xs text-muted-foreground">
                {subForm.includes_vat
                  ? `Base: ${(parseFloat(subForm.base_value) / (1 + (subForm.vat_rate ?? 0) / 100)).toFixed(2)} € · IVA: ${(parseFloat(subForm.base_value) - parseFloat(subForm.base_value) / (1 + (subForm.vat_rate ?? 0) / 100)).toFixed(2)} €`
                  : `Total c/ IVA: ${(parseFloat(subForm.base_value) * (1 + (subForm.vat_rate ?? 0) / 100)).toFixed(2)} € · IVA: ${(parseFloat(subForm.base_value) * (subForm.vat_rate ?? 0) / 100).toFixed(2)} €`
                }
              </p>
            )}
            <div><Label>Localização</Label>
              <Select value={subForm.location || 'portugal'} onValueChange={v => setSubForm((f: any) => ({ ...f, location: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{LOCATIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={saveSub}>Guardar</Button>
              {subForm.id && <Button variant="destructive" size="icon" onClick={async () => { await fin.deleteRecurringExpense.mutateAsync(subForm.id); setSubOpen(false); toast.success('Eliminada'); }}><Trash2 className="h-4 w-4" /></Button>}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
