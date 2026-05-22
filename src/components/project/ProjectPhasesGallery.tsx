import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarDays, Check, ChevronDown, ChevronRight, Eye, EyeOff, Infinity as InfinityIcon, Layers, Plus, Users as UsersIcon, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { requireConfirm } from '@/lib/confirmDestructive';
import { format, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';
import {
  getPhaseStatusInfo,
  isDeliverableDone,
  isPhaseDone,
} from '@/lib/projectProgress';
import { isTaskDone, TASK_STATUSES, getTaskStatusInfo } from '@/lib/taskStatus';
import { ProjectPhasesTimeline } from '@/components/project/ProjectPhasesTimeline';
import { useTeamPhotos } from '@/hooks/useTeamPhotos';
import { getInitials } from '@/pages/Projetos';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { AddCadenceDialog } from '@/components/project/AddCadenceDialog';
import { OccurrenceRow } from '@/components/project/OccurrenceRow';

interface Props {
  projectId: string;
  projectStartDate?: string | null;
}

interface Phase {
  id: string;
  name: string;
  description: string | null;
  status: string;
  sort_order: number;
  planned_start: string | null;
  planned_end: string | null;
  completed_at: string | null;
  started_at: string | null;
  cycle_month_index?: number | null;
  source_phase_id?: string | null;
}

interface Deliverable {
  id: string;
  name: string;
  status: string;
  phase_id: string | null;
  assigned_to: string | null;
  planned_end: string | null;
}

interface RecurringOccurrence {
  id: string;
  name: string;
  scheduled_date: string;
  scheduled_time: string | null;
  item_type: 'reuniao' | 'tarefa' | 'entrega';
  status: 'pendente' | 'concluida' | 'cancelada' | 'reagendada';
  visible_in_portal?: boolean;
  linked_meeting_id?: string | null;
  linked_task_id?: string | null;
}

interface MonthTask {
  id: string;
  name?: string | null;
  status: string | null;
  deadline: string | null;
  assigned_to?: string | null;
  deliverable_id?: string | null;
}

interface ProjectMeeting {
  id: string;
  title: string | null;
  date_time: string | null;
  status: string | null;
}

export function ProjectPhasesGallery({ projectId, projectStartDate }: Props) {
  const [openPhaseId, setOpenPhaseId] = useState<string | null>(null);
  const [continuousOpen, setContinuousOpen] = useState(false);
  const [addingPhase, setAddingPhase] = useState(false);
  const [newName, setNewName] = useState('');
  const queryClient = useQueryClient();
  const { getPhotoUrl } = useTeamPhotos();

  const { data: phases = [], isLoading: phasesLoading } = useQuery({
    queryKey: ['project-phases', projectId],
    queryFn: async () => {
      const { data } = await supabase
        .from('project_phases')
        .select('*')
        .eq('project_id', projectId)
        .order('sort_order', { ascending: true });
      return (data || []) as Phase[];
    },
  });

  const { data: deliverables = [] } = useQuery({
    queryKey: ['project-deliverables', projectId],
    queryFn: async () => {
      const { data } = await supabase
        .from('project_deliverables')
        .select('id, name, status, phase_id, assigned_to, planned_end')
        .eq('project_id', projectId)
        .order('sort_order', { ascending: true });
      return (data || []) as Deliverable[];
    },
  });

  const { data: occurrences = [] } = useQuery({
    queryKey: ['project-recurring-occurrences', projectId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('project_recurring_occurrences')
        .select('id, name, scheduled_date, scheduled_time, item_type, status, visible_in_portal, linked_meeting_id, linked_task_id')
        .eq('project_id', projectId)
        .order('scheduled_date');
      return (data || []) as RecurringOccurrence[];
    },
  });

  // Tasks with deadline → used to enrich monthly buckets so the % matches
  // the "tarefas do mês" indicator shown at the top of the project page.
  const { data: monthTasks = [] } = useQuery({
    queryKey: ['project-month-tasks', projectId],
    queryFn: async () => {
      const { data } = await supabase
        .from('tasks')
        .select('id, name, status, deadline, assigned_to, deliverable_id')
        .eq('project_id', projectId)
        .not('deadline', 'is', null);
      return (data || []) as MonthTask[];
    },
  });

  // Meetings of the project: used to link cadências do tipo 'reuniao'
  const { data: projectMeetings = [] } = useQuery({
    queryKey: ['project-meetings-for-occurrences', projectId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('meetings')
        .select('id, title, date_time, status')
        .eq('project_id', projectId)
        .order('date_time', { ascending: false });
      return (data || []) as ProjectMeeting[];
    },
  });

  const updateOccurrence = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<RecurringOccurrence> }) => {
      const { error } = await (supabase as any)
        .from('project_recurring_occurrences')
        .update(patch)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-recurring-occurrences', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project-monthly-occurrences', projectId] });
    },
    onError: (e: Error) => toast.error('Erro ao atualizar', { description: e.message }),
  });

  const deleteOccurrence = useMutation({
    mutationFn: async (id: string) => {
      await requireConfirm({
        title: 'Eliminar ocorrência?',
        description: 'Esta ocorrência mensal será removida. Esta ação não pode ser desfeita.',
      });
      const { error } = await (supabase as any)
        .from('project_recurring_occurrences')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-recurring-occurrences', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project-monthly-occurrences', projectId] });
    },
    onError: (e: Error) => toast.error('Erro ao eliminar', { description: e.message }),
  });

  const updateTaskStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await (supabase as any)
        .from('tasks')
        .update({ status, completed_at: status === 'done' ? new Date().toISOString() : null })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-month-tasks', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project-tasks', projectId] });
    },
    onError: (e: Error) => toast.error('Erro ao atualizar tarefa', { description: e.message }),
  });

  // One-shot phases = todas as fases normais (Onboarding, Alinhamento, Offboarding…).
  // Já não temos fases-mês — o trabalho recorrente vive numa única fase virtual "Trabalho Contínuo".
  const oneShotPhases = useMemo(
    () => phases.filter(p => p.cycle_month_index == null),
    [phases]
  );

  // Agenda contínua: todas as ocorrências + tarefas standalone agrupadas por mês.
  // Usada tanto para o card global como para o detalhe expandido por mês.
  const continuousByMonth = useMemo(() => {
    const linkedTaskIds = new Set(occurrences.map(o => o.linked_task_id).filter(Boolean) as string[]);
    // Excluímos tarefas ligadas a entregas (Onboarding, Alinhamento, Offboarding…),
    // pois essas já aparecem na fase correspondente — não pertencem ao trabalho contínuo.
    const standaloneTasks = monthTasks.filter(
      t => !linkedTaskIds.has(t.id) && !t.deliverable_id,
    );
    const map = new Map<string, { occurrences: RecurringOccurrence[]; tasks: MonthTask[] }>();
    const ensure = (k: string) => {
      if (!map.has(k)) map.set(k, { occurrences: [], tasks: [] });
      return map.get(k)!;
    };
    for (const o of occurrences) {
      const key = o.scheduled_date.slice(0, 7);
      if (!key) continue;
      ensure(key).occurrences.push(o);
    }
    for (const t of standaloneTasks) {
      const key = (t.deadline || '').slice(0, 7);
      if (!key) continue;
      // Só agregamos tarefas em meses que já tenham cadências planeadas,
      // para não inventar meses com tarefas one-shot.
      if (!map.has(key)) continue;
      ensure(key).tasks.push(t);
    }
    for (const v of map.values()) {
      v.occurrences.sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date));
      v.tasks.sort((a, b) => (a.deadline || '').localeCompare(b.deadline || ''));
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [occurrences, monthTasks]);

  const continuousTotals = useMemo(() => {
    let total = 0;
    let done = 0;
    for (const [, bucket] of continuousByMonth) {
      total += bucket.occurrences.length + bucket.tasks.length;
      done += bucket.occurrences.filter(o => o.status === 'concluida').length;
      done += bucket.tasks.filter(t => isTaskDone({ status: t.status } as any)).length;
    }
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    return { total, done, pct };
  }, [continuousByMonth]);

  const hasContinuous = continuousByMonth.length > 0;

  // Profiles for responsibles
  const assigneeIds = useMemo(
    () => Array.from(new Set(deliverables.map(d => d.assigned_to).filter(Boolean) as string[])),
    [deliverables]
  );
  const { data: profiles = [] } = useQuery({
    queryKey: ['phase-gallery-profiles', assigneeIds.sort().join(',')],
    enabled: assigneeIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', assigneeIds);
      return (data || []) as { id: string; full_name: string | null; avatar_url: string | null }[];
    },
  });
  const profileMap = useMemo(() => new Map(profiles.map(p => [p.id, p])), [profiles]);

  const addPhase = useMutation({
    mutationFn: async (name: string) => {
      const nextOrder = phases.length;
      const { error } = await supabase.from('project_phases').insert({
        project_id: projectId,
        name,
        sort_order: nextOrder,
        status: 'pendente',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-phases', projectId] });
      setAddingPhase(false);
      setNewName('');
      toast.success('Fase adicionada');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (phasesLoading) {
    return <div className="text-sm text-muted-foreground">A carregar fases…</div>;
  }

  const offboardingPhases = oneShotPhases.filter(p => /offboarding/i.test(p.name || ''));
  const nonOffboardingPhases = oneShotPhases.filter(p => !/offboarding/i.test(p.name || ''));
  const totalCards = oneShotPhases.length + (hasContinuous ? 1 : 0);
  const meetingOptions = projectMeetings.map(m => ({
    value: m.id,
    label: m.title || 'Sem título',
    date: m.date_time ? format(parseISO(m.date_time), "d MMM · HH:mm", { locale: pt }) : '',
  }));
  const nowKey = new Date().toISOString().slice(0, 7);

  return (
    <>
      {/* Toolbar: Nova fase */}
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs text-muted-foreground">
          {totalCards > 0
            ? `${oneShotPhases.length} ${oneShotPhases.length === 1 ? 'fase' : 'fases'}${hasContinuous ? ` · trabalho contínuo (${continuousTotals.done}/${continuousTotals.total})` : ''}`
            : ''}
        </div>
        {addingPhase ? (
          <div className="flex items-center gap-2">
            <Input
              autoFocus
              placeholder="Nome da fase"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              className="h-8 text-xs w-56"
              onKeyDown={e => e.key === 'Enter' && newName.trim() && addPhase.mutate(newName.trim())}
            />
            <Button size="sm" className="h-8" onClick={() => newName.trim() && addPhase.mutate(newName.trim())} disabled={!newName.trim() || addPhase.isPending}>
              <Check className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" variant="ghost" className="h-8" onClick={() => { setAddingPhase(false); setNewName(''); }}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <Button size="sm" onClick={() => setAddingPhase(true)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Nova fase
          </Button>
        )}
      </div>

      {totalCards === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center border-2 border-dashed rounded-xl">
          <Layers className="h-9 w-9 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">
            Ainda não há fases definidas para este projeto.
          </p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            Usa o botão "Nova fase" acima para começar.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {nonOffboardingPhases.map(phase => {
          const phaseDeliverables = deliverables.filter(d => d.phase_id === phase.id);
          const total = phaseDeliverables.length;
          const done = phaseDeliverables.filter(isDeliverableDone).length;
          const pct = total > 0 ? Math.round((done / total) * 100) : (isPhaseDone(phase) ? 100 : 0);
          const statusInfo = getPhaseStatusInfo(phase.status);
          const responsibles = Array.from(
            new Set(phaseDeliverables.map(d => d.assigned_to).filter(Boolean) as string[])
          );
          const phaseDone = isPhaseDone(phase);
          // Apenas a fase com status efetivo "em curso" (definido manualmente ou pelo trigger)
          // ganha o destaque animado. Ter algumas entregas feitas não chega.
          const inProgress = !phaseDone && (phase.status === 'em_curso' || phase.status === 'em_progresso');

          return (
            <button
              key={phase.id}
              type="button"
              onClick={() => setOpenPhaseId(phase.id)}
              className={cn(
                'group relative flex flex-col gap-3 rounded-xl border p-4 text-left transition-all duration-200 hover:-translate-y-0.5',
                phaseDone &&
                  'border-success/30 bg-success/5 opacity-70 shadow-none hover:opacity-90 hover:border-success/50',
                inProgress &&
                  'border-primary/60 bg-gradient-to-br from-primary/10 via-card to-card shadow-lg shadow-primary/15 ring-1 ring-primary/30 hover:shadow-xl hover:shadow-primary/25',
                !phaseDone && !inProgress &&
                  'border-border/60 bg-gradient-to-br from-card to-card/80 shadow-sm hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10'
              )}
            >
              {inProgress && (
                <span className="absolute -top-1.5 -right-1.5 flex h-3 w-3">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60" />
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-primary" />
                </span>
              )}
              {/* Header: name + status */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-muted-foreground/70">
                      #{phase.sort_order + 1}
                    </span>
                    <h3 className="text-sm font-semibold leading-tight truncate">
                      {phase.name}
                    </h3>
                  </div>
                  {phase.description && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {phase.description}
                    </p>
                  )}
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground/40 transition-all group-hover:translate-x-0.5 group-hover:text-primary shrink-0" />
              </div>

              {/* Status badge */}
              <Badge className={cn(statusInfo.color, 'border self-start text-[10px]')}>
                {statusInfo.label}
              </Badge>

              {/* Progress */}
              <div>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
                  <span>{done}/{total} entregas</span>
                  <span className="font-semibold text-foreground">{pct}%</span>
                </div>
                <Progress value={pct} className="h-1.5" />
              </div>

              {/* Dates */}
              {(phase.planned_start || phase.planned_end) && (
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <CalendarDays className="h-3 w-3 shrink-0" />
                  <span className="truncate">
                    {phase.planned_start ? format(parseISO(phase.planned_start), 'd MMM', { locale: pt }) : '—'}
                    {' → '}
                    {phase.planned_end ? format(parseISO(phase.planned_end), 'd MMM', { locale: pt }) : '—'}
                  </span>
                </div>
              )}

              {/* Responsibles */}
              {responsibles.length > 0 && (
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <UsersIcon className="h-3 w-3 shrink-0" />
                  <div className="flex -space-x-1">
                    {responsibles.slice(0, 4).map(pid => {
                      const p = profileMap.get(pid);
                      if (!p) return null;
                      return (
                        <Avatar key={pid} className="h-5 w-5 border border-background">
                          <AvatarImage src={getPhotoUrl(p as any)} />
                          <AvatarFallback className="text-[8px]">
                            {getInitials(p.full_name)}
                          </AvatarFallback>
                        </Avatar>
                      );
                    })}
                    {responsibles.length > 4 && (
                      <span className="ml-2 text-[10px]">+{responsibles.length - 4}</span>
                    )}
                  </div>
                </div>
              )}

              {/* Deliverables preview */}
              {phaseDeliverables.length > 0 && (
                <div className="border-t border-border/50 pt-2 mt-1 space-y-1">
                  {phaseDeliverables.slice(0, 3).map(d => (
                    <div key={d.id} className="flex items-center gap-2 text-[11px]">
                      <span
                        className={cn(
                          'h-1.5 w-1.5 rounded-full shrink-0',
                          isDeliverableDone(d) ? 'bg-success' : 'bg-muted-foreground/30'
                        )}
                      />
                      <span
                        className={cn(
                          'truncate',
                          isDeliverableDone(d) ? 'line-through text-muted-foreground' : 'text-foreground'
                        )}
                      >
                        {d.name}
                      </span>
                    </div>
                  ))}
                  {phaseDeliverables.length > 3 && (
                    <div className="text-[10px] text-muted-foreground/70 pl-3.5">
                      +{phaseDeliverables.length - 3} entregas…
                    </div>
                  )}
                </div>
              )}
            </button>
          );
        })}
        {hasContinuous && (
          <button
            type="button"
            onClick={() => setContinuousOpen(true)}
            className={cn(
              'group relative flex flex-col gap-3 rounded-xl border p-4 text-left transition-all duration-200 hover:-translate-y-0.5',
              continuousTotals.total > 0 && continuousTotals.done === continuousTotals.total
                ? 'border-success/30 bg-success/5 opacity-70 shadow-none hover:opacity-90 hover:border-success/50'
                : 'border-border/60 bg-gradient-to-br from-card to-card/80 shadow-sm hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10'
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <InfinityIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <h3 className="text-sm font-semibold leading-tight truncate">
                    Trabalho Contínuo
                  </h3>
                </div>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  Cadências e tarefas regulares ao longo do contrato
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground/40 transition-all group-hover:translate-x-0.5 group-hover:text-primary shrink-0" />
            </div>

            <Badge className="bg-muted text-muted-foreground border self-start text-[10px]">
              {continuousByMonth.length} {continuousByMonth.length === 1 ? 'mês' : 'meses'}
            </Badge>

            <div>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
                <span>{continuousTotals.done}/{continuousTotals.total} itens</span>
                <span className="font-semibold text-foreground">{continuousTotals.pct}%</span>
              </div>
              <Progress value={continuousTotals.pct} className="h-1.5" />
            </div>

            {(() => {
              const currentBucket = continuousByMonth.find(([k]) => k === nowKey)?.[1];
              if (!currentBucket) return null;
              const items: { id: string; name: string; done: boolean }[] = [
                ...currentBucket.occurrences.map(o => ({ id: `o-${o.id}`, name: o.name, done: o.status === 'concluida' })),
                ...currentBucket.tasks.map(t => ({ id: `t-${t.id}`, name: t.name || 'Tarefa', done: isTaskDone({ status: t.status } as any) })),
              ];
              if (items.length === 0) return null;
              return (
                <div className="border-t border-border/50 pt-2 mt-1 space-y-1">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mb-1">
                    Este mês
                  </div>
                  {items.slice(0, 3).map(it => (
                    <div key={it.id} className="flex items-center gap-2 text-[11px]">
                      <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', it.done ? 'bg-success' : 'bg-muted-foreground/30')} />
                      <span className={cn('truncate', it.done ? 'line-through text-muted-foreground' : 'text-foreground')}>
                        {it.name}
                      </span>
                    </div>
                  ))}
                  {items.length > 3 && (
                    <div className="text-[10px] text-muted-foreground/70 pl-3.5">
                      +{items.length - 3} itens…
                    </div>
                  )}
                </div>
              );
            })()}
          </button>
        )}
        {offboardingPhases.map(phase => {
          const phaseDeliverables = deliverables.filter(d => d.phase_id === phase.id);
          const total = phaseDeliverables.length;
          const done = phaseDeliverables.filter(isDeliverableDone).length;
          const pct = total > 0 ? Math.round((done / total) * 100) : (isPhaseDone(phase) ? 100 : 0);
          const statusInfo = getPhaseStatusInfo(phase.status);
          const responsibles = Array.from(
            new Set(phaseDeliverables.map(d => d.assigned_to).filter(Boolean) as string[])
          );
          const phaseDone = isPhaseDone(phase);
          const inProgress = !phaseDone && (phase.status === 'em_curso' || phase.status === 'em_progresso');

          return (
            <button
              key={phase.id}
              type="button"
              onClick={() => setOpenPhaseId(phase.id)}
              className={cn(
                'group relative flex flex-col gap-3 rounded-xl border p-4 text-left transition-all duration-200 hover:-translate-y-0.5',
                phaseDone &&
                  'border-success/30 bg-success/5 opacity-70 shadow-none hover:opacity-90 hover:border-success/50',
                inProgress &&
                  'border-primary/60 bg-gradient-to-br from-primary/10 via-card to-card shadow-lg shadow-primary/15 ring-1 ring-primary/30 hover:shadow-xl hover:shadow-primary/25',
                !phaseDone && !inProgress &&
                  'border-border/60 bg-gradient-to-br from-card to-card/80 shadow-sm hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10'
              )}
            >
              {inProgress && (
                <span className="absolute -top-1.5 -right-1.5 flex h-3 w-3">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60" />
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-primary" />
                </span>
              )}
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono uppercase tracking-wide text-muted-foreground/70">
                      Fim
                    </span>
                    <h3 className="text-sm font-semibold leading-tight truncate">
                      {phase.name}
                    </h3>
                  </div>
                  {phase.description && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {phase.description}
                    </p>
                  )}
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground/40 transition-all group-hover:translate-x-0.5 group-hover:text-primary shrink-0" />
              </div>
              <Badge className={cn(statusInfo.color, 'border self-start text-[10px]')}>
                {statusInfo.label}
              </Badge>
              <div>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
                  <span>{done}/{total} entregas</span>
                  <span className="font-semibold text-foreground">{pct}%</span>
                </div>
                <Progress value={pct} className="h-1.5" />
              </div>
              {(phase.planned_start || phase.planned_end) && (
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <CalendarDays className="h-3 w-3 shrink-0" />
                  <span className="truncate">
                    {phase.planned_start ? format(parseISO(phase.planned_start), 'd MMM', { locale: pt }) : '—'}
                    {' → '}
                    {phase.planned_end ? format(parseISO(phase.planned_end), 'd MMM', { locale: pt }) : '—'}
                  </span>
                </div>
              )}
              {responsibles.length > 0 && (
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <UsersIcon className="h-3 w-3 shrink-0" />
                  <div className="flex -space-x-1">
                    {responsibles.slice(0, 4).map(pid => {
                      const p = profileMap.get(pid);
                      if (!p) return null;
                      return (
                        <Avatar key={pid} className="h-5 w-5 border border-background">
                          <AvatarImage src={getPhotoUrl(p as any)} />
                          <AvatarFallback className="text-[8px]">
                            {getInitials(p.full_name)}
                          </AvatarFallback>
                        </Avatar>
                      );
                    })}
                    {responsibles.length > 4 && (
                      <span className="ml-2 text-[10px]">+{responsibles.length - 4}</span>
                    )}
                  </div>
                </div>
              )}
              {phaseDeliverables.length > 0 && (
                <div className="border-t border-border/50 pt-2 mt-1 space-y-1">
                  {phaseDeliverables.slice(0, 3).map(d => (
                    <div key={d.id} className="flex items-center gap-2 text-[11px]">
                      <span
                        className={cn(
                          'h-1.5 w-1.5 rounded-full shrink-0',
                          isDeliverableDone(d) ? 'bg-success' : 'bg-muted-foreground/30'
                        )}
                      />
                      <span
                        className={cn(
                          'truncate',
                          isDeliverableDone(d) ? 'line-through text-muted-foreground' : 'text-foreground'
                        )}
                      >
                        {d.name}
                      </span>
                    </div>
                  ))}
                  {phaseDeliverables.length > 3 && (
                    <div className="text-[10px] text-muted-foreground/70 pl-3.5">
                      +{phaseDeliverables.length - 3} entregas…
                    </div>
                  )}
                </div>
              )}
            </button>
          );
        })}
        </div>
      )}

      {/* Detail dialog — reuses the full timeline component */}
      <Dialog open={!!openPhaseId} onOpenChange={open => !open && setOpenPhaseId(null)}>
        <DialogContent className="max-w-[95vw] w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader className="sr-only">
            <DialogTitle>Detalhe da fase</DialogTitle>
          </DialogHeader>
          <div>
            <ProjectPhasesTimeline
              projectId={projectId}
              projectStartDate={projectStartDate}
              focusPhaseId={openPhaseId}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: Trabalho Contínuo agrupado por mês */}
      <Dialog open={continuousOpen} onOpenChange={setContinuousOpen}>
        <DialogContent className="max-w-[95vw] w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <InfinityIcon className="h-4 w-4 text-muted-foreground shrink-0" />
              Trabalho Contínuo
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4 text-[11px] text-muted-foreground">
            <span className="hidden sm:inline">Cadências e tarefas regulares ao longo do contrato</span>
            <div className="flex items-center gap-3">
              <span><strong className="text-foreground">{continuousTotals.done}/{continuousTotals.total}</strong> itens</span>
              <span>·</span>
              <span><strong className="text-foreground">{continuousTotals.pct}%</strong></span>
              <div className="w-32"><Progress value={continuousTotals.pct} className="h-1.5" /></div>
              <AddCadenceDialog projectId={projectId} />
            </div>
          </div>
          <div className="space-y-2">
                {continuousByMonth.map(([monthKey, bucket]) => {
                  const monthDate = parseISO(monthKey + '-01');
                  const isCurrent = monthKey === nowKey;
                  const isPast = monthKey < nowKey;
                  const occs = bucket.occurrences;
                  const tks = bucket.tasks;
                  const totalM = occs.length + tks.length;
                  const doneM =
                    occs.filter(o => o.status === 'concluida').length +
                    tks.filter(t => isTaskDone({ status: t.status } as any)).length;
                  const allDoneM = totalM > 0 && doneM === totalM;
                  type AgendaItem =
                    | { kind: 'occ'; date: string; occ: RecurringOccurrence }
                    | { kind: 'task'; date: string; task: MonthTask };
                  const agenda: AgendaItem[] = [
                    ...occs.map(o => ({ kind: 'occ' as const, date: o.scheduled_date, occ: o })),
                    ...tks.map(t => ({ kind: 'task' as const, date: t.deadline || '', task: t })),
                  ].sort((a, b) => a.date.localeCompare(b.date));
                  return (
                    <Collapsible key={monthKey} defaultOpen={isCurrent}>
                      <CollapsibleTrigger className="w-full group flex items-center justify-between gap-3 px-3 py-2 rounded-md border border-border/60 bg-card hover:bg-card/80 transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=closed]:-rotate-90 shrink-0" />
                          <h4 className="text-sm font-medium capitalize">
                            {format(monthDate, 'MMMM yyyy', { locale: pt })}
                          </h4>
                          <Badge
                            className={cn(
                              'border text-[10px]',
                              allDoneM
                                ? 'bg-success/15 text-success border-success/30'
                                : isCurrent
                                ? 'bg-primary/15 text-primary border-primary/30'
                                : isPast
                                ? 'bg-warning/15 text-warning border-warning/30'
                                : 'bg-muted text-muted-foreground border-border',
                            )}
                          >
                            {allDoneM ? 'Concluído' : isCurrent ? 'Em curso' : isPast ? 'Em atraso' : 'Pendente'}
                          </Badge>
                        </div>
                        <span className="text-[11px] text-muted-foreground font-mono shrink-0">
                          {doneM}/{totalM}
                        </span>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="space-y-2 pt-2 pb-1 px-1">
                        {agenda.length === 0 && (
                          <div className="text-xs text-muted-foreground text-center py-3">
                            Sem itens neste mês.
                          </div>
                        )}
                        {agenda.map(item => {
                          if (item.kind === 'task') {
                            const t = item.task;
                            const tDone = isTaskDone({ status: t.status } as any);
                            const due = t.deadline ? parseISO(t.deadline) : null;
                            const statusInfo = getTaskStatusInfo(t.status);
                            return (
                              <div
                                key={`t-${t.id}`}
                                className={cn(
                                  'group flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2 transition-colors hover:border-primary/40',
                                  tDone && 'opacity-70',
                                )}
                              >
                                <div className="flex items-center gap-2 shrink-0 px-2 py-1 rounded bg-muted/40 text-xs font-mono">
                                  <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                                  {due && <span className="capitalize">{format(due, 'EEE', { locale: pt })}</span>}
                                  {due && <span>{format(due, "d 'de' MMM", { locale: pt })}</span>}
                                </div>
                                <a
                                  href={`/hub/tarefas?id=${t.id}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-sm flex-1 truncate hover:underline"
                                  title="Abrir tarefa"
                                >
                                  {t.name || 'Tarefa'}
                                </a>
                                <span className="text-[10px] uppercase tracking-wider text-muted-foreground shrink-0 hidden sm:inline">
                                  Tarefa
                                </span>
                                <Select
                                  value={t.status || 'por_comecar'}
                                  onValueChange={(v) => updateTaskStatus.mutate({ id: t.id, status: v })}
                                >
                                  <SelectTrigger
                                    className={cn(
                                      'h-6 px-2 py-0 rounded-full border text-[10px] font-medium shrink-0 w-auto gap-1 [&>svg]:h-3 [&>svg]:w-3',
                                      statusInfo.color,
                                    )}
                                  >
                                    <SelectValue>{statusInfo.label}</SelectValue>
                                  </SelectTrigger>
                                  <SelectContent>
                                    {TASK_STATUSES.map(s => (
                                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                {/* spacer to match OccurrenceRow's portal-eye icon slot */}
                                <span className="h-3.5 w-3.5 shrink-0" aria-hidden />
                                {/* spacer to match OccurrenceRow's pencil button slot */}
                                <span className="h-7 w-7 shrink-0" aria-hidden />
                              </div>
                            );
                          }
                          const o = item.occ;
                          return (
                            <OccurrenceRow
                              key={`o-${o.id}`}
                              occurrence={o}
                              meetingOptions={meetingOptions}
                              onUpdate={(patch) => updateOccurrence.mutate({ id: o.id, patch: patch as Partial<RecurringOccurrence> })}
                              onDelete={() => deleteOccurrence.mutate(o.id)}
                            />
                          );
                        })}
                      </CollapsibleContent>
                    </Collapsible>
                  );
                })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
