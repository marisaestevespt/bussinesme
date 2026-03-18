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
import { NavLink } from '@/components/NavLink';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { usePermissions } from '@/hooks/usePermissions';
import {
  Rocket, Calendar, Users, GitBranch, FolderKanban, CheckSquare,
  Key, MessageSquare, Building2, Megaphone, DollarSign, ShoppingCart,
  UserCheck, UsersRound, Headphones, Target, CalendarCheck, Crown,
  LayoutDashboard, Settings, LogOut,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const ICON_MAP: Record<string, any> = {
  Rocket, Calendar, Users, GitBranch, FolderKanban, CheckSquare,
  Key, MessageSquare, Building2, Megaphone, DollarSign, ShoppingCart,
  UserCheck, UsersRound, Headphones, Target, CalendarCheck, Crown,
};

interface NavItem {
  title: string;
  url: string;
  icon: string;
  moduleKey: string;
}

const secretariaItems: NavItem[] = [
  { title: 'Secretária', url: '/secretaria', icon: 'LayoutDashboard', moduleKey: 'secretaria' },
];

const comecaAquiItems: NavItem[] = [
  { title: 'Começa Aqui', url: '/comeca-aqui', icon: 'Rocket', moduleKey: 'comeca-aqui' },
];

const transversaisItems: NavItem[] = [
  { title: 'Agenda do Negócio', url: '/hub/agenda', icon: 'Calendar', moduleKey: 'agenda' },
  { title: 'Reuniões', url: '/hub/reunioes', icon: 'Users', moduleKey: 'reunioes' },
  { title: 'Processos', url: '/hub/processos', icon: 'GitBranch', moduleKey: 'processos' },
  { title: 'Projetos', url: '/hub/projetos', icon: 'FolderKanban', moduleKey: 'projetos' },
  { title: 'Tarefas', url: '/hub/tarefas', icon: 'CheckSquare', moduleKey: 'tarefas' },
  { title: 'Acessos', url: '/hub/acessos', icon: 'Key', moduleKey: 'acessos' },
  { title: 'Mural', url: '/hub/mural', icon: 'MessageSquare', moduleKey: 'mural' },
];

const departamentosItems: NavItem[] = [
  { title: 'Administrativo', url: '/hub/administrativo', icon: 'Building2', moduleKey: 'administrativo' },
  { title: 'Marketing', url: '/hub/marketing', icon: 'Megaphone', moduleKey: 'marketing' },
  { title: 'Financeiro', url: '/hub/financeiro', icon: 'DollarSign', moduleKey: 'financeiro' },
  { title: 'Comercial', url: '/hub/comercial', icon: 'ShoppingCart', moduleKey: 'comercial' },
  { title: 'Clientes', url: '/hub/clientes', icon: 'UserCheck', moduleKey: 'clientes' },
  { title: 'Equipa', url: '/hub/equipa', icon: 'UsersRound', moduleKey: 'equipa' },
  { title: 'Operação', url: '/hub/operacao', icon: 'Headphones', moduleKey: 'operacao' },
];

const executiveItems: NavItem[] = [
  { title: 'Planeamento', url: '/executive/planeamento', icon: 'Target', moduleKey: 'planeamento' },
  { title: 'Weekly Align', url: '/executive/weekly-align', icon: 'CalendarCheck', moduleKey: 'weekly-align' },
  { title: 'Gestão de Equipa', url: '/executive/gestao-equipa', icon: 'Crown', moduleKey: 'gestao-equipa-ceo' },
];

function getIcon(name: string) {
  if (name === 'LayoutDashboard') return LayoutDashboard;
  if (name === 'Settings') return Settings;
  return ICON_MAP[name] || Rocket;
}

function NavSection({
  label,
  items,
  collapsed,
  canAccess,
}: {
  label: string;
  items: NavItem[];
  collapsed: boolean;
  canAccess: (key: string) => boolean;
}) {
  const filtered = items.filter(item => canAccess(item.moduleKey));
  if (filtered.length === 0) return null;

  return (
    <SidebarGroup>
      <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-muted-foreground/70 font-medium">
        {label}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {filtered.map((item) => {
            const Icon = getIcon(item.icon);
            return (
              <SidebarMenuItem key={item.url}>
                <SidebarMenuButton asChild>
                  <NavLink
                    to={item.url}
                    end
                    className="hq-transition hover:bg-accent/50"
                    activeClassName="bg-accent text-accent-foreground font-medium"
                  >
                    <Icon className="mr-2 h-4 w-4" strokeWidth={1.5} />
                    {!collapsed && <span className="text-sm">{item.title}</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const { isOwner, signOut, user } = useAuth();
  const { settings } = useBusinessSettings();
  const { canAccess } = usePermissions();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          {settings?.logo_url && (
            <img
              src={settings.logo_url}
              alt="Logo"
              className="h-8 w-8 rounded-md object-contain"
            />
          )}
          {!collapsed && (
            <span className="text-sm font-semibold tracking-tight truncate">
              HQ | {settings?.business_name || 'Negócio'}
            </span>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <NavSection label="Pessoal" items={secretariaItems} collapsed={collapsed} canAccess={() => true} />
        <NavSection label="Começa Aqui" items={comecaAquiItems} collapsed={collapsed} canAccess={canAccess} />
        <NavSection label="Transversais" items={transversaisItems} collapsed={collapsed} canAccess={canAccess} />
        <NavSection label="Departamentos" items={departamentosItems} collapsed={collapsed} canAccess={canAccess} />
        {isOwner && (
          <NavSection label="Executive Room" items={executiveItems} collapsed={collapsed} canAccess={() => true} />
        )}
      </SidebarContent>

      <SidebarFooter className="p-3 space-y-1">
        <SidebarMenu>
          {isOwner && (
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <NavLink
                  to="/definicoes"
                  end
                  className="hq-transition hover:bg-accent/50"
                  activeClassName="bg-accent text-accent-foreground font-medium"
                >
                  <Settings className="mr-2 h-4 w-4" strokeWidth={1.5} />
                  {!collapsed && <span className="text-sm">Definições</span>}
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={signOut}
              className="hq-transition hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
            >
              <LogOut className="mr-2 h-4 w-4" strokeWidth={1.5} />
              {!collapsed && <span className="text-sm">Sair</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
