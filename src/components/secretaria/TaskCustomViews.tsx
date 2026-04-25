import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { LayoutGrid, List, Table as TableIcon, Plus, Pencil, X, SlidersHorizontal, ChevronDown, ChevronRight } from 'lucide-react';
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
  list: 'Lista',
  table: 'Tabela',
  board: 'Board',
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
const PRIORITY_COLOR: Record<string, string> = {
  urgente: 'bg-destructive/10 text-destructive border-destructive/30',
  alta: 'bg-orange-500/10 text-orange-600 border-orange-500/30',
  media: 'bg-blue-500/10 text-blue-600 border-blue-500/30',
  baixa: 'bg-muted text-muted-foreground',
  __none__: 'bg-muted text-muted-foreground',
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
    atrasado: '⚠️ Em atraso', hoje: 'Hoje', futuro: 'Próximos', __sem__: 'Sem prazo',
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
      <Badge variant="outline" className="text-[10px] shrink-0">{SOURCE_LABELS[item.source]}</Badge>
      <span className={cn('truncate', compact ? 'text-xs' : 'text-sm')}>{item.title}</span>
      {item.priority && (
        <Badge variant="outline" className={cn('text-[10px] shrink-0', PRIORITY_COLOR[item.priority] || '')}>
          {PRIORITY_LABEL[item.priority] || item.priority}
        </Badge>
      )}
    </div>
  );
}

