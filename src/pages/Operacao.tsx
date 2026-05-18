import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useTeamPhotos } from '@/hooks/useTeamPhotos';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { useSearchParams } from 'react-router-dom';
import { Users, FolderOpen, CheckCircle2, Clock, AlertTriangle, Briefcase, Building2, ListTodo, Filter, X, TrendingUp, UserX, CalendarClock, Rocket, Target, CircleDot, Hourglass, Activity } from 'lucide-react';
import { getPlanningSection } from '@/lib/department-planning';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format, isToday, isBefore, startOfToday, isAfter, endOfWeek, startOfWeek, subDays, differenceInDays } from 'date-fns';
import { pt } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { OperacaoKpis } from '@/components/operacao/OperacaoKpis';
import { OperacaoAnaliseTab } from '@/components/operacao/OperacaoAnaliseTab';
import { isTaskDone, isTaskOpen, isTaskOverdue } from '@/lib/taskStatus';
import { computeProjectHealth } from '@/lib/projectHealth';
import { isDeliverableDone } from '@/lib/projectProgress';
import { cn } from '@/lib/utils';
import { TaskFormDialog } from '@/components/tasks/TaskFormDialog';
import { EmptyHint } from '@/components/ui/loading-skeletons';
import { useImpersonation } from '@/contexts/ImpersonationContext';

import {
  Project, Task, Client, Profile, ProjectMember, TaskFilters,
  ACTIVE_STATUSES, EMPTY_FILTERS, DEPT_LABELS, DEPT_COLORS, TASK_STATUS_META,
  getInitials, applyTaskFilters, TaskDynamicFilters, TaskBadge, PriorityDot,
} from './operacao/shared';

// ─── Main ───────────────────────────────────────────────────────

