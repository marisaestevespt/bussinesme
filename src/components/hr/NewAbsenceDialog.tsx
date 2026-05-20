import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, AlertTriangle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAbsenceCoverage, computeAbsenceStatus } from '@/hooks/useAbsenceCoverage';
import { sendNotification } from '@/hooks/useNotifications';

type TeamMember = { id: string; full_name: string; profile_id: string | null; role_title: string | null; };

type AffectedTask = {
  id: string;
  name: string;
  deadline: string | null;
  project_name: string | null;
  priority: string | null;
};

export function NewAbsenceDialog({ open, onClose, members }: { open: boolean; onClose: () => void; members: TeamMember[] }) {
  const qc = useQueryClient();
  const { upsertCoverage } = useAbsenceCoverage();

  const [memberId, setMemberId] = useState('');
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [reason, setReason] = useState('');
  const [coverId, setCoverId] = useState('');

  // Confirmation modal
  const [showConfirm, setShowConfirm] = useState(false);
  const [affectedTasks, setAffectedTasks] = useState<AffectedTask[]>([]);
  const [saving, setSaving] = useState(false);

  const activeMembers = members.filter(m => m.id !== memberId);

  const absentMember = members.find(m => m.id === memberId);
  const coverMember = members.find(m => m.id === coverId);

  async function fetchAffectedTasks(): Promise<AffectedTask[]> {
    if (!absentMember?.profile_id || !startDate || !endDate) return [];
    const sStr = format(startDate, 'yyyy-MM-dd');
    const eStr = format(endDate, 'yyyy-MM-dd');

    const { data: tasks } = await supabase
      .from('tasks')
      .select('id, name, deadline, priority, project_id')
      .eq('assigned_to', absentMember.profile_id)
      .neq('status', 'done')
      .gte('deadline', sStr)
      .lte('deadline', eStr);

    if (!tasks || tasks.length === 0) return [];

    // Get project names
    const projectIds = [...new Set(tasks.filter(t => t.project_id).map(t => t.project_id!))];
    let projectMap: Record<string, string> = {};
    if (projectIds.length > 0) {
      const { data: projects } = await supabase.from('projects').select('id, name').in('id', projectIds);
      projects?.forEach(p => { projectMap[p.id] = p.name; });
    }

    return tasks.map(t => ({
      id: t.id,
      name: t.name,
      deadline: t.deadline,
      project_name: t.project_id ? (projectMap[t.project_id] || null) : null,
      priority: t.priority,
    }));
  }

  async function handleSubmit() {
    if (!memberId || !startDate || !endDate) {
      toast.error('Preencha membro e datas');
      return;
    }
    if (endDate < startDate) {
      toast.error('A data de fim não pode ser anterior à data de início');
      return;
    }

    if (coverId && coverId !== 'none') {
      // Fetch affected tasks and show confirmation
      const tasks = await fetchAffectedTasks();
      setAffectedTasks(tasks);
      setShowConfirm(true);
    } else {
      // No cover member, just save
      await saveAbsence(false);
    }
  }

  async function saveAbsence(reassign: boolean) {
    if (saving) return;
    setSaving(true);
      const sStr = format(startDate!, 'yyyy-MM-dd');
      const eStr = format(endDate!, 'yyyy-MM-dd');
      const sub = coverId && coverId !== 'none' ? coverId : null;

      const payload: any = {
        member_id: memberId,
        start_date: sStr,
        end_date: eStr,
        reason: reason || 'ausencia',
        substitute_id: sub,
        sos_notes: null,
        status: computeAbsenceStatus(sStr, eStr),
      };

      upsertCoverage.mutate(payload, {
        onSuccess: async () => {
          // Reassign tasks if confirmed
          if (reassign && sub && affectedTasks.length > 0) {
            const coverProfile = members.find(m => m.id === sub)?.profile_id;
            if (coverProfile) {
              // Batch: a single UPDATE for all affected tasks instead of N per-task updates
              await supabase
                .from('tasks')
                .update({ assigned_to: coverProfile })
                .in('id', affectedTasks.map(t => t.id));
            }

            // Send notification to owner
            const { data: ownerRoles } = await supabase.from('user_roles').select('user_id').eq('role', 'owner').limit(1);
            const ownerUserId = ownerRoles?.[0]?.user_id;
            if (ownerUserId) {
              await sendNotification({
                userId: ownerUserId,
                type: 'absence_conflict',
                title: `${affectedTasks.length} tarefa(s) de ${absentMember?.full_name} reatribuída(s) a ${coverMember?.full_name} (${format(startDate!, 'dd/MM')} - ${format(endDate!, 'dd/MM')})`,
                link: '/hub/tarefas',
              });
            }
          }

          toast.success('Ausência registada');
          qc.invalidateQueries({ queryKey: ['absence-coverage'] });
          qc.invalidateQueries({ queryKey: ['tasks_list'] });
          setSaving(false);
          resetAndClose();
        },
        onError: () => {
          toast.error('Não consegui guardar a ausência. Tenta novamente.');
          setSaving(false);
        },
      });
  }

  function resetAndClose() {
    setMemberId('');
    setStartDate(undefined);
    setEndDate(undefined);
    setReason('');
    setCoverId('');
    setShowConfirm(false);
    setAffectedTasks([]);
    onClose();
  }

  // Confirmation modal
  if (showConfirm) {
    return (
      <Dialog open onOpenChange={() => setShowConfirm(false)}>
        <DialogContent className="max-w-xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Confirmar reatribuição de tarefas
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              As seguintes tarefas de <strong>{absentMember?.full_name}</strong> entre{' '}
              <strong>{startDate && format(startDate, 'dd/MM/yyyy')}</strong> e{' '}
              <strong>{endDate && format(endDate, 'dd/MM/yyyy')}</strong> serão reatribuídas a{' '}
              <strong>{coverMember?.full_name}</strong>:
            </p>

            {affectedTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground italic py-4">
                Não existem tarefas para reatribuir neste período.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tarefa</TableHead>
                    <TableHead>Data limite</TableHead>
                    <TableHead>Projeto</TableHead>
                    <TableHead>Prioridade</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {affectedTasks.map(t => (
                    <TableRow key={t.id}>
                      <TableCell className="text-sm font-medium">{t.name}</TableCell>
                      <TableCell className="text-sm">{t.deadline ? format(parseISO(t.deadline), 'dd/MM/yyyy') : '—'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{t.project_name || '—'}</TableCell>
                      <TableCell>
                        {t.priority === 'P1' ? (
                          <Badge variant="destructive" className="text-[10px]">P1</Badge>
                        ) : t.priority === 'P2' ? (
                          <Badge variant="secondary" className="text-[10px]">P2</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => { setShowConfirm(false); }}>Cancelar</Button>
              <Button onClick={() => saveAbsence(affectedTasks.length > 0)} disabled={saving}>
                {affectedTasks.length > 0 ? 'Confirmar reatribuição' : 'Confirmar ausência'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={resetAndClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nova Ausência</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-medium">Membro ausente *</label>
            <Select value={memberId || '_'} onValueChange={v => setMemberId(v === '_' ? '' : v)}>
              <SelectTrigger><SelectValue placeholder="Selecionar membro" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_" disabled>Selecionar...</SelectItem>
                {members.map(m => <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium">Data início *</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !startDate && 'text-muted-foreground')}>
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    {startDate ? format(startDate, 'dd/MM/yyyy') : 'Selecionar'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={startDate} onSelect={setStartDate} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Data fim *</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !endDate && 'text-muted-foreground')}>
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    {endDate ? format(endDate, 'dd/MM/yyyy') : 'Selecionar'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={endDate} onSelect={setEndDate} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium">Motivo</label>
            <Input placeholder="Ex: Férias, Baixa, Folga..." value={reason} onChange={e => setReason(e.target.value)} />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium">Quem cobre</label>
            <Select value={coverId || 'none'} onValueChange={setCoverId}>
              <SelectTrigger><SelectValue placeholder="Selecionar quem cobre" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Ninguém</SelectItem>
                {activeMembers.map(m => (
                  <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button onClick={handleSubmit} className="w-full" disabled={saving}>
            Registar ausência
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
