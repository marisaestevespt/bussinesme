import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from '@/components/ui/sidebar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { NavLink } from '@/components/NavLink';
import { useAuth } from '@/hooks/useAuth';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { usePermissions } from '@/hooks/usePermissions';
import { useFavorites } from '@/hooks/useFavorites';
import { useSectorConfig } from '@/hooks/useSectorConfig';
import { useImpersonation } from '@/contexts/ImpersonationContext';
import {
  Rocket, Calendar, Users, GitBranch, FolderKanban, CheckSquare,
  Key, MessageSquare, Building2, Megaphone, DollarSign, ShoppingCart,
  UserCheck, UsersRound, Headphones, Target, CalendarCheck, Crown,
  LayoutDashboard, Settings, LogOut, Package, Heart, BookOpen, Star,
  Clock, Lightbulb, MessageSquareHeart, ChevronRight, LifeBuoy,
} from 'lucide-react';

const ICON_MAP: Record<string, any> = {
  Rocket, Calendar, Users, GitBranch, FolderKanban, CheckSquare,
  Key, MessageSquare, Building2, Megaphone, DollarSign, ShoppingCart,
  UserCheck, UsersRound, Headphones, Target, CalendarCheck, Crown,
  Package, Heart, BookOpen, LayoutDashboard, Settings, Star,
  Clock, Lightbulb, MessageSquareHeart,
};

interface NavItem {
  title: string;
  url: string;
  icon: string;
  moduleKey: string;
  termKey?: string;
}

const pessoalItems: NavItem[] = [
  { title: 'Secretária', url: '/secretaria', icon: 'LayoutDashboard', moduleKey: 'secretaria' },
];

const hallItems: NavItem[] = [
  { title: 'Começa Aqui', url: '/comeca-aqui', icon: 'Rocket', moduleKey: 'comeca-aqui' },
  { title: 'Mural', url: '/hub/mural', icon: 'MessageSquare', moduleKey: 'mural' },
  { title: 'Hub de Equipa', url: '/hub-equipa', icon: 'UsersRound', moduleKey: 'hub-equipa' },
];

const transversaisItems: NavItem[] = [
  { title: 'Agenda de Negócio', url: '/hub/agenda', icon: 'Calendar', moduleKey: 'agenda' },
  { title: 'Reuniões', url: '/hub/reunioes', icon: 'Users', moduleKey: 'reunioes', termKey: 'reunioes' },
  { title: 'Acessos', url: '/hub/acessos', icon: 'Key', moduleKey: 'acessos' },
  { title: 'Projetos', url: '/hub/projetos', icon: 'FolderKanban', moduleKey: 'projetos', termKey: 'projetos' },
  { title: 'Processos', url: '/hub/processos', icon: 'GitBranch', moduleKey: 'processos' },
  { title: 'Tarefas', url: '/hub/tarefas', icon: 'CheckSquare', moduleKey: 'tarefas' },
];

const departamentosItems: NavItem[] = [
  { title: 'Marketing', url: '/hub/marketing', icon: 'Megaphone', moduleKey: 'marketing' },
  { title: 'Comercial', url: '/hub/comercial', icon: 'ShoppingCart', moduleKey: 'comercial' },
  { title: 'Clientes', url: '/hub/clientes', icon: 'UserCheck', moduleKey: 'clientes', termKey: 'clientes' },
  { title: 'Contabilidade', url: '/hub/financeiro', icon: 'DollarSign', moduleKey: 'financeiro' },
  { title: 'Operação', url: '/hub/operacao', icon: 'Headphones', moduleKey: 'operacao' },
  { title: 'Produtos', url: '/hub/produtos', icon: 'Package', moduleKey: 'produtos', termKey: 'produtos' },
  { title: 'Recursos Humanos', url: '/hub/recursos-humanos', icon: 'UsersRound', moduleKey: 'recursos-humanos' },
];

const executiveItems: NavItem[] = [
  { title: 'Executive Room', url: '/executive', icon: 'Crown', moduleKey: 'executive-room' },
];

function getIcon(name: string) {
  return ICON_MAP[name] || Star;
}

