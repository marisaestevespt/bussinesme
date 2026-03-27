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
import { Plus, Trash2, RefreshCw } from 'lucide-react';
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

export default function FornecedoresPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({});

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
      };

      let supplierId = form.id;
      if (form.id) {
        await supabase.from('suppliers').update(record).eq('id', form.id);
      } else {
        const { data } = await supabase.from('suppliers').insert(record).select('id').single();
        supplierId = data?.id;
      }

      // Create linked recurring expense if toggled
      if (form.create_recurring && supplierId && form.recurring_value) {
        const base = parseFloat(form.recurring_value) || 0;
        const vat = form.default_vat_rate ?? 23;
        const total = Math.round(base * (1 + vat / 100) * 100) / 100;
        const periodicity = form.recurring_periodicity || 'mensal';
        const now = new Date();
        const date = now.toISOString().slice(0, 10);

        await supabase.from('financial_expenses').insert({
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
          payment_method: form.payment_method || null,
          expense_date: date,
          expense_month: now.getMonth() + 1,
          expense_quarter: Math.ceil((now.getMonth() + 1) / 3),
          expense_year: now.getFullYear(),
        } as any);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['suppliers-all'] });
      qc.invalidateQueries({ queryKey: ['suppliers-list'] });
      qc.invalidateQueries({ queryKey: ['suppliers-list-vat'] });
      qc.invalidateQueries({ queryKey: ['financial-expenses'] });
      toast.success('Fornecedor guardado');
      setOpen(false);
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('suppliers').delete().eq('id', id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['suppliers-all'] });
      qc.invalidateQueries({ queryKey: ['suppliers-list'] });
      toast.success('Fornecedor eliminado');
      setOpen(false);
    },
  });

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
                  <TableHead>Email</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>IBAN</TableHead>
                  <TableHead>Pagamento</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-right">Despesas</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {suppliers.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Sem fornecedores</TableCell></TableRow>
                ) : suppliers.map((s: any) => (
                  <TableRow key={s.id} className="cursor-pointer hover:bg-muted/50" onClick={() => { setForm({ ...s, create_recurring: false }); setOpen(true); }}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell className="text-muted-foreground">{s.nif || '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{s.email || '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{s.phone || '—'}</TableCell>
                    <TableCell className="text-muted-foreground font-mono text-xs">{s.iban || '—'}</TableCell>
                    <TableCell><Badge variant="outline">{PAYMENT_LABELS[s.payment_method as keyof typeof PAYMENT_LABELS] || s.payment_method || '—'}</Badge></TableCell>
                    <TableCell>{s.category || '—'}</TableCell>
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
              <div><Label>Taxa IVA padrão (%)</Label>
                <Select value={String(form.default_vat_rate ?? 23)} onValueChange={v => setForm((f: any) => ({ ...f, default_vat_rate: parseInt(v) }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[0, 6, 13, 23].map(v => <SelectItem key={v} value={String(v)}>{v}%</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Morada</Label><Input value={form.address || ''} onChange={e => setForm((f: any) => ({ ...f, address: e.target.value }))} /></div>
              <div><Label>Website</Label><Input value={form.website || ''} onChange={e => setForm((f: any) => ({ ...f, website: e.target.value }))} /></div>
              <div><Label>Notas</Label><Textarea value={form.notes || ''} onChange={e => setForm((f: any) => ({ ...f, notes: e.target.value }))} rows={3} /></div>

              {/* Recurring expense link */}
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
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label className="text-xs">Valor base (€)</Label><Input type="number" step="0.01" value={form.recurring_value || ''} onChange={e => setForm((f: any) => ({ ...f, recurring_value: e.target.value }))} /></div>
                      <div><Label className="text-xs">Periodicidade</Label>
                        <Select value={form.recurring_periodicity || 'mensal'} onValueChange={v => setForm((f: any) => ({ ...f, recurring_periodicity: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{PERIODICITIES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </div>
                    {form.recurring_value && parseFloat(form.recurring_value) > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Equivalente mensal: {fmt(calcMonthlyEquivalent(parseFloat(form.recurring_value), form.recurring_periodicity || 'mensal'))}
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
      </div>
    </AppLayout>
  );
}
