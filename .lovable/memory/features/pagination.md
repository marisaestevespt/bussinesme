Infinite scroll pagination system to avoid Supabase 1000-row limit truncation.

## Architecture
- `src/hooks/useInfiniteSupabaseQuery.tsx` — reusable hook with PAGE_SIZE=50, flattenInfiniteData, getInfiniteCount helpers
- `src/components/InfiniteScrollList.tsx` — UI wrapper with IntersectionObserver sentinel, "Mostrando X de Y" counter, bottom loader

## Paginated hooks/pages
- useClients.tsx — clients query returns { data, totalCount, hasNextPage, fetchNextPage, isFetchingNextPage }
- useCrmData.tsx — leads query (same pattern)
- useFinancialData.tsx — expenses query (same pattern)
- useCommercialData.tsx — allSales query (infinite, no count)
- Tarefas.tsx — tasks query with useInfiniteQuery inline
- Projetos.tsx — projects query with useInfiniteQuery inline
- Reunioes.tsx — meetings via useMeetings() returns infinite query
- Processos.tsx — sops query with useInfiniteQuery inline

## Pattern for hooks returning paginated data
```tsx
const clients = {
  ...clientsQuery,
  data: flattenInfiniteData(clientsQuery.data?.pages),
  totalCount: getInfiniteCount(clientsQuery.data?.pages),
};
```

## Analytical queries (NOT paginated — filtered by year instead)
- useCommercialData sales query — filtered by .eq('sale_year', year)
- usePlanningData — all queries filtered by year
- ExecutiveWeeklyAlign — filtered by week range
- MarketingAnalise — filtered by month/year
