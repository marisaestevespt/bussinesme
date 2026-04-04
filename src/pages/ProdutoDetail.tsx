import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQueryClient, useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Copy, Trash2, Plus, ExternalLink, X, Upload, ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useProduct, useProducts, STATUS_OPTIONS, ESCADA_OPTIONS, PRODUCT_TYPE_OPTIONS, SALES_TYPE_OPTIONS, Product } from '@/hooks/useProducts';
import { useAuth } from '@/hooks/useAuth';
import { RichTextEditor } from '@/components/RichTextEditor';
import { ProductMetricsTab } from '@/components/product/ProductMetricsTab';
import { ProductCustomerSuccess } from '@/components/product/ProductCustomerSuccess';
import { ProductEntregasSection } from '@/components/product/ProductEntregasSection';
import { ProductComercialSection } from '@/components/product/ProductComercialSection';
import { ProductMarketingSection } from '@/components/product/ProductMarketingSection';
import { ProductProcessosSection, ProductBackofficeSection, ProductArquivoSection, ProductContabilidadeSection } from '@/components/product/ProductSections';
import { ProductSalesTab } from '@/components/product/ProductSalesTab';
import { ProductPriceTiers } from '@/components/product/ProductPriceTiers';
import { format, parseISO, isFuture, isToday } from 'date-fns';
import { BackNavigation } from '@/components/BackNavigation';
import { cn } from '@/lib/utils';

