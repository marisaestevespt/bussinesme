import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useTeamPhotos } from '@/hooks/useTeamPhotos';
import { Package, CheckCircle2, Clock, AlertTriangle, ArrowRight } from 'lucide-react';
import { format, isAfter, subDays, startOfMonth, endOfMonth, addMonths, addDays, getDay } from 'date-fns';
import { pt } from 'date-fns/locale';

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pendente: { label: 'Pendente', color: 'bg-gray-100 text-gray-700' },
  em_curso: { label: 'Em curso', color: 'bg-info/15 text-info' },
  entregue: { label: 'Entregue', color: 'bg-success/15 text-success' },
  atrasado: { label: 'Atrasado', color: 'bg-destructive/15 text-destructive' },
};

const TASK_STATUS_MAP: Record<string, { label: string; color: string }> = {
  pendente: { label: 'Pendente', color: 'bg-gray-100 text-gray-700' },
  em_curso: { label: 'Em curso', color: 'bg-info/15 text-info' },
  concluida: { label: 'Concluída', color: 'bg-success/15 text-success' },
};

function calcNextOccurrence(week: number, weekday: number): Date {
  const today = new Date();
  for (let offset = 0; offset <= 2; offset++) {
    const target = addMonths(today, offset);
    const date = getOccurrenceInMonth(target, week, weekday);
    if (date && isAfter(date, subDays(today, 1))) return date;
  }
  return addMonths(today, 1);
}

function getOccurrenceInMonth(refDate: Date, week: number, weekday: number): Date | null {
  const monthStart = startOfMonth(refDate);
  const monthEnd = endOfMonth(refDate);
  if (week > 0) {
    let count = 0;
    let d = monthStart;
    while (d <= monthEnd) {
      if (getDay(d) === weekday) { count++; if (count === week) return d; }
      d = addDays(d, 1);
    }
    return null;
  }
  const occurrences: Date[] = [];
  let d = monthStart;
  while (d <= monthEnd) {
    if (getDay(d) === weekday) occurrences.push(new Date(d));
    d = addDays(d, 1);
  }
  const idx = occurrences.length + week;
  return idx >= 0 ? occurrences[idx] : null;
}

function getInitials(name: string | null) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

interface ClientDeliverablesTabProps {
  clientName: string;
  clientId: string;
}

