import { useState, useMemo } from 'react';
import { BackNavigation } from '@/components/BackNavigation';
import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Clock, Briefcase, AlertTriangle, Plus, BarChart3, Timer,
  ArrowLeftRight, Building2, Calculator, Users, TrendingUp,
  ArrowRight, CheckCircle2, Trash2, Cpu
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, subWeeks } from 'date-fns';
import { pt } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { CapacitySimulator } from '@/components/productivity/CapacitySimulator';
import { useProducts, Product } from '@/hooks/useProducts';
import { useClients } from '@/hooks/useClients';

const CATEGORIES = [
  { value: 'cliente', label: 'Cliente' },
  { value: 'interno', label: 'Interno' },
  { value: 'reuniao', label: 'Reunião' },
  { value: 'conteudos', label: 'Conteúdos' },
  { value: 'formacao', label: 'Formação' },
  { value: 'outro', label: 'Outro' },
];

const PERIOD_FILTERS = [
  { value: 'week', label: 'Esta semana' },
  { value: 'month', label: 'Este mês' },
  { value: 'quarter', label: 'Este trimestre' },
  { value: 'year', label: 'Este ano' },
];

const PIE_COLORS = ['hsl(var(--primary))', 'hsl(var(--accent))', '#f59e0b', '#8b5cf6', '#06b6d4', '#94a3b8'];

const WEEKS_PER_MONTH = 4.33;

function getDateRange(period: string) {
  const now = new Date();
  switch (period) {
    case 'week': return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
    case 'month': return { start: startOfMonth(now), end: endOfMonth(now) };
    case 'quarter': return { start: startOfQuarter(now), end: endOfQuarter(now) };
    case 'year': return { start: startOfYear(now), end: endOfYear(now) };
    default: return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
  }
}

function weeksInPeriod(period: string) {
  const { start, end } = getDateRange(period);
  return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000)));
}

function catLabel(v: string) { return CATEGORIES.find(c => c.value === v)?.label || v; }

/* ═══════════════════════════════════════════════════ */
/*  MAIN PAGE                                         */
/* ═══════════════════════════════════════════════════ */
export default function ExecutiveProductivity() {
  const qc = useQueryClient();

  const members = useQuery({
    queryKey: ['team', 'members'],
    queryFn: async () => {
      const { data } = await supabase.from('team_members').select('*').order('full_name');
      return (data || []) as any[];
    },
  });

  const entries = useQuery({
    queryKey: ['time_entries'],
    queryFn: async () => {
      const { data } = await supabase.from('time_entries').select('*').order('entry_date', { ascending: false });
      return (data || []) as any[];
    },
  });

  const clientsQ = useQuery({
    queryKey: ['clients_list'],
    queryFn: async () => {
      const { data } = await supabase.from('clients').select('id, full_name, current_product, status, dp');
      return (data || []) as any[];
    },
  });

  const productsQ = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const { data } = await supabase.from('products').select('id, name, monthly_hours_per_client');
      return (data || []) as any[];
    },
  });

  const projects = useQuery({
    queryKey: ['projects_list'],
    queryFn: async () => {
      const { data } = await supabase.from('projects').select('id, name, client_name, type');
      return (data || []) as any[];
    },
  });

  const tasks = useQuery({
    queryKey: ['tasks_list'],
    queryFn: async () => {
      const { data } = await supabase.from('tasks').select('id, name, assigned_to, original_assignee, project_id, department, estimated_time, deadline, status, priority, notes, created_at, updated_at');
      return (data || []) as any[];
    },
  });

  const capacityScenarios = useQuery({
    queryKey: ['capacity_scenarios'],
    queryFn: async () => {
      const { data } = await supabase.from('capacity_scenarios').select('*').order('created_at', { ascending: false }).limit(1);
      return (data || []) as any[];
    },
  });

  const capacityProducts = useQuery({
    queryKey: ['capacity_scenario_products'],
    queryFn: async () => {
      const { data } = await supabase.from('capacity_scenario_products').select('*');
      return (data || []) as any[];
    },
  });

  return (
    <AppLayout>
      <div className="space-y-6">
        <BackNavigation />
        <PageHeader title="Produtividade & Capacidade" subtitle="Tempo, ocupação, capacidade e simulações de crescimento" />

        <MainTabs
          members={members.data || []}
          entries={entries.data || []}
          clients={clientsQ.data || []}
          products={productsQ.data || []}
          projects={projects.data || []}
          tasks={tasks.data || []}
          scenario={capacityScenarios.data?.[0] || null}
          scenarioProducts={capacityProducts.data || []}
        />
      </div>
    </AppLayout>
  );
}

/* ═══════════════════════════════════════════════════ */
/*  MAIN TABS                                         */
/* ═══════════════════════════════════════════════════ */
const MAIN_TABS = [
  { value: 'overview', label: 'Visão Geral', icon: BarChart3 },
  { value: 'time', label: 'Tempo', icon: Clock },
  { value: 'capacity', label: 'Capacidade', icon: Building2 },
  { value: 'simulation', label: 'Simulação', icon: Cpu },
  { value: 'overload', label: 'Tarefas & Sobrecarga', icon: AlertTriangle },
];

function MainTabs({ members, entries, clients, products, projects, tasks, scenario, scenarioProducts }: {
  members: any[]; entries: any[]; clients: any[]; products: any[]; projects: any[]; tasks: any[]; scenario: any; scenarioProducts: any[];
}) {
  const [active, setActive] = useState('overview');

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-1.5">
        {MAIN_TABS.map(t => (
          <button
            key={t.value}
            onClick={() => setActive(t.value)}
            className={`inline-flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-sm font-medium border transition-all ${
              active === t.value
                ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                : 'border-secondary bg-background text-secondary-foreground hover:bg-muted'
            }`}
          >
            <t.icon className="h-3.5 w-3.5" />{t.label}
          </button>
        ))}
      </div>

      {active === 'overview' && <OverviewTab entries={entries} members={members} />}
      {active === 'time' && <TimeTab entries={entries} members={members} clients={clients} projects={projects} tasks={tasks} scenario={scenario} scenarioProducts={scenarioProducts} />}
      {active === 'capacity' && <CapacityTab members={members} entries={entries} clients={clients} products={products} scenario={scenario} scenarioProducts={scenarioProducts} />}
      {active === 'simulation' && <SimulationTab members={members} entries={entries} clients={clients} products={products} />}
      {active === 'overload' && <OverloadTab entries={entries} members={members} tasks={tasks} />}
    </div>
  );
}

/* ═══════════════════════════════════════════════════ */
/*  TAB 1: VISÃO GERAL                                */
/* ═══════════════════════════════════════════════════ */
function OverviewTab({ entries, members }: { entries: any[]; members: any[] }) {
  const { start, end } = getDateRange('week');
  const weekEntries = entries.filter(e => {
    const d = new Date(e.entry_date);
    return d >= start && d <= end;
  });

  const totalHours = weekEntries.reduce((s, e) => s + Number(e.duration || 0), 0);
  const clientHours = weekEntries.filter(e => e.client_id).reduce((s, e) => s + Number(e.duration || 0), 0);
  const internalHours = totalHours - clientHours;

  const hoursByMember: Record<string, number> = {};
  weekEntries.forEach(e => {
    const mid = e.member_id || 'unknown';
    hoursByMember[mid] = (hoursByMember[mid] || 0) + Number(e.duration || 0);
  });

  const topMemberId = Object.entries(hoursByMember).sort((a, b) => b[1] - a[1])[0]?.[0];
  const topMember = members.find(m => m.id === topMemberId);

  const barData = members.map(m => ({
    name: m.full_name?.split(' ')[0] || 'N/A',
    horas: Number((hoursByMember[m.id] || 0).toFixed(1)),
  }));

  const catDist: Record<string, number> = {};
  weekEntries.forEach(e => {
    const c = e.category || 'outro';
    catDist[c] = (catDist[c] || 0) + Number(e.duration || 0);
  });
  const pieData = Object.entries(catDist).map(([key, val]) => ({ name: catLabel(key), value: Number(val.toFixed(1)) }));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Total de horas (semana)</p>
          <p className="text-2xl font-bold">{totalHours.toFixed(1)}h</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Trabalho de cliente</p>
          <p className="text-2xl font-bold">{clientHours.toFixed(1)}h</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Trabalho interno</p>
          <p className="text-2xl font-bold">{internalHours.toFixed(1)}h</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Mais horas esta semana</p>
          <p className="text-2xl font-bold">{topMember?.full_name?.split(' ')[0] || '—'}</p>
        </CardContent></Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Horas por membro (semana)</CardTitle></CardHeader>
          <CardContent className="h-64">
            {barData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData}><XAxis dataKey="name" fontSize={12} /><YAxis fontSize={12} /><Tooltip /><Bar dataKey="horas" fill="hsl(var(--primary))" radius={[4,4,0,0]} /></BarChart>
              </ResponsiveContainer>
            ) : <p className="text-sm text-muted-foreground text-center pt-20">Sem dados</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Distribuição por categoria</CardTitle></CardHeader>
          <CardContent className="h-64">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart><Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} label={({ name, value }) => `${name}: ${value}h`}>
                  {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie><Legend /></PieChart>
              </ResponsiveContainer>
            ) : <p className="text-sm text-muted-foreground text-center pt-20">Sem dados</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════ */
