import { NavLink, useLocation } from 'react-router-dom';
import { Briefcase, Calendar, Users, Video, Menu } from 'lucide-react';
import { useSidebar } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { to: '/secretaria', label: 'Secretária', icon: Briefcase },
  { to: '/hub/agenda', label: 'Agenda', icon: Calendar },
  { to: '/hub/reunioes', label: 'Reuniões', icon: Video },
  { to: '/hub/clientes', label: 'Clientes', icon: Users },
] as const;

/**
 * Mobile-only bottom navigation bar.
 * Always visible on small screens; hidden on `md:` and up where the sidebar is permanent/icon-collapsible.
 * The "Mais" button opens the sidebar drawer with the full module list.
 */
export function MobileBottomNav() {
  const { setOpenMobile } = useSidebar();
  const { pathname } = useLocation();

  return (
    <nav
      aria-label="Navegação principal mobile"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 h-16 border-t bg-background/95 backdrop-blur-md shadow-[0_-2px_8px_-2px_rgba(0,0,0,0.06)] pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="grid grid-cols-5 h-full">
        {NAV_ITEMS.map(item => {
          const Icon = item.icon;
          const active = pathname === item.to || pathname.startsWith(item.to + '/');
          return (
            <li key={item.to} className="flex">
              <NavLink
                to={item.to}
                className={cn(
                  'flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium hq-transition',
                  active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon className={cn('h-5 w-5', active && 'stroke-[2.4]')} />
                <span className="truncate max-w-full px-1">{item.label}</span>
              </NavLink>
            </li>
          );
        })}
        <li className="flex">
          <button
            type="button"
            onClick={() => setOpenMobile(true)}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium text-muted-foreground hover:text-foreground hq-transition"
            aria-label="Abrir menu completo"
          >
            <Menu className="h-5 w-5" />
            <span>Mais</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}