function TableView({ items }: { items: UnifiedItem[] }) {
  return (
    <div className="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[110px]">Fonte</TableHead>
            <TableHead>Título</TableHead>
            <TableHead className="w-[110px]">Prioridade</TableHead>
            <TableHead className="w-[120px]">Prazo</TableHead>
            <TableHead className="w-[90px]">Estado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.length === 0 && (
            <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nada para mostrar</TableCell></TableRow>
          )}
          {items.map(i => (
            <TableRow key={i.id}>
              <TableCell><Badge variant="outline" className="text-[10px]">{SOURCE_LABELS[i.source]}</Badge></TableCell>
              <TableCell className="font-medium">{i.title}{i.subtitle && <span className="text-xs text-muted-foreground block">{i.subtitle}</span>}</TableCell>
              <TableCell>{i.priority ? <Badge variant="outline" className={cn('text-[10px]', PRIORITY_COLOR[i.priority] || '')}>{PRIORITY_LABEL[i.priority] || i.priority}</Badge> : '—'}</TableCell>
              <TableCell className="text-xs">{i.deadline ? format(parseISO(i.deadline), 'dd MMM', { locale: pt }) : '—'}</TableCell>
              <TableCell>{i.completed ? <Badge variant="secondary" className="text-[10px]">Feito</Badge> : <Badge variant="outline" className="text-[10px]">Pendente</Badge>}</TableCell>
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
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {groups.map(g => (
        <Card key={g.key} className="bg-muted/30">
          <CardHeader className="pb-2 pt-3 px-3">
            <CardTitle className="text-xs font-semibold flex items-center justify-between">
              <span>{g.label}</span>
              <Badge variant="secondary" className="text-[10px]">{g.items.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-2 space-y-1.5 max-h-[60vh] overflow-y-auto">
            {g.items.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">—</p>}
            {g.items.map(i => (
              <div key={i.id} className="rounded-md border bg-background p-2 hover:shadow-sm transition-shadow">
                <ItemRow item={i} compact />
                {i.deadline && <p className="text-[10px] text-muted-foreground mt-1">{format(parseISO(i.deadline), 'dd MMM', { locale: pt })}</p>}
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
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
        return (
          <Card key={g.key}>
            <button
              type="button"
              onClick={() => setCollapsed(c => ({ ...c, [g.key]: !c[g.key] }))}
              className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <span className="text-sm font-semibold">{g.label}</span>
                <Badge variant="secondary" className="text-[10px]">{g.items.length}</Badge>
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

function FiltersBar({ filters, onChange, items }: { filters: SavedFilters; onChange: (f: SavedFilters) => void; items: UnifiedItem[] }) {
  const sources = Array.from(new Set(items.map(i => i.source)));
  const toggle = <T extends string>(arr: T[] | undefined, v: T): T[] => {
    const cur = arr || [];
    return cur.includes(v) ? cur.filter(x => x !== v) : [...cur, v];
  };
  return (
    <div className="flex items-center gap-2 flex-wrap p-2 rounded-lg border bg-muted/30">
      <Input
        placeholder="Pesquisar..."
        value={filters.search || ''}
        onChange={e => onChange({ ...filters, search: e.target.value })}
        className="h-8 w-48 text-xs"
      />
      <div className="flex items-center gap-1 flex-wrap">
        {sources.map(s => {
          const active = filters.sources?.includes(s);
          return (
            <Button
              key={s}
              size="sm"
              variant={active ? 'default' : 'outline'}
              className="h-7 text-[10px] px-2"
              onClick={() => onChange({ ...filters, sources: toggle(filters.sources, s) })}
            >{SOURCE_LABELS[s]}</Button>
          );
        })}
      </div>
      <Button
        size="sm"
        variant={filters.hideCompleted ? 'default' : 'outline'}
        className="h-7 text-[10px]"
        onClick={() => onChange({ ...filters, hideCompleted: !filters.hideCompleted })}
      >Esconder feitas</Button>
      {(filters.search || filters.sources?.length || filters.priorities?.length || filters.hideCompleted) && (
        <Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={() => onChange({})}>
          <X className="h-3 w-3 mr-1" /> Limpar
        </Button>
      )}
    </div>
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
        scope,
        name,
        view_type: 'list',
        group_by: 'none',
        filters: {} as any,
        sort_order: savedViews.length,
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
      title: 'Nova vista',
      label: 'Nome',
      placeholder: 'Ex: Urgentes, Reuniões da semana...',
      confirmText: 'Criar',
    });
    if (name) createView.mutate(name);
  };

  const handleRename = async (v: SavedView) => {
    const name = await askText({
      title: 'Renomear vista',
      label: 'Novo nome',
      defaultValue: v.name,
      confirmText: 'Guardar',
    });
    if (name && name !== v.name) renameView.mutate({ id: v.id, name });
  };

  return (
    <div className="space-y-3">
      {/* Tabs de vistas */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1 rounded-lg border p-1 flex-wrap">
          <Button
            variant={activeView === 'default' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveView('default')}
            className="h-7"
          >{defaultTitle}</Button>
          {savedViews.map(sv => (
            <div key={sv.id} className="flex items-center">
              <Button
                variant={activeView === sv.id ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveView(sv.id)}
                className="h-7 pr-1"
              >
                <SlidersHorizontal className="h-3 w-3 mr-1" />
                {sv.name}
              </Button>
              {activeView === sv.id && (
                <div className="flex items-center ml-0.5 gap-0.5">
                  <Button variant="ghost" size="icon" className="h-6 w-6" aria-label="Renomear" onClick={() => handleRename(sv)}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost" size="icon" className="h-6 w-6 text-destructive"
                    aria-label="Eliminar"
                    onClick={async () => {
                      const ok = await confirm({
                        title: 'Eliminar vista?',
                        description: `A vista "${sv.name}" será removida.`,
                        confirmText: 'Eliminar',
                        variant: 'destructive',
                      });
                      if (ok) deleteView.mutate(sv.id);
                    }}
                  ><X className="h-3 w-3" /></Button>
                </div>
              )}
            </div>
          ))}
          <Button variant="ghost" size="sm" className="h-7 text-muted-foreground" onClick={handleNewView}>
            <Plus className="h-3 w-3 mr-1" /> Vista
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Select value={groupBy} onValueChange={v => setGroupBy(v as GroupBy)}>
            <SelectTrigger className="h-8 w-[170px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(['none', 'source', 'priority', 'deadline'] as GroupBy[]).map(g => (
                <SelectItem key={g} value={g}>{GROUP_LABELS[g]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1 rounded-lg border p-1">
            {(['list', 'table', 'board'] as ViewType[]).map(v => {
              const Icon = VIEW_ICONS[v];
              return (
                <Button
                  key={v}
                  variant={viewType === v ? 'default' : 'ghost'}
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setViewType(v)}
                  aria-label={VIEW_LABELS[v]}
                  title={VIEW_LABELS[v]}
                ><Icon className="h-3.5 w-3.5" /></Button>
              );
            })}
          </div>
        </div>
      </div>

      <FiltersBar filters={filters} onChange={setFilters} items={items} />

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