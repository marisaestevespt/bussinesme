import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfMonth, endOfMonth, subMonths, startOfToday, differenceInDays, startOfWeek, endOfWeek, addDays } from 'date-fns';
import { sumRevenue } from '@/lib/salesCalculations';
import { calculateMRR } from '@/lib/financialHealth';
import { teamMonthlyCapacitySummary } from '@/lib/memberCapacity';
import { isTaskOpen, isTaskOverdue } from '@/lib/taskStatus';
import type { Tables } from '@/integrations/supabase/types';

type ExpenseLite = Pick<Tables<'financial_expenses'>, 'total_with_vat'> & Partial<Tables<'financial_expenses'>>;
type SaleLite = Pick<Tables<'commercial_sales'>, 'id' | 'invoice_total' | 'sale_month' | 'status'>;
type ProjectLite = Pick<Tables<'projects'>, 'id' | 'name' | 'status' | 'deadline' | 'department'>;
type TaskLite = Pick<Tables<'tasks'>, 'id' | 'status' | 'deadline' | 'department'>;
type LeadLite = Pick<Tables<'crm_leads'>, 'id' | 'name' | 'next_followup' | 'created_at' | 'status'>;
type NpsLite = Pick<Tables<'client_nps_records'>, 'nps_score' | 'actual_date' | 'client_id'>;
type ContentLite = Pick<Tables<'content_items'>, 'id' | 'title' | 'status' | 'scheduled_at'>;

/**
 * Single batched hook powering the CEO Cockpit (ExecutiveDashboard).
 *
 * Aggregates everything the Owner/Admin needs in 30 seconds:
 * - Business pulse (MRR, revenue, runway, capacity, churn, NPS)
 * - Cross-app alerts that demand a CEO decision
 * - Per-department health snapshot
 *
 * Uses ONE batched Promise.all to keep the dashboard snappy.
 */
