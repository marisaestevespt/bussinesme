import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Plus, Trash2, CheckSquare, CalendarIcon, CalendarDays, ExternalLink, FileText, Link2, Loader2, CheckCircle2, Crown, UserMinus, Eye } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, parseISO, isWithinInterval, getDay, startOfMonth, endOfMonth, eachDayOfInterval, startOfDay } from 'date-fns';
import { getHolidaySet } from '@/lib/holidays';
import {
  MEMBER_STATUSES, MEMBER_TYPES, CONTRACT_TYPES, CONTRACT_STATUSES,
  PAYMENT_TYPES, PAYMENT_STATUSES, FEEDBACK_TYPES, labelFor,
} from '@/hooks/useTeamData';
import { getMonthName } from '@/hooks/useExecutiveData';
import { DeptBadge, currentYear, currentMonth, scheduleToLines } from './team-helpers';
import { isTaskDone, isTaskOpen } from '@/lib/taskStatus';
import { deriveContractStatus } from '@/lib/contractStatus';
import { EmptyHint } from '@/components/ui/loading-skeletons';
import { EntityIconPicker, parseIcon } from '@/components/entity-icon';
import { MemberQuickLinks } from './MemberQuickLinks';
import { Progress } from '@/components/ui/progress';
import { useImpersonation } from '@/contexts/ImpersonationContext';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { OnboardingItem } from '@/components/onboarding/OnboardingItem';
import { requireConfirm, confirmDestructive } from '@/lib/confirmDestructive';

function MemberIconBlock({ member }: { member: any }) {
  const qc = useQueryClient();
  const fallback = member?.photo_url ? { type: 'image' as const, value: member.photo_url } : null;
  const icon = parseIcon(member?.icon) ?? fallback;
  return (
    <div className="-mb-1">
      <EntityIconPicker
        icon={icon}
        onChange={async (next) => {
          await supabase.from('team_members').update({ icon: next as any, photo_url: next?.type === 'image' ? next.value : member?.photo_url || null }).eq('id', member.id);
          qc.invalidateQueries({ queryKey: ['team_members'] });
        }}
        bucket="entity-icons"
        pathPrefix={`team-members/${member.id}`}
        className="h-16 w-16"
        emojiClassName="text-3xl"
        variant="circle"
      />
    </div>
  );
}

