import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, ListTodo } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
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

  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, user_id, full_name');
      return data || [];
    },
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects_list'],
    queryFn: async () => {
      const { data } = await supabase.from('projects').select('id, name').order('name');
      return data || [];
    },
  });

  // Build initial drafts from unchecked actions
  const buildDrafts = (): TaskDraft[] => {
    const drafts: TaskDraft[] = [];
    ownerActions.filter(a => !a.checked && a.text.trim()).forEach(a => {
      drafts.push({
        selected: true,
        text: a.text,
        source: ownerLabel,
        deadline: undefined,
        department: department || '',
        assignedTo: '',
        priority: 'media',
        projectId: projectId || '',
      });
    });
    clientActions.filter(a => !a.checked && a.text.trim()).forEach(a => {
      drafts.push({
        selected: true,
        text: a.text,
        source: clientLabel,
        deadline: undefined,
        department: department || '',
        assignedTo: '',
        priority: 'media',
        projectId: projectId || '',
      });
    });
    return drafts;
  };

  const [drafts, setDrafts] = useState<TaskDraft[]>([]);
  const [saving, setSaving] = useState(false);

  // Reset drafts whenever dialog opens — use useEffect to guarantee latest props
  useEffect(() => {
    if (open) {
      setDrafts(buildDrafts());
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleOpenChange = (v: boolean) => {
    onOpenChange(v);
  };

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
        status: 'pendente',
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
    <Dialog open={open} onOpenChange={handleOpenChange}>
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
          <div className="space-y-4">
            {drafts.map((d, idx) => (
              <div key={idx} className={cn(
                'rounded-lg border p-4 space-y-3 transition-opacity',
                !d.selected && 'opacity-50'
              )}>
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={d.selected}
                    onCheckedChange={v => updateDraft(idx, { selected: !!v })}
                    className="mt-0.5"
                  />
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center justify-between">
                      <Input
                        value={d.text}
                        onChange={e => updateDraft(idx, { text: e.target.value })}
                        className="h-8 text-sm font-medium"
                      />
                      <span className="text-[10px] text-muted-foreground ml-2 whitespace-nowrap">{d.source}</span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {/* Deadline */}
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
                            <Calendar
                              mode="single"
                              selected={d.deadline}
                              onSelect={day => updateDraft(idx, { deadline: day })}
                              initialFocus
                              className="p-3 pointer-events-auto"
                            />
                          </PopoverContent>
                        </Popover>
                      </div>

                      {/* Department */}
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">Departamento</Label>
                        <Select value={d.department} onValueChange={v => updateDraft(idx, { department: v })}>
                          <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                          <SelectContent>
                            {DEPARTMENTS.map(dep => (
                              <SelectItem key={dep.value} value={dep.value}>{dep.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Assignee */}
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">Responsável</Label>
                        <Select value={d.assignedTo} onValueChange={v => updateDraft(idx, { assignedTo: v })}>
                          <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                          <SelectContent>
                            {profiles.map(p => (
                              <SelectItem key={p.id} value={p.id}>{p.full_name || '—'}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Priority */}
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

                    {/* Project */}
                    {projects.length > 0 && (
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">Projeto</Label>
                        <Select value={d.projectId} onValueChange={v => updateDraft(idx, { projectId: v })}>
                          <SelectTrigger className="h-7 text-xs w-full"><SelectValue placeholder="Sem projeto" /></SelectTrigger>
                          <SelectContent>
                            {projects.map((p: any) => (
                              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
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
