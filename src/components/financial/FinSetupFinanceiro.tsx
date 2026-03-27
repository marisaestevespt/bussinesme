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
import { calcMonthlyEquivalent, type Subscription } from '@/hooks/useFinancialData';

import { CategorySelect } from './CategorySelect';
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
const SUB_STATUS = [
  { value: 'ativo', label: 'Ativo' },
  { value: 'pausado', label: 'Pausado' },
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
  const subscriptions = fin.subscriptions.data || [];
  const today = new Date();

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

  // --- Subscription Dialog ---
  const [subOpen, setSubOpen] = useState(false);
  const [subForm, setSubForm] = useState<any>({});

  const openNewSub = () => {
    setSubForm({ category: 'outro', periodicity: 'mensal', location: 'portugal', country: 'Portugal', status: 'ativo', value: '', platform_name: '', vat_rate: 0, includes_vat: false, nif: '' });
    setSubOpen(true);
  };

  const saveSub = async () => {
    if (!subForm.platform_name?.trim()) { toast.error('Nome é obrigatório'); return; }
    const val = parseFloat(subForm.value) || 0;
    const vatRate = parseInt(subForm.vat_rate) || 0;
    await fin.upsertSubscription.mutateAsync({
      ...(subForm.id ? { id: subForm.id } : {}),
      platform_name: subForm.platform_name,
      category: subForm.category,
      value: val,
      periodicity: subForm.periodicity,
      location: subForm.location,
      start_date: subForm.start_date ? (typeof subForm.start_date === 'string' ? subForm.start_date : format(subForm.start_date, 'yyyy-MM-dd')) : null,
      renewal_date: null,
      status: subForm.status,
      notes: subForm.notes || null,
      documents: subForm.documents || [],
      vat_rate: vatRate,
      includes_vat: !!subForm.includes_vat,
      nif: subForm.nif || '',
      country: subForm.country || '',
    } as any);
    setSubOpen(false);
    toast.success('Subscrição guardada');
  };

  const activeSubs = subscriptions.filter(s => s.status === 'ativo');
  const totalMonthly = activeSubs.reduce((s, sub) => s + sub.monthly_equivalent, 0);

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
                   <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subscriptions.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Sem subscrições</TableCell></TableRow>
                ) : subscriptions.map(s => (
                    <TableRow key={s.id} className="cursor-pointer hover:bg-muted/50" onClick={() => {
                      setSubForm({ ...s, value: s.value.toString(), start_date: s.start_date ? new Date(s.start_date + 'T00:00:00') : undefined });
                      setSubOpen(true);
                    }}>
                      <TableCell className="font-medium">{s.platform_name}</TableCell>
                      <TableCell>{getCategoryLabel('subscription', s.category)}</TableCell>
                      <TableCell className="text-right">{fmt(s.value)}</TableCell>
                      <TableCell>{PERIODICITIES.find(p => p.value === s.periodicity)?.label || s.periodicity}</TableCell>
                      <TableCell className="text-right font-medium">{fmt(s.monthly_equivalent)}</TableCell>
                      <TableCell>{LOCATIONS.find(l => l.value === s.location)?.label || s.location}</TableCell>
                      <TableCell><Badge variant="outline" className={s.status === 'ativo' ? 'bg-success/10 text-success' : s.status === 'pausado' ? 'bg-warning/10 text-warning' : 'bg-muted text-muted-foreground'}>{SUB_STATUS.find(st => st.value === s.status)?.label || s.status}</Badge></TableCell>
                    </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        
      </div>

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
              <div><Label>Status</Label>
                <Select value={subForm.status || 'ativo'} onValueChange={v => setSubForm((f: any) => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{SUB_STATUS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
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
              <div><Label>{subForm.includes_vat ? 'Valor c/ IVA (€)' : 'Valor (€)'}</Label><Input type="number" step="0.01" value={subForm.value || ''} onChange={e => setSubForm((f: any) => ({ ...f, value: e.target.value }))} /></div>
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
            {subForm.value && parseFloat(subForm.value) > 0 && (subForm.vat_rate ?? 0) > 0 && (
              <p className="text-xs text-muted-foreground">
                {subForm.includes_vat
                  ? `Base: ${(parseFloat(subForm.value) / (1 + (subForm.vat_rate ?? 0) / 100)).toFixed(2)} € · IVA: ${(parseFloat(subForm.value) - parseFloat(subForm.value) / (1 + (subForm.vat_rate ?? 0) / 100)).toFixed(2)} €`
                  : `Total c/ IVA: ${(parseFloat(subForm.value) * (1 + (subForm.vat_rate ?? 0) / 100)).toFixed(2)} € · IVA: ${(parseFloat(subForm.value) * (subForm.vat_rate ?? 0) / 100).toFixed(2)} €`
                }
              </p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div><Label>NIF da Plataforma</Label><Input value={subForm.nif || ''} onChange={e => setSubForm((f: any) => ({ ...f, nif: e.target.value }))} placeholder="Ex: 123456789" /></div>
              <div><Label>País</Label>
                <Select value={subForm.location || 'portugal'} onValueChange={v => {
                  const countryMap: Record<string, string> = { portugal: 'Portugal', ue: 'União Europeia', fora_ue: 'Fora da UE' };
                  setSubForm((f: any) => ({ ...f, location: v, country: countryMap[v] || '' }));
                }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{LOCATIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Notas</Label><Input value={subForm.notes || ''} onChange={e => setSubForm((f: any) => ({ ...f, notes: e.target.value }))} /></div>
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