export function MemberDetailSheet({ open, onClose, member, team, onOffboard }: any) {
  const [newTask, setNewTask] = useState('');
  const [detailTab, setDetailTab] = useState('info');
  const [vacStart, setVacStart] = useState('');
  const [vacEnd, setVacEnd] = useState('');
  const [vacNotes, setVacNotes] = useState('');
  const [generatingLink, setGeneratingLink] = useState(false);
  const qc = useQueryClient();
  const { isOwner } = useAuth();
  const { startImpersonation, impersonating } = useImpersonation();
  const navigate = useNavigate();

  const handleImpersonate = async () => {
    if (!member?.id) return;
    try {
      await startImpersonation(member.id);
      toast.success(`A pré-visualizar como ${member.full_name}`);
      onClose?.();
      navigate('/hub/secretaria');
    } catch (e: any) {
      toast.error('Falha ao iniciar pré-visualização', { description: e?.message });
    }
  };

  const handleCopyInviteLink = async () => {
    if (!member?.email) {
      toast.error('Este membro não tem email definido.');
      return;
    }
    setGeneratingLink(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-invite-link', {
        body: { email: member.email },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.invite_url) {
        await navigator.clipboard.writeText(data.invite_url);
        toast.success(data.email_sent ? 'Email enviado e link de convite copiado!' : 'Link de convite copiado!');
      } else if (data?.email_sent) {
        toast.success('Email de convite enviado!');
      } else {
        toast.error(data?.invite_error || 'Não foi possível gerar o link.');
      }
    } catch (err: any) {
      toast.error('Erro: ' + (err.message || err));
    } finally {
      setGeneratingLink(false);
    }
  };

  // Onboarding is handled in person — no welcome email is sent for team members.

  const memberTasks = useQuery({
    queryKey: ['member-tasks', member?.profile_id],
    enabled: !!member?.profile_id,
    queryFn: async () => {
      const { data } = await supabase.from('tasks').select('*').eq('assigned_to', member.profile_id).order('created_at', { ascending: false }).limit(50);
      return data || [];
    },
  });

  const memberTime = useQuery({
    queryKey: ['member-time', member?.id],
    enabled: !!member?.id,
    queryFn: async () => {
      const { data } = await supabase.from('time_entries').select('*').eq('member_id', member.id).order('entry_date', { ascending: false }).limit(50);
      return data || [];
    },
  });

  const memberFeedback = useQuery({
    queryKey: ['member-feedback', member?.id],
    enabled: !!member?.id,
    queryFn: async () => {
      const { data } = await supabase.from('feedback_sessions').select('*').eq('member_id', member.id).order('session_date', { ascending: false });
      return data || [];
    },
  });

  const memberVacations = useQuery({
    queryKey: ['member-vacations', member?.id],
    enabled: !!member?.id,
    queryFn: async () => {
      const { data } = await supabase.from('team_member_vacations').select('*').eq('member_id', member.id).order('start_date', { ascending: false });
      return data || [];
    },
  });

  const handleAddVacation = async () => {
    if (!vacStart || !vacEnd) { toast.error('Selecione as datas'); return; }
    if (vacEnd < vacStart) { toast.error('Data fim deve ser após início'); return; }

    // Validate overlap
    const existing = memberVacations.data || [];
    const newStart = parseISO(vacStart);
    const newEnd = parseISO(vacEnd);
    const hasOverlap = existing.some((v: any) => {
      try {
        const eStart = parseISO(v.start_date);
        const eEnd = parseISO(v.end_date);
        return isWithinInterval(newStart, { start: eStart, end: eEnd }) ||
               isWithinInterval(newEnd, { start: eStart, end: eEnd }) ||
               isWithinInterval(eStart, { start: newStart, end: newEnd });
      } catch { return false; }
    });
    if (hasOverlap) { toast.error('Este período sobrepõe-se a férias já registadas'); return; }

    const { error } = await supabase.from('team_member_vacations').insert({
      member_id: member.id, start_date: vacStart, end_date: vacEnd, notes: vacNotes || null,
    });
    if (error) toast.error('Não consegui guardar a membro. Tenta novamente.');
    else { toast.success('Férias adicionadas'); setVacStart(''); setVacEnd(''); setVacNotes(''); qc.invalidateQueries({ queryKey: ['member-vacations', member.id] }); qc.invalidateQueries({ queryKey: ['escala-vacations'] }); }
  };

  const handleDeleteVacation = async (id: string) => {
    if (!(await confirmDestructive())) return;
    await supabase.from('team_member_vacations').delete().eq('id', id);
    toast.success('Férias removidas');
    qc.invalidateQueries({ queryKey: ['member-vacations', member.id] });
    qc.invalidateQueries({ queryKey: ['escala-vacations'] });
  };

  const items = (team.onboarding.data || []).filter((i: any) => i.member_id === member.id);
  const onbTotal = items.length;
  const onbDone = items.filter((i: any) => i.completed).length;
  const onbPct = onbTotal > 0 ? Math.round((onbDone / onbTotal) * 100) : 0;
  const onbOverdue = items.filter((i: any) => !i.completed && i.deadline_date && parseISO(i.deadline_date) < startOfDay(new Date())).length;
  const onbNextDue = items
    .filter((i: any) => !i.completed && i.deadline_date)
    .sort((a: any, b: any) => a.deadline_date.localeCompare(b.deadline_date))[0];
  const contracts = (team.contracts.data || []).filter((c: any) => c.member_id === member.id);
  const payments = (team.payments.data || []).filter((p: any) => p.member_id === member.id);
  const totalHours = (memberTime.data || []).reduce((s: number, e: any) => s + Number(e.duration || 0), 0);
  const monthHours = (memberTime.data || []).filter((e: any) => e.entry_month === currentMonth && e.entry_year === currentYear).reduce((s: number, e: any) => s + Number(e.duration || 0), 0);
  const pendingTasks = (memberTasks.data || []).filter(isTaskOpen).length;
  const feedbackSessions = memberFeedback.data || [];

  // Vacation business days count
  const vacationDays = (() => {
    const yearStart = new Date(currentYear, 0, 1);
    const yearEnd = new Date(currentYear, 11, 31);
    let businessDays = 0;
    (memberVacations.data || []).forEach((v: any) => {
      try {
        let s = parseISO(v.start_date);
        let e = parseISO(v.end_date);
        if (s < yearStart) s = yearStart;
        if (e > yearEnd) e = yearEnd;
        const current = new Date(s);
        while (current <= e) {
          const day = current.getDay();
          if (day !== 0 && day !== 6) businessDays++;
          current.setDate(current.getDate() + 1);
        }
      } catch {}
    });
    return businessDays;
  })();

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl w-[95vw] max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-4">
            <MemberIconBlock member={member} />
            <div className="flex items-center gap-2">
              <DialogTitle className="text-xl">{member.full_name}</DialogTitle>
              {member.email && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-2"
                  onClick={handleCopyInviteLink}
                  disabled={generatingLink}
                >
                  {generatingLink ? <Loader2 className="h-3 w-3 animate-spin" /> : <Link2 className="h-3 w-3" />}
                  Copiar link de convite
                </Button>
              )}
              {member.status === 'ativo' && onOffboard && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-2 text-warning hover:text-warning"
                  onClick={() => onOffboard(member)}
                >
                  <UserMinus className="h-3 w-3" />
                  Iniciar offboarding
                </Button>
              )}
              {isOwner && member.status === 'ativo' && !impersonating && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-2"
                  onClick={handleImpersonate}
                >
                  <Eye className="h-3 w-3" />
                  Ver como este membro
                </Button>
              )}
            </div>
            {member.role_title && <p className="text-sm text-muted-foreground mt-0.5">{member.role_title}</p>}
          </div>
        </DialogHeader>
        <div className="space-y-4 mt-4">
          <div className="space-y-2">
            <div className="flex gap-2 flex-wrap">
              <Badge variant={member.status === 'ativo' ? 'default' : 'secondary'}>{labelFor(MEMBER_STATUSES, member.status)}</Badge>
              <Badge variant="outline">{labelFor(MEMBER_TYPES, member.member_type)}</Badge>
            </div>
            <div className="flex gap-2 flex-wrap">
              {(member.role_title || '').toLowerCase() === 'owner' ? (
                <Badge className="text-xs gap-1 bg-warning/15 text-warning hover:bg-warning/20 border-warning/30">
                  <Crown className="h-3 w-3" /> Owner — acesso total
                </Badge>
              ) : (
                <>
                  {member.role_title && <Badge className="text-xs text-white" style={{ backgroundColor: member.role_color || '#6366f1' }}>{member.role_title}</Badge>}
                  <DeptBadge dept={member.department} />
                </>
              )}
            </div>
          </div>

          <div className={`grid ${onbTotal > 0 ? 'grid-cols-5' : 'grid-cols-4'} gap-2`}>
            <div className="bg-muted/50 rounded-lg p-2 text-center"><p className="text-xs text-muted-foreground">Horas (mês)</p><p className="font-bold text-sm">{monthHours.toFixed(1)}h</p></div>
            <div className="bg-muted/50 rounded-lg p-2 text-center"><p className="text-xs text-muted-foreground">Horas (total)</p><p className="font-bold text-sm">{totalHours.toFixed(1)}h</p></div>
            <div className="bg-muted/50 rounded-lg p-2 text-center"><p className="text-xs text-muted-foreground">Tarefas ativas</p><p className="font-bold text-sm">{pendingTasks}</p></div>
            <div className="bg-muted/50 rounded-lg p-2 text-center"><p className="text-xs text-muted-foreground">Sessões feedback</p><p className="font-bold text-sm">{feedbackSessions.length}</p></div>
            {onbTotal > 0 && (
              <button
                type="button"
                onClick={() => setDetailTab('onboarding')}
                className={`rounded-lg p-2 text-center transition hover:opacity-80 ${onbPct === 100 ? 'bg-primary/15' : onbOverdue > 0 ? 'bg-destructive/10' : 'bg-muted/50'}`}
              >
                <p className="text-xs text-muted-foreground">Onboarding</p>
                <p className="font-bold text-sm flex items-center justify-center gap-1">
                  {onbPct === 100 && <CheckCircle2 className="h-3 w-3 text-primary" />}
                  {onbDone}/{onbTotal}
                </p>
              </button>
            )}
          </div>

          <Tabs value={detailTab} onValueChange={setDetailTab}>
            <TabsList className="w-full">
              <TabsTrigger value="info" className="text-xs flex-1">Info</TabsTrigger>
              <TabsTrigger value="tarefas" className="text-xs flex-1">Tarefas</TabsTrigger>
              <TabsTrigger value="tempo" className="text-xs flex-1">Tempo</TabsTrigger>
              <TabsTrigger value="contrato" className="text-xs flex-1">Contrato</TabsTrigger>
              <TabsTrigger value="pagamentos" className="text-xs flex-1">Pagamentos</TabsTrigger>
              <TabsTrigger value="feedback" className="text-xs flex-1">Feedback</TabsTrigger>
              <TabsTrigger value="ferias" className="text-xs flex-1">Férias</TabsTrigger>
              <TabsTrigger value="onboarding" className="text-xs flex-1">Onboarding</TabsTrigger>
              <TabsTrigger value="links" className="text-xs flex-1">Links</TabsTrigger>
            </TabsList>

            <TabsContent value="info" className="space-y-3 mt-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                {member.email && <div><span className="text-muted-foreground text-xs">Email</span><p>{member.email}</p></div>}
                {member.whatsapp && <div><span className="text-muted-foreground text-xs">Telefone</span><p>{member.whatsapp}</p></div>}
                {member.birthday && <div><span className="text-muted-foreground text-xs">Aniversário</span><p>{member.birthday}</p></div>}
                {member.work_schedule && <div><span className="text-muted-foreground text-xs">Horário</span><div className="mt-0.5 space-y-0.5">{scheduleToLines(member.work_schedule).map((line, i) => <p key={i} className="text-sm">{line}</p>)}</div></div>}
                {member.identification && <div><span className="text-muted-foreground text-xs">Identificação</span><p>{member.identification}</p></div>}
                {member.iban && <div><span className="text-muted-foreground text-xs">IBAN</span><p>{member.iban}</p></div>}
                {member.fiscal_address && <div><span className="text-muted-foreground text-xs">Morada fiscal</span><p>{member.fiscal_address}</p></div>}
                {member.start_date && <div><span className="text-muted-foreground text-xs">Data de início</span><p>{member.start_date}</p></div>}
              </div>
              {member.presentation && <div><span className="text-xs text-muted-foreground">Apresentação</span><p className="text-sm mt-1">{member.presentation}</p></div>}
              {member.responsibilities && <div><span className="text-xs text-muted-foreground">Responsabilidades</span><p className="text-sm mt-1 whitespace-pre-wrap">{member.responsibilities}</p></div>}
            </TabsContent>

            <TabsContent value="tarefas" className="space-y-2 mt-3">
              {!member.profile_id ? (
                <p className="text-xs text-muted-foreground">Este membro não está ligado a um perfil de utilizador.</p>
              ) : (memberTasks.data || []).length === 0 ? (
                <EmptyHint>Sem tarefas atribuídas.</EmptyHint>
              ) : (
                <div className="space-y-1">
                  {(memberTasks.data || []).map((t: any) => (
                    <div key={t.id} className="flex items-center gap-2 py-1.5 border-b border-border/50">
                      <CheckSquare className={`h-3.5 w-3.5 ${isTaskDone(t) ? 'text-primary' : 'text-muted-foreground'}`} />
                      <span className={`text-sm flex-1 ${isTaskDone(t) ? 'line-through text-muted-foreground' : ''}`}>{t.name}</span>
                      <Badge variant="outline" className="text-[10px]">{t.status}</Badge>
                      {t.deadline && <span className="text-[10px] text-muted-foreground">{t.deadline}</span>}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="tempo" className="space-y-3 mt-3">
              {/* Holiday/weekend work detection */}
              <HolidayWeekendWorkCards memberId={member.id} />

              {(memberTime.data || []).length === 0 ? (
                <EmptyHint>Sem registos de tempo.</EmptyHint>
              ) : (
                <Table>
                  <TableHeader><TableRow>
                    <TableHead className="">Data</TableHead><TableHead className="">Duração</TableHead><TableHead className="">Categoria</TableHead><TableHead className="">Descrição</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {(memberTime.data || []).slice(0, 20).map((e: any) => (
                      <TableRow key={e.id}>
                        <TableCell className="">{e.entry_date}</TableCell>
                        <TableCell className="">{Number(e.duration).toFixed(1)}h</TableCell>
                        <TableCell className="">{e.category || '—'}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{e.description || '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            <TabsContent value="contrato" className="space-y-2 mt-3">
              {contracts.length === 0 ? (
                <EmptyHint>Sem contratos.</EmptyHint>
              ) : contracts.map((c: any) => (
                <Card key={c.id}>
                  <CardContent className="p-3 space-y-2 text-sm">
                    <div className="flex justify-between items-center">
                      {(() => {
                        const eff = deriveContractStatus(c);
                        return <Badge variant={eff === 'ativo' ? 'default' : eff === 'terminado' ? 'secondary' : 'outline'} className="text-[10px]">{labelFor(CONTRACT_STATUSES, eff)}</Badge>;
                      })()}
                      <span className="text-xs text-muted-foreground">
                        {labelFor(CONTRACT_TYPES, c.contract_type)}
                        {c.previous_contract_id && <Badge variant="outline" className="ml-2 text-[9px]">Renovação</Badge>}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div><span className="text-muted-foreground">Início:</span> {c.start_date || '—'}</div>
                      <div><span className="text-muted-foreground">Fim:</span> {c.end_date || '—'}</div>
                      {c.monthly_value > 0 && <div><span className="text-muted-foreground">Valor mensal:</span> €{Number(c.monthly_value).toLocaleString()}</div>}
                      {c.contracted_hours && <div><span className="text-muted-foreground">Horas contratadas:</span> {c.contracted_hours}</div>}
                      {c.payment_day && <div><span className="text-muted-foreground">Dia de pagamento:</span> {c.payment_day}</div>}
                    </div>
                    {c.document_url && <a href={c.document_url} target="_blank" rel="noopener" className="text-xs text-primary underline flex items-center gap-1"><ExternalLink className="h-3 w-3" /> Ver documento</a>}
                    {c.notes && <p className="text-xs text-muted-foreground mt-1">{c.notes}</p>}
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="pagamentos" className="space-y-2 mt-3">
              {payments.length === 0 ? (
                <EmptyHint>Sem pagamentos.</EmptyHint>
              ) : (
                <Table>
                  <TableHeader><TableRow>
                    <TableHead className="">Mês</TableHead><TableHead className="">Tipo</TableHead><TableHead className="">Bruto</TableHead><TableHead className="">Líquido</TableHead><TableHead className="">Status</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {payments.map((p: any) => {
                      const isOverdue = p.status === 'por_pagar' && (p.year < currentYear || (p.year === currentYear && p.month < currentMonth));
                      return (
                        <TableRow key={p.id} className={isOverdue ? 'bg-destructive/5' : ''}>
                          <TableCell className="">{p.month && p.year ? `${getMonthName(p.month)} ${p.year}` : '—'}</TableCell>
                          <TableCell className="">{labelFor(PAYMENT_TYPES, p.payment_type)}</TableCell>
                          <TableCell className="">€{Number(p.gross_value).toLocaleString()}</TableCell>
                          <TableCell className="">€{Number(p.net_value).toLocaleString()}</TableCell>
                          <TableCell><Badge variant={p.status === 'pago' ? 'default' : isOverdue ? 'destructive' : 'secondary'} className="text-[10px]">{isOverdue ? 'Em atraso' : labelFor(PAYMENT_STATUSES, p.status)}</Badge></TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            <TabsContent value="feedback" className="space-y-2 mt-3">
              {feedbackSessions.length === 0 ? (
                <EmptyHint>Sem sessões de feedback.</EmptyHint>
              ) : feedbackSessions.map((fb: any) => (
                <Card key={fb.id}>
                  <CardContent className="p-3 space-y-2">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs font-medium">{fb.session_date}{fb.session_time ? ` às ${fb.session_time}` : ''}</span>
                      </div>
                      <Badge variant="outline" className="text-[10px]">{labelFor(FEEDBACK_TYPES, fb.feedback_type)}</Badge>
                    </div>
                    {fb.summary && <div><span className="text-xs text-muted-foreground">Resumo:</span><p className="text-xs mt-0.5">{fb.summary}</p></div>}
                    {fb.went_well && <div><span className="text-xs text-muted-foreground">Correu bem:</span><p className="text-xs mt-0.5">{fb.went_well}</p></div>}
                    {fb.to_improve && <div><span className="text-xs text-muted-foreground">A melhorar:</span><p className="text-xs mt-0.5">{fb.to_improve}</p></div>}
                    {fb.agreements && <div><span className="text-xs text-muted-foreground">Acordos:</span><p className="text-xs mt-0.5">{fb.agreements}</p></div>}
                    {fb.transcript_url && <a href={fb.transcript_url} target="_blank" rel="noopener" className="text-xs text-primary underline flex items-center gap-1"><FileText className="h-3 w-3" /> Ver transcrição</a>}
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            {/* Onboarding tab — uses only SOP-generated items, no hardcoded defaults */}
            <TabsContent value="onboarding" className="space-y-2 mt-3">
              {items.length > 0 && (
                <div className={`rounded-lg p-3 space-y-2 ${onbPct === 100 ? 'bg-primary/10 border border-primary/20' : 'bg-muted/40'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {onbPct === 100 ? (
                        <>
                          <CheckCircle2 className="h-4 w-4 text-primary" />
                          <span className="text-sm font-medium">Onboarding concluído</span>
                        </>
                      ) : (
                        <span className="text-sm font-medium">Progresso: {onbDone} de {onbTotal} passos</span>
                      )}
                    </div>
                    <Badge variant={onbPct === 100 ? 'default' : 'outline'} className="text-xs">{onbPct}%</Badge>
                  </div>
                  <Progress value={onbPct} className="h-2" />
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    {onbOverdue > 0 ? (
                      <span className="text-destructive font-medium">{onbOverdue} em atraso</span>
                    ) : <span>Sem passos em atraso</span>}
                    {onbNextDue && onbPct < 100 && (
                      <span>Próximo: <span className="text-foreground">{onbNextDue.task}</span> ({onbNextDue.deadline_date})</span>
                    )}
                  </div>
                </div>
              )}

              {items.length === 0 ? (
                <EmptyHint>Sem checklist de onboarding. Cria um template de onboarding nos Processos do departamento para que seja gerada automaticamente.</EmptyHint>
              ) : (
                <div className="space-y-1">
                  {items.map((i: any) => (
                    <div key={i.id} className="group relative">
                      <OnboardingItem
                        item={i}
                        onToggle={(id, next) => team.toggleOnboardingItem.mutate({ id, completed: next })}
                      />
                      <button
                        onClick={() => team.deleteOnboardingItem.mutate(i.id)}
                        className="absolute top-2 right-1 opacity-0 group-hover:opacity-100 z-10"
                        aria-label="Eliminar"
                      >
                        <Trash2 className="h-3 w-3 text-muted-foreground" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2 mt-2">
                <Input placeholder="Novo item..." value={newTask} onChange={e => setNewTask(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && newTask.trim()) { team.addOnboardingItem.mutate({ member_id: member.id, task: newTask.trim() }); setNewTask(''); }}} className="h-8 text-sm" />
                <Button size="sm" variant="ghost" className="h-8" onClick={() => { if (newTask.trim()) { team.addOnboardingItem.mutate({ member_id: member.id, task: newTask.trim() }); setNewTask(''); }}}><Plus className="h-4 w-4" /></Button>
              </div>
            </TabsContent>

            <TabsContent value="links" className="space-y-2 mt-3">
              <MemberQuickLinks memberId={member.id} />
            </TabsContent>

            {/* Férias tab — with overlap validation */}
            <TabsContent value="ferias" className="space-y-3 mt-3">
              <div className="flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-2.5">
                <CalendarDays className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">{vacationDays} dias úteis</span>
                <span className="text-xs text-muted-foreground">de férias marcados em {currentYear}</span>
              </div>

              <Separator />

              <div className="space-y-2">
                <p className="text-sm font-medium">Períodos de férias</p>
                {(memberVacations.data || []).length === 0 ? (
                  <EmptyHint>Sem férias registadas.</EmptyHint>
                ) : (memberVacations.data || []).map((v: any) => (
                  <div key={v.id} className="flex items-center justify-between bg-muted/50 rounded-md px-3 py-2">
                    <div>
                      <span className="text-sm">{format(parseISO(v.start_date), 'dd/MM/yyyy')} → {format(parseISO(v.end_date), 'dd/MM/yyyy')}</span>
                      {v.notes && <p className="text-xs text-muted-foreground">{v.notes}</p>}
                    </div>
                    <Button variant="ghost" aria-label="Eliminar" size="icon" className="h-7 w-7" onClick={() => handleDeleteVacation(v.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>

              <Separator />

              <div className="space-y-2">
                <p className="text-sm font-medium">Adicionar férias</p>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="text-xs text-muted-foreground">Início</label><Input type="date" value={vacStart} onChange={e => setVacStart(e.target.value)} /></div>
                  <div><label className="text-xs text-muted-foreground">Fim</label><Input type="date" value={vacEnd} onChange={e => setVacEnd(e.target.value)} /></div>
                </div>
                <Input placeholder="Notas (opcional)" value={vacNotes} onChange={e => setVacNotes(e.target.value)} />
                <Button size="sm" onClick={handleAddVacation} className="w-full"><Plus className="h-4 w-4 mr-1" /> Adicionar Férias</Button>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function HolidayWeekendWorkCards({ memberId }: { memberId: string }) {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const holidaySet = getHolidaySet(now.getFullYear());

  const { data: entries = [] } = useQuery({
    queryKey: ['member-time-entries-holidays', memberId, format(now, 'yyyy-MM')],
    queryFn: async () => {
      const { data } = await supabase
        .from('time_entries')
        .select('entry_date, duration')
        .eq('member_id', memberId)
        .gte('entry_date', format(monthStart, 'yyyy-MM-dd'))
        .lte('entry_date', format(monthEnd, 'yyyy-MM-dd'));
      return data || [];
    },
  });

  const weekendEntries = entries.filter(e => {
    const d = new Date(e.entry_date);
    return getDay(d) === 0 || getDay(d) === 6;
  });
  const holidayEntries = entries.filter(e => holidaySet.has(e.entry_date));
  const weekendDays = new Set(weekendEntries.map(e => e.entry_date)).size;
  const holidayDays = new Set(holidayEntries.map(e => e.entry_date)).size;
  const weekendHours = weekendEntries.reduce((s, e) => s + Number(e.duration || 0), 0);
  const holidayHours = holidayEntries.reduce((s, e) => s + Number(e.duration || 0), 0);

  if (weekendDays === 0 && holidayDays === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {weekendDays > 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-warning/15 dark:bg-warning/20 px-3 py-2">
          <CalendarDays className="h-4 w-4 text-warning" />
          <div><p className="text-xs text-muted-foreground">Fins-de-semana este mês</p><p className="text-sm font-medium">{weekendDays} dia{weekendDays > 1 ? 's' : ''} · {weekendHours.toFixed(1)}h</p></div>
        </div>
      )}
      {holidayDays > 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-info/15 dark:bg-info/20 px-3 py-2">
          <CalendarDays className="h-4 w-4 text-info" />
          <div><p className="text-xs text-muted-foreground">Feriados este mês</p><p className="text-sm font-medium">{holidayDays} dia{holidayDays > 1 ? 's' : ''} · {holidayHours.toFixed(1)}h</p></div>
        </div>
      )}
    </div>
  );
}
