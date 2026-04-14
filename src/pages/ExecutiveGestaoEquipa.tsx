import { useState, useMemo } from 'react';

import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Plus, Trash2, Users, MessageSquare, FileText, AlertTriangle, CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, isSameDay, isWithinInterval, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths } from 'date-fns';
import { pt as ptLocale } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  useTeamData, CONTRACT_TYPES, CONTRACT_STATUSES,
  PAYMENT_TYPES, PAYMENT_STATUSES, FEEDBACK_TYPES, WORK_AREAS, labelFor,
} from '@/hooks/useTeamData';
import { getMonthName } from '@/hooks/useExecutiveData';
import { useMemberSave } from '@/hooks/useMemberSave';
import { MemberDialog } from '@/components/hr/MemberDialog';
import { MemberDetailSheet } from '@/components/hr/MemberDetailSheet';
import {
  DeptBadge, getInitials, MemberSelect, currentYear, currentMonth,
  getPortugueseHolidays, DAY_KEY_MAP,
} from '@/components/hr/team-helpers';

// ─── Generic Form Dialog ──────
function RecordDialog({ open, onClose, title, fields, initial, onSave }: any) {
  const [f, setF] = useState(initial || {});
  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {fields.map((field: any) => {
            if (field.type === 'select') {
              return (
                <div key={field.key}>
                  <label className="text-xs text-muted-foreground">{field.label}</label>
                  <Select value={f[field.key] || field.options[0]?.value || ''} onValueChange={v => set(field.key, v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{field.options.map((o: any) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              );
            }
            if (field.type === 'textarea') {
              return (<div key={field.key}><label className="text-xs text-muted-foreground">{field.label}</label><Textarea value={f[field.key] || ''} onChange={e => set(field.key, e.target.value)} rows={2} /></div>);
            }
            if (field.type === 'number') {
              return (<div key={field.key}><label className="text-xs text-muted-foreground">{field.label}</label><Input type="number" value={f[field.key] || ''} onChange={e => set(field.key, e.target.value ? Number(e.target.value) : '')} /></div>);
            }
            return (<div key={field.key}><label className="text-xs text-muted-foreground">{field.label}</label><Input type={field.type || 'text'} value={f[field.key] || ''} onChange={e => set(field.key, e.target.value)} /></div>);
          })}
          <Button className="w-full" onClick={() => { onSave({ ...initial, ...f }); onClose(false); }}>Guardar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Dashboard (stats + escala + alerts — people-focused) ──────
function TabDashboard({ team }: { team: ReturnType<typeof useTeamData> }) {
  const [escalaMonth, setEscalaMonth] = useState(new Date());
  const allMembers = (team.members.data || []).filter((m: any) => m.status === 'ativo');
  const allPayments = team.payments.data || [];
  const allContracts = team.contracts.data || [];
  const allFeedback = team.feedback.data || [];

  const expiringContracts = useMemo(() => {
    const now = new Date();
    const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    return allContracts.filter((c: any) => c.status === 'ativo' && c.end_date && new Date(c.end_date) <= thirtyDays);
  }, [allContracts]);

  const overduePayments = useMemo(() => {
    return allPayments.filter((p: any) => {
      if (p.status !== 'por_pagar') return false;
      if (p.year < currentYear) return true;
      if (p.year === currentYear && p.month < currentMonth) return true;
      return false;
    });
  }, [allPayments]);

  const overdueByMember = useMemo(() => {
    const map: Record<string, number> = {};
    overduePayments.forEach((p: any) => { map[p.member_id] = (map[p.member_id] || 0) + 1; });
    return map;
  }, [overduePayments]);

  // Feedback stats
  const recentFeedback = useMemo(() => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    return allFeedback.filter((f: any) => f.session_date && new Date(f.session_date) >= thirtyDaysAgo);
  }, [allFeedback]);

  const memberName = (id: string) => allMembers.find((m: any) => m.id === id)?.full_name || (team.members.data || []).find((m: any) => m.id === id)?.full_name || '—';

  // Escala data
  const escalaMembers = useQuery({
    queryKey: ['dashboard-escala-members'],
    queryFn: async () => {
      const { data } = await supabase.from('team_members').select('id, full_name, photo_url, role_title, work_schedule, works_holidays, custom_holidays, status, profile_id').eq('status', 'ativo').order('full_name');
      return (data || []) as any[];
    },
  });

  const escalaVacations = useQuery({
    queryKey: ['dashboard-escala-vacations'],
    queryFn: async () => {
      const { data } = await supabase.from('team_member_vacations').select('*').order('start_date');
      return (data || []) as any[];
    },
  });

  const escalaAbsences = useQuery({
    queryKey: ['absence-coverage'],
    queryFn: async () => {
      const { data } = await supabase.from('absence_coverage').select('id, member_id, start_date, end_date, reason').order('start_date');
      return (data || []) as any[];
    },
  });

  const monthDays = useMemo(() => {
    return eachDayOfInterval({ start: startOfMonth(escalaMonth), end: endOfMonth(escalaMonth) });
  }, [escalaMonth]);

  const holidays = useMemo(() => getPortugueseHolidays(escalaMonth.getFullYear()), [escalaMonth]);

  const getAvail = (member: any, day: Date): string => {
    // Check absence_coverage first
    const abs = (escalaAbsences.data || []).filter((a: any) => a.member_id === member.id);
    for (const a of abs) {
      if (isWithinInterval(day, { start: parseISO(a.start_date), end: parseISO(a.end_date) })) return 'absence';
    }
    const vacs = (escalaVacations.data || []).filter((v: any) => v.member_id === member.id);
    for (const v of vacs) {
      if (isWithinInterval(day, { start: parseISO(v.start_date), end: parseISO(v.end_date) })) return 'vacation';
    }
    const customDates: string[] = Array.isArray(member.custom_holidays) ? member.custom_holidays : [];
    for (const d of customDates) {
      try {
        if (d.includes('|')) {
          const [s, e] = d.split('|');
          if (isWithinInterval(day, { start: parseISO(s), end: parseISO(e) })) return 'vacation';
        } else {
          if (isSameDay(parseISO(d), day)) return 'vacation';
        }
      } catch {}
    }
    const isNational = holidays.some(h => isSameDay(h, day));
    if (isNational) return 'holiday';
    if (!member.work_schedule) return 'off';
    try {
      const schedule = JSON.parse(member.work_schedule);
      const dayKey = DAY_KEY_MAP[day.getDay()];
      const val = schedule[dayKey];
      if (!val) return 'off';
      if (Array.isArray(val)) return val.length > 0 ? 'available' : 'off';
      if (typeof val === 'object' && (val.manha || val.tarde)) return 'available';
      return 'off';
    } catch { return 'off'; }
  };

  const availColors: Record<string, string> = {
    available: 'bg-emerald-100 dark:bg-emerald-900/30',
    off: 'bg-muted',
    vacation: 'bg-amber-100 dark:bg-amber-900/30',
    absence: 'bg-orange-100 dark:bg-orange-900/30',
    holiday: 'bg-blue-100 dark:bg-blue-900/30',
  };
  const availDots: Record<string, string> = {
    available: 'bg-emerald-500',
    off: 'bg-muted-foreground/30',
    vacation: 'bg-amber-500',
    holiday: 'bg-blue-500',
  };

  return (
    <div className="space-y-6">
      {/* Stats Row — people-focused */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-l-4 border-l-primary">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center"><Users className="h-5 w-5 text-primary" /></div>
            <div><p className="text-[11px] text-muted-foreground uppercase tracking-wide">Membros ativos</p><p className="text-xl font-bold">{allMembers.length}</p></div>
          </CardContent>
        </Card>
        <Card className={cn("border-l-4", expiringContracts.length > 0 ? "border-l-amber-500" : "border-l-emerald-500")}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${expiringContracts.length > 0 ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-emerald-100 dark:bg-emerald-900/30'}`}>
              <FileText className={`h-5 w-5 ${expiringContracts.length > 0 ? 'text-amber-600' : 'text-emerald-600'}`} />
            </div>
            <div><p className="text-[11px] text-muted-foreground uppercase tracking-wide">Contratos (30d)</p><p className="text-xl font-bold">{expiringContracts.length > 0 ? expiringContracts.length : '✓'}</p></div>
          </CardContent>
        </Card>
        <Card className={cn("border-l-4", overduePayments.length > 0 ? "border-l-destructive" : "border-l-emerald-500")}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${overduePayments.length > 0 ? 'bg-destructive/10' : 'bg-emerald-100 dark:bg-emerald-900/30'}`}>
              <AlertTriangle className={`h-5 w-5 ${overduePayments.length > 0 ? 'text-destructive' : 'text-emerald-600'}`} />
            </div>
            <div><p className="text-[11px] text-muted-foreground uppercase tracking-wide">Pagamentos</p><p className="text-xl font-bold">{overduePayments.length > 0 ? `${overduePayments.length} atraso` : '✓'}</p></div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-violet-500">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
              <MessageSquare className="h-5 w-5 text-violet-600" />
            </div>
            <div><p className="text-[11px] text-muted-foreground uppercase tracking-wide">Feedback (30d)</p><p className="text-xl font-bold">{recentFeedback.length}</p></div>
          </CardContent>
        </Card>
      </div>

      {/* Month Schedule */}
      {(escalaMembers.data || []).length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEscalaMonth(m => subMonths(m, 1))}><ChevronLeft className="h-4 w-4" /></Button>
                <h3 className="text-sm font-semibold">Escala — {format(escalaMonth, 'MMMM yyyy', { locale: ptLocale })}</h3>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEscalaMonth(m => addMonths(m, 1))}><ChevronRight className="h-4 w-4" /></Button>
              </div>
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" /> Disponível</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500 inline-block" /> Férias</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-orange-500 inline-block" /> Ausência</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-500 inline-block" /> Feriado</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-muted-foreground/30 inline-block" /> Folga</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    <th className="text-left font-medium text-muted-foreground py-1 pr-3 w-[140px] sticky left-0 bg-card z-10">Membro</th>
                    {monthDays.map(d => (
                      <th key={d.toISOString()} className={cn("text-center font-medium py-1 px-1 min-w-[32px]", isSameDay(d, new Date()) && "text-primary")}>
                        <div className="text-[10px]">{format(d, 'd')}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(escalaMembers.data || []).map((m: any) => (
                    <tr key={m.id} className="border-t border-border/50">
                      <td className="py-1.5 pr-3 sticky left-0 bg-card z-10">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6"><AvatarImage src={m.photo_url || undefined} /><AvatarFallback className="text-[9px]">{getInitials(m.full_name)}</AvatarFallback></Avatar>
                          <span className="truncate font-medium">{m.full_name?.split(' ')[0]}</span>
                        </div>
                      </td>
                      {monthDays.map(d => {
                        const avail = getAvail(m, d);
                        return (
                          <td key={d.toISOString()} className="py-1.5 px-1 text-center">
                            <div className={cn("mx-auto h-5 w-5 rounded-full flex items-center justify-center", availColors[avail])}>
                              <span className={cn("h-1.5 w-1.5 rounded-full", availDots[avail])} />
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {overduePayments.length > 0 && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2 text-destructive"><AlertTriangle className="h-4 w-4" /><h3 className="text-sm font-semibold">Pagamentos em atraso</h3></div>
            {Object.entries(overdueByMember).map(([memberId, count]) => (
              <div key={memberId} className="flex items-center justify-between text-sm">
                <span className="font-medium">{memberName(memberId)}</span>
                <span className="text-xs text-muted-foreground">{count} pagamento(s) pendente(s)</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Tab: Equipa (list) ──────
export function TabEquipa({ team }: { team: ReturnType<typeof useTeamData> }) {
  const [dialog, setDialog] = useState<any>(null);
  const [selected, setSelected] = useState<any>(null);
  const [showExMembers, setShowExMembers] = useState(false);
  const [offboardingDialog, setOffboardingDialog] = useState<any>(null);
  const [reassignments, setReassignments] = useState<Record<string, string>>({});
  const [settlementValue, setSettlementValue] = useState('');
  const [settlementNotes, setSettlementNotes] = useState('');
  const { saveMember } = useMemberSave();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const allMembers = team.members.data || [];
  const activeMembers = allMembers.filter((m: any) => m.status === 'ativo' || m.status === 'prestador');
  const exMembers = allMembers.filter((m: any) => m.status === 'inativo');

  // Fetch pending tasks & projects for offboarding member
  const offboardingMemberId = offboardingDialog?.profile_id;
  const { data: pendingTasks = [] } = useQuery({
    queryKey: ['offboarding-tasks', offboardingMemberId],
    enabled: !!offboardingMemberId,
    queryFn: async () => {
      const { data } = await supabase.from('tasks').select('id, name, status, deadline, project_id')
        .eq('assigned_to', offboardingMemberId)
        .not('status', 'in', '("concluida","cancelada")');
      return data || [];
    },
  });

  const { data: pendingProjects = [] } = useQuery({
    queryKey: ['offboarding-projects', offboardingDialog?.full_name],
    enabled: !!offboardingDialog,
    queryFn: async () => {
      // Projects where member is assigned via team_member link or name
      const { data } = await supabase.from('projects').select('id, name, status')
        .not('status', 'in', '("concluido","cancelado","arquivado")');
      return data || [];
    },
  });

  const otherActiveMembers = activeMembers.filter((m: any) => m.id !== offboardingDialog?.id);

  const handleStartOffboarding = (member: any) => {
    setOffboardingDialog(member);
    setReassignments({});
    setSettlementValue('');
    setSettlementNotes('');
  };

  const confirmMemberOffboarding = async () => {
    if (!offboardingDialog) return;
    const memberId = offboardingDialog.id;

    // 1. Reassign tasks
    for (const [taskId, newAssignee] of Object.entries(reassignments)) {
      if (newAssignee) {
        await supabase.from('tasks').update({ assigned_to: newAssignee }).eq('id', taskId);
      }
    }

    // 2. Update member: inactivated_at, settlement, status
    const updates: any = {
      status: 'inativo',
      inactivated_at: new Date().toISOString(),
    };
    if (settlementValue) {
      updates.settlement_value = Number(settlementValue);
      updates.settlement_date = format(new Date(), 'yyyy-MM-dd');
      updates.settlement_notes = settlementNotes || null;
    }
    await supabase.from('team_members').update(updates).eq('id', memberId);

    // 3. Create settlement expense if value > 0
    if (Number(settlementValue) > 0) {
      await supabase.from('financial_expenses').insert({
        description: `Liquidação final — ${offboardingDialog.full_name}`,
        amount: Number(settlementValue),
        category: 'pessoal',
        status: 'por_pagar',
        expense_date: format(new Date(), 'yyyy-MM-dd'),
        expense_month: new Date().getMonth() + 1,
        expense_quarter: Math.ceil((new Date().getMonth() + 1) / 3),
        expense_year: new Date().getFullYear(),
      } as any);
    }

    // 4. Terminate active contracts
    const memberContracts = (team.contracts.data || []).filter((c: any) => c.member_id === memberId && c.status === 'ativo');
    for (const c of memberContracts) {
      await supabase.from('member_contracts').update({ status: 'terminado' }).eq('id', c.id);
    }

    // 5. Create notification for owner
    const currentUser = (await supabase.auth.getUser()).data.user;
    if (currentUser) {
      await supabase.from('notifications').insert({
        user_id: currentUser.id,
        title: `Offboarding: ${offboardingDialog.full_name}`,
        message: `Membro ${offboardingDialog.full_name} marcado como inativo. Acessos serão revogados em 7 dias.`,
        type: 'team',
      });
    }

    qc.invalidateQueries({ queryKey: ['team'] });
    toast.success('Membro marcado como inativo. Acessos serão revogados automaticamente em 7 dias.');
    setOffboardingDialog(null);
  };

  const displayMembers = showExMembers ? exMembers : activeMembers;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold">Equipa</h2>
          <div className="flex rounded-lg border overflow-hidden text-xs">
            <button
              className={cn("px-3 py-1.5 transition-colors", !showExMembers ? "bg-primary text-primary-foreground" : "hover:bg-muted")}
              onClick={() => setShowExMembers(false)}
            >
              Ativos ({activeMembers.length})
            </button>
            <button
              className={cn("px-3 py-1.5 transition-colors", showExMembers ? "bg-primary text-primary-foreground" : "hover:bg-muted")}
              onClick={() => setShowExMembers(true)}
            >
              Ex-membros ({exMembers.length})
            </button>
          </div>
        </div>
        <Button size="sm" onClick={() => setDialog({})}><Plus className="h-4 w-4 mr-1" /> Novo Membro</Button>
      </div>
      {displayMembers.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">
          {showExMembers ? 'Sem ex-membros.' : 'Sem membros ativos.'}
        </CardContent></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {displayMembers.map(m => (
            <Card key={m.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelected(m)}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={(m as any).photo_url || undefined} />
                      <AvatarFallback className="text-xs font-semibold">{getInitials(m.full_name)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="font-medium text-sm">{m.full_name}</h3>
                      {m.role_title && <p className="text-xs text-muted-foreground">{m.role_title}</p>}
                    </div>
                  </div>
                  <Badge variant={m.status === 'ativo' ? 'default' : 'secondary'} className="text-[10px] shrink-0">
                    {m.status === 'ativo' ? 'Ativo' : m.status === 'inativo' ? 'Inativo' : m.status}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-1">
                  <DeptBadge dept={(m as any).departments?.length ? (m as any).departments : m.department} />
                  {Array.isArray((m as any).work_areas) && (m as any).work_areas.map((wa: string) => {
                    const opt = WORK_AREAS.find(w => w.value === wa);
                    return opt ? <Badge key={wa} variant="outline" className="text-[10px]">{opt.label}</Badge> : null;
                  })}
                </div>
                {m.email && <p className="text-xs text-muted-foreground">{m.email}</p>}
                {(m as any).inactivated_at && showExMembers && (
                  <p className="text-[10px] text-muted-foreground">Inativo desde: {format(parseISO((m as any).inactivated_at), 'dd/MM/yyyy')}</p>
                )}
                <div className="flex gap-1 pt-1">
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={e => { e.stopPropagation(); setDialog(m); }}>Editar</Button>
                  {m.status === 'ativo' && (
                    <Button variant="ghost" size="sm" className="h-7 text-xs text-amber-600" onClick={e => { e.stopPropagation(); handleStartOffboarding(m); }}>Offboarding</Button>
                  )}
                  {m.status === 'inativo' && (
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={e => {
                      e.stopPropagation();
                      team.upsertMember.mutate({ ...m, status: 'ativo', inactivated_at: null, access_revoked: false } as any);
                      toast.success('Membro reativado');
                    }}>Reativar</Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {dialog !== null && <MemberDialog open onClose={() => setDialog(null)} initial={dialog} onSave={saveMember} />}
      {selected && <MemberDetailSheet open onClose={() => setSelected(null)} member={selected} team={team} />}

      {/* Offboarding Dialog */}
      <Dialog open={!!offboardingDialog} onOpenChange={() => setOffboardingDialog(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Offboarding — {offboardingDialog?.full_name}</DialogTitle></DialogHeader>
          <div className="space-y-5">
            {/* Pending tasks for reassignment */}
            {pendingTasks.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  {pendingTasks.length} tarefa(s) pendente(s) para reatribuir
                </h3>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {pendingTasks.map((t: any) => (
                    <div key={t.id} className="flex items-center gap-2 text-sm border rounded-md p-2">
                      <span className="flex-1 truncate">{t.name}</span>
                      {t.deadline && <span className="text-[10px] text-muted-foreground shrink-0">{t.deadline}</span>}
                      <Select value={reassignments[t.id] || ''} onValueChange={v => setReassignments(p => ({ ...p, [t.id]: v }))}>
                        <SelectTrigger className="w-40 h-7 text-xs"><SelectValue placeholder="Reatribuir a..." /></SelectTrigger>
                        <SelectContent>
                          {otherActiveMembers.map((m: any) => (
                            <SelectItem key={m.id} value={m.profile_id || m.id}>{m.full_name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {pendingTasks.length === 0 && (
              <div className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
                ✓ Sem tarefas pendentes para reatribuir.
              </div>
            )}

            <Separator />

            {/* Settlement */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Liquidação Final</h3>
              <p className="text-xs text-muted-foreground">Registar valor de liquidação (será criada uma despesa automaticamente).</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Valor (€)</label>
                  <Input type="number" placeholder="0.00" value={settlementValue} onChange={e => setSettlementValue(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Notas</label>
                  <Input placeholder="Ex: férias não gozadas..." value={settlementNotes} onChange={e => setSettlementNotes(e.target.value)} />
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-2 text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
              <p>Ao confirmar:</p>
              <ul className="list-disc pl-4 space-y-1">
                <li>O membro será marcado como <strong>inativo</strong></li>
                <li>Os contratos ativos serão terminados</li>
                <li>As tarefas selecionadas serão reatribuídas</li>
                {Number(settlementValue) > 0 && <li>Será criada uma despesa de liquidação de <strong>{Number(settlementValue).toFixed(2)}€</strong></li>}
                <li>Os acessos serão <strong>revogados automaticamente em 7 dias</strong></li>
                <li>O membro ficará na tab <strong>"Ex-membros"</strong> (pode ser reativado)</li>
              </ul>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOffboardingDialog(null)}>Cancelar</Button>
              <Button variant="destructive" onClick={confirmMemberOffboarding}>Confirmar Offboarding</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Feedback Session Dialog ──────
function FeedbackDialog({ open, onClose, initial, members, onSave }: any) {
  const isEdit = !!initial?.id;
  const [f, setF] = useState(initial || {
    member_id: '', session_date: '', session_time: '', feedback_type: 'feedback_formal',
    went_well: '', to_improve: '', agreements: '', next_session: '', summary: '', transcript_url: '',
  });
  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{isEdit ? 'Editar Feedback' : 'Nova Sessão de Feedback'}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">Membro *</label>
            <Select value={f.member_id || ''} onValueChange={v => set('member_id', v)}>
              <SelectTrigger><SelectValue placeholder="Selecionar membro" /></SelectTrigger>
              <SelectContent>{members.map((m: any) => <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-xs text-muted-foreground">Data *</label><Input type="date" value={f.session_date || ''} onChange={e => set('session_date', e.target.value)} /></div>
            <div><label className="text-xs text-muted-foreground">Hora</label><Input type="time" value={f.session_time || ''} onChange={e => set('session_time', e.target.value)} /></div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Tipo</label>
            <Select value={f.feedback_type || 'feedback_formal'} onValueChange={v => set('feedback_type', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{FEEDBACK_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><label className="text-xs text-muted-foreground">Resumo</label><Textarea value={f.summary || ''} onChange={e => set('summary', e.target.value)} rows={2} /></div>
          <div><label className="text-xs text-muted-foreground">O que correu bem</label><Textarea value={f.went_well || ''} onChange={e => set('went_well', e.target.value)} rows={2} /></div>
          <div><label className="text-xs text-muted-foreground">O que melhorar</label><Textarea value={f.to_improve || ''} onChange={e => set('to_improve', e.target.value)} rows={2} /></div>
          <div><label className="text-xs text-muted-foreground">Acordos & próximos passos</label><Textarea value={f.agreements || ''} onChange={e => set('agreements', e.target.value)} rows={2} /></div>
          <div><label className="text-xs text-muted-foreground">URL da transcrição (PDF)</label><Input placeholder="https://..." value={f.transcript_url || ''} onChange={e => set('transcript_url', e.target.value)} /></div>
          <div><label className="text-xs text-muted-foreground">Próxima sessão</label><Input type="date" value={f.next_session || ''} onChange={e => set('next_session', e.target.value)} /></div>
          <Button className="w-full" disabled={!f.member_id || !f.session_date} onClick={() => { onSave({ ...initial, ...f }); onClose(false); }}>Guardar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Tab: Feedback ──────
export function TabFeedback({ team }: { team: ReturnType<typeof useTeamData> }) {
  const allMembers = team.members.data || [];
  const [filterMember, setFilterMember] = useState('');
  const [dialog, setDialog] = useState<any>(null);
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: feedbackEventType } = useQuery({
    queryKey: ['event-type', 'feedback'],
    queryFn: async () => {
      const { data } = await supabase
        .from('event_types')
        .select('id')
        .eq('slug', 'feedback')
        .maybeSingle();
      return data;
    },
    staleTime: Infinity,
  });

  const data = useMemo(() => {
    let d = team.feedback.data || [];
    if (filterMember) d = d.filter(r => r.member_id === filterMember);
    return d;
  }, [team.feedback.data, filterMember]);

  const memberName = (id: string) => allMembers.find(m => m.id === id)?.full_name || '—';

  const saveFeedback = async (rec: any) => {
    try {
      const isNew = !rec.id;
      const memberObj = allMembers.find((m: any) => m.id === rec.member_id);
      if (isNew) {
        const payload = { ...rec };
        delete payload.id;
        const startDate = rec.session_date && rec.session_time
          ? `${rec.session_date}T${rec.session_time}:00`
          : `${rec.session_date}T09:00:00`;
        const { data: eventData } = await supabase.from('events').insert({
          title: `Sessão de Feedback — ${memberObj?.full_name || 'Membro'}`,
          start_date: startDate, event_type_id: feedbackEventType?.id || null,
          department: 'recursos-humanos', created_by: user?.id || null, notes: rec.summary || null,
        }).select('id').single();
        if (eventData?.id) {
          const memberProfiles: string[] = [];
          if (user?.id) memberProfiles.push(user.id);
          if (memberObj?.profile_id && memberObj.profile_id !== user?.id) memberProfiles.push(memberObj.profile_id);
          if (memberProfiles.length > 0) {
            await supabase.from('event_members').insert(memberProfiles.map(pid => ({ event_id: eventData.id, profile_id: pid })));
          }
          payload.event_id = eventData.id;
        }
        const { error } = await supabase.from('feedback_sessions').insert(payload);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('feedback_sessions').update(rec).eq('id', rec.id);
        if (error) throw error;
      }
      qc.invalidateQueries({ queryKey: ['team'] });
      toast.success(isNew ? 'Sessão criada e adicionada à agenda!' : 'Sessão atualizada');
    } catch (err: any) {
      toast.error('Erro: ' + (err.message || err));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center gap-3 flex-wrap">
        <h2 className="text-base font-semibold">Feedback</h2>
        <div className="flex gap-2 items-center">
          <div className="w-48"><MemberSelect value={filterMember} onChange={setFilterMember} members={allMembers} /></div>
          <Button size="sm" onClick={() => setDialog({})}><Plus className="h-4 w-4 mr-1" /> Nova Sessão</Button>
        </div>
      </div>
      <Card><div className="overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Data</TableHead><TableHead>Hora</TableHead><TableHead>Membro</TableHead><TableHead>Tipo</TableHead><TableHead>Resumo</TableHead><TableHead>Transcrição</TableHead><TableHead>Próxima</TableHead><TableHead></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {data.length === 0 ? <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground text-sm py-6">Sem sessões</TableCell></TableRow> :
              data.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs">{r.session_date}</TableCell>
                  <TableCell className="text-xs">{r.session_time || '—'}</TableCell>
                  <TableCell className="text-sm">{memberName(r.member_id)}</TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px]">{labelFor(FEEDBACK_TYPES, r.feedback_type)}</Badge></TableCell>
                  <TableCell className="text-xs max-w-[150px] truncate">{r.summary || '—'}</TableCell>
                  <TableCell>{r.transcript_url ? <a href={r.transcript_url} target="_blank" rel="noopener" className="text-xs text-primary underline">PDF</a> : '—'}</TableCell>
                  <TableCell className="text-xs">{r.next_session || '—'}</TableCell>
                  <TableCell><div className="flex gap-1">
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setDialog(r)}>Editar</Button>
                    <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={() => team.deleteFeedback.mutate(r.id)}><Trash2 className="h-3 w-3" /></Button>
                  </div></TableCell>
                </TableRow>
              ))
            }
          </TableBody>
        </Table>
      </div></Card>
      {dialog !== null && <FeedbackDialog open onClose={() => setDialog(null)} initial={dialog} members={allMembers} onSave={saveFeedback} />}
    </div>
  );
}

// ─── Tab: Contratos & Pagamentos ──────
export function TabContracts({ team }: { team: ReturnType<typeof useTeamData> }) {
  const allMembers = team.members.data || [];
  const [filterMember, setFilterMember] = useState('');
  const [contractDialog, setContractDialog] = useState<any>(null);
  const [paymentDialog, setPaymentDialog] = useState<any>(null);

  const memberName = (id: string) => allMembers.find(m => m.id === id)?.full_name || '—';

  const contractsData = useMemo(() => {
    let d = team.contracts.data || [];
    if (filterMember) d = d.filter(r => r.member_id === filterMember);
    return d;
  }, [team.contracts.data, filterMember]);

  const paymentsData = useMemo(() => {
    let d = team.payments.data || [];
    if (filterMember) d = d.filter(r => r.member_id === filterMember);
    return d.sort((a, b) => (b.year - a.year) || (b.month - a.month));
  }, [team.payments.data, filterMember]);

  const contractFields = [
    { key: 'member_id', label: 'Membro', type: 'select', options: allMembers.map(m => ({ value: m.id, label: m.full_name })) },
    { key: 'contract_type', label: 'Tipo de contrato', type: 'select', options: CONTRACT_TYPES },
    { key: 'start_date', label: 'Data de início', type: 'date' },
    { key: 'end_date', label: 'Data de fim', type: 'date' },
    { key: 'status', label: 'Status', type: 'select', options: CONTRACT_STATUSES },
    { key: 'document_url', label: 'Documento (URL)', type: 'text' },
    { key: 'notes', label: 'Notas', type: 'textarea' },
  ];

  const paymentFields = [
    { key: 'member_id', label: 'Membro', type: 'select', options: allMembers.map(m => ({ value: m.id, label: m.full_name })) },
    { key: 'month', label: 'Mês', type: 'number' },
    { key: 'year', label: 'Ano', type: 'number' },
    { key: 'payment_type', label: 'Tipo', type: 'select', options: PAYMENT_TYPES },
    { key: 'gross_value', label: 'Valor Bruto (€)', type: 'number' },
    { key: 'net_value', label: 'Valor Líquido (€)', type: 'number' },
    { key: 'status', label: 'Status', type: 'select', options: PAYMENT_STATUSES },
    { key: 'document_url', label: 'Documentos (URL)', type: 'text' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center gap-3 flex-wrap">
        <h2 className="text-base font-semibold">Contratos & Pagamentos</h2>
        <div className="w-48"><MemberSelect value={filterMember} onChange={setFilterMember} members={allMembers} /></div>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-semibold">Contratos</h3>
          <Button size="sm" onClick={() => setContractDialog({})}><Plus className="h-4 w-4 mr-1" /> Novo Contrato</Button>
        </div>
        <Card><div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Membro</TableHead><TableHead>Tipo</TableHead><TableHead>Início</TableHead><TableHead>Fim</TableHead><TableHead>Status</TableHead><TableHead>Doc</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {contractsData.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground text-sm py-6">Sem contratos</TableCell></TableRow> :
                contractsData.map(c => (
                  <TableRow key={c.id}>
                    <TableCell className="text-sm">{memberName(c.member_id)}</TableCell>
                    <TableCell className="text-xs">{labelFor(CONTRACT_TYPES, c.contract_type)}</TableCell>
                    <TableCell className="text-xs">{c.start_date || '—'}</TableCell>
                    <TableCell className="text-xs">{c.end_date || '—'}</TableCell>
                    <TableCell><Badge variant={c.status === 'ativo' ? 'default' : 'secondary'} className="text-[10px]">{labelFor(CONTRACT_STATUSES, c.status)}</Badge></TableCell>
                    <TableCell>{c.document_url ? <a href={c.document_url} target="_blank" rel="noopener" className="text-xs text-primary underline">Ver</a> : '—'}</TableCell>
                    <TableCell><div className="flex gap-1">
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setContractDialog(c)}>Editar</Button>
                      <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={() => team.deleteContract.mutate(c.id)}><Trash2 className="h-3 w-3" /></Button>
                    </div></TableCell>
                  </TableRow>
                ))
              }
            </TableBody>
          </Table>
        </div></Card>
        {contractDialog !== null && <RecordDialog open onClose={() => setContractDialog(null)} title={contractDialog.id ? 'Editar Contrato' : 'Novo Contrato'} fields={contractFields} initial={contractDialog} onSave={(r: any) => team.upsertContract.mutate(r)} />}
      </div>

      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-semibold">Pagamentos</h3>
          <Button size="sm" onClick={() => setPaymentDialog({ month: currentMonth, year: currentYear })}><Plus className="h-4 w-4 mr-1" /> Novo Pagamento</Button>
        </div>
        <Card><div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Membro</TableHead><TableHead>Mês</TableHead><TableHead>Tipo</TableHead><TableHead>Bruto</TableHead><TableHead>Líquido</TableHead><TableHead>Status</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {paymentsData.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground text-sm py-6">Sem pagamentos</TableCell></TableRow> :
                paymentsData.map(p => {
                  const isOverdue = p.status === 'por_pagar' && (p.year < currentYear || (p.year === currentYear && p.month < currentMonth));
                  return (
                    <TableRow key={p.id} className={isOverdue ? 'bg-destructive/5' : ''}>
                      <TableCell className="text-sm">{memberName(p.member_id)}</TableCell>
                      <TableCell className="text-xs">{p.month && p.year ? `${getMonthName(p.month)} ${p.year}` : '—'}</TableCell>
                      <TableCell className="text-xs">{labelFor(PAYMENT_TYPES, p.payment_type)}</TableCell>
                      <TableCell className="text-xs">€{Number(p.gross_value).toLocaleString()}</TableCell>
                      <TableCell className="text-xs">€{Number(p.net_value).toLocaleString()}</TableCell>
                      <TableCell><Badge variant={p.status === 'pago' ? 'default' : isOverdue ? 'destructive' : 'secondary'} className="text-[10px]">{isOverdue ? 'Em atraso' : labelFor(PAYMENT_STATUSES, p.status)}</Badge></TableCell>
                      <TableCell><div className="flex gap-1">
                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setPaymentDialog(p)}>Editar</Button>
                        <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={() => team.deletePayment.mutate(p.id)}><Trash2 className="h-3 w-3" /></Button>
                      </div></TableCell>
                    </TableRow>
                  );
                })
              }
            </TableBody>
          </Table>
        </div></Card>
        {paymentDialog !== null && <RecordDialog open onClose={() => setPaymentDialog(null)} title={paymentDialog.id ? 'Editar Pagamento' : 'Novo Pagamento'} fields={paymentFields} initial={paymentDialog} onSave={(r: any) => team.upsertPayment.mutate(r)} />}
      </div>
    </div>
  );
}

// ─── Navigation Sections ──────
const HR_SECTIONS = [
  { path: '/hub/recursos-humanos/equipa', label: 'Equipa', icon: Users, iconColor: 'text-blue-600', color: 'from-blue-500/10 to-blue-600/5 hover:from-blue-500/20 hover:to-blue-600/10' },
  { path: '/hub/recursos-humanos/escala', label: 'Escala', icon: CalendarIcon, iconColor: 'text-orange-600', color: 'from-orange-500/10 to-orange-600/5 hover:from-orange-500/20 hover:to-orange-600/10' },
  { path: '/hub/recursos-humanos/feedback', label: 'Feedback', icon: MessageSquare, iconColor: 'text-amber-600', color: 'from-amber-500/10 to-amber-600/5 hover:from-amber-500/20 hover:to-amber-600/10' },
  { path: '/hub/recursos-humanos/contratos-pagamentos', label: 'Contratos & Pagamentos', icon: FileText, iconColor: 'text-emerald-600', color: 'from-emerald-500/10 to-emerald-600/5 hover:from-emerald-500/20 hover:to-emerald-600/10' },
];

// ─── Main Page ──────
export default function ExecutiveGestaoEquipa() {
  const team = useTeamData();
  const navigate = useNavigate();

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader title="Gestão de Equipa" subtitle="Pessoas, contratos, horários e feedback — tudo sobre a tua equipa" />

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {HR_SECTIONS.map(s => (
            <Card
              key={s.path}
              className={`group cursor-pointer border bg-gradient-to-br ${s.color} transition-all duration-200 hover:shadow-md hover:-translate-y-0.5`}
              onClick={() => navigate(s.path)}
            >
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`h-9 w-9 rounded-lg bg-background/80 flex items-center justify-center shadow-sm shrink-0 ${s.iconColor}`}>
                  <s.icon className="h-4.5 w-4.5" />
                </div>
                <span className="font-medium text-sm text-foreground">{s.label}</span>
              </CardContent>
            </Card>
          ))}
        </div>

        <Separator />

        <TabDashboard team={team} />
      </div>
    </AppLayout>
  );
}