/*  TAB 2: TEMPO (Interno vs Cliente + Por Cliente + Registo) */
/* ═══════════════════════════════════════════════════ */
function TimeTab({ entries, members, clients, projects, tasks, scenario, scenarioProducts }: {
  entries: any[]; members: any[]; clients: any[]; projects: any[]; tasks: any[]; scenario: any; scenarioProducts: any[];
}) {
  return (
    <Tabs defaultValue="split" className="space-y-4">
      <TabsList className="flex-wrap">
        <TabsTrigger value="split"><ArrowLeftRight className="h-3.5 w-3.5 mr-1.5" />Interno vs Cliente</TabsTrigger>
        <TabsTrigger value="by-client"><Briefcase className="h-3.5 w-3.5 mr-1.5" />Tempo por Cliente</TabsTrigger>
        <TabsTrigger value="log"><Timer className="h-3.5 w-3.5 mr-1.5" />Registo de Tempo</TabsTrigger>
      </TabsList>
      <TabsContent value="split">
        <TimeSplitView entries={entries} members={members} scenario={scenario} scenarioProducts={scenarioProducts} />
      </TabsContent>
      <TabsContent value="by-client">
        <ByClientView entries={entries} clients={clients} />
      </TabsContent>
      <TabsContent value="log">
        <TimeLogView entries={entries} members={members} clients={clients} projects={projects} tasks={tasks} />
      </TabsContent>
    </Tabs>
  );
}

