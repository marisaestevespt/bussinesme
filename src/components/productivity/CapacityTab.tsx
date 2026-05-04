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
import { Users, Calculator, Clock, AlertTriangle, TrendingUp, ArrowRight, CheckCircle2, Plus, Trash2, UserPlus, Rocket, Euro, ArrowUpRight } from 'lucide-react';
import { HiringSimulator } from './CapacitySimulator';
import { HiringSignalAlert } from './HiringSignalAlert';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getDay } from 'date-fns';
import { getHolidaySet } from '@/lib/holidays';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useProducts, Product } from '@/hooks/useProducts';
import { useClients } from '@/hooks/useClients';
import { WEEKS_PER_MONTH, getDateRange } from './productivity-constants';
import { formatEuro } from '@/lib/formatting';
import { EmptyHint } from '@/components/ui/loading-skeletons';

export function CapacityTab({ members, entries, clients, products, scenario, scenarioProducts }: {
  members: any[]; entries: any[]; clients: any[]; products: any[]; scenario: any; scenarioProducts: any[];
}) {
  return (
    <Tabs defaultValue="team" className="space-y-4">
      <TabsList className="flex-wrap">
        <TabsTrigger value="team"><Users className="h-3.5 w-3.5 mr-1.5" />Ocupação da Equipa</TabsTrigger>
        <TabsTrigger value="simulator"><Rocket className="h-3.5 w-3.5 mr-1.5" />Simulador de Crescimento</TabsTrigger>
      </TabsList>
      <TabsContent value="team">
        <TeamCapacityView members={members} entries={entries} />
      </TabsContent>
      <TabsContent value="simulator">
        <CapacitySimulatorView members={members} entries={entries} clients={clients} products={products} scenario={scenario} scenarioProducts={scenarioProducts} />
      </TabsContent>
    </Tabs>
  );
}