export function useCeoCockpit() {
  const now = new Date();
  const today = startOfToday();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const monthStart = format(startOfMonth(now), 'yyyy-MM-dd');
  const monthEnd = format(endOfMonth(now), 'yyyy-MM-dd');
  const prevMonthStart = format(startOfMonth(subMonths(now, 1)), 'yyyy-MM-dd');
  const prevMonthEnd = format(endOfMonth(subMonths(now, 1)), 'yyyy-MM-dd');
  const ninetyDaysAgo = format(subMonths(now, 3), 'yyyy-MM-dd');
  const weekStart = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const weekEnd = format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');

  const query = useQuery({
    queryKey: ['ceo-cockpit', currentMonth, currentYear],
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      const [
        clients, products, sales, expensesM, expensesPrevM, expenses90d,
        members, timeEntries, tasks, projects, leads, npsRecords, meetings,
        annualGoal, contentMonth, contentIdeas,
      ] = await Promise.all([
        supabase.from('clients').select('id, status, full_name, current_product, start_date, end_of_cycle, renegotiation_status, renegotiation_reason, renegotiation_started_at'),
        supabase.from('products').select('id, name, ticket, product_type'),
        supabase.from('commercial_sales').select('id, invoice_total, sale_month, sale_year, status').eq('sale_year', currentYear),
        supabase.from('financial_expenses').select('total_with_vat, category, department, expense_date').gte('expense_date', monthStart).lte('expense_date', monthEnd),
        supabase.from('financial_expenses').select('total_with_vat').gte('expense_date', prevMonthStart).lte('expense_date', prevMonthEnd),
        supabase.from('financial_expenses').select('total_with_vat, expense_date').gte('expense_date', ninetyDaysAgo),
        supabase.from('team_members').select('id, status, expected_weekly_hours, full_name'),
        supabase.from('time_entries').select('member_id, duration').gte('entry_date', monthStart).lte('entry_date', monthEnd),
        supabase.from('tasks').select('id, status, deadline, assigned_to, priority, name, project_id, department'),
        supabase.from('projects').select('id, name, status, deadline, department, type, project_mode, client_name, progress').is('archived_at', null),
        supabase.from('crm_leads').select('id, name, next_followup, created_at, status'),
        supabase.from('client_nps_records').select('nps_score, actual_date, client_id').gte('actual_date', ninetyDaysAgo).not('nps_score', 'is', null),
        supabase.from('meetings').select('id, title, date_time, status, project_id, client_name').gte('date_time', monthStart).lte('date_time', monthEnd).order('date_time', { ascending: true }),
        supabase.from('commercial_annual_goals').select('goal_amount').eq('year', currentYear).maybeSingle(),
        supabase.from('content_items').select('id, title, status, scheduled_at, content_type, format').gte('scheduled_at', monthStart).lte('scheduled_at', monthEnd),
        supabase.from('marketing_ideas').select('id'),
      ]);

      return {
        clients: clients.data || [],
        products: products.data || [],
        sales: sales.data || [],
        expensesM: expensesM.data || [],
        expensesPrevM: expensesPrevM.data || [],
        expenses90d: expenses90d.data || [],
        members: members.data || [],
        timeEntries: timeEntries.data || [],
        tasks: tasks.data || [],
        projects: projects.data || [],
        leads: leads.data || [],
        npsRecords: npsRecords.data || [],
        meetings: meetings.data || [],
        annualGoal: annualGoal.data?.goal_amount || 0,
        contentMonth: contentMonth.data || [],
        contentIdeas: contentIdeas.data || [],
      };
    },
  });

  const derived = useMemo(() => {
    const d = query.data;
    if (!d) return null;

    // ── Pulse: MRR, revenue, runway, capacity, churn, NPS ────────
    const activeClients = d.clients.filter(c => c.status === 'ativo' || c.status === 'em_onboarding');
    const mrr = calculateMRR(activeClients, d.products).total;

    const monthRevenue = sumRevenue(d.sales.filter(s => s.sale_month === currentMonth));
    const yearRevenue = sumRevenue(d.sales);
    const prevMonthRevenue = sumRevenue(d.sales.filter(s => s.sale_month === currentMonth - 1));

    const monthExpenses = d.expensesM.reduce((s, e: ExpenseLite) => s + (Number(e.total_with_vat) || 0), 0);
    const prevMonthExpenses = d.expensesPrevM.reduce((s, e: ExpenseLite) => s + (Number(e.total_with_vat) || 0), 0);

    // Burn rate: average monthly net cash out (last 90 days)
    const burn90 = d.expenses90d.reduce((s, e: ExpenseLite) => s + (Number(e.total_with_vat) || 0), 0) / 3;
    const monthlyNet = monthRevenue - monthExpenses;

    const capacity = teamMonthlyCapacitySummary(d.members, d.timeEntries);

    // NPS average (90d)
    const npsScores = d.npsRecords.map((r: NpsLite) => Number(r.nps_score)).filter(n => !isNaN(n));
    const avgNps = npsScores.length > 0 ? Math.round((npsScores.reduce((s, v) => s + v, 0) / npsScores.length) * 10) / 10 : null;

    // Annual goal progress
    const goalProgress = d.annualGoal > 0 ? Math.round((yearRevenue / d.annualGoal) * 100) : 0;

    // ── Alerts ───────────────────────────────────────────────────
    const overdueSales = d.sales.filter((s: SaleLite) => s.status === 'em_atraso');
    const renewalClients = d.clients.filter(c => c.status === 'altura_renovacao');
    const onboardingClients = d.clients.filter(c => c.status === 'em_onboarding');
    const renegotiatingClients = d.clients.filter((c: any) => c.renegotiation_status === 'em_curso');

    const clientsNearEndOfCycle = d.clients.filter(c => {
      if (c.status === 'terminado' || !c.end_of_cycle) return false;
      const days = differenceInDays(new Date(c.end_of_cycle), today);
      return days >= 0 && days <= 30;
    });

    const overdueProjects = d.projects.filter((p: ProjectLite) =>
      ['em_curso', 'em_revisao', 'em_pausa'].includes(p.status) &&
      p.deadline && new Date(p.deadline) < today
    );

    const overdueTasks = d.tasks.filter((t: TaskLite) => isTaskOverdue(t, today));

    const overloadedMembers = capacity ? capacity.overloadedCount : 0;

    const staleLeads = d.leads.filter((l: LeadLite) => {
      if (l.status === 'ganho' || l.status === 'perdido') return false;
      const ref = l.next_followup || l.created_at;
      if (!ref) return false;
      return differenceInDays(today, new Date(ref)) >= 14;
    });

    // Detractors (NPS ≤ 6) in last 90 days
    const detractors = d.npsRecords.filter((r: NpsLite) => Number(r.nps_score) <= 6);

    // Expenses up vs prev month?
    const expenseDeltaPct = prevMonthExpenses > 0
      ? Math.round(((monthExpenses - prevMonthExpenses) / prevMonthExpenses) * 100)
      : 0;

    // ── Department health ────────────────────────────────────────
    const tasksByDept = (dept: string) => (d.tasks || []).filter((t: TaskLite) => t.department === dept && isTaskOpen(t));
    const projectsByDept = (dept: string) => (d.projects || []).filter((p: ProjectLite) =>
      p.department === dept && ['em_curso', 'em_revisao', 'em_pausa'].includes(p.status)
    );

    const deptHealth = {
      comercial: {
        openLeads: d.leads.filter((l: LeadLite) => l.status !== 'ganho' && l.status !== 'perdido').length,
        staleLeads: staleLeads.length,
        monthRevenue,
        prevMonthRevenue,
        revenueDelta: prevMonthRevenue > 0 ? Math.round(((monthRevenue - prevMonthRevenue) / prevMonthRevenue) * 100) : 0,
      },
      marketing: {
        publishedMonth: d.contentMonth.filter((c: ContentLite) => c.status === 'publicado').length,
        scheduledMonth: d.contentMonth.filter((c: ContentLite) => c.status === 'agendado' || c.status === 'pronto').length,
        draftMonth: d.contentMonth.filter((c: ContentLite) => c.status === 'rascunho' || c.status === 'em_producao').length,
        ideas: d.contentIdeas.length,
        marketingProjects: d.projects.filter((p: ProjectLite) => p.department === 'marketing' && ['em_curso', 'em_revisao'].includes(p.status)).length,
      },
      operacao: {
        activeProjects: d.projects.filter((p: ProjectLite) => ['em_curso', 'em_revisao'].includes(p.status)).length,
        overdueProjects: overdueProjects.length,
        openTasks: d.tasks.filter(isTaskOpen).length,
        overdueTasks: overdueTasks.length,
      },
      financeiro: {
        monthRevenue,
        monthExpenses,
        net: monthlyNet,
        overdueSales: overdueSales.length,
        expenseDeltaPct,
      },
      clientes: {
        active: activeClients.length,
        renewal: renewalClients.length,
        onboarding: onboardingClients.length,
        avgNps,
        nearEnd: clientsNearEndOfCycle.length,
      },
      equipa: {
        total: capacity?.total ?? 0,
        usedPct: capacity?.pct ?? 0,
        overloaded: overloadedMembers,
      },
    };

    return {
      // pulse
      mrr,
      monthRevenue,
      prevMonthRevenue,
      yearRevenue,
      annualGoal: d.annualGoal,
      goalProgress,
      monthExpenses,
      monthlyNet,
      burn90,
      capacity,
      avgNps,
      activeClientsCount: activeClients.length,

      // alerts (ordered by urgency)
      alerts: {
        overdueSales,
        clientsNearEndOfCycle,
        overdueProjects,
        overdueTasks,
        overloadedMembers,
        staleLeads,
        detractors,
        expenseDeltaPct,
        renewalClients,
        onboardingClients,
        renegotiatingClients,
      },

      // department health
      deptHealth,

      // raw collections (for week focus block)
      meetings: d.meetings,
      tasks: d.tasks,
      members: d.members,
      projects: d.projects,
    };
  }, [query.data, currentMonth, today]);

  return { ...query, derived };
}