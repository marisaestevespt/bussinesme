import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EntitySection } from '@/components/layout/entity';
import { ProjectResponsibilities } from '@/components/project/ProjectResponsibilities';
import { useTaskTimeTotals, formatDuration } from '@/components/TaskTimeTracker';
import { getTaskStatusInfo } from '@/lib/taskStatus';
import { getMeetingStatusInfo } from '@/lib/meetingStatus';
import { Handshake, CheckSquare, Plus, Video, ChevronRight, Clock } from 'lucide-react';
import { getInitials } from '@/pages/Projetos';
import type { ProjectFull, Task, Meeting, Profile } from '@/hooks/useProjectDetailData';

const TASK_PRIORITIES = [
  { value: 'baixa', label: 'Baixa', color: 'bg-muted text-muted-foreground' },
  { value: 'media', label: 'Média', color: 'bg-warning/15 text-warning' },
  { value: 'alta', label: 'Alta', color: 'bg-warning/15 text-warning' },
  { value: 'urgente', label: 'Urgente', color: 'bg-destructive/15 text-destructive' },
];
const getPriorityInfo = (v: string) => TASK_PRIORITIES.find(p => p.value === v) || TASK_PRIORITIES[1];

function ProjectTimeDisplay({ taskIds }: { taskIds: string[] }) {
  const { data: totalMinutes = 0 } = useTaskTimeTotals(taskIds);
  if (totalMinutes === 0) return null;
  return (
    <Badge variant="secondary" className="gap-1 text-xs">
      <Clock className="h-3 w-3" /> {formatDuration(totalMinutes)} investidas
    </Badge>
  );
}

interface Props {
  projectId: string;
  local: ProjectFull;
  isServicoMensal: boolean;
  taskMode: string;
  taskModes?: string[];
  tasks: Task[];
  meetings: Meeting[];
  profileMap: Map<string, Profile & { avatar_url: string | null }>;
  getPhotoUrl: (p: Profile) => string | undefined;
  resolvedClientId: string | null | undefined;
  reunioesLabel: string;
  onGenerateMonthly: () => void;
  onAddTask: () => void;
  onAddMeeting: () => void;
  onOpenTaskDetail: (id: string) => void;
  onOpenAllMeetings: () => void;
}

