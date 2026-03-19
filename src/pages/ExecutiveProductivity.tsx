import { useState, useMemo } from 'react';
import { AppLayout } from '@/components/AppLayout';
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
import { Clock, Users, Briefcase, AlertTriangle, Plus, BarChart3, Timer } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, subWeeks } from 'date-fns';
import { pt } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

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
      const { data } = await supabase.from('tasks').select('id, name, assigned_to, project_id, department, estimated_time, deadline, status');
      return (data || []) as any[];
    },
  });

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Gestão de Produtividade & Tempo</h1>
          <p className="text-sm text-muted-foreground mt-1">Controlo de tempo, ocupação e análise de produtividade</p>
        </div>

        <Tabs defaultValue="overview">
          <TabsList className="flex-wrap">
            <TabsTrigger value="overview"><BarChart3 className="h-3.5 w-3.5 mr-1.5" />Visão Geral</TabsTrigger>
            <TabsTrigger value="by-client"><Briefcase className="h-3.5 w-3.5 mr-1.5" />Tempo por Cliente</TabsTrigger>
            <TabsTrigger value="by-member"><Users className="h-3.5 w-3.5 mr-1.5" />Tempo por Membro</TabsTrigger>
            <TabsTrigger value="overload"><AlertTriangle className="h-3.5 w-3.5 mr-1.5" />Tarefas & Sobrecarga</TabsTrigger>
            <TabsTrigger value="log"><Timer className="h-3.5 w-3.5 mr-1.5" />Registo de Tempo</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <OverviewTab entries={entries.data || []} members={members.data || []} clients={clients.data || []} products={productsQ.data || []} tasks={tasks.data || []} />
          </TabsContent>
          <TabsContent value="by-client">
            <ByClientTab entries={entries.data || []} clients={clients.data || []} />
          </TabsContent>
          <TabsContent value="by-member">
            <ByMemberTab entries={entries.data || []} members={members.data || []} />
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

