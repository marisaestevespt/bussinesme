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
  FolderOpen, Download, ChevronRight, Sparkles, Upload, Briefcase
} from 'lucide-react';
import type { Portal } from '@/hooks/usePortalData';

const sb = (table: string) => supabase.from(table as any) as any;

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
  const [activeSection, setActiveSection] = useState('home');

  const [faqs, setFaqs] = useState<any[]>([]);
  const [questions, setQuestions] = useState<any[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [feedback, setFeedback] = useState<any[]>([]);
  const [meetings, setMeetings] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [onboarding, setOnboarding] = useState<any[]>([]);
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

  useEffect(() => { init(); }, [token]);

  const init = async () => {
    if (!token) return;
    const { data: portalData } = await sb('client_portals').select('*').eq('token', token).maybeSingle();
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
    const [clientCtxRes, settingsRes] = await Promise.all([
      (supabase as any).rpc('get_portal_client_context', { _token: token }),
      supabase.from('business_settings').select('*').limit(1).maybeSingle(),
    ]);
    const clientData = Array.isArray(clientCtxRes.data) ? clientCtxRes.data[0] : null;
    if (clientCtxRes.error || !clientData) { toast.error('Não foi possível carregar o portal.'); navigate(`/portal/${token}`, { replace: true }); return; }
    setClient(clientData);
    setSettings(settingsRes.data);
    const pid = portalData.id;
    const cid = portalData.client_id;
    const [faqsR, questionsR, commentsR, feedbackR, meetingsR, paymentsR, onbR, tasksR, phasesR, summR, historyR, materialsR, contractR] = await Promise.all([
      sb('portal_faqs').select('*').eq('portal_id', pid).order('sort_order'),
      sb('portal_initial_questions').select('*').eq('portal_id', pid).order('sort_order'),
      sb('portal_comments').select('*').eq('portal_id', pid).order('created_at', { ascending: true }),
      sb('portal_feedback').select('*').eq('portal_id', pid).order('submitted_at', { ascending: false }),
      (supabase as any).rpc('get_portal_meetings', { _token: token }),
      (supabase as any).rpc('get_portal_payments', { _token: token }),
      sb('client_onboarding').select('*').eq('client_id', cid).order('sort_order'),
      supabase.from('tasks').select('*').eq('visible_in_portal', true),
      sb('portal_timeline_phases').select('*').eq('portal_id', pid).order('sort_order'),
      
      (supabase as any).rpc('get_portal_project_history', { _token: token }),
      sb('portal_materials').select('*').eq('portal_id', pid).order('created_at', { ascending: false }),
      (supabase as any).rpc('get_portal_contract_documents', { _token: token }),
    ]);
    setFaqs(faqsR.data || []);
    setQuestions(questionsR.data || []);
    setComments(commentsR.data || []);
    setFeedback(feedbackR.data || []);
    setMeetings((meetingsR as any).data || []);
    setPayments((paymentsR as any).data || []);
    setOnboarding(onbR.data || []);
    setTasks((tasksR as any).data || []);
    setPhases(phasesR.data || []);
    setSummaries(summR.data || []);
    setProjectHistory((historyR as any).data || []);
    setPortalMaterials(materialsR.data || []);
    setContractDocs((contractR as any).data || []);
    setLoading(false);
  };

  const sendComment = async () => {
    if (!commentText.trim() || !portal) return;
    await sb('portal_comments').insert({ portal_id: portal.id, content: commentText.trim(), author: 'client', author_name: client?.full_name || 'Cliente' });
    setComments(prev => [...prev, { id: crypto.randomUUID(), portal_id: portal.id, content: commentText.trim(), author: 'client', author_name: client?.full_name || 'Cliente', created_at: new Date().toISOString() }]);
    setCommentText('');
  };

  const sendFeedback = async () => {
    if (!feedbackText.trim() || !portal) return;
    await sb('portal_feedback').insert({ portal_id: portal.id, content: feedbackText.trim() });
    toast.success('Feedback enviado! Obrigado. 💛');
    setFeedbackText('');
  };

  const answerQuestion = async (qId: string, answer: string) => {
    await sb('portal_initial_questions').update({ answer, answered_at: new Date().toISOString() }).eq('id', qId);
    setQuestions(prev => prev.map(q => q.id === qId ? { ...q, answer, answered_at: new Date().toISOString() } : q));
    toast.success('Resposta guardada ✨');
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
  const logoUrl = settings?.logo_url;
  const firstName = client.full_name?.split(' ')[0] || '';

  const navItems = [
    { key: 'home', label: 'Início', icon: Star, always: true },
    ...(portal.show_workspace ? [{ key: 'workspace', label: 'Espaço de Trabalho', icon: Briefcase }] : []),
    ...(contractDocs.length > 0 ? [{ key: 'contract', label: 'Contrato', icon: FileText }] : []),
    ...(portal.show_meetings ? [{ key: 'meetings', label: 'Reuniões', icon: CalendarDays }] : []),
    ...(portal.show_payments ? [{ key: 'payments', label: 'Pagamentos', icon: CreditCard }] : []),
    ...((portal as any).show_materials && portalMaterials.length > 0 ? [{ key: 'materials', label: 'Materiais', icon: FolderOpen }] : []),
    ...(projectHistory.length > 0 ? [{ key: 'history', label: 'Histórico', icon: History }] : []),
  ];

  const completedOnb = onboarding.filter((o: any) => o.completed).length;
  const totalOnb = onboarding.length;
  const onbPercent = totalOnb > 0 ? Math.round((completedOnb / totalOnb) * 100) : 0;

  const statusLabel = (s: string) => {
    const map: Record<string, { text: string; cls: string }> = {
      pago: { text: 'Pago', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
      em_falta: { text: 'Em falta', cls: 'bg-red-50 text-red-600 border-red-200' },
      pendente: { text: 'Pendente', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
      aguarda_pagamento: { text: 'Aguarda pagamento', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
      em_atraso: { text: 'Em atraso', cls: 'bg-red-50 text-red-600 border-red-200' },
    };
    return map[s] || { text: s, cls: '' };
  };

  const meetingStatus = (s: string) => {
    const map: Record<string, { text: string; cls: string }> = {
      confirmada: { text: 'Confirmada', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
      realizada: { text: 'Realizada', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
      cancelada: { text: 'Cancelada', cls: 'bg-red-50 text-red-600 border-red-200' },
    };
    return map[s] || { text: s, cls: '' };
  };

  // Current active phase for status display
  const activePhase = phases.find((p: any) => p.status === 'em_curso');
  const completedPhases = phases.filter((p: any) => p.status === 'concluido').length;
  const projectProgress = phases.length > 0 ? Math.round((completedPhases / phases.length) * 100) : 0;

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
                  .filter((m: any) => ['marcada', 'agendada', 'confirmada', 'por_confirmar'].includes(m.status) && m.date_time)
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
                const next = payments
                  .filter((p: any) => !['pago'].includes(p.status) && p.payment_date)
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

            {/* Quick action cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {portal.show_onboarding && onboarding.length > 0 && (
                <SectionCard className="p-5 cursor-pointer group" onClick={() => setActiveSection('onboarding')}>
                  <div className="flex items-start justify-between">
                    <div className="p-2.5 rounded-xl" style={{ backgroundColor: pcAlpha(0.1) }}>
                      <CheckSquare className="h-5 w-5" style={{ color: pc }} />
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                  <p className="font-semibold text-sm mt-3">Onboarding</p>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${onbPercent}%`, backgroundColor: pc }} />
                    </div>
                    <span className="text-xs font-medium text-muted-foreground">{onbPercent}%</span>
                  </div>
                </SectionCard>
              )}
            </div>

            {/* Inline initial questions — step-by-step */}
            {questions.length > 0 && (() => {
              const allAnswered = questions.every((q: any) => q.answer?.trim());
              const answeredCount = questions.filter((q: any) => q.answer?.trim()).length;
              const allSubmitted = allAnswered && !activeQuestionId;
              // Auto-open first unanswered on mount
              const firstUnanswered = questions.find((q: any) => !q.answer?.trim());
              const currentOpen = activeQuestionId || (allSubmitted ? null : firstUnanswered?.id || null);

              const handleSubmitAll = async () => {
                // Save any remaining drafts
                for (const [qId, text] of Object.entries(draftAnswers)) {
                  if (text.trim()) await answerQuestion(qId, text);
                }
                setDraftAnswers({});
                setActiveQuestionId(null);
                toast.success('Respostas submetidas!');
              };

              return (
                <div
                  className="rounded-2xl border-2 overflow-hidden transition-all"
                  style={{
                    borderColor: allSubmitted ? 'hsl(var(--border))' : pcAlpha(0.3),
                    boxShadow: allSubmitted ? 'none' : `0 4px 24px ${pcAlpha(0.08)}`,
                  }}
                >
                  {/* Header */}
                  <div
                    className="px-6 py-4 flex items-center justify-between"
                    style={{ backgroundColor: allSubmitted ? 'transparent' : pcAlpha(0.05) }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg" style={{ backgroundColor: allSubmitted ? 'hsl(var(--muted))' : pcAlpha(0.12) }}>
                        <ClipboardList className="h-4 w-4" style={{ color: allSubmitted ? 'hsl(var(--muted-foreground))' : pc }} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">Perguntas Iniciais</p>
                        <p className="text-xs text-muted-foreground">{answeredCount}/{questions.length} respondidas</p>
                      </div>
                    </div>
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

                  {/* Questions list */}
                  {!allSubmitted && (
                    <div className="bg-white divide-y divide-border/30">
                      {questions.map((q: any, i: number) => {
                        const isOpen = currentOpen === q.id;
                        const hasAnswer = q.answer?.trim() || draftAnswers[q.id]?.trim();
                        return (
                          <div key={q.id} className="transition-all">
                            {/* Question row — clickable to toggle */}
                            <button
                              className="w-full px-6 py-3.5 flex items-center gap-3 text-left hover:bg-muted/30 transition-colors"
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

                            {/* Answer area — only visible when open */}
                            {isOpen && (
                              <div className="px-6 pb-4 pl-[3.75rem]">
                                {q.answer?.trim() ? (
                                  <div className="space-y-2">
                                    <div className="rounded-xl bg-emerald-50/50 border border-emerald-100 p-3">
                                      <p className="text-sm">{q.answer}</p>
                                      {q.answered_at && <p className="text-[10px] text-muted-foreground mt-1">Respondida {format(parseISO(q.answered_at), 'dd/MM/yyyy')}</p>}
                                    </div>
                                    <Textarea
                                      className="text-sm rounded-xl border-border/40 bg-muted/10 focus-visible:ring-1"
                                      placeholder="Editar resposta..."
                                      defaultValue={q.answer}
                                      onChange={e => setDraftAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                                      rows={2}
                                      style={{ '--tw-ring-color': pcAlpha(0.25) } as any}
                                    />
                                  </div>
                                ) : (
                                  <Textarea
                                    className="text-sm rounded-xl border-border/40 bg-muted/10 focus-visible:ring-1"
                                    placeholder="A tua resposta..."
                                    value={draftAnswers[q.id] || ''}
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
                                      // Auto-advance to next unanswered
                                      const nextUnanswered = questions.find((qq: any) => qq.id !== q.id && !qq.answer?.trim());
                                      setActiveQuestionId(nextUnanswered?.id || null);
                                    }}
                                  >
                                    ✓ Guardar resposta
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {/* Submit all button */}
                      {allAnswered && (
                        <div className="px-6 py-4">
                          <Button
                            className="w-full rounded-xl text-white font-semibold"
                            style={{ backgroundColor: pc }}
                            onClick={handleSubmitAll}
                          >
                            <Send className="h-4 w-4 mr-2" />Submeter Respostas
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Monthly summaries on home for servico_mensal */}
            {portal.portal_type === 'servico_mensal' && portal.show_monthly_summary && summaries.length > 0 && (
              <SectionCard className="p-6">
                <SectionTitle icon={ClipboardList}>Resumos Mensais</SectionTitle>
                <div className="space-y-3">
                  {summaries.map((s: any) => (
                    <div key={s.id} className="rounded-xl border border-border/40 bg-muted/20 p-4">
                      <p className="font-semibold text-sm mb-1" style={{ color: pc }}>{s.month}/{s.year}</p>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{s.content}</p>
                    </div>
                  ))}
                </div>
              </SectionCard>
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

        {/* ═══ WORKSPACE ═══ */}
        {activeSection === 'workspace' && (
          <div className="space-y-5">
            <SectionTitle icon={Briefcase}>Espaço de Trabalho</SectionTitle>

            {/* Project phases / timeline */}
            <SectionCard className="p-6">
              <p className="text-sm font-semibold mb-4">📋 Fases do Projeto</p>
              {phases.length > 0 ? (
                <div className="space-y-0">
                  {phases.map((p: any, i: number) => {
                    const done = p.status === 'concluido';
                    const active = p.status === 'em_curso';
                    return (
                      <div key={p.id} className="flex items-center gap-4 relative">
                        {i < phases.length - 1 && (
                          <div className="absolute left-4 top-10 w-0.5 h-6" style={{ backgroundColor: done ? pcAlpha(0.25) : '#e5e5e5' }} />
                        )}
                        <div
                          className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all ${
                            done ? 'text-white' : active ? 'text-white ring-4 ring-opacity-20' : 'bg-muted text-muted-foreground'
                          }`}
                          style={done || active ? { backgroundColor: pc } : undefined}
                        >
                          {done ? '✓' : i + 1}
                        </div>
                        <div className="flex-1 py-3">
                          <p className={`text-sm font-medium ${done ? 'text-muted-foreground line-through' : ''}`}>{p.title}</p>
                        </div>
                        <Badge variant="outline" className={`text-[10px] ${
                          done ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          active ? 'text-white border-0' : ''
                        }`} style={active ? { backgroundColor: pc } : undefined}>
                          {done ? 'Concluído' : active ? 'Em curso' : 'Por começar'}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Ainda sem fases definidas. Em breve terás aqui o progresso do teu projeto.</p>
              )}
            </SectionCard>

            {/* Deliverables (documents & drive) */}
            <SectionCard className="p-6">
              <p className="text-sm font-semibold mb-3">📦 Entregáveis</p>
              {(client.documents || client.drive_folder_url) ? (
                <div className="space-y-2">
                  {client.documents && (
                    <a href={client.documents} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2.5 text-sm hover:underline rounded-lg p-2 -mx-2 hover:bg-muted/30 transition-colors"
                      style={{ color: pc }}>
                      <FileText className="h-3.5 w-3.5 shrink-0" />
                      Documentos
                    </a>
                  )}
                  {client.drive_folder_url && (
                    <a href={client.drive_folder_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2.5 text-sm hover:underline rounded-lg p-2 -mx-2 hover:bg-muted/30 transition-colors"
                      style={{ color: pc }}>
                      <FolderOpen className="h-3.5 w-3.5 shrink-0" />
                      Pasta Drive
                    </a>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Sem entregáveis disponíveis de momento.</p>
              )}
              {portalMaterials.length > 0 && (
                <div className="mt-4 space-y-2">
                  {portalMaterials.map((m: any) => (
                    <a key={m.id} href={m.file_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2.5 text-sm hover:underline rounded-lg p-2 -mx-2 hover:bg-muted/30 transition-colors"
                      style={{ color: pc }}>
                      <Download className="h-3.5 w-3.5 shrink-0" />
                      {m.file_name}
                    </a>
                  ))}
                </div>
              )}
            </SectionCard>

            {/* Tasks */}
            <SectionCard className="p-5">
              <p className="text-sm font-semibold mb-3">✅ Tarefas</p>
              {tasks.length > 0 ? (
                <div className="space-y-1">
                  {tasks.map((t: any) => (
                    <div key={t.id} className="flex items-center justify-between py-2.5 px-2 -mx-2 rounded-lg hover:bg-muted/20 transition-colors">
                      <span className="text-sm">{t.name}</span>
                      <Badge variant="outline" className="text-[10px]">{t.status}</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Ainda sem tarefas atribuídas.</p>
              )}
            </SectionCard>

            {/* FAQs inside workspace */}
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
                  const isPending = m.status === 'marcada' || m.status === 'por_confirmar';
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
                              onClick={async () => {
                                const { data } = await (supabase as any).rpc('portal_confirm_meeting', { _token: token, _meeting_id: m.id });
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
            <SectionTitle icon={CheckSquare}>Onboarding</SectionTitle>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${onbPercent}%`, backgroundColor: pc }} />
              </div>
              <span className="text-sm font-semibold" style={{ color: pc }}>{onbPercent}%</span>
            </div>
            <SectionCard className="overflow-hidden">
              {onboarding.map((o: any) => (
                <div key={o.id} className={`flex items-center gap-3 px-5 py-4 border-b border-border/20 last:border-0 transition-colors hover:bg-muted/10 ${o.completed ? 'opacity-50' : ''}`}>
                  <Checkbox checked={o.completed} onCheckedChange={async (v) => {
                    await sb('client_onboarding').update({ completed: !!v }).eq('id', o.id);
                    setOnboarding(prev => prev.map(x => x.id === o.id ? { ...x, completed: !!v } : x));
                  }} />
                  <span className={`text-sm ${o.completed ? 'line-through' : ''}`}>{o.activity}</span>
                </div>
              ))}
            </SectionCard>
          </div>
        )}

        {/* ═══ QUESTIONS ═══ */}
        {activeSection === 'questions' && (
          <div className="space-y-5">
            <SectionTitle icon={ClipboardList}>Perguntas Iniciais</SectionTitle>
            {questions.length === 0 ? (
              <SectionCard className="p-8 text-center">
                <p className="text-sm text-muted-foreground">Sem perguntas definidas.</p>
              </SectionCard>
            ) : questions.map((q: any) => (
              <SectionCard key={q.id} className="p-5 space-y-3">
                <p className="text-sm font-semibold">{q.question}</p>
                <Textarea
                  className="text-sm rounded-xl border-border/40 bg-muted/10 focus-visible:ring-1"
                  placeholder="A tua resposta..."
                  defaultValue={q.answer || ''}
                  onBlur={e => {
                    if (e.target.value !== (q.answer || '')) answerQuestion(q.id, e.target.value);
                  }}
                  rows={3}
                  style={{ '--tw-ring-color': pcAlpha(0.25) } as any}
                />
                {q.answered_at && <p className="text-xs text-muted-foreground">Respondida em {format(parseISO(q.answered_at), 'dd/MM/yyyy HH:mm')}</p>}
              </SectionCard>
            ))}
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

        {/* ═══ MATERIALS ═══ */}
        {activeSection === 'materials' && (
          <div className="space-y-5">
            <SectionTitle icon={FolderOpen}>Materiais</SectionTitle>
            <p className="text-sm text-muted-foreground -mt-2">Ficheiros partilhados pela equipa.</p>
            {portalMaterials.length === 0 ? (
              <SectionCard className="p-8 text-center">
                <p className="text-sm text-muted-foreground">Sem materiais disponíveis.</p>
              </SectionCard>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {portalMaterials.map((m: any) => (
                  <SectionCard key={m.id} className="p-5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2 rounded-xl" style={{ backgroundColor: pcAlpha(0.08) }}>
                          <FileText className="h-4 w-4" style={{ color: pc }} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{m.file_name}</p>
                          {m.description && <p className="text-xs text-muted-foreground mt-0.5">{m.description}</p>}
                        </div>
                      </div>
                      <Button size="sm" variant="outline" className="rounded-lg shrink-0" asChild>
                        <a href={m.file_url} target="_blank" rel="noopener noreferrer">
                          <Download className="h-3.5 w-3.5 mr-1" />Abrir
                        </a>
                      </Button>
                    </div>
                  </SectionCard>
                ))}
              </div>
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
