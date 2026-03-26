import { useMemo, useState } from 'react';
import { BackNavigation } from '@/components/BackNavigation';
import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { usePlanningData } from '@/hooks/usePlanningData';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfWeek, endOfWeek, format, subDays, addDays, addWeeks, startOfMonth, endOfMonth } from 'date-fns';
import { useTeamData } from '@/hooks/useTeamData';
import { WeeklyAlignDetailSheet, type DetailField } from '@/components/executive/WeeklyAlignDetailSheet';
import { WeeklyKpiCards, CapacityFinancialCards } from '@/components/executive/WeeklyAlignKpis';
import { WeeklyStrategicMetrics } from '@/components/executive/WeeklyStrategicMetrics';
import { MetasSection, AgendaSection, VendasSection, LeadsSection, ClientesSection, NpsSection, ExpiringContractsSection, OperacaoSection } from '@/components/executive/WeeklyAlignSections';
import { RoutinesSection } from '@/components/executive/WeeklyAlignRoutines';
import { ChevronLeft, ChevronRight, Save } from 'lucide-react';
import { toast } from 'sonner';
import { differenceInDays, parseISO } from 'date-fns';

export default function ExecutiveWeeklyAlign() {
  const now = new Date();
  const qc = useQueryClient();
  const [weekOffset, setWeekOffset] = useState(0);

  const weekStart = useMemo(() => {
    const base = startOfWeek(now, { weekStartsOn: 1 });
    return weekOffset === 0 ? base : addWeeks(base, weekOffset);
  }, [weekOffset]);

  const weekEnd = useMemo(() => endOfWeek(weekStart, { weekStartsOn: 1 }), [weekStart]);
  const weekStartStr = format(weekStart, 'yyyy-MM-dd');
  const weekEndStr = format(weekEnd, 'yyyy-MM-dd');
  const isCurrentWeek = weekOffset === 0;

  const currentYear = weekStart.getFullYear();
  const currentMonth = weekStart.getMonth() + 1;
  const monthStart = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
  const monthEnd = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${new Date(currentYear, currentMonth, 0).getDate()}`;

  // Previous week for comparison
  const prevWeekStart = useMemo(() => addWeeks(weekStart, -1), [weekStart]);
  const prevWeekEnd = useMemo(() => endOfWeek(prevWeekStart, { weekStartsOn: 1 }), [prevWeekStart]);
  const prevWeekStartStr = format(prevWeekStart, 'yyyy-MM-dd');
  const prevWeekEndStr = format(prevWeekEnd, 'yyyy-MM-dd');

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

  // ─── Queries ───
  const events = useQuery({
    queryKey: ['wa-events', currentMonth],
    queryFn: async () => {
      const { data } = await supabase.from('events').select('*').gte('start_date', monthStart).lte('start_date', monthEnd + 'T23:59:59').order('start_date');
      return data || [];
    },
  });

  const salesWeek = useQuery({
    queryKey: ['wa-sales-week', weekStartStr],
    queryFn: async () => {
      const { data } = await supabase.from('commercial_sales').select('*').gte('payment_date', weekStartStr).lte('payment_date', weekEndStr);
      return data || [];
    },
  });

  const salesActions = useQuery({
    queryKey: ['wa-sales-actions'],
    queryFn: async () => {
      const { data } = await supabase.from('commercial_sales_actions').select('*').in('status', ['em_curso', 'por_comecar']).order('start_date');
      return data || [];
    },
  });

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

  const leads = useQuery({
    queryKey: ['wa-leads'],
    queryFn: async () => {
      const { data } = await supabase.from('crm_leads').select('*').not('status', 'in', '("ganho","perdido")').order('next_followup');
      return data || [];
    },
  });

  const clients = useQuery({
    queryKey: ['wa-clients'],
    queryFn: async () => {
      const { data } = await supabase.from('clients').select('*').order('start_date', { ascending: false });
      return data || [];
    },
  });

  const projects = useQuery({
    queryKey: ['wa-projects'],
    queryFn: async () => {
      const { data } = await supabase.from('projects').select('*').in('status', ['em_curso', 'em_ideia', 'em_pausa']).order('deadline');
      return data || [];
    },
  });

  const tasks = useQuery({
    queryKey: ['wa-tasks-week', weekStartStr],
    queryFn: async () => {
      const { data } = await supabase.from('tasks').select('*').gte('deadline', weekStartStr).lte('deadline', weekEndStr).order('deadline');
      return data || [];
    },
  });

  // Routine tasks for this week and previous week
  const routineTasksWeek = useQuery({
    queryKey: ['wa-routine-tasks-week', weekStartStr, weekEndStr],
    queryFn: async () => {
      const { data } = await supabase
        .from('tasks')
        .select('*, profiles:assigned_to(full_name), planning_routines:routine_id(title, role_function, recurrence_type)')
        .eq('tag', 'Rotina')
        .gte('deadline', weekStartStr)
        .lte('deadline', weekEndStr)
        .order('deadline');
      return data || [];
    },
  });

  const routineTasksPrevWeek = useQuery({
    queryKey: ['wa-routine-tasks-prev-week', prevWeekStartStr, prevWeekEndStr],
    queryFn: async () => {
      const { data } = await supabase
        .from('tasks')
        .select('*, profiles:assigned_to(full_name), planning_routines:routine_id(title, role_function, recurrence_type)')
        .eq('tag', 'Rotina')
        .gte('deadline', prevWeekStartStr)
        .lte('deadline', prevWeekEndStr)
        .order('deadline');
      return data || [];
    },
  });

  const meetings = useQuery({
    queryKey: ['wa-meetings-week', weekStartStr],
    queryFn: async () => {
      const { data } = await supabase.from('meetings').select('*').gte('date_time', weekStartStr).lte('date_time', weekEndStr + 'T23:59:59').order('date_time');
      return data || [];
    },
  });

  const contents = useQuery({
    queryKey: ['wa-content-week', weekStartStr],
    queryFn: async () => {
      const { data } = await supabase.from('content_items').select('*').gte('scheduled_at', weekStartStr).lte('scheduled_at', weekEndStr + 'T23:59:59').order('scheduled_at');
      return data || [];
    },
  });

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

  const sixtyDaysAhead = format(addDays(now, 60), 'yyyy-MM-dd');
  const expiringContracts = useQuery({
    queryKey: ['wa-expiring-contracts', format(now, 'yyyy-MM-dd')],
    queryFn: async () => {
      const { data } = await supabase
        .from('member_contracts')
        .select('*, team_members(id, full_name, role_title, department)')
        .eq('status', 'ativo')
        .not('end_date', 'is', null)
        .lte('end_date', sixtyDaysAhead)
        .order('end_date');
      return (data || []) as any[];
    },
  });

  const milestonesWeek = useQuery({
    queryKey: ['wa-milestones-week', weekStartStr, weekEndStr],
    queryFn: async () => {
      const { data } = await supabase.from('client_milestones').select('*, clients!client_milestones_client_id_fkey(full_name, current_product)').gte('expected_date', weekStartStr).lte('expected_date', weekEndStr).order('expected_date');
      return (data || []) as any[];
    },
  });

  // Previous week queries
  const prevSalesWeek = useQuery({
    queryKey: ['wa-sales-week-prev', prevWeekStartStr],
    queryFn: async () => {
      const { data } = await supabase.from('commercial_sales').select('invoice_total').gte('payment_date', prevWeekStartStr).lte('payment_date', prevWeekEndStr);
      return data || [];
    },
  });

  const prevTasksWeek = useQuery({
    queryKey: ['wa-tasks-week-prev', prevWeekStartStr],
    queryFn: async () => {
      const { data } = await supabase.from('tasks').select('id,status').gte('deadline', prevWeekStartStr).lte('deadline', prevWeekEndStr);
      return data || [];
    },
  });

  const prevMeetingsWeek = useQuery({
    queryKey: ['wa-meetings-week-prev', prevWeekStartStr],
    queryFn: async () => {
      const { data } = await supabase.from('meetings').select('id').gte('date_time', prevWeekStartStr).lte('date_time', prevWeekEndStr + 'T23:59:59');
      return data || [];
    },
  });

  // Weekly notes
  const weeklyNotes = useQuery({
    queryKey: ['wa-notes', weekStartStr],
    queryFn: async () => {
      const { data } = await supabase.from('weekly_align_notes').select('*').eq('week_start', weekStartStr).maybeSingle();
      return data;
    },
  });

  const [notesForm, setNotesForm] = useState({ decisions: '', blockers: '', key_points: '' });
  const notesLoaded = useMemo(() => {
    if (weeklyNotes.data) {
      return { decisions: weeklyNotes.data.decisions || '', blockers: weeklyNotes.data.blockers || '', key_points: weeklyNotes.data.key_points || '' };
    }
    return { decisions: '', blockers: '', key_points: '' };
  }, [weeklyNotes.data]);

  useMemo(() => { setNotesForm(notesLoaded); }, [notesLoaded]);

  const saveNotes = useMutation({
    mutationFn: async () => {
      if (weeklyNotes.data?.id) {
        const { error } = await supabase.from('weekly_align_notes').update(notesForm as any).eq('id', weeklyNotes.data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('weekly_align_notes').insert({ ...notesForm, week_start: weekStartStr } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['wa-notes'] }); toast.success('Notas guardadas'); },
    onError: () => toast.error('Erro ao guardar notas'),
  });

  // ─── Computed values ───
  const { members } = useTeamData();
  const teamMembers = members.data || [];
  const todayStr = format(now, 'yyyy-MM-dd');
  const thirtyDaysAgo = format(subDays(now, 30), 'yyyy-MM-dd');
  const thirtyDaysAhead = format(addDays(now, 30), 'yyyy-MM-dd');

  const totalBilled = useMemo(() => (monthSales.data || []).reduce((s, v) => s + Number(v.invoice_total || 0), 0), [monthSales.data]);
  const billingGoal = monthlyGoal.data?.goal_amount || 0;

  const followUps = useMemo(() => (leads.data || []).filter(l => l.next_followup && l.next_followup <= todayStr), [leads.data, todayStr]);
  const onboardingClients = useMemo(() => (clients.data || []).filter(c => c.start_date && c.start_date >= thirtyDaysAgo), [clients.data, thirtyDaysAgo]);
  const renewalClients = useMemo(() => (clients.data || []).filter(c => c.end_of_cycle && c.end_of_cycle <= thirtyDaysAhead && c.end_of_cycle >= todayStr), [clients.data, thirtyDaysAhead, todayStr]);

  const salesWeekTotal = useMemo(() => (salesWeek.data || []).reduce((s, v) => s + Number(v.invoice_total || 0), 0), [salesWeek.data]);
  const tasksWeekCount = (tasks.data || []).length;
  const tasksWeekDone = (tasks.data || []).filter(t => t.status === 'concluida').length;
  const contentWeekCount = (contents.data || []).length;
  const meetingsWeekCount = (meetings.data || []).length;

  const prevSalesWeekTotal = useMemo(() => (prevSalesWeek.data || []).reduce((s: number, v: any) => s + Number(v.invoice_total || 0), 0), [prevSalesWeek.data]);

  const expiringContractsList = useMemo(() => {
    return (expiringContracts.data || []).map((c: any) => ({
      ...c, daysLeft: differenceInDays(parseISO(c.end_date), now),
    }));
  }, [expiringContracts.data]);

  // Capacity alert
  const monthStartDate = format(startOfMonth(now), 'yyyy-MM-dd');
  const monthEndDate = format(endOfMonth(now), 'yyyy-MM-dd');
  const timeEntriesMonth = useQuery({
    queryKey: ['wa-time-entries-month', monthStartDate],
    queryFn: async () => {
      const { data } = await supabase.from('time_entries').select('member_id,duration_hours').gte('entry_date', monthStartDate).lte('entry_date', monthEndDate);
      return data || [];
    },
  });

  const capacityAlert = useMemo(() => {
    const activeMembers = teamMembers.filter((m: any) => m.status === 'ativo' || m.status === 'prestador');
    if (activeMembers.length === 0) return null;
    const totalCapacity = activeMembers.reduce((sum: number, m: any) => sum + (Number(m.weekly_hours) || 40) * 4.33, 0);
    const totalUsed = (timeEntriesMonth.data || []).reduce((sum: number, e: any) => sum + (Number(e.duration_hours) || 0), 0);
    const pct = totalCapacity > 0 ? Math.round((totalUsed / totalCapacity) * 100) : 0;
    const overloaded = activeMembers.filter((m: any) => {
      const mh = (timeEntriesMonth.data || []).filter((e: any) => e.member_id === m.id).reduce((s: number, e: any) => s + (Number(e.duration_hours) || 0), 0);
      const cap = (Number(m.weekly_hours) || 40) * 4.33;
      return cap > 0 && (mh / cap) > 0.85;
    });
    return { pct, totalCapacity: Math.round(totalCapacity), totalUsed: Math.round(totalUsed), overloadedCount: overloaded.length, total: activeMembers.length };
  }, [teamMembers, timeEntriesMonth.data]);

  // Financial summary
  const monthExpenses = useQuery({
    queryKey: ['wa-expenses-month', currentMonth, currentYear],
    queryFn: async () => {
      const { data } = await supabase.from('financial_expenses').select('total_with_vat, category, status').eq('expense_month', currentMonth).eq('expense_year', currentYear);
      return data || [];
    },
  });

  const monthPayroll = useQuery({
    queryKey: ['wa-payroll-month', currentMonth, currentYear],
    queryFn: async () => {
      const { data } = await supabase.from('financial_payroll').select('total_cost, status').eq('month', currentMonth).eq('year', currentYear);
      return data || [];
    },
  });

  const financialSummary = useMemo(() => {
    const totalExpenses = (monthExpenses.data || []).reduce((s, e) => s + Number(e.total_with_vat || 0), 0);
    const pendingExpenses = (monthExpenses.data || []).filter(e => e.status === 'por_pagar').reduce((s, e) => s + Number(e.total_with_vat || 0), 0);
    const totalPayroll = (monthPayroll.data || []).reduce((s, p) => s + Number(p.total_cost || 0), 0);
    const pendingPayroll = (monthPayroll.data || []).filter(p => p.status === 'por_pagar').reduce((s, p) => s + Number(p.total_cost || 0), 0);
    const totalCosts = totalExpenses + totalPayroll;
    const totalPending = pendingExpenses + pendingPayroll;
    const balance = totalBilled - totalCosts;
    return { totalExpenses, totalPayroll, totalCosts, totalPending, balance };
  }, [monthExpenses.data, monthPayroll.data, totalBilled]);

  const getMemberName = (id: string | null) => {
    if (!id) return '—';
    return teamMembers.find((t: any) => t.id === id)?.full_name || '—';
  };

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

        {/* Strategic Metrics — compact row */}
        <WeeklyStrategicMetrics />

        {/* KPI Summary Cards */}
        <WeeklyKpiCards
          salesWeekTotal={salesWeekTotal}
          prevSalesWeekTotal={prevSalesWeekTotal}
          tasksWeekDone={tasksWeekDone}
          tasksWeekCount={tasksWeekCount}
          prevTasksWeekCount={(prevTasksWeek.data || []).length}
          leadsCount={(leads.data || []).length}
          followUpsCount={followUps.length}
          overdueNpsCount={(npsOverdue.data || []).length}
          meetingsWeekCount={meetingsWeekCount}
          prevMeetingsWeekCount={(prevMeetingsWeek.data || []).length}
        />

        {/* Capacity & Financial */}
        <CapacityFinancialCards
          capacityAlert={capacityAlert}
          totalBilled={totalBilled}
          financialSummary={financialSummary}
          currentMonth={currentMonth}
        />

        <Separator />

        {/* Notas & Decisões */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Notas & Decisões</h2>
            <Button size="sm" variant="outline" onClick={() => saveNotes.mutate()} disabled={saveNotes.isPending}>
              <Save className="h-3.5 w-3.5 mr-1.5" />
              Guardar
            </Button>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Decisões tomadas</label>
              <Textarea placeholder="Decisões desta semana..." value={notesForm.decisions} onChange={e => setNotesForm(p => ({ ...p, decisions: e.target.value }))} className="min-h-[80px] text-sm" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Bloqueios / Riscos</label>
              <Textarea placeholder="Bloqueios identificados..." value={notesForm.blockers} onChange={e => setNotesForm(p => ({ ...p, blockers: e.target.value }))} className="min-h-[80px] text-sm" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Pontos-chave</label>
              <Textarea placeholder="Destaques da semana..." value={notesForm.key_points} onChange={e => setNotesForm(p => ({ ...p, key_points: e.target.value }))} className="min-h-[80px] text-sm" />
            </div>
          </div>
        </section>

        <Separator />
        <MetasSection planning={planning} currentMonth={currentMonth} onOpenDetail={openDetail} />
        <Separator />
        <AgendaSection events={events.data || []} onOpenDetail={openDetail} />
        <Separator />
        <VendasSection
          salesWeek={salesWeek.data || []}
          salesActions={salesActions.data || []}
          salesWeekTotal={salesWeekTotal}
          prevSalesWeekTotal={prevSalesWeekTotal}
          totalBilled={totalBilled}
          billingGoal={billingGoal}
          currentMonth={currentMonth}
          onOpenDetail={openDetail}
        />
        <Separator />
        <LeadsSection leads={leads.data || []} followUps={followUps} onOpenDetail={openDetail} />
        <Separator />
        <ClientesSection onboardingClients={onboardingClients} renewalClients={renewalClients} />
        <Separator />
        <NpsSection
          npsWeek={npsWeek.data || []}
          npsOverdue={npsOverdue.data || []}
          milestonesWeek={milestonesWeek.data || []}
          getMemberName={getMemberName}
          onOpenDetail={openDetail}
        />
        <Separator />
        <ExpiringContractsSection expiringContractsList={expiringContractsList} />
        {expiringContractsList.length > 0 && <Separator />}
        <OperacaoSection
          projects={projects.data || []}
          tasks={tasks.data || []}
          meetings={meetings.data || []}
          contents={contents.data || []}
          tasksWeekDone={tasksWeekDone}
          tasksWeekCount={tasksWeekCount}
          meetingsWeekCount={meetingsWeekCount}
          contentWeekCount={contentWeekCount}
          onOpenDetail={openDetail}
        />
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
