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
import { Copy, ExternalLink, Plus, Trash2, X, MessageSquare, RefreshCw, Upload, FileText, Image as ImageIcon } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import {
  usePortal, usePortalFaqs, usePortalQuestions, usePortalFeedback,
  usePortalComments,
  getPortalTypeFromProduct, Portal
} from '@/hooks/usePortalData';
import { useProducts, Product } from '@/hooks/useProducts';

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
  
  

  const [replyText, setReplyText] = useState('');
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
    // Seed FAQs and diagnostic questions from product
    setTimeout(async () => {
      await seedFaqsFromProduct();
      await seedQuestionsFromProduct();
    }, 1500);
  };

  const seedQuestionsFromProduct = async () => {
    const portalRes = await supabase.from('client_portals').select('id').eq('client_id', clientId).maybeSingle();
    const pid = portalRes.data?.id;
    if (!pid || !product) return;
    // Fetch diagnostic questions from product
    const { data: diagQuestions } = await (supabase as any)
      .from('product_diagnostic_questions')
      .select('*')
      .eq('product_id', product.id)
      .order('sort_order');
    if (!diagQuestions || diagQuestions.length === 0) return;

    // Fetch client + business data for auto-fill
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
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Portal de Cliente</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
             O tipo de produto atual ({currentProduct || 'nenhum'}) não gera portal de cliente.
            Apenas produtos do tipo Serviço Pontual, Consultoria, Mentoria, Workshop ou Serviço Mensal criam portal.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!portalData) {
    return (
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Portal de Cliente</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">Este cliente ainda não tem portal criado.</p>
          <Button size="sm" onClick={createPortal}>Criar Portal</Button>
        </CardContent>
      </Card>
    );
  }

  const toggleField = (field: keyof Portal) => {
    updatePortal.mutate({ [field]: !portalData[field] } as any);
  };

  return (
    <div className="space-y-4">
      {/* Portal settings */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Portal de Cliente</CardTitle>
            <Badge variant={portalData.is_active ? 'default' : 'secondary'}>
              {portalData.is_active ? 'Activo' : 'Inactivo'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* URL */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">URL do Portal</Label>
            <div className="flex gap-2">
              <Input value={portalUrl} readOnly className="text-xs font-mono" />
              <Button variant="outline" size="icon" onClick={() => { navigator.clipboard.writeText(portalUrl); toast.success('Link copiado'); }}>
                <Copy className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" asChild>
                <a href={portalUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /></a>
              </Button>
              <Button size="sm" onClick={() => {
                localStorage.setItem(`portal_session_${portalData.id}`, JSON.stringify({
                  portal_id: portalData.id,
                  client_id: clientId,
                  timestamp: Date.now(),
                }));
                window.open(`${window.location.origin}/portal/${portalData.token}/view`, '_blank');
              }}>
                <ExternalLink className="h-3 w-3 mr-1" />Editar Portal
              </Button>
            </div>
          </div>

          {/* Slug personalizado */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Slug personalizado (URL curta)</Label>
            <div className="flex gap-2 items-center">
              <span className="text-xs text-muted-foreground whitespace-nowrap">{window.location.origin}/portal/</span>
              <Input
                className="h-7 text-xs w-48"
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

          {/* Tipo */}
          <div className="text-xs text-muted-foreground">
            Tipo: <Badge variant="outline">{portalData.portal_type === 'projeto_unico' ? 'Projeto Único' : 'Serviço Mensal'}</Badge>
          </div>

          {/* Toggles */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <ToggleRow label="Activo" checked={portalData.is_active} onChange={() => toggleField('is_active')} />
            <ToggleRow label="Espaço de Trabalho" checked={portalData.show_workspace} onChange={() => toggleField('show_workspace')} />
            <ToggleRow label="Reuniões" checked={portalData.show_meetings} onChange={() => toggleField('show_meetings')} />
            <ToggleRow label="Pagamentos" checked={portalData.show_payments} onChange={() => toggleField('show_payments')} />
            <ToggleRow label="Onboarding" checked={portalData.show_onboarding} onChange={() => toggleField('show_onboarding')} />
            <ToggleRow label="Fases / Timeline" checked={portalData.show_timeline} onChange={() => toggleField('show_timeline')} />
          </div>
        </CardContent>
      </Card>

      {/* FAQs management */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm">FAQ's do Portal</CardTitle>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={importFaqsFromProduct}>
              <RefreshCw className="h-3 w-3 mr-1" />Importar do Produto
            </Button>
            <Button size="sm" variant="outline" onClick={() => addFaq.mutate({ portal_id: portalId!, question: '', sort_order: (faqs.data?.length || 0) })}>
              <Plus className="h-3 w-3 mr-1" />Nova FAQ
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {(faqs.data || []).map(f => (
            <div key={f.id} className="flex gap-2 items-start">
              <div className="flex-1 space-y-1">
                <Input className="h-7 text-xs" defaultValue={f.question} placeholder="Pergunta" onBlur={e => updateFaq.mutate({ id: f.id, question: e.target.value })} />
                <Textarea className="text-xs min-h-[40px]" defaultValue={f.answer || ''} placeholder="Resposta" onBlur={e => updateFaq.mutate({ id: f.id, answer: e.target.value })} rows={2} />
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteFaq.mutate(f.id)}><X className="h-3 w-3" /></Button>
            </div>
          ))}
          {(faqs.data || []).length === 0 && <p className="text-xs text-muted-foreground">Sem FAQ's definidas</p>}
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
      />

      {/* Feedback received */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Feedback Recebido</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {(feedback.data || []).map(f => (
            <div key={f.id} className="border rounded-md p-2 text-xs">
              <p>{f.content}</p>
              <p className="text-muted-foreground mt-1">{format(parseISO(f.submitted_at), 'dd/MM/yyyy HH:mm')}</p>
            </div>
          ))}
          {(feedback.data || []).length === 0 && <p className="text-xs text-muted-foreground">Sem feedback recebido</p>}
        </CardContent>
      </Card>


      {/* Timeline phases — now managed via project_phases, visible in portal automatically */}


      {/* Materials */}
      {(portalData as any).show_materials && (
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm">Entregáveis</CardTitle>
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
                <span className="cursor-pointer"><Upload className="h-3 w-3 mr-1" />{uploadingMaterial ? 'A carregar...' : 'Carregar'}</span>
              </Button>
            </label>
          </CardHeader>
          <CardContent className="space-y-2">
            {portalMaterials.map((m: any) => (
              <div key={m.id} className="flex items-center justify-between gap-2 border rounded-md p-2">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <a href={m.file_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline truncate">{m.file_name}</a>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive shrink-0" onClick={async () => {
                  await supabase.from('portal_materials').delete().eq('id', m.id);
                  refetchMaterials();
                }}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
            {portalMaterials.length === 0 && <p className="text-xs text-muted-foreground">Sem entregáveis. Carrega ficheiros para partilhar com o cliente.</p>}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <Label className="text-xs">{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
