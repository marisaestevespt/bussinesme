import { useState, useMemo } from 'react';
import { AbsenceCoverageTable } from '@/components/hr/AbsenceCoverageTable';
import { NewAbsenceDialog } from '@/components/hr/NewAbsenceDialog';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {InlineLoader, EmptyHint } from '@/components/ui/loading-skeletons';
import { Separator } from '@/components/ui/separator';
import { Plus, Trash2, CalendarIcon, Palmtree, Clock, AlertCircle } from 'lucide-react';
import { format, addDays, startOfWeek, endOfWeek, eachDayOfInterval, isWithinInterval, parseISO, isSameDay, startOfMonth, endOfMonth } from 'date-fns';
import { pt } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { requireConfirm, confirmDestructive } from '@/lib/confirmDestructive';

// ─── Portuguese national holidays (fixed + computed) ─────
function getPortugueseHolidays(year: number): Date[] {
  // Easter calculation (Anonymous Gregorian algorithm)
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  const easter = new Date(year, month - 1, day);

  const goodFriday = addDays(easter, -2);
  const corpusChristi = addDays(easter, 60);

  return [
    new Date(year, 0, 1),   // Ano Novo
    goodFriday,               // Sexta-feira Santa
    easter,                   // Páscoa
    new Date(year, 3, 25),   // Liberdade
    new Date(year, 4, 1),    // Dia do Trabalhador
    corpusChristi,            // Corpo de Deus
    new Date(year, 5, 10),   // Dia de Portugal
    new Date(year, 7, 15),   // Assunção
    new Date(year, 9, 5),    // Implantação da República
    new Date(year, 10, 1),   // Todos os Santos
    new Date(year, 11, 1),   // Restauração da Independência
    new Date(year, 11, 8),   // Imaculada Conceição
    new Date(year, 11, 25),  // Natal
  ];
}

const DAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const DAY_KEY_MAP: Record<number, string> = { 1: 'seg', 2: 'ter', 3: 'qua', 4: 'qui', 5: 'sex', 6: 'sab', 0: 'dom' };

type TeamMember = {
  id: string;
  full_name: string;
  photo_url: string | null;
  role_title: string | null;
  work_schedule: string | null;
  works_holidays: boolean;
  custom_holidays: any;
  status: string;
  profile_id: string | null;
};

type Vacation = {
  id: string;
  member_id: string;
  start_date: string;
  end_date: string;
  notes: string | null;
};

type Absence = {
  id: string;
  member_id: string;
  start_date: string;
  end_date: string;
  reason: string;
};

function useEscalaData() {
  const members = useQuery({
    queryKey: ['escala-members'],
    queryFn: async () => {
      const { data } = await supabase
        .from('team_members')
        .select('id, full_name, photo_url, role_title, work_schedule, works_holidays, custom_holidays, status, profile_id')
        .eq('status', 'ativo')
        .order('full_name');
      return (data || []) as TeamMember[];
    },
  });

  const vacations = useQuery({
    queryKey: ['escala-vacations'],
    queryFn: async () => {
      const { data } = await supabase
        .from('team_member_vacations')
        .select('*')
        .order('start_date');
      return (data || []) as Vacation[];
    },
  });

  const absences = useQuery({
    queryKey: ['absence-coverage'],
    queryFn: async () => {
      const { data } = await supabase
        .from('absence_coverage')
        .select('id, member_id, start_date, end_date, reason')
        .order('start_date');
      return (data || []) as Absence[];
    },
  });

  return {
    members: members.data || [],
    vacations: vacations.data || [],
    absences: absences.data || [],
    isLoading: members.isLoading || vacations.isLoading || absences.isLoading,
  };
}

