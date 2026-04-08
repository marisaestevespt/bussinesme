import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { CheckCircle2, Circle, Clock, Layers, Plus, Pencil, Trash2, ChevronUp, ChevronDown, X, Check, CalendarDays, AlertTriangle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { format, differenceInCalendarDays, addDays as addCalendarDays, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';
import { addBusinessDays } from '@/lib/holidays';

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
}

const PHASE_STATUS = [
  { value: 'pendente', label: 'Pendente', icon: Circle, color: 'text-muted-foreground' },
  { value: 'em_curso', label: 'Em curso', icon: Clock, color: 'text-info' },
  { value: 'concluida', label: 'Concluída', icon: CheckCircle2, color: 'text-success' },
];

const DELIVERABLE_STATUS = [
  { value: 'pendente', label: 'Pendente' },
  { value: 'em_progresso', label: 'Em progresso' },
  { value: 'concluido', label: 'Concluído' },
];

function getStatusInfo(status: string) {
  return PHASE_STATUS.find(s => s.value === status) || PHASE_STATUS[0];
}

interface Props {
  projectId: string;
  projectStartDate?: string | null;
}

export function ProjectPhasesTimeline({ projectId, projectStartDate }: Props) {
  const qc = useQueryClient();
  const phaseKey = ['project-phases', projectId];
  const delKey = ['project-deliverables', projectId];

  const [editingPhase, setEditingPhase] = useState<string | null>(null);
  const [editingDel, setEditingDel] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [addingPhase, setAddingPhase] = useState(false);
  const [addingDelPhase, setAddingDelPhase] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [cascadePrompt, setCascadePrompt] = useState<{
    delayDays: number;
    phaseId: string;
    phaseIdx: number;
    type: 'phase_end' | 'del_end';
    delId?: string;
  } | null>(null);
  const { data: phases = [] } = useQuery({
    queryKey: phaseKey,
    queryFn: async () => {
      const { data } = await (supabase as any).from('project_phases').select('*').eq('project_id', projectId).order('sort_order');
      return (data || []) as ProjectPhase[];
    },
  });

  const { data: deliverables = [] } = useQuery({
    queryKey: delKey,
    queryFn: async () => {
      const { data } = await (supabase as any).from('project_deliverables').select('*').eq('project_id', projectId).order('sort_order');
      return (data || []) as ProjectDeliverable[];
    },
  });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: phaseKey });
    qc.invalidateQueries({ queryKey: delKey });
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
      const sortedPhases = [...phases].sort((a, b) => a.sort_order - b.sort_order);
      let prevPhaseEnd: Date = startDate;

      for (const phase of sortedPhases) {
        // Calculate phase start
        let phaseStart: Date;
        if (phase.offset_trigger === 'fase_anterior' && phase.sort_order > 0) {
          phaseStart = phase.duration_unit === 'dias_uteis'
            ? addBusinessDays(prevPhaseEnd, phase.offset_days || 0)
            : addCalendarDays(prevPhaseEnd, phase.offset_days || 0);
        } else {
          phaseStart = phase.duration_unit === 'dias_uteis'
            ? addBusinessDays(startDate, phase.offset_days || 0)
            : addCalendarDays(startDate, phase.offset_days || 0);
        }

        // Calculate phase end
        const phaseDuration = phase.duration_days || 0;
        const phaseEnd = phaseDuration > 0
          ? (phase.duration_unit === 'dias_uteis'
            ? addBusinessDays(phaseStart, phaseDuration)
            : addCalendarDays(phaseStart, phaseDuration))
          : phaseStart;

        await (supabase as any).from('project_phases').update({
          planned_start: format(phaseStart, 'yyyy-MM-dd'),
          planned_end: format(phaseEnd, 'yyyy-MM-dd'),
        }).eq('id', phase.id);

        // Calculate deliverable dates within phase
        const phaseDels = deliverables
          .filter(d => d.phase_id === phase.id)
          .sort((a, b) => a.sort_order - b.sort_order);

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

          const delDuration = Math.max(del.duration_days || 1, 1);
          const delEnd = del.duration_unit === 'dias_uteis'
            ? addBusinessDays(delStart, delDuration)
            : addCalendarDays(delStart, delDuration);

          await (supabase as any).from('project_deliverables').update({
            planned_start: format(delStart, 'yyyy-MM-dd'),
            planned_end: format(delEnd, 'yyyy-MM-dd'),
          }).eq('id', del.id);

          prevDelEnd = delEnd;
        }

        prevPhaseEnd = phaseEnd;
      }

      invalidateAll();
      toast.success('Datas recalculadas com sucesso');
    } catch (err) {
      toast.error('Erro ao recalcular datas');
      console.error(err);
    } finally {
      setRecalculating(false);
    }
  };


  const applyCascade = async (delayDays: number, fromPhaseIdx: number) => {
    // Shift all subsequent phases and their deliverables by delayDays
    const subsequentPhases = phases.filter(p => p.sort_order > phases[fromPhaseIdx].sort_order);
    for (const sp of subsequentPhases) {
      const updates: Record<string, unknown> = {};
      if (sp.planned_start) {
        const newStart = addCalendarDays(parseISO(sp.planned_start), delayDays);
        updates.planned_start = format(newStart, 'yyyy-MM-dd');
      }
      if (sp.planned_end) {
        const newEnd = addCalendarDays(parseISO(sp.planned_end), delayDays);
        updates.planned_end = format(newEnd, 'yyyy-MM-dd');
      }
      if (Object.keys(updates).length > 0) {
        await (supabase as any).from('project_phases').update(updates).eq('id', sp.id);
      }
      // Shift deliverables of this phase too
      const phaseDels = deliverables.filter(d => d.phase_id === sp.id);
      for (const pd of phaseDels) {
        const delUpdates: Record<string, unknown> = {};
        if (pd.planned_start) {
          delUpdates.planned_start = format(addCalendarDays(parseISO(pd.planned_start), delayDays), 'yyyy-MM-dd');
        }
        if (pd.planned_end) {
          delUpdates.planned_end = format(addCalendarDays(parseISO(pd.planned_end), delayDays), 'yyyy-MM-dd');
        }
        if (Object.keys(delUpdates).length > 0) {
          await (supabase as any).from('project_deliverables').update(delUpdates).eq('id', pd.id);
        }
      }
    }
    // Also shift remaining deliverables in the SAME phase (after the edited one)
    if (cascadePrompt?.type === 'del_end' && cascadePrompt.delId) {
      const samePhaseDels = deliverables
        .filter(d => d.phase_id === phases[fromPhaseIdx].id)
        .sort((a, b) => a.sort_order - b.sort_order);
      const editedIdx = samePhaseDels.findIndex(d => d.id === cascadePrompt.delId);
      if (editedIdx >= 0) {
        const after = samePhaseDels.slice(editedIdx + 1);
        for (const pd of after) {
          const delUpdates: Record<string, unknown> = {};
          if (pd.planned_start) {
            delUpdates.planned_start = format(addCalendarDays(parseISO(pd.planned_start), delayDays), 'yyyy-MM-dd');
          }
          if (pd.planned_end) {
            delUpdates.planned_end = format(addCalendarDays(parseISO(pd.planned_end), delayDays), 'yyyy-MM-dd');
          }
          if (Object.keys(delUpdates).length > 0) {
            await (supabase as any).from('project_deliverables').update(delUpdates).eq('id', pd.id);
          }
        }
      }
    }
    invalidateAll();
    toast.success(`Datas recalculadas (+${delayDays} dias)`);
    setCascadePrompt(null);
  };

  // --- Phase mutations ---
  const updatePhase = useMutation({
    mutationFn: async ({ id, ...fields }: { id: string } & Record<string, unknown>) => {
      const updates: Record<string, unknown> = { ...fields };
      if (fields.status === 'em_curso' && !fields.started_at) updates.started_at = new Date().toISOString();
      if (fields.status === 'concluida' && !fields.completed_at) updates.completed_at = new Date().toISOString();
      if (fields.status === 'pendente') { updates.started_at = null; updates.completed_at = null; }

      await (supabase as any).from('project_phases').update(updates).eq('id', id);

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
      await (supabase as any).from('project_phases').insert({ project_id: projectId, name, sort_order: maxOrder, status: 'pendente' });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: phaseKey }); setAddingPhase(false); setNewName(''); toast.success('Fase adicionada'); },
  });

  const deletePhase = useMutation({
    mutationFn: async (id: string) => {
      await (supabase as any).from('project_deliverables').delete().eq('phase_id', id);
      await (supabase as any).from('project_phases').delete().eq('id', id);
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
        (supabase as any).from('project_phases').update({ sort_order: b.sort_order }).eq('id', a.id),
        (supabase as any).from('project_phases').update({ sort_order: a.sort_order }).eq('id', b.id),
      ]);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: phaseKey }),
  });

  // --- Deliverable mutations ---
  const updateDeliverable = useMutation({
    mutationFn: async ({ id, ...fields }: { id: string } & Record<string, unknown>) => {
      await (supabase as any).from('project_deliverables').update(fields).eq('id', id);

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

  const addDeliverable = useMutation({
    mutationFn: async ({ phaseId, name }: { phaseId: string; name: string }) => {
      const phaseDels = deliverables.filter(d => d.phase_id === phaseId);
      const maxOrder = phaseDels.length > 0 ? Math.max(...phaseDels.map(d => d.sort_order)) + 1 : 0;
      await (supabase as any).from('project_deliverables').insert({
        project_id: projectId, phase_id: phaseId, name, sort_order: maxOrder, status: 'pendente', portal_visible: true,
      });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: delKey }); setAddingDelPhase(null); setNewName(''); toast.success('Entrega adicionada'); },
  });

  const deleteDeliverable = useMutation({
    mutationFn: async (id: string) => {
      await (supabase as any).from('project_deliverables').delete().eq('id', id);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: delKey }); toast.success('Entrega removida'); },
  });

  const moveDel = useMutation({
    mutationFn: async ({ id, phaseId, direction }: { id: string; phaseId: string; direction: 'up' | 'down' }) => {
      const phaseDels = deliverables.filter(d => d.phase_id === phaseId).sort((a, b) => a.sort_order - b.sort_order);
      const idx = phaseDels.findIndex(d => d.id === id);
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= phaseDels.length) return;
      const a = phaseDels[idx], b = phaseDels[swapIdx];
      await Promise.all([
        (supabase as any).from('project_deliverables').update({ sort_order: b.sort_order }).eq('id', a.id),
        (supabase as any).from('project_deliverables').update({ sort_order: a.sort_order }).eq('id', b.id),
      ]);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: delKey }),
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
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm">Fases do Projeto</CardTitle>
          </div>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setAddingPhase(true)}>
            <Plus className="h-3 w-3 mr-1" /> Adicionar Fase
          </Button>
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

  const completedCount = deliverables.filter(d => d.status === 'concluido').length;
  const progress = deliverables.length > 0 ? Math.round((completedCount / deliverables.length) * 100) : 0;

  return (
    <>
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-primary" />
          <CardTitle className="text-sm">Fases do Projeto</CardTitle>
          <Badge variant="secondary" className="text-[10px]">{completedCount}/{phases.length}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{progress}% concluído</span>
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={recalculateDates} disabled={recalculating || !projectStartDate}>
            <RefreshCw className={cn("h-3 w-3 mr-1", recalculating && "animate-spin")} /> Recalcular datas
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setAddingPhase(true); setNewName(''); }}>
            <Plus className="h-3 w-3 mr-1" /> Fase
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="relative">
          {phases.map((phase, i) => {
            const si = getStatusInfo(phase.status);
            const Icon = si.icon;
            const isLast = i === phases.length - 1 && !addingPhase;
            const phaseDeliverables = deliverables
              .filter(d => d.phase_id === phase.id)
              .sort((a, b) => a.sort_order - b.sort_order);
            const isEditing = editingPhase === phase.id;

            return (
              <div key={phase.id} className="flex gap-3 relative group/phase">
                <div className="flex flex-col items-center">
                  <div className={cn('h-6 w-6 rounded-full flex items-center justify-center shrink-0 border-2',
                    phase.status === 'concluida' ? 'border-success bg-success/10' :
                    phase.status === 'em_curso' ? 'border-info bg-info/10' :
                    'border-muted bg-muted/30'
                  )}>
                    <Icon className={cn('h-3.5 w-3.5', si.color)} />
                  </div>
                  {!isLast && (
                    <div className={cn('w-0.5 flex-1 min-h-[24px]',
                      phase.status === 'concluida' ? 'bg-success/40' : 'bg-border'
                    )} />
                  )}
                </div>

                <div className={cn('pb-4 flex-1 min-w-0', isLast && 'pb-0')}>
                  {isEditing ? (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5">
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
                            onBlur={e => { const v = e.target.value || null; if (v !== (phase.planned_start || null)) updatePhase.mutate({ id: phase.id, planned_start: v }); }} />
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-muted-foreground">Fim:</span>
                          <Input type="date" className="h-6 text-[10px] w-32" defaultValue={phase.planned_end || ''}
                            onBlur={e => { const v = e.target.value || null; if (v !== (phase.planned_end || null)) updatePhase.mutate({ id: phase.id, planned_end: v }); }} />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-medium">{phase.name || `Fase ${phase.sort_order + 1}`}</span>
                        <Select value={phase.status} onValueChange={(v) => updatePhase.mutate({ id: phase.id, status: v })}>
                          <SelectTrigger className="h-6 text-[10px] w-24 border-none shadow-none p-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PHASE_STATUS.map(s => (
                              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {(phase.planned_start || phase.planned_end) && (
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <CalendarDays className="h-3 w-3" />
                            {phase.planned_start ? format(new Date(phase.planned_start + 'T00:00:00'), 'd MMM', { locale: pt }) : '?'}
                            {' → '}
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
                          <Button variant="ghost" size="sm" className="h-5 w-5 p-0 text-destructive" onClick={() => {
                            if (confirm('Remover esta fase e todas as suas entregas?')) deletePhase.mutate(phase.id);
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
                    <div className="mt-2 space-y-1 pl-1">
                      {phaseDeliverables.map((d, di) => {
                        const isEditingThis = editingDel === d.id;
                        return (
                          <div key={d.id} className="space-y-1 group/del">
                            <div className="flex items-center gap-2">
                              {isEditingThis ? (
                                <>
                                  <Input autoFocus value={editName} onChange={e => setEditName(e.target.value)} className="h-5 text-xs flex-1"
                                    onKeyDown={e => e.key === 'Enter' && saveEditDel(d.id)} />
                                  <Button size="sm" className="h-5 px-1" onClick={() => saveEditDel(d.id)}><Check className="h-2.5 w-2.5" /></Button>
                                  <Button size="sm" variant="ghost" className="h-5 px-1" onClick={() => setEditingDel(null)}><X className="h-2.5 w-2.5" /></Button>
                                </>
                              ) : (
                                <>
                                  {d.status === 'concluido' ? (
                                    <CheckCircle2 className="h-3 w-3 text-success shrink-0" />
                                  ) : d.status === 'em_progresso' ? (
                                    <Clock className="h-3 w-3 text-info shrink-0" />
                                  ) : (
                                    <Circle className="h-3 w-3 text-muted-foreground/40 shrink-0" />
                                  )}
                                  <span className={cn('text-xs flex-1', d.status === 'concluido' && 'text-muted-foreground line-through')}>{d.name}</span>
                                  {(d.planned_start || d.planned_end) && (
                                    <span className="text-[9px] text-muted-foreground flex items-center gap-0.5">
                                      <CalendarDays className="h-2.5 w-2.5" />
                                      {d.planned_start ? format(new Date(d.planned_start + 'T00:00:00'), 'd MMM', { locale: pt }) : '?'}
                                      {' → '}
                                      {d.planned_end ? format(new Date(d.planned_end + 'T00:00:00'), 'd MMM', { locale: pt }) : '?'}
                                    </span>
                                  )}
                                  <Select value={d.status} onValueChange={(v) => updateDeliverable.mutate({ id: d.id, status: v })}>
                                    <SelectTrigger className="h-5 text-[9px] w-20 border-none shadow-none p-0.5">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {DELIVERABLE_STATUS.map(s => (
                                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <div className="opacity-0 group-hover/del:opacity-100 flex items-center gap-0.5 transition-opacity">
                                    <Button variant="ghost" size="sm" className="h-4 w-4 p-0" onClick={() => startEditDel(d)}>
                                      <Pencil className="h-2.5 w-2.5" />
                                    </Button>
                                    {di > 0 && (
                                      <Button variant="ghost" size="sm" className="h-4 w-4 p-0" onClick={() => moveDel.mutate({ id: d.id, phaseId: phase.id, direction: 'up' })}>
                                        <ChevronUp className="h-2.5 w-2.5" />
                                      </Button>
                                    )}
                                    {di < phaseDeliverables.length - 1 && (
                                      <Button variant="ghost" size="sm" className="h-4 w-4 p-0" onClick={() => moveDel.mutate({ id: d.id, phaseId: phase.id, direction: 'down' })}>
                                        <ChevronDown className="h-2.5 w-2.5" />
                                      </Button>
                                    )}
                                    <Button variant="ghost" size="sm" className="h-4 w-4 p-0 text-destructive" onClick={() => deleteDeliverable.mutate(d.id)}>
                                      <Trash2 className="h-2.5 w-2.5" />
                                    </Button>
                                  </div>
                                </>
                              )}
                            </div>
                            {/* Inline date editing when in edit mode */}
                            {isEditingThis && (
                              <div className="flex items-center gap-2 ml-5 flex-wrap">
                                <CalendarDays className="h-2.5 w-2.5 text-muted-foreground" />
                                <span className="text-[9px] text-muted-foreground">Início:</span>
                                <Input type="date" className="h-5 text-[9px] w-28" value={d.planned_start || ''}
                                  onChange={e => updateDeliverable.mutate({ id: d.id, planned_start: e.target.value || null })} />
                                <span className="text-[9px] text-muted-foreground">Fim:</span>
                                <Input type="date" className="h-5 text-[9px] w-28" value={d.planned_end || ''}
                                  onChange={e => updateDeliverable.mutate({ id: d.id, planned_end: e.target.value || null })} />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Add deliverable */}
                  {addingDelPhase === phase.id ? (
                    <div className="flex items-center gap-1.5 mt-1.5 pl-1">
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
              <div className="flex items-center gap-1.5 flex-1">
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
            <AlertTriangle className="h-4 w-4 text-amber-500" />
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
    </>
  );
}
