import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ResponsibilityDetailDialog } from '@/components/ResponsibilityDetailDialog';
import { TaskFormDialog } from '@/components/tasks/TaskFormDialog';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  CheckSquare, PhoneCall, FileText, Users, FolderKanban,
  Star, ShoppingCart, ListChecks, Clock, ChevronRight, Plus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';
import { toast } from 'sonner';
import type { UnifiedItem, ResponsibilitySource } from '@/hooks/useUnifiedResponsibilities';
import { SOURCE_LABELS } from '@/hooks/useUnifiedResponsibilities';

const SOURCE_ICON: Record<ResponsibilitySource, typeof CheckSquare> = {
  tarefa: CheckSquare,
  crm: PhoneCall,
  conteudo: FileText,
  reuniao: Users,
  projeto: FolderKanban,
  nps: Star,
  acao_venda: ShoppingCart,
  rotina: ListChecks,
};

const SOURCE_COLOR: Record<ResponsibilitySource, string> = {
  tarefa: 'bg-success/15 text-success border-success/30',
  crm: 'bg-info/15 text-info border-info/30',
  conteudo: 'bg-accent-violet/15 text-accent-violet border-accent-violet',
  reuniao: 'bg-destructive/15 text-destructive border-destructive/30',
  projeto: 'bg-warning/15 text-warning border-warning/30',
  nps: 'bg-warning/15 text-warning border-warning/30',
  acao_venda: 'bg-warning/15 text-warning border-warning/30',
  rotina: 'bg-accent-violet/15 text-accent-violet border-accent-violet',
};

import { PRIORITY_LABELS } from '@/components/secretaria/secretaria-shared';
import { EmptyHint } from '@/components/ui/loading-skeletons';

export type SourceFilter = 'todos' | ResponsibilitySource;

const FILTER_OPTIONS: { value: SourceFilter; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'tarefa', label: 'Tarefas' },
  { value: 'crm', label: 'Follow-ups' },
  { value: 'conteudo', label: 'Conteúdos' },
  { value: 'reuniao', label: 'Reuniões' },
  { value: 'nps', label: 'NPS' },
  { value: 'acao_venda', label: 'Ações' },
  { value: 'rotina', label: 'Rotinas' },
];

function getItemRoute(item: UnifiedItem): string | null {
  switch (item.source) {
    case 'tarefa': return `/tarefas`;
    case 'crm': return `/comercial/crm`;
    case 'conteudo': return `/conteudo/${item.sourceId}`;
    case 'reuniao': return `/hub/reunioes/${item.sourceId}`;
    case 'projeto': return `/hub/projetos/${item.sourceId}`;
    case 'nps': return null;
    case 'acao_venda': return `/comercial/acoes`;
    case 'rotina': return `/executive/planeamento`;
    default: return null;
  }
}

const TOGGLEABLE_SOURCES: ResponsibilitySource[] = ['tarefa', 'rotina'];

interface Props {
  items: UnifiedItem[];
  title: string;
  maxHeight?: string;
  defaultDeadline?: string;
}

