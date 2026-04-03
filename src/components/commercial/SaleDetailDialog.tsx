import { useState, useEffect } from 'react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Switch } from '@/components/ui/switch';
import { CalendarIcon, User, Gift, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCommercialData } from '@/hooks/useCommercialData';
import { ENTRY_STATUSES, getEntryStatusBadge, getEffectiveEntryStatus } from '@/components/financial/EntryDetailSheet';
import { InvoiceUpload, type DocEntry } from '@/components/financial/InvoiceUpload';

const STATUS_OPTIONS = ENTRY_STATUSES;
const DEFAULT_SOURCE_OPTIONS = ['Instagram', 'Sessão de Diagnóstico', 'Recomendação', 'Orgânico', 'Outro'];
const SPECIAL_OFFER_REASONS = ['Campanha especial', 'Cliente antigo', 'Parceria', 'Desconto de lançamento', 'Upgrade de produto'];
const fmt = (v: number) => v.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface Props {
  saleId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SaleDetailDialog({ saleId, open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const { isOwner } = useAuth();
  const commercialData = useCommercialData();

  const { data: sale } = useQuery({
    queryKey: ['sale-detail-dialog', saleId],
    queryFn: async () => {
      const { data } = await supabase.from('commercial_sales').select('*').eq('id', saleId!).maybeSingle();
      return data;
    },
    enabled: !!saleId && open,
  });

  const [form, setForm] = useState<any>({});

  useEffect(() => {
    if (sale && open) {
      setForm({
        ...sale,
        payment_date_obj: sale.payment_date ? new Date(sale.payment_date) : undefined,
      });
    }
  }, [sale, open]);

  const clientInfo = useQuery({
    queryKey: ['client-by-name', form.client],
    queryFn: async () => {
      if (!form.client) return null;
      const { data } = await supabase.from('clients').select('full_name, nif, fiscal_address').eq('full_name', form.client).maybeSingle();
      return data;
    },
    enabled: !!form.client && open,
  });

  const productInfo = useQuery({
    queryKey: ['product-vat', form.product],
    queryFn: async () => {
      if (!form.product) return null;
      const { data } = await supabase.from('products').select('vat_rate, invoice_denomination').eq('name', form.product).maybeSingle();
      return data;
    },
    enabled: !!form.product && open,
  });

  const { data: customSources } = useQuery({
    queryKey: ['sales-sources'],
    queryFn: async () => {
      const { data } = await supabase.from('commercial_sales').select('source');
      return [...new Set((data || []).map(d => d.source).filter(Boolean))] as string[];
    },
  });
  const sourceOptions = [...new Set([...DEFAULT_SOURCE_OPTIONS, ...(customSources || [])])];

  const { data: clientsList } = useQuery({
    queryKey: ['clients-list-names'],
    queryFn: async () => {
      const { data } = await supabase.from('clients').select('full_name').order('full_name');
      return (data || []).map(c => c.full_name);
    },
  });

  const products = (commercialData.productGoals.data || []).map(p => p.product_name);

  const getVatMultiplier = () => {
    const rate = productInfo.data?.vat_rate;
    if (!rate || rate === 'isento') return 1;
    return 1 + parseFloat(rate) / 100;
  };

  useEffect(() => {
    if (form.base_value !== undefined && productInfo.data) {
      const base = parseFloat(form.base_value) || 0;
      const total = Math.round(base * getVatMultiplier() * 100) / 100;
      setForm((f: any) => ({ ...f, invoice_total: total }));
    }
  }, [form.base_value, productInfo.data?.vat_rate]);

  const save = async () => {
    if (!saleId) return;
    const payDate = form.payment_date_obj ? format(form.payment_date_obj, 'yyyy-MM-dd') : form.payment_date;
    const payDateParsed = payDate ? new Date(payDate) : null;
    const saleMonth = payDateParsed ? payDateParsed.getMonth() + 1 : null;
    const saleQuarter = saleMonth ? Math.ceil(saleMonth / 3) : null;
    const saleYear = payDateParsed ? payDateParsed.getFullYear() : null;

    const { error } = await supabase.from('commercial_sales').update({
      status: form.status,
      payment_date: payDate,
      description: form.description,
      base_value: parseFloat(form.base_value) || 0,
      invoice_total: parseFloat(form.invoice_total) || 0,
      product: form.product || null,
      client: form.client || null,
      source: form.source || null,
      documents: Array.isArray(form.documents) ? form.documents : [],
      sale_month: saleMonth,
      sale_quarter: saleQuarter,
      sale_year: saleYear,
      is_special_offer: form.is_special_offer || false,
      special_offer_reason: form.is_special_offer ? (form.special_offer_reason || null) : null,
    } as any).eq('id', saleId);

    if (error) { toast.error('Erro ao guardar'); return; }
    toast.success('Venda guardada');
    qc.invalidateQueries({ queryKey: ['commercial'] });
    qc.invalidateQueries({ queryKey: ['project-sales'] });
    qc.invalidateQueries({ queryKey: ['sale-detail-dialog', saleId] });
    onOpenChange(false);
  };

  const effectiveStatus = getEffectiveEntryStatus(form.status || 'aguarda_pagamento', form.payment_date || null);
  const statusInfo = getEntryStatusBadge(effectiveStatus);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-background">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="font-mono">{form.sale_id}</span>
            <Badge variant="outline" className={statusInfo.cls}>{statusInfo.label}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Client info */}
          {clientInfo.data && (
            <div className="rounded-lg border border-border bg-muted/50 p-3 space-y-1">
              <div className="flex items-center gap-2 text-sm font-medium"><User className="h-4 w-4 text-muted-foreground" /> Dados do Cliente</div>
              <div className="grid grid-cols-1 gap-1 text-sm text-muted-foreground">
                <span><strong className="text-foreground">Nome:</strong> {clientInfo.data.full_name}</span>
                <span><strong className="text-foreground">NIF:</strong> {clientInfo.data.nif || '—'}</span>
                <span><strong className="text-foreground">Morada:</strong> {clientInfo.data.fiscal_address || '—'}</span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Status</Label>
              <Select value={form.status || 'aguarda_pagamento'} onValueChange={v => setForm((f: any) => ({ ...f, status: v }))} disabled={!isOwner}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Data de Pagamento</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !form.payment_date_obj && "text-muted-foreground")} disabled={!isOwner}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {form.payment_date_obj ? format(form.payment_date_obj, 'dd/MM/yyyy') : 'Selecionar data'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={form.payment_date_obj} onSelect={d => setForm((f: any) => ({ ...f, payment_date_obj: d }))} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Descrição</Label>
            <Input value={form.description || ''} onChange={e => setForm((f: any) => ({ ...f, description: e.target.value }))} readOnly={!isOwner} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Valor Base (€)</Label>
              <Input type="number" step="0.01" value={form.base_value ?? ''} onChange={e => setForm((f: any) => ({ ...f, base_value: e.target.value }))} readOnly={!isOwner} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                Fatura Total (€) {productInfo.data?.vat_rate && productInfo.data.vat_rate !== 'isento'
                  ? <span className="font-normal">({productInfo.data.vat_rate}% IVA)</span>
                  : productInfo.data?.vat_rate === 'isento'
                  ? <span className="font-normal">(Isento)</span>
                  : null}
              </Label>
              <Input type="number" step="0.01" value={form.invoice_total ?? ''} onChange={e => setForm((f: any) => ({ ...f, invoice_total: e.target.value }))} readOnly={!isOwner} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Produto</Label>
              <Select value={form.product || ''} onValueChange={v => setForm((f: any) => ({ ...f, product: v }))} disabled={!isOwner}>
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>{products.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Cliente</Label>
              <Select value={form.client || ''} onValueChange={v => setForm((f: any) => ({ ...f, client: v }))} disabled={!isOwner}>
                <SelectTrigger><SelectValue placeholder="Selecionar cliente" /></SelectTrigger>
                <SelectContent>{(clientsList || []).map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Fonte</Label>
            <Select value={form.source || ''} onValueChange={v => {
              if (v === '__custom__') {
                const custom = prompt('Introduz a nova fonte:');
                if (custom?.trim()) setForm((f: any) => ({ ...f, source: custom.trim() }));
                return;
              }
              setForm((f: any) => ({ ...f, source: v }));
            }} disabled={!isOwner}>
              <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
              <SelectContent>
                {sourceOptions.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                <SelectItem value="__custom__">+ Adicionar outro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Special Offer */}
          <div className="rounded-lg border border-border p-3 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium flex items-center gap-1.5"><Gift className="h-4 w-4" /> Oferta Especial</Label>
              <Switch
                checked={form.is_special_offer || false}
                onCheckedChange={v => setForm((f: any) => ({ ...f, is_special_offer: v, special_offer_reason: v ? f.special_offer_reason : '' }))}
                disabled={!isOwner}
              />
            </div>
            {form.is_special_offer && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Motivo da oferta</Label>
                <Select value={form.special_offer_reason || ''} onValueChange={v => {
                  if (v === '__custom__') {
                    const custom = prompt('Introduz o motivo da oferta especial:');
                    if (custom?.trim()) setForm((f: any) => ({ ...f, special_offer_reason: custom.trim() }));
                    return;
                  }
                  setForm((f: any) => ({ ...f, special_offer_reason: v }));
                }} disabled={!isOwner}>
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
            documents={Array.isArray(form.documents) ? form.documents : []}
            onChange={docs => setForm((f: any) => ({ ...f, documents: docs }))}
            label="Ficheiros (faturas, comprovativos, recibos)"
          />

          {isOwner && (
            <Button className="w-full" onClick={save}>Guardar</Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
