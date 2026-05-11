import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';
import {
  FileText, CalendarDays, CreditCard, HelpCircle, CheckSquare,
  MessageSquare, Star, Send, ClipboardList, Clock, History,
  FolderOpen, Download, ChevronRight, Sparkles, Upload, Briefcase, CheckCircle2, Circle, Image as ImageIcon, Pencil, LogOut, Repeat, Handshake, User, Users
} from 'lucide-react';
import type { Portal } from '@/hooks/usePortalData';
import {InlineLoader, EmptyHint } from '@/components/ui/loading-skeletons';
import { isDeliverableDone, isPhaseDone, isPhaseComplete as allDeliverablesDone, deliverableProgress, phaseProgress } from '@/lib/projectProgress';
import { usePortalBranding } from '@/hooks/usePortalBranding';
import { resolvePublicPortal, type PublicPortal } from '@/lib/portalAccess';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { SectionCard, SectionTitle } from '@/components/portal-view/SectionPrimitives';
import { PortalContractSection } from '@/components/portal-view/PortalContractSection';
import { PortalFeedbackSection } from '@/components/portal-view/PortalFeedbackSection';
import { PortalPlaylistEmbed } from '@/components/portal-view/PortalPlaylistEmbed';
import { PortalHistorySection } from '@/components/portal-view/PortalHistorySection';
import { PortalMeetingsSection } from '@/components/portal-view/PortalMeetingsSection';
import { PortalPaymentsSection } from '@/components/portal-view/PortalPaymentsSection';
import { PortalWorkspaceSection } from '@/components/portal-view/PortalWorkspaceSection';
import { PortalQuestionsSection } from '@/components/portal-view/PortalQuestionsSection';
import { PortalDeliverableAttachment } from '@/components/portal/PortalDeliverableAttachment';
import { BUSINESS_BRAND_FALLBACK_HSL, normalizePortalBranding, portalCssColorAlpha } from '@/lib/portalBranding';
import type {
  PortalFaq, PortalQuestion, PortalComment, PortalFeedback,
  PortalMeeting, PortalMeetingDoc, PortalMeetingPoint,
  PortalPayment, PortalPhase, PortalDeliverable,
  PortalContractDocument, PortalProjectHistoryEntry,
} from '@/types/portal';

const isClientStep = (o: { responsible?: string | null }) =>
  o.responsible?.toLowerCase().trim() === 'cliente';

