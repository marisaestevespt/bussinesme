import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQueryClient, useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Copy, Trash2, Upload, ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useProduct, useProducts, STATUS_OPTIONS, ESCADA_OPTIONS, PRODUCT_TYPE_OPTIONS, SALES_TYPE_OPTIONS, Product } from '@/hooks/useProducts';
import { useCommercialData } from '@/hooks/useCommercialData';
import { useAuth } from '@/hooks/useAuth';
import { useTeamData } from '@/hooks/useTeamData';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TabProduto } from '@/components/product/tabs/TabProduto';
import { TabComercialMarketing } from '@/components/product/tabs/TabComercialMarketing';
import { TabBackoffice } from '@/components/product/tabs/TabBackoffice';
import { TabCustomerSuccess } from '@/components/product/tabs/TabCustomerSuccess';
import { TabArquivo } from '@/components/product/tabs/TabArquivo';

const MONTH_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const COLORS = ['hsl(var(--primary))', 'hsl(var(--muted))'];

export default function ProdutoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isOwner } = useAuth();
  const isNew = id === 'novo';

  const { data: product, isLoading } = useProduct(isNew ? undefined : id);
  const { upsertProduct, duplicateProduct, deleteProduct } = useProducts();
  const commercialData = useCommercialData();
  const { members } = useTeamData();

  const [form, setForm] = useState<Partial<Product>>({});
  const [initialized, setInitialized] = useState(false);

  if (product && !initialized) { setForm(product); setInitialized(true); }
  if (isNew && !initialized) { setForm({ name: '', status: 'em_ideia', description: '' }); setInitialized(true); }

  const update = (field: string, value: any) => setForm(prev => ({ ...prev, [field]: value }));

  const save = async () => {
    if (!form.name?.trim()) { toast.error('Nome é obrigatório'); return; }
    try { await upsertProduct.mutateAsync(form as any); toast.success('Produto guardado'); if (isNew) navigate('/hub/produtos'); } catch {}
  };

  const handleDuplicate = async () => { if (product) { await duplicateProduct.mutateAsync(product); navigate('/hub/produtos'); } };
  const handleDelete = async () => { if (product && confirm('Tens a certeza que queres eliminar este produto?')) { await deleteProduct.mutateAsync(product.id); navigate('/hub/produtos'); } };

  // Sub-table queries
  const { data: feedbacks = [] } = useQuery({ queryKey: ['product-feedbacks', id], queryFn: async () => { if (!id || isNew) return []; const { data } = await supabase.from('product_feedbacks').select('*').eq('product_id', id).order('created_at'); return data || []; }, enabled: !isNew });
  const { data: funnels = [] } = useQuery({ queryKey: ['product-funnels', id], queryFn: async () => { if (!id || isNew) return []; const { data } = await supabase.from('product_funnels').select('*').eq('product_id', id).order('created_at', { ascending: false }); return data || []; }, enabled: !isNew });
  const { data: automations = [] } = useQuery({ queryKey: ['product-automations', id], queryFn: async () => { if (!id || isNew) return []; const { data } = await supabase.from('product_automations').select('*').eq('product_id', id).order('created_at', { ascending: false }); return data || []; }, enabled: !isNew });
  const { data: trafficAds = [] } = useQuery({ queryKey: ['product-traffic-ads', id], queryFn: async () => { if (!id || isNew) return []; const { data } = await supabase.from('product_traffic_ads').select('*').eq('product_id', id).order('created_at', { ascending: false }); return data || []; }, enabled: !isNew });
  const { data: usefulLinks = [] } = useQuery({ queryKey: ['product-useful-links', id], queryFn: async () => { if (!id || isNew) return []; const { data } = await supabase.from('product_useful_links').select('*').eq('product_id', id).order('sort_order'); return data || []; }, enabled: !isNew });
  const { data: costs = [] } = useQuery({ queryKey: ['product-costs', id], queryFn: async () => { if (!id || isNew) return []; const { data } = await supabase.from('product_costs').select('*').eq('product_id', id).order('sort_order'); return data || []; }, enabled: !isNew });
  const { data: salesActions = [] } = useQuery({ queryKey: ['product-sales-actions', form.name], queryFn: async () => { if (!form.name) return []; const { data } = await supabase.from('commercial_sales_actions').select('*').eq('product', form.name).order('created_at', { ascending: false }); return data || []; }, enabled: !!form.name });
  const { data: sops = [] } = useQuery({ queryKey: ['product-sops', form.name], queryFn: async () => { if (!form.name) return []; const { data } = await supabase.from('sops').select('*').eq('product_name', form.name).order('created_at', { ascending: false }); return data || []; }, enabled: !!form.name });

  const invalidateSub = () => {
    ['product-feedbacks', 'product-funnels', 'product-automations', 'product-traffic-ads', 'product-useful-links', 'product-costs'].forEach(k => qc.invalidateQueries({ queryKey: [k, id] }));
  };

  const addRow = useMutation({ mutationFn: async ({ table, data }: { table: string; data: any }) => { const { error } = await supabase.from(table as any).insert(data); if (error) throw error; }, onSuccess: invalidateSub, onError: () => toast.error('Erro ao adicionar registo') });
  const updateRow = useMutation({ mutationFn: async ({ table, id: rowId, data }: { table: string; id: string; data: any }) => { const { error } = await supabase.from(table as any).update(data).eq('id', rowId); if (error) throw error; }, onSuccess: invalidateSub });
  const deleteRow = useMutation({ mutationFn: async ({ table, id: rowId }: { table: string; id: string }) => { const { error } = await supabase.from(table as any).delete().eq('id', rowId); if (error) throw error; }, onSuccess: invalidateSub });

  // Sales data
  const yearSales = commercialData.sales.data || [];
  const productSales = yearSales.filter(s => s.product === form.name);
  const currentMonth = new Date().getMonth() + 1;
  const monthProductSales = productSales.filter(s => s.sale_month === currentMonth);
  const monthTotal = monthProductSales.reduce((s, v) => s + Number(v.invoice_total || 0), 0);
  const lineData = MONTH_LABELS.map((name, i) => ({ name, vendas: productSales.filter(s => s.sale_month === i + 1).length }));
  const fmt = (v: number) => v.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  if (!isNew && isLoading) {
    return <AppLayout><div className="flex min-h-[50vh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="p-6 space-y-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="ghost" size="sm" onClick={() => navigate('/hub/produtos')}><ArrowLeft className="h-4 w-4 mr-1" /> Produtos</Button>
          <div className="flex-1" />
          {!isNew && isOwner && (
            <>
              <Button variant="outline" size="sm" onClick={handleDuplicate}><Copy className="h-4 w-4 mr-1" /> Duplicar</Button>
              <Button variant="outline" size="sm" className="text-destructive" onClick={handleDelete}><Trash2 className="h-4 w-4 mr-1" /> Eliminar</Button>
            </>
          )}
          {isOwner && <Button size="sm" onClick={save} disabled={upsertProduct.isPending}>{isNew ? 'Criar Produto' : 'Guardar'}</Button>}
        </div>

        {/* Cover */}
        <div className="relative w-full h-48 rounded-lg overflow-hidden bg-muted/30 border border-dashed border-border group">
          {form.cover_url ? <img src={form.cover_url} alt="Capa" className="w-full h-full object-cover" /> : (
            <div className="flex items-center justify-center h-full text-muted-foreground"><ImageIcon className="h-8 w-8 mr-2 opacity-40" /><span className="text-sm">Adicionar capa do produto</span></div>
          )}
          {isOwner && (
            <label className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
              <Upload className="h-6 w-6 text-white" />
              <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                const file = e.target.files?.[0]; if (!file) return;
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
              {form.logo_url ? <img src={form.logo_url} alt="Logo" className="h-full w-full object-contain p-1" /> : <ImageIcon className="h-8 w-8 text-muted-foreground/40" />}
            </div>
            {isOwner && (
              <label className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                <Upload className="h-4 w-4 text-white" />
                <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                  const file = e.target.files?.[0]; if (!file) return;
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
            <Textarea value={form.description || ''} onChange={e => update('description', e.target.value)} placeholder="Descrição do produto..." className="border-none shadow-none px-0 focus-visible:ring-0 resize-none min-h-[60px]" readOnly={!isOwner} />
          </div>
        </div>

        {/* Properties */}
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
                <Label className="text-xs text-muted-foreground">Escada</Label>
                <Select value={form.escada || ''} onValueChange={v => update('escada', v)} disabled={!isOwner}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>{ESCADA_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
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
                <Label className="text-xs text-muted-foreground">Tipo de Vendas</Label>
                <Select value={form.sales_type || ''} onValueChange={v => update('sales_type', v)} disabled={!isOwner}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>{SALES_TYPE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Ticket</Label>
                <Input value={form.ticket || ''} onChange={e => update('ticket', e.target.value)} placeholder="Ex: 400-480€" className="h-9" readOnly={!isOwner} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Página de Vendas</Label>
                <Input value={form.sales_page_url || ''} onChange={e => update('sales_page_url', e.target.value)} placeholder="https://..." className="h-9" readOnly={!isOwner} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Drive</Label>
                <Input value={form.drive_url || ''} onChange={e => update('drive_url', e.target.value)} placeholder="https://..." className="h-9" readOnly={!isOwner} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Datas Importantes</Label>
                <Input type="date" value="" onChange={() => {}} className="h-9" readOnly={!isOwner} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        {!isNew && id && (
          <Tabs defaultValue="produto" className="space-y-4">
            <TabsList className="grid grid-cols-5 w-full">
              <TabsTrigger value="produto">Produto</TabsTrigger>
              <TabsTrigger value="comercial">Comercial & Marketing</TabsTrigger>
              <TabsTrigger value="backoffice">Backoffice</TabsTrigger>
              <TabsTrigger value="customer-success">Customer Success</TabsTrigger>
              <TabsTrigger value="arquivo">Arquivo</TabsTrigger>
            </TabsList>

            <TabsContent value="produto">
              <TabProduto form={form} update={update} isOwner={isOwner} id={id} feedbacks={feedbacks} addRow={addRow} updateRow={updateRow} deleteRow={deleteRow} />
            </TabsContent>

            <TabsContent value="comercial">
              <TabComercialMarketing form={form} update={update} isOwner={isOwner} id={id} salesActions={salesActions} funnels={funnels} automations={automations} trafficAds={trafficAds} addRow={addRow} updateRow={updateRow} deleteRow={deleteRow} />
            </TabsContent>

            <TabsContent value="backoffice">
              <TabBackoffice form={form} update={update} isOwner={isOwner} id={id} usefulLinks={usefulLinks} sops={sops} addRow={addRow} updateRow={updateRow} deleteRow={deleteRow} />
            </TabsContent>

            <TabsContent value="customer-success">
              <TabCustomerSuccess productId={id} isOwner={isOwner} teamMembers={members.data || []} />
            </TabsContent>

            <TabsContent value="arquivo">
              <TabArquivo form={form} update={update} isOwner={isOwner} id={id} costs={costs} addRow={addRow} updateRow={updateRow} deleteRow={deleteRow} />
            </TabsContent>
          </Tabs>
        )}

        {/* Sales section */}
        {!isNew && form.name && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Vendas feitas</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Vendas este mês</CardTitle></CardHeader>
                <CardContent className="h-[200px] flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={[{ name: 'Vendas', value: monthProductSales.length || 0 }, { name: '', value: Math.max(1, monthProductSales.length === 0 ? 1 : 0) }]} cx="50%" cy="50%" innerRadius={50} outerRadius={75} dataKey="value" paddingAngle={2}>
                        <Cell fill="hsl(var(--primary))" />
                        <Cell fill="hsl(var(--muted))" />
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Evolução anual</CardTitle></CardHeader>
                <CardContent className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={lineData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="name" className="text-xs" />
                      <YAxis className="text-xs" allowDecimals={false} />
                      <Tooltip />
                      <Line type="monotone" dataKey="vendas" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
