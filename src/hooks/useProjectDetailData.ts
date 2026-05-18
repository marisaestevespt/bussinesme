import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import type { ProjectOption } from '@/pages/Reunioes';
import { logAudit } from '@/lib/auditLog';

// ─── Types ──────────────────────────────────────────────────────

export interface ProjectFull {
  id: string; name: string; type: string; status: string; department: string | null;
  departments: string[] | null;
  client_name: string | null; client_id: string | null;
  product_id: string | null; product_name: string | null;
  budgeted_minutes: number | null;
  start_date: string | null; deadline: string | null; progress: number; notes: string | null;
  objetivo: string | null; diretrizes: string | null; cronograma: string | null;
  entregaveis: string | null; recursos: string | null; project_notes: string | null;
  closure_good: string | null; closure_bad: string | null; closure_lessons: string | null;
  created_by: string | null; created_at: string; cover_url: string | null;
  total_time_minutes: number | null;
  project_mode: string | null;
  task_mode: string | null;
  task_modes?: string[] | null;
  whatsapp_group_url: string | null;
  contract_documents: Array<{ name: string; url: string }> | null;
  payment_method: string | null;
  payment_config: Record<string, unknown> | null;
}

export interface Profile { id: string; user_id: string; full_name: string | null; avatar_url: string | null; }
export interface Task { id: string; name: string; status: string; priority: string; deadline: string | null; assigned_to: string | null; project_id: string | null; department: string | null; estimated_time?: number | null; estimated_minutes?: number | null; }
export interface Meeting { id: string; title: string; date_time: string; status: string; project_id: string | null; }
export interface MonthlyOccurrence { id: string; status: string | null; linked_task_id: string | null; scheduled_date: string; }

// ─── Helpers ────────────────────────────────────────────────────

export async function calcTotalTime(projectId: string): Promise<number> {
  const { data: directTime } = await supabase.from('time_entries').select('duration').eq('project_id', projectId);
  const { data: taskIds } = await supabase.from('tasks').select('id').eq('project_id', projectId);
  let taskTime: { duration: number }[] = [];
  if (taskIds && taskIds.length > 0) {
    const { data } = await supabase.from('time_entries').select('duration').in('task_id', taskIds.map(t => t.id));
    taskTime = (data || []) as { duration: number }[];
  }
  const { data: meetingDurations } = await supabase.from('meetings').select('duration_minutes, planned_duration_minutes, actual_duration_minutes').eq('project_id', projectId);
  const meetingTime = (meetingDurations || []).reduce(
    (sum, m: any) => sum + (m.actual_duration_minutes ?? m.planned_duration_minutes ?? m.duration_minutes ?? 0),
    0,
  );
  const timeEntryTotal = [...(directTime || []), ...taskTime].reduce((sum, e) => sum + (e.duration || 0), 0);
  return timeEntryTotal + meetingTime;
}

// ─── Hook ───────────────────────────────────────────────────────