export default function ProdutoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isOwner, user } = useAuth();
  const isNew = id === 'novo';

  const { data: product, isLoading } = useProduct(isNew ? undefined : id);
  const { upsertProduct, duplicateProduct, deleteProduct } = useProducts();

  const [form, setForm] = useState<Partial<Product>>({});
  const [initialized, setInitialized] = useState(false);
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [showEventDialog, setShowEventDialog] = useState(false);
  const [newEvent, setNewEvent] = useState({ title: '', start_date: '', end_date: '' });

  if (product && !initialized) {
    setForm(product);
    setInitialized(true);
  }
  if (isNew && !initialized) {
    setForm({ name: '', status: 'em_ideia', description: '' });
    setInitialized(true);
  }

  const update = (field: string, value: unknown) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const save = async () => {
    if (!form.name?.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }
    try {
      const newId = await upsertProduct.mutateAsync(form as Product);
      toast.success('Produto guardado');
      if (isNew && newId) navigate(`/hub/produtos/${newId}`, { replace: true });
    } catch (err: any) {
      console.error('Product save error:', err);
      toast.error(err?.message || 'Erro ao guardar produto');
    }
  };

  const handleDuplicate = async () => {
    if (product) {
      await duplicateProduct.mutateAsync(product);
      navigate('/hub/produtos');
    }
  };

  const handleDelete = async () => {
    if (product && confirm('Tens a certeza que queres eliminar este produto?')) {
      await deleteProduct.mutateAsync(product.id);
      navigate('/hub/produtos');
    }
  };

  // ─── Sub-table queries ───────────────────────────────────────
  const subQueryOpts = (key: string, table: string, filterCol: string, filterVal: string | undefined, orderCol = 'created_at') => ({
    queryKey: [key, filterVal],
    queryFn: async (): Promise<Record<string, unknown>[]> => {
      if (!filterVal) return [];
      const { data } = await (supabase as any).from(table).select('*').eq(filterCol, filterVal).order(orderCol);
      return data || [];
    },
    enabled: !!filterVal,
  });

  const { data: feedbacks = [] } = useQuery(subQueryOpts('product-feedbacks', 'product_feedbacks', 'product_id', isNew ? undefined : id));
  const { data: funnels = [] } = useQuery(subQueryOpts('marketing-funnels-product', 'marketing_funnels', 'product_name', form.name));
  const { data: automations = [] } = useQuery(subQueryOpts('marketing-automations-product', 'marketing_automations', 'product_name', form.name));
  const { data: trafficAds = [] } = useQuery(subQueryOpts('traffic-creatives-product', 'traffic_creatives', 'product_name', form.name));
  const { data: usefulLinks = [] } = useQuery(subQueryOpts('product-useful-links', 'product_useful_links', 'product_id', isNew ? undefined : id, 'sort_order'));
  const { data: costs = [] } = useQuery(subQueryOpts('product-costs', 'product_costs', 'product_id', isNew ? undefined : id, 'sort_order'));
  const { data: onboardingTemplate = [] } = useQuery(subQueryOpts('product-onboarding-template', 'product_onboarding_templates', 'product_id', isNew ? undefined : id, 'sort_order'));
  const { data: deliverableTemplates = [] } = useQuery(subQueryOpts('product-deliverable-templates', 'product_deliverable_templates', 'product_id', isNew ? undefined : id, 'sort_order'));
  const { data: offboardingTemplate = [] } = useQuery(subQueryOpts('product-offboarding-template', 'product_offboarding_templates', 'product_id', isNew ? undefined : id, 'sort_order'));
  const { data: projectTemplate = [] } = useQuery(subQueryOpts('product-project-template', 'product_project_templates', 'product_id', isNew ? undefined : id, 'sort_order'));
  const { data: productPaymentMethods = [] } = useQuery(subQueryOpts('product-payment-methods', 'product_payment_methods', 'product_id', isNew ? undefined : id));
  const { data: salesActions = [] } = useQuery(subQueryOpts('product-sales-actions', 'commercial_sales_actions', 'product', form.name));
  const { data: productContents = [] } = useQuery({
    queryKey: ['product-content-items', id],
    queryFn: async () => {
      if (!id || isNew) return [];
      const { data } = await supabase.from('content_items').select('*').eq('product_id', id as never).order('scheduled_at', { ascending: false });
      return (data || []) as Record<string, unknown>[];
    },
    enabled: !isNew && !!id,
  });
  const { data: improvements = [] } = useQuery(subQueryOpts('product-improvements', 'product_improvements', 'product_id', isNew ? undefined : id, 'sort_order'));
  const { data: productDocuments = [] } = useQuery(subQueryOpts('product-documents', 'product_documents', 'product_id', isNew ? undefined : id, 'sort_order'));
  const { data: productSops = [] } = useQuery({
    queryKey: ['linked-sops', 'produto', id],
    queryFn: async () => {
      if (!id || isNew) return [];
      const { data } = await supabase.from('sops').select('*').eq('linked_entity_type', 'produto').eq('linked_entity_id', id).order('sort_order');
      return (data || []) as Record<string, unknown>[];
    },
    enabled: !isNew && !!id,
  });
  const { data: productEvents = [] } = useQuery({
    queryKey: ['product-events', form.name],
    queryFn: async () => {
      if (!form.name) return [];
      const { data } = await supabase.from('events').select('id, title, start_date, end_date').eq('product_name', form.name).order('start_date', { ascending: true });
      return (data || []) as Record<string, unknown>[];
    },
    enabled: !!form.name,
  });
  const { data: productMeetings = [] } = useQuery({
    queryKey: ['product-meetings', id],
    queryFn: async () => {
      if (!id) return [];
      const { data } = await supabase.from('meetings').select('id, title, date_time, status, client_name, project_name').eq('product_id', id).order('date_time', { ascending: false });
      return (data || []) as Record<string, unknown>[];
    },
    enabled: !!id,
  });

  // ─── Mutations ───────────────────────────────────────────────
  const invalidateAll = () => {
    const keys = [
      ['product-feedbacks', id], ['marketing-funnels-product', form.name],
      ['marketing-automations-product', form.name], ['traffic-creatives-product', form.name],
      ['marketing-funnels'], ['marketing-automations'], ['traffic-creatives'],
      ['product-useful-links', id], ['product-costs', id],
      ['product-onboarding-template', id], ['product-improvements', id],
      ['product-deliverable-templates', id],
    ];
    keys.forEach(k => qc.invalidateQueries({ queryKey: k }));
  };

  const addRow = useMutation({
    mutationFn: async ({ table, data }: { table: string; data: Record<string, unknown> }) => {
      const { error } = await supabase.from(table as 'clients').insert(data as never);
      if (error) throw error;
    },
    onSuccess: invalidateAll,
    onError: () => toast.error('Erro ao adicionar registo'),
  });

  const updateRow = useMutation({
    mutationFn: async ({ table, id: rowId, data }: { table: string; id: string; data: Record<string, unknown> }) => {
      const { error } = await supabase.from(table as 'clients').update(data as never).eq('id', rowId);
      if (error) throw error;
    },
    onSuccess: invalidateAll,
  });

  const deleteRow = useMutation({
    mutationFn: async ({ table, id: rowId }: { table: string; id: string }) => {
      const { error } = await supabase.from(table as 'clients').delete().eq('id', rowId);
      if (error) throw error;
    },
    onSuccess: invalidateAll,
  });

  if (!isNew && isLoading) {
    return (
      <AppLayout>
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </AppLayout>
    );
  }

  // ─── JSONB helpers ───────────────────────────────────────────
  const includedItems: string[] = Array.isArray(form.included_items) ? (form.included_items as unknown as string[]) : [];
  const faqs: { question: string; answer: string }[] = Array.isArray(form.faqs) ? (form.faqs as unknown as { question: string; answer: string }[]) : [];
  const clientProfile = (form.client_profile || {}) as Record<string, string[]>;
  const competitors: { name: string; notes: string }[] = Array.isArray(form.competitors) ? (form.competitors as unknown as { name: string; notes: string }[]) : [];

  const toggleSection = (key: string) => setOpenSection(prev => prev === key ? null : key);

  const getEventStatus = (ev: Record<string, unknown>) => {
    const start = parseISO(ev.start_date as string);
    if (isToday(start)) return { label: 'Hoje', color: 'bg-primary text-primary-foreground' };
    if (isFuture(start)) return { label: 'Futuro', color: 'bg-blue-100 text-blue-800 border-blue-200' };
    return { label: 'Passado', color: 'bg-muted text-muted-foreground' };
  };

  const createProductEvent = async () => {
    if (!newEvent.title.trim() || !newEvent.start_date) {
      toast.error('Título e data de início são obrigatórios');
      return;
    }
    const { error } = await supabase.from('events').insert({
      title: newEvent.title.trim(),
      start_date: newEvent.start_date,
      end_date: newEvent.end_date || null,
      product_name: form.name,
      created_by: user?.id,
    } as never);
    if (error) { toast.error('Erro ao criar evento'); return; }
    qc.invalidateQueries({ queryKey: ['product-events', form.name] });
    setShowEventDialog(false);
    setNewEvent({ title: '', start_date: '', end_date: '' });
    toast.success('Evento criado na Agenda');
  };

  const SectionButton = ({ sectionKey, label }: { sectionKey: string; label: string }) => (
    <Button
      variant={openSection === sectionKey ? 'default' : 'secondary'}
      onClick={() => toggleSection(sectionKey)}
      className="h-11 px-5 text-sm font-medium rounded-xl"
    >
      {label}
    </Button>
  );

  return (
    <AppLayout>
      <div className="p-6 space-y-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 flex-wrap">
          <BackNavigation parentRoute="/hub/produtos" parentLabel="Produtos" />
          <div className="flex-1" />
          {!isNew && isOwner && (
            <>
              <Button variant="outline" size="sm" onClick={handleDuplicate}>
                <Copy className="h-4 w-4 mr-1" /> Duplicar
              </Button>
              <Button variant="outline" size="sm" className="text-destructive" onClick={handleDelete}>
                <Trash2 className="h-4 w-4 mr-1" /> Eliminar
              </Button>
            </>
          )}
          {isOwner && (
            <Button size="sm" onClick={save} disabled={upsertProduct.isPending}>
              {isNew ? 'Criar Produto' : 'Guardar'}
            </Button>
          )}
        </div>

        {/* Cover image */}
        <div className="relative w-full h-48 rounded-lg overflow-hidden bg-muted/30 border border-dashed border-border group">
          {form.cover_url ? (
            <img src={form.cover_url} alt="Capa" className="w-full h-full object-cover" />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <ImageIcon className="h-8 w-8 mr-2 opacity-40" />
              <span className="text-sm">Adicionar capa do produto</span>
            </div>
          )}
          {isOwner && (
            <label className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
              <Upload className="h-6 w-6 text-white" />
              <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const path = `covers/${id || 'new'}-${Date.now()}.${file.name.split('.').pop()}`;
                const { error } = await supabase.storage.from('product-files').upload(path, file, { upsert: true });
                if (error) { toast.error('Erro ao enviar imagem'); return; }
                const { data: urlData } = supabase.storage.from('product-files').getPublicUrl(path);
                update('cover_url', urlData.publicUrl);
              }} />
            </label>
          )}
        </div>

        {/* Logo + Name */}
        <div className="flex gap-4 items-start">
          <div className="relative shrink-0 group">
            <div className="h-20 w-20 rounded-xl border bg-background overflow-hidden flex items-center justify-center">
              {form.logo_url ? (
                <img src={form.logo_url} alt="Logo" className="h-full w-full object-contain p-1" />
              ) : (
                <ImageIcon className="h-8 w-8 text-muted-foreground/40" />
              )}
            </div>
            {isOwner && (
              <label className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                <Upload className="h-4 w-4 text-white" />
                <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const path = `logos/${id || 'new'}-${Date.now()}.${file.name.split('.').pop()}`;
                  const { error } = await supabase.storage.from('product-files').upload(path, file, { upsert: true });
                  if (error) { toast.error('Erro ao enviar logo'); return; }
                  const { data: urlData } = supabase.storage.from('product-files').getPublicUrl(path);
                  update('logo_url', urlData.publicUrl);
                }} />
              </label>
            )}
          </div>
          <div className="flex-1 space-y-2">
            <Input value={form.name || ''} onChange={e => update('name', e.target.value)} placeholder="Nome do produto" className="text-2xl font-bold border-none shadow-none px-0 focus-visible:ring-0 h-auto" readOnly={!isOwner} />
            <Textarea value={form.description || ''} onChange={e => update('description', e.target.value)} placeholder="Descrição curta do produto..." className="border-none shadow-none px-0 focus-visible:ring-0 resize-none min-h-[60px]" readOnly={!isOwner} />
          </div>
        </div>

        {/* Properties Card */}
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Status</Label>
                <Select value={form.status || 'em_ideia'} onValueChange={v => update('status', v)} disabled={!isOwner}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Tipo de Produto</Label>
                <Select value={form.product_type || ''} onValueChange={v => update('product_type', v)} disabled={!isOwner}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>{PRODUCT_TYPE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Escada</Label>
                <Select value={form.escada || ''} onValueChange={v => update('escada', v)} disabled={!isOwner}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>{ESCADA_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Tipo de Vendas</Label>
                <Select value={form.sales_type || ''} onValueChange={v => update('sales_type', v)} disabled={!isOwner}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>{SALES_TYPE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Tipo de Ticket</Label>
                <Select value={(form as any).ticket_type || 'fixo'} onValueChange={v => update('ticket_type', v)} disabled={!isOwner}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixo">Fixo</SelectItem>
                    <SelectItem value="variavel">Variável</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {((form as any).ticket_type || 'fixo') === 'fixo' ? (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Ticket (€)</Label>
                  <Input value={form.ticket || ''} onChange={e => update('ticket', e.target.value)} placeholder="Ex: 480€" className="h-9" readOnly={!isOwner} />
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Ticket Médio (€)</Label>
                  <Input value={form.ticket || ''} onChange={e => update('ticket', e.target.value)} placeholder="Ex: 400-480€" className="h-9" readOnly={!isOwner} />
                </div>
              )}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Horas mensais por cliente</Label>
                <Input type="number" value={form.monthly_hours_per_client ?? ''} onChange={e => update('monthly_hours_per_client', e.target.value ? Number(e.target.value) : null)} placeholder="Ex: 20" className="h-9" readOnly={!isOwner} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Máx. clientes em simultâneo</Label>
                <Input type="number" min={0} value={(form as any).max_simultaneous_clients ?? ''} onChange={e => update('max_simultaneous_clients', e.target.value ? Number(e.target.value) : null)} placeholder="Ex: 10" className="h-9" readOnly={!isOwner} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Tempo de Acesso</Label>
                <div className="flex items-center gap-2">
                  <Input type="number" min={0} placeholder="Ex: 90" value={form.cycle_duration ?? ''} onChange={e => update('cycle_duration', e.target.value ? parseInt(e.target.value) : null)} className="h-9" readOnly={!isOwner} />
                  <span className="text-xs text-muted-foreground shrink-0">dias</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Página de Vendas</Label>
                <div className="flex items-center gap-1">
                  <Input value={form.sales_page_url || ''} onChange={e => update('sales_page_url', e.target.value)} placeholder="https://..." className="h-9" readOnly={!isOwner} />
                  {form.sales_page_url && <a href={form.sales_page_url} target="_blank" rel="noopener noreferrer" className="shrink-0"><ExternalLink className="h-4 w-4 text-primary" /></a>}
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Drive</Label>
                <div className="flex items-center gap-1">
                  <Input value={form.drive_url || ''} onChange={e => update('drive_url', e.target.value)} placeholder="https://..." className="h-9" readOnly={!isOwner} />
                  {form.drive_url && <a href={form.drive_url} target="_blank" rel="noopener noreferrer" className="shrink-0"><ExternalLink className="h-4 w-4 text-primary" /></a>}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sobre o Produto */}
        <Card>
          <CardHeader><CardTitle className="text-base">Sobre o Produto</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <RichTextEditor content={form.about_content || ''} onChange={v => update('about_content', v)} editable={isOwner} />
            <div>
              <h4 className="text-sm font-semibold mb-2">O que está incluído</h4>
              {includedItems.map((item, i) => (
                <div key={i} className="flex gap-2 mb-1">
                  <Input value={item} onChange={e => { const next = [...includedItems]; next[i] = e.target.value; update('included_items', next); }} className="h-8 text-sm" readOnly={!isOwner} />
                  {isOwner && <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => update('included_items', includedItems.filter((_, j) => j !== i))}><X className="h-3 w-3" /></Button>}
                </div>
              ))}
              {isOwner && <Button variant="outline" size="sm" className="mt-1" onClick={() => update('included_items', [...includedItems, ''])}><Plus className="h-3 w-3 mr-1" /> Adicionar item</Button>}
            </div>
            <div>
              <h4 className="text-sm font-semibold mb-2">FAQ's</h4>
              <Accordion type="multiple" className="w-full">
                {faqs.map((faq, i) => (
                  <AccordionItem key={i} value={`faq-${i}`}>
                    <AccordionTrigger className="text-sm">
                      <Input value={faq.question} onChange={e => { const next = [...faqs]; next[i] = { ...next[i], question: e.target.value }; update('faqs', next); }} placeholder={`Pergunta ${i + 1}`} className="border-none shadow-none h-auto p-0 focus-visible:ring-0 text-sm" onClick={e => e.stopPropagation()} readOnly={!isOwner} />
                    </AccordionTrigger>
                    <AccordionContent>
                      <Textarea value={faq.answer} onChange={e => { const next = [...faqs]; next[i] = { ...next[i], answer: e.target.value }; update('faqs', next); }} placeholder="Resposta..." className="min-h-[60px]" readOnly={!isOwner} />
                      {isOwner && <Button variant="ghost" size="sm" className="mt-1 text-destructive" onClick={() => update('faqs', faqs.filter((_, j) => j !== i))}><Trash2 className="h-3 w-3 mr-1" /> Remover</Button>}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
              {isOwner && <Button variant="outline" size="sm" className="mt-2" onClick={() => update('faqs', [...faqs, { question: '', answer: '' }])}><Plus className="h-3 w-3 mr-1" /> Adicionar FAQ</Button>}
            </div>
          </CardContent>
        </Card>

        {/* Feedbacks */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Feedbacks</CardTitle>
            {isOwner && <Button size="sm" variant="outline" onClick={() => addRow.mutate({ table: 'product_feedbacks', data: { product_id: id, feedback: '', client_name: '' } })}><Plus className="h-3 w-3 mr-1" /> Adicionar</Button>}
          </CardHeader>
          <CardContent className="space-y-4">
            {feedbacks.length === 0 && <p className="text-center text-muted-foreground py-4">Sem feedbacks</p>}
            {feedbacks.map((f: Record<string, unknown>) => (
              <div key={f.id as string} className="border rounded-lg p-4 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Feedback</Label>
                    <Textarea defaultValue={f.feedback as string} onBlur={e => updateRow.mutate({ table: 'product_feedbacks', id: f.id as string, data: { feedback: e.target.value } })} className="min-h-[60px] text-sm" readOnly={!isOwner} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Cliente</Label>
                    <Input defaultValue={f.client_name as string} onBlur={e => updateRow.mutate({ table: 'product_feedbacks', id: f.id as string, data: { client_name: e.target.value } })} className="h-9" readOnly={!isOwner} />
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Imagem / Print</Label>
                  {f.image_url ? (
                    <div className="relative group inline-block">
                      <img src={f.image_url as string} alt="Feedback" className="max-h-48 rounded-md border object-contain" />
                      {isOwner && <Button variant="destructive" size="icon" className="h-6 w-6 absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => updateRow.mutate({ table: 'product_feedbacks', id: f.id as string, data: { image_url: null } })}><X className="h-3 w-3" /></Button>}
                    </div>
                  ) : isOwner ? (
                    <label className="flex items-center gap-2 px-3 py-2 border border-dashed rounded-md cursor-pointer hover:bg-muted/50 transition-colors w-fit">
                      <Upload className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Carregar imagem</span>
                      <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const path = `feedbacks/${f.id}-${Date.now()}.${file.name.split('.').pop()}`;
                        const { error } = await supabase.storage.from('product-files').upload(path, file, { upsert: true });
                        if (error) { toast.error('Erro ao enviar imagem'); return; }
                        const { data: urlData } = supabase.storage.from('product-files').getPublicUrl(path);
                        updateRow.mutate({ table: 'product_feedbacks', id: f.id as string, data: { image_url: urlData.publicUrl } });
                      }} />
                    </label>
                  ) : <p className="text-xs text-muted-foreground">Sem imagem</p>}
                </div>
                {isOwner && <div className="flex justify-end"><Button variant="ghost" size="sm" className="text-destructive" onClick={() => deleteRow.mutate({ table: 'product_feedbacks', id: f.id as string })}><Trash2 className="h-3 w-3 mr-1" /> Remover</Button></div>}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Datas Importantes */}
        <Card className="bg-background border-secondary">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Datas Importantes</CardTitle>
            {isOwner && <Button size="sm" variant="outline" onClick={() => setShowEventDialog(true)}><Plus className="h-3.5 w-3.5 mr-1" />Adicionar Evento</Button>}
          </CardHeader>
          <CardContent>
            {productEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Sem datas importantes associadas a este produto na Agenda.</p>
            ) : (
              <Table>
                <TableHeader><TableRow><TableHead>Evento</TableHead><TableHead>Data / Hora</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {productEvents.map((ev: Record<string, unknown>) => {
                    const st = getEventStatus(ev);
                    return (
                      <TableRow key={ev.id as string} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate('/hub/agenda')}>
                        <TableCell className="font-medium">{ev.title as string}</TableCell>
                        <TableCell className="text-sm">
                          {format(parseISO(ev.start_date as string), 'dd/MM/yyyy HH:mm')}
                          {ev.end_date && ` — ${format(parseISO(ev.end_date as string), 'dd/MM/yyyy HH:mm')}`}
                        </TableCell>
                        <TableCell><Badge className={cn('text-xs', st.color)}>{st.label}</Badge></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Dialog open={showEventDialog} onOpenChange={setShowEventDialog}>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo Evento — {form.name}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Título</Label>
                <Input value={newEvent.title} onChange={e => setNewEvent(p => ({ ...p, title: e.target.value }))} placeholder="Ex: Lançamento do produto" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5"><Label>Data / Hora Início</Label><Input type="datetime-local" value={newEvent.start_date} onChange={e => setNewEvent(p => ({ ...p, start_date: e.target.value }))} /></div>
                <div className="space-y-1.5"><Label>Data / Hora Fim (opcional)</Label><Input type="datetime-local" value={newEvent.end_date} onChange={e => setNewEvent(p => ({ ...p, end_date: e.target.value }))} /></div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEventDialog(false)}>Cancelar</Button>
              <Button onClick={createProductEvent}>Criar Evento</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ═══ SECTION BUTTONS ═══ */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <SectionButton sectionKey="clientes-vendas" label="Clientes e Vendas" />
            <SectionButton sectionKey="entregas" label="Entregas" />
            <SectionButton sectionKey="comercial" label="Comercial" />
            <SectionButton sectionKey="marketing" label="Marketing" />
            <SectionButton sectionKey="contabilidade" label="Contabilidade" />
            <SectionButton sectionKey="processos" label="Processos" />
            <SectionButton sectionKey="backoffice" label="Backoffice" />
            <SectionButton sectionKey="customer-success" label="Customer Success" />
            <SectionButton sectionKey="metricas" label="Métricas" />
            <SectionButton sectionKey="arquivo" label="Arquivo" />
          </div>

          {openSection === 'clientes-vendas' && (
            <ProductSalesTab productName={form.name || ''} />
          )}

          {openSection === 'entregas' && (
            <ProductEntregasSection
              deliverableTemplates={deliverableTemplates as Array<{ id: string; name: string; description?: string; is_recurring?: boolean }>}
              isOwner={isOwner}
              productId={id!}
              onAdd={() => addRow.mutate({ table: 'product_deliverable_templates', data: { product_id: id, name: '', sort_order: deliverableTemplates.length } })}
              onUpdate={(rowId, data) => updateRow.mutate({ table: 'product_deliverable_templates', id: rowId, data })}
              onDelete={(rowId) => deleteRow.mutate({ table: 'product_deliverable_templates', id: rowId })}
            />
          )}

          {openSection === 'comercial' && (
            <ProductComercialSection
              clientProfile={clientProfile}
              competitors={competitors}
              salesActions={salesActions}
              isOwner={isOwner}
              productName={form.name || ''}
              onUpdateClientProfile={(key, val) => update('client_profile', { ...(clientProfile as Record<string, unknown>), [key]: val })}
              onUpdateCompetitors={(c) => update('competitors', c)}
              onAddSalesAction={() => addRow.mutate({ table: 'commercial_sales_actions', data: { action_name: `Nova Ação — ${form.name}`, product: form.name, status: 'planeada', action_type: 'campanha' } })}
            />
          )}

          {openSection === 'marketing' && (
            <ProductMarketingSection
              productContents={productContents}
              funnels={funnels}
              automations={automations}
              trafficAds={trafficAds}
              isOwner={isOwner}
              productName={form.name || ''}
              onAddFunnel={() => addRow.mutate({ table: 'marketing_funnels', data: { name: `Funil — ${form.name}`, product_name: form.name } })}
              onAddAutomation={() => addRow.mutate({ table: 'marketing_automations', data: { name: `Automação — ${form.name}`, product_name: form.name } })}
              onAddTrafficAd={() => addRow.mutate({ table: 'traffic_creatives', data: { name: `Criativo — ${form.name}`, product_name: form.name } })}
              onDeleteRow={(table, rowId) => deleteRow.mutate({ table, id: rowId })}
            />
          )}

          {openSection === 'contabilidade' && (
            <ProductContabilidadeSection
              form={form as Record<string, unknown>}
              costs={costs}
              isOwner={isOwner}
              productId={id!}
              onUpdateField={(field, value) => update(field, value)}
              onAddCost={() => { if (!id) { toast.error('Guarda o produto primeiro'); return; } addRow.mutate({ table: 'product_costs', data: { product_id: id, name: '', usage_desc: '', value: 0 } }); }}
              onUpdateCost={(costId, data) => updateRow.mutate({ table: 'product_costs', id: costId, data })}
              onDeleteCost={(costId) => deleteRow.mutate({ table: 'product_costs', id: costId })}
            />
          )}

          {openSection === 'processos' && (
            <ProductProcessosSection
              productSops={productSops}
              projectTemplate={projectTemplate}
              isOwner={isOwner}
              productId={id!}
              onAddProjectTask={() => addRow.mutate({ table: 'product_project_templates', data: { product_id: id, task_name: '' } })}
              onUpdateRow={(table, rowId, data) => updateRow.mutate({ table, id: rowId, data })}
              onDeleteRow={(table, rowId) => deleteRow.mutate({ table, id: rowId })}
            />
          )}

          {openSection === 'backoffice' && (
            <ProductBackofficeSection
              usefulLinks={usefulLinks}
              improvements={improvements}
              productMeetings={productMeetings}
              isOwner={isOwner}
              productId={id!}
              onAddLink={() => addRow.mutate({ table: 'product_useful_links', data: { product_id: id, name: '', url: '' } })}
              onAddImprovement={() => addRow.mutate({ table: 'product_improvements', data: { product_id: id, description: '', completed: false, sort_order: improvements.length } })}
              onUpdateRow={(table, rowId, data) => updateRow.mutate({ table, id: rowId, data })}
              onDeleteRow={(table, rowId) => deleteRow.mutate({ table, id: rowId })}
            />
          )}

          {openSection === 'customer-success' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-200">
              <ProductCustomerSuccess productId={id!} productName={form.name || ''} isOwner={isOwner} />
            </div>
          )}

          {openSection === 'metricas' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-200">
              <ProductMetricsTab productId={id!} productName={form.name || ''} isOwner={isOwner} />
            </div>
          )}

          {openSection === 'arquivo' && (
            <ProductArquivoSection
              productDocuments={productDocuments}
              archiveNotes={form.archive_notes || ''}
              brainstormingContent={form.brainstorming_content || ''}
              isOwner={isOwner}
              productId={id!}
              onUpdateField={(field, value) => update(field, value)}
            />
          )}
        </div>
      </div>
    </AppLayout>
  );
}
