import { useState, useMemo, useEffect } from 'react';
import { useAbsenceCoverage, computeAbsenceStatus } from '@/hooks/useAbsenceCoverage';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Pencil, AlertTriangle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { sendNotification } from '@/hooks/useNotifications';

type TeamMember = {
  id: string;
  full_name: string;
  role_title: string | null;
  department: string | null;
  departments: string[] | null;
  profile_id: string | null;
  custom_holidays: any;
};

type Vacation = { id: string; member_id: string; start_date: string; end_date: string; notes: string | null };

type MergedAbsence = {
  key: string;
  member_id: string;
  start_date: string;
  end_date: string;
  reason: string;
  source: 'db_vacation' | 'custom_holiday' | 'manual';
  // From absence_coverage (if matched)
  coverage_id: string | null;
  substitute_id: string | null;
  sos_notes: string | null;
};

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

function isOwnerRole(role: string | null) {
  if (!role) return false;
  const r = role.toLowerCase();
  return r.includes('owner') || r.includes('fundador') || r.includes('ceo');
}

function suggestSubstitutes(absentMember: TeamMember | undefined, members: TeamMember[], absentMemberId: string): TeamMember[] {
  if (!absentMember) return members.filter(m => m.id !== absentMemberId);
  const others = members.filter(m => m.id !== absentMemberId);
  const absentDepts = new Set<string>([
    ...(absentMember.department ? [absentMember.department] : []),
    ...((absentMember.departments as any[]) || []).filter(Boolean).map(String),
  ]);
  const memberDepts = (m: TeamMember) => new Set<string>([
    ...(m.department ? [m.department] : []),
    ...((m.departments as any[]) || []).filter(Boolean).map(String),
  ]);
  const sharesDept = (m: TeamMember) => {
    if (absentDepts.size === 0) return false;
    for (const d of memberDepts(m)) if (absentDepts.has(d)) return true;
    return false;
  };
  const sameRole = others.filter(m => m.role_title && absentMember.role_title && m.role_title === absentMember.role_title);
  const sameDept = others.filter(m => sharesDept(m) && !sameRole.includes(m));
  const owners = others.filter(m => isOwnerRole(m.role_title) && !sameRole.includes(m) && !sameDept.includes(m));
  const rest = others.filter(m => !sameRole.includes(m) && !sameDept.includes(m) && !owners.includes(m));
  return [...sameRole, ...sameDept, ...owners, ...rest];
}

