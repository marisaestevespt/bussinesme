import { supabase } from '@/integrations/supabase/client';

const MONTH_NAMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

/**
 * Ensure planning records (months, quarters, semesters) exist for the current year.
 * Runs once per session on app boot.
 */
export async function ensureYearPlanningRecords() {
  const year = new Date().getFullYear();

  // Check if monthly records exist
  const { data: existingMonths } = await supabase
    .from('planning_months')
    .select('id')
    .eq('year', year)
    .limit(1);

  if (existingMonths && existingMonths.length > 0) return; // Already exists

  // Create 12 monthly records
  const months = MONTH_NAMES.map((name, i) => ({
    year,
    month: i + 1,
    label: name,
  }));

  await supabase.from('planning_months').insert(months as any);

  // Create 4 quarterly records
  const quarters = [1, 2, 3, 4].map(q => ({
    year,
    quarter: q,
    label: `T${q}`,
  }));

  await supabase.from('planning_quarters').insert(quarters as any);

  // Create 2 semester records
  const semesters = [1, 2].map(s => ({
    year,
    semester: s,
    label: `S${s}`,
  }));

  await supabase.from('planning_semesters').insert(semesters as any);
}