/* ─── TAB 1: VISÃO GERAL ─── */
function OverviewTab({ entries, members, clients, products, tasks }: { entries: any[]; members: any[]; clients: any[]; products: any[]; tasks: any[] }) {
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

      {/* Overload Alerts */}
      {alerts.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-destructive" /> Alertas de sobrecarga</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow>
                <TableHead>Membro</TableHead><TableHead>Esperadas</TableHead><TableHead>Registadas</TableHead><TableHead>Excesso</TableHead><TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {alerts.map(a => (
                  <TableRow key={a.id}>
                    <TableCell className="text-sm font-medium">{a.full_name}</TableCell>
                    <TableCell className="text-sm">{a.expected}h</TableCell>
                    <TableCell className="text-sm">{a.actual.toFixed(1)}h</TableCell>
                    <TableCell className="text-sm">+{a.pct.toFixed(0)}%</TableCell>
                    <TableCell><Badge variant={a.pct >= 20 ? 'destructive' : 'secondary'} className="text-xs">{a.pct >= 20 ? 'Sobrecarga' : 'Atenção'}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* ─── Capacidade da Equipa ─── */}
      <TeamCapacitySection members={members} clients={clients} products={products} tasks={tasks} />
    </div>
  );
}

/* ─── CAPACIDADE DA EQUIPA ─── */
function TeamCapacitySection({ members, clients, products, tasks }: { members: any[]; clients: any[]; products: any[]; tasks: any[] }) {
  const activeMembers = members.filter(m => m.status === 'ativo');
  const activeClients = clients.filter(c => c.status === 'ativo');

  const productHoursMap: Record<string, number | null> = {};
  products.forEach(p => { productHoursMap[p.name] = p.monthly_hours_per_client; });

  const rows = activeMembers.map(m => {
    const weeklyHours = Number(m.expected_weekly_hours || 40);
    const monthlyAvailable = Math.round(weeklyHours * 4.33 * 10) / 10;

    // Clients where dp matches member name
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

    const freeHours = Math.round((monthlyAvailable - committedHours) * 10) / 10;
    const occupancy = monthlyAvailable > 0 ? Math.round((committedHours / monthlyAvailable) * 100) : 0;
    const capacityStatus: 'green' | 'amber' | 'red' = occupancy > 100 ? 'red' : occupancy >= 80 ? 'amber' : 'green';

    return {
      id: m.id, name: m.full_name, monthlyAvailable, clientCount: memberClients.length,
      committedHours, freeHours, occupancy, capacityStatus, missingHoursFlag, clientDetails,
    };
  });

  const alertRows = rows.filter(r => r.capacityStatus === 'red' || r.capacityStatus === 'amber');

  const statusColors: Record<string, string> = {
    green: 'bg-emerald-500', amber: 'bg-amber-400', red: 'bg-red-500',
  };
  const statusLabels: Record<string, string> = {
    green: 'Dentro da capacidade', amber: 'Atenção', red: 'Sobrecarga',
  };

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
                <TableRow key={r.id}>
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

/* ─── TAB 3: TEMPO POR MEMBRO ─── */
function ByMemberTab({ entries, members }: { entries: any[]; members: any[] }) {
  const [period, setPeriod] = useState('month');
  const { start, end } = getDateRange(period);
  const weeks = weeksInPeriod(period);

  const filtered = entries.filter(e => {
    const d = new Date(e.entry_date);
    return d >= start && d <= end;
  });

  const rows = members.map(m => {
    const mEntries = filtered.filter(e => e.member_id === m.id);
    const hours = mEntries.reduce((s, e) => s + Number(e.duration || 0), 0);
    const expected = Number(m.expected_weekly_hours || 40) * weeks;
    const diff = hours - expected;
    const pct = expected > 0 ? (hours / expected) * 100 : 0;
    const catBreakdown: Record<string, number> = {};
    mEntries.forEach(e => { const c = e.category || 'outro'; catBreakdown[c] = (catBreakdown[c] || 0) + Number(e.duration || 0); });
    return { ...m, hours, expected, diff, pct, catBreakdown };
  });

  const chartData = rows.map(r => ({
    name: r.full_name?.split(' ')[0] || 'N/A',
    esperadas: Number(r.expected.toFixed(1)),
    registadas: Number(r.hours.toFixed(1)),
  }));

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {PERIOD_FILTERS.map(f => (
          <Button key={f.value} size="sm" variant={period === f.value ? 'default' : 'outline'} onClick={() => setPeriod(f.value)}>{f.label}</Button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Membro</TableHead><TableHead>Função</TableHead><TableHead className="text-right">Esperadas</TableHead><TableHead className="text-right">Registadas</TableHead><TableHead className="text-right">Diferença</TableHead><TableHead className="text-right">Ocupação</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {rows.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm font-medium">{r.full_name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{r.role_title || '—'}</TableCell>
                    <TableCell className="text-sm text-right">{r.expected.toFixed(0)}h</TableCell>
                    <TableCell className="text-sm text-right">{r.hours.toFixed(1)}h</TableCell>
                    <TableCell className={`text-sm text-right ${r.diff > 0 ? 'text-destructive' : r.diff < -5 ? 'text-amber-500' : ''}`}>{r.diff > 0 ? '+' : ''}{r.diff.toFixed(1)}h</TableCell>
                    <TableCell className="text-right">
                      <Badge variant={r.pct > 110 ? 'destructive' : r.pct > 90 ? 'default' : 'secondary'} className="text-xs">{r.pct.toFixed(0)}%</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Esperadas vs Registadas</CardTitle></CardHeader>
          <CardContent className="h-72">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical">
                  <XAxis type="number" fontSize={12} />
                  <YAxis type="category" dataKey="name" fontSize={12} width={70} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="esperadas" fill="hsl(var(--muted-foreground))" radius={[0,4,4,0]} />
                  <Bar dataKey="registadas" fill="hsl(var(--primary))" radius={[0,4,4,0]} />
                </BarChart>
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
