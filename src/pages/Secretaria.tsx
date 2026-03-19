import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  CheckSquare, AlertTriangle, Users, FolderKanban, Play, Square, Clock,
  Plus, CalendarIcon, Link2, ImageIcon, FileText, ExternalLink, Trash2,
  BarChart3, ListTodo, ChevronRight,
} from 'lucide-react';
import { format, parseISO, isToday, isBefore, startOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval, differenceInSeconds, eachDayOfInterval, addDays } from 'date-fns';
import { pt } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { RichTextEditor } from '@/components/RichTextEditor';

// ─── Helpers ──────────────────────────────────────────────────

const today = startOfDay(new Date());
const weekStart = startOfWeek(today, { weekStartsOn: 1 });
const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
const monthStart = startOfMonth(today);
const monthEnd = endOfMonth(today);

function greetingText() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 19) return 'Boa tarde';
  return 'Boa noite';
}

function formatTimer(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
}

const STATUS_COLORS: Record<string, string> = {
  por_comecar: 'bg-muted text-muted-foreground',
  a_fazer: 'bg-blue-100 text-blue-800',
  aguarda_feedback: 'bg-amber-100 text-amber-800',
  para_aprovacao: 'bg-purple-100 text-purple-800',
  precisa_alteracoes: 'bg-orange-100 text-orange-800',
  done: 'bg-emerald-100 text-emerald-800',
};

const STATUS_LABELS: Record<string, string> = {
  por_comecar: 'Por começar',
  a_fazer: 'A fazer',
  aguarda_feedback: 'Aguarda Feedback',
  para_aprovacao: 'Para Aprovação',
  precisa_alteracoes: 'Precisa de Alterações',
  done: 'Done',
};

const PRIORITY_LABELS: Record<string, string> = {
  alta: 'P1', media: 'P2', baixa: 'P3',
};

const TIME_CATEGORIES = [
  { value: 'cliente', label: 'Cliente' },
  { value: 'interno', label: 'Interno' },
  { value: 'reuniao', label: 'Reunião' },
  { value: 'conteudos', label: 'Conteúdos' },
  { value: 'formacao', label: 'Formação' },
  { value: 'outro', label: 'Outro' },
];

// ─── Hooks ──────────────────────────────────────────────────

function useMyProfile() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['my-profile', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('*').eq('user_id', user!.id).single();
      return data;
    },
  });
}

function useMyTeamMember() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['my-team-member', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase.from('team_members').select('*').eq('profile_id', user!.id).maybeSingle();
      return data;
    },
  });
}

function useMyTasks() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['my-tasks', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase.from('tasks').select('*').eq('assigned_to', user!.id).order('deadline');
      return data || [];
    },
  });
}

