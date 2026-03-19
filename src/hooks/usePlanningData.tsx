import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

function clean(obj: Record<string, any>): Record<string, any> {
  const c: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) c[k] = v === '' ? null : v;
  return c;
}

const currentYear = new Date().getFullYear();

export const PLAN_AREAS = [
  { value: 'financeiro', label: 'Financeiro' },
  { value: 'comercial', label: 'Comercial' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'operacao', label: 'Operação' },
  { value: 'equipa', label: 'Equipa' },
  { value: 'inovacao', label: 'Inovação & Desenvolvimento' },
  { value: 'outro', label: 'Outro' },
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
  { value: 'manual', label: 'Manual' },
  { value: 'bd_vendas', label: 'BD Vendas' },
  { value: 'bd_crm', label: 'BD CRM' },
  { value: 'bd_clientes', label: 'BD Clientes' },
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
  const invalidate = () => qc.invalidateQueries({ queryKey: ['planning'] });

  // ─── Objectives ──────────────────
  const objectives = useQuery({
    queryKey: [...key, 'objectives'],
    queryFn: async () => {
      const { data } = await supabase.from('executive_objectives').select('*').eq('year', year).order('created_at');
      return data || [];
    },
  });

  const upsertObjective = useMutation({
    mutationFn: async (raw: any) => {
      const obj = clean(raw);
      if (obj.id) {
        const { error } = await supabase.from('executive_objectives').update(obj as any).eq('id', obj.id);
        if (error) throw error;
      } else {
        delete obj.id;
        const { error } = await supabase.from('executive_objectives').insert({ ...obj, year } as any);
        if (error) throw error;
      }
    },
    onSuccess: invalidate,
    onError: (e: any) => toast.error('Erro ao guardar objetivo: ' + (e.message || e)),
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
  });

  const upsertCriterion = useMutation({
    mutationFn: async (raw: any) => {
      const rec = clean(raw);
      if (rec.id) {
        const { error } = await supabase.from('objective_criteria').update(rec as any).eq('id', rec.id);
        if (error) throw error;
      } else {
        delete rec.id;
        const { error } = await supabase.from('objective_criteria').insert(rec as any);
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
      return data || [];
    },
  });

  const upsertGoal = useMutation({
    mutationFn: async (raw: any) => {
      const rec = clean(raw);
      // auto period_type
      if (rec.period && typeof rec.period === 'string') {
        rec.period_type = rec.period.startsWith('T') ? 'trimestral' : 'mensal';
      }
      if (rec.id) {
        const { error } = await supabase.from('planning_goals').update(rec as any).eq('id', rec.id);
        if (error) throw error;
      } else {
        delete rec.id;
        const { error } = await supabase.from('planning_goals').insert({ ...rec, year } as any);
        if (error) throw error;
      }
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
  });

  const upsertMetric = useMutation({
    mutationFn: async (raw: any) => {
      const rec = clean(raw);
      if (rec.id) {
        const { error } = await supabase.from('objective_metrics').update(rec as any).eq('id', rec.id);
        if (error) throw error;
      } else {
        delete rec.id;
        const { error } = await supabase.from('objective_metrics').insert(rec as any);
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
  });

  const addMetricRecord = useMutation({
    mutationFn: async (raw: any) => {
      const rec = clean(raw);
      delete rec.id;
      const { error } = await supabase.from('metric_history').insert(rec as any);
      if (error) throw error;
      // update current_value on the metric
      if (rec.metric_id && rec.value != null) {
        await supabase.from('objective_metrics').update({ current_value: rec.value, last_updated_at: new Date().toISOString() } as any).eq('id', rec.metric_id);
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
  });

  const upsertAction = useMutation({
    mutationFn: async (raw: any) => {
      const rec = clean(raw);
      if (rec.id) {
        const { error } = await supabase.from('objective_actions').update(rec as any).eq('id', rec.id);
        if (error) throw error;
      } else {
        delete rec.id;
        const { error } = await supabase.from('objective_actions').insert(rec as any);
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
    mutationFn: async (action: any) => {
      // Create task
      const { data: task, error } = await supabase.from('tasks').insert({
        name: action.description,
        deadline: action.deadline || null,
        assigned_to: action.responsible_id || null,
        status: action.status === 'feito' ? 'concluida' : 'pendente',
      } as any).select('id').single();
      if (error) throw error;
      // Link task to action
      await supabase.from('objective_actions').update({ task_id: task.id, action_type: 'tarefa' } as any).eq('id', action.id);
    },
    onSuccess: () => { invalidate(); toast.success('Ação convertida em tarefa'); },
    onError: () => toast.error('Erro ao converter ação'),
  });

  // ─── Auto-calculated values (raw data for filtering) ──────────────────
  const autoSalesRaw = useQuery({
    queryKey: ['auto-sales-raw', year],
    queryFn: async () => {
      const { data } = await supabase.from('commercial_sales').select('invoice_total,product').eq('sale_year', year);
      return data || [];
    },
  });

  const autoCrmRaw = useQuery({
    queryKey: ['auto-crm-raw', year],
    queryFn: async () => {
      const { data } = await supabase.from('crm_leads').select('id,potential_product').eq('status', 'ganho');
      return data || [];
    },
  });

  const autoActiveClients = useQuery({
    queryKey: ['auto-active-clients'],
    queryFn: async () => {
      const { data } = await supabase.from('clients').select('id').eq('status', 'ativo');
      return (data || []).length;
    },
  });

  // Helper: get auto value for a source, optionally filtered by product name
  const getAutoValue = (source: string, productName?: string | null) => {
    if (source === 'bd_vendas') {
      const rows = autoSalesRaw.data || [];
      const filtered = productName ? rows.filter((r: any) => r.product === productName) : rows;
      return filtered.reduce((s: number, v: any) => s + Number(v.invoice_total || 0), 0);
    }
    if (source === 'bd_crm') {
      const rows = autoCrmRaw.data || [];
      const filtered = productName ? rows.filter((r: any) => r.potential_product === productName) : rows;
      return filtered.length;
    }
    if (source === 'bd_clientes') return autoActiveClients.data ?? null;
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
    return (productsQuery.data || []).find((p: any) => p.id === productId)?.name || null;
  };

  // Helper: compute objective progress
  const objectiveProgress = (obj: any) => {
    if (obj.objective_type === 'quantitativo') {
      const pName = obj.product_name ?? resolveProductName(obj.product_id);
      const cv = obj.value_source === 'manual' ? Number(obj.current_value || 0) : (getAutoValue(obj.value_source, pName) ?? 0);
      const tv = Number(obj.target_value || 0);
      if (tv <= 0) return 0;
      return Math.min(100, Math.round((cv / tv) * 100));
    }
    // Qualitative
    const crits = (criteria.data || []).filter((c: any) => c.objective_id === obj.id);
    if (crits.length === 0) return 0;
    return Math.round((crits.filter((c: any) => c.completed).length / crits.length) * 100);
  };

  // Helper: current value for objective
  const objectiveCurrentValue = (obj: any) => {
    if (obj.value_source === 'manual') return Number(obj.current_value || 0);
    const pName = obj.product_name ?? resolveProductName(obj.product_id);
    return getAutoValue(obj.value_source, pName) ?? 0;
  };

  // Computed: metrics with overdue check
  const isMetricOverdue = (metric: any) => {
    if (!metric.last_updated_at) return true;
    const last = new Date(metric.last_updated_at);
    const now = new Date();
    const diffDays = (now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24);
    if (metric.cadence === 'diaria') return diffDays >= 1.5;
    if (metric.cadence === 'semanal') return diffDays >= 7;
    if (metric.cadence === 'mensal') return diffDays >= 30;
    return false;
  };

  const isMetricDueToday = (metric: any) => {
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
    const records = (metricHistory.data || []).filter((r: any) => r.metric_id === metricId);
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
    getAutoValue, objectiveProgress, objectiveCurrentValue,
    isMetricOverdue, isMetricDueToday, getMetricTrend,
    invalidate, year,
  };
}
