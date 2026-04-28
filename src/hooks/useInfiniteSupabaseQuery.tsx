import { useInfiniteQuery, type UseInfiniteQueryOptions } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/** Loose Supabase query builder — `.from()` returns a deeply-typed builder
 *  parameterised by the literal table name; we accept arbitrary table names
 *  here, so we model the builder as `unknown` with a callable filter shape. */
type SupabaseFilterBuilder = {
  range: (from: number, to: number) => SupabaseFilterBuilder;
  // Allow any chained filter methods used by callers (.eq, .in, .gte, etc.)
  [k: string]: unknown;
};
type SupabaseFromFn = (table: string) => {
  select: (sel: string, opts: { count: 'exact' }) => {
    order: (col: string, opts: { ascending: boolean }) => SupabaseFilterBuilder;
  };
};

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
    filters?: (query: SupabaseFilterBuilder) => SupabaseFilterBuilder;
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

      const fromFn = supabase.from as unknown as SupabaseFromFn;
      let query: SupabaseFilterBuilder = fromFn(tableName)
        .select(select, { count: 'exact' })
        .order(orderBy, { ascending })
        .range(from, to);

      if (filters) {
        query = filters(query);
      }

      const { data, error, count } = (await (query as unknown as Promise<{
        data: T[] | null;
        error: Error | null;
        count: number | null;
      }>)) as { data: T[] | null; error: Error | null; count: number | null };
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
