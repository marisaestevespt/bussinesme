import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

type Entity = 'meeting' | 'client';

const FN_BY_ENTITY: Record<Entity, 'user_can_open_meeting' | 'user_can_open_client'> = {
  meeting: 'user_can_open_meeting',
  client: 'user_can_open_client',
};

/**
 * Verifica se o utilizador atual pode abrir o detalhe de uma reunião ou cliente.
 * Owner/Admin retornam sempre true (validado pela função SQL).
 */
export function useDetailAccess(entity: Entity, id: string | null | undefined) {
  const { user, isAdminOrOwner } = useAuth();
  return useQuery({
    queryKey: ['detail-access', entity, id, user?.id],
    enabled: !!user && !!id,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      if (isAdminOrOwner) return true;
      const fn = FN_BY_ENTITY[entity];
      const { data, error } = await supabase.rpc(fn as any, {
        [entity === 'meeting' ? '_meeting_id' : '_client_id']: id,
      } as any);
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
  return useQuery({
    queryKey: ['detail-access-map', entity, ids.slice().sort().join(','), user?.id],
    enabled: !!user && ids.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const map: Record<string, boolean> = {};
      if (isAdminOrOwner) {
        ids.forEach((id) => (map[id] = true));
        return map;
      }
      const fn = FN_BY_ENTITY[entity];
      const param = entity === 'meeting' ? '_meeting_id' : '_client_id';
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