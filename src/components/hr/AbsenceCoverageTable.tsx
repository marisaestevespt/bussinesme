import { useState, useMemo } from 'react';
import { useAbsenceCoverage, computeAbsenceStatus } from '@/hooks/useAbsenceCoverage';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Plus, CalendarIcon, Trash2, Pencil, AlertTriangle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type TeamMember = {
  id: string;
  full_name: string;
  role_title: string | null;
  department: string | null;
  profile_id: string | null;
};

const REASON_OPTIONS = [
  { value: 'ferias', label: 'Férias' },
  { value: 'folga', label: 'Folga' },
  { value: 'baixa', label: 'Baixa' },
  { value: 'outro', label: 'Outro' },
];

const STATUS_BADGE: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  agendada: { label: 'Agendada', variant: 'secondary' },
  ativa: { label: 'Ativa', variant: 'destructive' },
  terminada: { label: 'Terminada', variant: 'outline' },
};

const FILTER_OPTIONS = [
  { value: 'todas', label: 'Todas' },
  { value: 'ativa', label: 'Ativas' },
  { value: 'agendada', label: 'Agendadas' },
];

function suggestSubstitutes(
  absentMember: TeamMember | undefined,
  members: TeamMember[],
  absentMemberId: string
): TeamMember[] {
  if (!absentMember) return members.filter(m => m.id !== absentMemberId);

  const others = members.filter(m => m.id !== absentMemberId);

  // Priority: same role > same department > owner
  const sameRole = others.filter(m => m.role_title && absentMember.role_title && m.role_title === absentMember.role_title);
  const sameDept = others.filter(m => m.department && absentMember.department && m.department === absentMember.department && !sameRole.includes(m));
  const owners = others.filter(m => {
    const r = (m.role_title || '').toLowerCase();
    return (r.includes('owner') || r.includes('fundador')) && !sameRole.includes(m) && !sameDept.includes(m);
  });
  const rest = others.filter(m => !sameRole.includes(m) && !sameDept.includes(m) && !owners.includes(m));

  return [...sameRole, ...sameDept, ...owners, ...rest];
}