export function useProjectDetailData(id: string | undefined, opts?: { isRecorrenteMensal?: boolean; monthStart?: string; monthEnd?: string }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const allProjectsForMeetingQ = useQuery({
    queryKey: ['projects-for-meetings'],
    queryFn: async () => { const { data } = await supabase.from('projects').select('id, name').order('name').is('archived_at', null); return (data || []) as ProjectOption[]; },
  });

  const projectQ = useQuery({
    queryKey: ['project', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('projects').select('*').eq('id', id!).maybeSingle();
      if (error) throw error;
      return data as unknown as ProjectFull;
    },
    enabled: !!id,
  });

  const profilesQ = useQuery({
    queryKey: ['profiles'],
    queryFn: async () => { const { data } = await supabase.from('profiles').select('id, user_id, full_name, avatar_url'); return (data || []) as Profile[]; },
  });

  const teamMembersPhotosQ = useQuery({
    queryKey: ['team-members-photos'],
    queryFn: async () => {
      const { data } = await supabase.from('team_members').select('profile_id, full_name, photo_url');
      return (data || []) as { profile_id: string | null; full_name: string; photo_url: string | null }[];
    },
  });

  const projectMembersQ = useQuery({
    queryKey: ['project-members', id],
    queryFn: async () => {
      const { data } = await supabase.from('project_members').select('profile_id').eq('project_id', id!);
      return (data || []).map((d: { profile_id: string }) => d.profile_id);
    },
    enabled: !!id,
  });

  const tasksQ = useQuery({
    queryKey: ['project-tasks', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('tasks')
        .select('*')
        .eq('project_id', id!)
        .order('deadline', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true });

      return (data || []) as Task[];
    },
    enabled: !!id,
  });

  const clientsListQ = useQuery({
    queryKey: ['clients_list'],
    queryFn: async () => { const { data } = await supabase.from('clients').select('id, full_name').eq('status', 'ativo').order('full_name'); return data || []; },
  });

  const projectCostQ = useQuery({
    queryKey: ['project-cost', id],
    queryFn: async () => {
      const { data: directEntries } = await supabase.from('time_entries').select('duration, member_id').eq('project_id', id!);
      const { data: taskIds } = await supabase.from('tasks').select('id').eq('project_id', id!);
      let taskEntries: { duration: number; member_id: string | null }[] = [];
      if (taskIds && taskIds.length > 0) {
        const { data } = await supabase.from('time_entries').select('duration, member_id').in('task_id', taskIds.map(t => t.id));
        taskEntries = (data || []) as { duration: number; member_id: string | null }[];
      }
      const allEntries = [...(directEntries || []), ...taskEntries] as { duration: number; member_id: string | null }[];
      if (allEntries.length === 0) return 0;
      const memberIds = [...new Set(allEntries.filter(e => e.member_id).map(e => e.member_id!))];
      const { data: members } = memberIds.length > 0
        ? await supabase.from('team_members').select('id, hourly_cost').in('id', memberIds)
        : { data: [] };
      const costMap = new Map(
        (members || []).map((m: { id: string; hourly_cost: number | null }) => [m.id, m.hourly_cost || 0]),
      );
      return allEntries.reduce((sum, e) => {
        const hours = (e.duration || 0) / 60;
        const cost = e.member_id ? (costMap.get(e.member_id) || 0) : 0;
        return sum + hours * cost;
      }, 0);
    },
    enabled: !!id,
  });

  const project = projectQ.data;
  const clientForProjectQ = useQuery({
    queryKey: ['client-by-name', project?.client_id, project?.client_name],
    queryFn: async () => {
      if (project!.client_id) return { id: project!.client_id };
      const { data } = await supabase.from('clients').select('id').eq('full_name', project!.client_name!).maybeSingle();
      return data as { id: string } | null;
    },
    enabled: !!(project?.client_id || project?.client_name),
  });

  const projectPhasesQ = useQuery({
    queryKey: ['project-phases', id],
    queryFn: async () => {
      const { data } = await supabase.from('project_phases').select('*').eq('project_id', id!).order('sort_order');
      return (data || []) as { status: string; planned_start?: string | null; cycle_month_index?: number | null }[];
    },
    enabled: !!id,
  });

  const projectDeliverablesQ = useQuery({
    queryKey: ['project-deliverables', id],
    queryFn: async () => {
      const { data } = await supabase.from('project_deliverables').select('*').eq('project_id', id!).order('sort_order');
      return (data || []) as { status: string }[];
    },
    enabled: !!id,
  });

  const monthlyTasksQ = useQuery({
    queryKey: ['project-monthly-tasks', id, opts?.monthStart],
    queryFn: async () => {
      const { data } = await supabase
        .from('tasks')
        .select('id, status, deadline')
        .eq('project_id', id!)
        .gte('deadline', opts!.monthStart!)
        .lte('deadline', opts!.monthEnd!);
      return (data || []) as { id: string; status: string; deadline: string }[];
    },
    enabled: !!id && !!opts?.isRecorrenteMensal && !!opts?.monthStart && !!opts?.monthEnd,
  });

  const monthlyOccurrencesQ = useQuery({
    queryKey: ['project-monthly-occurrences', id, opts?.monthStart],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('project_recurring_occurrences')
        .select('id, status, linked_task_id, scheduled_date')
        .eq('project_id', id!)
        .gte('scheduled_date', opts!.monthStart!)
        .lte('scheduled_date', opts!.monthEnd!);
      return (data || []) as MonthlyOccurrence[];
    },
    enabled: !!id && !!opts?.isRecorrenteMensal && !!opts?.monthStart && !!opts?.monthEnd,
  });

  const meetingsQ = useQuery({
    queryKey: ['project-meetings', id, project?.client_id],
    queryFn: async () => {
      // Reuniões ligadas ao projeto
      const { data: byProject } = await supabase
        .from('meetings')
        .select('id, title, date_time, status, project_id, client_id, visible_in_portal')
        .eq('project_id', id!)
        .order('date_time');
      let combined = (byProject || []) as Meeting[];
      // Fallback: reuniões só com client_id (sem project_id) deste cliente
      if (project?.client_id) {
        const { data: byClient } = await supabase
          .from('meetings')
          .select('id, title, date_time, status, project_id, client_id, visible_in_portal')
          .eq('client_id', project.client_id)
          .is('project_id', null)
          .order('date_time');
        const seen = new Set(combined.map(m => m.id));
        for (const m of (byClient || []) as Meeting[]) {
          if (!seen.has(m.id)) combined.push(m);
        }
        combined.sort((a, b) => (a.date_time || '').localeCompare(b.date_time || ''));
      }
      return combined;
    },
    enabled: !!id,
  });

  // ─── Mutations independentes do estado local ────────────────

  const projectMembers = projectMembersQ.data || [];
  const toggleMember = useMutation({
    mutationFn: async (profileId: string) => {
      // Re-check server-side to avoid stale cache races on rapid clicks
      const { data: existing, error: checkErr } = await supabase
        .from('project_members')
        .select('profile_id')
        .eq('project_id', id!)
        .eq('profile_id', profileId)
        .maybeSingle();
      if (checkErr) throw checkErr;
      if (existing) {
        const { error } = await supabase
          .from('project_members')
          .delete()
          .eq('project_id', id!)
          .eq('profile_id', profileId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('project_members')
          .insert({ project_id: id!, profile_id: profileId });
        if (error) throw error;
      }
    },
    onMutate: async (profileId: string) => {
      await queryClient.cancelQueries({ queryKey: ['project-members', id] });
      const previous = queryClient.getQueryData<string[]>(['project-members', id]) || [];
      const next = previous.includes(profileId)
        ? previous.filter(p => p !== profileId)
        : [...previous, profileId];
      queryClient.setQueryData(['project-members', id], next);
      return { previous };
    },
    onError: (e: Error, _profileId, context) => {
      if (context?.previous) queryClient.setQueryData(['project-members', id], context.previous);
      toast.error(e.message);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['project-members', id] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { data: snap } = await supabase.from('projects').select('name, client_id').eq('id', id!).maybeSingle();
      // Soft-delete: archive instead of hard delete to preserve history & avoid FK issues
      const { error } = await supabase.from('projects').update({ archived_at: new Date().toISOString() } as any).eq('id', id!);
      if (error) throw error;
      logAudit('archived', 'project', id, { name: snap?.name, client_id: snap?.client_id });
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['projects'] }); toast.success('Projeto arquivado. Podes restaurá-lo na lista de Arquivados.'); navigate('/hub/projetos'); },
    onError: (e: Error) => toast.error(e.message),
  });

  return {
    allProjectsForMeeting: allProjectsForMeetingQ.data || [],
    project,
    isLoading: projectQ.isLoading,
    profiles: profilesQ.data || [],
    teamMembersPhotos: teamMembersPhotosQ.data || [],
    projectMembers,
    tasks: tasksQ.data || [],
    clientsList: clientsListQ.data || [],
    projectCost: projectCostQ.data || 0,
    clientForProject: clientForProjectQ.data,
    projectPhases: projectPhasesQ.data || [],
    projectDeliverables: projectDeliverablesQ.data || [],
    monthlyTasks: monthlyTasksQ.data || [],
    monthlyOccurrences: monthlyOccurrencesQ.data || [],
    meetings: meetingsQ.data || [],
    toggleMember,
    deleteMutation,
  };
}