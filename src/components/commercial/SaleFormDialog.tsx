import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const STATUS_OPTIONS = [
  { value: 'na', label: 'N.A.' },
  { value: 'fatura_emitida', label: 'Fatura Emitida' },
  { value: 'pagamento_ok', label: 'Pagamento OK' },
  { value: 'recibo_enviado', label: 'Recibo Enviado' },
  { value: 'contabilidade_ok', label: 'Contabilidade OK' },
];

const SOURCE_OPTIONS = ['Instagram', 'Sessão de Diagnóstico', 'Recomendação', 'Orgânico', 'Outro'];

interface SaleFormDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  products: string[];
  onSave: (sale: any) => void;
  initialData?: any;
}

export function SaleFormDialog({ open, onOpenChange, products, onSave, initialData }: SaleFormDialogProps) {
  const [form, setForm] = useState({
    id: '',
    sale_id: '',
    status: 'na',
    payment_date: undefined as Date | undefined,
    description: '',
    base_value: '',
    invoice_total: '',
    product: '',
    client: '',
    source: '',
    documents: '',
  });

  useEffect(() => {
    if (initialData) {
      setForm({
        id: initialData.id || '',
        sale_id: initialData.sale_id || '',
        status: initialData.status || 'na',
        payment_date: initialData.payment_date ? new Date(initialData.payment_date) : undefined,
        description: initialData.description || '',
        base_value: initialData.base_value?.toString() || '',
        invoice_total: initialData.invoice_total?.toString() || '',
        product: initialData.product || '',
        client: initialData.client || '',
        source: initialData.source || '',
        documents: initialData.documents || '',
      });
    } else {
      setForm({ id: '', sale_id: '', status: 'na', payment_date: undefined, description: '', base_value: '', invoice_total: '', product: '', client: '', source: '', documents: '' });
    }
  }, [initialData, open]);

  const handleSave = () => {
    onSave({
      ...(form.id ? { id: form.id } : {}),
      ...(form.sale_id ? { sale_id: form.sale_id } : {}),
      status: form.status,
      payment_date: form.payment_date ? format(form.payment_date, 'yyyy-MM-dd') : null,
      description: form.description,
      base_value: parseFloat(form.base_value) || 0,
      invoice_total: parseFloat(form.invoice_total) || 0,
      product: form.product || null,
      client: form.client || null,
      source: form.source || null,
      documents: form.documents || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{form.id ? 'Editar Venda' : 'Nova Venda'}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          {form.sale_id && (
            <div>
              <Label>ID</Label>
              <Input value={form.sale_id} onChange={e => setForm(f => ({ ...f, sale_id: e.target.value }))} />
            </div>
          )}
          <div>
            <Label>Status</Label>
            <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{STATUS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Data de Pagamento</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !form.payment_date && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {form.payment_date ? format(form.payment_date, 'dd/MM/yyyy') : 'Selecionar data'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={form.payment_date} onSelect={d => setForm(f => ({ ...f, payment_date: d }))} className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>
          <div>
            <Label>Descrição</Label>
            <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Valor Base (€)</Label><Input type="number" step="0.01" value={form.base_value} onChange={e => setForm(f => ({ ...f, base_value: e.target.value }))} /></div>
            <div><Label>Fatura Total (€)</Label><Input type="number" step="0.01" value={form.invoice_total} onChange={e => setForm(f => ({ ...f, invoice_total: e.target.value }))} /></div>
          </div>
          <div>
            <Label>Produto</Label>
            <Select value={form.product} onValueChange={v => setForm(f => ({ ...f, product: v }))}>
              <SelectTrigger><SelectValue placeholder="Selecionar produto" /></SelectTrigger>
              <SelectContent>
                {products.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                {products.length === 0 && <SelectItem value="_none" disabled>Sem produtos definidos</SelectItem>}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Cliente</Label><Input value={form.client} onChange={e => setForm(f => ({ ...f, client: e.target.value }))} /></div>
          <div>
            <Label>Fonte da Venda</Label>
            <Select value={form.source} onValueChange={v => setForm(f => ({ ...f, source: v }))}>
              <SelectTrigger><SelectValue placeholder="Selecionar fonte" /></SelectTrigger>
              <SelectContent>{SOURCE_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Documentos (link)</Label><Input value={form.documents} onChange={e => setForm(f => ({ ...f, documents: e.target.value }))} placeholder="https://..." /></div>
          <Button className="w-full" onClick={handleSave}>Guardar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
