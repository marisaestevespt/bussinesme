import { cn } from '@/lib/utils';

interface CollectionGridProps {
  children: React.ReactNode;
  /** Density preset. `compact` = 4-up, `comfortable` = 3-up, `spacious` = 2-up. */
  density?: 'compact' | 'comfortable' | 'spacious';
  className?: string;
}

const DENSITY: Record<NonNullable<CollectionGridProps['density']>, string> = {
  compact: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
  comfortable: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  spacious: 'grid-cols-1 md:grid-cols-2',
};

/**
 * Canonical responsive grid for galleries of entity cards.
 */
export function CollectionGrid({ children, density = 'comfortable', className }: CollectionGridProps) {
  return (
    <div className={cn('grid gap-3', DENSITY[density], className)}>{children}</div>
  );
}