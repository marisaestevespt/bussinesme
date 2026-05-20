import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Users, MessageSquare, FileText, AlertTriangle } from 'lucide-react';
import { format, isSameDay, isWithinInterval, parseISO, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { pt as ptLocale } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTeamData } from '@/hooks/useTeamData';
import { getInitials, currentYear, currentMonth, getPortugueseHolidays, DAY_KEY_MAP } from '@/components/hr/team-helpers';

const DAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const STATUS_COLORS: Record<string, string> = {
  available: 'bg-success',
  off: 'bg-muted',
  vacation: 'bg-info',
  absence: 'bg-warning',
  holiday: 'bg-warning',
};

const STATUS_LABELS: Record<string, string> = {
  available: 'Disponível',
  off: 'Folga',
  vacation: 'Férias',
  absence: 'Ausência',
  holiday: 'Feriado',
};

// Dashboard with people-focused stats + monthly schedule + overdue payment alerts.
export function TabDashboard({ team }: { team: ReturnType<typeof useTeamData> }) {
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

  const recentFeedback = useMemo(() => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    return allFeedback.filter((f: any) => f.session_date && new Date(f.session_date) >= thirtyDaysAgo);
  }, [allFeedback]);

  const memberName = (id: string) => allMembers.find((m: any) => m.id === id)?.full_name || (team.members.data || []).find((m: any) => m.id === id)?.full_name || '—';

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

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-l-4 border-l-primary">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center"><Users className="h-5 w-5 text-primary" /></div>
            <div><p className="text-[11px] text-muted-foreground uppercase tracking-wide">Membros ativos</p><p className="text-xl font-bold">{allMembers.length}</p></div>
          </CardContent>
        </Card>
        <Card className={cn("border-l-4", expiringContracts.length > 0 ? "border-l-amber-500" : "border-l-emerald-500")}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${expiringContracts.length > 0 ? 'bg-warning/15 dark:bg-warning/30' : 'bg-success/15 dark:bg-success/30'}`}>
              <FileText className={`h-5 w-5 ${expiringContracts.length > 0 ? 'text-warning' : 'text-success'}`} />
            </div>
            <div><p className="text-[11px] text-muted-foreground uppercase tracking-wide">Contratos (30d)</p><p className="text-xl font-bold">{expiringContracts.length > 0 ? expiringContracts.length : '✓'}</p></div>
          </CardContent>
        </Card>
        <Card className={cn("border-l-4", overduePayments.length > 0 ? "border-l-destructive" : "border-l-emerald-500")}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${overduePayments.length > 0 ? 'bg-destructive/10' : 'bg-success/15 dark:bg-success/30'}`}>
              <AlertTriangle className={`h-5 w-5 ${overduePayments.length > 0 ? 'text-destructive' : 'text-success'}`} />
            </div>
            <div><p className="text-[11px] text-muted-foreground uppercase tracking-wide">Pagamentos</p><p className="text-xl font-bold">{overduePayments.length > 0 ? `${overduePayments.length} atraso` : '✓'}</p></div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-violet-500">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-accent-violet/15 dark:bg-accent-violet/30 flex items-center justify-center">
              <MessageSquare className="h-5 w-5 text-accent-violet" />
            </div>
            <div><p className="text-[11px] text-muted-foreground uppercase tracking-wide">Feedback (30d)</p><p className="text-xl font-bold">{recentFeedback.length}</p></div>
          </CardContent>
        </Card>
      </div>

      {(escalaMembers.data || []).length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button variant="ghost" aria-label="Anterior" size="icon" className="h-7 w-7" onClick={() => setEscalaMonth(m => subMonths(m, 1))}><ChevronLeft className="h-4 w-4" /></Button>
                <h3 className="text-sm font-semibold">Escala — {format(escalaMonth, 'MMMM yyyy', { locale: ptLocale })}</h3>
                <Button variant="ghost" aria-label="Seguinte" size="icon" className="h-7 w-7" onClick={() => setEscalaMonth(m => addMonths(m, 1))}><ChevronRight className="h-4 w-4" /></Button>
              </div>
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-success inline-block" /> Disponível</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-warning inline-block" /> Férias</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-warning inline-block" /> Ausência</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-info inline-block" /> Feriado</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-muted-foreground/30 inline-block" /> Folga</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    <th className="text-left font-medium text-muted-foreground py-1 pr-3 w-[140px] sticky left-0 bg-card z-10">Membro</th>
                    {monthDays.map(d => {
                      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                      const isHoliday = holidays.some(h => isSameDay(h, d));
                      return (
                        <th key={d.toISOString()} className={cn(
                          "text-center font-medium py-1 px-1 min-w-[32px]",
                          isSameDay(d, new Date()) && "text-primary",
                          isWeekend && "bg-muted/50 text-muted-foreground/60",
                          isHoliday && "bg-warning/15 dark:bg-warning/20",
                        )}>
                          <div className="text-[9px]">{['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][d.getDay()]}</div>
                          <div className="text-[10px]">{format(d, 'd')}</div>
                        </th>
                      );
                    })}
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