export function AbsenceCoverageTable() {
  const { coverages, upsertCoverage, deleteCoverage } = useAbsenceCoverage();
  const [filter, setFilter] = useState('todas');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  // Form state
  const [memberId, setMemberId] = useState('');
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [reason, setReason] = useState('ferias');
  const [substituteId, setSubstituteId] = useState('');
  const [sosNotes, setSosNotes] = useState('');

  const { data: members = [] } = useQuery({
    queryKey: ['team-members-coverage'],
    queryFn: async () => {
      const { data } = await supabase
        .from('team_members')
        .select('id, full_name, role_title, department, profile_id')
        .eq('status', 'ativo')
        .order('full_name');
      return (data || []) as TeamMember[];
    },
  });

  // Compute live statuses
  const enriched = useMemo(() =>
    coverages.map(c => ({ ...c, _status: computeAbsenceStatus(c.start_date, c.end_date) })),
    [coverages]
  );

  const filtered = useMemo(() => {
    if (filter === 'todas') return enriched;
    return enriched.filter(c => c._status === filter);
  }, [enriched, filter]);

  const getName = (id: string) => members.find(m => m.id === id)?.full_name || '—';

  const suggestedSubstitutes = useMemo(() => {
    if (!memberId) return members;
    const absent = members.find(m => m.id === memberId);
    return suggestSubstitutes(absent, members, memberId);
  }, [memberId, members]);

  function openNew() {
    setEditing(null);
    setMemberId(''); setStartDate(undefined); setEndDate(undefined);
    setReason('ferias'); setSubstituteId(''); setSosNotes('');
    setDialogOpen(true);
  }

  function openEdit(c: any) {
    setEditing(c);
    setMemberId(c.member_id);
    setStartDate(parseISO(c.start_date));
    setEndDate(parseISO(c.end_date));
    setReason(c.reason);
    setSubstituteId(c.substitute_id || '');
    setSosNotes(c.sos_notes || '');
    setDialogOpen(true);
  }

  function handleSave() {
    if (!memberId || !startDate || !endDate) {
      toast.error('Preenche membro e datas'); return;
    }
    if (endDate < startDate) {
      toast.error('Data fim deve ser após início'); return;
    }
    const s = format(startDate, 'yyyy-MM-dd');
    const e = format(endDate, 'yyyy-MM-dd');
    const payload: any = {
      member_id: memberId,
      start_date: s,
      end_date: e,
      reason,
      substitute_id: substituteId || null,
      sos_notes: sosNotes || null,
      status: computeAbsenceStatus(s, e),
    };
    if (editing) payload.id = editing.id;
    upsertCoverage.mutate(payload, {
      onSuccess: () => {
        toast.success(editing ? 'Cobertura atualizada' : 'Ausência registada');
        setDialogOpen(false);
      },
      onError: () => toast.error('Erro ao guardar'),
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Cobertura de Ausências</h2>
        <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Nova Ausência</Button>
      </div>

      {/* Quick filter */}
      <div className="flex gap-2">
        {FILTER_OPTIONS.map(f => (
          <Button
            key={f.value}
            variant={filter === f.value ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter(f.value)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Membro ausente</TableHead>
                <TableHead>Data início</TableHead>
                <TableHead>Data fim</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead>Substituto</TableHead>
                <TableHead>Notas SOS</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    Nenhuma ausência registada.
                  </TableCell>
                </TableRow>
              )}
              {filtered.map(c => {
                const st = STATUS_BADGE[c._status] || STATUS_BADGE.agendada;
                return (
                  <TableRow key={c.id} className={cn(c._status === 'ativa' && 'bg-destructive/5')}>
                    <TableCell className="font-medium">{getName(c.member_id)}</TableCell>
                    <TableCell>{format(parseISO(c.start_date), 'dd/MM/yyyy')}</TableCell>
                    <TableCell>{format(parseISO(c.end_date), 'dd/MM/yyyy')}</TableCell>
                    <TableCell>{REASON_OPTIONS.find(r => r.value === c.reason)?.label || c.reason}</TableCell>
                    <TableCell>
                      {c.substitute_id ? getName(c.substitute_id) : (
                        <span className="text-muted-foreground flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3 text-amber-500" /> Sem substituto
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                      {c.sos_notes || '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={st.variant}>{st.label}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(c)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                          deleteCoverage.mutate(c.id, { onSuccess: () => toast.success('Removido') });
                        }}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Ausência' : 'Nova Ausência'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Member */}
            <div className="space-y-1">
              <label className="text-xs font-medium">Membro ausente</label>
              <Select value={memberId} onValueChange={setMemberId}>
                <SelectTrigger><SelectValue placeholder="Selecionar membro" /></SelectTrigger>
                <SelectContent>
                  {members.map(m => <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium">Data início</label>
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
                <label className="text-xs font-medium">Data fim</label>
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

            {/* Reason */}
            <div className="space-y-1">
              <label className="text-xs font-medium">Motivo</label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {REASON_OPTIONS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Substitute - with smart suggestions */}
            <div className="space-y-1">
              <label className="text-xs font-medium">Substituto</label>
              <Select value={substituteId} onValueChange={setSubstituteId}>
                <SelectTrigger><SelectValue placeholder="Selecionar substituto" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem substituto</SelectItem>
                  {suggestedSubstitutes.map((m, i) => {
                    const absent = members.find(x => x.id === memberId);
                    let hint = '';
                    if (absent) {
                      if (m.role_title && absent.role_title && m.role_title === absent.role_title) hint = ' (mesma função)';
                      else if (m.department && absent.department && m.department === absent.department) hint = ' (mesmo dept.)';
                      else if ((m.role_title || '').toLowerCase().includes('owner') || (m.role_title || '').toLowerCase().includes('fundador')) hint = ' (owner)';
                    }
                    return (
                      <SelectItem key={m.id} value={m.id}>
                        {m.full_name}{hint}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* SOS Notes */}
            <div className="space-y-1">
              <label className="text-xs font-medium">Notas SOS</label>
              <Textarea
                placeholder="Instruções específicas para o substituto em caso de urgência..."
                value={sosNotes}
                onChange={e => setSosNotes(e.target.value)}
                rows={3}
              />
            </div>

            <Button onClick={handleSave} className="w-full" disabled={upsertCoverage.isPending}>
              {editing ? 'Guardar alterações' : 'Registar ausência'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
