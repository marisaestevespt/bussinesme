import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Editable } from '@/components/ui/editable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { ArrowLeft, CalendarIcon, User, Trash2, FileText, Plus, ExternalLink, Upload, X, Gift } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useCommercialData } from '@/hooks/useCommercialData';
import { BackNavigation } from '@/components/BackNavigation';
import { EntityHeroHeader, parseIcon } from '@/components/entity-icon';
import { ENTRY_STATUSES, getEntryStatusBadge, getEffectiveEntryStatus } from '@/components/financial/EntryDetailSheet';
import { InvoiceUpload, type DocEntry } from '@/components/financial/InvoiceUpload';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { InlineLoader } from '@/components/ui/loading-skeletons';
import { formatNumber } from '@/lib/formatting';
import { useSectorConfig } from '@/hooks/useSectorConfig';

const STATUS_OPTIONS = ENTRY_STATUSES;
import { buildSaleSourceOptions } from '@/lib/labelMaps';
const SPECIAL_OFFER_REASONS = ['Campanha especial', 'Cliente antigo', 'Parceria', 'Desconto de lançamento', 'Upgrade de produto'];
export default function VendaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isOwner } = useAuth();
  const sectorConfig = useSectorConfig();
  const commercialData = useCommercialData();
  const confirm = useConfirm();

  const { data: sale, isLoading } = useQuery({
    queryKey: ['sale-detail', id],
    queryFn: async () => {
      const { data } = await supabase.from('commercial_sales').select('*').eq('id', id!).maybeSingle();
      return data;
    },
    enabled: !!id,
  });

  const { data: customSources } = useQuery({
    queryKey: ['sales-sources'],
    queryFn: async () => {
      const { data } = await supabase.from('commercial_sales').select('source');
      const unique = [...new Set((data || []).map(d => d.source).filter(Boolean))] as string[];
      return unique;
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

  const [form, setForm] = useState<any>({});
  const [initialized, setInitialized] = useState(false);

  if (sale && !initialized) {
    setForm({
      ...sale,
      payment_date_obj: sale.payment_date ? new Date(sale.payment_date) : undefined,
    });
    setInitialized(true);
  }

  // Client info
  const clientInfo = useQuery({
    queryKey: ['client-by-name', form.client],
    queryFn: async () => {
      if (!form.client) return null;
      const { data } = await supabase.from('clients').select('full_name, nif, fiscal_address, client_id, email, whatsapp').eq('full_name', form.client).maybeSingle();
      return data;
    },
    enabled: !!form.client,
  });

  // Product info (VAT)
  const productInfo = useQuery({
    queryKey: ['product-vat', form.product],
    queryFn: async () => {
      if (!form.product) return null;
      const { data } = await supabase.from('products').select('vat_rate, invoice_denomination').eq('name', form.product).maybeSingle();
      return data;
    },
    enabled: !!form.product,
  });

  const products = (commercialData.productGoals.data || []).map(p => p.product_name);

  const getVatMultiplier = () => {
    const rate = productInfo.data?.vat_rate;
    if (!rate || rate === 'isento') return 1;
    return 1 + parseFloat(rate) / 100;
  };

  // Auto-calc invoice_total
  useEffect(() => {
    if (form.base_value !== undefined && productInfo.data) {
      const base = parseFloat(form.base_value) || 0;
      const total = Math.round(base * getVatMultiplier() * 100) / 100;
      setForm((f: any) => ({ ...f, invoice_total: total }));
    }
  }, [form.base_value, productInfo.data?.vat_rate]);

  const save = async () => {
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
      documents: Array.isArray(form.documents) ? form.documents : [],
      sale_month: saleMonth,
      sale_quarter: saleQuarter,
      sale_year: saleYear,
      is_special_offer: form.is_special_offer || false,
      special_offer_reason: form.is_special_offer ? (form.special_offer_reason || null) : null,
    } as any).eq('id', id!);

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
              idempotencyKey: `invoice-available-${id}-${newDocs.length}`,
              templateData: {
                clientName: form.client,
                productName: form.product || undefined,
                amount: form.invoice_total ? String(parseFloat(form.invoice_total).toFixed(2)) : undefined,
                portalUrl,
                businessName: settings?.business_name,
                primaryColor: (emailCustom as any)?.primary_color || settings?.primary_color || undefined,
                primaryForeground: (emailCustom as any)?.primary_foreground || '0 0% 100%',
                textColor: (emailCustom as any)?.text_color || settings?.text_color || undefined,
                accentColor: (emailCustom as any)?.muted_color || settings?.accent_color || undefined,
                fontDisplay: (emailCustom as any)?.font_display || settings?.font_display || undefined,
                fontBody: (emailCustom as any)?.font_body || settings?.font_body || undefined,
                logoUrl: settings?.logo_url || undefined,
                customTitle: (emailCustom as any)?.title_text || undefined,
                customSubtitle: (emailCustom as any)?.subtitle_text || undefined,
                customCta: (emailCustom as any)?.cta_text || undefined,
                customFooter: (emailCustom as any)?.footer_text || undefined,
                customEmoji: (emailCustom as any)?.emoji || undefined,
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
    qc.invalidateQueries({ queryKey: ['sale-detail', id] });
  };

  const handleDelete = async () => {
    const ok = await confirm({
      title: 'Eliminar venda?',
      description: 'Esta venda e os documentos anexados serão removidos permanentemente.',
      confirmText: 'Eliminar',
      variant: 'destructive',
    });
    if (!ok) return;
    await commercialData.deleteSale.mutateAsync(id!);
    navigate('/hub/comercial/vendas');
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex min-h-[50vh] items-center justify-center">
          <InlineLoader />
        </div>
      </AppLayout>
    );
  }

  if (!sale) {
    return (
      <AppLayout>
        <div className="p-6 text-center text-muted-foreground">Venda não encontrada</div>
      </AppLayout>
    );
  }

  const effectiveStatus = getEffectiveEntryStatus(form.status || 'aguarda_pagamento', form.payment_date || null);
  const statusInfo = getEntryStatusBadge(effectiveStatus);

  return (
    <AppLayout>
      <div className="space-y-6 w-full">
        <EntityHeroHeader
          icon={parseIcon((sale as any)?.icon)}
          onIconChange={async (next) => {
            await supabase.from('commercial_sales').update({ icon: next as any } as any).eq('id', id!);
            qc.invalidateQueries({ queryKey: ['sale-detail', id] });
          }}
          coverUrl={(sale as any)?.cover_url || null}
          onCoverChange={async (url) => {
            await supabase.from('commercial_sales').update({ cover_url: url } as any).eq('id', id!);
            qc.invalidateQueries({ queryKey: ['sale-detail', id] });
          }}
          bucket="entity-icons"
          pathPrefix={`sales/${id}`}
          disabled={!isOwner}
        />
        {/* Header */}
        <div className="flex items-center gap-3 flex-wrap">
          <BackNavigation parentRoute="/hub/comercial/vendas" parentLabel={sectorConfig.t('vendas')} />
          <div className="flex items-center gap-2">
            <span className="font-mono text-lg font-bold">{form.sale_id}</span>
            <Badge variant="outline" className={statusInfo.cls}>{statusInfo.label}</Badge>
          </div>
          <div className="flex-1" />
          {isOwner && (
            <>
              <Button variant="outline" size="sm" className="text-destructive" onClick={handleDelete}>
                <Trash2 className="h-4 w-4 mr-1" /> Eliminar
              </Button>
              <Button size="sm" onClick={save}>Guardar</Button>
            </>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main form */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader><CardTitle className="text-base">Detalhes da Venda</CardTitle></CardHeader>
              <CardContent className="space-y-4">
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
                  <Editable display={form.description || ''} disabled={!isOwner} placeholder="Sem descrição" render={({ stop, autoFocusRef }) => (
                    <Input ref={autoFocusRef as any} value={form.description || ''} onBlur={stop} onChange={e => setForm((f: any) => ({ ...f, description: e.target.value }))} />
                  )} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Valor Base (€)</Label>
                    <Editable display={form.base_value ?? ''} disabled={!isOwner} suffix="€" placeholder="0 €" align="right" render={({ stop, autoFocusRef }) => (
                      <Input ref={autoFocusRef as any} type="number" step="0.01" value={form.base_value ?? ''} onBlur={stop} onChange={e => setForm((f: any) => ({ ...f, base_value: e.target.value }))} />
                    )} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">
                      Fatura Total (€) {productInfo.data?.vat_rate && productInfo.data.vat_rate !== 'isento'
                        ? <span className="text-muted-foreground font-normal">({productInfo.data.vat_rate}% IVA)</span>
                        : productInfo.data?.vat_rate === 'isento'
                        ? <span className="text-muted-foreground font-normal">(Isento)</span>
                        : null}
                    </Label>
                    <Editable display={form.invoice_total ?? ''} disabled={!isOwner} suffix="€" placeholder="0 €" align="right" render={({ stop, autoFocusRef }) => (
                      <Input ref={autoFocusRef as any} type="number" step="0.01" value={form.invoice_total ?? ''} onBlur={stop} onChange={e => setForm((f: any) => ({ ...f, invoice_total: e.target.value }))} />
                    )} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Produto</Label>
                    <Select value={form.product || ''} onValueChange={v => setForm((f: any) => ({ ...f, product: v }))} disabled={!isOwner}>
                      <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                      <SelectContent>
                        {products.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
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

                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Cliente</Label>
                  <Select value={form.client || ''} onValueChange={v => setForm((f: any) => ({ ...f, client: v }))} disabled={!isOwner}>
                    <SelectTrigger><SelectValue placeholder="Selecionar cliente" /></SelectTrigger>
                    <SelectContent>
                      {(clientsList || []).map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
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
              </CardContent>
            </Card>
          </div>

          {/* Sidebar — Client info + Product info */}
          <div className="space-y-4">
            {/* Client card */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" /> Dados do Cliente
                </CardTitle>
              </CardHeader>
              <CardContent>
                {clientInfo.data ? (
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">ID:</span>{' '}
                      <span className="font-mono font-medium">{clientInfo.data.client_id}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Nome:</span>{' '}
                      <span className="font-medium">{clientInfo.data.full_name}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">NIF:</span>{' '}
                      <span className="font-medium">{clientInfo.data.nif || '—'}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Morada Fiscal:</span>{' '}
                      <span className="font-medium">{clientInfo.data.fiscal_address || '—'}</span>
                    </div>
                    {clientInfo.data.email && (
                      <div>
                        <span className="text-muted-foreground">Email:</span>{' '}
                        <span className="font-medium">{clientInfo.data.email}</span>
                      </div>
                    )}
                    {clientInfo.data.whatsapp && (
                      <div>
                        <span className="text-muted-foreground">WhatsApp:</span>{' '}
                        <span className="font-medium">{clientInfo.data.whatsapp}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {form.client ? 'Cliente não encontrado na base de dados' : 'Sem cliente associado'}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Product / Invoice info */}
            {productInfo.data && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" /> Dados de Faturação
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Produto:</span>{' '}
                      <span className="font-medium">{form.product}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">IVA:</span>{' '}
                      <span className="font-medium">
                        {productInfo.data.vat_rate === 'isento' ? 'Isento' : `${productInfo.data.vat_rate}%`}
                      </span>
                    </div>
                    {productInfo.data.invoice_denomination && (
                      <div>
                        <span className="text-muted-foreground">Denominação:</span>{' '}
                        <span className="font-medium">{productInfo.data.invoice_denomination}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Quick summary */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Resumo</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Valor Base</span>
                    <span className="font-semibold">€{formatNumber(Number(form.base_value || 0))}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Fatura Total</span>
                    <span className="font-semibold">€{formatNumber(Number(form.invoice_total || 0))}</span>
                  </div>
                  {form.sale_month && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Período</span>
                      <span>{['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'][(form.sale_month || 1) - 1]} {form.sale_year}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
