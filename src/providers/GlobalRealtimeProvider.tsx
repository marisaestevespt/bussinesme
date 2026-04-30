import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

/**
 * Subscreve TODAS as mudanças do schema `public` via Supabase Realtime e
 * invalida queries do React Query relacionadas com a tabela alterada.
 *
 * Estratégia de invalidação:
 *  - Para cada evento, percorre todas as queries ativas e invalida aquelas
 *    cuja queryKey contenha o nome da tabela como string (em qualquer posição)
 *    ou cujo primeiro elemento corresponda exatamente.
 *
 * Isto faz com que TODAS as views/listagens reflitam alterações em tempo real,
 * sem necessidade de refresh manual da página.
 */
export function GlobalRealtimeProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const debounceMap = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    if (!user) {
      // Sem utilizador autenticado, não subscrever (RLS bloquearia tudo)
      return;
    }

    const invalidateForTable = (table: string) => {
      // Debounce por tabela: agrupa rajadas de eventos em 150ms
      const existing = debounceMap.current.get(table);
      if (existing) clearTimeout(existing);
      const timeout = setTimeout(() => {
        debounceMap.current.delete(table);
        queryClient.invalidateQueries({
          predicate: (query) => {
            const key = query.queryKey;
            if (!Array.isArray(key)) return false;
            return key.some((part) => {
              if (typeof part !== 'string') return false;
              // Match exato ou contains (case-insensitive)
              return (
                part === table ||
                part.toLowerCase().includes(table.toLowerCase())
              );
            });
          },
        });
      }, 150);
      debounceMap.current.set(table, timeout);
    };

    const channel = supabase
      .channel('global-db-changes')
      .on(
        'postgres_changes' as any,
        { event: '*', schema: 'public' },
        (payload: any) => {
          const table = payload?.table;
          if (typeof table === 'string' && table.length > 0) {
            invalidateForTable(table);
          }
        },
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      debounceMap.current.forEach((t) => clearTimeout(t));
      debounceMap.current.clear();
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [user, queryClient]);

  return <>{children}</>;
}