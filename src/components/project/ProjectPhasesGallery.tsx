import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CalendarDays, Check, ChevronRight, Layers, Plus, Users as UsersIcon, X } from 'lucide-react';
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
}

interface Deliverable {
  id: string;
  name: string;
  status: string;
  phase_id: string | null;
  assigned_to: string | null;
  planned_end: string | null;
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

  return (
    <>
      {/* Toolbar: Nova fase */}
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs text-muted-foreground">
          {phases.length > 0 ? `${phases.length} ${phases.length === 1 ? 'fase' : 'fases'}` : ''}
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

      {phases.length === 0 ? (
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
        {phases.map(phase => {
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
    </>
  );
}
