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
import {
  Rocket, Calendar, Users, GitBranch, FolderKanban, CheckSquare,
  Key, MessageSquare, Building2, Megaphone, DollarSign, ShoppingCart,
  UserCheck, UsersRound, Headphones, Target, CalendarCheck, Crown,
  LayoutDashboard, Settings, LogOut, Package, Heart, BookOpen, Star,
  Clock, Lightbulb, MessageSquareHeart,
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
  termKey?: string; // optional key for sector terminology
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
  { title: 'Biblioteca', url: '/hub/biblioteca', icon: 'BookOpen', moduleKey: 'biblioteca' },
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
          <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-semibold cursor-pointer hover:text-muted-foreground transition-colors select-none mb-1">
            {label}
            {!collapsed && (
              <svg
                className="ml-auto h-3 w-3 shrink-0 text-muted-foreground/40 transition-transform group-data-[state=open]/collapsible:rotate-90"
                xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              >
                <path d="m9 18 6-6-6-6" />
              </svg>
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
                        className="group/nav rounded-lg px-3 py-2 transition-all duration-200 hover:bg-primary/8 hover:translate-x-0.5"
                        activeClassName="bg-primary text-primary-foreground font-medium shadow-sm hover:bg-primary/90 hover:translate-x-0"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/8 group-[.bg-primary]/nav:bg-primary-foreground/15 transition-colors">
                            <Icon className="h-3.5 w-3.5" strokeWidth={1.8} />
                          </div>
                          {!collapsed && <span className="text-[13px]">{displayTitle}</span>}
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
  const { isOwner, signOut } = useAuth();
  const { settings } = useBusinessSettings();
  const { canAccess } = usePermissions();
  const { favorites } = useFavorites();
  const sectorConfig = useSectorConfig();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4 pb-2">
        <div className="flex items-center gap-3">
          {settings?.logo_url ? (
            <img src={settings.logo_url} alt="Logo" className="h-9 w-9 rounded-xl object-contain shadow-sm" />
          ) : (
            <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <span className="text-sm font-bold text-primary">
                {(settings?.business_name || 'L').charAt(0)}
              </span>
            </div>
          )}
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-bold tracking-tight truncate">
                {settings?.business_name || 'Business ME'}
              </span>
              <span className="text-[10px] text-muted-foreground/60 font-medium">Sistema de Gestão</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2">
        <NavSection label="Pessoal" items={pessoalItems} collapsed={collapsed} canAccess={() => true} sectorConfig={sectorConfig} />
        {favorites.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-semibold mb-1">
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
                          className="group/nav rounded-lg px-3 py-2 transition-all duration-200 hover:bg-primary/8 hover:translate-x-0.5"
                          activeClassName="bg-primary text-primary-foreground font-medium shadow-sm hover:bg-primary/90 hover:translate-x-0"
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/8 group-[.bg-primary]/nav:bg-primary-foreground/15 transition-colors">
                              <Icon className="h-3.5 w-3.5" strokeWidth={1.8} />
                            </div>
                            {!collapsed && <span className="text-[13px]">{fav.page_title}</span>}
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
        <NavSection label="Hall" items={hallItems} collapsed={collapsed} canAccess={canAccess} sectorConfig={sectorConfig} />
        <NavSection label="Transversais" items={transversaisItems} collapsed={collapsed} canAccess={canAccess} sectorConfig={sectorConfig} />
        <NavSection label="Departamentos" items={departamentosItems} collapsed={collapsed} canAccess={canAccess} sectorConfig={sectorConfig} />
        {isOwner && (
          <NavSection label="Administração" items={executiveItems} collapsed={collapsed} canAccess={() => true} sectorConfig={sectorConfig} />
        )}
      </SidebarContent>

      <SidebarFooter className="p-3 space-y-0.5 border-t">
        <SidebarMenu>
          {isOwner && (
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <NavLink
                  to="/definicoes"
                  end
                  className="group/nav rounded-lg px-3 py-2 transition-all duration-200 hover:bg-primary/8"
                  activeClassName="bg-primary text-primary-foreground font-medium shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/8 transition-colors">
                      <Settings className="h-3.5 w-3.5" strokeWidth={1.8} />
                    </div>
                    {!collapsed && <span className="text-[13px]">Definições</span>}
                  </div>
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={signOut}
              className="rounded-lg px-3 py-2 transition-all duration-200 hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-destructive/8 transition-colors">
                  <LogOut className="h-3.5 w-3.5" strokeWidth={1.8} />
                </div>
                {!collapsed && <span className="text-[13px]">Sair</span>}
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
