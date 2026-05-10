import { useState, useEffect } from 'react';
import { enrichQuestionsWithAutoFill } from '@/lib/portalAutoFill';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { CalendarIcon, Plus, Trash2, GitBranch, UserPlus, Video, ChevronDown, Upload, X, ExternalLink } from 'lucide-react';
import { CrmLabelPicker, CrmLabelBadges } from './CrmLabelPicker';
import { useCrmLabels } from '@/hooks/useCrmLabels';
import { format, differenceInDays, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { CRM_SOURCES, INTERACTION_TYPES, statusLabel, getFollowUpState } from '@/hooks/useCrmData';
import { useCrmStages } from '@/hooks/useCrmStages';
import { useCrmData } from '@/hooks/useCrmData';
import { toast } from 'sonner';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCommercialMembers } from '@/hooks/useTeamByWorkArea';
import { resolveProductId } from '@/lib/productResolver';
import { EmptyHint } from '@/components/ui/loading-skeletons';
import { QuoteCalculatorDialog } from '@/components/product/QuoteCalculatorDialog';
import { Calculator } from 'lucide-react';

interface LeadDetailSheetProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  lead: any | null;
  products: string[];
  profiles: { id: string; full_name: string | null }[];
  onSave: (lead: any) => void;
  onDelete?: (id: string) => void;
}

