import { useMemo, useState } from 'react';
import { BackNavigation } from '@/components/BackNavigation';
import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { useExecutiveData, SALES_ROUTINES, getMonthName } from '@/hooks/useExecutiveData';
import { usePlanningData, planStatusLabel, CADENCES } from '@/hooks/usePlanningData';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfWeek, endOfWeek, format, subDays, addDays, parseISO, differenceInDays, subWeeks, addWeeks } from 'date-fns';
import { useTeamData } from '@/hooks/useTeamData';
import { cn } from '@/lib/utils';
import { WeeklyAlignDetailSheet, type DetailField } from '@/components/executive/WeeklyAlignDetailSheet';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const MONTH_NAMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

export default function ExecutiveWeeklyAlign() {
  const now = new Date();
  const [weekOffset, setWeekOffset] = useState(0);

  const weekStart = useMemo(() => {
    const base = startOfWeek(now, { weekStartsOn: 1 });
    return weekOffset === 0 ? base : addWeeks(base, weekOffset);
  }, [weekOffset]);

  const weekEnd = useMemo(() => endOfWeek(weekStart, { weekStartsOn: 1 }), [weekStart]);
  const weekStartStr = format(weekStart, 'yyyy-MM-dd');
  const weekEndStr = format(weekEnd, 'yyyy-MM-dd');

  const currentYear = weekStart.getFullYear();
  const currentMonth = weekStart.getMonth() + 1;
  const monthStart = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
  const monthEnd = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${new Date(currentYear, currentMonth, 0).getDate()}`;

  const isCurrentWeek = weekOffset === 0;

  const exec = useExecutiveData(currentYear);
  const planning = usePlanningData(currentYear);

  // Detail sheet state
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailTitle, setDetailTitle] = useState('');
  const [detailSubtitle, setDetailSubtitle] = useState('');
  const [detailFields, setDetailFields] = useState<DetailField[]>([]);

  const openDetail = (title: string, subtitle: string, fields: DetailField[]) => {
    setDetailTitle(title);
    setDetailSubtitle(subtitle);
    setDetailFields(fields);
    setDetailOpen(true);
  };

  // Events this month
  const events = useQuery({
    queryKey: ['wa-events', currentMonth],
    queryFn: async () => {
      const { data } = await supabase.from('events').select('*').gte('start_date', monthStart).lte('start_date', monthEnd + 'T23:59:59').order('start_date');
      return data || [];
    },
  });

  // Sales this week
  const salesWeek = useQuery({
    queryKey: ['wa-sales-week', weekStartStr],
    queryFn: async () => {
      const { data } = await supabase.from('commercial_sales').select('*').gte('payment_date', weekStartStr).lte('payment_date', weekEndStr);
      return data || [];
    },
  });

  // Sales actions active
  const salesActions = useQuery({
    queryKey: ['wa-sales-actions'],
    queryFn: async () => {
      const { data } = await supabase.from('commercial_sales_actions').select('*').in('status', ['em_curso', 'por_comecar']).order('start_date');
      return data || [];
    },
  });

  // Monthly goals for billing
  const monthlyGoal = useQuery({
    queryKey: ['wa-monthly-goal', currentMonth, currentYear],
    queryFn: async () => {
      const { data } = await supabase.from('commercial_monthly_goals').select('*').eq('month', currentMonth).eq('year', currentYear).maybeSingle();
      return data;
    },
  });

  const monthSales = useQuery({
    queryKey: ['wa-month-sales', currentMonth, currentYear],
    queryFn: async () => {
      const { data } = await supabase.from('commercial_sales').select('invoice_total').eq('sale_month', currentMonth).eq('sale_year', currentYear);
      return data || [];
    },
  });

  const totalBilled = useMemo(() => (monthSales.data || []).reduce((s, v) => s + Number(v.invoice_total || 0), 0), [monthSales.data]);
  const billingGoal = monthlyGoal.data?.goal_amount || 0;
  const billingPct = billingGoal > 0 ? Math.round((totalBilled / billingGoal) * 100) : 0;

  // CRM leads
  const leads = useQuery({
    queryKey: ['wa-leads'],
    queryFn: async () => {
      const { data } = await supabase.from('crm_leads').select('*').not('status', 'in', '("ganho","perdido")').order('next_followup');
      return data || [];
    },
  });

  const todayStr = format(now, 'yyyy-MM-dd');
  const followUps = useMemo(() => (leads.data || []).filter(l => l.next_followup && l.next_followup <= todayStr), [leads.data, todayStr]);

  // Clients
  const clients = useQuery({
    queryKey: ['wa-clients'],
    queryFn: async () => {
      const { data } = await supabase.from('clients').select('*').order('start_date', { ascending: false });
      return data || [];
    },
  });

  const thirtyDaysAgo = format(subDays(now, 30), 'yyyy-MM-dd');
  const thirtyDaysAhead = format(addDays(now, 30), 'yyyy-MM-dd');
  const onboardingClients = useMemo(() => (clients.data || []).filter(c => c.start_date && c.start_date >= thirtyDaysAgo), [clients.data, thirtyDaysAgo]);
  const renewalClients = useMemo(() => (clients.data || []).filter(c => c.end_of_cycle && c.end_of_cycle <= thirtyDaysAhead && c.end_of_cycle >= todayStr), [clients.data, thirtyDaysAhead, todayStr]);

  // Projects active
  const projects = useQuery({
    queryKey: ['wa-projects'],
    queryFn: async () => {
      const { data } = await supabase.from('projects').select('*').in('status', ['em_curso', 'em_ideia', 'em_pausa']).order('deadline');
      return data || [];
    },
  });

  // Tasks this week
  const tasks = useQuery({
    queryKey: ['wa-tasks-week', weekStartStr],
    queryFn: async () => {
      const { data } = await supabase.from('tasks').select('*').gte('deadline', weekStartStr).lte('deadline', weekEndStr).order('deadline');
      return data || [];
    },
  });

  // Meetings this week
  const meetings = useQuery({
    queryKey: ['wa-meetings-week', weekStartStr],
    queryFn: async () => {
      const { data } = await supabase.from('events').select('*').gte('start_date', weekStartStr).lte('start_date', weekEndStr + 'T23:59:59').order('start_date');
      return data || [];
    },
  });

  // Content this week
  const contents = useQuery({
    queryKey: ['wa-content-week', weekStartStr],
    queryFn: async () => {
      const { data } = await supabase.from('content_items').select('*').gte('scheduled_at', weekStartStr).lte('scheduled_at', weekEndStr + 'T23:59:59').order('scheduled_at');
      return data || [];
    },
  });

  // NPS records this week & overdue
  const npsWeek = useQuery({
    queryKey: ['wa-nps-week', weekStartStr, weekEndStr],
    queryFn: async () => {
      const { data } = await supabase.from('client_nps_records').select('*, clients!client_nps_records_client_id_fkey(full_name, current_product)').gte('expected_date', weekStartStr).lte('expected_date', weekEndStr).order('expected_date');
      return (data || []) as any[];
    },
  });

  const npsOverdue = useQuery({
    queryKey: ['wa-nps-overdue', weekStartStr],
    queryFn: async () => {
      const { data } = await supabase.from('client_nps_records').select('*, clients!client_nps_records_client_id_fkey(full_name, current_product)').lt('expected_date', weekStartStr).neq('status', 'feito').order('expected_date');
      return (data || []) as any[];
    },
  });

  // Milestones this week
  const milestonesWeek = useQuery({
    queryKey: ['wa-milestones-week', weekStartStr, weekEndStr],
    queryFn: async () => {
      const { data } = await supabase.from('client_milestones').select('*, clients!client_milestones_client_id_fkey(full_name, current_product)').gte('expected_date', weekStartStr).lte('expected_date', weekEndStr).order('expected_date');
      return (data || []) as any[];
    },
  });

  const { members } = useTeamData();
  const teamMembers = members.data || [];
  const getMemberName = (id: string | null) => {
    if (!id) return '—';
    return teamMembers.find((t: any) => t.id === id)?.full_name || '—';
  };

  const overdueCount = (npsOverdue.data || []).length;

  const getNpsRowColor = (expectedDate: string, status: string) => {
    if (status === 'feito') return 'bg-emerald-50 border-l-4 border-l-emerald-500';
    const diff = differenceInDays(parseISO(expectedDate), now);
    if (diff < 0) return 'bg-red-50 border-l-4 border-l-red-500';
    return 'bg-amber-50 border-l-4 border-l-amber-500';
  };

  const autoNpsStatus = (expectedDate: string, currentStatus: string) => {
    if (currentStatus === 'feito') return 'feito';
    if (differenceInDays(parseISO(expectedDate), now) < 0) return 'em_atraso';
    return 'por_fazer';
  };

  const MILESTONE_TYPE_LABELS: Record<string, string> = {
    check_in: 'Check-in', feedback: 'Recolha de Feedback', reuniao: 'Reunião', email: 'Email', outro: 'Outro',
  };

  const routineMap = Object.fromEntries((exec.weeklyRoutines.data || []).map(r => [r.routine_key, r.completed]));

  // --- Detail openers for each section ---
  const openGoalDetail = (g: any) => {
    const obj = planning.allObjectives.find((o: any) => o.id === g.objective_id);
    openDetail(g.period || 'Meta', 'Meta', [
      { label: 'Objetivo Anual', value: obj?.title },
      { label: 'Período', value: g.period },
      { label: 'Status', value: planStatusLabel(g.status), badge: true, badgeVariant: g.status === 'atingido' ? 'default' : 'secondary' },
      { label: 'Valor alvo', value: g.target_value },
      { label: 'Valor real', value: g.actual_value },
      { label: 'Desvio', value: g.actual_value && g.target_value ? String(Number(g.actual_value) - Number(g.target_value)) : null },
    ]);
  };

  const openEventDetail = (e: any) => openDetail(e.title, 'Evento', [
    { label: 'Data início', value: e.start_date?.slice(0, 10) },
    { label: 'Data fim', value: e.end_date?.slice(0, 10) },
    { label: 'Departamento', value: e.department },
    { label: 'Cliente', value: e.client_name },
    { label: 'Produto', value: e.product_name },
    { label: 'URL reunião', value: e.meeting_url },
    { label: 'Notas', value: e.notes },
  ]);

  const openSaleDetail = (s: any) => openDetail(`Venda ${s.sale_id}`, s.client || 'Venda', [
    { label: 'Status', value: s.status, badge: true },
    { label: 'Cliente', value: s.client },
    { label: 'Produto', value: s.product },
    { label: 'Valor base', value: s.base_value ? `€${Number(s.base_value).toLocaleString()}` : null },
    { label: 'Total fatura', value: `€${Number(s.invoice_total).toLocaleString()}` },
    { label: 'Data pagamento', value: s.payment_date },
    { label: 'Origem', value: s.source },
    { label: 'Descrição', value: s.description },
  ]);

  const openSaleActionDetail = (a: any) => openDetail(a.action_name, 'Ação de venda', [
    { label: 'Status', value: a.status, badge: true },
    { label: 'Tipo', value: a.action_type },
    { label: 'Produto', value: a.product },
    { label: 'Objetivo', value: a.objective },
    { label: 'Data início', value: a.start_date },
    { label: 'Data fim', value: a.end_date },
    { label: 'Resultado', value: a.result },
  ]);

  const openLeadDetail = (l: any) => openDetail(l.name, 'Lead', [
    { label: 'Status', value: l.status, badge: true },
    { label: 'Valor estimado', value: l.estimated_value ? `€${Number(l.estimated_value).toLocaleString()}` : null },
    { label: 'Telefone', value: l.phone },
    { label: 'Email', value: l.email },
    { label: 'Origem', value: l.source },
    { label: 'Produto potencial', value: l.potential_product },
    { label: 'Contexto', value: l.context },
    { label: 'Próximo follow-up', value: l.next_followup },
    { label: 'Notas follow-up', value: l.followup_notes },
    { label: 'Data entrada', value: l.added_at },
    { label: 'Documentos', value: l.documents },
  ]);

  const openClientDetail = (c: any) => openDetail(c.full_name, 'Cliente', [
    { label: 'ID', value: c.client_id },
    { label: 'Status', value: c.status, badge: true },
    { label: 'Email', value: c.email },
    { label: 'Whatsapp', value: c.whatsapp },
    { label: 'Produto atual', value: c.current_product },
    { label: 'Data início', value: c.start_date },
    { label: 'Fim de ciclo', value: c.end_of_cycle },
    { label: 'NIF', value: c.nif },
    { label: 'Morada fiscal', value: c.fiscal_address },
    { label: 'Observações', value: c.observations },
    { label: 'Link Drive', value: c.drive_folder_url },
  ]);

  const openNpsDetail = (r: any) => {
    const status = autoNpsStatus(r.expected_date, r.status);
    openDetail(r.clients?.full_name || 'NPS', 'Recolha NPS', [
      { label: 'Cliente', value: r.clients?.full_name },
      { label: 'Produto', value: r.clients?.current_product },
      { label: 'Data prevista', value: format(parseISO(r.expected_date), 'dd/MM/yyyy') },
      { label: 'Status', value: status === 'feito' ? 'Feito' : status === 'em_atraso' ? 'Em atraso' : 'Por fazer', badge: true, badgeVariant: status === 'feito' ? 'default' : status === 'em_atraso' ? 'destructive' : 'secondary' },
      { label: 'Score NPS', value: r.nps_score },
      { label: 'Data real', value: r.actual_date },
      { label: 'Notas', value: r.notes },
    ]);
  };

  const openMilestoneDetail = (m: any) => {
    const status = autoNpsStatus(m.expected_date, m.status);
    openDetail(m.milestone || 'Marco', 'Marco de acompanhamento', [
      { label: 'Cliente', value: m.clients?.full_name },
      { label: 'Produto', value: m.clients?.current_product },
      { label: 'Marco', value: m.milestone },
      { label: 'Tipo', value: MILESTONE_TYPE_LABELS[m.milestone_type] || m.milestone_type },
      { label: 'Data prevista', value: format(parseISO(m.expected_date), 'dd/MM/yyyy') },
      { label: 'Responsável', value: getMemberName(m.responsible_id) },
      { label: 'Status', value: status === 'feito' ? 'Feito' : status === 'em_atraso' ? 'Em atraso' : 'Por fazer', badge: true, badgeVariant: status === 'feito' ? 'default' : status === 'em_atraso' ? 'destructive' : 'secondary' },
      { label: 'Notas', value: m.notes },
    ]);
  };

  const openProjectDetail = (p: any) => openDetail(p.name, 'Projeto', [
    { label: 'Status', value: p.status, badge: true },
    { label: 'Departamento', value: p.department },
    { label: 'Deadline', value: p.deadline },
    { label: 'Descrição', value: p.description },
    { label: 'Responsável', value: p.responsible },
  ]);

  const openTaskDetail = (t: any) => openDetail(t.name, 'Tarefa', [
    { label: 'Status', value: t.status, badge: true },
    { label: 'Deadline', value: t.deadline },
    { label: 'Departamento', value: t.department },
    { label: 'Descrição', value: t.description },
    { label: 'Prioridade', value: t.priority },
  ]);

  const openMeetingDetail = (m: any) => openDetail(m.title, 'Reunião', [
    { label: 'Data início', value: m.start_date?.slice(0, 16)?.replace('T', ' ') },
    { label: 'Data fim', value: m.end_date?.slice(0, 16)?.replace('T', ' ') },
    { label: 'Departamento', value: m.department },
    { label: 'Cliente', value: m.client_name },
    { label: 'Produto', value: m.product_name },
    { label: 'URL reunião', value: m.meeting_url },
    { label: 'Notas', value: m.notes },
  ]);

  const openContentDetail = (c: any) => openDetail(c.title, 'Conteúdo', [
    { label: 'Status', value: c.status, badge: true },
    { label: 'Formato', value: c.format },
    { label: 'Tipo', value: c.content_type },
    { label: 'Fase do funil', value: c.funnel_stage },
    { label: 'Produto', value: c.product_name },
    { label: 'Objetivo', value: c.objective },
    { label: 'Data agendada', value: c.scheduled_at?.slice(0, 10) },
    { label: 'Copy', value: c.copy_content },
  ]);

  const clickableRow = "cursor-pointer hover:bg-muted/70 transition-colors";

  return (
    <AppLayout>
      <div className="space-y-8">
        <BackNavigation />
        <PageHeader title="Weekly Align" subtitle={`Semana ${format(weekStart, 'dd/MM')} — ${format(weekEnd, 'dd/MM/yyyy')}`} />

        {/* Week navigation */}
        <div className="flex items-center justify-center gap-4 -mt-4">
          <Button variant="outline" size="icon" onClick={() => setWeekOffset(w => w - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium">
            {format(weekStart, 'dd/MM')} — {format(weekEnd, 'dd/MM/yyyy')}
          </span>
          <Button variant="outline" size="icon" onClick={() => setWeekOffset(w => w + 1)} disabled={weekOffset >= 0}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          {!isCurrentWeek && (
            <Button variant="ghost" size="sm" onClick={() => setWeekOffset(0)} className="text-xs">
              Semana atual
            </Button>
          )}
        </div>
        {!isCurrentWeek && (
          <p className="text-xs text-muted-foreground text-center -mt-2">Dados de semanas anteriores são apenas de leitura.</p>
        )}

        {/* 1 // Metas */}
        <section className="space-y-4">
          <h2 className="text-base font-semibold">1 // Metas</h2>
          <Tabs defaultValue="metas">
            <TabsList><TabsTrigger value="metas">Metas do mês</TabsTrigger><TabsTrigger value="metricas_atraso">Métricas em atraso</TabsTrigger><TabsTrigger value="agenda">Agenda do mês</TabsTrigger></TabsList>
            <TabsContent value="metas">
              {(() => {
                const currentMonthName = MONTH_NAMES[currentMonth - 1];
                const monthPlanGoals = planning.allGoals.filter((g: any) => g.period === currentMonthName);
                return (
                  <Card><div className="overflow-x-auto">
                    <Table>
                      <TableHeader><TableRow>
                        <TableHead>Objetivo Anual</TableHead><TableHead>Período</TableHead><TableHead>Valor alvo</TableHead><TableHead>Valor real</TableHead><TableHead>Desvio</TableHead><TableHead>Status</TableHead>
                      </TableRow></TableHeader>
                      <TableBody>
                        {monthPlanGoals.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground text-sm py-6">Sem metas este mês</TableCell></TableRow> :
                          monthPlanGoals.map((g: any) => {
                            const obj = planning.allObjectives.find((o: any) => o.id === g.objective_id);
                            const dev = g.actual_value && g.target_value ? (Number(g.actual_value) - Number(g.target_value)) : null;
                            return (
                              <TableRow key={g.id} className={clickableRow} onClick={() => openGoalDetail(g)}>
                                <TableCell className="text-xs">{obj?.title || '—'}</TableCell>
                                <TableCell className="text-sm">{g.period}</TableCell>
                                <TableCell className="text-xs">{g.target_value || '—'}</TableCell>
                                <TableCell className="text-xs">{g.actual_value || '—'}</TableCell>
                                <TableCell className={`text-xs ${dev !== null && dev < 0 ? 'text-destructive font-medium' : ''}`}>{dev != null ? (dev >= 0 ? `+${dev}` : dev) : '—'}</TableCell>
                                <TableCell><Badge variant={g.status === 'atingido' ? 'default' : 'secondary'} className="text-[10px]">{planStatusLabel(g.status)}</Badge></TableCell>
                              </TableRow>
                            );
                          })
                        }
                      </TableBody>
                    </Table>
                  </div></Card>
                );
              })()}
            </TabsContent>
            <TabsContent value="metricas_atraso">
              {(() => {
                const overdueMetrics = planning.allMetrics.filter((m: any) => planning.isMetricOverdue(m));
                const getDaysOverdue = (m: any) => {
                  if (!m.last_updated_at) return '—';
                  return Math.floor((new Date().getTime() - new Date(m.last_updated_at).getTime()) / (1000 * 60 * 60 * 24));
                };
                return (
                  <Card><div className="overflow-x-auto">
                    <Table>
                      <TableHeader><TableRow>
                        <TableHead>Objetivo</TableHead><TableHead>Métrica</TableHead><TableHead>Última atualização</TableHead><TableHead>Dias em atraso</TableHead>
                      </TableRow></TableHeader>
                      <TableBody>
                        {overdueMetrics.length === 0 ? <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground text-sm py-6">Sem métricas em atraso</TableCell></TableRow> :
                          overdueMetrics.map((m: any) => {
                            const obj = planning.allObjectives.find((o: any) => o.id === m.objective_id);
                            return (
                              <TableRow key={m.id} className="bg-red-50">
                                <TableCell className="text-xs">{obj?.title || '—'}</TableCell>
                                <TableCell className="text-sm font-medium">{m.name}</TableCell>
                                <TableCell className="text-xs">{m.last_updated_at ? new Date(m.last_updated_at).toLocaleDateString('pt-PT') : 'Nunca'}</TableCell>
                                <TableCell className="text-xs text-destructive font-medium">{getDaysOverdue(m)} dias</TableCell>
                              </TableRow>
                            );
                          })
                        }
                      </TableBody>
                    </Table>
                  </div></Card>
                );
              })()}
            </TabsContent>
            <TabsContent value="agenda">
              <Card><div className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Evento</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {(events.data || []).length === 0 ? <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground text-sm py-6">Sem eventos</TableCell></TableRow> :
                      (events.data || []).map(e => (
                        <TableRow key={e.id} className={clickableRow} onClick={() => openEventDetail(e)}>
                          <TableCell className="text-xs">{e.start_date?.slice(0, 10)}</TableCell><TableCell className="text-sm">{e.title}</TableCell>
                        </TableRow>
                      ))
                    }
                  </TableBody>
                </Table>
              </div></Card>
            </TabsContent>
          </Tabs>
        </section>

        <Separator />

        {/* 2 // Vendas & Faturação */}
        <section className="space-y-4">
          <h2 className="text-base font-semibold">2 // Vendas & Faturação</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Card><CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-medium">Status faturação — {getMonthName(currentMonth)}</h3>
              <div className="text-xs text-muted-foreground space-y-1">
                <p>Meta: €{billingGoal.toLocaleString()} | Até agora: €{totalBilled.toLocaleString()}</p>
                <p>Progresso: {billingPct}% — Faturado: €{totalBilled.toLocaleString()} de €{billingGoal.toLocaleString()}</p>
              </div>
            </CardContent></Card>

            <Card><CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-medium">Rotinas de Vendas</h3>
              {SALES_ROUTINES.map(r => (
                <div key={r.key} className="flex items-center gap-2">
                  <Checkbox checked={!!routineMap[r.key]} onCheckedChange={v => exec.toggleRoutine.mutate({ routineKey: r.key, completed: !!v })} />
                  <span className={`text-sm ${routineMap[r.key] ? 'line-through text-muted-foreground' : ''}`}>{r.label}</span>
                </div>
              ))}
            </CardContent></Card>
          </div>

          <Card><CardContent className="p-4">
            <h3 className="text-sm font-medium mb-2">Vendas esta semana</h3>
            {(salesWeek.data || []).length === 0 ? <p className="text-xs text-muted-foreground">Sem vendas esta semana</p> :
              <Table><TableHeader><TableRow><TableHead>ID</TableHead><TableHead>Cliente</TableHead><TableHead>Produto</TableHead><TableHead>Total</TableHead></TableRow></TableHeader>
                <TableBody>{(salesWeek.data || []).map(s => (
                  <TableRow key={s.id} className={clickableRow} onClick={() => openSaleDetail(s)}>
                    <TableCell className="text-xs">{s.sale_id}</TableCell><TableCell className="text-xs">{s.client}</TableCell><TableCell className="text-xs">{s.product}</TableCell><TableCell className="text-xs">€{Number(s.invoice_total).toLocaleString()}</TableCell>
                  </TableRow>
                ))}</TableBody>
              </Table>
            }
          </CardContent></Card>

          <Card><CardContent className="p-4">
            <h3 className="text-sm font-medium mb-2">Ações de venda</h3>
            {(salesActions.data || []).length === 0 ? <p className="text-xs text-muted-foreground">Sem ações ativas</p> :
              <Table><TableHeader><TableRow><TableHead>Ação</TableHead><TableHead>Tipo</TableHead><TableHead>Status</TableHead><TableHead>Produto</TableHead></TableRow></TableHeader>
                <TableBody>{(salesActions.data || []).map(a => (
                  <TableRow key={a.id} className={clickableRow} onClick={() => openSaleActionDetail(a)}>
                    <TableCell className="text-xs">{a.action_name}</TableCell><TableCell className="text-xs">{a.action_type}</TableCell><TableCell><Badge variant="secondary" className="text-[10px]">{a.status}</Badge></TableCell><TableCell className="text-xs">{a.product}</TableCell>
                  </TableRow>
                ))}</TableBody>
              </Table>
            }
          </CardContent></Card>
        </section>

        <Separator />

        {/* 3 // Leads & Oportunidades */}
        <section className="space-y-4">
          <h2 className="text-base font-semibold">3 // Leads & Oportunidades</h2>
          <Tabs defaultValue="aberto">
            <TabsList><TabsTrigger value="aberto">Leads em aberto</TabsTrigger><TabsTrigger value="followups">Follow-ups a fazer</TabsTrigger></TabsList>
            <TabsContent value="aberto">
              <Card><div className="overflow-x-auto">
                <Table><TableHeader><TableRow>
                  <TableHead>Nome</TableHead><TableHead>Status</TableHead><TableHead>Valor</TableHead><TableHead>Telefone</TableHead><TableHead>Email</TableHead><TableHead>Próx. FU</TableHead><TableHead>Notas FU</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {(leads.data || []).length === 0 ? <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground text-sm py-6">Sem leads</TableCell></TableRow> :
                    (leads.data || []).map(l => (
                      <TableRow key={l.id} className={clickableRow} onClick={() => openLeadDetail(l)}>
                        <TableCell className="text-sm font-medium">{l.name}</TableCell>
                        <TableCell><Badge variant="secondary" className="text-[10px]">{l.status}</Badge></TableCell>
                        <TableCell className="text-xs">{l.estimated_value ? `€${Number(l.estimated_value).toLocaleString()}` : '—'}</TableCell>
                        <TableCell className="text-xs">{l.phone || '—'}</TableCell>
                        <TableCell className="text-xs">{l.email || '—'}</TableCell>
                        <TableCell className="text-xs">{l.next_followup || '—'}</TableCell>
                        <TableCell className="text-xs max-w-[150px] truncate">{l.followup_notes || '—'}</TableCell>
                      </TableRow>
                    ))
                  }
                </TableBody></Table>
              </div></Card>
            </TabsContent>
            <TabsContent value="followups">
              <Card><div className="overflow-x-auto">
                <Table><TableHeader><TableRow>
                  <TableHead>Nome</TableHead><TableHead>Status</TableHead><TableHead>Valor</TableHead><TableHead>Telefone</TableHead><TableHead>Email</TableHead><TableHead>Próx. FU</TableHead><TableHead>Notas FU</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {followUps.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground text-sm py-6">Sem follow-ups pendentes</TableCell></TableRow> :
                    followUps.map(l => (
                      <TableRow key={l.id} className={clickableRow} onClick={() => openLeadDetail(l)}>
                        <TableCell className="text-sm font-medium">{l.name}</TableCell>
                        <TableCell><Badge variant="secondary" className="text-[10px]">{l.status}</Badge></TableCell>
                        <TableCell className="text-xs">{l.estimated_value ? `€${Number(l.estimated_value).toLocaleString()}` : '—'}</TableCell>
                        <TableCell className="text-xs">{l.phone || '—'}</TableCell>
                        <TableCell className="text-xs">{l.email || '—'}</TableCell>
                        <TableCell className="text-xs">{l.next_followup || '—'}</TableCell>
                        <TableCell className="text-xs max-w-[150px] truncate">{l.followup_notes || '—'}</TableCell>
                      </TableRow>
                    ))
                  }
                </TableBody></Table>
              </div></Card>
            </TabsContent>
          </Tabs>
        </section>

        <Separator />

        {/* 4 // Clientes */}
        <section className="space-y-4">
          <h2 className="text-base font-semibold">4 // Clientes</h2>
          <Tabs defaultValue="onboarding">
            <TabsList><TabsTrigger value="onboarding">Em onboarding</TabsTrigger><TabsTrigger value="renovacoes">Próximas renovações</TabsTrigger></TabsList>
            <TabsContent value="onboarding">
              <Card><div className="overflow-x-auto">
                <Table><TableHeader><TableRow>
                  <TableHead>ID</TableHead><TableHead>Início</TableHead><TableHead>Status</TableHead><TableHead>Nome</TableHead><TableHead>Email</TableHead><TableHead>Whatsapp</TableHead><TableHead>Produto</TableHead><TableHead>Fim Ciclo</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {onboardingClients.length === 0 ? <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground text-sm py-6">Nenhum</TableCell></TableRow> :
                    onboardingClients.map(c => (
                      <TableRow key={c.id} className={clickableRow} onClick={() => openClientDetail(c)}>
                        <TableCell className="text-xs">{c.client_id}</TableCell>
                        <TableCell className="text-xs">{c.start_date || '—'}</TableCell>
                        <TableCell><Badge variant="secondary" className="text-[10px]">{c.status}</Badge></TableCell>
                        <TableCell className="text-sm">{c.full_name}</TableCell>
                        <TableCell className="text-xs">{c.email || '—'}</TableCell>
                        <TableCell className="text-xs">{c.whatsapp || '—'}</TableCell>
                        <TableCell className="text-xs">{c.current_product || '—'}</TableCell>
                        <TableCell className="text-xs">{c.end_of_cycle || '—'}</TableCell>
                      </TableRow>
                    ))
                  }
                </TableBody></Table>
              </div></Card>
            </TabsContent>
            <TabsContent value="renovacoes">
              <Card><div className="overflow-x-auto">
                <Table><TableHeader><TableRow>
                  <TableHead>ID</TableHead><TableHead>Início</TableHead><TableHead>Status</TableHead><TableHead>Nome</TableHead><TableHead>Email</TableHead><TableHead>Whatsapp</TableHead><TableHead>Produto</TableHead><TableHead>Fim Ciclo</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {renewalClients.length === 0 ? <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground text-sm py-6">Nenhum</TableCell></TableRow> :
                    renewalClients.map(c => (
                      <TableRow key={c.id} className={clickableRow} onClick={() => openClientDetail(c)}>
                        <TableCell className="text-xs">{c.client_id}</TableCell>
                        <TableCell className="text-xs">{c.start_date || '—'}</TableCell>
                        <TableCell><Badge variant="secondary" className="text-[10px]">{c.status}</Badge></TableCell>
                        <TableCell className="text-sm">{c.full_name}</TableCell>
                        <TableCell className="text-xs">{c.email || '—'}</TableCell>
                        <TableCell className="text-xs">{c.whatsapp || '—'}</TableCell>
                        <TableCell className="text-xs">{c.current_product || '—'}</TableCell>
                        <TableCell className="text-xs">{c.end_of_cycle || '—'}</TableCell>
                      </TableRow>
                    ))
                  }
                </TableBody></Table>
              </div></Card>
            </TabsContent>
          </Tabs>
        </section>

        <Separator />

        {/* 4.1 // NPS desta semana */}
        <section className="space-y-4">
          <h2 className="text-base font-semibold">4.1 // NPS desta semana</h2>
          <p className="text-xs text-muted-foreground">Acompanhamento de NPS e marcos de Customer Success da semana corrente.</p>

          <Card><CardContent className="p-4">
            <h3 className="text-sm font-medium mb-2">Recolhas de NPS previstas esta semana</h3>
            {(npsWeek.data || []).length === 0 ? <p className="text-xs text-muted-foreground">Sem recolhas previstas esta semana</p> :
              <div className="overflow-x-auto">
                <Table><TableHeader><TableRow>
                  <TableHead>Cliente</TableHead><TableHead>Produto</TableHead><TableHead>Data prevista</TableHead><TableHead>Status</TableHead><TableHead>NPS</TableHead><TableHead>Responsável</TableHead>
                </TableRow></TableHeader>
                <TableBody>{(npsWeek.data || []).map((r: any) => {
                  const status = autoNpsStatus(r.expected_date, r.status);
                  return (
                    <TableRow key={r.id} className={cn(getNpsRowColor(r.expected_date, status), clickableRow)} onClick={() => openNpsDetail(r)}>
                      <TableCell className="text-sm font-medium">{r.clients?.full_name || '—'}</TableCell>
                      <TableCell className="text-xs">{r.clients?.current_product || '—'}</TableCell>
                      <TableCell className="text-xs">{format(parseISO(r.expected_date), 'dd/MM/yyyy')}</TableCell>
                      <TableCell><Badge variant={status === 'feito' ? 'default' : status === 'em_atraso' ? 'destructive' : 'secondary'} className="text-[10px]">{status === 'feito' ? 'Feito' : status === 'em_atraso' ? 'Em atraso' : 'Por fazer'}</Badge></TableCell>
                      <TableCell className="text-xs">{r.nps_score != null ? r.nps_score : '—'}</TableCell>
                      <TableCell className="text-xs">{getMemberName(r.responsible_id)}</TableCell>
                    </TableRow>
                  );
                })}</TableBody></Table>
              </div>
            }
          </CardContent></Card>

          <Card><CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-sm font-medium">Recolhas em atraso</h3>
              {overdueCount > 0 && <Badge variant="destructive" className="text-[10px]">{overdueCount}</Badge>}
            </div>
            {overdueCount === 0 ? <p className="text-xs text-muted-foreground">Sem recolhas em atraso</p> :
              <div className="overflow-x-auto">
                <Table><TableHeader><TableRow>
                  <TableHead>Cliente</TableHead><TableHead>Produto</TableHead><TableHead>Data prevista</TableHead><TableHead>Dias em atraso</TableHead>
                </TableRow></TableHeader>
                <TableBody>{(npsOverdue.data || []).map((r: any) => (
                  <TableRow key={r.id} className={cn("bg-red-50 border-l-4 border-l-red-500", clickableRow)} onClick={() => openNpsDetail(r)}>
                    <TableCell className="text-sm font-medium">{r.clients?.full_name || '—'}</TableCell>
                    <TableCell className="text-xs">{r.clients?.current_product || '—'}</TableCell>
                    <TableCell className="text-xs">{format(parseISO(r.expected_date), 'dd/MM/yyyy')}</TableCell>
                    <TableCell className="text-xs font-medium text-destructive">{differenceInDays(now, parseISO(r.expected_date))} dias</TableCell>
                  </TableRow>
                ))}</TableBody></Table>
              </div>
            }
          </CardContent></Card>

          <Card><CardContent className="p-4">
            <h3 className="text-sm font-medium mb-2">Marcos de acompanhamento desta semana</h3>
            {(milestonesWeek.data || []).length === 0 ? <p className="text-xs text-muted-foreground">Sem marcos previstos esta semana</p> :
              <div className="overflow-x-auto">
                <Table><TableHeader><TableRow>
                  <TableHead>Cliente</TableHead><TableHead>Produto</TableHead><TableHead>Marco</TableHead><TableHead>Tipo</TableHead><TableHead>Data prevista</TableHead><TableHead>Responsável</TableHead><TableHead>Status</TableHead>
                </TableRow></TableHeader>
                <TableBody>{(milestonesWeek.data || []).map((m: any) => {
                  const status = autoNpsStatus(m.expected_date, m.status);
                  return (
                    <TableRow key={m.id} className={cn(getNpsRowColor(m.expected_date, status), clickableRow)} onClick={() => openMilestoneDetail(m)}>
                      <TableCell className="text-sm font-medium">{m.clients?.full_name || '—'}</TableCell>
                      <TableCell className="text-xs">{m.clients?.current_product || '—'}</TableCell>
                      <TableCell className="text-xs">{m.milestone || '—'}</TableCell>
                      <TableCell className="text-xs">{MILESTONE_TYPE_LABELS[m.milestone_type] || m.milestone_type}</TableCell>
                      <TableCell className="text-xs">{format(parseISO(m.expected_date), 'dd/MM/yyyy')}</TableCell>
                      <TableCell className="text-xs">{getMemberName(m.responsible_id)}</TableCell>
                      <TableCell><Badge variant={status === 'feito' ? 'default' : status === 'em_atraso' ? 'destructive' : 'secondary'} className="text-[10px]">{status === 'feito' ? 'Feito' : status === 'em_atraso' ? 'Em atraso' : 'Por fazer'}</Badge></TableCell>
                    </TableRow>
                  );
                })}</TableBody></Table>
              </div>
            }
          </CardContent></Card>
        </section>

        <Separator />

        {/* 5 // Operação & Esta semana */}
        <section className="space-y-4">
          <h2 className="text-base font-semibold">5 // Operação & Esta semana</h2>

          <Card><CardContent className="p-4">
            <h3 className="text-sm font-medium mb-2">Projetos a acontecer</h3>
            {(projects.data || []).length === 0 ? <p className="text-xs text-muted-foreground">Sem projetos ativos</p> :
              <div className="overflow-x-auto">
                <Table><TableHeader><TableRow>
                  <TableHead>Status</TableHead><TableHead>Projeto</TableHead><TableHead>Departamento</TableHead><TableHead>Deadline</TableHead>
                </TableRow></TableHeader>
                <TableBody>{(projects.data || []).slice(0, 10).map(p => (
                  <TableRow key={p.id} className={clickableRow} onClick={() => openProjectDetail(p)}>
                    <TableCell><Badge variant="secondary" className="text-[10px]">{p.status}</Badge></TableCell>
                    <TableCell className="text-sm">{p.name}</TableCell>
                    <TableCell className="text-xs">{p.department || '—'}</TableCell>
                    <TableCell className="text-xs">{p.deadline || '—'}</TableCell>
                  </TableRow>
                ))}</TableBody></Table>
              </div>
            }
          </CardContent></Card>

          <div className="grid gap-4 md:grid-cols-3">
            <Card><CardContent className="p-4">
              <h3 className="text-sm font-medium mb-2">Tarefas planeadas</h3>
              {(tasks.data || []).length === 0 ? <p className="text-xs text-muted-foreground">Sem tarefas</p> :
                (tasks.data || []).map(t => (
                  <div key={t.id} className={cn("flex items-center gap-2 py-1 px-1 rounded", clickableRow)} onClick={() => openTaskDetail(t)}>
                    <div className={`h-2 w-2 rounded-full shrink-0 ${t.status === 'concluida' ? 'bg-green-500' : 'bg-yellow-500'}`} />
                    <span className="text-xs">{t.name}</span>
                  </div>
                ))
              }
            </CardContent></Card>

            <Card><CardContent className="p-4">
              <h3 className="text-sm font-medium mb-2">Reuniões marcadas</h3>
              {(meetings.data || []).length === 0 ? <p className="text-xs text-muted-foreground">Sem reuniões</p> :
                (meetings.data || []).map(m => (
                  <div key={m.id} className={cn("text-xs py-1 px-1 flex justify-between rounded", clickableRow)} onClick={() => openMeetingDetail(m)}>
                    <span>{m.title}</span><span className="text-muted-foreground">{m.start_date?.slice(0, 10)}</span>
                  </div>
                ))
              }
            </CardContent></Card>

            <Card><CardContent className="p-4">
              <h3 className="text-sm font-medium mb-2">Conteúdos desta semana</h3>
              {(contents.data || []).length === 0 ? <p className="text-xs text-muted-foreground">Sem conteúdos</p> :
                (contents.data || []).map(c => (
                  <div key={c.id} className={cn("py-1 px-1 rounded", clickableRow)} onClick={() => openContentDetail(c)}>
                    <p className="text-xs font-medium">{c.title}</p>
                    <div className="flex gap-1 mt-0.5">
                      <Badge variant="outline" className="text-[9px]">{c.status}</Badge>
                      {c.format && <Badge variant="outline" className="text-[9px]">{c.format}</Badge>}
                    </div>
                  </div>
                ))
              }
            </CardContent></Card>
          </div>
        </section>
      </div>

      <WeeklyAlignDetailSheet
        open={detailOpen}
        onOpenChange={setDetailOpen}
        title={detailTitle}
        subtitle={detailSubtitle}
        fields={detailFields}
      />
    </AppLayout>
  );
}
