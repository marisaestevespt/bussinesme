import { ReactNode, lazy, Suspense } from 'react';
import { useLocation } from 'react-router-dom';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { pageTitleForPath } from '@/lib/routeTitles';
import { NotificationBell } from '@/components/NotificationBell';
import { FavoriteButton } from '@/components/FavoriteButton';
import { AiInsightsButton } from '@/components/AiInsightsButton';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useSystemNotifications } from '@/hooks/useSystemNotifications';
import { TabsBar } from '@/components/TabsBar';
import { NewTabButton } from '@/components/TabsBar';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { useAuth } from '@/hooks/useAuth';

// Lazy-load heavy floating widgets (pdfjs, large UI) to keep AppLayout chunk small
const OnboardingTour = lazy(() => import('@/components/OnboardingTour').then(m => ({ default: m.OnboardingTour })));
const FloatingAiChat = lazy(() => import('@/components/FloatingAiChat').then(m => ({ default: m.FloatingAiChat })));

export function AppLayout({ children }: { children: ReactNode }) {
  const { settings } = useBusinessSettings();
  useSystemNotifications();
  const { isAdminOrOwner } = useAuth();

  const { pathname } = useLocation();
  const businessName = settings?.business_name || 'Lyrata';
  useDocumentTitle(`${businessName} · ${pageTitleForPath(pathname)}`);

  return (
    <TooltipProvider>
      <SidebarProvider>
        <div className="min-h-screen flex w-full bg-muted/30">
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-3 focus:py-2 focus:rounded-md focus:bg-primary focus:text-primary-foreground focus:shadow-elevated"
          >
            Saltar para o conteúdo
          </a>
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
            <div className="hidden sm:block">
              <TabsBar />
            </div>
            <main id="main-content" className="flex-1 overflow-auto p-4 sm:p-8 lg:p-12 pb-24 md:pb-10">
              <div className="mx-auto w-full max-w-[1600px]">
                {children}
              </div>
            </main>
            <Suspense fallback={null}>
              <OnboardingTour />
              {isAdminOrOwner && <FloatingAiChat />}
            </Suspense>
            <MobileBottomNav />
          </div>
        </div>
      </SidebarProvider>
    </TooltipProvider>
  );
}