function NavSection({
  label,
  items,
  collapsed,
  canAccess,
  sectorConfig,
}: {
  label: string;
  items: NavItem[];
  collapsed: boolean;
  canAccess: (key: string) => boolean;
  sectorConfig?: ReturnType<typeof useSectorConfig>;
}) {
  const filtered = items.filter(item => {
    if (!canAccess(item.moduleKey)) return false;
    if (sectorConfig?.isModuleHidden(item.moduleKey)) return false;
    return true;
  });
  if (filtered.length === 0) return null;

  return (
    <Collapsible defaultOpen className="group/collapsible">
      <SidebarGroup>
        <CollapsibleTrigger asChild>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-[0.12em] text-sidebar-foreground/40 font-semibold cursor-pointer hover:text-sidebar-foreground/70 transition-colors select-none mb-0.5 px-3">
            {label}
            {!collapsed && (
              <ChevronRight className="ml-auto h-3 w-3 shrink-0 text-sidebar-foreground/30 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
            )}
          </SidebarGroupLabel>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarGroupContent>
            <SidebarMenu>
              {filtered.map((item) => {
                const Icon = getIcon(item.icon);
                const displayTitle = item.termKey && sectorConfig
                  ? sectorConfig.t(item.termKey as any)
                  : item.title;
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        end
                        className="group/nav rounded-lg px-3 py-2 transition-all duration-200 text-sidebar-foreground/70 hover:text-sidebar-accent-foreground hover:bg-sidebar-accent"
                        activeClassName="!bg-sidebar-primary/15 !text-sidebar-primary font-medium hover:!bg-sidebar-primary/20"
                      >
                        <div className="flex items-center gap-3">
                          <Icon className="h-4 w-4 shrink-0 transition-colors" strokeWidth={1.7} />
                          {!collapsed && <span className="text-[13px] truncate">{displayTitle}</span>}
                        </div>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </CollapsibleContent>
      </SidebarGroup>
    </Collapsible>
  );
}

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const { isOwner: realIsOwner, isAdminOrOwner: realIsAdminOrOwner, signOut } = useAuth();
  const { settings } = useBusinessSettings();
  const { canAccess } = usePermissions();
  const { favorites } = useFavorites();
  const sectorConfig = useSectorConfig();
  // While impersonating a member, suppress owner/admin-only sections so the preview
  // matches what the member would actually see.
  const { impersonating } = useImpersonation();
  const isOwner = realIsOwner && !impersonating;
  const isAdminOrOwner = realIsAdminOrOwner && !impersonating;

  const disabledModules: string[] = settings?.disabled_modules ?? [];
  const canAccessWithToggles = (key: string) => {
    if (disabledModules.includes(key)) return false;
    return canAccess(key);
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4 pb-3">
        <div className="flex items-center gap-3">
          {settings?.logo_url ? (
            <img src={settings.logo_url} alt="Logo" className="h-8 w-8 rounded-lg object-contain ring-1 ring-white/10" />
          ) : (
            <div className="h-8 w-8 rounded-lg bg-sidebar-primary/20 flex items-center justify-center ring-1 ring-sidebar-primary/30">
              <span className="text-xs font-bold text-sidebar-primary">
                {(settings?.business_name || 'L').charAt(0)}
              </span>
            </div>
          )}
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-semibold tracking-tight truncate text-sidebar-foreground/90">
                {settings?.business_name || 'Sistema Lyrata®'}
              </span>
              {settings?.business_name && (
                <span className="text-[10px] text-sidebar-foreground/35 font-medium truncate">
                  Sistema Lyrata®
                </span>
              )}
            </div>
          )}
        </div>

        {/* Subtle separator */}
        {!collapsed && (
          <div className="mt-3 h-px bg-gradient-to-r from-transparent via-sidebar-border to-transparent" />
        )}
      </SidebarHeader>

      <SidebarContent className="px-2">
        <NavSection label="Pessoal" items={pessoalItems} collapsed={collapsed} canAccess={() => true} sectorConfig={sectorConfig} />
        {favorites.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-[10px] uppercase tracking-[0.12em] text-sidebar-foreground/40 font-semibold mb-0.5 px-3">
              Favoritos
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {favorites.map((fav) => {
                  const Icon = getIcon(fav.page_icon);
                  return (
                    <SidebarMenuItem key={fav.id}>
                      <SidebarMenuButton asChild>
                        <NavLink
                          to={fav.page_path}
                          end
                          className="group/nav rounded-lg px-3 py-2 transition-all duration-200 text-sidebar-foreground/70 hover:text-sidebar-accent-foreground hover:bg-sidebar-accent"
                          activeClassName="!bg-sidebar-primary/15 !text-sidebar-primary font-medium hover:!bg-sidebar-primary/20"
                        >
                          <div className="flex items-center gap-3">
                            <Icon className="h-4 w-4 shrink-0 transition-colors" strokeWidth={1.7} />
                            {!collapsed && <span className="text-[13px] truncate">{fav.page_title}</span>}
                          </div>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
        <NavSection label="Hall" items={hallItems} collapsed={collapsed} canAccess={canAccessWithToggles} sectorConfig={sectorConfig} />
        <NavSection label="Transversais" items={transversaisItems} collapsed={collapsed} canAccess={canAccessWithToggles} sectorConfig={sectorConfig} />
        <NavSection label="Departamentos" items={departamentosItems} collapsed={collapsed} canAccess={canAccessWithToggles} sectorConfig={sectorConfig} />
        {isAdminOrOwner && (
          <NavSection label="Administração" items={executiveItems} collapsed={collapsed} canAccess={() => true} sectorConfig={sectorConfig} />
        )}
      </SidebarContent>

      <SidebarFooter className="p-3 space-y-0.5">
        {/* Separator */}
        <div className="h-px mb-2 bg-gradient-to-r from-transparent via-sidebar-border to-transparent" />
        <SidebarMenu>
          {isOwner && (
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <NavLink
                  to="/definicoes"
                  end
                  className="group/nav rounded-lg px-3 py-2 transition-all duration-200 text-sidebar-foreground/70 hover:text-sidebar-accent-foreground hover:bg-sidebar-accent"
                  activeClassName="!bg-sidebar-primary/15 !text-sidebar-primary font-medium"
                >
                  <div className="flex items-center gap-3">
                    <Settings className="h-4 w-4 shrink-0" strokeWidth={1.7} />
                    {!collapsed && <span className="text-[13px]">Definições</span>}
                  </div>
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <NavLink
                to="/ajuda"
                end
                className="group/nav rounded-lg px-3 py-2 transition-all duration-200 text-sidebar-foreground/70 hover:text-sidebar-accent-foreground hover:bg-sidebar-accent"
                activeClassName="!bg-sidebar-primary/15 !text-sidebar-primary font-medium"
              >
                <div className="flex items-center gap-3">
                  <LifeBuoy className="h-4 w-4 shrink-0" strokeWidth={1.7} />
                  {!collapsed && <span className="text-[13px]">Ajuda</span>}
                </div>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={signOut}
              className="rounded-lg px-3 py-2 transition-all duration-200 text-sidebar-foreground/50 hover:text-destructive hover:bg-destructive/10"
            >
              <div className="flex items-center gap-3">
                <LogOut className="h-4 w-4 shrink-0" strokeWidth={1.7} />
                {!collapsed && <span className="text-[13px]">Sair</span>}
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
