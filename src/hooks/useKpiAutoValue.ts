import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { DepartmentKpi } from './useDepartmentKpis';

const CACHE = { staleTime: 5 * 60 * 1000, gcTime: 10 * 60 * 1000 } as const;

// ── Helpers shared by all branches ────────────────────────────────────────
const monthOf = (v: string | number | null | undefined): number | null => {
  if (v == null) return null;
  if (typeof v === 'number') return v;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.getMonth() + 1;
};
const inMonths = (months: number[], dateField: string) => (r: Record<string, unknown>) => {
  const mm = monthOf(r[dateField] as string | number | null);
  return mm !== null && months.includes(mm);
};

/**
 * Resolves auto value for KPRs across a [startMonth, endMonth] window in a year.
 * Internally fetches **year-wide** data once (so all callers — monthly, quarterly,
 * annual — share the same TanStack cache entries) and filters by month at
 * resolve-time. `resolve(kpi, monthsOverride?)` allows callers (e.g. goals on
 * arbitrary periods) to override the default range without re-fetching.
 */
export function useKpiAutoValueRange(year: number, startMonth: number, endMonth: number) {
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;
  const yearEndTs = `${yearEnd}T23:59:59`;
  const defaultMonths: number[] = [];
  for (let m = startMonth; m <= endMonth; m++) defaultMonths.push(m);

  const sales = useQuery({
    queryKey: ['kpi-auto-sales', year],
    queryFn: async () => {
      const { data } = await supabase
        .from('commercial_sales')
        .select('invoice_total,product,product_id,sale_month')
        .eq('sale_year', year);
      return data || [];
    },
    ...CACHE,
  });

  const crm = useQuery({
    queryKey: ['kpi-auto-crm', year],
    queryFn: async () => {
      const { data } = await supabase
        .from('crm_leads')
        .select('id,potential_product_id,potential_product,created_at,added_at,updated_at,status,next_followup')
        .eq('status', 'ganho')
        .gte('created_at', yearStart)
        .lte('created_at', yearEndTs);
      return data || [];
    },
    ...CACHE,
  });

  // All leads in period (for conversion rates and tempo de fecho)
  const allLeads = useQuery({
    queryKey: ['kpi-auto-all-leads', year],
    queryFn: async () => {
      const { data } = await supabase
        .from('crm_leads')
        .select('id,status,added_at,updated_at,next_followup,potential_product_id')
        .gte('added_at', yearStart)
        .lte('added_at', yearEnd);
      return data || [];
    },
    ...CACHE,
  });

  // Pendentes globais (overdue follow-ups) — não dependem do período
  const pendingFollowups = useQuery({
    queryKey: ['kpi-auto-pending-followups'],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { count } = await supabase
        .from('crm_leads')
        .select('id', { count: 'exact', head: true })
        .not('next_followup', 'is', null)
        .lte('next_followup', today)
        .not('status', 'in', '(ganho,perdido)');
      return count ?? 0;
    },
    ...CACHE,
  });

  // Quotes (propostas) criadas no período
  const quotes = useQuery({
    queryKey: ['kpi-auto-quotes', year],
    queryFn: async () => {
      const { data } = await supabase
        .from('product_quotes')
        .select('id,lead_id,product_id,created_at')
        .gte('created_at', yearStart)
        .lte('created_at', yearEndTs);
      return data || [];
    },
    ...CACHE,
  });

  const activeClients = useQuery({
    queryKey: ['kpi-auto-clients-active'],
    queryFn: async () => {
      const { count } = await supabase
        .from('clients')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'ativo');
      return count ?? 0;
    },
    ...CACHE,
  });

  // Clientes com fase / produto / renovação
  const clientsFull = useQuery({
    queryKey: ['kpi-auto-clients-full'],
    queryFn: async () => {
      const { data } = await supabase
        .from('clients')
        .select('id,status,current_product_id,renewal_count');
      return data || [];
    },
    ...CACHE,
  });

  // Atividades de ciclo (renovações)
  const renewals = useQuery({
    queryKey: ['kpi-auto-renewals', year],
    queryFn: async () => {
      const { data } = await supabase
        .from('client_renewals')
        .select('client_id,cycle_number,completed,due_date')
        .gte('due_date', yearStart)
        .lte('due_date', yearEnd);
      return data || [];
    },
    ...CACHE,
  });

  const timeEntries = useQuery({
    queryKey: ['kpi-auto-time', year],
    queryFn: async () => {
      const { data } = await supabase
        .from('time_entries')
        .select('duration,entry_month,category,client_id')
        .eq('entry_year', year);
      return data || [];
    },
    ...CACHE,
  });

  const tasksDone = useQuery({
    queryKey: ['kpi-auto-tasks', year],
    queryFn: async () => {
      const { data } = await supabase
        .from('tasks')
        .select('id,department,updated_at,deadline,assigned_to,original_assignee,priority,status')
        .eq('status', 'done')
        .gte('updated_at', yearStart)
        .lte('updated_at', yearEndTs);
      return data || [];
    },
    ...CACHE,
  });

  // Tarefas P1/P2 (alta/media) em atraso — global
  const overdueTasks = useQuery({
    queryKey: ['kpi-auto-overdue-tasks'],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { count } = await supabase
        .from('tasks')
        .select('id', { count: 'exact', head: true })
        .in('priority', ['alta', 'media'])
        .neq('status', 'done')
        .not('deadline', 'is', null)
        .lt('deadline', today);
      return count ?? 0;
    },
    ...CACHE,
  });

  const team = useQuery({
    queryKey: ['kpi-auto-team'],
    queryFn: async () => {
      const { count } = await supabase
        .from('team_members')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'ativo');
      return count ?? 0;
    },
    ...CACHE,
  });

  // Capacidade total da equipa (soma de horas semanais esperadas dos ativos)
  const teamCapacity = useQuery({
    queryKey: ['kpi-auto-team-capacity'],
    queryFn: async () => {
      const { data } = await supabase
        .from('team_members')
        .select('expected_weekly_hours')
        .eq('status', 'ativo');
      return (data || []).reduce(
        (s: number, m: any) => s + Number(m.expected_weekly_hours || 0),
        0,
      );
    },
    ...CACHE,
  });

  // Objetivos anuais do ano (para progresso médio)
  const yearObjectives = useQuery({
    queryKey: ['kpi-auto-year-objectives', year],
    queryFn: async () => {
      const { data } = await supabase
        .from('executive_objectives')
        .select('id,target_value,current_value,year,status')
        .eq('year', year);
      return data || [];
    },
    ...CACHE,
  });

  // Renovações concluídas — lifetime, para taxa de ativação
  const renewalsCompletedAll = useQuery({
    queryKey: ['kpi-auto-renewals-completed-all'],
    queryFn: async () => {
      const { data } = await supabase
        .from('client_renewals')
        .select('client_id,completed')
        .eq('completed', true);
      return data || [];
    },
    ...CACHE,
  });

  const channelMetrics = useQuery({
    queryKey: ['kpi-auto-followers', year],
    queryFn: async () => {
      const { data } = await supabase
        .from('channel_monthly_metrics')
        .select('followers,channel_id,month,ig_accounts_reached,yt_total_views,ig_avg_saves')
        .eq('year', year);
      return data || [];
    },
    ...CACHE,
  });

  const content = useQuery({
    queryKey: ['kpi-auto-content', year],
    queryFn: async () => {
      const { data } = await supabase
        .from('content_items')
        .select('id,scheduled_at')
        .eq('status', 'publicado')
        .gte('scheduled_at', yearStart)
        .lte('scheduled_at', yearEndTs);
      return data || [];
    },
    ...CACHE,
  });

  const contentChannels = useQuery({
    queryKey: ['kpi-auto-content-channels'],
    queryFn: async () => {
      const { data } = await supabase.from('content_channels').select('content_id,channel_id');
      return data || [];
    },
    ...CACHE,
  });

  // Content metrics (saves/shares/impressions) no período
  const contentMetrics = useQuery({
    queryKey: ['kpi-auto-content-metrics', year],
    queryFn: async () => {
      const { data } = await supabase
        .from('content_metrics')
        .select('saves,shares,impressions,reach,views,month,year')
        .eq('year', year);
      return data || [];
    },
    ...CACHE,
  });

  const meetings = useQuery({
    queryKey: ['kpi-auto-meetings', year],
    queryFn: async () => {
      const { data } = await supabase
        .from('meetings')
        .select('id,department,client_id,date_time')
        .in('status', ['terminada', 'confirmada'])
        .gte('date_time', yearStart + 'T00:00:00')
        .lte('date_time', yearEndTs);
      return data || [];
    },
    ...CACHE,
  });

  const nps = useQuery({
    queryKey: ['kpi-auto-nps', year],
    queryFn: async () => {
      const { data } = await supabase
        .from('client_nps_records')
        .select('nps_score,client_id,actual_date')
        .not('nps_score', 'is', null)
        .gte('actual_date', yearStart)
        .lte('actual_date', yearEnd);
      return data || [];
    },
    ...CACHE,
  });

  const expenses = useQuery({
    queryKey: ['kpi-auto-expenses', year],
    queryFn: async () => {
      const { data } = await supabase
        .from('financial_expenses')
        .select('total_with_vat,category,monthly_equivalent,is_recurring,status,renewal_date,expense_date')
        .gte('expense_date', yearStart)
        .lte('expense_date', yearEnd);
      return data || [];
    },
    ...CACHE,
  });

  // Pagamentos em atraso — global (despesas com status pendente vencidas)
  const overdueExpenses = useQuery({
    queryKey: ['kpi-auto-overdue-expenses'],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { count } = await supabase
        .from('financial_expenses')
        .select('id', { count: 'exact', head: true })
        .neq('status', 'pago')
        .not('renewal_date', 'is', null)
        .lt('renewal_date', today);
      return count ?? 0;
    },
    ...CACHE,
  });

  // SOPs ativos — global
  const activeSops = useQuery({
    queryKey: ['kpi-auto-active-sops'],
    queryFn: async () => {
      const { count } = await supabase
        .from('sops')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'ativo');
      return count ?? 0;
    },
    ...CACHE,
  });

  // Produtos recorrentes (para MRR)
  const productsRecurring = useQuery({
    queryKey: ['kpi-auto-products-recurring'],
    queryFn: async () => {
      const { data } = await supabase
        .from('products')
        .select('id,name,cycle_renewable,base_price');
      return data || [];
    },
    ...CACHE,
  });

  // Projetos com deadline (para "no prazo")
  const activeProjects = useQuery({
    queryKey: ['kpi-auto-active-projects'],
    queryFn: async () => {
      const { data } = await supabase
        .from('projects')
        .select('id,status,deadline,archived_at')
        .is('archived_at', null)
        .in('status', ['em_curso', 'agendado']);
      return data || [];
    },
    ...CACHE,
  });

  const projectsDone = useQuery({
    queryKey: ['kpi-auto-projects', year],
    queryFn: async () => {
      const { data } = await supabase
        .from('projects')
        .select('id,type,updated_at')
        .eq('status', 'concluido')
        .is('archived_at', null)
        .gte('updated_at', yearStart)
        .lte('updated_at', yearEndTs);
      return data || [];
    },
    ...CACHE,
  });

  const metrics = useQuery({
    queryKey: ['kpi-auto-metrics'],
    queryFn: async () => {
      const { data } = await supabase.from('objective_metrics').select('id,current_value');
      return data || [];
    },
    ...CACHE,
  });

  const resolve = (kpi: DepartmentKpi, monthsOverride?: number[]): number | null => {
    const src = kpi.value_source;
    const sf = (kpi.source_filter as Record<string, string> | null) || {};
    if (!src || src === 'manual') return null;

    // Effective month window for this resolve call.
    const M = monthsOverride && monthsOverride.length > 0 ? monthsOverride : defaultMonths;
    const mStart = M[0];
    const mEnd = M[M.length - 1];
    // Filter year-wide datasets to the requested window.
    const inM = (field: string) => inMonths(M, field);
    const salesIn = ((sales.data || []) as Record<string, unknown>[]).filter(inM('sale_month'));
    const crmIn = ((crm.data || []) as Record<string, unknown>[]).filter(inM('created_at'));
    const allLeadsIn = ((allLeads.data || []) as Record<string, unknown>[]).filter(inM('added_at'));
    const quotesIn = ((quotes.data || []) as Record<string, unknown>[]).filter(inM('created_at'));
    const renewalsIn = ((renewals.data || []) as Record<string, unknown>[]).filter(inM('due_date'));
    const timeEntriesIn = ((timeEntries.data || []) as Record<string, unknown>[]).filter(inM('entry_month'));
    const tasksDoneIn = ((tasksDone.data || []) as Record<string, unknown>[]).filter(inM('updated_at'));
    const channelMetricsIn = ((channelMetrics.data || []) as Record<string, unknown>[]).filter(inM('month'));
    const contentIn = ((content.data || []) as Record<string, unknown>[]).filter(inM('scheduled_at'));
    const contentMetricsIn = ((contentMetrics.data || []) as Record<string, unknown>[]).filter(inM('month'));
    const meetingsIn = ((meetings.data || []) as Record<string, unknown>[]).filter(inM('date_time'));
    const npsIn = ((nps.data || []) as Record<string, unknown>[]).filter(inM('actual_date'));
    const expensesIn = ((expenses.data || []) as Record<string, unknown>[]).filter(inM('expense_date'));
    const projectsDoneIn = ((projectsDone.data || []) as Record<string, unknown>[]).filter(inM('updated_at'));

    if (src === 'metrica') {
      const m = (metrics.data || []).find((x: any) => x.id === (sf.metric_id || ''));
      return m ? Number((m as any).current_value || 0) : null;
    }
    if (src === 'bd_vendas' || src === 'commercial') {
      let rows = salesIn as any[];
      if (sf.product_id) rows = rows.filter((r) => r.product_id === sf.product_id);
      return rows.reduce((s, r) => s + Number(r.invoice_total || 0), 0);
    }
    if (src === 'bd_crm') {
      let rows = crmIn as any[];
      if (sf.product_id) rows = rows.filter((r) => r.potential_product_id === sf.product_id);
      return rows.length;
    }
    // === CRM avançado ===
    if (src === 'bd_crm_conv_sessao') {
      // % leads que receberam proposta = quotes únicos / leads adicionados no período
      const totalLeads = allLeadsIn.length;
      if (totalLeads === 0) return 0;
      const uniq = new Set(quotesIn.map((q: any) => q.lead_id).filter(Boolean));
      return Math.round((uniq.size / totalLeads) * 1000) / 10;
    }
    if (src === 'bd_crm_conv_proposta') {
      // % leads ganhos / leads com proposta
      const uniqQuotes = new Set(quotesIn.map((q: any) => q.lead_id).filter(Boolean));
      if (uniqQuotes.size === 0) return 0;
      const wonIds = new Set([
        ...(allLeadsIn as any[]).filter((l) => l.status === 'ganho').map((l) => l.id),
        ...(crmIn as any[]).map((l) => l.id),
      ]);
      const numerator = Array.from(wonIds).filter((id) => uniqQuotes.has(id)).length;
      return Math.round((numerator / uniqQuotes.size) * 1000) / 10;
    }
    if (src === 'bd_crm_tempo_fecho') {
      // Média dias entre added_at e updated_at para leads ganhos no período
      const rows = crmIn as any[];
      const days = rows
        .map((r) => {
          const a = r.added_at ? new Date(r.added_at) : (r.created_at ? new Date(r.created_at) : null);
          const u = r.updated_at ? new Date(r.updated_at) : null;
          if (!a || !u) return null;
          return (u.getTime() - a.getTime()) / (1000 * 60 * 60 * 24);
        })
        .filter((x): x is number => x !== null && x >= 0);
      if (days.length === 0) return null;
      return Math.round((days.reduce((s, d) => s + d, 0) / days.length) * 10) / 10;
    }
    if (src === 'bd_crm_followups') {
      // Follow-ups pendentes (vencidos) — quanto menor, melhor
      return pendingFollowups.data ?? 0;
    }

    if (src === 'bd_clientes') return activeClients.data ?? null;
    if (src === 'bd_clientes_fase_media') {
      // Média do cycle_number atual (max por cliente) entre clientes ativos
      const active = new Set(
        ((clientsFull.data || []) as any[]).filter((c) => c.status === 'ativo').map((c) => c.id),
      );
      if (active.size === 0) return null;
      const byClient: Record<string, number> = {};
      for (const r of renewalsIn as any[]) {
        if (!active.has(r.client_id)) continue;
        const cur = byClient[r.client_id] || 0;
        byClient[r.client_id] = Math.max(cur, Number(r.cycle_number || 0));
      }
      const vals = Object.values(byClient);
      // Para clientes sem renewals registadas, assumir ciclo 1
      const missing = active.size - vals.length;
      const total = vals.reduce((s, v) => s + v, 0) + missing * 1;
      return Math.round((total / active.size) * 10) / 10;
    }
    if (src === 'bd_clientes_renovacao') {
      // % de atividades de renovação concluídas no período
      const rows = renewalsIn as any[];
      if (rows.length === 0) return null;
      const done = rows.filter((r) => r.completed).length;
      return Math.round((done / rows.length) * 1000) / 10;
    }

    if (src === 'bd_tempo') {
      let rows = timeEntriesIn as any[];
      if (sf.category) rows = rows.filter((r) => r.category === sf.category);
      if (sf.client_id) rows = rows.filter((r) => r.client_id === sf.client_id);
      return rows.reduce((s, r) => s + Number(r.duration || 0), 0);
    }
    if (src === 'bd_tarefas') {
      let rows = tasksDoneIn as any[];
      if (sf.department) rows = rows.filter((r) => r.department === sf.department);
      return rows.length;
    }
    if (src === 'bd_tarefas_p1p2_atraso') {
      return overdueTasks.data ?? 0;
    }

    if (src === 'bd_equipa') return team.data ?? null;
    if (src === 'bd_capacidade_disponivel') {
      const weeklyTotal = teamCapacity.data ?? 0;
      const weeks = (M.length * 4.33);
      const available = weeklyTotal * weeks;
      const logged = (timeEntriesIn as any[]).reduce(
        (s, r) => s + Number(r.duration || 0),
        0,
      );
      return Math.round((available - logged) * 10) / 10;
    }
    if (src === 'bd_equipa_execucao_autonoma') {
      // % tarefas done que não foram reatribuídas (assigned_to == original_assignee ou original null)
      const rows = tasksDoneIn as any[];
      if (rows.length === 0) return null;
      const auton = rows.filter(
        (r) => !r.original_assignee || r.original_assignee === r.assigned_to,
      ).length;
      return Math.round((auton / rows.length) * 1000) / 10;
    }
    if (src === 'bd_equipa_entregas_a_tempo') {
      // % tarefas done concluídas até deadline
      const rows = (tasksDoneIn as any[]).filter((r) => r.deadline);
      if (rows.length === 0) return null;
      const onTime = rows.filter((r) => new Date(r.updated_at) <= new Date(r.deadline + 'T23:59:59')).length;
      return Math.round((onTime / rows.length) * 1000) / 10;
    }

    if (src === 'bd_marketing') {
      // Para "seguidores" usar snapshot do último mês do período (não somar meses).
      let rows = channelMetricsIn as any[];
      if (rows.length === 0) return 0;
      const latestMonth = Math.max(...rows.map((r) => Number(r.month || 0)));
      rows = rows.filter((r) => Number(r.month) === latestMonth);
      if (sf.channel_id) rows = rows.filter((r) => r.channel_id === sf.channel_id);
      return rows.reduce((s, r) => s + Number(r.followers || 0), 0);
    }
    if (src === 'bd_mkt_alcance_ig') {
      let rows = channelMetricsIn as any[];
      if (sf.channel_id) rows = rows.filter((r) => r.channel_id === sf.channel_id);
      return rows.reduce((s, r) => s + Number(r.ig_accounts_reached || 0), 0);
    }
    if (src === 'bd_mkt_views_youtube') {
      let rows = channelMetricsIn as any[];
      if (sf.channel_id) rows = rows.filter((r) => r.channel_id === sf.channel_id);
      return rows.reduce((s, r) => s + Number(r.yt_total_views || 0), 0);
    }
    if (src === 'bd_mkt_save_share') {
      // (saves + shares) / impressions × 100
      const rows = contentMetricsIn as any[];
      const saves = rows.reduce((s, r) => s + Number(r.saves || 0), 0);
      const shares = rows.reduce((s, r) => s + Number(r.shares || 0), 0);
      const impr = rows.reduce((s, r) => s + Number(r.impressions || r.reach || 0), 0);
      if (impr === 0) return null;
      return Math.round(((saves + shares) / impr) * 1000) / 10;
    }

    if (src === 'bd_conteudos') {
      let rows = contentIn as any[];
      if (sf.channel_id) {
        const links = (contentChannels.data || []) as any[];
        const ids = new Set(links.filter((l) => l.channel_id === sf.channel_id).map((l) => l.content_id));
        rows = rows.filter((r) => ids.has(r.id));
      }
      return rows.length;
    }
    if (src === 'bd_reunioes') {
      let rows = meetingsIn as any[];
      if (sf.department) rows = rows.filter((r) => r.department === sf.department);
      return rows.length;
    }
    if (src === 'bd_nps') {
      let rows = npsIn as any[];
      if (sf.client_id) rows = rows.filter((r) => r.client_id === sf.client_id);
      if (rows.length === 0) return null;
      const sum = rows.reduce((s, r) => s + Number(r.nps_score), 0);
      return Math.round((sum / rows.length) * 10) / 10;
    }
    if (src === 'bd_despesas') {
      let rows = expensesIn as any[];
      if (sf.category) rows = rows.filter((r) => r.category === sf.category);
      return rows.reduce((s, r) => s + Number(r.total_with_vat || 0), 0);
    }
    if (src === 'bd_projetos') {
      let rows = projectsDoneIn as any[];
      if (sf.type) rows = rows.filter((r) => r.type === sf.type);
      return rows.length;
    }
    if (src === 'bd_projetos_no_prazo') {
      const rows = (activeProjects.data || []) as any[];
      if (rows.length === 0) return null;
      const today = new Date().toISOString().slice(0, 10);
      const onTime = rows.filter((r) => !r.deadline || r.deadline >= today).length;
      return Math.round((onTime / rows.length) * 1000) / 10;
    }

    // === Financeiro ===
    if (src === 'bd_fin_mrr') {
      // Soma de vendas no período cujo produto é recorrente (cycle_renewable=true)
      const recurringIds = new Set(
        ((productsRecurring.data || []) as any[]).filter((p) => p.cycle_renewable).map((p) => p.id),
      );
      const rows = (salesIn as any[]).filter((s) => recurringIds.has(s.product_id));
      const total = rows.reduce((s, r) => s + Number(r.invoice_total || 0), 0);
      // MRR mensal médio no intervalo
      const monthSpan = M.length;
      return Math.round((total / monthSpan) * 100) / 100;
    }
    if (src === 'bd_fin_receita_variavel') {
      const recurringIds = new Set(
        ((productsRecurring.data || []) as any[]).filter((p) => p.cycle_renewable).map((p) => p.id),
      );
      const rows = (salesIn as any[]).filter((s) => !recurringIds.has(s.product_id));
      return Math.round(rows.reduce((s, r) => s + Number(r.invoice_total || 0), 0) * 100) / 100;
    }
    if (src === 'bd_fin_custos_ratio') {
      const totalRev = (salesIn as any[]).reduce((s, r) => s + Number(r.invoice_total || 0), 0);
      if (totalRev === 0) return null;
      const fixed = (expensesIn as any[])
        .filter((e) => e.is_recurring)
        .reduce((s, e) => s + Number(e.total_with_vat || 0), 0);
      return Math.round((fixed / totalRev) * 1000) / 10;
    }
    if (src === 'bd_fin_breakeven') {
      const rev = (salesIn as any[]).reduce((s, r) => s + Number(r.invoice_total || 0), 0);
      const cost = (expensesIn as any[]).reduce((s, e) => s + Number(e.total_with_vat || 0), 0);
      return Math.round((rev - cost) * 100) / 100;
    }
    if (src === 'bd_fin_pagamentos_atraso') {
      return overdueExpenses.data ?? 0;
    }

    // === Operação ===
    if (src === 'bd_ops_sops_ativos') {
      return activeSops.data ?? 0;
    }

    // === Produtos ===
    if (src === 'bd_produtos_assinaturas') {
      // Clientes ativos com produto recorrente
      const recurringIds = new Set(
        ((productsRecurring.data || []) as any[]).filter((p) => p.cycle_renewable).map((p) => p.id),
      );
      const rows = ((clientsFull.data || []) as any[]).filter(
        (c) => c.status === 'ativo' && recurringIds.has(c.current_product_id),
      );
      if (sf.product_id) {
        return rows.filter((c) => c.current_product_id === sf.product_id).length;
      }
      return rows.length;
    }
    if (src === 'bd_produtos_ticket_medio') {
      let rows = salesIn as any[];
      if (sf.product_id) rows = rows.filter((r) => r.product_id === sf.product_id);
      if (rows.length === 0) return null;
      const avg = rows.reduce((s, r) => s + Number(r.invoice_total || 0), 0) / rows.length;
      return Math.round(avg * 100) / 100;
    }
    if (src === 'bd_produtos_ativacao') {
      // % clientes ativos com produto sf.product_id que têm pelo menos uma renewal completed
      const allClients = ((clientsFull.data || []) as any[]).filter((c) => c.status === 'ativo');
      const target = sf.product_id
        ? allClients.filter((c) => c.current_product_id === sf.product_id)
        : allClients;
      if (target.length === 0) return null;
      const activated = new Set(((renewalsCompletedAll.data || []) as any[]).map((r) => r.client_id));
      const num = target.filter((c) => activated.has(c.id)).length;
      return Math.round((num / target.length) * 1000) / 10;
    }

    // === Geral / Estratégico ===
    if (src === 'bd_objetivos_progresso') {
      const rows = (yearObjectives.data || []) as any[];
      const usable = rows.filter((o) => Number(o.target_value || 0) > 0);
      if (usable.length === 0) return null;
      const sum = usable.reduce((s, o) => {
        const pct = Math.min(100, (Number(o.current_value || 0) / Number(o.target_value)) * 100);
        return s + pct;
      }, 0);
      return Math.round((sum / usable.length) * 10) / 10;
    }

    // === Geral ===
    if (src === 'bd_geral_mrr_ratio') {
      const recurringIds = new Set(
        ((productsRecurring.data || []) as any[]).filter((p) => p.cycle_renewable).map((p) => p.id),
      );
      const totalRev = (salesIn as any[]).reduce((s, r) => s + Number(r.invoice_total || 0), 0);
      if (totalRev === 0) return null;
      const mrr = (salesIn as any[])
        .filter((s) => recurringIds.has(s.product_id))
        .reduce((s, r) => s + Number(r.invoice_total || 0), 0);
      return Math.round((mrr / totalRev) * 1000) / 10;
    }
    if (src === 'bd_geral_velocidade_mrr') {
      // Variação MRR primeiro mês vs último mês do range (€)
      if (M.length < 2) return 0;
      const recurringIds = new Set(
        ((productsRecurring.data || []) as any[]).filter((p) => p.cycle_renewable).map((p) => p.id),
      );
      const rows = (salesIn as any[]).filter((s) => recurringIds.has(s.product_id));
      const first = rows
        .filter((r) => r.sale_month === mStart)
        .reduce((s, r) => s + Number(r.invoice_total || 0), 0);
      const last = rows
        .filter((r) => r.sale_month === mEnd)
        .reduce((s, r) => s + Number(r.invoice_total || 0), 0);
      return Math.round((last - first) * 100) / 100;
    }

    return null;
  };

  const isLoading =
    sales.isLoading || crm.isLoading || activeClients.isLoading || timeEntries.isLoading ||
    tasksDone.isLoading || team.isLoading || channelMetrics.isLoading || content.isLoading ||
    meetings.isLoading || nps.isLoading || expenses.isLoading || projectsDone.isLoading;

  return { resolve, isLoading };
}

/** Backwards-compatible monthly wrapper */
export function useKpiAutoValue(year: number, month: number) {
  return useKpiAutoValueRange(year, month, month);
}

/** Helpers */
export function quarterRange(quarter: number): [number, number] {
  const start = (quarter - 1) * 3 + 1;
  return [start, start + 2];
}