function getAvailability(
  member: TeamMember,
  day: Date,
  vacations: Vacation[],
  absences: Absence[],
  nationalHolidays: Date[]
): 'available' | 'off' | 'vacation' | 'holiday' | 'absence' {
  // Check absence_coverage first
  const memberAbsences = absences.filter(a => a.member_id === member.id);
  for (const a of memberAbsences) {
    if (isWithinInterval(day, { start: parseISO(a.start_date), end: parseISO(a.end_date) })) {
      return 'absence';
    }
  }

  // Check vacation
  const memberVacations = vacations.filter(v => v.member_id === member.id);
  for (const v of memberVacations) {
    if (isWithinInterval(day, { start: parseISO(v.start_date), end: parseISO(v.end_date) })) {
      return 'vacation';
    }
  }

  // Check custom_holidays
  const customDates: string[] = Array.isArray(member.custom_holidays) ? member.custom_holidays : [];
  for (const d of customDates) {
    try {
      if (d.includes('|')) {
        const [s, e] = d.split('|');
        if (isWithinInterval(day, { start: parseISO(s), end: parseISO(e) })) return 'vacation';
      } else {
        if (isSameDay(parseISO(d), day)) return 'vacation';
      }
    } catch { /* skip invalid */ }
  }

  // Check national holiday
  const isNational = nationalHolidays.some(h => isSameDay(h, day));
  if (isNational) return 'holiday';

  // Check work schedule
  if (!member.work_schedule) return 'off';
  try {
    const schedule = JSON.parse(member.work_schedule);
    const dayKey = DAY_KEY_MAP[day.getDay()];
    const val = schedule[dayKey];
    if (!val) return 'off';
    if (Array.isArray(val)) return val.length > 0 ? 'available' : 'off';
    if (typeof val === 'object' && (val.manha || val.tarde)) return 'available';
    return 'off';
  } catch {
    return 'off';
  }
}

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

