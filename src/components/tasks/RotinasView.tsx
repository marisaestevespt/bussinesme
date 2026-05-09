import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Pencil, Trash2, Play, Repeat } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PROCESS_DEPARTMENTS } from '@/lib/departments';

const RECURRENCE_OPTIONS = [
  { value: 'diario', label: 'Diária' },
  { value: 'semanal', label: 'Semanal' },
  { value: 'quinzenal', label: 'Quinzenal' },
  { value: 'mensal', label: 'Mensal (dia específico)' },
  { value: 'mensal_primeiro', label: '1º dia do mês' },
  { value: 'mensal_ultimo', label: 'Último dia do mês' },
  { value: 'primeiro_dia_util', label: '1º dia útil do mês' },
  { value: 'ultimo_dia_util', label: 'Último dia útil do mês' },
];

const WEEKDAYS = [
  { value: 1, label: 'Segunda' },
  { value: 2, label: 'Terça' },
  { value: 3, label: 'Quarta' },
  { value: 4, label: 'Quinta' },
  { value: 5, label: 'Sexta' },
  { value: 6, label: 'Sábado' },
  { value: 7, label: 'Domingo' },
];

export function RotinasView() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [recurrenceType, setRecurrenceType] = useState('semanal');
  const [weekday, setWeekday] = useState<number | null>(null);
  const [monthDay, setMonthDay] = useState<number | null>(null);
  const [roleFunction, setRoleFunction] = useState('');
  const [department, setDepartment] = useState('');
  const [sopId, setSopId] = useState('');
  const [estimatedTime, setEstimatedTime] = useState('');
  const [format, setFormat] = useState<'tarefa' | 'reuniao' | 'entrega'>('tarefa');
  const [estimatedMinutes, setEstimatedMinutes] = useState('');
  const [hourTime, setHourTime] = useState('');
  const [adjustBizDay, setAdjustBizDay] = useState(true);
  const [active, setActive] = useState(true);

  // Data
  const { data: routines = [], isLoading } = useQuery({
    queryKey: ['planning-routines'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('planning_routines')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: sops = [] } = useQuery({
    queryKey: ['sops-list-simple'],
    queryFn: async () => {
      const { data } = await supabase.from('sops').select('id, name').order('name');
      return data || [];
    },
  });

  const { data: teamMembers = [] } = useQuery({
    queryKey: ['team', 'members'],
    queryFn: async () => {
      const { data } = await supabase.from('team_members').select('id, full_name, role_title, status').eq('status', 'ativo');
      return data || [];
    },
  });

  // Unique roles from team
  const uniqueRoles = useMemo(() => {
    const roles = new Set<string>();
    teamMembers.forEach(m => { if (m.role_title) roles.add(m.role_title); });
    return Array.from(roles).sort();
  }, [teamMembers]);

  const upsert = useMutation({
    mutationFn: async (payload: any) => {
      if (editing) {
        const { error } = await supabase.from('planning_routines').update(payload).eq('id', editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('planning_routines').insert({ ...payload, created_by: user?.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['planning-routines'] });
      toast.success(editing ? 'Rotina atualizada' : 'Rotina criada');
      closeDialog();
    },
    onError: () => toast.error('Erro ao guardar rotina'),
  });

  const deleteRoutine = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('planning_routines').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['planning-routines'] });
      toast.success('Rotina eliminada');
      closeDialog();
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from('planning_routines').update({ active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['planning-routines'] }),
  });

  // Trigger manual generation
  const triggerGeneration = useMutation({
    mutationFn: async () => {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(`https://${projectId}.supabase.co/functions/v1/generate-routine-tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
      });
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      toast.success(`Tarefas geradas: ${data.created}`);
    },
    onError: () => toast.error('Erro ao gerar tarefas'),
  });

  function openNew() {
    setEditing(null);
    setTitle(''); setRecurrenceType('semanal'); setWeekday(null); setMonthDay(null);
    setRoleFunction(''); setDepartment(''); setSopId(''); setEstimatedTime('');
    setFormat('tarefa'); setEstimatedMinutes('');
    setHourTime(''); setAdjustBizDay(true); setActive(true);
    setDialogOpen(true);
  }

  function openEdit(r: any) {
    setEditing(r);
    setTitle(r.title); setRecurrenceType(r.recurrence_type);
    setWeekday(r.weekday); setMonthDay(r.month_day);
    setRoleFunction(r.role_function || ''); setDepartment(r.department || '');
    setSopId(r.sop_id || ''); setEstimatedTime(r.estimated_time != null ? String(r.estimated_time) : '');
    setFormat((r.format as any) || 'tarefa');
    setEstimatedMinutes(r.estimated_minutes != null ? String(r.estimated_minutes) : '');
    setHourTime(r.hour_time || ''); setAdjustBizDay(r.adjust_to_business_day); setActive(r.active);
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditing(null);
  }

  function handleSave() {
    if (!title.trim()) { toast.error('Indica o nome da rotina'); return; }
    if ((recurrenceType === 'semanal' || recurrenceType === 'quinzenal') && weekday == null) {
      toast.error('Seleciona o dia da semana'); return;
    }
    if (recurrenceType === 'mensal' && monthDay == null) {
      toast.error('Indica o dia do mês'); return;
    }

    const payload: any = {
      title: title.trim(),
      recurrence_type: recurrenceType,
      weekday: ['semanal', 'quinzenal'].includes(recurrenceType) ? weekday : null,
      month_day: recurrenceType === 'mensal' ? monthDay : null,
      role_function: roleFunction || null,
      department: department || null,
      sop_id: sopId || null,
      estimated_time: estimatedTime ? parseFloat(estimatedTime) : null,
      format,
      estimated_minutes: estimatedMinutes ? parseInt(estimatedMinutes) : (estimatedTime ? Math.round(parseFloat(estimatedTime) * 60) : null),
      hour_time: hourTime || null,
      adjust_to_business_day: adjustBizDay,
      active,
    };
    upsert.mutate(payload);
  }

  const getRecurrenceLabel = (r: any) => {
    const base = RECURRENCE_OPTIONS.find(o => o.value === r.recurrence_type)?.label || r.recurrence_type;
    if (['semanal', 'quinzenal'].includes(r.recurrence_type) && r.weekday != null) {
      return `${base} — ${WEEKDAYS.find(w => w.value === r.weekday)?.label || ''}`;
    }
    if (r.recurrence_type === 'mensal' && r.month_day != null) {
      return `${base} — dia ${r.month_day}`;
    }
    return base;
  };

  const getSopName = (id: string | null) => {
    if (!id) return '—';
    return sops.find(s => s.id === id)?.name || '—';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Rotinas geram tarefas automaticamente todos os dias às 6h.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => triggerGeneration.mutate()} disabled={triggerGeneration.isPending}>
            <Play className="h-4 w-4 mr-1" /> Gerar agora
          </Button>
          <Button size="sm" onClick={openNew}>
            <Plus className="h-4 w-4 mr-1" /> Nova Rotina
          </Button>
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Rotina</TableHead>
              <TableHead>Recorrência</TableHead>
              <TableHead>Função</TableHead>
              <TableHead>Departamento</TableHead>
              <TableHead>SOP</TableHead>
              <TableHead>Ativa</TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {routines.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  Sem rotinas definidas. Cria a primeira!
                </TableCell>
              </TableRow>
            )}
            {routines.map((r: any) => (
              <TableRow key={r.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openEdit(r)}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <Repeat className="h-3.5 w-3.5 text-muted-foreground" />
                    {r.title}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">{getRecurrenceLabel(r)}</Badge>
                </TableCell>
                <TableCell className="text-sm">{r.role_function || '—'}</TableCell>
                <TableCell className="text-sm">
                  {r.department ? (PROCESS_DEPARTMENTS.find(d => d.value === r.department)?.label || r.department) : '—'}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{getSopName(r.sop_id)}</TableCell>
                <TableCell>
                  <Switch
                    checked={r.active}
                    onCheckedChange={(val) => { toggleActive.mutate({ id: r.id, active: val }); }}
                    onClick={(e) => e.stopPropagation()}
                  />
                </TableCell>
                <TableCell>
                  <Button variant="ghost" aria-label="Editar" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); openEdit(r); }}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Rotina' : 'Nova Rotina'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            <div>
              <Label>Nome da rotina *</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Validar faturas" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Recorrência *</Label>
                <Select value={recurrenceType} onValueChange={setRecurrenceType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {RECURRENCE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {['semanal', 'quinzenal'].includes(recurrenceType) && (
                <div>
                  <Label>Dia da semana *</Label>
                  <Select value={weekday != null ? String(weekday) : ''} onValueChange={v => setWeekday(Number(v))}>
                    <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                    <SelectContent>
                      {WEEKDAYS.map(w => <SelectItem key={w.value} value={String(w.value)}>{w.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {recurrenceType === 'mensal' && (
                <div>
                  <Label>Dia do mês *</Label>
                  <Input type="number" min={1} max={31} value={monthDay ?? ''} onChange={e => setMonthDay(Number(e.target.value) || null)} />
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Função responsável</Label>
                <Select value={roleFunction} onValueChange={v => setRoleFunction(v === '_none' ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="Selecionar função" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Nenhuma</SelectItem>
                    {uniqueRoles.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground mt-0.5">A tarefa será atribuída à pessoa com esta função na equipa</p>
              </div>

              <div>
                <Label>Departamento</Label>
                <Select value={department} onValueChange={v => setDepartment(v === '_none' ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Nenhum</SelectItem>
                    {PROCESS_DEPARTMENTS.map(d => <SelectItem key={d.value} value={d.value}>{d.icon} {d.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>SOP associado</Label>
                <Select value={sopId} onValueChange={v => setSopId(v === '_none' ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Nenhum</SelectItem>
                    {sops.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Tempo estimado (horas)</Label>
                <Input type="number" step="0.5" min="0" value={estimatedTime} onChange={e => setEstimatedTime(e.target.value)} placeholder="Ex: 1.5" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Hora (opcional)</Label>
                <Input type="time" value={hourTime} onChange={e => setHourTime(e.target.value)} />
                <p className="text-[10px] text-muted-foreground mt-0.5">Deixa vazio se não tem hora fixa</p>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Switch checked={adjustBizDay} onCheckedChange={setAdjustBizDay} />
                <Label className="text-sm">Ajustar para dia útil</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={active} onCheckedChange={setActive} />
                <Label className="text-sm">Ativa</Label>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 mt-4">
            {editing && (
              <Button variant="destructive" size="sm" onClick={() => deleteRoutine.mutate(editing.id)}>
                <Trash2 className="h-4 w-4 mr-1" /> Eliminar
              </Button>
            )}
            <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
            <Button onClick={handleSave} disabled={upsert.isPending}>
              {editing ? 'Guardar' : 'Criar Rotina'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
