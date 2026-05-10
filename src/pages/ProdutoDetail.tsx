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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Copy, Trash2, Plus, ExternalLink, X, Upload, ImageIcon, Pencil, Check, Circle, Layers, Settings2, Tag, ListTree, ShoppingCart, Wallet, Clock, Users, Timer, Link2, FolderOpen, Info, MessageSquare, CalendarClock, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { useProduct, useProducts, STATUS_OPTIONS, ESCADA_OPTIONS, PRODUCT_TYPE_OPTIONS, SALES_TYPE_OPTIONS, TASK_MODE_OPTIONS, SESSION_BASED_TYPES, deriveProjectMode, Product } from '@/hooks/useProducts';
import { Checkbox } from '@/components/ui/checkbox';
import { ProductDescriptionEditor } from '@/components/product/ProductDescriptionEditor';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { RichTextEditor } from '@/components/RichTextEditor';
import { ProductMetricsTab } from '@/components/product/ProductMetricsTab';
import { ProductCustomerSuccess } from '@/components/product/ProductCustomerSuccess';
import { ProductEntregasSection } from '@/components/product/ProductEntregasSection';
import { ProductComercialSection } from '@/components/product/ProductComercialSection';
import { ProductSalesKitSection } from '@/components/product/ProductSalesKitSection';
import { ProductMarketingSection } from '@/components/product/ProductMarketingSection';
import { ProductProcessosSection, ProductBackofficeSection, ProductArquivoSection, ProductContabilidadeSection } from '@/components/product/ProductSections';
import { ProductSalesTab } from '@/components/product/ProductSalesTab';
import { ProductPriceTiers } from '@/components/product/ProductPriceTiers';
import { ProductPricingEditor } from '@/components/product/ProductPricingEditor';
import { ProductBrandingSection } from '@/components/product/ProductBrandingSection';
import { ProductWelcomeEmailSection } from '@/components/product/ProductWelcomeEmailSection';
import { ProductProjectsSection } from '@/components/product/ProductProjectsSection';
import { format, parseISO, isFuture, isToday } from 'date-fns';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { BackNavigation } from '@/components/BackNavigation';
import { cn } from '@/lib/utils';
import { EmptyHint } from '@/components/ui/loading-skeletons';
import { EntitySection } from '@/components/layout/entity';
import { EntityIconPicker, parseIcon } from '@/components/entity-icon';

