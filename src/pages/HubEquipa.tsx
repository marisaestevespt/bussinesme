import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { BackNavigation } from '@/components/BackNavigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Rocket, MessageSquare, Users, Calendar, Video, Key, FolderKanban, GitBranch, CheckSquare,
  Megaphone, ShoppingCart, UserCheck, DollarSign, Headphones, Package, UsersRound, Lock,
  Plus, ClipboardList, AlertTriangle, ListTodo, FolderOpen, CalendarDays,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { MessageSquare as WhatsAppIcon, ExternalLink, Pencil, Check, X as XIcon } from 'lucide-react';
import { Input as InputField } from '@/components/ui/input';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, subDays, startOfWeek, endOfWeek, parseISO, isPast, isToday } from 'date-fns';
import { pt } from 'date-fns/locale';
import { isTaskOpen } from '@/lib/taskStatus';
import { EmptyHint } from '@/components/ui/loading-skeletons';

// ─── Constants ──────────────────────────────────────────────────

const TRANSVERSAIS_CARDS = [
  { label: 'Agenda de Negócio', icon: Calendar, path: '/hub/agenda', iconColor: 'text-info', color: 'from-info/10 to-info/5 hover:from-info/20 hover:to-info/10' },
  { label: 'Reuniões', icon: Video, path: '/hub/reunioes', iconColor: 'text-accent-violet', color: 'from-accent-violet/10 to-accent-violet/5 hover:from-accent-violet/20 hover:to-accent-violet/10' },
  { label: 'Acessos', icon: Key, path: '/hub/acessos', iconColor: 'text-warning', color: 'from-warning/10 to-warning/5 hover:from-warning/20 hover:to-warning/10' },
  { label: 'Projetos', icon: FolderKanban, path: '/hub/projetos', iconColor: 'text-success', color: 'from-success/10 to-success/5 hover:from-success/20 hover:to-success/10' },
  { label: 'Processos', icon: GitBranch, path: '/hub/processos', iconColor: 'text-muted-foreground', color: 'from-border/10 to-border/5 hover:from-border/20 hover:to-border/10' },
  { label: 'Tarefas', icon: CheckSquare, path: '/hub/tarefas', iconColor: 'text-destructive', color: 'from-destructive/10 to-destructive/5 hover:from-destructive/20 hover:to-destructive/10' },
];

const DEPARTMENT_CARDS = [
  { key: 'marketing', label: 'Marketing', icon: Megaphone, path: '/hub/marketing' },
  { key: 'comercial', label: 'Comercial', icon: ShoppingCart, path: '/hub/comercial' },
  { key: 'clientes', label: 'Clientes', icon: UserCheck, path: '/hub/clientes' },
  { key: 'financeiro', label: 'Financeiro', icon: DollarSign, path: '/hub/financeiro' },
  { key: 'operacao', label: 'Operação', icon: Headphones, path: '/hub/operacao' },
  { key: 'produtos', label: 'Produtos', icon: Package, path: '/hub/produtos' },
  { key: 'equipa', label: 'Equipa', icon: UsersRound, path: '/hub/recursos-humanos' },
];

function greetingText() {
  const h = new Date().getHours();
  if (h < 5) return 'Boa madrugada';
  if (h < 12) return 'Bom dia';
  if (h < 19) return 'Boa tarde';
  return 'Boa noite';
}

// ─── Analog Clock ──────────────────────────────────────────────────