/* ── Interno vs Cliente ── */
function TimeSplitView({ entries, members, scenario, scenarioProducts }: { entries: any[]; members: any[]; scenario: any; scenarioProducts: any[] }) {
  const [period, setPeriod] = useState('month');
  const { start, end } = getDateRange(period);

  const filtered = entries.filter(e => {
    const d = new Date(e.entry_date);
    return d >= start && d <= end;
  });

  const totalHours = filtered.reduce((s, e) => s + Number(e.duration || 0), 0);
  const clientHours = filtered.filter(e => e.client_id || e.category === 'cliente').reduce((s, e) => s + Number(e.duration || 0), 0);
  const internalHours = totalHours - clientHours;

  const clientPct = totalHours > 0 ? Math.round((clientHours / totalHours) * 100) : 0;
  const internalPct = totalHours > 0 ? 100 - clientPct : 0;

  const planned = useMemo(() => {
    if (!scenario) return null;
    const adminPct = Number(scenario.admin_percent || 0);
    const businessPct = Number(scenario.business_percent || 0);
    const internalPlanned = adminPct + businessPct;
    const clientPlanned = 100 - internalPlanned;
    const totalTeamHours = Number(scenario.useful_hours_per_month || 0) * Number(scenario.team_size || 1);
    return { internalPct: internalPlanned, clientPct: clientPlanned, adminPct, businessPct, totalTeamHours, scenarioName: scenario.name };
  }, [scenario]);

  const monthlyTrend = useMemo(() => {
    const now = new Date();
    const months: { month: string; cliente: number; interno: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const m = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mEnd = endOfMonth(m);
      const mEntries = entries.filter(e => { const d = new Date(e.entry_date); return d >= m && d <= mEnd; });
      const total = mEntries.reduce((s, e) => s + Number(e.duration || 0), 0);
      const client = mEntries.filter(e => e.client_id || e.category === 'cliente').reduce((s, e) => s + Number(e.duration || 0), 0);
      months.push({ month: format(m, 'MMM', { locale: pt }), cliente: Number(client.toFixed(1)), interno: Number((total - client).toFixed(1)) });
    }
    return months;
  }, [entries]);

  const memberSplit = useMemo(() => {
    const activeMembers = members.filter(m => m.status === 'ativo');
    return activeMembers.map(m => {
      const mEntries = filtered.filter(e => e.member_id === m.id);
      const total = mEntries.reduce((s: number, e: any) => s + Number(e.duration || 0), 0);
      const client = mEntries.filter((e: any) => e.client_id || e.category === 'cliente').reduce((s: number, e: any) => s + Number(e.duration || 0), 0);
      return { id: m.id, name: m.full_name, total, client, internal: total - client, clientPct: total > 0 ? Math.round((client / total) * 100) : 0 };
    }).filter(m => m.total > 0).sort((a, b) => b.total - a.total);
  }, [filtered, members]);

  const deviation = planned ? { clientDiff: clientPct - planned.clientPct, internalDiff: internalPct - planned.internalPct } : null;

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        {PERIOD_FILTERS.map(f => (
          <Button key={f.value} size="sm" variant={period === f.value ? 'default' : 'outline'} onClick={() => setPeriod(f.value)}>{f.label}</Button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total registado</p><p className="text-2xl font-bold">{totalHours.toFixed(1)}h</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Tempo em cliente</p><p className="text-2xl font-bold">{clientHours.toFixed(1)}h</p><p className="text-xs text-muted-foreground">{clientPct}% do total</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Tempo interno</p><p className="text-2xl font-bold">{internalHours.toFixed(1)}h</p><p className="text-xs text-muted-foreground">{internalPct}% do total</p></CardContent></Card>
        {planned && (
          <Card className={deviation && Math.abs(deviation.clientDiff) > 10 ? 'border-amber-400/50' : ''}>
            <CardContent className="p-4"><p className="text-xs text-muted-foreground">Desvio do planeado</p><p className="text-2xl font-bold">{deviation ? `${deviation.clientDiff > 0 ? '+' : ''}${deviation.clientDiff}%` : '—'}</p><p className="text-xs text-muted-foreground">Cliente: planeado {planned.clientPct}%</p></CardContent>
          </Card>
        )}
      </div>

      {planned && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><ArrowLeftRight className="h-4 w-4" />Real vs Planeado ({planned.scenarioName})</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs mb-1"><span>Tempo em cliente</span><span>Real: {clientPct}% | Planeado: {planned.clientPct}%</span></div>
                <div className="relative h-6 rounded-full bg-muted overflow-hidden">
                  <div className="absolute inset-y-0 left-0 bg-primary/30 rounded-full" style={{ width: `${planned.clientPct}%` }} />
                  <div className="absolute inset-y-0 left-0 bg-primary rounded-full transition-all" style={{ width: `${clientPct}%` }} />
                  <div className="absolute inset-y-0 flex items-center px-2 text-[10px] font-medium text-primary-foreground">{clientPct}%</div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1"><span>Tempo interno</span><span>Real: {internalPct}% | Planeado: {planned.internalPct}%</span></div>
                <div className="relative h-6 rounded-full bg-muted overflow-hidden">
                  <div className="absolute inset-y-0 left-0 bg-accent/50 rounded-full" style={{ width: `${planned.internalPct}%` }} />
                  <div className="absolute inset-y-0 left-0 bg-accent rounded-full transition-all" style={{ width: `${internalPct}%` }} />
                  <div className="absolute inset-y-0 flex items-center px-2 text-[10px] font-medium">{internalPct}%</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Tendência mensal (últimos 6 meses)</CardTitle></CardHeader>
        <CardContent className="h-64">
          {monthlyTrend.some(m => m.cliente > 0 || m.interno > 0) ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyTrend}>
                <XAxis dataKey="month" fontSize={12} /><YAxis fontSize={12} /><Tooltip /><Legend />
                <Bar dataKey="cliente" name="Cliente" fill="hsl(var(--primary))" stackId="a" />
                <Bar dataKey="interno" name="Interno" fill="hsl(var(--accent))" stackId="a" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-muted-foreground text-center pt-20">Sem dados</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Divisão por membro</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Membro</TableHead><TableHead className="text-right">Total</TableHead><TableHead className="text-right">Cliente</TableHead><TableHead className="text-right">Interno</TableHead><TableHead className="text-right">% Cliente</TableHead><TableHead>Distribuição</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {memberSplit.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">Sem registos no período</TableCell></TableRow>
              ) : memberSplit.map(m => (
                <TableRow key={m.id}>
                  <TableCell className="text-sm font-medium">{m.name}</TableCell>
                  <TableCell className="text-sm text-right">{m.total.toFixed(1)}h</TableCell>
                  <TableCell className="text-sm text-right">{m.client.toFixed(1)}h</TableCell>
                  <TableCell className="text-sm text-right">{m.internal.toFixed(1)}h</TableCell>
                  <TableCell className="text-sm text-right">{m.clientPct}%</TableCell>
                  <TableCell>
                    <div className="flex h-2.5 w-24 rounded-full overflow-hidden bg-muted">
                      <div className="bg-primary h-full" style={{ width: `${m.clientPct}%` }} />
                      <div className="bg-accent h-full" style={{ width: `${100 - m.clientPct}%` }} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

/* ── Tempo por Cliente ── */
function ByClientView({ entries, clients }: { entries: any[]; clients: any[] }) {
  const [period, setPeriod] = useState('month');
  const { start, end } = getDateRange(period);

  const filtered = entries.filter(e => { const d = new Date(e.entry_date); return d >= start && d <= end && e.client_id; });

  const byClient: Record<string, { hours: number; sessions: number; last: string }> = {};
  filtered.forEach(e => {
    const cid = e.client_id;
    if (!byClient[cid]) byClient[cid] = { hours: 0, sessions: 0, last: '' };
    byClient[cid].hours += Number(e.duration || 0);
    byClient[cid].sessions += 1;
    if (!byClient[cid].last || e.entry_date > byClient[cid].last) byClient[cid].last = e.entry_date;
  });

  const weeks = weeksInPeriod(period);
  const rows = Object.entries(byClient).map(([cid, data]) => {
    const client = clients.find(c => c.id === cid);
    return { cid, name: client?.full_name || 'Desconhecido', product: client?.current_product || '—', ...data, avg: data.hours / weeks };
  }).sort((a, b) => b.hours - a.hours);

  const chartData = rows.slice(0, 10).map(r => ({ name: r.name.split(' ')[0], horas: Number(r.hours.toFixed(1)) }));

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {PERIOD_FILTERS.map(f => (
          <Button key={f.value} size="sm" variant={period === f.value ? 'default' : 'outline'} onClick={() => setPeriod(f.value)}>{f.label}</Button>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Cliente</TableHead><TableHead>Produto</TableHead><TableHead className="text-right">Horas</TableHead><TableHead className="text-right">Sessões</TableHead><TableHead className="text-right">Média/sem</TableHead><TableHead>Último</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">Sem registos no período</TableCell></TableRow>
                ) : rows.map(r => (
                  <TableRow key={r.cid}>
                    <TableCell className="text-sm font-medium">{r.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{r.product}</TableCell>
                    <TableCell className="text-sm text-right">{r.hours.toFixed(1)}h</TableCell>
                    <TableCell className="text-sm text-right">{r.sessions}</TableCell>
                    <TableCell className="text-sm text-right">{r.avg.toFixed(1)}h</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.last ? format(new Date(r.last), 'dd/MM') : '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Horas por cliente</CardTitle></CardHeader>
          <CardContent className="h-64">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical"><XAxis type="number" fontSize={12} /><YAxis type="category" dataKey="name" fontSize={12} width={80} /><Tooltip /><Bar dataKey="horas" fill="hsl(var(--primary))" radius={[0,4,4,0]} /></BarChart>
              </ResponsiveContainer>
            ) : <p className="text-sm text-muted-foreground text-center pt-20">Sem dados</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ── Registo de Tempo ── */
function TimeLogView({ entries, members, clients, projects, tasks }: { entries: any[]; members: any[]; clients: any[]; projects: any[]; tasks: any[] }) {
  const qc = useQueryClient();
  const [filter, setFilter] = useState('all');
  const [filterMember, setFilterMember] = useState('');
  const [filterClient, setFilterClient] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);

  const [newDate, setNewDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [newMember, setNewMember] = useState('');
  const [newDuration, setNewDuration] = useState('');
  const [newCategory, setNewCategory] = useState('interno');
  const [newTask, setNewTask] = useState('');
  const [newProject, setNewProject] = useState('');
  const [newClient, setNewClient] = useState('');
  const [newDesc, setNewDesc] = useState('');

  const addEntry = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('time_entries').insert({
        entry_date: newDate, member_id: newMember || null, duration: parseFloat(newDuration) || 0,
        category: newCategory, task_id: newTask || null, project_id: newProject || null,
        client_id: newClient || null, description: newDesc || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['time_entries'] });
      toast.success('Registo adicionado');
      setDialogOpen(false);
      setNewDuration(''); setNewDesc(''); setNewTask(''); setNewProject(''); setNewClient('');
    },
    onError: () => toast.error('Erro ao guardar'),
  });

  const deleteEntry = useMutation({
    mutationFn: async (id: string) => { await supabase.from('time_entries').delete().eq('id', id); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['time_entries'] }); toast.success('Removido'); },
  });

  const filtered = useMemo(() => {
    let result = [...entries];
    if (filter === 'week') { const { start, end } = getDateRange('week'); result = result.filter(e => { const d = new Date(e.entry_date); return d >= start && d <= end; }); }
    else if (filter === 'month') { const { start, end } = getDateRange('month'); result = result.filter(e => { const d = new Date(e.entry_date); return d >= start && d <= end; }); }
    if (filterMember) result = result.filter(e => e.member_id === filterMember);
    if (filterClient) result = result.filter(e => e.client_id === filterClient);
    return result;
  }, [entries, filter, filterMember, filterClient]);

  const totalHours = filtered.reduce((s, e) => s + Number(e.duration || 0), 0);

  const handleProjectChange = (pid: string) => {
    setNewProject(pid);
    if (pid) {
      const proj = projects.find((p: any) => p.id === pid);
      if (proj?.client_name) { const client = clients.find((c: any) => c.full_name === proj.client_name); if (client) setNewClient(client.id); }
    }
  };

  const memberName = (id: string) => members.find(m => m.id === id)?.full_name || '—';
  const clientName = (id: string) => clients.find(c => c.id === id)?.full_name || '—';
  const taskName = (id: string) => tasks.find(t => t.id === id)?.name || '—';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-2 flex-wrap">
          {[{ v: 'all', l: 'Todos' }, { v: 'week', l: 'Esta semana' }, { v: 'month', l: 'Este mês' }].map(f => (
            <Button key={f.v} size="sm" variant={filter === f.v ? 'default' : 'outline'} onClick={() => setFilter(f.v)}>{f.l}</Button>
          ))}
          <Select value={filterMember} onValueChange={v => setFilterMember(v === 'all' ? '' : v)}>
            <SelectTrigger className="h-8 w-40 text-sm"><SelectValue placeholder="Por membro" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {members.map(m => <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterClient} onValueChange={v => setFilterClient(v === 'all' ? '' : v)}>
            <SelectTrigger className="h-8 w-40 text-sm"><SelectValue placeholder="Por cliente" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Total: <strong>{totalHours.toFixed(1)}h</strong></span>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="h-3 w-3 mr-1" /> Novo Registo</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Novo Registo de Tempo</DialogTitle></DialogHeader>
              <div className="grid gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-xs font-medium text-muted-foreground">Data</label><Input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} className="h-8 text-sm" /></div>
                  <div><label className="text-xs font-medium text-muted-foreground">Duração (horas)</label><Input type="number" step="0.25" min="0" value={newDuration} onChange={e => setNewDuration(e.target.value)} placeholder="1.5" className="h-8 text-sm" /></div>
                </div>
                <div><label className="text-xs font-medium text-muted-foreground">Membro</label>
                  <Select value={newMember} onValueChange={setNewMember}><SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecionar membro" /></SelectTrigger><SelectContent>{members.map(m => <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>)}</SelectContent></Select>
                </div>
                <div><label className="text-xs font-medium text-muted-foreground">Categoria</label>
                  <Select value={newCategory} onValueChange={setNewCategory}><SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger><SelectContent>{CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent></Select>
                </div>
                <div><label className="text-xs font-medium text-muted-foreground">Projeto (opcional)</label>
                  <Select value={newProject} onValueChange={handleProjectChange}><SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Nenhum" /></SelectTrigger><SelectContent><SelectItem value="none">Nenhum</SelectItem>{projects.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select>
                </div>
                <div><label className="text-xs font-medium text-muted-foreground">Cliente (opcional)</label>
                  <Select value={newClient} onValueChange={setNewClient}><SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Nenhum" /></SelectTrigger><SelectContent><SelectItem value="none">Nenhum</SelectItem>{clients.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}</SelectContent></Select>
                </div>
                <div><label className="text-xs font-medium text-muted-foreground">Tarefa (opcional)</label>
                  <Select value={newTask} onValueChange={setNewTask}><SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Nenhuma" /></SelectTrigger><SelectContent><SelectItem value="none">Nenhuma</SelectItem>{tasks.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent></Select>
                </div>
                <div><label className="text-xs font-medium text-muted-foreground">Descrição</label><Textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Descrição do trabalho..." className="min-h-[60px] text-sm" /></div>
                <Button onClick={() => addEntry.mutate()} disabled={!newDuration || !newMember}>Guardar</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>ID</TableHead><TableHead>Data</TableHead><TableHead>Membro</TableHead><TableHead className="text-right">Duração</TableHead><TableHead>Categoria</TableHead><TableHead>Tarefa</TableHead><TableHead>Cliente</TableHead><TableHead>Descrição</TableHead><TableHead className="w-8"></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center text-sm text-muted-foreground py-8">Sem registos de tempo</TableCell></TableRow>
              ) : filtered.map((e: any) => (
                <TableRow key={e.id}>
                  <TableCell className="text-xs text-muted-foreground font-mono">{e.entry_id}</TableCell>
                  <TableCell className="text-sm">{format(new Date(e.entry_date), 'dd/MM/yyyy')}</TableCell>
                  <TableCell className="text-sm">{e.member_id ? memberName(e.member_id) : '—'}</TableCell>
                  <TableCell className="text-sm text-right font-medium">{Number(e.duration).toFixed(1)}h</TableCell>
                  <TableCell><Badge variant="secondary" className="text-xs">{catLabel(e.category)}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[120px] truncate">{e.task_id ? taskName(e.task_id) : '—'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{e.client_id ? clientName(e.client_id) : '—'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">{e.description || '—'}</TableCell>
                  <TableCell><button onClick={() => deleteEntry.mutate(e.id)} className="text-muted-foreground hover:text-destructive"><Clock className="h-3 w-3" /></button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

/* ═══════════════════════════════════════════════════ */
/*  TAB 3: CAPACIDADE                                  */
/*  (Ocupação da equipa + Simulador de capacidade/clientes) */
/* ═══════════════════════════════════════════════════ */
function CapacityTab({ members, entries, clients, products, scenario, scenarioProducts }: {
  members: any[]; entries: any[]; clients: any[]; products: any[]; scenario: any; scenarioProducts: any[];
}) {
  return (
    <Tabs defaultValue="team" className="space-y-4">
      <TabsList className="flex-wrap">
        <TabsTrigger value="team"><Users className="h-3.5 w-3.5 mr-1.5" />Ocupação da Equipa</TabsTrigger>
        <TabsTrigger value="simulator"><Calculator className="h-3.5 w-3.5 mr-1.5" />Simulador de Clientes</TabsTrigger>
      </TabsList>
      <TabsContent value="team">
        <TeamCapacityView members={members} entries={entries} />
      </TabsContent>
      <TabsContent value="simulator">
        <CapacitySimulatorView members={members} clients={clients} products={products} scenario={scenario} scenarioProducts={scenarioProducts} />
      </TabsContent>
    </Tabs>
  );
}

/* ── Ocupação da Equipa (was CompanyCapacityTab) ── */
function TeamCapacityView({ members, entries }: { members: any[]; entries: any[] }) {
  const activeMembers = members.filter(m => m.status === 'ativo' || m.status === 'prestador');
  const totalWeeklyHours = activeMembers.reduce((s, m) => s + (Number(m.expected_weekly_hours) || 0), 0);
  const totalMonthlyHours = Math.round(totalWeeklyHours * WEEKS_PER_MONTH);

  const { start, end } = getDateRange('month');
  const monthEntries = entries.filter(e => { const d = new Date(e.entry_date); return d >= start && d <= end; });

  const CLIENT_WORK_AREAS = ['cliente_servico', 'cliente_comercial', 'cliente_administrativo'];

  const memberCapacity = useMemo(() => {
    return activeMembers.map(m => {
      const weeklyH = Number(m.expected_weekly_hours) || 0;
      const monthlyH = Math.round(weeklyH * WEEKS_PER_MONTH);
      const actualH = monthEntries.filter(e => e.member_id === m.id).reduce((s: number, e: any) => s + Number(e.duration || 0), 0);
      const clientH = monthEntries.filter(e => e.member_id === m.id && (e.client_id || e.category === 'cliente')).reduce((s: number, e: any) => s + Number(e.duration || 0), 0);
      const internalH = actualH - clientH;
      const usagePct = monthlyH > 0 ? Math.round((actualH / monthlyH) * 100) : 0;
      const areas: string[] = Array.isArray((m as any).work_areas) ? (m as any).work_areas : [];
      const isClientFacing = areas.some(a => CLIENT_WORK_AREAS.includes(a));
      const areaLabel = isClientFacing ? 'Cliente' : areas.includes('interno') ? 'Interno' : '—';
      return { id: m.id, name: m.full_name, role: m.role_title || '—', weeklyH, monthlyH, actualH: Number(actualH.toFixed(1)), clientH: Number(clientH.toFixed(1)), internalH: Number(internalH.toFixed(1)), usagePct, remainingH: Number((monthlyH - actualH).toFixed(1)), areaLabel, isClientFacing };
    }).sort((a, b) => b.usagePct - a.usagePct);
  }, [activeMembers, monthEntries]);

  const totalActual = memberCapacity.reduce((s, m) => s + m.actualH, 0);
  const totalClientH = memberCapacity.reduce((s, m) => s + m.clientH, 0);
  const totalInternalH = memberCapacity.reduce((s, m) => s + m.internalH, 0);
  const overallUsage = totalMonthlyHours > 0 ? Math.round((totalActual / totalMonthlyHours) * 100) : 0;
  const totalRemainingH = totalMonthlyHours - totalActual;

  const chartData = memberCapacity.map(m => ({ name: m.name.split(' ')[0], capacidade: m.monthlyH, registado: m.actualH }));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Equipa ativa</p><p className="text-2xl font-bold">{activeMembers.length}</p><p className="text-xs text-muted-foreground">membros</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Capacidade mensal</p><p className="text-2xl font-bold">{totalMonthlyHours}h</p><p className="text-xs text-muted-foreground">{totalWeeklyHours}h/semana</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Registado (mês)</p><p className="text-2xl font-bold">{totalActual.toFixed(1)}h</p><p className="text-xs"><span className="text-primary font-medium">{totalClientH.toFixed(1)}h cliente</span> <span className="text-muted-foreground">+ {totalInternalH.toFixed(1)}h interno</span></p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Ocupação geral</p><p className={`text-2xl font-bold ${overallUsage > 100 ? 'text-destructive' : overallUsage > 85 ? 'text-amber-500' : 'text-foreground'}`}>{overallUsage}%</p><Progress value={Math.min(overallUsage, 100)} className="h-2 mt-1" /></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Horas restantes</p><p className={`text-2xl font-bold ${totalRemainingH < 0 ? 'text-destructive' : 'text-foreground'}`}>{totalRemainingH.toFixed(0)}h</p><p className="text-xs text-muted-foreground">este mês</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Capacidade vs Registado por membro (mês atual)</CardTitle></CardHeader>
        <CardContent className="h-64">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis dataKey="name" fontSize={12} /><YAxis fontSize={12} /><Tooltip /><Legend />
                <Bar dataKey="capacidade" name="Capacidade" fill="hsl(var(--muted-foreground) / 0.2)" radius={[4,4,0,0]} />
                <Bar dataKey="registado" name="Registado" fill="hsl(var(--primary))" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-muted-foreground text-center pt-20">Sem dados</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Detalhe por membro</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Membro</TableHead><TableHead>Função</TableHead><TableHead>Área</TableHead><TableHead className="text-right">h/semana</TableHead><TableHead className="text-right">Capacidade/mês</TableHead><TableHead className="text-right">Cliente</TableHead><TableHead className="text-right">Interno</TableHead><TableHead className="text-right">Restante</TableHead><TableHead className="text-right">Ocupação</TableHead><TableHead>Barra</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {memberCapacity.map(m => (
                <TableRow key={m.id}>
                  <TableCell className="text-sm font-medium">{m.name}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{m.role}</TableCell>
                  <TableCell>
                    {m.areaLabel !== '—' && (
                      <Badge variant={m.isClientFacing ? 'default' : 'secondary'} className="text-[10px]">{m.areaLabel}</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-right tabular-nums">{m.weeklyH}h</TableCell>
                  <TableCell className="text-sm text-right tabular-nums">{m.monthlyH}h</TableCell>
                  <TableCell className="text-sm text-right tabular-nums text-primary">{m.clientH}h</TableCell>
                  <TableCell className="text-sm text-right tabular-nums text-muted-foreground">{m.internalH}h</TableCell>
                  <TableCell className={`text-sm text-right tabular-nums ${m.remainingH < 0 ? 'text-destructive' : ''}`}>{m.remainingH}h</TableCell>
                  <TableCell className={`text-sm text-right font-medium ${m.usagePct > 100 ? 'text-destructive' : m.usagePct > 85 ? 'text-amber-500' : ''}`}>{m.usagePct}%</TableCell>
                  <TableCell>
                    <div className="flex h-2.5 w-24 rounded-full overflow-hidden bg-muted">
                      <div className={`h-full rounded-full ${m.usagePct > 100 ? 'bg-destructive' : m.usagePct > 85 ? 'bg-amber-500' : 'bg-primary'}`} style={{ width: `${Math.min(m.usagePct, 100)}%` }} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {memberCapacity.length === 0 && (
                <TableRow><TableCell colSpan={10} className="text-center text-sm text-muted-foreground py-8">Sem membros ativos</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {memberCapacity.some(m => m.usagePct > 100) && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div className="text-sm space-y-1">
              <p className="font-medium">Membros em sobre-capacidade:</p>
              <ul className="text-xs space-y-0.5">
                {memberCapacity.filter(m => m.usagePct > 100).map(m => (
                  <li key={m.id}><strong>{m.name}</strong> — {m.actualH}h de {m.monthlyH}h ({m.usagePct}%)</li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ── Cenários de Crescimento (moved from CapacitySimulator) ── */
function GrowthScenarioSection({ members, clients, products }: { members: any[]; clients: any[]; products: Product[] }) {
  const [newClients, setNewClients] = useState(5);
  const [selectedProduct, setSelectedProduct] = useState(products[0]?.id || '');

  const CLIENT_WORK_AREAS = ['cliente_servico', 'cliente_comercial', 'cliente_administrativo'];
  const allActive = members.filter((m: any) => m.status === 'ativo' || m.status === 'prestador');
  // Only consider members who work with clients; fall back to all if no one has work_areas yet
  const clientFacingActive = allActive.filter((m: any) => {
    const areas: string[] = Array.isArray(m.work_areas) ? m.work_areas : [];
    return areas.some(a => CLIENT_WORK_AREAS.includes(a));
  });
  const activeMembers = clientFacingActive.length > 0 ? clientFacingActive : allActive;
  const activeClients = clients.filter((c: any) => c.status === 'ativo');

  const product = products.find((p: Product) => p.id === selectedProduct);
  const hoursPerClient = product?.monthly_hours_per_client || 0;

  const simulation = useMemo(() => {
    const memberLoad: Record<string, { name: string; dept: string; capacity: number; committed: number; clients: number }> = {};
    activeMembers.forEach((m: any) => {
      const monthlyH = (Number(m.expected_weekly_hours) || 0) * WEEKS_PER_MONTH;
      const assignedClients = activeClients.filter((c: any) => c.dp === m.full_name);
      let committed = 0;
      assignedClients.forEach((c: any) => {
        const prod = products.find((p: Product) => p.name === c.current_product);
        committed += prod?.monthly_hours_per_client || 0;
      });
      memberLoad[m.id] = { name: m.full_name, dept: m.department || '—', capacity: Math.round(monthlyH), committed, clients: assignedClients.length };
    });

    const totalNeededHours = newClients * hoursPerClient;
    const totalFreeHours = Object.values(memberLoad).reduce((s, m) => s + Math.max(0, m.capacity - m.committed), 0);
    const hoursDeficit = Math.max(0, totalNeededHours - totalFreeHours);
    const membersNeeded = hoursDeficit > 0 ? Math.ceil(hoursDeficit / (40 * WEEKS_PER_MONTH * 0.7)) : 0;

    const sortedMembers = Object.values(memberLoad).sort((a, b) => (b.capacity - b.committed) - (a.capacity - a.committed));

    let remaining = newClients;
    const distribution: { name: string; dept: string; newClients: number; newLoad: number; totalLoad: number; capacity: number }[] = [];
    sortedMembers.forEach(m => {
      if (remaining <= 0) return;
      const freeH = Math.max(0, m.capacity - m.committed);
      const canTake = hoursPerClient > 0 ? Math.floor(freeH / hoursPerClient) : 0;
      const takes = Math.min(canTake, remaining);
      if (takes > 0) {
        distribution.push({ name: m.name, dept: m.dept, newClients: takes, newLoad: takes * hoursPerClient, totalLoad: m.committed + takes * hoursPerClient, capacity: m.capacity });
        remaining -= takes;
      }
    });

    return { totalNeededHours, totalFreeHours: Math.round(totalFreeHours), hoursDeficit: Math.round(hoursDeficit), membersNeeded, distribution, remainingUnassigned: remaining };
  }, [activeMembers, activeClients, products, newClients, hoursPerClient]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Cenário de crescimento</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <Label className="text-xs font-medium text-muted-foreground block mb-1">Novos clientes</Label>
            <Input type="number" value={newClients} onChange={e => setNewClients(Number(e.target.value))} className="h-8 w-24 text-sm" min={1} />
          </div>
          <div>
            <Label className="text-xs font-medium text-muted-foreground block mb-1">Produto</Label>
            <Select value={selectedProduct} onValueChange={setSelectedProduct}>
              <SelectTrigger className="h-8 w-48 text-sm"><SelectValue placeholder="Selecionar produto" /></SelectTrigger>
              <SelectContent>
                {products.map((p: Product) => (
                  <SelectItem key={p.id} value={p.id}>{p.name} ({p.monthly_hours_per_client || 0}h/mês)</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="text-sm text-muted-foreground pb-1">
            = <strong>{simulation.totalNeededHours}h/mês</strong> necessárias
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-4">
          <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Horas necessárias</p><p className="text-lg font-bold">{simulation.totalNeededHours}h</p></div>
          <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Horas livres na equipa</p><p className="text-lg font-bold">{simulation.totalFreeHours}h</p></div>
          <div className={`rounded-lg border p-3 ${simulation.hoursDeficit > 0 ? 'border-destructive/50' : ''}`}><p className="text-xs text-muted-foreground">Défice</p><p className={`text-lg font-bold ${simulation.hoursDeficit > 0 ? 'text-destructive' : 'text-foreground'}`}>{simulation.hoursDeficit > 0 ? `${simulation.hoursDeficit}h` : 'Nenhum'}</p></div>
          <div className={`rounded-lg border p-3 ${simulation.membersNeeded > 0 ? 'border-primary/50 bg-primary/5' : ''}`}><p className="text-xs text-muted-foreground">Contratações necessárias</p><p className="text-lg font-bold">{simulation.membersNeeded}</p></div>
        </div>

        {simulation.distribution.length > 0 && (
          <Table>
            <TableHeader><TableRow>
              <TableHead>Membro</TableHead><TableHead>Departamento</TableHead><TableHead className="text-right">Novos clientes</TableHead><TableHead className="text-right">+Horas</TableHead><TableHead className="text-right">Carga total</TableHead><TableHead className="text-right">Capacidade</TableHead><TableHead>Ocupação</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {simulation.distribution.map((d, i) => {
                const pct = d.capacity > 0 ? Math.round((d.totalLoad / d.capacity) * 100) : 0;
                return (
                  <TableRow key={i}>
                    <TableCell className="text-sm font-medium">{d.name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{d.dept}</TableCell>
                    <TableCell className="text-sm text-right">+{d.newClients}</TableCell>
                    <TableCell className="text-sm text-right">+{d.newLoad}h</TableCell>
                    <TableCell className="text-sm text-right">{d.totalLoad}h</TableCell>
                    <TableCell className="text-sm text-right">{d.capacity}h</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="flex h-2 w-16 rounded-full overflow-hidden bg-muted">
                          <div className={`h-full rounded-full ${pct > 100 ? 'bg-destructive' : pct > 85 ? 'bg-amber-500' : 'bg-primary'}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                        </div>
                        <span className="text-xs">{pct}%</span>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}

        {simulation.remainingUnassigned > 0 && (
          <div className="rounded-lg border border-amber-400/50 bg-amber-50/50 dark:bg-amber-950/20 p-3 text-sm">
            <p className="font-medium text-amber-700 dark:text-amber-400">
              ⚠ {simulation.remainingUnassigned} cliente{simulation.remainingUnassigned > 1 ? 's' : ''} sem capacidade na equipa atual.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Será necessário contratar {simulation.membersNeeded} pessoa{simulation.membersNeeded > 1 ? 's' : ''} para absorver a carga adicional de {simulation.hoursDeficit}h/mês.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ── Simulador de Clientes (from ExecutiveCapacidade) ── */
function CapacitySimulatorView({ members: teamMembers, clients: allClientsRaw, products: allProductsRaw, scenario: scenarioData, scenarioProducts: scenarioProductsRawData }: {
  members: any[]; clients: any[]; products: any[]; scenario: any; scenarioProducts: any[];
}) {
  const qc = useQueryClient();
  const { products: productsHook } = useProducts();
  const allProducts = (productsHook.data || []).filter((p: Product) => p.status !== 'off');
  const { clients: clientsHook } = useClients();
  const allClients = clientsHook.data || [];

  const members = teamMembers.filter(m => m.status === 'ativo' || m.status === 'prestador');

  const scenario = useQuery({
    queryKey: ['capacity-scenario'],
    queryFn: async () => {
      const { data } = await supabase.from('capacity_scenarios').select('*').order('created_at').limit(1).maybeSingle();
      return data;
    },
  });

  const scenarioProductsRaw = useQuery({
    queryKey: ['capacity-scenario-products', scenario.data?.id],
    queryFn: async () => {
      if (!scenario.data?.id) return [];
      const { data } = await supabase.from('capacity_scenario_products').select('*').eq('scenario_id', scenario.data.id).order('created_at');
      return data || [];
    },
    enabled: !!scenario.data?.id,
  });

  const scenarioProducts = useMemo(() => {
    const raw = scenarioProductsRaw.data || [];
    return {
      ...scenarioProductsRaw,
      data: raw.map(sp => {
        if (!sp.product_id) return sp;
        const sourceProduct = allProducts.find((p: Product) => p.id === sp.product_id);
        if (sourceProduct && sourceProduct.monthly_hours_per_client != null) {
          return { ...sp, hours_per_client_month: sourceProduct.monthly_hours_per_client };
        }
        return sp;
      }),
    };
  }, [scenarioProductsRaw.data, allProducts]);

  const [clientFacingIds, setClientFacingIds] = useState<Set<string>>(new Set());
  const [cfInitialized, setCfInitialized] = useState(false);

  if (members.length > 0 && !cfInitialized) {
    // Auto-detect client-facing members from work_areas
    const CLIENT_AREAS = ['cliente_administrativo', 'cliente_servico', 'cliente_comercial'];
    const autoIds = members
      .filter(m => {
        const areas: string[] = Array.isArray((m as any).work_areas) ? (m as any).work_areas : [];
        return areas.some(a => CLIENT_AREAS.includes(a));
      })
      .map(m => m.id);
    // If no one has work_areas set yet, fall back to all members (backward compat)
    setClientFacingIds(new Set(autoIds.length > 0 ? autoIds : members.map(m => m.id)));
    setCfInitialized(true);
  }

  const [memberOverhead, setMemberOverhead] = useState<Record<string, { admin: number; business: number }>>({});
  const [overheadInitialized, setOverheadInitialized] = useState(false);

  if (members.length > 0 && scenario.data && !overheadInitialized) {
    const defaultAdmin = Number(scenario.data.admin_percent) || 20;
    const defaultBusiness = Number(scenario.data.business_percent) || 0;
    const saved = (scenario.data as any).member_overheads;
    const initial: Record<string, { admin: number; business: number }> = {};
    for (const m of members) {
      if (saved && saved[m.id]) initial[m.id] = saved[m.id];
      else initial[m.id] = { admin: defaultAdmin, business: defaultBusiness };
    }
    setMemberOverhead(initial);
    setOverheadInitialized(true);
  }

  const setMemberAdmin = (id: string, val: number) => {
    setMemberOverhead(prev => ({ ...prev, [id]: { ...prev[id], admin: val, business: prev[id]?.business || 0 } }));
  };
  const setMemberBusiness = (id: string, val: number) => {
    setMemberOverhead(prev => ({ ...prev, [id]: { admin: prev[id]?.admin || 0, business: val } }));
  };

  const clientFacingMembers = useMemo(() => members.filter(m => clientFacingIds.has(m.id)), [members, clientFacingIds]);
  const clientFacingMonthlyHours = useMemo(() => clientFacingMembers.reduce((sum, m) => sum + (Number(m.expected_weekly_hours) || 0) * WEEKS_PER_MONTH, 0), [clientFacingMembers]);

  const availableHours = useMemo(() => {
    return clientFacingMembers.reduce((sum, m) => {
      const monthlyH = (Number(m.expected_weekly_hours) || 0) * WEEKS_PER_MONTH;
      const oh = memberOverhead[m.id] || { admin: 20, business: 0 };
      return sum + monthlyH * (1 - Math.min(oh.admin + oh.business, 100) / 100);
    }, 0);
  }, [clientFacingMembers, memberOverhead]);

  const totalOverheadHours = useMemo(() => {
    return clientFacingMembers.reduce((sum, m) => {
      const monthlyH = (Number(m.expected_weekly_hours) || 0) * WEEKS_PER_MONTH;
      const oh = memberOverhead[m.id] || { admin: 20, business: 0 };
      return sum + monthlyH * (Math.min(oh.admin + oh.business, 100) / 100);
    }, 0);
  }, [clientFacingMembers, memberOverhead]);

  const effectiveTeamSize = members.length;
  const effectiveClientFacing = clientFacingMembers.length;

  const realClientCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of allClients) {
      if (['ativo', 'em_onboarding', 'altura_renovacao'].includes((c as any).status) && (c as any).current_product) {
        counts[(c as any).current_product] = (counts[(c as any).current_product] || 0) + 1;
      }
    }
    return counts;
  }, [allClients]);

  const ensureScenario = useMutation({
    mutationFn: async () => {
      if (scenario.data) return scenario.data.id;
      const { data, error } = await supabase.from('capacity_scenarios').insert({ name: 'Cenário principal' } as any).select('id').single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['capacity-scenario'] }),
  });

  const saveSettings = useMutation({
    mutationFn: async () => {
      let scenarioId = scenario.data?.id;
      if (!scenarioId) scenarioId = await ensureScenario.mutateAsync();
      const { error } = await supabase.from('capacity_scenarios').update({
        useful_hours_per_month: Math.round(clientFacingMonthlyHours), admin_percent: 0, business_percent: 0,
        team_size: effectiveTeamSize, client_facing_count: effectiveClientFacing, member_overheads: memberOverhead,
      } as any).eq('id', scenarioId);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['capacity-scenario'] }); toast.success('Definições guardadas'); },
  });

  const addProduct = useMutation({
    mutationFn: async (product: Product) => {
      let scenarioId = scenario.data?.id;
      if (!scenarioId) scenarioId = await ensureScenario.mutateAsync();
      const { error } = await supabase.from('capacity_scenario_products').insert({
        scenario_id: scenarioId, product_id: product.id, product_name: product.name,
        hours_per_client_month: product.monthly_hours_per_client || 0, current_clients: 0,
        price_per_client: parseFloat(String(product.ticket || '0').replace(/[^\d.,]/g, '').replace(',', '.')) || 0,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['capacity-scenario-products'] }); toast.success('Produto adicionado'); },
  });

  const updateScenarioProduct = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; hours_per_client_month?: number; current_clients?: number; price_per_client?: number }) => {
      const { error } = await supabase.from('capacity_scenario_products').update(updates as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['capacity-scenario-products'] }),
  });

  const deleteScenarioProduct = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('capacity_scenario_products').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['capacity-scenario-products'] }),
  });

  const items = scenarioProducts.data || [];
  const totalHoursUsed = items.reduce((sum, p) => sum + (Number(p.hours_per_client_month) * Number(p.current_clients)), 0);
  const hoursRemaining = availableHours - totalHoursUsed;
  const capacityPercent = availableHours > 0 ? Math.round((totalHoursUsed / availableHours) * 100) : 0;

  const currentRevenue = items.reduce((sum, p) => sum + (Number(p.price_per_client || 0) * Number(p.current_clients)), 0);

  const maxRevenue = useMemo(() => {
    if (items.length === 0) return 0;
    const totalCurrentClients = items.reduce((s, p) => s + Number(p.current_clients), 0);
    if (totalCurrentClients === 0) {
      let best = 0;
      for (const p of items) { const hpc = Number(p.hours_per_client_month); const price = Number(p.price_per_client || 0); if (hpc > 0) best = Math.max(best, Math.floor(availableHours / hpc) * price); }
      return best;
    }
    const weights = items.map(p => ({ hpc: Number(p.hours_per_client_month), price: Number(p.price_per_client || 0), ratio: Number(p.current_clients) / totalCurrentClients }));
    const hoursPerUnit = weights.reduce((s, w) => s + w.hpc * w.ratio, 0);
    const revenuePerUnit = weights.reduce((s, w) => s + w.price * w.ratio, 0);
    if (hoursPerUnit <= 0) return currentRevenue;
    return Math.round(revenuePerUnit * Math.floor(availableHours / hoursPerUnit));
  }, [items, availableHours, currentRevenue]);

  const addedProductIds = items.map(p => p.product_id);
  const availableToAdd = allProducts.filter((p: Product) => !addedProductIds.includes(p.id));
  const clientHours = Math.round(availableHours);

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Settings */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Clock className="h-4 w-4" /> Parâmetros base</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-3">
            <Label className="text-xs font-medium flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> Equipa ({effectiveTeamSize} membros)</Label>
            <p className="text-[10px] text-muted-foreground">Membros com área de trabalho de cliente são pré-selecionados automaticamente. Podes ajustar manualmente.</p>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {members.map(m => {
                const weeklyH = Number(m.expected_weekly_hours) || 0;
                const monthlyH = Math.round(weeklyH * WEEKS_PER_MONTH);
                const isSelected = clientFacingIds.has(m.id);
                const oh = memberOverhead[m.id] || { admin: 20, business: 0 };
                const totalOh = Math.min(oh.admin + oh.business, 100);
                const availH = Math.round(monthlyH * (1 - totalOh / 100));
                return (
                  <div key={m.id} className={`rounded-lg border p-2.5 space-y-2 ${isSelected ? 'border-primary/30 bg-primary/5' : 'opacity-60'}`}>
                    <label className="flex items-center gap-2 cursor-pointer text-sm">
                      <Checkbox checked={isSelected} onCheckedChange={(checked) => { const next = new Set(clientFacingIds); if (checked) next.add(m.id); else next.delete(m.id); setClientFacingIds(next); }} />
                      <span className="flex-1 truncate font-medium">{m.full_name}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">{weeklyH}h/sem ≈ {monthlyH}h/mês</span>
                    </label>
                    {isSelected && (
                      <div className="grid grid-cols-3 gap-2 pl-6">
                        <div className="space-y-0.5"><Label className="text-[9px] text-muted-foreground">Admin %</Label><Input type="number" className="h-6 text-xs" min={0} max={100} value={oh.admin} onChange={e => setMemberAdmin(m.id, Math.min(Number(e.target.value), 100))} /></div>
                        <div className="space-y-0.5"><Label className="text-[9px] text-muted-foreground">Negócio %</Label><Input type="number" className="h-6 text-xs" min={0} max={100} value={oh.business} onChange={e => setMemberBusiness(m.id, Math.min(Number(e.target.value), 100))} /></div>
                        <div className="space-y-0.5"><Label className="text-[9px] text-muted-foreground">Disponível</Label><div className="h-6 flex items-center text-xs font-medium text-primary">{availH}h</div></div>
                      </div>
                    )}
                  </div>
                );
              })}
              {members.length === 0 && <p className="text-xs text-muted-foreground py-2">Nenhum membro ativo encontrado</p>}
            </div>
            <div className="rounded-md bg-muted/50 px-3 py-2 space-y-1">
              <div className="flex justify-between text-xs"><span className="text-muted-foreground">{effectiveClientFacing} em entrega</span><span className="font-medium">{Math.round(clientFacingMonthlyHours)}h/mês bruto</span></div>
              <div className="flex justify-between text-xs"><span className="text-muted-foreground">Overhead total</span><span className="font-medium">−{Math.round(totalOverheadHours)}h</span></div>
              <div className="flex justify-between text-sm font-bold border-t pt-1"><span>Horas para clientes</span><span className="text-primary">{clientHours}h</span></div>
            </div>
          </div>
          <Button size="sm" className="w-full" onClick={() => saveSettings.mutate()}>Guardar parâmetros</Button>
        </CardContent>
      </Card>

      {/* Capacity Overview */}
      <div className="lg:col-span-2 space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">Horas usadas</p><p className="text-2xl font-bold">{totalHoursUsed.toFixed(0)}h</p><p className="text-[10px] text-muted-foreground">de {availableHours.toFixed(0)}h disponíveis</p></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">Ocupação</p><p className={`text-2xl font-bold ${capacityPercent > 90 ? 'text-destructive' : capacityPercent > 70 ? 'text-amber-500' : 'text-foreground'}`}>{capacityPercent}%</p><Progress value={Math.min(capacityPercent, 100)} className="h-2 mt-1" /></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">Horas livres</p><p className={`text-2xl font-bold ${hoursRemaining < 0 ? 'text-destructive' : 'text-foreground'}`}>{hoursRemaining.toFixed(0)}h</p>{hoursRemaining < 0 && <p className="text-[10px] text-destructive font-medium">Sobre-capacidade!</p>}</CardContent></Card>
        </div>

        {items.some(p => Number(p.price_per_client || 0) > 0) && (
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Projeção de faturação mensal</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="flex-1 rounded-lg border p-4 text-center">
                  <p className="text-xs text-muted-foreground">Faturação atual</p>
                  <p className="text-2xl font-bold">{currentRevenue.toLocaleString('pt-PT')}€</p>
                  <p className="text-[10px] text-muted-foreground">{items.reduce((s, p) => s + Number(p.current_clients), 0)} clientes</p>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground shrink-0" />
                <div className="flex-1 rounded-lg border p-4 text-center border-primary/30 bg-primary/5">
                  <p className="text-xs text-muted-foreground">Se lotares a capacidade</p>
                  <p className="text-2xl font-bold text-primary">{maxRevenue.toLocaleString('pt-PT')}€</p>
                  {maxRevenue > currentRevenue && <p className="text-[10px] text-muted-foreground">+{(maxRevenue - currentRevenue).toLocaleString('pt-PT')}€ potencial</p>}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Calculator className="h-4 w-4" /> Produtos no simulador</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Adiciona produtos para simular a capacidade</p>
            ) : (
              <div className="space-y-3">
                {items.map(item => {
                  const hpc = Number(item.hours_per_client_month);
                  const currentClients = Number(item.current_clients);
                  const hoursUsed = hpc * currentClients;
                  const extraPossible = hpc > 0 && hoursRemaining > 0 ? Math.floor(hoursRemaining / hpc) : 0;
                  const realCount = realClientCounts[item.product_name] || 0;
                  const itemRevenue = Number(item.price_per_client || 0) * currentClients;

                  return (
                    <div key={item.id} className="rounded-lg border p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-sm">{item.product_name}</h4>
                          {itemRevenue > 0 && <Badge variant="secondary" className="text-[10px]">{itemRevenue.toLocaleString('pt-PT')}€/mês</Badge>}
                        </div>
                        <button onClick={() => deleteScenarioProduct.mutate(item.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                      <div className="grid grid-cols-6 gap-3">
                        <div className="space-y-1">
                          <Label className="text-[10px]">Horas/cliente/mês</Label>
                          <Input type="number" className="h-7 text-sm" defaultValue={hpc} onBlur={e => { const val = parseFloat(e.target.value); if (!isNaN(val) && val !== hpc) updateScenarioProduct.mutate({ id: item.id, hours_per_client_month: val }); }} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px]">€/cliente/mês</Label>
                          <Input type="number" className="h-7 text-sm" defaultValue={Number(item.price_per_client || 0)} onBlur={e => updateScenarioProduct.mutate({ id: item.id, price_per_client: Number(e.target.value) })} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px]">Clientes reais</Label>
                          <div className="h-7 flex items-center gap-1.5">
                            <span className="text-sm font-semibold">{realCount}</span>
                            <Button size="sm" variant="ghost" className="h-5 px-1.5 text-[10px]" onClick={() => updateScenarioProduct.mutate({ id: item.id, current_clients: realCount })}>Usar</Button>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px]">Carga atual</Label>
                          <div className="h-7 flex items-center">
                            <span className={`text-sm font-semibold ${hoursUsed > 0 ? 'text-foreground' : 'text-muted-foreground'}`}>{hoursUsed.toFixed(0)}h/mês</span>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px]">Simular c/ clientes</Label>
                          <Input type="number" className="h-7 text-sm" defaultValue={currentClients} onBlur={e => updateScenarioProduct.mutate({ id: item.id, current_clients: Number(e.target.value) })} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px]">Podes aceitar +</Label>
                          <div className="h-7 flex items-center"><span className={`text-sm font-semibold flex items-center gap-1 ${extraPossible === 0 ? 'text-muted-foreground' : 'text-primary'}`}><Users className="h-3 w-3" /> {extraPossible}</span></div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {availableToAdd.length > 0 && (
              <>
                <Separator />
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Adicionar produto</p>
                  <div className="flex flex-wrap gap-2">
                    {availableToAdd.map((p: Product) => (
                      <Button key={p.id} size="sm" variant="outline" className="text-xs h-7 gap-1" onClick={() => addProduct.mutate(p)}><Plus className="h-3 w-3" /> {p.name}</Button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {items.length > 0 && (
          <Card className={hoursRemaining < 0 ? 'border-destructive/50 bg-destructive/5' : 'border-primary/30 bg-primary/5'}>
            <CardContent className="p-4 flex items-start gap-3">
              {hoursRemaining < 0 ? <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" /> : <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />}
              <div className="text-sm space-y-1">
                {hoursRemaining < 0 ? (
                  <p>Estás <strong>{Math.abs(hoursRemaining).toFixed(0)}h acima</strong> da capacidade mensal. Considera ajustar a carga ou expandir a equipa.</p>
                ) : hoursRemaining < 10 ? (
                  <p>Capacidade <strong>quase no limite</strong> — apenas {hoursRemaining.toFixed(0)}h livres por mês.</p>
                ) : (
                  <>
                    <p>Tens <strong>{hoursRemaining.toFixed(0)}h livres</strong> por mês. Com essa margem podes aceitar:</p>
                    <ul className="text-xs text-muted-foreground space-y-0.5 mt-1">
                      {items.filter(p => Number(p.hours_per_client_month) > 0).map(p => {
                        const extra = Math.floor(hoursRemaining / Number(p.hours_per_client_month));
                        return (
                          <li key={p.id}><strong>+{extra}</strong> clientes de <em>{p.product_name}</em>{Number(p.price_per_client || 0) > 0 && <span className="text-muted-foreground"> (+{(extra * Number(p.price_per_client)).toLocaleString('pt-PT')}€/mês)</span>}</li>
                        );
                      })}
                    </ul>
                    <p className="text-[10px] text-muted-foreground mt-1">(valores exclusivos — aceitar clientes de um produto reduz espaço para outros)</p>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Growth Scenario — simulate adding N clients */}
        <GrowthScenarioSection members={members} clients={allClients} products={allProducts} />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════ */
/*  TAB 4: SIMULAÇÃO (Contratação + Crescimento + Dept) */
/* ═══════════════════════════════════════════════════ */
function SimulationTab({ members, entries, clients, products }: { members: any[]; entries: any[]; clients: any[]; products: any[] }) {
  return (
    <div className="space-y-4">
      <CapacitySimulator members={members} entries={entries} clients={clients} products={products} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════ */
/*  TAB 5: TAREFAS & SOBRECARGA                       */
/* ═══════════════════════════════════════════════════ */
function OverloadTab({ entries, members, tasks }: { entries: any[]; members: any[]; tasks: any[] }) {
  const taskTime: Record<string, { hours: number; count: number }> = {};
  entries.forEach(e => {
    if (!e.task_id) return;
    if (!taskTime[e.task_id]) taskTime[e.task_id] = { hours: 0, count: 0 };
    taskTime[e.task_id].hours += Number(e.duration || 0);
    taskTime[e.task_id].count += 1;
  });

  const taskRows = Object.entries(taskTime)
    .map(([tid, data]) => {
      const task = tasks.find(t => t.id === tid);
      return { tid, name: task?.name || 'Tarefa desconhecida', assigned: task?.assigned_to, department: task?.department, ...data };
    })
    .sort((a, b) => b.hours - a.hours)
    .slice(0, 20);

  const now = new Date();
  const weekRanges = Array.from({ length: 4 }, (_, i) => {
    const ws = startOfWeek(subWeeks(now, 3 - i), { weekStartsOn: 1 });
    const we = endOfWeek(ws, { weekStartsOn: 1 });
    return { start: ws, end: we, label: `${format(ws, 'dd/MM')} → ${format(we, 'dd/MM')}` };
  });

  const memberOverload = members.map(m => {
    const expected = Number(m.expected_weekly_hours || 40);
    const weeklyPcts = weekRanges.map(w => {
      const wEntries = entries.filter(e => { const d = new Date(e.entry_date); return e.member_id === m.id && d >= w.start && d <= w.end; });
      const hours = wEntries.reduce((s, e) => s + Number(e.duration || 0), 0);
      return expected > 0 ? (hours / expected) * 100 : 0;
    });
    const trend = weeklyPcts[3] - weeklyPcts[0];
    const trendLabel = Math.abs(trend) < 5 ? 'Estável' : trend > 0 ? 'A aumentar' : 'A diminuir';
    return { ...m, weeklyPcts, trendLabel };
  });

  const pctColor = (pct: number) => pct >= 120 ? 'text-destructive font-semibold' : pct >= 110 ? 'text-amber-500 font-medium' : 'text-green-600';

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Tarefas que consomem mais tempo</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Tarefa</TableHead><TableHead>Responsável</TableHead><TableHead>Departamento</TableHead><TableHead className="text-right">Tempo total</TableHead><TableHead className="text-right">Registos</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {taskRows.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">Sem dados de tempo em tarefas</TableCell></TableRow>
              ) : taskRows.map(r => (
                <TableRow key={r.tid}>
                  <TableCell className="text-sm font-medium">{r.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.assigned || '—'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.department || '—'}</TableCell>
                  <TableCell className="text-sm text-right">{r.hours.toFixed(1)}h</TableCell>
                  <TableCell className="text-sm text-right">{r.count}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Análise de sobrecarga (últimas 4 semanas)</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Membro</TableHead>
              {weekRanges.map((w, i) => <TableHead key={i} className="text-center text-xs">{w.label}</TableHead>)}
              <TableHead>Tendência</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {memberOverload.map(m => (
                <TableRow key={m.id}>
                  <TableCell className="text-sm font-medium">{m.full_name}</TableCell>
                  {m.weeklyPcts.map((pct, i) => (
                    <TableCell key={i} className={`text-center text-sm ${pctColor(pct)}`}>{pct.toFixed(0)}%</TableCell>
                  ))}
                  <TableCell><Badge variant="secondary" className="text-xs">{m.trendLabel}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
