import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileText, Clock, CheckCircle2, Circle, User, Calendar, ExternalLink, RotateCw } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { UnifiedItem } from '@/hooks/useUnifiedResponsibilities';
import { SOURCE_LABELS } from '@/hooks/useUnifiedResponsibilities';
import { TASK_STATUSES as CANON_TASK_STATUSES, getTaskPriorityInfo } from '@/lib/taskStatus';
import { InlineLoader } from '@/components/ui/loading-skeletons';

// Use the canonical task statuses so badges/dropdowns match the Tarefas page.
const TASK_STATUSES = CANON_TASK_STATUSES;

interface Props {
  item: UnifiedItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ResponsibilityDetailDialog({ item, open, onOpenChange }: Props) {
  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-base pr-6">{item.title}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="flex-1 -mx-6 px-6">
          <DetailContent item={item} onClose={() => onOpenChange(false)} />
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function DetailContent({ item, onClose }: { item: UnifiedItem; onClose: () => void }) {
  switch (item.source) {
    case 'tarefa':
      return <TaskDetail item={item} onClose={onClose} />;
    case 'rotina':
      return <RoutineChecklistDetail item={item} onClose={onClose} />;
    default:
      return <GenericDetail item={item} />;
  }
}

// ─── Task Detail (includes SOP if routine) ───────────────────

function TaskDetail({ item, onClose }: { item: UnifiedItem; onClose: () => void }) {
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data: task } = useQuery({
    queryKey: ['task-detail', item.sourceId],
    queryFn: async () => {
      const { data, error } = await supabase.from('tasks')
        .select('*, planning_routines:routine_id(id, title, recurrence_type, weekday, month_day)')
        .eq('id', item.sourceId)
        .single();
      if (error) throw error;
      // Fetch profile name separately since there's no FK
      if (data?.assigned_to) {
        const { data: profile } = await supabase.from('profiles')
          .select('full_name')
          .eq('id', data.assigned_to)
          .maybeSingle();
        return { ...data, profiles: profile };
      }
      return { ...data, profiles: null };
    },
  });

  const routineId = (task as any)?.routine_id;

  // Fetch linked SOP if this task belongs to a routine
  const { data: linkedSop } = useQuery({
    queryKey: ['routine-sop', routineId],
    enabled: !!routineId,
    queryFn: async () => {
      const { data } = await supabase.from('sops')
        .select('id, sop_id, name, passos, department')
        .eq('routine_id', routineId!)
        .maybeSingle();
      return data;
    },
  });

  const updateStatus = useMutation({
    mutationFn: async (status: string) => {
      const { error } = await supabase.from('tasks').update({ status }).eq('id', item.sourceId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['unified-tasks'] });
      qc.invalidateQueries({ queryKey: ['task-detail', item.sourceId] });
      qc.invalidateQueries({ queryKey: ['my-tasks'] });
      toast.success('Status atualizado');
    },
  });

  if (!task) return <div className="py-6 text-center text-sm text-muted-foreground">A carregar...</div>;

  const routine = (task as any)?.planning_routines;
  const recLabel = routine
    ? routine.recurrence_type === 'semanal'
      ? `Semanal — ${['', '2ª', '3ª', '4ª', '5ª', '6ª', 'Sáb', 'Dom'][routine.weekday || 0]} feira`
      : `Mensal — dia ${routine.month_day}`
    : null;

  return (
    <div className="space-y-4 pb-4">
      {/* Meta info */}
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline" className="gap-1 text-xs">
          <Calendar className="h-3 w-3" />
          {task.deadline ? format(parseISO(task.deadline), 'd MMM yyyy', { locale: pt }) : 'Sem prazo'}
        </Badge>
        {task.priority && (
          <Badge variant="outline" className="text-xs">
            {getTaskPriorityInfo(task.priority).label}
          </Badge>
        )}
        {(task as any).profiles?.full_name && (
          <Badge variant="outline" className="gap-1 text-xs">
            <User className="h-3 w-3" />
            {(task as any).profiles.full_name}
          </Badge>
        )}
      </div>

      {/* Routine badge */}
      {routine && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-accent-violet/15 border border-accent-violet">
          <RotateCw className="h-4 w-4 text-accent-violet shrink-0" />
          <div>
            <p className="text-sm font-medium text-accent-violet">{routine.title}</p>
            <p className="text-xs text-accent-violet">{recLabel}</p>
          </div>
        </div>
      )}

