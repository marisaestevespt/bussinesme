import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

/**
 * Canonical tab style: pills (capsule). Used across all entity detail pages.
 *
 * Usage:
 *   <EntityTabs defaultValue="info">
 *     <EntityTabsList>
 *       <EntityTabsTrigger value="info">Info</EntityTabsTrigger>
 *       <EntityTabsTrigger value="docs">Documentos</EntityTabsTrigger>
 *     </EntityTabsList>
 *     <EntityTabsContent value="info">...</EntityTabsContent>
 *   </EntityTabs>
 */
export const EntityTabs = Tabs;
export const EntityTabsContent = TabsContent;

export function EntityTabsList({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <TabsList
      className={cn(
        'inline-flex h-auto bg-transparent p-1 rounded-sm gap-1 flex-wrap border-2 border-primary/25',
        className,
      )}
    >
      {children}
    </TabsList>
  );
}

export function EntityTabsTrigger({
  value,
  children,
  className,
}: {
  value: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <TabsTrigger
      value={value}
      className={cn(
        'rounded-sm px-4 py-1.5 font-typewriter text-[11px] uppercase tracking-[0.16em] border-2 border-transparent transition-all',
        'data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary data-[state=active]:shadow-md',
        'data-[state=inactive]:text-foreground/70 hover:text-primary hover:bg-primary/5 hover:border-primary/30',
        className,
      )}
    >
      {children}
    </TabsTrigger>
  );
}