import { ReactNode } from 'react';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { NotificationBell } from '@/components/NotificationBell';
import { FavoriteButton } from '@/components/FavoriteButton';
import { AiInsightsButton } from '@/components/AiInsightsButton';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useSystemNotifications } from '@/hooks/useSystemNotifications';
import { OnboardingTour } from '@/components/OnboardingTour';
import { FloatingAiChat } from '@/components/FloatingAiChat';
import { TabsBar } from '@/components/TabsBar';
import { NewTabButton } from '@/components/TabsBar';

export function AppLayout({ children }: { children: ReactNode }) {
  const { settings } = useBusinessSettings();
  useSystemNotifications();

  return (
    <TooltipProvider>
      <SidebarProvider>
        <div className="min-h-screen flex w-full bg-muted/30">
          <AppSidebar />
          <div className="flex-1 flex flex-col min-w-0">
            <header className="h-14 flex items-center border-b bg-background/80 backdrop-blur-sm px-3 sm:px-5 shrink-0 sticky top-0 z-30">
              <SidebarTrigger className="mr-2 sm:mr-3" />
              <span className="text-sm font-medium text-muted-foreground truncate flex-1 min-w-0">
                {settings?.business_name || 'Lyrata'}
              </span>
              {/* Desktop: all buttons inline */}
              <div className="hidden sm:flex items-center gap-1 shrink-0">
                <AiInsightsButton />
                <NewTabButton />
                <FavoriteButton />
                <NotificationBell />
              </div>
              {/* Mobile: only NotificationBell visible, rest in overflow */}
              <div className="flex sm:hidden items-center gap-0.5 shrink-0">
                <AiInsightsButton />
                <FavoriteButton />
                <NotificationBell />
              </div>
            </header>
            <TabsBar />
            <main className="flex-1 p-4 sm:p-8 lg:p-12 pb-24 sm:pb-10 overflow-auto">
              {children}
            </main>
            <OnboardingTour />
            <FloatingAiChat />
          </div>
        </div>
      </SidebarProvider>
    </TooltipProvider>
  );
}