// ─── Vacation Management Dialog ─────
function VacationDialog({ member, vacations, onClose }: { member: TeamMember; vacations: Vacation[]; onClose: () => void }) {
  const qc = useQueryClient();
  const memberVacations = vacations.filter(v => v.member_id === member.id);
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [notes, setNotes] = useState('');

  const handleAdd = async () => {
    if (!startDate || !endDate) { toast.error('Selecione as datas'); return; }
    if (endDate < startDate) { toast.error('Data fim deve ser após início'); return; }
    const { error } = await supabase.from('team_member_vacations').insert({
      member_id: member.id,
      start_date: format(startDate, 'yyyy-MM-dd'),
      end_date: format(endDate, 'yyyy-MM-dd'),
      notes: notes || null,
    });
    if (error) toast.error('Não consegui guardar a escala. Tenta novamente.');
    else { toast.success('Férias adicionadas'); setStartDate(undefined); setEndDate(undefined); setNotes(''); qc.invalidateQueries({ queryKey: ['escala-vacations'] }); }
  };

  const handleDelete = async (id: string) => {
    if (!(await confirmDestructive())) return;
    await supabase.from('team_member_vacations').delete().eq('id', id);
    toast.success('Removido');
    qc.invalidateQueries({ queryKey: ['escala-vacations'] });
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Férias — {member.full_name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Existing vacations */}
          {memberVacations.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Períodos registados</p>
              {memberVacations.map(v => (
                <div key={v.id} className="flex items-center justify-between text-sm bg-muted/50 rounded-md px-3 py-2">
                  <span>{format(parseISO(v.start_date), 'dd/MM/yyyy')} → {format(parseISO(v.end_date), 'dd/MM/yyyy')}</span>
                  <Button variant="ghost" aria-label="Eliminar" size="icon" className="h-7 w-7" onClick={() => handleDelete(v.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <Separator />

          {/* Add new vacation */}
          <p className="text-sm font-medium text-foreground">Adicionar período</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Início</label>
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
              <label className="text-xs text-muted-foreground">Fim</label>
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
          <Input placeholder="Notas (opcional)" value={notes} onChange={e => setNotes(e.target.value)} />
          <Button onClick={handleAdd} className="w-full"><Plus className="h-4 w-4 mr-1" />Adicionar Férias</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Vacation Popover Content (inline list) ─────
function VacationPopoverContent({ member, vacations, onOpenDialog }: { member: TeamMember; vacations: Vacation[]; onOpenDialog: () => void }) {
  const memberVacations = vacations.filter(v => v.member_id === member.id);

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-foreground">Férias de {member.full_name}</p>
      {memberVacations.length === 0 ? (
        <EmptyHint>Sem férias registadas</EmptyHint>
      ) : (
        <div className="space-y-1 max-h-[160px] overflow-y-auto">
          {memberVacations.map(v => (
            <div key={v.id} className="flex items-center gap-2 text-xs bg-muted/50 rounded px-2 py-1.5">
              <Palmtree className="h-3 w-3 text-info shrink-0" />
              <span>{format(parseISO(v.start_date), 'dd/MM/yyyy')} → {format(parseISO(v.end_date), 'dd/MM/yyyy')}</span>
            </div>
          ))}
        </div>
      )}
      <Button size="sm" className="w-full text-xs h-7" onClick={onOpenDialog}>
        <Plus className="h-3 w-3 mr-1" /> Adicionar período
      </Button>
    </div>
  );
}

// ─── Main Escala Component ─────
export function TabEscala() {
  const { members, vacations, absences, isLoading } = useEscalaData();
  const [viewMonth, setViewMonth] = useState(() => new Date());
  const [vacationMember, setVacationMember] = useState<TeamMember | null>(null);
  const [absenceDialogOpen, setAbsenceDialogOpen] = useState(false);

  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const nationalHolidays = useMemo(() => getPortugueseHolidays(year), [year]);

  const days = useMemo(() => eachDayOfInterval({ start: startOfMonth(viewMonth), end: endOfMonth(viewMonth) }), [viewMonth]);

  const getInitials = (name: string) => name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

  const prevMonth = () => setViewMonth(new Date(year, month - 1, 1));
  const nextMonth = () => setViewMonth(new Date(year, month + 1, 1));

  if (isLoading) return <InlineLoader />;

  return (
    <div className="space-y-6">
      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs">
        {Object.entries(STATUS_LABELS).map(([key, label]) => (
          <div key={key} className="flex items-center gap-2">
            <span className={cn('h-3 w-3 rounded-full', STATUS_COLORS[key])} />
            <span className="text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>

      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={prevMonth}>← Anterior</Button>
        <h3 className="text-lg font-semibold text-foreground capitalize">
          {format(viewMonth, 'MMMM yyyy', { locale: pt })}
        </h3>
        <Button variant="outline" size="sm" onClick={nextMonth}>Seguinte →</Button>
      </div>

      {/* Schedule grid */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 bg-card z-10 min-w-[180px]">Membro</TableHead>
                {days.map(d => {
                  const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                  const isHoliday = nationalHolidays.some(h => isSameDay(h, d));
                  return (
                    <TableHead
 key={d.toISOString()}
 className={cn(
 'text-center text-[10px] px-1 min-w-[32px]',
 isWeekend && 'bg-muted/50',
 isHoliday && 'bg-warning/15 dark:bg-warning/20'
 )}
 >
                      <div>{DAY_LABELS[d.getDay()]}</div>
                      <div className="font-semibold">{d.getDate()}</div>
                    </TableHead>
                  );
                })}
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map(m => (
                <TableRow key={m.id}>
                  <TableCell className="sticky left-0 bg-card z-10">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-7 w-7">
                        <AvatarImage src={m.photo_url || ''} />
                        <AvatarFallback className="bg-primary/10 text-primary text-[10px]">{getInitials(m.full_name)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate">{m.full_name}</p>
                        <Popover>
                          <PopoverTrigger asChild>
                            <button className="text-[10px] text-primary hover:underline">
                              Férias
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-72 p-3 pointer-events-auto" align="start">
                            <VacationPopoverContent member={m} vacations={vacations} onOpenDialog={() => setVacationMember(m)} />
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                  </TableCell>
                  {days.map(d => {
                    const status = getAvailability(m, d, vacations, absences, nationalHolidays);
                    return (
                      <TableCell key={d.toISOString()} className="text-center p-1">
                        <div
                          className={cn('h-5 w-5 mx-auto rounded-full', STATUS_COLORS[status])}
                          title={`${m.full_name} — ${format(d, 'dd/MM')} — ${STATUS_LABELS[status]}`}
                        />
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Vacation dialog */}
      {vacationMember && (
        <VacationDialog
          member={vacationMember}
          vacations={vacations}
          onClose={() => setVacationMember(null)}
        />
      )}

      {/* Ausências */}
      <Separator className="my-6" />
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Ausências</h2>
        <Button size="sm" onClick={() => setAbsenceDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Nova Ausência
        </Button>
      </div>
      <AbsenceCoverageTable />

      <NewAbsenceDialog
        open={absenceDialogOpen}
        onClose={() => setAbsenceDialogOpen(false)}
        members={members.map(m => ({ id: m.id, full_name: m.full_name, profile_id: m.profile_id, role_title: m.role_title }))}
      />
    </div>
  );
}
