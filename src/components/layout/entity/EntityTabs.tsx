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
        'inline-flex h-auto bg-muted/50 p-1 rounded-full gap-1 flex-wrap',
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
        'rounded-full px-4 py-1 text-sm font-medium transition-all',
        'data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm',
        'data-[state=inactive]:text-muted-foreground hover:text-foreground',
        className,
      )}
    >
      {children}
    </TabsTrigger>
  );
}