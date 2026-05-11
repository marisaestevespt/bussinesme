import { useState } from 'react';
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
import { Copy, ExternalLink, Plus, X, RefreshCw, Upload, FileText, Globe, Settings2, HelpCircle, Mail, Loader2, Music } from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import {
  usePortal, usePortalFaqs, usePortalQuestions,
  usePortalComments,
  getPortalTypeFromProduct, Portal
} from '@/hooks/usePortalData';
import { useProducts } from '@/hooks/useProducts';
import { EmptyHint } from '@/components/ui/loading-skeletons';
import { useAuth } from '@/hooks/useAuth';

interface Props {
  clientId: string;
  clientName: string;
  currentProduct: string | null;
  productId?: string | null;
}

export function ClientPortalSection({ clientId, clientName, currentProduct, productId }: Props) {
  const { products } = useProducts();
  const queryClient = useQueryClient();
  const { isOwner } = useAuth();
  const productList = products.data || [];
  const product = productList.find(p => (productId && p.id === productId) || p.name === currentProduct);
  const portalType = getPortalTypeFromProduct(product?.product_type || null);

  const { portal, upsertPortal, updatePortal } = usePortal(clientId);
  const portalData = portal.data;
  const portalId = portalData?.id;

  const welcomeSentAt = (portalData as any)?.welcome_email_sent_at as string | null | undefined;
  const [sendingWelcome, setSendingWelcome] = useState(false);

  // Find latest project of this client to send welcome for
  const { data: latestProject } = useQuery({
    queryKey: ['client-latest-project-for-welcome', clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from('projects')
        .select('id, name')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!clientId,
  });

  const handleSendWelcome = async () => {
    if (!latestProject?.id) {
      toast.error('Este cliente ainda não tem projeto associado');
      return;
    }
    setSendingWelcome(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-client-welcome', {
        body: { project_id: latestProject.id },
      });
      if (error || (data as any)?.error) {
        throw new Error((data as any)?.error || error?.message || 'Falha ao enviar');
      }
      toast.success('Email de boas-vindas enviado');
      queryClient.invalidateQueries({ queryKey: ['portal', clientId] });
    } catch (e: any) {
      toast.error(e.message || 'Erro a enviar email');
    } finally {
      setSendingWelcome(false);
    }
  };

  const { faqs, addFaq, updateFaq, deleteFaq } = usePortalFaqs(portalId);
  const { questions, addQuestion, updateQuestion, deleteQuestion } = usePortalQuestions(portalId);
  const { comments, addComment } = usePortalComments(portalId);

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

  const toggleActive = () => {
    updatePortal.mutate({ is_active: !portalData.is_active } as any);
  };

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
            <Label className="eyebrowr">URL do Portal</Label>
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

          {/* Welcome email */}
          <div className="rounded-lg border bg-muted/20 p-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium flex items-center gap-2">
                <Mail className="h-4 w-4 text-primary" />
                Email de Boas-vindas
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {welcomeSentAt
                  ? `Último envio: ${format(parseISO(welcomeSentAt), "dd/MM/yyyy 'às' HH:mm")}`
                  : 'Ainda não foi enviado.'}
              </p>
            </div>
            <Button
              size="sm"
              variant={welcomeSentAt ? 'outline' : 'default'}
              onClick={handleSendWelcome}
              disabled={sendingWelcome}
              className="shrink-0"
            >
              {sendingWelcome ? (
                <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />A enviar...</>
              ) : welcomeSentAt ? (
                <><Mail className="h-3.5 w-3.5 mr-1.5" />Re-enviar</>
              ) : (
                <><Mail className="h-3.5 w-3.5 mr-1.5" />Enviar boas-vindas</>
              )}
            </Button>
          </div>

          {/* Slug */}
          <div className="space-y-2">
            <Label className="eyebrowr">Slug personalizado</Label>
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

          {/* Active toggle */}
          <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/20 p-4">
            <div>
              <Label className="text-sm font-medium">Portal ativo</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Quando desativado, o cliente não consegue aceder ao portal.</p>
            </div>
            <Switch checked={!!portalData.is_active} onCheckedChange={toggleActive} />
          </div>

          {/* Playlist (vibe) */}
          <div className="space-y-2">
            <Label className="eyebrowr flex items-center gap-2">
              <Music className="h-3.5 w-3.5" />
              Playlist do portal
            </Label>
            <Input
              placeholder="Cola um link de Spotify, YouTube, SoundCloud ou Apple Music"
              defaultValue={(portalData as any).playlist_url || ''}
              onBlur={async (e) => {
                const val = e.target.value.trim() || null;
                if (val === ((portalData as any).playlist_url || null)) return;
                const { error } = await supabase.from('client_portals').update({ playlist_url: val } as any).eq('id', portalId!);
                if (error) { toast.error('Erro ao guardar playlist'); return; }
                queryClient.invalidateQueries({ queryKey: ['portal', clientId] });
                toast.success(val ? 'Playlist guardada' : 'Playlist removida');
              }}
              className="text-sm"
            />
            <p className="text-xs text-muted-foreground/70">
              Sobrepõe a playlist definida no produto. Deixa em branco para usar a do produto.
            </p>
          </div>

        </CardContent>
      </Card>

      {/* Materials card removed — entregáveis são geridos exclusivamente na subpágina interna "Entregáveis". */}
    </div>
  );
}