      {/* Status change */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">Status</label>
        <Select value={task.status} onValueChange={(v) => updateStatus.mutate(v)}>
          <SelectTrigger className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TASK_STATUSES.map(s => (
              <SelectItem key={s.value} value={s.value}>
                <div className="flex items-center gap-2">
                  <div className={cn('h-2 w-2 rounded-full', s.value === 'done' ? 'bg-success' : s.value === 'a_fazer' ? 'bg-info' : 'bg-muted')} />
                  {s.label}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Notes */}
      {task.notes && (
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">Notas</label>
          <p className="text-sm text-foreground bg-muted/50 p-3 rounded-lg">{task.notes}</p>
        </div>
      )}

      {/* Linked SOP */}
      {linkedSop && (
        <>
          <Separator />
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">SOP Associado</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => { onClose(); navigate(`/hub/processos/${linkedSop.id}`); }}
              >
                Abrir SOP <ExternalLink className="h-3 w-3" />
              </Button>
            </div>
            <div className="p-3 rounded-lg border bg-card">
              <p className="text-sm font-medium">{linkedSop.name}</p>
              <p className="text-xs text-muted-foreground font-mono">{linkedSop.sop_id}</p>
              {linkedSop.passos && Array.isArray(linkedSop.passos) && (linkedSop.passos as any[]).length > 0 && (
                <div className="mt-3 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Passos</p>
                  {(linkedSop.passos as any[]).slice(0, 8).map((step: any, i: number) => (
                    <div key={i} className="flex items-start gap-2 text-xs">
                      <span className="text-muted-foreground shrink-0 mt-0.5">{i + 1}.</span>
                      <span>{typeof step === 'string' ? step : step.text || step.title || JSON.stringify(step)}</span>
                    </div>
                  ))}
                  {(linkedSop.passos as any[]).length > 8 && (
                    <p className="text-[10px] text-muted-foreground">+{(linkedSop.passos as any[]).length - 8} passos...</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Routine Checklist Detail ────────────────────────────────

function RoutineChecklistDetail({ item, onClose }: { item: UnifiedItem; onClose: () => void }) {
  const qc = useQueryClient();

  const toggleMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('executive_monthly_checklists')
        .update({ completed: true })
        .eq('id', item.sourceId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['unified-habits'] });
      qc.invalidateQueries({ queryKey: ['executive'] });
      toast.success('Rotina marcada como concluída');
      onClose();
    },
  });

  return (
    <div className="space-y-4 pb-4">
      <div className="flex items-center gap-2 p-3 rounded-lg bg-accent-violet/15 border border-accent-violet">
        <RotateCw className="h-4 w-4 text-accent-violet shrink-0" />
        <p className="text-sm text-accent-violet">Rotina mensal do Planeamento Executivo</p>
      </div>

      <p className="text-sm">{item.title.replace('Rotina — ', '')}</p>

      <Button
        className="w-full gap-2"
        onClick={() => toggleMutation.mutate()}
        disabled={toggleMutation.isPending}
      >
        <CheckCircle2 className="h-4 w-4" />
        Marcar como Concluída
      </Button>
    </div>
  );
}

// ─── Generic Detail (fallback) ───────────────────────────────

function GenericDetail({ item }: { item: UnifiedItem }) {
  return (
    <div className="space-y-4 pb-4">
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline" className="text-xs">{SOURCE_LABELS[item.source]}</Badge>
        {item.deadline && (
          <Badge variant="outline" className="gap-1 text-xs">
            <Clock className="h-3 w-3" />
            {format(parseISO(item.deadline.split('T')[0]), 'd MMM yyyy', { locale: pt })}
          </Badge>
        )}
      </div>
      {item.subtitle && <p className="text-sm text-muted-foreground">{item.subtitle}</p>}
    </div>
  );
}