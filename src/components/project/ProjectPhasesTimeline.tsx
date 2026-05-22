import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { CheckCircle2, CheckSquare, Circle, Clock, Layers, Plus, Pencil, Trash2, ChevronUp, ChevronDown, X, Check, CalendarDays, AlertTriangle, RefreshCw, Wand2, Video, Flag } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { requireConfirm } from '@/lib/confirmDestructive';
import { format, differenceInCalendarDays, addDays as addCalendarDays, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';
import { addBusinessDays } from '@/lib/holidays';
import { TaskFormDialog } from '@/components/tasks/TaskFormDialog';
import { NewMeetingButton } from '@/components/meeting/NewMeetingButton';
import { useNavigate } from 'react-router-dom';
import { DeliverableFormatCell } from '@/components/project/DeliverableFormatCell';
import {
  isDeliverableDone,
  isPhaseDone,
  countDoneDeliverables,
  countDonePhases,
  projectProgress as computeProjectProgress,
  progressLabel as computeProgressLabel,
} from '@/lib/projectProgress';

interface ProjectPhase {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  linked_sop_id: string | null;
  duration_days: number | null;
  duration_unit: string;
  offset_days: number;
  offset_trigger: string;
  planned_start: string | null;
  planned_end: string | null;
}

interface ProjectDeliverable {
  id: string;
  name: string;
  description: string | null;
  status: string;
  sort_order: number;
  phase_id: string | null;
  portal_visible?: boolean;
  duration_days: number | null;
  duration_unit: string;
  offset_days: number;
  offset_trigger: string;
  planned_start: string | null;
  planned_end: string | null;
  is_meeting?: boolean;
  meeting_id?: string | null;
  deliverable_type?: string | null;
  responsible_type?: string | null;
  link_url?: string | null;
  document_url?: string | null;
  document_file_path?: string | null;
}

import {
  PHASE_STATUSES as CANON_PHASE_STATUSES,
  DELIVERABLE_STATUSES as CANON_DEL_STATUSES,
  getPhaseStatusInfo,
  getDeliverableStatusInfo,
} from '@/lib/projectProgress';

const PHASE_ICONS: Record<string, typeof Circle> = {
  pendente: Circle,
  em_curso: Clock,
  concluida: CheckCircle2,
};
const PHASE_ICON_COLORS: Record<string, string> = {
  pendente: 'text-muted-foreground',
  em_curso: 'text-info',
  concluida: 'text-success',
};

const PHASE_STATUS = CANON_PHASE_STATUSES.map(s => ({
  ...s,
  icon: PHASE_ICONS[s.value] || Circle,
  // Keep the legacy `color` (text-only) for icon coloring; badge color lives in `s.color`.
  iconColor: PHASE_ICON_COLORS[s.value] || 'text-muted-foreground',
}));

const DELIVERABLE_STATUS = CANON_DEL_STATUSES;

function getStatusInfo(status: string) {
  const base = getPhaseStatusInfo(status);
  return {
    ...base,
    icon: PHASE_ICONS[base.value] || Circle,
    color: PHASE_ICON_COLORS[base.value] || 'text-muted-foreground',
  };
}

interface Props {
  projectId: string;
  projectStartDate?: string | null;
  focusPhaseId?: string | null;
}

export function ProjectPhasesTimeline({ projectId, projectStartDate, focusPhaseId }: Props) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const phaseKey = ['project-phases', projectId];
  const delKey = ['project-deliverables', projectId];
  const navigate = useNavigate();

  // Project context (client_id, name) for pre-filling meeting dialog
  const { data: projectCtx } = useQuery({
    queryKey: ['project-meeting-ctx', projectId],
    queryFn: async () => {
      const { data } = await supabase
        .from('projects')
        .select('id, name, client_id, deadline, department, departments, clients ( id, full_name )')
        .eq('id', projectId)
        .maybeSingle();
      return data as any;
    },
  });

  // Team members of the project's department(s) + project members — used to
  // pre-select participants when creating a meeting from a deliverable.
  const { data: teamMembers = [] } = useQuery({
    queryKey: ['team-members-for-meeting-defaults'],
    queryFn: async () => {
      const { data } = await supabase
        .from('team_members')
        .select('profile_id, department, status')
        .eq('status', 'ativo');
      return (data || []) as { profile_id: string | null; department: string | null }[];
    },
  });
  const { data: projectMembers = [] } = useQuery({
    queryKey: ['project-members-list', projectId],
    queryFn: async () => {
      const { data } = await supabase
        .from('project_members')
        .select('profile_id')
        .eq('project_id', projectId);
      return (data || []) as { profile_id: string }[];
    },
  });

  const computeMeetingMembers = (d: any): string[] => {
    const ids = new Set<string>();
    if (d?.assigned_to) ids.add(d.assigned_to);
    projectMembers.forEach(pm => { if (pm.profile_id) ids.add(pm.profile_id); });
    const projectDepts = new Set<string>();
    if (projectCtx?.department) projectDepts.add(projectCtx.department);
    if (Array.isArray(projectCtx?.departments)) {
      projectCtx.departments.forEach((dep: any) => { if (typeof dep === 'string' && dep) projectDepts.add(dep); });
    }
    if (projectDepts.size > 0) {
      teamMembers.forEach(tm => {
        if (tm.profile_id && tm.department && projectDepts.has(tm.department)) ids.add(tm.profile_id);
      });
    }
    return Array.from(ids);
  };
  const projectDefaultDepartment = projectCtx?.department
    || (Array.isArray(projectCtx?.departments) && projectCtx.departments[0]) || undefined;

  const linkMeetingMutation = useMutation({
    mutationFn: async ({ deliverableId, meetingId }: { deliverableId: string; meetingId: string }) => {
      const { error } = await supabase
        .from('project_deliverables')
        .update({ meeting_id: meetingId })
        .eq('id', deliverableId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: delKey });
      toast.success('Reunião ligada à entrega');
    },
    onError: (e: any) => toast.error(e?.message || 'Falha ao ligar reunião'),
  });

  const [editingPhase, setEditingPhase] = useState<string | null>(null);
  const [editingDel, setEditingDel] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [addingPhase, setAddingPhase] = useState(false);
  const [addingDelPhase, setAddingDelPhase] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [taskDetailId, setTaskDetailId] = useState<string | null>(null);
  const [cascadePrompt, setCascadePrompt] = useState<{
    delayDays: number;
    phaseId: string;
    phaseIdx: number;
    type: 'phase_end' | 'del_end';
    delId?: string;
  } | null>(null);
  // Out-of-window conflict prompt (deliverable outside phase, or phase outside project)
  const [conflictPrompt, setConflictPrompt] = useState<{
    kind: 'del_outside_phase' | 'phase_outside_project';
    message: string;
    targetId: string; // phase id to extend (or project deadline target)
    field: 'planned_start' | 'planned_end';
    newValue: string; // YYYY-MM-DD
    originalValue: string | null;
    sourceTable: 'project_phases' | 'project_deliverables';
    sourceId: string;
    extendLabel: string;
    extendDate: string; // YYYY-MM-DD to set on target if user chooses extend
    canExtend: boolean; // false when target is the project deadline (not editable here)
  } | null>(null);
  const { data: phases = [] } = useQuery({
    queryKey: phaseKey,
    queryFn: async () => {
      const { data } = await supabase.from('project_phases').select('*').eq('project_id', projectId).order('sort_order');
      return (data || []) as ProjectPhase[];
    },
  });

  const { data: deliverables = [] } = useQuery({
    queryKey: delKey,
    queryFn: async () => {
      const { data } = await supabase.from('project_deliverables').select('*').eq('project_id', projectId).order('sort_order');
      return (data || []) as ProjectDeliverable[];
    },
  });

  // Tasks linked to deliverables (auto-generated by sync_deliverable_to_task trigger)
  // for opening the unified task detail modal when clicking a deliverable.
  const taskKey = ['project-deliverable-tasks', projectId];
  const { data: linkedTasks = [] } = useQuery({
    queryKey: taskKey,
    queryFn: async () => {
      const { data } = await supabase
        .from('tasks')
        .select('*')
        .eq('project_id', projectId)
        .not('deliverable_id', 'is', null);
      return (data || []) as any[];
    },
  });
  const taskByDeliverable = new Map<string, any>(linkedTasks.map((t: any) => [t.deliverable_id, t]));
  const editingTask = taskDetailId ? linkedTasks.find((t: any) => t.id === taskDetailId) : null;

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: phaseKey });
    qc.invalidateQueries({ queryKey: delKey });
    qc.invalidateQueries({ queryKey: ['project-tasks', projectId] });
    qc.invalidateQueries({ queryKey: ['linked-tasks', projectId] });
  };

  // --- Shared: recalculate a phase's deliverables, return last anchor date ---
  const recalcPhaseDeliverables = async (
    phaseDels: ProjectDeliverable[],
    phaseStart: Date,
  ): Promise<Date> => {
    let prevDelEnd: Date = phaseStart;
    for (let di = 0; di < phaseDels.length; di++) {
      const del = phaseDels[di];
      let delStart: Date;
      if (del.offset_trigger === 'entrega_anterior' && di > 0) {
        delStart = del.duration_unit === 'dias_uteis'
          ? addBusinessDays(prevDelEnd, del.offset_days || 0)
          : addCalendarDays(prevDelEnd, del.offset_days || 0);
      } else {
        delStart = del.duration_unit === 'dias_uteis'
          ? addBusinessDays(phaseStart, del.offset_days || 0)
          : addCalendarDays(phaseStart, del.offset_days || 0);
      }

      // Quando duration_days não está definido (ou é 0), tratar como entrega
      // pontual: planned_end = planned_start. Isto garante que a tarefa
      // associada nasce sempre com deadline (caso contrário ficava NULL).
      let delEnd: Date;
      if (del.duration_days != null && del.duration_days > 0) {
        delEnd = del.duration_unit === 'dias_uteis'
          ? addBusinessDays(delStart, del.duration_days)
          : addCalendarDays(delStart, del.duration_days);
      } else {
        delEnd = delStart;
      }

      await supabase.from('project_deliverables').update({
        planned_start: format(delStart, 'yyyy-MM-dd'),
        planned_end: format(delEnd, 'yyyy-MM-dd'),
      }).eq('id', del.id);

      prevDelEnd = delEnd;
    }
    return prevDelEnd;
  };

  // --- Shared: recalculate phases from a given index, chaining from prevEnd ---
  const recalcPhasesFrom = async (
    sortedPhases: ProjectPhase[],
    allDels: ProjectDeliverable[],
    fromIdx: number,
    startAnchor: Date,
    projectStart: Date,
  ) => {
    let prevPhaseEnd = startAnchor;
    for (let pi = fromIdx; pi < sortedPhases.length; pi++) {
      const phase = sortedPhases[pi];
      let phaseStart: Date;
      if (phase.offset_trigger === 'fase_anterior' && pi > 0) {
        phaseStart = phase.duration_unit === 'dias_uteis'
          ? addBusinessDays(prevPhaseEnd, phase.offset_days || 0)
          : addCalendarDays(prevPhaseEnd, phase.offset_days || 0);
      } else {
        phaseStart = phase.duration_unit === 'dias_uteis'
          ? addBusinessDays(projectStart, phase.offset_days || 0)
          : addCalendarDays(projectStart, phase.offset_days || 0);
      }

      const phaseDuration = phase.duration_days || 0;
      let phaseEnd = phaseDuration > 0
        ? (phase.duration_unit === 'dias_uteis'
          ? addBusinessDays(phaseStart, phaseDuration)
          : addCalendarDays(phaseStart, phaseDuration))
        : phaseStart;

      // Recalculate deliverables
      const phaseDels = allDels
        .filter(d => d.phase_id === phase.id)
        .sort((a, b) => a.sort_order - b.sort_order);

      const lastDelEnd = await recalcPhaseDeliverables(phaseDels, phaseStart);

      // Phase end = max of nominal end and last deliverable end
      if (lastDelEnd > phaseEnd) phaseEnd = lastDelEnd;

      await supabase.from('project_phases').update({
        planned_start: format(phaseStart, 'yyyy-MM-dd'),
        planned_end: format(phaseEnd, 'yyyy-MM-dd'),
      }).eq('id', phase.id);

      prevPhaseEnd = phaseEnd;
    }
  };

  // --- Recalculate all dates from project start ---
  const [recalculating, setRecalculating] = useState(false);
  const recalculateDates = async () => {
    if (!projectStartDate) {
      toast.error('Este projeto não tem data de início definida');
      return;
    }
    setRecalculating(true);
    try {
      const startDate = parseISO(projectStartDate);
      const { data: latestPhases } = await supabase.from('project_phases')
        .select('*').eq('project_id', projectId).order('sort_order');
      const { data: latestDels } = await supabase.from('project_deliverables')
        .select('*').eq('project_id', projectId).order('sort_order');

      if (!latestPhases || !latestDels) throw new Error('Sem dados');

      await recalcPhasesFrom(
        (latestPhases as ProjectPhase[]).sort((a, b) => a.sort_order - b.sort_order),
        latestDels as ProjectDeliverable[],
        0,
        startDate,
        startDate,
      );

      invalidateAll();
      toast.success('Datas recalculadas com sucesso');
    } catch (err) {
      toast.error('Erro ao recalcular datas');
      console.error(err);
    } finally {
      setRecalculating(false);
    }
  };

  const applyCascade = async (_delayDays: number, fromPhaseIdx: number) => {
    try {
      // Fetch latest data from DB
      const { data: latestPhases } = await supabase.from('project_phases')
        .select('*').eq('project_id', projectId).order('sort_order');
      const { data: latestDels } = await supabase.from('project_deliverables')
        .select('*').eq('project_id', projectId).order('sort_order');

      if (!latestPhases || !latestDels) return;

      const sortedPhases = (latestPhases as ProjectPhase[]).sort((a, b) => a.sort_order - b.sort_order);
      const currentPhase = sortedPhases[fromPhaseIdx];
      if (!currentPhase) return;

      const projectStart = projectStartDate ? parseISO(projectStartDate) : new Date();

      // If cascade from deliverable edit, first recalculate same-phase deliverables after the edited one
      if (cascadePrompt?.type === 'del_end' && cascadePrompt.delId) {
        const samePhaseDels = (latestDels as ProjectDeliverable[])
          .filter(d => d.phase_id === currentPhase.id)
          .sort((a, b) => a.sort_order - b.sort_order);
        const editedIdx = samePhaseDels.findIndex(d => d.id === cascadePrompt.delId);

        if (editedIdx >= 0) {
          const editedDel = samePhaseDels[editedIdx];
          let prevEnd = editedDel.planned_end ? parseISO(editedDel.planned_end) : parseISO(editedDel.planned_start || currentPhase.planned_start || projectStartDate || '');
          const phaseStartDate = currentPhase.planned_start ? parseISO(currentPhase.planned_start) : projectStart;

          for (let di = editedIdx + 1; di < samePhaseDels.length; di++) {
            const del = samePhaseDels[di];
            let delStart: Date;
            if (del.offset_trigger === 'entrega_anterior') {
              delStart = del.duration_unit === 'dias_uteis'
                ? addBusinessDays(prevEnd, del.offset_days || 0)
                : addCalendarDays(prevEnd, del.offset_days || 0);
            } else {
              delStart = del.duration_unit === 'dias_uteis'
                ? addBusinessDays(phaseStartDate, del.offset_days || 0)
                : addCalendarDays(phaseStartDate, del.offset_days || 0);
            }

            let delEnd: Date;
            if (del.duration_days != null && del.duration_days > 0) {
              delEnd = del.duration_unit === 'dias_uteis'
                ? addBusinessDays(delStart, del.duration_days)
                : addCalendarDays(delStart, del.duration_days);
            } else {
              delEnd = delStart;
            }

            await supabase.from('project_deliverables').update({
              planned_start: format(delStart, 'yyyy-MM-dd'),
              planned_end: format(delEnd, 'yyyy-MM-dd'),
            }).eq('id', del.id);

            prevEnd = delEnd;
          }
        }

        // Update current phase end = max of nominal end and all deliverable ends
        const allCurrentDels = (latestDels as ProjectDeliverable[])
          .filter(d => d.phase_id === currentPhase.id);
        let maxEnd = currentPhase.planned_end || '';
        for (const d of allCurrentDels) {
          if (d.planned_end && d.planned_end > maxEnd) maxEnd = d.planned_end;
        }
        if (maxEnd && maxEnd !== currentPhase.planned_end) {
          await supabase.from('project_phases').update({ planned_end: maxEnd }).eq('id', currentPhase.id);
          currentPhase.planned_end = maxEnd;
        }
      }

      // Recalculate all subsequent phases using their rules
      const anchor = currentPhase.planned_end ? parseISO(currentPhase.planned_end) : projectStart;

      // Re-fetch deliverables after same-phase updates
      const { data: freshDels } = await supabase.from('project_deliverables')
        .select('*').eq('project_id', projectId).order('sort_order');

      await recalcPhasesFrom(
        sortedPhases,
        (freshDels || latestDels) as ProjectDeliverable[],
        fromPhaseIdx + 1,
        anchor,
        projectStart,
      );

      invalidateAll();
      toast.success('Datas recalculadas com sucesso');
    } catch (err) {
      toast.error('Erro ao recalcular datas');
      console.error(err);
    }
    setCascadePrompt(null);
  };

  // --- Phase mutations ---
  const updatePhase = useMutation({
    mutationFn: async ({ id, ...fields }: { id: string } & Record<string, unknown>) => {
      const updates: Record<string, unknown> = { ...fields };
      if (fields.status === 'em_curso' && !fields.started_at) updates.started_at = new Date().toISOString();
      if (fields.status === 'concluida' && !fields.completed_at) updates.completed_at = new Date().toISOString();
      if (fields.status === 'pendente') { updates.started_at = null; updates.completed_at = null; }

      await supabase.from('project_phases').update(updates as never).eq('id', id);

      // Check for delay AFTER saving — return info for cascade prompt
      if (fields.planned_end && typeof fields.planned_end === 'string') {
        const phase = phases.find(p => p.id === id);
        if (phase?.planned_end) {
          return { type: 'phase_end' as const, originalEnd: phase.planned_end, newEnd: fields.planned_end as string, entityId: id };
        }
      }
      return null;
    },
    onSuccess: (delayInfo) => {
      qc.invalidateQueries({ queryKey: phaseKey });
      if (delayInfo) {
        const diff = differenceInCalendarDays(parseISO(delayInfo.newEnd), parseISO(delayInfo.originalEnd));
        if (diff > 0) {
          const phaseIdx = phases.findIndex(p => p.id === delayInfo.entityId);
          if (phaseIdx >= 0) {
            setCascadePrompt({ delayDays: diff, phaseId: delayInfo.entityId, phaseIdx, type: 'phase_end' });
          }
        }
      }
    },
  });

  const addPhase = useMutation({
    mutationFn: async (name: string) => {
      const maxOrder = phases.length > 0 ? Math.max(...phases.map(p => p.sort_order)) + 1 : 0;
      await supabase.from('project_phases').insert({ project_id: projectId, name, sort_order: maxOrder, status: 'pendente' });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: phaseKey }); setAddingPhase(false); setNewName(''); toast.success('Fase adicionada'); },
  });

  const deletePhase = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('project_deliverables').delete().eq('phase_id', id);
      await supabase.from('project_phases').delete().eq('id', id);
    },
    onSuccess: () => { invalidateAll(); toast.success('Fase removida'); },
  });

  const movePhase = useMutation({
    mutationFn: async ({ id, direction }: { id: string; direction: 'up' | 'down' }) => {
      const idx = phases.findIndex(p => p.id === id);
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= phases.length) return;
      const a = phases[idx], b = phases[swapIdx];
      await Promise.all([
        supabase.from('project_phases').update({ sort_order: b.sort_order }).eq('id', a.id),
        supabase.from('project_phases').update({ sort_order: a.sort_order }).eq('id', b.id),
      ]);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: phaseKey }),
  });

  // --- Deliverable mutations ---
  const updateDeliverable = useMutation({
    mutationFn: async ({ id, ...fields }: { id: string } & Record<string, unknown>) => {
      await supabase.from('project_deliverables').update(fields as never).eq('id', id);

      // Check for delay AFTER saving
      if (fields.planned_end && typeof fields.planned_end === 'string') {
        const del = deliverables.find(d => d.id === id);
        if (del?.planned_end && del.phase_id) {
          return { type: 'del_end' as const, originalEnd: del.planned_end, newEnd: fields.planned_end as string, phaseId: del.phase_id, delId: id };
        }
      }
      return null;
    },
    onSuccess: (delayInfo) => {
      qc.invalidateQueries({ queryKey: delKey });
      qc.invalidateQueries({ queryKey: ['project-tasks', projectId] });
      qc.invalidateQueries({ queryKey: ['linked-tasks', projectId] });
      if (delayInfo) {
        const diff = differenceInCalendarDays(parseISO(delayInfo.newEnd), parseISO(delayInfo.originalEnd));
        if (diff > 0) {
          const phaseIdx = phases.findIndex(p => p.id === delayInfo.phaseId);
          if (phaseIdx >= 0) {
            setCascadePrompt({ delayDays: diff, phaseId: delayInfo.phaseId, phaseIdx, type: 'del_end', delId: delayInfo.delId });
          }
        }
      }
    },
  });

  /**
   * Check if a date change would push a deliverable outside its phase window
   * or a phase outside the project window. Returns conflict info or null.
   */
  function checkWindowConflict(args: {
    sourceTable: 'project_phases' | 'project_deliverables';
    sourceId: string;
    field: 'planned_start' | 'planned_end';
    newValue: string;
  }): NonNullable<typeof conflictPrompt> | null {
    const { sourceTable, sourceId, field, newValue } = args;
    if (sourceTable === 'project_deliverables') {
      const del = deliverables.find(d => d.id === sourceId);
      if (!del?.phase_id) return null;
      const phase = phases.find(p => p.id === del.phase_id);
      if (!phase) return null;
      const phaseStart = phase.planned_start;
      const phaseEnd = phase.planned_end;
      if (field === 'planned_end' && phaseEnd && newValue > phaseEnd) {
        return {
          kind: 'del_outside_phase',
          message: `A data de fim (${format(parseISO(newValue), 'dd MMM yyyy', { locale: pt })}) é depois do fim da fase "${phase.name}" (${format(parseISO(phaseEnd), 'dd MMM yyyy', { locale: pt })}).`,
          targetId: phase.id,
          field,
          newValue,
          originalValue: (del as any)[field] ?? null,
          sourceTable,
          sourceId,
          extendLabel: `Estender fim da fase para ${format(parseISO(newValue), 'dd MMM', { locale: pt })}`,
          extendDate: newValue,
          canExtend: true,
        };
      }
      if (field === 'planned_start' && phaseStart && newValue < phaseStart) {
        return {
          kind: 'del_outside_phase',
          message: `A data de início (${format(parseISO(newValue), 'dd MMM yyyy', { locale: pt })}) é antes do início da fase "${phase.name}" (${format(parseISO(phaseStart), 'dd MMM yyyy', { locale: pt })}).`,
          targetId: phase.id,
          field,
          newValue,
          originalValue: (del as any)[field] ?? null,
          sourceTable,
          sourceId,
          extendLabel: `Antecipar início da fase para ${format(parseISO(newValue), 'dd MMM', { locale: pt })}`,
          extendDate: newValue,
          canExtend: true,
        };
      }
    } else {
      // phase vs project
      const phase = phases.find(p => p.id === sourceId);
      if (!phase) return null;
      const projDeadline = projectCtx?.deadline as string | null | undefined;
      const projStart = projectStartDate ?? null;
      if (field === 'planned_end' && projDeadline && newValue > projDeadline) {
        return {
          kind: 'phase_outside_project',
          message: `A data de fim da fase (${format(parseISO(newValue), 'dd MMM yyyy', { locale: pt })}) é depois do prazo do projeto (${format(parseISO(projDeadline), 'dd MMM yyyy', { locale: pt })}).`,
          targetId: projectId,
          field,
          newValue,
          originalValue: (phase as any)[field] ?? null,
          sourceTable,
          sourceId,
          extendLabel: 'Ajustar prazo do projeto manualmente',
          extendDate: newValue,
          canExtend: false,
        };
      }
      if (field === 'planned_start' && projStart && newValue < projStart) {
        return {
          kind: 'phase_outside_project',
          message: `A data de início da fase (${format(parseISO(newValue), 'dd MMM yyyy', { locale: pt })}) é antes do início do projeto (${format(parseISO(projStart), 'dd MMM yyyy', { locale: pt })}).`,
          targetId: projectId,
          field,
          newValue,
          originalValue: (phase as any)[field] ?? null,
          sourceTable,
          sourceId,
          extendLabel: 'Ajustar início do projeto manualmente',
          extendDate: newValue,
          canExtend: false,
        };
      }
    }
    return null;
  }

  /**
   * Wrapper used by inputs: intercepts date changes and shows the conflict
   * dialog before persisting. If no conflict, proceeds with the mutation.
   */
  function tryUpdateWithConflictCheck(args: {
    sourceTable: 'project_phases' | 'project_deliverables';
    sourceId: string;
    field: 'planned_start' | 'planned_end';
    newValue: string | null;
  }) {
    const { sourceTable, sourceId, field, newValue } = args;
    if (newValue) {
      const conflict = checkWindowConflict({ sourceTable, sourceId, field, newValue });
      if (conflict) {
        setConflictPrompt(conflict);
        return;
      }
    }
    if (sourceTable === 'project_phases') {
      updatePhase.mutate({ id: sourceId, [field]: newValue });
    } else {
      updateDeliverable.mutate({ id: sourceId, [field]: newValue });
    }
  }

  async function applyConflictResolution(action: 'accept' | 'extend') {
    if (!conflictPrompt) return;
    const c = conflictPrompt;
    if (action === 'extend' && c.canExtend) {
      // Extend the parent phase first, then save the source change.
      await supabase
        .from('project_phases')
        .update({ [c.field]: c.extendDate } as never)
        .eq('id', c.targetId);
    }
    if (c.sourceTable === 'project_phases') {
      updatePhase.mutate({ id: c.sourceId, [c.field]: c.newValue });
    } else {
      updateDeliverable.mutate({ id: c.sourceId, [c.field]: c.newValue });
    }
    setConflictPrompt(null);
  }

  const addDeliverable = useMutation({
    mutationFn: async ({ phaseId, name }: { phaseId: string; name: string }) => {
      const phaseDels = deliverables.filter(d => d.phase_id === phaseId);
      const maxOrder = phaseDels.length > 0 ? Math.max(...phaseDels.map(d => d.sort_order)) + 1 : 0;
      await supabase.from('project_deliverables').insert({
        project_id: projectId, phase_id: phaseId, name, sort_order: maxOrder, status: 'pendente', portal_visible: true,
      });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: delKey }); setAddingDelPhase(null); setNewName(''); toast.success('Entrega adicionada'); },
  });

  const deleteDeliverable = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('project_deliverables').delete().eq('id', id);
    },
    onSuccess: () => { invalidateAll(); toast.success('Entrega removida'); },
  });

  const moveDel = useMutation({
    mutationFn: async ({ id, phaseId, direction }: { id: string; phaseId: string; direction: 'up' | 'down' }) => {
      const phaseDels = deliverables.filter(d => d.phase_id === phaseId).sort((a, b) => a.sort_order - b.sort_order);
      const idx = phaseDels.findIndex(d => d.id === id);
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= phaseDels.length) return;
      const a = phaseDels[idx], b = phaseDels[swapIdx];
      await Promise.all([
        supabase.from('project_deliverables').update({ sort_order: b.sort_order }).eq('id', a.id),
        supabase.from('project_deliverables').update({ sort_order: a.sort_order }).eq('id', b.id),
      ]);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: delKey }),
  });

  const applyDeliverables = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('apply_project_deliverable_tasks', { _project_id: projectId });
      if (error) throw error;
      return (data as number) ?? 0;
    },
    onSuccess: (count) => {
      invalidateAll();
      qc.invalidateQueries({ queryKey: taskKey });
      if (count === 0) toast.info('Sem entregas para aplicar. Define datas nas entregas primeiro.');
      else toast.success(`${count} tarefa(s) criada(s) a partir das entregas`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function startEditPhase(phase: ProjectPhase) {
    setEditingPhase(phase.id);
    setEditName(phase.name);
    setEditDesc(phase.description || '');
  }

  function saveEditPhase(id: string) {
    updatePhase.mutate({ id, name: editName, description: editDesc || null });
    setEditingPhase(null);
  }

  function startEditDel(d: ProjectDeliverable) {
    setEditingDel(d.id);
    setEditName(d.name);
  }

  function saveEditDel(id: string) {
    updateDeliverable.mutate({ id, name: editName });
    setEditingDel(null);
  }

  if (phases.length === 0 && !addingPhase) {
    return (
      <Card className="overflow-hidden">
        <CardHeader className="pb-3 bg-muted/30 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <Layers className="h-4.5 w-4.5 text-primary" />
              </div>
              <CardTitle className="text-base">Fases do Projeto</CardTitle>
            </div>
            <Button size="sm" onClick={() => setAddingPhase(true)}>
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Adicionar Fase
            </Button>
          </div>
        </CardHeader>
        {addingPhase && (
          <CardContent className="pt-0">
            <div className="flex items-center gap-2">
              <Input autoFocus placeholder="Nome da fase" value={newName} onChange={e => setNewName(e.target.value)}
                className="h-7 text-xs" onKeyDown={e => e.key === 'Enter' && newName.trim() && addPhase.mutate(newName.trim())} />
              <Button size="sm" className="h-7" onClick={() => newName.trim() && addPhase.mutate(newName.trim())} disabled={!newName.trim()}>
                <Check className="h-3 w-3" />
              </Button>
              <Button size="sm" variant="ghost" className="h-7" onClick={() => { setAddingPhase(false); setNewName(''); }}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          </CardContent>
        )}
      </Card>
    );
  }

  const completedDeliverables = countDoneDeliverables(deliverables);
  const completedPhases = countDonePhases(phases);
  const progress = computeProjectProgress(deliverables, phases);
  const progressLabel = computeProgressLabel(deliverables, phases, { deliverables: 'points', phases: 'fases' });
  const focusedPhase = focusPhaseId ? phases.find(p => p.id === focusPhaseId) : null;
  // Progress scoped to focused phase when in dialog mode
  const focusedDeliverables = focusedPhase ? deliverables.filter(d => d.phase_id === focusedPhase.id) : [];
  const focusedProgress = focusedPhase ? computeProjectProgress(focusedDeliverables, [focusedPhase]) : 0;
  const focusedProgressLabel = focusedPhase ? computeProgressLabel(focusedDeliverables, [focusedPhase], { deliverables: 'points', phases: 'fases' }) : '';

  return (
    <>
    <Card className="overflow-hidden">
      <CardHeader className="pb-3 bg-muted/30 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Layers className="h-4.5 w-4.5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">
                {focusedPhase ? focusedPhase.name : 'Fases do Projeto'}
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {focusedPhase
                  ? `${focusedProgress}% concluído · ${focusedProgressLabel}`
                  : `${progress}% concluído · ${progressLabel}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={recalculateDates} disabled={recalculating || !projectStartDate}>
              <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", recalculating && "animate-spin")} /> Recalcular datas
            </Button>
            {!focusPhaseId && (
              <Button size="sm" onClick={() => { setAddingPhase(true); setNewName(''); }}>
                <Plus className="h-3.5 w-3.5 mr-1.5" /> Fase
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="relative">
          {(focusPhaseId ? phases.filter(p => p.id === focusPhaseId) : phases).map((phase, i, arr) => {
            const si = getStatusInfo(phase.status);
            const Icon = si.icon;
            const isLast = i === arr.length - 1 && !addingPhase;
            const phaseDeliverables = deliverables
              .filter(d => d.phase_id === phase.id)
              .sort((a, b) => a.sort_order - b.sort_order);
            const isEditing = editingPhase === phase.id;

            return (
              <div key={phase.id} className="flex gap-4 relative group/phase">
                {!focusPhaseId && (
                  <div className="flex flex-col items-center">
                    <div className={cn('h-8 w-8 rounded-full flex items-center justify-center shrink-0 border-2',
                      phase.status === 'concluida' ? 'border-success bg-success/10' :
                      phase.status === 'em_curso' ? 'border-info bg-info/10' :
                      'border-muted bg-muted/30'
                    )}>
                      <Icon className={cn('h-4 w-4', si.color)} />
                    </div>
                    {!isLast && (
                      <div className={cn('w-0.5 flex-1 min-h-[32px]',
                        phase.status === 'concluida' ? 'bg-success/40' : 'bg-border'
                      )} />
                    )}
                  </div>
                )}

                <div className={cn('pb-5 flex-1 min-w-0', isLast && 'pb-0')}>
                  {isEditing ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Input autoFocus value={editName} onChange={e => setEditName(e.target.value)} className="h-7 text-xs flex-1"
                          onKeyDown={e => e.key === 'Enter' && saveEditPhase(phase.id)} />
                        <Button size="sm" className="h-7 px-2" onClick={() => saveEditPhase(phase.id)}><Check className="h-3 w-3" /></Button>
                        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setEditingPhase(null)}><X className="h-3 w-3" /></Button>
                      </div>
                      <Input value={editDesc} onChange={e => setEditDesc(e.target.value)} placeholder="Descrição (opcional)" className="h-7 text-xs" />
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex items-center gap-1">
                          <CalendarDays className="h-3 w-3 text-muted-foreground" />
                          <span className="text-[10px] text-muted-foreground">Início:</span>
                          <Input type="date" className="h-6 text-[10px] w-32" defaultValue={phase.planned_start || ''}
                            onBlur={e => { const v = e.target.value || null; if (v !== (phase.planned_start || null)) tryUpdateWithConflictCheck({ sourceTable: 'project_phases', sourceId: phase.id, field: 'planned_start', newValue: v }); }} />
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-muted-foreground">Fim:</span>
                          <Input type="date" className="h-6 text-[10px] w-32" defaultValue={phase.planned_end || ''}
                            onBlur={e => { const v = e.target.value || null; if (v !== (phase.planned_end || null)) tryUpdateWithConflictCheck({ sourceTable: 'project_phases', sourceId: phase.id, field: 'planned_end', newValue: v }); }} />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className={cn(
                        "flex items-center gap-3 flex-wrap",
                        focusPhaseId && "justify-center mb-8 mt-1"
                      )}>
                        {!focusPhaseId && (
                          <span className="text-base font-semibold">{phase.name || `Fase ${phase.sort_order + 1}`}</span>
                        )}
                        <Select value={phase.status} onValueChange={(v) => updatePhase.mutate({ id: phase.id, status: v })}>
                          <SelectTrigger className={cn(
                            "gap-1.5",
                            focusPhaseId
                              ? "h-9 text-sm font-medium w-auto min-w-[140px] px-3 border-none shadow-none [&>svg:last-child]:ml-1"
                              : "h-7 text-xs w-28 border-none shadow-none px-2"
                          )}>
                            {focusPhaseId && <Icon className={cn('h-4 w-4', si.color)} />}
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PHASE_STATUS.map(s => (
                              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {focusPhaseId && (phase.planned_start || phase.planned_end) && (
                          <span className="h-6 w-px bg-border" aria-hidden />
                        )}
                        {(phase.planned_start || phase.planned_end) && (
                          <span className={cn(
                            "flex items-center gap-1.5 text-foreground",
                            focusPhaseId
                              ? "text-sm font-medium rounded-md border bg-card px-3 py-1.5"
                              : "text-xs text-muted-foreground"
                          )}>
                            <CalendarDays className={cn(focusPhaseId ? "h-4 w-4 text-muted-foreground" : "h-3.5 w-3.5")} />
                            {phase.planned_start ? format(new Date(phase.planned_start + 'T00:00:00'), 'd MMM', { locale: pt }) : '?'}
                            <span className="text-muted-foreground">→</span>
                            {phase.planned_end ? format(new Date(phase.planned_end + 'T00:00:00'), 'd MMM', { locale: pt }) : '?'}
                          </span>
                        )}
                        <div className="opacity-0 group-hover/phase:opacity-100 flex items-center gap-0.5 transition-opacity">
                          <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => startEditPhase(phase)}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                          {i > 0 && (
                            <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => movePhase.mutate({ id: phase.id, direction: 'up' })}>
                              <ChevronUp className="h-3 w-3" />
                            </Button>
                          )}
                          {i < phases.length - 1 && (
                            <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => movePhase.mutate({ id: phase.id, direction: 'down' })}>
                              <ChevronDown className="h-3 w-3" />
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" className="h-5 w-5 p-0 text-destructive" aria-label="Remover fase" onClick={async () => {
                            const ok = await confirm({
                              title: 'Remover fase?',
                              description: `A fase "${phase.name}" e todas as entregas associadas serão eliminadas.`,
                              confirmText: 'Remover',
                              variant: 'destructive',
                            });
                            if (ok) deletePhase.mutate(phase.id);
                          }}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      {phase.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">{phase.description}</p>
                      )}
                    </>
                  )}

                  {/* Deliverables */}
                  {phaseDeliverables.length > 0 && (
                    <div className="mt-3 space-y-1 pl-2">
                      {/* Header de colunas */}
                      <div
                        className="grid items-center gap-2 px-3 pb-1 text-[10px] uppercase tracking-wide text-muted-foreground/60 font-medium"
                        style={{ gridTemplateColumns: '16px minmax(0,1fr) 120px 120px 110px minmax(260px, 1.2fr) 110px' }}
                      >
                        <span />
                        <span>Entrega</span>
                        <span className="flex items-center gap-1"><CalendarDays className="h-2.5 w-2.5" /> Para fazer</span>
                        <span className="flex items-center gap-1"><Flag className="h-2.5 w-2.5" /> Deadline</span>
                        <span>Status</span>
                        <span>Formato</span>
                        <span className="text-right">Ações</span>
                      </div>
                      {phaseDeliverables.map((d, di) => {
                        const isEditingThis = editingDel === d.id;
                        const _delInfo = getDeliverableStatusInfo(d.status);
                        const delStatusConfig = { bg: _delInfo.color, label: _delInfo.label };
                        return (
                          <div key={d.id} className="group/del rounded-lg border bg-card/50 px-3 py-2">
                            <div className="grid items-start gap-2" style={{ gridTemplateColumns: '16px minmax(0,1fr) 120px 120px 110px minmax(260px, 1.2fr) 110px' }}>
                              {isEditingThis ? (
                                <div className="col-span-7 flex items-center gap-2">
                                  <Input autoFocus value={editName} onChange={e => setEditName(e.target.value)} className="h-5 text-xs flex-1"
                                    onKeyDown={e => e.key === 'Enter' && saveEditDel(d.id)} />
                                  <Button size="sm" className="h-5 px-1" onClick={() => saveEditDel(d.id)}><Check className="h-2.5 w-2.5" /></Button>
                                  <Button size="sm" variant="ghost" className="h-5 px-1" onClick={() => setEditingDel(null)}><X className="h-2.5 w-2.5" /></Button>
                                </div>
                              ) : (
                                <>
                                  {d.status === 'concluido' ? (
                                    <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                                  ) : d.status === 'em_progresso' ? (
                                    <Clock className="h-4 w-4 text-info shrink-0" />
                                  ) : (
                                    <Circle className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                                  )}
                                  {(() => {
                                    const linkedTask = taskByDeliverable.get(d.id);
                                    const clickable = !!linkedTask;
                                    return (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (linkedTask) setTaskDetailId(linkedTask.id);
                                          else startEditDel(d);
                                        }}
                                        className={cn(
                                          'text-sm font-medium text-left truncate hover:text-primary transition-colors min-w-0',
                                          clickable && 'cursor-pointer',
                                          d.status === 'concluido' && 'text-muted-foreground line-through'
                                        )}
                                        title={clickable ? 'Abrir detalhes da tarefa' : 'Editar entrega'}
                                      >
                                        {d.name}
                                      </button>
                                    );
                                  })()}
                                  {/* Para fazer (scheduled_date) */}
                                  {(() => {
                                    const sched = (d as any).scheduled_date as string | null | undefined;
                                    const overrun = !!sched && !!d.planned_end && sched > d.planned_end;
                                    return (
                                      <div className="flex items-center justify-start min-w-0">
                                        <Input
                                          type="date"
                                          defaultValue={(d as any).scheduled_date || ''}
                                          onBlur={e => {
                                            const v = e.target.value || null;
                                            if (v !== ((d as any).scheduled_date || null)) {
                                              updateDeliverable.mutate({ id: d.id, scheduled_date: v });
                                            }
                                          }}
                                          className={cn(
                                            'h-6 text-[10px] tabular-nums w-full px-1.5',
                                            overrun && 'border-warning text-warning bg-warning/5'
                                          )}
                                          title={overrun ? 'Data planeada ultrapassa a deadline' : 'Data para fazer'}
                                        />
                                      </div>
                                    );
                                  })()}
                                  {/* Deadline (planned_end) */}
                                  <div className="flex items-center justify-start min-w-0">
                                    <Input
                                      type="date"
                                      defaultValue={d.planned_end || ''}
                                      onBlur={e => {
                                        const v = e.target.value || null;
                                        if (v !== (d.planned_end || null)) {
                                          tryUpdateWithConflictCheck({ sourceTable: 'project_deliverables', sourceId: d.id, field: 'planned_end', newValue: v });
                                        }
                                      }}
                                      className="h-6 text-[10px] tabular-nums w-full px-1.5 font-medium"
                                      title="Deadline (prazo limite)"
                                    />
                                  </div>
                                  {/* Status (coluna fixa) */}
                                  <div className="flex justify-start">
                                    <Select value={d.status} onValueChange={(v) => updateDeliverable.mutate({ id: d.id, status: v })}>
                                      <SelectTrigger className="h-auto border-none shadow-none p-0 w-auto [&>svg]:hidden focus:ring-0">
                                        <Badge className={`text-[10px] font-semibold px-2 py-0.5 cursor-pointer hover:opacity-80 transition-opacity ${delStatusConfig.bg}`}>
                                          {delStatusConfig.label}
                                        </Badge>
                                      </SelectTrigger>
                                      <SelectContent>
                                        {DELIVERABLE_STATUS.map(s => (
                                          <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  {/* Reunião (coluna fixa) */}
                                  <div className="flex justify-start">
                                    <DeliverableFormatCell
                                      deliverable={d as any}
                                      projectId={projectId}
                                      projectName={projectCtx?.name}
                                      clientId={projectCtx?.client_id ?? null}
                                      clientName={projectCtx?.clients?.full_name ?? null}
                                      defaultDepartment={projectDefaultDepartment}
                                      defaultMemberIds={computeMeetingMembers(d)}
                                    />
                                  </div>
                                  {/* Ações */}
                                  <div className="opacity-0 group-hover/del:opacity-100 flex items-center justify-end gap-1 transition-opacity">
                                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => startEditDel(d)} title="Editar nome">
                                      <Pencil className="h-3 w-3" />
                                    </Button>
                                    {di > 0 && (
                                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => moveDel.mutate({ id: d.id, phaseId: phase.id, direction: 'up' })} title="Subir">
                                        <ChevronUp className="h-3 w-3" />
                                      </Button>
                                    )}
                                    {di < phaseDeliverables.length - 1 && (
                                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => moveDel.mutate({ id: d.id, phaseId: phase.id, direction: 'down' })} title="Descer">
                                        <ChevronDown className="h-3 w-3" />
                                      </Button>
                                    )}
                                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive" onClick={() => deleteDeliverable.mutate(d.id)} title="Eliminar">
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Add deliverable */}
                  {addingDelPhase === phase.id ? (
                    <div className="flex items-center gap-2 mt-1.5 pl-1">
                      <Input autoFocus placeholder="Nome da entrega" value={newName} onChange={e => setNewName(e.target.value)}
                        className="h-6 text-xs flex-1" onKeyDown={e => e.key === 'Enter' && newName.trim() && addDeliverable.mutate({ phaseId: phase.id, name: newName.trim() })} />
                      <Button size="sm" className="h-6 px-2" onClick={() => newName.trim() && addDeliverable.mutate({ phaseId: phase.id, name: newName.trim() })} disabled={!newName.trim()}>
                        <Check className="h-2.5 w-2.5" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-6 px-2" onClick={() => { setAddingDelPhase(null); setNewName(''); }}>
                        <X className="h-2.5 w-2.5" />
                      </Button>
                    </div>
                  ) : (
                    <Button variant="ghost" size="sm" className="h-5 text-[10px] mt-1 pl-1 opacity-0 group-hover/phase:opacity-100 transition-opacity"
                      onClick={() => { setAddingDelPhase(phase.id); setNewName(''); }}>
                      <Plus className="h-2.5 w-2.5 mr-0.5" /> Entrega
                    </Button>
                  )}
                </div>
              </div>
            );
          })}

          {/* Add phase inline */}
          {addingPhase && (
            <div className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className="h-6 w-6 rounded-full flex items-center justify-center shrink-0 border-2 border-dashed border-muted">
                  <Plus className="h-3 w-3 text-muted-foreground" />
                </div>
              </div>
              <div className="flex items-center gap-2 flex-1">
                <Input autoFocus placeholder="Nome da fase" value={newName} onChange={e => setNewName(e.target.value)}
                  className="h-7 text-xs flex-1" onKeyDown={e => e.key === 'Enter' && newName.trim() && addPhase.mutate(newName.trim())} />
                <Button size="sm" className="h-7" onClick={() => newName.trim() && addPhase.mutate(newName.trim())} disabled={!newName.trim()}>
                  <Check className="h-3 w-3" />
                </Button>
                <Button size="sm" variant="ghost" className="h-7" onClick={() => { setAddingPhase(false); setNewName(''); }}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>

    {/* Cascade recalculation prompt */}
    <AlertDialog open={!!cascadePrompt} onOpenChange={(open) => { if (!open) setCascadePrompt(null); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warning" />
            Atraso detetado
          </AlertDialogTitle>
          <AlertDialogDescription>
            {cascadePrompt?.type === 'phase_end'
              ? `A data de fim desta fase foi adiada ${cascadePrompt.delayDays} dia(s).`
              : `A data de fim desta entrega foi adiada ${cascadePrompt?.delayDays} dia(s).`
            }
            {' '}Queres recalcular as datas das entregas e fases seguintes?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Não, manter</AlertDialogCancel>
          <AlertDialogAction onClick={() => cascadePrompt && applyCascade(cascadePrompt.delayDays, cascadePrompt.phaseIdx)}>
            Sim, recalcular (+{cascadePrompt?.delayDays} dias)
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    {/* Out-of-window conflict prompt */}
    <AlertDialog open={!!conflictPrompt} onOpenChange={(open) => { if (!open) setConflictPrompt(null); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warning" />
            {conflictPrompt?.kind === 'del_outside_phase' ? 'Entrega fora da fase' : 'Fase fora do projeto'}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {conflictPrompt?.message}
            {!conflictPrompt?.canExtend && ' Para alargar o projeto, ajusta o prazo na ficha do projeto.'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <Button variant="outline" onClick={() => applyConflictResolution('accept')}>
            Aceitar mesmo assim
          </Button>
          {conflictPrompt?.canExtend && (
            <AlertDialogAction onClick={() => applyConflictResolution('extend')}>
              {conflictPrompt.extendLabel}
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    {/* Task detail modal (mesmo da página Tarefas e Operação) */}
    <TaskFormDialog
      open={!!taskDetailId}
      onOpenChange={(open) => !open && setTaskDetailId(null)}
      editingTask={editingTask}
      onSuccess={() => {
        qc.invalidateQueries({ queryKey: taskKey });
        qc.invalidateQueries({ queryKey: delKey });
      }}
    />
    </>
  );
}