function AnalogClock() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const seconds = time.getSeconds();
  const minutes = time.getMinutes();
  const hours = time.getHours() % 12;

  const secDeg = seconds * 6;
  const minDeg = minutes * 6 + seconds * 0.1;
  const hrDeg = hours * 30 + minutes * 0.5;

  const dateStr = format(time, "EEEE, d MMM", { locale: pt });
  const timeStr = format(time, "HH:mm");

  return (
    <div className="flex flex-col items-center gap-1 shrink-0">
      <div className="relative h-16 w-16">
        <svg viewBox="0 0 100 100" className="h-full w-full">
          <circle cx="50" cy="50" r="48" fill="none" stroke="hsl(var(--foreground))" strokeOpacity="0.25" strokeWidth="2" />
          {Array.from({ length: 12 }).map((_, i) => {
            const angle = (i * 30 - 90) * (Math.PI / 180);
            const x1 = 50 + 40 * Math.cos(angle);
            const y1 = 50 + 40 * Math.sin(angle);
            const x2 = 50 + 45 * Math.cos(angle);
            const y2 = 50 + 45 * Math.sin(angle);
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="hsl(var(--foreground))" strokeOpacity="0.5" strokeWidth="2" strokeLinecap="round" />;
          })}
          <line x1="50" y1="50" x2={50 + 25 * Math.cos((hrDeg - 90) * Math.PI / 180)} y2={50 + 25 * Math.sin((hrDeg - 90) * Math.PI / 180)} stroke="hsl(var(--foreground))" strokeWidth="3" strokeLinecap="round" />
          <line x1="50" y1="50" x2={50 + 35 * Math.cos((minDeg - 90) * Math.PI / 180)} y2={50 + 35 * Math.sin((minDeg - 90) * Math.PI / 180)} stroke="hsl(var(--foreground))" strokeWidth="2" strokeLinecap="round" />
          <line x1="50" y1="50" x2={50 + 38 * Math.cos((secDeg - 90) * Math.PI / 180)} y2={50 + 38 * Math.sin((secDeg - 90) * Math.PI / 180)} stroke="hsl(var(--primary))" strokeOpacity="0.8" strokeWidth="1" strokeLinecap="round" />
          <circle cx="50" cy="50" r="2.5" fill="hsl(var(--primary))" />
        </svg>
      </div>
      <span className="text-xs font-medium tabular-nums text-foreground">{timeStr}</span>
      <span className="text-[10px] text-muted-foreground capitalize">{dateStr}</span>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────

// ─── Team WhatsApp Link (header) ──────────────────────────────────────
function TeamWhatsAppLink() {
  const { isOwner } = useAuth();
  const { canAccess } = usePermissions();
  const isAdmin = isOwner || canAccess('admin' as any);
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const { data: settings } = useQuery({
    queryKey: ['business-settings-whatsapp'],
    queryFn: async () => {
      const { data } = await supabase.from('business_settings').select('whatsapp_team_url').limit(1).maybeSingle();
      return data;
    },
  });

  const url = (settings as any)?.whatsapp_team_url || '';

  const saveMut = useMutation({
    mutationFn: async (newUrl: string) => {
      const { data: existing } = await supabase.from('business_settings').select('id').limit(1).maybeSingle();
      if (existing) {
        await supabase.from('business_settings').update({ whatsapp_team_url: newUrl } as any).eq('id', existing.id);
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['business-settings-whatsapp'] }); toast.success('Link guardado'); setEditing(false); },
    onError: () => toast.error('Não consegui guardar a membro. Tenta novamente.'),
  });

  if (editing) {
    return (
      <div className="flex items-center gap-2 mt-2">
        <InputField value={draft} onChange={e => setDraft(e.target.value)} placeholder="https://chat.whatsapp.com/..." className="h-7 text-xs flex-1 max-w-sm" autoFocus />
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => saveMut.mutate(draft.trim())} disabled={saveMut.isPending}><Check className="h-3.5 w-3.5" /></Button>
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground" onClick={() => setEditing(false)}><XIcon className="h-3.5 w-3.5" /></Button>
      </div>
    );
  }

  if (!url && !isAdmin) return null;

  return (
    <div className="flex items-center gap-2 mt-2">
      {url ? (
        <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-primary hover:text-primary/80 flex items-center gap-2 transition-colors">
          <WhatsAppIcon className="h-3.5 w-3.5" /> Grupo de Equipa (WhatsApp) <ExternalLink className="h-3 w-3" />
        </a>
      ) : (
        <span className="text-xs text-muted-foreground italic flex items-center gap-2"><WhatsAppIcon className="h-3.5 w-3.5" /> Sem link de grupo</span>
      )}
      {isAdmin && (
        <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground" onClick={() => { setDraft(url); setEditing(true); }}>
          <Pencil className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}

export default function HubEquipaPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Get profile name
  const { data: profile } = useQuery({
    queryKey: ['my-profile', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('full_name').eq('user_id', user!.id).maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const firstName = profile?.full_name?.split(' ')[0] || '';

  return (
    <AppLayout>
      {/* Full-width banner aligned with system PageHeader style */}
      <div className="relative -mx-4 sm:-mx-8 px-4 sm:px-8 py-5 sm:py-8 overflow-hidden border-b border-border/60">
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(135deg, hsl(var(--primary) / 0.10) 0%, hsl(var(--primary) / 0.04) 50%, hsl(var(--gradient-end)) 100%)`,
          }}
        />
        <div
          className="hidden sm:block absolute -top-8 -right-8 w-56 h-56 rounded-full opacity-[0.10] blur-3xl"
          style={{ background: `hsl(var(--gradient-accent))` }}
        />
        <div
          className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full"
          style={{ background: `hsl(var(--primary) / 0.35)` }}
        />
        <div className="relative flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground truncate">
              {greetingText()}, {firstName}.
            </h1>
            <p className="mt-1 sm:mt-1.5 text-xs sm:text-sm text-muted-foreground hidden sm:block">
              Olá! Bem-vindo(a) ao nosso espaço. Este é o lugar onde organizamos, colaboramos e crescemos juntos.
            </p>
            <div className="mt-3"><TeamWhatsAppLink /></div>
          </div>
          <AnalogClock />
        </div>
      </div>

      <div className="space-y-6 pt-6">
        <BackNavigation parentRoute="/secretaria" parentLabel="Secretaria" />

        {/* Active absence alerts */}
        <ActiveAbsenceAlerts />

        {/* Novidades do mês */}
        <NovidadesMes />

        {/* Transversais cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
          {TRANSVERSAIS_CARDS.map(s => (
            <Card
              key={s.path}
              className={`group cursor-pointer border bg-gradient-to-br ${s.color} transition-all duration-200 hover:shadow-md hover:-translate-y-0.5`}
              onClick={() => navigate(s.path)}
            >
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`h-9 w-9 rounded-lg bg-background/80 flex items-center justify-center shadow-sm shrink-0 ${s.iconColor}`}>
                  <s.icon className="h-4.5 w-4.5" />
                </div>
                <span className="font-medium text-sm">{s.label}</span>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Departamentos */}
        <DepartamentosColumn />

        {/* Weekly summary cards */}
        <WeeklySummary />
      </div>
    </AppLayout>
  );
}

// ─── Active Absence Alerts ──────────────────────────────────────────────────

function ActiveAbsenceAlerts() {
  const { data: coverages = [] } = useQuery({
    queryKey: ['active-absences-hub'],
    queryFn: async () => {
      const today = format(new Date(), 'yyyy-MM-dd');
      const { data } = await supabase
        .from('absence_coverage')
        .select('*')
        .lte('start_date', today)
        .gte('end_date', today);
      return data || [];
    },
  });

  const { data: members = [] } = useQuery({
    queryKey: ['team-members-hub-absence'],
    queryFn: async () => {
      const { data } = await supabase.from('team_members').select('id, full_name').eq('status', 'ativo');
      return data || [];
    },
  });

  if (coverages.length === 0) return null;

  const getName = (id: string) => members.find(m => m.id === id)?.full_name || '—';

  return (
    <div className="space-y-2">
      {coverages.map((c: any) => (
        <div key={c.id} className="flex items-center gap-2 bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-2.5 text-sm">
          <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
          <span>
            <strong>{getName(c.member_id)}</strong> está ausente até {format(parseISO(c.end_date), 'dd/MM/yyyy')}.
            {c.substitute_id ? <> Cobertura: <strong>{getName(c.substitute_id)}</strong>.</> : <span className="text-destructive"> Sem substituto definido.</span>}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Novidades do Mês ──────────────────────────────────────────────────

function NovidadesMes() {
  const navigate = useNavigate();

  const { data: posts = [] } = useQuery({
    queryKey: ['hub-mural-novidades'],
    queryFn: async () => {
      const since = subDays(new Date(), 30).toISOString();
      const { data } = await supabase
        .from('mural_posts')
        .select('id, title, category, created_at, author_id')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(5);
      return data || [];
    },
  });

  // Fetch author names
  const authorIds = [...new Set(posts.map(p => p.author_id))];
  const { data: authors = [] } = useQuery({
    queryKey: ['hub-mural-authors', authorIds],
    queryFn: async () => {
      if (!authorIds.length) return [];
      const { data } = await supabase.from('profiles').select('user_id, full_name').in('user_id', authorIds);
      return data || [];
    },
    enabled: authorIds.length > 0,
  });

  const getAuthorName = (id: string) => authors.find((a: any) => a.user_id === id)?.full_name?.split(' ')[0] || '';

  return (
    <div className="rounded-xl border-2 border-secondary bg-background p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-secondary" />
          Novidades do mês
        </h2>
        <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={() => navigate('/hub/mural')}>
          Ver tudo →
        </Button>
      </div>

      {posts.length === 0 ? (
        <EmptyHint>Sem novidades nos últimos 30 dias.</EmptyHint>
      ) : (
        <div className="space-y-2">
          {posts.map((p: any) => (
            <div
              key={p.id}
              className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 hover:bg-muted/70 cursor-pointer transition-colors"
              onClick={() => navigate('/hub/mural')}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{p.title}</p>
                <p className="text-[11px] text-muted-foreground">
                  {getAuthorName(p.author_id)} · {format(new Date(p.created_at), "d MMM", { locale: pt })}
                </p>
              </div>
              <Badge variant="outline" className="text-[10px] shrink-0 ml-2">{p.category}</Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Column 3: Departamentos ──────────────────────────────────────────

function DepartamentosColumn() {
  const navigate = useNavigate();
  const { canAccess } = usePermissions();

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Departamentos</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {DEPARTMENT_CARDS.slice(0, 4).map(d => <DeptCard key={d.key} d={d} canAccess={canAccess(d.key)} navigate={navigate} />)}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {DEPARTMENT_CARDS.slice(4).map(d => <DeptCard key={d.key} d={d} canAccess={canAccess(d.key)} navigate={navigate} />)}
      </div>
    </div>
  );
}

function DeptCard({ d, canAccess, navigate }: { d: typeof DEPARTMENT_CARDS[number]; canAccess: boolean; navigate: any }) {
  return (
    <Card
      className={`transition-all ${canAccess ? 'cursor-pointer hover:shadow-md hover:border-primary/20' : 'opacity-50 cursor-not-allowed'}`}
      onClick={canAccess ? () => navigate(d.path) : undefined}
    >
      <CardContent className="p-3 flex items-center gap-2">
        <div className={`h-7 w-7 rounded-md flex items-center justify-center shrink-0 ${canAccess ? 'bg-primary/10' : 'bg-muted'}`}>
          {canAccess ? <d.icon className="h-3.5 w-3.5 text-primary" /> : <Lock className="h-3 w-3 text-muted-foreground" />}
        </div>
        <span className={`text-xs font-medium truncate ${canAccess ? '' : 'text-muted-foreground'}`}>{d.label}</span>
      </CardContent>
    </Card>
  );
}

// ─── Weekly Summary ──────────────────────────────────────────────────

function WeeklySummary() {
  const navigate = useNavigate();
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

  const { data: tasks = [] } = useQuery({
    queryKey: ['hub-week-tasks', weekStart.toISOString()],
    queryFn: async () => {
      const { data } = await supabase
        .from('tasks')
        .select('id, name, status, deadline')
        .gte('deadline', weekStart.toISOString().split('T')[0])
        .lte('deadline', weekEnd.toISOString().split('T')[0])
        .order('deadline');
      return data || [];
    },
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['hub-active-projects'],
    queryFn: async () => {
      const { data } = await supabase
        .from('projects')
        .select('id, name, status')
        .eq('status', 'em_curso')
        .is('archived_at', null)
        .order('name')
        .limit(10);
      return data || [];
    },
  });

  const { data: events = [] } = useQuery({
    queryKey: ['hub-week-events', weekStart.toISOString()],
    queryFn: async () => {
      const { data } = await supabase
        .from('events')
        .select('id, title, start_date')
        .gte('start_date', weekStart.toISOString())
        .lte('start_date', weekEnd.toISOString())
        .order('start_date');
      return data || [];
    },
  });

  const pendingTasks = tasks.filter(isTaskOpen);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {/* Tarefas esta semana */}
      <Card className="cursor-pointer hover:shadow-md transition-all" onClick={() => navigate('/hub/tarefas')}>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center gap-2">
            <ListTodo className="h-4 w-4 text-destructive" />
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tarefas esta semana</span>
          </div>
          <p className="text-2xl font-bold">{pendingTasks.length}</p>
          <div className="space-y-1 max-h-24 overflow-y-auto">
            {pendingTasks.slice(0, 3).map((t: any) => (
              <p key={t.id} className="text-[11px] text-muted-foreground truncate">• {t.name}</p>
            ))}
            {pendingTasks.length > 3 && <p className="text-[10px] text-muted-foreground">+{pendingTasks.length - 3} mais</p>}
          </div>
        </CardContent>
      </Card>

      {/* Projetos ativos */}
      <Card className="cursor-pointer hover:shadow-md transition-all" onClick={() => navigate('/hub/projetos')}>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center gap-2">
            <FolderKanban className="h-4 w-4 text-success" />
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Projetos ativos</span>
          </div>
          <p className="text-2xl font-bold">{projects.length}</p>
          <div className="space-y-1 max-h-24 overflow-y-auto">
            {projects.slice(0, 3).map((p: any) => (
              <p key={p.id} className="text-[11px] text-muted-foreground truncate">• {p.name}</p>
            ))}
            {projects.length > 3 && <p className="text-[10px] text-muted-foreground">+{projects.length - 3} mais</p>}
          </div>
        </CardContent>
      </Card>

      {/* Eventos esta semana */}
      <Card className="cursor-pointer hover:shadow-md transition-all" onClick={() => navigate('/hub/agenda')}>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-info" />
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Eventos esta semana</span>
          </div>
          <p className="text-2xl font-bold">{events.length}</p>
          <div className="space-y-1 max-h-24 overflow-y-auto">
            {events.slice(0, 3).map((e: any) => (
              <p key={e.id} className="text-[11px] text-muted-foreground truncate">
                • {e.title} <span className="text-muted-foreground/60">({format(new Date(e.start_date), "EEE HH:mm", { locale: pt })})</span>
              </p>
            ))}
            {events.length > 3 && <p className="text-[10px] text-muted-foreground">+{events.length - 3} mais</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
