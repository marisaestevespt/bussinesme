import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { startOfWeek, format } from 'date-fns';

const currentYear = new Date().getFullYear();

export const OBJECTIVE_AREAS = [
  { value: 'financeiro', label: 'Financeiro' },
  { value: 'inovacao', label: 'Inovação & Desenvolvimento' },
  { value: 'reconhecimento', label: 'Reconhecimento & Autoridade' },
  { value: 'operacao', label: 'Operação' },
  { value: 'outro', label: 'Outro' },
];

export const OBJECTIVE_STATUSES = [
  { value: 'por_iniciar', label: 'Por iniciar' },
  { value: 'doing', label: 'Doing' },
  { value: 'atingido', label: 'Atingido' },
];

export const GOAL_STATUSES = [
  { value: 'por_iniciar', label: 'Por iniciar' },
  { value: 'doing', label: 'Doing' },
  { value: 'atingido', label: 'Atingido!!' },
];

export const SALES_ROUTINES = [
  { key: 'followups_leads', label: 'Follow-ups de Leads' },
  { key: 'contacto_leads_antigas', label: 'Contacto com leads antigas (2x semana)' },
  { key: 'stories_produto', label: 'Stories sobre o produto principal (4x semana)' },
  { key: 'atualizacao_crm', label: 'Atualização CRM' },
];

export function areaLabel(val: string) {
  return OBJECTIVE_AREAS.find(a => a.value === val)?.label || val;
}

export function statusLabel(val: string) {
  return [...OBJECTIVE_STATUSES, ...GOAL_STATUSES].find(s => s.value === val)?.label || val;
}

export function getMonthName(m: number) {
  return ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'][m - 1] || '';
}

export function getQuarterMonths(q: number) {
  const start = (q - 1) * 3 + 1;
  return [start, start + 1, start + 2];
}

export function getMonthRange(m: number, year: number) {
  const start = new Date(year, m - 1, 1);
  const end = new Date(year, m, 0);
  return { start, end };
}

