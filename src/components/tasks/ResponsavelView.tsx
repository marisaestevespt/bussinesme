import { useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { getStatusInfo, getPriorityInfo, getDeptInfo } from './TaskTable';
import { useTeamPhotos } from '@/hooks/useTeamPhotos';

function getInitials(name?: string | null) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '?';
}

interface ResponsavelViewProps {
  tasks: any[];
  profiles: any[];
  isOverdue: (t: any) => boolean;
  isDoneAfterDeadline: (t: any) => boolean;
  getProfileName: (id: string | null) => string;
  getProjectName: (id: string | null) => string;
  onTaskClick: (t: any) => void;
}

export function ResponsavelView({
  tasks, profiles, isOverdue, isDoneAfterDeadline, getProfileName, getProjectName, onTaskClick,
}: ResponsavelViewProps) {
  const { getPhotoUrl } = useTeamPhotos();
  const grouped = useMemo(() => {
    const map: Record<string, any[]> = {};
    tasks.forEach(t => {
      const key = t.assigned_to || '__unassigned';
      if (!map[key]) map[key] = [];
      map[key].push(t);
    });
    return map;
  }, [tasks]);

  const sortedKeys = Object.keys(grouped).sort((a, b) => {
    if (a === '__unassigned') return 1;
    if (b === '__unassigned') return -1;
    return getProfileName(a).localeCompare(getProfileName(b));
  });

  if (!tasks.length) {
    return <div className="text-center py-12 text-muted-foreground">Sem tarefas atribuídas.</div>;
  }

  return (
    <div className="space-y-6">
      {sortedKeys.map(key => {
        const personTasks = grouped[key];
        const personName = key === '__unassigned' ? 'Sem responsável' : getProfileName(key);
        const personProfile = key === '__unassigned' ? null : profiles.find((p: any) => p.id === key);
        const personPhoto = key === '__unassigned' ? '' : getPhotoUrl(personProfile || { id: key, full_name: personName });

        return (
          <div key={key} className="space-y-2">
            <div className="flex items-center gap-2">
              <Avatar className="h-7 w-7">
                {personPhoto && <AvatarImage src={personPhoto} />}
                <AvatarFallback className="text-[10px] font-semibold">
                  {key === '__unassigned' ? '—' : getInitials(personName)}
                </AvatarFallback>
              </Avatar>
              <h3 className="text-sm font-semibold text-foreground">{personName}</h3>
              <Badge variant="secondary" className="text-xs">{personTasks.length}</Badge>
            </div>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tarefa</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Prioridade</TableHead>
                    <TableHead>Prazo</TableHead>
                    <TableHead>Departamento</TableHead>
                    <TableHead>Projeto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {personTasks.map(task => {
                    const overdue = isOverdue(task);
                    const statusInfo = getStatusInfo(task.status);
                    const priorityInfo = getPriorityInfo(task.priority);
                    const deptInfo = getDeptInfo(task.department);

                    return (
                      <TableRow key={task.id} className="cursor-pointer hover:bg-muted/50" onClick={() => onTaskClick(task)}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{task.name}</span>
                            {overdue && <AlertTriangle className="h-3.5 w-3.5 text-destructive" />}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn('text-xs', statusInfo.color)}>{statusInfo.label}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn('text-xs', priorityInfo.color)}>{priorityInfo.label}</Badge>
                        </TableCell>
                        <TableCell>
                          <span className={cn('text-sm', overdue && 'text-destructive font-semibold')}>
                            {task.deadline ? format(parseISO(task.deadline), 'dd/MM/yyyy') : '—'}
                          </span>
                        </TableCell>
                        <TableCell>
                          {deptInfo ? <Badge variant="outline" className="text-xs">{deptInfo.icon} {deptInfo.label}</Badge> : '—'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{getProjectName(task.project_id) || '—'}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        );
      })}
    </div>
  );
}
