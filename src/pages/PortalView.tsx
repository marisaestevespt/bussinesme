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

const sb = (table: string) => supabase.from(table as any) as any;
const isClientStep = (o: any) => o.responsible?.toLowerCase().trim() === 'cliente';

const SectionCard = ({ children, className = '', onClick, style }: { children: React.ReactNode; className?: string; onClick?: () => void; style?: React.CSSProperties }) => (
  <div className={`bg-white rounded-2xl border border-border/40 shadow-sm hover:shadow-md transition-shadow ${className}`} onClick={onClick} style={style}>
    {children}
  </div>
);

const SectionTitle = ({ children, icon: Icon }: { children: React.ReactNode; icon?: any }) => (
  <div className="flex items-center gap-2.5 mb-4">
    {Icon && <div className="p-2 rounded-xl bg-primary/10"><Icon className="h-4 w-4 text-primary" /></div>}
    <h2 className="text-lg font-bold tracking-tight" style={{ fontFamily: 'var(--font-display, "Plus Jakarta Sans", sans-serif)' }}>{children}</h2>
  </div>
);

export default function PortalViewPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [portal, setPortal] = useState<Portal | null>(null);
  const [client, setClient] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<string>('home');

  const [faqs, setFaqs] = useState<any[]>([]);
  const [questions, setQuestions] = useState<any[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [feedback, setFeedback] = useState<any[]>([]);
  const [meetings, setMeetings] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [onboarding, setOnboarding] = useState<any[]>([]); // derived from phases
  const [tasks, setTasks] = useState<any[]>([]);
  const [phases, setPhases] = useState<any[]>([]);
  
  const [projectHistory, setProjectHistory] = useState<any[]>([]);
  const [portalMaterials, setPortalMaterials] = useState<any[]>([]);
  const [contractDocs, setContractDocs] = useState<any[]>([]);

  const [commentText, setCommentText] = useState('');
  const [feedbackText, setFeedbackText] = useState('');
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
  const [draftAnswers, setDraftAnswers] = useState<Record<string, string>>({});
  const [expandedOnbStep, setExpandedOnbStep] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);

  useEffect(() => { init(); }, [token]);

  const init = async () => {
    if (!token) return;
    // Try as UUID token first, then as slug
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token);
    let portalData: any = null;
    if (isUUID) {
      const { data } = await (supabase as any).rpc('get_portal_by_token', { _token: token });
      const row = Array.isArray(data) ? data[0] : data;
      if (row) portalData = { ...row, token };
    }
    if (!portalData) {
      const { data } = await (supabase as any).rpc('get_portal_by_slug', { _slug: token });
      const row = Array.isArray(data) ? data[0] : data;
      if (row) portalData = { ...row, slug: token };
    }
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
      (supabase as any).rpc('get_portal_client_context', { _token: realToken }),
      supabase.from('business_settings').select('*').limit(1).maybeSingle(),
    ]);
    const clientData = Array.isArray(clientCtxRes.data) ? clientCtxRes.data[0] : null;
    if (clientCtxRes.error || !clientData) { toast.error('Não foi possível carregar o portal.'); navigate(`/portal/${token}`, { replace: true }); return; }
    setClient(clientData);
    setSettings(settingsRes.data);
    const pid = portalData.id;
    const cid = portalData.client_id;
    const [faqsR, questionsR, commentsR, feedbackR, meetingsR, paymentsR, tasksR, projPhasesR, historyR, materialsR, contractR] = await Promise.all([
      (supabase as any).rpc('get_portal_faqs', { _token: realToken }),
      (supabase as any).rpc('get_portal_initial_questions', { _token: realToken }),
      (supabase as any).rpc('get_portal_comments', { _token: realToken }),
      (supabase as any).rpc('get_portal_feedback', { _token: realToken }),
      (supabase as any).rpc('get_portal_meetings', { _token: realToken }),
      (supabase as any).rpc('get_portal_payments', { _token: realToken }),
      supabase.from('tasks').select('*').eq('visible_in_portal', true),
      (supabase as any).rpc('get_portal_phases', { _token: realToken }),
      (supabase as any).rpc('get_portal_project_history', { _token: realToken }),
      (supabase as any).rpc('get_portal_materials', { _token: realToken }),
      (supabase as any).rpc('get_portal_contract_documents', { _token: realToken }),
    ]);
    setFaqs(((faqsR as any).data || []).slice().sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0)));
    setQuestions(((questionsR as any).data || []).slice().sort((a: any, b: any) =>
      (a.group_sort_order ?? 0) - (b.group_sort_order ?? 0) || (a.sort_order ?? 0) - (b.sort_order ?? 0)));
    setComments(((commentsR as any).data || []).slice().sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()));
    setFeedback(((feedbackR as any).data || []).slice().sort((a: any, b: any) => new Date(b.submitted_at || b.created_at).getTime() - new Date(a.submitted_at || a.created_at).getTime()));
    setMeetings((meetingsR as any).data || []);
    setPayments((paymentsR as any).data || []);
    setTasks((tasksR as any).data || []);
    // get_portal_phases now returns jsonb with deliverables included
    const phasesData = (projPhasesR as any).data || [];
    const parsedPhases = Array.isArray(phasesData) ? phasesData : [];
    const allPhases = parsedPhases.map((p: any) => ({ ...p, title: p.name, status: p.status === 'concluida' ? 'concluido' : p.status }));
    setPhases(allPhases);
    // Show all phases in the onboarding/timeline section
    setOnboarding(allPhases);
    setProjectHistory((historyR as any).data || []);
    setPortalMaterials(((materialsR as any).data || []).slice().sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
    setContractDocs((contractR as any).data || []);
    setLoading(false);
  };

  const sendComment = async () => {
    if (!commentText.trim() || !portal) return;
    await (supabase as any).rpc('portal_add_comment', {
      _token: portal.token,
      _author: client?.full_name || 'Cliente',
      _content: commentText.trim(),
    });
    setComments(prev => [...prev, { id: crypto.randomUUID(), portal_id: portal.id, content: commentText.trim(), author: 'client', author_name: client?.full_name || 'Cliente', created_at: new Date().toISOString() }]);
    setCommentText('');
  };

  const sendFeedback = async () => {
    if (!feedbackText.trim() || !portal) return;
    await (supabase as any).rpc('portal_submit_feedback', {
      _token: portal.token,
      _payload: { content: feedbackText.trim() },
    });
    toast.success('Feedback enviado! Obrigado. 💛');
    setFeedbackText('');
  };

  const maybeNotifyQuestionsSubmitted = async () => {
    if (!portal?.token) return;
    try {
      await (supabase as any).rpc('portal_submit_initial_questions', { _token: portal.token });
    } catch (err) {
      console.error('Erro ao validar submissão das perguntas do portal:', err);
    }
  };

  const answerQuestion = async (qId: string, answer: string) => {
    const answeredAt = new Date().toISOString();
    await (supabase as any).rpc('portal_answer_initial_question', {
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
      await (supabase as any).rpc('portal_answer_initial_question', {
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
      await (supabase as any).rpc('portal_answer_initial_question', {
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
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
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

  const hasUnansweredQuestions = questions.length > 0 && questions.some((q: any) => !q.answer?.trim() && !(Array.isArray(q.file_urls) && q.file_urls.length > 0));

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
  const isPhaseComplete = (p: any) => {
    const dels = p.deliverables || [];
    return dels.length > 0 && dels.every((d: any) => d.status === 'concluido' || d.status === 'concluida');
  };
  const completedOnb = onboarding.filter(isPhaseComplete).length;
  const totalOnb = onboarding.length;
  const onbPercent = totalOnb > 0 ? Math.round((completedOnb / totalOnb) * 100) : 0;

  // Find next pending deliverable across all onboarding phases
  const nextStep = (() => {
    for (const phase of onboarding) {
      const dels = phase.deliverables || [];
      const pending = dels.find((d: any) => d.status !== 'concluido' && d.status !== 'concluida');
      if (pending) return { ...pending, phase_name: phase.name };
    }
    return null;
  })();

  // Override next step if questions need filling
  const effectiveNextStep = hasUnansweredQuestions
    ? { name: 'Preencher perguntas iniciais', phase_name: 'Perguntas', planned_end: null, _isQuestions: true }
    : nextStep;

  const statusLabel = (s: string) => {
    const map: Record<string, { text: string; cls: string }> = {
      pago: { text: 'Pago', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
      tudo_ok: { text: 'Pago', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
      em_falta: { text: 'Em falta', cls: 'bg-red-50 text-red-600 border-red-200' },
      pendente: { text: 'Pendente', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
      aguarda_pagamento: { text: 'Aguarda pagamento', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
      em_atraso: { text: 'Em atraso', cls: 'bg-red-50 text-red-600 border-red-200' },
    };
    return map[s] || { text: s, cls: '' };
  };

  const meetingStatus = (s: string) => {
    const map: Record<string, { text: string; cls: string }> = {
      por_confirmar: { text: 'Por confirmar', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
      por_organizar: { text: 'Por organizar', cls: 'bg-sky-50 text-sky-700 border-sky-200' },
      confirmada: { text: 'Confirmada', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
      marcada: { text: 'Confirmada', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
      terminada: { text: 'Terminada', cls: 'bg-slate-100 text-slate-700 border-slate-200' },
      realizada: { text: 'Realizada', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
      cancelada: { text: 'Cancelada', cls: 'bg-red-50 text-red-600 border-red-200' },
    };
    return map[s] || { text: s, cls: '' };
  };

  // Current active phase for status display
  const activePhase = phases.find((p: any) => p.status === 'em_curso');
  const allDeliverables = phases.flatMap((p: any) => p.deliverables || []);
  const completedDeliverables = allDeliverables.filter((d: any) => d.status === 'concluido').length;
  const projectProgress = allDeliverables.length > 0 ? Math.round((completedDeliverables / allDeliverables.length) * 100) : 0;

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
                <div className="hidden sm:flex items-center gap-1.5 text-muted-foreground">
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
                size="icon"
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
                  className={`flex items-center gap-1.5 px-3.5 py-2.5 text-sm whitespace-nowrap border-b-2 transition-all ${
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
                  .filter((m: any) => ['por_organizar', 'confirmada', 'por_confirmar', 'marcada'].includes(m.status) && m.date_time)
                  .sort((a: any, b: any) => new Date(a.date_time).getTime() - new Date(b.date_time).getTime())[0];
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
                  .filter((p: any) => {
                    if (!p.payment_date) return false;
                    const isPaid = paidStatuses.includes(p.status);
                    if (isPaid) return false;
                    // Show future pending payments OR past overdue ones
                    return true;
                  })
                  .sort((a: any, b: any) => new Date(a.payment_date).getTime() - new Date(b.payment_date).getTime())[0];
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
                  <div className="flex items-center gap-2.5">
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
                          {effectiveNextStep.planned_end && (
                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {format(parseISO(effectiveNextStep.planned_end), "d 'de' MMMM", { locale: pt })}
                            </span>
                          )}
                        </div>
                      </SectionCard>
                    )}

                    {/* Phase cards */}
                    <div className="flex flex-wrap gap-3">
                      {onboarding.map((phase: any, i: number) => {
                        const dels = phase.deliverables || [];
                        const done = isPhaseComplete(phase);
                        const completedDels = dels.filter((d: any) => d.status === 'concluido' || d.status === 'concluida').length;
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
                              <div className="mt-2 flex items-center gap-1.5">
                                {done ? (
                                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
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
                          const phase = onboarding.find((p: any) => p.id === expandedOnbStep);
                          if (!phase) return null;
                          const dels = phase.deliverables || [];
                          const completedDels = dels.filter((d: any) => d.status === 'concluido' || d.status === 'concluida').length;
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
                                  {dels.map((d: any) => {
                                    const dDone = d.status === 'concluido' || d.status === 'concluida';
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
                                          const all = parsed.map((p: any) => ({ ...p, title: p.name, status: p.status === 'concluida' ? 'concluido' : p.status }));
                                          setPhases(all);
                                          setOnboarding(all);
                                        }}
                                      >
                                        {dDone
                                          ? <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
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
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${isClient ? 'bg-amber-100 text-amber-700' : 'bg-muted text-muted-foreground'}`}>
                                              {isClient ? '👤 Tu' : '👥 Equipa'}
                                            </span>
                                          </div>
                                          {d.description && <p className="text-xs text-muted-foreground mt-1">{d.description}</p>}
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
              <div className="flex items-center gap-2.5">
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
                    <Badge variant="outline" className="text-[10px] font-medium text-emerald-600 border-emerald-200 bg-emerald-50">
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
                            const openInSection = section.items.find((q: any) => q.id === currentOpen);
                            if (openInSection) setActiveQuestionId(null);
                          }
                        }}
                      >
                        <div className="flex items-center gap-2.5">
                          <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${isSectionOpen ? 'rotate-90' : ''}`} />
                          <p className="text-sm font-semibold">{section.group}</p>
                        </div>
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${sectionComplete ? 'text-emerald-600 border-emerald-200 bg-emerald-50' : ''}`}
                        >
                          {sectionAnswered}/{section.items.length}
                        </Badge>
                      </button>

                      {isSectionOpen && (
                        <div className="divide-y divide-border/20 border-t border-border/20">
                          {section.items.map((q: any, i: number) => {
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
                                      <div className="rounded-xl bg-emerald-50/50 border border-emerald-100 p-3 mb-2">
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
                                        <div className="rounded-xl bg-emerald-50/50 border border-emerald-100 p-3">
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
                                          const nextUnanswered = questions.find((qq: any) => qq.id !== q.id && !qq.answer?.trim() && !(Array.isArray(qq.file_urls) && qq.file_urls.length));
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
                                          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
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
          <div className="space-y-5">
            <SectionTitle icon={Briefcase}>Espaço de Trabalho</SectionTitle>

            {/* Project phases - Cards with progress bar */}
            {(() => {
              const total = phases.length;
              const done = phases.filter((p: any) => p.status === 'concluido' || p.status === 'concluida').length;
              const pct = total > 0 ? Math.round((done / total) * 100) : 0;
              return (
                <SectionCard className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-sm font-semibold">📋 Fases do Projeto</p>
                    {total > 0 && <span className="text-xs text-muted-foreground">{done}/{total} concluídas</span>}
                  </div>
                  {total > 0 ? (
                    <>
                      {/* Progress bar */}
                      <div className="h-2.5 rounded-full bg-muted/40 mb-5 overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: pc }} />
                      </div>
                      {/* Phase timeline */}
                      <div className="space-y-4">
                        {phases.map((p: any, i: number) => {
                          const isDone = p.status === 'concluido' || p.status === 'concluida';
                          const isActive = p.status === 'em_curso';
                          const deliverables = Array.isArray(p.deliverables) ? p.deliverables : [];
                          return (
                            <div key={p.id} className={`rounded-xl border p-4 transition-all ${
                              isDone ? 'border-emerald-200 bg-emerald-50/50' :
                              isActive ? 'border-2 shadow-sm' : 'border-border/30 bg-muted/10'
                            }`} style={isActive ? { borderColor: pc, backgroundColor: pcAlpha(0.04) } : undefined}>
                              <div className="flex items-center gap-3">
                                {isDone ? (
                                  <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                                ) : isActive ? (
                                  <div className="h-5 w-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0" style={{ backgroundColor: pc }}>
                                    {i + 1}
                                  </div>
                                ) : (
                                  <Circle className="h-5 w-5 text-muted-foreground/40 shrink-0" />
                                )}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className={`text-sm font-medium ${isDone ? 'text-muted-foreground line-through' : ''}`}>{p.title || p.name}</p>
                                    {(p.planned_start || p.planned_end) && (
                                      <span className="text-[10px] text-muted-foreground">
                                        {p.planned_start ? format(parseISO(p.planned_start), "d MMM", { locale: pt }) : '?'}
                                        {' — '}
                                        {p.planned_end ? format(parseISO(p.planned_end), "d MMM", { locale: pt }) : '?'}
                                      </span>
                                    )}
                                  </div>
                                  {p.description && <p className="text-xs text-muted-foreground mt-0.5">{p.description}</p>}
                                </div>
                                <span className={`text-[10px] font-medium shrink-0 ${
                                  isDone ? 'text-emerald-600' : isActive ? '' : 'text-muted-foreground'
                                }`} style={isActive ? { color: pc } : undefined}>
                                  {isDone ? 'Concluído' : isActive ? 'Em curso' : 'Por começar'}
                                </span>
                              </div>
                              {/* Deliverables / Marcos */}
                              {deliverables.length > 0 && (
                                <div className="mt-3 pl-8 space-y-1.5">
                                  {deliverables.map((d: any) => {
                                    const dDone = d.status === 'concluido';
                                    const dActive = d.status === 'em_progresso';
                                    return (
                                      <div key={d.id} className="flex items-center gap-2">
                                        {dDone ? (
                                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                                        ) : dActive ? (
                                          <div className="h-3.5 w-3.5 rounded-full border-2 shrink-0" style={{ borderColor: pc }} />
                                        ) : (
                                          <Circle className="h-3.5 w-3.5 text-muted-foreground/30 shrink-0" />
                                        )}
                                        <span className={`text-xs ${dDone ? 'text-muted-foreground line-through' : ''}`}>{d.name}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">Ainda sem fases definidas. Em breve terás aqui o progresso do teu projeto.</p>
                  )}
                </SectionCard>
              );
            })()}

            {/* Deliverables - Gallery */}
            <SectionCard className="p-6">
              <p className="text-sm font-semibold mb-4">📦 Entregáveis</p>
              {(() => {
                const allItems: { id: string; label: string; url: string; type: 'link' | 'file' }[] = [];
                if (client.documents) allItems.push({ id: 'docs', label: 'Documentos', url: client.documents, type: 'link' });
                if (client.drive_folder_url) allItems.push({ id: 'drive', label: 'Pasta Drive', url: client.drive_folder_url, type: 'link' });
                portalMaterials.forEach((m: any) => allItems.push({ id: m.id, label: m.file_name, url: m.file_url, type: 'file' }));

                return allItems.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {allItems.map(item => (
                      <a
                        key={item.id}
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group rounded-xl border border-border/30 p-4 hover:shadow-md hover:border-border/60 transition-all flex flex-col items-center gap-3 text-center"
                      >
                        <div className="p-3 rounded-xl transition-colors" style={{ backgroundColor: pcAlpha(0.08) }}>
                          {item.type === 'link' ? (
                            <FolderOpen className="h-6 w-6" style={{ color: pc }} />
                          ) : (
                            <FileText className="h-6 w-6" style={{ color: pc }} />
                          )}
                        </div>
                        <span className="text-xs font-medium truncate w-full">{item.label}</span>
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Download className="h-3 w-3" />
                          {item.type === 'link' ? 'Abrir' : 'Descarregar'}
                        </span>
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Ainda sem entregáveis disponíveis.</p>
                );
              })()}
            </SectionCard>

            {/* Tasks - Table */}
            <SectionCard className="p-5">
              <p className="text-sm font-semibold mb-3">✅ Tarefas</p>
              {tasks.length > 0 ? (
                <div className="rounded-lg border border-border/30 overflow-hidden">
                  <div className="grid grid-cols-[1fr_120px] bg-muted/30 px-4 py-2.5 text-xs font-medium text-muted-foreground">
                    <span>Tarefa</span>
                    <span className="text-center">Estado</span>
                  </div>
                  {tasks.map((t: any, i: number) => (
                    <div key={t.id} className={`grid grid-cols-[1fr_120px] px-4 py-3 text-sm items-center ${i < tasks.length - 1 ? 'border-b border-border/20' : ''}`}>
                      <span className="truncate">{t.name}</span>
                      <div className="flex justify-center">
                        <Badge variant="outline" className={`text-[10px] ${
                          t.status === 'concluida' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          t.status === 'em_progresso' ? 'border-0 text-white' : ''
                        }`} style={t.status === 'em_progresso' ? { backgroundColor: pc } : undefined}>
                          {t.status === 'concluida' ? 'Concluída' : t.status === 'em_progresso' ? 'Em progresso' : t.status === 'pendente' ? 'Pendente' : t.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Ainda sem tarefas atribuídas.</p>
              )}
            </SectionCard>

            {/* FAQs - Accordion */}
            <SectionCard className="p-5">
              <p className="text-sm font-semibold mb-3">❓ Perguntas Frequentes</p>
              {faqs.length > 0 ? (
                <Accordion type="single" collapsible className="w-full">
                  {faqs.map((f: any) => (
                    <AccordionItem key={f.id} value={f.id} className="border-border/30">
                      <AccordionTrigger className="text-sm font-medium hover:no-underline py-4">{f.question}</AccordionTrigger>
                      <AccordionContent className="text-sm text-muted-foreground leading-relaxed pb-4">
                        {f.answer || 'Resposta em breve.'}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              ) : (
                <p className="text-sm text-muted-foreground">Ainda sem perguntas frequentes.</p>
              )}
            </SectionCard>
          </div>
        )}

        {/* ═══ CONTRACT ═══ */}
        {activeSection === 'contract' && (
          <div className="space-y-5">
            <SectionTitle icon={FileText}>Contrato</SectionTitle>
            {contractDocs.length === 0 ? (
              <SectionCard className="p-8 text-center">
                <FileText className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">Sem documentos de contrato disponíveis.</p>
              </SectionCard>
            ) : (
              <div className="space-y-3">
                {contractDocs.map((proj: any, pi: number) => {
                  const docs = Array.isArray(proj.contract_documents) ? proj.contract_documents : [];
                  return docs.map((doc: any, di: number) => (
                    <SectionCard key={`${pi}-${di}`} className="p-5">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="p-2.5 rounded-xl" style={{ backgroundColor: pcAlpha(0.08) }}>
                            <FileText className="h-5 w-5" style={{ color: pc }} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{doc.name || 'Contrato'}</p>
                            {proj.project_name && <p className="text-xs text-muted-foreground mt-0.5">{proj.project_name}</p>}
                          </div>
                        </div>
                        <Button size="sm" variant="outline" className="rounded-lg shrink-0" asChild>
                          <a href={doc.url} target="_blank" rel="noopener noreferrer">
                            <Download className="h-3.5 w-3.5 mr-1" />Abrir
                          </a>
                        </Button>
                      </div>
                    </SectionCard>
                  ));
                })}
              </div>
            )}
          </div>
        )}

        {/* ═══ MEETINGS ═══ */}
        {activeSection === 'meetings' && (
          <div className="space-y-5">
            <SectionTitle icon={CalendarDays}>Reuniões</SectionTitle>
            {meetings.length === 0 ? (
              <SectionCard className="p-8 text-center">
                <CalendarDays className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">Sem reuniões registadas.</p>
              </SectionCard>
            ) : (
              <div className="space-y-3">
                {meetings.map((m: any) => {
                  const isPending = m.status === 'por_organizar' || m.status === 'por_confirmar';
                  const ms = meetingStatus(m.status);
                  return (
                    <SectionCard key={m.id} className="p-5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-xl bg-muted/40 mt-0.5">
                            <CalendarDays className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="font-semibold text-sm">{m.title}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {m.date_time ? format(parseISO(m.date_time), "EEEE, d 'de' MMMM · HH:mm", { locale: pt }) : '—'}
                              {m.duration_minutes ? ` · ${m.duration_minutes} min` : ''}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 sm:shrink-0">
                          {m.meeting_url && (
                            <Button size="sm" variant="outline" className="h-8 text-xs rounded-lg" asChild>
                              <a href={m.meeting_url} target="_blank" rel="noopener noreferrer">Entrar</a>
                            </Button>
                          )}
                          {isPending ? (
                            <Button size="sm" className="h-8 text-xs rounded-lg text-white" style={{ backgroundColor: pc }}
                              onClick={async (e) => {
                                e.stopPropagation();
                                const { data, error } = await (supabase as any).rpc('portal_confirm_meeting', { _token: portalToken, _meeting_id: m.id });
                                if (error) { toast.error('Erro ao confirmar: ' + error.message); return; }
                                if (data) { setMeetings(prev => prev.map(x => x.id === m.id ? { ...x, status: 'confirmada' } : x)); toast.success('Presença confirmada ✨'); }
                                else toast.error('Não foi possível confirmar');
                              }}>
                              Confirmar
                            </Button>
                          ) : (
                            <Badge variant="outline" className={`text-[10px] ${ms.cls}`}>{ms.text}</Badge>
                          )}
                        </div>
                      </div>
                      {/* Notes section for pending meetings */}
                      {isPending && !m.portal_notes && (
                        <div className="mt-3 pt-3 border-t border-border/20">
                          <p className="text-[11px] text-muted-foreground mb-1.5">💡 Se este horário não te der jeito, sugere alternativas:</p>
                          <Textarea
                            id={`notes-${m.id}`}
                            className="text-xs rounded-lg border-border/30 bg-muted/10 min-h-[60px]"
                            placeholder="Ex: Prefiro terça ou quinta da semana seguinte, à tarde..."
                            defaultValue=""
                          />
                          <Button
                            size="sm"
                            className="mt-2 h-7 text-xs rounded-lg text-white"
                            style={{ backgroundColor: pc }}
                            onClick={async () => {
                              const el = document.getElementById(`notes-${m.id}`) as HTMLTextAreaElement;
                              const val = el?.value?.trim();
                              if (!val) { toast.error('Escreve uma sugestão primeiro'); return; }
                              await (supabase as any).rpc('portal_add_meeting_notes', { _token: portalToken, _meeting_id: m.id, _notes: val });
                              setMeetings(prev => prev.map(x => x.id === m.id ? { ...x, portal_notes: val } : x));
                              toast.success('Sugestão enviada ✓');
                            }}>
                            <Send className="h-3 w-3 mr-1" />Enviar sugestão
                          </Button>
                        </div>
                      )}
                      {isPending && m.portal_notes && (
                        <div className="mt-3 pt-3 border-t border-border/20">
                          <p className="text-[11px] text-muted-foreground">✅ Sugestão enviada:</p>
                          <p className="text-xs mt-1 bg-muted/20 rounded-lg p-2">{m.portal_notes}</p>
                        </div>
                      )}
                      {!isPending && m.portal_notes && (
                        <div className="mt-3 pt-3 border-t border-border/20">
                          <p className="text-[11px] text-muted-foreground">📝 As tuas notas:</p>
                          <p className="text-xs mt-1">{m.portal_notes}</p>
                        </div>
                      )}
                    </SectionCard>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ═══ PAYMENTS ═══ */}
        {activeSection === 'payments' && (
          <div className="space-y-5">
            <SectionTitle icon={CreditCard}>Pagamentos</SectionTitle>

            {payments.length === 0 ? (
              <SectionCard className="p-8 text-center">
                <CreditCard className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">Sem pagamentos registados.</p>
              </SectionCard>
            ) : (
              <div className="space-y-3">
                {payments.map((p: any) => {
                  const st = statusLabel(p.status);
                  const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
                  return (
                    <SectionCard
                      key={p.id}
                      className="p-5 cursor-pointer"
                      onClick={() => setSelectedPayment(p)}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className={`text-[10px] shrink-0 ${st.cls}`}>{st.text}</Badge>
                          <div>
                            <p className="text-sm font-medium">
                              {p.sale_month ? monthNames[p.sale_month - 1] : '—'}
                              {p.payment_date && <span className="text-muted-foreground font-normal"> · {format(parseISO(p.payment_date), "d MMM yyyy", { locale: pt })}</span>}
                            </p>
                            {p.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{p.description}</p>}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-bold" style={{ color: pc }}>
                            {typeof p.invoice_total === 'number' ? `${p.invoice_total.toFixed(2)} €` : '—'}
                          </span>
                          <ChevronRight className="h-4 w-4 text-muted-foreground/30" />
                        </div>
                      </div>
                    </SectionCard>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Payment detail dialog */}
        <Dialog open={!!selectedPayment} onOpenChange={() => setSelectedPayment(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base">Detalhe do Pagamento</DialogTitle>
            </DialogHeader>
            {selectedPayment && (() => {
              const p = selectedPayment;
              const st = statusLabel(p.status);
              const docs = Array.isArray(p.documents) ? p.documents : [];
              const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
              return (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className={`${st.cls}`}>{st.text}</Badge>
                    <span className="text-lg font-bold" style={{ color: pc }}>
                      {typeof p.invoice_total === 'number' ? `${p.invoice_total.toFixed(2)} €` : '—'}
                    </span>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between py-1.5 border-b border-border/20">
                      <span className="text-muted-foreground">Mês</span>
                      <span className="font-medium">{p.sale_month ? monthNames[p.sale_month - 1] : '—'}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-border/20">
                      <span className="text-muted-foreground">Data de pagamento</span>
                      <span className="font-medium">{p.payment_date ? format(parseISO(p.payment_date), "d 'de' MMMM yyyy", { locale: pt }) : '—'}</span>
                    </div>
                    {p.description && (
                      <div className="flex justify-between py-1.5 border-b border-border/20">
                        <span className="text-muted-foreground">Descrição</span>
                        <span className="font-medium text-right max-w-[200px]">{p.description}</span>
                      </div>
                    )}
                    {p.payment_method && (
                      <div className="flex justify-between py-1.5 border-b border-border/20">
                        <span className="text-muted-foreground">Método</span>
                        <span className="font-medium uppercase">{p.payment_method}</span>
                      </div>
                    )}
                  </div>
                  {docs.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-2">Documentos</p>
                      {docs.map((d: any, i: number) => (
                        <a key={i} href={d.url || d} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-2 text-sm hover:underline py-1" style={{ color: pc }}>
                          <Download className="h-3.5 w-3.5" />
                          {d.name || d.file_name || `Documento ${i + 1}`}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
          </DialogContent>
        </Dialog>

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
                      {nextStep.planned_end && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {format(parseISO(nextStep.planned_end), "d 'de' MMMM", { locale: pt })}
                        </span>
                      )}
                    </div>
                  </SectionCard>
                )}

                {/* Phase cards */}
                <div className="flex flex-wrap gap-3">
                  {onboarding.map((phase: any, i: number) => {
                    const dels = phase.deliverables || [];
                    const done = isPhaseComplete(phase);
                    const completedDels = dels.filter((d: any) => d.status === 'concluido' || d.status === 'concluida').length;
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
                          <div className="mt-2 flex items-center gap-1.5">
                            {done ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
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
          <div className="space-y-5">
            <SectionTitle icon={MessageSquare}>Feedback</SectionTitle>
            <SectionCard className="p-5 space-y-4">
              <Textarea
                className="rounded-xl border-border/40 bg-muted/10 focus-visible:ring-1"
                placeholder="Partilha o teu feedback connosco... 💬"
                value={feedbackText}
                onChange={e => setFeedbackText(e.target.value)}
                rows={4}
                style={{ '--tw-ring-color': pcAlpha(0.25) } as any}
              />
              <Button className="rounded-xl text-white" style={{ backgroundColor: pc }} disabled={!feedbackText.trim()} onClick={sendFeedback}>
                <Send className="h-4 w-4 mr-2" />Enviar Feedback
              </Button>
            </SectionCard>
            {feedback.length > 0 && (
              <SectionCard className="p-5">
                <p className="text-sm font-semibold mb-3">Feedback Anterior</p>
                <div className="space-y-3">
                  {feedback.map((f: any) => (
                    <div key={f.id} className="rounded-xl border border-border/30 bg-muted/10 p-4">
                      <p className="text-sm leading-relaxed">{f.content}</p>
                      <p className="text-xs text-muted-foreground mt-2">{format(parseISO(f.submitted_at), 'dd/MM/yyyy HH:mm')}</p>
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}
          </div>
        )}


        {/* ═══ HISTORY ═══ */}
        {activeSection === 'history' && (
          <div className="space-y-5">
            <SectionTitle icon={History}>Histórico de Projetos</SectionTitle>
            <p className="text-sm text-muted-foreground -mt-2">Projetos anteriores concluídos.</p>
            {projectHistory.map((h: any) => (
              <SectionCard key={h.id} className="p-5">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-semibold text-sm">{h.project_name}</p>
                  <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">Concluído</Badge>
                </div>
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mb-3">
                  {h.product_name && <span>🏷️ {h.product_name}</span>}
                  {h.start_date && <span>📅 Início: {h.start_date}</span>}
                  {h.end_date && <span>🏁 Fim: {h.end_date}</span>}
                </div>
                {Array.isArray(h.timeline_phases) && h.timeline_phases.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs font-semibold mb-2">Timeline</p>
                    <div className="space-y-1.5">
                      {h.timeline_phases.map((p: any, i: number) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          <div className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                            p.status === 'concluido' ? 'text-white' : p.status === 'em_curso' ? 'text-white' : 'bg-muted text-muted-foreground'
                          }`} style={p.status === 'concluido' || p.status === 'em_curso' ? { backgroundColor: pc } : undefined}>
                            {p.status === 'concluido' ? '✓' : i + 1}
                          </div>
                          <span className={p.status === 'concluido' ? 'text-muted-foreground line-through' : ''}>{p.title}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {Array.isArray(h.monthly_summaries) && h.monthly_summaries.length > 0 && (
                  <Accordion type="single" collapsible>
                    <AccordionItem value="summaries" className="border-border/30">
                      <AccordionTrigger className="text-xs hover:no-underline">Resumos Mensais ({h.monthly_summaries.length})</AccordionTrigger>
                      <AccordionContent className="space-y-2">
                        {h.monthly_summaries.map((s: any, i: number) => (
                          <div key={i} className="rounded-xl border border-border/30 bg-muted/10 p-3 text-xs">
                            <p className="font-semibold" style={{ color: pc }}>{s.month}/{s.year}</p>
                            <p className="text-muted-foreground whitespace-pre-wrap mt-1">{s.content}</p>
                          </div>
                        ))}
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                )}
                {h.notes && (
                  <div className="mt-3 rounded-xl bg-muted/20 p-3">
                    <p className="text-xs font-semibold mb-1">Notas</p>
                    <p className="text-xs text-muted-foreground">{h.notes}</p>
                  </div>
                )}
              </SectionCard>
            ))}
          </div>
        )}

      </main>
    </div>
  );
}
