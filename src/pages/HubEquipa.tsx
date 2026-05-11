import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { BackNavigation } from '@/components/BackNavigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  MessageSquare, Calendar, Video, Key, FolderKanban, GitBranch, CheckSquare,
  Megaphone, ShoppingCart, UserCheck, DollarSign, Headphones, Package, UsersRound, Lock,
  AlertTriangle, ListTodo, CalendarDays, ArrowUpRight,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { MessageSquare as WhatsAppIcon, ExternalLink, Pencil, Check, X as XIcon } from 'lucide-react';
import { Input as InputField } from '@/components/ui/input';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, subDays, startOfWeek, endOfWeek, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';
import { isTaskOpen } from '@/lib/taskStatus';
import { EmptyHint } from '@/components/ui/loading-skeletons';
import { Eyebrow, SerifDivider, SpeechBubble, EarCard, BigKpi, DisplayItalic, Highlight } from '@/components/editorial';

// ─── Constants ──────────────────────────────────────────────────

const TRANSVERSAIS_CARDS = [
  { num: '01', label: 'Agenda', icon: Calendar, path: '/hub/agenda' },
  { num: '02', label: 'Reuniões', icon: Video, path: '/hub/reunioes' },
  { num: '03', label: 'Projetos', icon: FolderKanban, path: '/hub/projetos' },
  { num: '04', label: 'Tarefas', icon: CheckSquare, path: '/hub/tarefas' },
  { num: '05', label: 'Processos', icon: GitBranch, path: '/hub/processos' },
  { num: '06', label: 'Acessos', icon: Key, path: '/hub/acessos' },
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

const FALLBACK_QUOTE = 'Define a missão, visão e proposta de valor em Definições → Marca.';
function pickQuote(quotes: string[]) {
  if (!quotes.length) return FALLBACK_QUOTE;
  const idx = new Date().getDate() % quotes.length;
  return quotes[idx];
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
      <div className="relative h-14 w-14">
        <svg viewBox="0 0 100 100" className="h-full w-full">
          <circle cx="50" cy="50" r="48" fill="none" stroke="hsl(var(--primary))" strokeOpacity="0.55" strokeWidth="1.5" />
          {Array.from({ length: 12 }).map((_, i) => {
            const angle = (i * 30 - 90) * (Math.PI / 180);
            const x1 = 50 + 40 * Math.cos(angle);
            const y1 = 50 + 40 * Math.sin(angle);
            const x2 = 50 + 45 * Math.cos(angle);
            const y2 = 50 + 45 * Math.sin(angle);
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="hsl(var(--foreground))" strokeOpacity="0.45" strokeWidth="1.5" strokeLinecap="round" />;
          })}
          <line x1="50" y1="50" x2={50 + 25 * Math.cos((hrDeg - 90) * Math.PI / 180)} y2={50 + 25 * Math.sin((hrDeg - 90) * Math.PI / 180)} stroke="hsl(var(--foreground))" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="50" y1="50" x2={50 + 35 * Math.cos((minDeg - 90) * Math.PI / 180)} y2={50 + 35 * Math.sin((minDeg - 90) * Math.PI / 180)} stroke="hsl(var(--foreground))" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="50" y1="50" x2={50 + 38 * Math.cos((secDeg - 90) * Math.PI / 180)} y2={50 + 38 * Math.sin((secDeg - 90) * Math.PI / 180)} stroke="hsl(var(--primary))" strokeOpacity="0.9" strokeWidth="0.8" strokeLinecap="round" />
          <circle cx="50" cy="50" r="2.5" fill="hsl(var(--primary))" />
        </svg>
      </div>
      <span className="font-display text-sm leading-none tabular-nums">{timeStr}</span>
      <span className="font-typewriter text-[9px] text-muted-foreground capitalize">{dateStr}</span>
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
    <div className="flex items-center gap-2">
      {url ? (
        <a href={url} target="_blank" rel="noopener noreferrer" className="font-typewriter text-[11px] uppercase tracking-[0.18em] text-primary hover:text-primary/80 flex items-center gap-2 transition-colors">
          <WhatsAppIcon className="h-3 w-3" /> Grupo da Equipa <ExternalLink className="h-2.5 w-2.5" />
        </a>
      ) : (
        <span className="font-typewriter text-[11px] text-muted-foreground italic flex items-center gap-2"><WhatsAppIcon className="h-3 w-3" /> sem link de grupo</span>
      )}
      {isAdmin && (
        <button className="text-muted-foreground/60 hover:text-primary transition-colors" onClick={() => { setDraft(url); setEditing(true); }}>
          <Pencil className="h-3 w-3" />
        </button>
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
  const todayLabel = format(new Date(), "EEEE, d 'de' MMMM", { locale: pt });

  const { data: brand } = useQuery({
    queryKey: ['business-settings-brand-quotes'],
    queryFn: async () => {
      const { data } = await supabase
        .from('business_settings')
        .select('mission, vision, proposta_unica_valor')
        .limit(1)
        .maybeSingle();
      return data;
    },
  });
  const brandQuotes = [
    (brand as any)?.mission,
    (brand as any)?.vision,
    (brand as any)?.proposta_unica_valor,
  ].map(s => (s || '').trim()).filter(Boolean);
  const heroQuote = pickQuote(brandQuotes);

  return (
    <AppLayout>
      {/* Editorial hero — compact */}
      <div className="relative -mx-4 sm:-mx-8 px-4 sm:px-8 pt-4 pb-5 hq-linen border-b border-border">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
          <div className="sm:col-span-8 min-w-0">
            <Eyebrow>Hub da Equipa · {todayLabel}</Eyebrow>
            <h1 className="font-display text-3xl sm:text-4xl leading-[1.05] mt-1.5 text-foreground">
              {greetingText()},{' '}
              <DisplayItalic className="text-primary">{firstName || 'equipa'}</DisplayItalic>
              <span className="text-primary">.</span>
            </h1>
            <div className="mt-2 flex items-center gap-4 flex-wrap">
              <p className="text-xs text-muted-foreground">
                Onde <Highlight>organizamos</Highlight>, colaboramos e crescemos juntos.
              </p>
              <TeamWhatsAppLink />
            </div>
          </div>
          <div className="sm:col-span-4 flex items-center justify-end gap-4">
            <SpeechBubble variant="gold" tail="bottom-right" className="max-w-[220px] text-right !text-xs !py-2 !px-3 hidden sm:inline-block">
              {heroQuote}
            </SpeechBubble>
            <AnalogClock />
          </div>
        </div>
      </div>

      <div className="space-y-8 pt-6">
        <BackNavigation parentRoute="/secretaria" parentLabel="Secretaria" />

        {/* Active absence alerts */}
        <ActiveAbsenceAlerts />

        {/* KPIs gigantes — editorial */}
        <WeeklySummary />

        <SerifDivider>transversais</SerifDivider>

        {/* Transversais — ear-tagged numbered cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {TRANSVERSAIS_CARDS.map(s => (
            <EarCard key={s.path} ear={s.num} onClick={() => navigate(s.path)} className="p-5">
              <s.icon className="h-5 w-5 text-primary mb-3" strokeWidth={1.5} />
              <div className="font-display text-xl leading-none">{s.label}</div>
              <div className="font-typewriter text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
                abrir <ArrowUpRight className="h-2.5 w-2.5" />
              </div>
            </EarCard>
          ))}
        </div>

        <SerifDivider>departamentos</SerifDivider>

        {/* Departamentos */}
        <DepartamentosColumn />

        <SerifDivider>novidades do mês</SerifDivider>

        {/* Novidades do mês */}
        <NovidadesMes />
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
        <div key={c.id} className="flex items-center gap-3 bg-destructive/5 border-l-2 border-destructive px-4 py-3 text-sm">
          <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
          <span className="font-typewriter text-[12px]">
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
    <div className="hq-linen border border-border rounded-md p-6 space-y-4">
      <div className="flex items-center justify-between">
        <Eyebrow tone="primary">
          <MessageSquare className="h-3 w-3 inline mr-2 -mt-0.5" />
          do mural — últimos 30 dias
        </Eyebrow>
        <button className="hq-btn-vintage-ghost !py-1.5 !px-3 !text-[10px]" onClick={() => navigate('/hub/mural')}>
          ver tudo <ArrowUpRight className="h-3 w-3" />
        </button>
      </div>

      {posts.length === 0 ? (
        <EmptyHint>Sem novidades nos últimos 30 dias.</EmptyHint>
      ) : (
        <div className="divide-y divide-border/60">
          {posts.map((p: any) => (
            <div
              key={p.id}
              className="flex items-center justify-between py-3 cursor-pointer hover:bg-primary/[0.02] -mx-2 px-2 transition-colors"
              onClick={() => navigate('/hub/mural')}
            >
              <div className="flex-1 min-w-0">
                <p className="font-display text-base truncate">{p.title}</p>
                <p className="font-typewriter text-[10px] text-muted-foreground mt-0.5">
                  {getAuthorName(p.author_id)} · {format(new Date(p.created_at), "d MMM", { locale: pt })}
                </p>
              </div>
              <Badge variant="outline" className="text-[10px] font-typewriter uppercase tracking-wider shrink-0 ml-2 rounded-sm">{p.category}</Badge>
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
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
      {DEPARTMENT_CARDS.map(d => (
        <DeptCard key={d.key} d={d} canAccess={canAccess(d.key)} navigate={navigate} />
      ))}
      </div>
  );
}

function DeptCard({ d, canAccess, navigate }: { d: typeof DEPARTMENT_CARDS[number]; canAccess: boolean; navigate: any }) {
  return (
    <div
      className={`rounded-md border-2 bg-card p-4 transition-colors ${canAccess ? 'cursor-pointer border-primary/25 hover:border-primary' : 'opacity-50 cursor-not-allowed border-dashed border-border'}`}
      onClick={canAccess ? () => navigate(d.path) : undefined}
    >
      <div className="flex flex-col items-start gap-2">
        {canAccess ? <d.icon className="h-4 w-4 text-primary" strokeWidth={1.5} /> : <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
        <span className="font-display text-base leading-tight">{d.label}</span>
      </div>
    </div>
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
    <div className="grid grid-cols-1 sm:grid-cols-12 gap-6 items-stretch">
      <div
        className="sm:col-span-3 border-l-2 border-primary pl-5 cursor-pointer group"
        onClick={() => navigate('/hub/tarefas')}
      >
        <BigKpi
          value={pendingTasks.length}
          label={<><ListTodo className="h-3 w-3 inline mr-1.5 -mt-0.5" />tarefas esta semana</>}
          hint={pendingTasks.slice(0, 2).map((t: any) => t.name).join(' · ') || 'sem tarefas pendentes'}
        />
      </div>
      <div
        className="sm:col-span-3 border-l-2 border-[hsl(var(--brand-gold))] pl-5 cursor-pointer"
        onClick={() => navigate('/hub/projetos')}
      >
        <BigKpi
          value={projects.length}
          label={<><FolderKanban className="h-3 w-3 inline mr-1.5 -mt-0.5" />projetos ativos</>}
          hint={projects.slice(0, 2).map((p: any) => p.name).join(' · ') || 'sem projetos em curso'}
        />
      </div>
      <div
        className="sm:col-span-3 border-l-2 border-[hsl(var(--brand-mocha))] pl-5 cursor-pointer"
        onClick={() => navigate('/hub/agenda')}
      >
        <BigKpi
          value={events.length}
          label={<><CalendarDays className="h-3 w-3 inline mr-1.5 -mt-0.5" />eventos esta semana</>}
          hint={events.slice(0, 2).map((e: any) => e.title).join(' · ') || 'agenda livre'}
        />
      </div>
      <div className="sm:col-span-3 hq-linen border-2 border-primary/30 rounded-md p-5 flex flex-col justify-center">
        <Eyebrow>esta semana</Eyebrow>
        <p className="hq-display-italic text-base mt-2 leading-snug text-foreground/80">
          {pendingTasks.length === 0 && events.length === 0
            ? '"Espaço para respirar — usa-o."'
            : `"${pendingTasks.length} tarefas, ${events.length} compromissos. Boa semana, ${''}equipa."`}
        </p>
      </div>
    </div>
  );
}
