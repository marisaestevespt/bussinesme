import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useTeamPhotos } from '@/hooks/useTeamPhotos';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Progress } from '@/components/ui/progress';
import { Plus, Package, CalendarIcon, Trash2, Download, Clock, Video } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format, startOfMonth, endOfMonth, addMonths, getDay, addDays, subDays, isAfter } from 'date-fns';
import { pt } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { DeliverableFormatCell } from '@/components/project/DeliverableFormatCell';
import { TaskFormDialog } from '@/components/tasks/TaskFormDialog';
import { useServiceMembers } from '@/hooks/useTeamByWorkArea';
import { EmptyHint } from '@/components/ui/loading-skeletons';
import {
  isDeliverableDone,
  deliverableProgress,
  DELIVERABLE_STATUSES,
  getDeliverableStatusInfo,
} from '@/lib/projectProgress';
import { NewMeetingButton } from '@/components/meeting/NewMeetingButton';
import { useNavigate } from 'react-router-dom';

const WEEK_OPTIONS = [
  { value: '1', label: '1ª semana' },
  { value: '2', label: '2ª semana' },
  { value: '3', label: '3ª semana' },
  { value: '4', label: '4ª semana' },
  { value: '-1', label: 'Última semana' },
  { value: '-2', label: 'Penúltima semana' },
];

const WEEKDAY_OPTIONS = [
  { value: '1', label: 'Segunda' },
  { value: '2', label: 'Terça' },
  { value: '3', label: 'Quarta' },
  { value: '4', label: 'Quinta' },
  { value: '5', label: 'Sexta' },
  { value: '6', label: 'Sábado' },
  { value: '0', label: 'Domingo' },
];

const getStatusInfo = getDeliverableStatusInfo;

/**
 * Calculate the next occurrence date given a week-of-month and weekday rule.
 * recurrence_week: 1-4 = nth week, -1 = last week, -2 = second-to-last
 * recurrence_weekday: 0 = Sunday, 1 = Monday ... 6 = Saturday
 */
function calcNextOccurrence(recurrenceWeek: number, recurrenceWeekday: number): Date {
  const today = new Date();
  // Try current month first, then next month
  for (let offset = 0; offset <= 2; offset++) {
    const target = addMonths(today, offset);
    const date = getOccurrenceInMonth(target, recurrenceWeek, recurrenceWeekday);
    if (date && isAfter(date, subDays(today, 1))) return date;
  }
  return addMonths(today, 1); // fallback
}

function getOccurrenceInMonth(refDate: Date, week: number, weekday: number): Date | null {
  const monthStart = startOfMonth(refDate);
  const monthEnd = endOfMonth(refDate);

  if (week > 0) {
    // Find nth occurrence of weekday in month
    let count = 0;
    let d = monthStart;
    while (d <= monthEnd) {
      if (getDay(d) === weekday) {
        count++;
        if (count === week) return d;
      }
      d = addDays(d, 1);
    }
    return null;
  } else {
    // From end: -1 = last, -2 = second-to-last
    const occurrences: Date[] = [];
    let d = monthStart;
    while (d <= monthEnd) {
      if (getDay(d) === weekday) occurrences.push(new Date(d));
      d = addDays(d, 1);
    }
    const idx = occurrences.length + week; // e.g. length + (-1) = last
    return idx >= 0 ? occurrences[idx] : null;
  }
}

function formatRecurrenceRule(week: number, weekday: number): string {
  const w = WEEK_OPTIONS.find(o => o.value === String(week));
  const d = WEEKDAY_OPTIONS.find(o => o.value === String(weekday));
  return `${w?.label || ''}, ${d?.label || ''}`;
}

interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
}

