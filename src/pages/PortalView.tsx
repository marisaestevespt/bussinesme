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
  FolderOpen, Download, ChevronRight, Sparkles, Upload, Briefcase, CheckCircle2, Circle, Image as ImageIcon, Pencil, LogOut
} from 'lucide-react';
import type { Portal } from '@/hooks/usePortalData';
import {InlineLoader, EmptyHint } from '@/components/ui/loading-skeletons';
import { isDeliverableDone, isPhaseDone, isPhaseComplete as allDeliverablesDone, deliverableProgress, phaseProgress } from '@/lib/projectProgress';
import { usePortalBranding } from '@/hooks/usePortalBranding';
import { resolvePublicPortal, type PublicPortal } from '@/lib/portalAccess';
import { SectionCard, SectionTitle } from '@/components/portal-view/SectionPrimitives';
import { PortalContractSection } from '@/components/portal-view/PortalContractSection';
import { PortalFeedbackSection } from '@/components/portal-view/PortalFeedbackSection';
import { PortalHistorySection } from '@/components/portal-view/PortalHistorySection';
import { PortalMeetingsSection } from '@/components/portal-view/PortalMeetingsSection';
import { PortalPaymentsSection } from '@/components/portal-view/PortalPaymentsSection';
import type {
  PortalFaq, PortalQuestion, PortalComment, PortalFeedback,
  PortalMeeting, PortalMeetingDoc, PortalMeetingPoint,
  PortalPayment, PortalPhase, PortalDeliverable,
  PortalMaterial, PortalContractDocument, PortalProjectHistoryEntry,
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
  const [portalMaterials, setPortalMaterials] = useState<PortalMaterial[]>([]);
  const [contractDocs, setContractDocs] = useState<PortalContractDocument[]>([]);

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
    setSettings(settingsRes.data || {});
    const [faqsR, questionsR, commentsR, feedbackR, meetingsR, paymentsR, tasksR, projPhasesR, historyR, materialsR, contractR] = await Promise.all([
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
      supabase.rpc('get_portal_materials', { _token: realToken }),
      supabase.rpc('get_portal_contract_documents', { _token: realToken }),
    ]);
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
    const materialsList = (materialsR.data || []) as unknown as PortalMaterial[];
    setPortalMaterials(materialsList.slice().sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()));
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

  const rawColor = settings?.primary_color || '12 76% 52%';
  const pc = `hsl(${rawColor})`;
  const pcAlpha = (a: number) => `hsl(${rawColor} / ${a})`;
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
    ...(projectHistory.length > 0 ? [{ key: 'history', label: 'Histórico', icon: History }] : []),
  ];

  // Onboarding progress: count phases where all deliverables are done
  const isPhaseComplete = (p: any) => allDeliverablesDone(p.deliverables || []);
  const completedOnb = onboarding.filter(isPhaseComplete).length;
  const totalOnb = onboarding.length;
  const onbPercent = totalOnb > 0 ? Math.round((completedOnb / totalOnb) * 100) : 0;

  // Find next pending deliverable across all onboarding phases
  const nextStep = (() => {
    for (const phase of onboarding) {
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

  // Override next step if questions need filling
  const effectiveNextStep = hasUnansweredQuestions
    ? { name: 'Preencher perguntas iniciais', phase_name: 'Perguntas', planned_end: null, _isQuestions: true }
    : nextStep;

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

  // Current active phase for status display
  const activePhase = phases.find((p) => p.status === 'em_curso');
  const allDeliverables = phases.flatMap((p) => p.deliverables || []);
  const completedDeliverables = allDeliverables.filter(isDeliverableDone).length;
  const projectProgress = deliverableProgress(allDeliverables);

  return (
    <div className="min-h-screen" style={{ background: `linear-gradient(180deg, #fefcfa 0%, ${pcAlpha(0.04)} 100%)` }}>
      {/* ─── Header with integrated nav ─── */}
      <header className="sticky top-0 z-30 backdrop-blur-md bg-white/80 border-b border-border/30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {logoUrl && <img src={logoUrl} alt="Logo" className="h-7 object-contain" />}
            </div>
            <div className="flex items-center gap-3">
              {(settings as any)?.support_hours && (
                <div className="hidden sm:flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  <span className="text-[11px]">{(settings as any).support_hours}</span>
                </div>
              )}
              <div className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ backgroundColor: pc }}>
                {firstName.charAt(0).toUpperCase()}
              </div>
              <span className="text-sm font-medium text-foreground hidden sm:inline">{firstName}</span>
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
          <div className="-mb-px flex gap-1 overflow-x-auto scrollbar-none pb-0">
            {navItems.map(item => {
              const active = activeSection === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => setActiveSection(item.key)}
                  className={`flex items-center gap-2 px-3.5 py-2.5 text-sm whitespace-nowrap border-b-2 transition-all ${
                    active ? 'font-semibold border-current' : 'text-muted-foreground border-transparent hover:text-foreground hover:border-border'
                  }`}
                  style={active ? { color: pc } : undefined}
                >
                  <item.icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* ─── Main ─── */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-5 sm:py-8 space-y-6">

        {/* ═══ HOME ═══ */}
        {activeSection === 'home' && (
          <>

            {/* Welcome hero with project status */}
            <div
              className="rounded-2xl p-6 sm:p-8 text-white relative overflow-hidden"
              style={{ background: `linear-gradient(135deg, ${pc} 0%, ${pcAlpha(0.8)} 100%)` }}
            >
              <div className="absolute top-0 right-0 w-40 h-40 rounded-full opacity-10 bg-white -translate-y-1/2 translate-x-1/2" />
              <div className="relative z-10">
                <p className="text-white/70 text-sm mb-1">Olá 👋</p>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ fontFamily: 'var(--font-display, "Plus Jakarta Sans", sans-serif)' }}>
                  Bem-vinda, {firstName}!
                </h1>
                <p className="text-white/80 text-sm mt-2 max-w-md">
                  Este é o teu espaço de acompanhamento. Aqui encontras tudo o que precisas.
                </p>

                {/* Project status bar */}
                {phases.length > 0 && (
                  <div className="mt-5 bg-white/15 rounded-xl p-4 backdrop-blur-sm">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-white/90 text-xs font-medium">Progresso do Projeto</span>
                      <span className="text-white font-bold text-sm">{projectProgress}%</span>
                    </div>
                    <div className="h-2 bg-white/20 rounded-full overflow-hidden mb-3">
                      <div className="h-full bg-white rounded-full transition-all" style={{ width: `${projectProgress}%` }} />
                    </div>
                    {activePhase && (
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-white animate-pulse" />
                        <span className="text-white/90 text-xs">Fase atual: <strong>{activePhase.title}</strong></span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {portal.show_meetings && (() => {
                const next = meetings
                  .filter((m) => ['por_organizar', 'confirmada', 'por_confirmar', 'marcada'].includes(m.status) && m.date_time)
                  .sort((a, b) => new Date(a.date_time).getTime() - new Date(b.date_time).getTime())[0];
                return (
                  <div
                    className="rounded-2xl p-5 cursor-pointer group border transition-all hover:scale-[1.01]"
                    style={{ backgroundColor: pcAlpha(0.04), borderColor: pcAlpha(0.12), boxShadow: `0 4px 24px ${pcAlpha(0.10)}, 0 1px 4px rgba(0,0,0,0.04)` }}
                    onClick={() => setActiveSection('meetings')}
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-xl" style={{ backgroundColor: pcAlpha(0.12) }}>
                        <CalendarDays className="h-5 w-5" style={{ color: pc }} />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs text-muted-foreground font-medium">Próxima Reunião</p>
                        <p className="text-sm font-bold mt-0.5">
                          {next ? format(parseISO(next.date_time), "d 'de' MMMM, HH:mm", { locale: pt }) : 'Sem reuniões agendadas'}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>
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
                  <div
                    className="rounded-2xl p-5 cursor-pointer group border transition-all hover:scale-[1.01]"
                    style={{ backgroundColor: pcAlpha(0.04), borderColor: pcAlpha(0.12), boxShadow: `0 4px 24px ${pcAlpha(0.10)}, 0 1px 4px rgba(0,0,0,0.04)` }}
                    onClick={() => setActiveSection('payments')}
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-xl" style={{ backgroundColor: pcAlpha(0.12) }}>
                        <CreditCard className="h-5 w-5" style={{ color: pc }} />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs text-muted-foreground font-medium">Próximo Pagamento</p>
                        <p className="text-sm font-bold mt-0.5">
                          {next ? format(parseISO(next.payment_date), "d 'de' MMMM, yyyy", { locale: pt }) : 'Sem pagamentos pendentes'}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* ── Onboarding Step Cards ── */}
            {portal.show_onboarding && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl" style={{ backgroundColor: pcAlpha(0.1) }}>
                      <CheckSquare className="h-4 w-4" style={{ color: pc }} />
                    </div>
                    <h3 className="text-sm font-bold">A nossa jornada</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${onbPercent}%`, backgroundColor: pc }} />
                    </div>
                    <span className="text-xs font-semibold" style={{ color: pc }}>{onbPercent}%</span>
                  </div>
                </div>
                {onboarding.length === 0 ? (
                  <SectionCard className="p-6 text-center">
                    <p className="text-sm text-muted-foreground">Ainda sem fases definidas.</p>
                  </SectionCard>
                ) : (
                  <div className="space-y-3">
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
                          <span className="text-[10px] uppercase tracking-widest font-bold" style={{ color: pc }}>Próximo passo</span>
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
                    <div className="flex flex-wrap gap-3">
                      {onboarding.map((phase, i) => {
                        const dels = phase.deliverables || [];
                        const done = isPhaseComplete(phase);
                        const completedDels = dels.filter(isDeliverableDone).length;
                        return (
                          <div
                            key={phase.id}
                            className={`flex-1 min-w-[100px] rounded-2xl border shadow-sm transition-all cursor-pointer overflow-hidden ${
                              done ? 'border-border/20 bg-muted/40 opacity-60' : 'border-border/40 bg-white hover:shadow-md'
                            }`}
                            onClick={() => setExpandedOnbStep(phase.id)}
                          >
                            <div className="p-4 flex flex-col items-center text-center">
                              <span className="text-[10px] uppercase tracking-widest font-medium text-muted-foreground">Fase</span>
                              <span className="text-3xl font-black mt-0.5" style={{ color: done ? 'hsl(var(--muted-foreground))' : pc }}>
                                {i + 1}
                              </span>
                              <p className={`text-xs font-medium mt-1.5 line-clamp-2 ${done ? 'text-muted-foreground' : ''}`}>{phase.name || 'Sem nome'}</p>
                              <p className="text-[10px] text-muted-foreground mt-1">{completedDels}/{dels.length} entregas</p>
                              <div className="mt-2 flex items-center gap-2">
                                {done ? (
                                  <CheckCircle2 className="h-4 w-4 text-success" />
                                ) : (
                                  <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
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
        {activeSection === 'questions' && questions.length > 0 && (() => {
          const isQAnswered = (q: any) => q.answer?.trim() || (Array.isArray(q.file_urls) && q.file_urls.length > 0);
          const allAnswered = questions.every(isQAnswered);
          const answeredCount = questions.filter(isQAnswered).length;
          const allSubmitted = allAnswered && !activeQuestionId;
          const currentOpen = activeQuestionId;

          const handleSubmitAll = async () => {
            for (const [qId, text] of Object.entries(draftAnswers)) {
              if (text.trim()) await answerQuestion(qId, text);
            }
            setDraftAnswers({});
            setActiveQuestionId(null);
            toast.success('Respostas submetidas!');
            if (client?.id && client?.full_name) {
              (supabase as any).rpc('notify_portal_questions_submitted', {
                _client_name: client.full_name,
                _client_id: client.id,
              }).catch(() => {});
            }
          };

          const groups: { group: string; items: any[] }[] = [];
          const seen = new Set<string>();
          for (const q of questions) {
            const g = q.question_group || 'Geral';
            if (!seen.has(g)) { seen.add(g); groups.push({ group: g, items: [] }); }
            groups.find(gr => gr.group === g)!.items.push(q);
          }

          return (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <SectionTitle icon={ClipboardList}>Perguntas Iniciais</SectionTitle>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">{answeredCount}/{questions.length} respondidas</span>
                  {allSubmitted ? (
                    <Badge variant="outline" className="text-[10px] font-medium text-success border-success/30 bg-success/15">
                      ✓ Submetido
                    </Badge>
                  ) : (
                    <Badge className="text-[10px] font-semibold text-white border-0 px-2.5 py-0.5" style={{ backgroundColor: pc }}>
                      Por preencher
                    </Badge>
                  )}
                </div>
              </div>

              {!allSubmitted && (
                <p className="text-sm text-muted-foreground -mt-2">
                  Responde a todas as perguntas para nos ajudar a conhecer melhor o teu negócio. Podes guardar e voltar mais tarde.
                </p>
              )}

              <div className="space-y-3">
                {groups.map((section) => {
                  const sectionAnswered = section.items.filter(isQAnswered).length;
                  const sectionComplete = sectionAnswered === section.items.length;
                  const isSectionOpen = expandedSections.has(section.group);

                  return (
                    <SectionCard key={section.group} className="overflow-hidden">
                      <button
                        className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-muted/20 transition-colors"
                        onClick={() => {
                          setExpandedSections(prev => {
                            const next = new Set(prev);
                            if (next.has(section.group)) next.delete(section.group);
                            else next.add(section.group);
                            return next;
                          });
                          if (isSectionOpen) {
                            const openInSection = section.items.find((q) => q.id === currentOpen);
                            if (openInSection) setActiveQuestionId(null);
                          }
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${isSectionOpen ? 'rotate-90' : ''}`} />
                          <p className="text-sm font-semibold">{section.group}</p>
                        </div>
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${sectionComplete ? 'text-success border-success/30 bg-success/15' : ''}`}
                        >
                          {sectionAnswered}/{section.items.length}
                        </Badge>
                      </button>

                      {isSectionOpen && (
                        <div className="divide-y divide-border/20 border-t border-border/20">
                          {section.items.map((q, i) => {
                            const isOpen = currentOpen === q.id;
                            const hasAnswer = q.answer?.trim() || draftAnswers[q.id]?.trim() || (Array.isArray(q.file_urls) && q.file_urls.length > 0);
                            return (
                              <div key={q.id} className="transition-all">
                                <button
                                  className="w-full px-5 py-3 flex items-center gap-3 text-left hover:bg-muted/30 transition-colors pl-10"
                                  onClick={() => setActiveQuestionId(isOpen ? null : q.id)}
                                >
                                  <div
                                    className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 transition-all ${
                                      hasAnswer ? 'text-white' : 'bg-muted text-muted-foreground'
                                    }`}
                                    style={hasAnswer ? { backgroundColor: pc } : undefined}
                                  >
                                    {hasAnswer ? '✓' : i + 1}
                                  </div>
                                  <p className={`text-sm flex-1 ${hasAnswer ? 'text-muted-foreground' : 'font-medium'}`}>{q.question}</p>
                                  <ChevronRight className={`h-4 w-4 text-muted-foreground/40 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                                </button>

                                {isOpen && (
                                  <div className="px-5 pb-4 pl-[4.5rem]">
                                    {Array.isArray(q.file_urls) && q.file_urls.length > 0 && (
                                      <div className="rounded-xl bg-success/15/50 border border-success p-3 mb-2">
                                        <div className="flex flex-wrap gap-2">
                                          {(q.file_urls as string[]).map((url: string, fi: number) => {
                                            const isImg = /\.(jpg|jpeg|png|gif|webp)$/i.test(url);
                                            return (
                                              <div key={fi} className="relative group/file">
                                                {isImg ? (
                                                  <a href={url} target="_blank" rel="noopener noreferrer">
                                                    <img src={url} alt="" className="h-16 w-16 object-cover rounded-lg border" />
                                                  </a>
                                                ) : (
                                                  <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-primary hover:underline bg-white rounded-lg border px-2 py-1">
                                                    <FileText className="h-3 w-3" />{url.split('/').pop()?.substring(0, 25)}
                                                  </a>
                                                )}
                                                <button
                                                  onClick={() => removeQuestionFile(q.id, fi)}
                                                  className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-destructive text-white flex items-center justify-center opacity-0 group-hover/file:opacity-100 transition-opacity text-[10px] font-bold"
                                                  title="Remover ficheiro"
                                                >
                                                  ✕
                                                </button>
                                              </div>
                                            );
                                          })}
                                        </div>
                                        {q.answered_at && <p className="text-[10px] text-muted-foreground mt-2">Enviado {format(parseISO(q.answered_at), 'dd/MM/yyyy')}</p>}
                                      </div>
                                    )}

                                    {/* Text answer — always available */}
                                    {q.answer?.trim() && editingQuestionId !== q.id ? (
                                      <div className="space-y-2">
                                        <div className="rounded-xl bg-success/15/50 border border-success p-3">
                                          <p className="text-sm">{q.answer}</p>
                                          {q.answered_at && <p className="text-[10px] text-muted-foreground mt-1">Respondida {format(parseISO(q.answered_at), 'dd/MM/yyyy')}</p>}
                                        </div>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="text-xs text-muted-foreground"
                                          onClick={() => {
                                            setEditingQuestionId(q.id);
                                            setDraftAnswers(prev => ({ ...prev, [q.id]: q.answer }));
                                          }}
                                        >
                                          <Pencil className="h-3 w-3 mr-1" /> Editar resposta
                                        </Button>
                                      </div>
                                    ) : (
                                      <Textarea
                                        className="text-sm rounded-xl border-border/40 bg-muted/10 focus-visible:ring-1"
                                        placeholder="A tua resposta..."
                                        value={draftAnswers[q.id] ?? q.answer ?? ''}
                                        onChange={e => setDraftAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                                        rows={3}
                                        style={{ '--tw-ring-color': pcAlpha(0.25) } as any}
                                        autoFocus
                                      />
                                    )}
                                    {(draftAnswers[q.id]?.trim() && draftAnswers[q.id] !== q.answer) && (
                                      <Button
                                        size="sm"
                                        className="mt-2 rounded-lg text-white text-xs"
                                        style={{ backgroundColor: pc }}
                                        onClick={async () => {
                                          await answerQuestion(q.id, draftAnswers[q.id]);
                                          setDraftAnswers(prev => { const n = { ...prev }; delete n[q.id]; return n; });
                                          setEditingQuestionId(null);
                                          const nextUnanswered = questions.find((qq) => qq.id !== q.id && !qq.answer?.trim() && !(Array.isArray(qq.file_urls) && qq.file_urls.length));
                                          setActiveQuestionId(nextUnanswered?.id || null);
                                        }}
                                      >
                                        ✓ Guardar resposta
                                      </Button>
                                    )}

                                    {/* File upload — always available */}
                                    <div className="space-y-2 mt-3">
                                      <label className="flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border/40 bg-muted/10 p-4 cursor-pointer hover:bg-muted/20 transition-colors">
                                        <input
                                          type="file"
                                          className="hidden"
                                          multiple
                                          onChange={e => {
                                            if (e.target.files?.length) {
                                              uploadQuestionFiles(q.id, e.target.files);
                                            }
                                          }}
                                          disabled={uploadingQuestionFiles[q.id]}
                                        />
                                        {uploadingQuestionFiles[q.id] ? (
                                          <InlineLoader />
                                        ) : (
                                          <>
                                            <Upload className="h-4 w-4 text-muted-foreground" />
                                            <span className="text-sm text-muted-foreground">Carregar ficheiro(s) ou imagem(ns)</span>
                                          </>
                                        )}
                                      </label>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </SectionCard>
                  );
                })}
              </div>

              {allAnswered && !allSubmitted && (
                <Button
                  className="w-full rounded-xl text-white font-semibold py-3"
                  style={{ backgroundColor: pc }}
                  onClick={handleSubmitAll}
                >
                  <Send className="h-4 w-4 mr-2" />Submeter Todas as Respostas
                </Button>
              )}
            </div>
          );
        })()}

        {/* ═══ WORKSPACE ═══ */}
        {activeSection === 'workspace' && (
          <PortalWorkspaceSection
            phases={phases}
            client={client}
            portalMaterials={portalMaterials}
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

        {/* ═══ ONBOARDING ═══ */}
        {activeSection === 'onboarding' && (
          <div className="space-y-5">
            <SectionTitle icon={CheckSquare}>A nossa jornada</SectionTitle>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${onbPercent}%`, backgroundColor: pc }} />
              </div>
              <span className="text-sm font-semibold" style={{ color: pc }}>{onbPercent}%</span>
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
                    <p className="text-base font-semibold">{nextStep.name}</p>
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
                <div className="flex flex-wrap gap-3">
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
                          <span className="text-[10px] uppercase tracking-widest font-medium text-muted-foreground">Fase</span>
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

      </main>
    </div>
  );
}
