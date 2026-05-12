import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Aggregates real business KPIs for a given quarter (and previous quarter for
 * growth comparison). Pulls directly from operational tables — no dependency
 * on planning goals being defined.
 */
export function useQuarterBusinessSummary(year: number, quarterIdx: number) {
  return useQuery({
    queryKey: ['quarter-business-summary', year, quarterIdx],
    queryFn: async () => {
      const startMonth = quarterIdx * 3 + 1;
      const endMonth = startMonth + 2;
      const start = `${year}-${String(startMonth).padStart(2, '0')}-01`;
      const endLast = new Date(year, endMonth, 0); // last day of endMonth
      const end = `${year}-${String(endMonth).padStart(2, '0')}-${String(endLast.getDate()).padStart(2, '0')}`;

      // Previous quarter (handle Q1 -> previous year Q4)
      const prevQ = quarterIdx === 0 ? 3 : quarterIdx - 1;
      const prevYear = quarterIdx === 0 ? year - 1 : year;
      const prevStartMonth = prevQ * 3 + 1;
      const prevEndMonth = prevStartMonth + 2;
      const prevStart = `${prevYear}-${String(prevStartMonth).padStart(2, '0')}-01`;
      const prevEndLast = new Date(prevYear, prevEndMonth, 0);
      const prevEnd = `${prevYear}-${String(prevEndMonth).padStart(2, '0')}-${String(prevEndLast.getDate()).padStart(2, '0')}`;

      const months = [startMonth, startMonth + 1, startMonth + 2];
      const prevMonths = [prevStartMonth, prevStartMonth + 1, prevStartMonth + 2];

      const [
        salesCur, salesPrev,
        leadsCur, leadsPrev,
        leadsWonCur, leadsWonPrev,
        expensesCur, expensesPrev,
        tasksDoneCur, tasksDonePrevRes,
        meetingsCur,
        npsCur,
        timeCur, timePrev,
        clientsActiveRes,
        newClientsCur, newClientsPrev,
      ] = await Promise.all([
        supabase.from('commercial_sales').select('invoice_total,sale_month').eq('sale_year', year).in('sale_month', months),
        supabase.from('commercial_sales').select('invoice_total,sale_month').eq('sale_year', prevYear).in('sale_month', prevMonths),
        supabase.from('crm_leads').select('id').gte('added_at', start).lte('added_at', end + 'T23:59:59'),
        supabase.from('crm_leads').select('id').gte('added_at', prevStart).lte('added_at', prevEnd + 'T23:59:59'),
        supabase.from('crm_leads').select('id').eq('status', 'ganho').gte('added_at', start).lte('added_at', end + 'T23:59:59'),
        supabase.from('crm_leads').select('id').eq('status', 'ganho').gte('added_at', prevStart).lte('added_at', prevEnd + 'T23:59:59'),
        supabase.from('financial_expenses').select('total_with_vat').gte('expense_date', start).lte('expense_date', end),
        supabase.from('financial_expenses').select('total_with_vat').gte('expense_date', prevStart).lte('expense_date', prevEnd),
        supabase.from('tasks').select('id,department').eq('status', 'done').gte('updated_at', start).lte('updated_at', end + 'T23:59:59'),
        supabase.from('tasks').select('id').eq('status', 'done').gte('updated_at', prevStart).lte('updated_at', prevEnd + 'T23:59:59'),
        supabase.from('meetings').select('id,department').in('status', ['terminada', 'confirmada']).gte('date_time', start + 'T00:00:00').lte('date_time', end + 'T23:59:59'),
        supabase.from('client_nps_records').select('nps_score').not('nps_score', 'is', null).gte('actual_date', start).lte('actual_date', end),
        supabase.from('time_entries').select('duration').eq('entry_year', year).in('entry_month', months),
        supabase.from('time_entries').select('duration').eq('entry_year', prevYear).in('entry_month', prevMonths),
        supabase.from('clients').select('id').eq('status', 'ativo'),
        supabase.from('clients').select('id').gte('created_at', start).lte('created_at', end + 'T23:59:59'),
        supabase.from('clients').select('id').gte('created_at', prevStart).lte('created_at', prevEnd + 'T23:59:59'),
      ]);

      const sum = (rows: any[] | null | undefined, key: string) =>
        (rows || []).reduce((s: number, r: any) => s + Number(r[key] || 0), 0);
      const len = (rows: any[] | null | undefined) => (rows || []).length;
      const growth = (cur: number, prev: number) => {
        if (prev === 0) return cur > 0 ? 100 : 0;
        return Math.round(((cur - prev) / prev) * 100);
      };

      const revenue = sum(salesCur.data, 'invoice_total');
      const revenuePrev = sum(salesPrev.data, 'invoice_total');
      const expenses = sum(expensesCur.data, 'total_with_vat');
      const expensesPrevVal = sum(expensesPrev.data, 'total_with_vat');
      const margin = revenue - expenses;
      const marginPrev = revenuePrev - expensesPrevVal;
      const leadsTotal = len(leadsCur.data);
      const leadsWon = len(leadsWonCur.data);
      const conversion = leadsTotal ? Math.round((leadsWon / leadsTotal) * 100) : 0;
      const tasksDone = len(tasksDoneCur.data);
      const tasksDonePrev = len(tasksDonePrevRes.data);
      const npsScores = (npsCur.data || []).map((r: any) => Number(r.nps_score));
      const npsAvg = npsScores.length ? Math.round((npsScores.reduce((a, b) => a + b, 0) / npsScores.length) * 10) / 10 : null;
      const hours = sum(timeCur.data, 'duration') / 60;
      const hoursPrev = sum(timePrev.data, 'duration') / 60;

      // Tasks per department
      const tasksByDept: Record<string, number> = {};
      (tasksDoneCur.data || []).forEach((t: any) => {
        const k = t.department || 'sem_dept';
        tasksByDept[k] = (tasksByDept[k] || 0) + 1;
      });

      return {
        revenue, revenuePrev, revenueGrowth: growth(revenue, revenuePrev),
        expenses, expensesPrev: expensesPrevVal, expensesGrowth: growth(expenses, expensesPrevVal),
        margin, marginPrev, marginGrowth: growth(margin, marginPrev),
        leadsTotal, leadsTotalPrev: len(leadsPrev.data), leadsGrowth: growth(leadsTotal, len(leadsPrev.data)),
        leadsWon, leadsWonPrev: len(leadsWonPrev.data), conversion,
        newClients: len(newClientsCur.data),
        newClientsPrev: len(newClientsPrev.data),
        newClientsGrowth: growth(len(newClientsCur.data), len(newClientsPrev.data)),
        clientsActive: len(clientsActiveRes.data),
        tasksDone, tasksDonePrev, tasksGrowth: growth(tasksDone, tasksDonePrev),
        tasksByDept,
        meetings: len(meetingsCur.data),
        npsAvg, npsCount: npsScores.length,
        hours, hoursPrev, hoursGrowth: growth(hours, hoursPrev),
      };
    },
    staleTime: 5 * 60 * 1000,
  });
}