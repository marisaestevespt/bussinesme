import { cn } from '@/lib/utils';

interface CollectionPageProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Canonical wrapper for any "collection" page (gallery / list / board / table
 * of entities). Provides consistent vertical rhythm and max-width.
 *
 * Composition:
 *   <CollectionPage>
 *     <CollectionHeader title="Reuniões" actions={...} />
 *     <CollectionToolbar>...</CollectionToolbar>
 *     <CollectionViewSwitcher value={view} onChange={...} />
 *     <CollectionGrid>{items.map(...)}</CollectionGrid>
 *   </CollectionPage>
 */
export function CollectionPage({ children, className }: CollectionPageProps) {
  return (
    <div className={cn('w-full space-y-6', className)}>
      {children}
    </div>
  );
}