import { useEffect, useRef, useCallback } from 'react';
import { Loader2 } from 'lucide-react';

interface InfiniteScrollListProps {
  /** Total count of items in the DB (null = unknown) */
  totalCount: number | null;
  /** Number of items currently loaded */
  loadedCount: number;
  /** Whether there are more pages */
  hasNextPage: boolean | undefined;
  /** Whether a page is currently being fetched */
  isFetchingNextPage: boolean;
  /** Fetch the next page */
  fetchNextPage: () => void;
  /** Children to render */
  children: React.ReactNode;
  /** Show counter at top? Default true */
  showCounter?: boolean;
}

export function InfiniteScrollList({
  totalCount,
  loadedCount,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  children,
  showCounter = true,
}: InfiniteScrollListProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  const handleIntersect = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    },
    [hasNextPage, isFetchingNextPage, fetchNextPage]
  );

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(handleIntersect, { rootMargin: '200px' });
    observer.observe(el);
    return () => observer.disconnect();
  }, [handleIntersect]);

  return (
    <div>
      {showCounter && totalCount !== null && (
        <p className="text-xs text-muted-foreground mb-2 px-6">
          Mostrando {loadedCount} de {totalCount}
        </p>
      )}
      {children}
      <div ref={sentinelRef} className="h-1" />
      {isFetchingNextPage && (
        <div className="flex justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  );
}
