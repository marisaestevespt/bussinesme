import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// cleanPayload imported from utils — aliased as `clean` for minimal diff
import { cleanPayload as clean } from '@/lib/utils';
import type {
  PlanningFormPayload,
  ObjectiveRow,
  CriterionRow,
  GoalRow,
  MetricRow,
  MetricHistoryRow,
  ActionRow,
  ProductLite,
} from '@/types/planning';
import { requireConfirm, confirmDestructive } from '@/lib/confirmDestructive';
import { useKpiAutoValueRange } from './useKpiAutoValue';
import type { DepartmentKpi } from './useDepartmentKpis';

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
  { value: 'em_risco', label: 'Em risco' },
  { value: 'nao_atingido', label: 'Não atingido' },
];

export const VALUE_SOURCES = [
  { value: 'manual', label: 'Manual', area: null, desc: 'Introduzir valores manualmente' },
  { value: 'metrica', label: 'Métrica na Ficha', area: null, desc: 'Progresso via métrica com tracking periódico' },
  { value: 'commercial', label: 'Meta Comercial (Vendas)', area: 'comercial', desc: 'Sincroniza com metas anuais/trimestrais/mensais comerciais (Vendas)' },
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
  // === KPIs derivados (auto-calculados a partir de dados existentes) ===
  { value: 'bd_crm_conv_sessao', label: 'Conversão sessão → proposta', area: 'comercial', desc: '% de leads do período que receberam proposta' },
  { value: 'bd_crm_conv_proposta', label: 'Conversão proposta → ganho', area: 'comercial', desc: '% de propostas que resultaram em ganho' },
  { value: 'bd_crm_tempo_fecho', label: 'Tempo médio de fecho', area: 'comercial', desc: 'Média de dias entre criação do lead e ganho' },
  { value: 'bd_crm_followups', label: 'Follow-ups pendentes', area: 'comercial', desc: 'Leads com follow-up vencido por fazer' },
  { value: 'bd_mkt_alcance_ig', label: 'Alcance orgânico Instagram', area: 'marketing', desc: 'Soma de contas alcançadas no Instagram' },
  { value: 'bd_mkt_views_youtube', label: 'Visualizações YouTube', area: 'marketing', desc: 'Soma de views no YouTube' },
  { value: 'bd_mkt_save_share', label: 'Taxa save + share', area: 'marketing', desc: '% (saves+shares)/impressões dos conteúdos' },
  { value: 'bd_fin_mrr', label: 'MRR — Receita recorrente', area: 'financeiro', desc: 'Vendas de produtos recorrentes (média mensal)' },
  { value: 'bd_fin_receita_variavel', label: 'Receita variável', area: 'financeiro', desc: 'Vendas de produtos não recorrentes' },
  { value: 'bd_fin_custos_ratio', label: 'Custos fixos / faturação', area: 'financeiro', desc: '% despesas recorrentes sobre faturação' },
  { value: 'bd_fin_breakeven', label: 'Distância ao break-even', area: 'financeiro', desc: 'Receita menos despesas no período' },
  { value: 'bd_fin_pagamentos_atraso', label: 'Pagamentos em atraso', area: 'financeiro', desc: 'Nº de despesas com data de renovação vencida e não pagas' },
  { value: 'bd_ops_sops_ativos', label: 'SOPs documentados e ativos', area: 'operacao', desc: 'Contagem de SOPs com status ativo' },
  { value: 'bd_tarefas_p1p2_atraso', label: 'Tarefas P1/P2 em atraso', area: 'operacao', desc: 'Tarefas alta/média prioridade vencidas e por fazer' },
  { value: 'bd_projetos_no_prazo', label: 'Projetos no prazo', area: 'operacao', desc: '% projetos ativos com deadline no futuro' },
  { value: 'bd_clientes_fase_media', label: 'Fase média de consultoria', area: 'clientes', desc: 'Média do ciclo atual dos clientes ativos' },
  { value: 'bd_clientes_renovacao', label: 'Taxa de renovação', area: 'clientes', desc: '% de atividades de renovação concluídas' },
  { value: 'bd_produtos_assinaturas', label: 'Assinaturas ativas', area: 'produtos', desc: 'Clientes ativos com produto recorrente' },
  { value: 'bd_produtos_ticket_medio', label: 'Ticket médio por venda', area: 'produtos', desc: 'Média do valor de fatura por venda' },
  { value: 'bd_equipa_execucao_autonoma', label: 'Taxa de execução autónoma', area: 'equipa', desc: '% tarefas done sem reatribuição' },
  { value: 'bd_equipa_entregas_a_tempo', label: 'Entregas a tempo', area: 'equipa', desc: '% tarefas done concluídas até deadline' },
  { value: 'bd_geral_mrr_ratio', label: 'Rácio MRR / faturação', area: 'geral', desc: 'MRR sobre faturação total no período' },
  { value: 'bd_geral_velocidade_mrr', label: 'Velocidade crescimento MRR', area: 'geral', desc: 'Variação € MRR entre 1.º e último mês do período' },
  { value: 'bd_capacidade_disponivel', label: 'Capacidade disponível (horas)', area: 'equipa', desc: 'Horas semanais da equipa × semanas − horas registadas no período' },
  { value: 'bd_produtos_ativacao', label: 'Taxa de ativação', area: 'produtos', desc: '% clientes ativos do produto com pelo menos 1 renovação concluída' },
  { value: 'bd_objetivos_progresso', label: 'Progresso objetivos anuais', area: 'geral', desc: 'Média do progresso (% atual/meta) dos objetivos do ano' },
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
      await requireConfirm();
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
      await requireConfirm();
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
      await requireConfirm();
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
      await requireConfirm();
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
      await requireConfirm();
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

  // ─── Auto-calculated values: delegate to the unified KPI resolver ────────
  // Single source of truth covering all 36 VALUE_SOURCES (objectives + goals
  // + KPIs share the same logic and the same TanStack cache entries).
  const kpiResolver = useKpiAutoValueRange(year, 1, 12);

  // Build a synthetic DepartmentKpi-like object so we can call resolver.resolve
  const buildKpiLike = (
    source: string,
    sourceFilter: Record<string, string> | null,
    productId: string | null | undefined,
    metricId: string | null | undefined,
  ): DepartmentKpi => {
    const sf: Record<string, string> = { ...(sourceFilter || {}) };
    if (productId && !sf.product_id) sf.product_id = productId;
    if (metricId && !sf.metric_id) sf.metric_id = metricId;
    return {
      id: 'synthetic', department: '', name: '', description: null, unit: null,
      target_value: null, current_value: null, value_source: source,
      source_filter: sf, is_active: true, sort_order: 0, notes: null,
      last_updated_at: null,
    };
  };

  const productIdFromName = (productName?: string | null): string | null => {
    if (!productName) return null;
    return ((productsQuery.data || []) as ProductLite[]).find((p) => p.name === productName)?.id || null;
  };

  // Helper: get auto value for a source (annual scope)
  const getAutoValue = (source: string, productName?: string | null, metricId?: string | null, sourceFilter?: Record<string, string> | null) => {
    if (!source || source === 'manual') return null;
    const kpi = buildKpiLike(source, sourceFilter ?? null, productIdFromName(productName), metricId);
    return kpiResolver.resolve(kpi);
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

  // Helper: get auto value for a goal (period-filtered version of getAutoValue).
  // Delegates to the unified KPI resolver with a months override derived from
  // the goal period (legacy 'Maio'/'T2' or canonical '2026-05'/'Q2').
  const goalAutoValue = (obj: ObjectiveRow & { product_name?: string | null; source_filter?: Record<string, string> | null }, goalPeriod: string) => {
    if (!obj || obj.value_source === 'manual' || obj.value_source === 'metrica') return null;
    const normalized = periodCanonicalToLegacy(goalPeriod) || goalPeriod;
    const monthIdx = MONTH_NAMES.indexOf(normalized);
    const quarterMatch = normalized.match(/^T([1-4])$/);
    const periodMonths = monthIdx !== -1
      ? [monthIdx + 1]
      : quarterMatch
        ? [0, 1, 2].map((offset) => (Number(quarterMatch[1]) - 1) * 3 + 1 + offset)
        : [];
    if (periodMonths.length === 0) return null;
    const kpi = buildKpiLike(obj.value_source, obj.source_filter ?? null, obj.product_id, obj.primary_metric_id);
    return kpiResolver.resolve(kpi, periodMonths);
  };


  // Helper: compute objective progress
  const objectiveProgress = (obj: ObjectiveRow & { product_name?: string | null; source_filter?: Record<string, string> | null }) => {
    if (obj.objective_type === 'quantitativo') {
      const cv = objectiveCurrentValue(obj);
      const tv = Number(obj.target_value || 0);
      if (tv <= 0) return 0;
      return Math.min(100, Math.round((cv / tv) * 100));
    }
    // Qualitative
    const crits = (criteria.data || []).filter((c) => c.objective_id === obj.id);
    if (crits.length === 0) return 0;
    return Math.round((crits.filter((c) => c.completed).length / crits.length) * 100);
  };

  // Helper: aggregate current_value from auto-sourced linked metrics (if any)
  const aggregatedFromMetrics = (objectiveId: string): number | null => {
    const linked = (metrics.data || []).filter(
      (m: any) => m.objective_id === objectiveId && (m.linked_kpi_id || (m.source && m.source !== 'manual')),
    );
    if (linked.length === 0) return null;
    return linked.reduce((acc: number, m: any) => acc + Number(m.current_value || 0), 0);
  };

  // Helper: current value for objective.
  // When source = 'manual' but there are auto-sourced linked metrics, aggregate from them.
  const objectiveCurrentValue = (obj: ObjectiveRow & { product_name?: string | null; source_filter?: Record<string, string> | null }) => {
    if (obj.value_source === 'manual') {
      const auto = aggregatedFromMetrics(obj.id);
      if (auto !== null) return auto;
      return Number(obj.current_value || 0);
    }
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
