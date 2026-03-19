import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Rocket, MessageSquare, Users, Calendar, Video, Key, FolderKanban, GitBranch, CheckSquare,
  Megaphone, ShoppingCart, UserCheck, DollarSign, Headphones, Package, UsersRound, Lock,
  Plus, ClipboardList, AlertTriangle,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, subDays, parseISO, isPast, isToday } from 'date-fns';
import { pt } from 'date-fns/locale';

// ─── Constants ──────────────────────────────────────────────────

const HALL_LINKS = [
  { label: 'Começa Aqui', icon: Rocket, path: '/comeca-aqui' },
  { label: 'Mural', icon: MessageSquare, path: '/hub/mural' },
  { label: 'Hub de Equipa', icon: Users, path: '/hub-equipa' },
];

const TRANSVERSAIS_LINKS = [
  { label: 'Agenda de Negócio', icon: Calendar, path: '/hub/agenda' },
  { label: 'Reuniões', icon: Video, path: '/hub/reunioes' },
  { label: 'Acessos', icon: Key, path: '/hub/acessos' },
  { label: 'Projetos', icon: FolderKanban, path: '/hub/projetos' },
  { label: 'Processos', icon: GitBranch, path: '/hub/processos' },
  { label: 'Tarefas', icon: CheckSquare, path: '/hub/tarefas' },
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
          {/* Face */}
          <circle cx="50" cy="50" r="48" fill="none" stroke="white" strokeOpacity="0.3" strokeWidth="2" />
          {Array.from({ length: 12 }).map((_, i) => {
            const angle = (i * 30 - 90) * (Math.PI / 180);
            const x1 = 50 + 40 * Math.cos(angle);
            const y1 = 50 + 40 * Math.sin(angle);
            const x2 = 50 + 45 * Math.cos(angle);
            const y2 = 50 + 45 * Math.sin(angle);
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="white" strokeOpacity="0.6" strokeWidth="2" strokeLinecap="round" />;
          })}
          <line x1="50" y1="50" x2={50 + 25 * Math.cos((hrDeg - 90) * Math.PI / 180)} y2={50 + 25 * Math.sin((hrDeg - 90) * Math.PI / 180)} stroke="white" strokeWidth="3" strokeLinecap="round" />
          <line x1="50" y1="50" x2={50 + 35 * Math.cos((minDeg - 90) * Math.PI / 180)} y2={50 + 35 * Math.sin((minDeg - 90) * Math.PI / 180)} stroke="white" strokeWidth="2" strokeLinecap="round" />
          <line x1="50" y1="50" x2={50 + 38 * Math.cos((secDeg - 90) * Math.PI / 180)} y2={50 + 38 * Math.sin((secDeg - 90) * Math.PI / 180)} stroke="white" strokeOpacity="0.7" strokeWidth="1" strokeLinecap="round" />
          <circle cx="50" cy="50" r="2.5" fill="white" />
        </svg>
      </div>
      <span className="text-xs font-medium tabular-nums text-white">{timeStr}</span>
      <span className="text-[10px] text-white/70 capitalize">{dateStr}</span>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────

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
      <div className="space-y-6">
        {/* Header */}
        <div className="rounded-xl bg-primary px-6 py-5 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-primary-foreground">
              {greetingText()}, {firstName}.
            </h1>
            <p className="text-sm text-primary-foreground/70 mt-1">
              Olá! Bem-vindo(a) ao nosso espaço. Este é o lugar onde organizamos, colaboramos e crescemos juntos.
            </p>
          </div>
          <AnalogClock />
        </div>

        {/* Quick links */}
        <QuickLinks />

        {/* Two columns: Hall + Transversais */}
        <div className="grid gap-8 md:grid-cols-2">
          <HallColumn />
          <TransversaisColumn />
        </div>

        {/* Departamentos full width */}
        <DepartamentosColumn />
      </div>
    </AppLayout>
  );
}

// ─── Quick Links ──────────────────────────────────────────────────

function QuickLinks() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Mural novelty count (last 30 days)
  const { data: muralCount } = useQuery({
    queryKey: ['mural-novelty-count'],
    queryFn: async () => {
      const since = subDays(new Date(), 30).toISOString();
      const { count } = await supabase
        .from('mural_posts')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', since);
      return count || 0;
    },
  });

  const shortcuts = [
    { label: 'Secretária', action: () => navigate('/secretaria') },
    {
      label: 'Mural',
      badge: muralCount && muralCount > 0 ? `${muralCount} novidade${muralCount > 1 ? 's' : ''}` : undefined,
      action: () => navigate('/hub/mural'),
    },
    { label: 'Nova Tarefa', icon: Plus, action: () => navigate('/hub/tarefas') },
    { label: 'Nova Reunião', icon: Plus, action: () => navigate('/hub/reunioes') },
    { label: 'Novo Projeto', icon: Plus, action: () => navigate('/hub/projetos') },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      {shortcuts.map(s => (
        <Button key={s.label} variant="outline" size="sm" className="gap-1.5" onClick={s.action}>
          {s.icon && <s.icon className="h-3.5 w-3.5" />}
          {s.label}
          {s.badge && <Badge variant="secondary" className="ml-1 text-[10px]">{s.badge}</Badge>}
        </Button>
      ))}
    </div>
  );
}

