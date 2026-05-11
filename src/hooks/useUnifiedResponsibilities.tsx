import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

import {
  isToday, isBefore, isWithinInterval, parseISO, startOfDay, startOfWeek,
  endOfWeek, addDays, format,
} from 'date-fns';
import { isTaskDone } from '@/lib/taskStatus';

// ─── Types ───────────────────────────────────────────────────

export type ResponsibilitySource =
  | 'tarefa' | 'crm' | 'conteudo' | 'reuniao'
  | 'projeto' | 'nps' | 'acao_venda' | 'rotina';

export interface UnifiedItem {
  id: string;
  sourceId: string;
  source: ResponsibilitySource;
  title: string;
  subtitle?: string;
  date?: string;           // ISO date string for sorting
  deadline?: string;
  priority?: string;
  isInfoOnly: boolean;     // meetings & projects — no checkbox
  completed: boolean;
  estimatedHours: number;  // 0 = use default weight
}

const DEFAULT_WEIGHT_HOURS = 0.25;
const DEFAULT_MEETING_HOURS = 1;

const SOURCE_LABELS: Record<ResponsibilitySource, string> = {
  tarefa: 'Tarefas',
  crm: 'CRM',
  conteudo: 'Conteúdos',
  reuniao: 'Reuniões',
  projeto: 'Projetos',
  nps: 'NPS',
  acao_venda: 'Ações de Venda',
  rotina: 'Rotinas',
};

export { SOURCE_LABELS };

// ─── Hook ────────────────────────────────────────────────────

