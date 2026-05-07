import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useImpersonation } from '@/contexts/ImpersonationContext';

type Entity = 'meeting' | 'client' | 'project';

const FN_BY_ENTITY: Record<Entity, 'user_can_open_meeting' | 'user_can_open_client' | 'user_can_open_project'> = {
  meeting: 'user_can_open_meeting',
  client: 'user_can_open_client',
  project: 'user_can_open_project',
};

const PARAM_BY_ENTITY: Record<Entity, string> = {
  meeting: '_meeting_id',
  client: '_client_id',
  project: '_project_id',
};

type ImpersonatedLite = { user_id: string | null; profile_id: string | null };

async function checkAccessAsImpersonated(
  entity: Entity,
  id: string,
  imp: ImpersonatedLite,
): Promise<boolean> {
  const profileId = imp.profile_id;
  const userId = imp.user_id;

  if (entity === 'meeting') {
    if (profileId) {
      const { data } = await supabase
        .from('meeting_participants')
        .select('meeting_id')
        .eq('meeting_id', id)
        .eq('profile_id', profileId)
        .maybeSingle();
      if (data) return true;
    }
    if (userId) {
      const { data } = await supabase
        .from('meetings')
        .select('id')
        .eq('id', id)
        .eq('created_by', userId)
        .maybeSingle();
      if (data) return true;
    }
    return false;
  }

  if (entity === 'project') {
    if (!profileId) return false;
    // Member of project?
    const { data: pm } = await supabase
      .from('project_members')
      .select('id')
      .eq('project_id', id)
      .eq('profile_id', profileId)
      .maybeSingle();
    if (pm) return true;
    // Or assigned to the project's client
    const { data: proj } = await supabase
      .from('projects')
      .select('client_id')
      .eq('id', id)
      .maybeSingle();
    if (proj?.client_id) {
      const { data: ca } = await supabase
        .from('client_assignments')
        .select('id')
        .eq('client_id', proj.client_id)
        .eq('profile_id', profileId)
        .maybeSingle();
      if (ca) return true;
    }
    return false;
  }

  if (entity === 'client') {
    if (!profileId) return false;
    const { data } = await supabase
      .from('client_assignments')
      .select('id')
      .eq('client_id', id)
      .eq('profile_id', profileId)
      .maybeSingle();
    return Boolean(data);
  }

  return false;
}


/**
 * Verifica se o utilizador atual pode abrir o detalhe de uma reunião ou cliente.
 * Owner/Admin retornam sempre true (validado pela função SQL).
 */
export function useDetailAccess(entity: Entity, id: string | null | undefined) {
  const { user, isAdminOrOwner } = useAuth();
  const { impersonating } = useImpersonation();
  return useQuery({
    queryKey: ['detail-access', entity, id, user?.id, impersonating?.member_id ?? null],
    enabled: !!user && !!id,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      // While impersonating, behave as the impersonated member (no admin bypass).
      // The SQL RPCs evaluate auth.uid() (the real owner) so they would always
      // return true — we have to validate client-side using the impersonated
      // member's profile_id / user_id.
      if (impersonating) {
        return await checkAccessAsImpersonated(entity, id!, impersonating);
      }
      if (isAdminOrOwner) return true;
      const fn = FN_BY_ENTITY[entity];
      const { data, error } = await supabase.rpc(fn as any, { [PARAM_BY_ENTITY[entity]]: id } as any);
      if (error) {
        console.warn('[useDetailAccess]', entity, error.message);
        return false;
      }
      return Boolean(data);
    },
  });
}

/**
 * Versão batch: verifica acesso a múltiplos ids de uma vez.
 * Usa um único RPC por id mas com cache partilhado (react-query dedupa).
 * Para listagens grandes (>50 items) considerar criar uma função SQL batch.
 */
export function useDetailAccessMap(entity: Entity, ids: string[]) {
  const { user, isAdminOrOwner } = useAuth();
  const { impersonating } = useImpersonation();
  return useQuery({
    queryKey: ['detail-access-map', entity, ids.slice().sort().join(','), user?.id, impersonating?.member_id ?? null],
    enabled: !!user && ids.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const map: Record<string, boolean> = {};
      if (impersonating) {
        const results = await Promise.all(
          ids.map(async (id) => [id, await checkAccessAsImpersonated(entity, id, impersonating)] as const),
        );
        results.forEach(([id, ok]) => (map[id] = ok));
        return map;
      }
      if (isAdminOrOwner) {
        ids.forEach((id) => (map[id] = true));
        return map;
      }
      const fn = FN_BY_ENTITY[entity];
      const param = PARAM_BY_ENTITY[entity];
      // Paraleliza chamadas (RPC não suporta batch nativo)
      const results = await Promise.all(
        ids.map(async (id) => {
          const { data } = await supabase.rpc(fn as any, { [param]: id } as any);
          return [id, Boolean(data)] as const;
        }),
      );
      results.forEach(([id, ok]) => (map[id] = ok));
      return map;
    },
  });
}