import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { ChevronRight, GitBranch, Repeat, Link2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';
import { PROCESS_DEPARTMENTS } from '@/lib/departments';
import { isTaskDone } from '@/lib/taskStatus';
import { TASK_STATUSES, TASK_PRIORITIES, getTaskStatusInfo, getTaskPriorityInfo } from '@/lib/taskStatus';
import { useTeamPhotos } from '@/hooks/useTeamPhotos';
import { DepartmentBadge } from '@/components/shared/DepartmentBadge';

const PRIORITIES = TASK_PRIORITIES;

export const getStatusInfo = getTaskStatusInfo;
export const getPriorityInfo = getTaskPriorityInfo;
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
  profiles?: { id: string; full_name: string | null; avatar_url?: string | null }[];
  onUpdateTask?: (id: string, patch: Record<string, any>) => void;
}

function getInitials(name?: string | null) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '?';
}

/** Stop propagation wrapper so inline editors don't trigger row click. */
function Stop({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={className}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  );
}

export function TaskTable({
  tasks, isOverdue, isDoneAfterDeadline, getProfileName, getProjectName, onTaskClick, taskDependencies = [], allTasks = [], profiles = [], onUpdateTask,
}: TaskTableProps) {
  if (!tasks.length) {
    return <div className="text-center py-12 text-muted-foreground">Sem tarefas nesta vista.</div>;
  }

  const editable = !!onUpdateTask;
  const { getPhotoUrl } = useTeamPhotos();

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
                return dep && !isTaskDone(dep);
              });
            const subtaskCount = allTasks.filter((t: any) => t.parent_task_id === task.id).length;
            const responsibleProfile = profiles.find(p => p.id === task.assigned_to);
            const responsibleName = responsibleProfile?.full_name || getProfileName(task.assigned_to);
            const responsiblePhoto = getPhotoUrl(responsibleProfile || (task.assigned_to ? { id: task.assigned_to, full_name: responsibleName } : null));

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
                    {false && <Repeat className="h-3 w-3 text-muted-foreground" />}
                    {hasBlockingDeps && <Link2 className="h-3.5 w-3.5 text-warning" />}
                    {overdue && <AlertTriangle className="h-3.5 w-3.5 text-destructive" />}
                    {lateComplete && <AlertTriangle className="h-3.5 w-3.5 text-destructive" />}
                  </div>
                </TableCell>
                <TableCell>
                  {editable ? (
                    <Stop>
                      <Select value={task.status} onValueChange={(v) => v !== task.status && onUpdateTask!(task.id, { status: v })}>
                        <SelectTrigger className={cn('h-7 px-2 text-xs gap-1 border-0 bg-transparent hover:bg-muted/60 focus:ring-0 focus:ring-offset-0 w-fit min-w-max [&>span]:whitespace-nowrap', statusInfo.color)}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TASK_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </Stop>
                  ) : (
                    <Badge variant="outline" className={cn('text-xs', statusInfo.color)}>{statusInfo.label}</Badge>
                  )}
                </TableCell>
                <TableCell>
                  {editable ? (
                    <Stop>
                      <Select value={task.priority} onValueChange={(v) => v !== task.priority && onUpdateTask!(task.id, { priority: v })}>
                        <SelectTrigger className={cn('h-7 px-2 text-xs gap-1 border-0 bg-transparent hover:bg-muted/60 focus:ring-0 focus:ring-offset-0 w-fit min-w-max [&>span]:whitespace-nowrap', priorityInfo.color)}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PRIORITIES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </Stop>
                  ) : (
                    <Badge variant="outline" className={cn('text-xs', priorityInfo.color)}>{priorityInfo.label}</Badge>
                  )}
                </TableCell>
                <TableCell>
                  {editable ? (
                    <Stop>
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            className={cn(
                              'text-sm px-2 py-1 rounded hover:bg-muted/60 transition-colors',
                              (overdue || lateComplete) && 'text-destructive font-semibold'
                            )}
                          >
                            {task.deadline ? format(parseISO(task.deadline), 'dd/MM/yyyy') : '—'}
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            locale={pt}
                            selected={task.deadline ? parseISO(task.deadline) : undefined}
                            onSelect={(d) => {
                              if (!d) return;
                              onUpdateTask!(task.id, { deadline: format(d, 'yyyy-MM-dd') });
                            }}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </Stop>
                  ) : (
                    <span className={cn('text-sm', (overdue || lateComplete) && 'text-destructive font-semibold')}>
                      {task.deadline ? format(parseISO(task.deadline), 'dd/MM/yyyy') : '—'}
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  {editable ? (
                    <Stop>
                      <Select
                        value={task.assigned_to || '_none'}
                        onValueChange={(v) => onUpdateTask!(task.id, { assigned_to: v === '_none' ? null : v })}
                      >
                        <SelectTrigger className="h-8 px-1.5 gap-2 border-0 bg-transparent hover:bg-muted/60 focus:ring-0 focus:ring-offset-0 w-fit min-w-max [&>span]:whitespace-nowrap [&>svg]:opacity-0 [&>svg]:group-hover:opacity-100">
                          <div className="flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                              <AvatarImage src={responsiblePhoto || undefined} />
                              <AvatarFallback className="text-[10px] font-semibold">
                                {getInitials(responsibleName)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm whitespace-nowrap">
                              {responsibleName || 'Sem responsável'}
                            </span>
                          </div>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_none">Sem responsável</SelectItem>
                          {profiles
                            .filter(p => p.full_name)
                            .map(p => (
                              <SelectItem key={p.id} value={p.id}>
                                <div className="flex items-center gap-2">
                                  <Avatar className="h-5 w-5">
                                    <AvatarImage src={getPhotoUrl(p) || undefined} />
                                    <AvatarFallback className="text-[9px] font-semibold">
                                      {getInitials(p.full_name)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span>{p.full_name}</span>
                                </div>
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </Stop>
                  ) : (
                    <div className="flex items-center gap-2 text-sm">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={responsiblePhoto || undefined} />
                        <AvatarFallback className="text-[10px] font-semibold">
                          {getInitials(responsibleName)}
                        </AvatarFallback>
                      </Avatar>
                      <span>{responsibleName || '—'}</span>
                    </div>
                  )}
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  {task.department ? (
                    <DepartmentBadge department={task.department} stopPropagation />
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

