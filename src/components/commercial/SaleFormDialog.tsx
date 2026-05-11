import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, User } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Switch } from '@/components/ui/switch';
import { ENTRY_STATUSES } from '@/components/financial/EntryDetailSheet';
import { InvoiceUpload, type DocEntry } from '@/components/financial/InvoiceUpload';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { SPECIAL_OFFER_REASONS } from '@/lib/salesConstants';


const STATUS_OPTIONS = ENTRY_STATUSES.map(s => ({ value: s.value, label: s.label }));

import { DEFAULT_SALE_SOURCES, buildSaleSourceOptions } from '@/lib/labelMaps';

interface SaleFormDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  products: string[];
  onSave: (sale: any) => void;
  initialData?: any;
}

export function SaleFormDialog({ open, onOpenChange, products, onSave, initialData }: SaleFormDialogProps) {
  const { settings } = useBusinessSettings();
  const ivaExempt = (settings as any)?.iva_exempt === true;
  const [form, setForm] = useState({
    id: '',
    sale_id: '',
    status: 'aguarda_pagamento',
    payment_date: undefined as Date | undefined,
    description: '',
    base_value: '',
    vat_rate: '' as string,
    invoice_total: '',
    product: '',
    client: '',
    source: '',
    documents: [] as DocEntry[],
    is_special_offer: false,
    special_offer_reason: '',
  });

  useEffect(() => {
    if (initialData) {
      const rawDocs = initialData.documents;
      setForm({
        id: initialData.id || '',
        sale_id: initialData.sale_id || '',
        status: initialData.status || 'aguarda_pagamento',
        payment_date: initialData.payment_date ? new Date(initialData.payment_date) : undefined,
        description: initialData.description || '',
        base_value: initialData.base_value?.toString() || '',
        vat_rate: initialData.vat_rate?.toString() || '',
        invoice_total: initialData.invoice_total?.toString() || '',
        product: initialData.product || '',
        client: initialData.client || '',
        source: initialData.source || '',
        documents: Array.isArray(rawDocs) ? rawDocs : [],
        is_special_offer: initialData.is_special_offer || false,
        special_offer_reason: initialData.special_offer_reason || '',
      });
    } else {
      setForm({ id: '', sale_id: '', status: 'aguarda_pagamento', payment_date: undefined, description: '', base_value: '', vat_rate: '', invoice_total: '', product: '', client: '', source: '', documents: [], is_special_offer: false, special_offer_reason: '' });
    }
  }, [initialData, open]);

  // Fetch clients list
  const clientsList = useQuery({
    queryKey: ['clients-list-names'],
    queryFn: async () => {
      const { data } = await supabase.from('clients').select('full_name').order('full_name');
      return (data || []).map(c => c.full_name);
    },
  });

  // Fetch client details by name
  const clientName = form.client;
  const clientInfo = useQuery({
    queryKey: ['client-by-name', clientName],
    queryFn: async () => {
      if (!clientName) return null;
      const { data } = await supabase.from('clients').select('full_name, nif, fiscal_address').eq('full_name', clientName).maybeSingle();
      return data;
    },
    enabled: !!clientName && open,
  });

  // Fetch product VAT rate
  const productName = form.product;
  const productInfo = useQuery({
    queryKey: ['product-vat', productName],
    queryFn: async () => {
      if (!productName) return null;
      const { data } = await supabase.from('products').select('vat_rate').eq('name', productName).maybeSingle();
      return data;
    },
    enabled: !!productName && open,
  });

  // Fetch custom sources from existing sales
  const customSources = useQuery({
    queryKey: ['sales-sources'],
    queryFn: async () => {
      const { data } = await supabase.from('commercial_sales').select('source');
      const unique = [...new Set((data || []).map(d => d.source).filter(Boolean))] as string[];
      return unique;
    },
  });
  const sourceOptions = buildSaleSourceOptions(customSources.data || []);

  const getEffectiveVatRate = () => {
    if (form.vat_rate !== '') return parseFloat(form.vat_rate) || 0;
    const rate = productInfo.data?.vat_rate;
    if (!rate || rate === 'isento') return 0;
    return parseFloat(rate) || 0;
  };

  // Auto-fill vat_rate from product when product changes
  useEffect(() => {
    if (productInfo.data?.vat_rate && !form.vat_rate) {
      const rate = productInfo.data.vat_rate === 'isento' ? '0' : productInfo.data.vat_rate;
      setForm(f => ({ ...f, vat_rate: rate }));
    }
  }, [productInfo.data?.vat_rate]);

  // Auto-calculate invoice_total when base_value or vat_rate changes
  useEffect(() => {
    if (form.base_value) {
      const base = parseFloat(form.base_value) || 0;
      const vat = ivaExempt ? 0 : getEffectiveVatRate();
      const total = Math.round(base * (1 + vat / 100) * 100) / 100;
      setForm(f => ({ ...f, invoice_total: total.toString() }));
    }
  }, [form.base_value, form.vat_rate, ivaExempt]);

  const handleSave = () => {
    if (!form.description?.trim()) { toast.error('Preenche a descrição'); return; }
    if (!form.base_value || parseFloat(form.base_value) <= 0) { toast.error('Valor base deve ser maior que 0'); return; }
    if (!form.client) { toast.error('Seleciona um cliente'); return; }
    if (!form.product) { toast.error('Seleciona um produto'); return; }

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
      documents: form.documents,
      is_special_offer: form.is_special_offer,
      special_offer_reason: form.is_special_offer ? form.special_offer_reason : null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{form.id ? 'Editar Venda' : 'Nova Venda'}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          {/* Client info card */}
          {clientInfo.data && (
            <div className="rounded-lg border border-border bg-muted/50 p-3 space-y-1">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <User className="h-4 w-4 text-muted-foreground" />
                Dados do Cliente
              </div>
              <div className="grid grid-cols-1 gap-1 text-sm text-muted-foreground">
                <span><strong className="text-foreground">Nome:</strong> {clientInfo.data.full_name}</span>
                <span><strong className="text-foreground">NIF:</strong> {clientInfo.data.nif || '—'}</span>
                <span><strong className="text-foreground">Morada Fiscal:</strong> {clientInfo.data.fiscal_address || '—'}</span>
              </div>
            </div>
          )}

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
          {ivaExempt ? (
            <div>
              <Label>Valor da Venda (€)</Label>
              <Input
                type="number"
                step="0.01"
                value={form.base_value}
                onChange={e => {
                  const v = e.target.value;
                  setForm(f => ({ ...f, base_value: v, vat_rate: '0', invoice_total: v }));
                }}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Estás isenta de IVA — não cobras IVA nas faturas (art. 53.º).
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Valor Base (€)</Label><Input type="number" step="0.01" value={form.base_value} onChange={e => setForm(f => ({ ...f, base_value: e.target.value }))} /></div>
              <div>
                <Label>IVA (%)</Label>
                <Select value={form.vat_rate || '23'} onValueChange={v => setForm(f => ({ ...f, vat_rate: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">0% (Isento)</SelectItem>
                    <SelectItem value="6">6%</SelectItem>
                    <SelectItem value="13">13%</SelectItem>
                    <SelectItem value="23">23%</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Fatura Total (€)</Label>
                <Input type="number" step="0.01" value={form.invoice_total} onChange={e => setForm(f => ({ ...f, invoice_total: e.target.value }))} />
              </div>
            </div>
          )}
          {!ivaExempt && form.base_value && parseFloat(form.base_value) > 0 && parseFloat(form.vat_rate || '0') > 0 && (
            <p className="text-xs text-muted-foreground -mt-2">
              IVA: {((parseFloat(form.invoice_total) || 0) - (parseFloat(form.base_value) || 0)).toFixed(2)} €
            </p>
          )}
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
          <div>
            <Label>Cliente</Label>
            <Select value={form.client} onValueChange={v => setForm(f => ({ ...f, client: v }))}>
              <SelectTrigger><SelectValue placeholder="Selecionar cliente" /></SelectTrigger>
              <SelectContent>
                {(clientsList.data || []).map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Fonte da Venda</Label>
            <Select value={form.source} onValueChange={v => {
              if (v === '__custom__') {
                const custom = prompt('Introduz a nova fonte:');
                if (custom?.trim()) setForm(f => ({ ...f, source: custom.trim() }));
                return;
              }
              setForm(f => ({ ...f, source: v }));
            }}>
              <SelectTrigger><SelectValue placeholder="Selecionar fonte" /></SelectTrigger>
              <SelectContent>
                {sourceOptions.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                <SelectItem value="__custom__">+ Adicionar outro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {/* Special Offer */}
          <div className="space-y-3 rounded-lg border border-border p-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Oferta Especial</Label>
              <Switch checked={form.is_special_offer} onCheckedChange={v => setForm(f => ({ ...f, is_special_offer: v, special_offer_reason: v ? f.special_offer_reason : '' }))} />
            </div>
            {form.is_special_offer && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Motivo da oferta</Label>
                <Select value={form.special_offer_reason} onValueChange={v => {
                  if (v === '__custom__') {
                    const custom = prompt('Introduz o motivo da oferta especial:');
                    if (custom?.trim()) setForm(f => ({ ...f, special_offer_reason: custom.trim() }));
                    return;
                  }
                  setForm(f => ({ ...f, special_offer_reason: v }));
                }}>
                  <SelectTrigger><SelectValue placeholder="Selecionar motivo" /></SelectTrigger>
                  <SelectContent>
                    {SPECIAL_OFFER_REASONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                    <SelectItem value="__custom__">+ Adicionar outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <InvoiceUpload
            documents={form.documents}
            onChange={docs => setForm(f => ({ ...f, documents: docs }))}
            label="Ficheiros (faturas, comprovativos, recibos)"
          />
          <Button className="w-full" onClick={handleSave}>Guardar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}