function getInitials(name: string | null) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function formatMin(min: number): string {
  if (!min || min < 0) return '0m';
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h${m}` : `${h}h`;
}

function EstimatedTimePopover({ currentMinutes, onSave }: { currentMinutes: number | null; onSave: (m: number | null) => void }) {
  const [hours, setHours] = useState<string>(currentMinutes != null ? Math.floor(currentMinutes / 60).toString() : '');
  const [mins, setMins] = useState<string>(currentMinutes != null ? (currentMinutes % 60).toString() : '');
  return (
    <PopoverContent className="w-64 p-3" align="end">
      <Label className="text-xs">Tempo estimado</Label>
      <div className="flex items-end gap-2 mt-2">
        <div className="flex-1">
          <span className="text-[10px] text-muted-foreground">Horas</span>
          <Input type="number" min="0" value={hours} onChange={e => setHours(e.target.value)} placeholder="0" className="h-8" />
        </div>
        <div className="flex-1">
          <span className="text-[10px] text-muted-foreground">Minutos</span>
          <Input type="number" min="0" max="59" value={mins} onChange={e => setMins(e.target.value)} placeholder="0" className="h-8" />
        </div>
      </div>
      <div className="flex items-center justify-between mt-3 gap-2">
        <Button variant="ghost" size="sm" className="text-xs" onClick={() => onSave(null)}>Limpar</Button>
        <Button size="sm" className="text-xs" onClick={() => {
          const h = parseInt(hours || '0') || 0;
          const m = parseInt(mins || '0') || 0;
          const total = h * 60 + m;
          onSave(total > 0 ? total : null);
        }}>Guardar</Button>
      </div>
    </PopoverContent>
  );
}

export function ProjectDeliverables({ projectId, profiles }: { projectId: string; profiles: Profile[] }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { getPhotoUrl } = useTeamPhotos();
  const [importOpen, setImportOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [name, setName] = useState('');
  const [deadline, setDeadline] = useState<Date | undefined>();
  const [assignedTo, setAssignedTo] = useState('');
  const { data: serviceMembers = [] } = useServiceMembers();
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceLabel, setRecurrenceLabel] = useState('');
  const [recurrenceWeek, setRecurrenceWeek] = useState('');
  const [recurrenceWeekday, setRecurrenceWeekday] = useState('');
  const [taskDetailId, setTaskDetailId] = useState<string | null>(null);
  const qc = useQueryClient();
  const navigate = useNavigate();

  // Project context (client_id, name) for pre-filling meeting dialog
  const { data: projectCtx } = useQuery({
    queryKey: ['project-meeting-ctx', projectId],
    queryFn: async () => {
      const { data } = await supabase
        .from('projects')
        .select('id, name, client_id, department, departments, clients ( id, full_name )')
        .eq('id', projectId)
        .maybeSingle();
      return data as any;
    },
  });

  // Team members (profile_id + department) — used to resolve members of the
  // project's department(s) when creating a meeting from a deliverable.
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

  // Profiles already assigned to this project (maximally relevant for meetings).
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

  /**
   * Compute the default participant set when creating a meeting from a deliverable:
   * - the deliverable assignee (if any)
   * - all team members whose `department` matches the project's main department
   *   or any department listed in `projects.departments` (jsonb array).
   */
  const computeMeetingMembers = (d: any): string[] => {
    const ids = new Set<string>();
    if (d?.assigned_to) ids.add(d.assigned_to);
    // Always include explicit project members.
    projectMembers.forEach(pm => { if (pm.profile_id) ids.add(pm.profile_id); });
    // Plus all active team members whose department matches the project department(s).
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
      qc.invalidateQueries({ queryKey: ['project-deliverables', projectId] });
      toast.success('Reunião ligada à entrega');
    },
    onError: (e: any) => toast.error(e?.message || 'Falha ao ligar reunião'),
  });

  const { data: deliverables = [] } = useQuery({
    queryKey: ['project-deliverables', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_deliverables')
        .select('*')
        .eq('project_id', projectId)
        .order('sort_order')
        .order('deadline', { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Tasks linked to deliverables (auto-generated by sync_deliverable_to_task trigger)
  const { data: linkedTasks = [] } = useQuery({
    queryKey: ['project-deliverable-tasks', projectId],
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

  // Real time totals per task (sum of task_time_entries)
  const linkedTaskIds = useMemo(() => linkedTasks.map((t: any) => t.id), [linkedTasks]);
  const { data: timeByTask = {} } = useQuery({
    queryKey: ['deliverable-time-totals', projectId, linkedTaskIds],
    enabled: linkedTaskIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from('task_time_entries')
        .select('task_id, duration_minutes, ended_at, is_manual')
        .in('task_id', linkedTaskIds);
      const map: Record<string, number> = {};
      (data || []).forEach((e: any) => {
        if (e.ended_at || e.is_manual) {
          map[e.task_id] = (map[e.task_id] || 0) + (e.duration_minutes || 0);
        }
      });
      return map;
    },
  });

  // Enrich deliverables with computed next deadline for recurring ones
  const enrichedDeliverables = useMemo(() => {
    return deliverables.map(d => {
      if (d.is_recurring && d.recurrence_week != null && d.recurrence_weekday != null) {
        const nextDate = calcNextOccurrence(d.recurrence_week, d.recurrence_weekday);
        return { ...d, computed_deadline: format(nextDate, 'yyyy-MM-dd'), _nextDate: nextDate };
      }
      return { ...d, computed_deadline: d.deadline, _nextDate: d.deadline ? new Date(d.deadline) : null };
    });
  }, [deliverables]);

  const computedDeadline = useMemo(() => {
    if (!isRecurring || !recurrenceWeek || !recurrenceWeekday) return deadline;
    return calcNextOccurrence(Number(recurrenceWeek), Number(recurrenceWeekday));
  }, [isRecurring, recurrenceWeek, recurrenceWeekday, deadline]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const finalDeadline = isRecurring && recurrenceWeek && recurrenceWeekday
        ? format(calcNextOccurrence(Number(recurrenceWeek), Number(recurrenceWeekday)), 'yyyy-MM-dd')
        : deadline ? format(deadline, 'yyyy-MM-dd') : null;

      const autoLabel = isRecurring && recurrenceWeek && recurrenceWeekday
        ? formatRecurrenceRule(Number(recurrenceWeek), Number(recurrenceWeekday))
        : recurrenceLabel || null;

      const { error } = await supabase.from('project_deliverables').insert({
        project_id: projectId,
        name,
        deadline: finalDeadline,
        assigned_to: assignedTo || null,
        is_recurring: isRecurring,
        recurrence_label: isRecurring ? autoLabel : null,
        recurrence_week: isRecurring && recurrenceWeek ? Number(recurrenceWeek) : null,
        recurrence_weekday: isRecurring && recurrenceWeekday ? Number(recurrenceWeekday) : null,
        sort_order: deliverables.length,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project-deliverables', projectId] });
      toast.success('Entrega criada');
      setDialogOpen(false);
      resetForm();
    },
    onError: () => toast.error('Erro ao criar entrega'),
  });

  const resetForm = () => {
    setName(''); setDeadline(undefined); setAssignedTo('');
    setIsRecurring(false); setRecurrenceLabel(''); setRecurrenceWeek(''); setRecurrenceWeekday('');
  };

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from('project_deliverables').update({ status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project-deliverables', projectId] });
      qc.invalidateQueries({ queryKey: ['project-tasks', projectId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('project_deliverables').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project-deliverables', projectId] });
      qc.invalidateQueries({ queryKey: ['project-tasks', projectId] });
      toast.success('Entrega eliminada');
    },
  });

  const updateDeadline = useMutation({
    mutationFn: async ({ id, deadline: newDeadline }: { id: string; deadline: string }) => {
      const { error } = await supabase.from('project_deliverables').update({ deadline: newDeadline }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project-deliverables', projectId] });
      qc.invalidateQueries({ queryKey: ['project-tasks', projectId] });
      toast.success('Data atualizada');
    },
  });

  const updateEstimated = useMutation({
    mutationFn: async ({ id, estimated_minutes }: { id: string; estimated_minutes: number | null }) => {
      const { error } = await supabase.from('project_deliverables').update({ estimated_minutes }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project-deliverables', projectId] });
      qc.invalidateQueries({ queryKey: ['project-deliverable-tasks', projectId] });
      toast.success('Tempo estimado atualizado');
    },
    onError: () => toast.error('Erro ao atualizar tempo'),
  });

  // Products with deliverable templates for import
  const { data: productsWithTemplates = [] } = useQuery({
    queryKey: ['products-with-templates'],
    queryFn: async () => {
      const { data: products } = await supabase.from('products').select('id, name').order('name');
      if (!products?.length) return [];
      const { data: templates } = await supabase.from('product_deliverable_templates' as any).select('id, product_id, name, description, sort_order, is_recurring, estimated_minutes, deliverable_type, is_meeting, meeting_title_template, responsible_type, link_url, document_url, document_file_path');
      const templatesByProduct = new Map<string, any[]>();
      ((templates || []) as any[]).forEach((t: any) => {
        if (!templatesByProduct.has(t.product_id)) templatesByProduct.set(t.product_id, []);
        templatesByProduct.get(t.product_id)!.push(t);
      });
      return products.filter(p => templatesByProduct.has(p.id)).map(p => ({
        ...p,
        templates: templatesByProduct.get(p.id)!.sort((a: any, b: any) => a.sort_order - b.sort_order),
      }));
    },
    enabled: importOpen,
  });

  const importMutation = useMutation({
    mutationFn: async (productId: string) => {
      const product = productsWithTemplates.find(p => p.id === productId);
      if (!product?.templates?.length) throw new Error('Sem templates');
      const inserts = product.templates.map((t: any, i: number) => ({
        project_id: projectId,
        name: t.name,
        description: t.description || null,
        is_recurring: !!t.is_recurring,
        sort_order: deliverables.length + i,
        status: 'pendente',
        estimated_minutes: t.estimated_minutes ?? null,
        deliverable_type: t.deliverable_type || 'tarefa',
        is_meeting: !!t.is_meeting || t.deliverable_type === 'reuniao',
        meeting_title_template: t.meeting_title_template ?? null,
        responsible_type: t.responsible_type || 'equipa',
        link_url: t.link_url ?? null,
        document_url: t.document_url ?? null,
        document_file_path: t.document_file_path ?? null,
      }));
      const { error } = await supabase.from('project_deliverables').insert(inserts as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project-deliverables', projectId] });
      toast.success('Entregas importadas do produto');
      setImportOpen(false);
      setSelectedProductId('');
    },
    onError: () => toast.error('Erro ao importar entregas'),
  });

  const doneCount = deliverables.filter(isDeliverableDone).length;
  const totalCount = deliverables.length;
  const progressPct = deliverableProgress(deliverables);

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Package className="h-4 w-4" /> Entregas / Milestones
              {totalCount > 0 && (
                <span className="text-xs text-muted-foreground font-normal">{doneCount}/{totalCount}</span>
              )}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="gap-2 h-7 text-xs" onClick={() => setImportOpen(true)}>
                <Download className="h-3.5 w-3.5" /> Importar do Produto
              </Button>
              <Button size="sm" variant="outline" className="gap-2 h-7 text-xs" onClick={() => setDialogOpen(true)}>
                <Plus className="h-3.5 w-3.5" /> Nova Entrega
              </Button>
            </div>
          </div>
          {totalCount > 0 && (
            <div className="flex items-center gap-2 mt-1">
              <Progress value={progressPct} className="h-1.5 flex-1" />
              <span className="text-[10px] text-muted-foreground">{progressPct}%</span>
            </div>
          )}
        </CardHeader>
        <CardContent className="pt-0">
          {enrichedDeliverables.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Nenhuma entrega definida. Adiciona milestones para acompanhar o progresso.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40%]">Nome</TableHead>
                  <TableHead>Anexo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Tempo</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="w-[40px]"></TableHead>
                  <TableHead className="w-[40px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {enrichedDeliverables.map(d => {
                  const si = getStatusInfo(d.status);
                  const assignee = d.assigned_to ? profiles.find(p => p.id === d.assigned_to) : null;
                  const displayDeadline = d.computed_deadline;
                  const isOverdue = displayDeadline && d.status !== 'entregue' && new Date(displayDeadline) < new Date();
                  const linkedTask = taskByDeliverable.get(d.id);
                  const realMin = linkedTask ? (timeByTask[linkedTask.id] || 0) : 0;
                  const estMin = (d as any).estimated_minutes ?? null;
                  const hasReal = realMin > 0;
                  const hasEst = estMin != null && estMin > 0;
                  const overBudget = hasEst && hasReal && realMin > estMin * 1.1;
                  const onTrack = hasEst && hasReal && realMin <= estMin;

                  return (
                    <TableRow key={d.id} className="group">
                      <TableCell className="py-2 px-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <button
                            type="button"
                            onClick={() => { if (linkedTask) setTaskDetailId(linkedTask.id); }}
                            disabled={!linkedTask}
                            className={cn(
                              'text-sm font-medium truncate text-left',
                              linkedTask ? 'cursor-pointer hover:text-primary transition-colors' : 'cursor-default'
                            )}
                            title={linkedTask ? 'Abrir detalhes da tarefa' : undefined}
                          >
                            {d.name}
                          </button>
                          {d.is_recurring && d.recurrence_week != null && d.recurrence_weekday != null && (
                            <Badge variant="outline" className="text-[9px] shrink-0">
                              🔄 {formatRecurrenceRule(d.recurrence_week, d.recurrence_weekday)}
                            </Badge>
                          )}
                          {d.is_recurring && d.recurrence_label && d.recurrence_week == null && (
                            <Badge variant="outline" className="text-[9px] shrink-0">🔄 {d.recurrence_label}</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="py-2 px-3">
                        <DeliverableFormatCell
                          deliverable={d as any}
                          projectId={projectId}
                          projectName={projectCtx?.name}
                          clientId={projectCtx?.client_id ?? null}
                          clientName={projectCtx?.clients?.full_name ?? null}
                          defaultDepartment={projectDefaultDepartment}
                          defaultMemberIds={computeMeetingMembers(d)}
                        />
                      </TableCell>
                      <TableCell className="py-2 px-3">
                        <Select value={d.status} onValueChange={v => updateStatus.mutate({ id: d.id, status: v })}>
                          <SelectTrigger className="w-auto h-6 border-0 p-0 shadow-none focus:ring-0">
                            <Badge className={`${si.color} border-0 text-[10px] cursor-pointer`}>{si.label}</Badge>
                          </SelectTrigger>
                          <SelectContent>
                            {DELIVERABLE_STATUSES.map(s => (
                              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="py-2 px-3">
                        <Popover>
                          <PopoverTrigger asChild>
                            <button
                              className={cn(
                                'text-[11px] inline-flex items-center gap-1 hover:underline tabular-nums',
                                overBudget ? 'text-destructive font-semibold' : onTrack ? 'text-success' : 'text-muted-foreground'
                              )}
                              title={hasEst && hasReal ? `${formatMin(realMin)} de ${formatMin(estMin)}` : hasEst ? `Estimado: ${formatMin(estMin)}` : hasReal ? `Real: ${formatMin(realMin)}` : 'Definir tempo'}
                            >
                              <Clock className="h-3 w-3" />
                              {hasReal ? formatMin(realMin) : '—'}{hasEst ? ` / ${formatMin(estMin)}` : ''}
                            </button>
                          </PopoverTrigger>
                          <EstimatedTimePopover
                            currentMinutes={estMin}
                            onSave={(m) => updateEstimated.mutate({ id: d.id, estimated_minutes: m })}
                          />
                        </Popover>
                      </TableCell>
                      <TableCell className="py-2 px-3">
                        {displayDeadline ? (
                          <Popover>
                            <PopoverTrigger asChild>
                              <button className={cn(
                                'text-[11px] hover:underline',
                                isOverdue ? 'text-destructive font-semibold' : 'text-muted-foreground'
                              )}>
                                {format(new Date(displayDeadline), 'dd MMM', { locale: pt })}
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="end">
                              <Calendar
                                mode="single"
                                selected={new Date(displayDeadline)}
                                onSelect={date => {
                                  if (date) updateDeadline.mutate({ id: d.id, deadline: format(date, 'yyyy-MM-dd') });
                                }}
                                className="p-3 pointer-events-auto"
                              />
                            </PopoverContent>
                          </Popover>
                        ) : (
                          <Popover>
                            <PopoverTrigger asChild>
                              <button className="text-[11px] text-muted-foreground/60 hover:text-primary">—</button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="end">
                              <Calendar
                                mode="single"
                                onSelect={date => {
                                  if (date) updateDeadline.mutate({ id: d.id, deadline: format(date, 'yyyy-MM-dd') });
                                }}
                                className="p-3 pointer-events-auto"
                              />
                            </PopoverContent>
                          </Popover>
                        )}
                      </TableCell>
                      <TableCell className="py-2 px-2">
                        {assignee && (
                          <Avatar className="h-5 w-5">
                            <AvatarImage src={getPhotoUrl(assignee)} />
                            <AvatarFallback className="text-[7px]">{getInitials(assignee.full_name)}</AvatarFallback>
                          </Avatar>
                        )}
                      </TableCell>
                      <TableCell className="py-2 px-2">
                        <button
                          onClick={() => deleteMutation.mutate(d.id)}
                          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={v => { setDialogOpen(v); if (!v) resetForm(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Nova Entrega / Milestone</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label>Nome da entrega *</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Calendário Editorial" />
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={isRecurring} onChange={e => setIsRecurring(e.target.checked)} className="rounded" />
                <span className="text-sm">Entrega recorrente</span>
              </label>
            </div>

            {isRecurring ? (
              <div className="space-y-3 p-3 rounded-lg bg-muted/50 border">
                <p className="text-xs text-muted-foreground">Define quando esta entrega acontece todos os meses:</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Semana do mês</Label>
                    <Select value={recurrenceWeek} onValueChange={setRecurrenceWeek}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Selecionar" />
                      </SelectTrigger>
                      <SelectContent>
                        {WEEK_OPTIONS.map(o => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Dia da semana</Label>
                    <Select value={recurrenceWeekday} onValueChange={setRecurrenceWeekday}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Selecionar" />
                      </SelectTrigger>
                      <SelectContent>
                        {WEEKDAY_OPTIONS.map(o => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {computedDeadline && recurrenceWeek && recurrenceWeekday && (
                  <p className="text-xs text-muted-foreground">
                    📅 Próxima entrega: <span className="font-medium text-foreground">{format(computedDeadline, "EEEE, d 'de' MMMM", { locale: pt })}</span>
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Data de entrega</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !deadline && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {deadline ? format(deadline, 'PPP', { locale: pt }) : 'Selecionar data'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={deadline} onSelect={setDeadline} className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
            )}

            <div className="space-y-2">
              <Label>Responsável</Label>
              <Select value={assignedTo} onValueChange={setAssignedTo}>
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Sem responsável</SelectItem>
                  {serviceMembers.length > 0 && (
                    <SelectGroup>
                      <SelectLabel className="text-[10px] text-muted-foreground">Equipa de Serviço</SelectLabel>
                      {serviceMembers.map(sm => (
                        <SelectItem key={`sm-${sm.profile_id || sm.id}`} value={sm.profile_id || sm.id}>
                          {sm.full_name} ⭐
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                  <SelectGroup>
                    <SelectLabel className="text-[10px] text-muted-foreground">Todos</SelectLabel>
                    {profiles.filter(p => p.full_name).map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <Button
              className="w-full"
              onClick={() => {
                if (!name.trim()) { toast.error('Nome obrigatório'); return; }
                if (isRecurring && (!recurrenceWeek || !recurrenceWeekday)) {
                  toast.error('Seleciona a semana e o dia da semana');
                  return;
                }
                createMutation.mutate();
              }}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? 'A criar...' : 'Criar Entrega'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Import from product dialog */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Importar Entregas do Produto</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm">Selecionar Produto</Label>
              {productsWithTemplates.length === 0 ? (
                <EmptyHint>Nenhum produto com entregas definidas.</EmptyHint>
              ) : (
                <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                  <SelectTrigger><SelectValue placeholder="Escolher produto..." /></SelectTrigger>
                  <SelectContent>
                    {productsWithTemplates.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name} ({p.templates.length} fases)</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {selectedProductId && (() => {
              const product = productsWithTemplates.find(p => p.id === selectedProductId);
              if (!product) return null;
              return (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Fases que serão criadas:</Label>
                  <div className="rounded-lg border p-3 space-y-2 bg-muted/30">
                    {product.templates.map((t: any, i: number) => (
                      <div key={t.id} className="flex items-center gap-2 text-sm">
                        <span className="text-xs text-muted-foreground font-mono w-5 text-right">{i + 1}.</span>
                        <span className="font-medium">{t.name || '(sem nome)'}</span>
                        {t.description && <span className="text-xs text-muted-foreground truncate">— {t.description}</span>}
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] text-muted-foreground">As entregas serão criadas como recorrentes. Poderás depois definir as datas no projeto.</p>
                </div>
              );
            })()}

            <Button
              className="w-full"
              onClick={() => {
                if (!selectedProductId) { toast.error('Seleciona um produto'); return; }
                importMutation.mutate(selectedProductId);
              }}
              disabled={!selectedProductId || importMutation.isPending}
            >
              {importMutation.isPending ? 'A importar...' : 'Importar Entregas'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    {/* Task detail modal (mesmo da página Tarefas e Operação) */}
    <TaskFormDialog
      open={!!taskDetailId}
      onOpenChange={(open) => !open && setTaskDetailId(null)}
      editingTask={editingTask}
      onSuccess={() => {
        qc.invalidateQueries({ queryKey: ['project-deliverable-tasks', projectId] });
        qc.invalidateQueries({ queryKey: ['project-deliverables', projectId] });
      }}
    />
    </>
  );
}
