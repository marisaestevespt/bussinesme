import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { CalendarIcon, ListTodo, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DEPARTMENTS } from '@/lib/departments';
import { toast } from 'sonner';

interface CheckItem { text: string; checked: boolean; }

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ownerActions: CheckItem[];
  clientActions: CheckItem[];
  ownerLabel: string;
  clientLabel: string;
  meetingTitle: string;
  projectId: string | null;
  department: string | null;
}

interface TaskDraft {
  selected: boolean;
  text: string;
  source: string;
  deadline: Date | undefined;
  department: string;
  assignedTo: string;
  priority: string;
  projectId: string;
}

export function CreateTasksFromMeetingDialog({
  open, onOpenChange, ownerActions, clientActions, ownerLabel, clientLabel,
  meetingTitle, projectId, department,
}: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles', 'active-team'],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, user_id, full_name, team_members!inner(status)')
        .eq('team_members.status', 'ativo');
      return data || [];
    },
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects_list'],
    queryFn: async () => {
      const { data } = await supabase.from('projects').select('id, name').order('name').is('archived_at', null);
      return data || [];
    },
  });

  const buildDrafts = (): TaskDraft[] => {
    const drafts: TaskDraft[] = [];
    ownerActions.filter(a => !a.checked && a.text.trim()).forEach(a => {
      drafts.push({
        selected: true, text: a.text, source: ownerLabel, deadline: undefined,
        department: department || '', assignedTo: '', priority: 'media', projectId: projectId || '',
      });
    });
    clientActions.filter(a => !a.checked && a.text.trim()).forEach(a => {
      drafts.push({
        selected: true, text: a.text, source: clientLabel, deadline: undefined,
        department: department || '', assignedTo: '', priority: 'media', projectId: projectId || '',
      });
    });
    return drafts;
  };

  const [drafts, setDrafts] = useState<TaskDraft[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setDrafts(buildDrafts());
      setExpandedIdx(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const updateDraft = (idx: number, patch: Partial<TaskDraft>) => {
    setDrafts(prev => prev.map((d, i) => i === idx ? { ...d, ...patch } : d));
  };

  const handleCreate = async () => {
    const selected = drafts.filter(d => d.selected);
    if (selected.length === 0) { toast.error('Seleciona pelo menos uma tarefa'); return; }
    setSaving(true);
    try {
      const rows = selected.map(d => ({
        name: d.text,
        deadline: d.deadline ? format(d.deadline, 'yyyy-MM-dd') : null,
        department: d.department || null,
        assigned_to: d.assignedTo || null,
        priority: d.priority,
        project_id: d.projectId || null,
        notes: `Criada a partir da reunião: ${meetingTitle}`,
        created_by: user?.id || null,
        status: 'por_comecar',
      }));
      const { error } = await supabase.from('tasks').insert(rows);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ['tasks'] });
      toast.success(`${selected.length} tarefa(s) criada(s)`);
      onOpenChange(false);
    } catch {
      toast.error('Erro ao criar tarefas');
    } finally {
      setSaving(false);
    }
  };

  const selectedCount = drafts.filter(d => d.selected).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListTodo className="h-5 w-5" /> Criar Tarefas a partir dos Próximos Passos
          </DialogTitle>
        </DialogHeader>

        {drafts.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Não existem ações por concluir nos próximos passos.
          </p>
        ) : (
          <div className="space-y-2">
            {drafts.map((d, idx) => {
              const isOpen = expandedIdx === idx;
              return (
                <Collapsible key={idx} open={isOpen} onOpenChange={(v) => setExpandedIdx(v ? idx : null)}>
                  <div className={cn(
                    'rounded-lg border transition-all',
                    !d.selected && 'opacity-50',
                    isOpen && 'border-primary/30 bg-muted/30'
                  )}>
                    <div className="flex items-center gap-3 px-4 py-3">
                      <Checkbox
                        checked={d.selected}
                        onCheckedChange={v => updateDraft(idx, { selected: !!v })}
                        onClick={e => e.stopPropagation()}
                      />
                      <CollapsibleTrigger asChild>
                        <button className="flex-1 flex items-center gap-2 text-left min-w-0">
                          {isOpen
                            ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                            : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
                          <span className="text-sm font-medium truncate">{d.text}</span>
                        </button>
                      </CollapsibleTrigger>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">{d.source}</span>
                    </div>

                    <CollapsibleContent>
                      <div className="px-4 pb-4 pt-1 space-y-3 border-t border-border/50">
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">Nome da tarefa</Label>
                          <Input
                            value={d.text}
                            onChange={e => updateDraft(idx, { text: e.target.value })}
                            className="h-8 text-sm"
                          />
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <div className="space-y-1">
                            <Label className="text-[10px] text-muted-foreground">Prazo</Label>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button variant="outline" size="sm" className={cn('h-7 text-xs w-full justify-start', !d.deadline && 'text-muted-foreground')}>
                                  <CalendarIcon className="mr-1 h-3 w-3" />
                                  {d.deadline ? format(d.deadline, 'dd/MM/yy') : 'Sem prazo'}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar mode="single" selected={d.deadline} onSelect={day => updateDraft(idx, { deadline: day })} initialFocus className="p-3 pointer-events-auto" />
                              </PopoverContent>
                            </Popover>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] text-muted-foreground">Departamento</Label>
                            <Select value={d.department} onValueChange={v => updateDraft(idx, { department: v })}>
                              <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                              <SelectContent>{DEPARTMENTS.map(dep => <SelectItem key={dep.value} value={dep.value}>{dep.label}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] text-muted-foreground">Responsável</Label>
                            <Select value={d.assignedTo} onValueChange={v => updateDraft(idx, { assignedTo: v })}>
                              <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                              <SelectContent>{profiles.map(p => <SelectItem key={p.id} value={p.id}>{p.full_name || '—'}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] text-muted-foreground">Prioridade</Label>
                            <Select value={d.priority} onValueChange={v => updateDraft(idx, { priority: v })}>
                              <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="baixa">Baixa</SelectItem>
                                <SelectItem value="media">Média</SelectItem>
                                <SelectItem value="alta">Alta</SelectItem>
                                <SelectItem value="urgente">Urgente</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        {projects.length > 0 && (
                          <div className="space-y-1">
                            <Label className="text-[10px] text-muted-foreground">Projeto</Label>
                            <Select value={d.projectId} onValueChange={v => updateDraft(idx, { projectId: v })}>
                              <SelectTrigger className="h-7 text-xs w-full"><SelectValue placeholder="Sem projeto" /></SelectTrigger>
                              <SelectContent>{projects.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                        )}
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              );
            })}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleCreate} disabled={saving || selectedCount === 0}>
            {saving ? 'A criar...' : `Criar ${selectedCount} tarefa(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
