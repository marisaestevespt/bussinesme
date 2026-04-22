import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, FileText } from 'lucide-react';
import { format, parseISO, isBefore, startOfDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { TaskFormDialog } from '@/components/tasks/TaskFormDialog';
import { useMyTasks, useProjects } from './secretaria-shared';
import {
  isTaskDone,
  isTaskOpen,
  isTaskOverdue,
  countOverdue,
  getTaskStatusInfo,
  getTaskPriorityInfo,
} from '@/lib/taskStatus';

const today = startOfDay(new Date());

export default function SecretariaTarefas() {
  const tasks = useMyTasks();
  const allProjects = useProjects();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [view, setView] = useState<'todo' | 'atrasadas' | 'concluidas'>('todo');
  const [editTaskId, setEditTaskId] = useState<string | null>(null);
  const [showNewTask, setShowNewTask] = useState(false);

  const editTask = useQuery({
    queryKey: ['edit-task-secretaria-tarefas', editTaskId],
    enabled: !!editTaskId,
    queryFn: async () => {
      const { data } = await supabase.from('tasks').select('*').eq('id', editTaskId!).maybeSingle();
      return data;
    },
  });

  const getProjectName = (id: string | null) => allProjects.data?.find(p => p.id === id)?.name || '';

  const filtered = useMemo(() => {
    const data = tasks.data || [];
    switch (view) {
      case 'todo': return data.filter(isTaskOpen).sort((a: any, b: any) => {
        const pa = a.priority === 'alta' ? 0 : a.priority === 'media' ? 1 : 2;
        const pb = b.priority === 'alta' ? 0 : b.priority === 'media' ? 1 : 2;
        return pa - pb || ((a.deadline || '') > (b.deadline || '') ? 1 : -1);
      });
      case 'atrasadas': return data.filter((t: any) => isTaskOverdue(t, today));
      case 'concluidas': return data.filter(isTaskDone).sort((a: any, b: any) => (b.updated_at || '').localeCompare(a.updated_at || ''));
      default: return data;
    }
  }, [tasks.data, view]);

  const markDone = async (id: string) => {
    await supabase.from('tasks').update({ status: 'done', updated_at: new Date().toISOString() }).eq('id', id);
    qc.invalidateQueries({ queryKey: ['my-tasks'] });
    toast.success('Tarefa concluída');
  };

  const overdueCount = countOverdue(tasks.data || [], today);

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Button variant={view === 'todo' ? 'default' : 'outline'} size="sm" onClick={() => setView('todo')}>To Do</Button>
          <Button variant={view === 'atrasadas' ? 'default' : 'outline'} size="sm" onClick={() => setView('atrasadas')}>
            Atrasadas {overdueCount > 0 && <Badge variant="destructive" className="ml-1 text-[10px]">{overdueCount}</Badge>}
          </Button>
          <Button variant={view === 'concluidas' ? 'default' : 'outline'} size="sm" onClick={() => setView('concluidas')}>Concluídas</Button>
        </div>
        <Button size="sm" onClick={() => setShowNewTask(true)}><Plus className="h-4 w-4 mr-1" /> Nova Tarefa</Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            {view !== 'concluidas' && <TableHead className="w-10" />}
            <TableHead>Tarefa</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Prioridade</TableHead>
            <TableHead>Data Limite</TableHead>
            <TableHead>Projeto</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Sem tarefas.</TableCell></TableRow>}
          {filtered.map((t: any) => (
            <TableRow key={t.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setEditTaskId(t.id)}>
              {view !== 'concluidas' && (
                <TableCell><Checkbox checked={false} onCheckedChange={(e) => { e; markDone(t.id); }} onClick={(e) => e.stopPropagation()} /></TableCell>
              )}
              <TableCell className="font-medium">
                <div className="flex items-center gap-1.5">
                  {t.name}
                  {t.content_id && (
                    <Button variant="ghost" aria-label="Documento" size="icon" className="h-6 w-6 shrink-0" onClick={(e) => { e.stopPropagation(); navigate(`/hub/marketing/conteudos/${t.content_id}`); }}>
                      <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  )}
                </div>
              </TableCell>
              {(() => {
                const si = getTaskStatusInfo(t.status);
                const pi = getTaskPriorityInfo(t.priority);
                return (
                  <>
                    <TableCell><Badge variant="outline" className={cn('text-[10px]', si.color)}>{si.label}</Badge></TableCell>
                    <TableCell><Badge variant="outline" className={cn('text-[10px]', pi.color)}>{pi.short}</Badge></TableCell>
                  </>
                );
              })()}
              <TableCell className="text-sm">{t.deadline ? format(parseISO(t.deadline), 'dd/MM/yyyy') : '—'}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{getProjectName(t.project_id)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <TaskFormDialog
        open={!!editTaskId}
        onOpenChange={(open) => { if (!open) setEditTaskId(null); }}
        editingTask={editTask.data ?? undefined}
        onSuccess={() => {
          setEditTaskId(null);
          qc.invalidateQueries({ queryKey: ['my-tasks'] });
          qc.invalidateQueries({ queryKey: ['unified-tasks'] });
        }}
      />

      <TaskFormDialog
        open={showNewTask}
        onOpenChange={setShowNewTask}
        onSuccess={() => {
          setShowNewTask(false);
          qc.invalidateQueries({ queryKey: ['my-tasks'] });
          qc.invalidateQueries({ queryKey: ['unified-tasks'] });
        }}
      />
    </div>
  );
}
