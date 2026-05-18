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
import { CalendarDays, Check, ChevronRight, Eye, EyeOff, Layers, Plus, Repeat, Users as UsersIcon, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';
import {
  getPhaseStatusInfo,
  isDeliverableDone,
  isPhaseDone,
} from '@/lib/projectProgress';
import { ProjectPhasesTimeline } from '@/components/project/ProjectPhasesTimeline';
import { useTeamPhotos } from '@/hooks/useTeamPhotos';
import { getInitials } from '@/pages/Projetos';

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
}

interface MonthTask {
  id: string;
  status: string | null;
  deadline: string | null;
}

export function ProjectPhasesGallery({ projectId, projectStartDate }: Props) {
  const [openPhaseId, setOpenPhaseId] = useState<string | null>(null);
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
        .select('id, name, scheduled_date, scheduled_time, item_type, status, visible_in_portal')
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
        .select('id, status, deadline')
        .eq('project_id', projectId)
        .not('deadline', 'is', null);
      return (data || []) as MonthTask[];
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['project-recurring-occurrences', projectId] }),
    onError: (e: Error) => toast.error('Erro ao atualizar', { description: e.message }),
  });

  const deleteOccurrence = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('project_recurring_occurrences')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['project-recurring-occurrences', projectId] }),
    onError: (e: Error) => toast.error('Erro ao eliminar', { description: e.message }),
  });

  // Split phases: cycle (mini-fases mensais) vs one-shot
  const cyclePhases = useMemo(
    () => phases.filter(p => p.cycle_month_index != null),
    [phases]
  );
  const oneShotPhases = useMemo(
    () => phases.filter(p => p.cycle_month_index == null),
    [phases]
  );

  // Unified monthly buckets: each month aggregates mini-fases + cadências
  const monthlyBuckets = useMemo(() => {
    const map = new Map<string, { miniPhases: Phase[]; occurrences: RecurringOccurrence[]; tasks: MonthTask[] }>();
    const ensure = (k: string) => {
      if (!map.has(k)) map.set(k, { miniPhases: [], occurrences: [], tasks: [] });
      return map.get(k)!;
    };
    for (const p of cyclePhases) {
      const key = (p.planned_start || '').slice(0, 7);
      if (!key) continue;
      ensure(key).miniPhases.push(p);
    }
    for (const o of occurrences) {
      const key = o.scheduled_date.slice(0, 7);
      ensure(key).occurrences.push(o);
    }
    for (const t of monthTasks) {
      const key = (t.deadline || '').slice(0, 7);
      if (!key) continue;
      // Only add tasks to months that already have cadências/mini-fases,
      // so we don't invent buckets for purely one-shot work.
      if (!map.has(key)) continue;
      ensure(key).tasks.push(t);
    }
    for (const v of map.values()) {
      v.miniPhases.sort((a, b) => (a.planned_start || '').localeCompare(b.planned_start || ''));
      v.occurrences.sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date));
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [cyclePhases, occurrences, monthTasks]);

  const [openMonthKey, setOpenMonthKey] = useState<string | null>(null);

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
  const totalCards = oneShotPhases.length + monthlyBuckets.length;

  return (
    <>
      {/* Toolbar: Nova fase */}
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs text-muted-foreground">
          {totalCards > 0
            ? `${oneShotPhases.length} ${oneShotPhases.length === 1 ? 'fase' : 'fases'}${monthlyBuckets.length > 0 ? ` · ${monthlyBuckets.length} ${monthlyBuckets.length === 1 ? 'mês' : 'meses'}` : ''}`
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
        {monthlyBuckets.map(([monthKey, bucket]) => {
          const { miniPhases, occurrences: items, tasks: bTasks } = bucket;
          const occTotal = items.length;
          const occDone = items.filter(o => o.status === 'concluida').length;
          const occCancelled = items.filter(o => o.status === 'cancelada').length;
          const phaseTotal = miniPhases.length;
          const phaseDoneCount = miniPhases.filter(isPhaseDone).length;
          const taskTotal = bTasks.length;
          const taskDone = bTasks.filter(t => (t.status || '') === 'done').length;
          const total = occTotal + phaseTotal + taskTotal;
          const done = occDone + phaseDoneCount + taskDone;
          const pct = total > 0 ? Math.round((done / total) * 100) : 0;
          const monthDate = parseISO(monthKey + '-01');
          const now = new Date();
          const isCurrentMonth = monthDate.getFullYear() === now.getFullYear() && monthDate.getMonth() === now.getMonth();
          const isPast = monthDate < new Date(now.getFullYear(), now.getMonth(), 1);
          const allDone = total > 0 && (done + occCancelled) === total;

          return (
            <button
              key={`month-${monthKey}`}
              type="button"
              onClick={() => setOpenMonthKey(monthKey)}
              className={cn(
                'group relative flex flex-col gap-3 rounded-xl border p-4 text-left transition-all duration-200 hover:-translate-y-0.5',
                allDone && 'border-success/30 bg-success/5 opacity-70 shadow-none hover:opacity-90 hover:border-success/50',
                isCurrentMonth && !allDone &&
                  'border-primary/60 bg-gradient-to-br from-primary/10 via-card to-card shadow-lg shadow-primary/15 ring-1 ring-primary/30 hover:shadow-xl hover:shadow-primary/25',
                !allDone && !isCurrentMonth &&
                  'border-border/60 bg-gradient-to-br from-card to-card/80 shadow-sm hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10'
              )}
            >
              {isCurrentMonth && !allDone && (
                <span className="absolute -top-1.5 -right-1.5 flex h-3 w-3">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60" />
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-primary" />
                </span>
              )}
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Repeat className="h-3 w-3 text-muted-foreground/70 shrink-0" />
                    <span className="text-[10px] font-mono uppercase tracking-wide text-muted-foreground/70">
                      Mês do contrato
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold leading-tight truncate mt-1 capitalize">
                    {format(monthDate, 'MMMM yyyy', { locale: pt })}
                  </h3>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground/40 transition-all group-hover:translate-x-0.5 group-hover:text-primary shrink-0" />
              </div>

              <Badge
                className={cn(
                  'border self-start text-[10px]',
                  allDone
                    ? 'bg-success/15 text-success border-success/30'
                    : isCurrentMonth
                    ? 'bg-primary/15 text-primary border-primary/30'
                    : isPast
                    ? 'bg-warning/15 text-warning border-warning/30'
                    : 'bg-muted text-muted-foreground border-border'
                )}
              >
                {allDone ? 'Concluído' : isCurrentMonth ? 'Em curso' : isPast ? 'Em atraso' : 'Pendente'}
              </Badge>

              <div>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
                  <span>
                    {phaseTotal > 0 && `${phaseDoneCount}/${phaseTotal} mini-fases`}
                    {phaseTotal > 0 && occTotal > 0 && ' · '}
                    {occTotal > 0 && `${occDone}/${occTotal} cadências`}
                    {(phaseTotal > 0 || occTotal > 0) && taskTotal > 0 && ' · '}
                    {taskTotal > 0 && `${taskDone}/${taskTotal} tarefas`}
                  </span>
                  <span className="font-semibold text-foreground">{pct}%</span>
                </div>
                <Progress value={pct} className="h-1.5" />
              </div>

              {miniPhases.length > 0 && (
                <div className="border-t border-border/50 pt-2 mt-1 space-y-1">
                  {miniPhases.map(mp => {
                    const done = isPhaseDone(mp);
                    const dStart = mp.planned_start ? parseISO(mp.planned_start).getDate() : null;
                    const dEnd = mp.planned_end ? parseISO(mp.planned_end).getDate() : null;
                    return (
                      <div key={mp.id} className="flex items-center gap-2 text-[11px]">
                        <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', done ? 'bg-success' : 'bg-primary/40')} />
                        <span className={cn('truncate', done ? 'line-through text-muted-foreground' : 'text-foreground font-medium')}>
                          {dStart != null && dEnd != null ? `${dStart}–${dEnd} · ` : ''}{mp.name}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {items.length > 0 && (
                <div className={cn('space-y-1', miniPhases.length === 0 && 'border-t border-border/50 pt-2 mt-1')}>
                  {items.slice(0, 3).map(o => (
                    <div key={o.id} className="flex items-center gap-2 text-[11px]">
                      <span
                        className={cn(
                          'h-1.5 w-1.5 rounded-full shrink-0',
                          o.status === 'concluida' ? 'bg-success' : o.status === 'cancelada' ? 'bg-destructive/40' : 'bg-muted-foreground/30'
                        )}
                      />
                      <span
                        className={cn(
                          'truncate',
                          o.status === 'concluida' ? 'line-through text-muted-foreground' : 'text-foreground'
                        )}
                      >
                        {format(parseISO(o.scheduled_date), 'd MMM', { locale: pt })} · {o.name}
                      </span>
                    </div>
                  ))}
                  {items.length > 3 && (
                    <div className="text-[10px] text-muted-foreground/70 pl-3.5">
                      +{items.length - 3} cadências…
                    </div>
                  )}
                </div>
              )}
            </button>
          );
        })}
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

      {/* Detail dialog for recurring monthly cycle */}
      <Dialog open={!!openMonthKey} onOpenChange={open => !open && setOpenMonthKey(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="capitalize">
              {openMonthKey
                ? format(parseISO(openMonthKey + '-01'), 'MMMM yyyy', { locale: pt })
                : 'Mês do contrato'}
            </DialogTitle>
          </DialogHeader>
          {openMonthKey && (() => {
            const bucket = monthlyBuckets.find(([k]) => k === openMonthKey)?.[1];
            const mini = bucket?.miniPhases || [];
            const occs = bucket?.occurrences || [];
            return (
            <div className="space-y-4 mt-2">
              {mini.length > 0 && (
                <div className="space-y-2">
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Mini-fases do mês</div>
                  {mini.map(mp => {
                    const dStart = mp.planned_start ? parseISO(mp.planned_start).getDate() : null;
                    const dEnd = mp.planned_end ? parseISO(mp.planned_end).getDate() : null;
                    const phaseDels = deliverables.filter(d => d.phase_id === mp.id);
                    const dDone = phaseDels.filter(isDeliverableDone).length;
                    const statusInfo = getPhaseStatusInfo(mp.status);
                    return (
                      <button
                        key={mp.id}
                        type="button"
                        onClick={() => { setOpenMonthKey(null); setOpenPhaseId(mp.id); }}
                        className="w-full text-left flex flex-col gap-1.5 px-3 py-2 rounded-md border border-border bg-card hover:border-primary/50 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-[11px] font-mono text-muted-foreground shrink-0">
                              {dStart != null && dEnd != null ? `${dStart}–${dEnd}` : '—'}
                            </span>
                            <span className="text-sm font-medium truncate">{mp.name}</span>
                          </div>
                          <Badge className={cn(statusInfo.color, 'border text-[10px] shrink-0')}>
                            {statusInfo.label}
                          </Badge>
                        </div>
                        {phaseDels.length > 0 && (
                          <div className="text-[11px] text-muted-foreground">
                            {dDone}/{phaseDels.length} entregas
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
              {occs.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Cadências do mês</div>
              {occs.map(o => (
                <div
                  key={o.id}
                  className={cn(
                    'flex flex-wrap items-center gap-2 px-3 py-2 rounded-md border bg-card text-sm',
                    o.status === 'cancelada' && 'opacity-50 line-through'
                  )}
                >
                  <span className="text-base shrink-0">
                    {o.item_type === 'reuniao' ? '📅' : o.item_type === 'tarefa' ? '📋' : '📦'}
                  </span>
                  <Input
                    type="date"
                    value={o.scheduled_date}
                    className="h-7 w-36 text-xs"
                    onChange={(e) => updateOccurrence.mutate({ id: o.id, patch: { scheduled_date: e.target.value } })}
                  />
                  <Input
                    className="h-7 text-sm flex-1 min-w-[160px]"
                    value={o.name}
                    onChange={(e) => updateOccurrence.mutate({ id: o.id, patch: { name: e.target.value } })}
                  />
                  {o.item_type === 'reuniao' && (
                    <Input
                      type="time"
                      value={o.scheduled_time || ''}
                      className="h-7 w-24 text-xs"
                      onChange={(e) => updateOccurrence.mutate({ id: o.id, patch: { scheduled_time: e.target.value || null } })}
                    />
                  )}
                  <Select
                    value={o.status}
                    onValueChange={(v) => updateOccurrence.mutate({ id: o.id, patch: { status: v as RecurringOccurrence['status'] } })}
                  >
                    <SelectTrigger className="h-7 w-32 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pendente">Pendente</SelectItem>
                      <SelectItem value="concluida">Concluída</SelectItem>
                      <SelectItem value="reagendada">Reagendada</SelectItem>
                      <SelectItem value="cancelada">Cancelada</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    title={o.visible_in_portal ? 'Visível no portal' : 'Oculto do cliente'}
                    onClick={() => updateOccurrence.mutate({ id: o.id, patch: { visible_in_portal: !o.visible_in_portal } })}
                  >
                    {o.visible_in_portal ? <Eye className="h-3.5 w-3.5 text-primary" /> : <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />}
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-destructive"
                    title="Eliminar ocorrência"
                    onClick={() => { if (confirm('Eliminar esta ocorrência?')) deleteOccurrence.mutate(o.id); }}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
                </div>
              )}
              {mini.length === 0 && occs.length === 0 && (
                <div className="text-sm text-muted-foreground text-center py-6">Sem mini-fases nem cadências neste mês.</div>
              )}
            </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </>
  );
}
