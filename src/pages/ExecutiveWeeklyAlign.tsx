import { useMemo } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useExecutiveData, SALES_ROUTINES, getMonthName, areaLabel, statusLabel } from '@/hooks/useExecutiveData';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfWeek, endOfWeek, format, subDays, addDays, parseISO, differenceInDays } from 'date-fns';
import { useTeamData } from '@/hooks/useTeamData';
import { cn } from '@/lib/utils';

const now = new Date();
const currentMonth = now.getMonth() + 1;
const currentYear = now.getFullYear();
const weekStart = startOfWeek(now, { weekStartsOn: 1 });
const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
const weekStartStr = format(weekStart, 'yyyy-MM-dd');
const weekEndStr = format(weekEnd, 'yyyy-MM-dd');
const monthStart = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
const monthEnd = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${new Date(currentYear, currentMonth, 0).getDate()}`;

export default function ExecutiveWeeklyAlign() {
  const exec = useExecutiveData(currentYear);
  const monthGoals = exec.goalsForMonth(currentMonth);
  const monthProg = exec.monthProgress(currentMonth);

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

  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold">Weekly Align</h1>
          <p className="text-sm text-muted-foreground">Semana {format(weekStart, 'dd/MM')} — {format(weekEnd, 'dd/MM/yyyy')}</p>
        </div>

        {/* 1 // Metas */}
        <section className="space-y-4">
          <h2 className="text-base font-semibold">1 // Metas</h2>
          <Tabs defaultValue="metas">
            <TabsList><TabsTrigger value="metas">Metas do mês</TabsTrigger><TabsTrigger value="agenda">Agenda do mês</TabsTrigger></TabsList>
            <TabsContent value="metas">
              <Card><div className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Status</TableHead><TableHead>Meta</TableHead><TableHead>Área</TableHead><TableHead>Data meta</TableHead><TableHead>Atingida</TableHead><TableHead>Mês</TableHead><TableHead>Trim.</TableHead><TableHead>Objetivo</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {monthGoals.length === 0 ? <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground text-sm py-6">Sem metas este mês</TableCell></TableRow> :
                      monthGoals.map(g => (
                        <TableRow key={g.id}>
                          <TableCell><Badge variant={g.status === 'atingido' ? 'default' : 'secondary'} className="text-[10px]">{statusLabel(g.status)}</Badge></TableCell>
                          <TableCell className="text-sm">{g.meta}</TableCell>
                          <TableCell className="text-xs">{areaLabel(g.area)}</TableCell>
                          <TableCell className="text-xs">{g.target_date || '—'}</TableCell>
                          <TableCell className="text-xs">{g.achieved_date || '—'}</TableCell>
                          <TableCell className="text-xs">{g.month ? getMonthName(g.month) : '—'}</TableCell>
                          <TableCell className="text-xs">{g.quarter ? `T${g.quarter}` : '—'}</TableCell>
                          <TableCell className="text-xs">{exec.allObjectives.find(o => o.id === g.objective_id)?.title || '—'}</TableCell>
                        </TableRow>
                      ))
                    }
                  </TableBody>
                </Table>
              </div></Card>
            </TabsContent>
            <TabsContent value="agenda">
              <Card><div className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Evento</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {(events.data || []).length === 0 ? <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground text-sm py-6">Sem eventos</TableCell></TableRow> :
                      (events.data || []).map(e => (
                        <TableRow key={e.id}><TableCell className="text-xs">{e.start_date?.slice(0, 10)}</TableCell><TableCell className="text-sm">{e.title}</TableCell></TableRow>
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
            {/* Billing status */}
            <Card><CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-medium">Status faturação — {getMonthName(currentMonth)}</h3>
              <div className="text-xs text-muted-foreground space-y-1">
                <p>Meta: €{billingGoal.toLocaleString()} | Até agora: €{totalBilled.toLocaleString()}</p>
                <p>Progresso: {billingPct}% — Faturado: €{totalBilled.toLocaleString()} de €{billingGoal.toLocaleString()}</p>
              </div>
            </CardContent></Card>

            {/* Routines */}
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

          {/* Sales this week */}
          <Card><CardContent className="p-4">
            <h3 className="text-sm font-medium mb-2">Vendas esta semana</h3>
            {(salesWeek.data || []).length === 0 ? <p className="text-xs text-muted-foreground">Sem vendas esta semana</p> :
              <Table><TableHeader><TableRow><TableHead>ID</TableHead><TableHead>Cliente</TableHead><TableHead>Produto</TableHead><TableHead>Total</TableHead></TableRow></TableHeader>
                <TableBody>{(salesWeek.data || []).map(s => (
                  <TableRow key={s.id}><TableCell className="text-xs">{s.sale_id}</TableCell><TableCell className="text-xs">{s.client}</TableCell><TableCell className="text-xs">{s.product}</TableCell><TableCell className="text-xs">€{Number(s.invoice_total).toLocaleString()}</TableCell></TableRow>
                ))}</TableBody>
              </Table>
            }
          </CardContent></Card>

          {/* Sales actions */}
          <Card><CardContent className="p-4">
            <h3 className="text-sm font-medium mb-2">Ações de venda</h3>
            {(salesActions.data || []).length === 0 ? <p className="text-xs text-muted-foreground">Sem ações ativas</p> :
              <Table><TableHeader><TableRow><TableHead>Ação</TableHead><TableHead>Tipo</TableHead><TableHead>Status</TableHead><TableHead>Produto</TableHead></TableRow></TableHeader>
                <TableBody>{(salesActions.data || []).map(a => (
                  <TableRow key={a.id}><TableCell className="text-xs">{a.action_name}</TableCell><TableCell className="text-xs">{a.action_type}</TableCell><TableCell><Badge variant="secondary" className="text-[10px]">{a.status}</Badge></TableCell><TableCell className="text-xs">{a.product}</TableCell></TableRow>
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
                      <TableRow key={l.id}>
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
                      <TableRow key={l.id}>
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
                      <TableRow key={c.id}>
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
                      <TableRow key={c.id}>
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

        {/* 5 // Operação & Esta semana */}
        <section className="space-y-4">
          <h2 className="text-base font-semibold">5 // Operação & Esta semana</h2>

          {/* Projects */}
          <Card><CardContent className="p-4">
            <h3 className="text-sm font-medium mb-2">Projetos a acontecer</h3>
            {(projects.data || []).length === 0 ? <p className="text-xs text-muted-foreground">Sem projetos ativos</p> :
              <div className="overflow-x-auto">
                <Table><TableHeader><TableRow>
                  <TableHead>Status</TableHead><TableHead>Projeto</TableHead><TableHead>Departamento</TableHead><TableHead>Deadline</TableHead>
                </TableRow></TableHeader>
                <TableBody>{(projects.data || []).slice(0, 10).map(p => (
                  <TableRow key={p.id}>
                    <TableCell><Badge variant="secondary" className="text-[10px]">{p.status}</Badge></TableCell>
                    <TableCell className="text-sm">{p.name}</TableCell>
                    <TableCell className="text-xs">{p.department || '—'}</TableCell>
                    <TableCell className="text-xs">{p.deadline || '—'}</TableCell>
                  </TableRow>
                ))}</TableBody></Table>
              </div>
            }
          </CardContent></Card>

          {/* Tasks / Meetings / Content */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card><CardContent className="p-4">
              <h3 className="text-sm font-medium mb-2">Tarefas planeadas</h3>
              {(tasks.data || []).length === 0 ? <p className="text-xs text-muted-foreground">Sem tarefas</p> :
                (tasks.data || []).map(t => (
                  <div key={t.id} className="flex items-center gap-2 py-1">
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
                  <div key={m.id} className="text-xs py-1 flex justify-between">
                    <span>{m.title}</span><span className="text-muted-foreground">{m.start_date?.slice(0, 10)}</span>
                  </div>
                ))
              }
            </CardContent></Card>

            <Card><CardContent className="p-4">
              <h3 className="text-sm font-medium mb-2">Conteúdos desta semana</h3>
              {(contents.data || []).length === 0 ? <p className="text-xs text-muted-foreground">Sem conteúdos</p> :
                (contents.data || []).map(c => (
                  <div key={c.id} className="py-1">
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
    </AppLayout>
  );
}
