import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface CollectionToolbarProps {
  /** Optional controlled search value. If omitted, search is hidden. */
  search?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  /** Filter chips / select dropdowns rendered after the search input. */
  children?: React.ReactNode;
  /** Right-aligned slot (e.g. view switcher). */
  trailing?: React.ReactNode;
  className?: string;
}

/**
 * Canonical toolbar for collection pages: search on the left, filter chips
 * in the middle, optional trailing slot (view switcher) on the right.
 */
export function CollectionToolbar({
  search,
  onSearchChange,
  searchPlaceholder = 'Pesquisar…',
  children,
  trailing,
  className,
}: CollectionToolbarProps) {
  const hasSearch = search !== undefined && onSearchChange !== undefined;
  return (
    <div className={cn('flex flex-col gap-2 md:flex-row md:items-center md:justify-between', className)}>
      <div className="flex flex-1 flex-wrap items-center gap-2">
        {hasSearch && (
          <div className="relative w-full md:w-64">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.5} />
            <Input
              value={search}
              onChange={(e) => onSearchChange?.(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-9 pl-8"
            />
          </div>
        )}
        {children}
      </div>
      {trailing && <div className="flex items-center gap-2">{trailing}</div>}
    </div>
  );
}