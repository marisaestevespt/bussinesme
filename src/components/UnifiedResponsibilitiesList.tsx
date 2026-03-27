import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ResponsibilityDetailDialog } from '@/components/ResponsibilityDetailDialog';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  CheckSquare, PhoneCall, FileText, Users, FolderKanban,
  Star, ShoppingCart, ListChecks, Clock, Target, ChevronRight, Plus, CalendarIcon,
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
    case 'nps': return null;
    case 'marco': return null;
    case 'acao_venda': return `/comercial/acoes`;
    case 'rotina': return `/executive/planeamento`;
    default: return null;
  }
}

/** Which sources support toggling completion directly */
const TOGGLEABLE_SOURCES: ResponsibilitySource[] = ['tarefa', 'marco', 'rotina'];

interface Props {
  items: UnifiedItem[];
  title: string;
  maxHeight?: string;
  /** Default deadline for quick-add tasks (ISO date string, e.g. today or end of week) */
  defaultDeadline?: string;
}

export function UnifiedResponsibilitiesList({ items, title, maxHeight = '500px', defaultDeadline }: Props) {
  const [filter, setFilter] = useState<SourceFilter>('todos');
  const [selectedItem, setSelectedItem] = useState<UnifiedItem | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDeadline, setNewDeadline] = useState<Date | undefined>(defaultDeadline ? parseISO(defaultDeadline) : new Date());
  const [newPriority, setNewPriority] = useState('alta');
  const [newDepartment, setNewDepartment] = useState('');
  const [newAssignedTo, setNewAssignedTo] = useState('');
  const [newProjectId, setNewProjectId] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();

  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles'],
    enabled: addOpen,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, full_name');
      return data || [];
    },
  });

  const { data: projectsList = [] } = useQuery({
    queryKey: ['projects-list-simple'],
    enabled: addOpen,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase.from('projects').select('id, name').neq('status', 'concluido').order('name');
      return data || [];
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async (item: UnifiedItem) => {
      const newCompleted = !item.completed;
      switch (item.source) {
        case 'tarefa': {
          const { error } = await supabase.from('tasks')
            .update({ status: newCompleted ? 'done' : 'todo' })
            .eq('id', item.sourceId);
          if (error) throw error;
          break;
        }
        case 'marco': {
          const { error } = await supabase.from('client_milestones')
            .update({ status: newCompleted ? 'concluido' : 'por_fazer' })
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
      qc.invalidateQueries({ queryKey: ['unified-milestones'] });
      qc.invalidateQueries({ queryKey: ['unified-habits'] });
      qc.invalidateQueries({ queryKey: ['executive'] });
      toast.success('Atualizado!');
    },
    onError: () => toast.error('Erro ao atualizar'),
  });

  const createMutation = useMutation({
    mutationFn: async (payload: any) => {
      const { error } = await supabase.from('tasks').insert({ ...payload, created_by: user?.id } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['unified-tasks'] });
      qc.invalidateQueries({ queryKey: ['my-tasks'] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Tarefa criada!');
      resetAddForm();
    },
    onError: () => toast.error('Erro ao criar tarefa'),
  });

  function resetAddForm() {
    setAddOpen(false);
    setNewName('');
    setNewDeadline(defaultDeadline ? parseISO(defaultDeadline) : new Date());
    setNewPriority('alta');
    setNewDepartment('');
    setNewAssignedTo('');
    setNewProjectId('');
    setNewNotes('');
  }

  function handleCreate() {
    if (!newName.trim() || !newDeadline) {
      toast.error('Preenche o nome e o prazo');
      return;
    }
    createMutation.mutate({
      name: newName.trim(),
      status: 'por_comecar',
      priority: newPriority,
      deadline: format(newDeadline, 'yyyy-MM-dd'),
      assigned_to: newAssignedTo || user?.id || null,
      department: newDepartment || null,
      project_id: newProjectId || null,
      notes: newNotes || null,
    });
  }

  const filtered = filter === 'todos' ? items : items.filter(i => i.source === filter);

  const countBySource: Partial<Record<ResponsibilitySource, number>> = {};
  items.forEach(i => { countBySource[i.source] = (countBySource[i.source] || 0) + 1; });

  const DIALOG_SOURCES: ResponsibilitySource[] = ['tarefa', 'marco', 'rotina'];

  const handleClick = (item: UnifiedItem) => {
    if (DIALOG_SOURCES.includes(item.source)) {
      setSelectedItem(item);
      return;
    }
    const route = getItemRoute(item);
    if (route) navigate(route);
  };

  const canToggle = (item: UnifiedItem) => !item.isInfoOnly && TOGGLEABLE_SOURCES.includes(item.source);

  const PRIORITIES = [
    { value: 'alta', label: 'Prioridade 1' },
    { value: 'media', label: 'Prioridade 2' },
    { value: 'baixa', label: 'Prioridade 3' },
  ];

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
                  {/* Checkbox or source icon */}
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

                  {/* Content */}
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

      <ResponsibilityDetailDialog
        item={selectedItem}
        open={!!selectedItem}
        onOpenChange={(open) => { if (!open) setSelectedItem(null); }}
      />
    </Card>

    {/* Add Task Dialog */}
    <Dialog open={addOpen} onOpenChange={(open) => { if (!open) resetAddForm(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova Tarefa</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Nome *</Label>
            <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Ex: Preparar relatório mensal" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Prazo *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal h-9">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {newDeadline ? format(newDeadline, 'dd/MM/yyyy') : 'Selecionar'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={newDeadline} onSelect={setNewDeadline} initialFocus />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label>Prioridade</Label>
              <Select value={newPriority} onValueChange={setNewPriority}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Responsável</Label>
              <Select value={newAssignedTo} onValueChange={setNewAssignedTo}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Eu" /></SelectTrigger>
                <SelectContent>
                  {profiles.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Departamento</Label>
              <Select value={newDepartment} onValueChange={setNewDepartment}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Nenhum" /></SelectTrigger>
                <SelectContent>
                  {PROCESS_DEPARTMENTS.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Projeto</Label>
            <Select value={newProjectId} onValueChange={setNewProjectId}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Nenhum" /></SelectTrigger>
              <SelectContent>
                {projectsList.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Notas</Label>
            <Textarea value={newNotes} onChange={e => setNewNotes(e.target.value)} placeholder="Observações..." rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={resetAddForm}>Cancelar</Button>
          <Button onClick={handleCreate} disabled={!newName.trim() || !newDeadline || createMutation.isPending}>
            Criar Tarefa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}