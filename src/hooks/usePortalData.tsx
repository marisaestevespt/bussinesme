import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';
import { requireConfirm, confirmDestructive } from '@/lib/confirmDestructive';

export type Portal = Tables<'client_portals'>;
export type PortalFaq = Tables<'portal_faqs'>;
export type PortalInitialQuestion = Tables<'portal_initial_questions'>;
export type PortalFeedback = Tables<'portal_feedback'>;
export type PortalComment = Tables<'portal_comments'>;
// portal_timeline_phases removed — phases now come from project_phases via get_portal_phases RPC
export type PortalMonthlySummary = Tables<'portal_monthly_summaries'>;

// Determine portal type from product type
export function getPortalTypeFromProduct(productType: string | null): 'projeto_unico' | 'servico_mensal' | null {
  if (!productType) return null;
  const projetoTypes = [
    'projeto_1_1',
    'servico_pontual',
    'consulta',
    'consultoria_individual',
    'consultoria_grupo',
    'mentoria_individual',
    'mentoria_grupo',
    'programa_implementacao',
    'programa_implementacao_grupo',
    'workshop',
  ];
  if (projetoTypes.includes(productType)) return 'projeto_unico';
  if (productType === 'servico_mensal') return 'servico_mensal';
  return null;
}

export function usePortal(clientId: string | undefined) {
  const qc = useQueryClient();
  const key = ['client_portal', clientId];

  const portal = useQuery({
    queryKey: key,
    queryFn: async () => {
      if (!clientId) return null;
      const { data, error } = await supabase.from('client_portals').select('*').eq('client_id', clientId).maybeSingle();
      if (error) throw error;
      return data as Portal | null;
    },
    enabled: !!clientId,
  });

  const upsertPortal = useMutation({
    mutationFn: async (fields: Partial<Portal> & { client_id: string; portal_type: Portal['portal_type'] }) => {
      if (portal.data?.id) {
        const { error } = await supabase.from('client_portals').update(fields as TablesUpdate<'client_portals'>).eq('id', portal.data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('client_portals').insert(fields as TablesInsert<'client_portals'>);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: key }); qc.invalidateQueries({ queryKey: ['all_portals'] }); },
    onError: () => toast.error('Erro ao guardar portal'),
  });

  const updatePortal = useMutation({
    mutationFn: async (fields: Partial<Portal>) => {
      if (!portal.data?.id) return;
      const { error } = await supabase.from('client_portals').update(fields as TablesUpdate<'client_portals'>).eq('id', portal.data.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: key }); qc.invalidateQueries({ queryKey: ['all_portals'] }); },
  });

  return { portal, upsertPortal, updatePortal };
}

export function useAllPortals() {
  return useQuery({
    queryKey: ['all_portals'],
    queryFn: async () => {
      const { data, error } = await supabase.from('client_portals').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as Portal[];
    },
  });
}

