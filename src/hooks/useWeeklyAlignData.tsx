import { useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfWeek, endOfWeek, format, addWeeks, addDays, subDays, startOfMonth, endOfMonth, differenceInDays, parseISO } from 'date-fns';
import { useTeamData } from '@/hooks/useTeamData';
import { sumRevenue } from '@/lib/salesCalculations';
import { isTaskDone } from '@/lib/taskStatus';
import { teamMonthlyCapacitySummary } from '@/lib/memberCapacity';
import type { Tables } from '@/integrations/supabase/types';

type WeekTaskRow = Pick<Tables<'tasks'>, 'id' | 'name' | 'status' | 'deadline' | 'assigned_to' | 'department'>;
type LeadLite = Pick<Tables<'crm_leads'>, 'id' | 'name' | 'status' | 'next_followup' | 'estimated_value'>;
type ClientLite = Pick<Tables<'clients'>, 'id' | 'full_name' | 'status' | 'start_date' | 'end_of_cycle' | 'current_product' | 'email' | 'client_id'>;
type MonthExpenseLite = Pick<Tables<'financial_expenses'>, 'total_with_vat' | 'category' | 'status'>;
type MonthPayrollLite = Pick<Tables<'financial_payroll'>, 'total_cost' | 'status'>;
type ExpiringContract = Tables<'member_contracts'> & {
  team_members: Pick<Tables<'team_members'>, 'id' | 'full_name' | 'role_title' | 'department'> | null;
};
type TeamMemberLite = Pick<Tables<'team_members'>, 'id' | 'full_name'>;

const STALE = 2 * 60 * 1000;

