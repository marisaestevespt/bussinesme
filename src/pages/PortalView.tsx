import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';
import { FileText, CalendarDays, CreditCard, HelpCircle, CheckSquare, MessageSquare, Star, Send, ClipboardList, BarChart3, Clock } from 'lucide-react';
import type { Portal } from '@/hooks/usePortalData';

const sb = (table: string) => supabase.from(table as any) as any;

export default function PortalViewPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [portal, setPortal] = useState<Portal | null>(null);
  const [client, setClient] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState('home');

  // Data states
  const [faqs, setFaqs] = useState<any[]>([]);
  const [questions, setQuestions] = useState<any[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [feedback, setFeedback] = useState<any[]>([]);
  const [meetings, setMeetings] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [onboarding, setOnboarding] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [phases, setPhases] = useState<any[]>([]);
  const [summaries, setSummaries] = useState<any[]>([]);

  const [commentText, setCommentText] = useState('');
  const [feedbackText, setFeedbackText] = useState('');

  useEffect(() => {
    init();
  }, [token]);

  const init = async () => {
    if (!token) return;

    const { data: portalData } = await sb('client_portals').select('*').eq('token', token).maybeSingle();
    if (!portalData || !portalData.is_active) {
      navigate(`/portal/${token}`, { replace: true });
      return;
    }

    // Check session
    const session = localStorage.getItem(`portal_session_${portalData.id}`);
    if (!session) {
      navigate(`/portal/${token}`, { replace: true });
      return;
    }

    try {
      const parsed = JSON.parse(session);
      if (Date.now() - parsed.timestamp > 24 * 60 * 60 * 1000) {
        localStorage.removeItem(`portal_session_${portalData.id}`);
        navigate(`/portal/${token}`, { replace: true });
        return;
      }
    } catch {
      navigate(`/portal/${token}`, { replace: true });
      return;
    }

    setPortal(portalData);

    const [clientCtxRes, settingsRes] = await Promise.all([
      (supabase as any).rpc('get_portal_client_context', { _token: token }),
      supabase.from('business_settings').select('*').limit(1).maybeSingle(),
    ]);

    const clientData = Array.isArray(clientCtxRes.data) ? clientCtxRes.data[0] : null;

    if (clientCtxRes.error || !clientData) {
      toast.error('Não foi possível carregar o portal.');
      navigate(`/portal/${token}`, { replace: true });
      return;
    }

    setClient(clientData);
    setSettings(settingsRes.data);

    // Load all portal data in parallel
    const pid = portalData.id;
    const cid = portalData.client_id;
    const cname = clientData.full_name;

    const [faqsR, questionsR, commentsR, feedbackR, meetingsR, paymentsR, onbR, tasksR, phasesR, summR] = await Promise.all([
      sb('portal_faqs').select('*').eq('portal_id', pid).order('sort_order'),
      sb('portal_initial_questions').select('*').eq('portal_id', pid).order('sort_order'),
      sb('portal_comments').select('*').eq('portal_id', pid).order('created_at', { ascending: true }),
      sb('portal_feedback').select('*').eq('portal_id', pid).order('submitted_at', { ascending: false }),
      cname ? supabase.from('meetings').select('*').eq('client_name', cname).order('date_time', { ascending: false }) : { data: [] },
      (supabase as any).rpc('get_portal_payments', { _token: token }),
      sb('client_onboarding').select('*').eq('client_id', cid).order('sort_order'),
      supabase.from('tasks').select('*').eq('visible_in_portal', true),
      sb('portal_timeline_phases').select('*').eq('portal_id', pid).order('sort_order'),
      sb('portal_monthly_summaries').select('*').eq('portal_id', pid).order('year', { ascending: false }).order('month', { ascending: false }),
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
    setLoading(false);
  };

  const sendComment = async () => {
    if (!commentText.trim() || !portal) return;
    await sb('portal_comments').insert({
      portal_id: portal.id,
      content: commentText.trim(),
      author: 'client',
      author_name: client?.full_name || 'Cliente',
    });
    setComments(prev => [...prev, { id: crypto.randomUUID(), portal_id: portal.id, content: commentText.trim(), author: 'client', author_name: client?.full_name || 'Cliente', created_at: new Date().toISOString() }]);
    setCommentText('');
  };

  const sendFeedback = async () => {
    if (!feedbackText.trim() || !portal) return;
    await sb('portal_feedback').insert({ portal_id: portal.id, content: feedbackText.trim() });
    toast.success('Feedback enviado! Obrigado.');
    setFeedbackText('');
  };

  const answerQuestion = async (qId: string, answer: string) => {
    await sb('portal_initial_questions').update({ answer, answered_at: new Date().toISOString() }).eq('id', qId);
    setQuestions(prev => prev.map(q => q.id === qId ? { ...q, answer, answered_at: new Date().toISOString() } : q));
    toast.success('Resposta guardada');
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!portal || !client) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center space-y-4">
            <p className="text-sm text-muted-foreground">Não foi possível carregar os dados do portal.</p>
            <Button onClick={() => navigate(`/portal/${token}`, { replace: true })}>Voltar ao acesso</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const primaryColor = settings?.primary_color || 'hsl(var(--primary))';
  const logoUrl = settings?.logo_url;

  const navItems = [
    { key: 'home', label: 'Início', icon: Star, always: true },
    ...(portal.show_workspace ? [{ key: 'workspace', label: 'Espaço de Trabalho', icon: FileText, always: false }] : []),
    ...(portal.show_meetings ? [{ key: 'meetings', label: 'Reuniões', icon: CalendarDays, always: false }] : []),
    ...(portal.show_payments ? [{ key: 'payments', label: 'Pagamentos', icon: CreditCard, always: false }] : []),
    ...(portal.show_faqs ? [{ key: 'faqs', label: "FAQ's", icon: HelpCircle, always: false }] : []),
  ];

  const completedOnb = onboarding.filter((o: any) => o.completed).length;
  const totalOnb = onboarding.length;
  const onbPercent = totalOnb > 0 ? Math.round((completedOnb / totalOnb) * 100) : 0;

  const upcomingMeetings = meetings.filter((m: any) => m.status === 'agendada' || m.status === 'confirmada');
  const pastMeetings = meetings.filter((m: any) => m.status !== 'agendada' && m.status !== 'confirmada');

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b" style={{ backgroundColor: primaryColor }}>
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {logoUrl && <img src={logoUrl} alt="Logo" className="h-8 object-contain brightness-0 invert" />}
          </div>
          <p className="text-sm font-medium text-primary-foreground">{client.full_name}</p>
        </div>
      </header>

      <div className="max-w-6xl mx-auto flex">
        {/* Sidebar nav */}
        <nav className="w-56 shrink-0 border-r min-h-[calc(100vh-65px)] p-4 hidden md:flex md:flex-col md:justify-between">
          <div className="space-y-1">
            {navItems.map(item => (
              <button
                key={item.key}
                onClick={() => setActiveSection(item.key)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${activeSection === item.key ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:bg-muted'}`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </button>
            ))}
          </div>

          {(settings as any)?.support_hours && (
            <div className="border-t pt-4 mt-4">
              <div className="flex items-center gap-2 px-3 text-muted-foreground">
                <Clock className="h-4 w-4 shrink-0" />
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wide">Horário de atendimento</p>
                  <p className="text-xs font-medium text-foreground">{(settings as any).support_hours}</p>
                </div>
              </div>
            </div>
          )}
        </nav>

        {/* Main content */}
        <main className="flex-1 p-6 space-y-6">
          {/* Mobile nav */}
          <div className="flex gap-2 flex-wrap md:hidden">
            {navItems.map(item => (
              <Button key={item.key} variant={activeSection === item.key ? 'default' : 'outline'} size="sm" onClick={() => setActiveSection(item.key)}>
                {item.label}
              </Button>
            ))}
          </div>

          {activeSection === 'home' && (
            <>
              <div className="space-y-2">
                <h1 className="text-2xl font-bold">Bem-vinda, {client.full_name?.split(' ')[0]}!</h1>
                <p className="text-muted-foreground">Este é o teu espaço de acompanhamento.</p>
              </div>

              {/* Action cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {portal.show_onboarding && onboarding.length > 0 && (
                  <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveSection('onboarding')}>
                    <CardContent className="p-4 flex items-center gap-3">
                      <CheckSquare className="h-8 w-8 text-primary" />
                      <div>
                        <p className="font-medium text-sm">Onboarding</p>
                        <p className="text-xs text-muted-foreground">{onbPercent}% concluído</p>
                      </div>
                    </CardContent>
                  </Card>
                )}
                <Card className="cursor-pointer hover:shadow-md transition-shadow bg-primary/5 border-primary/20" onClick={() => setActiveSection('questions')}>
                  <CardContent className="p-4 flex items-center gap-3">
                    <ClipboardList className="h-8 w-8 text-primary" />
                    <div>
                      <p className="font-medium text-sm">Perguntas Iniciais</p>
                      <p className="text-xs text-muted-foreground">{questions.filter(q => q.answer).length}/{questions.length} respondidas</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="cursor-pointer hover:shadow-md transition-shadow bg-primary/5 border-primary/20" onClick={() => setActiveSection('feedback')}>
                  <CardContent className="p-4 flex items-center gap-3">
                    <MessageSquare className="h-8 w-8 text-primary" />
                    <div>
                      <p className="font-medium text-sm">Feedback</p>
                      <p className="text-xs text-muted-foreground">Partilha a tua opinião</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {portal.portal_type === 'projeto_unico' && portal.show_timeline && phases.length > 0 && (
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Timeline do Projeto</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {phases.map((p: any, i: number) => (
                        <div key={p.id} className="flex items-center gap-3">
                          <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold ${p.status === 'concluido' ? 'bg-green-500 text-white' : p.status === 'em_curso' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                            {i + 1}
                          </div>
                          <div className="flex-1">
                            <p className={`text-sm font-medium ${p.status === 'concluido' ? 'line-through text-muted-foreground' : ''}`}>{p.title}</p>
                          </div>
                          <Badge variant="outline" className="text-[10px]">
                            {p.status === 'concluido' ? 'Concluído' : p.status === 'em_curso' ? 'Em curso' : 'Por começar'}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {portal.portal_type === 'servico_mensal' && portal.show_monthly_summary && summaries.length > 0 && (
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Resumos Mensais</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    {summaries.map((s: any) => (
                      <div key={s.id} className="border rounded-md p-3">
                        <p className="font-medium text-sm mb-1">{s.month}/{s.year}</p>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{s.content}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Next meeting & next payment */}
              <div className="space-y-4">
                {portal.show_meetings && (() => {
                  const nextMeeting = meetings
                    .filter((m: any) => (m.status === 'agendada' || m.status === 'confirmada') && m.date_time)
                    .sort((a: any, b: any) => new Date(a.date_time).getTime() - new Date(b.date_time).getTime())[0];
                  return (
                    <Card className="cursor-pointer hover:shadow-md transition-shadow border-l-4 border-l-primary" onClick={() => setActiveSection('meetings')}>
                      <CardContent className="p-4 flex items-center gap-3">
                        <CalendarDays className="h-8 w-8 text-primary shrink-0" />
                        <div>
                          <p className="font-medium text-sm">Próxima Reunião</p>
                          <p className="text-xs text-muted-foreground">
                            {nextMeeting
                              ? format(parseISO(nextMeeting.date_time), "d 'de' MMMM, HH:mm", { locale: pt })
                              : 'Sem reuniões agendadas'}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })()}

                {portal.show_payments && (() => {
                  const nextPayment = payments
                    .filter((p: any) => p.status === 'pendente' && p.payment_date)
                    .sort((a: any, b: any) => new Date(a.payment_date).getTime() - new Date(b.payment_date).getTime())[0];
                  return (
                    <Card className="cursor-pointer hover:shadow-md transition-shadow border-l-4 border-l-primary" onClick={() => setActiveSection('payments')}>
                      <CardContent className="p-4 flex items-center gap-3">
                        <CreditCard className="h-8 w-8 text-primary shrink-0" />
                        <div>
                          <p className="font-medium text-sm">Próximo Pagamento</p>
                          <p className="text-xs text-muted-foreground">
                            {nextPayment
                              ? format(parseISO(nextPayment.payment_date), "d 'de' MMMM, yyyy", { locale: pt })
                              : 'Sem pagamentos pendentes'}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })()}
              </div>
            </>
          )}

          {activeSection === 'workspace' && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold">Espaço de Trabalho</h2>
              {client.documents && (
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Documentos</CardTitle></CardHeader>
                  <CardContent>
                    <a href={client.documents} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline">{client.documents}</a>
                  </CardContent>
                </Card>
              )}
              {client.drive_folder_url && (
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Pasta Drive</CardTitle></CardHeader>
                  <CardContent>
                    <a href={client.drive_folder_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline">Abrir pasta</a>
                  </CardContent>
                </Card>
              )}
              {tasks.length > 0 && (
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Tarefas</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {tasks.map((t: any) => (
                      <div key={t.id} className="flex items-center justify-between py-2 border-b last:border-0">
                        <span className="text-sm">{t.name}</span>
                        <Badge variant="outline" className="text-[10px]">{t.status}</Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {activeSection === 'meetings' && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold">Reuniões</h2>
              {upcomingMeetings.length > 0 && (
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Próximas Reuniões</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {upcomingMeetings.map((m: any) => (
                      <div key={m.id} className="flex items-center justify-between py-2 border-b last:border-0">
                        <div>
                          <p className="text-sm font-medium">{m.title}</p>
                          <p className="text-xs text-muted-foreground">{m.date_time ? format(parseISO(m.date_time), 'dd MMM yyyy, HH:mm', { locale: pt }) : '—'}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {m.meeting_url && (
                            <Button size="sm" variant="outline" asChild>
                              <a href={m.meeting_url} target="_blank" rel="noopener noreferrer">Entrar</a>
                            </Button>
                          )}
                          {m.status === 'agendada' && (
                            <Button size="sm" onClick={async () => {
                              await supabase.from('meetings').update({ status: 'confirmada' as any }).eq('id', m.id);
                              setMeetings(prev => prev.map(x => x.id === m.id ? { ...x, status: 'confirmada' } : x));
                              toast.success('Presença confirmada');
                            }}>Confirmar presença</Button>
                          )}
                          {m.status === 'confirmada' && <Badge className="bg-green-100 text-green-800">Confirmada</Badge>}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
              {pastMeetings.length > 0 && (
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Reuniões Passadas</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {pastMeetings.map((m: any) => (
                      <div key={m.id} className="flex items-center justify-between py-2 border-b last:border-0 opacity-60">
                        <div>
                          <p className="text-sm">{m.title}</p>
                          <p className="text-xs text-muted-foreground">{m.date_time ? format(parseISO(m.date_time), 'dd MMM yyyy, HH:mm', { locale: pt }) : '—'}</p>
                        </div>
                        <Badge variant="outline" className="text-[10px]">{m.status}</Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
              {meetings.length === 0 && <p className="text-sm text-muted-foreground">Sem reuniões registadas.</p>}
            </div>
          )}

          {activeSection === 'payments' && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold">Pagamentos</h2>
              <Card>
                <CardContent className="p-0">
                  <div className="bg-muted px-4 py-2 font-medium text-xs grid grid-cols-4 gap-2">
                    <span>Mês</span><span>Data</span><span>Documento</span><span>Status</span>
                  </div>
                  {payments.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8 text-sm">Sem pagamentos registados.</p>
                  ) : payments.map((p: any) => {
                    const docs = p.documents;
                    const docList = Array.isArray(docs) ? docs : [];
                    const monthNames = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
                    return (
                      <div key={p.id} className="px-4 py-2 text-sm grid grid-cols-4 gap-2 border-b items-center">
                        <span className="text-xs">{p.sale_month ? monthNames[p.sale_month - 1] : '—'}</span>
                        <span className="text-xs">{p.payment_date || '—'}</span>
                        <span className="text-xs">
                          {docList.length > 0 ? docList.map((d: any, i: number) => (
                            <a key={i} href={d.url || d} target="_blank" rel="noopener noreferrer" className="text-primary underline block truncate max-w-[160px]">
                              {d.name || d.file_name || `Documento ${i + 1}`}
                            </a>
                          )) : '—'}
                        </span>
                        <span>
                          <Badge variant="outline" className={`text-[10px] ${p.status === 'pago' ? 'bg-green-100 text-green-800' : p.status === 'em_falta' ? 'bg-red-100 text-red-800' : ''}`}>
                            {p.status === 'pago' ? 'Pago' : p.status === 'em_falta' ? 'Em falta' : p.status === 'pendente' ? 'Pendente' : p.status}
                          </Badge>
                        </span>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </div>
          )}

          {activeSection === 'faqs' && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold">Perguntas Frequentes</h2>
              {faqs.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem FAQ's disponíveis.</p>
              ) : (
                <Accordion type="single" collapsible className="w-full">
                  {faqs.map((f: any) => (
                    <AccordionItem key={f.id} value={f.id}>
                      <AccordionTrigger className="text-sm">{f.question}</AccordionTrigger>
                      <AccordionContent className="text-sm text-muted-foreground">
                        {f.answer || 'Resposta em breve.'}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              )}

            </div>
          )}

          {activeSection === 'onboarding' && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold">Onboarding</h2>
              <div className="flex items-center gap-3 mb-2">
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${onbPercent}%` }} />
                </div>
                <span className="text-sm font-medium">{onbPercent}%</span>
              </div>
              <Card>
                <CardContent className="p-0">
                  {onboarding.map((o: any) => (
                    <div key={o.id} className={`flex items-center gap-3 px-4 py-3 border-b last:border-0 ${o.completed ? 'opacity-60' : ''}`}>
                      <Checkbox checked={o.completed} onCheckedChange={async (v) => {
                        await sb('client_onboarding').update({ completed: !!v }).eq('id', o.id);
                        setOnboarding(prev => prev.map(x => x.id === o.id ? { ...x, completed: !!v } : x));
                      }} />
                      <span className={`text-sm ${o.completed ? 'line-through' : ''}`}>{o.activity}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          )}

          {activeSection === 'questions' && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold">Perguntas Iniciais</h2>
              {questions.map((q: any) => (
                <Card key={q.id}>
                  <CardContent className="p-4 space-y-2">
                    <p className="text-sm font-medium">{q.question}</p>
                    <Textarea
                      className="text-sm"
                      placeholder="A tua resposta..."
                      defaultValue={q.answer || ''}
                      onBlur={e => {
                        if (e.target.value !== (q.answer || '')) {
                          answerQuestion(q.id, e.target.value);
                        }
                      }}
                      rows={3}
                    />
                    {q.answered_at && <p className="text-xs text-muted-foreground">Respondida em {format(parseISO(q.answered_at), 'dd/MM/yyyy HH:mm')}</p>}
                  </CardContent>
                </Card>
              ))}
              {questions.length === 0 && <p className="text-sm text-muted-foreground">Sem perguntas definidas.</p>}
            </div>
          )}

          {activeSection === 'feedback' && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold">Feedback</h2>
              <Card>
                <CardContent className="p-4 space-y-3">
                  <Textarea
                    placeholder="Partilha o teu feedback connosco..."
                    value={feedbackText}
                    onChange={e => setFeedbackText(e.target.value)}
                    rows={4}
                  />
                  <Button disabled={!feedbackText.trim()} onClick={sendFeedback}>
                    <Send className="h-4 w-4 mr-2" />Enviar Feedback
                  </Button>
                </CardContent>
              </Card>
              {feedback.length > 0 && (
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Feedback Anterior</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {feedback.map((f: any) => (
                      <div key={f.id} className="border rounded p-2 text-sm">
                        <p>{f.content}</p>
                        <p className="text-xs text-muted-foreground mt-1">{format(parseISO(f.submitted_at), 'dd/MM/yyyy HH:mm')}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          )}

        </main>
      </div>
    </div>
  );
}
