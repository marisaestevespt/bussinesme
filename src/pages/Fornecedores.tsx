import { useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { BackNavigation } from '@/components/BackNavigation';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Trash2, RefreshCw, CalendarClock } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const PAYMENT_METHODS = [
  { value: 'transferencia', label: 'Transferência' },
  { value: 'debito_direto', label: 'Débito Direto' },
  { value: 'mbway', label: 'MB Way' },
  { value: 'plataforma', label: 'Plataforma' },
  { value: 'cartao', label: 'Cartão' },
  { value: 'outro', label: 'Outro' },
];
const PAYMENT_LABELS = Object.fromEntries(PAYMENT_METHODS.map(m => [m.value, m.label]));

const PERIODICITIES = [
  { value: 'semanal', label: 'Semanal' },
  { value: 'mensal', label: 'Mensal' },
  { value: 'bimestral', label: 'Bimestral' },
  { value: 'trimestral', label: 'Trimestral' },
  { value: 'semestral', label: 'Semestral' },
  { value: 'anual', label: 'Anual' },
];

const calcMonthlyEquivalent = (base: number, periodicity: string) => {
  const map: Record<string, number> = { semanal: 52/12, mensal: 1, bimestral: 1/2, trimestral: 1/3, semestral: 1/6, anual: 1/12 };
  return Math.round(base * (map[periodicity] || 1) * 100) / 100;
};

const fmt = (v: number) => v.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

/**
 * Returns future billing dates between contract start and end.
 * Only generates dates from today forward using the billing day.
 * If includeCatchUp is true, adds a single entry for today as a catch-up.
 */
function getFutureBillingDates(
  startDate: string,
  endDate: string,
  periodicity: string,
  billingDay: number,
  includeCatchUp: boolean = false,
  catchUpDateStr?: string,
): { month: number; year: number; day: number; isCatchUp?: boolean }[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');
  const results: { month: number; year: number; day: number; isCatchUp?: boolean }[] = [];
  const safeDay = Math.min(billingDay, 28);

  const periodMonths: Record<string, number> = {
    semanal: 1, mensal: 1, bimestral: 2, trimestral: 3, semestral: 6, anual: 12,
  };
  const step = periodMonths[periodicity] || 1;

  // If catch-up requested, add a single entry with the chosen date
  if (includeCatchUp) {
    const cuDate = catchUpDateStr ? new Date(catchUpDateStr + 'T00:00:00') : today;
    results.push({ month: cuDate.getMonth() + 1, year: cuDate.getFullYear(), day: cuDate.getDate(), isCatchUp: true });
  }

  // Start from the first billing cycle date
  let cursor = new Date(start.getFullYear(), start.getMonth(), safeDay);
  // If the contract starts after the billing day, push to next cycle
  if (start.getDate() > safeDay) {
    cursor.setMonth(cursor.getMonth() + step);
  }

  // Skip past cycles — advance cursor to today or later
  while (cursor < today && cursor <= end) {
    cursor.setMonth(cursor.getMonth() + step);
  }

  // Generate future entries
  while (cursor <= end) {
    results.push({ month: cursor.getMonth() + 1, year: cursor.getFullYear(), day: safeDay });
    cursor.setMonth(cursor.getMonth() + step);
  }

  return results;
}

/** Count for preview display */
function countFutureOccurrences(startDate: string, endDate: string, periodicity: string, billingDay: number, includeCatchUp: boolean, catchUpDate?: string): number {
  return getFutureBillingDates(startDate, endDate, periodicity, billingDay, includeCatchUp, catchUpDate).length;
  return getFutureBillingDates(startDate, endDate, periodicity, billingDay, includeCatchUp).length;
}

/** Generate individual expense rows for future billing dates */
async function generateExpensesForPeriod(
  supplierId: string,
  name: string,
  baseValue: number,
  vatRate: number,
  periodicity: string,
  paymentMethod: string | null,
  category: string,
  recurrenceDay: number | null,
  startDate: string,
  endDate: string,
  parentExpenseId: string,
  includeCatchUp: boolean = false,
  catchUpDate?: string,
) {
  const billingDay = recurrenceDay || 1;
  const dates = getFutureBillingDates(startDate, endDate, periodicity, billingDay, includeCatchUp, catchUpDate);
  const valuePerOccurrence = periodicity === 'semanal' ? Math.round(baseValue * (52/12) * 100) / 100 : baseValue;
  const total = Math.round(valuePerOccurrence * (1 + vatRate / 100) * 100) / 100;

  const rows = dates.map(o => ({
    description: name,
    expense_name: name,
    supplier_id: supplierId,
    base_value: valuePerOccurrence,
    vat_rate: vatRate,
    total_with_vat: total,
    category,
    status: (o.isCatchUp ? 'pago' : 'por_pagar') as string,
    location: 'portugal',
    is_recurring: false,
    parent_expense_id: parentExpenseId,
    payment_method: paymentMethod,
    expense_date: `${o.year}-${String(o.month).padStart(2, '0')}-${String(o.day).padStart(2, '0')}`,
    expense_month: o.month,
    expense_quarter: Math.ceil(o.month / 3),
    expense_year: o.year,
    source_type: 'recurring',
  }));

  if (rows.length > 0) {
    const { error } = await supabase.from('financial_expenses').insert(rows as any);
    if (error) throw error;
  }
  return rows.length;
}

