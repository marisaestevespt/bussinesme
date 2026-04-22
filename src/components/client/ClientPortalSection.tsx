import { useState } from 'react';
import { QuestionsCollapsible } from './QuestionsCollapsible';
import { enrichQuestionsWithAutoFill } from '@/lib/portalAutoFill';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Copy, ExternalLink, Plus, X, RefreshCw, Upload, FileText, Globe, Settings2, MessageCircle, HelpCircle } from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import {
  usePortal, usePortalFaqs, usePortalQuestions, usePortalFeedback,
  usePortalComments,
  getPortalTypeFromProduct, Portal
} from '@/hooks/usePortalData';
import { useProducts } from '@/hooks/useProducts';

interface Props {
  clientId: string;
  clientName: string;
  currentProduct: string | null;
  productId?: string | null;
}

export function ClientPortalSection({ clientId, clientName, currentProduct, productId }: Props) {
  const { products } = useProducts();
  const queryClient = useQueryClient();
  const productList = products.data || [];
  const product = productList.find(p => (productId && p.id === productId) || p.name === currentProduct);
  const portalType = getPortalTypeFromProduct(product?.product_type || null);

  const { portal, upsertPortal, updatePortal } = usePortal(clientId);
  const portalData = portal.data;
  const portalId = portalData?.id;

  const { faqs, addFaq, updateFaq, deleteFaq } = usePortalFaqs(portalId);
  const { questions, addQuestion, updateQuestion, deleteQuestion } = usePortalQuestions(portalId);
  const { feedback } = usePortalFeedback(portalId);
  const { comments, addComment } = usePortalComments(portalId);

  const [uploadingMaterial, setUploadingMaterial] = useState(false);

  const { data: portalMaterials = [], refetch: refetchMaterials } = useQuery({
    queryKey: ['portal-materials', portalId],
    enabled: !!portalId,
    queryFn: async () => {
      const { data } = await supabase.from('portal_materials').select('*').eq('portal_id', portalId!).order('created_at', { ascending: false });
      return (data || []) as any[];
    },
  });

  const slug = (portalData as any)?.slug as string | null;
  const portalUrl = portalData ? `${window.location.origin}/portal/${slug || portalData.token}` : '';

  const createPortal = async () => {
    if (!portalType) { toast.error('Este tipo de produto não gera portal'); return; }
    await upsertPortal.mutateAsync({ client_id: clientId, portal_type: portalType });
    toast.success('Portal criado');
    setTimeout(async () => {
      await seedFaqsFromProduct();
      await seedQuestionsFromProduct();
    }, 1500);
  };

  const seedQuestionsFromProduct = async () => {
    const portalRes = await supabase.from('client_portals').select('id').eq('client_id', clientId).maybeSingle();
    const pid = portalRes.data?.id;
    if (!pid || !product) return;
    const { data: diagQuestions } = await (supabase as any)
      .from('product_diagnostic_questions')
      .select('*')
      .eq('product_id', product.id)
      .order('sort_order');
    if (!diagQuestions || diagQuestions.length === 0) return;

    const [clientRes, businessRes] = await Promise.all([
      supabase.from('clients').select('email, nif, fiscal_address, full_name').eq('id', clientId).maybeSingle(),
      supabase.from('business_setup').select('*').limit(1).maybeSingle(),
    ]);

    const rows = diagQuestions.map((q: any, i: number) => ({
      portal_id: pid,
      question: q.question_group ? `[${q.question_group}] ${q.question}` : q.question,
      answer_type: q.answer_type || 'text',
      sort_order: i,
    }));

    const enrichedRows = enrichQuestionsWithAutoFill(rows, clientRes.data || {}, businessRes.data || null);
    await supabase.from('portal_initial_questions').insert(enrichedRows as any);
    questions.refetch();
    toast.success(`${diagQuestions.length} perguntas importadas do produto`);
  };

  const seedFaqsFromProduct = async () => {
    const portalRes = await supabase.from('client_portals').select('id').eq('client_id', clientId).maybeSingle();
    const pid = portalRes.data?.id;
    if (!pid || !product) return;
    const productFaqs: { question: string; answer: string }[] = Array.isArray(product.faqs) ? (product.faqs as unknown as { question: string; answer: string }[]) : [];
    const validFaqs = productFaqs.filter(f => f.question?.trim());
    if (validFaqs.length === 0) return;
    const rows = validFaqs.map((f, i) => ({
      portal_id: pid,
      question: f.question,
      answer: f.answer || '',
      sort_order: i,
    }));
    await supabase.from('portal_faqs').insert(rows);
    faqs.refetch();
  };

  const importFaqsFromProduct = async () => {
    if (!portalId || !product) { toast.error('Sem produto associado'); return; }
    const productFaqs: { question: string; answer: string }[] = Array.isArray(product.faqs) ? (product.faqs as unknown as { question: string; answer: string }[]) : [];
    const validFaqs = productFaqs.filter(f => f.question?.trim());
    if (validFaqs.length === 0) { toast.info('O produto não tem FAQ\'s definidas'); return; }
    const existingCount = faqs.data?.length || 0;
    const rows = validFaqs.map((f, i) => ({
      portal_id: portalId,
      question: f.question,
      answer: f.answer || '',
      sort_order: existingCount + i,
    }));
    await supabase.from('portal_faqs' as any).insert(rows);
    faqs.refetch();
    toast.success(`${validFaqs.length} FAQ's importadas do produto`);
  };

  if (!portalType) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-8 text-center">
          <Globe className="h-8 w-8 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-sm font-medium text-muted-foreground">Portal de Cliente</p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            O tipo de produto atual ({currentProduct || 'nenhum'}) não gera portal de cliente.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!portalData) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-8 text-center">
          <Globe className="h-8 w-8 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-sm font-medium text-muted-foreground">Este cliente ainda não tem portal criado.</p>
          <Button size="sm" className="mt-4" onClick={createPortal}>Criar Portal</Button>
        </CardContent>
      </Card>
    );
  }

  const toggleField = (field: keyof Portal) => {
    updatePortal.mutate({ [field]: !portalData[field] } as any);
  };

  const toggleItems = [
    { label: 'Ativo', field: 'is_active' as keyof Portal },
    { label: 'Espaço de Trabalho', field: 'show_workspace' as keyof Portal },
    { label: 'Reuniões', field: 'show_meetings' as keyof Portal },
    { label: 'Pagamentos', field: 'show_payments' as keyof Portal },
    { label: 'Onboarding', field: 'show_onboarding' as keyof Portal },
    { label: 'Fases / Timeline', field: 'show_timeline' as keyof Portal },
  ];

  return (
    <div className="space-y-5">
      {/* Portal Settings Card */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-4 bg-muted/30 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <Globe className="h-4.5 w-4.5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">Portal de Cliente</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Tipo: {portalData.portal_type === 'projeto_unico' ? 'Projeto Único' : 'Serviço Mensal'}
                </p>
              </div>
            </div>
            <Badge variant={portalData.is_active ? 'default' : 'secondary'} className="text-xs px-3 py-1">
              {portalData.is_active ? 'Ativo' : 'Inativo'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-5 space-y-5">
          {/* URL Section */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">URL do Portal</Label>
            <div className="flex gap-2 items-center">
              <Input value={portalUrl} readOnly className="text-xs font-mono bg-muted/30 flex-1" />
              <Button variant="outline" aria-label="Copiar" size="icon" className="shrink-0" onClick={() => { navigator.clipboard.writeText(portalUrl); toast.success('Link copiado'); }}>
                <Copy className="h-4 w-4" />
              </Button>
              <Button variant="outline" aria-label="Abrir link externo" size="icon" className="shrink-0" asChild>
                <a href={portalUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /></a>
              </Button>
              <Button size="sm" className="shrink-0" onClick={() => {
                localStorage.setItem(`portal_session_${portalData.id}`, JSON.stringify({
                  portal_id: portalData.id,
                  client_id: clientId,
                  timestamp: Date.now(),
                }));
                window.open(`${window.location.origin}/portal/${portalData.token}/view`, '_blank');
              }}>
                <ExternalLink className="h-3 w-3 mr-1.5" />Editar Portal
              </Button>
            </div>
          </div>

          {/* Slug */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Slug personalizado</Label>
            <div className="flex gap-2 items-center">
              <span className="text-xs text-muted-foreground whitespace-nowrap">{window.location.origin}/portal/</span>
              <Input
                className="h-8 text-xs w-48"
                placeholder="ex: clever-counts"
                defaultValue={slug || ''}
                onBlur={async (e) => {
                  const val = e.target.value.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
                  if (val === (slug || '')) return;
                  if (!val) {
                    await supabase.from('client_portals').update({ slug: null } as any).eq('id', portalId!);
                    queryClient.invalidateQueries({ queryKey: ['portal', clientId] });
                    toast.success('Slug removido');
                    return;
                  }
                  const { error } = await supabase.from('client_portals').update({ slug: val } as any).eq('id', portalId!);
                  if (error?.code === '23505') { toast.error('Este slug já está em uso'); return; }
                  if (error) { toast.error('Erro ao guardar slug'); return; }
                  queryClient.invalidateQueries({ queryKey: ['portal', clientId] });
                  toast.success('Slug guardado');
                }}
              />
            </div>
          </div>

          {/* Toggles */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Settings2 className="h-3.5 w-3.5" />
              Secções visíveis
            </Label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3 rounded-lg border bg-muted/20 p-4">
              {toggleItems.map(item => (
                <div key={item.field} className="flex items-center justify-between gap-3">
                  <Label className="text-sm font-normal">{item.label}</Label>
                  <Switch checked={portalData[item.field] as boolean} onCheckedChange={() => toggleField(item.field)} />
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Initial Questions */}
      <QuestionsCollapsible
        portalId={portalId}
        questions={questions}
        addQuestion={addQuestion}
        updateQuestion={updateQuestion}
        deleteQuestion={deleteQuestion}
        seedQuestionsFromProduct={seedQuestionsFromProduct}
        clientId={clientId}
        clientName={clientName}
      />

      {/* Feedback */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-3 bg-muted/30 border-b">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-info/10 flex items-center justify-center">
              <MessageCircle className="h-4.5 w-4.5 text-info" />
            </div>
            <CardTitle className="text-base">Feedback Recebido</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-4 space-y-2">
          {(feedback.data || []).map(f => (
            <div key={f.id} className="rounded-lg border p-3 bg-background">
              <p className="text-sm leading-relaxed">{f.content}</p>
              <p className="text-xs text-muted-foreground mt-2">{format(parseISO(f.submitted_at), 'dd/MM/yyyy HH:mm')}</p>
            </div>
          ))}
          {(feedback.data || []).length === 0 && (
            <div className="text-center py-6">
              <MessageCircle className="h-6 w-6 mx-auto text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">Sem feedback recebido</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Materials */}
      {(portalData as any).show_materials && (
        <Card className="overflow-hidden">
          <CardHeader className="pb-3 bg-muted/30 border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-success/10 flex items-center justify-center">
                  <FileText className="h-4.5 w-4.5 text-success" />
                </div>
                <CardTitle className="text-base">Entregáveis</CardTitle>
              </div>
              <label>
                <input
                  type="file"
                  className="hidden"
                  multiple
                  onChange={async (e) => {
                    if (!e.target.files?.length || !portalId) return;
                    setUploadingMaterial(true);
                    for (const file of Array.from(e.target.files)) {
                      const path = `${portalId}/${Date.now()}-${file.name}`;
                      const { error } = await supabase.storage.from('project-files').upload(path, file);
                      if (error) { toast.error(`Erro: ${file.name}`); continue; }
                      const { data: { publicUrl } } = supabase.storage.from('project-files').getPublicUrl(path);
                      await supabase.from('portal_materials').insert({
                        portal_id: portalId,
                        file_url: publicUrl,
                        file_name: file.name,
                        file_type: file.type.startsWith('image') ? 'image' : 'file',
                      } as any);
                    }
                    refetchMaterials();
                    setUploadingMaterial(false);
                    toast.success('Ficheiro(s) carregado(s)');
                    e.target.value = '';
                  }}
                />
                <Button size="sm" variant="outline" asChild disabled={uploadingMaterial}>
                  <span className="cursor-pointer"><Upload className="h-3 w-3 mr-1.5" />{uploadingMaterial ? 'A carregar...' : 'Carregar'}</span>
                </Button>
              </label>
            </div>
          </CardHeader>
          <CardContent className="pt-4 space-y-2">
            {portalMaterials.map((m: any) => (
              <div key={m.id} className="flex items-center justify-between gap-3 rounded-lg border p-3 bg-background group hover:bg-muted/20 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-8 w-8 rounded bg-muted/50 flex items-center justify-center shrink-0">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <a href={m.file_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline truncate">{m.file_name}</a>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity shrink-0" onClick={async () => {
                  await supabase.from('portal_materials').delete().eq('id', m.id);
                  refetchMaterials();
                }}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            {portalMaterials.length === 0 && (
              <div className="text-center py-6">
                <FileText className="h-6 w-6 mx-auto text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">Sem entregáveis. Carrega ficheiros para partilhar com o cliente.</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
