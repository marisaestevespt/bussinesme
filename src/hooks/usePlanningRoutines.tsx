import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  addDays, getDay, startOfYear, endOfYear, eachWeekOfInterval,
  format, isBefore, isAfter, startOfDay, isSaturday, isSunday,
  subDays, getDaysInMonth,
} from 'date-fns';
import type { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';
import { adjustToBusinessDay as adjustToBusinessDayWithHolidays } from '@/lib/holidays';
import { requireConfirm, confirmDestructive } from '@/lib/confirmDestructive';

type PlanningRoutine = Tables<'planning_routines'>;

// ─── Task generation helpers ─────────────────────────────────

function adjustToBusinessDay(date: Date): Date {
  return adjustToBusinessDayWithHolidays(date);
}

function weekdayToDateFns(wd: number): number {
  return wd === 7 ? 0 : wd;
}

export function generateWeeklyDates(weekday: number, fromDate: Date, year: number): string[] {
  const yearStart = fromDate > startOfYear(new Date(year, 0, 1)) ? fromDate : startOfYear(new Date(year, 0, 1));
  const yearEnd = endOfYear(new Date(year, 0, 1));
  const targetDay = weekdayToDateFns(weekday);

  const weeks = eachWeekOfInterval({ start: yearStart, end: yearEnd }, { weekStartsOn: 1 });
  const dates: string[] = [];

  for (const weekStart of weeks) {
    let date = weekStart;
    while (getDay(date) !== targetDay) {
      date = addDays(date, 1);
    }
    if (!isBefore(date, yearStart) && !isAfter(date, yearEnd)) {
      dates.push(format(date, 'yyyy-MM-dd'));
    }
  }

  return dates;
}

export function generateMonthlyDates(monthDay: number, adjustBiz: boolean, fromDate: Date, year: number): string[] {
  const dates: string[] = [];
  const fromMonth = fromDate.getFullYear() === year ? fromDate.getMonth() : 0;

  for (let m = fromMonth; m < 12; m++) {
    const maxDay = getDaysInMonth(new Date(year, m));
    const day = Math.min(monthDay, maxDay);
    let date = new Date(year, m, day);
    if (isBefore(startOfDay(date), startOfDay(fromDate))) continue;
    if (adjustBiz) date = adjustToBusinessDay(date);
    dates.push(format(date, 'yyyy-MM-dd'));
  }

  return dates;
}

// ─── Generate tasks for a routine ────────────────────────────

interface RoutineForTaskGen {
  id: string;
  title: string;
  responsible: string | null;
  recurrence_type: string;
  weekday: number | null;
  month_day: number | null;
  adjust_to_business_day: boolean;
}

export async function generateTasksForRoutine(
  routine: RoutineForTaskGen,
  year: number,
  fromDate?: Date,
) {
  const from = fromDate || new Date();

  const { data: existing } = await supabase
    .from('tasks')
    .select('id')
    .eq('routine_id', routine.id)
    .gte('deadline', `${year}-01-01`)
    .lte('deadline', `${year}-12-31`)
    .limit(1);

  if (existing && existing.length > 0) return;

  let dates: string[] = [];

  if (routine.recurrence_type === 'semanal' && routine.weekday) {
    dates = generateWeeklyDates(routine.weekday, from, year);
  } else if (routine.recurrence_type === 'mensal' && routine.month_day) {
    dates = generateMonthlyDates(routine.month_day, routine.adjust_to_business_day, from, year);
  }

  if (dates.length === 0) return;

  const tasks: TablesInsert<'tasks'>[] = dates.map(d => ({
    name: routine.title,
    status: 'por_comecar',
    priority: 'media',
    deadline: d,
    assigned_to: routine.responsible,
    routine_id: routine.id,
    tag: 'Rotina',
  }));

  for (let i = 0; i < tasks.length; i += 50) {
    const batch = tasks.slice(i, i + 50);
    await supabase.from('tasks').insert(batch);
  }
}

// ─── Ensure current year tasks exist on app boot ─────────────

export async function ensureYearRoutineTasks() {
  const year = new Date().getFullYear();
  const yearStart = `${year}-01-01`;

  const { data: existingTasks } = await supabase
    .from('tasks')
    .select('id')
    .eq('tag', 'Rotina')
    .gte('deadline', yearStart)
    .limit(1);

  if (existingTasks && existingTasks.length > 0) return;

  const { data: routines } = await supabase
    .from('planning_routines')
    .select('*')
    .eq('active', true);

  if (!routines?.length) return;

  for (const r of routines) {
    await generateTasksForRoutine(r as RoutineForTaskGen, year, new Date(yearStart));
  }
}

// ─── Hook ────────────────────────────────────────────────────

export function usePlanningRoutines() {
  const qc = useQueryClient();

  const routines = useQuery({
    queryKey: ['planning-routines'],
    queryFn: async () => {
      const { data } = await supabase
        .from('planning_routines')
        .select('*, profiles:responsible(full_name, avatar_url)')
        .order('created_at', { ascending: false });
      return data || [];
    },
  });

  const createRoutine = useMutation({
    mutationFn: async (routine: {
      title: string;
      responsible: string | null;
      role_function?: string | null;
      recurrence_type: string;
      weekday?: number | null;
      month_day?: number | null;
      adjust_to_business_day?: boolean;
      hour_time?: string;
      created_by?: string;
    }) => {
      const { data, error } = await supabase
        .from('planning_routines')
        .insert(routine as TablesInsert<'planning_routines'>)
        .select('*')
        .single();
      if (error) throw error;

      await generateTasksForRoutine(data as RoutineForTaskGen, new Date().getFullYear());
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['planning-routines'] });
      qc.invalidateQueries({ queryKey: ['my-tasks'] });
      toast.success('Rotina criada e tarefas geradas');
    },
    onError: (e: Error) => toast.error('Erro: ' + (e.message || e)),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from('planning_routines').update({ active } satisfies TablesUpdate<'planning_routines'>).eq('id', id);
      if (error) throw error;

      if (active) {
        const { data: routine } = await supabase.from('planning_routines').select('*').eq('id', id).maybeSingle();
        if (routine) {
          await generateTasksForRoutine(routine as RoutineForTaskGen, new Date().getFullYear());
        }
      } else {
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        await supabase
          .from('tasks')
          .delete()
          .eq('routine_id', id)
          .neq('status', 'done')
          .gte('deadline', todayStr);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['planning-routines'] });
      qc.invalidateQueries({ queryKey: ['my-tasks'] });
      toast.success('Estado da rotina atualizado');
    },
  });

  const deleteRoutine = useMutation({
    mutationFn: async (id: string) => {
      await requireConfirm();
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      await supabase
        .from('tasks')
        .delete()
        .eq('routine_id', id)
        .neq('status', 'done')
        .gte('deadline', todayStr);

      await supabase.from('sops').delete().eq('routine_id', id);

      const { error } = await supabase.from('planning_routines').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['planning-routines'] });
      qc.invalidateQueries({ queryKey: ['my-tasks'] });
      toast.success('Rotina eliminada');
    },
  });

  return { routines, createRoutine, toggleActive, deleteRoutine };
}
