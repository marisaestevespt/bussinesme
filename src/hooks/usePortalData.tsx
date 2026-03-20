import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const sb = (table: string) => supabase.from(table as any) as any;

export type Portal = {
  id: string;
  created_at: string;
  client_id: string;
  token: string;
  is_active: boolean;
  portal_type: 'projeto_unico' | 'servico_mensal';
  show_workspace: boolean;
  show_meetings: boolean;
  show_payments: boolean;
  show_faqs: boolean;
  show_onboarding: boolean;
  show_timeline: boolean;
  show_monthly_summary: boolean;
  last_visit_at: string | null;
};

export type PortalFaq = {
  id: string; created_at: string; portal_id: string;
  question: string; answer: string | null; sort_order: number;
};

export type PortalInitialQuestion = {
  id: string; created_at: string; portal_id: string;
  question: string; answer: string | null; answered_at: string | null; sort_order: number;
};

export type PortalFeedback = {
  id: string; created_at: string; portal_id: string;
  content: string; submitted_at: string;
};

export type PortalComment = {
  id: string; created_at: string; portal_id: string;
  content: string; author: 'client' | 'team'; author_name: string;
};

export type PortalTimelinePhase = {
  id: string; created_at: string; portal_id: string;
  title: string; status: string; sort_order: number;
};

export type PortalMonthlySummary = {
  id: string; created_at: string; portal_id: string;
  month: number; year: number; content: string;
};

// Determine portal type from product type
export function getPortalTypeFromProduct(productType: string | null): 'projeto_unico' | 'servico_mensal' | null {
  if (!productType) return null;
  const projetoTypes = ['projeto_1_1', 'consultoria_individual', 'consultoria_grupo', 'mentoria_individual', 'mentoria_grupo'];
  if (projetoTypes.includes(productType)) return 'projeto_unico';
  if (productType === 'servico_mensal') return 'servico_mensal';
  return null; // curso, template — no portal
}

export function usePortal(clientId: string | undefined) {
  const qc = useQueryClient();
  const key = ['client_portal', clientId];

  const portal = useQuery({
    queryKey: key,
    queryFn: async () => {
      if (!clientId) return null;
      const { data, error } = await sb('client_portals').select('*').eq('client_id', clientId).maybeSingle();
      if (error) throw error;
      return data as Portal | null;
    },
    enabled: !!clientId,
  });

  const upsertPortal = useMutation({
    mutationFn: async (fields: Partial<Portal> & { client_id: string; portal_type: string }) => {
      if (portal.data?.id) {
        const { error } = await sb('client_portals').update(fields).eq('id', portal.data.id);
        if (error) throw error;
      } else {
        const { error } = await sb('client_portals').insert(fields);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: key }); qc.invalidateQueries({ queryKey: ['all_portals'] }); },
    onError: () => toast.error('Erro ao guardar portal'),
  });

  const updatePortal = useMutation({
    mutationFn: async (fields: Partial<Portal>) => {
      if (!portal.data?.id) return;
      const { error } = await sb('client_portals').update(fields).eq('id', portal.data.id);
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
      const { data, error } = await sb('client_portals').select('*').order('created_at', { ascending: false });
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
      const { data, error } = await sb('portal_faqs').select('*').eq('portal_id', portalId).order('sort_order');
      if (error) throw error;
      return (data || []) as PortalFaq[];
    },
    enabled: !!portalId,
  });

  const addFaq = useMutation({
    mutationFn: async (entry: Partial<PortalFaq> & { portal_id: string }) => {
      const { error } = await sb('portal_faqs').insert(entry);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const updateFaq = useMutation({
    mutationFn: async ({ id, ...fields }: Partial<PortalFaq> & { id: string }) => {
      const { error } = await sb('portal_faqs').update(fields).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const deleteFaq = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb('portal_faqs').delete().eq('id', id);
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
      const { data, error } = await sb('portal_initial_questions').select('*').eq('portal_id', portalId).order('sort_order');
      if (error) throw error;
      return (data || []) as PortalInitialQuestion[];
    },
    enabled: !!portalId,
  });

  const addQuestion = useMutation({
    mutationFn: async (entry: Partial<PortalInitialQuestion> & { portal_id: string }) => {
      const { error } = await sb('portal_initial_questions').insert(entry);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const updateQuestion = useMutation({
    mutationFn: async ({ id, ...fields }: Partial<PortalInitialQuestion> & { id: string }) => {
      const { error } = await sb('portal_initial_questions').update(fields).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const deleteQuestion = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb('portal_initial_questions').delete().eq('id', id);
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
      const { data, error } = await sb('portal_feedback').select('*').eq('portal_id', portalId).order('submitted_at', { ascending: false });
      if (error) throw error;
      return (data || []) as PortalFeedback[];
    },
    enabled: !!portalId,
  });

  const addFeedback = useMutation({
    mutationFn: async (entry: { portal_id: string; content: string }) => {
      const { error } = await sb('portal_feedback').insert(entry);
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
      const { data, error } = await sb('portal_comments').select('*').eq('portal_id', portalId).order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as PortalComment[];
    },
    enabled: !!portalId,
  });

  const addComment = useMutation({
    mutationFn: async (entry: { portal_id: string; content: string; author: 'client' | 'team'; author_name: string }) => {
      const { error } = await sb('portal_comments').insert(entry);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  return { comments, addComment };
}

// Portal Timeline Phases
export function usePortalTimeline(portalId: string | undefined) {
  const qc = useQueryClient();
  const key = ['portal_timeline', portalId];

  const phases = useQuery({
    queryKey: key,
    queryFn: async () => {
      if (!portalId) return [];
      const { data, error } = await sb('portal_timeline_phases').select('*').eq('portal_id', portalId).order('sort_order');
      if (error) throw error;
      return (data || []) as PortalTimelinePhase[];
    },
    enabled: !!portalId,
  });

  const addPhase = useMutation({
    mutationFn: async (entry: Partial<PortalTimelinePhase> & { portal_id: string }) => {
      const { error } = await sb('portal_timeline_phases').insert(entry);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const updatePhase = useMutation({
    mutationFn: async ({ id, ...fields }: Partial<PortalTimelinePhase> & { id: string }) => {
      const { error } = await sb('portal_timeline_phases').update(fields).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const deletePhase = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb('portal_timeline_phases').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  return { phases, addPhase, updatePhase, deletePhase };
}

// Portal Monthly Summaries
export function usePortalSummaries(portalId: string | undefined) {
  const qc = useQueryClient();
  const key = ['portal_summaries', portalId];

  const summaries = useQuery({
    queryKey: key,
    queryFn: async () => {
      if (!portalId) return [];
      const { data, error } = await sb('portal_monthly_summaries').select('*').eq('portal_id', portalId).order('year', { ascending: false }).order('month', { ascending: false });
      if (error) throw error;
      return (data || []) as PortalMonthlySummary[];
    },
    enabled: !!portalId,
  });

  const addSummary = useMutation({
    mutationFn: async (entry: Partial<PortalMonthlySummary> & { portal_id: string; month: number; year: number; content: string }) => {
      const { error } = await sb('portal_monthly_summaries').insert(entry);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const updateSummary = useMutation({
    mutationFn: async ({ id, ...fields }: Partial<PortalMonthlySummary> & { id: string }) => {
      const { error } = await sb('portal_monthly_summaries').update(fields).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const deleteSummary = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb('portal_monthly_summaries').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  return { summaries, addSummary, updateSummary, deleteSummary };
}