// Portal FAQs
export function usePortalFaqs(portalId: string | undefined) {
  const qc = useQueryClient();
  const key = ['portal_faqs', portalId];

  const faqs = useQuery({
    queryKey: key,
    queryFn: async () => {
      if (!portalId) return [];
      const { data, error } = await supabase.from('portal_faqs').select('*').eq('portal_id', portalId).order('sort_order');
      if (error) throw error;
      return (data || []) as PortalFaq[];
    },
    enabled: !!portalId,
  });

  const addFaq = useMutation({
    mutationFn: async (entry: TablesInsert<'portal_faqs'>) => {
      const { error } = await supabase.from('portal_faqs').insert(entry);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const updateFaq = useMutation({
    mutationFn: async ({ id, ...fields }: TablesUpdate<'portal_faqs'> & { id: string }) => {
      const { error } = await supabase.from('portal_faqs').update(fields).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const deleteFaq = useMutation({
    mutationFn: async (id: string) => {
      await requireConfirm();
      const { error } = await supabase.from('portal_faqs').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  return { faqs, addFaq, updateFaq, deleteFaq };
}

// Portal Initial Questions
export function usePortalQuestions(portalId: string | undefined) {
  const qc = useQueryClient();
  const key = ['portal_questions', portalId];

  const questions = useQuery({
    queryKey: key,
    queryFn: async () => {
      if (!portalId) return [];
      const { data, error } = await supabase.from('portal_initial_questions').select('*').eq('portal_id', portalId).order('sort_order');
      if (error) throw error;
      return (data || []) as PortalInitialQuestion[];
    },
    enabled: !!portalId,
  });

  const addQuestion = useMutation({
    mutationFn: async (entry: TablesInsert<'portal_initial_questions'>) => {
      const { error } = await supabase.from('portal_initial_questions').insert(entry);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const updateQuestion = useMutation({
    mutationFn: async ({ id, ...fields }: TablesUpdate<'portal_initial_questions'> & { id: string }) => {
      const { error } = await supabase.from('portal_initial_questions').update(fields).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const deleteQuestion = useMutation({
    mutationFn: async (id: string) => {
      await requireConfirm();
      const { error } = await supabase.from('portal_initial_questions').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  return { questions, addQuestion, updateQuestion, deleteQuestion };
}

// Portal Feedback
export function usePortalFeedback(portalId: string | undefined) {
  const qc = useQueryClient();
  const key = ['portal_feedback', portalId];

  const feedback = useQuery({
    queryKey: key,
    queryFn: async () => {
      if (!portalId) return [];
      const { data, error } = await supabase.from('portal_feedback').select('*').eq('portal_id', portalId).order('submitted_at', { ascending: false });
      if (error) throw error;
      return (data || []) as PortalFeedback[];
    },
    enabled: !!portalId,
  });

  const addFeedback = useMutation({
    mutationFn: async (entry: TablesInsert<'portal_feedback'>) => {
      const { error } = await supabase.from('portal_feedback').insert(entry);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  return { feedback, addFeedback };
}

// Portal Comments
export function usePortalComments(portalId: string | undefined) {
  const qc = useQueryClient();
  const key = ['portal_comments', portalId];

  const comments = useQuery({
    queryKey: key,
    queryFn: async () => {
      if (!portalId) return [];
      const { data, error } = await supabase.from('portal_comments').select('*').eq('portal_id', portalId).order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as PortalComment[];
    },
    enabled: !!portalId,
  });

  const addComment = useMutation({
    mutationFn: async (entry: TablesInsert<'portal_comments'>) => {
      const { error } = await supabase.from('portal_comments').insert(entry);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  return { comments, addComment };
}

// Portal Timeline — now reads from project_phases via get_portal_phases RPC (legacy usePortalTimeline removed)

// Portal Monthly Summaries
export function usePortalSummaries(portalId: string | undefined) {
  const qc = useQueryClient();
  const key = ['portal_summaries', portalId];

  const summaries = useQuery({
    queryKey: key,
    queryFn: async () => {
      if (!portalId) return [];
      const { data, error } = await supabase.from('portal_monthly_summaries').select('*').eq('portal_id', portalId).order('year', { ascending: false }).order('month', { ascending: false });
      if (error) throw error;
      return (data || []) as PortalMonthlySummary[];
    },
    enabled: !!portalId,
  });

  const addSummary = useMutation({
    mutationFn: async (entry: TablesInsert<'portal_monthly_summaries'>) => {
      const { error } = await supabase.from('portal_monthly_summaries').insert(entry);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const updateSummary = useMutation({
    mutationFn: async ({ id, ...fields }: TablesUpdate<'portal_monthly_summaries'> & { id: string }) => {
      const { error } = await supabase.from('portal_monthly_summaries').update(fields).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const deleteSummary = useMutation({
    mutationFn: async (id: string) => {
      await requireConfirm();
      const { error } = await supabase.from('portal_monthly_summaries').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  return { summaries, addSummary, updateSummary, deleteSummary };
}