export function useExecutiveData(year = currentYear) {
  const qc = useQueryClient();
  const key = ['executive', year];
  const invalidate = () => qc.invalidateQueries({ queryKey: ['executive'] });

  // Objectives
  const objectives = useQuery({
    queryKey: [...key, 'objectives'],
    queryFn: async () => {
      const { data } = await supabase.from('executive_objectives').select('*').eq('year', year).order('created_at');
      return data || [];
    },
  });

  const upsertObjective = useMutation({
    mutationFn: async (obj: any) => {
      if (obj.id) {
        const { error } = await supabase.from('executive_objectives').update(obj).eq('id', obj.id);
        if (error) throw error;
      } else {
        delete obj.id;
        const { error } = await supabase.from('executive_objectives').insert({ ...obj, year });
        if (error) throw error;
      }
    },
    onSuccess: invalidate,
    onError: () => toast.error('Erro ao guardar objetivo'),
  });

  const deleteObjective = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('executive_objectives').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  // Goals (Metas)
  const goals = useQuery({
    queryKey: [...key, 'goals'],
    queryFn: async () => {
      const { data } = await supabase.from('executive_goals').select('*').eq('year', year).order('target_date');
      return data || [];
    },
  });

  const upsertGoal = useMutation({
    mutationFn: async (g: any) => {
      // Auto-calculate month and quarter from target_date
      if (g.target_date) {
        const d = new Date(g.target_date);
        g.month = d.getMonth() + 1;
        g.quarter = Math.ceil((d.getMonth() + 1) / 3);
      }
      if (g.id) {
        const { error } = await supabase.from('executive_goals').update(g).eq('id', g.id);
        if (error) throw error;
      } else {
        delete g.id;
        const { error } = await supabase.from('executive_goals').insert({ ...g, year });
        if (error) throw error;
      }
    },
    onSuccess: invalidate,
    onError: () => toast.error('Erro ao guardar meta'),
  });

  const deleteGoal = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('executive_goals').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  // Brain Dump
  const brainDump = useQuery({
    queryKey: ['executive', 'braindump'],
    queryFn: async () => {
      const { data } = await supabase.from('executive_brain_dump').select('*').order('created_at', { ascending: false });
      return data || [];
    },
  });

  const addBrainDump = useMutation({
    mutationFn: async (task: string) => {
      const { error } = await supabase.from('executive_brain_dump').insert({ task });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const toggleBrainDump = useMutation({
    mutationFn: async ({ id, completed }: { id: string; completed: boolean }) => {
      const { error } = await supabase.from('executive_brain_dump').update({ completed }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const deleteBrainDump = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('executive_brain_dump').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  // Monthly Checklists
  const monthlyChecklists = useQuery({
    queryKey: [...key, 'monthly_checklists'],
    queryFn: async () => {
      const { data } = await supabase.from('executive_monthly_checklists').select('*').eq('year', year).order('created_at');
      return data || [];
    },
  });

  const addMonthlyCheckItem = useMutation({
    mutationFn: async ({ month, task }: { month: number; task: string }) => {
      const { error } = await supabase.from('executive_monthly_checklists').insert({ month, year, task });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const toggleMonthlyCheckItem = useMutation({
    mutationFn: async ({ id, completed }: { id: string; completed: boolean }) => {
      const { error } = await supabase.from('executive_monthly_checklists').update({ completed }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const deleteMonthlyCheckItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('executive_monthly_checklists').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  // Quarterly Analysis
  const quarterlyAnalysis = useQuery({
    queryKey: [...key, 'quarterly_analysis'],
    queryFn: async () => {
      const { data } = await supabase.from('executive_quarterly_analysis').select('*').eq('year', year).order('quarter');
      return data || [];
    },
  });

  const upsertQuarterlyAnalysis = useMutation({
    mutationFn: async (rec: any) => {
      const { data: existing } = await supabase.from('executive_quarterly_analysis')
        .select('id').eq('quarter', rec.quarter).eq('year', year).maybeSingle();
      if (existing) {
        const { error } = await supabase.from('executive_quarterly_analysis').update(rec).eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('executive_quarterly_analysis').insert({ ...rec, year });
        if (error) throw error;
      }
    },
    onSuccess: invalidate,
    onError: () => toast.error('Erro ao guardar análise'),
  });

  // Weekly Routines
  const currentWeekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');

  const weeklyRoutines = useQuery({
    queryKey: ['executive', 'routines', currentWeekStart],
    queryFn: async () => {
      const { data } = await supabase.from('executive_weekly_routines').select('*').eq('week_start', currentWeekStart);
      return data || [];
    },
  });

  const toggleRoutine = useMutation({
    mutationFn: async ({ routineKey, completed }: { routineKey: string; completed: boolean }) => {
      const existing = weeklyRoutines.data?.find(r => r.routine_key === routineKey);
      if (existing) {
        const { error } = await supabase.from('executive_weekly_routines').update({ completed }).eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('executive_weekly_routines').insert({
          week_start: currentWeekStart, routine_key: routineKey, completed,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['executive', 'routines'] }),
  });

  // Computed helpers
  const allObjectives = objectives.data || [];
  const allGoals = goals.data || [];

  const goalsForMonth = (m: number) => allGoals.filter(g => g.month === m);
  const goalsForQuarter = (q: number) => allGoals.filter(g => g.quarter === q);
  const goalsForObjective = (objId: string) => allGoals.filter(g => g.objective_id === objId);

  const monthProgress = (m: number) => {
    const mg = goalsForMonth(m);
    if (mg.length === 0) return 0;
    return Math.round((mg.filter(g => g.status === 'atingido').length / mg.length) * 100);
  };

  const quarterProgress = (q: number) => {
    const qg = goalsForQuarter(q);
    if (qg.length === 0) return 0;
    return Math.round((qg.filter(g => g.status === 'atingido').length / qg.length) * 100);
  };

  const objectiveProgress = (objId: string) => {
    const og = goalsForObjective(objId);
    if (og.length === 0) return 0;
    return Math.round((og.filter(g => g.status === 'atingido').length / og.length) * 100);
  };

  return {
    objectives, allObjectives, upsertObjective, deleteObjective,
    goals, allGoals, upsertGoal, deleteGoal,
    brainDump, addBrainDump, toggleBrainDump, deleteBrainDump,
    monthlyChecklists, addMonthlyCheckItem, toggleMonthlyCheckItem, deleteMonthlyCheckItem,
    quarterlyAnalysis, upsertQuarterlyAnalysis,
    weeklyRoutines, toggleRoutine, currentWeekStart,
    goalsForMonth, goalsForQuarter, goalsForObjective,
    monthProgress, quarterProgress, objectiveProgress,
    invalidate,
  };
}
