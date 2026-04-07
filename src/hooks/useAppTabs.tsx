import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const MAX_TABS = 10;
const STORAGE_KEY = 'app-tabs';

export interface AppTab {
  id: string;
  path: string;
  title: string;
}

interface TabsContextValue {
  tabs: AppTab[];
  activeTabId: string | null;
  openTab: (path: string, title: string) => void;
  closeTab: (id: string) => void;
  switchTab: (id: string) => void;
  closeOtherTabs: (id: string) => void;
  updateActiveTabTitle: (title: string) => void;
}

const TabsContext = createContext<TabsContextValue | null>(null);

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

function loadTabs(): { tabs: AppTab[]; activeTabId: string | null } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.tabs?.length) return parsed;
    }
  } catch {}
  return { tabs: [], activeTabId: null };
}

function saveTabs(tabs: AppTab[], activeTabId: string | null) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ tabs, activeTabId }));
  } catch {}
}

// Map common paths to human-readable titles
const PATH_TITLES: Record<string, string> = {
  '/secretaria': 'Secretária',
  '/comeca-aqui': 'Começa Aqui',
  '/hub-equipa': 'Hub de Equipa',
  '/hub/agenda': 'Agenda',
  '/hub/reunioes': 'Reuniões',
  '/hub/acessos': 'Acessos',
  '/hub/projetos': 'Projetos',
  '/hub/processos': 'Processos',
  '/hub/tarefas': 'Tarefas',
  '/hub/biblioteca': 'Biblioteca',
  '/hub/mural': 'Mural',
  '/hub/marketing': 'Marketing',
  '/hub/comercial': 'Comercial',
  '/hub/clientes': 'Clientes',
  '/hub/financeiro': 'Contabilidade',
  '/hub/operacao': 'Operação',
  '/hub/produtos': 'Produtos',
  '/hub/recursos-humanos': 'Recursos Humanos',
  '/executive': 'Executive Room',
  '/definicoes': 'Definições',
  '/hub/fornecedores': 'Fornecedores',
};

export function getTitleForPath(path: string): string {
  // Exact match
  if (PATH_TITLES[path]) return PATH_TITLES[path];
  // Partial match for sub-pages
  const base = Object.keys(PATH_TITLES)
    .filter(k => path.startsWith(k + '/'))
    .sort((a, b) => b.length - a.length)[0];
  if (base) return PATH_TITLES[base];
  return 'Página';
}

export function AppTabsProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [tabs, setTabs] = useState<AppTab[]>(() => loadTabs().tabs);
  const [activeTabId, setActiveTabId] = useState<string | null>(() => loadTabs().activeTabId);

  // Keep the active tab in sync with current location
  useEffect(() => {
    const currentPath = location.pathname;
    // Skip portal routes
    if (currentPath.startsWith('/portal')) return;
    // Skip auth routes
    if (currentPath === '/auth' || currentPath === '/reset-password' || currentPath === '/setup') return;

    if (tabs.length === 0) {
      // First tab — create automatically
      const id = generateId();
      const title = getTitleForPath(currentPath);
      setTabs([{ id, path: currentPath, title }]);
      setActiveTabId(id);
      return;
    }

    // Update the active tab's path to match current location
    if (activeTabId) {
      setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, path: currentPath, title: getTitleForPath(currentPath) } : t));
    }
  }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist
  useEffect(() => {
    saveTabs(tabs, activeTabId);
  }, [tabs, activeTabId]);

  const openTab = useCallback((path: string, title: string) => {
    setTabs(prev => {
      // Check if the path is already open
      const existing = prev.find(t => t.path === path);
      if (existing) {
        setActiveTabId(existing.id);
        navigate(path);
        return prev;
      }
      if (prev.length >= MAX_TABS) {
        return prev; // Don't open more than max
      }
      const id = generateId();
      const newTab: AppTab = { id, path, title: title || getTitleForPath(path) };
      setActiveTabId(id);
      navigate(path);
      return [...prev, newTab];
    });
  }, [navigate]);

  const closeTab = useCallback((id: string) => {
    setTabs(prev => {
      const idx = prev.findIndex(t => t.id === id);
      if (idx === -1) return prev;
      const next = prev.filter(t => t.id !== id);
      if (next.length === 0) {
        // Last tab — navigate to secretaria
        const newId = generateId();
        setActiveTabId(newId);
        navigate('/secretaria');
        return [{ id: newId, path: '/secretaria', title: 'Secretária' }];
      }
      if (activeTabId === id) {
        // Switch to the adjacent tab
        const newActive = next[Math.min(idx, next.length - 1)];
        setActiveTabId(newActive.id);
        navigate(newActive.path);
      }
      return next;
    });
  }, [activeTabId, navigate]);

  const switchTab = useCallback((id: string) => {
    setTabs(prev => {
      const tab = prev.find(t => t.id === id);
      if (tab) {
        setActiveTabId(id);
        navigate(tab.path);
      }
      return prev;
    });
  }, [navigate]);

  const closeOtherTabs = useCallback((id: string) => {
    setTabs(prev => prev.filter(t => t.id === id));
    setActiveTabId(id);
  }, []);

  const updateActiveTabTitle = useCallback((title: string) => {
    if (!activeTabId) return;
    setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, title } : t));
  }, [activeTabId]);

  return (
    <TabsContext.Provider value={{ tabs, activeTabId, openTab, closeTab, switchTab, closeOtherTabs, updateActiveTabTitle }}>
      {children}
    </TabsContext.Provider>
  );
}

export function useAppTabs() {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error('useAppTabs must be used within AppTabsProvider');
  return ctx;
}
