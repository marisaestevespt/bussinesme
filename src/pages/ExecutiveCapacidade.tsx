import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { BackNavigation } from '@/components/BackNavigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Plus, Trash2, Calculator, Users, Clock, AlertTriangle, CheckCircle2, TrendingUp, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { useProducts, Product } from '@/hooks/useProducts';
import { useClients } from '@/hooks/useClients';
import { Checkbox } from '@/components/ui/checkbox';

export default function ExecutiveCapacidade() {
  const qc = useQueryClient();
  const { products } = useProducts();
  const allProducts = (products.data || []).filter((p: Product) => p.status !== 'off');
  const { clients } = useClients();
  const allClients = clients.data || [];

  // Fetch active team members with their weekly hours
  const teamMembers = useQuery({
    queryKey: ['team-members-capacity'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('team_members')
        .select('id, full_name, expected_weekly_hours, status, role_title')
        .in('status', ['ativo', 'prestador'])
        .order('full_name');
      if (error) throw error;
      return (data || []) as { id: string; full_name: string; expected_weekly_hours: number | null; status: string; role_title: string | null }[];
    },
  });
  const members = teamMembers.data || [];

  // Track which members are "client-facing" (selected for capacity)
  const [clientFacingIds, setClientFacingIds] = useState<Set<string>>(new Set());
  const [cfInitialized, setCfInitialized] = useState(false);

  // Initialize: all members are client-facing by default
  if (members.length > 0 && !cfInitialized) {
    setClientFacingIds(new Set(members.map(m => m.id)));
    setCfInitialized(true);
  }

  const realClientCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    const activeStatuses = ['ativo', 'em_onboarding', 'altura_renovacao'];
    for (const c of allClients) {
      if (activeStatuses.includes((c as any).status) && (c as any).current_product) {
        const prod = (c as any).current_product;
        counts[prod] = (counts[prod] || 0) + 1;
      }
    }
    return counts;
  }, [allClients]);

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

  // Auto-sync hours_per_client_month from source product
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

  // Per-member overhead percentages: { [memberId]: { admin: number, business: number } }
  const [memberOverhead, setMemberOverhead] = useState<Record<string, { admin: number; business: number }>>({});
  const [overheadInitialized, setOverheadInitialized] = useState(false);

  // Initialize overheads from saved scenario or defaults
  if (members.length > 0 && scenario.data && !overheadInitialized) {
    const defaultAdmin = Number(scenario.data.admin_percent) || 20;
    const defaultBusiness = Number(scenario.data.business_percent) || 0;
    // Try to load per-member overheads from scenario metadata
    const saved = (scenario.data as any).member_overheads;
    const initial: Record<string, { admin: number; business: number }> = {};
    for (const m of members) {
      if (saved && saved[m.id]) {
        initial[m.id] = saved[m.id];
      } else {
        initial[m.id] = { admin: defaultAdmin, business: defaultBusiness };
      }
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

  const WEEKS_PER_MONTH = 4.33;

  const clientFacingMembers = useMemo(() => {
    return members.filter(m => clientFacingIds.has(m.id));
  }, [members, clientFacingIds]);

  const clientFacingMonthlyHours = useMemo(() => {
    return clientFacingMembers.reduce((sum, m) => sum + (Number(m.expected_weekly_hours) || 0) * WEEKS_PER_MONTH, 0);
  }, [clientFacingMembers]);

  // Available hours = per-member: monthlyH * (1 - overhead%)
  const availableHours = useMemo(() => {
    return clientFacingMembers.reduce((sum, m) => {
      const monthlyH = (Number(m.expected_weekly_hours) || 0) * WEEKS_PER_MONTH;
      const oh = memberOverhead[m.id] || { admin: 20, business: 0 };
      const overheadPct = Math.min(oh.admin + oh.business, 100);
      return sum + monthlyH * (1 - overheadPct / 100);
    }, 0);
  }, [clientFacingMembers, memberOverhead]);

  const totalOverheadHours = useMemo(() => {
    return clientFacingMembers.reduce((sum, m) => {
      const monthlyH = (Number(m.expected_weekly_hours) || 0) * WEEKS_PER_MONTH;
      const oh = memberOverhead[m.id] || { admin: 20, business: 0 };
      const overheadPct = Math.min(oh.admin + oh.business, 100);
      return sum + monthlyH * (overheadPct / 100);
    }, 0);
  }, [clientFacingMembers, memberOverhead]);

  const effectiveTeamSize = members.length;
  const effectiveClientFacing = clientFacingMembers.length;

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
      if (!scenarioId) {
        scenarioId = await ensureScenario.mutateAsync();
      }
      const { error } = await supabase.from('capacity_scenarios').update({
        useful_hours_per_month: Math.round(clientFacingMonthlyHours),
        admin_percent: 0,
        business_percent: 0,
        team_size: effectiveTeamSize,
        client_facing_count: effectiveClientFacing,
        member_overheads: memberOverhead,
      } as any).eq('id', scenarioId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['capacity-scenario'] });
      toast.success('Definições guardadas');
    },
  });

  const addProduct = useMutation({
    mutationFn: async (product: Product) => {
      let scenarioId = scenario.data?.id;
      if (!scenarioId) {
        scenarioId = await ensureScenario.mutateAsync();
      }
      const { error } = await supabase.from('capacity_scenario_products').insert({
        scenario_id: scenarioId,
        product_id: product.id,
        product_name: product.name,
        hours_per_client_month: product.monthly_hours_per_client || 0,
        current_clients: 0,
        price_per_client: parseFloat(String(product.ticket || '0').replace(/[^\d.,]/g, '').replace(',', '.')) || 0,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['capacity-scenario-products'] });
      toast.success('Produto adicionado');
    },
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

  // Calculations
  const items = scenarioProducts.data || [];
  const totalHoursUsed = items.reduce((sum, p) => sum + (Number(p.hours_per_client_month) * Number(p.current_clients)), 0);
  const hoursRemaining = availableHours - totalHoursUsed;
  const capacityPercent = availableHours > 0 ? Math.round((totalHoursUsed / availableHours) * 100) : 0;

  // Revenue: current vs max (proportional distribution)
  const currentRevenue = items.reduce((sum, p) => sum + (Number(p.price_per_client || 0) * Number(p.current_clients)), 0);

  // Calculate additional clients each product can take with remaining hours
  const perProductExtra = useMemo(() => {
    const result: Record<string, number> = {};
    let remainingHrs = hoursRemaining;
    for (const p of items) {
      const hpc = Number(p.hours_per_client_month);
      if (hpc > 0 && remainingHrs > 0) {
        const extra = Math.floor(remainingHrs / hpc);
        result[p.id] = extra;
      } else {
        result[p.id] = 0;
      }
    }
    return result;
  }, [items, hoursRemaining]);

  // Max revenue: keep current product mix ratio, fill remaining hours proportionally
  const maxRevenue = useMemo(() => {
    if (items.length === 0) return 0;
    const totalCurrentClients = items.reduce((s, p) => s + Number(p.current_clients), 0);
    if (totalCurrentClients === 0) {
      // No clients yet — show max for each product independently (best case single-product)
      let best = 0;
      for (const p of items) {
        const hpc = Number(p.hours_per_client_month);
        const price = Number(p.price_per_client || 0);
        if (hpc > 0) {
          best = Math.max(best, Math.floor(availableHours / hpc) * price);
        }
      }
      return best;
    }
    // Proportional fill: keep same ratio of clients across products
    const weights = items.map(p => ({
      hpc: Number(p.hours_per_client_month),
      price: Number(p.price_per_client || 0),
      ratio: Number(p.current_clients) / totalCurrentClients,
    }));
    // Cost per "unit" of the mix
    const hoursPerUnit = weights.reduce((s, w) => s + w.hpc * w.ratio, 0);
    const revenuePerUnit = weights.reduce((s, w) => s + w.price * w.ratio, 0);
    if (hoursPerUnit <= 0) return currentRevenue;
    const maxUnits = Math.floor(availableHours / hoursPerUnit);
    return Math.round(revenuePerUnit * maxUnits);
  }, [items, availableHours, currentRevenue]);

  const addedProductIds = items.map(p => p.product_id);
  const availableToAdd = allProducts.filter((p: Product) => !addedProductIds.includes(p.id));
  

  const clientHours = Math.round(availableHours);

  return (
    <AppLayout>
      <div className="space-y-6">
        <BackNavigation parentRoute="/executive" parentLabel="Executive Room" />
        <PageHeader title="Simulador de Capacidade" subtitle="Simula diferentes cenários para entender quantos clientes podes servir e quanta receita podes gerar." />

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Settings */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4" /> Parâmetros base
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Team members with hours and per-member overhead */}
              <div className="space-y-3">
                <Label className="text-xs font-medium flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> Equipa ({effectiveTeamSize} membros)</Label>
                <p className="text-[10px] text-muted-foreground">Seleciona quem faz entrega a clientes e define o overhead de cada pessoa.</p>
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
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(checked) => {
                              const next = new Set(clientFacingIds);
                              if (checked) next.add(m.id); else next.delete(m.id);
                              setClientFacingIds(next);
                            }}
                          />
                          <span className="flex-1 truncate font-medium">{m.full_name}</span>
                          <span className="text-xs text-muted-foreground tabular-nums">{weeklyH}h/sem ≈ {monthlyH}h/mês</span>
                        </label>
                        {isSelected && (
                          <div className="grid grid-cols-3 gap-2 pl-6">
                            <div className="space-y-0.5">
                              <Label className="text-[9px] text-muted-foreground">Admin %</Label>
                              <Input
                                type="number"
                                className="h-6 text-xs"
                                min={0} max={100}
                                value={oh.admin}
                                onChange={e => setMemberAdmin(m.id, Math.min(Number(e.target.value), 100))}
                              />
                            </div>
                            <div className="space-y-0.5">
                              <Label className="text-[9px] text-muted-foreground">Negócio %</Label>
                              <Input
                                type="number"
                                className="h-6 text-xs"
                                min={0} max={100}
                                value={oh.business}
                                onChange={e => setMemberBusiness(m.id, Math.min(Number(e.target.value), 100))}
                              />
                            </div>
                            <div className="space-y-0.5">
                              <Label className="text-[9px] text-muted-foreground">Disponível</Label>
                              <div className="h-6 flex items-center text-xs font-medium text-primary">{availH}h</div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {members.length === 0 && (
                    <p className="text-xs text-muted-foreground py-2">Nenhum membro ativo encontrado</p>
                  )}
                </div>
                <div className="rounded-md bg-muted/50 px-3 py-2 space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{effectiveClientFacing} em entrega</span>
                    <span className="font-medium">{Math.round(clientFacingMonthlyHours)}h/mês bruto</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Overhead total</span>
                    <span className="font-medium">−{Math.round(totalOverheadHours)}h</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold border-t pt-1">
                    <span>Horas para clientes</span>
                    <span className="text-primary">{clientHours}h</span>
                  </div>
                </div>
              </div>

              <Button size="sm" className="w-full" onClick={() => saveSettings.mutate()}>Guardar parâmetros</Button>
            </CardContent>
          </Card>


          {/* Capacity Overview */}
          <div className="lg:col-span-2 space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-xs text-muted-foreground">Horas usadas</p>
                  <p className="text-2xl font-bold">{totalHoursUsed.toFixed(0)}h</p>
                  <p className="text-[10px] text-muted-foreground">de {availableHours.toFixed(0)}h disponíveis</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-xs text-muted-foreground">Ocupação</p>
                  <p className={`text-2xl font-bold ${capacityPercent > 90 ? 'text-destructive' : capacityPercent > 70 ? 'text-amber-500' : 'text-foreground'}`}>
                    {capacityPercent}%
                  </p>
                  <Progress value={Math.min(capacityPercent, 100)} className="h-2 mt-1" />
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-xs text-muted-foreground">Horas livres</p>
                  <p className={`text-2xl font-bold ${hoursRemaining < 0 ? 'text-destructive' : 'text-foreground'}`}>
                    {hoursRemaining.toFixed(0)}h
                  </p>
                  {hoursRemaining < 0 && <p className="text-[10px] text-destructive font-medium">Sobre-capacidade!</p>}
                </CardContent>
              </Card>
            </div>

            {/* Revenue projection */}
            {items.some(p => Number(p.price_per_client || 0) > 0) && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" /> Projeção de faturação mensal
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4">
                    <div className="flex-1 rounded-lg border p-4 text-center">
                      <p className="text-xs text-muted-foreground">Faturação atual</p>
                      <p className="text-2xl font-bold">{currentRevenue.toLocaleString('pt-PT')}€</p>
                      <p className="text-[10px] text-muted-foreground">
                        {items.reduce((s, p) => s + Number(p.current_clients), 0)} clientes
                      </p>
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground shrink-0" />
                    <div className="flex-1 rounded-lg border p-4 text-center border-primary/30 bg-primary/5">
                      <p className="text-xs text-muted-foreground">Se lotares a capacidade</p>
                      <p className="text-2xl font-bold text-primary">{maxRevenue.toLocaleString('pt-PT')}€</p>
                      {maxRevenue > currentRevenue && (
                        <p className="text-[10px] text-muted-foreground">
                          +{(maxRevenue - currentRevenue).toLocaleString('pt-PT')}€ potencial
                        </p>
                      )}
                    </div>
                  </div>
                  {items.reduce((s, p) => s + Number(p.current_clients), 0) > 0 && (
                    <p className="text-[10px] text-muted-foreground mt-2 text-center">
                      Projeção baseada no mix atual de produtos (proporção mantida)
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Products table */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calculator className="h-4 w-4" /> Produtos no simulador
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {items.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    Adiciona produtos para simular a capacidade
                  </p>
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
                              {currentClients > 0 && (
                                <Badge variant="outline" className="text-[10px]">{hoursUsed.toFixed(0)}h/mês</Badge>
                              )}
                              {itemRevenue > 0 && (
                                <Badge variant="secondary" className="text-[10px]">{itemRevenue.toLocaleString('pt-PT')}€/mês</Badge>
                              )}
                            </div>
                            <button onClick={() => deleteScenarioProduct.mutate(item.id)} className="text-muted-foreground hover:text-destructive">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <div className="grid grid-cols-5 gap-3">
                            <div className="space-y-1">
                              <Label className="text-[10px]">Horas/cliente/mês</Label>
                              <Input
                                type="number"
                                className="h-7 text-sm"
                                defaultValue={hpc}
                                onBlur={e => {
                                  const val = parseFloat(e.target.value);
                                  if (!isNaN(val) && val !== hpc) {
                                    updateScenarioProduct.mutate({ id: item.id, hours_per_client_month: val });
                                  }
                                }}
                                title="Valor do produto (editável para override)"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[10px]">€/cliente/mês</Label>
                              <Input
                                type="number"
                                className="h-7 text-sm"
                                defaultValue={Number(item.price_per_client || 0)}
                                onBlur={e => updateScenarioProduct.mutate({ id: item.id, price_per_client: Number(e.target.value) })}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[10px]">Clientes reais</Label>
                              <div className="h-7 flex items-center gap-1.5">
                                <span className="text-sm font-semibold">{realCount}</span>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-5 px-1.5 text-[10px]"
                                  onClick={() => updateScenarioProduct.mutate({ id: item.id, current_clients: realCount })}
                                >
                                  Usar
                                </Button>
                              </div>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[10px]">Simular c/ clientes</Label>
                              <Input
                                type="number"
                                className="h-7 text-sm"
                                defaultValue={currentClients}
                                onBlur={e => updateScenarioProduct.mutate({ id: item.id, current_clients: Number(e.target.value) })}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[10px]">Podes aceitar +</Label>
                              <div className="h-7 flex items-center">
                                <span className={`text-sm font-semibold flex items-center gap-1 ${extraPossible === 0 ? 'text-muted-foreground' : 'text-primary'}`}>
                                  <Users className="h-3 w-3" /> {extraPossible}
                                </span>
                              </div>
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
                          <Button key={p.id} size="sm" variant="outline" className="text-xs h-7 gap-1" onClick={() => addProduct.mutate(p)}>
                            <Plus className="h-3 w-3" /> {p.name}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Insight card — global */}
            {items.length > 0 && (
              <Card className={hoursRemaining < 0 ? 'border-destructive/50 bg-destructive/5' : 'border-primary/30 bg-primary/5'}>
                <CardContent className="p-4 flex items-start gap-3">
                  {hoursRemaining < 0 ? (
                    <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                  ) : (
                    <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  )}
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
                            const extra = Number(p.hours_per_client_month) > 0 ? Math.floor(hoursRemaining / Number(p.hours_per_client_month)) : 0;
                            return (
                              <li key={p.id}>
                                <strong>+{extra}</strong> clientes de <em>{p.product_name}</em>
                                {Number(p.price_per_client || 0) > 0 && (
                                  <span className="text-muted-foreground"> (+{(extra * Number(p.price_per_client)).toLocaleString('pt-PT')}€/mês)</span>
                                )}
                              </li>
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
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
