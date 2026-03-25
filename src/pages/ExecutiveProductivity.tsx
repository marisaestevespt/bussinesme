import { useState, useMemo } from 'react';
import { BackNavigation } from '@/components/BackNavigation';
import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Clock, Users, Briefcase, AlertTriangle, Plus, BarChart3, Timer, ArrowLeftRight, Building2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, subWeeks } from 'date-fns';
import { pt } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { MemberProductivityDetail } from '@/components/productivity/MemberProductivityDetail';

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

  const clients = useQuery({
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

  const profiles = useQuery({
    queryKey: ['profiles_list'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, full_name');
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
        <PageHeader title="Análise de Produtividade" subtitle="Controlo de tempo, ocupação e análise de produtividade" />

        <Tabs defaultValue="overview">
          <TabsList className="flex-wrap">
            <TabsTrigger value="overview"><BarChart3 className="h-3.5 w-3.5 mr-1.5" />Visão Geral</TabsTrigger>
            <TabsTrigger value="capacity"><Building2 className="h-3.5 w-3.5 mr-1.5" />Capacidade Empresa</TabsTrigger>
            <TabsTrigger value="split"><ArrowLeftRight className="h-3.5 w-3.5 mr-1.5" />Interno vs Cliente</TabsTrigger>
            <TabsTrigger value="by-client"><Briefcase className="h-3.5 w-3.5 mr-1.5" />Tempo por Cliente</TabsTrigger>
            
            <TabsTrigger value="overload"><AlertTriangle className="h-3.5 w-3.5 mr-1.5" />Tarefas & Sobrecarga</TabsTrigger>
            <TabsTrigger value="log"><Timer className="h-3.5 w-3.5 mr-1.5" />Registo de Tempo</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <OverviewTab entries={entries.data || []} members={members.data || []} />
          </TabsContent>
          <TabsContent value="capacity">
            <CompanyCapacityTab members={members.data || []} entries={entries.data || []} />
          </TabsContent>
          <TabsContent value="split">
            <TimeSplitTab entries={entries.data || []} members={members.data || []} scenario={capacityScenarios.data?.[0] || null} scenarioProducts={capacityProducts.data || []} />
          </TabsContent>
          <TabsContent value="by-client">
            <ByClientTab entries={entries.data || []} clients={clients.data || []} />
          </TabsContent>


          <TabsContent value="overload">
            <OverloadTab entries={entries.data || []} members={members.data || []} tasks={tasks.data || []} />
          </TabsContent>
          <TabsContent value="log">
            <TimeLogTab entries={entries.data || []} members={members.data || []} clients={clients.data || []} projects={projects.data || []} tasks={tasks.data || []} />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}


/* ─── TAB: CAPACIDADE EMPRESA ─── */
function CompanyCapacityTab({ members, entries }: { members: any[]; entries: any[] }) {
  const WEEKS_PER_MONTH = 4.33;
  const activeMembers = members.filter(m => m.status === 'ativo' || m.status === 'prestador');

  const totalWeeklyHours = activeMembers.reduce((s, m) => s + (Number(m.expected_weekly_hours) || 0), 0);
  const totalMonthlyHours = Math.round(totalWeeklyHours * WEEKS_PER_MONTH);

  const { start, end } = getDateRange('month');
  const monthEntries = entries.filter(e => {
    const d = new Date(e.entry_date);
    return d >= start && d <= end;
  });

  const memberCapacity = useMemo(() => {
    return activeMembers.map(m => {
      const weeklyH = Number(m.expected_weekly_hours) || 0;
      const monthlyH = Math.round(weeklyH * WEEKS_PER_MONTH);
      const actualH = monthEntries.filter(e => e.member_id === m.id).reduce((s: number, e: any) => s + Number(e.duration || 0), 0);
      const clientH = monthEntries.filter(e => e.member_id === m.id && (e.client_id || e.category === 'cliente')).reduce((s: number, e: any) => s + Number(e.duration || 0), 0);
      const internalH = actualH - clientH;
      const usagePct = monthlyH > 0 ? Math.round((actualH / monthlyH) * 100) : 0;
      return { id: m.id, name: m.full_name, role: m.role_title || '—', weeklyH, monthlyH, actualH: Number(actualH.toFixed(1)), clientH: Number(clientH.toFixed(1)), internalH: Number(internalH.toFixed(1)), usagePct, remainingH: Number((monthlyH - actualH).toFixed(1)) };
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
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Equipa ativa</p>
          <p className="text-2xl font-bold">{activeMembers.length}</p>
          <p className="text-xs text-muted-foreground">membros</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Capacidade mensal</p>
          <p className="text-2xl font-bold">{totalMonthlyHours}h</p>
          <p className="text-xs text-muted-foreground">{totalWeeklyHours}h/semana</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Registado (mês)</p>
          <p className="text-2xl font-bold">{totalActual.toFixed(1)}h</p>
          <p className="text-xs text-muted-foreground">{totalClientH.toFixed(1)}h cliente + {totalInternalH.toFixed(1)}h interno</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Ocupação geral</p>
          <p className={`text-2xl font-bold ${overallUsage > 100 ? 'text-destructive' : overallUsage > 85 ? 'text-amber-500' : 'text-foreground'}`}>{overallUsage}%</p>
          <Progress value={Math.min(overallUsage, 100)} className="h-2 mt-1" />
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Horas restantes</p>
          <p className={`text-2xl font-bold ${totalRemainingH < 0 ? 'text-destructive' : 'text-foreground'}`}>{totalRemainingH.toFixed(0)}h</p>
          <p className="text-xs text-muted-foreground">este mês</p>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Capacidade vs Registado por membro (mês atual)</CardTitle></CardHeader>
        <CardContent className="h-64">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis dataKey="name" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Legend />
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
              <TableHead>Membro</TableHead>
              <TableHead>Função</TableHead>
              <TableHead className="text-right">h/semana</TableHead>
              <TableHead className="text-right">Capacidade/mês</TableHead>
              <TableHead className="text-right">Registado</TableHead>
              <TableHead className="text-right">Restante</TableHead>
              <TableHead className="text-right">Ocupação</TableHead>
              <TableHead>Barra</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {memberCapacity.map(m => (
                <TableRow key={m.id}>
                  <TableCell className="text-sm font-medium">{m.name}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{m.role}</TableCell>
                  <TableCell className="text-sm text-right tabular-nums">{m.weeklyH}h</TableCell>
                  <TableCell className="text-sm text-right tabular-nums">{m.monthlyH}h</TableCell>
                  <TableCell className="text-sm text-right tabular-nums">{m.actualH}h</TableCell>
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
                <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">Sem membros ativos</TableCell></TableRow>
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

/* ─── TAB: INTERNO VS CLIENTE ─── */
function TimeSplitTab({ entries, members, scenario, scenarioProducts }: { entries: any[]; members: any[]; scenario: any; scenarioProducts: any[] }) {
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

  // Planned split from capacity simulator
  const planned = useMemo(() => {
    if (!scenario) return null;
    const adminPct = Number(scenario.admin_percent || 0);
    const businessPct = Number(scenario.business_percent || 0);
    const internalPlanned = adminPct + businessPct;
    const clientPlanned = 100 - internalPlanned;
    const totalTeamHours = Number(scenario.useful_hours_per_month || 0) * Number(scenario.team_size || 1);
    return {
      internalPct: internalPlanned,
      clientPct: clientPlanned,
      adminPct,
      businessPct,
      totalTeamHours,
      scenarioName: scenario.name,
    };
  }, [scenario]);

  // Monthly trend data
  const monthlyTrend = useMemo(() => {
    const now = new Date();
    const months: { month: string; cliente: number; interno: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const m = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mEnd = endOfMonth(m);
      const mEntries = entries.filter(e => {
        const d = new Date(e.entry_date);
        return d >= m && d <= mEnd;
      });
      const total = mEntries.reduce((s, e) => s + Number(e.duration || 0), 0);
      const client = mEntries.filter(e => e.client_id || e.category === 'cliente').reduce((s, e) => s + Number(e.duration || 0), 0);
      months.push({
        month: format(m, 'MMM', { locale: pt }),
        cliente: Number(client.toFixed(1)),
        interno: Number((total - client).toFixed(1)),
      });
    }
    return months;
  }, [entries]);

  // Per-member split
  const memberSplit = useMemo(() => {
    const activeMembers = members.filter(m => m.status === 'ativo');
    return activeMembers.map(m => {
      const mEntries = filtered.filter(e => e.member_id === m.id);
      const total = mEntries.reduce((s: number, e: any) => s + Number(e.duration || 0), 0);
      const client = mEntries.filter((e: any) => e.client_id || e.category === 'cliente').reduce((s: number, e: any) => s + Number(e.duration || 0), 0);
      const internal = total - client;
      return {
        id: m.id,
        name: m.full_name,
        total,
        client,
        internal,
        clientPct: total > 0 ? Math.round((client / total) * 100) : 0,
      };
    }).filter(m => m.total > 0).sort((a, b) => b.total - a.total);
  }, [filtered, members]);

  // Deviation from plan
  const deviation = planned ? {
    clientDiff: clientPct - planned.clientPct,
    internalDiff: internalPct - planned.internalPct,
  } : null;

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        {PERIOD_FILTERS.map(f => (
          <Button key={f.value} size="sm" variant={period === f.value ? 'default' : 'outline'} onClick={() => setPeriod(f.value)}>{f.label}</Button>
        ))}
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total registado</p>
            <p className="text-2xl font-bold">{totalHours.toFixed(1)}h</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Tempo em cliente</p>
            <p className="text-2xl font-bold">{clientHours.toFixed(1)}h</p>
            <p className="text-xs text-muted-foreground">{clientPct}% do total</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Tempo interno</p>
            <p className="text-2xl font-bold">{internalHours.toFixed(1)}h</p>
            <p className="text-xs text-muted-foreground">{internalPct}% do total</p>
          </CardContent>
        </Card>
        {planned && (
          <Card className={deviation && Math.abs(deviation.clientDiff) > 10 ? 'border-amber-400/50' : ''}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Desvio do planeado</p>
              <p className="text-2xl font-bold">{deviation ? `${deviation.clientDiff > 0 ? '+' : ''}${deviation.clientDiff}%` : '—'}</p>
              <p className="text-xs text-muted-foreground">Cliente: planeado {planned.clientPct}%</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Real vs Planned comparison */}
      {planned && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <ArrowLeftRight className="h-4 w-4" />
              Real vs Planeado ({planned.scenarioName})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span>Tempo em cliente</span>
                  <span>Real: {clientPct}% | Planeado: {planned.clientPct}%</span>
                </div>
                <div className="relative h-6 rounded-full bg-muted overflow-hidden">
                  <div className="absolute inset-y-0 left-0 bg-primary/30 rounded-full" style={{ width: `${planned.clientPct}%` }} />
                  <div className="absolute inset-y-0 left-0 bg-primary rounded-full transition-all" style={{ width: `${clientPct}%` }} />
                  <div className="absolute inset-y-0 flex items-center px-2 text-[10px] font-medium text-primary-foreground">{clientPct}%</div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span>Tempo interno (admin + negócio)</span>
                  <span>Real: {internalPct}% | Planeado: {planned.internalPct}%</span>
                </div>
                <div className="relative h-6 rounded-full bg-muted overflow-hidden">
                  <div className="absolute inset-y-0 left-0 bg-accent/50 rounded-full" style={{ width: `${planned.internalPct}%` }} />
                  <div className="absolute inset-y-0 left-0 bg-accent rounded-full transition-all" style={{ width: `${internalPct}%` }} />
                  <div className="absolute inset-y-0 flex items-center px-2 text-[10px] font-medium">{internalPct}%</div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Simulador prevê {planned.adminPct}% admin + {planned.businessPct}% negócio = {planned.internalPct}% interno, restando {planned.clientPct}% para clientes.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Monthly trend chart */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Tendência mensal (últimos 6 meses)</CardTitle></CardHeader>
        <CardContent className="h-64">
          {monthlyTrend.some(m => m.cliente > 0 || m.interno > 0) ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyTrend}>
                <XAxis dataKey="month" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Legend />
                <Bar dataKey="cliente" name="Cliente" fill="hsl(var(--primary))" stackId="a" radius={[0,0,0,0]} />
                <Bar dataKey="interno" name="Interno" fill="hsl(var(--accent))" stackId="a" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-muted-foreground text-center pt-20">Sem dados</p>}
        </CardContent>
      </Card>

      {/* Per-member breakdown */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Divisão por membro</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Membro</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Cliente</TableHead>
              <TableHead className="text-right">Interno</TableHead>
              <TableHead className="text-right">% Cliente</TableHead>
              <TableHead>Distribuição</TableHead>
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

      {!planned && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            <p>Sem cenário de capacidade definido. Configure o simulador de capacidade para comparar o real com o planeado.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ─── TAB 1: VISÃO GERAL ─── */
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

  // Overload alerts
  const alerts = members.filter(m => {
    const expected = Number(m.expected_weekly_hours || 40);
    const actual = hoursByMember[m.id] || 0;
    return actual > expected * 1.1;
  }).map(m => {
    const expected = Number(m.expected_weekly_hours || 40);
    const actual = hoursByMember[m.id] || 0;
    const pct = ((actual - expected) / expected) * 100;
    return { ...m, actual, expected, pct };
  });

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
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

      {/* Charts */}
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

/* ─── CAPACIDADE DA EQUIPA ─── */
function TeamCapacitySection({ members, clients, products, tasks, entries, projects, profiles }: { members: any[]; clients: any[]; products: any[]; tasks: any[]; entries: any[]; projects: any[]; profiles: any[] }) {
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const activeMembers = members.filter(m => m.status === 'ativo');
  const activeClients = clients.filter(c => c.status === 'ativo');

  const productHoursMap: Record<string, number | null> = {};
  products.forEach(p => { productHoursMap[p.name] = p.monthly_hours_per_client; });

  const rows = activeMembers.map(m => {
    const weeklyHours = Number(m.expected_weekly_hours || 40);
    const monthlyAvailable = Math.round(weeklyHours * 4.33 * 10) / 10;

    const memberClients = activeClients.filter(c => c.dp === m.full_name);

    let committedHours = 0;
    let missingHoursFlag = false;
    const clientDetails = memberClients.map(c => {
      const productName = c.current_product || null;
      const hours = productName ? productHoursMap[productName] : null;
      if (hours != null) {
        committedHours += hours;
      } else {
        missingHoursFlag = true;
      }
      return { clientName: c.full_name, productName: productName || '—', hours };
    });

    const taskEstimatedHours = tasks
      .filter(t => t.assigned_to === m.profile_id && t.status !== 'done' && t.estimated_time)
      .reduce((sum: number, t: any) => sum + Number(t.estimated_time || 0), 0);
    committedHours += taskEstimatedHours;

    const freeHours = Math.round((monthlyAvailable - committedHours) * 10) / 10;
    const occupancy = monthlyAvailable > 0 ? Math.round((committedHours / monthlyAvailable) * 100) : 0;
    const capacityStatus: 'green' | 'amber' | 'red' = occupancy > 100 ? 'red' : occupancy >= 80 ? 'amber' : 'green';

    return {
      id: m.id, name: m.full_name, monthlyAvailable, clientCount: memberClients.length,
      committedHours, freeHours, occupancy, capacityStatus, missingHoursFlag, clientDetails,
      taskEstimatedHours,
    };
  });

  const alertRows = rows.filter(r => r.capacityStatus === 'red' || r.capacityStatus === 'amber');

  const statusColors: Record<string, string> = {
    green: 'bg-emerald-500', amber: 'bg-amber-400', red: 'bg-red-500',
  };
  const statusLabels: Record<string, string> = {
    green: 'Dentro da capacidade', amber: 'Atenção', red: 'Sobrecarga',
  };

  // Detail panel
  const selectedMember = activeMembers.find(m => m.id === selectedMemberId);
  const selectedRow = rows.find(r => r.id === selectedMemberId);

  if (selectedMember && selectedRow) {
    return (
      <div className="space-y-4">
        <h2 className="text-base font-semibold flex items-center gap-2"><Users className="h-4 w-4" /> Capacidade da Equipa</h2>
        <MemberProductivityDetail
          member={selectedMember}
          memberRow={selectedRow}
          allMembers={activeMembers}
          allTasks={tasks}
          allEntries={entries}
          allProjects={projects}
          allProfiles={profiles}
          onBack={() => setSelectedMemberId(null)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold flex items-center gap-2"><Users className="h-4 w-4" /> Capacidade da Equipa</h2>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Membro</TableHead>
              <TableHead className="text-right">Horas disponíveis/mês</TableHead>
              <TableHead className="text-right">Clientes ativos</TableHead>
              <TableHead className="text-right">Horas comprometidas</TableHead>
              <TableHead className="text-right">Horas livres</TableHead>
              <TableHead className="text-right">% Ocupação</TableHead>
              <TableHead>Status</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">Sem membros ativos</TableCell></TableRow>
              ) : rows.map(r => (
                <TableRow key={r.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedMemberId(r.id)}>
                  <TableCell className="text-sm font-medium">
                    {r.name}
                    {r.missingHoursFlag && (
                      <span className="ml-1.5 text-amber-500" title="Algum produto sem horas mensais definidas"><AlertTriangle className="inline h-3 w-3" /></span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-right">{r.monthlyAvailable}h</TableCell>
                  <TableCell className="text-sm text-right">{r.clientCount}</TableCell>
                  <TableCell className="text-sm text-right">{r.committedHours}h</TableCell>
                  <TableCell className={`text-sm text-right ${r.freeHours < 0 ? 'text-destructive font-medium' : ''}`}>{r.freeHours}h</TableCell>
                  <TableCell className="text-sm text-right">{r.occupancy}%</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <span className={`inline-block h-2.5 w-2.5 rounded-full ${statusColors[r.capacityStatus]}`} />
                      <span className="text-xs">{statusLabels[r.capacityStatus]}</span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Alert block */}
      {alertRows.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-destructive" /> Alertas de Capacidade</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {alertRows.map(r => (
              <div key={r.id} className="rounded-lg border p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <span className={`inline-block h-2.5 w-2.5 rounded-full ${statusColors[r.capacityStatus]}`} />
                  <span className="font-medium text-sm">{r.name}</span>
                  <Badge variant={r.capacityStatus === 'red' ? 'destructive' : 'secondary'} className="text-xs ml-auto">
                    {statusLabels[r.capacityStatus]}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground grid grid-cols-3 gap-2">
                  <span>Disponíveis: {r.monthlyAvailable}h</span>
                  <span>Comprometidas: {r.committedHours}h</span>
                  <span>{r.capacityStatus === 'red' ? `Excesso: ${Math.abs(r.freeHours)}h` : `Restantes: ${r.freeHours}h`}</span>
                </div>
                <p className="text-xs text-muted-foreground italic">
                  {r.capacityStatus === 'red'
                    ? `Este membro não tem capacidade para novos clientes. As horas comprometidas excedem as horas disponíveis em ${Math.abs(r.freeHours)}h.`
                    : `Este membro está a aproximar-se do limite de capacidade. Restam apenas ${r.freeHours}h disponíveis.`}
                </p>
                {r.clientDetails.length > 0 && (
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead className="text-xs">Cliente</TableHead>
                      <TableHead className="text-xs">Produto</TableHead>
                      <TableHead className="text-xs text-right">Horas/mês</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {r.clientDetails.map((cd, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-xs">{cd.clientName}</TableCell>
                          <TableCell className="text-xs">{cd.productName}</TableCell>
                          <TableCell className="text-xs text-right">
                            {cd.hours != null ? `${cd.hours}h` : <span className="text-amber-500">Sem horas definidas</span>}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ─── TAB 2: TEMPO POR CLIENTE ─── */
function ByClientTab({ entries, clients }: { entries: any[]; clients: any[] }) {
  const [period, setPeriod] = useState('month');
  const { start, end } = getDateRange(period);

  const filtered = entries.filter(e => {
    const d = new Date(e.entry_date);
    return d >= start && d <= end && e.client_id;
  });

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

/* ─── TAB 4: TAREFAS & SOBRECARGA ─── */
function OverloadTab({ entries, members, tasks }: { entries: any[]; members: any[]; tasks: any[] }) {
  // Tasks by time
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
      return { tid, name: task?.name || 'Tarefa desconhecida', assigned: task?.assigned_to, project_id: task?.project_id, department: task?.department, ...data };
    })
    .sort((a, b) => b.hours - a.hours)
    .slice(0, 20);

  // Weekly overload analysis (last 4 weeks)
  const now = new Date();
  const weekRanges = Array.from({ length: 4 }, (_, i) => {
    const ws = startOfWeek(subWeeks(now, 3 - i), { weekStartsOn: 1 });
    const we = endOfWeek(ws, { weekStartsOn: 1 });
    return { start: ws, end: we, label: `${format(ws, 'dd/MM')} → ${format(we, 'dd/MM')}` };
  });

  const memberOverload = members.map(m => {
    const expected = Number(m.expected_weekly_hours || 40);
    const weeklyPcts = weekRanges.map(w => {
      const wEntries = entries.filter(e => {
        const d = new Date(e.entry_date);
        return e.member_id === m.id && d >= w.start && d <= w.end;
      });
      const hours = wEntries.reduce((s, e) => s + Number(e.duration || 0), 0);
      return expected > 0 ? (hours / expected) * 100 : 0;
    });
    const avg = weeklyPcts.reduce((s, v) => s + v, 0) / 4;
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

/* ─── TAB 5: REGISTO DE TEMPO ─── */
function TimeLogTab({ entries, members, clients, projects, tasks }: { entries: any[]; members: any[]; clients: any[]; projects: any[]; tasks: any[] }) {
  const qc = useQueryClient();
  const [filter, setFilter] = useState('all');
  const [filterMember, setFilterMember] = useState('');
  const [filterClient, setFilterClient] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);

  // New entry state
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
        entry_date: newDate,
        member_id: newMember || null,
        duration: parseFloat(newDuration) || 0,
        category: newCategory,
        task_id: newTask || null,
        project_id: newProject || null,
        client_id: newClient || null,
        description: newDesc || null,
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
    mutationFn: async (id: string) => {
      await supabase.from('time_entries').delete().eq('id', id);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['time_entries'] }); toast.success('Removido'); },
  });

  // Filter
  const filtered = useMemo(() => {
    let result = [...entries];
    const now = new Date();
    if (filter === 'week') {
      const { start, end } = getDateRange('week');
      result = result.filter(e => { const d = new Date(e.entry_date); return d >= start && d <= end; });
    } else if (filter === 'month') {
      const { start, end } = getDateRange('month');
      result = result.filter(e => { const d = new Date(e.entry_date); return d >= start && d <= end; });
    }
    if (filterMember) result = result.filter(e => e.member_id === filterMember);
    if (filterClient) result = result.filter(e => e.client_id === filterClient);
    return result;
  }, [entries, filter, filterMember, filterClient]);

  const totalHours = filtered.reduce((s, e) => s + Number(e.duration || 0), 0);

  // Auto-fill client when project selected
  const handleProjectChange = (pid: string) => {
    setNewProject(pid);
    if (pid) {
      const proj = projects.find((p: any) => p.id === pid);
      if (proj?.client_name) {
        const client = clients.find((c: any) => c.full_name === proj.client_name);
        if (client) setNewClient(client.id);
      }
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
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-3 w-3 mr-1" /> Novo Registo</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Novo Registo de Tempo</DialogTitle></DialogHeader>
              <div className="grid gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Data</label>
                    <Input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} className="h-8 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Duração (horas)</label>
                    <Input type="number" step="0.25" min="0" value={newDuration} onChange={e => setNewDuration(e.target.value)} placeholder="1.5" className="h-8 text-sm" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Membro</label>
                  <Select value={newMember} onValueChange={setNewMember}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecionar membro" /></SelectTrigger>
                    <SelectContent>{members.map(m => <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Categoria</label>
                  <Select value={newCategory} onValueChange={setNewCategory}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>{CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Projeto (opcional)</label>
                  <Select value={newProject} onValueChange={handleProjectChange}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Nenhum" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      {projects.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Cliente (opcional)</label>
                  <Select value={newClient} onValueChange={setNewClient}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Nenhum" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      {clients.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Tarefa (opcional)</label>
                  <Select value={newTask} onValueChange={setNewTask}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Nenhuma" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhuma</SelectItem>
                      {tasks.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Descrição</label>
                  <Textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Descrição do trabalho..." className="min-h-[60px] text-sm" />
                </div>
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
              <TableHead>ID</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Membro</TableHead>
              <TableHead className="text-right">Duração</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Tarefa</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead className="w-8"></TableHead>
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
                  <TableCell>
                    <button onClick={() => deleteEntry.mutate(e.id)} className="text-muted-foreground hover:text-destructive">
                      <Clock className="h-3 w-3" />
                    </button>
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
