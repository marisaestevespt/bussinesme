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

const TRANSVERSAIS_CARDS = [
  { label: 'Agenda de Negócio', icon: Calendar, path: '/hub/agenda', iconColor: 'text-blue-600', color: 'from-blue-500/10 to-blue-600/5 hover:from-blue-500/20 hover:to-blue-600/10' },
  { label: 'Reuniões', icon: Video, path: '/hub/reunioes', iconColor: 'text-violet-600', color: 'from-violet-500/10 to-violet-600/5 hover:from-violet-500/20 hover:to-violet-600/10' },
  { label: 'Acessos', icon: Key, path: '/hub/acessos', iconColor: 'text-amber-600', color: 'from-amber-500/10 to-amber-600/5 hover:from-amber-500/20 hover:to-amber-600/10' },
  { label: 'Projetos', icon: FolderKanban, path: '/hub/projetos', iconColor: 'text-emerald-600', color: 'from-emerald-500/10 to-emerald-600/5 hover:from-emerald-500/20 hover:to-emerald-600/10' },
  { label: 'Processos', icon: GitBranch, path: '/hub/processos', iconColor: 'text-slate-600', color: 'from-slate-500/10 to-slate-600/5 hover:from-slate-500/20 hover:to-slate-600/10' },
  { label: 'Tarefas', icon: CheckSquare, path: '/hub/tarefas', iconColor: 'text-rose-600', color: 'from-rose-500/10 to-rose-600/5 hover:from-rose-500/20 hover:to-rose-600/10' },
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

        {/* Departamentos full width */}
        <DepartamentosColumn />
      </div>
    </AppLayout>
  );
}


// ─── Quick Summary ──────────────────────────────────────────────────

function QuickSummary() {
  const { user } = useAuth();

  const { data: profile } = useQuery({
    queryKey: ['my-profile-id', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id').eq('user_id', user!.id).maybeSingle();
      return data;
    },
    enabled: !!user,
  });

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
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Resumo rápido</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-6">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Tarefas em atraso</span>
          <Badge variant={overdueTasks > 0 ? 'destructive' : 'secondary'} className="text-xs">{overdueTasks}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <FolderKanban className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Projetos ativos</span>
          <Badge variant="secondary" className="text-xs">{activeProjects}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Próximas reuniões:</span>
          {nextMeetings.length === 0 ? (
            <span className="text-xs text-muted-foreground">Nenhuma agendada</span>
          ) : (
            nextMeetings.map((m: any) => (
              <span key={m.id} className="text-xs">
                {m.title} <span className="text-muted-foreground">({format(new Date(m.start_date), "d MMM, HH:mm", { locale: pt })})</span>
              </span>
            ))
          )}
        </div>
      </CardContent>
    </Card>
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
