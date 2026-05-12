import { useState, useEffect } from 'react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Switch } from '@/components/ui/switch';
import { CalendarIcon, User, Gift, FileText, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCommercialData } from '@/hooks/useCommercialData';
import { ENTRY_STATUSES, getEntryStatusBadge, getEffectiveEntryStatus } from '@/components/financial/EntryDetailSheet';
import { InvoiceUpload, type DocEntry } from '@/components/financial/InvoiceUpload';
import { formatNumber } from '@/lib/formatting';
import { PAYMENT_METHOD_OPTIONS as SALE_PAYMENT_METHODS, SPECIAL_OFFER_REASONS } from '@/lib/salesConstants';

const STATUS_OPTIONS = ENTRY_STATUSES;
import { buildSaleSourceOptions } from '@/lib/labelMaps';
interface Props {
  saleId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SaleDetailDialog({ saleId, open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const { isOwner } = useAuth();
  const commercialData = useCommercialData();
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

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
  const sourceOptions = buildSaleSourceOptions(customSources || []);

  const { data: clientsList } = useQuery({
    queryKey: ['clients-list-names'],
    queryFn: async () => {
      const { data } = await supabase.from('clients').select('full_name').order('full_name');
      return (data || []).map(c => c.full_name);
    },
  });

  const { data: productNames } = useQuery({
    queryKey: ['product-names-sale-dialog'],
    queryFn: async () => {
      const { data } = await supabase.from('products').select('name');
      return (data || []).map(p => p.name);
    },
    staleTime: 5 * 60 * 1000,
  });
  const products = productNames || [];

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

    // Detect new documents for invoice email
    const oldDocs: DocEntry[] = Array.isArray(sale?.documents) ? (sale.documents as DocEntry[]) : [];
    const newDocs: DocEntry[] = Array.isArray(form.documents) ? form.documents : [];
    const hasNewInvoice = newDocs.length > oldDocs.length;

    const { error } = await supabase.from('commercial_sales').update({
      status: form.status,
      payment_date: payDate,
      description: form.description,
      base_value: parseFloat(form.base_value) || 0,
      invoice_total: parseFloat(form.invoice_total) || 0,
      product: form.product || null,
      client: form.client || null,
      source: form.source || null,
      documents: newDocs,
      sale_month: saleMonth,
      sale_quarter: saleQuarter,
      sale_year: saleYear,
      is_special_offer: form.is_special_offer || false,
      special_offer_reason: form.is_special_offer ? (form.special_offer_reason || null) : null,
      payment_method: form.payment_method || null,
    } as any).eq('id', saleId);

    if (error) { toast.error('Não consegui guardar a venda. Tenta novamente.'); return; }

    // Send invoice-available email if new documents were added
    if (hasNewInvoice && form.client) {
      try {
        const { data: clientData } = await supabase.from('clients').select('email, id').eq('full_name', form.client).maybeSingle();
        if (clientData?.email) {
          const [{ data: portal }, { data: settings }, { data: emailCustom }] = await Promise.all([
            supabase.from('client_portals').select('token').eq('client_id', clientData.id).eq('is_active', true).maybeSingle(),
            supabase.from('business_settings').select('business_name, primary_color, text_color, accent_color, font_display, font_body, logo_url').limit(1).maybeSingle(),
            supabase.from('email_template_settings').select('*').eq('template_key', 'invoice-available').maybeSingle(),
          ]);
          
          const portalUrl = portal?.token ? `${window.location.origin}/portal/${portal.token}` : undefined;
          
          await supabase.functions.invoke('send-transactional-email', {
            body: {
              templateName: 'invoice-available',
              recipientEmail: clientData.email,
              idempotencyKey: `invoice-available-${saleId}-${newDocs.length}`,
              templateData: {
                clientName: form.client,
                productName: form.product || undefined,
                amount: form.invoice_total ? String(parseFloat(form.invoice_total).toFixed(2)) : undefined,
                portalUrl,
                businessName: settings?.business_name,
                primaryColor: emailCustom?.primary_color || settings?.primary_color || undefined,
                primaryForeground: emailCustom?.primary_foreground || '0 0% 100%',
                textColor: emailCustom?.text_color || settings?.text_color || undefined,
                accentColor: emailCustom?.muted_color || settings?.accent_color || undefined,
                fontDisplay: emailCustom?.font_display || settings?.font_display || undefined,
                fontBody: emailCustom?.font_body || settings?.font_body || undefined,
                logoUrl: settings?.logo_url || undefined,
                // Custom text overrides
                customTitle: emailCustom?.title_text || undefined,
                customSubtitle: emailCustom?.subtitle_text || undefined,
                customCta: emailCustom?.cta_text || undefined,
                customFooter: emailCustom?.footer_text || undefined,
                customEmoji: emailCustom?.emoji || undefined,
              },
            },
          });
        }
      } catch (e) {
        console.error('Failed to send invoice email:', e);
      }
    }

    toast.success('Venda guardada');
    qc.invalidateQueries({ queryKey: ['commercial'] });
    qc.invalidateQueries({ queryKey: ['project-sales'] });
    qc.invalidateQueries({ queryKey: ['sale-detail-dialog', saleId] });
    onOpenChange(false);
  };

  const handleDelete = async () => {
    if (!saleId) return;
    const { error } = await supabase.from('commercial_sales').delete().eq('id', saleId);
    if (error) { toast.error('Não consegui eliminar a venda. Tenta novamente.'); return; }
    toast.success('Entrada eliminada');
    qc.invalidateQueries({ queryKey: ['commercial'] });
    qc.invalidateQueries({ queryKey: ['project-sales'] });
    onOpenChange(false);
  };

  const effectiveStatus = getEffectiveEntryStatus(form.status || 'aguarda_pagamento', form.payment_date || null);
  const statusInfo = getEntryStatusBadge(effectiveStatus);

  return (
    <>
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
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Status</Label>
              <Select value={form.status || 'aguarda_pagamento'} onValueChange={v => setForm((f: any) => ({ ...f, status: v }))} disabled={!isOwner}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
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

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Descrição</Label>
            <Input value={form.description || ''} onChange={e => setForm((f: any) => ({ ...f, description: e.target.value }))} readOnly={!isOwner} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Valor Base (€)</Label>
              <Input type="number" step="0.01" value={form.base_value ?? ''} onChange={e => setForm((f: any) => ({ ...f, base_value: e.target.value }))} readOnly={!isOwner} />
            </div>
            <div className="space-y-2">
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
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Produto</Label>
              <Select value={form.product || ''} onValueChange={v => setForm((f: any) => ({ ...f, product: v }))} disabled={!isOwner}>
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>{products.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Cliente</Label>
              <Select value={form.client || ''} onValueChange={v => setForm((f: any) => ({ ...f, client: v }))} disabled={!isOwner}>
                <SelectTrigger><SelectValue placeholder="Selecionar cliente" /></SelectTrigger>
                <SelectContent>{(clientsList || []).map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Método de Pagamento</Label>
              <Select value={form.payment_method || ''} onValueChange={v => setForm((f: any) => ({ ...f, payment_method: v }))} disabled={!isOwner}>
                <SelectTrigger><SelectValue placeholder="Não definido" /></SelectTrigger>
                <SelectContent>
                  {SALE_PAYMENT_METHODS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
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
          </div>

          {/* Special Offer */}
          <div className="rounded-lg border border-border p-3 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium flex items-center gap-2"><Gift className="h-4 w-4" /> Oferta Especial</Label>
              <Switch
                checked={form.is_special_offer || false}
                onCheckedChange={v => setForm((f: any) => ({ ...f, is_special_offer: v, special_offer_reason: v ? f.special_offer_reason : '' }))}
                disabled={!isOwner}
              />
            </div>
            {form.is_special_offer && (
              <div className="space-y-2">
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
            <div className="flex gap-2">
              <Button className="flex-1" onClick={save}>Guardar</Button>
              <Button variant="destructive" aria-label="Eliminar" size="icon" onClick={() => setConfirmDeleteOpen(true)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>

    <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Eliminar entrada</AlertDialogTitle>
          <AlertDialogDescription>
            Tens a certeza que queres eliminar esta entrada ({form.sale_id})? Esta ação não pode ser revertida.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            Eliminar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
