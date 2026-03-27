import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  CheckSquare, PhoneCall, FileText, Users, FolderKanban,
  Star, ShoppingCart, ListChecks, Clock, Target, ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';
import type { UnifiedItem, ResponsibilitySource } from '@/hooks/useUnifiedResponsibilities';
import { SOURCE_LABELS } from '@/hooks/useUnifiedResponsibilities';

const SOURCE_ICON: Record<ResponsibilitySource, typeof CheckSquare> = {
  tarefa: CheckSquare,
  crm: PhoneCall,
  conteudo: FileText,
  reuniao: Users,
  projeto: FolderKanban,
  nps: Star,
  marco: Target,
  acao_venda: ShoppingCart,
  rotina: ListChecks,
};

const SOURCE_COLOR: Record<ResponsibilitySource, string> = {
  tarefa: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  crm: 'bg-blue-100 text-blue-800 border-blue-200',
  conteudo: 'bg-violet-100 text-violet-800 border-violet-200',
  reuniao: 'bg-rose-100 text-rose-800 border-rose-200',
  projeto: 'bg-amber-100 text-amber-800 border-amber-200',
  nps: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  marco: 'bg-cyan-100 text-cyan-800 border-cyan-200',
  acao_venda: 'bg-orange-100 text-orange-800 border-orange-200',
  rotina: 'bg-purple-100 text-purple-800 border-purple-200',
};

const PRIORITY_LABELS: Record<string, string> = {
  alta: 'P1', media: 'P2', baixa: 'P3',
};

export type SourceFilter = 'todos' | ResponsibilitySource;

const FILTER_OPTIONS: { value: SourceFilter; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'tarefa', label: 'Tarefas' },
  { value: 'crm', label: 'Follow-ups' },
  { value: 'conteudo', label: 'Conteúdos' },
  { value: 'reuniao', label: 'Reuniões' },
  { value: 'nps', label: 'NPS' },
  { value: 'marco', label: 'Marcos' },
  { value: 'acao_venda', label: 'Ações' },
  { value: 'rotina', label: 'Rotinas' },
];

/** Maps a unified item to the route where its source detail lives */
function getItemRoute(item: UnifiedItem): string | null {
  switch (item.source) {
    case 'tarefa': return `/tarefas`;
    case 'crm': return `/comercial/crm`;
    case 'conteudo': return `/conteudo/${item.sourceId}`;
    case 'reuniao': return `/reunioes/${item.sourceId}`;
    case 'projeto': return `/projetos/${item.sourceId}`;
    case 'nps': return null; // opens inside client detail
    case 'marco': return null;
    case 'acao_venda': return `/comercial/acoes`;
     case 'rotina': return `/executive/planeamento`;
    default: return null;
  }
}

interface Props {
  items: UnifiedItem[];
  title: string;
  maxHeight?: string;
}

export function UnifiedResponsibilitiesList({ items, title, maxHeight = '500px' }: Props) {
  const [filter, setFilter] = useState<SourceFilter>('todos');
  const navigate = useNavigate();

  const filtered = filter === 'todos' ? items : items.filter(i => i.source === filter);

  // Count per source for filter badges
  const countBySource: Partial<Record<ResponsibilitySource, number>> = {};
  items.forEach(i => { countBySource[i.source] = (countBySource[i.source] || 0) + 1; });

  const handleClick = (item: UnifiedItem) => {
    const route = getItemRoute(item);
    if (route) navigate(route);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Filters */}
        <div className="flex flex-wrap gap-1.5">
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
          <div className="space-y-1.5">
            {filtered.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">Sem responsabilidades pendentes.</p>
            )}
            {filtered.map(item => {
              const Icon = SOURCE_ICON[item.source];
              const route = getItemRoute(item);

              return (
                <div
                  key={item.id}
                  className={cn(
                    'flex items-center gap-3 p-2.5 rounded-lg border transition-all',
                    route && 'cursor-pointer hover:bg-accent/50',
                    item.isInfoOnly && 'bg-muted/30',
                  )}
                  onClick={() => handleClick(item)}
                >
                  {/* Source icon */}
                  <div className="h-5 w-5 flex items-center justify-center text-muted-foreground shrink-0">
                    <Icon className="h-4 w-4" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.title}</p>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
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

                  {/* Navigate arrow */}
                  {route && (
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
