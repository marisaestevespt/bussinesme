import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  addDays, getDay, startOfYear, endOfYear, eachWeekOfInterval,
  format, isBefore, isAfter, startOfDay, isSaturday, isSunday,
  subDays, getDaysInMonth,
} from 'date-fns';

// ─── Task generation helpers ─────────────────────────────────

function adjustToBusinessDay(date: Date): Date {
  if (isSaturday(date)) return subDays(date, 1); // Fri
  if (isSunday(date)) return subDays(date, 2);  // Fri
  return date;
}

/** Map weekday 1-7 (Mon-Sun) to date-fns getDay() 0-6 (Sun-Sat) */
function weekdayToDateFns(wd: number): number {
  return wd === 7 ? 0 : wd; // 1→1(Mon), …, 6→6(Sat), 7→0(Sun)
}

export function generateWeeklyDates(weekday: number, fromDate: Date, year: number): string[] {
  const yearStart = fromDate > startOfYear(new Date(year, 0, 1)) ? fromDate : startOfYear(new Date(year, 0, 1));
  const yearEnd = endOfYear(new Date(year, 0, 1));
  const targetDay = weekdayToDateFns(weekday);

  const weeks = eachWeekOfInterval({ start: yearStart, end: yearEnd }, { weekStartsOn: 1 });
  const dates: string[] = [];

  for (const weekStart of weeks) {
    // Find the target day in this week
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

export async function generateTasksForRoutine(
  routine: { id: string; title: string; responsible: string | null; recurrence_type: string; weekday: number | null; month_day: number | null; adjust_to_business_day: boolean },
  year: number,
  fromDate?: Date,
) {
  const from = fromDate || new Date();

  // Check if tasks already exist for this routine this year
  const { data: existing } = await supabase
    .from('tasks')
    .select('id')
    .eq('routine_id', routine.id)
    .gte('deadline', `${year}-01-01`)
    .lte('deadline', `${year}-12-31`)
    .limit(1);

  if (existing && existing.length > 0) return; // Already generated

  let dates: string[] = [];

  if (routine.recurrence_type === 'semanal' && routine.weekday) {
    dates = generateWeeklyDates(routine.weekday, from, year);
  } else if (routine.recurrence_type === 'mensal' && routine.month_day) {
    dates = generateMonthlyDates(routine.month_day, routine.adjust_to_business_day, from, year);
  }

  if (dates.length === 0) return;

  const tasks = dates.map(d => ({
    name: routine.title,
    status: 'pendente',
    priority: 'media',
    deadline: d,
    assigned_to: routine.responsible,
    routine_id: routine.id,
    tag: 'Rotina',
  }));

  // Insert in batches of 50
  for (let i = 0; i < tasks.length; i += 50) {
    const batch = tasks.slice(i, i + 50);
    await supabase.from('tasks').insert(batch as any);
  }
}

// ─── Ensure current year tasks exist on app boot ─────────────

export async function ensureYearRoutineTasks() {
  const year = new Date().getFullYear();
  const yearStart = `${year}-01-01`;

  // Check if any routine tasks exist for this year
  const { data: existingTasks } = await supabase
    .from('tasks')
    .select('id')
    .eq('tag', 'Rotina')
    .gte('deadline', yearStart)
    .limit(1);

  if (existingTasks && existingTasks.length > 0) return; // Already have tasks

  // Get all active routines
  const { data: routines } = await supabase
    .from('planning_routines')
    .select('*')
    .eq('active', true);

  if (!routines?.length) return;

  for (const r of routines) {
    await generateTasksForRoutine(r as any, year, new Date(yearStart));
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
        .insert(routine as any)
        .select('*')
        .single();
      if (error) throw error;

      // Generate tasks for remaining of current year
      await generateTasksForRoutine(data as any, new Date().getFullYear());
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['planning-routines'] });
      qc.invalidateQueries({ queryKey: ['my-tasks'] });
      toast.success('Rotina criada e tarefas geradas');
    },
    onError: (e: any) => toast.error('Erro: ' + (e.message || e)),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from('planning_routines').update({ active } as any).eq('id', id);
      if (error) throw error;

      if (active) {
        // Re-generate tasks for this year
        const { data: routine } = await supabase.from('planning_routines').select('*').eq('id', id).single();
        if (routine) {
          await generateTasksForRoutine(routine as any, new Date().getFullYear());
        }
      } else {
        // Delete future non-completed tasks
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        await supabase
          .from('tasks')
          .delete()
          .eq('routine_id', id)
          .neq('status', 'done')
          .neq('status', 'concluida')
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
      // Delete future non-completed tasks first
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      await supabase
        .from('tasks')
        .delete()
        .eq('routine_id', id)
        .neq('status', 'done')
        .neq('status', 'concluida')
        .gte('deadline', todayStr);

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