export default function OperacaoPage() {
  const [clientFilters, setClientFilters] = useState<TaskFilters>(EMPTY_FILTERS);
  const { impersonating } = useImpersonation();
  const impersonatedProfileId = impersonating?.profile_id ?? null;
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const activeTab = tabParam === 'interno' || tabParam === 'analise' ? tabParam : 'clientes';
  const { getPhotoUrl } = useTeamPhotos();
  const [internoFilters, setInternoFilters] = useState<TaskFilters>(EMPTY_FILTERS);
  const [expandedStatus, setExpandedStatus] = useState<string | null>(null);
  const [healthDetailProjectId, setHealthDetailProjectId] = useState<string | null>(null);
  const [taskDetailId, setTaskDetailId] = useState<string | null>(null);
  const [showOverdueTasks, setShowOverdueTasks] = useState(false);

  const qc = useQueryClient();

  // ── Queries ─────────────────────────────────────────────────
  const { data: projects = [] } = useQuery({
    queryKey: ['op-projects'],
    queryFn: async () => {
      const { data } = await supabase.from('projects').select('id,name,type,status,department,client_name,deadline,progress,start_date,created_at,cover_url,project_mode,task_mode,client_id').order('deadline', { ascending: true }).is('archived_at', null);
      return (data || []) as (Project & { project_mode: string | null; task_mode: string | null })[];
    },
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['op-tasks', impersonatedProfileId],
    queryFn: async () => {
      let q = supabase
        .from('tasks')
        .select('id,name,status,priority,deadline,assigned_to,project_id,department')
        .order('deadline', { ascending: true });
      if (impersonating) {
        // Quando estamos a ver a app como um membro, só mostramos tarefas
        // atribuídas a esse membro (mesmo critério usado para abrir o detalhe).
        q = impersonatedProfileId
          ? q.eq('assigned_to', impersonatedProfileId)
          : q.eq('assigned_to', '00000000-0000-0000-0000-000000000000');
      }
      const { data } = await q;
      return (data || []) as Task[];
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['op-clients'],
    queryFn: async () => {
      const { data } = await supabase.from('clients').select('id,client_id,full_name,status,current_product,start_date,end_of_cycle');
      return (data || []) as Client[];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ['op-profiles'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id,full_name,avatar_url');
      return (data || []) as Profile[];
    },
  });

  // Fetch all onboarding deliverables (pending AND completed, to distinguish "all done" from "no checklist")
  const { data: allOnboardingDeliverables = [] } = useQuery({
    queryKey: ['op-onboarding-deliverables'],
    queryFn: async () => {
      const { data } = await supabase
        .from('project_deliverables')
        .select('id, name, status, phase_id, project_id, sort_order');
      return (data || []) as { id: string; name: string; status: string; phase_id: string; project_id: string; sort_order: number }[];
    },
  });

  const { data: onboardingPhases = [] } = useQuery({
    queryKey: ['op-onboarding-phases'],
    queryFn: async () => {
      const { data } = await supabase
        .from('project_phases')
        .select('id, project_id, name, is_onboarding')
        .eq('is_onboarding', true);
      return (data || []) as { id: string; project_id: string; name: string; is_onboarding: boolean }[];
    },
  });

  // Status de TODAS as fases ativas — usado para saber se uma entrega já está "em curso".
  const { data: allPhases = [] } = useQuery({
    queryKey: ['op-all-phases-status'],
    queryFn: async () => {
      const { data } = await supabase
        .from('project_phases')
        .select('id, status, project_id');
      return (data || []) as { id: string; status: string; project_id: string }[];
    },
  });

  const { data: projectMembers = [] } = useQuery({
    queryKey: ['op-project-members'],
    queryFn: async () => {
      const { data } = await supabase.from('project_members').select('project_id,profile_id');
      return (data || []) as ProjectMember[];
    },
  });

  const { data: deliverables = [] } = useQuery({
    queryKey: ['op-deliverables'],
    queryFn: async () => {
      // Usa planned_end (data planeada de fim) — coluna deadline está deprecated nos entregáveis.
      // Exclui concluídos/entregues e apenas mostra os com data planeada.
      const { data } = await supabase
        .from('project_deliverables')
        .select('id,name,planned_start,planned_end,status,project_id,phase_id,assigned_to,responsible_type')
        .not('status', 'in', '(concluido,entregue)')
        .not('planned_end', 'is', null)
        .order('planned_end', { ascending: true });
      return (data || []).map(d => ({
        id: d.id,
        name: d.name,
        deadline: d.planned_end as string | null, // alias para reutilizar lógica existente
        planned_start: (d as any).planned_start as string | null,
        status: d.status,
        project_id: d.project_id,
        phase_id: (d as any).phase_id as string | null,
        assigned_to: d.assigned_to,
        responsible_type: (d as any).responsible_type as string | null,
      })) as { id: string; name: string; deadline: string | null; planned_start: string | null; status: string; project_id: string; phase_id: string | null; assigned_to: string | null; responsible_type: string | null }[];
    },
  });

  const { data: meetings = [] } = useQuery({
    queryKey: ['op-meetings'],
    queryFn: async () => {
      const { data } = await supabase
        .from('meetings')
        .select('id,title,date_time,status,project_id,client_id,client_name')
        .not('status', 'in', '(terminada)')
        .order('date_time', { ascending: true });
      return (data || []) as { id: string; title: string; date_time: string; status: string; project_id: string | null; client_id: string | null; client_name: string | null }[];
    },
  });

  // ── Derived data ────────────────────────────────────────────
  const profileMap = useMemo(() => new Map(profiles.map(p => [p.id, p])), [profiles]);

  const clientProjects = useMemo(() => projects.filter(p => p.type === 'clientes' || p.type === 'cliente_projeto_unico' || p.type === 'cliente_servico_mensal'), [projects]);
  const internoProjects = useMemo(() => projects.filter(p => p.type === 'interno'), [projects]);

  const activeClientProjects = useMemo(() => clientProjects.filter(p => ACTIVE_STATUSES.includes(p.status)), [clientProjects]);
  const activeInternoProjects = useMemo(() => internoProjects.filter(p => ACTIVE_STATUSES.includes(p.status)), [internoProjects]);

  // Split by mode
  const activeClientPontuais = useMemo(() => activeClientProjects.filter(p => p.project_mode !== 'recorrente'), [activeClientProjects]);
  const activeClientRecorrentes = useMemo(() => activeClientProjects.filter(p => p.project_mode === 'recorrente'), [activeClientProjects]);
  const activeInternoPontuais = useMemo(() => activeInternoProjects.filter(p => p.project_mode !== 'recorrente'), [activeInternoProjects]);
  const activeInternoRecorrentes = useMemo(() => activeInternoProjects.filter(p => p.project_mode === 'recorrente'), [activeInternoProjects]);

  const allActiveProjects = useMemo(() => projects.filter(p => ACTIVE_STATUSES.includes(p.status)), [projects]);

  const clientProjectIds = useMemo(() => new Set(clientProjects.map(p => p.id)), [clientProjects]);
  const internoProjectIds = useMemo(() => new Set(internoProjects.map(p => p.id)), [internoProjects]);

  const clientTasks = useMemo(() => tasks.filter(t => t.project_id && clientProjectIds.has(t.project_id) && isTaskOpen(t)), [tasks, clientProjectIds]);
  const internoTasks = useMemo(() => tasks.filter(t => t.project_id && internoProjectIds.has(t.project_id) && isTaskOpen(t)), [tasks, internoProjectIds]);

  const activeClients = useMemo(() => clients.filter(c => c.status !== 'terminado'), [clients]);

  const onboardingClients = useMemo(() => clients.filter(c => c.status === 'em_onboarding'), [clients]);

  const internoByDept = useMemo(() => {
    const map = new Map<string, number>();
    activeInternoProjects.forEach(p => {
      const dept = p.department || 'sem_dept';
      map.set(dept, (map.get(dept) || 0) + 1);
    });
    return Array.from(map.entries()).map(([dept, count]) => ({
      name: DEPT_LABELS[dept] || dept,
      value: count,
      color: DEPT_COLORS[dept] || 'hsl(var(--muted-foreground))',
    })).sort((a, b) => b.value - a.value);
  }, [activeInternoProjects]);

  // Hoisted up so memos defined below (like `projectProgress`) can use it.
  const today = startOfToday();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekEnd2 = endOfWeek(today, { weekStartsOn: 1 });

  // Per-project real progress map. Uses the SAME rule as the project detail page:
  //   recorrente mensal → tasks of current month
  //   else → deliverables (all) > phases (all) > 0
  // This keeps the "Saúde dos Projetos" card, project lists in Operação, and the
  // ProjectHealthBadge inside the detail page perfectly coherent.
  const projectProgress = useMemo(() => {
    const map = new Map<string, number>();
    // Group deliverables by project
    const delivByProject = new Map<string, typeof allDeliverablesForProgress>();
    allDeliverablesForProgress.forEach(d => {
      if (!d.project_id) return;
      if (!delivByProject.has(d.project_id)) delivByProject.set(d.project_id, []);
      delivByProject.get(d.project_id)!.push(d);
    });
    // Group phases by project
    const phasesByProject = new Map<string, typeof allPhases>();
    allPhases.forEach(ph => {
      if (!ph.project_id) return;
      if (!phasesByProject.has(ph.project_id)) phasesByProject.set(ph.project_id, []);
      phasesByProject.get(ph.project_id)!.push(ph);
    });
    // Pre-compute current month tasks done/total per project (only used by recurring)
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59);
    const monthlyByProject = new Map<string, { done: number; total: number }>();
    tasks.forEach(t => {
      if (!t.project_id || !t.deadline) return;
      const dl = new Date(t.deadline);
      if (dl < monthStart || dl > monthEnd) return;
      const cur = monthlyByProject.get(t.project_id) || { done: 0, total: 0 };
      cur.total += 1;
      if (isTaskDone(t)) cur.done += 1;
      monthlyByProject.set(t.project_id, cur);
    });
    projects.forEach(p => {
      const dels = delivByProject.get(p.id) || [];
      const phs = phasesByProject.get(p.id) || [];
      const isRecMensal = p.type === 'cliente_servico_mensal' && p.project_mode === 'recorrente';
      const monthlyFn = isRecMensal
        ? () => monthlyByProject.get(p.id) || { done: 0, total: 0 }
        : null;
      map.set(
        p.id,
        computeProjectProgressFromSources(p as any, dels as any, phs as any, monthlyFn),
      );
    });
    return map;
  }, [projects, allDeliverablesForProgress, allPhases, tasks, today]);

  const internoMembers = useMemo(() => {
    const memberProjects = new Map<string, Set<string>>();
    projectMembers.forEach(pm => {
      if (internoProjectIds.has(pm.project_id)) {
        if (!memberProjects.has(pm.profile_id)) memberProjects.set(pm.profile_id, new Set());
        memberProjects.get(pm.profile_id)!.add(pm.project_id);
      }
    });
    const memberTasks = new Map<string, number>();
    internoTasks.forEach(t => {
      if (t.assigned_to) memberTasks.set(t.assigned_to, (memberTasks.get(t.assigned_to) || 0) + 1);
    });
    return Array.from(memberProjects.entries()).map(([profileId, projIds]) => ({
      profile: profileMap.get(profileId),
      projectCount: projIds.size,
      projectNames: Array.from(projIds).map(pid => projects.find(p => p.id === pid)?.name || '').filter(Boolean),
      openTasks: memberTasks.get(profileId) || 0,
    })).filter(m => m.profile);
  }, [projectMembers, internoProjectIds, internoTasks, profileMap, projects]);

  const projectMembersMap = useMemo(() => {
    const map = new Map<string, Profile[]>();
    projectMembers.forEach(pm => {
      const p = profileMap.get(pm.profile_id);
      if (p) {
        if (!map.has(pm.project_id)) map.set(pm.project_id, []);
        map.get(pm.project_id)!.push(p);
      }
    });
    return map;
  }, [projectMembers, profileMap]);

  const projectNameMap = useMemo(() => new Map(projects.map(p => [p.id, p.name])), [projects]);

  const filteredClientTasks = useMemo(() => applyTaskFilters(clientTasks, clientFilters), [clientTasks, clientFilters]);
  const filteredInternoTasks = useMemo(() => applyTaskFilters(internoTasks, internoFilters), [internoTasks, internoFilters]);

  const clientProjectOptions = useMemo(() => clientProjects.map(p => ({ id: p.id, name: p.name })), [clientProjects]);
  const internoProjectOptions = useMemo(() => internoProjects.map(p => ({ id: p.id, name: p.name })), [internoProjects]);

  // ── KPI data ────────────────────────────────────────────────
  // Note: `today`, `weekStart`, `weekEnd2` are declared earlier so that
  // the `projectProgress` memo can reference them.
  const overdueTasks = useMemo(() =>
    tasks.filter(t => isTaskOverdue(t, today)),
    [tasks, today]
  );

  const weeklyCompletion = useMemo(() => {
    const weekTasks = tasks.filter(t => t.deadline && new Date(t.deadline) >= weekStart && new Date(t.deadline) <= weekEnd2);
    const done = weekTasks.filter(isTaskDone).length;
    return { done, total: weekTasks.length, rate: weekTasks.length > 0 ? Math.round((done / weekTasks.length) * 100) : 0 };
  }, [tasks, weekStart, weekEnd2]);

  const allocatedMembers = useMemo(() => {
    const memberIds = new Set<string>();
    projectMembers.forEach(pm => {
      if (allActiveProjects.some(p => p.id === pm.project_id)) memberIds.add(pm.profile_id);
    });
    return memberIds.size;
  }, [projectMembers, allActiveProjects]);

   // ── Alerts data ─────────────────────────────────────────────
  const clientsNearEndOfCycle = useMemo(() => {
    return clients.filter(c => {
      if (c.status === 'terminado' || !c.end_of_cycle) return false;
      const daysLeft = differenceInDays(new Date(c.end_of_cycle), today);
      return daysLeft >= 0 && daysLeft <= 15;
    });
  }, [clients, today]);

  const overdueDeliverables = useMemo(() =>
    deliverables.filter(d => d.deadline && isBefore(new Date(d.deadline), today) && !isDeliverableDone(d)),
    [deliverables, today]
  );

  // ── À espera do cliente ─────────────────────────────────────
  // Entregas com responsável = cliente ainda em aberto + tarefas em "Aguarda feedback cliente"
  type WaitItem = {
    id: string;
    name: string;
    kind: 'task' | 'deliverable';
    projectId: string | null;
    projectName: string;
    daysWaiting: number;
    overdue: boolean;
  };
  const awaitingClient = useMemo<WaitItem[]>(() => {
    const items: WaitItem[] = [];

    tasks.forEach(t => {
      if (t.status !== 'aguarda_feedback') return;
      const proj = t.project_id ? allActiveProjects.find(p => p.id === t.project_id) : null;
      const ref = t.deadline ? new Date(t.deadline) : today;
      const days = differenceInDays(today, ref);
      items.push({
        id: t.id,
        name: t.name,
        kind: 'task',
        projectId: t.project_id,
        projectName: proj?.name || '',
        daysWaiting: Math.max(0, days),
        overdue: days > 0,
      });
    });

    const phaseStatusById = new Map(allPhases.map(p => [p.id, p.status]));

    deliverables.forEach(d => {
      if (d.responsible_type !== 'cliente') return;
      if (isDeliverableDone(d)) return;
      // Só conta se a entrega já está "ativa agora":
      //  - a fase já arrancou (status em_curso), OU
      //  - já passou a data de início planeada, OU
      //  - o prazo já passou (caso extremo)
      const phaseActive = d.phase_id ? phaseStatusById.get(d.phase_id) === 'em_curso' : false;
      const startPassed = d.planned_start ? !isBefore(today, new Date(d.planned_start)) : false;
      const deadlinePassed = d.deadline ? isBefore(new Date(d.deadline), today) : false;
      if (!phaseActive && !startPassed && !deadlinePassed) return;

      const proj = allActiveProjects.find(p => p.id === d.project_id);
      const ref = d.deadline ? new Date(d.deadline) : null;
      const days = ref ? differenceInDays(today, ref) : 0;
      items.push({
        id: d.id,
        name: d.name,
        kind: 'deliverable',
        projectId: d.project_id,
        projectName: proj?.name || '',
        daysWaiting: Math.max(0, days),
        overdue: ref ? isBefore(ref, today) : false,
      });
    });

    return items.sort((a, b) => Number(b.overdue) - Number(a.overdue) || b.daysWaiting - a.daysWaiting);
  }, [tasks, deliverables, allActiveProjects, allPhases, today]);

  // ── Em aprovação interna ────────────────────────────────────
  // Tarefas em "Para aprovação" — aguardam validação do responsável interno
  const pendingInternalApproval = useMemo<WaitItem[]>(() => {
    return tasks
      .filter(t => t.status === 'para_aprovacao')
      .map(t => {
        const proj = t.project_id ? allActiveProjects.find(p => p.id === t.project_id) : null;
        const ref = t.deadline ? new Date(t.deadline) : today;
        const days = differenceInDays(today, ref);
        return {
          id: t.id,
          name: t.name,
          kind: 'task' as const,
          projectId: t.project_id,
          projectName: proj?.name || '',
          daysWaiting: Math.max(0, days),
          overdue: days > 0,
        };
      })
      .sort((a, b) => Number(b.overdue) - Number(a.overdue) || b.daysWaiting - a.daysWaiting);
  }, [tasks, allActiveProjects, today]);

  // ── Countdown — next delivery (tasks + meetings + project deadlines) ──
  const nextDelivery = useMemo(() => {
    type NextItem = { id: string; name: string; daysLeft: number; deadline: string; projectName?: string; type: 'task' | 'project' | 'meeting'; projectId?: string };
    const candidates: NextItem[] = [];

    // Tasks (incluem entregas auto-geradas via deliverable_id)
    tasks.filter(isTaskOpen).forEach(t => {
      if (t.deadline && !isBefore(new Date(t.deadline), today)) {
        const proj = t.project_id ? allActiveProjects.find(p => p.id === t.project_id) : null;
        candidates.push({
          id: t.id, name: t.name, deadline: t.deadline,
          daysLeft: differenceInDays(new Date(t.deadline), today),
          projectName: proj?.name || '', type: 'task', projectId: t.project_id || undefined,
        });
      }
    });

    // Project deadlines
    allActiveProjects.forEach(p => {
      if (p.deadline && !isBefore(new Date(p.deadline), today)) {
        candidates.push({
          id: p.id, name: p.name, deadline: p.deadline,
          daysLeft: differenceInDays(new Date(p.deadline), today),
          type: 'project', projectId: p.id,
        });
      }
    });

    // Meetings
    meetings.forEach(m => {
      const dt = new Date(m.date_time);
      if (!isBefore(dt, today)) {
        const proj = m.project_id ? allActiveProjects.find(p => p.id === m.project_id) : null;
        candidates.push({
          id: m.id, name: `📅 ${m.title}`, deadline: m.date_time,
          daysLeft: differenceInDays(dt, today),
          projectName: proj?.name || m.client_name || '', type: 'meeting', projectId: m.project_id || undefined,
        });
      }
    });

    candidates.sort((a, b) => a.daysLeft - b.daysLeft);
    return candidates[0] || null;
  }, [allActiveProjects, tasks, meetings, today]);

  // ── Project health indicators ──────────────────────────────
  const projectHealth = useMemo(() => {
    return allActiveProjects.map(p => {
      const override = projectProgress.get(p.id);
      const r = computeProjectHealth(p as any, tasks as any, today, override);
      return { ...p, prog: r.prog ?? -1, health: r.health, isTarefasLivres: r.useOverdueOnly };
    }).sort((a, b) => {
      const order = { red: 0, yellow: 1, green: 2 };
      return order[a.health] - order[b.health];
    });
  }, [allActiveProjects, projectProgress, tasks, today]);

  // ── Delivery timeline (next 7 days) — tasks + meetings + project milestones ──
  const deliveryTimeline = useMemo(() => {
    const days: { date: Date; label: string; items: { name: string; type: 'project' | 'task' | 'meeting'; id: string; assigneeId?: string | null; projectId?: string | null }[] }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      const dateStr = format(d, 'yyyy-MM-dd');
      const items: { name: string; type: 'project' | 'task' | 'meeting'; id: string; assigneeId?: string | null; projectId?: string | null }[] = [];

      // Projects
      allActiveProjects.forEach(p => {
        if (p.deadline && format(new Date(p.deadline), 'yyyy-MM-dd') === dateStr) {
          items.push({ name: p.name, type: 'project', id: p.id, projectId: p.id });
        }
      });

      // Tasks (já incluem entregas auto-geradas)
      tasks.filter(isTaskOpen).forEach(t => {
        if (t.deadline && format(new Date(t.deadline), 'yyyy-MM-dd') === dateStr) {
          items.push({ name: t.name, type: 'task', id: t.id, assigneeId: t.assigned_to, projectId: t.project_id });
        }
      });

      // Meetings
      meetings.forEach(m => {
        if (format(new Date(m.date_time), 'yyyy-MM-dd') === dateStr) {
          items.push({ name: m.title, type: 'meeting', id: m.id, projectId: m.project_id });
        }
      });

      days.push({ date: d, label: isToday(d) ? 'Hoje' : format(d, 'EEE dd', { locale: pt }), items });
    }
    return days;
  }, [allActiveProjects, tasks, meetings, today]);

  function renderTaskRow(t: Task) {
    const assignee = t.assigned_to ? profileMap.get(t.assigned_to) : null;
    const projName = t.project_id ? projectNameMap.get(t.project_id) : null;
    const content = (
      <>
        <PriorityDot priority={t.priority} />
        <span className="flex-1 min-w-0 truncate">{t.name}</span>
        <TaskBadge deadline={t.deadline} status={t.status} />
        {projName && <span className="text-[10px] text-muted-foreground truncate max-w-[100px]">{projName}</span>}
        {t.deadline && <span className="text-[10px] text-muted-foreground shrink-0">{format(new Date(t.deadline), 'dd/MM')}</span>}
        {assignee && (
          <Avatar className="h-5 w-5 shrink-0">
            <AvatarImage src={getPhotoUrl(assignee)} />
            <AvatarFallback className="text-[8px]">{getInitials(assignee.full_name)}</AvatarFallback>
          </Avatar>
        )}
      </>
    );
    return (
      <button
        key={t.id}
        type="button"
        onClick={() => setTaskDetailId(t.id)}
        className="flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-muted/40 transition-colors text-sm cursor-pointer w-full text-left"
      >
        {content}
      </button>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader title="Operação" subtitle="Vista operacional de projetos de clientes e internos" department="operacao" />

        {/* Planeamento (regra: ver mem://design/department-planning-card.md) */}
        {(() => {
          const p = getPlanningSection('operacao');
          const Icon = p.icon;
          return (
            <Link to={p.path}>
              <Card className={`group cursor-pointer border bg-gradient-to-br ${p.color} transition-all duration-200 hover:shadow-md hover:-translate-y-0.5`}>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className={`h-9 w-9 rounded-lg bg-background/80 flex items-center justify-center shadow-sm shrink-0 ${p.iconColor}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-medium text-sm text-foreground">{p.label}</p>
                    <p className="text-[11px] text-muted-foreground">{p.desc}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })()}

        <OperacaoKpis
          allActiveCount={allActiveProjects.length}
          pontuaisCount={activeClientPontuais.length + activeInternoPontuais.length}
          recorrentesCount={activeClientRecorrentes.length + activeInternoRecorrentes.length}
          overdueTasks={overdueTasks.length}
          weeklyCompletion={weeklyCompletion}
          allocatedMembers={allocatedMembers}
          onClickOverdue={() => setShowOverdueTasks(true)}
        />

        {/* Clients near end of cycle — kept as small alert */}
        {clientsNearEndOfCycle.length > 0 && (
          <Card className="border border-warning/30 dark:border-warning bg-warning/15/50 dark:bg-warning/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <CalendarClock className="h-4 w-4 text-warning" />
                <h3 className="text-sm font-semibold text-warning dark:text-warning">Clientes perto do fim de ciclo</h3>
                <Badge variant="outline" className="bg-warning/15 text-warning border-warning/30 text-[10px]">{clientsNearEndOfCycle.length}</Badge>
              </div>
              <div className="flex flex-wrap gap-3">
                {clientsNearEndOfCycle.map(c => {
                  const daysLeft = differenceInDays(new Date(c.end_of_cycle!), today);
                  return (
                    <Link key={c.id} to={`/hub/clientes/${c.id}`} className="flex items-center gap-2 text-sm hover:underline">
                      <span className="font-medium text-warning dark:text-warning">{c.full_name}</span>
                      <Badge variant={daysLeft <= 7 ? 'destructive' : 'outline'} className="text-[10px]">{daysLeft}d</Badge>
                    </Link>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Task edit dialog (mesmo da página Tarefas) */}
        <TaskFormDialog
          open={!!taskDetailId}
          onOpenChange={open => !open && setTaskDetailId(null)}
          editingTask={taskDetailId ? tasks.find(x => x.id === taskDetailId) : null}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ['op-tasks'] });
            qc.invalidateQueries({ queryKey: ['op-deliverables'] });
          }}
        />

        {/* Overdue tasks dialog */}
        <Dialog open={showOverdueTasks} onOpenChange={setShowOverdueTasks}>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                <Clock className="h-4 w-4 text-destructive" /> Tarefas atrasadas
                <Badge variant="destructive" className="text-[10px]">{overdueTasks.length}</Badge>
              </DialogTitle>
              <p className="text-xs text-muted-foreground">Tarefas em aberto com prazo já vencido. Clica para abrir.</p>
            </DialogHeader>
            {overdueTasks.length === 0 ? (
              <div className="py-8 text-center">
                <CheckCircle2 className="h-8 w-8 text-success mx-auto mb-2" />
                <p className="text-sm font-medium text-success">Tudo em dia!</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tarefa</TableHead>
                      <TableHead>Projeto</TableHead>
                      <TableHead className="text-right">Prazo</TableHead>
                      <TableHead className="text-right">Atraso</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {overdueTasks
                      .slice()
                      .sort((a, b) => {
                        const da = a.deadline ? differenceInDays(today, new Date(a.deadline)) : 0;
                        const db = b.deadline ? differenceInDays(today, new Date(b.deadline)) : 0;
                        return db - da;
                      })
                      .map(t => {
                        const proj = t.project_id ? allActiveProjects.find(p => p.id === t.project_id) : null;
                        const days = t.deadline ? differenceInDays(today, new Date(t.deadline)) : 0;
                        return (
                          <TableRow
 key={t.id}
 className="cursor-pointer"
 onClick={() => { setShowOverdueTasks(false); setTaskDetailId(t.id); }}
                          >
                            <TableCell className="text-sm">
                              <div className="flex items-center gap-2">
                                <PriorityDot priority={t.priority} />
                                <span className="font-medium">{t.name}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {proj?.name || '—'}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-destructive">
                              {t.deadline ? format(new Date(t.deadline), 'dd/MM/yyyy') : '—'}
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge variant="destructive" className="text-[10px]">{days}d</Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Health detail dialog */}
        <Dialog open={!!healthDetailProjectId} onOpenChange={open => !open && setHealthDetailProjectId(null)}>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            {(() => {
              const p = allActiveProjects.find(proj => proj.id === healthDetailProjectId);
              if (!p) return null;
              const pTasks = tasks.filter(t => t.project_id === p.id && isTaskOpen(t));
              const pOverdueTasks = pTasks.filter(t => isTaskOverdue(t, today));
              const pUnassigned = pTasks.filter(t => !t.assigned_to);
              const hp = projectHealth.find(h => h.id === p.id);
              const healthLabel = hp?.health === 'red' ? 'Em risco' : hp?.health === 'yellow' ? 'Atenção' : 'Em dia';
              const healthColor = hp?.health === 'red' ? 'text-destructive' : hp?.health === 'yellow' ? 'text-warning' : 'text-success';
              // Re-run the health calc to get the human-readable reason + the
              // contextual numbers (expected progress, days left, etc.).
              const override = projectProgress.get(p.id);
              const detail = computeProjectHealth(p as any, tasks as any, today, override);
              const hasIssues = pOverdueTasks.length > 0 || pUnassigned.length > 0 || detail.health !== 'green';
              // Detect "schedule" issues that are not just overdue tasks
              const scheduleIssue =
                !detail.useOverdueOnly &&
                detail.health !== 'green' &&
                detail.prog !== null &&
                detail.expectedProg !== null &&
                detail.prog < detail.expectedProg - 10;
              const stalled =
                !detail.useOverdueOnly &&
                detail.prog === 0 &&
                detail.health === 'red' &&
                pOverdueTasks.length === 0;
              const tightDeadline =
                !detail.useOverdueOnly &&
                detail.daysLeft !== null &&
                detail.daysLeft <= 7 &&
                detail.prog !== null &&
                detail.prog < 80;

              return (
                <>
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-base">
                      <span className={healthColor}>●</span> {p.name}
                    </DialogTitle>
                    <p className="text-xs text-muted-foreground">{p.client_name || (Array.isArray((p as any).departments) && (p as any).departments.length > 0 ? (p as any).departments.join(', ') : p.department) || ''} · <span className={healthColor}>{healthLabel}</span></p>
                  </DialogHeader>

                  {/* Always show the WHY of the current health status */}
                  <div className={cn(
                    'rounded-lg border px-3 py-2.5 text-sm',
                    detail.health === 'red' && 'border-destructive/30 bg-destructive/5 text-destructive',
                    detail.health === 'yellow' && 'border-warning/30 bg-warning/5 text-warning',
                    detail.health === 'green' && 'border-success/30 bg-success/5 text-success',
                  )}>
                    <div className="flex items-start gap-2">
                      {detail.health === 'green'
                        ? <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
                        : <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />}
                      <div className="flex-1">
                        <p className="font-medium leading-snug">Porquê este estado?</p>
                        <p className="text-xs opacity-90 mt-0.5">{detail.reason}</p>
                      </div>
                    </div>
                    {/* Numeric breakdown */}
                    {!detail.useOverdueOnly && detail.prog !== null && (
                      <div className="mt-2.5 grid grid-cols-2 gap-2 text-[11px] text-foreground/80">
                        <div className="flex items-center gap-1.5">
                          <Activity className="h-3 w-3" />
                          Progresso: <span className="font-semibold">{Math.round(detail.prog)}%</span>
                        </div>
                        {detail.expectedProg !== null && (
                          <div className="flex items-center gap-1.5">
                            <Target className="h-3 w-3" />
                            Esperado: <span className="font-semibold">{Math.round(detail.expectedProg)}%</span>
                          </div>
                        )}
                        {detail.daysLeft !== null && (
                          <div className="flex items-center gap-1.5 col-span-2">
                            <Clock className="h-3 w-3" />
                            {detail.daysLeft >= 0
                              ? `${detail.daysLeft} dia${detail.daysLeft === 1 ? '' : 's'} até ao prazo`
                              : `${Math.abs(detail.daysLeft)} dia${Math.abs(detail.daysLeft) === 1 ? '' : 's'} de atraso no prazo`}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actionable suggestions when the issue is schedule-based */}
                  {(scheduleIssue || stalled || tightDeadline) && (
                    <div className="rounded-lg border bg-muted/40 px-3 py-2.5 text-xs space-y-1.5">
                      <p className="font-semibold text-foreground">O que podes fazer:</p>
                      <ul className="space-y-1 text-muted-foreground list-disc pl-4">
                        {scheduleIssue && (
                          <li>Marcar entregáveis concluídos na tab <span className="font-medium">Operação</span> do projeto.</li>
                        )}
                        {stalled && (
                          <li>O projeto não avançou desde o arranque — confirma a <span className="font-medium">data de início</span> ou começa as primeiras entregas.</li>
                        )}
                        {tightDeadline && (
                          <li>Prazo a aproximar-se com progresso baixo — considera <span className="font-medium">renegociar o deadline</span> ou priorizar as entregas em falta.</li>
                        )}
                      </ul>
                    </div>
                  )}

                  {!hasIssues && detail.health === 'green' && (
                    <div className="py-6 text-center">
                      <CheckCircle2 className="h-8 w-8 text-success mx-auto mb-2" />
                      <p className="text-sm font-medium text-success">Tudo em dia!</p>
                      <p className="text-xs text-muted-foreground mt-1">Este projeto não tem alertas pendentes.</p>
                    </div>
                  )}

                  {pOverdueTasks.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold flex items-center gap-2 mb-2">
                        <Clock className="h-4 w-4 text-destructive" /> Tarefas atrasadas
                        <Badge variant="destructive" className="text-[10px]">{pOverdueTasks.length}</Badge>
                      </h4>
                      <div className="space-y-1 max-h-[200px] overflow-y-auto">
                        {pOverdueTasks.map(t => (
                          <div key={t.id} className="flex items-center gap-2 py-1.5 px-3 rounded-md bg-destructive/5 text-sm">
                            <PriorityDot priority={t.priority} />
                            <span className="flex-1 truncate">{t.name}</span>
                            <span className="text-[10px] text-destructive shrink-0">{format(new Date(t.deadline!), 'dd/MM')}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {pUnassigned.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold flex items-center gap-2 mb-2">
                        <UserX className="h-4 w-4 text-warning" /> Tarefas sem responsável
                        <Badge variant="outline" className="text-[10px]">{pUnassigned.length}</Badge>
                      </h4>
                      <div className="space-y-1 max-h-[200px] overflow-y-auto">
                        {pUnassigned.map(t => (
                          <div key={t.id} className="flex items-center gap-2 py-1.5 px-3 rounded-md bg-muted/50 text-sm">
                            <span className="flex-1 truncate">{t.name}</span>
                            {t.deadline && <span className="text-[10px] text-muted-foreground">{format(new Date(t.deadline), 'dd/MM')}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="pt-2 border-t">
                    <Link to={`/hub/projetos/${p.id}`} className="text-sm text-primary hover:underline font-medium" onClick={() => setHealthDetailProjectId(null)}>
                      Ver projeto →
                    </Link>
                  </div>
                </>
              );
            })()}
          </DialogContent>
        </Dialog>

        {/* ═══════════════ COUNTDOWN + TIMELINE + HEALTH ═══════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

          {/* Countdown — next delivery */}
          {nextDelivery && (
            <Card className="lg:col-span-3 border border-primary/20 bg-primary/5 animate-fade-in overflow-hidden shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Rocket className="h-4 w-4 text-primary" />
                  <p className="text-xs font-semibold text-primary uppercase tracking-wider">Próxima Entrega</p>
                </div>
                <div className="flex items-baseline gap-1 mb-2">
                  {nextDelivery.daysLeft === 0 ? (
                    <span className={`text-3xl sm:text-4xl font-black tabular-nums text-destructive`}>Hoje</span>
                  ) : nextDelivery.daysLeft === 1 ? (
                    <span className={`text-3xl sm:text-4xl font-black tabular-nums text-destructive`}>Amanhã</span>
                  ) : (
                    <>
                      <span className={`text-3xl sm:text-4xl font-black tabular-nums ${nextDelivery.daysLeft <= 3 ? 'text-destructive' : nextDelivery.daysLeft <= 7 ? 'text-warning' : 'text-foreground'}`}>
                        {nextDelivery.daysLeft}
                      </span>
                      <span className="text-sm text-muted-foreground font-medium">dias</span>
                    </>
                  )}
                </div>
                <Link to={`/hub/projetos/${nextDelivery.projectId || nextDelivery.id}`} className="group">
                  <p className="text-sm font-semibold group-hover:text-primary transition-colors leading-snug">{nextDelivery.name}</p>
                  {nextDelivery.projectName && <p className="text-xs text-muted-foreground mt-1">{nextDelivery.projectName}</p>}
                  <p className="text-xs font-medium text-primary mt-1.5">
                    📅 {format(new Date(nextDelivery.deadline), "dd 'de' MMMM yyyy", { locale: pt })}
                  </p>
                </Link>
              </CardContent>
            </Card>
          )}

          {/* Delivery Timeline */}
          <Card className={`${nextDelivery ? 'lg:col-span-9' : 'lg:col-span-12'} animate-fade-in`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <CalendarClock className="h-4 w-4" /> Timeline de Entregas
                <span className="text-xs text-muted-foreground font-normal ml-1">próximos 7 dias</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {deliveryTimeline.length === 0 ? (
                <EmptyHint>Sem entregas nos próximos 7 dias 🎉</EmptyHint>
              ) : (
                <div className="pb-2">
                  {/* Timeline horizontal: eixo de dias + items por dia (ocupa toda a largura do card) */}
                  <div className="relative w-full">
                    {/* Linha do tempo */}
                    <div className="absolute left-0 right-0 top-8 h-px bg-border" />
                    {/* Marcadores de dia */}
                    <div className="grid relative w-full" style={{ gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
                      {deliveryTimeline.map((day, idx) => {
                        const today = isToday(day.date);
                        return (
                          <div key={idx} className="flex flex-col items-center relative px-1.5">
                            {/* Cabeçalho do dia */}
                            <div className={`text-xs font-semibold leading-tight text-center mb-1 ${today ? 'text-primary' : 'text-muted-foreground'}`}>
                              <div className="capitalize">{day.label.split(' ')[0]}</div>
                              <div className="text-[10px] opacity-80 font-normal">{day.label.split(' ').slice(1).join(' ')}</div>
                            </div>
                            {/* Marcador na linha */}
                            <div className={`relative z-10 h-3 w-3 rounded-full border-2 ${
                              today ? 'bg-primary border-primary ring-2 ring-primary/20'
                                : day.items.length > 0 ? 'bg-card border-primary/60'
                                : 'bg-card border-border'
                            }`} />
                            {/* Items empilhados abaixo */}
                            <div className="mt-2 w-full flex flex-col gap-2">
                              {day.items.map((item, i) => (
                                (() => {
                                  const assignee = item.assigneeId ? profileMap.get(item.assigneeId) : null;
                                  const href = item.type === 'meeting'
                                    ? `/hub/reunioes/${item.id}`
                                    : item.type === 'project' && item.projectId ? `/hub/projetos/${item.projectId}` : null;
                                  const className = `text-[11px] leading-snug px-2 py-1.5 rounded-md flex items-start gap-2 ${
                                    item.type === 'meeting' ? 'bg-info/15 text-info dark:text-info font-medium ring-1 ring-info/30' :
                                    item.type === 'project' ? 'bg-primary/15 text-primary font-medium ring-1 ring-primary/30' :
                                    'bg-accent/20 text-accent-foreground'
                                  } ${href || item.type === 'task' ? 'hover:opacity-80 cursor-pointer transition-opacity' : ''}`;
                                  const inner = (
                                    <>
                                      {item.type === 'meeting' && <span className="shrink-0 leading-none">📅</span>}
                                      <span className="flex-1 min-w-0 break-words text-left line-clamp-2">{item.name}</span>
                                      {assignee && (
                                        <Avatar className="h-4 w-4 shrink-0 mt-0.5">
                                          <AvatarImage src={getPhotoUrl(assignee)} />
                                          <AvatarFallback className="text-[8px]">{getInitials(assignee.full_name)}</AvatarFallback>
                                        </Avatar>
                                      )}
                                    </>
                                  );
                                  if (href) {
                                    return (
                                      <Link key={i} to={href} className={className} title={item.name + (assignee?.full_name ? ` — ${assignee.full_name}` : '')}>
                                        {inner}
                                      </Link>
                                    );
                                  }
                                  if (item.type === 'task') {
                                    return (
                                      <button
                                        key={i}
                                        type="button"
                                        onClick={() => setTaskDetailId(item.id)}
                                        className={className + ' w-full text-left'}
                                        title={item.name + (assignee?.full_name ? ` — ${assignee.full_name}` : '')}
                                      >
                                        {inner}
                                      </button>
                                    );
                                  }
                                  return (
                                    <div key={i} className={className} title={item.name + (assignee?.full_name ? ` — ${assignee.full_name}` : '')}>
                                      {inner}
                                    </div>
                                  );
                                })()
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ═══════════════ SAÚDE DOS PROJETOS ═══════════════ */}
        <Card className="animate-fade-in">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Target className="h-4 w-4" /> Saúde dos Projetos
              <div className="flex items-center gap-3 ml-auto text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1"><CircleDot className="h-3 w-3 text-success" /> Em dia</span>
                <span className="flex items-center gap-1"><CircleDot className="h-3 w-3 text-warning" /> Atenção</span>
                <span className="flex items-center gap-1"><CircleDot className="h-3 w-3 text-destructive" /> Em risco</span>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {projectHealth.map(p => {
                const healthColor = {
                  green: { bg: 'bg-success/10', ring: 'ring-success/30', text: 'text-success dark:text-success', dot: 'bg-success' },
                  yellow: { bg: 'bg-warning/10', ring: 'ring-warning/30', text: 'text-warning dark:text-warning', dot: 'bg-warning' },
                  red: { bg: 'bg-destructive/10', ring: 'ring-destructive/30', text: 'text-destructive dark:text-destructive', dot: 'bg-destructive animate-pulse' },
                }[p.health];
                return (
                  <div
                    key={p.id}
                    onClick={() => setHealthDetailProjectId(p.id)}
                    className={`group rounded-xl p-4 ring-1 cursor-pointer ${healthColor.ring} ${healthColor.bg} hover:shadow-md transition-all hover-scale`}
                  >
                    <div className="flex items-start gap-2 mb-2">
                      <span className={`h-2 w-2 rounded-full mt-1 shrink-0 ${healthColor.dot}`} />
                      <p className="text-xs font-semibold group-hover:text-primary transition-colors leading-tight">{p.name}</p>
                    </div>
                    {p.client_name && <p className="text-[10px] text-muted-foreground truncate mb-2 pl-4">{p.client_name}</p>}
                    {!p.isTarefasLivres && (
                      <div className="flex items-center gap-2 pl-4">
                        <Progress value={p.prog} className="h-1.5 flex-1" />
                        <span className={`text-[10px] font-bold ${healthColor.text}`}>{p.prog}%</span>
                      </div>
                    )}
                    {p.isTarefasLivres && (
                      <p className="text-[10px] text-muted-foreground pl-4">Tarefas livres</p>
                    )}
                    {p.deadline && (
                      <p className="text-[10px] text-muted-foreground mt-1.5 pl-4">
                        {format(new Date(p.deadline), 'dd MMM', { locale: pt })}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>


        {/* Navegação por secção (estilo Comercial) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3" id="operacao-secoes">
          {[
            { value: 'clientes', label: 'Clientes', icon: Briefcase, iconColor: 'text-info', color: 'from-info/10 to-info/5 hover:from-info/20 hover:to-info/10', activeRing: 'ring-info' },
            { value: 'interno', label: 'Interno', icon: Building2, iconColor: 'text-accent-violet', color: 'from-accent-violet/10 to-accent-violet/5 hover:from-accent-violet/20 hover:to-accent-violet/10', activeRing: 'ring-accent-violet' },
            { value: 'analise', label: 'Análise', icon: Activity, iconColor: 'text-warning', color: 'from-warning/10 to-warning/5 hover:from-warning/20 hover:to-warning/10', activeRing: 'ring-warning' },
          ].map(s => {
            const isActive = activeTab === s.value;
            return (
              <Card
                key={s.value}
                className={cn(
                  'group cursor-pointer border bg-gradient-to-br transition-all duration-200 hover:shadow-md hover:-translate-y-0.5',
                  s.color,
                  isActive && `ring-2 ring-offset-1 ${s.activeRing}`,
                )}
                onClick={() => {
                  const next = new URLSearchParams(searchParams);
                  if (s.value === 'clientes') next.delete('tab');
                  else next.set('tab', s.value);
                  setSearchParams(next, { replace: true });
                  // Scroll suave até ao conteúdo da secção
                  setTimeout(() => {
                    document.getElementById('operacao-tab-content')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }, 50);
                }}
              >
                <CardContent className="p-4 flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-lg bg-background/80 flex items-center justify-center shadow-sm shrink-0 ${s.iconColor}`}>
                    <s.icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm">{s.label}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {s.value === 'clientes' && 'Clientes, projetos e entregas'}
                      {s.value === 'interno' && 'Trabalho interno e tarefas da equipa'}
                      {s.value === 'analise' && 'Saúde de horas e desvios'}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div id="operacao-tab-content" className="scroll-mt-4" />
        <Tabs
          value={activeTab}
          onValueChange={(v) => {
            const next = new URLSearchParams(searchParams);
            if (v === 'clientes') next.delete('tab');
            else next.set('tab', v);
            setSearchParams(next, { replace: true });
          }}
          className="space-y-4"
        >

          {/* ─── TAB CLIENTES ─── */}
          <TabsContent value="clientes" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Col 1: Status resumo */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Estado dos Clientes</CardTitle>
                </CardHeader>
                <CardContent className="pt-0 space-y-2">
                  {[
                    { value: 'em_onboarding', label: 'Em onboarding', className: 'bg-info/15 text-info' },
                    { value: 'ativo', label: 'Ativos', className: 'bg-success/15 text-success' },
                    { value: 'pausado', label: 'Pausados', className: 'bg-warning/15 text-warning' },
                    { value: 'altura_renovacao', label: 'Renovação', className: 'bg-accent-violet/15 text-accent-violet' },
                    { value: 'em_offboarding', label: 'Em offboarding', className: 'bg-warning/15 text-warning' },
                  ].map(s => {
                    const count = clients.filter(c => c.status === s.value).length;
                    return (
                      <button key={s.value} onClick={() => setExpandedStatus(s.value)} className="flex items-center justify-between w-full py-1.5 px-2 rounded-md hover:bg-muted/50 transition-colors">
                        <Badge variant="outline" className={`${s.className} border-0 text-xs`}>{s.label}</Badge>
                        <span className="text-sm font-semibold">{count}</span>
                      </button>
                    );
                  })}
                </CardContent>
              </Card>

              {/* Col 2: Projetos por modo */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <FolderOpen className="h-4 w-4" /> Projetos Ativos
                    <Badge variant="outline" className="text-[10px] ml-auto">{activeClientProjects.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 space-y-3 max-h-[400px] overflow-y-auto">
                  {activeClientProjects.length === 0 ? (
                    <EmptyHint>Nenhum projeto ativo</EmptyHint>
                  ) : (
                    <>
                      {activeClientPontuais.length > 0 && (
                        <div>
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">📌 Pontuais ({activeClientPontuais.length})</p>
                          <div className="space-y-0.5">
                            {activeClientPontuais.map(p => {
                              const prog = projectProgress.get(p.id) ?? p.progress;
                              const members = projectMembersMap.get(p.id) || [];
                              return (
                                <Link key={p.id} to={`/hub/projetos/${p.id}`} className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-muted/50 transition-colors group">
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">{p.name}</p>
                                    {p.client_name && <p className="text-[11px] text-muted-foreground truncate">{p.client_name}</p>}
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <div className="w-16 flex items-center gap-1">
                                      <Progress value={prog} className="h-1.5 flex-1" />
                                      <span className="text-[10px] text-muted-foreground w-6 text-right">{prog}%</span>
                                    </div>
                                    <div className="flex -space-x-1">
                                      {members.slice(0, 2).map(m => (
                                        <Avatar key={m.id} className="h-5 w-5 border-2 border-background">
                                          <AvatarImage src={getPhotoUrl(m)} />
                                          <AvatarFallback className="text-[7px]">{getInitials(m.full_name)}</AvatarFallback>
                                        </Avatar>
                                      ))}
                                    </div>
                                  </div>
                                </Link>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      {activeClientRecorrentes.length > 0 && (
                        <div>
                          {activeClientPontuais.length > 0 && <Separator className="my-2" />}
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">🔄 Recorrentes ({activeClientRecorrentes.length})</p>
                          <div className="space-y-0.5">
                            {activeClientRecorrentes.map(p => {
                              const prog = projectProgress.get(p.id) ?? p.progress;
                              const members = projectMembersMap.get(p.id) || [];
                              return (
                                <Link key={p.id} to={`/hub/projetos/${p.id}`} className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-muted/50 transition-colors group">
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">{p.name}</p>
                                    {p.client_name && <p className="text-[11px] text-muted-foreground truncate">{p.client_name}</p>}
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <div className="w-16 flex items-center gap-1">
                                      <Progress value={prog} className="h-1.5 flex-1" />
                                      <span className="text-[10px] text-muted-foreground w-6 text-right">{prog}%</span>
                                    </div>
                                    <div className="flex -space-x-1">
                                      {members.slice(0, 2).map(m => (
                                        <Avatar key={m.id} className="h-5 w-5 border-2 border-background">
                                          <AvatarImage src={getPhotoUrl(m)} />
                                          <AvatarFallback className="text-[7px]">{getInitials(m.full_name)}</AvatarFallback>
                                        </Avatar>
                                      ))}
                                    </div>
                                  </div>
                                </Link>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Tarefas — full width below */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <ListTodo className="h-4 w-4" /> Tarefas de Clientes
                    <Badge variant="outline" className="text-[10px]">{clientTasks.length}</Badge>
                  </CardTitle>
                  <TaskDynamicFilters filters={clientFilters} onChange={setClientFilters} profiles={profiles} projects={clientProjectOptions} />
                </div>
              </CardHeader>
              <CardContent className="pt-0 max-h-[400px] overflow-y-auto">
                {filteredClientTasks.length === 0 ? (
                  <EmptyHint>Nenhuma tarefa neste filtro</EmptyHint>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[160px]">Status</TableHead>
                        <TableHead className="w-[280px]">Nome da tarefa</TableHead>
                        <TableHead className="w-[160px]">Responsável</TableHead>
                        <TableHead>Projeto</TableHead>
                        <TableHead className="w-[80px]">Data</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredClientTasks.map(t => {
                        const assignee = t.assigned_to ? profileMap.get(t.assigned_to) : null;
                        const projName = t.project_id ? projectNameMap.get(t.project_id) : null;
                        const statusMeta = TASK_STATUS_META[t.status as keyof typeof TASK_STATUS_META] ?? { label: t.status, color: 'bg-muted text-muted-foreground' };
                        return (
                          <TableRow
 key={t.id}
 onClick={() => setTaskDetailId(t.id)}
                            className="cursor-pointer"
                          >
                            <TableCell>
                              <Badge variant="outline" className={cn('text-[10px] font-normal', statusMeta.color)}>
                                {statusMeta.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-medium max-w-[280px]">
                              <div className="flex items-center gap-2 min-w-0">
                                <PriorityDot priority={t.priority} />
                                <span className="truncate">{t.name}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              {assignee ? (
                                <div className="flex items-center gap-2 min-w-0">
                                  <Avatar className="h-5 w-5 shrink-0">
                                    <AvatarImage src={getPhotoUrl(assignee)} />
                                    <AvatarFallback className="text-[8px]">{getInitials(assignee.full_name)}</AvatarFallback>
                                  </Avatar>
                                  <span className="truncate text-xs">{assignee.full_name}</span>
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              <span className="block truncate">{projName ?? '—'}</span>
                            </TableCell>
                            <TableCell className="text-muted-foreground whitespace-nowrap">
                              {t.deadline ? format(new Date(t.deadline), 'dd/MM') : '—'}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* À espera do cliente */}
            {awaitingClient.length > 0 && (
              <Card className="border border-info/30 bg-info/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Hourglass className="h-4 w-4 text-info" />
                    <span className="text-info">À espera do cliente</span>
                    <Badge variant="outline" className="bg-info/15 text-info border-info/30 text-[10px]">
                      {awaitingClient.length}
                    </Badge>
                  </CardTitle>
                  <p className="text-[11px] text-muted-foreground">
                    Entregas do cliente em aberto e tarefas a aguardar feedback.
                  </p>
                </CardHeader>
                <CardContent className="pt-0 space-y-1 max-h-[400px] overflow-y-auto">
                  {awaitingClient.map(item => {
                    const inner = (
                      <>
                        <span className="shrink-0">
                          {item.kind === 'task' ? (
                            <Clock className="h-3.5 w-3.5 text-info" />
                          ) : (
                            <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                          )}
                        </span>
                        <span className="flex-1 truncate">
                          <span className="font-medium">{item.name}</span>
                          {item.projectName && (
                            <span className="text-muted-foreground"> · {item.projectName}</span>
                          )}
                        </span>
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-[10px] shrink-0',
                            !item.overdue
                              ? 'border-muted text-muted-foreground'
                              : item.daysWaiting > 7
                              ? 'border-destructive/40 text-destructive'
                              : 'border-warning/40 text-warning'
                          )}
                        >
                          {item.overdue ? `${item.daysWaiting}d atraso` : 'no prazo'}
                        </Badge>
                      </>
                    );
                    const cls =
                      'flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-muted/40 transition-colors text-sm w-full text-left';
                    if (item.kind === 'task') {
                      return (
                        <button key={item.id} type="button" onClick={() => setTaskDetailId(item.id)} className={cls}>
                          {inner}
                        </button>
                      );
                    }
                    return (
                      <Link
                        key={item.id}
                        to={item.projectId ? `/hub/projetos/${item.projectId}` : '/hub/operacao'}
                        className={cls}
                      >
                        {inner}
                      </Link>
                    );
                  })}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ─── TAB INTERNO ─── */}
          <TabsContent value="interno" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Col 1: Gráfico por departamento */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <FolderOpen className="h-4 w-4" /> Por Departamento
                    <Badge variant="outline" className="text-[10px] ml-auto">{activeInternoProjects.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  {activeInternoProjects.length === 0 ? (
                    <EmptyHint>Nenhum projeto interno ativo</EmptyHint>
                  ) : (
                    <div className="h-[250px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={internoByDept} margin={{ top: 8, right: 8, bottom: 4, left: -16 }}>
                          <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-25} textAnchor="end" height={50} />
                          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                          <Tooltip formatter={(value: number) => [`${value} projeto${value !== 1 ? 's' : ''}`, 'Ativos']} />
                          <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={40}>
                            {internoByDept.map((entry, i) => (
                              <Cell key={i} fill={entry.color} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Col 2: Equipa */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Users className="h-4 w-4" /> Equipa
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 space-y-0.5 max-h-[320px] overflow-y-auto">
                  {internoMembers.length === 0 ? (
                    <EmptyHint>Sem membros associados</EmptyHint>
                  ) : internoMembers.map(m => (
                    <div key={m.profile!.id} className="flex items-center gap-2 py-2 px-2 rounded-lg hover:bg-muted/40">
                      <Avatar className="h-7 w-7">
                        <AvatarImage src={getPhotoUrl(m.profile!)} />
                        <AvatarFallback className="text-[10px]">{getInitials(m.profile!.full_name)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{m.profile!.full_name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{m.projectNames.join(', ')}</p>
                      </div>
                      <Badge variant="outline" className="text-[10px] shrink-0">{m.openTasks} tarefas</Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            {/* Tarefas internas — full width below */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <ListTodo className="h-4 w-4" /> Tarefas Internas
                    <Badge variant="outline" className="text-[10px]">{internoTasks.length}</Badge>
                  </CardTitle>
                  <TaskDynamicFilters filters={internoFilters} onChange={setInternoFilters} profiles={profiles} projects={internoProjectOptions} />
                </div>
              </CardHeader>
              <CardContent className="pt-0 space-y-0.5 max-h-[400px] overflow-y-auto">
                {filteredInternoTasks.length === 0 ? (
                  <EmptyHint>Nenhuma tarefa neste filtro</EmptyHint>
                ) : filteredInternoTasks.map(t => renderTaskRow(t))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── TAB ANÁLISE ─── */}
          <TabsContent value="analise" className="space-y-4">
            <OperacaoAnaliseTab />
          </TabsContent>
        </Tabs>

        {/* Client status dialog */}
        <Dialog open={!!expandedStatus} onOpenChange={(open) => !open && setExpandedStatus(null)}>
          <DialogContent className={expandedStatus === 'altura_renovacao' ? 'max-w-2xl' : (expandedStatus === 'em_onboarding' || expandedStatus === 'em_offboarding') ? 'max-w-2xl' : 'max-w-md'}>
            <DialogHeader>
              <DialogTitle className="text-base">
                {expandedStatus && {
                  em_onboarding: 'Em onboarding',
                  ativo: 'Ativos',
                  pausado: 'Pausados',
                  altura_renovacao: 'Altura de renovação',
                  em_offboarding: 'Em offboarding',
                }[expandedStatus]}
              </DialogTitle>
            </DialogHeader>
            <div className="max-h-[400px] overflow-y-auto">
              {clients.filter(c => c.status === expandedStatus).length === 0 ? (
                <EmptyHint>Nenhum cliente neste status</EmptyHint>
              ) : expandedStatus === 'altura_renovacao' ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="">Nome</TableHead>
                      <TableHead className="">Data de Início</TableHead>
                      <TableHead className="">Fim de Ciclo</TableHead>
                      <TableHead className="">Produto Atual</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clients.filter(c => c.status === expandedStatus).map(c => (
                      <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={() => { setExpandedStatus(null); window.location.href = `/hub/clientes/${c.id}`; }}>
                        <TableCell className="text-sm font-medium">{c.full_name}</TableCell>
                        <TableCell className="text-muted-foreground">{c.start_date ? format(new Date(c.start_date), 'dd/MM/yyyy') : '—'}</TableCell>
                        <TableCell className="text-muted-foreground">{c.end_of_cycle ? format(new Date(c.end_of_cycle), 'dd/MM/yyyy') : '—'}</TableCell>
                        <TableCell className="">{c.current_product || '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="">ID</TableHead>
                      <TableHead className="">Nome</TableHead>
                      <TableHead className="">Data de Início</TableHead>
                      {(expandedStatus === 'em_onboarding' || expandedStatus === 'em_offboarding') && <TableHead className="">Por concluir</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clients.filter(c => c.status === expandedStatus).map(c => {
                      // Find pending deliverables from onboarding phases for this client
                      const onboardingPhaseIds = new Set(
                        onboardingPhases
                          .filter(ph => projects.find(p => p.id === ph.project_id && (p as any).client_id === c.id))
                          .map(ph => ph.id)
                      );
                      const allItems = (expandedStatus === 'em_onboarding' || expandedStatus === 'em_offboarding')
                        ? allOnboardingDeliverables.filter(d => onboardingPhaseIds.has(d.phase_id))
                        : [];
                      const pendingItems = allItems.filter(d => d.status !== 'concluido');
                      const allDone = allItems.length > 0 && pendingItems.length === 0;
                      return (
                        <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50 align-top" onClick={() => { setExpandedStatus(null); window.location.href = `/hub/clientes/${c.id}`; }}>
                          <TableCell className="font-mono">{c.client_id}</TableCell>
                          <TableCell className="text-sm font-medium">{c.full_name}</TableCell>
                          <TableCell className="text-muted-foreground">{c.start_date ? format(new Date(c.start_date), 'dd/MM/yyyy') : '—'}</TableCell>
                          {(expandedStatus === 'em_onboarding' || expandedStatus === 'em_offboarding') && (
                            <TableCell>
                              {allDone ? (
                                <span className="text-xs text-success flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Concluído</span>
                              ) : pendingItems.length === 0 ? (
                                <span className="text-xs text-muted-foreground">Sem checklist</span>
                              ) : (
                                <ul className="space-y-0.5">
                                  {pendingItems.map((item) => {
                                    const phaseName = onboardingPhases.find(ph => ph.id === item.phase_id)?.name;
                                    return (
                                      <li key={item.id} className="text-xs text-destructive flex items-center gap-1">
                                        <span className="h-1.5 w-1.5 rounded-full bg-destructive shrink-0" />
                                        {phaseName ? `${phaseName}: ` : ''}{item.name}
                                      </li>
                                    );
                                  })}
                                </ul>
                              )}
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
