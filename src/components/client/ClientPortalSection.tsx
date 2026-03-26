import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Copy, ExternalLink, Plus, Trash2, X, MessageSquare, RefreshCw, Upload, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import {
  usePortal, usePortalFaqs, usePortalQuestions, usePortalFeedback,
  usePortalComments, usePortalTimeline, usePortalSummaries,
  getPortalTypeFromProduct, Portal
} from '@/hooks/usePortalData';
import { useProducts, Product } from '@/hooks/useProducts';

interface Props {
  clientId: string;
  clientName: string;
  currentProduct: string | null;
}

export function ClientPortalSection({ clientId, clientName, currentProduct }: Props) {
  const { products } = useProducts();
  const queryClient = useQueryClient();
  const productList = products.data || [];
  const product = productList.find(p => p.name === currentProduct);
  const portalType = getPortalTypeFromProduct(product?.product_type || null);

  const { portal, upsertPortal, updatePortal } = usePortal(clientId);
  const portalData = portal.data;
  const portalId = portalData?.id;

  const { faqs, addFaq, updateFaq, deleteFaq } = usePortalFaqs(portalId);
  const { questions, addQuestion, updateQuestion, deleteQuestion } = usePortalQuestions(portalId);
  const { feedback } = usePortalFeedback(portalId);
  const { comments, addComment } = usePortalComments(portalId);
  const { phases, addPhase, updatePhase, deletePhase } = usePortalTimeline(portalId);
  const { summaries, addSummary, updateSummary, deleteSummary } = usePortalSummaries(portalId);

  const [replyText, setReplyText] = useState('');
  const [newSummaryMonth, setNewSummaryMonth] = useState(new Date().getMonth() + 1);
  const [newSummaryYear, setNewSummaryYear] = useState(new Date().getFullYear());
  const [newSummaryContent, setNewSummaryContent] = useState('');
  const [uploadingMaterial, setUploadingMaterial] = useState(false);

  const { data: portalMaterials = [], refetch: refetchMaterials } = useQuery({
    queryKey: ['portal-materials', portalId],
    enabled: !!portalId,
    queryFn: async () => {
      const { data } = await supabase.from('portal_materials').select('*').eq('portal_id', portalId!).order('created_at', { ascending: false });
      return (data || []) as any[];
    },
  });

  const portalUrl = portalData ? `${window.location.origin}/portal/${portalData.token}` : '';

  const createPortal = async () => {
    if (!portalType) { toast.error('Este tipo de produto não gera portal'); return; }
    await upsertPortal.mutateAsync({ client_id: clientId, portal_type: portalType });
    // After portal is created, seed FAQs from product
    toast.success('Portal criado');
    // We need to wait for portal data to be available, so seed FAQs after invalidation
    setTimeout(() => seedFaqsFromProduct(), 1500);
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
            Apenas produtos do tipo Projeto 1:1, Consultoria, Mentoria ou Serviço Mensal criam portal.
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
            <ToggleRow label="FAQ's" checked={portalData.show_faqs} onChange={() => toggleField('show_faqs')} />
            <ToggleRow label="Onboarding" checked={portalData.show_onboarding} onChange={() => toggleField('show_onboarding')} />
            <ToggleRow label="Materiais" checked={(portalData as any).show_materials ?? true} onChange={() => toggleField('show_materials' as keyof Portal)} />
            {portalData.portal_type === 'projeto_unico' && (
              <ToggleRow label="Timeline" checked={portalData.show_timeline} onChange={() => toggleField('show_timeline')} />
            )}
            {portalData.portal_type === 'servico_mensal' && (
              <ToggleRow label="Resumo Mensal" checked={portalData.show_monthly_summary} onChange={() => toggleField('show_monthly_summary')} />
            )}
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
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Perguntas Iniciais</CardTitle>
          <Button size="sm" variant="outline" onClick={() => addQuestion.mutate({ portal_id: portalId!, question: '', sort_order: (questions.data?.length || 0) })}>
            <Plus className="h-3 w-3 mr-1" />Nova Pergunta
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {(questions.data || []).map(q => (
            <div key={q.id} className="flex gap-2 items-start border rounded-md p-2">
              <div className="flex-1 space-y-1">
                <Input className="h-7 text-xs" defaultValue={q.question} placeholder="Pergunta" onBlur={e => updateQuestion.mutate({ id: q.id, question: e.target.value })} />
                {q.answer ? (
                  <div className="bg-muted/50 p-2 rounded text-xs">
                    <span className="font-medium">Resposta do cliente:</span> {q.answer}
                    {q.answered_at && <span className="text-muted-foreground ml-2">({format(parseISO(q.answered_at), 'dd/MM/yyyy HH:mm')})</span>}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">Aguardando resposta do cliente</p>
                )}
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteQuestion.mutate(q.id)}><X className="h-3 w-3" /></Button>
            </div>
          ))}
          {(questions.data || []).length === 0 && <p className="text-xs text-muted-foreground">Sem perguntas definidas</p>}
        </CardContent>
      </Card>

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


      {/* Timeline phases (projeto_unico) */}
      {portalData.portal_type === 'projeto_unico' && portalData.show_timeline && (
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm">Timeline do Projeto</CardTitle>
            <Button size="sm" variant="outline" onClick={() => addPhase.mutate({ portal_id: portalId!, title: '', sort_order: (phases.data?.length || 0) })}>
              <Plus className="h-3 w-3 mr-1" />Nova Fase
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {(phases.data || []).map(p => (
              <div key={p.id} className="flex gap-2 items-center">
                <Input className="h-7 text-xs flex-1" defaultValue={p.title} placeholder="Título da fase" onBlur={e => updatePhase.mutate({ id: p.id, title: e.target.value })} />
                <select className="h-7 text-xs border rounded px-2 bg-background" defaultValue={p.status} onChange={e => updatePhase.mutate({ id: p.id, status: e.target.value })}>
                  <option value="por_comecar">Por começar</option>
                  <option value="em_curso">Em curso</option>
                  <option value="concluido">Concluído</option>
                </select>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deletePhase.mutate(p.id)}><X className="h-3 w-3" /></Button>
              </div>
            ))}
            {(phases.data || []).length === 0 && <p className="text-xs text-muted-foreground">Sem fases definidas</p>}
          </CardContent>
        </Card>
      )}

      {/* Monthly Summaries (servico_mensal) */}
      {portalData.portal_type === 'servico_mensal' && portalData.show_monthly_summary && (
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm">Resumos Mensais</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2 items-end">
              <div className="space-y-1">
                <Label className="text-xs">Mês</Label>
                <Input type="number" min={1} max={12} className="h-7 text-xs w-16" value={newSummaryMonth} onChange={e => setNewSummaryMonth(Number(e.target.value))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Ano</Label>
                <Input type="number" className="h-7 text-xs w-20" value={newSummaryYear} onChange={e => setNewSummaryYear(Number(e.target.value))} />
              </div>
              <Button size="sm" variant="outline" onClick={() => {
                if (!newSummaryContent.trim()) return;
                addSummary.mutate({ portal_id: portalId!, month: newSummaryMonth, year: newSummaryYear, content: newSummaryContent });
                setNewSummaryContent('');
              }}>
                <Plus className="h-3 w-3 mr-1" />Adicionar
              </Button>
            </div>
            <Textarea className="text-xs" placeholder="Conteúdo do resumo mensal..." value={newSummaryContent} onChange={e => setNewSummaryContent(e.target.value)} rows={3} />
            <div className="space-y-2">
              {(summaries.data || []).map(s => (
                <div key={s.id} className="border rounded-md p-2 text-xs">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-medium">{s.month}/{s.year}</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => deleteSummary.mutate(s.id)}><X className="h-3 w-3" /></Button>
                  </div>
                  <Textarea className="text-xs min-h-[40px]" defaultValue={s.content} onBlur={e => updateSummary.mutate({ id: s.id, content: e.target.value })} rows={2} />
                </div>
              ))}
            </div>
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
