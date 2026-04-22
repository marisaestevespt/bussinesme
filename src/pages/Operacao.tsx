import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
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
import { Users, FolderOpen, CheckCircle2, Clock, AlertTriangle, Briefcase, Building2, ListTodo, Filter, X, TrendingUp, UserX, CalendarClock, Rocket, Target, CircleDot } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format, isToday, isBefore, startOfToday, isAfter, endOfWeek, startOfWeek, subDays, differenceInDays } from 'date-fns';
import { pt } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { OperacaoKpis } from '@/components/operacao/OperacaoKpis';
import { isTaskDone, isTaskOpen, isTaskOverdue } from '@/lib/taskStatus';
import { isUpcomingRenewal, daysUntilRenewal } from '@/lib/clientLifecycle';

// ─── Types ──────────────────────────────────────────────────────

type Project = {
  id: string; name: string; type: string; status: string; department: string | null;
  client_name: string | null; deadline: string | null; progress: number;
  start_date: string | null; created_at: string; cover_url: string | null;
};
type Task = {
  id: string; name: string; status: string; priority: string; deadline: string | null;
  assigned_to: string | null; project_id: string | null; department: string | null;
};
type Client = {
  id: string; client_id: string; full_name: string; status: string; current_product: string | null;
  start_date: string | null; end_of_cycle: string | null;
};
type Profile = {
  id: string; full_name: string | null; avatar_url: string | null;
};
type ProjectMember = {
  project_id: string; profile_id: string;
};

const ACTIVE_STATUSES = ['em_curso', 'em_ideia', 'em_pausa', 'em_revisao'];
type TaskFilter = 'todas' | 'hoje' | 'semana' | 'atrasadas';

const DEPT_LABELS: Record<string, string> = {
  administrativo: 'Administrativo',
  marketing: 'Marketing',
  financeiro: 'Financeiro',
  comercial: 'Comercial',
  clientes: 'Clientes',
  equipa: 'Equipa',
  operacao: 'Operação',
};
const DEPT_COLORS: Record<string, string> = {
  administrativo: 'hsl(33, 30%, 55%)',
  marketing: 'hsl(330, 60%, 55%)',
  financeiro: 'hsl(45, 80%, 50%)',
  comercial: 'hsl(190, 70%, 45%)',
  clientes: 'hsl(265, 55%, 55%)',
  equipa: 'hsl(165, 55%, 45%)',
  operacao: 'hsl(25, 75%, 55%)',
};

function getInitials(name: string | null) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

type TaskFilters = {
  time: TaskFilter;
  department: string;
  responsible: string;
  priority: string;
  project: string;
};

const EMPTY_FILTERS: TaskFilters = { time: 'todas', department: '', responsible: '', priority: '', project: '' };

const PRIORITY_OPTIONS = [
  { value: 'baixa', label: 'Baixa' },
  { value: 'media', label: 'Média' },
  { value: 'alta', label: 'Alta' },
  { value: 'urgente', label: 'Urgente' },
];

