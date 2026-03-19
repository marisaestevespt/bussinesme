import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { format, subDays, parseISO, startOfDay, endOfDay, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, isBefore } from 'date-fns';
import { pt } from 'date-fns/locale';
import {
  Calendar, Users, GitBranch, FolderKanban, CheckSquare, Key,
  MessageSquare, BookOpen, ArrowRight, Inbox, CalendarDays, Sun,
  Briefcase,
} from 'lucide-react';

// ─── Shortcuts to transversal pages ─────────────────────────────

const SHORTCUTS = [
  { label: 'Agenda', url: '/hub/agenda', icon: Calendar, color: 'bg-blue-100 text-blue-700' },
  { label: 'Reuniões', url: '/hub/reunioes', icon: Users, color: 'bg-violet-100 text-violet-700' },
  { label: 'Projetos', url: '/hub/projetos', icon: FolderKanban, color: 'bg-emerald-100 text-emerald-700' },
  { label: 'Processos', url: '/hub/processos', icon: GitBranch, color: 'bg-amber-100 text-amber-700' },
  { label: 'Tarefas', url: '/hub/tarefas', icon: CheckSquare, color: 'bg-pink-100 text-pink-700' },
  { label: 'Acessos', url: '/hub/acessos', icon: Key, color: 'bg-slate-100 text-slate-700' },
  { label: 'Mural', url: '/hub/mural', icon: MessageSquare, color: 'bg-red-100 text-red-700' },
  { label: 'Biblioteca', url: '/hub/biblioteca', icon: BookOpen, color: 'bg-teal-100 text-teal-700' },
];

// ─── Helpers ────────────────────────────────────────────────────

function getInitials(name: string | null) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

const TASK_STATUSES: Record<string, { label: string; color: string }> = {
  por_comecar: { label: 'Por começar', color: 'bg-muted text-muted-foreground' },
  a_fazer: { label: 'A fazer', color: 'bg-blue-100 text-blue-800' },
  aguarda_feedback: { label: 'Aguarda Feedback', color: 'bg-amber-100 text-amber-800' },
  para_aprovacao: { label: 'Para Aprovação', color: 'bg-purple-100 text-purple-800' },
  precisa_alteracoes: { label: 'Alterações', color: 'bg-orange-100 text-orange-800' },
  done: { label: 'Done', color: 'bg-emerald-100 text-emerald-800' },
};

const PROJECT_STATUSES: Record<string, { label: string; dot: string }> = {
  em_ideia: { label: 'Em ideia', dot: 'bg-gray-400' },
  em_curso: { label: 'Em curso', dot: 'bg-blue-500' },
  em_pausa: { label: 'Em pausa', dot: 'bg-yellow-500' },
  em_revisao: { label: 'Em revisão', dot: 'bg-purple-500' },
  concluido: { label: 'Concluído', dot: 'bg-green-500' },
  cancelado: { label: 'Cancelado', dot: 'bg-red-500' },
  arquivo: { label: 'Arquivo', dot: 'bg-slate-400' },
};

// ─── Data hooks ─────────────────────────────────────────────────

function useMuralRecent() {
  const thirtyDaysAgo = subDays(new Date(), 30).toISOString();
  return useQuery({
    queryKey: ['hub-equipa-mural'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mural_posts')
        .select('id, title, body, category, author_id, created_at')
        .gte('created_at', thirtyDaysAgo)
        .order('created_at', { ascending: false })
        .limit(5);
      if (error) throw error;
      return data || [];
    },
  });
}

