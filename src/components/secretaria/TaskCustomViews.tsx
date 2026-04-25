import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { LayoutGrid, List, Table as TableIcon, Plus, Pencil, X, SlidersHorizontal, ChevronDown, ChevronRight, Filter, Layers } from 'lucide-react';
import { UnifiedResponsibilitiesList } from '@/components/UnifiedResponsibilitiesList';
import type { UnifiedItem, ResponsibilitySource } from '@/hooks/useUnifiedResponsibilities';
import { SOURCE_LABELS } from '@/hooks/useUnifiedResponsibilities';
import { toast } from 'sonner';
import { useConfirm, usePrompt } from '@/components/ui/confirm-dialog';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';

type ViewType = 'list' | 'table' | 'board';
type GroupBy = 'none' | 'source' | 'priority' | 'deadline';

interface SavedFilters {
  sources?: ResponsibilitySource[];
  priorities?: string[];
  hideCompleted?: boolean;
  search?: string;
}

interface SavedView {
  id: string;
  name: string;
  view_type: ViewType;
  group_by: GroupBy;
  filters: SavedFilters;
  sort_order: number;
}

interface Props {
  scope: 'today' | 'week' | 'tasks';
  items: UnifiedItem[];
  defaultTitle: string;
  defaultDeadline?: string;
}

const VIEW_ICONS: Record<ViewType, typeof List> = {
  list: List,
  table: TableIcon,
  board: LayoutGrid,
};
const VIEW_LABELS: Record<ViewType, string> = {
  list: 'Lista', table: 'Tabela', board: 'Board',
};
const GROUP_LABELS: Record<GroupBy, string> = {
  none: 'Sem agrupamento',
  source: 'Por fonte',
  priority: 'Por prioridade',
  deadline: 'Por prazo',
};

const PRIORITY_ORDER = ['urgente', 'alta', 'media', 'baixa', '__none__'];
const PRIORITY_LABEL: Record<string, string> = {
  urgente: 'Urgente', alta: 'Alta', media: 'Média', baixa: 'Baixa', __none__: 'Sem prioridade',
};
const PRIORITY_DOT: Record<string, string> = {
  urgente: 'bg-destructive',
  alta: 'bg-accent',
  media: 'bg-primary',
  baixa: 'bg-muted-foreground/40',
  __none__: 'bg-muted-foreground/30',
};

function applyFilters(items: UnifiedItem[], f: SavedFilters): UnifiedItem[] {
  return items.filter(i => {
    if (f.hideCompleted && i.completed) return false;
    if (f.sources?.length && !f.sources.includes(i.source)) return false;
    if (f.priorities?.length && !f.priorities.includes(i.priority || '__none__')) return false;
    if (f.search && !i.title.toLowerCase().includes(f.search.toLowerCase())) return false;
    return true;
  });
}

function groupItems(items: UnifiedItem[], by: GroupBy): Array<{ key: string; label: string; items: UnifiedItem[] }> {
  if (by === 'none') return [{ key: 'all', label: '', items }];
  const map = new Map<string, UnifiedItem[]>();
  for (const i of items) {
    let key = 'outros';
    if (by === 'source') key = i.source;
    else if (by === 'priority') key = i.priority || '__none__';
    else if (by === 'deadline') {
      if (!i.deadline) key = '__sem__';
      else {
        const today = format(new Date(), 'yyyy-MM-dd');
        if (i.deadline < today) key = 'atrasado';
        else if (i.deadline === today) key = 'hoje';
        else key = 'futuro';
      }
    }
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(i);
  }
  const labels: Record<string, string> = {
    ...SOURCE_LABELS,
    ...PRIORITY_LABEL,
    atrasado: 'Em atraso', hoje: 'Hoje', futuro: 'Próximos', __sem__: 'Sem prazo',
  };
  let order: string[] = [];
  if (by === 'priority') order = PRIORITY_ORDER;
  else if (by === 'deadline') order = ['atrasado', 'hoje', 'futuro', '__sem__'];
  else order = Array.from(map.keys()).sort();
  return order
    .filter(k => map.has(k))
    .concat(Array.from(map.keys()).filter(k => !order.includes(k)))
    .map(k => ({ key: k, label: labels[k] || k, items: map.get(k) || [] }));
}

