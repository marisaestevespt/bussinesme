import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, LayoutList, Columns3, Users, Sparkles } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { isTaskDone, isTaskOpen, getTaskStatusInfo, getTaskPriorityInfo, TASK_STATUSES } from '@/lib/taskStatus';
import { monthlyCapacity } from '@/lib/memberCapacity';
import { useTeamPhotos } from '@/hooks/useTeamPhotos';
import { useSecretariaCustomViews, type CustomView } from '@/hooks/useSecretariaCustomViews';
import { EmptyHint } from '@/components/ui/loading-skeletons';

interface Props {
  year: number;
  monthNum: number;
  tasks: any[];
  team: any[];
}

type ViewMode = 'list' | 'board' | 'team' | 'custom';

function initials(name?: string | null) {
  if (!name) return '?';
  return name.split(' ').filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase()).join('');
}

function applyView(tasks: any[], v: CustomView): any[] {
  let list = [...tasks];
  const f = v.filters || {};
  if (f.search) {
    const s = f.search.toLowerCase();
    list = list.filter(t => (t.name || '').toLowerCase().includes(s));
  }
  if (f.statuses?.length) list = list.filter(t => f.statuses!.includes(t.status));
  if (f.priorities?.length) list = list.filter(t => f.priorities!.includes(t.priority));
  if (f.completion === 'done') list = list.filter(isTaskDone);
  else if (f.completion === 'pending') list = list.filter(isTaskOpen);
  // sort
  switch (v.sort_by) {
    case 'deadline_desc': list.sort((a, b) => (b.deadline || '').localeCompare(a.deadline || '')); break;
    case 'name_asc':      list.sort((a, b) => (a.name || '').localeCompare(b.name || '')); break;
    case 'name_desc':     list.sort((a, b) => (b.name || '').localeCompare(a.name || '')); break;
    case 'recent':        list.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')); break;
    case 'deadline_asc':
    default:              list.sort((a, b) => (a.deadline || '9999').localeCompare(b.deadline || '9999'));
  }
  return list;
}

