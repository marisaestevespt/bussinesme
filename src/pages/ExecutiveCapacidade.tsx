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
import { Plus, Trash2, Calculator, Users, Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { useProducts, Product } from '@/hooks/useProducts';

export default function ExecutiveCapacidade() {
  const qc = useQueryClient();
  const { products } = useProducts();
  const activeProducts = (products.data || []).filter((p: Product) => p.status === 'vendas_ativas');

  // Scenario data
  const scenario = useQuery({
    queryKey: ['capacity-scenario'],
    queryFn: async () => {
      const { data } = await supabase.from('capacity_scenarios').select('*').order('created_at').limit(1).maybeSingle();
      return data;
    },
  });

  const scenarioProducts = useQuery({
    queryKey: ['capacity-scenario-products', scenario.data?.id],
    queryFn: async () => {
      if (!scenario.data?.id) return [];
      const { data } = await supabase.from('capacity_scenario_products').select('*').eq('scenario_id', scenario.data.id).order('created_at');
      return data || [];
    },
    enabled: !!scenario.data?.id,
  });

  // Local state for editing
  const [hoursPerMonth, setHoursPerMonth] = useState<number | null>(null);
  const [adminPercent, setAdminPercent] = useState<number | null>(null);

  const effectiveHours = hoursPerMonth ?? (Number(scenario.data?.useful_hours_per_month) || 160);
  const effectiveAdmin = adminPercent ?? (Number(scenario.data?.admin_percent) || 20);
  const availableHours = effectiveHours * (1 - effectiveAdmin / 100);

  // Ensure scenario exists
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
        useful_hours_per_month: effectiveHours,
        admin_percent: effectiveAdmin,
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
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['capacity-scenario-products'] });
      toast.success('Produto adicionado');
    },
  });

  const updateScenarioProduct = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; hours_per_client_month?: number; current_clients?: number }) => {
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

  const addedProductIds = items.map(p => p.product_id);
  const availableToAdd = activeProducts.filter((p: Product) => !addedProductIds.includes(p.id));

  return (
    <AppLayout>
      <div className="space-y-6">
        <BackNavigation parentRoute="/executive" parentLabel="Executive Room" />
        <PageHeader title="Simulador de Capacidade" subtitle="Calcula quantos clientes podes servir em simultâneo, por produto." />

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Settings */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4" /> Parâmetros
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label className="text-xs">Horas úteis por mês</Label>
                <Input type="number" value={effectiveHours} onChange={e => setHoursPerMonth(Number(e.target.value))} className="h-8" />
                <p className="text-[10px] text-muted-foreground">Total de horas de trabalho no mês (ex: 160h = 8h × 20 dias)</p>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">% tempo admin/gestão: {effectiveAdmin}%</Label>
                <Slider value={[effectiveAdmin]} onValueChange={v => setAdminPercent(v[0])} min={0} max={50} step={5} />
                <p className="text-[10px] text-muted-foreground">Reuniões, admin, e-mails, gestão — tempo que não é entrega ao cliente</p>
              </div>
              <Separator />
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Horas disponíveis para clientes</span>
                  <span className="font-bold">{availableHours.toFixed(0)}h</span>
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
                  <p className="text-[10px] text-muted-foreground">de {availableHours.toFixed(0)}h</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-xs text-muted-foreground">Capacidade</p>
                  <p className={`text-2xl font-bold ${capacityPercent > 90 ? 'text-destructive' : capacityPercent > 70 ? 'text-yellow-600' : 'text-emerald-600'}`}>
                    {capacityPercent}%
                  </p>
                  <Progress value={Math.min(capacityPercent, 100)} className="h-2 mt-1" />
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-xs text-muted-foreground">Horas livres</p>
                  <p className={`text-2xl font-bold ${hoursRemaining < 0 ? 'text-destructive' : ''}`}>
                    {hoursRemaining.toFixed(0)}h
                  </p>
                  {hoursRemaining < 0 && <p className="text-[10px] text-destructive font-medium">Sobre-capacidade!</p>}
                </CardContent>
              </Card>
            </div>

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
                      const hoursUsed = Number(item.hours_per_client_month) * Number(item.current_clients);
                      const maxClients = Number(item.hours_per_client_month) > 0
                        ? Math.floor(availableHours / Number(item.hours_per_client_month))
                        : 0;
                      return (
                        <div key={item.id} className="rounded-lg border p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium text-sm">{item.product_name}</h4>
                              {Number(item.current_clients) > 0 && (
                                <Badge variant="outline" className="text-[10px]">{hoursUsed.toFixed(0)}h/mês</Badge>
                              )}
                            </div>
                            <button onClick={() => deleteScenarioProduct.mutate(item.id)} className="text-muted-foreground hover:text-destructive">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <div className="grid grid-cols-3 gap-3">
                            <div className="space-y-1">
                              <Label className="text-[10px]">Horas/cliente/mês</Label>
                              <Input
                                type="number"
                                className="h-7 text-sm"
                                defaultValue={Number(item.hours_per_client_month)}
                                onBlur={e => updateScenarioProduct.mutate({ id: item.id, hours_per_client_month: Number(e.target.value) })}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[10px]">Clientes atuais</Label>
                              <Input
                                type="number"
                                className="h-7 text-sm"
                                defaultValue={Number(item.current_clients)}
                                onBlur={e => updateScenarioProduct.mutate({ id: item.id, current_clients: Number(e.target.value) })}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[10px]">Máx. possível (sozinho)</Label>
                              <div className="h-7 flex items-center">
                                <span className="text-sm font-semibold flex items-center gap-1">
                                  <Users className="h-3 w-3 text-muted-foreground" /> {maxClients}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Add product */}
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

            {/* Insight card */}
            {items.length > 0 && (
              <Card className={hoursRemaining < 0 ? 'border-destructive/50 bg-destructive/5' : 'border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20'}>
                <CardContent className="p-4 flex items-start gap-3">
                  {hoursRemaining < 0 ? (
                    <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                  ) : (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                  )}
                  <div className="text-sm">
                    {hoursRemaining < 0 ? (
                      <p>Estás <strong>{Math.abs(hoursRemaining).toFixed(0)}h acima</strong> da tua capacidade mensal. Considera ajustar a carga ou expandir a equipa.</p>
                    ) : hoursRemaining < 10 ? (
                      <p>Capacidade <strong>quase no limite</strong>. Tens apenas {hoursRemaining.toFixed(0)}h livres por mês.</p>
                    ) : (
                      <p>Tens <strong>{hoursRemaining.toFixed(0)}h livres</strong> por mês. 
                        {items.length > 0 && items[0].hours_per_client_month > 0 && (
                          <> Podes aceitar mais ~{Math.floor(hoursRemaining / Number(items[0].hours_per_client_month))} clientes de "{items[0].product_name}".</>
                        )}
                      </p>
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
