import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format, startOfMonth, endOfMonth } from 'date-fns';

// ─── Constants ──────────────────────────────────────────────

export const STATUS_COLORS: Record<string, string> = {
  por_comecar: 'bg-muted text-muted-foreground',
  a_fazer: 'bg-info/15 text-info',
  aguarda_feedback: 'bg-warning/15 text-warning',
  para_aprovacao: 'bg-purple-100 text-purple-800',
  precisa_alteracoes: 'bg-warning/15 text-warning',
  done: 'bg-success/15 text-success',
};

export const STATUS_LABELS: Record<string, string> = {
  por_comecar: 'Por começar',
  a_fazer: 'A fazer',
  aguarda_feedback: 'Aguarda Feedback',
  para_aprovacao: 'Para Aprovação',
  precisa_alteracoes: 'Precisa de Alterações',
  done: 'Done',
};

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

export const PROJ_STATUS_MAP: Record<string, { label: string; color: string }> = {
  em_ideia: { label: 'Em ideia', color: 'bg-gray-100 text-gray-700' },
  em_curso: { label: 'Em curso', color: 'bg-info/15 text-info' },
  em_pausa: { label: 'Em pausa', color: 'bg-warning/15 text-warning' },
  em_revisao: { label: 'Em revisão', color: 'bg-purple-100 text-purple-800' },
  concluido: { label: 'Concluído', color: 'bg-success/15 text-success' },
  cancelado: { label: 'Cancelado', color: 'bg-destructive/15 text-destructive' },
  arquivo: { label: 'Arquivo', color: 'bg-slate-100 text-slate-600' },
};

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
  const assigneeIds = [user?.id!, ...(profileId && profileId !== user?.id ? [profileId] : [])];

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
  return useQuery({
    queryKey: ['my-projects', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data: memberRows } = await supabase.from('project_members').select('project_id').eq('profile_id', user!.id);
      if (!memberRows?.length) return [];
      const ids = memberRows.map(r => r.project_id);
      const { data } = await supabase.from('projects').select('*').in('id', ids).order('deadline');
      return data || [];
    },
  });
}

export function useMyMeetings() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['my-meetings', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data: partRows } = await supabase.from('meeting_participants').select('meeting_id').eq('profile_id', user!.id);
      if (!partRows?.length) return [];
      const ids = partRows.map(r => r.meeting_id);
      const { data } = await supabase.from('meetings').select('*').in('id', ids).order('date_time');
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