function TaskDynamicFilters({ filters, onChange, profiles, projects }: {
  filters: TaskFilters;
  onChange: (f: TaskFilters) => void;
  profiles: Profile[];
  projects: { id: string; name: string }[];
}) {
  const activeCount = [filters.department, filters.responsible, filters.priority, filters.project].filter(Boolean).length
    + (filters.time !== 'todas' ? 1 : 0);

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {(['todas', 'hoje', 'semana', 'atrasadas'] as TaskFilter[]).map(k => (
        <Button key={k} size="sm" variant={filters.time === k ? 'default' : 'outline'} className="h-7 text-xs"
          onClick={() => onChange({ ...filters, time: k })}>
          {{ todas: 'Todas', hoje: 'Hoje', semana: 'Semana', atrasadas: 'Atrasadas' }[k]}
        </Button>
      ))}

      <Popover>
        <PopoverTrigger asChild>
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
            <Filter className="h-3 w-3" /> Filtros
            {activeCount > 0 && <Badge variant="secondary" className="h-4 w-4 p-0 flex items-center justify-center text-[9px] rounded-full">{activeCount}</Badge>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 space-y-3" align="end">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Departamento</label>
            <Select value={filters.department} onValueChange={v => onChange({ ...filters, department: v === '_all' ? '' : v })}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">Todos</SelectItem>
                {Object.entries(DEPT_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Responsável</label>
            <Select value={filters.responsible} onValueChange={v => onChange({ ...filters, responsible: v === '_all' ? '' : v })}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">Todos</SelectItem>
                {profiles.filter(p => p.full_name).map(p => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Prioridade</label>
            <Select value={filters.priority} onValueChange={v => onChange({ ...filters, priority: v === '_all' ? '' : v })}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Todas" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">Todas</SelectItem>
                {PRIORITY_OPTIONS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Projeto</label>
            <Select value={filters.project} onValueChange={v => onChange({ ...filters, project: v === '_all' ? '' : v })}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">Todos</SelectItem>
                {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {activeCount > 0 && (
            <Button size="sm" variant="ghost" className="w-full h-7 text-xs" onClick={() => onChange(EMPTY_FILTERS)}>
              <X className="h-3 w-3 mr-1" /> Limpar filtros
            </Button>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}

function TaskBadge({ deadline, status }: { deadline: string | null; status: string }) {
  if (isTaskDone({ status })) return null;
  if (!deadline) return null;
  const d = new Date(deadline);
  const today = startOfToday();
  if (isBefore(d, today)) return <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Atrasada</Badge>;
  if (isToday(d)) return <Badge className="bg-warning/15 text-warning border-warning/30 text-[10px] px-1.5 py-0">Hoje</Badge>;
  return null;
}

function PriorityDot({ priority }: { priority: string }) {
  const colors: Record<string, string> = { alta: 'bg-red-500', media: 'bg-yellow-500', baixa: 'bg-green-500' };
  return <span className={`inline-block h-2 w-2 rounded-full ${colors[priority] || 'bg-muted'}`} />;
}

function applyTaskFilters(tasks: Task[], filters: TaskFilters): Task[] {
  let result = tasks;
  const today = startOfToday();
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
  switch (filters.time) {
    case 'hoje': result = result.filter(t => t.deadline && isToday(new Date(t.deadline))); break;
    case 'semana': result = result.filter(t => t.deadline && !isBefore(new Date(t.deadline), today) && !isAfter(new Date(t.deadline), weekEnd)); break;
    case 'atrasadas': result = result.filter(t => isTaskOverdue(t as any, today)); break;
  }
  if (filters.department) result = result.filter(t => t.department === filters.department);
  if (filters.responsible) result = result.filter(t => t.assigned_to === filters.responsible);
  if (filters.priority) result = result.filter(t => t.priority === filters.priority);
  if (filters.project) result = result.filter(t => t.project_id === filters.project);
  return result;
}

// ─── Main ───────────────────────────────────────────────────────

export default function OperacaoPage() {
  const [clientFilters, setClientFilters] = useState<TaskFilters>(EMPTY_FILTERS);
  const { getPhotoUrl } = useTeamPhotos();
  const [internoFilters, setInternoFilters] = useState<TaskFilters>(EMPTY_FILTERS);
  const [expandedStatus, setExpandedStatus] = useState<string | null>(null);
  const [healthDetailProjectId, setHealthDetailProjectId] = useState<string | null>(null);

  // ── Queries ─────────────────────────────────────────────────
  const { data: projects = [] } = useQuery({
    queryKey: ['op-projects'],
    queryFn: async () => {
      const { data } = await supabase.from('projects').select('id,name,type,status,department,client_name,deadline,progress,start_date,created_at,cover_url,project_mode,task_mode,client_id').order('deadline', { ascending: true });
      return (data || []) as (Project & { project_mode: string | null; task_mode: string | null })[];
    },
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['op-tasks'],
    queryFn: async () => {
      const { data } = await supabase.from('tasks').select('id,name,status,priority,deadline,assigned_to,project_id,department').order('deadline', { ascending: true });
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
      const { data } = await supabase.from('project_deliverables').select('id,name,deadline,status,project_id,assigned_to').neq('status', 'entregue').order('deadline', { ascending: true });
      return (data || []) as { id: string; name: string; deadline: string | null; status: string; project_id: string; assigned_to: string | null }[];
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

  const projectProgress = useMemo(() => {
    const map = new Map<string, number>();
    const totals = new Map<string, number>();
    const dones = new Map<string, number>();
    tasks.forEach(t => {
      if (!t.project_id) return;
      totals.set(t.project_id, (totals.get(t.project_id) || 0) + 1);
      if (isTaskDone(t)) dones.set(t.project_id, (dones.get(t.project_id) || 0) + 1);
    });
    totals.forEach((total, pid) => {
      map.set(pid, total > 0 ? Math.round(((dones.get(pid) || 0) / total) * 100) : 0);
    });
    return map;
  }, [tasks]);

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
  const today = startOfToday();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekEnd2 = endOfWeek(today, { weekStartsOn: 1 });

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
    return clients.filter(c => isUpcomingRenewal(c, 30, today));
  }, [clients, today]);

  const overdueDeliverables = useMemo(() =>
    deliverables.filter(d => d.deadline && isBefore(new Date(d.deadline), today) && d.status !== 'entregue'),
    [deliverables, today]
  );

  // ── Countdown — next delivery (deliverables first, then project deadlines) ──
  const nextDelivery = useMemo(() => {
    type NextItem = { id: string; name: string; daysLeft: number; deadline: string; projectName?: string; type: 'deliverable' | 'project'; projectId?: string };
    const candidates: NextItem[] = [];

    // Deliverables
    deliverables.forEach(d => {
      if (d.deadline && !isBefore(new Date(d.deadline), today)) {
        const proj = allActiveProjects.find(p => p.id === d.project_id);
        candidates.push({
          id: d.id, name: d.name, deadline: d.deadline,
          daysLeft: differenceInDays(new Date(d.deadline), today),
          projectName: proj?.name || '', type: 'deliverable', projectId: d.project_id,
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

    candidates.sort((a, b) => a.daysLeft - b.daysLeft);
    return candidates[0] || null;
  }, [allActiveProjects, deliverables, today]);

  // ── Project health indicators ──────────────────────────────
  const projectHealth = useMemo(() => {
    return allActiveProjects.map(p => {
      const isTarefasLivres = (p as any).task_mode === 'tarefas_livres';
      const prog = isTarefasLivres ? null : (projectProgress.get(p.id) ?? p.progress);
      let health: 'green' | 'yellow' | 'red' = 'green';

      if (isTarefasLivres) {
        // Only red if project has overdue tasks
        const hasOverdue = tasks.some(t =>
          t.project_id === p.id && isTaskOverdue(t, today)
        );
        if (hasOverdue) health = 'red';
      } else if (prog !== null) {
        if (p.deadline) {
          const daysLeft = differenceInDays(new Date(p.deadline), today);
          const expectedProg = p.deadline ? Math.max(0, Math.min(100, ((differenceInDays(today, new Date(p.start_date || p.created_at))) / Math.max(1, differenceInDays(new Date(p.deadline), new Date(p.start_date || p.created_at)))) * 100)) : 0;
          if (prog < expectedProg - 25 || (daysLeft <= 3 && prog < 80)) health = 'red';
          else if (prog < expectedProg - 10 || (daysLeft <= 7 && prog < 60)) health = 'yellow';
        }
        if (prog === 0 && differenceInDays(today, new Date(p.start_date || p.created_at)) > 7) health = 'red';
      }
      return { ...p, prog: prog ?? -1, health, isTarefasLivres };
    }).sort((a, b) => {
      const order = { red: 0, yellow: 1, green: 2 };
      return order[a.health] - order[b.health];
    });
  }, [allActiveProjects, projectProgress, tasks, today]);

  // ── Delivery timeline (next 14 days) — includes deliverables ──
  const deliveryTimeline = useMemo(() => {
    const days: { date: Date; label: string; items: { name: string; type: 'project' | 'task' | 'deliverable'; id: string }[] }[] = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      const dateStr = format(d, 'yyyy-MM-dd');
      const items: { name: string; type: 'project' | 'task' | 'deliverable'; id: string }[] = [];

      // Deliverables
      deliverables.forEach(del => {
        if (del.deadline && format(new Date(del.deadline), 'yyyy-MM-dd') === dateStr) {
          items.push({ name: del.name, type: 'deliverable', id: del.id });
        }
      });

      // Projects
      allActiveProjects.forEach(p => {
        if (p.deadline && format(new Date(p.deadline), 'yyyy-MM-dd') === dateStr) {
          items.push({ name: p.name, type: 'project', id: p.id });
        }
      });

      // Tasks
      tasks.filter(isTaskOpen).forEach(t => {
        if (t.deadline && format(new Date(t.deadline), 'yyyy-MM-dd') === dateStr) {
          items.push({ name: t.name, type: 'task', id: t.id });
        }
      });
      if (items.length > 0) {
        days.push({ date: d, label: isToday(d) ? 'Hoje' : format(d, 'EEE dd', { locale: pt }), items });
      }
    }
    return days;
  }, [allActiveProjects, deliverables, tasks, today]);

  function renderTaskRow(t: Task) {
    const assignee = t.assigned_to ? profileMap.get(t.assigned_to) : null;
    const projName = t.project_id ? projectNameMap.get(t.project_id) : null;
    return (
      <div key={t.id} className="flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-muted/40 transition-colors text-sm">
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
      </div>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader title="Operação" subtitle="Vista operacional de projetos de clientes e internos" department="operacao" />

        <OperacaoKpis
          allActiveCount={allActiveProjects.length}
          pontuaisCount={activeClientPontuais.length + activeInternoPontuais.length}
          recorrentesCount={activeClientRecorrentes.length + activeInternoRecorrentes.length}
          overdueTasks={overdueTasks.length}
          weeklyCompletion={weeklyCompletion}
          allocatedMembers={allocatedMembers}
        />

        {/* Clients near end of cycle — kept as small alert */}
        {clientsNearEndOfCycle.length > 0 && (
          <Card className="border border-warning/30 dark:border-amber-700 bg-warning/15/50 dark:bg-amber-950/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <CalendarClock className="h-4 w-4 text-warning" />
                <h3 className="text-sm font-semibold text-warning dark:text-amber-400">Clientes perto do fim de ciclo</h3>
                <Badge variant="outline" className="bg-warning/15 text-warning border-warning/30 text-[10px]">{clientsNearEndOfCycle.length}</Badge>
              </div>
              <div className="flex flex-wrap gap-3">
                {clientsNearEndOfCycle.map(c => {
                  const daysLeft = daysUntilRenewal(c, today) ?? 0;
                  return (
                    <Link key={c.id} to={`/clientes/${c.id}`} className="flex items-center gap-2 text-sm hover:underline">
                      <span className="font-medium text-warning dark:text-amber-300">{c.full_name}</span>
                      <Badge variant={daysLeft <= 7 ? 'destructive' : 'outline'} className="text-[10px]">{daysLeft}d</Badge>
                    </Link>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Health detail dialog */}
        <Dialog open={!!healthDetailProjectId} onOpenChange={open => !open && setHealthDetailProjectId(null)}>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            {(() => {
              const p = allActiveProjects.find(proj => proj.id === healthDetailProjectId);
              if (!p) return null;
              const pTasks = tasks.filter(t => t.project_id === p.id && isTaskOpen(t));
              const pOverdueTasks = pTasks.filter(t => isTaskOverdue(t, today));
              const pOverdueDeliverables = deliverables.filter(d => d.project_id === p.id && d.deadline && isBefore(new Date(d.deadline), today) && d.status !== 'entregue');
              const pUnassigned = pTasks.filter(t => !t.assigned_to);
              const hp = projectHealth.find(h => h.id === p.id);
              const healthLabel = hp?.health === 'red' ? 'Em risco' : hp?.health === 'yellow' ? 'Atenção' : 'Em dia';
              const healthColor = hp?.health === 'red' ? 'text-destructive' : hp?.health === 'yellow' ? 'text-warning' : 'text-success';
              const hasIssues = pOverdueTasks.length > 0 || pOverdueDeliverables.length > 0 || pUnassigned.length > 0;

              return (
                <>
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-base">
                      <span className={healthColor}>●</span> {p.name}
                    </DialogTitle>
                    <p className="text-xs text-muted-foreground">{p.client_name || p.department || ''} · <span className={healthColor}>{healthLabel}</span></p>
                  </DialogHeader>

                  {!hasIssues && (
                    <div className="py-6 text-center">
                      <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
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

                  {pOverdueDeliverables.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold flex items-center gap-2 mb-2">
                        <AlertTriangle className="h-4 w-4 text-destructive" /> Entregas atrasadas
                        <Badge variant="destructive" className="text-[10px]">{pOverdueDeliverables.length}</Badge>
                      </h4>
                      <div className="space-y-1 max-h-[200px] overflow-y-auto">
                        {pOverdueDeliverables.map(d => (
                          <div key={d.id} className="flex items-center gap-2 py-1.5 px-3 rounded-md bg-destructive/5 text-sm">
                            <span className="h-2 w-2 rounded-full bg-destructive shrink-0" />
                            <span className="flex-1 truncate">{d.name}</span>
                            <span className="text-[10px] text-destructive shrink-0">{format(new Date(d.deadline!), 'dd/MM')}</span>
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
                  <span className={`text-4xl font-black tabular-nums ${nextDelivery.daysLeft <= 3 ? 'text-destructive' : nextDelivery.daysLeft <= 7 ? 'text-warning' : 'text-foreground'}`}>
                    {nextDelivery.daysLeft}
                  </span>
                  <span className="text-sm text-muted-foreground font-medium">dias</span>
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
                <span className="text-xs text-muted-foreground font-normal ml-1">próximos 14 dias</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {deliveryTimeline.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Sem entregas nos próximos 14 dias 🎉</p>
              ) : (
                <div className="flex gap-0 overflow-x-auto pb-2">
                  {deliveryTimeline.map((day, idx) => (
                    <div key={idx} className="flex flex-col items-center min-w-0 flex-1">
                      {/* Connector line + dot */}
                      <div className="flex items-center w-full">
                        <div className={`h-0.5 flex-1 ${idx === 0 ? 'bg-transparent' : 'bg-border'}`} />
                        <div className={`h-3 w-3 rounded-full shrink-0 border-2 ${
                          isToday(day.date) ? 'bg-primary border-primary' : 
                          day.items.some(i => i.type === 'project') ? 'bg-amber-500 border-amber-500' : 'bg-muted-foreground/40 border-muted-foreground/40'
                        }`} />
                        <div className={`h-0.5 flex-1 ${idx === deliveryTimeline.length - 1 ? 'bg-transparent' : 'bg-border'}`} />
                      </div>
                      {/* Label */}
                      <p className={`text-[10px] mt-1.5 font-medium capitalize ${isToday(day.date) ? 'text-primary' : 'text-muted-foreground'}`}>
                        {day.label}
                      </p>
                      {/* Items */}
                      <div className="mt-1 space-y-0.5 w-full px-0.5">
                        {day.items.slice(0, 3).map((item, i) => (
                          <div key={i} className={`text-[9px] leading-tight px-1.5 py-1 rounded-md truncate text-center ${
                            item.type === 'deliverable' ? 'bg-accent/20 text-accent-foreground font-semibold ring-1 ring-accent/30' :
                            item.type === 'project' ? 'bg-primary/10 text-primary font-medium' : 'bg-muted text-muted-foreground'
                          }`} title={item.name}>
                            {item.name.length > 12 ? item.name.slice(0, 12) + '…' : item.name}
                          </div>
                        ))}
                        {day.items.length > 3 && (
                          <p className="text-[9px] text-muted-foreground text-center">+{day.items.length - 3}</p>
                        )}
                      </div>
                    </div>
                  ))}
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
                <span className="flex items-center gap-1"><CircleDot className="h-3 w-3 text-emerald-500" /> Em dia</span>
                <span className="flex items-center gap-1"><CircleDot className="h-3 w-3 text-amber-500" /> Atenção</span>
                <span className="flex items-center gap-1"><CircleDot className="h-3 w-3 text-red-500" /> Em risco</span>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {projectHealth.map(p => {
                const healthColor = {
                  green: { bg: 'bg-emerald-500/10', ring: 'ring-emerald-500/30', text: 'text-success dark:text-emerald-400', dot: 'bg-emerald-500' },
                  yellow: { bg: 'bg-amber-500/10', ring: 'ring-amber-500/30', text: 'text-warning dark:text-amber-400', dot: 'bg-amber-500' },
                  red: { bg: 'bg-red-500/10', ring: 'ring-red-500/30', text: 'text-destructive dark:text-red-400', dot: 'bg-red-500 animate-pulse' },
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
                      <div className="flex items-center gap-1.5 pl-4">
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


        <Tabs defaultValue="clientes" className="space-y-4">
          <TabsList>
            <TabsTrigger value="clientes" className="gap-1.5">
              <Briefcase className="h-3.5 w-3.5" /> Clientes
            </TabsTrigger>
            <TabsTrigger value="interno" className="gap-1.5">
              <Building2 className="h-3.5 w-3.5" /> Interno
            </TabsTrigger>
          </TabsList>

          {/* ─── TAB CLIENTES ─── */}
          <TabsContent value="clientes" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Col 1: Status resumo */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Estado dos Clientes</CardTitle>
                </CardHeader>
                <CardContent className="pt-0 space-y-1.5">
                  {[
                    { value: 'em_onboarding', label: 'Em onboarding', className: 'bg-info/15 text-info' },
                    { value: 'ativo', label: 'Ativos', className: 'bg-success/15 text-success' },
                    { value: 'pausado', label: 'Pausados', className: 'bg-warning/15 text-warning' },
                    { value: 'altura_renovacao', label: 'Renovação', className: 'bg-purple-100 text-purple-800' },
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
                    <p className="text-sm text-muted-foreground py-3">Nenhum projeto ativo</p>
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
              <CardContent className="pt-0 space-y-0.5 max-h-[400px] overflow-y-auto">
                {filteredClientTasks.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-3">Nenhuma tarefa neste filtro</p>
                ) : filteredClientTasks.map(t => renderTaskRow(t))}
              </CardContent>
            </Card>
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
                    <p className="text-sm text-muted-foreground py-3">Nenhum projeto interno ativo</p>
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
                    <p className="text-sm text-muted-foreground py-3">Sem membros associados</p>
                  ) : internoMembers.map(m => (
                    <div key={m.profile!.id} className="flex items-center gap-2.5 py-2 px-2 rounded-lg hover:bg-muted/40">
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
                  <p className="text-sm text-muted-foreground py-3">Nenhuma tarefa neste filtro</p>
                ) : filteredInternoTasks.map(t => renderTaskRow(t))}
              </CardContent>
            </Card>
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
                <p className="text-sm text-muted-foreground py-3">Nenhum cliente neste status</p>
              ) : expandedStatus === 'altura_renovacao' ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Nome</TableHead>
                      <TableHead className="text-xs">Data de Início</TableHead>
                      <TableHead className="text-xs">Fim de Ciclo</TableHead>
                      <TableHead className="text-xs">Produto Atual</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clients.filter(c => c.status === expandedStatus).map(c => (
                      <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={() => { setExpandedStatus(null); window.location.href = `/hub/clientes/${c.id}`; }}>
                        <TableCell className="text-sm font-medium">{c.full_name}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{c.start_date ? format(new Date(c.start_date), 'dd/MM/yyyy') : '—'}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{c.end_of_cycle ? format(new Date(c.end_of_cycle), 'dd/MM/yyyy') : '—'}</TableCell>
                        <TableCell className="text-xs">{c.current_product || '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">ID</TableHead>
                      <TableHead className="text-xs">Nome</TableHead>
                      <TableHead className="text-xs">Data de Início</TableHead>
                      {(expandedStatus === 'em_onboarding' || expandedStatus === 'em_offboarding') && <TableHead className="text-xs">Por concluir</TableHead>}
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
                          <TableCell className="text-xs font-mono">{c.client_id}</TableCell>
                          <TableCell className="text-sm font-medium">{c.full_name}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{c.start_date ? format(new Date(c.start_date), 'dd/MM/yyyy') : '—'}</TableCell>
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
