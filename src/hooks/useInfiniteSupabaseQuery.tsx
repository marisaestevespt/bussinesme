import { useInfiniteQuery, type UseInfiniteQueryOptions } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const PAGE_SIZE = 50;

export type InfinitePageResult<T> = {
  data: T[];
  count: number | null;
  nextPage: number | undefined;
};

/**
 * Generic hook for paginated Supabase queries with infinite scroll.
 * 
 * @param queryKey - React Query key
 * @param tableName - Supabase table name
 * @param options - { select, orderBy, ascending, filters }
 */
export function useInfiniteSupabaseQuery<T = Record<string, unknown>>(
  queryKey: unknown[],
  tableName: string,
  options: {
    select?: string;
    orderBy?: string;
    ascending?: boolean;
    filters?: (query: any) => any;
    enabled?: boolean;
  } = {}
) {
  const {
    select = '*',
    orderBy = 'created_at',
    ascending = false,
    filters,
    enabled = true,
  } = options;

  return useInfiniteQuery<InfinitePageResult<T>>({
    queryKey,
    initialPageParam: 0,
    queryFn: async ({ pageParam = 0 }) => {
      const from = (pageParam as number) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from(tableName)
        .select(select, { count: 'exact' })
        .order(orderBy, { ascending })
        .range(from, to);

      if (filters) {
        query = filters(query);
      }

      const { data, error, count } = await query;
      if (error) throw error;

      return {
        data: (data || []) as T[],
        count,
        nextPage: (data?.length ?? 0) === PAGE_SIZE ? (pageParam as number) + 1 : undefined,
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextPage,
    enabled,
  });
}

/** Flatten all pages into a single array */
export function flattenInfiniteData<T>(pages: InfinitePageResult<T>[] | undefined): T[] {
  if (!pages) return [];
  return pages.flatMap((p) => p.data);
}

/** Get total count from infinite query */
export function getInfiniteCount(pages: InfinitePageResult<unknown>[] | undefined): number | null {
  if (!pages?.length) return null;
  return pages[0].count;
}
