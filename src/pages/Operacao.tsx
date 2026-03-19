import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Link } from 'react-router-dom';
import { Users, FolderOpen, CheckCircle2, Clock, AlertTriangle, Briefcase, Building2, ListTodo } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format, isToday, isBefore, startOfToday, isAfter, subDays, endOfWeek, startOfWeek } from 'date-fns';
import { pt } from 'date-fns/locale';

// ─── Types ──────────────────────────────────────────────────────

type Project = {
  id: string; name: string; type: string; status: string; department: string | null;
  client_name: string | null; deadline: string | null; progress: number;
  start_date: string | null; created_at: string;
};
type Task = {
  id: string; name: string; status: string; priority: string; deadline: string | null;
  assigned_to: string | null; project_id: string | null;
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

function getInitials(name: string | null) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function TaskFilterButtons({ filter, setFilter }: { filter: TaskFilter; setFilter: (f: TaskFilter) => void }) {
  const opts: { key: TaskFilter; label: string }[] = [
    { key: 'todas', label: 'Todas' },
    { key: 'hoje', label: 'Hoje' },
    { key: 'semana', label: 'Esta semana' },
    { key: 'atrasadas', label: 'Atrasadas' },
  ];
  return (
    <div className="flex gap-1.5">
      {opts.map(o => (
        <Button key={o.key} size="sm" variant={filter === o.key ? 'default' : 'outline'} className="h-7 text-xs" onClick={() => setFilter(o.key)}>
          {o.label}
        </Button>
      ))}
    </div>
  );
}

function TaskBadge({ deadline, status }: { deadline: string | null; status: string }) {
  if (status === 'concluida') return null;
  if (!deadline) return null;
  const d = new Date(deadline);
  const today = startOfToday();
  if (isBefore(d, today)) return <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Atrasada</Badge>;
  if (isToday(d)) return <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-[10px] px-1.5 py-0">Hoje</Badge>;
  return null;
}

function PriorityDot({ priority }: { priority: string }) {
  const colors: Record<string, string> = { alta: 'bg-red-500', media: 'bg-yellow-500', baixa: 'bg-green-500' };
  return <span className={`inline-block h-2 w-2 rounded-full ${colors[priority] || 'bg-muted'}`} />;
}

function filterTasks(tasks: Task[], filter: TaskFilter): Task[] {
  const today = startOfToday();
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
  switch (filter) {
    case 'hoje': return tasks.filter(t => t.deadline && isToday(new Date(t.deadline)));
    case 'semana': return tasks.filter(t => t.deadline && !isBefore(new Date(t.deadline), today) && !isAfter(new Date(t.deadline), weekEnd));
    case 'atrasadas': return tasks.filter(t => t.deadline && isBefore(new Date(t.deadline), today) && t.status !== 'concluida');
    default: return tasks;
  }
}

// ─── Main ───────────────────────────────────────────────────────

export default function OperacaoPage() {
  const [clientTaskFilter, setClientTaskFilter] = useState<TaskFilter>('todas');
  const [internoTaskFilter, setInternoTaskFilter] = useState<TaskFilter>('todas');
  const [expandedStatus, setExpandedStatus] = useState<string | null>(null);

  // ── Queries ─────────────────────────────────────────────────
  const { data: projects = [] } = useQuery({
    queryKey: ['op-projects'],
    queryFn: async () => {
      const { data } = await supabase.from('projects').select('id,name,type,status,department,client_name,deadline,progress,start_date,created_at').order('deadline', { ascending: true });
      return (data || []) as Project[];
    },
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['op-tasks'],
    queryFn: async () => {
      const { data } = await supabase.from('tasks').select('id,name,status,priority,deadline,assigned_to,project_id').order('deadline', { ascending: true });
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

  // Onboarding items for all clients (for the popup)
  const { data: allOnboarding = [] } = useQuery({
    queryKey: ['op-all-onboarding'],
    queryFn: async () => {
      const { data } = await (supabase.from('client_onboarding' as any) as any).select('client_id,activity,completed,phase').eq('completed', false);
      return (data || []) as unknown as { client_id: string; activity: string; completed: boolean; phase: string | null }[];
    },
  });

  // Offboarding items for all clients (for the popup)
  const { data: allOffboarding = [] } = useQuery({
    queryKey: ['op-all-offboarding'],
    queryFn: async () => {
      const { data } = await (supabase.from('client_offboarding' as any) as any).select('client_id,activity,completed,phase').eq('completed', false);
      return (data || []) as unknown as { client_id: string; activity: string; completed: boolean; phase: string | null }[];
    },
  });

  const { data: projectMembers = [] } = useQuery({
    queryKey: ['op-project-members'],
    queryFn: async () => {
      const { data } = await supabase.from('project_members').select('project_id,profile_id');
      return (data || []) as ProjectMember[];
    },
  });

  // ── Derived data ────────────────────────────────────────────
  const profileMap = useMemo(() => new Map(profiles.map(p => [p.id, p])), [profiles]);

  const clientProjects = useMemo(() => projects.filter(p => p.type === 'clientes'), [projects]);
  const internoProjects = useMemo(() => projects.filter(p => p.type === 'interno'), [projects]);

  const activeClientProjects = useMemo(() => clientProjects.filter(p => ACTIVE_STATUSES.includes(p.status)), [clientProjects]);
  const activeInternoProjects = useMemo(() => internoProjects.filter(p => ACTIVE_STATUSES.includes(p.status)), [internoProjects]);

  const clientProjectIds = useMemo(() => new Set(clientProjects.map(p => p.id)), [clientProjects]);
  const internoProjectIds = useMemo(() => new Set(internoProjects.map(p => p.id)), [internoProjects]);

  const clientTasks = useMemo(() => tasks.filter(t => t.project_id && clientProjectIds.has(t.project_id) && t.status !== 'concluida'), [tasks, clientProjectIds]);
  const internoTasks = useMemo(() => tasks.filter(t => t.project_id && internoProjectIds.has(t.project_id) && t.status !== 'concluida'), [tasks, internoProjectIds]);

  // Client summary — all except "terminado"
  const activeClients = useMemo(() => clients.filter(c => c.status !== 'terminado'), [clients]);
  const productBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    activeClients.forEach(c => {
      const prod = c.current_product || 'Sem produto';
      map.set(prod, (map.get(prod) || 0) + 1);
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [activeClients]);

  const onboardingClients = useMemo(() => {
    return clients.filter(c => c.status === 'em_onboarding');
  }, [clients]);

  // Interno summary
  const internoByStatus = useMemo(() => {
    const counts = { em_curso: 0, em_ideia: 0, em_pausa: 0 };
    activeInternoProjects.forEach(p => {
      if (p.status in counts) counts[p.status as keyof typeof counts]++;
    });
    return counts;
  }, [activeInternoProjects]);

  // Project progress from tasks
  const projectProgress = useMemo(() => {
    const map = new Map<string, number>();
    const totals = new Map<string, number>();
    const dones = new Map<string, number>();
    tasks.forEach(t => {
      if (!t.project_id) return;
      totals.set(t.project_id, (totals.get(t.project_id) || 0) + 1);
      if (t.status === 'concluida') dones.set(t.project_id, (dones.get(t.project_id) || 0) + 1);
    });
    totals.forEach((total, pid) => {
      map.set(pid, total > 0 ? Math.round(((dones.get(pid) || 0) / total) * 100) : 0);
    });
    return map;
  }, [tasks]);

  // Members in internal projects
  const internoMembers = useMemo(() => {
    const memberProjects = new Map<string, Set<string>>();
    projectMembers.forEach(pm => {
      if (internoProjectIds.has(pm.project_id)) {
        if (!memberProjects.has(pm.profile_id)) memberProjects.set(pm.profile_id, new Set());
        memberProjects.get(pm.profile_id)!.add(pm.project_id);
      }
    });
    // Count open tasks per member
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

  // Members map for projects
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

  // Project name map for tasks
  const projectNameMap = useMemo(() => new Map(projects.map(p => [p.id, p.name])), [projects]);

  // Filtered tasks
  const filteredClientTasks = filterTasks(clientTasks, clientTaskFilter);
  const filteredInternoTasks = filterTasks(internoTasks, internoTaskFilter);

  // ── Render helpers ──────────────────────────────────────────

  function renderProjectRow(p: Project, showClient = false, showDept = false) {
    const prog = projectProgress.get(p.id) ?? p.progress;
    const members = projectMembersMap.get(p.id) || [];
    return (
      <Link key={p.id} to={`/hub/projetos/${p.id}`} className="flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-muted/50 transition-colors group">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">{p.name}</p>
          <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
            {showClient && p.client_name && <span>{p.client_name}</span>}
            {showDept && p.department && <span className="capitalize">{p.department}</span>}
            {p.deadline && <span>Entrega: {format(new Date(p.deadline), 'dd MMM', { locale: pt })}</span>}
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-20">
            <div className="flex items-center gap-1.5">
              <Progress value={prog} className="h-1.5 flex-1" />
              <span className="text-[10px] text-muted-foreground w-7 text-right">{prog}%</span>
            </div>
          </div>
          <div className="flex -space-x-1.5">
            {members.slice(0, 3).map(m => (
              <Avatar key={m.id} className="h-6 w-6 border-2 border-background">
                <AvatarImage src={m.avatar_url || ''} />
                <AvatarFallback className="text-[9px]">{getInitials(m.full_name)}</AvatarFallback>
              </Avatar>
            ))}
            {members.length > 3 && <span className="text-[10px] text-muted-foreground ml-1">+{members.length - 3}</span>}
          </div>
        </div>
      </Link>
    );
  }

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
            <AvatarImage src={assignee.avatar_url || ''} />
            <AvatarFallback className="text-[8px]">{getInitials(assignee.full_name)}</AvatarFallback>
          </Avatar>
        )}
      </div>
    );
  }

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Operação</h1>
          <p className="text-sm text-muted-foreground">Vista operacional de projetos de clientes e internos</p>
        </div>

        <div className="space-y-10">

          {/* ═══════════════ COLUNA ESQUERDA — CLIENTES ═══════════════ */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <Briefcase className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">Clientes</h2>
            </div>

            {/* Resumo */}
            <Card>
              <CardContent className="pt-4 pb-3 space-y-2">
                {[
                  { value: 'em_onboarding', label: 'Em onboarding', className: 'bg-blue-100 text-blue-800' },
                  { value: 'ativo', label: 'Ativos', className: 'bg-green-100 text-green-800' },
                  { value: 'pausado', label: 'Pausados', className: 'bg-amber-100 text-amber-800' },
                  { value: 'altura_renovacao', label: 'Altura de renovação', className: 'bg-purple-100 text-purple-800' },
                  { value: 'em_offboarding', label: 'Em offboarding', className: 'bg-orange-100 text-orange-800' },
                ].map(s => {
                  const count = clients.filter(c => c.status === s.value).length;
                  return (
                    <button
                      key={s.value}
                      onClick={() => setExpandedStatus(s.value)}
                      className="flex items-center justify-between w-full py-1 rounded hover:bg-muted/50 transition-colors"
                    >
                      <Badge variant="outline" className={`${s.className} border-0 text-xs`}>{s.label}</Badge>
                      <span className="text-sm font-semibold">{count}</span>
                    </button>
                  );
                })}

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
                              const pendingItems = expandedStatus === 'em_onboarding'
                                ? allOnboarding.filter(o => o.client_id === c.id)
                                : expandedStatus === 'em_offboarding'
                                ? allOffboarding.filter(o => o.client_id === c.id)
                                : [];
                              return (
                                <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50 align-top" onClick={() => { setExpandedStatus(null); window.location.href = `/hub/clientes/${c.id}`; }}>
                                  <TableCell className="text-xs font-mono">{c.client_id}</TableCell>
                                  <TableCell className="text-sm font-medium">{c.full_name}</TableCell>
                                  <TableCell className="text-xs text-muted-foreground">{c.start_date ? format(new Date(c.start_date), 'dd/MM/yyyy') : '—'}</TableCell>
                                  {(expandedStatus === 'em_onboarding' || expandedStatus === 'em_offboarding') && (
                                    <TableCell>
                                      {pendingItems.length === 0 ? (
                                        <span className="text-xs text-muted-foreground">Sem checklist</span>
                                      ) : (
                                        <ul className="space-y-0.5">
                                          {pendingItems.map((item, i) => (
                                            <li key={i} className="text-xs text-destructive flex items-center gap-1">
                                              <span className="h-1.5 w-1.5 rounded-full bg-destructive shrink-0" />
                                              {item.phase ? `${item.phase}: ` : ''}{item.activity}
                                            </li>
                                          ))}
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
              </CardContent>
            </Card>

            {/* Projetos de cliente */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <FolderOpen className="h-4 w-4" /> Projetos de Clientes
                  <Badge variant="outline" className="ml-auto text-[10px]">{activeClientProjects.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-0.5 max-h-[300px] overflow-y-auto">
                {activeClientProjects.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-3">Nenhum projeto de cliente ativo</p>
                ) : (
                  activeClientProjects.map(p => renderProjectRow(p, true))
                )}
              </CardContent>
            </Card>

            {/* Tarefas de cliente */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <ListTodo className="h-4 w-4" /> Tarefas de Clientes
                    <Badge variant="outline" className="text-[10px]">{clientTasks.length}</Badge>
                  </CardTitle>
                  <TaskFilterButtons filter={clientTaskFilter} setFilter={setClientTaskFilter} />
                </div>
              </CardHeader>
              <CardContent className="pt-0 space-y-0.5 max-h-[350px] overflow-y-auto">
                {filteredClientTasks.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-3">Nenhuma tarefa neste filtro</p>
                ) : (
                  filteredClientTasks.map(t => renderTaskRow(t))
                )}
              </CardContent>
            </Card>
          </div>

          {/* ═══════════════ COLUNA DIREITA — INTERNO ═══════════════ */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <Building2 className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">Interno</h2>
            </div>

            {/* Resumo */}
            <Card>
              <CardContent className="pt-4 pb-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FolderOpen className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Projetos internos ativos</span>
                  </div>
                  <span className="text-xl font-bold">{activeInternoProjects.length}</span>
                </div>
                <div className="flex gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-500 inline-block" /> Em curso: {internoByStatus.em_curso}</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-gray-400 inline-block" /> Por iniciar: {internoByStatus.em_ideia}</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-yellow-500 inline-block" /> Pausados: {internoByStatus.em_pausa}</span>
                </div>
              </CardContent>
            </Card>

            {/* Projetos internos */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <FolderOpen className="h-4 w-4" /> Projetos Internos
                  <Badge variant="outline" className="ml-auto text-[10px]">{activeInternoProjects.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-0.5 max-h-[300px] overflow-y-auto">
                {activeInternoProjects.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-3">Nenhum projeto interno ativo</p>
                ) : (
                  activeInternoProjects.map(p => renderProjectRow(p, false, true))
                )}
              </CardContent>
            </Card>

            {/* Tarefas internas */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <ListTodo className="h-4 w-4" /> Tarefas Internas
                    <Badge variant="outline" className="text-[10px]">{internoTasks.length}</Badge>
                  </CardTitle>
                  <TaskFilterButtons filter={internoTaskFilter} setFilter={setInternoTaskFilter} />
                </div>
              </CardHeader>
              <CardContent className="pt-0 space-y-0.5 max-h-[350px] overflow-y-auto">
                {filteredInternoTasks.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-3">Nenhuma tarefa neste filtro</p>
                ) : (
                  filteredInternoTasks.map(t => renderTaskRow(t))
                )}
              </CardContent>
            </Card>

            {/* Membros em projetos internos */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Users className="h-4 w-4" /> Equipa em Projetos Internos
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-1 max-h-[250px] overflow-y-auto">
                {internoMembers.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-3">Sem membros associados</p>
                ) : (
                  internoMembers.map(m => (
                    <div key={m.profile!.id} className="flex items-center gap-2.5 py-2 px-3 rounded-lg hover:bg-muted/40">
                      <Avatar className="h-7 w-7">
                        <AvatarImage src={m.profile!.avatar_url || ''} />
                        <AvatarFallback className="text-[10px]">{getInitials(m.profile!.full_name)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{m.profile!.full_name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{m.projectNames.join(', ')}</p>
                      </div>
                      <Badge variant="outline" className="text-[10px] shrink-0">{m.openTasks} tarefas</Badge>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
