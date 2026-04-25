import { useAppTabs, getTitleForPath } from '@/hooks/useAppTabs';
import { X, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const QUICK_PAGES = [
  { path: '/secretaria', title: 'Secretária' },
  { path: '/hub/agenda', title: 'Agenda' },
  { path: '/hub/tarefas', title: 'Tarefas' },
  { path: '/hub/projetos', title: 'Projetos' },
  { path: '/hub/clientes', title: 'Clientes' },
  { path: '/hub/reunioes', title: 'Reuniões' },
  { path: '/hub/marketing', title: 'Marketing' },
  { path: '/hub/comercial', title: 'Comercial' },
  { path: '/hub/financeiro', title: 'Contabilidade' },
  { path: '/hub/processos', title: 'Processos' },
  { path: '/executive', title: 'Executive Room' },
  { path: '/definicoes', title: 'Definições' },
];

export function TabsBar() {
  const { tabs, activeTabId, switchTab, closeTab, openTab } = useAppTabs();

  // Only show when there are 2+ tabs
  if (tabs.length < 2) return null;

  return (
    <div className="h-9 border-b bg-muted/30 flex items-center px-1 gap-0.5 shrink-0">
      <ScrollArea className="flex-1">
        <div className="flex items-center gap-0.5 pr-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => switchTab(tab.id)}
              className={cn(
                'group relative flex items-center gap-2 h-7 px-3 rounded-md text-xs font-medium whitespace-nowrap hq-transition max-w-[180px]',
                tab.id === activeTabId
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
              )}
            >
              <span className="truncate">{tab.title}</span>
              <span
                role="button"
                onClick={e => { e.stopPropagation(); closeTab(tab.id); }}
                className={cn(
                  'inline-flex items-center justify-center h-4 w-4 rounded-sm hover:bg-destructive/20 hover:text-destructive shrink-0',
                  tab.id === activeTabId ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                )}
              >
                <X className="h-3 w-3" />
              </span>
            </button>
          ))}
        </div>
        <ScrollBar orientation="horizontal" className="h-1" />
      </ScrollArea>

      {tabs.length < 10 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" aria-label="Adicionar" size="icon" className="h-6 w-6 shrink-0">
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {QUICK_PAGES.map(p => (
              <DropdownMenuItem
                key={p.path}
                onClick={() => openTab(p.path, p.title)}
                disabled={tabs.some(t => t.path === p.path)}
              >
                {p.title}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

/** Standalone "+" button for the header — always visible */
export function NewTabButton() {
  const { tabs, openTab } = useAppTabs();

  if (tabs.length >= 10) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" aria-label="Adicionar" size="icon" className="h-8 w-8">
          <Plus className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {QUICK_PAGES.map(p => (
          <DropdownMenuItem
            key={p.path}
            onClick={() => openTab(p.path, p.title)}
            disabled={tabs.some(t => t.path === p.path)}
          >
            {p.title}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
