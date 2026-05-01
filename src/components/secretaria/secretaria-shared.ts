import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { TASK_STATUSES, getTaskStatusInfo } from '@/lib/taskStatus';
import { PROJECT_STATUSES as CANON_PROJECT_STATUSES, getProjectStatusInfo } from '@/lib/projectStatus';

// ─── Constants ──────────────────────────────────────────────
// Re-export task status helpers from the canonical module so the secretária
// page renders identically to the main Tarefas page.
export const STATUS_COLORS: Record<string, string> = Object.fromEntries(
  TASK_STATUSES.map(s => [s.value, s.color])
);
export const STATUS_LABELS: Record<string, string> = Object.fromEntries(
  TASK_STATUSES.map(s => [s.value, s.label])
);

export const PRIORITY_LABELS: Record<string, string> = {
  alta: 'P1', media: 'P2', baixa: 'P3',
};

export const TIME_CATEGORIES = [
  { value: 'cliente', label: 'Cliente' },
  { value: 'interno', label: 'Interno' },
  { value: 'reuniao', label: 'Reunião' },
  { value: 'conteudos', label: 'Conteúdos' },
  { value: 'formacao', label: 'Formação' },
  { value: 'outro', label: 'Outro' },
];

// Canonical project status map — same labels/colors as Projetos page.
export const PROJ_STATUS_MAP: Record<string, { label: string; color: string }> = Object.fromEntries(
  CANON_PROJECT_STATUSES.map(s => [s.value, { label: s.label, color: s.color }])
);

// ─── Helpers ──────────────────────────────────────────────

export function greetingText() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 19) return 'Boa tarde';
  return 'Boa noite';
}

export function formatTimer(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
}

// ─── Shared Hooks ──────────────────────────────────────────

export function useMyProfile() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['my-profile', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('*').eq('user_id', user!.id).maybeSingle();
      return data;
    },
  });
}

export function useMyTeamMember() {
  const profile = useMyProfile();
  return useQuery({
    queryKey: ['my-team-member', profile.data?.id],
    enabled: !!profile.data?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('team_members')
        .select('*')
        .eq('profile_id', profile.data!.id)
        .maybeSingle();
      return data;
    },
  });
}

export function useMyTasks() {
  const { user } = useAuth();
  const profileQ = useQuery({
    queryKey: ['my-profile-id', user?.id],
    enabled: !!user?.id,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id').eq('user_id', user!.id).maybeSingle();
      return data?.id as string | null;
    },
  });
  const profileId = profileQ.data;
  const userId = user?.id;
  const assigneeIds = userId
    ? [userId, ...(profileId && profileId !== userId ? [profileId] : [])]
    : [];

  return useQuery({
    queryKey: ['my-tasks', user?.id, profileId],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase.from('tasks').select('*').in('assigned_to', assigneeIds).order('deadline');
      return data || [];
    },
  });
}

export function useMyProjects() {
  const { user } = useAuth();
  const profileQ = useQuery({
    queryKey: ['my-profile-id', user?.id],
    enabled: !!user?.id,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id').eq('user_id', user!.id).maybeSingle();
      return data?.id as string | null;
    },
  });
  const profileId = profileQ.data;
  return useQuery({
    queryKey: ['my-projects', user?.id, profileId],
    enabled: !!user?.id && !!profileId,
    queryFn: async () => {
      const { data: memberRows } = await supabase.from('project_members').select('project_id').eq('profile_id', profileId!);
      if (!memberRows?.length) return [];
      const ids = memberRows.map(r => r.project_id);
      const { data } = await supabase.from('projects').select('*').in('id', ids).order('deadline');
      return data || [];
    },
  });
}

export function useMyMeetings() {
  const { user } = useAuth();
  const profileQ = useQuery({
    queryKey: ['my-profile-id', user?.id],
    enabled: !!user?.id,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id').eq('user_id', user!.id).maybeSingle();
      return data?.id as string | null;
    },
  });
  const profileId = profileQ.data;
  return useQuery({
    queryKey: ['my-meetings', user?.id, profileId],
    enabled: !!user?.id && !!profileId,
    queryFn: async () => {
      // Apanha reuniões onde sou participante OU organizador (created_by)
      const { data: partRows } = await supabase
        .from('meeting_participants')
        .select('meeting_id')
        .eq('profile_id', profileId!);
      const partIds = (partRows || []).map(r => r.meeting_id);

      const { data: ownedRows } = await supabase
        .from('meetings')
        .select('id')
        .eq('created_by', user!.id);
      const ownedIds = (ownedRows || []).map(r => r.id);

      const allIds = Array.from(new Set([...partIds, ...ownedIds]));
      if (!allIds.length) return [];
      const { data } = await supabase
        .from('meetings')
        .select('*')
        .in('id', allIds)
        .order('date_time');
      return data || [];
    },
  });
}

export function useMyTimeEntries() {
  const member = useMyTeamMember();
  return useQuery({
    queryKey: ['my-time-entries', member.data?.id],
    enabled: !!member.data?.id,
    queryFn: async () => {
      const { data } = await supabase.from('time_entries').select('*').eq('member_id', member.data!.id).order('entry_date', { ascending: false });
      return data || [];
    },
  });
}

export function useProjects() {
  return useQuery({
    queryKey: ['projects-list'],
    queryFn: async () => {
      const { data } = await supabase.from('projects').select('id, name');
      return data || [];
    },
  });
}

export function useProfiles() {
  return useQuery({
    queryKey: ['profiles'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, full_name, avatar_url');
      return data || [];
    },
  });
}

export function useMonthRoutineTasks() {
  const { user } = useAuth();
  const mStart = format(startOfMonth(new Date()), 'yyyy-MM-dd');
  const mEnd = format(endOfMonth(new Date()), 'yyyy-MM-dd');
  return useQuery({
    queryKey: ['routine-tasks-month', user?.id, mStart],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('tasks')
        .select('*')
        .eq('tag', 'Rotina')
        .eq('assigned_to', user!.id)
        .gte('deadline', mStart)
        .lte('deadline', mEnd)
        .order('deadline');
      return data || [];
    },
  });
}

export function useMyOnboarding(teamMemberId: string | undefined) {
  return useQuery({
    queryKey: ['my-onboarding', teamMemberId],
    enabled: !!teamMemberId,
    queryFn: async () => {
      const { data } = await supabase
        .from('member_onboarding')
        .select('*')
        .eq('member_id', teamMemberId!)
        .order('sort_order');
      return data || [];
    },
  });
}