export function MonthDetailTasksCard({ year, monthNum, tasks, team }: Props) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<ViewMode>('list');
  const [selectedView, setSelectedView] = useState<string>('');
  const { getPhotoUrl } = useTeamPhotos();
  const { views } = useSecretariaCustomViews('tasks');

  // Profiles for assignee resolution (team_members.profile_id → profiles.user_id)
  const profilesQ = useQuery({
    queryKey: ['md-profiles'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, user_id, full_name, avatar_url');
      return data || [];
    },
  });
  const profiles = profilesQ.data || [];

  // KPIs ─────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const planned = tasks.length;
    const done = tasks.filter(isTaskDone).length;
    const internal = tasks.filter(t => !t.client_id && !t.project_id).length;
    const fromClients = tasks.filter(t => t.client_id || t.project_id).length;

    // Capacity %: somatório (estimated_minutes/60 committed) / sum(capacity)
    let totalCommitted = 0;
    let totalCapacity = 0;
    team.forEach(m => {
      const cap = monthlyCapacity(m);
      totalCapacity += cap;
      const myProfile = profiles.find(p => p.id === m.profile_id);
      const userId = myProfile?.user_id;
      const myTasks = tasks.filter(t => t.assigned_to === userId || t.assigned_to === m.profile_id);
      totalCommitted += myTasks.reduce((s, t) => s + Number(t.estimated_minutes || 0) / 60, 0);
    });
    const capPct = totalCapacity > 0 ? Math.round((totalCommitted / totalCapacity) * 100) : 0;

    return { planned, done, internal, fromClients, capPct, totalCommitted: Math.round(totalCommitted), totalCapacity: Math.round(totalCapacity) };
  }, [tasks, team, profiles]);

  // Sorted by date (default list)
  const sortedByDate = useMemo(
    () => [...tasks].sort((a, b) => (a.deadline || '9999').localeCompare(b.deadline || '9999')),
    [tasks],
  );

  // Board: agrupado por status
  const board = useMemo(() => {
    const map: Record<string, any[]> = {};
    TASK_STATUSES.forEach(s => { map[s.value] = []; });
    tasks.forEach(t => {
      const k = TASK_STATUSES.find(s => s.value === t.status)?.value || 'por_comecar';
      (map[k] ||= []).push(t);
    });
    return map;
  }, [tasks]);

  // Per-team-member
  const byMember = useMemo(() => {
    return team.map(m => {
      const profile = profiles.find(p => p.id === m.profile_id);
      const userId = profile?.user_id;
      const myTasks = tasks.filter(t => t.assigned_to === userId || t.assigned_to === m.profile_id);
      const cap = monthlyCapacity(m);
      const committed = myTasks.reduce((s, t) => s + Number(t.estimated_minutes || 0) / 60, 0);
      return {
        member: m,
        photoUrl: getPhotoUrl({ id: profile?.id, full_name: m.full_name, avatar_url: profile?.avatar_url }),
        tasks: myTasks.sort((a, b) => (a.deadline || '9999').localeCompare(b.deadline || '9999')),
        capacity: Math.round(cap),
        committed: Math.round(committed),
        pct: cap > 0 ? Math.round((committed / cap) * 100) : 0,
      };
    }).filter(x => x.tasks.length > 0 || x.committed > 0);
  }, [team, tasks, profiles, getPhotoUrl]);

  const activeCustomView = views.find(v => v.id === selectedView);
  const customList = activeCustomView ? applyView(tasks, activeCustomView) : [];

  const renderTaskRow = (t: any) => (
    <TableRow key={t.id} className="cursor-pointer hover:bg-muted/60" onClick={() => navigate(`/hub/tarefas?id=${t.id}`)}>
      <TableCell className="font-medium">{t.name}</TableCell>
      <TableCell><Badge variant="outline" className={cn('text-[10px]', getTaskPriorityInfo(t.priority).color)}>{getTaskPriorityInfo(t.priority).short}</Badge></TableCell>
      <TableCell><Badge variant="outline" className={cn('text-[10px]', getTaskStatusInfo(t.status).color)}>{getTaskStatusInfo(t.status).label}</Badge></TableCell>
      <TableCell className="text-muted-foreground text-xs">{t.deadline ? format(parseISO(t.deadline), 'dd/MM') : '—'}</TableCell>
    </TableRow>
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-sm">Tarefas & Produtividade</CardTitle>
          <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 gap-1" onClick={() => navigate('/hub/tarefas')}>
            <Plus className="h-3 w-3" /> Nova Tarefa
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* KPI cards ─────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {[
            { label: 'Planeadas', value: stats.planned, sub: `${stats.done} feitas` },
            { label: 'Concluídas', value: stats.done, sub: stats.planned > 0 ? `${Math.round((stats.done / stats.planned) * 100)}%` : '—' },
            { label: 'Internas', value: stats.internal },
            { label: 'De Clientes', value: stats.fromClients },
            { label: 'Capacidade', value: `${stats.capPct}%`, sub: `${stats.totalCommitted}h / ${stats.totalCapacity}h` },
          ].map(k => (
            <div key={k.label} className="rounded-lg border border-border/50 bg-background/60 p-2.5">
              <p className="text-[9px] uppercase text-muted-foreground tracking-wider">{k.label}</p>
              <p className="text-base font-bold mt-0.5">{k.value}</p>
              {k.sub && <p className="text-[10px] text-muted-foreground">{k.sub}</p>}
              {k.label === 'Capacidade' && <Progress value={Math.min(stats.capPct, 100)} className="h-1 mt-1.5" />}
            </div>
          ))}
        </div>

        {/* View switcher ───────────────────────────── */}
        <div className="flex items-center gap-1 flex-wrap">
          <Button size="sm" variant={mode === 'list' ? 'default' : 'outline'} className="h-7 text-[11px] px-2 gap-1" onClick={() => setMode('list')}>
            <LayoutList className="h-3 w-3" /> Lista por data
          </Button>
          <Button size="sm" variant={mode === 'board' ? 'default' : 'outline'} className="h-7 text-[11px] px-2 gap-1" onClick={() => setMode('board')}>
            <Columns3 className="h-3 w-3" /> Board
          </Button>
          <Button size="sm" variant={mode === 'team' ? 'default' : 'outline'} className="h-7 text-[11px] px-2 gap-1" onClick={() => setMode('team')}>
            <Users className="h-3 w-3" /> Por membro
          </Button>
          <Button size="sm" variant={mode === 'custom' ? 'default' : 'outline'} className="h-7 text-[11px] px-2 gap-1" onClick={() => setMode('custom')}>
            <Sparkles className="h-3 w-3" /> Personalizada
          </Button>
        </div>

        {/* List ─────────────────────────────────────── */}
        {mode === 'list' && (
          sortedByDate.length === 0 ? <EmptyHint>Sem tarefas para este mês.</EmptyHint> : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Tarefa</TableHead><TableHead>Prio.</TableHead><TableHead>Status</TableHead><TableHead>Deadline</TableHead>
              </TableRow></TableHeader>
              <TableBody>{sortedByDate.map(renderTaskRow)}</TableBody>
            </Table>
          )
        )}

        {/* Board ─────────────────────────────────────── */}
        {mode === 'board' && (
          <div className="overflow-x-auto pb-2">
            <div className="flex gap-2" style={{ minWidth: TASK_STATUSES.length * 200 }}>
              {TASK_STATUSES.map(s => {
                const items = board[s.value] || [];
                return (
                  <div key={s.value} className="w-48 shrink-0">
                    <div className={cn('text-[10px] font-medium mb-1.5 px-2 py-1 rounded-md border', s.color)}>
                      {s.label} <Badge variant="outline" className="text-[9px] ml-1">{items.length}</Badge>
                    </div>
                    <div className="space-y-1.5">
                      {items.map(t => (
                        <div key={t.id} onClick={() => navigate(`/hub/tarefas?id=${t.id}`)}
                          className="rounded-md border bg-background p-2 text-xs space-y-1 cursor-pointer hover:bg-muted/40">
                          <p className="font-medium truncate">{t.name}</p>
                          <div className="flex items-center justify-between gap-1">
                            <Badge variant="outline" className={cn('text-[9px]', getTaskPriorityInfo(t.priority).color)}>{getTaskPriorityInfo(t.priority).short}</Badge>
                            {t.deadline && <span className="text-[9px] text-muted-foreground">{format(parseISO(t.deadline), 'dd/MM')}</span>}
                          </div>
                        </div>
                      ))}
                      {items.length === 0 && <div className="text-[10px] text-muted-foreground text-center py-2">—</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Team ─────────────────────────────────────── */}
        {mode === 'team' && (
          byMember.length === 0 ? <EmptyHint>Sem tarefas atribuídas a membros este mês.</EmptyHint> : (
            <div className="space-y-3">
              {byMember.map(({ member, photoUrl, tasks: mt, capacity, committed, pct }) => (
                <div key={member.id} className="rounded-lg border border-border/50 p-3 space-y-2">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                      {photoUrl && <AvatarImage src={photoUrl} alt={member.full_name} />}
                      <AvatarFallback className="text-xs">{initials(member.full_name)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{member.full_name}</p>
                      <p className="text-[10px] text-muted-foreground">{mt.length} tarefas · {committed}h / {capacity}h</p>
                    </div>
                    <div className="w-28">
                      <Progress value={Math.min(pct, 100)} className="h-1.5" />
                      <p className={cn('text-[10px] text-right mt-0.5', pct > 100 ? 'text-destructive font-medium' : 'text-muted-foreground')}>{pct}%</p>
                    </div>
                  </div>
                  {mt.length > 0 && (
                    <div className="pl-12">
                      <Table>
                        <TableBody>
                          {mt.slice(0, 8).map(t => (
                            <TableRow key={t.id} className="cursor-pointer hover:bg-muted/60" onClick={() => navigate(`/hub/tarefas?id=${t.id}`)}>
                              <TableCell className="text-xs py-1.5">{t.name}</TableCell>
                              <TableCell className="py-1.5"><Badge variant="outline" className={cn('text-[9px]', getTaskPriorityInfo(t.priority).color)}>{getTaskPriorityInfo(t.priority).short}</Badge></TableCell>
                              <TableCell className="py-1.5"><Badge variant="outline" className={cn('text-[9px]', getTaskStatusInfo(t.status).color)}>{getTaskStatusInfo(t.status).label}</Badge></TableCell>
                              <TableCell className="py-1.5 text-[10px] text-muted-foreground">{t.deadline ? format(parseISO(t.deadline), 'dd/MM') : '—'}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      {mt.length > 8 && <p className="text-[10px] text-muted-foreground mt-1">+ {mt.length - 8} mais</p>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        )}

        {/* Custom ─────────────────────────────────────── */}
        {mode === 'custom' && (
          views.length === 0 ? (
            <EmptyHint>
              Sem vistas personalizadas. Cria uma vista na <button className="underline text-primary" onClick={() => navigate('/hub/secretaria?tab=tarefas')}>Secretária › Tarefas</button> e ela aparecerá aqui.
            </EmptyHint>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                {views.map(v => (
                  <Button key={v.id} size="sm" variant={selectedView === v.id ? 'default' : 'outline'} className="h-6 text-[10px] px-2" onClick={() => setSelectedView(v.id)}>
                    {v.name}
                  </Button>
                ))}
              </div>
              {!activeCustomView ? (
                <p className="text-xs text-muted-foreground py-2">Escolhe uma vista acima.</p>
              ) : customList.length === 0 ? (
                <EmptyHint>Sem tarefas correspondentes a esta vista.</EmptyHint>
              ) : (
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Tarefa</TableHead><TableHead>Prio.</TableHead><TableHead>Status</TableHead><TableHead>Deadline</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>{customList.map(renderTaskRow)}</TableBody>
                </Table>
              )}
            </div>
          )
        )}
      </CardContent>
    </Card>
  );
}