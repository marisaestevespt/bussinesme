import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Fetch active team members filtered by work_area.
 * work_areas is a jsonb array column, so we use the @> containment operator.
 */
export function useTeamByWorkArea(area: string) {
  return useQuery({
    queryKey: ['team-members-by-area', area],
    queryFn: async () => {
      const { data } = await supabase
        .from('team_members')
        .select('id, full_name, profile_id, role_title, photo_url, email, work_areas')
        .eq('status', 'ativo')
        .filter('work_areas', 'cs', `["${area}"]`)
        .order('full_name');
      return data || [];
    },
    enabled: !!area,
  });
}

/** Get all commercial members (cliente_comercial) */
export function useCommercialMembers() {
  return useTeamByWorkArea('cliente_comercial');
}

/** Get all service members (cliente_servico) */
export function useServiceMembers() {
  return useTeamByWorkArea('cliente_servico');
}

/** Get all administrative members (cliente_administrativo) */
export function useAdminMembers() {
  return useTeamByWorkArea('cliente_administrativo');
}
