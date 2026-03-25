import { ReactNode } from 'react';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { NotificationBell } from '@/components/NotificationBell';
import { FavoriteButton } from '@/components/FavoriteButton';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useContractExpiryNotifications } from '@/hooks/useContractExpiryNotifications';

export function AppLayout({ children }: { children: ReactNode }) {
  const { settings } = useBusinessSettings();
  useContractExpiryNotifications();

  return (
    <TooltipProvider>
      <SidebarProvider>
        <div className="min-h-screen flex w-full">
          <AppSidebar />
          <div className="flex-1 flex flex-col min-w-0">
            <header className="h-12 flex items-center border-b px-4 shrink-0">
              <SidebarTrigger className="mr-3" />
              <span className="text-sm text-muted-foreground truncate flex-1">
                HQ | {settings?.business_name || ''}
              </span>
              <div className="flex items-center gap-1">
                <FavoriteButton />
                <NotificationBell />
              </div>
            </header>
            <main className="flex-1 p-6 overflow-auto">
              {children}
            </main>
          </div>
        </div>
      </SidebarProvider>
    </TooltipProvider>
  );
}