function ItemRow({ item, compact }: { item: UnifiedItem; compact?: boolean }) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', PRIORITY_DOT[item.priority || '__none__'])} aria-hidden />
      <span className={cn('truncate', compact ? 'text-xs' : 'text-sm', item.completed && 'line-through text-muted-foreground')}>{item.title}</span>
      <span className="text-[10px] text-muted-foreground/70 shrink-0">· {SOURCE_LABELS[item.source]}</span>
    </div>
  );
}

function TableView({ items }: { items: UnifiedItem[] }) {
  return (
    <div className="rounded-2xl border bg-card overflow-hidden shadow-card">
      <Table>
        <TableHeader>
          <TableRow className="border-b border-border/50 hover:bg-transparent">
            <TableHead className="w-[36px] py-3" />
            <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/80">Tarefa</TableHead>
            <TableHead className="w-[120px] text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/80">Fonte</TableHead>
            <TableHead className="w-[110px] text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/80">Prioridade</TableHead>
            <TableHead className="w-[110px] text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/80">Prazo</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.length === 0 && (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={5} className="text-center text-muted-foreground py-12 text-sm">Nada para mostrar por aqui ✨</TableCell>
            </TableRow>
          )}
          {items.map(i => (
            <TableRow key={i.id} className="border-b-0 border-t border-border/40 hover:bg-muted/30 transition-colors">
              <TableCell className="py-3">
                <span className={cn('block w-2 h-2 rounded-full', PRIORITY_DOT[i.priority || '__none__'])} aria-hidden />
              </TableCell>
              <TableCell className="py-3">
                <div className={cn('text-sm font-medium', i.completed && 'line-through text-muted-foreground')}>{i.title}</div>
                {i.subtitle && <div className="text-xs text-muted-foreground mt-0.5">{i.subtitle}</div>}
              </TableCell>
              <TableCell className="py-3 text-xs text-muted-foreground">{SOURCE_LABELS[i.source]}</TableCell>
              <TableCell className="py-3">
                {i.priority
                  ? <span className="text-xs font-medium text-foreground/80">{PRIORITY_LABEL[i.priority] || i.priority}</span>
                  : <span className="text-xs text-muted-foreground/60">—</span>}
              </TableCell>
              <TableCell className="py-3 text-xs text-muted-foreground">
                {i.deadline ? format(parseISO(i.deadline), 'dd MMM', { locale: pt }) : '—'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function BoardView({ items, groupBy }: { items: UnifiedItem[]; groupBy: GroupBy }) {
  const effectiveGroup: GroupBy = groupBy === 'none' ? 'priority' : groupBy;
  const groups = useMemo(() => groupItems(items, effectiveGroup), [items, effectiveGroup]);
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {groups.map(g => {
        const dot = PRIORITY_DOT[g.key] || 'bg-muted-foreground/40';
        return (
          <div key={g.key} className="rounded-2xl bg-muted/30 p-3 flex flex-col min-h-[160px]">
            <div className="flex items-center justify-between px-1 pb-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className={cn('w-2 h-2 rounded-full shrink-0', dot)} aria-hidden />
                <span className="text-xs font-semibold text-foreground/90 truncate">{g.label}</span>
              </div>
              <span className="text-[11px] font-medium text-muted-foreground tabular-nums">{g.items.length}</span>
            </div>
            <div className="flex-1 space-y-1.5 max-h-[60vh] overflow-y-auto">
              {g.items.length === 0 && <p className="text-xs text-muted-foreground/70 text-center py-4">—</p>}
              {g.items.map(i => (
                <div key={i.id} className="rounded-xl bg-background p-2.5 shadow-card hover:shadow-elevated transition-shadow cursor-pointer">
                  <ItemRow item={i} compact />
                  {i.deadline && (
                    <p className="text-[10px] text-muted-foreground/70 mt-1 ml-3.5">
                      {format(parseISO(i.deadline), 'dd MMM', { locale: pt })}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function GroupedListView({ items, groupBy, defaultDeadline, title }: { items: UnifiedItem[]; groupBy: GroupBy; defaultDeadline?: string; title: string }) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  if (groupBy === 'none') {
    return <UnifiedResponsibilitiesList items={items} title={title} defaultDeadline={defaultDeadline} />;
  }
  const groups = groupItems(items, groupBy);
  return (
    <div className="space-y-2">
      {groups.map(g => {
        const isOpen = !collapsed[g.key];
        const dot = PRIORITY_DOT[g.key] || 'bg-muted-foreground/30';
        return (
          <Card key={g.key} className="border-0 shadow-card">
            <button
              type="button"
              onClick={() => setCollapsed(c => ({ ...c, [g.key]: !c[g.key] }))}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors rounded-t-2xl"
            >
              <div className="flex items-center gap-2.5">
                {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                <span className={cn('w-2 h-2 rounded-full', dot)} aria-hidden />
                <span className="text-sm font-semibold">{g.label}</span>
                <span className="text-[11px] text-muted-foreground tabular-nums">{g.items.length}</span>
              </div>
            </button>
            {isOpen && (
              <CardContent className="pt-0 pb-3">
                <UnifiedResponsibilitiesList items={g.items} title="" defaultDeadline={defaultDeadline} maxHeight="400px" />
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}

function activeFiltersCount(f: SavedFilters): number {
  let n = 0;
  if (f.search) n++;
  if (f.sources?.length) n++;
  if (f.priorities?.length) n++;
  if (f.hideCompleted) n++;
  return n;
}

function FiltersPopover({ filters, onChange, items }: { filters: SavedFilters; onChange: (f: SavedFilters) => void; items: UnifiedItem[] }) {
  const sources = Array.from(new Set(items.map(i => i.source)));
  const toggle = <T extends string>(arr: T[] | undefined, v: T): T[] => {
    const cur = arr || [];
    return cur.includes(v) ? cur.filter(x => x !== v) : [...cur, v];
  };
  const count = activeFiltersCount(filters);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 rounded-full px-3 gap-2">
          <Filter className="h-3.5 w-3.5" />
          <span className="text-xs font-medium">Filtros</span>
          {count > 0 && (
            <span className="ml-0.5 inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold tabular-nums">
              {count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-4 space-y-4">
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/80">Pesquisar</label>
          <Input
            placeholder="Procurar tarefa..."
            value={filters.search || ''}
            onChange={e => onChange({ ...filters, search: e.target.value })}
            className="h-9 rounded-lg"
          />
        </div>
        {sources.length > 0 && (
          <div className="space-y-2">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/80">Fonte</label>
            <div className="flex flex-wrap gap-1.5">
              {sources.map(s => {
                const active = filters.sources?.includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => onChange({ ...filters, sources: toggle(filters.sources, s) })}
                    className={cn(
                      'text-xs rounded-full px-3 py-1 border transition-colors',
                      active
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background text-foreground/80 border-border hover:border-foreground/40',
                    )}
                  >{SOURCE_LABELS[s]}</button>
                );
              })}
            </div>
          </div>
        )}
        <div className="space-y-2">
          <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/80">Prioridade</label>
          <div className="flex flex-wrap gap-1.5">
            {(['urgente', 'alta', 'media', 'baixa'] as const).map(p => {
              const active = filters.priorities?.includes(p);
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => onChange({ ...filters, priorities: toggle(filters.priorities, p) })}
                  className={cn(
                    'text-xs rounded-full px-3 py-1 border transition-colors inline-flex items-center gap-1.5',
                    active
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background text-foreground/80 border-border hover:border-foreground/40',
                  )}
                >
                  <span className={cn('w-1.5 h-1.5 rounded-full', PRIORITY_DOT[p])} />
                  {PRIORITY_LABEL[p]}
                </button>
              );
            })}
          </div>
        </div>
        <label className="flex items-center justify-between gap-2 cursor-pointer">
          <span className="text-sm">Esconder feitas</span>
          <button
            type="button"
            role="switch"
            aria-checked={!!filters.hideCompleted}
            onClick={() => onChange({ ...filters, hideCompleted: !filters.hideCompleted })}
            className={cn(
              'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
              filters.hideCompleted ? 'bg-primary' : 'bg-muted',
            )}
          >
            <span className={cn(
              'inline-block h-3.5 w-3.5 transform rounded-full bg-background shadow transition-transform',
              filters.hideCompleted ? 'translate-x-5' : 'translate-x-1',
            )} />
          </button>
        </label>
        {count > 0 && (
          <Button variant="ghost" size="sm" className="w-full h-8 text-xs" onClick={() => onChange({})}>
            <X className="h-3 w-3 mr-1" /> Limpar todos os filtros
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}

export function TaskCustomViews({ scope, items, defaultTitle, defaultDeadline }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const askText = usePrompt();

  const [activeView, setActiveView] = useState<string>('default');
  const [defaultViewType, setDefaultViewType] = useState<ViewType>('list');
  const [defaultGroupBy, setDefaultGroupBy] = useState<GroupBy>('none');
  const [defaultFilters, setDefaultFilters] = useState<SavedFilters>({});

  const { data: savedViews = [] } = useQuery({
    queryKey: ['user-task-views', scope, user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('user_task_views')
        .select('*')
        .eq('scope', scope)
        .order('sort_order');
      return (data || []) as SavedView[];
    },
  });

  const createView = useMutation({
    mutationFn: async (name: string) => {
      if (!user?.id) throw new Error('not authenticated');
      const { data, error } = await supabase.from('user_task_views').insert({
        user_id: user.id,
        scope, name,
        view_type: 'list', group_by: 'none',
        filters: {} as any, sort_order: savedViews.length,
      }).select('id').single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['user-task-views', scope, user?.id] });
      setActiveView(data.id);
    },
    onError: () => toast.error('Erro ao criar vista'),
  });

  const updateView = useMutation({
    mutationFn: async (patch: Partial<SavedView> & { id: string }) => {
      const { id, ...rest } = patch;
      const { error } = await supabase.from('user_task_views').update(rest as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['user-task-views', scope, user?.id] }),
  });

  const renameView = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase.from('user_task_views').update({ name }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['user-task-views', scope, user?.id] }),
  });

  const deleteView = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('user_task_views').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user-task-views', scope, user?.id] });
      setActiveView('default');
    },
  });

  const current = savedViews.find(v => v.id === activeView);
  const viewType: ViewType = current ? current.view_type : defaultViewType;
  const groupBy: GroupBy = current ? (current.group_by || 'none') : defaultGroupBy;
  const filters: SavedFilters = current ? (current.filters || {}) : defaultFilters;

  const setViewType = (v: ViewType) => {
    if (current) updateView.mutate({ id: current.id, view_type: v });
    else setDefaultViewType(v);
  };
  const setGroupBy = (g: GroupBy) => {
    if (current) updateView.mutate({ id: current.id, group_by: g });
    else setDefaultGroupBy(g);
  };
  const setFilters = (f: SavedFilters) => {
    if (current) updateView.mutate({ id: current.id, filters: f as any });
    else setDefaultFilters(f);
  };

  const filteredItems = useMemo(() => applyFilters(items, filters), [items, filters]);

  const handleNewView = async () => {
    const name = await askText({
      title: 'Nova vista', label: 'Nome',
      placeholder: 'Ex: Urgentes, Reuniões da semana...',
      confirmText: 'Criar',
    });
    if (name) createView.mutate(name);
  };

  const handleRename = async (v: SavedView) => {
    const name = await askText({
      title: 'Renomear vista', label: 'Novo nome',
      defaultValue: v.name, confirmText: 'Guardar',
    });
    if (name && name !== v.name) renameView.mutate({ id: v.id, name });
  };

  return (
    <div className="space-y-4">
      {/* Toolbar única */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        {/* Esquerda: vistas em pílulas */}
        <div className="flex items-center gap-1 flex-wrap">
          <button
            type="button"
            onClick={() => setActiveView('default')}
            className={cn(
              'h-9 px-3.5 rounded-full text-sm font-medium transition-colors',
              activeView === 'default'
                ? 'bg-foreground text-background'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted',
            )}
          >{defaultTitle}</button>
          {savedViews.map(sv => {
            const active = activeView === sv.id;
            return (
              <div key={sv.id} className="flex items-center">
                <button
                  type="button"
                  onClick={() => setActiveView(sv.id)}
                  className={cn(
                    'h-9 pl-3 pr-3 rounded-full text-sm font-medium transition-colors inline-flex items-center gap-1.5',
                    active
                      ? 'bg-foreground text-background'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                  )}
                >
                  <SlidersHorizontal className="h-3 w-3" />
                  {sv.name}
                </button>
                {active && (
                  <div className="flex items-center ml-1 gap-0.5">
                    <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full" aria-label="Renomear" onClick={() => handleRename(sv)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost" size="icon" className="h-7 w-7 rounded-full text-muted-foreground hover:text-destructive"
                      aria-label="Eliminar"
                      onClick={async () => {
                        const ok = await confirm({
                          title: 'Eliminar vista?',
                          description: `A vista "${sv.name}" será removida.`,
                          confirmText: 'Eliminar', variant: 'destructive',
                        });
                        if (ok) deleteView.mutate(sv.id);
                      }}
                    ><X className="h-3 w-3" /></Button>
                  </div>
                )}
              </div>
            );
          })}
          <Button variant="ghost" size="sm" className="h-9 rounded-full text-muted-foreground hover:text-foreground" onClick={handleNewView}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Nova vista
          </Button>
        </div>

        {/* Direita: agrupar + filtros + vista */}
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 rounded-full px-3 gap-2">
                <Layers className="h-3.5 w-3.5" />
                <span className="text-xs font-medium">{groupBy === 'none' ? 'Agrupar' : GROUP_LABELS[groupBy]}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-52 p-1.5">
              {(['none', 'source', 'priority', 'deadline'] as GroupBy[]).map(g => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGroupBy(g)}
                  className={cn(
                    'w-full text-left px-3 py-2 rounded-md text-sm transition-colors',
                    groupBy === g ? 'bg-muted font-medium' : 'hover:bg-muted/60',
                  )}
                >{GROUP_LABELS[g]}</button>
              ))}
            </PopoverContent>
          </Popover>
          <FiltersPopover filters={filters} onChange={setFilters} items={items} />
          <div className="flex items-center gap-0.5 rounded-full bg-muted p-1">
            {(['list', 'table', 'board'] as ViewType[]).map(v => {
              const Icon = VIEW_ICONS[v];
              const active = viewType === v;
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => setViewType(v)}
                  aria-label={VIEW_LABELS[v]}
                  title={VIEW_LABELS[v]}
                  className={cn(
                    'h-7 w-7 inline-flex items-center justify-center rounded-full transition-all',
                    active
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                ><Icon className="h-3.5 w-3.5" /></button>
              );
            })}
          </div>
        </div>
      </div>

      {viewType === 'list' && (
        <GroupedListView
          items={filteredItems}
          groupBy={groupBy}
          defaultDeadline={defaultDeadline}
          title={current ? current.name : defaultTitle}
        />
      )}
      {viewType === 'table' && <TableView items={filteredItems} />}
      {viewType === 'board' && <BoardView items={filteredItems} groupBy={groupBy} />}
    </div>
  );
}