function useTasks() {
  return useQuery({
    queryKey: ['hub-equipa-tasks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('id, name, status, priority, deadline, assigned_to, department')
        .neq('status', 'done')
        .order('deadline', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });
}

function useActiveProjects() {
  return useQuery({
    queryKey: ['hub-equipa-projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name, status, department, deadline, progress, client_name')
        .in('status', ['em_curso', 'em_revisao'])
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

function useProfiles() {
  return useQuery({
    queryKey: ['profiles'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, user_id, full_name, avatar_url');
      return (data || []) as { id: string; user_id: string; full_name: string | null; avatar_url: string | null }[];
    },
  });
}

// ─── Sub-components ─────────────────────────────────────────────

function MuralCard({ posts, profiles }: { posts: any[]; profiles: any[] }) {
  const profileMap = new Map(profiles.map(p => [p.user_id, p]));

  const CATEGORIES: Record<string, { label: string; color: string }> = {
    anuncio: { label: 'Anúncio', color: 'bg-red-100 text-red-800' },
    novidade: { label: 'Novidade', color: 'bg-green-100 text-green-800' },
    atualizacao: { label: 'Atualização', color: 'bg-blue-100 text-blue-800' },
    lembrete: { label: 'Lembrete', color: 'bg-yellow-100 text-yellow-800' },
    outro: { label: 'Outro', color: 'bg-gray-100 text-gray-800' },
  };

  if (posts.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground text-sm">
          Sem novidades nos últimos 30 dias
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <MessageSquare className="h-4 w-4" /> Novidades (últimos 30 dias)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {posts.map(post => {
          const author = profileMap.get(post.author_id);
          const cat = CATEGORIES[post.category] || CATEGORIES.outro;
          return (
            <div key={post.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-border/50">
              <Avatar className="h-8 w-8 shrink-0 mt-0.5">
                <AvatarImage src={author?.avatar_url || ''} />
                <AvatarFallback className="text-[10px]">{getInitials(author?.full_name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-medium truncate">{post.title}</span>
                  <Badge className={`${cat.color} border-none text-[10px] px-1.5 py-0`}>{cat.label}</Badge>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-1">{post.body?.replace(/<[^>]*>/g, '') || ''}</p>
                <span className="text-[10px] text-muted-foreground/70 mt-1 block">
                  {format(parseISO(post.created_at), "d MMM yyyy", { locale: pt })}
                </span>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function InboxSection({ tasks, profiles }: { tasks: any[]; profiles: any[] }) {
  // Tasks without assigned_to = inbox (unaligned)
  const inbox = tasks.filter(t => !t.assigned_to).slice(0, 8);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Inbox className="h-4 w-4" /> Caixa de Entrada
        {inbox.length > 0 && <Badge variant="secondary" className="text-[10px] px-1.5">{inbox.length}</Badge>}
      </div>
      {inbox.length === 0 ? (
        <p className="text-xs text-muted-foreground/70 pl-6">Sem tarefas por alinhar</p>
      ) : (
        <div className="space-y-1">
          {inbox.map(t => {
            const st = TASK_STATUSES[t.status] || TASK_STATUSES.por_comecar;
            return (
              <div key={t.id} className="flex items-center gap-2 p-2 rounded-md bg-muted/20 border border-border/40 text-sm">
                <span className="truncate flex-1">{t.name}</span>
                <Badge className={`${st.color} border-none text-[10px] px-1.5 py-0 shrink-0`}>{st.label}</Badge>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TodaySection({ tasks, profiles }: { tasks: any[]; profiles: any[] }) {
  const today = format(new Date(), 'yyyy-MM-dd');
  const todayTasks = tasks.filter(t => t.deadline === today);
  const profileMap = new Map(profiles.map(p => [p.id, p]));

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Sun className="h-4 w-4" /> Para Hoje
        {todayTasks.length > 0 && <Badge variant="secondary" className="text-[10px] px-1.5">{todayTasks.length}</Badge>}
      </div>
      {todayTasks.length === 0 ? (
        <p className="text-xs text-muted-foreground/70 pl-6">Sem tarefas para hoje</p>
      ) : (
        <div className="space-y-1">
          {todayTasks.map(t => {
            const assignee = profileMap.get(t.assigned_to);
            const st = TASK_STATUSES[t.status] || TASK_STATUSES.por_comecar;
            return (
              <div key={t.id} className="flex items-center gap-2 p-2 rounded-md bg-muted/20 border border-border/40 text-sm">
                {assignee && (
                  <Avatar className="h-5 w-5 shrink-0">
                    <AvatarImage src={assignee.avatar_url || ''} />
                    <AvatarFallback className="text-[8px]">{getInitials(assignee.full_name)}</AvatarFallback>
                  </Avatar>
                )}
                <span className="truncate flex-1">{t.name}</span>
                <Badge className={`${st.color} border-none text-[10px] px-1.5 py-0 shrink-0`}>{st.label}</Badge>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function WeekCalendar({ tasks, profiles }: { tasks: any[]; profiles: any[] }) {
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });
  const profileMap = new Map(profiles.map(p => [p.id, p]));
  const today = startOfDay(now);

  const tasksByDay = useMemo(() => {
    const map: Record<string, any[]> = {};
    days.forEach(d => {
      const key = format(d, 'yyyy-MM-dd');
      map[key] = tasks.filter(t => t.deadline === key);
    });
    return map;
  }, [tasks, days]);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <CalendarDays className="h-4 w-4" /> Esta Semana
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map(day => {
          const key = format(day, 'yyyy-MM-dd');
          const dayTasks = tasksByDay[key] || [];
          const isToday = isSameDay(day, now);
          const isPast = isBefore(day, today) && !isToday;

          return (
            <div
              key={key}
              className={`rounded-lg border p-2 min-h-[80px] ${isToday ? 'border-primary bg-primary/5' : isPast ? 'bg-muted/30 border-border/30' : 'border-border/50'}`}
            >
              <div className={`text-[10px] font-medium mb-1 ${isToday ? 'text-primary' : 'text-muted-foreground'}`}>
                {format(day, 'EEE d', { locale: pt })}
              </div>
              {dayTasks.slice(0, 3).map(t => {
                const assignee = profileMap.get(t.assigned_to);
                return (
                  <div key={t.id} className="text-[10px] truncate py-0.5 px-1 rounded bg-muted/50 mb-0.5" title={t.name}>
                    {t.name}
                  </div>
                );
              })}
              {dayTasks.length > 3 && (
                <span className="text-[9px] text-muted-foreground">+{dayTasks.length - 3}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ProjectsList({ projects, navigate }: { projects: any[]; navigate: (path: string) => void }) {
  if (projects.length === 0) {
    return <p className="text-sm text-muted-foreground">Sem projetos ativos de momento.</p>;
  }

  return (
    <div className="space-y-2">
      {projects.slice(0, 6).map(p => {
        const st = PROJECT_STATUSES[p.status] || PROJECT_STATUSES.em_curso;
        return (
          <button
            key={p.id}
            onClick={() => navigate(`/hub/projetos/${p.id}`)}
            className="w-full flex items-center gap-3 p-3 rounded-lg bg-muted/20 border border-border/40 hover:bg-muted/50 transition-colors text-left"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium truncate">{p.name}</span>
                <Badge variant="outline" className="text-[10px] gap-1 px-1.5 py-0 shrink-0">
                  <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
                  {st.label}
                </Badge>
              </div>
              {p.client_name && <span className="text-[11px] text-muted-foreground">{p.client_name}</span>}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {p.deadline && (
                <span className="text-[10px] text-muted-foreground">
                  {format(parseISO(p.deadline), 'd MMM', { locale: pt })}
                </span>
              )}
              <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${p.progress}%` }} />
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────

export default function HubEquipaPage() {
  const [taskView, setTaskView] = useState<'inbox' | 'today' | 'week'>('inbox');
  const navigate = useNavigate();
  const { settings } = useBusinessSettings();
  const { user } = useAuth();
  const { data: muralPosts = [] } = useMuralRecent();
  const { data: tasks = [] } = useTasks();
  const { data: projects = [] } = useActiveProjects();
  const { data: profiles = [] } = useProfiles();

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* ─── Hero: Business image + shortcuts ─── */}
        <div className="flex flex-col sm:flex-row gap-6 items-start">
          {/* Business image */}
          <div className="shrink-0 w-full sm:w-56 h-32 sm:h-40 rounded-xl overflow-hidden bg-gradient-to-br from-primary/10 to-primary/5 border border-border flex items-center justify-center">
            {settings?.logo_url ? (
              <img
                src={settings.logo_url}
                alt={settings.business_name}
                className="h-full w-full object-contain p-4"
              />
            ) : (
              <div className="text-center p-4">
                <Briefcase className="h-10 w-10 mx-auto text-primary/40 mb-2" />
                <span className="text-sm font-medium text-muted-foreground" style={{ fontFamily: 'var(--font-display)' }}>
                  {settings?.business_name || 'O teu Negócio'}
                </span>
              </div>
            )}
          </div>

          {/* Shortcuts + Go to desk */}
          <div className="flex-1 space-y-4">
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-bold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
                Hub de Equipa
              </h1>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => navigate('/secretaria')}
              >
                Ir para a minha secretária <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>

            <div className="grid grid-cols-4 sm:grid-cols-4 md:grid-cols-8 gap-2">
              {SHORTCUTS.map(s => (
                <button
                  key={s.url}
                  onClick={() => navigate(s.url)}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors group"
                >
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${s.color} transition-transform group-hover:scale-110`}>
                    <s.icon className="h-4 w-4" />
                  </div>
                  <span className="text-[10px] font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                    {s.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ─── Mural recent ─── */}
        <MuralCard posts={muralPosts} profiles={profiles} />

        {/* ─── O que está a acontecer ─── */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
              O que está a acontecer
            </h2>
            <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
              {([
                { key: 'tarefas', label: 'Tarefas', icon: CheckSquare },
                { key: 'projetos', label: 'Projetos', icon: FolderKanban },
                { key: 'conteudos', label: 'Conteúdos', icon: MessageSquare },
              ] as const).map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveSection(tab.key)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    activeSection === tab.key
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <tab.icon className="h-3.5 w-3.5" />
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Tarefas ── */}
          {activeSection === 'tarefas' && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <CheckSquare className="h-4 w-4" /> Tarefas
                  </CardTitle>
                  <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => navigate('/hub/tarefas')}>
                    Ver todas <ArrowRight className="h-3 w-3" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                <InboxSection tasks={tasks} profiles={profiles} />
                <TodaySection tasks={tasks} profiles={profiles} />
                <WeekCalendar tasks={tasks} profiles={profiles} />
              </CardContent>
            </Card>
          )}

          {/* ── Projetos ── */}
          {activeSection === 'projetos' && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FolderKanban className="h-4 w-4" /> Projetos
                  </CardTitle>
                  <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => navigate('/hub/projetos')}>
                    Ver todos <ArrowRight className="h-3 w-3" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <ProjectsList projects={projects} navigate={navigate} />
              </CardContent>
            </Card>
          )}

          {/* ── Conteúdos (placeholder) ── */}
          {activeSection === 'conteudos' && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" /> Conteúdos
                </CardTitle>
              </CardHeader>
              <CardContent className="py-8 text-center">
                <p className="text-sm text-muted-foreground">
                  Em breve: gestão de conteúdos do negócio.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
