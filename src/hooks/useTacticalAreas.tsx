import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface TacticalArea {
  key: string;
  label: string;
  enabled: boolean;
  sort_order: number;
}

const DEFAULT_AREAS: TacticalArea[] = [
  { key: 'comercial', label: 'Comercial', enabled: true, sort_order: 1 },
  { key: 'marketing', label: 'Marketing', enabled: true, sort_order: 2 },
  { key: 'financeiro', label: 'Contabilidade', enabled: true, sort_order: 3 },
  { key: 'operacao', label: 'Operação', enabled: true, sort_order: 4 },
  { key: 'clientes', label: 'Clientes', enabled: true, sort_order: 5 },
  { key: 'produtos', label: 'Produtos', enabled: true, sort_order: 6 },
  { key: 'recursos-humanos', label: 'Recursos Humanos', enabled: true, sort_order: 7 },
];

/**
 * Loads the configured tactical areas from business_settings.
 * Each area key matches DEPARTMENTS keys so we can resolve members and projects.
 */
export function useTacticalAreas() {
  return useQuery({
    queryKey: ['tactical-areas'],
    queryFn: async (): Promise<TacticalArea[]> => {
      const { data } = await supabase
        .from('business_settings')
        .select('tactical_areas')
        .limit(1)
        .maybeSingle();
      const raw = (data as any)?.tactical_areas;
      const list: TacticalArea[] = Array.isArray(raw) && raw.length ? raw : DEFAULT_AREAS;
      return [...list]
        .filter((a) => a.enabled !== false)
        .sort((a, b) => (a.sort_order ?? 99) - (b.sort_order ?? 99));
    },
  });
}

/**
 * Loads team members and indexes them by department key, so each area card
 * can show its responsible(s).
 */
export function useMembersByDepartment() {
  return useQuery({
    queryKey: ['members-by-department'],
    queryFn: async () => {
      const { data } = await supabase
        .from('team_members')
        .select('id, full_name, photo_url, role_title, departments')
        .eq('status', 'ativo');
      const map: Record<string, Array<{ id: string; full_name: string; photo_url: string | null; role_title: string | null }>> = {};
      (data || []).forEach((m: any) => {
        const depts: string[] = Array.isArray(m.departments) ? m.departments : [];
        depts.forEach((d) => {
          if (!map[d]) map[d] = [];
          map[d].push({ id: m.id, full_name: m.full_name, photo_url: m.photo_url, role_title: m.role_title });
        });
      });
      return map;
    },
  });
}

/**
 * Projects whose deadline falls inside the given date range — these are the
 * "initiatives" surfaced in tactical area cards. Indexed by department key.
 */
export function useProjectsByDepartmentInRange(start: Date, end: Date) {
  const startStr = start.toISOString().slice(0, 10);
  const endStr = end.toISOString().slice(0, 10);
  return useQuery({
    queryKey: ['projects-by-dept-range', startStr, endStr],
    queryFn: async () => {
      const { data } = await supabase
        .from('projects')
        .select('id, name, status, progress, deadline, department, client_name')
        .gte('deadline', startStr)
        .lte('deadline', endStr)
        .not('status', 'in', '(cancelado)')
        .order('deadline', { ascending: true });
      const map: Record<string, any[]> = {};
      (data || []).forEach((p: any) => {
        const k = p.department || 'sem-departamento';
        if (!map[k]) map[k] = [];
        map[k].push(p);
      });
      return map;
    },
  });
}