export function LeadDetailSheet({ open, onOpenChange, lead, products, profiles, onSave, onDelete }: LeadDetailSheetProps) {
  const navigate = useNavigate();
  const { useLeadInteractions, upsertInteraction, deleteInteraction, useLeadActions, upsertLeadAction, deleteLeadAction } = useCrmData();
  const { stages: CRM_STATUSES } = useCrmStages();
  const { data: commercialMembers = [] } = useCommercialMembers();
  const { labels, leadLabelsMap } = useCrmLabels();
  const [form, setForm] = useState<any>({});
  const [interactionDialog, setInteractionDialog] = useState(false);
  const [newAction, setNewAction] = useState('');
  const [lostReasonDialog, setLostReasonDialog] = useState(false);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [quoteProductId, setQuoteProductId] = useState<string | null>(null);
  const [lostReason, setLostReason] = useState('');
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [meetingDialog, setMeetingDialog] = useState(false);
  const [meetingDate, setMeetingDate] = useState<Date | undefined>(undefined);
  const [meetingTime, setMeetingTime] = useState('10:00');
  const [meetingTitle, setMeetingTitle] = useState('');
  const qc = useQueryClient();

  const interactions = useLeadInteractions(lead?.id || null);
  const actions = useLeadActions(lead?.id || null);

  useEffect(() => {
    if (!open) return;
    if (lead) {
      setForm({
        id: lead.id,
        name: lead.name || '',
        added_at: lead.added_at || new Date().toISOString().split('T')[0],
        source: lead.source || '',
        status: lead.status || 'lead',
        email: lead.email || '',
        phone: lead.phone || '',
        potential_product: lead.potential_product || '',
        closed_product: lead.closed_product || '',
        responsible_id: lead.responsible_id || '',
        next_followup: lead.next_followup ? new Date(lead.next_followup) : undefined,
        followup_notes: lead.followup_notes || '',
        estimated_value: lead.estimated_value?.toString() || '',
        documents: lead.documents || '',
        context: lead.context || '',
        lost_reason: lead.lost_reason || '',
      });
    } else {
      setForm({
        name: '', added_at: new Date().toISOString().split('T')[0], source: '', status: 'lead',
        email: '', phone: '', potential_product: '', closed_product: '', responsible_id: '',
        next_followup: undefined, followup_notes: '', estimated_value: '', documents: '', context: '', lost_reason: '',
      });
    }
  }, [open, lead]);

  const set = (patch: any) => setForm((f: any) => ({ ...f, ...patch }));

  const handleStatusChange = (newStatus: string) => {
    if (newStatus === 'perdido' && form.status !== 'perdido') {
      setPendingStatus(newStatus);
      setLostReasonDialog(true);
      return;
    }
    set({ status: newStatus });
  };

  const handleLostReasonConfirm = () => {
    set({ status: pendingStatus, lost_reason: lostReason });
    setLostReasonDialog(false);
    setLostReason('');
    setPendingStatus(null);
  };

  const handleSave = async () => {
    if (!form.name?.trim()) { toast.error('Nome obrigatório'); return; }
    const potentialProductId = await resolveProductId(form.potential_product);
    onSave({
      ...(form.id ? { id: form.id } : {}),
      name: form.name,
      added_at: form.added_at,
      source: form.source || null,
      status: form.status,
      email: form.email || null,
      phone: form.phone || null,
      potential_product: form.potential_product || null,
      potential_product_id: potentialProductId,
      closed_product: form.closed_product || null,
      responsible_id: form.responsible_id || null,
      next_followup: form.next_followup ? format(form.next_followup, 'yyyy-MM-dd') : null,
      followup_notes: form.followup_notes || null,
      estimated_value: parseFloat(form.estimated_value) || 0,
      documents: form.documents || null,
      context: form.context || null,
      lost_reason: form.lost_reason || null,
    });
  };

  const handleAddAction = () => {
    if (!newAction.trim() || !lead?.id) return;
    upsertLeadAction.mutate({ lead_id: lead.id, task: newAction });
    setNewAction('');
  };

  const handleFileUpload = async (file: File) => {
    if (!lead?.id) return;
    const path = `crm/${lead.id}/${Date.now()}_${file.name}`;
    const { error: uploadErr } = await supabase.storage.from('commercial-files').upload(path, file);
    if (uploadErr) { toast.error('Erro ao fazer upload'); return; }
    const { data: urlData } = supabase.storage.from('commercial-files').getPublicUrl(path);
    const currentDocs = form.documents || '';
    const newDocs = currentDocs ? `${currentDocs}\n${urlData.publicUrl}` : urlData.publicUrl;
    set({ documents: newDocs });
    toast.success('Ficheiro carregado!');
  };

  const handleConvertToClient = async () => {
    if (!lead?.id) return;
    try {
      const productName = form.closed_product || form.potential_product || null;
      const productId = await resolveProductId(productName);
      const { data: newClient, error: clientError } = await supabase.from('clients').insert({
        full_name: form.name || '',
        email: form.email || null,
        whatsapp: form.phone || null,
        current_product: productName,
        current_product_id: productId,
        documents: form.documents || null,
        status: 'em_onboarding',
        conversion_date: format(new Date(), 'yyyy-MM-dd'),
      } as any).select('id').single();
      if (clientError) throw clientError;

      const addedDate = form.added_at ? parseISO(form.added_at) : new Date();
      const daysInCrm = differenceInDays(new Date(), addedDate);

      const responsibleName = profiles.find(p => p.id === form.responsible_id)?.full_name || '';
      const parts = [
        `Convertido de Lead CRM`,
        form.source ? `Fonte: ${form.source}` : null,
        form.potential_product ? `Produto potencial: ${form.potential_product}` : null,
        form.closed_product ? `Produto fechado: ${form.closed_product}` : null,
        form.estimated_value ? `Valor estimado: ${form.estimated_value}€` : null,
        responsibleName ? `Responsável: ${responsibleName}` : null,
        `Tempo no CRM: ${daysInCrm} dia(s)`,
      ].filter(Boolean).join(' | ');

      const observations = [
        form.context || null,
        form.followup_notes ? `Notas FU: ${form.followup_notes}` : null,
      ].filter(Boolean).join('\n');

      await supabase.from('client_history').insert({
        client_id: newClient.id,
        entry_date: format(new Date(), 'yyyy-MM-dd'),
        milestone: parts,
        observations: observations || null,
        lead_id: lead.id,
      } as any);

      let createdProjectId: string | null = null;
      if (productName) {
        const { data: matchedProduct } = await supabase
          .from('products')
          .select('id, product_type, sales_type, cycle_duration, default_project_mode, task_mode, task_modes, session_count, session_duration_minutes, estimated_project_hours')
          .eq('name', productName)
          .maybeSingle();

        let deadline: string | null = null;
        if (matchedProduct?.cycle_duration) {
          const end = new Date();
          end.setMonth(end.getMonth() + matchedProduct.cycle_duration);
          deadline = format(end, 'yyyy-MM-dd');
        }

        const isRecurringLead = (matchedProduct as any)?.default_project_mode === 'recorrente' || matchedProduct?.sales_type === 'avenca_mensal' || matchedProduct?.sales_type === 'subscricao';
        const projectMode = (matchedProduct as any)?.default_project_mode || (isRecurringLead ? 'recorrente' : 'pontual');
        const taskMode = (matchedProduct as any)?.task_mode || 'fases';

        const { data: newProject } = await supabase.from('projects').insert({
          name: `${productName} — ${form.name || 'Cliente'}`,
          type: isRecurringLead ? 'cliente_servico_mensal' : 'cliente_projeto_unico',
          status: 'em_onboarding',
          department: 'clientes',
          departments: ['clientes', 'operacao'],
          client_name: form.name || null,
          client_id: newClient.id,
          product_id: matchedProduct?.id || null,
          product_name: productName,
          start_date: format(new Date(), 'yyyy-MM-dd'),
          deadline: projectMode === 'recorrente' ? null : deadline,
          project_mode: projectMode,
          task_mode: taskMode,
          task_modes: (matchedProduct as any)?.task_modes || [taskMode],
          session_count: (matchedProduct as any)?.session_count ?? null,
          session_duration_minutes: (matchedProduct as any)?.session_duration_minutes ?? null,
          budgeted_minutes: (matchedProduct as any)?.estimated_project_hours
            ? Math.round(Number((matchedProduct as any).estimated_project_hours) * 60)
            : null,
        } as any).select('id').single();

        createdProjectId = newProject?.id || null;

        if (matchedProduct?.product_type) {
          const projetoTypes = ['projeto_1_1', 'servico_pontual', 'consulta', 'consultoria_individual', 'consultoria_grupo', 'mentoria_individual', 'mentoria_grupo', 'workshop'];
          let portalType: 'projeto_unico' | 'servico_mensal' | null = null;
          if (projetoTypes.includes(matchedProduct.product_type)) portalType = 'projeto_unico';
          else if (matchedProduct.product_type === 'servico_mensal') portalType = 'servico_mensal';

          if (portalType) {
            await supabase.from('client_portals').insert({
              client_id: newClient.id,
              portal_type: portalType,
              is_active: true,
            });

            if (matchedProduct.id) {
              // Carrega FAQs do produto (podem estar vazias)
              const { data: productData } = await supabase
                .from('products')
                .select('faqs')
                .eq('id', matchedProduct.id)
                .maybeSingle();
              const productFaqs: { question: string; answer: string }[] = Array.isArray(productData?.faqs)
                ? (productData.faqs as unknown as { question: string; answer: string }[])
                : [];
              const validFaqs = productFaqs.filter(f => f.question?.trim());

              // Procura o portal recém-criado (independente de haver FAQs)
              const { data: portal } = await supabase
                .from('client_portals')
                .select('id')
                .eq('client_id', newClient.id)
                .maybeSingle();

              if (portal?.id) {
                // 1) Copia FAQs (se houver pelo menos uma válida)
                if (validFaqs.length > 0) {
                  await supabase.from('portal_faqs').insert(
                    validFaqs.map((f, i) => ({
                      portal_id: portal.id,
                      question: f.question,
                      answer: f.answer || '',
                      sort_order: i,
                    }))
                  );
                }

                // 2) Copia perguntas de diagnóstico SEMPRE (independente de FAQs)
                const { data: diagQuestions } = await supabase
                  .from('product_diagnostic_questions')
                  .select('question, sort_order, question_group, answer_type, group_sort_order')
                  .eq('product_id', matchedProduct.id!)
                  .order('group_sort_order')
                  .order('sort_order');
                if (diagQuestions?.length) {
                  const { data: businessData } = await supabase.from('business_setup').select('*').limit(1).maybeSingle();
                  const clientData = { email: lead.email, full_name: lead.name };
                  const rows = diagQuestions.map((dq, i) => ({
                      portal_id: portal.id,
                      question: dq.question,
                      sort_order: dq.sort_order ?? i,
                      question_group: dq.question_group || null,
                      answer_type: dq.answer_type || 'text',
                      group_sort_order: dq.group_sort_order ?? 0,
                  }));
                  const enrichedRows = enrichQuestionsWithAutoFill(rows, clientData, businessData || null);
                  await supabase.from('portal_initial_questions').insert(enrichedRows as any);
                }
              }
            }
          }
        }
      }

      const successParts = ['Cliente criado'];
      if (createdProjectId) successParts.push('projeto criado');
      toast.success(successParts.join(', ') + '!');

      onOpenChange(false);
      navigate(`/hub/clientes/${newClient.id}`);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao converter lead em cliente');
    }
  };

  const docLinks = (form.documents || '').split('\n').filter(Boolean);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="!w-[96vw] !max-w-[1400px] !h-[94vh] !max-h-[94vh] !gap-0 !p-0 overflow-hidden">
          <DialogHeader className="border-b px-6 py-5 pr-12">
            <div className="flex items-center justify-between gap-3">
              <DialogTitle>{form.id ? 'Ficha do Lead' : 'Nova Lead'}</DialogTitle>
              {form.id && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    onOpenChange(false);
                    navigate(`/hub/comercial/crm/${form.id}`);
                  }}
                >
                  <ExternalLink className="h-3.5 w-3.5 mr-1" /> Abrir página
                </Button>
              )}
            </div>
          </DialogHeader>

          <div className="min-h-0 overflow-y-auto px-6 py-5">
            <div className="space-y-5">
              {/* Core fields */}
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label>Nome *</Label>
                  <Input value={form.name || ''} onChange={e => set({ name: e.target.value })} />
                </div>
                <div>
                  <Label>Adicionado</Label>
                  <Input value={form.added_at || ''} disabled className="text-muted-foreground" />
                </div>
                <div>
                  <Label>Fonte da Lead</Label>
                  <Select value={form.source || ''} onValueChange={v => set({ source: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                    <SelectContent>{CRM_SOURCES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Label>Status</Label>
                  <Select value={form.status || 'lead'} onValueChange={handleStatusChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{CRM_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                {form.id && (
                  <div className="col-span-2">
                    <Label>Etiquetas</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <CrmLabelBadges labelIds={leadLabelsMap[form.id] || []} labels={labels} />
                      <CrmLabelPicker leadId={form.id} selectedLabelIds={leadLabelsMap[form.id] || []} />
                    </div>
                  </div>
                )}
                <div><Label>Email</Label><Input value={form.email || ''} onChange={e => set({ email: e.target.value })} /></div>
                <div><Label>Telefone</Label><Input value={form.phone || ''} onChange={e => set({ phone: e.target.value })} /></div>
                <div className="col-span-2">
                  <Label>Vendedor / Responsável</Label>
                  <Select value={form.responsible_id || ''} onValueChange={v => set({ responsible_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                    <SelectContent>
                      {commercialMembers.length > 0 && (
                        <SelectGroup>
                          <SelectLabel className="text-[10px] text-muted-foreground">Equipa Comercial</SelectLabel>
                          {commercialMembers.map(cm => (
                            <SelectItem key={`cm-${cm.profile_id || cm.id}`} value={cm.profile_id || cm.id}>
                              {cm.full_name} <span className="text-muted-foreground ml-1">⭐</span>
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      )}
                      <SelectGroup>
                        <SelectLabel className="text-[10px] text-muted-foreground">Todos</SelectLabel>
                        {profiles.map(p => <SelectItem key={p.id} value={p.id}>{p.full_name || 'Sem nome'}</SelectItem>)}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Label>Produto Potencial</Label>
                  <Select value={form.potential_product || ''} onValueChange={v => set({ potential_product: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                    <SelectContent>{products.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Label>Produto Fechado</Label>
                  <Select value={form.closed_product || ''} onValueChange={v => set({ closed_product: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                    <SelectContent>{products.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Próximo Follow-up</Label>
                  <div className="flex gap-1">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("flex-1 justify-start text-left font-normal", !form.next_followup && "text-muted-foreground")}>
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {form.next_followup ? format(form.next_followup, 'dd/MM/yyyy') : 'Selecionar'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={form.next_followup} onSelect={d => set({ next_followup: d })} className="p-3 pointer-events-auto" />
                      </PopoverContent>
                    </Popover>
                    {form.next_followup && (
                      <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0" onClick={() => set({ next_followup: undefined })}>
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
                <div>
                  <Label>Valor Estimado (€)</Label>
                  <div className="flex gap-2">
                    <Input type="number" step="0.01" value={form.estimated_value || ''} onChange={e => set({ estimated_value: e.target.value })} />
                    <Button variant="outline" size="icon" type="button" title="Calculadora de Orçamento" onClick={async () => {
                      const productName = form.closed_product || form.potential_product;
                      if (!productName) { toast.error('Define o produto potencial primeiro'); return; }
                      const pid = await resolveProductId(productName);
                      if (!pid) { toast.error('Produto não encontrado'); return; }
                      setQuoteProductId(pid);
                      setQuoteOpen(true);
                    }}>
                      <Calculator className="h-4 w-4" />
                    </Button>
                  </div>
                  {form.quote_id && <p className="text-[11px] text-muted-foreground mt-1">Orçamento associado · valor sincronizado.</p>}
                </div>
                <div className="col-span-2">
                  <Label>Notas FU</Label>
                  <Input value={form.followup_notes || ''} onChange={e => set({ followup_notes: e.target.value })} />
                </div>
              </div>

              {/* Documents section */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Documentos</Label>
                <Input value={form.documents || ''} onChange={e => set({ documents: e.target.value })} placeholder="Link para documentos (https://...)" />
                {lead?.id && (
                  <div>
                    <label className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors border border-dashed rounded-md p-3 justify-center">
                      <Upload className="h-4 w-4" />
                      <span>Fazer upload de ficheiro</span>
                      <input
                        type="file"
                        className="hidden"
                        onChange={e => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload(file);
                          e.target.value = '';
                        }}
                      />
                    </label>
                  </div>
                )}
                {docLinks.length > 0 && (
                  <div className="space-y-1 rounded-md border p-2">
                    {docLinks.map((url: string, i: number) => (
                      <div key={i} className="flex items-center justify-between gap-2">
                        <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline truncate flex-1">{decodeURIComponent(url.split('/').pop() || url)}</a>
                        <Button variant="ghost" aria-label="Eliminar" size="icon" className="h-5 w-5 flex-shrink-0" onClick={() => {
                          const updated = docLinks.filter((_, j) => j !== i).join('\n');
                          set({ documents: updated });
                        }}>
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Separator />

              {/* Context */}
              <div>
                <Label className="text-sm font-semibold">Contexto</Label>
                <Textarea className="mt-1" rows={4} value={form.context || ''} onChange={e => set({ context: e.target.value })} placeholder="Notas gerais sobre este lead..." />
              </div>

              {form.lost_reason && (
                <div>
                  <Label className="text-sm font-semibold text-destructive">Motivo de Perda</Label>
                  <p className="text-sm mt-1">{form.lost_reason}</p>
                </div>
              )}

              <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_auto]">
                <Button className="w-full" onClick={handleSave}>Guardar</Button>
                {lead?.id && (
                  <Button variant="outline" className="w-full lg:w-auto border-primary text-primary hover:bg-primary/10" onClick={handleConvertToClient}>
                    <UserPlus className="h-4 w-4 mr-2" /> Converter em Cliente
                  </Button>
                )}
              </div>

              {/* Schedule meeting button */}
              {lead?.id && (
                <Button variant="outline" className="w-full" onClick={() => { setMeetingTitle(`Diagnóstico — ${form.name || 'Lead'}`); setMeetingDate(undefined); setMeetingTime('10:00'); setMeetingDialog(true); }}>
                  <Video className="h-4 w-4 mr-2" /> Agendar Reunião
                </Button>
              )}

              {/* Collapsible sections for saved leads */}
              {lead?.id && (
                <div className="space-y-2">
                  {/* Interactions */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold">Histórico de Interações ({(interactions.data || []).length})</h3>
                      <Button variant="outline" size="sm" onClick={() => setInteractionDialog(true)}><Plus className="h-3 w-3 mr-1" />Nova</Button>
                    </div>
                    {(interactions.data || []).length === 0 ? (
                      <EmptyHint>Sem interações registadas.</EmptyHint>
                    ) : (
                      <div className="space-y-1">
                        {(interactions.data || []).map((i: any) => (
                          <Collapsible key={i.id}>
                            <div className="flex items-center gap-2 rounded-md border px-3 py-2">
                              <CollapsibleTrigger asChild>
                                <Button variant="ghost" aria-label="Mostrar mais" size="icon" className="h-6 w-6 flex-shrink-0 p-0">
                                  <ChevronDown className="h-3.5 w-3.5 transition-transform [[data-state=open]>&]:rotate-180" />
                                </Button>
                              </CollapsibleTrigger>
                              <span className="text-xs text-muted-foreground w-[70px] flex-shrink-0">{i.interaction_date ? format(new Date(i.interaction_date), 'dd/MM/yy') : ''}</span>
                              <Badge variant="secondary" className="text-xs flex-shrink-0">{INTERACTION_TYPES.find(t => t.value === i.interaction_type)?.label || i.interaction_type}</Badge>
                              <span className="text-xs truncate flex-1 text-muted-foreground">{i.notes || ''}</span>
                              <Button variant="ghost" aria-label="Eliminar" size="icon" className="h-6 w-6 flex-shrink-0" onClick={() => deleteInteraction.mutate(i.id)}>
                                <Trash2 className="h-3 w-3 text-destructive" />
                              </Button>
                            </div>
                            <CollapsibleContent className="px-3 pb-2 pt-1">
                              <p className="text-sm whitespace-pre-wrap">{i.notes || 'Sem notas.'}</p>
                              {i.files && (
                                <a href={i.files} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline mt-1 block">📎 {i.files.split('/').pop()}</a>
                              )}
                            </CollapsibleContent>
                          </Collapsible>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actions checklist */}
                  <Separator />
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold">Lista de Ações ({(actions.data || []).length})</h3>
                    <div className="space-y-2">
                      {(actions.data || []).map((a: any) => (
                        <div key={a.id} className="flex items-center gap-2">
                          <Checkbox
                            checked={a.completed}
                            onCheckedChange={checked => upsertLeadAction.mutate({ id: a.id, lead_id: a.lead_id, completed: !!checked })}
                          />
                          <span className={cn("text-sm flex-1", a.completed && "line-through text-muted-foreground")}>{a.task}</span>
                          {a.deadline && <span className="text-xs text-muted-foreground">{format(new Date(a.deadline), 'dd/MM')}</span>}
                          <Button variant="ghost" aria-label="Eliminar" size="icon" className="h-6 w-6" onClick={() => deleteLeadAction.mutate(a.id)}>
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                      <Input placeholder="Nova ação..." value={newAction} onChange={e => setNewAction(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddAction()} />
                      <Button size="sm" variant="outline" onClick={handleAddAction}><Plus className="h-3 w-3" /></Button>
                    </div>
                  </div>

                  {/* Pipeline History */}
                  <Separator />
                  <PipelineHistory leadId={lead.id} />
                </div>
              )}

              {/* Delete */}
              {lead?.id && onDelete && (
                <>
                  <Separator />
                  <Button variant="destructive" size="sm" className="w-full" onClick={() => { onDelete(lead.id); onOpenChange(false); }}>
                    Eliminar Lead
                  </Button>
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* New Interaction Dialog */}
      <InteractionDialog
        open={interactionDialog}
        onOpenChange={setInteractionDialog}
        leadId={lead?.id}
        onSave={rec => { upsertInteraction.mutate(rec); setInteractionDialog(false); }}
      />

      {/* Lost Reason Dialog */}
      <Dialog open={lostReasonDialog} onOpenChange={v => { if (!v) { setLostReasonDialog(false); setPendingStatus(null); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Motivo de Perda</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Label>Motivo (opcional)</Label>
            <Textarea value={lostReason} onChange={e => setLostReason(e.target.value)} placeholder="Ex: Orçamento insuficiente, timing..." />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => { setLostReasonDialog(false); setPendingStatus(null); }}>Cancelar</Button>
              <Button className="flex-1" onClick={handleLostReasonConfirm}>Confirmar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Schedule Meeting Dialog */}
      <Dialog open={meetingDialog} onOpenChange={setMeetingDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Agendar Reunião</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Título</Label>
              <Input value={meetingTitle} onChange={e => setMeetingTitle(e.target.value)} />
            </div>
            <div>
              <Label>Data</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !meetingDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {meetingDate ? format(meetingDate, 'dd/MM/yyyy') : 'Selecionar data'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={meetingDate} onSelect={setMeetingDate} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label>Hora</Label>
              <Input type="time" value={meetingTime} onChange={e => setMeetingTime(e.target.value)} />
            </div>
            <Button className="w-full" disabled={!meetingDate || !meetingTitle.trim()} onClick={async () => {
              if (!meetingDate || !meetingTitle.trim()) return;
              const [h, m] = meetingTime.split(':').map(Number);
              const dt = new Date(meetingDate);
              dt.setHours(h || 10, m || 0, 0, 0);
              const { error } = await supabase.from('meetings').insert({
                title: meetingTitle.trim(),
                date_time: dt.toISOString(),
                status: 'por_confirmar',
                meeting_type: 'diagnostico' as any,
                client_name: form.name || null,
                department: 'comercial',
              });
              if (error) { toast.error('Erro ao criar reunião'); return; }
              if (lead?.id) {
                await supabase.from('crm_interactions').insert({
                  lead_id: lead.id,
                  interaction_type: 'reuniao',
                  interaction_date: format(meetingDate, 'yyyy-MM-dd'),
                  notes: `Reunião de diagnóstico agendada: ${meetingTitle}`,
                });
              }
              qc.invalidateQueries({ queryKey: ['meetings'] });
              qc.invalidateQueries({ queryKey: ['crm-interactions'] });
              setMeetingDialog(false);
              toast.success('Reunião agendada');
            }}>
              Agendar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ─── Interaction Dialog ─── */
function InteractionDialog({ open, onOpenChange, leadId, onSave }: { open: boolean; onOpenChange: (v: boolean) => void; leadId?: string; onSave: (r: any) => void }) {
  const [form, setForm] = useState({ interaction_date: new Date(), interaction_type: 'outro', notes: '', files: '' });
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (open) setForm({ interaction_date: new Date(), interaction_type: 'outro', notes: '', files: '' });
  }, [open]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    const urls: string[] = form.files ? form.files.split(',').map(u => u.trim()).filter(Boolean) : [];
    try {
      for (const file of Array.from(files)) {
        const ext = file.name.split('.').pop();
        const path = `crm-interactions/${leadId || 'new'}/${Date.now()}-${file.name}`;
        const { error } = await supabase.storage.from('commercial-files').upload(path, file);
        if (error) throw error;
        const { data: urlData } = supabase.storage.from('commercial-files').getPublicUrl(path);
        urls.push(urlData.publicUrl);
      }
      setForm(f => ({ ...f, files: urls.join(', ') }));
      toast.success('Ficheiro(s) carregado(s)');
    } catch (err: any) {
      toast.error('Erro ao carregar ficheiro: ' + err.message);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Nova Interação</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Data</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(form.interaction_date, 'dd/MM/yyyy')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={form.interaction_date} onSelect={d => d && setForm(f => ({ ...f, interaction_date: d }))} className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>
          <div>
            <Label>Tipo</Label>
            <Select value={form.interaction_type} onValueChange={v => setForm(f => ({ ...f, interaction_type: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{INTERACTION_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Notas</Label><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
          <div>
            <Label>Ficheiros</Label>
            <div className="flex gap-2">
              <Input value={form.files} onChange={e => setForm(f => ({ ...f, files: e.target.value }))} placeholder="Cole um link ou faça upload" className="flex-1" />
              <Button variant="outline" aria-label="Carregar" size="icon" className="shrink-0" disabled={uploading} onClick={() => document.getElementById('interaction-file-input')?.click()}>
                <Upload className="h-4 w-4" />
              </Button>
              <input id="interaction-file-input" type="file" multiple className="hidden" onChange={handleFileUpload} />
            </div>
            {uploading && <p className="text-xs text-muted-foreground mt-1">A carregar...</p>}
          </div>
          <Button className="w-full" disabled={uploading} onClick={() => onSave({
            lead_id: leadId,
            interaction_date: format(form.interaction_date, 'yyyy-MM-dd'),
            interaction_type: form.interaction_type,
            notes: form.notes || null,
            files: form.files || null,
          })}>Guardar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Pipeline History + Move ─── */
function PipelineHistory({ leadId }: { leadId: string }) {
  const qc = useQueryClient();
  const [moveOpen, setMoveOpen] = useState(false);
  const [selectedPipeline, setSelectedPipeline] = useState('');
  const [selectedStage, setSelectedStage] = useState('');

  const { data: history = [] } = useQuery({
    queryKey: ['crm-lead-pipeline-history', leadId],
    queryFn: async () => {
      const { data: plData } = await supabase
        .from('crm_pipeline_leads')
        .select('pipeline_id, stage_id, created_at, updated_at')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false });
      if (!plData || plData.length === 0) return [];

      const pipelineIds = [...new Set(plData.map(pl => pl.pipeline_id))];
      const stageIds = [...new Set(plData.map(pl => pl.stage_id))];

      const [{ data: pipelines }, { data: stages }] = await Promise.all([
        supabase.from('crm_pipelines').select('id, name').in('id', pipelineIds),
        supabase.from('crm_pipeline_stages').select('id, name, color').in('id', stageIds),
      ]);

      const pipelineMap = Object.fromEntries((pipelines || []).map(p => [p.id, p.name]));
      const stageMap = Object.fromEntries((stages || []).map(s => [s.id, { name: s.name, color: s.color }]));

      return plData.map(pl => ({
        pipelineId: pl.pipeline_id,
        pipelineName: pipelineMap[pl.pipeline_id] || 'Pipeline removido',
        stageName: stageMap[pl.stage_id]?.name || 'Etapa removida',
        stageColor: stageMap[pl.stage_id]?.color || '#94a3b8',
        addedAt: pl.created_at,
        updatedAt: pl.updated_at,
      }));
    },
    enabled: !!leadId,
  });

  const { data: allPipelines = [] } = useQuery({
    queryKey: ['crm-all-pipelines'],
    queryFn: async () => {
      const { data } = await supabase.from('crm_pipelines').select('id, name').order('name');
      return data || [];
    },
  });

  const { data: allStages = [] } = useQuery({
    queryKey: ['crm-all-pipeline-stages'],
    queryFn: async () => {
      const { data } = await supabase.from('crm_pipeline_stages').select('id, name, pipeline_id, sort_order').order('sort_order');
      return data || [];
    },
  });

  const stagesForSelected = allStages.filter(s => s.pipeline_id === selectedPipeline);

  const moveLead = useMutation({
    mutationFn: async () => {
      if (!selectedPipeline || !selectedStage) return;
      const existing = history.find(h => h.pipelineId === selectedPipeline);
      if (existing) {
        const { error } = await supabase.from('crm_pipeline_leads')
          .update({ stage_id: selectedStage })
          .eq('pipeline_id', selectedPipeline)
          .eq('lead_id', leadId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('crm_pipeline_leads')
          .insert({ pipeline_id: selectedPipeline, lead_id: leadId, stage_id: selectedStage });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-lead-pipeline-history', leadId] });
      qc.invalidateQueries({ queryKey: ['crm'] });
      qc.invalidateQueries({ queryKey: ['crm-pipeline-leads'] });
      toast.success('Lead movida para pipeline');
      setMoveOpen(false);
      setSelectedPipeline('');
      setSelectedStage('');
    },
    onError: () => toast.error('Erro ao mover lead'),
  });

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => setMoveOpen(true)}>
          <Plus className="h-3 w-3 mr-1" /> Mover para Pipeline
        </Button>
      </div>

      {history.length > 0 && (
        <div className="space-y-2">
          {history.map((h, i) => (
            <div key={i} className="flex items-center gap-3 text-sm">
              <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: h.stageColor }} />
              <div className="min-w-0 flex-1">
                <span className="font-medium">{h.pipelineName}</span>
                <span className="text-muted-foreground"> → {h.stageName}</span>
              </div>
              <span className="text-xs text-muted-foreground flex-shrink-0">
                {format(new Date(h.updatedAt || h.addedAt), 'dd/MM/yyyy')}
              </span>
            </div>
          ))}
        </div>
      )}

      {history.length === 0 && (
        <p className="text-sm text-muted-foreground">Esta lead ainda não está em nenhuma pipeline.</p>
      )}

      {/* Move Dialog */}
      <Dialog open={moveOpen} onOpenChange={setMoveOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Mover para Pipeline</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Pipeline</Label>
              <Select value={selectedPipeline} onValueChange={v => { setSelectedPipeline(v); setSelectedStage(''); }}>
                <SelectTrigger><SelectValue placeholder="Selecionar pipeline" /></SelectTrigger>
                <SelectContent>
                  {allPipelines.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedPipeline && stagesForSelected.length > 0 && (
              <div>
                <Label>Etapa</Label>
                <Select value={selectedStage} onValueChange={setSelectedStage}>
                  <SelectTrigger><SelectValue placeholder="Selecionar etapa" /></SelectTrigger>
                  <SelectContent>
                    {stagesForSelected.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button
              className="w-full"
              disabled={!selectedPipeline || !selectedStage || moveLead.isPending}
              onClick={() => moveLead.mutate()}
            >
              {moveLead.isPending ? 'A mover...' : 'Confirmar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {quoteProductId && lead?.id && (
        <QuoteCalculatorDialog
          open={quoteOpen}
          onOpenChange={setQuoteOpen}
          productId={quoteProductId}
          leadId={lead.id}
          onAccepted={({ id, total }) => {
            set({ estimated_value: String(total), quote_id: id });
          }}
        />
      )}
    </div>
  );
}