export default function PortalViewPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [portal, setPortal] = useState<PublicPortal | null>(null);
  const [client, setClient] = useState<Record<string, any> | null>(null);
  const [settings, setSettings] = useState<Record<string, any> | null>(null);
  const { branding: portalBranding } = usePortalBranding(token);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<string>('home');

  const businessName = (portalBranding?.business_name as string | undefined) || (settings?.business_name as string | undefined) || 'Portal';
  const clientName = (client?.full_name as string | undefined) || '';
  useDocumentTitle(clientName ? `${businessName} · Portal · ${clientName}` : `${businessName} · Portal de Cliente`);

  const [faqs, setFaqs] = useState<PortalFaq[]>([]);
  const [questions, setQuestions] = useState<PortalQuestion[]>([]);
  const [comments, setComments] = useState<PortalComment[]>([]);
  const [feedback, setFeedback] = useState<PortalFeedback[]>([]);
  const [meetings, setMeetings] = useState<PortalMeeting[]>([]);
  const [payments, setPayments] = useState<PortalPayment[]>([]);
  const [onboarding, setOnboarding] = useState<PortalPhase[]>([]); // derived from phases
  const [tasks, setTasks] = useState<Array<Record<string, any>>>([]);
  const [phases, setPhases] = useState<PortalPhase[]>([]);

  const [projectHistory, setProjectHistory] = useState<PortalProjectHistoryEntry[]>([]);
  const [contractDocs, setContractDocs] = useState<PortalContractDocument[]>([]);
  const [responsibilities, setResponsibilities] = useState<Array<Record<string, any>>>([]);
  const [routines, setRoutines] = useState<Array<Record<string, any>>>([]);

  const [commentText, setCommentText] = useState('');
  const [feedbackText, setFeedbackText] = useState('');
  const [selectedPayment, setSelectedPayment] = useState<PortalPayment | null>(null);
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
  const [draftAnswers, setDraftAnswers] = useState<Record<string, string>>({});
  const [expandedOnbStep, setExpandedOnbStep] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);

  useEffect(() => { init(); }, [token]);

  const init = async () => {
    if (!token) return;
    const portalData = await resolvePublicPortal(token, (fn, args) => (supabase.rpc as unknown as (f: string, a: unknown) => Promise<{ data: unknown; error: unknown }>)(fn, args));
    if (!portalData || !portalData.is_active) { navigate(`/portal/${token}`, { replace: true }); return; }
    const session = localStorage.getItem(`portal_session_${portalData.id}`);
    if (!session) { navigate(`/portal/${token}`, { replace: true }); return; }
    try {
      const parsed = JSON.parse(session);
      if (Date.now() - parsed.timestamp > 24 * 60 * 60 * 1000) {
        localStorage.removeItem(`portal_session_${portalData.id}`);
        navigate(`/portal/${token}`, { replace: true }); return;
      }
    } catch { navigate(`/portal/${token}`, { replace: true }); return; }
    setPortal(portalData);
    const realToken = portalData.token; // always use UUID token for RPCs
    const [clientCtxRes, settingsRes] = await Promise.all([
      supabase.rpc('get_portal_client_context', { _token: realToken }),
      // get_portal_branding not yet in generated types
      (supabase.rpc as unknown as (f: string, a: unknown) => Promise<{ data: Record<string, unknown> | null; error: unknown }>)('get_portal_branding', { _token: realToken }),
    ]);
    const clientData = Array.isArray(clientCtxRes.data) ? clientCtxRes.data[0] : null;
    if (clientCtxRes.error || !clientData) { toast.error('Não foi possível carregar o portal.'); navigate(`/portal/${token}`, { replace: true }); return; }
    setClient(clientData);
    setSettings(normalizePortalBranding(settingsRes.data || {}));
    const [faqsR, questionsR, commentsR, feedbackR, meetingsR, paymentsR, tasksR, projPhasesR, historyR, contractR] = await Promise.all([
      supabase.rpc('get_portal_faqs', { _token: realToken }),
      supabase.rpc('get_portal_initial_questions', { _token: realToken }),
      supabase.rpc('get_portal_comments', { _token: realToken }),
      supabase.rpc('get_portal_feedback', { _token: realToken }),
      supabase.rpc('get_portal_meetings', { _token: realToken }),
      supabase.rpc('get_portal_payments', { _token: realToken }),
      supabase.from('tasks').select('*').eq('visible_in_portal', true),
      // get_portal_phases not yet in generated types
      (supabase.rpc as unknown as (f: string, a: unknown) => Promise<{ data: unknown; error: unknown }>)('get_portal_phases', { _token: realToken }),
      supabase.rpc('get_portal_project_history', { _token: realToken }),
      supabase.rpc('get_portal_contract_documents', { _token: realToken }),
    ]);
    // Avença mensal: rotinas + responsabilidades acordadas
    const [respR, routR] = await Promise.all([
      (supabase.rpc as unknown as (f: string, a: unknown) => Promise<{ data: unknown; error: unknown }>)('get_portal_responsibilities', { _token: realToken }),
      (supabase.rpc as unknown as (f: string, a: unknown) => Promise<{ data: unknown; error: unknown }>)('get_portal_routines', { _token: realToken }),
    ]);
    setResponsibilities((respR.data as Array<Record<string, any>>) || []);
    setRoutines((routR.data as Array<Record<string, any>>) || []);
    const faqsList = (faqsR.data || []) as unknown as PortalFaq[];
    setFaqs(faqsList.slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)));
    const questionsList = (questionsR.data || []) as unknown as Array<PortalQuestion & { group_sort_order?: number }>;
    setQuestions(questionsList.slice().sort((a, b) =>
      (a.group_sort_order ?? 0) - (b.group_sort_order ?? 0) || (a.sort_order ?? 0) - (b.sort_order ?? 0)));
    const commentsList = (commentsR.data || []) as unknown as PortalComment[];
    setComments(commentsList.slice().sort((a, b) => new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime()));
    const feedbackList = (feedbackR.data || []) as unknown as PortalFeedback[];
    setFeedback(feedbackList.slice().sort((a, b) => new Date(b.submitted_at || b.created_at || 0).getTime() - new Date(a.submitted_at || a.created_at || 0).getTime()));
    setMeetings((meetingsR.data || []) as unknown as PortalMeeting[]);
    setPayments((paymentsR.data || []) as unknown as PortalPayment[]);
    setTasks((tasksR.data || []) as Array<Record<string, any>>);
    // get_portal_phases now returns jsonb with deliverables included
    const phasesData = projPhasesR.data || [];
    const parsedPhases = (Array.isArray(phasesData) ? phasesData : []) as PortalPhase[];
    const allPhases: PortalPhase[] = parsedPhases.map((p) => ({ ...p, title: p.name, status: p.status === 'concluida' ? 'concluido' : p.status }));
    setPhases(allPhases);
    // Show all phases in the onboarding/timeline section
    setOnboarding(allPhases);
    setProjectHistory((historyR.data || []) as unknown as PortalProjectHistoryEntry[]);
    setContractDocs((contractR.data || []) as unknown as PortalContractDocument[]);
    setLoading(false);
  };

  const sendComment = async () => {
    if (!commentText.trim() || !portal) return;
    await supabase.rpc('portal_add_comment', {
      _token: portal.token,
      _author: client?.full_name || 'Cliente',
      _content: commentText.trim(),
    });
    setComments(prev => [...prev, { id: crypto.randomUUID(), portal_id: portal.id, content: commentText.trim(), author: 'client', author_name: client?.full_name || 'Cliente', created_at: new Date().toISOString() }]);
    setCommentText('');
  };

  const sendFeedback = async () => {
    if (!feedbackText.trim() || !portal) return;
    await supabase.rpc('portal_submit_feedback', {
      _token: portal.token,
      _payload: { content: feedbackText.trim() },
    });
    toast.success('Feedback enviado! Obrigado. 💛');
    setFeedbackText('');
  };

  const maybeNotifyQuestionsSubmitted = async () => {
    if (!portal?.token) return;
    try {
      await supabase.rpc('portal_submit_initial_questions', { _token: portal.token });
    } catch (err) {
      console.error('Erro ao validar submissão das perguntas do portal:', err);
    }
  };

  const answerQuestion = async (qId: string, answer: string) => {
    const answeredAt = new Date().toISOString();
    await supabase.rpc('portal_answer_initial_question', {
      _token: portal!.token,
      _question_id: qId,
      _answer: answer,
      _file_urls: null,
    });
    setQuestions(prev => prev.map(q => q.id === qId ? { ...q, answer, answered_at: answeredAt } : q));
    await maybeNotifyQuestionsSubmitted();
    toast.success('Resposta guardada ✨');
  };

  const [uploadingQuestionFiles, setUploadingQuestionFiles] = useState<Record<string, boolean>>({});

  const uploadQuestionFiles = async (qId: string, files: FileList) => {
    if (!files.length || !token) return;
    setUploadingQuestionFiles(prev => ({ ...prev, [qId]: true }));
    try {
      const urls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const ext = file.name.split('.').pop();
        const path = `${token}/${qId}/${Date.now()}-${i}.${ext}`;
        const { error } = await supabase.storage.from('portal-uploads').upload(path, file);
        if (error) throw error;
        const { data: urlData } = supabase.storage.from('portal-uploads').getPublicUrl(path);
        urls.push(urlData.publicUrl);
      }
      const question = questions.find(q => q.id === qId);
      const existing: string[] = Array.isArray(question?.file_urls) ? question.file_urls : [];
      const allUrls = [...existing, ...urls];
      const answeredAt = new Date().toISOString();
      await supabase.rpc('portal_answer_initial_question', {
        _token: portal!.token,
        _question_id: qId,
        _answer: question?.answer || '',
        _file_urls: allUrls,
      });
      setQuestions(prev => prev.map(q => q.id === qId ? { ...q, file_urls: allUrls, answered_at: answeredAt } : q));
      await maybeNotifyQuestionsSubmitted();
      toast.success(`${urls.length} ficheiro(s) enviado(s) ✨`);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao enviar ficheiro(s)');
    } finally {
      setUploadingQuestionFiles(prev => ({ ...prev, [qId]: false }));
    }
  };

  const removeQuestionFile = async (qId: string, fileIndex: number) => {
    try {
      const question = questions.find(q => q.id === qId);
      const existing: string[] = Array.isArray(question?.file_urls) ? question.file_urls : [];
      const updated = existing.filter((_, i) => i !== fileIndex);
      await supabase.rpc('portal_answer_initial_question', {
        _token: portal!.token,
        _question_id: qId,
        _answer: question?.answer || '',
        _file_urls: updated.length ? updated : null,
      });
      setQuestions(prev => prev.map(q => q.id === qId ? { ...q, file_urls: updated } : q));
      toast.success('Ficheiro removido');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao remover ficheiro');
    }
  };

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center bg-[#fefcfa]">
      <InlineLoader />
    </div>
  );

  if (!portal || !client) return (
    <div className="flex min-h-screen items-center justify-center bg-[#fefcfa] p-4">
      <SectionCard className="w-full max-w-md p-8 text-center space-y-4">
        <p className="text-sm text-muted-foreground">Não foi possível carregar os dados do portal.</p>
        <Button onClick={() => navigate(`/portal/${token}`, { replace: true })}>Voltar ao acesso</Button>
      </SectionCard>
    </div>
  );

  const rawColor = settings?.primary_color || BUSINESS_BRAND_FALLBACK_HSL;
  const pc = `hsl(${rawColor})`;
  const pcAlpha = (a: number) => portalCssColorAlpha(rawColor, a);
  const portalToken = portal.token;
  const logoUrl = settings?.logo_url;
  const firstName = client.full_name?.split(' ')[0] || '';

  const hasUnansweredQuestions = questions.length > 0 && questions.some((q) => !q.answer?.trim() && !(Array.isArray(q.file_urls) && q.file_urls.length > 0));

  const navItems = [
    { key: 'home', label: 'Início', icon: Star, always: true },
    ...(questions.length > 0 ? [{ key: 'questions', label: 'Perguntas', icon: ClipboardList }] : []),
    ...(portal.show_workspace ? [{ key: 'workspace', label: 'Espaço de Trabalho', icon: Briefcase }] : []),
    ...(contractDocs.length > 0 ? [{ key: 'contract', label: 'Contrato', icon: FileText }] : []),
    ...(portal.show_meetings ? [{ key: 'meetings', label: 'Reuniões', icon: CalendarDays }] : []),
    ...(portal.show_payments ? [{ key: 'payments', label: 'Pagamentos', icon: CreditCard }] : []),
    ...((routines.length > 0 || responsibilities.length > 0) ? [{ key: 'avenca', label: 'Avença', icon: Repeat }] : []),
    ...(projectHistory.length > 0 ? [{ key: 'history', label: 'Histórico', icon: History }] : []),
  ];

  // Onboarding progress: granular by deliverables (same logic as overall project progress)
  const isPhaseComplete = (p: any) => allDeliverablesDone(p.deliverables || []);
  const completedOnb = onboarding.filter(isPhaseComplete).length;
  const totalOnb = onboarding.length;

  // Find next pending deliverable across all onboarding phases
  const nextStep = (() => {
    // Skip phases already done (by status or because all deliverables are complete)
    for (const phase of onboarding) {
      if (phase.status === 'concluido' || phase.status === 'concluida') continue;
      const dels = phase.deliverables || [];
      const pending = dels.find((d) => !isDeliverableDone(d));
      if (pending) return { ...pending, phase_name: phase.name };
    }
    return null;
  })();

  // If the next step is a meeting deliverable, prefer the actual scheduled date_time
  // from the meetings table over the timeline's planned_end.
  const nextStepMeetingDateTime = (() => {
    if (!nextStep) return null;
    const name: string = (nextStep.name || '').toLowerCase();
    const looksLikeMeeting =
      (nextStep as any).is_meeting === true ||
      /reuni[aã]o|alinhamento|kick[- ]?off|onboarding call/.test(name);
    if (!looksLikeMeeting) return null;
    // 1. Preferred: explicit link via meeting_id on the deliverable
    const linkedId = (nextStep as any).meeting_id;
    if (linkedId) {
      const linked = (meetings || []).find((m) => m.id === linkedId);
      if (linked?.date_time) return linked.date_time;
    }
    // 2. Fallback: next upcoming meeting (this client only — RPC already filters)
    const upcoming = (meetings || [])
      .filter((m) => m?.date_time && !['cancelada', 'realizada'].includes(m.status))
      .sort((a, b) => new Date(a.date_time).getTime() - new Date(b.date_time).getTime());
    return upcoming[0]?.date_time || null;
  })();

  // If the next step is a meeting deliverable linked to a meeting, prefer the meeting title
  const nextStepMeetingTitle = (() => {
    if (!nextStep) return null;
    const linkedId = (nextStep as any).meeting_id;
    if (!linkedId) return null;
    const linked = (meetings || []).find((m) => m.id === linkedId);
    return linked?.title || null;
  })();

  // Prefer the real next pending deliverable from the project phases (the
  // client's actual next responsibility). Only fall back to "Preencher
  // perguntas iniciais" when there is no pending deliverable but there are
  // unanswered initial questions in the portal.
  const realNextStep = nextStep && nextStepMeetingTitle
    ? { ...nextStep, name: nextStepMeetingTitle }
    : nextStep;
  const effectiveNextStep = realNextStep
    ? realNextStep
    : (hasUnansweredQuestions
        ? { name: 'Preencher perguntas iniciais', phase_name: 'Perguntas', planned_end: null, _isQuestions: true }
        : null);

  const statusLabel = (s: string) => {
    const map: Record<string, { text: string; cls: string }> = {
      pago: { text: 'Pago', cls: 'bg-success/15 text-success border-success/30' },
      tudo_ok: { text: 'Pago', cls: 'bg-success/15 text-success border-success/30' },
      em_falta: { text: 'Em falta', cls: 'bg-destructive/15 text-destructive border-destructive/30' },
      pendente: { text: 'Pendente', cls: 'bg-warning/15 text-warning border-warning/30' },
      aguarda_pagamento: { text: 'Aguarda pagamento', cls: 'bg-warning/15 text-warning border-warning/30' },
      em_atraso: { text: 'Em atraso', cls: 'bg-destructive/15 text-destructive border-destructive/30' },
    };
    return map[s] || { text: s, cls: '' };
  };

  const meetingStatus = (s: string) => {
    const map: Record<string, { text: string; cls: string }> = {
      por_confirmar: { text: 'Por confirmar', cls: 'bg-warning/15 text-warning border-warning/30' },
      por_organizar: { text: 'Por organizar', cls: 'bg-info/15 text-info border-info/30' },
      confirmada: { text: 'Confirmada', cls: 'bg-success/15 text-success border-success/30' },
      marcada: { text: 'Confirmada', cls: 'bg-success/15 text-success border-success/30' },
      terminada: { text: 'Terminada', cls: 'bg-muted text-muted-foreground border-border' },
      realizada: { text: 'Realizada', cls: 'bg-info/15 text-info border-info/30' },
      cancelada: { text: 'Cancelada', cls: 'bg-destructive/15 text-destructive border-destructive/30' },
    };
    return map[s] || { text: s, cls: '' };
  };

  // Current active phase. A phase is considered DONE if status is concluida
  // OR if every deliverable inside it is done (so a phase that is 4/4 done but still
  // marked em_curso in the DB is not shown as the active one).
  const isPhaseFullyDone = (p: PortalPhase) => {
    const statusDone = p.status === 'concluido' || p.status === 'concluida';
    if (statusDone) return true;
    const dels = p.deliverables || [];
    return dels.length > 0 && dels.every(isDeliverableDone);
  };
  const activePhase = (() => {
    // 1. Explicit em_curso, but only if not actually fully done
    const explicit = phases.find((p) => p.status === 'em_curso' && !isPhaseFullyDone(p));
    if (explicit) return explicit;
    // 2. Phase whose planned window contains today
    const today = new Date();
    const inWindow = phases.find((p) => {
      if (isPhaseFullyDone(p)) return false;
      const start = p.planned_start ? new Date(p.planned_start) : null;
      const end = p.planned_end ? new Date(p.planned_end) : null;
      if (!start || !end) return false;
      return today >= start && today <= end;
    });
    if (inWindow) return inWindow;
    // 3. First phase that is not yet fully done
    return phases.find((p) => !isPhaseFullyDone(p)) || null;
  })();
  const allDeliverables = phases.flatMap((p) => p.deliverables || []);
  const completedDeliverables = allDeliverables.filter(isDeliverableDone).length;
  const projectProgress = deliverableProgress(allDeliverables);

  return (
    <div className="min-h-screen" style={{ background: 'hsl(var(--background))' }}>
      {/* ─── Header with integrated nav ─── */}
      <header className="sticky top-0 z-30 backdrop-blur-md bg-background/85 border-b" style={{ borderColor: pcAlpha(0.1) }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" className="h-7 object-contain" />
              ) : (
                <span className="text-[10px] tracking-[0.3em] uppercase font-semibold" style={{ color: pcAlpha(0.6) }}>
                  {businessName}
                </span>
              )}
              <div className="hidden sm:block h-4 w-[1px]" style={{ background: pcAlpha(0.15) }} />
              <span className="hidden sm:inline text-[10px] tracking-[0.3em] uppercase font-semibold" style={{ color: pcAlpha(0.5) }}>
                Portal de Cliente
              </span>
            </div>
            <div className="flex items-center gap-3">
              {(settings as any)?.support_hours && (
                <div className="hidden sm:flex items-center gap-1.5" style={{ color: pcAlpha(0.5) }}>
                  <Clock className="h-3 w-3" strokeWidth={1.5} />
                  <span className="text-[10px] tracking-wider uppercase">{(settings as any).support_hours}</span>
                </div>
              )}
              <div className="h-8 w-8 flex items-center justify-center text-xs font-medium" style={{ backgroundColor: pcAlpha(0.1), color: pc, fontFamily: 'var(--font-display, Cormorant Garamond), Georgia, serif' }}>
                {firstName.charAt(0).toUpperCase()}
              </div>
              <span className="text-sm hidden sm:inline" style={{ color: pc, fontFamily: 'var(--font-display, Cormorant Garamond), Georgia, serif' }}>{firstName}</span>
              <Button
                variant="ghost"
                aria-label="Terminar sessão" size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                title="Terminar sessão"
                onClick={() => {
                  if (portal) localStorage.removeItem(`portal_session_${portal.id}`);
                  navigate(`/portal/${token}`, { replace: true });
                }}
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="-mb-px flex gap-6 overflow-x-auto scrollbar-none pb-0">
            {navItems.map(item => {
              const active = activeSection === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => setActiveSection(item.key)}
                  className={`flex items-center gap-2 py-3 text-[11px] tracking-[0.18em] uppercase whitespace-nowrap border-b-2 transition-all ${
                    active ? 'font-semibold border-current' : 'border-transparent hover:border-current'
                  }`}
                  style={{ color: active ? pc : pcAlpha(0.85) }}
                >
                  <item.icon className="h-3.5 w-3.5" strokeWidth={1.5} />
                  <span className="hidden sm:inline">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* ─── Main ─── */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-10 sm:space-y-12">

        {/* ═══ HOME ═══ */}
        {activeSection === 'home' && (
          <>

            {/* Welcome hero — editorial */}
            <div
              className="px-5 py-4 sm:px-6 sm:py-5 relative overflow-hidden border"
              style={{
                background: `linear-gradient(135deg, ${pc} 0%, ${pcAlpha(0.85)} 100%)`,
                borderColor: pcAlpha(0.4),
                borderRadius: 6,
                boxShadow: `0 8px 24px -10px ${pcAlpha(0.35)}`,
              }}
            >
              <div className="flex items-center justify-between gap-6 flex-wrap">
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] tracking-[0.3em] uppercase font-semibold text-white/60">
                    Bem-vindo
                  </span>
                  <h1 className="text-2xl sm:text-3xl leading-tight tracking-tight mt-0.5 text-white" style={{ fontFamily: 'var(--font-display, Cormorant Garamond), Georgia, serif' }}>
                    Olá, {firstName}.
                  </h1>
                </div>
                {phases.length > 0 && (
                  <div className="min-w-[180px]">
                    <div className="flex items-baseline justify-between mb-1.5">
                      <span className="text-[9px] tracking-[0.25em] uppercase font-semibold text-white/60">
                        Progresso
                      </span>
                      <span className="text-lg font-light text-white" style={{ fontFamily: 'var(--font-display, Cormorant Garamond), Georgia, serif' }}>{projectProgress}<span className="text-[10px]">%</span></span>
                    </div>
                    <div className="h-[3px] rounded-full overflow-hidden bg-white/15">
                      <div className="h-full transition-all bg-white" style={{ width: `${projectProgress}%` }} />
                    </div>
                    {activePhase && (
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <div className="h-1 w-1 rounded-full bg-white/80 animate-pulse" />
                        <span className="text-[10px] text-white/75 truncate">{activePhase.title}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {portal.show_meetings && (() => {
                const next = meetings
                  .filter((m) => ['por_organizar', 'confirmada', 'por_confirmar', 'marcada'].includes(m.status) && m.date_time)
                  .sort((a, b) => new Date(a.date_time).getTime() - new Date(b.date_time).getTime())[0];
                return (
                  <PortalKpi
                    icon={CalendarDays}
                    label="próxima reunião"
                    value={next ? format(parseISO(next.date_time), "d MMM", { locale: pt }) : '—'}
                    hint={next ? format(parseISO(next.date_time), "EEEE 'às' HH:mm", { locale: pt }) : 'sem reuniões agendadas'}
                    onClick={() => setActiveSection('meetings')}
                    pc={pc}
                  />
                );
              })()}
              {portal.show_payments && (() => {
                const paidStatuses = ['pago', 'pago_falta_fatura', 'tudo_ok'];
                const next = payments
                  .filter((p) => {
                    if (!p.payment_date) return false;
                    const isPaid = paidStatuses.includes(p.status);
                    if (isPaid) return false;
                    // Show future pending payments OR past overdue ones
                    return true;
                  })
                  .sort((a, b) => new Date(a.payment_date).getTime() - new Date(b.payment_date).getTime())[0];
                return (
                  <PortalKpi
                    icon={CreditCard}
                    label="próximo pagamento"
                    value={next?.amount != null ? `${Number(next.amount).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €` : (next ? format(parseISO(next.payment_date), "d MMM", { locale: pt }) : '—')}
                    hint={next ? format(parseISO(next.payment_date), "d 'de' MMMM, yyyy", { locale: pt }) : 'sem pagamentos pendentes'}
                    onClick={() => setActiveSection('payments')}
                    pc={pc}
                  />
                );
              })()}
            </div>

            {/* ── Onboarding Step Cards ── */}
            {portal.show_onboarding && (
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl" style={{ backgroundColor: pcAlpha(0.1) }}>
                      <CheckSquare className="h-4 w-4" style={{ color: pc }} />
                    </div>
                    <h3 className="text-sm font-bold">A nossa jornada</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${projectProgress}%`, backgroundColor: pc }} />
                    </div>
                    <span className="text-xs font-semibold" style={{ color: pc }}>{projectProgress}%</span>
                  </div>
                </div>
                {onboarding.length === 0 ? (
                  <SectionCard className="p-6 text-center">
                    <p className="text-sm text-muted-foreground">Ainda sem fases definidas.</p>
                  </SectionCard>
                ) : (
                  <div className="space-y-6">
                    {/* Next step highlight */}
                    {effectiveNextStep && (
                      <SectionCard
                        className="p-4 border-l-4 cursor-pointer hover:shadow-md transition-all"
                        style={{ borderLeftColor: pc }}
                        onClick={() => {
                          if ((effectiveNextStep as any)._isQuestions) setActiveSection('questions');
                        }}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Sparkles className="h-3.5 w-3.5" style={{ color: pc }} />
                          <span className="eyebrow font-bold" style={{ color: pc }}>Próximo passo</span>
                        </div>
                        <p className="text-sm font-semibold">{effectiveNextStep.name}</p>
                        <div className="flex items-center gap-3 mt-1.5">
                          <span className="text-[10px] text-muted-foreground">{effectiveNextStep.phase_name}</span>
                          {(() => {
                            const useDt = !(effectiveNextStep as any)._isQuestions && nextStepMeetingDateTime;
                            const dateStr = useDt ? nextStepMeetingDateTime : effectiveNextStep.planned_end;
                            if (!dateStr) return null;
                            return (
                              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {useDt
                                  ? format(parseISO(dateStr), "d 'de' MMMM 'às' HH:mm", { locale: pt })
                                  : format(parseISO(dateStr), "d 'de' MMMM", { locale: pt })}
                              </span>
                            );
                          })()}
                        </div>
                      </SectionCard>
                    )}

                    {/* Phase cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-5">
                      {onboarding.map((phase, i) => {
                        const dels = phase.deliverables || [];
                        const done = isPhaseComplete(phase);
                        const completedDels = dels.filter(isDeliverableDone).length;
                        const ear = String(i + 1).padStart(2, '0');
                        return (
                          <div key={phase.id} className="relative h-full">
                            <div
                              className="absolute -top-2 -left-1 z-10 px-2 py-0.5 text-[10px] uppercase tracking-widest rounded-sm shadow-sm"
                              style={{ backgroundColor: done ? 'hsl(var(--muted-foreground))' : pc, color: '#fff' }}
                            >
                              {ear}
                            </div>
                            <div
                              onClick={() => setExpandedOnbStep(phase.id)}
                              className={`rounded-md border-2 transition-colors cursor-pointer p-4 h-full flex flex-col ${done ? 'opacity-60' : ''}`}
                              style={{ borderColor: done ? 'hsl(var(--border))' : pcAlpha(0.3), backgroundColor: 'hsl(var(--card))' }}
                              onMouseEnter={(e) => { if (!done) e.currentTarget.style.borderColor = pc; }}
                              onMouseLeave={(e) => { if (!done) e.currentTarget.style.borderColor = pcAlpha(0.3); }}
                            >
                              <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-1">Fase</div>
                              <p className="text-sm leading-tight line-clamp-2 mb-3 flex-1" style={{ color: done ? 'hsl(var(--muted-foreground))' : pc, fontFamily: 'var(--font-display, Cormorant Garamond), Georgia, serif', fontSize: '1.05rem' }}>
                                {phase.name || 'Sem nome'}
                              </p>
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[10px] text-muted-foreground">{completedDels}/{dels.length} entregas</span>
                                {done ? (
                                  <CheckCircle2 className="h-4 w-4 text-success" />
                                ) : (
                                  <div className="flex-1 max-w-[60px] h-1 rounded-full overflow-hidden" style={{ background: pcAlpha(0.1) }}>
                                    <div className="h-full rounded-full transition-all" style={{ width: `${dels.length ? (completedDels / dels.length) * 100 : 0}%`, backgroundColor: pc }} />
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Phase detail dialog */}
                    <Dialog open={!!expandedOnbStep} onOpenChange={(open) => !open && setExpandedOnbStep(null)}>
                      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                        {(() => {
                          const phase = onboarding.find((p) => p.id === expandedOnbStep);
                          if (!phase) return null;
                          const dels = phase.deliverables || [];
                          const completedDels = dels.filter(isDeliverableDone).length;
                          const done = isPhaseComplete(phase);
                          return (
                            <>
                              <DialogHeader>
                                <DialogTitle className="flex items-center gap-3">
                                  <span className="text-2xl font-black" style={{ color: done ? 'hsl(var(--muted-foreground))' : pc }}>
                                    {onboarding.indexOf(phase) + 1}
                                  </span>
                                  <span>{phase.name}</span>
                                </DialogTitle>
                              </DialogHeader>
                              {phase.description && <p className="text-sm text-muted-foreground">{phase.description}</p>}
                              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                <span>{completedDels}/{dels.length} entregas concluídas</span>
                                {phase.planned_start && <span>Início: {format(parseISO(phase.planned_start), "d MMM yyyy", { locale: pt })}</span>}
                                {phase.planned_end && <span>Fim: {format(parseISO(phase.planned_end), "d MMM yyyy", { locale: pt })}</span>}
                              </div>
                              <div className="h-2 bg-muted rounded-full overflow-hidden">
                                <div className="h-full rounded-full transition-all" style={{ width: `${dels.length ? (completedDels / dels.length) * 100 : 0}%`, backgroundColor: pc }} />
                              </div>
                              {dels.length > 0 && (
                                <div className="space-y-2 mt-2">
                                  {dels.map((d) => {
                                    const dDone = isDeliverableDone(d);
                                    const isClient = (d.responsible_type || 'equipa') === 'cliente';
                                    return (
                                      <div key={d.id} className={`flex items-start gap-3 p-3 rounded-lg border ${dDone ? 'bg-muted/30 border-border/20' : 'bg-background border-border/40'} ${isClient && !dDone ? 'cursor-pointer hover:border-primary/40' : ''}`}
                                        onClick={async () => {
                                          if (!isClient) return;
                                          const newCompleted = !dDone;
                                          await (supabase as any).rpc('portal_toggle_deliverable', { _token: portalToken, _deliverable_id: d.id, _completed: newCompleted });
                                          // Refresh phases
                                          const res = await (supabase as any).rpc('get_portal_phases', { _token: portalToken });
                                          const phasesData = res.data || [];
                                          const parsed = Array.isArray(phasesData) ? phasesData : [];
                                          const all = parsed.map((p) => ({ ...p, title: p.name, status: p.status === 'concluida' ? 'concluido' : p.status }));
                                          setPhases(all);
                                          setOnboarding(all);
                                        }}
                                      >
                                        {dDone
                                          ? <CheckCircle2 className="h-4 w-4 text-success shrink-0 mt-0.5" />
                                          : isClient
                                            ? <Circle className="h-4 w-4 text-primary/60 shrink-0 mt-0.5" />
                                            : <Circle className="h-4 w-4 text-muted-foreground/40 shrink-0 mt-0.5" />}
                                        <div className="flex-1 min-w-0">
                                          <p className={`text-sm ${dDone ? 'text-muted-foreground line-through' : 'font-medium'}`}>{d.name}</p>
                                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                                            {d.planned_end && (
                                              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                                <Clock className="h-3 w-3" />
                                                {format(parseISO(d.planned_end), "d 'de' MMMM", { locale: pt })}
                                              </span>
                                            )}
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${isClient ? 'bg-warning/15 text-warning' : 'bg-muted text-muted-foreground'}`}>
                                              {isClient ? '👤 Tu' : '👥 Equipa'}
                                            </span>
                                          </div>
                                          {d.description && <p className="text-xs text-muted-foreground mt-1">{String(d.description)}</p>}
                                          <PortalDeliverableAttachment d={d as any} portalToken={portalToken} />
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </DialogContent>
                    </Dialog>
                  </div>
                )}
              </div>
            )}

            {/* Feedback inline at bottom */}
            <div className="rounded-2xl border border-border/30 bg-muted/5 p-5 space-y-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium text-muted-foreground">Tens algum feedback para nós?</p>
              </div>
              <Textarea
                className="rounded-xl border-border/40 bg-white focus-visible:ring-1 text-sm"
                placeholder="Partilha a tua opinião... 💬"
                value={feedbackText}
                onChange={e => setFeedbackText(e.target.value)}
                rows={3}
                style={{ '--tw-ring-color': pcAlpha(0.25) } as any}
              />
              <Button className="rounded-xl text-white text-sm" style={{ backgroundColor: pc }} disabled={!feedbackText.trim()} onClick={sendFeedback}>
                <Send className="h-3.5 w-3.5 mr-1.5" />Enviar Feedback
              </Button>
            </div>
          </>
        )}

        {/* ═══ QUESTIONS ═══ */}
        {activeSection === 'questions' && questions.length > 0 && (
          <PortalQuestionsSection
            questions={questions}
            client={client}
            activeQuestionId={activeQuestionId}
            setActiveQuestionId={setActiveQuestionId}
            draftAnswers={draftAnswers}
            setDraftAnswers={setDraftAnswers}
            expandedSections={expandedSections}
            setExpandedSections={setExpandedSections}
            editingQuestionId={editingQuestionId}
            setEditingQuestionId={setEditingQuestionId}
            uploadingQuestionFiles={uploadingQuestionFiles}
            uploadQuestionFiles={uploadQuestionFiles}
            removeQuestionFile={removeQuestionFile}
            answerQuestion={answerQuestion}
            pc={pc}
            pcAlpha={pcAlpha}
          />
        )}

        {/* ═══ WORKSPACE ═══ */}
        {activeSection === 'workspace' && (
          <PortalWorkspaceSection
            phases={phases}
            client={client}
            portalMaterials={[]}
            tasks={tasks}
            faqs={faqs}
            pc={pc}
            pcAlpha={pcAlpha}
          />
        )}

        {/* ═══ CONTRACT ═══ */}
        {activeSection === 'contract' && (
          <PortalContractSection contractDocs={contractDocs} pc={pc} pcAlpha={pcAlpha} />
        )}

        {/* ═══ MEETINGS ═══ */}
        {activeSection === 'meetings' && (
          <PortalMeetingsSection
            meetings={meetings}
            setMeetings={setMeetings}
            portalToken={portalToken}
            pc={pc}
            meetingStatus={meetingStatus}
          />
        )}

        {/* ═══ PAYMENTS ═══ */}
        {activeSection === 'payments' && (
          <PortalPaymentsSection
            payments={payments}
            selectedPayment={selectedPayment}
            setSelectedPayment={setSelectedPayment}
            pc={pc}
            statusLabel={statusLabel}
          />
        )}

        {/* ═══ AVENÇA: Rotinas + Responsabilidades ═══ */}
        {activeSection === 'avenca' && (
          <div className="space-y-6">
            {routines.length > 0 && (
              <section className="rounded-2xl border bg-card p-5 sm:p-6">
                <h2 className="text-lg font-semibold flex items-center gap-2 mb-1"><Repeat className="h-5 w-5" style={{ color: pc }} /> Rotinas</h2>
                <p className="text-xs text-muted-foreground mb-4">Tarefas fixas e recorrentes deste serviço.</p>
                <div className="space-y-2">
                  {routines.map((r: any) => {
                    const desc = r.recurrence_type === 'diaria' ? 'Todos os dias'
                      : r.recurrence_type === 'semanal' ? `Semanal${r.weekday !== null ? ` · ${['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][r.weekday]}` : ''}`
                      : r.recurrence_type === 'mensal' ? (r.month_day ? `Dia ${r.month_day} de cada mês` : 'Mensal')
                      : r.recurrence_type;
                    return (
                      <div key={r.id} className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                        <Repeat className="h-4 w-4 shrink-0" style={{ color: pc }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{r.title}</p>
                          <p className="text-xs text-muted-foreground">{desc}{r.hour_time ? ` · ${String(r.hour_time).slice(0,5)}` : ''}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {responsibilities.length > 0 && (
              <section className="rounded-2xl border bg-card p-5 sm:p-6">
                <h2 className="text-lg font-semibold flex items-center gap-2 mb-1"><Handshake className="h-5 w-5" style={{ color: pc }} /> Responsabilidades Acordadas</h2>
                <p className="text-xs text-muted-foreground mb-4">O que ficou definido entre cliente e equipa.</p>
                <div className="space-y-2">
                  {responsibilities.map((r: any) => {
                    const Icon = r.party === 'cliente' ? User : r.party === 'equipa' ? Users : Handshake;
                    const label = r.party === 'cliente' ? 'Cliente' : r.party === 'equipa' ? 'Equipa' : 'Partilhada';
                    return (
                      <div key={r.id} className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30">
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium shrink-0" style={{ backgroundColor: pcAlpha(0.1), color: pc }}>
                          <Icon className="h-3 w-3" /> {label}
                        </span>
                        <p className="text-sm flex-1">{r.description}</p>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        )}

        {/* ═══ ONBOARDING ═══ */}
        {activeSection === 'onboarding' && (
          <div className="space-y-5">
            <SectionTitle icon={CheckSquare}>A nossa jornada</SectionTitle>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${projectProgress}%`, backgroundColor: pc }} />
              </div>
              <span className="text-sm font-semibold" style={{ color: pc }}>{projectProgress}%</span>
            </div>
            {onboarding.length === 0 ? (
              <SectionCard className="p-8 text-center">
                <p className="text-sm text-muted-foreground">Ainda sem fases definidas.</p>
              </SectionCard>
            ) : (
              <div className="space-y-4">
                {/* Next step highlight */}
                {nextStep && (
                  <SectionCard className="p-5 border-l-4" style={{ borderLeftColor: pc }}>
                    <div className="flex items-center gap-2 mb-1">
                      <Sparkles className="h-4 w-4" style={{ color: pc }} />
                      <span className="text-xs uppercase tracking-widest font-bold" style={{ color: pc }}>Próximo passo</span>
                    </div>
                    <p className="text-base font-semibold">{nextStepMeetingTitle || nextStep.name}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-xs text-muted-foreground">{nextStep.phase_name}</span>
                      {(() => {
                        const dateStr = nextStepMeetingDateTime || nextStep.planned_end;
                        if (!dateStr) return null;
                        const withTime = !!nextStepMeetingDateTime;
                        return (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {withTime
                              ? format(parseISO(dateStr), "d 'de' MMMM 'às' HH:mm", { locale: pt })
                              : format(parseISO(dateStr), "d 'de' MMMM", { locale: pt })}
                          </span>
                        );
                      })()}
                    </div>
                  </SectionCard>
                )}

                {/* Phase cards */}
                <div className="flex flex-wrap gap-5">
                  {onboarding.map((phase, i) => {
                    const dels = phase.deliverables || [];
                    const done = isPhaseComplete(phase);
                    const completedDels = dels.filter((d) => d.status === 'concluido' || d.status === 'concluida').length;
                    return (
                      <div
                        key={phase.id}
                        className={`flex-1 min-w-[100px] rounded-2xl border shadow-sm transition-all cursor-pointer overflow-hidden ${
                          done ? 'border-border/20 bg-muted/40 opacity-60' : 'border-border/40 bg-white hover:shadow-md'
                        }`}
                        onClick={() => setExpandedOnbStep(phase.id)}
                      >
                        <div className="p-5 flex flex-col items-center text-center">
                          <span className="eyebrow font-medium text-muted-foreground">Fase</span>
                          <span className="text-4xl font-black mt-0.5" style={{ color: done ? 'hsl(var(--muted-foreground))' : pc }}>
                            {i + 1}
                          </span>
                          <p className={`text-xs font-medium mt-1.5 line-clamp-2 ${done ? 'text-muted-foreground' : ''}`}>{phase.name || 'Sem nome'}</p>
                          <p className="text-[10px] text-muted-foreground mt-1">{completedDels}/{dels.length} entregas</p>
                          <div className="mt-2 flex items-center gap-2">
                            {done ? (
                              <CheckCircle2 className="h-4 w-4 text-success" />
                            ) : (
                              <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                                <div className="h-full rounded-full transition-all" style={{ width: `${dels.length ? (completedDels / dels.length) * 100 : 0}%`, backgroundColor: pc }} />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}


        {/* ═══ FEEDBACK ═══ */}
        {activeSection === 'feedback' && (
          <PortalFeedbackSection
            feedback={feedback}
            feedbackText={feedbackText}
            setFeedbackText={setFeedbackText}
            sendFeedback={sendFeedback}
            pc={pc}
            pcAlpha={pcAlpha}
          />
        )}


        {/* ═══ HISTORY ═══ */}
        {activeSection === 'history' && (
          <PortalHistorySection projectHistory={projectHistory} pc={pc} />
        )}

        {/* ═══ PLAYLIST (vibe) — herda do produto, override por cliente ═══ */}
        {(portal.playlist_url || (settings as any)?.playlist_url) && (
          <PortalPlaylistEmbed url={(portal.playlist_url as string) || ((settings as any).playlist_url as string)} />
        )}

      </main>
    </div>
  );
}

// ─── PortalKpi ─────────────────────────────────────────
// BigKpi-style: thin colored left border + serif value + small caption.
// White-label safe — uses brand `pc` only, no --primary tokens.
function PortalKpi({
  icon: Icon,
  label,
  value,
  hint,
  onClick,
  pc,
}: {
  icon: any;
  label: React.ReactNode;
  value: React.ReactNode;
  hint?: React.ReactNode;
  onClick?: () => void;
  pc: string;
}) {
  return (
    <div
      onClick={onClick}
      className="border-l-2 pl-5 py-1 cursor-pointer group"
      style={{ borderColor: pc }}
    >
      <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground flex items-center gap-1.5">
        <Icon className="h-3 w-3" strokeWidth={1.5} style={{ color: pc }} />
        {label}
      </div>
      <div
        className="text-4xl sm:text-5xl leading-[1.05] mt-1.5 tracking-tight"
        style={{ color: pc, fontFamily: 'var(--font-display, Cormorant Garamond), Georgia, serif' }}
      >
        {value}
      </div>
      {hint && (
        <div className="text-[11px] text-muted-foreground mt-2 flex items-center gap-1 capitalize">
          {hint}
          <ChevronRight className="h-3 w-3 opacity-50 group-hover:translate-x-0.5 group-hover:opacity-100 transition-all" />
        </div>
      )}
    </div>
  );
}