// ─── Column 1: Hall ──────────────────────────────────────────────────

function HallColumn() {
  const navigate = useNavigate();
  const { isOwner } = useAuth();

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">Hall</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {HALL_LINKS.map(l => (
            <button
              key={l.path}
              onClick={() => navigate(l.path)}
              className="block text-sm font-semibold hover:text-primary transition-colors text-left py-1"
            >
              {l.label}
            </button>
          ))}
        </CardContent>
      </Card>

      
    </div>
  );
}


// ─── Column 2: Transversais ──────────────────────────────────────────

function TransversaisColumn() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Get profile id for filtering
  const { data: profile } = useQuery({
    queryKey: ['my-profile-id', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id').eq('user_id', user!.id).maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  // Overdue tasks count
  const { data: overdueTasks = 0 } = useQuery({
    queryKey: ['hub-overdue-tasks', profile?.id],
    queryFn: async () => {
      const today = format(new Date(), 'yyyy-MM-dd');
      const { count } = await supabase
        .from('tasks')
        .select('id', { count: 'exact', head: true })
        .eq('assigned_to', profile!.id)
        .neq('status', 'done')
        .lt('deadline', today);
      return count || 0;
    },
    enabled: !!profile,
  });

  // Next 2 meetings
  const { data: nextMeetings = [] } = useQuery({
    queryKey: ['hub-next-meetings', profile?.id],
    queryFn: async () => {
      const now = new Date().toISOString();
      const { data } = await supabase
        .from('events')
        .select('id, title, start_date')
        .gte('start_date', now)
        .order('start_date', { ascending: true })
        .limit(2);
      return data || [];
    },
    enabled: !!profile,
  });

  // Active projects count
  const { data: activeProjects = 0 } = useQuery({
    queryKey: ['hub-active-projects', profile?.id],
    queryFn: async () => {
      const { count } = await supabase
        .from('projects')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'em_curso');
      return count || 0;
    },
    enabled: !!profile,
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">Transversais</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {TRANSVERSAIS_LINKS.map(l => (
            <button
              key={l.path}
              onClick={() => navigate(l.path)}
              className="block text-sm font-semibold hover:text-primary transition-colors text-left py-1"
            >
              {l.label}
            </button>
          ))}
        </CardContent>
      </Card>

      {/* Quick summary */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Resumo rápido</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Overdue tasks */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="h-3.5 w-3.5" /> Tarefas em atraso
            </span>
            <Badge variant={overdueTasks > 0 ? 'destructive' : 'secondary'} className="text-xs">
              {overdueTasks}
            </Badge>
          </div>

          {/* Next meetings */}
          <div className="space-y-1.5">
            <span className="text-sm text-muted-foreground flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5" /> Próximas reuniões
            </span>
            {nextMeetings.length === 0 ? (
              <p className="text-xs text-muted-foreground pl-6">Nenhuma agendada</p>
            ) : (
              nextMeetings.map((m: any) => (
                <div key={m.id} className="flex items-center justify-between pl-6">
                  <span className="text-xs truncate">{m.title}</span>
                  <span className="text-[10px] text-muted-foreground shrink-0 ml-2">
                    {format(new Date(m.start_date), "d MMM, HH:mm", { locale: pt })}
                  </span>
                </div>
              ))
            )}
          </div>

          {/* Active projects */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground flex items-center gap-2">
              <FolderKanban className="h-3.5 w-3.5" /> Projetos ativos
            </span>
            <Badge variant="secondary" className="text-xs">{activeProjects}</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Column 3: Departamentos ──────────────────────────────────────────

function DepartamentosColumn() {
  const navigate = useNavigate();
  const { canAccess } = usePermissions();

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Departamentos</h2>
      <div className="grid grid-cols-2 gap-3">
        {DEPARTMENT_CARDS.map(d => {
          const hasAccess = canAccess(d.key);
          return (
            <Card
              key={d.key}
              className={`transition-all ${hasAccess ? 'cursor-pointer hover:shadow-md hover:border-primary/20' : 'opacity-50 cursor-not-allowed'}`}
              onClick={hasAccess ? () => navigate(d.path) : undefined}
            >
              <CardContent className="p-4 flex flex-col items-center gap-2 text-center">
                <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${hasAccess ? 'bg-primary/10' : 'bg-muted'}`}>
                  {hasAccess ? (
                    <d.icon className="h-5 w-5 text-primary" />
                  ) : (
                    <Lock className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <span className={`text-xs font-medium ${hasAccess ? '' : 'text-muted-foreground'}`}>{d.label}</span>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
