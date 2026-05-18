import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeftRight, Briefcase, Timer, Plus, Clock, Trash2 } from 'lucide-react';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, endOfMonth } from 'date-fns';
import { pt } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { CATEGORIES, PERIOD_FILTERS, getDateRange, weeksInPeriod, catLabel } from './productivity-constants';
import { EmptyHint } from '@/components/ui/loading-skeletons';
import { requireConfirm, confirmDestructive } from '@/lib/confirmDestructive';

export function TimeTab({ entries, members, clients, projects, tasks, scenario, scenarioProducts }: {
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

function TimeSplitView({ entries, members, scenario }: { entries: any[]; members: any[]; scenario: any; scenarioProducts: any[] }) {
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
          <Card className={deviation && Math.abs(deviation.clientDiff) > 10 ? 'border-warning/30/50' : ''}>
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
          ) : <EmptyHint className="pt-20">Sem dados</EmptyHint>}
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
                    <TableCell className="text-muted-foreground">{r.last ? format(new Date(r.last), 'dd/MM') : '—'}</TableCell>
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
            ) : <EmptyHint className="pt-20">Sem dados</EmptyHint>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

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
    onError: () => toast.error('Não consegui guardar a registo de tempo. Tenta novamente.'),
  });

  const deleteEntry = useMutation({
    mutationFn: async (id: string) => {
      await requireConfirm(); await supabase.from('time_entries').delete().eq('id', id); },
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
                  <TableCell className="text-muted-foreground font-mono">{e.entry_id}</TableCell>
                  <TableCell className="text-sm">{format(new Date(e.entry_date), 'dd/MM/yyyy')}</TableCell>
                  <TableCell className="text-sm">{e.member_id ? memberName(e.member_id) : '—'}</TableCell>
                  <TableCell className="text-sm text-right font-medium">{Number(e.duration).toFixed(1)}h</TableCell>
                  <TableCell><Badge variant="secondary" className="text-xs">{catLabel(e.category)}</Badge></TableCell>
                  <TableCell className="text-muted-foreground max-w-[120px] truncate">{e.task_id ? taskName(e.task_id) : '—'}</TableCell>
                  <TableCell className="text-muted-foreground">{e.client_id ? clientName(e.client_id) : '—'}</TableCell>
                  <TableCell className="text-muted-foreground max-w-[150px] truncate">{e.description || '—'}</TableCell>
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