export function ClientDeliverablesTab({ clientName, clientId }: ClientDeliverablesTabProps) {
  const navigate = useNavigate();
  const { getPhotoUrl } = useTeamPhotos();

  // Find projects linked to this client
  const { data: projects = [] } = useQuery({
    queryKey: ['client-projects', clientName],
    queryFn: async () => {
      const { data } = await supabase.from('projects').select('id, name, status, project_mode')
        .eq('client_name', clientName)
        .neq('status', 'concluido')
        .neq('status', 'cancelado');
      return data || [];
    },
    enabled: !!clientName,
  });

  const projectIds = projects.map(p => p.id);

  // Deliverables from all client projects
  const { data: deliverables = [] } = useQuery({
    queryKey: ['client-deliverables', projectIds],
    queryFn: async () => {
      if (projectIds.length === 0) return [];
      const { data } = await supabase.from('project_deliverables').select('*')
        .in('project_id', projectIds)
        .neq('status', 'entregue')
        .order('deadline', { ascending: true, nullsFirst: false });
      return data || [];
    },
    enabled: projectIds.length > 0,
  });

  // Tasks from all client projects
  const { data: tasks = [] } = useQuery({
    queryKey: ['client-tasks', projectIds],
    queryFn: async () => {
      if (projectIds.length === 0) return [];
      const { data } = await supabase.from('tasks').select('*')
        .in('project_id', projectIds)
        .neq('status', 'done')
        .order('deadline', { ascending: true, nullsFirst: false });
      return data || [];
    },
    enabled: projectIds.length > 0,
  });

  // Profiles for avatars
  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles-for-client-tab'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, full_name, avatar_url');
      return data || [];
    },
  });

  const profileMap = new Map(profiles.map(p => [p.id, p]));
  const projectMap = new Map(projects.map(p => [p.id, p]));

  // Enrich deliverables with computed deadline
  const enrichedDeliverables = useMemo(() => {
    return deliverables.map(d => {
      if (d.is_recurring && d.recurrence_week != null && d.recurrence_weekday != null) {
        const nextDate = calcNextOccurrence(d.recurrence_week, d.recurrence_weekday);
        return { ...d, computed_deadline: format(nextDate, 'yyyy-MM-dd'), _nextDate: nextDate };
      }
      return { ...d, computed_deadline: d.deadline, _nextDate: d.deadline ? new Date(d.deadline) : null };
    }).sort((a, b) => {
      if (!a._nextDate) return 1;
      if (!b._nextDate) return -1;
      return a._nextDate.getTime() - b._nextDate.getTime();
    });
  }, [deliverables]);

  const nextDeliverable = enrichedDeliverables[0];

  // Stats
  const allDeliverables = deliverables.length;
  const overdue = enrichedDeliverables.filter(d => d.computed_deadline && !isDeliverableDone(d) && new Date(d.computed_deadline) < new Date()).length;
  const pendingTasks = tasks.length;

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Package className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{allDeliverables}</p>
              <p className="text-xs text-muted-foreground">Entregas pendentes</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-warning/15 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold">{pendingTasks}</p>
              <p className="text-xs text-muted-foreground">Tarefas em aberto</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${overdue > 0 ? 'bg-destructive/15' : 'bg-success/15'}`}>
              <AlertTriangle className={`h-5 w-5 ${overdue > 0 ? 'text-destructive' : 'text-success'}`} />
            </div>
            <div>
              <p className="text-2xl font-bold">{overdue}</p>
              <p className="text-xs text-muted-foreground">{overdue > 0 ? 'Em atraso' : 'Tudo em dia'}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Next delivery highlight */}
      {nextDeliverable && (
        <Card className="border-primary/20 bg-primary/[0.03]">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-primary" />
              <span className="text-xs font-semibold text-primary uppercase">Próxima Entrega</span>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold">{nextDeliverable.name}</p>
                <p className="text-sm text-muted-foreground">
                  Projeto: {projectMap.get(nextDeliverable.project_id)?.name || '—'}
                </p>
              </div>
              <div className="text-right">
                {nextDeliverable.computed_deadline && (
                  <p className="font-medium text-sm">
                    {format(new Date(nextDeliverable.computed_deadline), "d 'de' MMMM", { locale: pt })}
                  </p>
                )}
                {nextDeliverable.computed_deadline && (() => {
                  const days = Math.ceil((new Date(nextDeliverable.computed_deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                  if (days < 0) return <Badge className="bg-destructive/15 text-destructive border-0 text-xs">Atrasado {Math.abs(days)}d</Badge>;
                  if (days === 0) return <Badge className="bg-warning/15 text-warning border-0 text-xs">Hoje</Badge>;
                  return <Badge variant="outline" className="text-xs">em {days} dias</Badge>;
                })()}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Deliverables list */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Package className="h-4 w-4" /> Entregas ({enrichedDeliverables.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {enrichedDeliverables.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma entrega pendente</p>
          ) : (
            <div className="space-y-1">
              {enrichedDeliverables.map(d => {
                const si = STATUS_MAP[d.status] || STATUS_MAP.pendente;
                const proj = projectMap.get(d.project_id);
                const assignee = d.assigned_to ? profileMap.get(d.assigned_to) : null;
                const isOverdue = d.computed_deadline && new Date(d.computed_deadline) < new Date();

                return (
                  <div key={d.id} className="flex items-center gap-2 py-2 px-2 rounded-lg hover:bg-muted/40 transition-colors">
                    <Badge className={`${si.color} border-0 text-[10px] shrink-0`}>{si.label}</Badge>
                    <span className="flex-1 text-sm font-medium truncate">{d.name}</span>
                    {proj && (
                      <button
                        onClick={() => navigate(`/hub/projetos/${proj.id}`)}
                        className="text-[10px] text-muted-foreground hover:text-primary hover:underline shrink-0 flex items-center gap-0.5"
                      >
                        {proj.name} <ArrowRight className="h-3 w-3" />
                      </button>
                    )}
                    {d.computed_deadline && (
                      <span className={`text-[10px] shrink-0 ${isOverdue ? 'text-destructive font-semibold' : 'text-muted-foreground'}`}>
                        {format(new Date(d.computed_deadline), 'dd MMM', { locale: pt })}
                      </span>
                    )}
                    {assignee && (
                      <Avatar className="h-5 w-5 shrink-0">
                        <AvatarImage src={getPhotoUrl(assignee)} />
                        <AvatarFallback className="text-[7px]">{getInitials(assignee.full_name)}</AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tasks list */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" /> Tarefas em Aberto ({tasks.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma tarefa pendente</p>
          ) : (
            <div className="space-y-1">
              {tasks.map(t => {
                const si = TASK_STATUS_MAP[t.status] || TASK_STATUS_MAP.pendente;
                const proj = projectMap.get(t.project_id!);
                const assignee = t.assigned_to ? profileMap.get(t.assigned_to) : null;
                const isOverdue = t.deadline && new Date(t.deadline) < new Date();

                return (
                  <div key={t.id} className="flex items-center gap-2 py-2 px-2 rounded-lg hover:bg-muted/40 transition-colors">
                    <Badge className={`${si.color} border-0 text-[10px] shrink-0`}>{si.label}</Badge>
                    <span className="flex-1 text-sm font-medium truncate">{t.name}</span>
                    {proj && (
                      <button
                        onClick={() => navigate(`/hub/projetos/${proj.id}`)}
                        className="text-[10px] text-muted-foreground hover:text-primary hover:underline shrink-0 flex items-center gap-0.5"
                      >
                        {proj.name} <ArrowRight className="h-3 w-3" />
                      </button>
                    )}
                    {t.deadline && (
                      <span className={`text-[10px] shrink-0 ${isOverdue ? 'text-destructive font-semibold' : 'text-muted-foreground'}`}>
                        {format(new Date(t.deadline), 'dd MMM', { locale: pt })}
                      </span>
                    )}
                    {assignee && (
                      <Avatar className="h-5 w-5 shrink-0">
                        <AvatarImage src={getPhotoUrl(assignee)} />
                        <AvatarFallback className="text-[7px]">{getInitials(assignee.full_name)}</AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Projects overview */}
      {projects.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Projetos Ativos ({projects.length})</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-1">
              {projects.map(p => (
                <button
                  key={p.id}
                  onClick={() => navigate(`/hub/projetos/${p.id}`)}
                  className="flex items-center gap-3 w-full py-2 px-2 rounded-lg hover:bg-muted/40 transition-colors text-left"
                >
                  <span className="text-sm font-medium flex-1">{p.name}</span>
                  {(p as any).project_mode === 'recorrente' && (
                    <Badge variant="outline" className="text-[9px]">🔄 Recorrente</Badge>
                  )}
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