export function ProjectProcessosSection({
  projectId, local, isServicoMensal, taskMode, taskModes, tasks, meetings, profileMap, getPhotoUrl,
  resolvedClientId, reunioesLabel, onGenerateMonthly, onAddTask, onAddMeeting, onOpenTaskDetail, onOpenAllMeetings,
}: Props) {
  const navigate = useNavigate();
  const modes = taskModes || [taskMode];
  const hasFixedTasks = modes.includes('tarefas_fixas');
  const now = new Date();
  const sorted = [...(meetings || [])].sort((a, b) =>
    new Date(a.date_time || 0).getTime() - new Date(b.date_time || 0).getTime()
  );
  const upcoming = sorted.filter((m) => m.date_time && new Date(m.date_time) >= now);
  const pastDone = sorted
    .filter((m) => m.date_time && new Date(m.date_time) < now)
    .slice(-3)
    .reverse();
  const meetingList = [...upcoming, ...pastDone];

  return (
    <>
      {isServicoMensal && (
        <EntitySection title="Responsabilidades Acordadas" icon={Handshake}>
          <ProjectResponsibilities projectId={projectId} />
        </EntitySection>
      )}

      <EntitySection
        title={hasFixedTasks ? 'Tarefas do Mês' : taskMode === 'tarefas_livres' ? 'Tarefas' : 'Estado e Prioridades'}
        icon={CheckSquare}
        action={
          <div className="flex gap-2 items-center">
            <ProjectTimeDisplay taskIds={tasks.map(t => t.id)} />
            {hasFixedTasks && <Button size="sm" variant="outline" className="gap-1" onClick={onGenerateMonthly}>📋 Gerar</Button>}
            <Button size="sm" variant="outline" className="gap-1" onClick={onAddTask}><Plus className="h-3.5 w-3.5" /> Tarefa</Button>
          </div>
        }
      >
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed rounded-xl">
            <CheckSquare className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">{hasFixedTasks ? 'Usa o botão "Gerar tarefas" para criar as tarefas deste mês.' : taskMode === 'tarefas_livres' ? 'Adiciona tarefas conforme necessário.' : 'Nenhuma tarefa ligada a este projeto'}</p>
          </div>
        ) : (
          <div className="rounded-xl border overflow-hidden">
            <Table>
              <TableHeader><TableRow className="bg-muted/60">
                <TableHead className="font-semibold">Status</TableHead><TableHead className="font-semibold">Prioridade</TableHead><TableHead className="font-semibold">Tarefa</TableHead><TableHead className="font-semibold">Data final</TableHead><TableHead className="font-semibold">Responsável</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {tasks.map(t => {
                  const si = getTaskStatusInfo(t.status);
                  const pi = getPriorityInfo(t.priority);
                  const assignee = t.assigned_to ? profileMap.get(t.assigned_to) : null;
                  return (
                    <TableRow key={t.id} className="cursor-pointer hover:bg-muted/30" onClick={() => onOpenTaskDetail(t.id)}>
                      <TableCell><Badge className={`${si.color} border-0 text-[10px]`}>{si.label}</Badge></TableCell>
                      <TableCell><Badge className={`${pi.color} border-0 text-[10px]`}>{pi.label}</Badge></TableCell>
                      <TableCell className="font-medium text-sm">{t.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{t.deadline ? format(new Date(t.deadline), 'd MMM', { locale: pt }) : '—'}</TableCell>
                      <TableCell>{assignee ? <div className="flex items-center gap-2"><Avatar className="h-5 w-5"><AvatarImage src={getPhotoUrl(assignee)} /><AvatarFallback className="text-[8px]">{getInitials(assignee.full_name)}</AvatarFallback></Avatar><span className="text-xs">{assignee.full_name}</span></div> : <span className="text-xs text-muted-foreground">—</span>}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </EntitySection>

      <EntitySection
        title={reunioesLabel}
        icon={Video}
        action={
          <div className="flex gap-2 items-center">
            <Button size="sm" variant="ghost" className="gap-1" onClick={onOpenAllMeetings}>Ver todas</Button>
            <Button size="sm" variant="outline" className="gap-1" onClick={onAddMeeting}><Plus className="h-3.5 w-3.5" /> Reunião</Button>
          </div>
        }
      >
        {meetingList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center border-2 border-dashed rounded-xl">
            <Video className="h-8 w-8 text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">Sem reuniões associadas a este projeto.</p>
          </div>
        ) : (
          <div className="rounded-xl border overflow-hidden divide-y">
            {meetingList.map((m: Meeting & { client_id?: string | null; visible_in_portal?: boolean }) => {
              const isPast = m.date_time && new Date(m.date_time) < now;
              const isInternal = m.client_id && m.visible_in_portal === false;
              const fallbackStatus = isPast ? 'realizada' : 'por_confirmar';
              const statusInfo = getMeetingStatusInfo(m.status || fallbackStatus);
              return (
                <div
                  key={m.id}
                  className="px-4 py-2.5 text-sm grid grid-cols-[100px_1fr_auto] gap-3 items-center cursor-pointer hover:bg-muted/40"
                  onClick={() => navigate(`/hub/reunioes/${m.id}`)}
                >
                  <span
                    className="inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[10px] font-medium"
                    style={{ backgroundColor: `${statusInfo.dotColor}20`, color: statusInfo.dotColor }}
                  >
                    {statusInfo.label}
                  </span>
                  <div className="min-w-0">
                    <p className="font-medium truncate flex items-center gap-2">
                      {m.title}
                      {isInternal && (
                        <span className="text-[10px] font-normal text-muted-foreground bg-muted px-1.5 py-0.5 rounded" title="Não visível para o cliente">
                          🔒 Interna
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {m.date_time ? format(new Date(m.date_time), "d MMM yyyy 'às' HH:mm", { locale: pt }) : '—'}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
                </div>
              );
            })}
          </div>
        )}
      </EntitySection>
    </>
  );
}