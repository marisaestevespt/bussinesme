import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import type { TablesInsert, TablesUpdate, Json } from '@/integrations/supabase/types';

export interface DigestSettings {
  id: string;
  user_id: string;
  is_owner_digest: boolean;
  enabled: boolean;
  frequency: 'diario' | 'semanal' | 'mensal';
  send_time: string;
  send_day_of_week: number | null;
  send_day_of_month: number | null;
  sections: Record<string, boolean>;
  digest_type: 'morning' | 'eod';
}

const OWNER_DEFAULT_SECTIONS: Record<string, boolean> = {
  reunioes_dia: true,
  tarefas_equipa_hoje: true,
  tarefas_atraso: true,
  followups_leads: true,
  aniversarios: true,
  renovacoes_clientes: true,
  rotinas_dia: true,
  vendas_hoje: true,
  leads_novas: true,
  nps_recebidos: true,
  pagamentos_recebidos: true,
  projetos_fechados: true,
  projetos_novos: true,
  tempo_trabalhado: true,
  resumo_membros: true,
  prazos_fiscais: true,
};

const MEMBER_DEFAULT_SECTIONS: Record<string, boolean> = {
  tarefas_hoje: true,
  tarefas_atraso: true,
  reunioes_hoje: true,
  followups_leads: true,
  aniversarios: true,
  renovacoes_clientes: true,
  rotinas: true,
  tarefas_concluidas: true,
  tempo_registado: true,
};

const OWNER_EOD_DEFAULT_SECTIONS: Record<string, boolean> = {
  tarefas_concluidas_equipa: true,
  rotinas_progresso: true,
  tempo_trabalhado: true,
  vendas_hoje: true,
  pagamentos_recebidos: true,
  projetos_fechados: true,
  tarefas_atraso: true,
};

const MEMBER_EOD_DEFAULT_SECTIONS: Record<string, boolean> = {
  tarefas_concluidas: true,
  rotinas_progresso: true,
  tempo_registado: true,
  tarefas_atraso: true,
  preview_amanha: true,
};

export function useDigestSettings(isOwnerDigest: boolean, digestType: 'morning' | 'eod' = 'morning') {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const profileQuery = useQuery({
    queryKey: ['my-profile-id', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user!.id)
        .maybeSingle();
      return data?.id || null;
    },
  });

  const profileId = profileQuery.data;

  const settingsQuery = useQuery({
    queryKey: ['digest-settings', profileId, isOwnerDigest, digestType],
    enabled: !!profileId,
    queryFn: async () => {
      const { data } = await supabase
        .from('digest_settings')
        .select('*')
        .eq('user_id', profileId!)
        .eq('is_owner_digest', isOwnerDigest);
      // Filter by digest_type in JS since it's a new column
      type DigestRow = { digest_type?: string | null };
      const match = (data || []).find((d: DigestRow) => (d.digest_type || 'morning') === digestType);
      return (match as DigestSettings | undefined) || null;
    },
  });

  const upsertMutation = useMutation({
    mutationFn: async (updates: Partial<DigestSettings>) => {
      if (!profileId) throw new Error('Profile not found');

      const defaultSections = isOwnerDigest
        ? (digestType === 'eod' ? OWNER_EOD_DEFAULT_SECTIONS : OWNER_DEFAULT_SECTIONS)
        : (digestType === 'eod' ? MEMBER_EOD_DEFAULT_SECTIONS : MEMBER_DEFAULT_SECTIONS);

      if (settingsQuery.data?.id) {
        const patch: TablesUpdate<'digest_settings'> = {
          ...updates,
          ...(updates.sections !== undefined ? { sections: updates.sections as unknown as Json } : {}),
        } as TablesUpdate<'digest_settings'>;
        const { error } = await supabase
          .from('digest_settings')
          .update(patch)
          .eq('id', settingsQuery.data.id);
        if (error) throw error;
      } else {
        const insert: TablesInsert<'digest_settings'> = {
          user_id: profileId,
          is_owner_digest: isOwnerDigest,
          digest_type: digestType,
          sections: defaultSections as unknown as Json,
          ...updates,
          ...(updates.sections !== undefined ? { sections: updates.sections as unknown as Json } : {}),
        } as TablesInsert<'digest_settings'>;
        const { error } = await supabase
          .from('digest_settings')
          .insert(insert);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['digest-settings', profileId, isOwnerDigest, digestType] });
    },
  });

  const getDefaultSections = () => {
    if (isOwnerDigest) return digestType === 'eod' ? OWNER_EOD_DEFAULT_SECTIONS : OWNER_DEFAULT_SECTIONS;
    return digestType === 'eod' ? MEMBER_EOD_DEFAULT_SECTIONS : MEMBER_DEFAULT_SECTIONS;
  };

  return {
    settings: settingsQuery.data,
    isLoading: profileQuery.isLoading || settingsQuery.isLoading,
    profileId,
    update: upsertMutation.mutateAsync,
    isUpdating: upsertMutation.isPending,
    ownerDefaultSections: OWNER_DEFAULT_SECTIONS,
    memberDefaultSections: MEMBER_DEFAULT_SECTIONS,
    ownerEodDefaultSections: OWNER_EOD_DEFAULT_SECTIONS,
    memberEodDefaultSections: MEMBER_EOD_DEFAULT_SECTIONS,
    defaultSections: getDefaultSections(),
  };
}
