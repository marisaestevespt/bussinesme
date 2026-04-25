import { ReactNode, lazy, Suspense } from 'react';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { NotificationBell } from '@/components/NotificationBell';
import { FavoriteButton } from '@/components/FavoriteButton';
import { AiInsightsButton } from '@/components/AiInsightsButton';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useSystemNotifications } from '@/hooks/useSystemNotifications';
import { TabsBar } from '@/components/TabsBar';
import { NewTabButton } from '@/components/TabsBar';

// Lazy-load heavy floating widgets (pdfjs, large UI) to keep AppLayout chunk small
const OnboardingTour = lazy(() => import('@/components/OnboardingTour').then(m => ({ default: m.OnboardingTour })));
const FloatingAiChat = lazy(() => import('@/components/FloatingAiChat').then(m => ({ default: m.FloatingAiChat })));

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
              <div className="flex-1 min-w-0 flex flex-col">
                <span className="text-sm font-medium text-foreground truncate">
                  {settings?.business_name || 'Sistema Lyrata®'}
                </span>
                {settings?.business_name && (
                  <span className="text-xs text-muted-foreground truncate">
                    Sistema Lyrata®
                  </span>
                )}
              </div>
              <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
                <AiInsightsButton />
                <NewTabButton />
                <FavoriteButton />
                <NotificationBell />
              </div>
            </header>
            <TabsBar />
            <main className="flex-1 p-4 sm:p-8 lg:p-12 pb-24 sm:pb-10 overflow-auto">
              {children}
            </main>
            <Suspense fallback={null}>
              <OnboardingTour />
              <FloatingAiChat />
            </Suspense>
          </div>
        </div>
      </SidebarProvider>
    </TooltipProvider>
  );
}
