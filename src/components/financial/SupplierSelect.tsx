import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import type { SupplierSelectOption, SupplierFormState } from './types';

const PAYMENT_METHODS = [
  { value: 'transferencia', label: 'Transferência' },
  { value: 'debito_direto', label: 'Débito Direto' },
  { value: 'mbway', label: 'MB Way' },
  { value: 'plataforma', label: 'Plataforma' },
  { value: 'cartao', label: 'Cartão' },
  { value: 'outro', label: 'Outro' },
];

interface Props {
  value: string | null;
  onValueChange: (v: string | null, supplier?: SupplierSelectOption) => void;
}

export function SupplierSelect({ value, onValueChange }: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<SupplierFormState>({});

  const { data: suppliers = [] } = useQuery<SupplierSelectOption[]>({
    queryKey: ['suppliers-list'],
    queryFn: async () => {
      const { data } = await supabase
        .from('suppliers')
        .select('id, name, nif, default_vat_rate, payment_method, iban, email, phone, address, website, notes, category')
        .eq('is_active', true)
        .order('name');
      return (data || []) as SupplierSelectOption[];
    },
  });

  const resetForm = () => setForm({ payment_method: 'transferencia', default_vat_rate: 23, is_active: true });

  const create = useMutation({
    mutationFn: async () => {
      if (!form.name?.trim()) return null;
      const record = {
        name: form.name.trim(),
        nif: form.nif || null,
        email: form.email || null,
        phone: form.phone || null,
        address: form.address || null,
        website: form.website || null,
        iban: form.iban || null,
        payment_method: form.payment_method || 'transferencia',
        category: form.category || 'outro',
        notes: form.notes || null,
        is_active: true,
        default_vat_rate: form.default_vat_rate ?? 23,
      };
      const { data, error } = await supabase
        .from('suppliers')
        .insert(record)
        .select('id, name, nif, default_vat_rate, payment_method')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data) {
        qc.invalidateQueries({ queryKey: ['suppliers-list'] });
        qc.invalidateQueries({ queryKey: ['suppliers-all'] });
        qc.invalidateQueries({ queryKey: ['suppliers-list-vat'] });
        onValueChange(data.id, data as SupplierSelectOption);
        toast.success('Fornecedor criado');
        setOpen(false);
        resetForm();
      }
    },
    onError: () => toast.error('Erro ao criar fornecedor'),
  });

  return (
    <div className="flex gap-2">
      <Select value={value || '__none__'} onValueChange={v => {
        if (v === '__none__') {
          onValueChange(null);
        } else {
          const supplier = suppliers.find(s => s.id === v);
          onValueChange(v, supplier);
        }
      }}>
        <SelectTrigger className="flex-1">
          <SelectValue placeholder="Sem fornecedor" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">Sem fornecedor</SelectItem>
          {suppliers.map(s => (
            <SelectItem key={s.id} value={s.id}>
              {s.name}{s.nif ? ` (${s.nif})` : ''}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button type="button" variant="outline" aria-label="Adicionar" size="icon" className="shrink-0" onClick={() => { resetForm(); setOpen(true); }}>
        <Plus className="h-4 w-4" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Novo Fornecedor</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome *</Label><Input value={form.name || ''} onChange={e => setForm((f: any) => ({ ...f, name: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>NIF</Label><Input value={form.nif || ''} onChange={e => setForm((f: any) => ({ ...f, nif: e.target.value }))} /></div>
              <div><Label>Telefone</Label><Input value={form.phone || ''} onChange={e => setForm((f: any) => ({ ...f, phone: e.target.value }))} /></div>
            </div>
            <div><Label>Email</Label><Input value={form.email || ''} onChange={e => setForm((f: any) => ({ ...f, email: e.target.value }))} /></div>
            <div><Label>IBAN</Label><Input value={form.iban || ''} onChange={e => setForm((f: any) => ({ ...f, iban: e.target.value }))} placeholder="PT50..." /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Método Pagamento</Label>
                <Select value={form.payment_method || 'transferencia'} onValueChange={v => setForm((f: any) => ({ ...f, payment_method: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PAYMENT_METHODS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>IVA padrão</Label>
                <Select value={String(form.default_vat_rate ?? 23)} onValueChange={v => setForm((f: any) => ({ ...f, default_vat_rate: parseInt(v) }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{[0, 6, 13, 23].map(v => <SelectItem key={v} value={String(v)}>{v}%</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Morada</Label><Input value={form.address || ''} onChange={e => setForm((f: any) => ({ ...f, address: e.target.value }))} /></div>
            <div><Label>Website</Label><Input value={form.website || ''} onChange={e => setForm((f: any) => ({ ...f, website: e.target.value }))} /></div>
            <div><Label>Notas</Label><Textarea value={form.notes || ''} onChange={e => setForm((f: any) => ({ ...f, notes: e.target.value }))} rows={2} /></div>
            <Button className="w-full" onClick={() => create.mutate()} disabled={!form.name?.trim()}>Criar Fornecedor</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
