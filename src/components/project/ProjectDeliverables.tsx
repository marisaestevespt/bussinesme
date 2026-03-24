import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Progress } from '@/components/ui/progress';
import { Plus, Package, CalendarIcon, Trash2, GripVertical } from 'lucide-react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const DELIVERABLE_STATUSES = [
  { value: 'pendente', label: 'Pendente', color: 'bg-gray-100 text-gray-700' },
  { value: 'em_curso', label: 'Em curso', color: 'bg-blue-100 text-blue-800' },
  { value: 'entregue', label: 'Entregue', color: 'bg-green-100 text-green-800' },
  { value: 'atrasado', label: 'Atrasado', color: 'bg-red-100 text-red-800' },
];

function getStatusInfo(v: string) {
  return DELIVERABLE_STATUSES.find(s => s.value === v) || DELIVERABLE_STATUSES[0];
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

export function ProjectDeliverables({ projectId, profiles }: { projectId: string; profiles: Profile[] }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState('');
  const [deadline, setDeadline] = useState<Date | undefined>();
  const [assignedTo, setAssignedTo] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceLabel, setRecurrenceLabel] = useState('');
  const qc = useQueryClient();

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

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('project_deliverables').insert({
        project_id: projectId,
        name,
        deadline: deadline ? format(deadline, 'yyyy-MM-dd') : null,
        assigned_to: assignedTo || null,
        is_recurring: isRecurring,
        recurrence_label: isRecurring ? recurrenceLabel : null,
        sort_order: deliverables.length,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project-deliverables', projectId] });
      toast.success('Entrega criada');
      setDialogOpen(false);
      setName(''); setDeadline(undefined); setAssignedTo(''); setIsRecurring(false); setRecurrenceLabel('');
    },
    onError: () => toast.error('Erro ao criar entrega'),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from('project_deliverables').update({ status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project-deliverables', projectId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('project_deliverables').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project-deliverables', projectId] });
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
      toast.success('Data atualizada');
    },
  });

  const doneCount = deliverables.filter(d => d.status === 'entregue').length;
  const totalCount = deliverables.length;
  const progressPct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

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
            <Button size="sm" variant="outline" className="gap-1.5 h-7 text-xs" onClick={() => setDialogOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> Nova Entrega
            </Button>
          </div>
          {totalCount > 0 && (
            <div className="flex items-center gap-2 mt-1">
              <Progress value={progressPct} className="h-1.5 flex-1" />
              <span className="text-[10px] text-muted-foreground">{progressPct}%</span>
            </div>
          )}
        </CardHeader>
        <CardContent className="pt-0">
          {deliverables.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Nenhuma entrega definida. Adiciona milestones para acompanhar o progresso.
            </p>
          ) : (
            <div className="space-y-1">
              {deliverables.map(d => {
                const si = getStatusInfo(d.status);
                const assignee = d.assigned_to ? profiles.find(p => p.id === d.assigned_to) : null;
                const isOverdue = d.deadline && d.status !== 'entregue' && new Date(d.deadline) < new Date();

                return (
                  <div key={d.id} className="flex items-center gap-2 py-2 px-2 rounded-lg hover:bg-muted/40 transition-colors group">
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

                    <span className="flex-1 text-sm font-medium truncate">{d.name}</span>

                    {d.is_recurring && d.recurrence_label && (
                      <Badge variant="outline" className="text-[9px] shrink-0">🔄 {d.recurrence_label}</Badge>
                    )}

                    {d.deadline && (
                      <Popover>
                        <PopoverTrigger asChild>
                          <button className={cn(
                            "text-[10px] shrink-0 hover:underline",
                            isOverdue ? "text-destructive font-semibold" : "text-muted-foreground"
                          )}>
                            {format(new Date(d.deadline), 'dd MMM', { locale: pt })}
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="end">
                          <Calendar
                            mode="single"
                            selected={new Date(d.deadline)}
                            onSelect={date => {
                              if (date) updateDeadline.mutate({ id: d.id, deadline: format(date, 'yyyy-MM-dd') });
                            }}
                            className="p-3 pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                    )}

                    {assignee && (
                      <Avatar className="h-5 w-5 shrink-0">
                        <AvatarImage src={assignee.avatar_url || ''} />
                        <AvatarFallback className="text-[7px]">{getInitials(assignee.full_name)}</AvatarFallback>
                      </Avatar>
                    )}

                    <button
                      onClick={() => deleteMutation.mutate(d.id)}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity shrink-0"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Nova Entrega / Milestone</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Nome da entrega *</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Calendário Editorial" />
            </div>
            <div className="space-y-1.5">
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
            <div className="space-y-1.5">
              <Label>Responsável</Label>
              <Select value={assignedTo} onValueChange={setAssignedTo}>
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Sem responsável</SelectItem>
                  {profiles.filter(p => p.full_name).map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={isRecurring} onChange={e => setIsRecurring(e.target.checked)} className="rounded" />
                <span className="text-sm">Entrega recorrente</span>
              </label>
              {isRecurring && (
                <Input value={recurrenceLabel} onChange={e => setRecurrenceLabel(e.target.value)} placeholder="Ex: Mensal" className="flex-1 h-8 text-sm" />
              )}
            </div>
            <Button
              className="w-full"
              onClick={() => {
                if (!name.trim()) { toast.error('Nome obrigatório'); return; }
                createMutation.mutate();
              }}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? 'A criar...' : 'Criar Entrega'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