export function UnifiedResponsibilitiesList({ items, title, maxHeight = '500px', defaultDeadline }: Props) {
  const [filter, setFilter] = useState<SourceFilter>('todos');
  const [selectedItem, setSelectedItem] = useState<UnifiedItem | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editTaskId, setEditTaskId] = useState<string | null>(null);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const toggleMutation = useMutation({
    mutationFn: async (item: UnifiedItem) => {
      const newCompleted = !item.completed;
      switch (item.source) {
        case 'tarefa': {
          const { error } = await supabase.from('tasks')
            .update({ status: newCompleted ? 'done' : 'por_comecar' })
            .eq('id', item.sourceId);
          if (error) throw error;
          break;
        }
        case 'rotina': {
          const { error } = await supabase.from('executive_monthly_checklists')
            .update({ completed: newCompleted })
            .eq('id', item.sourceId);
          if (error) throw error;
          break;
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['unified-tasks'] });
      qc.invalidateQueries({ queryKey: ['unified-habits'] });
      qc.invalidateQueries({ queryKey: ['executive'] });
      toast.success('Atualizado!');
    },
    onError: () => toast.error('Erro ao atualizar'),
  });

  const filtered = filter === 'todos' ? items : items.filter(i => i.source === filter);

  const countBySource: Partial<Record<ResponsibilitySource, number>> = {};
  items.forEach(i => { countBySource[i.source] = (countBySource[i.source] || 0) + 1; });

  const DIALOG_SOURCES: ResponsibilitySource[] = ['rotina'];

  // Fetch full task for editing
  const { data: editTask } = useQuery({
    queryKey: ['task-edit', editTaskId],
    enabled: !!editTaskId,
    queryFn: async () => {
      const { data, error } = await supabase.from('tasks').select('*').eq('id', editTaskId!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const handleClick = (item: UnifiedItem) => {
    if (item.source === 'tarefa') {
      setEditTaskId(item.sourceId);
      return;
    }
    if (DIALOG_SOURCES.includes(item.source)) {
      setSelectedItem(item);
      return;
    }
    const route = getItemRoute(item);
    if (route) navigate(route);
  };

  const canToggle = (item: UnifiedItem) => !item.isInfoOnly && TOGGLEABLE_SOURCES.includes(item.source);

  return (
    <>
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-xs"
          onClick={() => setAddOpen(true)}
        >
          <Plus className="h-3.5 w-3.5" /> Adicionar
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          {FILTER_OPTIONS.map(f => {
            const count = f.value === 'todos' ? items.length : (countBySource[f.value as ResponsibilitySource] || 0);
            if (f.value !== 'todos' && count === 0) return null;
            return (
              <Button
                key={f.value}
                variant={filter === f.value ? 'default' : 'outline'}
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => setFilter(f.value)}
              >
                {f.label}
                <span className="text-[10px] opacity-70">({count})</span>
              </Button>
            );
          })}
        </div>

        {/* List */}
        <ScrollArea style={{ maxHeight }} className="overflow-auto pr-2">
          <div className="space-y-2">
            {filtered.length === 0 && (
              <EmptyHint>Sem responsabilidades pendentes.</EmptyHint>
            )}
            {filtered.map(item => {
              const Icon = SOURCE_ICON[item.source];
              const route = getItemRoute(item);
              const toggleable = canToggle(item);

              return (
                <div
                  key={item.id}
                  className={cn(
                    'flex items-center gap-3 p-2.5 rounded-lg border transition-all',
                    route && !toggleable && 'cursor-pointer hover:bg-accent/50',
                    item.isInfoOnly && 'bg-muted/30',
                    item.completed && 'opacity-60',
                  )}
                  onClick={() => {
                    if (!toggleable) handleClick(item);
                  }}
                >
                  {toggleable ? (
                    <Checkbox
                      checked={item.completed}
                      onCheckedChange={() => toggleMutation.mutate(item)}
                      className="shrink-0"
                    />
                  ) : (
                    <div className="h-5 w-5 flex items-center justify-center text-muted-foreground shrink-0">
                      <Icon className="h-4 w-4" />
                    </div>
                  )}

                  <div
                    className={cn('flex-1 min-w-0', toggleable && 'cursor-pointer')}
                    onClick={(e) => {
                      if (toggleable) {
                        e.stopPropagation();
                        handleClick(item);
                      }
                    }}
                  >
                    <p className={cn('text-sm font-medium truncate', item.completed && 'line-through text-muted-foreground')}>
                      {item.title}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <Badge className={cn('text-[9px] font-normal border', SOURCE_COLOR[item.source])}>
                        {SOURCE_LABELS[item.source]}
                      </Badge>
                      {item.priority && (
                        <Badge variant="outline" className="text-[9px]">{PRIORITY_LABELS[item.priority] || item.priority}</Badge>
                      )}
                      {item.deadline && (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                          <Clock className="h-2.5 w-2.5" />
                          {format(parseISO(item.deadline.split('T')[0]), 'd MMM', { locale: pt })}
                        </span>
                      )}
                      {item.date && item.date.includes('T') && (
                        <span className="text-[10px] text-muted-foreground">
                          {format(parseISO(item.date), 'HH:mm')}
                        </span>
                      )}
                    </div>
                  </div>

                  {route && (
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>

      <ResponsibilityDetailDialog
        item={selectedItem}
        open={!!selectedItem}
        onOpenChange={(open) => { if (!open) setSelectedItem(null); }}
      />
    </Card>

    <TaskFormDialog
      open={addOpen}
      onOpenChange={setAddOpen}
      defaultDeadline={defaultDeadline ? parseISO(defaultDeadline) : undefined}
    />

    <TaskFormDialog
      open={!!editTaskId}
      onOpenChange={(open) => { if (!open) setEditTaskId(null); }}
      editingTask={editTask ?? undefined}
      onSuccess={() => {
        setEditTaskId(null);
        qc.invalidateQueries({ queryKey: ['unified-tasks'] });
      }}
    />
    </>
  );
}