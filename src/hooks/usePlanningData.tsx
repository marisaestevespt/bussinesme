import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// cleanPayload imported from utils — aliased as `clean` for minimal diff
import { cleanPayload as clean } from '@/lib/utils';
import { sumRevenue } from '@/lib/salesCalculations';
import type {
  PlanningFormPayload,
  ObjectiveRow,
  CriterionRow,
  GoalRow,
  MetricRow,
  MetricHistoryRow,
  ActionRow,
  AutoSalesRow,
  AutoCrmRow,
  AutoTimeEntryRow,
  AutoTaskRow,
  AutoMarketingFollowersRow,
  AutoContentItemRow,
  AutoContentChannelRow,
  AutoMeetingRow,
  AutoNpsRow,
  AutoExpenseRow,
  AutoProjectRow,
  ProductLite,
} from '@/types/planning';

const currentYear = new Date().getFullYear();

export const PLAN_AREAS = [
  { value: 'comercial', label: 'Comercial' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'financeiro', label: 'Financeiro' },
  { value: 'operacao', label: 'Operação' },
  { value: 'clientes', label: 'Clientes' },
  { value: 'produtos', label: 'Produtos' },
  { value: 'equipa', label: 'Equipa' },
  { value: 'geral', label: 'Geral' },
];

export const PLAN_STATUSES = [
  { value: 'por_iniciar', label: 'Por iniciar' },
  { value: 'em_curso', label: 'Em curso' },
  { value: 'atingido', label: 'Atingido' },
  { value: 'abandonado', label: 'Abandonado' },
];

export const GOAL_STATUSES = [
  { value: 'por_iniciar', label: 'Por iniciar' },
  { value: 'em_curso', label: 'Em curso' },
  { value: 'atingido', label: 'Atingido' },
  { value: 'nao_atingido', label: 'Não atingido' },
];

export const VALUE_SOURCES = [
  { value: 'manual', label: 'Manual', area: null, desc: 'Introduzir valores manualmente' },
  { value: 'metrica', label: 'Métrica na Ficha', area: null, desc: 'Progresso via métrica com tracking periódico' },
  { value: 'bd_vendas', label: 'Faturação (Vendas)', area: 'financeiro', desc: 'Soma de vendas registadas no período' },
  { value: 'bd_crm', label: 'Leads ganhos (CRM)', area: 'comercial', desc: 'Contagem de leads com status ganho' },
  { value: 'bd_clientes', label: 'Clientes ativos', area: 'comercial', desc: 'Nº de clientes com status ativo' },
  { value: 'bd_tempo', label: 'Horas registadas (Timer)', area: 'operacao', desc: 'Soma de horas do time tracker no ano' },
  { value: 'bd_tarefas', label: 'Tarefas concluídas', area: 'operacao', desc: 'Contagem de tarefas com status concluída' },
  { value: 'bd_equipa', label: 'Membros da equipa', area: 'equipa', desc: 'Nº de membros ativos na equipa' },
  { value: 'bd_marketing', label: 'Seguidores (Marketing)', area: 'marketing', desc: 'Total de seguidores dos canais de marketing' },
  { value: 'bd_conteudos', label: 'Conteúdos publicados', area: 'marketing', desc: 'Nº de conteúdos publicados no ano' },
  { value: 'bd_reunioes', label: 'Reuniões realizadas', area: 'comercial', desc: 'Nº de reuniões realizadas no ano' },
  { value: 'bd_nps', label: 'NPS médio', area: 'comercial', desc: 'Média dos scores NPS registados' },
  { value: 'bd_despesas', label: 'Despesas totais', area: 'financeiro', desc: 'Soma de saídas/despesas no ano' },
  { value: 'bd_projetos', label: 'Projetos concluídos', area: 'operacao', desc: 'Nº de projetos com status concluído' },
];

export const MEASUREMENT_TYPES = [
  { value: 'acumulativo', label: 'Acumulativo' },
  { value: 'progressivo', label: 'Progressivo' },
];

export const CADENCES = [
  { value: 'diaria', label: 'Diária' },
  { value: 'semanal', label: 'Semanal' },
  { value: 'mensal', label: 'Mensal' },
];

export const PERIODS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
  'T1', 'T2', 'T3', 'T4',
  'S1', 'S2',
];

export const ACTION_STATUSES = [
  { value: 'por_fazer', label: 'Por fazer' },
  { value: 'em_curso', label: 'Em curso' },
  { value: 'feito', label: 'Feito' },
  { value: 'cancelado', label: 'Cancelado' },
];

export function planAreaLabel(v: string) {
  return PLAN_AREAS.find(a => a.value === v)?.label || v;
}

export function planStatusLabel(v: string) {
  return [...PLAN_STATUSES, ...GOAL_STATUSES, ...ACTION_STATUSES].find(s => s.value === v)?.label || v;
}

