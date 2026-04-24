import { useState, useMemo } from 'react';
import { useSubscriptions, calcMonthlyEquivalent, type Subscription } from '@/hooks/useSubscriptions';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Repeat } from 'lucide-react';
import { formatEuro } from '@/lib/formatting';
import { useConfirm } from '@/components/ui/confirm-dialog';

const PERIODICITIES = [
  { value: 'semanal', label: 'Semanal' },
  { value: 'mensal', label: 'Mensal' },
  { value: 'bimestral', label: 'Bimestral' },
  { value: 'trimestral', label: 'Trimestral' },
  { value: 'semestral', label: 'Semestral' },
  { value: 'anual', label: 'Anual' },
];

const CATEGORIES = ['ferramentas', 'marketing', 'pessoal', 'escritorio', 'formacao', 'cloud', 'outro'];
const STATUSES = ['ativo', 'pausado', 'cancelado'];

const emptyForm: Partial<Subscription> = {
  platform_name: '',
  category: 'ferramentas',
  value: 0,
  periodicity: 'mensal',
  vat_rate: 23,
  includes_vat: false,
  status: 'ativo',
  location: 'portugal',
};

export function FinSubscricoes() {
  const { list, upsert, remove } = useSubscriptions();
  const subs = list.data || [];
  const confirm = useConfirm();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<Subscription>>(emptyForm);

  const totals = useMemo(() => {
    const active = subs.filter(s => s.status === 'ativo');
    const monthly = active.reduce((acc, s) => acc + Number(s.monthly_equivalent || 0), 0);
    return {
      count: active.length,
      monthly,
      yearly: monthly * 12,
    };
  }, [subs]);

  const handleSave = async () => {
    if (!form.platform_name?.trim()) return;
    await upsert.mutateAsync(form as any);
    setOpen(false);
    setForm(emptyForm);
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm({ title: 'Eliminar subscrição?', description: 'Esta ação não pode ser desfeita.' });
    if (ok) remove.mutate(id);
  };

  const previewMonthly = calcMonthlyEquivalent(Number(form.value || 0), form.periodicity || 'mensal');

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Subscrições ativas</div>
          <div className="text-2xl font-semibold mt-1">{totals.count}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Custo mensal estimado</div>
          <div className="text-2xl font-semibold mt-1">{formatEuro(totals.monthly)}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Custo anual estimado</div>
          <div className="text-2xl font-semibold mt-1">{formatEuro(totals.yearly)}</div>
        </CardContent></Card>
      </div>

      <div className="flex justify-end">
        <Button size="sm" onClick={() => { setForm(emptyForm); setOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Nova Subscrição
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plataforma</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Periodicidade</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="text-right">Mensal</TableHead>
                <TableHead>Renovação</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subs.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-12">
                  <Repeat className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  Sem subscrições registadas
                </TableCell></TableRow>
              ) : subs.map(s => (
                <TableRow key={s.id} className="cursor-pointer hover:bg-muted/50" onClick={() => { setForm(s); setOpen(true); }}>
                  <TableCell className="font-medium">{s.platform_name}</TableCell>
                  <TableCell><Badge variant="outline">{s.category}</Badge></TableCell>
                  <TableCell className="capitalize text-muted-foreground">{s.periodicity}</TableCell>
                  <TableCell className="text-right">{formatEuro(Number(s.value))}</TableCell>
                  <TableCell className="text-right font-medium">{formatEuro(Number(s.monthly_equivalent))}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{s.renewal_date || '—'}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={
                      s.status === 'ativo' ? 'bg-success/10 text-success' :
                      s.status === 'pausado' ? 'bg-warning/10 text-warning' :
                      'bg-muted text-muted-foreground'
                    }>{s.status}</Badge>
                  </TableCell>
                  <TableCell onClick={e => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(s.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.id ? 'Editar Subscrição' : 'Nova Subscrição'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div><Label>Plataforma *</Label>
              <Input value={form.platform_name || ''} onChange={e => setForm(f => ({ ...f, platform_name: e.target.value }))} placeholder="Ex: Notion, Figma, ChatGPT..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Categoria</Label>
                <Select value={form.category || 'outro'} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Status</Label>
                <Select value={form.status || 'ativo'} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Valor (€)</Label>
                <Input type="number" step="0.01" value={form.value ?? ''} onChange={e => setForm(f => ({ ...f, value: parseFloat(e.target.value) || 0 }))} />
              </div>
              <div><Label>Periodicidade</Label>
                <Select value={form.periodicity || 'mensal'} onValueChange={v => setForm(f => ({ ...f, periodicity: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PERIODICITIES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>IVA (%)</Label>
                <Select value={String(form.vat_rate ?? 23)} onValueChange={v => setForm(f => ({ ...f, vat_rate: parseInt(v) }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{[0, 6, 13, 23].map(v => <SelectItem key={v} value={String(v)}>{v}%</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="rounded-md bg-muted/40 p-3 text-sm">
              Equivalente mensal: <strong>{formatEuro(previewMonthly)}</strong> · Anual estimado: <strong>{formatEuro(previewMonthly * 12)}</strong>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Início</Label>
                <Input type="date" value={form.start_date || ''} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
              </div>
              <div><Label>Próxima renovação</Label>
                <Input type="date" value={form.renewal_date || ''} onChange={e => setForm(f => ({ ...f, renewal_date: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>NIF</Label><Input value={form.nif || ''} onChange={e => setForm(f => ({ ...f, nif: e.target.value }))} /></div>
              <div><Label>País</Label><Input value={form.country || ''} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} /></div>
            </div>
            <div><Label>Notas</Label>
              <Textarea value={form.notes || ''} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.platform_name?.trim() || upsert.isPending}>
              {form.id ? 'Atualizar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}