import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Calculator, Clock, AlertTriangle, TrendingUp, ArrowRight, CheckCircle2, Plus, Trash2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getDay } from 'date-fns';
import { getHolidaySet } from '@/lib/holidays';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useProducts, Product } from '@/hooks/useProducts';
import { useClients } from '@/hooks/useClients';
import { WEEKS_PER_MONTH, getDateRange } from './productivity-constants';

export function CapacityTab({ members, entries, clients, products, scenario, scenarioProducts }: {
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

function TeamCapacityView({ members, entries }: { members: any[]; entries: any[] }) {
  const activeMembers = members.filter(m => m.status === 'ativo' || m.status === 'prestador');
  const totalWeeklyHours = activeMembers.reduce((s, m) => s + (Number(m.expected_weekly_hours) || 0), 0);
  const totalMonthlyHours = Math.round(totalWeeklyHours * WEEKS_PER_MONTH);

  const { start, end } = getDateRange('month');
  const monthEntries = entries.filter(e => { const d = new Date(e.entry_date); return d >= start && d <= end; });

  const CLIENT_WORK_AREAS = ['cliente_servico', 'cliente_comercial', 'cliente_administrativo'];

  const holidaySet = useMemo(() => getHolidaySet(new Date().getFullYear()), []);

  const memberCapacity = useMemo(() => {
    return activeMembers.map(m => {
      const weeklyH = Number(m.expected_weekly_hours) || 0;
      const monthlyH = Math.round(weeklyH * WEEKS_PER_MONTH);
      const mEntries = monthEntries.filter(e => e.member_id === m.id);
      const actualH = mEntries.reduce((s: number, e: any) => s + Number(e.duration || 0), 0);
      const clientH = mEntries.filter(e => e.client_id || e.category === 'cliente').reduce((s: number, e: any) => s + Number(e.duration || 0), 0);
      const internalH = actualH - clientH;
      const usagePct = monthlyH > 0 ? Math.round((actualH / monthlyH) * 100) : 0;
      const areas: string[] = Array.isArray((m as any).work_areas) ? (m as any).work_areas : [];
      const isClientFacing = areas.some(a => CLIENT_WORK_AREAS.includes(a));
      const areaLabel = isClientFacing ? 'Cliente' : areas.includes('interno') ? 'Interno' : '—';
      const weekendEntries = mEntries.filter((e: any) => { const d = new Date(e.entry_date); return getDay(d) === 0 || getDay(d) === 6; });
      const holidayEntries = mEntries.filter((e: any) => holidaySet.has(e.entry_date));
      const weekendDays = new Set(weekendEntries.map((e: any) => e.entry_date)).size;
      const holidayDays = new Set(holidayEntries.map((e: any) => e.entry_date)).size;
      const weekendH = Number(weekendEntries.reduce((s: number, e: any) => s + Number(e.duration || 0), 0).toFixed(1));
      const holidayH = Number(holidayEntries.reduce((s: number, e: any) => s + Number(e.duration || 0), 0).toFixed(1));
      return { id: m.id, name: m.full_name, role: m.role_title || '—', weeklyH, monthlyH, actualH: Number(actualH.toFixed(1)), clientH: Number(clientH.toFixed(1)), internalH: Number(internalH.toFixed(1)), usagePct, remainingH: Number((monthlyH - actualH).toFixed(1)), areaLabel, isClientFacing, weekendDays, weekendH, holidayDays, holidayH };
    }).sort((a, b) => b.usagePct - a.usagePct);
  }, [activeMembers, monthEntries, holidaySet]);

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
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Horas disponíveis</p><p className={`text-2xl font-bold ${totalRemainingH < 0 ? 'text-destructive' : 'text-foreground'}`}>{totalRemainingH.toFixed(1)}h</p><p className="text-xs text-muted-foreground">restantes no mês</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Capacidade vs Registado</CardTitle></CardHeader>
        <CardContent className="h-64">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}><XAxis dataKey="name" fontSize={12} /><YAxis fontSize={12} /><Tooltip />
                <Bar dataKey="capacidade" name="Capacidade" fill="hsl(var(--muted-foreground))" opacity={0.3} radius={[4,4,0,0]} />
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
              <TableHead>Membro</TableHead><TableHead>Função</TableHead><TableHead>Área</TableHead>
              <TableHead className="text-right">Esperado</TableHead><TableHead className="text-right">Registado</TableHead>
              <TableHead className="text-right">Cliente</TableHead><TableHead className="text-right">Interno</TableHead>
              <TableHead className="text-right">Restante</TableHead><TableHead className="text-right">Ocupação</TableHead>
              <TableHead className="text-center">FdS</TableHead><TableHead className="text-center">Feriados</TableHead>
              <TableHead>Barra</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {memberCapacity.map(m => (
                <TableRow key={m.id}>
                  <TableCell className="text-sm font-medium">{m.name}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{m.role}</TableCell>
                  <TableCell><Badge variant={m.isClientFacing ? 'default' : 'secondary'} className="text-[10px]">{m.areaLabel}</Badge></TableCell>
                  <TableCell className="text-sm text-right tabular-nums">{m.monthlyH}h</TableCell>
                  <TableCell className="text-sm text-right tabular-nums font-medium">{m.actualH}h</TableCell>
                  <TableCell className="text-sm text-right tabular-nums text-primary">{m.clientH}h</TableCell>
                  <TableCell className="text-sm text-right tabular-nums">{m.internalH}h</TableCell>
                  <TableCell className={`text-sm text-right tabular-nums ${m.remainingH < 0 ? 'text-destructive' : ''}`}>{m.remainingH}h</TableCell>
                  <TableCell className={`text-sm text-right font-medium ${m.usagePct > 100 ? 'text-destructive' : m.usagePct > 85 ? 'text-amber-500' : ''}`}>{m.usagePct}%</TableCell>
                  <TableCell className="text-center text-xs">{m.weekendDays > 0 ? <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700">{m.weekendDays}d · {m.weekendH}h</Badge> : <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell className="text-center text-xs">{m.holidayDays > 0 ? <Badge variant="outline" className="text-[10px] border-blue-300 text-blue-700">{m.holidayDays}d · {m.holidayH}h</Badge> : <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell>
                    <div className="flex h-2.5 w-24 rounded-full overflow-hidden bg-muted">
                      <div className={`h-full rounded-full ${m.usagePct > 100 ? 'bg-destructive' : m.usagePct > 85 ? 'bg-amber-500' : 'bg-primary'}`} style={{ width: `${Math.min(m.usagePct, 100)}%` }} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {memberCapacity.length === 0 && (
                <TableRow><TableCell colSpan={12} className="text-center text-sm text-muted-foreground py-8">Sem membros ativos</TableCell></TableRow>
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

function GrowthScenarioSection({ members, clients, products }: { members: any[]; clients: any[]; products: Product[] }) {
  const [newClients, setNewClients] = useState(5);
  const [selectedProduct, setSelectedProduct] = useState(products[0]?.id || '');

  const CLIENT_WORK_AREAS = ['cliente_servico', 'cliente_comercial', 'cliente_administrativo'];
  const allActive = members.filter((m: any) => m.status === 'ativo' || m.status === 'prestador');
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
    const CLIENT_AREAS = ['cliente_administrativo', 'cliente_servico', 'cliente_comercial'];
    const autoIds = members
      .filter(m => {
        const areas: string[] = Array.isArray((m as any).work_areas) ? (m as any).work_areas : [];
        return areas.some(a => CLIENT_AREAS.includes(a));
      })
      .map(m => m.id);
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
                  const sourceProduct = allProducts.find((p: Product) => p.id === item.product_id);
                  const maxClients = (sourceProduct as any)?.max_simultaneous_clients as number | null;
                  const atCapacity = maxClients != null && maxClients > 0 && currentClients >= maxClients;

                  return (
                    <div key={item.id} className={`rounded-lg border p-4 space-y-3 ${atCapacity ? 'border-amber-400/60 bg-amber-50/30' : ''}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-sm">{item.product_name}</h4>
                          {itemRevenue > 0 && <Badge variant="secondary" className="text-[10px]">{itemRevenue.toLocaleString('pt-PT')}€/mês</Badge>}
                          {maxClients != null && maxClients > 0 && (
                            <Badge variant={atCapacity ? 'destructive' : 'outline'} className="text-[10px]">
                              {currentClients}/{maxClients} máx.
                            </Badge>
                          )}
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

        <GrowthScenarioSection members={members} clients={allClients} products={allProducts} />
      </div>
    </div>
  );
}