export default function FornecedoresPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({});
  const [renewDialog, setRenewDialog] = useState(false);
  const [renewForm, setRenewForm] = useState<any>({});

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers-all'],
    queryFn: async () => {
      const { data } = await supabase.from('suppliers').select('*').order('name');
      return data || [];
    },
  });

  const { data: expenseCounts = {} } = useQuery({
    queryKey: ['supplier-expense-counts'],
    queryFn: async () => {
      const { data } = await supabase
        .from('financial_expenses')
        .select('supplier_id')
        .not('supplier_id', 'is', null);
      const counts: Record<string, number> = {};
      (data || []).forEach((e: any) => {
        counts[e.supplier_id] = (counts[e.supplier_id] || 0) + 1;
      });
      return counts;
    },
  });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ['suppliers-all'] });
    qc.invalidateQueries({ queryKey: ['suppliers-list'] });
    qc.invalidateQueries({ queryKey: ['suppliers-list-vat'] });
    qc.invalidateQueries({ queryKey: ['financial-expenses'] });
    qc.invalidateQueries({ queryKey: ['recurring-expenses'] });
    qc.invalidateQueries({ queryKey: ['supplier-expense-counts'] });
  };

  const upsert = useMutation({
    mutationFn: async () => {
      if (!form.name?.trim()) return;
      const record = {
        name: form.name,
        nif: form.nif || null,
        email: form.email || null,
        phone: form.phone || null,
        address: form.address || null,
        website: form.website || null,
        iban: form.iban || null,
        payment_method: form.payment_method || 'transferencia',
        category: form.category || 'outro',
        notes: form.notes || null,
        is_active: form.is_active ?? true,
        default_vat_rate: form.default_vat_rate ?? 23,
        contract_start_date: form.contract_start_date || null,
        contract_end_date: form.contract_end_date || null,
      };

      let supplierId = form.id;
      if (form.id) {
        await supabase.from('suppliers').update(record as any).eq('id', form.id);
      } else {
        const { data } = await supabase.from('suppliers').insert(record as any).select('id').single();
        supplierId = data?.id;
      }

      // Create recurring expense rule + generate individual monthly expenses
      if (form.create_recurring && supplierId && form.recurring_value && form.contract_start_date && form.contract_end_date) {
        const base = parseFloat(form.recurring_value) || 0;
        const vat = form.default_vat_rate ?? 23;
        const total = Math.round(base * (1 + vat / 100) * 100) / 100;
        const periodicity = form.recurring_periodicity || 'mensal';
        const startDate = form.contract_start_date;

        // Create parent recurring expense (the rule)
        const { data: parentData, error: parentErr } = await supabase.from('financial_expenses').insert({
          description: form.name,
          expense_name: form.name,
          supplier_id: supplierId,
          base_value: base,
          vat_rate: vat,
          total_with_vat: total,
          category: form.category || 'outro',
          status: 'por_pagar',
          location: 'portugal',
          is_recurring: true,
          periodicity,
          monthly_equivalent: calcMonthlyEquivalent(base, periodicity),
          recurrence_day: form.recurring_day || null,
          payment_method: form.payment_method || null,
          expense_date: startDate,
          expense_month: new Date(startDate + 'T00:00:00').getMonth() + 1,
          expense_quarter: Math.ceil((new Date(startDate + 'T00:00:00').getMonth() + 1) / 3),
          expense_year: new Date(startDate + 'T00:00:00').getFullYear(),
          recurrence_end_date: form.contract_end_date,
        } as any).select('id').single();
        if (parentErr) throw parentErr;

        // Generate individual expenses for each month
        const count = await generateExpensesForPeriod(
          supplierId, form.name, base, vat, periodicity,
          form.payment_method || null, form.category || 'outro',
          form.recurring_day || null, startDate, form.contract_end_date,
          parentData.id, form.include_catchup || false, form.catchup_date
        );
        toast.success(`${count} despesas geradas`);
      }
    },
    onSuccess: () => {
      invalidateAll();
      toast.success('Fornecedor guardado');
      setOpen(false);
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('suppliers').delete().eq('id', id);
    },
    onSuccess: () => {
      invalidateAll();
      toast.success('Fornecedor eliminado');
      setOpen(false);
    },
  });

  // Renewal mutation
  const renewContract = useMutation({
    mutationFn: async () => {
      const supplierId = renewForm.supplier_id;
      const newEnd = renewForm.new_end_date;
      if (!supplierId || !newEnd) return;

      // Get existing recurring expense (parent)
      const { data: parentExpenses } = await supabase.from('financial_expenses')
        .select('*')
        .eq('supplier_id', supplierId)
        .eq('is_recurring', true)
        .limit(1);
      
      const parent = parentExpenses?.[0];
      if (!parent) { toast.error('Sem despesa recorrente associada'); return; }

      // Old end date = new start for generating expenses
      const oldEnd = renewForm.old_end_date;
      const generationStart = new Date(oldEnd + 'T00:00:00');
      generationStart.setMonth(generationStart.getMonth() + 1);
      const genStartStr = generationStart.toISOString().slice(0, 10);

      // Update parent expense end date
      await supabase.from('financial_expenses')
        .update({ recurrence_end_date: newEnd } as any)
        .eq('id', parent.id);

      // Update supplier contract dates
      const history = Array.isArray(renewForm.renewal_history) ? renewForm.renewal_history : [];
      history.push({
        date: new Date().toISOString().slice(0, 10),
        old_end: oldEnd,
        new_end: newEnd,
        notes: renewForm.renewal_notes || '',
      });

      await supabase.from('suppliers').update({
        contract_end_date: newEnd,
        last_renewal_date: new Date().toISOString().slice(0, 10),
        renewal_history: history,
      } as any).eq('id', supplierId);

      // Generate new expenses
      const count = await generateExpensesForPeriod(
        supplierId,
        parent.expense_name || parent.description || '',
        Number(parent.base_value),
        Number(parent.vat_rate),
        parent.periodicity || 'mensal',
        parent.payment_method,
        parent.category,
        parent.recurrence_day,
        genStartStr,
        newEnd,
        parent.id
      );
      toast.success(`Contrato renovado — ${count} novas despesas geradas`);
    },
    onSuccess: () => {
      invalidateAll();
      setRenewDialog(false);
      setOpen(false);
    },
  });

  const openRenewalDialog = () => {
    setRenewForm({
      supplier_id: form.id,
      old_end_date: form.contract_end_date || '',
      new_end_date: '',
      renewal_notes: '',
      renewal_history: form.renewal_history || [],
    });
    setRenewDialog(true);
  };

  return (
    <AppLayout>
      <div className="p-6 space-y-4">
        <BackNavigation />
        <PageHeader title="Fornecedores" />
        <div className="flex justify-end">
          <Button size="sm" onClick={() => { setForm({ is_active: true, payment_method: 'transferencia', default_vat_rate: 23 }); setOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Novo Fornecedor
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>NIF</TableHead>
                  <TableHead>Pagamento</TableHead>
                  <TableHead>Contrato</TableHead>
                  <TableHead className="text-right">Despesas</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {suppliers.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Sem fornecedores</TableCell></TableRow>
                ) : suppliers.map((s: any) => (
                  <TableRow key={s.id} className="cursor-pointer hover:bg-muted/50" onClick={() => { setForm({ ...s, create_recurring: false }); setOpen(true); }}>
                    <TableCell>
                      <div className="font-medium">{s.name}</div>
                      {s.nif && <div className="text-xs text-muted-foreground">{s.nif}</div>}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{s.nif || '—'}</TableCell>
                    <TableCell><Badge variant="outline">{PAYMENT_LABELS[s.payment_method as keyof typeof PAYMENT_LABELS] || s.payment_method || '—'}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {s.contract_start_date && s.contract_end_date 
                        ? `${s.contract_start_date} → ${s.contract_end_date}`
                        : '—'}
                    </TableCell>
                    <TableCell className="text-right">{(expenseCounts as any)[s.id] || 0}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={s.is_active ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}>
                        {s.is_active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent className="sm:max-w-md overflow-y-auto">
            <SheetHeader>
              <SheetTitle>{form.id ? 'Editar Fornecedor' : 'Novo Fornecedor'}</SheetTitle>
            </SheetHeader>
            <div className="space-y-4 mt-6">
              <div><Label>Nome *</Label><Input value={form.name || ''} onChange={e => setForm((f: any) => ({ ...f, name: e.target.value }))} /></div>
              <div><Label>NIF</Label><Input value={form.nif || ''} onChange={e => setForm((f: any) => ({ ...f, nif: e.target.value }))} /></div>
              <div><Label>Email</Label><Input value={form.email || ''} onChange={e => setForm((f: any) => ({ ...f, email: e.target.value }))} /></div>
              <div><Label>Telefone</Label><Input value={form.phone || ''} onChange={e => setForm((f: any) => ({ ...f, phone: e.target.value }))} /></div>
              <div><Label>IBAN</Label><Input value={form.iban || ''} onChange={e => setForm((f: any) => ({ ...f, iban: e.target.value }))} placeholder="PT50..." /></div>
              <div><Label>Método de Pagamento</Label>
                <Select value={form.payment_method || 'transferencia'} onValueChange={v => setForm((f: any) => ({ ...f, payment_method: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PAYMENT_METHODS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Categoria</Label>
                <Select value={form.category || 'outro'} onValueChange={v => setForm((f: any) => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['ferramentas', 'marketing', 'pessoal', 'escritorio', 'freelancer', 'formacao', 'viagens', 'outro'].map(c => (
                      <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Taxa IVA padrão (%)</Label>
                <Select value={String(form.default_vat_rate ?? 23)} onValueChange={v => setForm((f: any) => ({ ...f, default_vat_rate: parseInt(v) }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[0, 6, 13, 23].map(v => <SelectItem key={v} value={String(v)}>{v}%</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Contract dates */}
              <div className="rounded-lg border border-border p-3 space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <CalendarClock className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-medium">Contrato</Label>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-xs">Início</Label><Input type="date" value={form.contract_start_date || ''} onChange={e => setForm((f: any) => ({ ...f, contract_start_date: e.target.value }))} /></div>
                  <div><Label className="text-xs">Fim</Label><Input type="date" value={form.contract_end_date || ''} onChange={e => setForm((f: any) => ({ ...f, contract_end_date: e.target.value }))} /></div>
                </div>
                {form.id && form.contract_end_date && (
                  <Button type="button" variant="outline" size="sm" className="w-full" onClick={openRenewalDialog}>
                    <RefreshCw className="h-3.5 w-3.5 mr-1" /> Renovar Contrato
                  </Button>
                )}
                {form.last_renewal_date && (
                  <p className="text-xs text-muted-foreground">Última renovação: {form.last_renewal_date}</p>
                )}
              </div>

              <div><Label>Morada</Label><Input value={form.address || ''} onChange={e => setForm((f: any) => ({ ...f, address: e.target.value }))} /></div>
              <div><Label>Website</Label><Input value={form.website || ''} onChange={e => setForm((f: any) => ({ ...f, website: e.target.value }))} /></div>
              <div><Label>Notas</Label><Textarea value={form.notes || ''} onChange={e => setForm((f: any) => ({ ...f, notes: e.target.value }))} rows={3} /></div>

              {/* Recurring expense link — only for new suppliers or ones without existing recurring */}
              <div className="rounded-lg border border-border p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <RefreshCw className="h-4 w-4 text-muted-foreground" />
                    <Label className="text-sm font-normal">Criar despesa recorrente</Label>
                  </div>
                  <Switch checked={form.create_recurring || false} onCheckedChange={v => setForm((f: any) => ({ ...f, create_recurring: v }))} />
                </div>
                {form.create_recurring && (
                  <div className="space-y-3">
                    {!form.contract_start_date || !form.contract_end_date ? (
                      <p className="text-xs text-amber-600">⚠️ Define as datas do contrato acima para gerar despesas</p>
                    ) : null}
                    <div className="grid grid-cols-3 gap-3">
                      <div><Label className="text-xs">Valor base (€)</Label><Input type="number" step="0.01" value={form.recurring_value || ''} onChange={e => setForm((f: any) => ({ ...f, recurring_value: e.target.value }))} /></div>
                      <div><Label className="text-xs">Periodicidade</Label>
                        <Select value={form.recurring_periodicity || 'mensal'} onValueChange={v => setForm((f: any) => ({ ...f, recurring_periodicity: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{PERIODICITIES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div><Label className="text-xs">Dia pagamento</Label>
                        <Select value={String(form.recurring_day || '')} onValueChange={v => setForm((f: any) => ({ ...f, recurring_day: v ? parseInt(v) : null }))}>
                          <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                              <SelectItem key={d} value={String(d)}>Dia {d}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    {form.recurring_value && parseFloat(form.recurring_value) > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Equivalente mensal: {fmt(calcMonthlyEquivalent(parseFloat(form.recurring_value), form.recurring_periodicity || 'mensal'))}
                      </p>
                    )}
                    {/* Catch-up toggle + date */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Switch checked={form.include_catchup || false} onCheckedChange={v => setForm((f: any) => ({ ...f, include_catchup: v, catchup_date: v ? new Date().toISOString().slice(0, 10) : '' }))} />
                        <Label className="text-xs font-normal">Incluir entrada avulsa (marcada como paga)</Label>
                      </div>
                      {form.include_catchup && (
                        <div className="pl-8">
                          <Label className="text-xs">Data da entrada</Label>
                          <Input type="date" value={form.catchup_date || new Date().toISOString().slice(0, 10)} onChange={e => setForm((f: any) => ({ ...f, catchup_date: e.target.value }))} />
                        </div>
                      )}
                    </div>
                    {form.contract_start_date && form.contract_end_date && form.recurring_value && (
                      <p className="text-xs text-muted-foreground">
                        Serão geradas {countFutureOccurrences(form.contract_start_date, form.contract_end_date, form.recurring_periodicity || 'mensal', form.recurring_day || 1, form.include_catchup || false, form.catchup_date)} despesas
                        {form.include_catchup ? ` (1 entrada em ${form.catchup_date || 'hoje'} + futuras)` : ' (apenas futuras)'}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Documents */}
              <div className="space-y-2">
                <Label>Documentos / Contratos</Label>
                {form.documents && Array.isArray(form.documents) && form.documents.length > 0 && (
                  <div className="space-y-1">
                    {form.documents.map((doc: any, i: number) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <a href={doc.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate flex-1">{doc.name}</a>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => {
                          setForm((f: any) => ({ ...f, documents: (f.documents || []).filter((_: any, idx: number) => idx !== i) }));
                        }}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                      </div>
                    ))}
                  </div>
                )}
                <Input
                  type="file"
                  className="text-xs"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const path = `suppliers/${form.id || 'new'}/${Date.now()}_${file.name}`;
                    const { error: uploadErr } = await supabase.storage.from('financial-files').upload(path, file);
                    if (uploadErr) { toast.error('Erro ao carregar ficheiro'); return; }
                    const { data: urlData } = supabase.storage.from('financial-files').getPublicUrl(path);
                    const docs = Array.isArray(form.documents) ? form.documents : [];
                    setForm((f: any) => ({ ...f, documents: [...docs, { name: file.name, url: urlData.publicUrl }] }));
                    toast.success('Ficheiro carregado!');
                  }}
                />
              </div>

              {/* Renewal history */}
              {form.renewal_history && Array.isArray(form.renewal_history) && form.renewal_history.length > 0 && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Histórico de renovações</Label>
                  {form.renewal_history.map((r: any, i: number) => (
                    <div key={i} className="text-xs text-muted-foreground border-l-2 border-border pl-2">
                      {r.date}: {r.old_end} → {r.new_end} {r.notes && `— ${r.notes}`}
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <Button className="flex-1" onClick={() => upsert.mutate()} disabled={!form.name?.trim()}>Guardar</Button>
                {form.id && (
                  <Button variant="destructive" size="icon" onClick={() => remove.mutate(form.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </SheetContent>
        </Sheet>

        {/* Renewal dialog */}
        <Dialog open={renewDialog} onOpenChange={setRenewDialog}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Renovar Contrato</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Contrato atual termina a <strong>{renewForm.old_end_date}</strong>. Define a nova data de fim para gerar as despesas do novo período.
              </p>
              <div>
                <Label>Nova data de fim</Label>
                <Input type="date" value={renewForm.new_end_date || ''} onChange={e => setRenewForm((f: any) => ({ ...f, new_end_date: e.target.value }))} />
              </div>
              <div>
                <Label>Notas (opcional)</Label>
                <Input value={renewForm.renewal_notes || ''} onChange={e => setRenewForm((f: any) => ({ ...f, renewal_notes: e.target.value }))} placeholder="Ex: renovado por mais 12 meses" />
              </div>
              {renewForm.new_end_date && renewForm.old_end_date && (
                <p className="text-xs text-muted-foreground">
                  Novas despesas serão geradas de {renewForm.old_end_date} até {renewForm.new_end_date}
                </p>
              )}
              <Button className="w-full" onClick={() => renewContract.mutate()} disabled={!renewForm.new_end_date}>
                <RefreshCw className="h-4 w-4 mr-1" /> Confirmar Renovação
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
