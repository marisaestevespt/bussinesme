import { useState, useMemo } from 'react';
import { TasksByMemberKanban, TasksByPriority, OverdueTasks } from '@/components/hr/PerformanceTaskViews';
import { GestaoSummaryCards } from '@/components/hr/GestaoSummaryCards';

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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Plus, Trash2, Users, BarChart3, MessageSquare, FileText, AlertTriangle, Clock, CalendarIcon } from 'lucide-react';
import { format, isSameDay, isWithinInterval, parseISO, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { pt as ptLocale } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  useTeamData, MEMBER_STATUSES, CONTRACT_TYPES, CONTRACT_STATUSES,
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

// ─── Dashboard (stats + alerts + escala, NO duplicate gallery) ──────
function TabDashboard({ team }: { team: ReturnType<typeof useTeamData> }) {
  const allMembers = (team.members.data || []).filter((m: any) => m.status === 'ativo');
  const allPayments = team.payments.data || [];
  const allContracts = team.contracts.data || [];

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

  const monthDays = useMemo(() => {
    const today = new Date();
    return eachDayOfInterval({ start: startOfMonth(today), end: endOfMonth(today) }).filter(d => d.getDay() >= 1 && d.getDay() <= 5);
  }, []);

  const holidays = useMemo(() => getPortugueseHolidays(new Date().getFullYear()), []);

  const getAvail = (member: any, day: Date): string => {
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
    if (isNational) return member.works_holidays ? 'available' : 'holiday';
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
    available: 'bg-green-100 dark:bg-green-900/30',
    off: 'bg-muted',
    vacation: 'bg-amber-100 dark:bg-amber-900/30',
    holiday: 'bg-blue-100 dark:bg-blue-900/30',
  };
  const availDots: Record<string, string> = {
    available: 'bg-green-500',
    off: 'bg-muted-foreground/30',
    vacation: 'bg-amber-500',
    holiday: 'bg-blue-500',
  };

  return (
    <div className="space-y-6">
      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center"><Users className="h-5 w-5 text-primary" /></div>
            <div><p className="text-xs text-muted-foreground">Membros ativos</p><p className="text-lg font-bold">{allMembers.length}</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center"><Clock className="h-5 w-5 text-primary" /></div>
            <div><p className="text-xs text-muted-foreground">Horas trabalhadas (mês)</p><p className="text-lg font-bold">{totalHoursMonth.toFixed(1)}h</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-destructive/10 flex items-center justify-center"><AlertTriangle className="h-5 w-5 text-destructive" /></div>
            <div><p className="text-xs text-muted-foreground">Pagamentos em atraso</p><p className="text-lg font-bold">{overduePayments.length}</p></div>
          </CardContent>
        </Card>
      </div>

      {/* Month Schedule */}
      {(escalaMembers.data || []).length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Escala do Mês — {format(new Date(), 'MMMM yyyy', { locale: ptLocale })}</h3>
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-green-500 inline-block" /> Disponível</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500 inline-block" /> Férias</span>
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
        <Card className="border-destructive/50 bg-red-50/50 dark:bg-red-950/20">
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
  const { saveMember } = useMemberSave();
  const allMembers = team.members.data || [];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-base font-semibold">Equipa</h2>
        <Button size="sm" onClick={() => setDialog({})}><Plus className="h-4 w-4 mr-1" /> Novo Membro</Button>
      </div>
      {allMembers.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">Sem membros.</CardContent></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {allMembers.map(m => (
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
                    {labelFor(MEMBER_STATUSES, m.status)}
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
                <div className="flex gap-1 pt-1">
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={e => { e.stopPropagation(); setDialog(m); }}>Editar</Button>
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={e => { e.stopPropagation(); team.deleteMember.mutate(m.id); }}>Apagar</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {dialog !== null && <MemberDialog open onClose={() => setDialog(null)} initial={dialog} onSave={saveMember} />}
      {selected && <MemberDetailSheet open onClose={() => setSelected(null)} member={selected} team={team} />}
    </div>
  );
}

// ─── Tab: Performance (automatic data only, no manual records) ──────
export function TabPerformance({ team }: { team: ReturnType<typeof useTeamData> }) {
  const [perfTab, setPerfTab] = useState('prioridade');

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <GestaoSummaryCards />

      {/* Tarefas por Membro */}
      <Card>
        <CardContent className="pt-5 space-y-4">
          <h3 className="text-sm font-semibold">Tarefas por Membro</h3>
          <TasksByMemberKanban />
        </CardContent>
      </Card>

      {/* Task views tabs */}
      <Tabs value={perfTab} onValueChange={setPerfTab}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="prioridade"><AlertTriangle className="h-3.5 w-3.5 mr-1" />Por Prioridade</TabsTrigger>
          <TabsTrigger value="atraso"><Clock className="h-3.5 w-3.5 mr-1" />Em Atraso</TabsTrigger>
        </TabsList>
        <TabsContent value="prioridade"><TasksByPriority /></TabsContent>
        <TabsContent value="atraso"><OverdueTasks /></TabsContent>
      </Tabs>

    </div>
  );
}

// ─── Feedback Session Dialog ──────
const FEEDBACK_EVENT_TYPE_ID = 'b058c64c-169c-4098-bfaf-2b1773a3c60f';

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
          start_date: startDate, event_type_id: FEEDBACK_EVENT_TYPE_ID,
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

// ─── Tab: Contratos & Pagamentos (now includes payments table) ──────
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

      {/* Contratos */}
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

      {/* Pagamentos */}
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
  { path: '/hub/recursos-humanos/performance', label: 'Gestão de Equipa', icon: BarChart3, iconColor: 'text-violet-600', color: 'from-violet-500/10 to-violet-600/5 hover:from-violet-500/20 hover:to-violet-600/10' },
  { path: '/hub/recursos-humanos/feedback', label: 'Feedback', icon: MessageSquare, iconColor: 'text-amber-600', color: 'from-amber-500/10 to-amber-600/5 hover:from-amber-500/20 hover:to-amber-600/10' },
  { path: '/hub/recursos-humanos/contratos-pagamentos', label: 'Contratos & Pagamentos', icon: FileText, iconColor: 'text-emerald-600', color: 'from-emerald-500/10 to-emerald-600/5 hover:from-emerald-500/20 hover:to-emerald-600/10' },
];

// ─── Main Page ──────
export default function ExecutiveGestaoEquipa() {
  const team = useTeamData();
  const navigate = useNavigate();

  return (
    <AppLayout>
      <div className="p-6 space-y-8">
        <PageHeader title="Pessoas" subtitle="Central de gestão de todos os membros do negócio" />

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
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

        {/* Dashboard — stats + alerts + escala only (no duplicate member gallery) */}
        <TabDashboard team={team} />
      </div>
    </AppLayout>
  );
}