export function useUnifiedResponsibilities(userId?: string) {
  const { user, isOwner } = useAuth();
  const uid = userId || user?.id;
  
  const today = startOfDay(new Date());
  const weekStart_ = startOfWeek(today, { weekStartsOn: 1 });
  const weekEnd_ = endOfWeek(today, { weekStartsOn: 1 });
  const todayStr = format(today, 'yyyy-MM-dd');
  const currentMonth = today.getMonth() + 1;
  const currentYear = today.getFullYear();

  // Fetch profile id (profile.id != auth user.id)
  const profileQ = useQuery({
    queryKey: ['unified-profile-id', uid],
    enabled: !!uid,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase.from('profiles')
        .select('id')
        .eq('user_id', uid!)
        .maybeSingle();
      return data?.id as string | null;
    },
  });
  const profileId = profileQ.data;

  // Collect all IDs that could be used as assigned_to
  const assigneeIds = [uid!, ...(profileId && profileId !== uid ? [profileId] : [])];

  // 1. Tasks
  const tasksQ = useQuery({
    queryKey: ['unified-tasks', uid, profileId],
    enabled: !!uid,
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase.from('tasks')
        .select('id,name,status,deadline,priority,project_id,estimated_time,created_at,tag,routine_id')
        .in('assigned_to', assigneeIds).order('deadline');
      return data || [];
    },
  });

  // 2. CRM leads (follow-up needed)
  const leadsQ = useQuery({
    queryKey: ['unified-crm', uid],
    enabled: !!uid,
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase.from('crm_leads')
        .select('id,name,status,next_followup,responsible_id')
        .not('status', 'in', '("ganho","perdido")')
        .not('next_followup', 'is', null);
      return data || [];
    },
  });

  // 3. Content items
  const contentQ = useQuery({
    queryKey: ['unified-content', uid, profileId],
    enabled: !!uid && !!profileId,
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase.from('content_items')
        .select('id,title,status,scheduled_at,assigned_to')
        // assigned_to em content_items refere-se ao profile.id
        .eq('assigned_to', profileId!)
        .not('status', 'eq', 'publicado');
      return data || [];
    },
  });

  // 4. Meetings (next 7 days)
  const meetingsQ = useQuery({
    queryKey: ['unified-meetings', uid, profileId],
    enabled: !!uid && !!profileId,
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      const { data: partRows } = await supabase.from('meeting_participants').select('meeting_id').eq('profile_id', profileId!);
      if (!partRows?.length) return [];
      const ids = partRows.map(r => r.meeting_id);
      const { data } = await supabase.from('meetings')
        .select('id,title,date_time,status')
        .in('id', ids)
        .gte('date_time', todayStr)
        .lte('date_time', format(addDays(today, 7), 'yyyy-MM-dd\'T\'23:59:59'))
        .order('date_time');
      return data || [];
    },
  });

  // 5. Projects (deadline in next 7 days)
  const projectsQ = useQuery({
    queryKey: ['unified-projects', uid, profileId],
    enabled: !!uid && !!profileId,
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      const { data: memberRows } = await supabase.from('project_members').select('project_id').eq('profile_id', profileId!);
      if (!memberRows?.length) return [];
      const ids = memberRows.map(r => r.project_id);
      const { data } = await supabase.from('projects')
        .select('id,name,status,deadline')
        .in('id', ids)
        .gte('deadline', todayStr)
        .lte('deadline', format(addDays(today, 7), 'yyyy-MM-dd'))
        .neq('status', 'concluido');
      return data || [];
    },
  });

  // 6. NPS records
  const npsQ = useQuery({
    queryKey: ['unified-nps', uid, isOwner],
    // NPS sem responsável atribuído — só relevante para Owner (gestão).
    enabled: !!uid && !!isOwner,
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase.from('client_nps_records')
        .select('id,expected_date,status,client_id,clients(full_name)')
        .lte('expected_date', todayStr)
        .in('status', ['por_fazer', 'em_atraso']);
      return data || [];
    },
  });

  // 8. Sales actions
  const salesActionsQ = useQuery({
    queryKey: ['unified-sales-actions', uid, isOwner],
    // Ações de venda não têm responsável individual — só Owner.
    enabled: !!uid && !!isOwner,
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase.from('commercial_sales_actions')
        .select('id,action_name,status,start_date,end_date,created_at')
        .in('status', ['em_curso', 'por_comecar'])
        .lte('start_date', todayStr);
      return data || [];
    },
  });

  // 9. Routine tasks — already included via tasksQ (tag='Rotina'), no separate query needed

  // ─── Aggregate ─────────────────────────────────────────────

  const items: UnifiedItem[] = useMemo(() => {
    const result: UnifiedItem[] = [];

    // 1. Tasks (split into tarefa vs rotina based on tag)
    (tasksQ.data || []).forEach(t => {
      if (isTaskDone(t)) return;
      const isRoutine = t.tag === 'Rotina' || !!t.routine_id;
      result.push({
        id: `${isRoutine ? 'rotina' : 'tarefa'}-${t.id}`,
        sourceId: t.id,
        source: isRoutine ? 'rotina' : 'tarefa',
        title: t.name,
        subtitle: undefined,
        // Sem deadline ⇒ sem data; não deve cair em "hoje" nem "atraso".
        date: t.deadline || undefined,
        deadline: t.deadline || undefined,
        priority: t.priority,
        isInfoOnly: false,
        completed: isTaskDone(t),
        estimatedHours: t.estimated_time ? Number(t.estimated_time) : 0,
      });
    });

    // 2. CRM follow-ups
    (leadsQ.data || []).forEach(l => {
      if (!l.next_followup) return;
      const followupDate = l.next_followup;
      if (isBefore(parseISO(followupDate), addDays(today, 1)) || isToday(parseISO(followupDate))) {
        // Only include if responsible matches or no responsible (owner default)
        if (l.responsible_id && l.responsible_id !== uid) return;
        result.push({
          id: `crm-${l.id}`,
          sourceId: l.id,
          source: 'crm',
          title: `Follow-up — ${l.name}`,
          date: followupDate,
          deadline: followupDate,
          isInfoOnly: false,
          completed: false,
          estimatedHours: 0,
        });
      }
    });

    // 3. Content
    (contentQ.data || []).forEach(c => {
      if (!c.scheduled_at) return;
      const schedDate = c.scheduled_at.split('T')[0];
      const d = parseISO(schedDate);
      // Inclui conteúdos até ao fim da próxima semana (cobre vista "Hoje" e "Semana")
      if (isBefore(d, addDays(weekEnd_, 8))) {
        result.push({
          id: `conteudo-${c.id}`,
          sourceId: c.id,
          source: 'conteudo',
          title: `Publicar — ${c.title}`,
          date: c.scheduled_at,
          deadline: schedDate,
          isInfoOnly: false,
          completed: false,
          estimatedHours: 0,
        });
      }
    });

    // 4. Meetings (info only)
    (meetingsQ.data || []).forEach(m => {
      result.push({
        id: `reuniao-${m.id}`,
        sourceId: m.id,
        source: 'reuniao',
        title: `Reunião — ${m.title}`,
        date: m.date_time,
        deadline: m.date_time?.split('T')[0],
        isInfoOnly: true,
        completed: false,
        estimatedHours: DEFAULT_MEETING_HOURS,
      });
    });

    // 5. Projects (info only)
    (projectsQ.data || []).forEach(p => {
      result.push({
        id: `projeto-${p.id}`,
        sourceId: p.id,
        source: 'projeto',
        title: `Entrega — ${p.name}`,
        date: p.deadline,
        deadline: p.deadline || undefined,
        isInfoOnly: true,
        completed: false,
        estimatedHours: 0,
      });
    });

    // 6. NPS
    (npsQ.data || []).forEach(n => {
      const clientName = (n as { clients?: { full_name?: string | null } | null }).clients?.full_name || 'Cliente';
      result.push({
        id: `nps-${n.id}`,
        sourceId: n.id,
        source: 'nps',
        title: `NPS — ${clientName}`,
        date: n.expected_date,
        deadline: n.expected_date,
        isInfoOnly: false,
        completed: false,
        estimatedHours: 0,
      });
    });

    // 8. Sales actions
    (salesActionsQ.data || []).forEach(a => {
      result.push({
        id: `acao_venda-${a.id}`,
        sourceId: a.id,
        source: 'acao_venda',
        title: `Ação de Venda — ${a.action_name}`,
        date: a.start_date || a.created_at,
        deadline: a.end_date || undefined,
        isInfoOnly: false,
        completed: false,
        estimatedHours: 0,
      });
    });

    // 9. Rotinas — routine tasks already included via tasks source (tag='Rotina')

    // Sort by date
    result.sort((a, b) => {
      const da = a.date || '9999';
      const db = b.date || '9999';
      return da.localeCompare(db);
    });

    return result;
  }, [tasksQ.data, leadsQ.data, contentQ.data, meetingsQ.data, projectsQ.data, npsQ.data, salesActionsQ.data, uid, today]);

  // ─── Filtered views ────────────────────────────────────────

  const todayItems = useMemo(() =>
    items.filter(i => {
      // "Hoje" = itens com prazo hoje OU já atrasados.
      // Itens sem data ficam fora — pertencem à lista geral de tarefas.
      if (!i.date) return false;
      const d = parseISO(i.date.split('T')[0]);
      return isToday(d) || isBefore(d, today);
    }),
  [items, today]);

  const weekItems = useMemo(() =>
    items.filter(i => {
      if (!i.date) return false;
      const d = parseISO(i.date.split('T')[0]);
      return isWithinInterval(d, { start: weekStart_, end: weekEnd_ }) || isBefore(d, today);
    }),
  [items, weekStart_, weekEnd_, today]);

  // ─── No bidirectional sync — items are windows to their source ──

  // ─── Productivity helpers ──────────────────────────────────

  const getItemHours = (item: UnifiedItem) => {
    if (item.estimatedHours > 0) return item.estimatedHours;
    if (item.source === 'reuniao') return DEFAULT_MEETING_HOURS;
    return DEFAULT_WEIGHT_HOURS;
  };

  return {
    items,
    todayItems,
    weekItems,
    getItemHours,
    isLoading: profileQ.isLoading || tasksQ.isLoading || leadsQ.isLoading || contentQ.isLoading || meetingsQ.isLoading,
  };
}
