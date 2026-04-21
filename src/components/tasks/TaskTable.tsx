import { useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ChevronRight, GitBranch, Repeat, Link2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { PROCESS_DEPARTMENTS } from '@/lib/departments';

const TASK_STATUSES = [
  { value: 'por_comecar', label: 'Por começar', color: 'bg-muted text-muted-foreground' },
  { value: 'a_fazer', label: 'A fazer', color: 'bg-info/15 text-info border-info/30' },
  { value: 'aguarda_feedback', label: 'Aguarda Feedback', color: 'bg-warning/15 text-warning border-warning/30' },
  { value: 'para_aprovacao', label: 'Para Aprovação', color: 'bg-primary/15 text-primary border-primary/30' },
  { value: 'precisa_alteracoes', label: 'Precisa de Alterações', color: 'bg-warning/20 text-warning border-warning/40' },
  { value: 'done', label: 'Done', color: 'bg-success/15 text-success border-success/30' },
];

const PRIORITIES = [
  { value: 'alta', label: 'Prioridade 1', color: 'bg-destructive/15 text-destructive border-destructive/30' },
  { value: 'media', label: 'Prioridade 2', color: 'bg-warning/15 text-warning border-warning/30' },
  { value: 'baixa', label: 'Prioridade 3', color: 'bg-muted text-muted-foreground border-border' },
];

export function getStatusInfo(val: string) {
  return TASK_STATUSES.find(s => s.value === val) || TASK_STATUSES[0];
}
export function getPriorityInfo(val: string) {
  return PRIORITIES.find(p => p.value === val) || PRIORITIES[2];
}
export function getDeptInfo(val: string) {
  return PROCESS_DEPARTMENTS.find(d => d.value === val);
}

export { TASK_STATUSES, PRIORITIES };

interface TaskTableProps {
  tasks: any[];
  isOverdue: (t: any) => boolean;
  isDoneAfterDeadline: (t: any) => boolean;
  getProfileName: (id: string | null) => string;
  getProjectName: (id: string | null) => string;
  onTaskClick: (t: any) => void;
  taskDependencies?: any[];
  allTasks?: any[];
}

export function TaskTable({
  tasks, isOverdue, isDoneAfterDeadline, getProfileName, getProjectName, onTaskClick, taskDependencies = [], allTasks = [],
}: TaskTableProps) {
  if (!tasks.length) {
    return <div className="text-center py-12 text-muted-foreground">Sem tarefas nesta vista.</div>;
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tarefa</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Prioridade</TableHead>
            <TableHead>Prazo</TableHead>
            <TableHead>Responsável</TableHead>
            <TableHead>Departamento</TableHead>
            <TableHead>Projeto</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.map(task => {
            const overdue = isOverdue(task);
            const lateComplete = isDoneAfterDeadline(task);
            const statusInfo = getStatusInfo(task.status);
            const priorityInfo = getPriorityInfo(task.priority);
            const deptInfo = getDeptInfo(task.department);
            const hasBlockingDeps = taskDependencies
              .filter(d => d.task_id === task.id)
              .some(d => {
                const dep = allTasks.find((t: any) => t.id === d.depends_on_task_id);
                return dep && dep.status !== 'done';
              });
            const subtaskCount = allTasks.filter((t: any) => t.parent_task_id === task.id).length;

            return (
              <TableRow key={task.id} className="cursor-pointer hover:bg-muted/50" onClick={() => onTaskClick(task)}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {task.parent_task_id && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                    <span className="font-medium">{task.name}</span>
                    {subtaskCount > 0 && (
                      <Badge variant="secondary" className="text-[9px] px-1 py-0 gap-0.5">
                        <GitBranch className="h-2.5 w-2.5" />{subtaskCount}
                      </Badge>
                    )}
                    {task.recurrence_type && <Repeat className="h-3 w-3 text-muted-foreground" />}
                    {hasBlockingDeps && <Link2 className="h-3.5 w-3.5 text-amber-500" />}
                    {overdue && <AlertTriangle className="h-3.5 w-3.5 text-destructive" />}
                    {lateComplete && <AlertTriangle className="h-3.5 w-3.5 text-destructive" />}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={cn('text-xs', statusInfo.color)}>{statusInfo.label}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={cn('text-xs', priorityInfo.color)}>{priorityInfo.label}</Badge>
                </TableCell>
                <TableCell>
                  <span className={cn('text-sm', (overdue || lateComplete) && 'text-destructive font-semibold')}>
                    {task.deadline ? format(parseISO(task.deadline), 'dd/MM/yyyy') : '—'}
                  </span>
                </TableCell>
                <TableCell className="text-sm">{getProfileName(task.assigned_to)}</TableCell>
                <TableCell>
                  {deptInfo ? (
                    <Badge variant="outline" className="text-xs">{deptInfo.icon} {deptInfo.label}</Badge>
                  ) : '—'}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{getProjectName(task.project_id) || '—'}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