export function AbsenceCoverageTable() {
  const { coverages, upsertCoverage } = useAbsenceCoverage();
  const [filter, setFilter] = useState('todas');
  const [editingAbsence, setEditingAbsence] = useState<MergedAbsence | null>(null);
  const [substituteId, setSubstituteId] = useState('');
  const [sosNotes, setSosNotes] = useState('');

  const { data: members = [] } = useQuery({
    queryKey: ['team-members-coverage'],
    queryFn: async () => {
      const { data } = await supabase
        .from('team_members')
        .select('id, full_name, role_title, department, departments, profile_id, custom_holidays')
        .eq('status', 'ativo')
        .order('full_name');
      return (data || []) as TeamMember[];
    },
  });

  const { data: vacations = [] } = useQuery({
    queryKey: ['coverage-vacations'],
    queryFn: async () => {
      const { data } = await supabase.from('team_member_vacations').select('*').order('start_date');
      return (data || []) as Vacation[];
    },
  });

  // Merge all absence sources, excluding CEO/Owner
  const mergedAbsences = useMemo(() => {
    const result: MergedAbsence[] = [];
    const nonOwnerMembers = members.filter(m => !isOwnerRole(m.role_title));

    for (const m of nonOwnerMembers) {
      // 1. From team_member_vacations table
      const memberVacs = vacations.filter(v => v.member_id === m.id);
      for (const v of memberVacs) {
        const matched = coverages.find(c => c.member_id === m.id && c.start_date === v.start_date && c.end_date === v.end_date);
        result.push({
          key: `vac-${v.id}`,
          member_id: m.id,
          start_date: v.start_date,
          end_date: v.end_date,
          reason: 'ferias',
          source: 'db_vacation',
          coverage_id: matched?.id || null,
          substitute_id: matched?.substitute_id || null,
          sos_notes: matched?.sos_notes || null,
        });
      }

      // 2. From custom_holidays (date ranges stored as "start|end")
      const custom: string[] = Array.isArray(m.custom_holidays) ? m.custom_holidays : [];
      for (const d of custom) {
        try {
          if (d.includes('|')) {
            const [s, e] = d.split('|');
            const matched = coverages.find(c => c.member_id === m.id && c.start_date === s && c.end_date === e);
            result.push({
              key: `ch-${m.id}-${s}`,
              member_id: m.id,
              start_date: s,
              end_date: e,
              reason: 'ferias',
              source: 'custom_holiday',
              coverage_id: matched?.id || null,
              substitute_id: matched?.substitute_id || null,
              sos_notes: matched?.sos_notes || null,
            });
          }
        } catch { /* skip invalid */ }
      }
    }

    // 3. Manual entries from absence_coverage that don't match vacations (e.g. Baixa, Folga)
    for (const c of coverages) {
      const mem = members.find(m => m.id === c.member_id);
      if (mem && isOwnerRole(mem.role_title)) continue;
      const alreadyMerged = result.some(r => r.coverage_id === c.id);
      if (!alreadyMerged) {
        result.push({
          key: `manual-${c.id}`,
          member_id: c.member_id,
          start_date: c.start_date,
          end_date: c.end_date,
          reason: c.reason,
          source: 'manual',
          coverage_id: c.id,
          substitute_id: c.substitute_id,
          sos_notes: c.sos_notes,
        });
      }
    }

    // Sort by start_date ascending
    return result.sort((a, b) => a.start_date.localeCompare(b.start_date));
  }, [members, vacations, coverages]);

  const enriched = useMemo(() =>
    mergedAbsences.map(a => ({ ...a, _status: computeAbsenceStatus(a.start_date, a.end_date) })),
    [mergedAbsences]
  );

  const filtered = useMemo(() => {
    if (filter === 'todas') return enriched;
    return enriched.filter(c => c._status === filter);
  }, [enriched, filter]);

  const getName = (id: string) => members.find(m => m.id === id)?.full_name || '—';

  const suggestedSubstitutes = useMemo(() => {
    if (!editingAbsence) return members;
    const absent = members.find(m => m.id === editingAbsence.member_id);
    return suggestSubstitutes(absent, members, editingAbsence.member_id);
  }, [editingAbsence, members]);

  function openEdit(a: MergedAbsence & { _status: string }) {
    setEditingAbsence(a);
    setSubstituteId(a.substitute_id || '');
    setSosNotes(a.sos_notes || '');
  }

  async function checkConflictingTasks(memberId: string, startDate: string, endDate: string) {
    // Get the member's profile_id
    const member = members.find(m => m.id === memberId);
    if (!member?.profile_id) return;

    // Find tasks assigned to this member with deadline in the absence period
    const { data: tasks } = await supabase
      .from('tasks')
      .select('id, name, deadline, assigned_to')
      .eq('assigned_to', member.profile_id)
      .neq('status', 'done')
      .gte('deadline', startDate)
      .lte('deadline', endDate);

    if (!tasks || tasks.length === 0) return;

    // Find owner user_id
    const { data: ownerRoles } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'owner')
      .limit(1);

    const ownerUserId = ownerRoles?.[0]?.user_id;
    if (!ownerUserId) return;

    const memberName = member.full_name;
    const fmtStart = format(parseISO(startDate), 'dd/MM/yyyy');
    const fmtEnd = format(parseISO(endDate), 'dd/MM/yyyy');

    for (const task of tasks) {
      await sendNotification({
        userId: ownerUserId,
        type: 'absence_conflict',
        title: `${memberName} está ausente de ${fmtStart} a ${fmtEnd}. A tarefa '${task.name}' precisa de ser realocada.`,
        link: '/hub/tarefas',
      });
    }
  }

  function handleSave() {
    if (!editingAbsence) return;
    const payload: any = {
      member_id: editingAbsence.member_id,
      start_date: editingAbsence.start_date,
      end_date: editingAbsence.end_date,
      reason: editingAbsence.reason,
      substitute_id: substituteId && substituteId !== 'none' ? substituteId : null,
      sos_notes: sosNotes || null,
      status: computeAbsenceStatus(editingAbsence.start_date, editingAbsence.end_date),
    };
    if (editingAbsence.coverage_id) payload.id = editingAbsence.coverage_id;
    upsertCoverage.mutate(payload, {
      onSuccess: () => {
        toast.success('Cobertura atualizada');
        // Check for conflicting tasks and notify owner
        checkConflictingTasks(editingAbsence.member_id, editingAbsence.start_date, editingAbsence.end_date);
        setEditingAbsence(null);
      },
      onError: () => toast.error('Não consegui guardar a cobertura. Tenta novamente.'),
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Cobertura de Ausências</h2>
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
                <TableHead className="w-[60px]"></TableHead>
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
                  <TableRow key={c.key} className={cn(c._status === 'ativa' && 'bg-destructive/5')}>
                    <TableCell className="font-medium">{getName(c.member_id)}</TableCell>
                    <TableCell>{format(parseISO(c.start_date), 'dd/MM/yyyy')}</TableCell>
                    <TableCell>{format(parseISO(c.end_date), 'dd/MM/yyyy')}</TableCell>
                    <TableCell className="capitalize">{c.reason === 'ferias' ? 'Férias' : c.reason}</TableCell>
                    <TableCell>
                      {c.substitute_id ? getName(c.substitute_id) : (
                        <span className="text-muted-foreground flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3 text-warning" /> Sem substituto
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-muted-foreground">
                      {c.sos_notes || '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={st.variant}>{st.label}</Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" aria-label="Editar" size="icon" className="h-7 w-7" onClick={() => openEdit(c)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit substitute dialog */}
      <Dialog open={!!editingAbsence} onOpenChange={() => setEditingAbsence(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Definir Cobertura</DialogTitle>
          </DialogHeader>
          {editingAbsence && (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
                <p><strong>{getName(editingAbsence.member_id)}</strong></p>
                <p className="text-muted-foreground">
                  {format(parseISO(editingAbsence.start_date), 'dd/MM/yyyy')} → {format(parseISO(editingAbsence.end_date), 'dd/MM/yyyy')}
                </p>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium">Substituto</label>
                <Select value={substituteId || 'none'} onValueChange={setSubstituteId}>
                  <SelectTrigger><SelectValue placeholder="Selecionar substituto" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem substituto</SelectItem>
                    {suggestedSubstitutes.map(m => {
                      const absent = members.find(x => x.id === editingAbsence.member_id);
                      let hint = '';
                      if (absent) {
                        if (m.role_title && absent.role_title && m.role_title === absent.role_title) hint = ' (mesma função)';
                        else if (
                          (() => {
                            const a = new Set<string>([
                              ...(absent.department ? [absent.department] : []),
                              ...((absent.departments as any[]) || []).filter(Boolean).map(String),
                            ]);
                            const b = [
                              ...(m.department ? [m.department] : []),
                              ...((m.departments as any[]) || []).filter(Boolean).map(String),
                            ];
                            return b.some(d => a.has(d));
                          })()
                        ) hint = ' (mesmo dept.)';
                        else if (isOwnerRole(m.role_title)) hint = ' (owner)';
                      }
                      return <SelectItem key={m.id} value={m.id}>{m.full_name}{hint}</SelectItem>;
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium">Notas SOS</label>
                <Textarea
                  placeholder="Instruções para o substituto em caso de urgência..."
                  value={sosNotes}
                  onChange={e => setSosNotes(e.target.value)}
                  rows={3}
                />
              </div>

              <Button onClick={handleSave} className="w-full" disabled={upsertCoverage.isPending}>
                Guardar cobertura
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
