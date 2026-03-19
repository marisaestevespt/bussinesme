import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { ArrowLeft, CalendarIcon, User, Trash2, FileText, Plus, ExternalLink, Upload, X } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useCommercialData } from '@/hooks/useCommercialData';

const STATUS_OPTIONS = [
  { value: 'na', label: 'N.A.', className: 'bg-muted text-muted-foreground' },
  { value: 'aguarda_pagamento', label: 'Aguarda Pagamento', className: 'bg-orange-100 text-orange-800 border-orange-200' },
  { value: 'em_atraso', label: 'Em Atraso', className: 'bg-red-100 text-red-800 border-red-200' },
  { value: 'fatura_emitida', label: 'Fatura Emitida', className: 'bg-amber-100 text-amber-800 border-amber-200' },
  { value: 'pagamento_ok', label: 'Pagamento OK', className: 'bg-green-100 text-green-800 border-green-200' },
  { value: 'recibo_enviado', label: 'Recibo Enviado', className: 'bg-blue-100 text-blue-800 border-blue-200' },
  { value: 'contabilidade_ok', label: 'Contabilidade OK', className: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
];

const SOURCE_OPTIONS = ['Instagram', 'Sessão de Diagnóstico', 'Recomendação', 'Orgânico', 'Outro'];
const fmt = (v: number) => v.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function VendaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isOwner } = useAuth();
  const commercialData = useCommercialData();

  const { data: sale, isLoading } = useQuery({
    queryKey: ['sale-detail', id],
    queryFn: async () => {
      const { data } = await supabase.from('commercial_sales').select('*').eq('id', id!).maybeSingle();
      return data;
    },
    enabled: !!id,
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

    const { error } = await supabase.from('commercial_sales').update({
      status: form.status,
      payment_date: payDate,
      description: form.description,
      base_value: parseFloat(form.base_value) || 0,
      invoice_total: parseFloat(form.invoice_total) || 0,
      product: form.product || null,
      client: form.client || null,
      source: form.source || null,
      documents: form.documents || null,
      sale_month: saleMonth,
      sale_quarter: saleQuarter,
      sale_year: saleYear,
    }).eq('id', id!);

    if (error) { toast.error('Erro ao guardar'); return; }
    toast.success('Venda guardada');
    qc.invalidateQueries({ queryKey: ['commercial'] });
    qc.invalidateQueries({ queryKey: ['sale-detail', id] });
  };

  const handleDelete = async () => {
    if (!confirm('Tens a certeza que queres eliminar esta venda?')) return;
    await commercialData.deleteSale.mutateAsync(id!);
    navigate('/hub/comercial/vendas');
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
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

  const statusInfo = STATUS_OPTIONS.find(s => s.value === form.status) || STATUS_OPTIONS[0];

  return (
    <AppLayout>
      <div className="p-6 space-y-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="ghost" size="sm" onClick={() => navigate('/hub/comercial/vendas')}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Vendas
          </Button>
          <div className="flex items-center gap-2">
            <span className="font-mono text-lg font-bold">{form.sale_id}</span>
            <Badge variant="outline" className={statusInfo.className}>{statusInfo.label}</Badge>
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
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Status</Label>
                    <Select value={form.status || 'na'} onValueChange={v => setForm((f: any) => ({ ...f, status: v }))} disabled={!isOwner}>
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
                        ? <span className="text-muted-foreground font-normal">({productInfo.data.vat_rate}% IVA)</span>
                        : productInfo.data?.vat_rate === 'isento'
                        ? <span className="text-muted-foreground font-normal">(Isento)</span>
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
                      <SelectContent>
                        {products.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Fonte</Label>
                    <Select value={form.source || ''} onValueChange={v => setForm((f: any) => ({ ...f, source: v }))} disabled={!isOwner}>
                      <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                      <SelectContent>{SOURCE_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Cliente</Label>
                  <Input value={form.client || ''} onChange={e => setForm((f: any) => ({ ...f, client: e.target.value }))} readOnly={!isOwner} />
                </div>

                <div className="space-y-3">
                  <Label className="text-xs text-muted-foreground">Documentos</Label>
                  {(() => {
                    const docs: { type: string; url: string; name: string }[] = Array.isArray(form.documents) ? form.documents : [];
                    return (
                      <div className="space-y-2">
                        {docs.map((doc, i) => (
                          <div key={i} className="flex items-center gap-2 rounded-md border border-border p-2 text-sm">
                            {doc.type === 'link' ? <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" /> : <FileText className="h-4 w-4 text-muted-foreground shrink-0" />}
                            <a href={doc.url} target="_blank" rel="noopener noreferrer" className="truncate flex-1 text-primary hover:underline">
                              {doc.name || doc.url}
                            </a>
                            {isOwner && (
                              <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => {
                                const next = docs.filter((_, j) => j !== i);
                                setForm((f: any) => ({ ...f, documents: next }));
                              }}>
                                <X className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        ))}
                        {isOwner && (
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => {
                              const url = prompt('Cole o link do documento:');
                              if (!url) return;
                              const name = prompt('Nome do documento (opcional):') || url;
                              setForm((f: any) => ({ ...f, documents: [...(Array.isArray(f.documents) ? f.documents : []), { type: 'link', url, name }] }));
                            }}>
                              <Plus className="h-3 w-3 mr-1" /> Link
                            </Button>
                            <label>
                              <Button variant="outline" size="sm" asChild>
                                <span><Upload className="h-3 w-3 mr-1" /> Ficheiro</span>
                              </Button>
                              <input type="file" className="hidden" onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                const path = `sales/${id}/${Date.now()}-${file.name}`;
                                const { error } = await supabase.storage.from('commercial-files').upload(path, file);
                                if (error) { toast.error('Erro ao enviar ficheiro'); return; }
                                const { data: urlData } = supabase.storage.from('commercial-files').getPublicUrl(path);
                                setForm((f: any) => ({ ...f, documents: [...(Array.isArray(f.documents) ? f.documents : []), { type: 'file', url: urlData.publicUrl, name: file.name }] }));
                                toast.success('Ficheiro enviado');
                              }} />
                            </label>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
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
                    <span className="font-semibold">€{fmt(Number(form.base_value || 0))}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Fatura Total</span>
                    <span className="font-semibold">€{fmt(Number(form.invoice_total || 0))}</span>
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