export function useWeeklyAlignData(weekOffset: number) {
  // Stable "now" — only changes when the component remounts, not every render
  const nowRef = useRef(new Date());
  const now = nowRef.current;

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

  const prevWeekStart = useMemo(() => addWeeks(weekStart, -1), [weekStart]);
  const prevWeekEnd = useMemo(() => endOfWeek(prevWeekStart, { weekStartsOn: 1 }), [prevWeekStart]);
  const prevWeekStartStr = format(prevWeekStart, 'yyyy-MM-dd');
  const prevWeekEndStr = format(prevWeekEnd, 'yyyy-MM-dd');

  const todayStr = format(now, 'yyyy-MM-dd');
  const thirtyDaysAgo = format(subDays(now, 30), 'yyyy-MM-dd');
  const thirtyDaysAhead = format(addDays(now, 30), 'yyyy-MM-dd');
  const sixtyDaysAhead = format(addDays(now, 60), 'yyyy-MM-dd');

  const monthStartDate = format(startOfMonth(now), 'yyyy-MM-dd');
  const monthEndDate = format(endOfMonth(now), 'yyyy-MM-dd');

  const { members } = useTeamData({ members: true });
  const teamMembers = members.data || [];

  // ─── Batch: week-scoped queries ───
  const weekData = useQuery({
    queryKey: ['wa-week-batch', weekStartStr, weekEndStr],
    staleTime: STALE,
    queryFn: async () => {
      const [salesRes, tasksRes, meetingsRes, contentsRes, routinesRes, npsRes] = await Promise.all([
        supabase.from('commercial_sales').select('id,client,product,invoice_total,payment_date,status').gte('payment_date', weekStartStr).lte('payment_date', weekEndStr),
        supabase.from('tasks').select('id,name,status,deadline,assigned_to,department').gte('deadline', weekStartStr).lte('deadline', weekEndStr).order('deadline'),
        supabase.from('meetings').select('id,title,date_time,status').gte('date_time', weekStartStr).lte('date_time', weekEndStr + 'T23:59:59').order('date_time'),
        supabase.from('content_items').select('id,title,status,scheduled_at').gte('scheduled_at', weekStartStr).lte('scheduled_at', weekEndStr + 'T23:59:59').order('scheduled_at'),
        supabase.from('tasks').select('*, planning_routines:routine_id(title, role_function, recurrence_type)').eq('tag', 'Rotina').gte('deadline', weekStartStr).lte('deadline', weekEndStr).order('deadline'),
        supabase.from('client_nps_records').select('*, clients!client_nps_records_client_id_fkey(full_name, current_product)').gte('expected_date', weekStartStr).lte('expected_date', weekEndStr).order('expected_date'),
      ]);
      return {
        salesWeek: salesRes.data || [],
        tasks: (tasksRes.data || []) as WeekTaskRow[],
        meetings: meetingsRes.data || [],
        contents: contentsRes.data || [],
        routineTasksWeek: routinesRes.data || [],
        npsWeek: (npsRes.data || []) as Array<Record<string, unknown>>,
      };
    },
  });

  // ─── Batch: previous week comparison ───
  const prevWeekData = useQuery({
    queryKey: ['wa-prev-week-batch', prevWeekStartStr, prevWeekEndStr],
    staleTime: STALE,
    queryFn: async () => {
      const [salesRes, tasksRes, meetingsRes, routinesRes] = await Promise.all([
        supabase.from('commercial_sales').select('invoice_total').gte('payment_date', prevWeekStartStr).lte('payment_date', prevWeekEndStr),
        supabase.from('tasks').select('id,status').gte('deadline', prevWeekStartStr).lte('deadline', prevWeekEndStr),
        supabase.from('meetings').select('id').gte('date_time', prevWeekStartStr).lte('date_time', prevWeekEndStr + 'T23:59:59'),
        supabase.from('tasks').select('*, planning_routines:routine_id(title, role_function, recurrence_type)').eq('tag', 'Rotina').gte('deadline', prevWeekStartStr).lte('deadline', prevWeekEndStr).order('deadline'),
      ]);
      return {
        prevSalesWeek: salesRes.data || [],
        prevTasksWeek: tasksRes.data || [],
        prevMeetingsWeek: meetingsRes.data || [],
        routineTasksPrevWeek: routinesRes.data || [],
      };
    },
  });

  // ─── Batch: month-scoped ───
  const monthData = useQuery({
    queryKey: ['wa-month-batch', currentMonth, currentYear],
    staleTime: STALE,
    queryFn: async () => {
      const [eventsRes, goalRes, monthSalesRes, expensesRes, payrollRes] = await Promise.all([
        supabase.from('events').select('*').gte('start_date', monthStart).lte('start_date', monthEnd + 'T23:59:59').order('start_date'),
        supabase.from('commercial_monthly_goals').select('goal_amount').eq('month', currentMonth).eq('year', currentYear).maybeSingle(),
        supabase.from('commercial_sales').select('invoice_total').eq('sale_month', currentMonth).eq('sale_year', currentYear),
        supabase.from('financial_expenses').select('total_with_vat, category, status').eq('expense_month', currentMonth).eq('expense_year', currentYear),
        supabase.from('financial_payroll').select('total_cost, status').eq('month', currentMonth).eq('year', currentYear),
      ]);
      return {
        events: eventsRes.data || [],
        monthlyGoal: goalRes.data,
        monthSales: monthSalesRes.data || [],
        monthExpenses: expensesRes.data || [],
        monthPayroll: payrollRes.data || [],
      };
    },
  });

  // ─── Batch: global/active data ───
  const globalData = useQuery({
    queryKey: ['wa-global-batch'],
    staleTime: STALE,
    queryFn: async () => {
      const [salesActionsRes, leadsRes, clientsRes, projectsRes, npsOverdueRes, contractsRes, timeEntriesRes] = await Promise.all([
        supabase.from('commercial_sales_actions').select('id,action_name,status,start_date,end_date').in('status', ['em_curso', 'por_comecar']).order('start_date'),
        supabase.from('crm_leads').select('id,name,status,next_followup,estimated_value').not('status', 'in', '("ganho","perdido")').order('next_followup'),
        supabase.from('clients').select('id,client_id,full_name,status,start_date,end_of_cycle,current_product,email').order('start_date', { ascending: false }),
        supabase.from('projects').select('id,name,status,deadline,client_name,department,departments').in('status', ['em_curso', 'em_ideia', 'em_pausa', 'em_revisao', 'em_onboarding']).order('deadline').is('archived_at', null),
        supabase.from('client_nps_records').select('*, clients!client_nps_records_client_id_fkey(full_name, current_product)').lt('expected_date', weekStartStr).neq('status', 'feito').order('expected_date'),
        supabase.from('member_contracts').select('*, team_members(id, full_name, role_title, department)').eq('status', 'ativo').not('end_date', 'is', null).lte('end_date', sixtyDaysAhead).order('end_date'),
        supabase.from('time_entries').select('member_id,duration').gte('entry_date', monthStartDate).lte('entry_date', monthEndDate),
      ]);
      return {
        salesActions: salesActionsRes.data || [],
        leads: (leadsRes.data || []) as LeadLite[],
        clients: (clientsRes.data || []) as ClientLite[],
        projects: projectsRes.data || [],
        npsOverdue: (npsOverdueRes.data || []) as Array<Record<string, unknown>>,
        expiringContracts: (contractsRes.data || []) as ExpiringContract[],
        timeEntriesMonth: timeEntriesRes.data || [],
      };
    },
  });

  // ─── Computed values ───
  const wk = weekData.data;
  const prev = prevWeekData.data;
  const mo = monthData.data;
  const gl = globalData.data;

  const totalBilled = useMemo(() => sumRevenue(mo?.monthSales || []), [mo?.monthSales]);
  const billingGoal = mo?.monthlyGoal?.goal_amount || 0;

  const salesWeekTotal = useMemo(() => sumRevenue(wk?.salesWeek || []), [wk?.salesWeek]);
  const prevSalesWeekTotal = useMemo(() => sumRevenue(prev?.prevSalesWeek || []), [prev?.prevSalesWeek]);

  const tasksWeekCount = (wk?.tasks || []).length;
  const tasksWeekDone = (wk?.tasks || []).filter((t) => isTaskDone(t as { status: string | null })).length;
  const contentWeekCount = (wk?.contents || []).length;
  const meetingsWeekCount = (wk?.meetings || []).length;

  const followUps = useMemo(() => (gl?.leads || []).filter((l) => l.next_followup && l.next_followup <= todayStr), [gl?.leads, todayStr]);
  // Onboarding: clientes com status 'em_onboarding' (estado real, não inferido por data)
  const onboardingClients = useMemo(
    () => (gl?.clients || []).filter((c) => c.status === 'em_onboarding'),
    [gl?.clients],
  );
  // Renovações: status 'altura_renovacao' OU fim de ciclo nos próximos 30 dias (cliente ainda ativo)
  const renewalClients = useMemo(
    () =>
      (gl?.clients || []).filter(
        (c) =>
          c.status === 'altura_renovacao' ||
          (c.status === 'ativo' &&
            c.end_of_cycle &&
            c.end_of_cycle <= thirtyDaysAhead &&
            c.end_of_cycle >= todayStr),
      ),
    [gl?.clients, thirtyDaysAhead, todayStr],
  );

  const expiringContractsList = useMemo(() => {
    return (gl?.expiringContracts || []).map((c) => ({
      ...c,
      daysLeft: c.end_date ? differenceInDays(parseISO(c.end_date), now) : 0,
    }));
  }, [gl?.expiringContracts]);

  const capacityAlert = useMemo(() => {
    return teamMonthlyCapacitySummary(
      teamMembers as Parameters<typeof teamMonthlyCapacitySummary>[0],
      (gl?.timeEntriesMonth || []) as Parameters<typeof teamMonthlyCapacitySummary>[1],
    );
  }, [teamMembers, gl?.timeEntriesMonth]);

  const financialSummary = useMemo(() => {
    const expenses = (mo?.monthExpenses || []) as MonthExpenseLite[];
    const payroll = (mo?.monthPayroll || []) as MonthPayrollLite[];
    const totalExpenses = expenses.reduce((s, e) => s + Number(e.total_with_vat || 0), 0);
    const pendingExpenses = expenses.filter((e) => e.status === 'por_pagar').reduce((s, e) => s + Number(e.total_with_vat || 0), 0);
    const totalPayroll = payroll.reduce((s, p) => s + Number(p.total_cost || 0), 0);
    const pendingPayroll = payroll.filter((p) => p.status === 'por_pagar').reduce((s, p) => s + Number(p.total_cost || 0), 0);
    const totalCosts = totalExpenses + totalPayroll;
    const totalPending = pendingExpenses + pendingPayroll;
    const balance = totalBilled - totalCosts;
    return { totalExpenses, totalPayroll, totalCosts, totalPending, balance };
  }, [mo?.monthExpenses, mo?.monthPayroll, totalBilled]);

  const getMemberName = (id: string | null) => {
    if (!id) return '—';
    return (teamMembers as TeamMemberLite[]).find((t) => t.id === id)?.full_name || '—';
  };

  return {
    weekStart, weekEnd, weekStartStr, weekEndStr, isCurrentWeek,
    currentYear, currentMonth,
    // Raw data
    events: mo?.events || [],
    salesWeek: wk?.salesWeek || [],
    salesActions: gl?.salesActions || [],
    tasks: wk?.tasks || [],
    meetings: wk?.meetings || [],
    contents: wk?.contents || [],
    leads: gl?.leads || [],
    clients: gl?.clients || [],
    projects: gl?.projects || [],
    npsWeek: wk?.npsWeek || [],
    npsOverdue: gl?.npsOverdue || [],
    routineTasksWeek: wk?.routineTasksWeek || [],
    routineTasksPrevWeek: prev?.routineTasksPrevWeek || [],
    expiringContractsList,
    // Computed
    salesWeekTotal, prevSalesWeekTotal,
    totalBilled, billingGoal,
    tasksWeekCount, tasksWeekDone,
    contentWeekCount, meetingsWeekCount,
    followUps, onboardingClients, renewalClients,
    capacityAlert, financialSummary,
    getMemberName, teamMembers,
    // Previous week counts
    prevTasksWeekCount: (prev?.prevTasksWeek || []).length,
    prevMeetingsWeekCount: (prev?.prevMeetingsWeek || []).length,
  };
}