export function usePlanningData(year = currentYear) {
  const qc = useQueryClient();
  const key = ['planning', year];
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['planning'] });
    qc.invalidateQueries({ queryKey: ['commercial'] });
  };

  const MONTH_NAMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

  // ─── Period normalization (canonical ↔ legacy) ───
  // DB canonical: 'Q1'..'Q4', 'S1'..'S2', 'YYYY-MM', 'YYYY'.
  // UI legacy: 'T1'..'T4', 'Janeiro'..'Dezembro'.
  // We keep the UI on legacy strings to avoid widespread refactors;
  // conversion happens at IO boundary only.
  const periodCanonicalToLegacy = (p: string | null | undefined): string => {
    if (!p) return '';
    if (/^Q[1-4]$/.test(p)) return 'T' + p.slice(1);
    const m = p.match(/^\d{4}-(\d{2})$/);
    if (m) {
      const idx = parseInt(m[1], 10) - 1;
      return MONTH_NAMES[idx] ?? p;
    }
    return p;
  };
  const periodLegacyToCanonical = (p: string | null | undefined): string => {
    if (!p) return '';
    if (/^T[1-4]$/.test(p)) return 'Q' + p.slice(1);
    const idx = MONTH_NAMES.indexOf(p);
    if (idx >= 0) return `${year}-${String(idx + 1).padStart(2, '0')}`;
    return p;
  };

  // Sync commercial objective → commercial_annual_goals
  const syncObjectiveToCommercial = async (obj: PlanningFormPayload) => {
    if (obj.value_source !== 'commercial' || obj.area !== 'comercial') return;
    try {
      const targetValue = Number(obj.target_value) || 0;
      const { data: existing } = await supabase
        .from('commercial_annual_goals')
        .select('id')
        .eq('year', year)
        .maybeSingle();
      if (existing) {
        await supabase.from('commercial_annual_goals').update({ goal_amount: targetValue }).eq('id', existing.id);
      } else {
        await supabase.from('commercial_annual_goals').insert({ year, goal_amount: targetValue });
      }
    } catch (e) { console.error('Sync objective→commercial failed', e); }
  };

  // Sync planning goal → commercial_monthly_goals OR commercial_quarterly_goals
  const syncGoalToCommercial = async (rec: PlanningFormPayload) => {
    if (!rec.objective_id) return;
    try {
      const { data: obj } = await supabase
        .from('executive_objectives')
        .select('value_source, area')
        .eq('id', rec.objective_id as string)
        .maybeSingle();
      if (!obj || obj.value_source !== 'commercial' || obj.area !== 'comercial') return;
      const period = String((rec as { period?: unknown }).period ?? '');
      const goalAmount = Number(rec.target_value) || 0;

      // Trimestral: T1..T4 OR Q1..Q4 (canonical) → commercial_quarterly_goals
      const qMatch = period.match(/^[TQ]([1-4])$/);
      if (qMatch) {
        const quarter = Number(qMatch[1]);
        const { data: existing } = await supabase
          .from('commercial_quarterly_goals')
          .select('id')
          .eq('year', year)
          .eq('quarter', quarter)
          .maybeSingle();
        if (existing) {
          await supabase.from('commercial_quarterly_goals').update({ goal_amount: goalAmount }).eq('id', existing.id);
        } else {
          await supabase.from('commercial_quarterly_goals').insert({ year, quarter, goal_amount: goalAmount });
        }
        return;
      }

      // Mensal: nome do mês OU 'YYYY-MM' (canonical) → commercial_monthly_goals
      let month = 0;
      const ymMatch = period.match(/^\d{4}-(\d{2})$/);
      if (ymMatch) {
        month = parseInt(ymMatch[1], 10);
      } else {
        const monthIdx = MONTH_NAMES.indexOf(period);
        if (monthIdx === -1) return;
        month = monthIdx + 1;
      }
      const { data: existing } = await supabase
        .from('commercial_monthly_goals')
        .select('id')
        .eq('year', year)
        .eq('month', month)
        .maybeSingle();
      if (existing) {
        await supabase.from('commercial_monthly_goals').update({ goal_amount: goalAmount }).eq('id', existing.id);
      } else {
        await supabase.from('commercial_monthly_goals').insert({ year, month, goal_amount: goalAmount });
      }
    } catch (e) { console.error('Sync goal→commercial failed', e); }
  };

  // ─── Objectives ──────────────────
  const objectives = useQuery({
    queryKey: [...key, 'objectives'],
    queryFn: async () => {
      const { data } = await supabase.from('executive_objectives').select('*').eq('year', year).order('created_at');
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const upsertObjective = useMutation({
    mutationFn: async (raw: PlanningFormPayload) => {
      const obj = clean(raw);
      if (obj.id) {
        const { error } = await supabase.from('executive_objectives').update(obj as never).eq('id', obj.id as string);
        if (error) throw error;
      } else {
        delete obj.id;
        const { error } = await supabase.from('executive_objectives').insert({ ...obj, year } as never);
        if (error) throw error;
      }
      await syncObjectiveToCommercial(obj);
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error('Erro ao guardar objetivo: ' + (e.message || e)),
  });

  const deleteObjective = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('executive_objectives').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  // ─── Criteria (qualitative) ──────────────────
  const criteria = useQuery({
    queryKey: [...key, 'criteria'],
    queryFn: async () => {
      const { data } = await supabase.from('objective_criteria').select('*').order('sort_order');
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const upsertCriterion = useMutation({
    mutationFn: async (raw: PlanningFormPayload) => {
      const rec = clean(raw);
      if (rec.id) {
        const { error } = await supabase.from('objective_criteria').update(rec as never).eq('id', rec.id as string);
        if (error) throw error;
      } else {
        delete rec.id;
        const { error } = await supabase.from('objective_criteria').insert(rec as never);
        if (error) throw error;
      }
    },
    onSuccess: invalidate,
  });

  const deleteCriterion = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('objective_criteria').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  // ─── Planning Goals (Metas) ──────────────────
  const goals = useQuery({
    queryKey: [...key, 'goals'],
    queryFn: async () => {
      const { data } = await supabase.from('planning_goals').select('*').eq('year', year).order('created_at');
      // Expose legacy period strings to existing UI consumers
      return (data || []).map((g) => ({
        ...g,
        period_canonical: g.period,
        period: periodCanonicalToLegacy(g.period as string),
      }));
    },
    staleTime: 5 * 60 * 1000,
  });

  const upsertGoal = useMutation({
    mutationFn: async (raw: PlanningFormPayload) => {
      const rec = clean(raw);
      // Convert legacy period strings → canonical before persisting
      if (rec.period && typeof rec.period === 'string') {
        const canonical = periodLegacyToCanonical(rec.period);
        rec.period = canonical;
        rec.period_type = canonical.startsWith('Q')
          ? 'trimestral'
          : canonical.startsWith('S')
            ? 'semestral'
            : /^\d{4}-\d{2}$/.test(canonical)
              ? 'mensal'
              : 'anual';
      }
      if (rec.id) {
        const { error } = await supabase.from('planning_goals').update(rec as never).eq('id', rec.id as string);
        if (error) throw error;
      } else {
        delete rec.id;
        const { error } = await supabase.from('planning_goals').insert({ ...rec, year } as never);
        if (error) throw error;
      }
      await syncGoalToCommercial(rec);
    },
    onSuccess: invalidate,
    onError: () => toast.error('Erro ao guardar meta'),
  });

  const deleteGoal = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('planning_goals').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  // ─── Metrics ──────────────────
  const metrics = useQuery({
    queryKey: [...key, 'metrics'],
    queryFn: async () => {
      const { data } = await supabase.from('objective_metrics').select('*').order('created_at');
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const upsertMetric = useMutation({
    mutationFn: async (raw: PlanningFormPayload) => {
      const rec = clean(raw);
      if (rec.id) {
        const { error } = await supabase.from('objective_metrics').update(rec as never).eq('id', rec.id as string);
        if (error) throw error;
      } else {
        delete rec.id;
        const { error } = await supabase.from('objective_metrics').insert(rec as never);
        if (error) throw error;
      }
    },
    onSuccess: invalidate,
  });

  const deleteMetric = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('objective_metrics').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  // ─── Metric History ──────────────────
  const metricHistory = useQuery({
    queryKey: [...key, 'metric_history'],
    queryFn: async () => {
      const { data } = await supabase.from('metric_history').select('*').order('recorded_at', { ascending: true });
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const addMetricRecord = useMutation({
    mutationFn: async (raw: PlanningFormPayload) => {
      const rec = clean(raw);
      delete rec.id;
      const { error } = await supabase.from('metric_history').insert(rec as never);
      if (error) throw error;
      // update current_value on the metric
      if (rec.metric_id && rec.value != null) {
        await supabase
          .from('objective_metrics')
          .update({ current_value: rec.value as number, last_updated_at: new Date().toISOString() } as never)
          .eq('id', rec.metric_id as string);
      }
    },
    onSuccess: invalidate,
  });

  // ─── Actions ──────────────────
  const actions = useQuery({
    queryKey: [...key, 'actions'],
    queryFn: async () => {
      const { data } = await supabase.from('objective_actions').select('*').order('created_at');
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const upsertAction = useMutation({
    mutationFn: async (raw: PlanningFormPayload) => {
      const rec = clean(raw);
      if (rec.id) {
        const { error } = await supabase.from('objective_actions').update(rec as never).eq('id', rec.id as string);
        if (error) throw error;
      } else {
        delete rec.id;
        const { error } = await supabase.from('objective_actions').insert(rec as never);
        if (error) throw error;
      }
    },
    onSuccess: invalidate,
  });

  const deleteAction = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('objective_actions').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const convertActionToTask = useMutation({
    mutationFn: async (action: ActionRow) => {
      // Create task
      const { data: task, error } = await supabase.from('tasks').insert({
        name: action.description,
        deadline: action.deadline || null,
        assigned_to: action.responsible_id || null,
        status: action.status === 'feito' ? 'done' : 'por_comecar',
      } as never).select('id').single();
      if (error) throw error;
      // Link task to action
      await supabase
        .from('objective_actions')
        .update({ task_id: task.id, action_type: 'tarefa' } as never)
        .eq('id', action.id);
    },
    onSuccess: () => { invalidate(); toast.success('Ação convertida em tarefa'); },
    onError: () => toast.error('Erro ao converter ação'),
  });

  // ─── Auto-calculated values (only load when objectives need them) ──────────────────
  const needsAutoCalc = (objectives.data || []).some((o) => o.value_source && o.value_source !== 'manual');
  const AUTO_CACHE = { staleTime: 5 * 60 * 1000, gcTime: 10 * 60 * 1000 } as const;

  const autoSalesRaw = useQuery({
    queryKey: ['auto-sales-raw', year],
    queryFn: async () => {
      const { data } = await supabase.from('commercial_sales').select('invoice_total,product,product_id,sale_month').eq('sale_year', year);
      return data || [];
    },
    enabled: needsAutoCalc,
    ...AUTO_CACHE,
  });

  const autoCrmRaw = useQuery({
    queryKey: ['auto-crm-raw', year],
    queryFn: async () => {
      const { data } = await supabase.from('crm_leads').select('id,potential_product,potential_product_id,created_at').eq('status', 'ganho');
      return data || [];
    },
    enabled: needsAutoCalc,
    ...AUTO_CACHE,
  });

  const autoActiveClients = useQuery({
    queryKey: ['auto-active-clients'],
    queryFn: async () => {
      const { data } = await supabase.from('clients').select('id').eq('status', 'ativo');
      return (data || []).length;
    },
    enabled: needsAutoCalc,
    ...AUTO_CACHE,
  });

  const autoTimeEntries = useQuery({
    queryKey: ['auto-time-entries', year],
    queryFn: async () => {
      const { data } = await supabase.from('time_entries').select('duration,entry_month,category,client_id').eq('entry_year', year);
      return data || [];
    },
    enabled: needsAutoCalc,
    ...AUTO_CACHE,
  });

  const autoTasksCompleted = useQuery({
    queryKey: ['auto-tasks-completed', year],
    queryFn: async () => {
      const startDate = `${year}-01-01`;
      const endDate = `${year}-12-31`;
      const { data } = await supabase.from('tasks').select('id,updated_at,department').eq('status', 'done').gte('updated_at', startDate).lte('updated_at', endDate + 'T23:59:59');
      return data || [];
    },
    enabled: needsAutoCalc,
    ...AUTO_CACHE,
  });

  const autoTeamMembers = useQuery({
    queryKey: ['auto-team-members'],
    queryFn: async () => {
      const { data } = await supabase.from('team_members').select('id').eq('status', 'ativo');
      return (data || []).length;
    },
    enabled: needsAutoCalc,
    ...AUTO_CACHE,
  });

  const autoMarketingFollowersRaw = useQuery({
    queryKey: ['auto-marketing-followers-raw', year],
    queryFn: async () => {
      const { data } = await supabase.from('channel_monthly_metrics').select('followers,channel_id,month').eq('year', year).order('month', { ascending: false });
      return data || [];
    },
    enabled: needsAutoCalc,
    ...AUTO_CACHE,
  });

  const autoContentRaw = useQuery({
    queryKey: ['auto-content-raw', year],
    queryFn: async () => {
      const startDate = `${year}-01-01`;
      const endDate = `${year}-12-31T23:59:59`;
      const { data } = await supabase.from('content_items').select('id,product_id,scheduled_at').eq('status', 'publicado').gte('scheduled_at', startDate).lte('scheduled_at', endDate);
      return data || [];
    },
    enabled: needsAutoCalc,
    ...AUTO_CACHE,
  });

  const autoContentChannels = useQuery({
    queryKey: ['auto-content-channels', year],
    queryFn: async () => {
      const { data } = await supabase.from('content_channels').select('content_id,channel_id');
      return data || [];
    },
    enabled: needsAutoCalc,
    ...AUTO_CACHE,
  });

  const autoMeetingsRaw = useQuery({
    queryKey: ['auto-meetings-raw', year],
    queryFn: async () => {
      const startDate = `${year}-01-01T00:00:00`;
      const endDate = `${year}-12-31T23:59:59`;
      const { data } = await supabase.from('meetings').select('id,department,client_id,date_time').in('status', ['terminada', 'confirmada']).gte('date_time', startDate).lte('date_time', endDate);
      return data || [];
    },
    enabled: needsAutoCalc,
    ...AUTO_CACHE,
  });

  const autoNpsRaw = useQuery({
    queryKey: ['auto-nps-raw', year],
    queryFn: async () => {
      const startDate = `${year}-01-01`;
      const endDate = `${year}-12-31`;
      const { data } = await supabase.from('client_nps_records').select('nps_score,client_id,actual_date').not('nps_score', 'is', null).gte('actual_date', startDate).lte('actual_date', endDate);
      return data || [];
    },
    enabled: needsAutoCalc,
    ...AUTO_CACHE,
  });

  const autoExpensesRaw = useQuery({
    queryKey: ['auto-expenses-raw', year],
    queryFn: async () => {
      const startDate = `${year}-01-01`;
      const endDate = `${year}-12-31`;
      const { data } = await supabase.from('financial_expenses').select('total_with_vat,category,expense_date').gte('expense_date', startDate).lte('expense_date', endDate);
      return data || [];
    },
    enabled: needsAutoCalc,
    ...AUTO_CACHE,
  });

  const autoProjectsRaw = useQuery({
    queryKey: ['auto-projects-raw', year],
    queryFn: async () => {
      const startDate = `${year}-01-01`;
      const endDate = `${year}-12-31T23:59:59`;
      const { data } = await supabase.from('projects').select('id,type,client_name,updated_at').eq('status', 'concluido').is('archived_at', null).gte('updated_at', startDate).lte('updated_at', endDate);
      return data || [];
    },
    enabled: needsAutoCalc,
    ...AUTO_CACHE,
  });

  // Helper: get auto value for a source with optional source_filter
  const getAutoValue = (source: string, productName?: string | null, metricId?: string | null, sourceFilter?: Record<string, string> | null) => {
    const sf = sourceFilter || {};
    if (source === 'metrica' && metricId) {
      const metric = (metrics.data || []).find((m) => m.id === metricId);
      return metric ? Number(metric.current_value || 0) : null;
    }
    if (source === 'bd_vendas' || source === 'commercial') {
      const rows = (autoSalesRaw.data || []) as AutoSalesRow[];
      // Prefer relational match by product_id; fall back to name only if id can't be resolved.
      const productId = productName ? ((productsQuery.data || []) as ProductLite[]).find((p) => p.name === productName)?.id : null;
      const filtered = productName
        ? (productId
            ? rows.filter((r) => r.product_id === productId)
            : rows.filter((r) => r.product === productName))
        : rows;
      return sumRevenue(filtered);
    }
    if (source === 'bd_crm') {
      const rows = (autoCrmRaw.data || []) as AutoCrmRow[];
      const productId = productName ? ((productsQuery.data || []) as ProductLite[]).find((p) => p.name === productName)?.id : null;
      const filtered = productName
        ? (productId
            ? rows.filter((r) => r.potential_product_id === productId)
            : rows.filter((r) => r.potential_product === productName))
        : rows;
      return filtered.length;
    }
    if (source === 'bd_clientes') return autoActiveClients.data ?? null;
    if (source === 'bd_tempo') {
      let rows = (autoTimeEntries.data || []) as AutoTimeEntryRow[];
      if (sf.category) rows = rows.filter((r) => r.category === sf.category);
      if (sf.client_id) rows = rows.filter((r) => r.client_id === sf.client_id);
      return rows.reduce((s, r) => s + Number(r.duration || 0), 0);
    }
    if (source === 'bd_tarefas') {
      let rows = (autoTasksCompleted.data || []) as AutoTaskRow[];
      if (sf.department) rows = rows.filter((r) => r.department === sf.department);
      return rows.length;
    }
    if (source === 'bd_equipa') return autoTeamMembers.data ?? null;
    if (source === 'bd_marketing') {
      const allData = (autoMarketingFollowersRaw.data || []) as AutoMarketingFollowersRow[];
      if (allData.length === 0) return 0;
      const latestMonth = allData[0].month;
      let latest = allData.filter((d) => d.month === latestMonth);
      if (sf.channel_id) latest = latest.filter((d) => d.channel_id === sf.channel_id);
      return latest.reduce((s, d) => s + Number(d.followers || 0), 0);
    }
    if (source === 'bd_conteudos') {
      let rows = (autoContentRaw.data || []) as AutoContentItemRow[];
      if (sf.channel_id) {
        const links = (autoContentChannels.data || []) as AutoContentChannelRow[];
        const contentIds = new Set(links.filter((l) => l.channel_id === sf.channel_id).map((l) => l.content_id));
        rows = rows.filter((r) => contentIds.has(r.id));
      }
      return rows.length;
    }
    if (source === 'bd_reunioes') {
      let rows = (autoMeetingsRaw.data || []) as AutoMeetingRow[];
      if (sf.department) rows = rows.filter((r) => r.department === sf.department);
      return rows.length;
    }
    if (source === 'bd_nps') {
      let rows = (autoNpsRaw.data || []) as AutoNpsRow[];
      if (sf.client_id) rows = rows.filter((r) => r.client_id === sf.client_id);
      if (rows.length === 0) return null;
      const sum = rows.reduce((s, r) => s + Number(r.nps_score), 0);
      return Math.round((sum / rows.length) * 10) / 10;
    }
    if (source === 'bd_despesas') {
      let rows = (autoExpensesRaw.data || []) as AutoExpenseRow[];
      if (sf.category) rows = rows.filter((r) => r.category === sf.category);
      return rows.reduce((s, r) => s + Number(r.total_with_vat || 0), 0);
    }
    if (source === 'bd_projetos') {
      let rows = (autoProjectsRaw.data || []) as AutoProjectRow[];
      if (sf.type) rows = rows.filter((r) => r.type === sf.type);
      return rows.length;
    }
    return null;
  };

  // Products for resolving product_id → name
  const productsQuery = useQuery({
    queryKey: ['products-names'],
    queryFn: async () => {
      const { data } = await supabase.from('products').select('id,name');
      return data || [];
    },
  });

  const resolveProductName = (productId: string | null) => {
    if (!productId) return null;
    return (productsQuery.data || []).find((p) => p.id === productId)?.name || null;
  };

  // Helper: filter rows by month (1-based) using various date fields
  const filterByMonth = <T,>(rows: T[], month: number, dateField: string): T[] => {
    return rows.filter((r) => {
      const val = (r as Record<string, unknown>)[dateField] as string | number | null | undefined;
      if (!val) return false;
      if (typeof val === 'number') return val === month;
      const d = new Date(val);
      return d.getMonth() + 1 === month;
    });
  };

  // Helper: get auto value for a goal (period-filtered version of getAutoValue)
  const goalAutoValue = (obj: ObjectiveRow & { product_name?: string | null; source_filter?: Record<string, string> | null }, goalPeriod: string) => {
    if (!obj || obj.value_source === 'manual' || obj.value_source === 'metrica') return null;
    const source = obj.value_source;
    const sf = obj.source_filter || {};
    const monthIdx = MONTH_NAMES.indexOf(goalPeriod);
    const quarterMatch = goalPeriod.match(/^T([1-4])$/);
    const periodMonths = monthIdx !== -1
      ? [monthIdx + 1]
      : quarterMatch
        ? [0, 1, 2].map((offset) => (Number(quarterMatch[1]) - 1) * 3 + 1 + offset)
        : [];
    if (periodMonths.length === 0) return null;
    const filterByPeriod = <T,>(rows: T[], dateField: string): T[] =>
      rows.filter((row) => periodMonths.some((month) => filterByMonth([row], month, dateField).length > 0));
    const periodEndMonth = Math.max(...periodMonths);

    if (source === 'bd_vendas' || source === 'commercial') {
      let rows = (autoSalesRaw.data || []) as AutoSalesRow[];
      // Prefer product_id if available, else fall back to name match.
      if (obj.product_id) {
        rows = rows.filter((r) => r.product_id === obj.product_id);
      } else if (obj.product_name) {
        rows = rows.filter((r) => r.product === obj.product_name);
      }
      return sumRevenue(filterByPeriod(rows, 'sale_month'));
    }
    if (source === 'bd_crm') {
      let rows = (autoCrmRaw.data || []) as AutoCrmRow[];
      if (obj.product_id) {
        rows = rows.filter((r) => r.potential_product_id === obj.product_id);
      } else if (obj.product_name) {
        rows = rows.filter((r) => r.potential_product === obj.product_name);
      }
      return filterByPeriod(rows, 'created_at').length;
    }
    // Snapshot metrics — return current count for current/past months, null for future
    if (source === 'bd_clientes') {
      const now = new Date();
      const isCurrentOrPast = (year < now.getFullYear()) || (year === now.getFullYear() && periodEndMonth <= now.getMonth() + 1);
      return isCurrentOrPast ? (autoActiveClients.data ?? null) : null;
    }
    if (source === 'bd_equipa') {
      const now = new Date();
      const isCurrentOrPast = (year < now.getFullYear()) || (year === now.getFullYear() && periodEndMonth <= now.getMonth() + 1);
      return isCurrentOrPast ? (autoTeamMembers.data ?? null) : null;
    }
    if (source === 'bd_marketing') {
      const allData = (autoMarketingFollowersRaw.data || []) as AutoMarketingFollowersRow[];
      if (allData.length === 0) return 0;
      // Try to find data for this specific month
      let monthData = allData.filter((d) => d.month != null && periodMonths.includes(d.month));
      if (sf.channel_id) monthData = monthData.filter((d) => d.channel_id === sf.channel_id);
      if (monthData.length > 0) return monthData.reduce((s, d) => s + Number(d.followers || 0), 0);
      // Fall back to latest available
      const now = new Date();
      const isCurrentOrPast = (year < now.getFullYear()) || (year === now.getFullYear() && periodEndMonth <= now.getMonth() + 1);
      if (!isCurrentOrPast) return null;
      const latestMonth = allData[0].month;
      let latest = allData.filter((d) => d.month === latestMonth);
      if (sf.channel_id) latest = latest.filter((d) => d.channel_id === sf.channel_id);
      return latest.reduce((s, d) => s + Number(d.followers || 0), 0);
    }
    if (source === 'bd_tempo') {
      let rows = (autoTimeEntries.data || []) as AutoTimeEntryRow[];
      if (sf.category) rows = rows.filter((r) => r.category === sf.category);
      if (sf.client_id) rows = rows.filter((r) => r.client_id === sf.client_id);
      return filterByPeriod(rows, 'entry_month').reduce((s, r) => s + Number(r.duration || 0), 0);
    }
    if (source === 'bd_tarefas') {
      let rows = (autoTasksCompleted.data || []) as AutoTaskRow[];
      if (sf.department) rows = rows.filter((r) => r.department === sf.department);
      return filterByPeriod(rows, 'updated_at').length;
    }
    if (source === 'bd_conteudos') {
      let rows = (autoContentRaw.data || []) as AutoContentItemRow[];
      if (sf.channel_id) {
        const links = (autoContentChannels.data || []) as AutoContentChannelRow[];
        const contentIds = new Set(links.filter((l) => l.channel_id === sf.channel_id).map((l) => l.content_id));
        rows = rows.filter((r) => contentIds.has(r.id));
      }
      return filterByPeriod(rows, 'scheduled_at').length;
    }
    if (source === 'bd_reunioes') {
      let rows = (autoMeetingsRaw.data || []) as AutoMeetingRow[];
      if (sf.department) rows = rows.filter((r) => r.department === sf.department);
      return filterByPeriod(rows, 'date_time').length;
    }
    if (source === 'bd_nps') {
      let rows = (autoNpsRaw.data || []) as AutoNpsRow[];
      if (sf.client_id) rows = rows.filter((r) => r.client_id === sf.client_id);
      const monthRows = filterByPeriod(rows, 'actual_date');
      if (monthRows.length === 0) return null;
      const sum = monthRows.reduce((s, r) => s + Number(r.nps_score), 0);
      return Math.round((sum / monthRows.length) * 10) / 10;
    }
    if (source === 'bd_despesas') {
      let rows = (autoExpensesRaw.data || []) as AutoExpenseRow[];
      if (sf.category) rows = rows.filter((r) => r.category === sf.category);
      return filterByPeriod(rows, 'expense_date').reduce((s, r) => s + Number(r.total_with_vat || 0), 0);
    }
    if (source === 'bd_projetos') {
      let rows = (autoProjectsRaw.data || []) as AutoProjectRow[];
      if (sf.type) rows = rows.filter((r) => r.type === sf.type);
      return filterByPeriod(rows, 'updated_at').length;
    }
    return null;
  };


  // Helper: compute objective progress
  const objectiveProgress = (obj: ObjectiveRow & { product_name?: string | null; source_filter?: Record<string, string> | null }) => {
    if (obj.objective_type === 'quantitativo') {
      const pName = obj.product_name ?? resolveProductName(obj.product_id);
      const sf = obj.source_filter || null;
      const cv = obj.value_source === 'manual' ? Number(obj.current_value || 0) : (getAutoValue(obj.value_source, pName, obj.primary_metric_id, sf) ?? 0);
      const tv = Number(obj.target_value || 0);
      if (tv <= 0) return 0;
      return Math.min(100, Math.round((cv / tv) * 100));
    }
    // Qualitative
    const crits = (criteria.data || []).filter((c) => c.objective_id === obj.id);
    if (crits.length === 0) return 0;
    return Math.round((crits.filter((c) => c.completed).length / crits.length) * 100);
  };

  // Helper: current value for objective
  const objectiveCurrentValue = (obj: ObjectiveRow & { product_name?: string | null; source_filter?: Record<string, string> | null }) => {
    if (obj.value_source === 'manual') return Number(obj.current_value || 0);
    const pName = obj.product_name ?? resolveProductName(obj.product_id);
    const sf = obj.source_filter || null;
    return getAutoValue(obj.value_source, pName, obj.primary_metric_id, sf) ?? 0;
  };

  // Helper: auto-compute goal status based on actual vs target
  const computeGoalStatus = (goal: GoalRow & { actual_value?: number | null }) => {
    const actual = Number(goal.actual_value || 0);
    const target = Number(goal.target_value || 0);
    if (!target) return goal.status;
    const monthIdx = MONTH_NAMES.indexOf(goal.period ?? '');
    const monthEnded = monthIdx !== -1 && monthIdx < new Date().getMonth() && (goal.year || year) <= new Date().getFullYear();
    if (actual >= target) return 'atingido';
    if (monthEnded && actual < target) return 'nao_atingido';
    if (actual > 0) return 'em_curso';
    return goal.status;
  };

  // ════════════════════════════════════════════════════════════════
  // SINGLE SOURCE OF TRUTH for period progress (month / quarter / semester / year)
  // Used by MonthlyGallery, QuarterlyGallery, SemesterGallery, MonthDetailView.
  // Aggregates ONLY monthly goals whose `period` matches one of `periodMonths`.
  // For each goal: pct = atingido ? 100 : auto/actual ÷ target, capped at 100.
  // ════════════════════════════════════════════════════════════════
  const getPeriodProgress = (periodMonths: string[]): { pct: number; count: number; achievedCount: number } => {
    const allG = (goals.data || []) as unknown as Array<GoalRow & { actual_value?: number | null; objective_id?: string | null }>;
    const allObj = (objectives.data || []) as ObjectiveRow[];
    const periodGoals = allG.filter((g) => periodMonths.includes(g.period ?? ''));
    if (periodGoals.length === 0) return { pct: 0, count: 0, achievedCount: 0 };

    let achievedCount = 0;
    const pcts = periodGoals.map((g) => {
      if (g.status === 'atingido') { achievedCount++; return 100; }
      const target = Number(g.target_value || 0);
      if (target <= 0) return 0;
      const linkedObj = g.objective_id ? allObj.find((o) => o.id === g.objective_id) : null;
      const autoVal = linkedObj ? Number(goalAutoValue(linkedObj as any, g.period ?? '') ?? 0) : 0;
      const actual = autoVal > 0 ? autoVal : Number(g.actual_value || 0);
      const pct = Math.min(Math.round((actual / target) * 100), 100);
      if (pct >= 100) achievedCount++;
      return pct;
    });
    const avg = Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length);
    return { pct: avg, count: periodGoals.length, achievedCount };
  };

  // Helper: get goals with deviation info for alerts
  const getGoalsWithDeviations = () => {
    const allG = (goals.data || []) as unknown as Array<GoalRow & { actual_value?: number | null }>;
    const now = new Date();
    const currentMonthIdx = now.getMonth();
    return allG.filter((g) => {
      const monthIdx = MONTH_NAMES.indexOf(g.period ?? '');
      if (monthIdx === -1) return false;
      const target = Number(g.target_value || 0);
      const actual = Number(g.actual_value || 0);
      if (!target) return false;
      // Current or past month with actual < target
      if (monthIdx <= currentMonthIdx && actual < target) return true;
      return false;
    });
  };

  // Computed: metrics with overdue check
  const isMetricOverdue = (metric: MetricRow) => {
    if (!metric.last_updated_at) return true;
    const last = new Date(metric.last_updated_at);
    const now = new Date();
    const diffDays = (now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24);
    if (metric.cadence === 'diaria') return diffDays >= 1.5;
    if (metric.cadence === 'semanal') return diffDays >= 7;
    if (metric.cadence === 'mensal') return diffDays >= 30;
    return false;
  };

  const isMetricDueToday = (metric: MetricRow) => {
    if (!metric.last_updated_at) return false;
    const last = new Date(metric.last_updated_at);
    const now = new Date();
    const diffDays = (now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24);
    if (metric.cadence === 'diaria') return diffDays >= 0.8 && diffDays < 1.5;
    if (metric.cadence === 'semanal') return diffDays >= 6 && diffDays < 7;
    if (metric.cadence === 'mensal') return diffDays >= 28 && diffDays < 30;
    return false;
  };

  // Metric trend (comparing last 3 records)
  const getMetricTrend = (metricId: string): 'up' | 'stable' | 'down' => {
    const records = ((metricHistory.data || []) as MetricHistoryRow[]).filter((r) => r.metric_id === metricId);
    if (records.length < 2) return 'stable';
    const last3 = records.slice(-3);
    const first = Number(last3[0].value);
    const last = Number(last3[last3.length - 1].value);
    if (last > first * 1.05) return 'up';
    if (last < first * 0.95) return 'down';
    return 'stable';
  };

  return {
    objectives, allObjectives: objectives.data || [],
    upsertObjective, deleteObjective,
    criteria, upsertCriterion, deleteCriterion,
    goals, allGoals: goals.data || [],
    upsertGoal, deleteGoal,
    metrics, allMetrics: metrics.data || [],
    upsertMetric, deleteMetric,
    metricHistory, addMetricRecord,
    actions, allActions: actions.data || [],
    upsertAction, deleteAction, convertActionToTask,
    getAutoValue, goalAutoValue, objectiveProgress, objectiveCurrentValue,
    computeGoalStatus, getGoalsWithDeviations, getPeriodProgress,
    isMetricOverdue, isMetricDueToday, getMetricTrend,
    invalidate, year,
  };
}