function useMyProjects() {
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

function useMyMeetings() {
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

function useMyTimeEntries() {
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

function useProjects() {
  return useQuery({
    queryKey: ['projects-list'],
    queryFn: async () => {
      const { data } = await supabase.from('projects').select('id, name');
      return data || [];
    },
  });
}

function useProfiles() {
  return useQuery({
    queryKey: ['profiles'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, full_name, avatar_url');
      return data || [];
    },
  });
}

// ─── Main Page ──────────────────────────────────────────────

export default function SecretariaPage() {
  const { user } = useAuth();
  const profile = useMyProfile();
  const teamMember = useMyTeamMember();
  const tasks = useMyTasks();
  const projects = useMyProjects();
  const meetings = useMyMeetings();
  const timeEntries = useMyTimeEntries();
  const allProjects = useProjects();
  const allProfiles = useProfiles();
  const qc = useQueryClient();

  const firstName = profile.data?.full_name?.split(' ')[0] || 'Utilizador';

  // Task counts
  const todayTasks = useMemo(() => (tasks.data || []).filter(t => t.deadline && isToday(parseISO(t.deadline)) && t.status !== 'done'), [tasks.data]);
  const overdueTasks = useMemo(() => (tasks.data || []).filter(t => t.status !== 'done' && t.deadline && isBefore(parseISO(t.deadline), today)), [tasks.data]);
  const todayMeetings = useMemo(() => (meetings.data || []).filter(m => isToday(parseISO(m.date_time))), [meetings.data]);
  const activeProjects = useMemo(() => (projects.data || []).filter(p => p.status === 'em_curso'), [projects.data]);

  const getProjectName = (id: string | null) => allProjects.data?.find(p => p.id === id)?.name || '';

  const [activeTab, setActiveTab] = useState<string | null>(null);

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        {/* Dashboard greeting */}
        <div>
          <h2 className="text-2xl font-bold text-foreground">{greetingText()}, {firstName}.</h2>
          <p className="text-sm text-muted-foreground">{format(new Date(), "EEEE, d 'de' MMMM 'de' yyyy", { locale: pt })}</p>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Tarefas para hoje</p><p className="text-2xl font-bold">{todayTasks.length}</p></CardContent></Card>
          <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Tarefas em atraso</p><p className="text-2xl font-bold text-destructive">{overdueTasks.length}</p></CardContent></Card>
          <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Reuniões hoje</p><p className="text-2xl font-bold">{todayMeetings.length}</p></CardContent></Card>
          <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Projetos ativos</p><p className="text-2xl font-bold">{activeProjects.length}</p></CardContent></Card>
        </div>

        {/* Navigation cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {[
            { value: 'dia', label: 'O Meu Dia', icon: CalendarIcon, iconColor: 'text-blue-600', color: 'from-blue-500/10 to-blue-600/5 hover:from-blue-500/20 hover:to-blue-600/10' },
            { value: 'semana', label: 'A Minha Semana', icon: CalendarIcon, iconColor: 'text-indigo-600', color: 'from-indigo-500/10 to-indigo-600/5 hover:from-indigo-500/20 hover:to-indigo-600/10' },
            { value: 'tarefas', label: 'As Minhas Tarefas', icon: CheckSquare, iconColor: 'text-emerald-600', color: 'from-emerald-500/10 to-emerald-600/5 hover:from-emerald-500/20 hover:to-emerald-600/10' },
            { value: 'projetos', label: 'Os Meus Projetos', icon: FolderKanban, iconColor: 'text-violet-600', color: 'from-violet-500/10 to-violet-600/5 hover:from-violet-500/20 hover:to-violet-600/10' },
            { value: 'reunioes', label: 'As Minhas Reuniões', icon: Users, iconColor: 'text-rose-600', color: 'from-rose-500/10 to-rose-600/5 hover:from-rose-500/20 hover:to-rose-600/10' },
            { value: 'produtividade', label: 'Produtividade', icon: BarChart3, iconColor: 'text-amber-600', color: 'from-amber-500/10 to-amber-600/5 hover:from-amber-500/20 hover:to-amber-600/10' },
            { value: 'contrato', label: 'Contrato & Pagamentos', icon: FileText, iconColor: 'text-cyan-600', color: 'from-cyan-500/10 to-cyan-600/5 hover:from-cyan-500/20 hover:to-cyan-600/10' },
            { value: 'espaco', label: 'O Meu Espaço', icon: ImageIcon, iconColor: 'text-orange-600', color: 'from-orange-500/10 to-orange-600/5 hover:from-orange-500/20 hover:to-orange-600/10' },
          ].map(s => (
            <Card
              key={s.value}
              className={cn(
                'group cursor-pointer border bg-gradient-to-br transition-all duration-200 hover:shadow-md hover:-translate-y-0.5',
                s.color,
                activeTab === s.value && 'ring-2 ring-primary/50 shadow-md'
              )}
              onClick={() => setActiveTab(activeTab === s.value ? null : s.value)}
            >
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`h-9 w-9 rounded-lg bg-background/80 flex items-center justify-center shadow-sm shrink-0 ${s.iconColor}`}>
                  <s.icon className="h-4.5 w-4.5" />
                </div>
                <span className="font-medium text-sm text-foreground">{s.label}</span>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === 'dia' && (
          <MeuDiaTab
            todayTasks={todayTasks}
            todayMeetings={todayMeetings}
            timeEntries={timeEntries.data || []}
            getProjectName={getProjectName}
            qc={qc}
          />
        )}

        {activeTab === 'semana' && (
          <MinhaSemanaTab
            allTasks={tasks.data || []}
            allMeetings={meetings.data || []}
            timeEntries={timeEntries.data || []}
            getProjectName={getProjectName}
            qc={qc}
          />
        )}

        {activeTab === 'tarefas' && (
          <MinhasTarefasTab tasks={tasks.data || []} getProjectName={getProjectName} qc={qc} userId={user?.id} />
        )}

        {activeTab === 'projetos' && (
          <MeusProjetosTab projects={projects.data || []} />
        )}

        {activeTab === 'reunioes' && (
          <MinhasReunioesTab meetings={meetings.data || []} profiles={allProfiles.data || []} />
        )}

        {activeTab === 'produtividade' && (
          <MinhaProdutividadeTab
            tasks={tasks.data || []}
            timeEntries={timeEntries.data || []}
            teamMember={teamMember.data}
            allProjects={allProjects.data || []}
            qc={qc}
            userId={user?.id}
          />
        )}

        {activeTab === 'contrato' && (
          <MeuContratoTab teamMember={teamMember.data} />
        )}

        {activeTab === 'espaco' && (
          <MeuEspacoTab userId={user?.id} teamMember={teamMember.data} />
        )}
      </div>
    </AppLayout>
  );
}


// ═══════════════════════════════════════════════════════════════
// O MEU DIA — Simple: today's tasks, meetings, time worked
// ═══════════════════════════════════════════════════════════════

function MeuDiaTab({ todayTasks, todayMeetings, timeEntries, getProjectName, qc }: any) {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const todayTime = useMemo(() => (timeEntries || []).filter((e: any) => e.entry_date === todayStr), [timeEntries, todayStr]);
  const todayHours = useMemo(() => todayTime.reduce((sum: number, e: any) => sum + (e.duration || 0), 0), [todayTime]);

  const markDone = async (taskId: string) => {
    await supabase.from('tasks').update({ status: 'done', updated_at: new Date().toISOString() }).eq('id', taskId);
    qc.invalidateQueries({ queryKey: ['my-tasks'] });
    toast.success('Tarefa concluída');
  };

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Tarefas hoje</p><p className="text-2xl font-bold">{todayTasks.length}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Reuniões hoje</p><p className="text-2xl font-bold">{todayMeetings.length}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Tempo registado</p><p className="text-2xl font-bold">{todayHours.toFixed(1)}h</p></CardContent></Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Today tasks */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Tarefas de Hoje</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {todayTasks.length === 0 && <p className="text-sm text-muted-foreground">Sem tarefas para hoje.</p>}
            {todayTasks.map((t: any) => (
              <div key={t.id} className="flex items-center gap-3 p-2 rounded-lg border">
                <Checkbox checked={false} onCheckedChange={() => markDone(t.id)} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{t.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant="outline" className="text-[10px]">{PRIORITY_LABELS[t.priority] || t.priority}</Badge>
                    {t.project_id && <span className="text-[10px] text-muted-foreground truncate">{getProjectName(t.project_id)}</span>}
                  </div>
                </div>
                <Badge className={cn('text-[10px]', STATUS_COLORS[t.status])}>{STATUS_LABELS[t.status] || t.status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Today meetings */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Reuniões de Hoje</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {todayMeetings.length === 0 && <p className="text-sm text-muted-foreground">Sem reuniões hoje.</p>}
            {todayMeetings.map((m: any) => (
              <div key={m.id} className="flex items-center justify-between p-2 rounded-lg border">
                <div>
                  <p className="text-sm font-medium">{m.title}</p>
                  <p className="text-xs text-muted-foreground">{format(parseISO(m.date_time), 'HH:mm')}</p>
                </div>
                {m.transcript_url && (
                  <Button variant="ghost" size="sm" asChild><a href={m.transcript_url} target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5" /></a></Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Today time entries */}
      {todayTime.length > 0 && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Tempo Registado Hoje</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {todayTime.map((e: any) => (
              <div key={e.id} className="flex items-center justify-between p-2 rounded-lg border">
                <div className="flex-1 min-w-0">
                  <p className="text-sm">{e.description || 'Sem descrição'}</p>
                  {e.category && <Badge variant="outline" className="text-[10px] mt-0.5">{e.category}</Badge>}
                </div>
                <span className="text-sm font-medium">{(e.duration || 0).toFixed(1)}h</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// A MINHA SEMANA — Week tasks, meetings, time, calendar
// ═══════════════════════════════════════════════════════════════

function MinhaSemanaTab({ allTasks, allMeetings, timeEntries, getProjectName, qc }: any) {
  const weekTasks = useMemo(() => allTasks.filter((t: any) => t.deadline && isWithinInterval(parseISO(t.deadline), { start: weekStart, end: weekEnd })), [allTasks]);
  const weekMeetings = useMemo(() => allMeetings.filter((m: any) => isWithinInterval(parseISO(m.date_time), { start: weekStart, end: weekEnd })), [allMeetings]);
  const weekTime = useMemo(() => (timeEntries || []).filter((e: any) => {
    if (!e.entry_date) return false;
    const d = parseISO(e.entry_date);
    return isWithinInterval(d, { start: weekStart, end: weekEnd });
  }), [timeEntries]);
  const weekHours = useMemo(() => weekTime.reduce((sum: number, e: any) => sum + (e.duration || 0), 0), [weekTime]);

  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const markDone = async (taskId: string) => {
    await supabase.from('tasks').update({ status: 'done', updated_at: new Date().toISOString() }).eq('id', taskId);
    qc.invalidateQueries({ queryKey: ['my-tasks'] });
    toast.success('Tarefa concluída');
  };

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Tarefas esta semana</p><p className="text-2xl font-bold">{weekTasks.length}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Reuniões esta semana</p><p className="text-2xl font-bold">{weekMeetings.length}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Horas registadas</p><p className="text-2xl font-bold">{weekHours.toFixed(1)}h</p></CardContent></Card>
      </div>

      {/* Week calendar */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Calendário Semanal</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-2">
            {weekDays.map(day => {
              const dayKey = format(day, 'yyyy-MM-dd');
              const dayTasks = weekTasks.filter((t: any) => t.deadline === dayKey);
              const dayMeetings = weekMeetings.filter((m: any) => format(parseISO(m.date_time), 'yyyy-MM-dd') === dayKey);
              return (
                <div key={dayKey} className={cn('rounded-lg border p-2 min-h-[80px]', isToday(day) && 'border-primary bg-primary/5')}>
                  <p className="text-xs font-medium mb-1">{format(day, 'EEE d', { locale: pt })}</p>
                  {dayTasks.map((t: any) => <p key={t.id} className="text-[10px] truncate text-foreground">📋 {t.name}</p>)}
                  {dayMeetings.map((m: any) => <p key={m.id} className="text-[10px] truncate text-primary">📅 {format(parseISO(m.date_time), 'HH:mm')} {m.title}</p>)}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Week tasks list */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Tarefas da Semana</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {weekTasks.length === 0 && <p className="text-sm text-muted-foreground">Sem tarefas esta semana.</p>}
            {weekTasks.map((t: any) => (
              <div key={t.id} className="flex items-center gap-3 p-2 rounded-lg border">
                <Checkbox checked={t.status === 'done'} onCheckedChange={() => t.status !== 'done' && markDone(t.id)} />
                <div className="flex-1 min-w-0">
                  <p className={cn('text-sm font-medium truncate', t.status === 'done' && 'line-through text-muted-foreground')}>{t.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {t.deadline && <span className="text-[10px] text-muted-foreground">{format(parseISO(t.deadline), 'EEE d', { locale: pt })}</span>}
                    {t.project_id && <span className="text-[10px] text-muted-foreground">· {getProjectName(t.project_id)}</span>}
                  </div>
                </div>
                <Badge className={cn('text-[10px]', STATUS_COLORS[t.status])}>{STATUS_LABELS[t.status] || t.status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Reuniões da Semana</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {weekMeetings.length === 0 && <p className="text-sm text-muted-foreground">Sem reuniões esta semana.</p>}
            {weekMeetings.map((m: any) => (
              <div key={m.id} className="flex items-center justify-between p-2 rounded-lg border">
                <div>
                  <p className="text-sm font-medium">{m.title}</p>
                  <p className="text-xs text-muted-foreground">{format(parseISO(m.date_time), "EEE d, HH:mm", { locale: pt })}</p>
                </div>
                {m.transcript_url && (
                  <Button variant="ghost" size="sm" asChild><a href={m.transcript_url} target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5" /></a></Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB 2 — AS MINHAS TAREFAS
// ═══════════════════════════════════════════════════════════════

function MinhasTarefasTab({ tasks, getProjectName, qc, userId }: any) {
  const [view, setView] = useState<'todo' | 'atrasadas' | 'concluidas'>('todo');

  const filtered = useMemo(() => {
    switch (view) {
      case 'todo': return tasks.filter((t: any) => t.status !== 'done').sort((a: any, b: any) => {
        const pa = a.priority === 'alta' ? 0 : a.priority === 'media' ? 1 : 2;
        const pb = b.priority === 'alta' ? 0 : b.priority === 'media' ? 1 : 2;
        return pa - pb || ((a.deadline || '') > (b.deadline || '') ? 1 : -1);
      });
      case 'atrasadas': return tasks.filter((t: any) => t.status !== 'done' && t.deadline && isBefore(parseISO(t.deadline), today));
      case 'concluidas': return tasks.filter((t: any) => t.status === 'done').sort((a: any, b: any) => (b.updated_at || '').localeCompare(a.updated_at || ''));
      default: return tasks;
    }
  }, [tasks, view]);

  const markDone = async (id: string) => {
    await supabase.from('tasks').update({ status: 'done', updated_at: new Date().toISOString() }).eq('id', id);
    qc.invalidateQueries({ queryKey: ['my-tasks'] });
    toast.success('Tarefa concluída');
  };

  const overdueCount = tasks.filter((t: any) => t.status !== 'done' && t.deadline && isBefore(parseISO(t.deadline), today)).length;

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Button variant={view === 'todo' ? 'default' : 'outline'} size="sm" onClick={() => setView('todo')}>To Do</Button>
          <Button variant={view === 'atrasadas' ? 'default' : 'outline'} size="sm" onClick={() => setView('atrasadas')}>
            Atrasadas {overdueCount > 0 && <Badge variant="destructive" className="ml-1 text-[10px]">{overdueCount}</Badge>}
          </Button>
          <Button variant={view === 'concluidas' ? 'default' : 'outline'} size="sm" onClick={() => setView('concluidas')}>Concluídas</Button>
        </div>
        <Button size="sm" onClick={() => window.open('/hub/tarefas', '_self')}><Plus className="h-4 w-4 mr-1" /> Nova Tarefa</Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            {view !== 'concluidas' && <TableHead className="w-10" />}
            <TableHead>Tarefa</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Prioridade</TableHead>
            <TableHead>Data Limite</TableHead>
            <TableHead>Projeto</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Sem tarefas.</TableCell></TableRow>}
          {filtered.map((t: any) => (
            <TableRow key={t.id}>
              {view !== 'concluidas' && (
                <TableCell><Checkbox checked={false} onCheckedChange={() => markDone(t.id)} /></TableCell>
              )}
              <TableCell className="font-medium">{t.name}</TableCell>
              <TableCell><Badge className={cn('text-[10px]', STATUS_COLORS[t.status])}>{STATUS_LABELS[t.status] || t.status}</Badge></TableCell>
              <TableCell><Badge variant="outline" className="text-[10px]">{PRIORITY_LABELS[t.priority] || t.priority}</Badge></TableCell>
              <TableCell className="text-sm">{t.deadline ? format(parseISO(t.deadline), 'dd/MM/yyyy') : '—'}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{getProjectName(t.project_id)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB 3 — OS MEUS PROJETOS
// ═══════════════════════════════════════════════════════════════

const PROJ_STATUS_MAP: Record<string, { label: string; color: string }> = {
  em_ideia: { label: 'Em ideia', color: 'bg-gray-100 text-gray-700' },
  em_curso: { label: 'Em curso', color: 'bg-blue-100 text-blue-800' },
  em_pausa: { label: 'Em pausa', color: 'bg-yellow-100 text-yellow-800' },
  em_revisao: { label: 'Em revisão', color: 'bg-purple-100 text-purple-800' },
  concluido: { label: 'Concluído', color: 'bg-green-100 text-green-800' },
  cancelado: { label: 'Cancelado', color: 'bg-red-100 text-red-800' },
  arquivo: { label: 'Arquivo', color: 'bg-slate-100 text-slate-600' },
};

function MeusProjetosTab({ projects }: { projects: any[] }) {
  const [view, setView] = useState<'ativos' | 'todos'>('ativos');
  const filtered = view === 'ativos' ? projects.filter(p => p.status === 'em_curso') : projects;

  return (
    <div className="space-y-4 mt-4">
      <div className="flex gap-2">
        <Button variant={view === 'ativos' ? 'default' : 'outline'} size="sm" onClick={() => setView('ativos')}>Ativos</Button>
        <Button variant={view === 'todos' ? 'default' : 'outline'} size="sm" onClick={() => setView('todos')}>Todos</Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Projeto</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Progresso</TableHead>
            <TableHead>Data de entrega</TableHead>
            <TableHead>Departamento</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Sem projetos.</TableCell></TableRow>}
          {filtered.map((p: any) => {
            const si = PROJ_STATUS_MAP[p.status] || { label: p.status, color: '' };
            return (
              <TableRow key={p.id} className="cursor-pointer hover:bg-muted/50" onClick={() => window.open(`/hub/projetos/${p.id}`, '_self')}>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell><Badge variant="outline" className="text-[10px]">{p.type === 'clientes' ? 'Cliente' : 'Interno'}</Badge></TableCell>
                <TableCell><Badge className={cn('text-[10px]', si.color)}>{si.label}</Badge></TableCell>
                <TableCell><div className="flex items-center gap-2"><Progress value={p.progress || 0} className="h-1.5 w-16" /><span className="text-xs">{p.progress || 0}%</span></div></TableCell>
                <TableCell className="text-sm">{p.deadline ? format(parseISO(p.deadline), 'dd/MM/yyyy') : '—'}</TableCell>
                <TableCell className="text-sm text-muted-foreground capitalize">{p.department || '—'}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB 4 — AS MINHAS REUNIÕES
// ═══════════════════════════════════════════════════════════════

function MinhasReunioesTab({ meetings, profiles }: { meetings: any[]; profiles: any[] }) {
  const [view, setView] = useState<'proximas' | 'todas'>('proximas');
  const now = new Date();
  const filtered = view === 'proximas' ? meetings.filter(m => parseISO(m.date_time) >= startOfDay(now)) : meetings;

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Button variant={view === 'proximas' ? 'default' : 'outline'} size="sm" onClick={() => setView('proximas')}>Próximas</Button>
          <Button variant={view === 'todas' ? 'default' : 'outline'} size="sm" onClick={() => setView('todas')}>Todas</Button>
        </div>
        <Button size="sm" onClick={() => window.open('/hub/reunioes', '_self')}><Plus className="h-4 w-4 mr-1" /> Nova Reunião</Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Status</TableHead>
            <TableHead>Data & Hora</TableHead>
            <TableHead>Reunião</TableHead>
            <TableHead>Link</TableHead>
            <TableHead>Projeto</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Sem reuniões.</TableCell></TableRow>}
          {filtered.map((m: any) => (
            <TableRow key={m.id} className="cursor-pointer hover:bg-muted/50" onClick={() => window.open(`/hub/reunioes/${m.id}`, '_self')}>
              <TableCell><Badge variant="outline" className="text-[10px] capitalize">{m.status?.replace('_', ' ')}</Badge></TableCell>
              <TableCell className="text-sm">{format(parseISO(m.date_time), "dd/MM/yyyy 'às' HH:mm")}</TableCell>
              <TableCell className="font-medium">{m.title}</TableCell>
              <TableCell>
                {m.transcript_url && <Button variant="ghost" size="sm" asChild><a href={m.transcript_url} target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5" /></a></Button>}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">{m.project_name || '—'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB 5 — A MINHA PRODUTIVIDADE
// ═══════════════════════════════════════════════════════════════

function MinhaProdutividadeTab({ tasks, timeEntries, teamMember, allProjects, qc, userId }: any) {
  const [period, setPeriod] = useState<'week' | 'month'>('week');

  // Timer state
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerStart, setTimerStart] = useState<Date | null>(null);
  const [timerElapsed, setTimerElapsed] = useState(0);
  const [timerDesc, setTimerDesc] = useState('');
  const [timerProject, setTimerProject] = useState('');
  const [timerTask, setTimerTask] = useState('');
  const [timerCategory, setTimerCategory] = useState('interno');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (timerRunning && timerStart) {
      intervalRef.current = setInterval(() => {
        setTimerElapsed(differenceInSeconds(new Date(), timerStart));
      }, 1000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [timerRunning, timerStart]);

  const startTimer = () => {
    setTimerStart(new Date());
    setTimerRunning(true);
    setTimerElapsed(0);
  };

  const stopTimer = async () => {
    if (!timerStart || !teamMember?.id) return;
    const durationHours = Math.round((timerElapsed / 3600) * 100) / 100;
    if (durationHours < 0.01) { toast.error('Duração mínima: 1 minuto'); return; }
    const { error } = await supabase.from('time_entries').insert({
      member_id: teamMember.id,
      entry_date: format(new Date(), 'yyyy-MM-dd'),
      duration: durationHours,
      category: timerCategory,
      description: timerDesc || null,
      project_id: timerProject || null,
      task_id: timerTask || null,
    });
    if (error) { toast.error('Erro ao guardar registo'); return; }
    setTimerRunning(false);
    setTimerStart(null);
    setTimerElapsed(0);
    setTimerDesc('');
    setTimerProject('');
    setTimerTask('');
    setTimerCategory('interno');
    qc.invalidateQueries({ queryKey: ['my-time-entries'] });
    toast.success('Tempo registado');
  };

  // Period filters
  const periodStart = period === 'week' ? weekStart : monthStart;
  const periodEnd = period === 'week' ? weekEnd : monthEnd;
  const periodEntries = useMemo(() => timeEntries.filter((e: any) => {
    const d = parseISO(e.entry_date);
    return isWithinInterval(d, { start: periodStart, end: periodEnd });
  }), [timeEntries, periodStart, periodEnd]);

  const totalHours = periodEntries.reduce((s: number, e: any) => s + Number(e.duration || 0), 0);
  const completedTasks = useMemo(() => tasks.filter((t: any) => t.status === 'done' && t.updated_at && isWithinInterval(parseISO(t.updated_at), { start: periodStart, end: periodEnd })), [tasks, periodStart, periodEnd]);
  const overdueTasks = tasks.filter((t: any) => t.status !== 'done' && t.deadline && isBefore(parseISO(t.deadline), today));

  const daysInPeriod = period === 'week' ? 5 : Math.ceil((periodEnd.getTime() - periodStart.getTime()) / 86400000);
  const avgPerDay = daysInPeriod > 0 ? Math.round((totalHours / daysInPeriod) * 10) / 10 : 0;

  // Week entries for history
  const weekEntries = useMemo(() => timeEntries.filter((e: any) => {
    const d = parseISO(e.entry_date);
    return isWithinInterval(d, { start: weekStart, end: weekEnd });
  }), [timeEntries]);

  const weekTotalHours = weekEntries.reduce((s: number, e: any) => s + Number(e.duration || 0), 0);

  // Chart data - last 7 days
  const chartData = useMemo(() => {
    const days = eachDayOfInterval({ start: addDays(today, -6), end: today });
    return days.map(d => {
      const key = format(d, 'yyyy-MM-dd');
      const hours = timeEntries.filter((e: any) => e.entry_date === key).reduce((s: number, e: any) => s + Number(e.duration || 0), 0);
      return { day: format(d, 'EEE', { locale: pt }), hours: Math.round(hours * 10) / 10 };
    });
  }, [timeEntries]);

  const expectedDaily = teamMember?.expected_weekly_hours ? Number(teamMember.expected_weekly_hours) / 5 : 8;

  // Completed tasks split
  const weekCompletedTasks = useMemo(() => tasks.filter((t: any) => t.status === 'done' && t.updated_at && isWithinInterval(parseISO(t.updated_at), { start: weekStart, end: weekEnd })), [tasks]);
  const monthCompletedTasks = useMemo(() => tasks.filter((t: any) => t.status === 'done' && t.updated_at && isWithinInterval(parseISO(t.updated_at), { start: monthStart, end: monthEnd })), [tasks]);

  // Delete time entry
  const deleteEntry = async (id: string) => {
    await supabase.from('time_entries').delete().eq('id', id);
    qc.invalidateQueries({ queryKey: ['my-time-entries'] });
    toast.success('Registo eliminado');
  };

  const openTasks = useMemo(() => tasks.filter((t: any) => t.status !== 'done'), [tasks]);

  return (
    <div className="space-y-6 mt-4">
      {/* Period toggle + summary */}
      <div className="flex gap-2">
        <Button variant={period === 'week' ? 'default' : 'outline'} size="sm" onClick={() => setPeriod('week')}>Esta semana</Button>
        <Button variant={period === 'month' ? 'default' : 'outline'} size="sm" onClick={() => setPeriod('month')}>Este mês</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Horas registadas</p><p className="text-2xl font-bold">{Math.round(totalHours * 10) / 10}h</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Tarefas concluídas</p><p className="text-2xl font-bold">{completedTasks.length}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Tarefas em atraso</p><p className="text-2xl font-bold text-destructive">{overdueTasks.length}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Média horas/dia</p><p className="text-2xl font-bold">{avgPerDay}h</p></CardContent></Card>
      </div>

      {/* Time tracker */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm font-medium flex items-center gap-2"><Clock className="h-4 w-4" /> Time Tracker</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex items-center gap-3">
              <span className="font-mono text-2xl font-bold tabular-nums">{formatTimer(timerElapsed)}</span>
              {!timerRunning ? (
                <Button size="sm" onClick={startTimer} disabled={!teamMember?.id}><Play className="h-4 w-4 mr-1" /> Iniciar</Button>
              ) : (
                <Button size="sm" variant="destructive" onClick={stopTimer}><Square className="h-4 w-4 mr-1" /> Parar</Button>
              )}
            </div>
            <Input placeholder="Descrição..." value={timerDesc} onChange={e => setTimerDesc(e.target.value)} className="max-w-[200px]" />
            <Select value={timerCategory} onValueChange={setTimerCategory}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>{TIME_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={timerProject} onValueChange={setTimerProject}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Projeto..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum</SelectItem>
                {(allProjects || []).map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={timerTask} onValueChange={setTimerTask}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Tarefa..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhuma</SelectItem>
                {openTasks.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Time history this week */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Histórico de tempo — esta semana ({Math.round(weekTotalHours * 10) / 10}h)</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Duração</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {weekEntries.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-4">Sem registos.</TableCell></TableRow>}
              {weekEntries.map((e: any) => (
                <TableRow key={e.id}>
                  <TableCell className="text-sm">{format(parseISO(e.entry_date), 'dd/MM')}</TableCell>
                  <TableCell className="text-sm">{e.description || '—'}</TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px] capitalize">{e.category}</Badge></TableCell>
                  <TableCell className="text-sm font-medium">{Number(e.duration).toFixed(1)}h</TableCell>
                  <TableCell><Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => deleteEntry(e.id)}><Trash2 className="h-3.5 w-3.5 text-muted-foreground" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Completed tasks split */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Concluídas esta semana ({weekCompletedTasks.length})</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {weekCompletedTasks.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma.</p>}
            {weekCompletedTasks.map((t: any) => (
              <div key={t.id} className="flex items-center justify-between text-sm">
                <span>{t.name}</span>
                <span className="text-xs text-muted-foreground">{t.updated_at ? format(parseISO(t.updated_at), 'dd/MM') : ''}</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Concluídas este mês ({monthCompletedTasks.length})</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {monthCompletedTasks.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma.</p>}
            {monthCompletedTasks.slice(0, 15).map((t: any) => (
              <div key={t.id} className="flex items-center justify-between text-sm">
                <span>{t.name}</span>
                <span className="text-xs text-muted-foreground">{t.updated_at ? format(parseISO(t.updated_at), 'dd/MM') : ''}</span>
              </div>
            ))}
            {monthCompletedTasks.length > 15 && <p className="text-xs text-muted-foreground">+{monthCompletedTasks.length - 15} mais</p>}
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Horas — últimos 7 dias</CardTitle></CardHeader>
        <CardContent className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <XAxis dataKey="day" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <ReferenceLine y={expectedDaily} stroke="hsl(var(--primary))" strokeDasharray="3 3" label={{ value: `${expectedDaily}h`, position: 'right', fontSize: 10 }} />
              <Bar dataKey="hours" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB 6 — O MEU CONTRATO & PAGAMENTOS
// ═══════════════════════════════════════════════════════════════

function MeuContratoTab({ teamMember }: { teamMember: any }) {
  const contracts = useQuery({
    queryKey: ['my-contracts', teamMember?.id],
    enabled: !!teamMember?.id,
    queryFn: async () => {
      const { data } = await supabase.from('member_contracts').select('*').eq('member_id', teamMember.id).order('start_date', { ascending: false });
      return data || [];
    },
  });

  const payments = useQuery({
    queryKey: ['my-payments', teamMember?.id],
    enabled: !!teamMember?.id,
    queryFn: async () => {
      const { data } = await supabase.from('member_payments').select('*').eq('member_id', teamMember.id).order('year', { ascending: false });
      return data || [];
    },
  });

  const currentYear = new Date().getFullYear();
  const yearTotal = (payments.data || []).filter(p => p.year === currentYear && p.status === 'pago').reduce((s, p) => s + Number(p.net_value || 0), 0);

  const activeContract = (contracts.data || []).find(c => c.status === 'ativo');

  return (
    <div className="space-y-6 mt-4">
      {/* Contract */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">O Meu Contrato</CardTitle></CardHeader>
        <CardContent>
          {!activeContract ? (
            <p className="text-sm text-muted-foreground">Sem contrato registado.</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div><p className="text-xs text-muted-foreground">Tipo</p><p className="font-medium capitalize">{activeContract.contract_type?.replace('_', ' ')}</p></div>
              <div><p className="text-xs text-muted-foreground">Data de início</p><p className="font-medium">{activeContract.start_date || '—'}</p></div>
              <div><p className="text-xs text-muted-foreground">Data de fim</p><p className="font-medium">{activeContract.end_date || '—'}</p></div>
              <div><p className="text-xs text-muted-foreground">Status</p><Badge variant="outline" className="capitalize">{activeContract.status}</Badge></div>
              {activeContract.document_url && (
                <div className="col-span-full"><Button variant="outline" size="sm" asChild><a href={activeContract.document_url} target="_blank" rel="noreferrer"><FileText className="h-4 w-4 mr-1" /> Ver Documento</a></Button></div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payments */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">Os Meus Pagamentos</CardTitle>
            <Badge variant="outline">Total pago {currentYear}: {yearTotal.toFixed(2)} €</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mês</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Valor Bruto</TableHead>
                <TableHead>Valor Líquido</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(payments.data || []).length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Sem pagamentos registados.</TableCell></TableRow>}
              {(payments.data || []).map((p: any) => (
                <TableRow key={p.id}>
                  <TableCell className="text-sm">{p.month}/{p.year}</TableCell>
                  <TableCell className="text-sm capitalize">{p.payment_type?.replace('_', ' ')}</TableCell>
                  <TableCell className="text-sm">{Number(p.gross_value).toFixed(2)} €</TableCell>
                  <TableCell className="text-sm font-medium">{Number(p.net_value).toFixed(2)} €</TableCell>
                  <TableCell><Badge variant={p.status === 'pago' ? 'default' : 'outline'} className="text-[10px]">{p.status === 'pago' ? 'Pago' : 'Por Pagar'}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB 7 — O MEU ESPAÇO
// ═══════════════════════════════════════════════════════════════

function MeuEspacoTab({ userId, teamMember }: { userId?: string; teamMember: any }) {
  const qc = useQueryClient();

  // Personal image
  const personalImage = useQuery({
    queryKey: ['personal-image', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase.from('member_personal_images').select('*').eq('user_id', userId!).maybeSingle();
      return data;
    },
  });

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userId) return;
    const path = `${userId}/${Date.now()}_${file.name}`;
    const { error: upErr } = await supabase.storage.from('personal-images').upload(path, file);
    if (upErr) { toast.error('Erro no upload'); return; }
    const { data: { publicUrl } } = supabase.storage.from('personal-images').getPublicUrl(path);
    await supabase.from('member_personal_images').upsert({ user_id: userId, image_url: publicUrl, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
    qc.invalidateQueries({ queryKey: ['personal-image'] });
    toast.success('Imagem atualizada');
  };

  // Personal notes
  const personalNotes = useQuery({
    queryKey: ['personal-notes', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase.from('member_personal_notes').select('*').eq('user_id', userId!).maybeSingle();
      return data;
    },
  });

  const saveNotes = useCallback(async (content: string) => {
    if (!userId) return;
    await supabase.from('member_personal_notes').upsert({ user_id: userId, content, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  }, [userId]);

  // Debounced save for notes
  const notesTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleNotesChange = (content: string) => {
    if (notesTimeoutRef.current) clearTimeout(notesTimeoutRef.current);
    notesTimeoutRef.current = setTimeout(() => saveNotes(content), 1000);
  };

  // Personal links
  const personalLinks = useQuery({
    queryKey: ['personal-links', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase.from('member_personal_links').select('*').eq('user_id', userId!).order('sort_order');
      return data || [];
    },
  });

  const [newLinkLabel, setNewLinkLabel] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');

  const addLink = async () => {
    if (!newLinkLabel.trim() || !newLinkUrl.trim() || !userId) return;
    await supabase.from('member_personal_links').insert({ user_id: userId, label: newLinkLabel.trim(), url: newLinkUrl.trim(), sort_order: (personalLinks.data?.length || 0) });
    setNewLinkLabel('');
    setNewLinkUrl('');
    qc.invalidateQueries({ queryKey: ['personal-links'] });
  };

  const deleteLink = async (id: string) => {
    await supabase.from('member_personal_links').delete().eq('id', id);
    qc.invalidateQueries({ queryKey: ['personal-links'] });
  };

  // Onboarding
  const onboarding = useQuery({
    queryKey: ['my-onboarding', teamMember?.id],
    enabled: !!teamMember?.id,
    queryFn: async () => {
      const { data } = await supabase.from('member_onboarding').select('*').eq('member_id', teamMember.id).order('sort_order');
      return data || [];
    },
  });

  const pendingOnboarding = (onboarding.data || []).filter(i => !i.completed);
  const toggleOnboarding = async (id: string, completed: boolean) => {
    await supabase.from('member_onboarding').update({ completed }).eq('id', id);
    qc.invalidateQueries({ queryKey: ['my-onboarding'] });
  };

  return (
    <div className="space-y-6 mt-4">
      {/* Personal image */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm font-medium flex items-center gap-2"><ImageIcon className="h-4 w-4" /> Imagem Pessoal</CardTitle></CardHeader>
        <CardContent>
          {personalImage.data?.image_url && (
            <img src={personalImage.data.image_url} alt="Imagem pessoal" className="w-full max-w-md h-48 object-cover rounded-lg mb-3" />
          )}
          <label className="cursor-pointer">
            <Input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
            <Button variant="outline" size="sm" asChild><span><ImageIcon className="h-4 w-4 mr-1" /> {personalImage.data ? 'Alterar imagem' : 'Upload de imagem'}</span></Button>
          </label>
        </CardContent>
      </Card>

      {/* Personal notes */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm font-medium flex items-center gap-2"><FileText className="h-4 w-4" /> Notas Pessoais</CardTitle></CardHeader>
        <CardContent>
          <RichTextEditor
            content={personalNotes.data?.content || ''}
            onChange={handleNotesChange}
          />
        </CardContent>
      </Card>

      {/* Personal links */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm font-medium flex items-center gap-2"><Link2 className="h-4 w-4" /> Os Meus Links</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {(personalLinks.data || []).map((link: any) => (
            <div key={link.id} className="flex items-center justify-between gap-2 p-2 rounded border">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm font-medium truncate">{link.label}</span>
                <a href={link.url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline truncate">{link.url}</a>
              </div>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0" onClick={() => deleteLink(link.id)}><Trash2 className="h-3.5 w-3.5 text-muted-foreground" /></Button>
            </div>
          ))}
          <div className="flex gap-2">
            <Input placeholder="Nome" value={newLinkLabel} onChange={e => setNewLinkLabel(e.target.value)} className="flex-1" />
            <Input placeholder="URL" value={newLinkUrl} onChange={e => setNewLinkUrl(e.target.value)} className="flex-1" />
            <Button size="sm" onClick={addLink} disabled={!newLinkLabel.trim() || !newLinkUrl.trim()}><Plus className="h-4 w-4" /></Button>
          </div>
        </CardContent>
      </Card>

      {/* Onboarding */}
      {pendingOnboarding.length > 0 && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">O Meu Onboarding</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {(onboarding.data || []).map((item: any) => (
              <div key={item.id} className="flex items-center gap-3">
                <Checkbox checked={item.completed} onCheckedChange={(checked) => toggleOnboarding(item.id, !!checked)} />
                <span className={cn('text-sm', item.completed && 'line-through text-muted-foreground')}>{item.task}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
