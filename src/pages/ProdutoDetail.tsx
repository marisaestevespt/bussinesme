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
import { ArrowLeft, Copy, Trash2, Plus, ExternalLink, X, Upload, ImageIcon, ChevronDown } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { useProduct, useProducts, STATUS_OPTIONS, ESCADA_OPTIONS, PRODUCT_TYPE_OPTIONS, SALES_TYPE_OPTIONS, Product } from '@/hooks/useProducts';
import { useAuth } from '@/hooks/useAuth';
import { RichTextEditor } from '@/components/RichTextEditor';
import { OfferCalculator } from '@/components/product/OfferCalculator';
import { ProductKPIsTab } from '@/components/product/ProductKPIsTab';
import { ProductMetricsTab } from '@/components/product/ProductMetricsTab';
import { ProductCustomerSuccess } from '@/components/product/ProductCustomerSuccess';
import { format, parseISO, isPast, isFuture, isToday } from 'date-fns';
import { BackNavigation } from '@/components/BackNavigation';
import { cn } from '@/lib/utils';

const SOP_STATUSES: Record<string, { label: string; color: string }> = {
  para_criar: { label: 'Para criar', color: 'bg-muted text-muted-foreground' },
  em_criacao: { label: 'Em criação', color: 'bg-amber-100 text-amber-800 border-amber-200' },
  ativo: { label: 'Ativo', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  em_revisao: { label: 'Em revisão', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  off: { label: 'Off', color: 'bg-red-100 text-red-800 border-red-200' },
};

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

  const update = (field: string, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const save = async () => {
    if (!form.name?.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }
    try {
      const newId = await upsertProduct.mutateAsync(form as any);
      toast.success('Produto guardado');
      if (isNew && newId) navigate(`/hub/produtos/${newId}`, { replace: true });
    } catch { }
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

  const fmt = (v: number) => v.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Sub-table hooks
  const { data: feedbacks = [] } = useQuery({
    queryKey: ['product-feedbacks', id],
    queryFn: async () => {
      if (!id || isNew) return [];
      const { data } = await supabase.from('product_feedbacks').select('*').eq('product_id', id).order('created_at');
      return data || [];
    },
    enabled: !isNew,
  });

  const { data: funnels = [] } = useQuery({
    queryKey: ['marketing-funnels-product', form.name],
    queryFn: async () => {
      if (!form.name) return [];
      const { data } = await supabase.from('marketing_funnels').select('*').eq('product_name', form.name).order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!form.name,
  });

  const { data: automations = [] } = useQuery({
    queryKey: ['marketing-automations-product', form.name],
    queryFn: async () => {
      if (!form.name) return [];
      const { data } = await supabase.from('marketing_automations').select('*').eq('product_name', form.name).order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!form.name,
  });

  const { data: trafficAds = [] } = useQuery({
    queryKey: ['traffic-creatives-product', form.name],
    queryFn: async () => {
      if (!form.name) return [];
      const { data } = await supabase.from('traffic_creatives').select('*').eq('product_name', form.name).order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!form.name,
  });

  const { data: usefulLinks = [] } = useQuery({
    queryKey: ['product-useful-links', id],
    queryFn: async () => {
      if (!id || isNew) return [];
      const { data } = await supabase.from('product_useful_links').select('*').eq('product_id', id).order('sort_order');
      return data || [];
    },
    enabled: !isNew,
  });

  const { data: costs = [] } = useQuery({
    queryKey: ['product-costs', id],
    queryFn: async () => {
      if (!id || isNew) return [];
      const { data } = await supabase.from('product_costs').select('*').eq('product_id', id).order('sort_order');
      return data || [];
    },
    enabled: !isNew,
  });

  const { data: onboardingTemplate = [] } = useQuery({
    queryKey: ['product-onboarding-template', id],
    queryFn: async () => {
      if (!id || isNew) return [];
      const { data } = await supabase.from('product_onboarding_templates' as any).select('*').eq('product_id', id).order('sort_order');
      return data || [];
    },
    enabled: !isNew,
  });

  const { data: offboardingTemplate = [] } = useQuery({
    queryKey: ['product-offboarding-template', id],
    queryFn: async () => {
      if (!id || isNew) return [];
      const { data } = await supabase.from('product_offboarding_templates' as any).select('*').eq('product_id', id).order('sort_order');
      return data || [];
    },
    enabled: !isNew,
  });

  const { data: projectTemplate = [] } = useQuery({
    queryKey: ['product-project-template', id],
    queryFn: async () => {
      if (!id || isNew) return [];
      const { data } = await supabase.from('product_project_templates' as any).select('*').eq('product_id', id).order('sort_order');
      return data || [];
    },
    enabled: !isNew,
  });

  const { data: productPaymentMethods = [] } = useQuery({
    queryKey: ['product-payment-methods', id],
    queryFn: async () => {
      if (!id || isNew) return [];
      const { data } = await supabase.from('product_payment_methods' as any).select('*').eq('product_id', id);
      return (data || []) as any[];
    },
    enabled: !isNew,
  });

  const { data: salesActions = [] } = useQuery({
    queryKey: ['product-sales-actions', form.name],
    queryFn: async () => {
      if (!form.name) return [];
      const { data } = await supabase.from('commercial_sales_actions').select('*').eq('product', form.name).order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!form.name,
  });

  // Events linked to this product (Datas Importantes)
  const { data: improvements = [] } = useQuery({
    queryKey: ['product-improvements', id],
    queryFn: async () => {
      if (!id || isNew) return [];
      const { data } = await supabase.from('product_improvements' as any).select('*').eq('product_id', id).order('sort_order').order('created_at');
      return (data || []) as any[];
    },
    enabled: !isNew,
  });

  const { data: productSops = [] } = useQuery({
    queryKey: ['linked-sops', 'produto', id],
    queryFn: async () => {
      if (!id || isNew) return [];
      const { data } = await supabase.from('sops').select('*').eq('linked_entity_type', 'produto').eq('linked_entity_id', id).order('sort_order') as any;
      return data || [];
    },
    enabled: !isNew && !!id,
  });

  const { data: productEvents = [] } = useQuery({
    queryKey: ['product-events', form.name],
    queryFn: async () => {
      if (!form.name) return [];
      const { data } = await supabase.from('events').select('id, title, start_date, end_date').eq('product_name', form.name).order('start_date', { ascending: true });
      return data || [];
    },
    enabled: !!form.name,
  });

  // Mutations for sub-tables
  const invalidateSub = () => {
    qc.invalidateQueries({ queryKey: ['product-feedbacks', id] });
    qc.invalidateQueries({ queryKey: ['marketing-funnels-product', form.name] });
    qc.invalidateQueries({ queryKey: ['marketing-automations-product', form.name] });
    qc.invalidateQueries({ queryKey: ['traffic-creatives-product', form.name] });
    qc.invalidateQueries({ queryKey: ['marketing-funnels'] });
    qc.invalidateQueries({ queryKey: ['marketing-automations'] });
    qc.invalidateQueries({ queryKey: ['traffic-creatives'] });
    qc.invalidateQueries({ queryKey: ['product-useful-links', id] });
    qc.invalidateQueries({ queryKey: ['product-costs', id] });
    qc.invalidateQueries({ queryKey: ['product-onboarding-template', id] });
    qc.invalidateQueries({ queryKey: ['product-improvements', id] });
  };

  const addRow = useMutation({
    mutationFn: async ({ table, data }: { table: string; data: any }) => {
      const { error } = await supabase.from(table as any).insert(data);
      if (error) throw error;
    },
    onSuccess: invalidateSub,
    onError: () => toast.error('Erro ao adicionar registo'),
  });

  const updateRow = useMutation({
    mutationFn: async ({ table, id: rowId, data }: { table: string; id: string; data: any }) => {
      const { error } = await supabase.from(table as any).update(data).eq('id', rowId);
      if (error) throw error;
    },
    onSuccess: invalidateSub,
  });

  const deleteRow = useMutation({
    mutationFn: async ({ table, id: rowId }: { table: string; id: string }) => {
      const { error } = await supabase.from(table as any).delete().eq('id', rowId);
      if (error) throw error;
    },
    onSuccess: invalidateSub,
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

  // JSONB helpers
  const includedItems: string[] = Array.isArray(form.included_items) ? form.included_items : [];
  const faqs: { question: string; answer: string }[] = Array.isArray(form.faqs) ? form.faqs : [];
  const clientProfile = form.client_profile || {};
  const competitors: { name: string; notes: string }[] = Array.isArray(form.competitors) ? form.competitors : [];

  const updateIncludedItems = (items: string[]) => update('included_items', items);
  const updateFaqs = (f: any[]) => update('faqs', f);
  const updateClientProfile = (key: string, val: string[]) => update('client_profile', { ...clientProfile, [key]: val });
  const updateCompetitors = (c: any[]) => update('competitors', c);

  const toggleSection = (key: string) => setOpenSection(prev => prev === key ? null : key);

  const getEventStatus = (ev: any) => {
    const start = parseISO(ev.start_date);
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
    } as any);
    if (error) { toast.error('Erro ao criar evento'); return; }
    qc.invalidateQueries({ queryKey: ['product-events', form.name] });
    setShowEventDialog(false);
    setNewEvent({ title: '', start_date: '', end_date: '' });
    toast.success('Evento criado na Agenda');
  };

  // Section button component
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
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const path = `covers/${id || 'new'}-${Date.now()}.${file.name.split('.').pop()}`;
                  const { error } = await supabase.storage.from('product-files').upload(path, file, { upsert: true });
                  if (error) { toast.error('Erro ao enviar imagem'); return; }
                  const { data: urlData } = supabase.storage.from('product-files').getPublicUrl(path);
                  update('cover_url', urlData.publicUrl);
                }}
              />
            </label>
          )}
        </div>

        {/* Logo + Name & Description */}
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
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const path = `logos/${id || 'new'}-${Date.now()}.${file.name.split('.').pop()}`;
                    const { error } = await supabase.storage.from('product-files').upload(path, file, { upsert: true });
                    if (error) { toast.error('Erro ao enviar logo'); return; }
                    const { data: urlData } = supabase.storage.from('product-files').getPublicUrl(path);
                    update('logo_url', urlData.publicUrl);
                  }}
                />
              </label>
            )}
          </div>

          <div className="flex-1 space-y-2">
            <Input
              value={form.name || ''}
              onChange={e => update('name', e.target.value)}
              placeholder="Nome do produto"
              className="text-2xl font-bold border-none shadow-none px-0 focus-visible:ring-0 h-auto"
              readOnly={!isOwner}
            />
            <Textarea
              value={form.description || ''}
              onChange={e => update('description', e.target.value)}
              placeholder="Descrição curta do produto..."
              className="border-none shadow-none px-0 focus-visible:ring-0 resize-none min-h-[60px]"
              readOnly={!isOwner}
            />
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
                  <SelectContent>
                    {STATUS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Tipo de Produto</Label>
                <Select value={form.product_type || ''} onValueChange={v => update('product_type', v)} disabled={!isOwner}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>
                    {PRODUCT_TYPE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Escada</Label>
                <Select value={form.escada || ''} onValueChange={v => update('escada', v)} disabled={!isOwner}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>
                    {ESCADA_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Tipo de Vendas</Label>
                <Select value={form.sales_type || ''} onValueChange={v => update('sales_type', v)} disabled={!isOwner}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>
                    {SALES_TYPE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Ticket (€)</Label>
                <Input value={form.ticket || ''} onChange={e => update('ticket', e.target.value)} placeholder="Ex: 400-480€" className="h-9" readOnly={!isOwner} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Horas mensais por cliente</Label>
                <Input type="number" value={form.monthly_hours_per_client ?? ''} onChange={e => update('monthly_hours_per_client', e.target.value ? Number(e.target.value) : null)} placeholder="Ex: 20" className="h-9" readOnly={!isOwner} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Tempo de Acesso</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    placeholder="Ex: 90"
                    value={form.cycle_duration ?? ''}
                    onChange={e => update('cycle_duration', e.target.value ? parseInt(e.target.value) : null)}
                    className="h-9"
                    readOnly={!isOwner}
                  />
                  <span className="text-xs text-muted-foreground shrink-0">dias</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Página de Vendas</Label>
                <div className="flex items-center gap-1">
                  <Input value={form.sales_page_url || ''} onChange={e => update('sales_page_url', e.target.value)} placeholder="https://..." className="h-9" readOnly={!isOwner} />
                  {form.sales_page_url && (
                    <a href={form.sales_page_url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                      <ExternalLink className="h-4 w-4 text-primary" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sobre o Produto + Incluído + FAQs */}
        <Card>
          <CardHeader><CardTitle className="text-base">Sobre o Produto</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <RichTextEditor
              content={form.about_content || ''}
              onChange={v => update('about_content', v)}
              editable={isOwner}
            />

            <div>
              <h4 className="text-sm font-semibold mb-2">O que está incluído</h4>
              {includedItems.map((item, i) => (
                <div key={i} className="flex gap-2 mb-1">
                  <Input
                    value={item}
                    onChange={e => {
                      const next = [...includedItems];
                      next[i] = e.target.value;
                      updateIncludedItems(next);
                    }}
                    className="h-8 text-sm"
                    readOnly={!isOwner}
                  />
                  {isOwner && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => updateIncludedItems(includedItems.filter((_, j) => j !== i))}>
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              ))}
              {isOwner && (
                <Button variant="outline" size="sm" className="mt-1" onClick={() => updateIncludedItems([...includedItems, ''])}>
                  <Plus className="h-3 w-3 mr-1" /> Adicionar item
                </Button>
              )}
            </div>

            <div>
              <h4 className="text-sm font-semibold mb-2">FAQ's</h4>
              <Accordion type="multiple" className="w-full">
                {faqs.map((faq, i) => (
                  <AccordionItem key={i} value={`faq-${i}`}>
                    <AccordionTrigger className="text-sm">
                      <Input
                        value={faq.question}
                        onChange={e => {
                          const next = [...faqs];
                          next[i] = { ...next[i], question: e.target.value };
                          updateFaqs(next);
                        }}
                        placeholder={`Pergunta ${i + 1}`}
                        className="border-none shadow-none h-auto p-0 focus-visible:ring-0 text-sm"
                        onClick={e => e.stopPropagation()}
                        readOnly={!isOwner}
                      />
                    </AccordionTrigger>
                    <AccordionContent>
                      <Textarea
                        value={faq.answer}
                        onChange={e => {
                          const next = [...faqs];
                          next[i] = { ...next[i], answer: e.target.value };
                          updateFaqs(next);
                        }}
                        placeholder="Resposta..."
                        className="min-h-[60px]"
                        readOnly={!isOwner}
                      />
                      {isOwner && (
                        <Button variant="ghost" size="sm" className="mt-1 text-destructive" onClick={() => updateFaqs(faqs.filter((_, j) => j !== i))}>
                          <Trash2 className="h-3 w-3 mr-1" /> Remover
                        </Button>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
              {isOwner && (
                <Button variant="outline" size="sm" className="mt-2" onClick={() => updateFaqs([...faqs, { question: '', answer: '' }])}>
                  <Plus className="h-3 w-3 mr-1" /> Adicionar FAQ
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Feedbacks */}
        {(
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-base">Feedbacks</CardTitle>
              {isOwner && (
                <Button size="sm" variant="outline" onClick={() => addRow.mutate({ table: 'product_feedbacks', data: { product_id: id, feedback: '', client_name: '' } })}>
                  <Plus className="h-3 w-3 mr-1" /> Adicionar
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {feedbacks.length === 0 && (
                <p className="text-center text-muted-foreground py-4">Sem feedbacks</p>
              )}
              {feedbacks.map((f: any) => (
                <div key={f.id} className="border rounded-lg p-4 space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Feedback</Label>
                      <Textarea
                        defaultValue={f.feedback}
                        onBlur={e => updateRow.mutate({ table: 'product_feedbacks', id: f.id, data: { feedback: e.target.value } })}
                        className="min-h-[60px] text-sm"
                        readOnly={!isOwner}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Cliente</Label>
                      <Input
                        defaultValue={f.client_name}
                        onBlur={e => updateRow.mutate({ table: 'product_feedbacks', id: f.id, data: { client_name: e.target.value } })}
                        className="h-9"
                        readOnly={!isOwner}
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Imagem / Print</Label>
                    {f.image_url ? (
                      <div className="relative group inline-block">
                        <img src={f.image_url} alt="Feedback" className="max-h-48 rounded-md border object-contain" />
                        {isOwner && (
                          <Button
                            variant="destructive"
                            size="icon"
                            className="h-6 w-6 absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => updateRow.mutate({ table: 'product_feedbacks', id: f.id, data: { image_url: null } })}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    ) : isOwner ? (
                      <label className="flex items-center gap-2 px-3 py-2 border border-dashed rounded-md cursor-pointer hover:bg-muted/50 transition-colors w-fit">
                        <Upload className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Carregar imagem</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const path = `feedbacks/${f.id}-${Date.now()}.${file.name.split('.').pop()}`;
                            const { error } = await supabase.storage.from('product-files').upload(path, file, { upsert: true });
                            if (error) { toast.error('Erro ao enviar imagem'); return; }
                            const { data: urlData } = supabase.storage.from('product-files').getPublicUrl(path);
                            updateRow.mutate({ table: 'product_feedbacks', id: f.id, data: { image_url: urlData.publicUrl } });
                          }}
                        />
                      </label>
                    ) : (
                      <p className="text-xs text-muted-foreground">Sem imagem</p>
                    )}
                  </div>
                  {isOwner && (
                    <div className="flex justify-end">
                      <Button variant="ghost" size="sm" className="text-destructive" onClick={() => deleteRow.mutate({ table: 'product_feedbacks', id: f.id })}>
                        <Trash2 className="h-3 w-3 mr-1" /> Remover
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Datas Importantes — from Agenda */}
        {(
          <>
          <Card className="bg-background border-secondary">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Datas Importantes</CardTitle>
              {isOwner && (
                <Button size="sm" variant="outline" onClick={() => setShowEventDialog(true)}>
                  <Plus className="h-3.5 w-3.5 mr-1" />Adicionar Evento
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {productEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Sem datas importantes associadas a este produto na Agenda.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Evento</TableHead>
                      <TableHead>Data / Hora</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {productEvents.map((ev: any) => {
                      const st = getEventStatus(ev);
                      return (
                        <TableRow key={ev.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate('/hub/agenda')}>
                          <TableCell className="font-medium">{ev.title}</TableCell>
                          <TableCell className="text-sm">
                            {format(parseISO(ev.start_date), 'dd/MM/yyyy HH:mm')}
                            {ev.end_date && ` — ${format(parseISO(ev.end_date), 'dd/MM/yyyy HH:mm')}`}
                          </TableCell>
                          <TableCell>
                            <Badge className={cn('text-xs', st.color)}>{st.label}</Badge>
                          </TableCell>
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
              <DialogHeader>
                <DialogTitle>Novo Evento — {form.name}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Título</Label>
                  <Input value={newEvent.title} onChange={e => setNewEvent(p => ({ ...p, title: e.target.value }))} placeholder="Ex: Lançamento do produto" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Data / Hora Início</Label>
                    <Input type="datetime-local" value={newEvent.start_date} onChange={e => setNewEvent(p => ({ ...p, start_date: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Data / Hora Fim (opcional)</Label>
                    <Input type="datetime-local" value={newEvent.end_date} onChange={e => setNewEvent(p => ({ ...p, end_date: e.target.value }))} />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowEventDialog(false)}>Cancelar</Button>
                <Button onClick={createProductEvent}>Criar Evento</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          </>
        )}

        {/* Processos moved to section button */}

        {/* ═══════ SECTION BUTTONS ═══════ */}
        {(
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              <SectionButton sectionKey="comercial" label="Comercial & Mkt" />
              <SectionButton sectionKey="contabilidade" label="Contabilidade" />
              <SectionButton sectionKey="processos" label="Processos" />
              <SectionButton sectionKey="backoffice" label="Backoffice" />
              <SectionButton sectionKey="customer-success" label="Customer Success" />
              <SectionButton sectionKey="kpis" label="KPIs do Produto" />
              <SectionButton sectionKey="metricas" label="Métricas" />
              <SectionButton sectionKey="arquivo" label="Arquivo" />
            </div>

            {/* ===== COMERCIAL & MKT ===== */}
            {openSection === 'comercial' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-200">
                {/* Ações de Venda */}
                <Card>
                  <CardHeader className="flex-row items-center justify-between">
                    <CardTitle className="text-base">Ações de Venda</CardTitle>
                    {isOwner && (
                      <Button size="sm" variant="outline" onClick={() => addRow.mutate({ table: 'commercial_sales_actions', data: { action_name: `Nova Ação — ${form.name}`, product: form.name, status: 'planeada', action_type: 'campanha' } })}>
                        <Plus className="h-3 w-3 mr-1" /> Nova Ação
                      </Button>
                    )}
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Status</TableHead>
                          <TableHead>Ação</TableHead>
                          <TableHead>Data/Período</TableHead>
                          <TableHead>Produto</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {salesActions.length === 0 && (
                          <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-4">Sem ações para este produto</TableCell></TableRow>
                        )}
                        {salesActions.map((a: any) => (
                          <TableRow key={a.id}>
                            <TableCell><Badge variant="outline" className="text-xs">{a.status}</Badge></TableCell>
                            <TableCell className="font-medium">{a.action_name}</TableCell>
                            <TableCell className="text-sm">{a.start_date ? format(new Date(a.start_date), 'dd/MM/yyyy') : '—'}</TableCell>
                            <TableCell className="text-sm">{a.product || '—'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                {/* Funis */}
                <Card>
                  <CardHeader className="flex-row items-center justify-between">
                    <CardTitle className="text-base">Funis</CardTitle>
                    {isOwner && (
                      <Button size="sm" variant="outline" onClick={() => addRow.mutate({ table: 'marketing_funnels', data: { name: `Funil — ${form.name}`, product_name: form.name } })}>
                        <Plus className="h-3 w-3 mr-1" /> Novo Funil
                      </Button>
                    )}
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Status</TableHead>
                          <TableHead>Nome</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Objetivo</TableHead>
                          <TableHead>Atualização</TableHead>
                          {isOwner && <TableHead className="w-10" />}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {funnels.length === 0 && (
                          <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-4">Sem funis</TableCell></TableRow>
                        )}
                        {funnels.map((f: any) => (
                          <TableRow key={f.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/marketing/funis/${f.id}`)}>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">{f.status?.replace('_', ' ') || '—'}</Badge>
                            </TableCell>
                            <TableCell className="font-medium">{f.name}</TableCell>
                            <TableCell className="text-sm">{f.tipo_funil || '—'}</TableCell>
                            <TableCell className="text-sm">{f.objetivo || '—'}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{format(new Date(f.updated_at), 'dd/MM/yyyy')}</TableCell>
                            {isOwner && (
                              <TableCell>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={e => { e.stopPropagation(); deleteRow.mutate({ table: 'marketing_funnels', id: f.id }); }}><Trash2 className="h-3 w-3" /></Button>
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                {/* Automações */}
                <Card>
                  <CardHeader className="flex-row items-center justify-between">
                    <CardTitle className="text-base">Automações</CardTitle>
                    {isOwner && (
                      <Button size="sm" variant="outline" onClick={() => addRow.mutate({ table: 'marketing_automations', data: { name: `Automação — ${form.name}`, product_name: form.name } })}>
                        <Plus className="h-3 w-3 mr-1" /> Nova Automação
                      </Button>
                    )}
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Status</TableHead>
                          <TableHead>Nome</TableHead>
                          <TableHead>Plataforma</TableHead>
                          <TableHead>Objetivo</TableHead>
                          <TableHead>Atualização</TableHead>
                          {isOwner && <TableHead className="w-10" />}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {automations.length === 0 && (
                          <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-4">Sem automações</TableCell></TableRow>
                        )}
                        {automations.map((a: any) => (
                          <TableRow key={a.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/marketing/automacoes/${a.id}`)}>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">{a.status?.replace('_', ' ') || '—'}</Badge>
                            </TableCell>
                            <TableCell className="font-medium">{a.name}</TableCell>
                            <TableCell className="text-sm">{a.plataforma || '—'}</TableCell>
                            <TableCell className="text-sm">{a.objetivo || '—'}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{format(new Date(a.updated_at), 'dd/MM/yyyy')}</TableCell>
                            {isOwner && (
                              <TableCell>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={e => { e.stopPropagation(); deleteRow.mutate({ table: 'marketing_automations', id: a.id }); }}><Trash2 className="h-3 w-3" /></Button>
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                {/* Produtos Concorrentes */}
                <Card>
                  <CardHeader><CardTitle className="text-base">Produtos Concorrentes</CardTitle></CardHeader>
                  <CardContent>
                    <Accordion type="multiple" className="w-full">
                      {competitors.map((c, i) => (
                        <AccordionItem key={i} value={`comp-${i}`}>
                          <AccordionTrigger className="text-sm">
                            <Input
                              value={c.name}
                              onChange={e => {
                                const next = [...competitors];
                                next[i] = { ...next[i], name: e.target.value };
                                updateCompetitors(next);
                              }}
                              className="border-none shadow-none h-auto p-0 focus-visible:ring-0 text-sm font-medium"
                              onClick={e => e.stopPropagation()}
                              readOnly={!isOwner}
                            />
                          </AccordionTrigger>
                          <AccordionContent>
                            <Textarea
                              value={c.notes}
                              onChange={e => {
                                const next = [...competitors];
                                next[i] = { ...next[i], notes: e.target.value };
                                updateCompetitors(next);
                              }}
                              placeholder="Notas sobre este concorrente..."
                              className="min-h-[80px]"
                              readOnly={!isOwner}
                            />
                            {isOwner && (
                              <Button variant="ghost" size="sm" className="mt-1 text-destructive" onClick={() => updateCompetitors(competitors.filter((_, j) => j !== i))}>
                                <Trash2 className="h-3 w-3 mr-1" /> Remover
                              </Button>
                            )}
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                    {isOwner && (
                      <Button variant="outline" size="sm" className="mt-2" onClick={() => updateCompetitors([...competitors, { name: '', notes: '' }])}>
                        <Plus className="h-3 w-3 mr-1" /> Adicionar concorrente
                      </Button>
                    )}
                  </CardContent>
                </Card>

                {/* Tráfego Pago */}
                <Card>
                  <CardHeader className="flex-row items-center justify-between">
                    <CardTitle className="text-base">Tráfego Pago</CardTitle>
                    {isOwner && (
                      <Button size="sm" variant="outline" onClick={() => addRow.mutate({ table: 'traffic_creatives', data: { name: `Criativo — ${form.name}`, product_name: form.name } })}>
                        <Plus className="h-3 w-3 mr-1" /> Novo Criativo
                      </Button>
                    )}
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data Início</TableHead>
                          <TableHead>Nome</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Formato</TableHead>
                          <TableHead>Objetivo</TableHead>
                          <TableHead>Link</TableHead>
                          {isOwner && <TableHead className="w-10" />}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {trafficAds.length === 0 && (
                          <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-4">Sem criativos</TableCell></TableRow>
                        )}
                        {trafficAds.map((ad: any) => (
                          <TableRow key={ad.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/marketing/trafego-pago/criativo/${ad.id}`)}>
                            <TableCell className="text-sm">{ad.start_date ? format(new Date(ad.start_date), 'dd/MM/yyyy') : '—'}</TableCell>
                            <TableCell className="font-medium">{ad.name}</TableCell>
                            <TableCell><Badge variant="outline" className="text-xs">{ad.status?.replace('_', ' ') || '—'}</Badge></TableCell>
                            <TableCell className="text-sm">{ad.formato || '—'}</TableCell>
                            <TableCell className="text-sm">{ad.objetivo || '—'}</TableCell>
                            <TableCell>{ad.link ? <a href={ad.link} target="_blank" rel="noopener noreferrer" className="text-primary text-xs" onClick={e => e.stopPropagation()}><ExternalLink className="h-3 w-3" /></a> : '—'}</TableCell>
                            {isOwner && (
                              <TableCell>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={e => { e.stopPropagation(); deleteRow.mutate({ table: 'traffic_creatives', id: ad.id }); }}><Trash2 className="h-3 w-3" /></Button>
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* ===== CONTABILIDADE ===== */}
            {openSection === 'contabilidade' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-200">
                <Card>
                  <CardHeader><CardTitle className="text-base">Dados de Faturação</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Taxa de IVA</Label>
                        <Select value={(form as any).vat_rate || '23'} onValueChange={v => update('vat_rate', v)} disabled={!isOwner}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="isento">Isento</SelectItem>
                            <SelectItem value="6">6%</SelectItem>
                            <SelectItem value="13">13%</SelectItem>
                            <SelectItem value="23">23%</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Denominação para Faturas</Label>
                        <Input
                          value={(form as any).invoice_denomination || ''}
                          onChange={e => update('invoice_denomination', e.target.value)}
                          placeholder="Ex: Serviço de Consultoria de Marketing Digital"
                          readOnly={!isOwner}
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Notas de Contabilidade</Label>
                      <Textarea
                        value={(form as any).accounting_notes || ''}
                        onChange={e => update('accounting_notes', e.target.value)}
                        placeholder="Notas adicionais sobre faturação, isenções, etc."
                        className="min-h-[100px]"
                        readOnly={!isOwner}
                      />
                    </div>
                  </CardContent>
                </Card>
                <OfferCalculator vatRate={(form as any).vat_rate || '23'} />

              </div>
            )}

            {/* ===== PROCESSOS ===== */}
            {openSection === 'processos' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-200">
                {/* SOPs do Produto */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Processos (SOPs)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>ID</TableHead>
                          <TableHead>Nome</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {productSops.length === 0 && (
                          <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-4">Sem processos associados</TableCell></TableRow>
                        )}
                        {productSops.map((sop: any) => {
                          const st = SOP_STATUSES[sop.status] || SOP_STATUSES.para_criar;
                          return (
                            <TableRow key={sop.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/hub/processos/${sop.id}`)}>
                              <TableCell className="text-xs font-mono text-muted-foreground">{sop.sop_id}</TableCell>
                              <TableCell className="font-medium text-sm">{sop.name}</TableCell>
                              <TableCell><Badge className={cn('text-xs', st.color)}>{st.label}</Badge></TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>


                {/* Template de Projeto */}
                <Card>
                  <CardHeader className="flex-row items-center justify-between">
                    <CardTitle className="text-base">Template de Projeto</CardTitle>
                    {isOwner && (
                      <Button size="sm" variant="outline" onClick={() => addRow.mutate({ table: 'product_project_templates', data: { product_id: id, task_name: '' } })}>
                        <Plus className="h-3 w-3 mr-1" /> Adicionar Tarefa
                      </Button>
                    )}
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground mb-3">Tarefas que serão criadas automaticamente no projeto de cada cliente deste produto.</p>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Fase</TableHead>
                          <TableHead>Tarefa</TableHead>
                          <TableHead>Responsável</TableHead>
                          {isOwner && <TableHead className="w-10" />}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {projectTemplate.length === 0 && (
                          <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-4">Sem tarefas no template</TableCell></TableRow>
                        )}
                        {projectTemplate.map((t: any) => (
                          <TableRow key={t.id}>
                            <TableCell><Input defaultValue={t.phase || ''} placeholder="Fase" onBlur={e => updateRow.mutate({ table: 'product_project_templates', id: t.id, data: { phase: e.target.value } })} className="border-none shadow-none h-auto p-0 text-sm" readOnly={!isOwner} /></TableCell>
                            <TableCell><Input defaultValue={t.task_name || ''} placeholder="Nome da tarefa" onBlur={e => updateRow.mutate({ table: 'product_project_templates', id: t.id, data: { task_name: e.target.value } })} className="border-none shadow-none h-auto p-0 text-sm" readOnly={!isOwner} /></TableCell>
                            <TableCell><Input defaultValue={t.responsible || ''} placeholder="Responsável" onBlur={e => updateRow.mutate({ table: 'product_project_templates', id: t.id, data: { responsible: e.target.value } })} className="border-none shadow-none h-auto p-0 text-sm" readOnly={!isOwner} /></TableCell>
                            {isOwner && (
                              <TableCell><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteRow.mutate({ table: 'product_project_templates', id: t.id })}><Trash2 className="h-3 w-3" /></Button></TableCell>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            )}

            {openSection === 'backoffice' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-200">
                {/* Cliente do Produto (moved from old Produto tab) */}
                <Card>
                  <CardHeader><CardTitle className="text-base">Cliente do Produto</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {[
                        { key: 'dificuldades', label: 'Dificuldades', hint: 'O que acontece no dia a dia' },
                        { key: 'dores', label: 'Dores', hint: 'Impacto emocional e mental' },
                        { key: 'desejo', label: 'Desejo', hint: 'O que quer concretizar ao comprar' },
                      ].map(({ key, label, hint }) => (
                        <div key={key} className="space-y-2">
                          <h4 className="text-sm font-semibold">{label}</h4>
                          <p className="text-xs text-muted-foreground">{hint}</p>
                          {(clientProfile[key] || []).map((item: string, i: number) => (
                            <div key={i} className="flex gap-1">
                              <Input value={item} onChange={e => {
                                const arr = [...(clientProfile[key] || [])];
                                arr[i] = e.target.value;
                                updateClientProfile(key, arr);
                              }} className="h-7 text-xs" readOnly={!isOwner} />
                              {isOwner && <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => updateClientProfile(key, (clientProfile[key] || []).filter((_: any, j: number) => j !== i))}><X className="h-3 w-3" /></Button>}
                            </div>
                          ))}
                          {isOwner && <Button variant="ghost" size="sm" className="text-xs" onClick={() => updateClientProfile(key, [...(clientProfile[key] || []), ''])}><Plus className="h-3 w-3 mr-1" /> Adicionar</Button>}
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {[
                        { key: 'pensa', label: 'O que ela pensa', hint: 'Pensamentos recorrentes' },
                        { key: 'expressoes', label: 'Expressões que usa', hint: 'Linguagem real' },
                        { key: 'ouve', label: 'O que ela ouve', hint: 'Contexto externo' },
                      ].map(({ key, label, hint }) => (
                        <div key={key} className="space-y-2">
                          <h4 className="text-sm font-semibold">{label}</h4>
                          <p className="text-xs text-muted-foreground">{hint}</p>
                          {(clientProfile[key] || []).map((item: string, i: number) => (
                            <div key={i} className="flex gap-1">
                              <Input value={item} onChange={e => {
                                const arr = [...(clientProfile[key] || [])];
                                arr[i] = e.target.value;
                                updateClientProfile(key, arr);
                              }} className="h-7 text-xs" readOnly={!isOwner} />
                              {isOwner && <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => updateClientProfile(key, (clientProfile[key] || []).filter((_: any, j: number) => j !== i))}><X className="h-3 w-3" /></Button>}
                            </div>
                          ))}
                          {isOwner && <Button variant="ghost" size="sm" className="text-xs" onClick={() => updateClientProfile(key, [...(clientProfile[key] || []), ''])}><Plus className="h-3 w-3 mr-1" /> Adicionar</Button>}
                        </div>
                      ))}
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold mb-2">Linguagem</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {[
                          { key: 'linguagem_nucleo', label: 'Núcleo (usar sempre)' },
                          { key: 'linguagem_apoio', label: 'Apoio (usar quando faz sentido)' },
                          { key: 'linguagem_evitar', label: 'Evitar' },
                        ].map(({ key, label }) => (
                          <div key={key} className="space-y-2">
                            <p className="text-xs text-muted-foreground font-medium">{label}</p>
                            {(clientProfile[key] || []).map((item: string, i: number) => (
                              <div key={i} className="flex gap-1">
                                <Input value={item} onChange={e => {
                                  const arr = [...(clientProfile[key] || [])];
                                  arr[i] = e.target.value;
                                  updateClientProfile(key, arr);
                                }} className="h-7 text-xs" readOnly={!isOwner} />
                                {isOwner && <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => updateClientProfile(key, (clientProfile[key] || []).filter((_: any, j: number) => j !== i))}><X className="h-3 w-3" /></Button>}
                              </div>
                            ))}
                            {isOwner && <Button variant="ghost" size="sm" className="text-xs" onClick={() => updateClientProfile(key, [...(clientProfile[key] || []), ''])}><Plus className="h-3 w-3 mr-1" /> Adicionar</Button>}
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Links Úteis */}
                <Card>
                  <CardHeader className="flex-row items-center justify-between">
                    <CardTitle className="text-base">Links Úteis</CardTitle>
                    {isOwner && (
                      <Button size="sm" variant="outline" onClick={() => addRow.mutate({ table: 'product_useful_links', data: { product_id: id, name: '', url: '' } })}>
                        <Plus className="h-3 w-3 mr-1" /> Adicionar
                      </Button>
                    )}
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nome</TableHead>
                          <TableHead>Link</TableHead>
                          {isOwner && <TableHead className="w-10" />}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {usefulLinks.length === 0 && (
                          <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-4">Sem links</TableCell></TableRow>
                        )}
                        {usefulLinks.map((l: any) => (
                          <TableRow key={l.id}>
                            <TableCell>
                              <Input defaultValue={l.name} onBlur={e => updateRow.mutate({ table: 'product_useful_links', id: l.id, data: { name: e.target.value } })} className="border-none shadow-none h-auto p-0 text-sm" readOnly={!isOwner} />
                            </TableCell>
                            <TableCell>
                              <Input defaultValue={l.url} onBlur={e => updateRow.mutate({ table: 'product_useful_links', id: l.id, data: { url: e.target.value } })} className="border-none shadow-none h-auto p-0 text-sm" readOnly={!isOwner} />
                            </TableCell>
                            {isOwner && (
                              <TableCell>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteRow.mutate({ table: 'product_useful_links', id: l.id })}><Trash2 className="h-3 w-3" /></Button>
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                {/* Drive */}
                <Card>
                  <CardHeader><CardTitle className="text-base">Drive</CardTitle></CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <Input value={form.drive_url || ''} onChange={e => update('drive_url', e.target.value)} placeholder="https://..." readOnly={!isOwner} />
                      {form.drive_url && (
                        <a href={form.drive_url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4 text-primary" />
                        </a>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex-row items-center justify-between">
                    <CardTitle className="text-base">Melhorias</CardTitle>
                    {isOwner && (
                      <Button size="sm" variant="outline" onClick={() => addRow.mutate({ table: 'product_improvements', data: { product_id: id, description: '', completed: false, sort_order: improvements.length } })}>
                        <Plus className="h-3 w-3 mr-1" /> Adicionar
                      </Button>
                    )}
                  </CardHeader>
                  <CardContent>
                    {improvements.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Nenhuma melhoria registada.</p>
                    ) : (
                      <div className="space-y-2">
                        {improvements.map((item: any) => (
                          <div key={item.id} className="flex items-start gap-3 group">
                            <Checkbox
                              checked={item.completed}
                              onCheckedChange={(checked) => updateRow.mutate({ table: 'product_improvements', id: item.id, data: { completed: !!checked } })}
                              disabled={!isOwner}
                              className="mt-0.5"
                            />
                            <Input
                              value={item.description}
                              onChange={e => updateRow.mutate({ table: 'product_improvements', id: item.id, data: { description: e.target.value } })}
                              onBlur={e => updateRow.mutate({ table: 'product_improvements', id: item.id, data: { description: e.target.value } })}
                              className={cn("flex-1 h-8 text-sm", item.completed && "line-through text-muted-foreground")}
                              placeholder="Descrever melhoria..."
                              readOnly={!isOwner}
                            />
                            {isOwner && (
                              <Button size="icon" variant="ghost" className="h-8 w-8 opacity-0 group-hover:opacity-100" onClick={() => deleteRow.mutate({ table: 'product_improvements', id: item.id })}>
                                <X className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Custos do Produto */}
                <Card>
                  <CardHeader className="flex-row items-center justify-between">
                    <CardTitle className="text-base">Custos do Produto</CardTitle>
                    {isOwner && (
                      <Button size="sm" variant="outline" onClick={() => addRow.mutate({ table: 'product_costs', data: { product_id: id, name: '', usage_desc: '', value: 0 } })}>
                        <Plus className="h-3 w-3 mr-1" /> Adicionar
                      </Button>
                    )}
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nome</TableHead>
                          <TableHead>Utilização</TableHead>
                          <TableHead>Valor (€)</TableHead>
                          {isOwner && <TableHead className="w-10" />}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {costs.length === 0 && (
                          <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-4">Sem custos</TableCell></TableRow>
                        )}
                        {costs.map((c: any) => (
                          <TableRow key={c.id}>
                            <TableCell>
                              <Input defaultValue={c.name} onBlur={e => updateRow.mutate({ table: 'product_costs', id: c.id, data: { name: e.target.value } })} className="border-none shadow-none h-auto p-0 text-sm" readOnly={!isOwner} />
                            </TableCell>
                            <TableCell>
                              <Input defaultValue={c.usage_desc} onBlur={e => updateRow.mutate({ table: 'product_costs', id: c.id, data: { usage_desc: e.target.value } })} className="border-none shadow-none h-auto p-0 text-sm" readOnly={!isOwner} />
                            </TableCell>
                            <TableCell>
                              <Input type="number" defaultValue={c.value} onBlur={e => updateRow.mutate({ table: 'product_costs', id: c.id, data: { value: Number(e.target.value) } })} className="border-none shadow-none h-auto p-0 text-sm w-20" readOnly={!isOwner} />
                            </TableCell>
                            {isOwner && (
                              <TableCell>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteRow.mutate({ table: 'product_costs', id: c.id })}><Trash2 className="h-3 w-3" /></Button>
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* ===== CUSTOMER SUCCESS ===== */}
            {openSection === 'customer-success' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-200">
                <ProductCustomerSuccess productId={id!} isOwner={isOwner} />
              </div>
            )}

            {/* ===== KPIs DO PRODUTO ===== */}
            {openSection === 'kpis' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-200">
                <ProductKPIsTab productId={id!} productName={form.name || ''} isOwner={isOwner} />
              </div>
            )}

            {/* ===== MÉTRICAS ===== */}
            {openSection === 'metricas' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-200">
                <ProductMetricsTab productId={id!} productName={form.name || ''} isOwner={isOwner} />
              </div>
            )}

            {/* ===== ARQUIVO ===== */}
            {openSection === 'arquivo' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-200">
                <Card>
                  <CardHeader><CardTitle className="text-base">Brainstorming</CardTitle></CardHeader>
                  <CardContent>
                    <RichTextEditor
                      content={form.brainstorming_content || ''}
                      onChange={v => update('brainstorming_content', v)}
                      editable={isOwner}
                    />
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