function TeamCapacityView({ members, entries }: { members: any[]; entries: any[] }) {
  const activeMembers = members.filter(m => m.status === 'ativo');
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
      <HiringSignalAlert overallUsage={overallUsage} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Equipa ativa</p><p className="text-2xl font-bold">{activeMembers.length}</p><p className="text-xs text-muted-foreground">membros</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Capacidade mensal</p><p className="text-2xl font-bold">{totalMonthlyHours}h</p><p className="text-xs text-muted-foreground">{totalWeeklyHours}h/semana</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Registado (mês)</p><p className="text-2xl font-bold">{totalActual.toFixed(1)}h</p><p className="text-xs"><span className="text-primary font-medium">{totalClientH.toFixed(1)}h cliente</span> <span className="text-muted-foreground">+ {totalInternalH.toFixed(1)}h interno</span></p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Ocupação geral</p><p className={`text-2xl font-bold ${overallUsage > 100 ? 'text-destructive' : overallUsage > 85 ? 'text-warning' : 'text-foreground'}`}>{overallUsage}%</p><Progress value={Math.min(overallUsage, 100)} className="h-2 mt-1" /></CardContent></Card>
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
          ) : <EmptyHint className="pt-20">Sem dados</EmptyHint>}
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
                  <TableCell className="text-muted-foreground">{m.role}</TableCell>
                  <TableCell><Badge variant={m.isClientFacing ? 'default' : 'secondary'} className="text-[10px]">{m.areaLabel}</Badge></TableCell>
                  <TableCell className="text-sm text-right tabular-nums">{m.monthlyH}h</TableCell>
                  <TableCell className="text-sm text-right tabular-nums font-medium">{m.actualH}h</TableCell>
                  <TableCell className="text-sm text-right tabular-nums text-primary">{m.clientH}h</TableCell>
                  <TableCell className="text-sm text-right tabular-nums">{m.internalH}h</TableCell>
                  <TableCell className={`text-sm text-right tabular-nums ${m.remainingH < 0 ? 'text-destructive' : ''}`}>{m.remainingH}h</TableCell>
                  <TableCell className={`text-sm text-right font-medium ${m.usagePct > 100 ? 'text-destructive' : m.usagePct > 85 ? 'text-warning' : ''}`}>{m.usagePct}%</TableCell>
                  <TableCell className="text-center">{m.weekendDays > 0 ? <Badge variant="outline" className="text-[10px] border-warning/30 text-warning">{m.weekendDays}d · {m.weekendH}h</Badge> : <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell className="text-center">{m.holidayDays > 0 ? <Badge variant="outline" className="text-[10px] border-info/30 text-info">{m.holidayDays}d · {m.holidayH}h</Badge> : <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell>
                    <div className="flex h-2.5 w-24 rounded-full overflow-hidden bg-muted">
                      <div className={`h-full rounded-full ${m.usagePct > 100 ? 'bg-destructive' : m.usagePct > 85 ? 'bg-warning' : 'bg-primary'}`} style={{ width: `${Math.min(m.usagePct, 100)}%` }} />
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

function CapacitySimulatorView({ members: teamMembers, entries, clients: allClientsRaw, products: allProductsRaw, scenario: scenarioData, scenarioProducts: scenarioProductsRawData }: {
  members: any[]; entries: any[]; clients: any[]; products: any[]; scenario: any; scenarioProducts: any[];
}) {
  const qc = useQueryClient();
  const { products: productsHook } = useProducts();
  const allProducts = (productsHook.data || []).filter((p: Product) => p.status !== 'off');
  const { clients: clientsHook } = useClients();
  const allClients = clientsHook.data || [];

  const members = teamMembers.filter(m => m.status === 'ativo');

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

  // ─── Client-facing selection ───
  const [clientFacingIds, setClientFacingIds] = useState<Set<string>>(new Set());
  const [cfInitialized, setCfInitialized] = useState(false);

  if (members.length > 0 && !cfInitialized) {
    // Fonte única: flag works_with_clients no membro.
    // Fallback (legacy) para work_areas client-facing se ninguém tiver a flag.
    const flagged = members.filter(m => (m as any).works_with_clients === true).map(m => m.id);
    if (flagged.length > 0) {
      setClientFacingIds(new Set(flagged));
    } else {
      const CLIENT_AREAS = ['cliente_administrativo', 'cliente_servico', 'cliente_comercial'];
      const autoIds = members
        .filter(m => {
          const areas: string[] = Array.isArray((m as any).work_areas) ? (m as any).work_areas : [];
          return areas.some(a => CLIENT_AREAS.includes(a));
        })
        .map(m => m.id);
      setClientFacingIds(new Set(autoIds.length > 0 ? autoIds : members.map(m => m.id)));
    }
    setCfInitialized(true);
  }

  // ─── Overhead in HOURS per member ───
  const [memberOverhead, setMemberOverhead] = useState<Record<string, { admin: number; business: number }>>({});
  const [overheadInitialized, setOverheadInitialized] = useState(false);

  if (members.length > 0 && scenario.data && !overheadInitialized) {
    const saved = (scenario.data as any).member_overheads;
    const initial: Record<string, { admin: number; business: number }> = {};
    for (const m of members) {
      const monthlyH = Math.round((Number(m.expected_weekly_hours) || 0) * WEEKS_PER_MONTH);
      if (saved && saved[m.id]) {
        const s = saved[m.id];
        // Migrate from % to hours: if values look like percentages (both < 100 and monthlyH > 100), convert
        if (s.admin <= 100 && s.business <= 100 && monthlyH > 100) {
          initial[m.id] = { admin: Math.round(monthlyH * s.admin / 100), business: Math.round(monthlyH * s.business / 100) };
        } else if (s.admin <= 100 && s.business <= 100 && monthlyH <= 100) {
          // Could be either; if admin+business < monthlyH treat as hours, else as %
          if (s.admin + s.business <= monthlyH) initial[m.id] = s;
          else initial[m.id] = { admin: Math.round(monthlyH * s.admin / 100), business: Math.round(monthlyH * s.business / 100) };
        } else {
          initial[m.id] = s;
        }
      } else {
        // Default: 20% of monthly hours for admin, 0 for business
        initial[m.id] = { admin: Math.round(monthlyH * 0.2), business: 0 };
      }
    }
    setMemberOverhead(initial);
    setOverheadInitialized(true);
  }

  const setMemberAdmin = (id: string, val: number) => {
    setMemberOverhead(prev => ({ ...prev, [id]: { ...prev[id], admin: Math.max(0, val), business: prev[id]?.business || 0 } }));
  };
  const setMemberBusiness = (id: string, val: number) => {
    setMemberOverhead(prev => ({ ...prev, [id]: { admin: prev[id]?.admin || 0, business: Math.max(0, val) } }));
  };

  // ─── Computed values ───
  const clientFacingMembers = useMemo(() => members.filter(m => clientFacingIds.has(m.id)), [members, clientFacingIds]);

  const teamSummary = useMemo(() => {
    let totalMonthly = 0, totalAdmin = 0, totalBusiness = 0;
    clientFacingMembers.forEach(m => {
      const monthlyH = (Number(m.expected_weekly_hours) || 0) * WEEKS_PER_MONTH;
      const oh = memberOverhead[m.id] || { admin: 0, business: 0 };
      totalMonthly += monthlyH;
      totalAdmin += oh.admin;
      totalBusiness += oh.business;
    });
    const available = Math.max(0, totalMonthly - totalAdmin - totalBusiness);
    return { totalMonthly: Math.round(totalMonthly), totalAdmin: Math.round(totalAdmin), totalBusiness: Math.round(totalBusiness), available: Math.round(available) };
  }, [clientFacingMembers, memberOverhead]);

  const realClientCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of allClients) {
      if (['ativo', 'em_onboarding', 'altura_renovacao'].includes((c as any).status) && (c as any).current_product) {
        counts[(c as any).current_product] = (counts[(c as any).current_product] || 0) + 1;
      }
    }
    return counts;
  }, [allClients]);

  // ─── Mutations ───
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
        useful_hours_per_month: teamSummary.available,
        team_size: members.length,
        client_facing_count: clientFacingMembers.length,
        member_overheads: memberOverhead,
      } as any).eq('id', scenarioId);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['capacity-scenario'] }); toast.success('Parâmetros guardados'); },
  });

  const addProduct = useMutation({
    mutationFn: async (product: Product) => {
      let scenarioId = scenario.data?.id;
      if (!scenarioId) scenarioId = await ensureScenario.mutateAsync();
      const ticketVal = parseFloat(String((product as any).ticket ?? '0').replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
      const { error } = await supabase.from('capacity_scenario_products').insert({
        scenario_id: scenarioId, product_id: product.id, product_name: product.name,
        hours_per_client_month: product.monthly_hours_per_client || 0, current_clients: 0,
        price_per_client: ticketVal,
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
  // current_clients now stores "simulate +X extra", so total = real + extra
  const totalHoursUsed = items.reduce((sum, p) => {
    const hpc = Number(p.hours_per_client_month);
    const real = realClientCounts[p.product_name] || 0;
    const simExtra = Number(p.current_clients);
    return sum + hpc * (real + simExtra);
  }, 0);
  const hoursRemaining = teamSummary.available - totalHoursUsed;
  const capacityPercent = teamSummary.available > 0 ? Math.round((totalHoursUsed / teamSummary.available) * 100) : 0;
  const totalRealClients = items.reduce((s, p) => s + (realClientCounts[p.product_name] || 0), 0);
  const totalSimExtra = items.reduce((s, p) => s + Number(p.current_clients), 0);

  const addedProductIds = items.map(p => p.product_id);
  const availableToAdd = allProducts.filter((p: Product) => !addedProductIds.includes(p.id));

  // ─── RENDER ───
  return (
    <div className="space-y-8">
      {/* ═══ PASSO 1: EQUIPA ═══ */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">1</div>
              Horas da equipa para clientes
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5 ml-8">Define quanto tempo cada membro gasta com admin e negócio. O resto fica disponível para clientes.</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => saveSettings.mutate()} disabled={saveSettings.isPending}>Guardar</Button>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Membro</TableHead>
                  <TableHead className="text-right w-28">Horas/mês</TableHead>
                  <TableHead className="text-right w-28">Admin (h)</TableHead>
                  <TableHead className="text-right w-28">Negócio (h)</TableHead>
                  <TableHead className="text-right w-32">Disponível p/ clientes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map(m => {
                  const weeklyH = Number(m.expected_weekly_hours) || 0;
                  const monthlyH = Math.round(weeklyH * WEEKS_PER_MONTH);
                  const isSelected = clientFacingIds.has(m.id);
                  const oh = memberOverhead[m.id] || { admin: 0, business: 0 };
                  const availH = Math.max(0, monthlyH - oh.admin - oh.business);
                  return (
                    <TableRow key={m.id} className={!isSelected ? 'opacity-40' : ''}>
                      <TableCell>
                        <Checkbox checked={isSelected} onCheckedChange={(checked) => {
                          const next = new Set(clientFacingIds);
                          if (checked) next.add(m.id); else next.delete(m.id);
                          setClientFacingIds(next);
                        }} />
                      </TableCell>
                      <TableCell className="font-medium text-sm">{m.full_name}</TableCell>
                      <TableCell className="text-right tabular-nums text-sm text-muted-foreground">{monthlyH}h</TableCell>
                      <TableCell className="text-right">
                        {isSelected ? (
                          <Input type="number" className="h-7 w-20 text-sm text-right ml-auto" min={0} max={monthlyH}
                            value={oh.admin} onChange={e => setMemberAdmin(m.id, Number(e.target.value))} />
                        ) : <span className="text-sm text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        {isSelected ? (
                          <Input type="number" className="h-7 w-20 text-sm text-right ml-auto" min={0} max={monthlyH}
                            value={oh.business} onChange={e => setMemberBusiness(m.id, Number(e.target.value))} />
                        ) : <span className="text-sm text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={`text-sm font-semibold tabular-nums ${isSelected ? 'text-primary' : 'text-muted-foreground'}`}>{isSelected ? `${availH}h` : '—'}</span>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {members.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-6">Nenhum membro ativo</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Team summary */}
        <div className="grid grid-cols-4 gap-3">
          <div className="rounded-lg border bg-muted/30 p-3 text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Total bruto</p>
            <p className="text-lg font-bold tabular-nums">{teamSummary.totalMonthly}h</p>
          </div>
          <div className="rounded-lg border bg-muted/30 p-3 text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Admin</p>
            <p className="text-lg font-bold tabular-nums">−{teamSummary.totalAdmin}h</p>
          </div>
          <div className="rounded-lg border bg-muted/30 p-3 text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Negócio</p>
            <p className="text-lg font-bold tabular-nums">−{teamSummary.totalBusiness}h</p>
          </div>
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Para clientes</p>
            <p className="text-lg font-bold tabular-nums text-primary">{teamSummary.available}h</p>
          </div>
        </div>
      </div>

      <Separator />

      {/* ═══ PASSO 2: PRODUTOS & CLIENTES ═══ */}
      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">2</div>
            Produtos e clientes
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5 ml-8">Vê quantos clientes ativos tens, simula adicionar mais e analisa o impacto nas horas.</p>
        </div>

        {items.length > 0 && (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead className="text-right w-24">Clientes ativos</TableHead>
                    <TableHead className="text-right w-28">h/cliente/mês</TableHead>
                    <TableHead className="text-right w-24">Simular +</TableHead>
                    <TableHead className="text-right w-24">Máximo</TableHead>
                    <TableHead className="text-right w-32">Análise (horas)</TableHead>
                    <TableHead className="text-right w-28">Podes adicionar +</TableHead>
                    <TableHead className="w-8"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map(item => {
                    const hpc = Number(item.hours_per_client_month);
                    const simExtra = Number(item.current_clients); // current_clients stores the "simulate +X" value
                    const realCount = realClientCounts[item.product_name] || 0;
                    const sourceProduct = allProducts.find((p: Product) => p.id === item.product_id);
                    const maxClients = (sourceProduct as any)?.max_simultaneous_clients as number | null;
                    const totalClients = realCount + simExtra;
                    const totalHours = hpc * totalClients;
                    const canAddByMax = maxClients != null && maxClients > 0 ? Math.max(0, maxClients - totalClients) : null;
                    const canAddByHours = hpc > 0 && hoursRemaining > 0 ? Math.floor(hoursRemaining / hpc) : 0;
                    const canAdd = canAddByMax != null ? Math.min(canAddByMax, canAddByHours) : canAddByHours;
                    const atCapacity = maxClients != null && maxClients > 0 && totalClients >= maxClients;

                    return (
                      <TableRow key={item.id} className={atCapacity ? 'bg-destructive/5' : ''}>
                        <TableCell className="font-medium text-sm">{item.product_name}</TableCell>
                        <TableCell className="text-right text-sm tabular-nums font-medium">{realCount}</TableCell>
                        <TableCell className="text-right">
                          <Input type="number" className="h-7 w-20 text-sm text-right ml-auto" defaultValue={hpc}
                            onBlur={e => { const val = parseFloat(e.target.value); if (!isNaN(val) && val !== hpc) updateScenarioProduct.mutate({ id: item.id, hours_per_client_month: val }); }} />
                        </TableCell>
                        <TableCell className="text-right">
                          <Input type="number" min={0} className="h-7 w-20 text-sm text-right ml-auto" defaultValue={simExtra}
                            onBlur={e => updateScenarioProduct.mutate({ id: item.id, current_clients: Math.max(0, Number(e.target.value)) })} />
                        </TableCell>
                        <TableCell className="text-right text-sm tabular-nums">
                          {maxClients != null && maxClients > 0 ? (
                            <Badge variant={atCapacity ? 'destructive' : 'outline'} className="text-[10px]">{maxClients}</Badge>
                          ) : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-right text-sm tabular-nums">
                          <span className="font-medium">{totalHours}h</span>
                          {simExtra > 0 && <span className="text-[10px] text-muted-foreground ml-1">({realCount}+{simExtra} × {hpc}h)</span>}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={`text-sm font-semibold tabular-nums ${canAdd === 0 ? 'text-muted-foreground' : 'text-primary'}`}>+{canAdd}</span>
                        </TableCell>
                        <TableCell>
                          <button onClick={() => deleteScenarioProduct.mutate(item.id)} className="text-muted-foreground hover:text-destructive">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {items.length === 0 && (
          <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">Adiciona produtos abaixo para simular a capacidade</CardContent></Card>
        )}

        {availableToAdd.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <span className="text-xs text-muted-foreground self-center mr-1">Adicionar:</span>
            {availableToAdd.map((p: Product) => (
              <Button key={p.id} size="sm" variant="outline" className="text-xs h-7 gap-1" onClick={() => addProduct.mutate(p)}>
                <Plus className="h-3 w-3" /> {p.name}
              </Button>
            ))}
          </div>
        )}
      </div>

      <Separator />

      {/* ═══ PASSO 3: DIAGNÓSTICO ═══ */}
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">3</div>
            Diagnóstico
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5 ml-8">Resultado da simulação com os dados acima.</p>
        </div>

        {items.length > 0 ? (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card><CardContent className="p-4 text-center">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Clientes totais</p>
                <p className="text-2xl font-bold">{totalRealClients + totalSimExtra}</p>
                {totalSimExtra > 0 && <p className="text-[10px] text-muted-foreground">{totalRealClients} ativos + {totalSimExtra} simulados</p>}
              </CardContent></Card>
              <Card><CardContent className="p-4 text-center">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Horas ocupadas</p>
                <p className="text-2xl font-bold tabular-nums">{totalHoursUsed}h</p>
                <p className="text-[10px] text-muted-foreground">de {teamSummary.available}h</p>
              </CardContent></Card>
              <Card><CardContent className="p-4 text-center">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Ocupação</p>
                <p className={`text-2xl font-bold ${capacityPercent > 90 ? 'text-destructive' : capacityPercent > 70 ? 'text-warning' : 'text-foreground'}`}>{capacityPercent}%</p>
                <Progress value={Math.min(capacityPercent, 100)} className="h-2 mt-1" />
              </CardContent></Card>
              <Card><CardContent className="p-4 text-center">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Horas livres</p>
                <p className={`text-2xl font-bold ${hoursRemaining < 0 ? 'text-destructive' : 'text-foreground'}`}>{hoursRemaining}h</p>
                {hoursRemaining < 0 && <p className="text-[10px] text-destructive font-medium">Sobre-capacidade!</p>}
              </CardContent></Card>
            </div>

            {/* Conclusion */}
            <Card className={hoursRemaining < 0 ? 'border-destructive/50 bg-destructive/5' : hoursRemaining < 20 ? 'border-warning/30/50 bg-warning/15/30' : 'border-primary/30 bg-primary/5'}>
              <CardContent className="p-4 flex items-start gap-3">
                {hoursRemaining < 0 ? (
                  <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                )}
                <div className="text-sm space-y-2">
                  {hoursRemaining < 0 ? (
                    <>
                      <p><strong>Capacidade esgotada.</strong> Estás {Math.abs(hoursRemaining)}h acima do que a equipa consegue entregar.</p>
                      <p className="text-xs text-muted-foreground">
                        💡 Opções: reduzir clientes, delegar tarefas admin, ou contratar alguém com ~{Math.abs(hoursRemaining)}h/mês disponíveis.
                      </p>
                    </>
                  ) : hoursRemaining < 20 ? (
                    <>
                      <p><strong>Quase no limite.</strong> Só tens {hoursRemaining}h livres por mês.</p>
                      <p className="text-xs text-muted-foreground">
                        💡 Antes de aceitar mais clientes, considera delegar horas de admin ou preparar uma contratação.
                      </p>
                    </>
                  ) : (
                    <>
                      <p><strong>Tens margem.</strong> {hoursRemaining}h livres por mês. Podes aceitar mais clientes:</p>
                      <ul className="text-xs text-muted-foreground space-y-0.5 mt-1">
                        {items.filter(p => Number(p.hours_per_client_month) > 0).map(p => {
                          const hpc = Number(p.hours_per_client_month);
                          const sourceP = allProducts.find((pr: Product) => pr.id === p.product_id);
                          const maxC = (sourceP as any)?.max_simultaneous_clients as number | null;
                          const extraH = Math.floor(hoursRemaining / hpc);
                          const realC = realClientCounts[p.product_name] || 0;
                          const simE = Number(p.current_clients);
                          const extraM = maxC != null && maxC > 0 ? Math.max(0, maxC - realC - simE) : Infinity;
                          const extra = Math.min(extraH, extraM);
                          const limited = extraM < extraH && maxC != null;
                          return (
                            <li key={p.id}>
                              <strong>+{extra}</strong> clientes de <em>{p.product_name}</em>
                              {limited && <span className="text-warning"> (limitado pelo máximo de {maxC})</span>}
                            </li>
                          );
                        })}
                      </ul>
                      <p className="text-[10px] text-muted-foreground mt-1">(valores exclusivos — aceitar de um produto reduz espaço para outros)</p>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* If over capacity, show hiring suggestion */}
            {hoursRemaining < 0 && (
              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <UserPlus className="h-5 w-5 text-primary shrink-0" />
                    <div className="text-sm">
                      <p className="font-medium">Precisas de mais ~{Math.abs(hoursRemaining)}h/mês</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Isso equivale a contratar alguém a {Math.abs(hoursRemaining) <= 80 ? 'part-time' : 'full-time'} (~{Math.ceil(Math.abs(hoursRemaining) / WEEKS_PER_MONTH)}h/semana).
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        ) : (
          <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">
            Adiciona produtos no passo 2 para ver o diagnóstico.
          </CardContent></Card>
        )}
      </div>

      <Separator />

      {/* ═══ PASSO 4: IMPACTO FINANCEIRO ═══ */}
      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">4</div>
            Impacto financeiro
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5 ml-8">Compara a faturação atual com a simulada para perceber o impacto de aceitar mais clientes.</p>
        </div>

        {items.length > 0 ? (() => {
          const finData = items.map(item => {
            const realCount = realClientCounts[item.product_name] || 0;
            const simExtra = Number(item.current_clients);
            let price = Number(item.price_per_client) || 0;
            // Fallback: if price is 0, try to get it from the live product
            if (price === 0 && item.product_id) {
              const sourceP = allProducts.find((p: Product) => p.id === item.product_id);
              if (sourceP) {
                price = parseFloat(String((sourceP as any).ticket || '0').replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
              }
            }
            const currentRevenue = realCount * price;
            const simRevenue = (realCount + simExtra) * price;
            return {
              product: item.product_name,
              realCount,
              simExtra,
              price,
              currentRevenue,
              simRevenue,
              diff: simRevenue - currentRevenue,
            };
          });
          const totalCurrentMonthly = finData.reduce((s, f) => s + f.currentRevenue, 0);
          const totalSimMonthly = finData.reduce((s, f) => s + f.simRevenue, 0);
          const diffMonthly = totalSimMonthly - totalCurrentMonthly;
          const diffAnnual = diffMonthly * 12;
          return (
            <div className="space-y-4">
              {/* Summary cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card><CardContent className="p-4 text-center">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Faturação atual/mês</p>
                  <p className="text-2xl font-bold tabular-nums">{formatEuro(totalCurrentMonthly)}</p>
                  <p className="text-[10px] text-muted-foreground">{totalRealClients} clientes</p>
                </CardContent></Card>
                <Card className={diffMonthly > 0 ? 'border-primary/30 bg-primary/5' : ''}><CardContent className="p-4 text-center">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Faturação simulada/mês</p>
                  <p className="text-2xl font-bold tabular-nums">{formatEuro(totalSimMonthly)}</p>
                  <p className="text-[10px] text-muted-foreground">{totalRealClients + totalSimExtra} clientes</p>
                </CardContent></Card>
                <Card className={diffMonthly > 0 ? 'border-primary/30 bg-primary/5' : ''}><CardContent className="p-4 text-center">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Diferença mensal</p>
                  <p className={`text-2xl font-bold tabular-nums ${diffMonthly > 0 ? 'text-primary' : diffMonthly < 0 ? 'text-destructive' : ''}`}>
                    {diffMonthly > 0 ? '+' : ''}{formatEuro(diffMonthly)}
                  </p>
                </CardContent></Card>
                <Card className={diffMonthly > 0 ? 'border-primary/30 bg-primary/5' : ''}><CardContent className="p-4 text-center">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Diferença anual</p>
                  <p className={`text-2xl font-bold tabular-nums ${diffAnnual > 0 ? 'text-primary' : diffAnnual < 0 ? 'text-destructive' : ''}`}>
                    {diffAnnual > 0 ? '+' : ''}{formatEuro(diffAnnual)}
                  </p>
                </CardContent></Card>
              </div>

              {/* Per-product table */}
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produto</TableHead>
                        <TableHead className="text-right">Preço/cliente</TableHead>
                        <TableHead className="text-right">Clientes ativos</TableHead>
                        <TableHead className="text-right">Simulados (+)</TableHead>
                        <TableHead className="text-right">Faturação atual</TableHead>
                        <TableHead className="text-right">Faturação simulada</TableHead>
                        <TableHead className="text-right">Diferença</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {finData.map(f => (
                        <TableRow key={f.product}>
                          <TableCell className="font-medium text-sm">{f.product}</TableCell>
                          <TableCell className="text-right text-sm tabular-nums">{formatEuro(f.price)}</TableCell>
                          <TableCell className="text-right text-sm tabular-nums">{f.realCount}</TableCell>
                          <TableCell className="text-right text-sm tabular-nums">{f.simExtra > 0 ? `+${f.simExtra}` : '—'}</TableCell>
                          <TableCell className="text-right text-sm tabular-nums">{formatEuro(f.currentRevenue)}</TableCell>
                          <TableCell className="text-right text-sm tabular-nums font-medium">{formatEuro(f.simRevenue)}</TableCell>
                          <TableCell className={`text-right text-sm tabular-nums font-semibold ${f.diff > 0 ? 'text-primary' : ''}`}>
                            {f.diff > 0 ? '+' : ''}{formatEuro(f.diff)}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="border-t-2">
                        <TableCell colSpan={4} className="text-sm font-semibold text-right">Total</TableCell>
                        <TableCell className="text-right text-sm font-bold tabular-nums">{formatEuro(totalCurrentMonthly)}</TableCell>
                        <TableCell className="text-right text-sm font-bold tabular-nums">{formatEuro(totalSimMonthly)}</TableCell>
                        <TableCell className={`text-right text-sm font-bold tabular-nums ${diffMonthly > 0 ? 'text-primary' : diffMonthly < 0 ? 'text-destructive' : ''}`}>
                          {diffMonthly > 0 ? '+' : ''}{formatEuro(diffMonthly)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Conclusion */}
              {totalSimExtra > 0 && (
                <Card className={diffMonthly > 0 ? 'border-primary/30 bg-primary/5' : 'border-muted'}>
                  <CardContent className="p-4 flex items-start gap-3">
                    <ArrowUpRight className={`h-5 w-5 shrink-0 mt-0.5 ${diffMonthly > 0 ? 'text-primary' : 'text-muted-foreground'}`} />
                    <div className="text-sm space-y-1">
                      <p><strong>Com +{totalSimExtra} clientes</strong>, passarias a faturar <strong>{formatEuro(totalSimMonthly)}/mês</strong> ({formatEuro(diffAnnual > 0 ? diffAnnual : 0)}/ano a mais).</p>
                      {hoursRemaining < 0 && (
                        <p className="text-xs text-muted-foreground">
                          ⚠️ Mas precisas de mais {Math.abs(hoursRemaining)}h/mês de capacidade. Vê o passo 5 para simular contratações.
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {totalSimExtra === 0 && (
                <p className="text-sm text-muted-foreground text-center py-2">Simula +clientes no passo 2 para ver o impacto financeiro.</p>
              )}
            </div>
          );
        })() : (
          <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">
            Adiciona produtos no passo 2 para ver o impacto financeiro.
          </CardContent></Card>
        )}
      </div>

      <Separator />

      {/* ═══ PASSO 5: SIMULAÇÃO DE CONTRATAÇÃO ═══ */}
      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">5</div>
            Simulação de contratação
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5 ml-8">Simula novas contratações e analisa o impacto na capacidade e custos.</p>
        </div>
        <HiringSimulator members={members} entries={entries} />
      </div>
    </div>
  );
}