export default function ProdutoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isOwner, user } = useAuth();
  const { canAccess } = usePermissions();
  // Sales-only: tem acesso ao módulo Comercial mas não é Owner nem tem acesso a Produtos no menu.
  // Esconde secções operacionais/sensíveis na página do produto.
  const isSalesOnly = !isOwner && canAccess('comercial') && !canAccess('produtos');
  const canSeeSection = (key: string) => {
    if (!isSalesOnly) return true;
    const allowed = new Set([
      'clientes-vendas', 'projetos', 'comercial', 'marketing', 'branding', 'backoffice', 'metricas', 'arquivo',
    ]);
    return allowed.has(key);
  };
  const isNew = id === 'novo';
  const confirm = useConfirm();

  const { data: product, isLoading } = useProduct(isNew ? undefined : id);
  const { upsertProduct, duplicateProduct, deleteProduct } = useProducts();

  const [form, setForm] = useState<Partial<Product>>({});
  const [initialized, setInitialized] = useState(false);
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [showEventDialog, setShowEventDialog] = useState(false);
  const [newEvent, setNewEvent] = useState({ title: '', start_date: '', end_date: '' });
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');

  if (product && !initialized) {
    setForm(product);
    setInitialized(true);
  }
  if (isNew && !initialized) {
    setForm({ name: '', status: 'em_ideia', description: '' });
    setInitialized(true);
  }

  const update = (field: string, value: unknown) => {
    setForm(prev => {
      const next: any = { ...prev, [field]: value };
      // Mantém default_project_mode sincronizado automaticamente (derivado de tipo + venda)
      if (field === 'product_type' || field === 'sales_type') {
        next.default_project_mode = deriveProjectMode(next.product_type, next.sales_type);
      }
      return next;
    });
  };

  const save = async () => {
    if (!form.name?.trim()) {
      toast.error('Nome obrigatório');
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
    if (!product) return;
    const ok = await confirm({
      title: 'Eliminar produto?',
      description: `O produto "${product.name}" e os dados associados serão removidos permanentemente.`,
      confirmText: 'Eliminar',
      variant: 'destructive',
    });
    if (!ok) return;
    await deleteProduct.mutateAsync(product.id);
    navigate('/hub/produtos');
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
    staleTime: 2 * 60 * 1000,
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
    staleTime: 2 * 60 * 1000,
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
    staleTime: 2 * 60 * 1000,
  });
  const { data: productEvents = [] } = useQuery({
    queryKey: ['product-events', id],
    queryFn: async () => {
      if (!id) return [];
      const { data } = await supabase.from('events').select('id, title, start_date, end_date').eq('product_id', id).order('start_date', { ascending: true });
      return (data || []) as Record<string, unknown>[];
    },
    enabled: !!id,
    staleTime: 2 * 60 * 1000,
  });
  const { data: productMeetings = [] } = useQuery({
    queryKey: ['product-meetings', id],
    queryFn: async () => {
      if (!id) return [];
      const { data } = await supabase.from('meetings').select('id, title, date_time, status, client_name, project_name, meeting_type, department').eq('product_id', id).order('date_time', { ascending: false });
      return (data || []) as Record<string, unknown>[];
    },
    enabled: !!id,
    staleTime: 2 * 60 * 1000,
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
        <div className="space-y-6">
          <div className="h-8 w-48 animate-pulse rounded bg-muted" />
          <div className="grid gap-4 md:grid-cols-2">
            <div className="h-32 animate-pulse rounded-lg bg-muted" />
            <div className="h-32 animate-pulse rounded-lg bg-muted" />
          </div>
          <div className="h-64 animate-pulse rounded-lg bg-muted" />
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
    if (isFuture(start)) return { label: 'Futuro', color: 'bg-info/15 text-info border-info/30' };
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
      product_id: id,
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
      variant={openSection === sectionKey ? 'default' : 'outline'}
      size="sm"
      onClick={() => toggleSection(sectionKey)}
    >
      {label}
    </Button>
  );

  return (
    <AppLayout>
      <div className="space-y-10 w-full">
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

        {/* Notion-style hero: cover + floating logo + clean title + description */}
        <div className="relative -mx-2 md:-mx-4">
          {/* Cover */}
          <div className="relative w-full h-44 md:h-56 rounded-lg overflow-hidden bg-muted/40 group">
            {form.cover_url ? (
              <img src={form.cover_url} alt="Capa" className="w-full h-full object-cover" />
            ) : (
              <div className="h-full w-full bg-gradient-to-br from-primary/15 via-accent/10 to-muted/30" />
            )}
            {isOwner && (
              <label className="absolute top-3 right-3 inline-flex items-center gap-2 rounded-md bg-background/80 hover:bg-background backdrop-blur px-2.5 py-1.5 text-xs font-medium text-foreground border border-border/60 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                <Upload className="h-3.5 w-3.5" />
                {form.cover_url ? 'Mudar capa' : 'Adicionar capa'}
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

          {/* Title block */}
          <div className="px-2 md:px-6 pt-3">
            {/* Floating icon (emoji or image) — Notion-style, left-aligned with title */}
            <div className="relative -mt-12 md:-mt-14 mb-2 w-fit -ml-1">
              <EntityIconPicker
                icon={parseIcon(form.icon) ?? (form.logo_url ? { type: 'image', value: form.logo_url } : null)}
                onChange={(next) => {
                  update('icon', next as any);
                  // Keep logo_url in sync for legacy consumers
                  update('logo_url', next?.type === 'image' ? next.value : null);
                }}
                bucket="product-files"
                pathPrefix={`icons/${id || 'new'}`}
                disabled={!isOwner}
              />
            </div>

            {/* Name */}
            {editingName || isNew ? (
                      <div className="flex items-center gap-2 w-full">
                        <Input
                          autoFocus={!isNew}
                          value={isNew ? (form.name || '') : nameDraft}
                          onChange={e => isNew ? update('name', e.target.value) : setNameDraft(e.target.value)}
                          placeholder="Nome do produto"
                          className="flex-1 min-w-0 w-full text-3xl md:text-4xl font-bold border-input/60 shadow-none px-1 h-auto py-1 leading-tight tracking-tight bg-background"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !isNew) {
                              e.preventDefault();
                              if (!nameDraft.trim()) { toast.error('Nome obrigatório'); return; }
                              update('name', nameDraft.trim());
                              if (product) {
                                upsertProduct.mutateAsync({ id: product.id, name: nameDraft.trim() } as Product)
                                  .then(() => { toast.success('Nome atualizado'); setEditingName(false); })
                                  .catch(() => toast.error('Erro ao guardar'));
                              } else {
                                setEditingName(false);
                              }
                            }
                            if (e.key === 'Escape' && !isNew) { setEditingName(false); setNameDraft(form.name || ''); }
                          }}
                        />
                        {!isNew && (
                          <>
                            <Button
                              size="icon"
                              variant="default"
                              className="h-10 w-10 shrink-0"
                              onClick={async () => {
                                if (!nameDraft.trim()) { toast.error('Nome obrigatório'); return; }
                                update('name', nameDraft.trim());
                                if (product) {
                                  try {
                                    await upsertProduct.mutateAsync({ id: product.id, name: nameDraft.trim() } as Product);
                                    toast.success('Nome atualizado');
                                    setEditingName(false);
                                  } catch { toast.error('Erro ao guardar'); }
                                }
                              }}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-10 w-10 shrink-0"
                              onClick={() => { setEditingName(false); setNameDraft(form.name || ''); }}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    ) : (
                      <div
                        className={cn(
                          'group/name flex items-center gap-2 -mx-2 px-2 py-1 rounded-md',
                          isOwner && 'cursor-text hover:bg-muted/50 transition-colors'
                        )}
                        onClick={() => { if (isOwner) { setNameDraft(form.name || ''); setEditingName(true); } }}
                        title={isOwner ? 'Clicar para editar' : undefined}
                      >
                        <h1 className="text-3xl md:text-4xl font-bold leading-tight tracking-tight text-foreground truncate">
                          {form.name || <span className="text-muted-foreground/60">Sem nome</span>}
                        </h1>
                        {isOwner && (
                          <Pencil className="h-4 w-4 shrink-0 opacity-0 group-hover/name:opacity-100 transition-opacity text-muted-foreground" />
                        )}
                      </div>
                    )}

            {/* Description */}
            <div className="mt-2">
                    <ProductDescriptionEditor
                      value={form.description || ''}
                      onChange={(v) => update('description', v)}
                      isOwner={isOwner}
                      productId={product?.id}
                      persistedValue={product?.description || ''}
                      onSave={async (v) => {
                        if (!product) return;
                        await upsertProduct.mutateAsync({ id: product.id, name: form.name!, description: v ?? null } as Product);
                        qc.invalidateQueries({ queryKey: ['products', product.id] });
                      }}
                      isSaving={upsertProduct.isPending}
                    />
            </div>
          </div>
        </div>

        {/* Properties — Notion-style */}
        <div className="rounded-lg border border-border/60 bg-card">
          {(() => {
            const ticketType = ((form as any).ticket_type || 'fixo') as string;
            // Reusable styles for inline (borderless) controls
            const inlineTrigger = "h-8 border-0 bg-transparent shadow-none px-2 -ml-2 hover:bg-muted/60 focus:ring-0 focus:ring-offset-0 [&>svg]:opacity-50";
            const inlineInput = "h-8 border-0 bg-transparent shadow-none px-2 -ml-2 hover:bg-muted/60 focus-visible:ring-0 focus-visible:ring-offset-0 focus:bg-muted/40 rounded-md";

            const Row = ({ icon: Icon, label, children }: { icon: any; label: string; children: React.ReactNode }) => (
              <div className="grid grid-cols-[150px_1fr] items-center py-1.5 border-b border-border/50">
                <div className="flex items-center gap-2 text-xs text-muted-foreground pr-3 mr-3 border-r border-border/50 self-stretch py-1">
                  <Icon className="h-3.5 w-3.5" />
                  <span>{label}</span>
                </div>
                <div className="min-w-0 text-sm">{children}</div>
              </div>
            );

            const SectionTitle = ({ children }: { children: React.ReactNode }) => (
              <div className="col-span-full pt-8 pb-2 first:pt-0">
                <p className="text-[11px] font-semibold text-primary/70 uppercase tracking-wider">{children}</p>
              </div>
            );

            return (
              <div className="p-4 md:p-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-0">
                  {/* ── Geral ── */}
                  <SectionTitle>Geral</SectionTitle>
                  <Row icon={Circle} label="Status">
                    <Select value={form.status || 'em_ideia'} onValueChange={v => update('status', v)} disabled={!isOwner}>
                      <SelectTrigger className={inlineTrigger}><SelectValue /></SelectTrigger>
                      <SelectContent>{STATUS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </Row>

                  {/* ── Configuração de Projeto ── */}
                  <SectionTitle>Configuração de Projeto</SectionTitle>
                  <Row icon={Settings2} label="Modo Operacional (Entregas)">
                    {(() => {
                      const modes: string[] = (form as any).task_modes || [(form as any).task_mode || 'fases'];
                      const labels = TASK_MODE_OPTIONS.filter(o => modes.includes(o.value)).map(o => o.label);
                      const summary = labels.length > 0 ? labels.join(' + ') : 'Selecionar…';
                      return (
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className={cn(inlineTrigger, 'justify-between font-normal')} disabled={!isOwner}>
                              <span className="truncate text-left">{summary}</span>
                              <ChevronDown className="h-3.5 w-3.5 opacity-50 shrink-0 ml-2" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-80 p-2" align="start">
                            <div className="flex flex-col gap-1">
                              {TASK_MODE_OPTIONS.map(opt => {
                                const checked = modes.includes(opt.value);
                                return (
                                  <label key={opt.value} className="flex items-start gap-2 cursor-pointer p-2 rounded hover:bg-muted/50">
                                    <Checkbox
                                      checked={checked}
                                      disabled={!isOwner}
                                      onCheckedChange={(v) => {
                                        const next = v
                                          ? Array.from(new Set([...modes, opt.value]))
                                          : modes.filter((m: string) => m !== opt.value);
                                        update('task_modes', next.length > 0 ? next : ['fases']);
                                      }}
                                      className="mt-0.5"
                                    />
                                    <span className="text-sm leading-tight">
                                      <span className="font-medium">{opt.label}</span>
                                      <span className="block text-[11px] text-muted-foreground">{opt.description}</span>
                                    </span>
                                  </label>
                                );
                              })}
                              <p className="text-[11px] text-muted-foreground italic px-2 pt-1">Podes combinar vários modos.</p>
                            </div>
                          </PopoverContent>
                        </Popover>
                      );
                    })()}
                  </Row>
                  {SESSION_BASED_TYPES.has(form.product_type || '') && (
                    <p className="text-[11px] text-muted-foreground italic px-1">
                      💡 Define as sessões/reuniões deste produto na tab <b>Entregas</b> (cria entregas do tipo "Reunião" com duração e título próprios).
                    </p>
                  )}

                  {/* ── Detalhes Comerciais ── */}
                  <SectionTitle>Detalhes Comerciais</SectionTitle>
                  <Row icon={Tag} label="Tipo de Produto">
                    <Select value={form.product_type || ''} onValueChange={v => update('product_type', v)} disabled={!isOwner}>
                      <SelectTrigger className={inlineTrigger}><SelectValue placeholder="Vazio" /></SelectTrigger>
                      <SelectContent>{PRODUCT_TYPE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </Row>
                  <Row icon={ListTree} label="Escada">
                    <Select value={form.escada || ''} onValueChange={v => update('escada', v)} disabled={!isOwner}>
                      <SelectTrigger className={inlineTrigger}><SelectValue placeholder="Vazio" /></SelectTrigger>
                      <SelectContent>{ESCADA_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </Row>
                  <Row icon={ShoppingCart} label="Tipo de Vendas">
                    <Select value={form.sales_type || ''} onValueChange={v => update('sales_type', v)} disabled={!isOwner}>
                      <SelectTrigger className={inlineTrigger}><SelectValue placeholder="Vazio" /></SelectTrigger>
                      <SelectContent>{SALES_TYPE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </Row>
                  <Row icon={Wallet} label="Tipo de Ticket">
                    <Select value={ticketType} onValueChange={v => update('ticket_type', v)} disabled={!isOwner}>
                      <SelectTrigger className={inlineTrigger}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fixo">Fixo</SelectItem>
                        <SelectItem value="variavel">Variável</SelectItem>
                      </SelectContent>
                    </Select>
                  </Row>
                  <Row icon={Wallet} label={ticketType === 'fixo' ? 'Ticket (€)' : 'Ticket Médio (€)'}>
                    <Input value={form.ticket || ''} onChange={e => update('ticket', e.target.value)} placeholder={ticketType === 'fixo' ? 'Ex: 480€' : 'Ex: 400-480€'} className={inlineInput} readOnly={!isOwner} />
                  </Row>
                  {form.product_type === 'servico_mensal' && (
                    <Row icon={Clock} label="Horas/mês por cliente (Métricas)">
                      <Input type="number" value={form.monthly_hours_per_client ?? ''} onChange={e => update('monthly_hours_per_client', e.target.value ? Number(e.target.value) : null)} placeholder="Ex: 20" className={inlineInput} readOnly={!isOwner} />
                    </Row>
                  )}
                  {form.product_type && !['servico_mensal', 'curso', 'ebook', 'template'].includes(form.product_type) && (
                    <Row icon={Clock} label="Horas por projeto pontual">
                      <Input type="number" value={(form as any).estimated_project_hours ?? ''} onChange={e => update('estimated_project_hours', e.target.value ? Number(e.target.value) : null)} placeholder="Ex: 35" className={inlineInput} readOnly={!isOwner} />
                    </Row>
                  )}
                  <Row icon={Users} label="Máx. clientes simultâneos (Métricas)">
                    <Input type="number" min={0} value={(form as any).max_simultaneous_clients ?? ''} onChange={e => update('max_simultaneous_clients', e.target.value ? Number(e.target.value) : null)} placeholder="Ex: 10" className={inlineInput} readOnly={!isOwner} />
                  </Row>
                  <Row icon={Timer} label="Duração do Ciclo">
                    <div className="flex items-center gap-2">
                      <Input type="number" min={0} placeholder="Ex: 12" value={form.cycle_duration ?? ''} onChange={e => update('cycle_duration', e.target.value ? parseInt(e.target.value) : null)} className={cn(inlineInput, 'flex-1')} readOnly={!isOwner} />
                      <span className="text-xs text-muted-foreground shrink-0">meses</span>
                    </div>
                  </Row>

                  {/* ── Links ── */}
                  <SectionTitle>Links</SectionTitle>
                  <Row icon={Link2} label="Página de Vendas">
                    <div className="flex items-center gap-1">
                      <Input value={form.sales_page_url || ''} onChange={e => update('sales_page_url', e.target.value)} placeholder="https://..." className={cn(inlineInput, 'flex-1')} readOnly={!isOwner} />
                      {form.sales_page_url && <a href={form.sales_page_url} target="_blank" rel="noopener noreferrer" className="shrink-0 p-1 rounded hover:bg-muted"><ExternalLink className="h-3.5 w-3.5 text-muted-foreground" /></a>}
                    </div>
                  </Row>
                  <Row icon={FolderOpen} label="Drive">
                    <div className="flex items-center gap-1">
                      <Input value={form.drive_url || ''} onChange={e => update('drive_url', e.target.value)} placeholder="https://..." className={cn(inlineInput, 'flex-1')} readOnly={!isOwner} />
                      {form.drive_url && <a href={form.drive_url} target="_blank" rel="noopener noreferrer" className="shrink-0 p-1 rounded hover:bg-muted"><ExternalLink className="h-3.5 w-3.5 text-muted-foreground" /></a>}
                    </div>
                  </Row>
                  <div className="md:col-span-2 pt-1 pb-2">
                    <p className="text-[11px] text-muted-foreground/80">
                      💡 Estes links aparecem agregados na vista <strong>Backoffice · Todos os Links do Produto</strong>.
                    </p>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Sobre o Produto */}
        <EntitySection title="Sobre o Produto" icon={Info} className="pt-2">
          <div className="space-y-4">
            <RichTextEditor content={form.about_content || ''} onChange={v => update('about_content', v)} editable={isOwner} />
            <div className="pt-4 pb-4 border-t">
              <h4 className="text-sm font-semibold mb-2">O que está incluído</h4>
              {includedItems.map((item, i) => (
                <div key={i} className="flex gap-2 mb-1">
                  <Input value={item} onChange={e => { const next = [...includedItems]; next[i] = e.target.value; update('included_items', next); }} className="h-8 text-sm" readOnly={!isOwner} />
                  {isOwner && <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => update('included_items', includedItems.filter((_, j) => j !== i))}><X className="h-3 w-3" /></Button>}
                </div>
              ))}
              {isOwner && <Button variant="outline" size="sm" className="mt-1" onClick={() => update('included_items', [...includedItems, ''])}><Plus className="h-3 w-3 mr-1" /> Adicionar item</Button>}
            </div>
            <div className="pt-4 border-t">
              <h4 className="text-sm font-semibold mb-2">FAQs do Portal do Cliente</h4>
              <p className="text-xs text-muted-foreground mb-2">Estas FAQs aparecem automaticamente no portal de todos os clientes deste produto. Alterações aqui propagam-se em tempo real. Para FAQs comerciais (para o vendedor responder), vai ao separador <strong>Comercial</strong>.</p>
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
          </div>
        </EntitySection>

        {/* Feedbacks */}
        <EntitySection
          title="Feedbacks"
          icon={MessageSquare}
          className="pt-2"
          action={isOwner && <Button size="sm" variant="outline" onClick={() => addRow.mutate({ table: 'product_feedbacks', data: { product_id: id, feedback: '', client_name: '' } })}><Plus className="h-3 w-3 mr-1" /> Adicionar</Button>}
        >
          <div className="space-y-4">
            {feedbacks.length === 0 && <EmptyHint>Sem feedbacks</EmptyHint>}
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
                  ) : <EmptyHint>Sem imagem</EmptyHint>}
                </div>
                {isOwner && <div className="flex justify-end"><Button variant="ghost" size="sm" className="text-destructive" onClick={() => deleteRow.mutate({ table: 'product_feedbacks', id: f.id as string })}><Trash2 className="h-3 w-3 mr-1" /> Remover</Button></div>}
              </div>
            ))}
          </div>
        </EntitySection>

        {/* Datas Importantes */}
        <EntitySection
          title="Datas Importantes"
          icon={CalendarClock}
          className="pt-2"
          action={isOwner && <Button size="sm" variant="outline" onClick={() => setShowEventDialog(true)}><Plus className="h-3.5 w-3.5 mr-1" />Adicionar Evento</Button>}
        >
            {productEvents.length === 0 ? (
              <EmptyHint>Sem datas importantes associadas a este produto na Agenda.</EmptyHint>
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
        </EntitySection>

        <Dialog open={showEventDialog} onOpenChange={setShowEventDialog}>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo Evento — {form.name}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Título</Label>
                <Input value={newEvent.title} onChange={e => setNewEvent(p => ({ ...p, title: e.target.value }))} placeholder="Ex: Lançamento do produto" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Data / Hora Início</Label><Input type="datetime-local" value={newEvent.start_date} onChange={e => setNewEvent(p => ({ ...p, start_date: e.target.value }))} /></div>
                <div className="space-y-2"><Label>Data / Hora Fim (opcional)</Label><Input type="datetime-local" value={newEvent.end_date} onChange={e => setNewEvent(p => ({ ...p, end_date: e.target.value }))} /></div>
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
            {canSeeSection('clientes-vendas') && <SectionButton sectionKey="clientes-vendas" label="Clientes e Vendas" />}
            {canSeeSection('projetos') && <SectionButton sectionKey="projetos" label="Projetos" />}
            {canSeeSection('entregas') && <SectionButton sectionKey="entregas" label="Entregas" />}
            {canSeeSection('comercial') && <SectionButton sectionKey="comercial" label="Comercial" />}
            {canSeeSection('marketing') && <SectionButton sectionKey="marketing" label="Marketing" />}
            {canSeeSection('branding') && <SectionButton sectionKey="branding" label="Branding" />}
            {canSeeSection('contabilidade') && <SectionButton sectionKey="contabilidade" label="Contabilidade" />}
            {canSeeSection('processos') && <SectionButton sectionKey="processos" label="Processos" />}
            {canSeeSection('backoffice') && <SectionButton sectionKey="backoffice" label="Backoffice" />}
            {canSeeSection('metricas') && <SectionButton sectionKey="metricas" label="Métricas" />}
            {canSeeSection('arquivo') && <SectionButton sectionKey="arquivo" label="Arquivo" />}
          </div>

          {openSection === 'clientes-vendas' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-top-2 duration-200">
              <ProductSalesTab productName={form.name || ''} />
              {!isNew && id && (
                <ProductCustomerSuccess productId={id} productName={form.name || ''} isOwner={isOwner} />
              )}
            </div>
          )}

          {openSection === 'projetos' && !isNew && id && (
            <div className="animate-in fade-in slide-in-from-top-2 duration-200">
              <ProductProjectsSection productId={id} productName={form.name || ''} />
            </div>
          )}

          {openSection === 'entregas' && (
            <ProductEntregasSection
              deliverableTemplates={deliverableTemplates as Array<{ id: string; name: string; description?: string; is_recurring?: boolean }>}
              isOwner={isOwner}
              productId={id!}
              isRecurring={deriveProjectMode(form.product_type, form.sales_type) === 'recorrente'}
              onAdd={() => addRow.mutate({ table: 'product_deliverable_templates', data: { product_id: id, name: '', sort_order: deliverableTemplates.length } })}
              onUpdate={(rowId, data) => updateRow.mutate({ table: 'product_deliverable_templates', id: rowId, data })}
              onDelete={(rowId) => deleteRow.mutate({ table: 'product_deliverable_templates', id: rowId })}
            />
          )}

          {openSection === 'comercial' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-top-2 duration-200">
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
              <ProductSalesKitSection
                presentationUrl={(form as any).sales_presentation_url || ''}
                pitch={(form as any).sales_pitch || ''}
                benefits={((form as any).sales_benefits || []) as Array<{ title: string; description: string }>}
                materials={((form as any).sales_materials || []) as Array<{ name: string; url: string; type: string }>}
                objections={((form as any).sales_objections || []) as Array<{ objection: string; response: string }>}
                caseStudies={((form as any).sales_case_studies || []) as Array<{ client: string; result: string; description: string }>}
                isOwner={isOwner}
                onUpdate={update}
              />
            </div>
          )}

          {openSection === 'marketing' && (
            <ProductMarketingSection
              productContents={productContents}
              funnels={funnels}
              automations={automations}
              trafficAds={trafficAds}
              isOwner={isOwner}
              productName={form.name || ''}
              salesPage={((form as any).sales_page || {}) as Record<string, unknown>}
              salesPageUrl={form.sales_page_url || ''}
              onUpdateSalesPage={(next) => update('sales_page', next)}
              onUpdateSalesPageUrl={(url) => update('sales_page_url', url)}
              onAddFunnel={() => addRow.mutate({ table: 'marketing_funnels', data: { name: `Funil — ${form.name}`, product_name: form.name, product_id: id } })}
              onAddAutomation={() => addRow.mutate({ table: 'marketing_automations', data: { name: `Automação — ${form.name}`, product_name: form.name, product_id: id } })}
              onAddTrafficAd={() => addRow.mutate({ table: 'traffic_creatives', data: { name: `Criativo — ${form.name}`, product_name: form.name, product_id: id } })}
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
              isOwner={isOwner}
              productId={id!}
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

          {openSection === 'branding' && (
            <div className="space-y-6">
              <ProductBrandingSection
                branding={((form as any).branding || {}) as Record<string, unknown>}
                isOwner={isOwner}
                onUpdate={(next) => update('branding', next)}
                portalBranding={((form as any).portal_branding || {}) as Record<string, unknown>}
                onUpdatePortalBranding={(next) => update('portal_branding', next)}
                productId={id!}
                calendarColor={(form as any).calendar_color ?? null}
                onUpdateCalendarColor={(next) => update('calendar_color', next)}
              />
              {id && id !== 'novo' && (
                <ProductWelcomeEmailSection
                  productId={id}
                  bannerUrl={(form as any).welcome_email_banner_url}
                  accentColor={(form as any).welcome_email_accent_color}
                  isOwner={isOwner}
                  onUpdate={(field, value) => update(field as any, value)}
                />
              )}
            </div>
          )}

          {openSection === 'metricas' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-top-2 duration-200">
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
