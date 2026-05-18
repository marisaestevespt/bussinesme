import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cleanPayload } from '@/lib/utils';
import { startOfWeek, format } from 'date-fns';
import type { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';
import { requireConfirm, confirmDestructive } from '@/lib/confirmDestructive';

type QuarterlyAnalysis = Tables<'executive_quarterly_analysis'>;

// cleanPayload imported from utils

const currentYear = new Date().getFullYear();

/** Shared month name helper */
export function getMonthName(m: number) {
  return ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'][m - 1] || '';
}

export const SALES_ROUTINES = [
  { key: 'followups_leads', label: 'Follow-ups de Leads' },
  { key: 'contacto_leads_antigas', label: 'Contacto com leads antigas (2x semana)' },
  { key: 'stories_produto', label: 'Stories sobre o produto principal (4x semana)' },
  { key: 'atualizacao_crm', label: 'Atualização CRM' },
];

/**
 * Executive data hook — Brain Dump, Monthly Checklists, Quarterly Analysis, Weekly Routines.
 * Planning objectives/goals are handled by usePlanningData.
 */
export function useExecutiveData(year = currentYear) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['executive'] });

  // Brain Dump
  const brainDump = useQuery({
    queryKey: ['executive', 'braindump'],
    queryFn: async () => {
      const { data } = await supabase.from('executive_brain_dump').select('*').order('created_at', { ascending: false });
      return data || [];
    },
    staleTime: 2 * 60 * 1000,
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
      const { error } = await supabase
        .from('executive_brain_dump')
        .update({ completed, status: completed ? 'aplicado' : 'em_ideia' })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const deleteBrainDump = useMutation({
    mutationFn: async (id: string) => {
      await requireConfirm();
      const { error } = await supabase.from('executive_brain_dump').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  // Monthly Checklists
  const monthlyChecklists = useQuery({
    queryKey: ['executive', year, 'monthly_checklists'],
    queryFn: async () => {
      const { data } = await supabase.from('executive_monthly_checklists').select('*').eq('year', year).order('created_at');
      return data || [];
    },
    staleTime: 2 * 60 * 1000,
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
      await requireConfirm();
      const { error } = await supabase.from('executive_monthly_checklists').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  // Quarterly Analysis
  const quarterlyAnalysis = useQuery({
    queryKey: ['executive', year, 'quarterly_analysis'],
    queryFn: async () => {
      const { data } = await supabase.from('executive_quarterly_analysis').select('*').eq('year', year).order('quarter');
      return data || [];
    },
    staleTime: 2 * 60 * 1000,
  });

  const upsertQuarterlyAnalysis = useMutation({
    mutationFn: async (raw: Partial<QuarterlyAnalysis> & { quarter: number }) => {
      const rec = cleanPayload(raw as Record<string, unknown>);
      const { data: existing } = await supabase.from('executive_quarterly_analysis')
        .select('id').eq('quarter', rec.quarter as number).eq('year', year).maybeSingle();
      if (existing) {
        const { error } = await supabase.from('executive_quarterly_analysis').update(rec as TablesUpdate<'executive_quarterly_analysis'>).eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('executive_quarterly_analysis').insert({ ...rec, year } as TablesInsert<'executive_quarterly_analysis'>);
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
    staleTime: 60 * 1000,
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

  return {
    brainDump, addBrainDump, toggleBrainDump, deleteBrainDump,
    monthlyChecklists, addMonthlyCheckItem, toggleMonthlyCheckItem, deleteMonthlyCheckItem,
    quarterlyAnalysis, upsertQuarterlyAnalysis,
    weeklyRoutines, toggleRoutine, currentWeekStart,
    invalidate,
  };
}
