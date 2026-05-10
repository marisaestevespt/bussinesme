import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Plus, Trash2, AlertTriangle, CheckCircle, TrendingDown, Check, Package, RefreshCw, ShoppingBag, Clock as ClockIcon } from 'lucide-react';
import { formatEuro } from '@/lib/formatting';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────────
type CostType = 'one_off' | 'recorrente' | 'por_venda' | 'horas';
type Recurrence = 'mensal' | 'anual';
type AmortMode = 'vendas' | 'periodo';
type TaxRegime = 'simplificado' | 'organizada';

interface ProductCost {
  id: string;
  product_id: string;
  scenario_id: string | null;
  cost_name: string;
  cost_type: CostType;
  cost_value: number | null;
  usage_desc: string | null;
  recurrence: Recurrence | null;
  hours: number | null;
  hourly_rate: number | null;
  member_id: string | null;
  unit: string | null;
  sort_order: number | null;
}

interface Scenario {
  id: string;
  product_id: string;
  name: string;
  is_default: boolean;
  desired_margin: number;
  tax_regime: TaxRegime;
  tax_rate: number;
  ss_rate: number;
  amortization_mode: AmortMode;
  estimated_sales: number | null;
  lifetime_months: number | null;
  notes: string | null;
  sort_order: number | null;
  last_test_price?: number | null;
  price_breakdown?: Record<string, unknown> | null;
}

interface TeamMemberLite { id: string; full_name: string; hourly_cost: number | null }

interface Props {
  productId: string;
  vatRate: string;
  isOwner: boolean;
}

const COST_TYPE_META: Record<CostType, { label: string; icon: typeof Package; color: string; desc: string }> = {
  one_off:    { label: 'One-off (criação)',  icon: Package,    color: 'text-info',     desc: 'Custos pagos uma vez na criação. Amortizam pelo nº de vendas estimadas.' },
  recorrente: { label: 'Recorrente',         icon: RefreshCw,  color: 'text-warning',  desc: 'Plataformas/subscrições mensais ou anuais. Distribuídas pelo período de venda × vendas.' },
  por_venda:  { label: 'Por venda',          icon: ShoppingBag, color: 'text-primary', desc: 'Custos que incorrem em cada unidade vendida.' },
  horas:      { label: 'Horas de equipa',    icon: ClockIcon,  color: 'text-accent-violet', desc: 'Horas estimadas × custo/hora do membro. Tipo de custo definido pelo modo de amortização.' },
};

// ─── Helpers de cálculo ───────────────────────────────────────────
function unitCostFromCost(c: ProductCost, scenario: Scenario): { unit: number; total: number; meta: string } {
  const sales = Math.max(scenario.estimated_sales || 0, 0);
  const months = Math.max(scenario.lifetime_months || 0, 0) || 12; // default 12 meses
  const baseValue = c.cost_type === 'horas'
    ? (Number(c.hours) || 0) * (Number(c.hourly_rate) || 0)
    : (Number(c.cost_value) || 0);

  switch (c.cost_type) {
    case 'one_off': {
      const unit = sales > 0 ? baseValue / sales : 0;
      return { unit, total: baseValue, meta: sales > 0 ? `${formatEuro(baseValue)} ÷ ${sales} vendas` : 'Sem vendas estimadas' };
    }
    case 'recorrente': {
      // Sempre: custo mensal × período de venda ÷ vendas estimadas
      const monthly = c.recurrence === 'anual' ? baseValue / 12 : baseValue;
      if (sales > 0) {
        const totalPeriodo = monthly * months;
        return { unit: totalPeriodo / sales, total: totalPeriodo, meta: `${formatEuro(monthly)}/mês × ${months}m ÷ ${sales} vendas` };
      }
      return { unit: 0, total: 0, meta: 'Sem vendas estimadas' };
    }
    case 'por_venda': {
      return { unit: baseValue, total: baseValue * sales, meta: `${formatEuro(baseValue)} por venda` };
    }
    case 'horas': {
      // Tratado como one-off por defeito (esforço total amortizado pelas vendas)
      const unit = sales > 0 ? baseValue / sales : 0;
      return { unit, total: baseValue, meta: sales > 0 ? `${formatEuro(baseValue)} ÷ ${sales} vendas` : 'Sem vendas estimadas' };
    }
  }
}

// ─── Cost Row ────────────────────────────────────────────────────
function CostRow({ cost, members, isOwner, onUpdate, onDelete }: {
  cost: ProductCost;
  members: TeamMemberLite[];
  isOwner: boolean;
  onUpdate: (id: string, data: Partial<ProductCost>) => void;
  onDelete: (id: string) => void;
}) {
  const [local, setLocal] = useState(cost);
  const [dirty, setDirty] = useState(false);
  useEffect(() => { setLocal(cost); setDirty(false); }, [cost.id]);

  const set = <K extends keyof ProductCost>(k: K, v: ProductCost[K]) => {
    setLocal(p => ({ ...p, [k]: v }));
    setDirty(true);
  };

  const save = () => {
    const payload: Partial<ProductCost> = {
      cost_name: local.cost_name,
      usage_desc: local.usage_desc,
      cost_value: local.cost_type === 'horas' ? null : (Number(local.cost_value) || 0),
      recurrence: local.cost_type === 'recorrente' ? (local.recurrence || 'mensal') : null,
      hours: local.cost_type === 'horas' ? (Number(local.hours) || 0) : null,
      hourly_rate: local.cost_type === 'horas' ? (Number(local.hourly_rate) || 0) : null,
      member_id: local.cost_type === 'horas' ? local.member_id : null,
    };
    onUpdate(cost.id, payload);
    setDirty(false);
  };

  return (
    <TableRow>
      <TableCell className="py-2">
        <Input
          value={local.cost_name || ''}
          onChange={e => set('cost_name', e.target.value)}
          placeholder="Ex: Adobe Creative Cloud"
          className="border-none shadow-none h-auto p-0 text-sm font-medium"
          readOnly={!isOwner}
          aria-label="Nome do custo"
        />
        <Input
          value={local.usage_desc || ''}
          onChange={e => set('usage_desc', e.target.value)}
          placeholder="Descrição/utilização"
          className="border-none shadow-none h-auto p-0 text-xs text-muted-foreground"
          readOnly={!isOwner}
          aria-label="Descrição"
        />
      </TableCell>

      {/* Valor / Horas */}
      <TableCell className="py-2 w-[180px]">
        {local.cost_type === 'horas' ? (
          <div className="flex gap-1 items-center">
            <Input type="number" placeholder="Horas"
              value={local.hours ?? ''}
              onChange={e => set('hours', e.target.value === '' ? null : Number(e.target.value))}
              className="h-7 text-xs w-16" readOnly={!isOwner} aria-label="Horas" />
            <span className="text-xs text-muted-foreground">×</span>
            <Input type="number" placeholder="€/h"
              value={local.hourly_rate ?? ''}
              onChange={e => set('hourly_rate', e.target.value === '' ? null : Number(e.target.value))}
              className="h-7 text-xs w-16" readOnly={!isOwner} aria-label="Custo por hora" />
          </div>
        ) : (
          <div className="flex gap-1 items-center">
            <Input type="number" placeholder="0"
              value={local.cost_value ?? ''}
              onChange={e => set('cost_value', e.target.value === '' ? null : Number(e.target.value))}
              className="h-7 text-xs w-24" readOnly={!isOwner} aria-label="Valor em euros" />
            <span className="text-xs text-muted-foreground">€</span>
            {local.cost_type === 'recorrente' && isOwner && (
              <Select value={local.recurrence || 'mensal'} onValueChange={v => set('recurrence', v as Recurrence)}>
                <SelectTrigger className="h-7 text-xs w-[80px]" aria-label="Recorrência"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mensal">/mês</SelectItem>
                  <SelectItem value="anual">/ano</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        )}
      </TableCell>

      {/* Membro (só horas) */}
      <TableCell className="py-2 w-[160px]">
        {local.cost_type === 'horas' && isOwner ? (
          <Select
            value={local.member_id || 'none'}
            onValueChange={v => {
              if (v === 'none') { set('member_id', null); return; }
              const m = members.find(mm => mm.id === v);
              setLocal(p => ({ ...p, member_id: v, hourly_rate: m?.hourly_cost ?? p.hourly_rate }));
              setDirty(true);
            }}
          >
            <SelectTrigger className="h-7 text-xs" aria-label="Membro responsável"><SelectValue placeholder="Membro" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— Genérico —</SelectItem>
              {members.map(m => (
                <SelectItem key={m.id} value={m.id}>{m.full_name}{m.hourly_cost ? ` (${formatEuro(m.hourly_cost)}/h)` : ''}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>

      {isOwner && (
        <TableCell className="py-2 w-[80px]">
          <div className="flex gap-1 justify-end">
            {dirty && (
              <Button variant="ghost" aria-label="Confirmar alterações" size="icon" className="h-7 w-7 text-success hover:text-success" onClick={save}>
                <Check className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button variant="ghost" aria-label="Eliminar custo" size="icon" className="h-7 w-7" onClick={() => onDelete(cost.id)}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </TableCell>
      )}
    </TableRow>
  );
}

// ─── Cost Group ─────────────────────────────────────────────────
function CostGroup({ type, costs, scenario, members, isOwner, onAdd, onUpdate, onDelete }: {
  type: CostType;
  costs: ProductCost[];
  scenario: Scenario;
  members: TeamMemberLite[];
  isOwner: boolean;
  onAdd: (type: CostType) => void;
  onUpdate: (id: string, data: Partial<ProductCost>) => void;
  onDelete: (id: string) => void;
}) {
  const meta = COST_TYPE_META[type];
  const Icon = meta.icon;
  const groupCosts = costs.filter(c => c.cost_type === type);
  const groupTotal = useMemo(
    () => groupCosts.reduce((s, c) => s + unitCostFromCost(c, scenario).unit, 0),
    [groupCosts, scenario]
  );

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center justify-between p-3 border-b">
        <div className="flex items-center gap-2">
          <Icon className={cn('h-4 w-4', meta.color)} />
          <div>
            <p className="text-sm font-medium">{meta.label}</p>
            <p className="text-[10px] text-muted-foreground">{meta.desc}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">por unidade:</span>
          <span className="font-semibold text-sm">{formatEuro(groupTotal)}</span>
          {isOwner && (
            <Button size="sm" variant="outline" onClick={() => onAdd(type)} className="h-7">
              <Plus className="h-3 w-3 mr-1" /> Adicionar
            </Button>
          )}
        </div>
      </div>
      {groupCosts.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome / Descrição</TableHead>
              <TableHead className="w-[180px]">Valor</TableHead>
              <TableHead className="w-[160px]">{type === 'horas' ? 'Membro' : ''}</TableHead>
              {isOwner && <TableHead className="w-[80px]" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {groupCosts.map(c => (
              <CostRow key={c.id} cost={c} members={members} isOwner={isOwner} onUpdate={onUpdate} onDelete={onDelete} />
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

// ─── Scenario Panel ─────────────────────────────────────────────
function ScenarioPanel({ scenario, productId, vatRate, isOwner }: { scenario: Scenario; productId: string; vatRate: string; isOwner: boolean }) {
  const qc = useQueryClient();

  // Perfil fiscal global do negócio (Definições > Fiscal)
  const { data: bizFiscal } = useQuery({
    queryKey: ['business-fiscal-profile'],
    queryFn: async () => {
      const { data } = await supabase
        .from('business_settings')
        .select('business_type, tax_irs_regime, ss_type, ss_exempt')
        .maybeSingle();
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });

  // Deriva regime + taxas típicas a partir do perfil global
  const fiscalFromSettings = useMemo(() => {
    if (!bizFiscal) return null;
    const isEmpresa = bizFiscal.business_type === 'empresa' || bizFiscal.tax_irs_regime === 'contabilidade_organizada' || bizFiscal.tax_irs_regime === 'organizada';
    const regime: TaxRegime = isEmpresa ? 'organizada' : 'simplificado';
    // Defaults razoáveis PT 2025: PME 17%, Independente Simplificado 25% IRS + 21,4% SS
    const tax_rate = isEmpresa ? 17 : 25;
    const ss_rate  = isEmpresa ? 0 : (bizFiscal.ss_exempt ? 0 : 21.4);
    const label = isEmpresa
      ? 'Sociedade · Contabilidade Organizada (IRC 17%)'
      : `Independente · Simplificado (IRS 25%${bizFiscal.ss_exempt ? ' · isento SS' : ' · SS 21,4%'})`;
    return { regime, tax_rate, ss_rate, label };
  }, [bizFiscal]);

  // Sincroniza automaticamente o cenário com o perfil fiscal do negócio.
  // Sem opção de override — single source of truth: Definições > Fiscal.
  useEffect(() => {
    if (!fiscalFromSettings || !isOwner) return;
    const drift =
      fiscalFromSettings.regime !== scenario.tax_regime ||
      Math.abs(fiscalFromSettings.tax_rate - (Number(scenario.tax_rate) || 0)) > 0.01 ||
      Math.abs(fiscalFromSettings.ss_rate  - (Number(scenario.ss_rate)  || 0)) > 0.01;
    if (drift) {
      updateScenario.mutate({
        tax_regime: fiscalFromSettings.regime,
        tax_rate: fiscalFromSettings.tax_rate,
        ss_rate: fiscalFromSettings.ss_rate,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fiscalFromSettings?.regime, fiscalFromSettings?.tax_rate, fiscalFromSettings?.ss_rate, scenario.id]);

  // Costs query (scoped to scenario)
  const { data: costs = [] } = useQuery<ProductCost[]>({
    queryKey: ['product-costs', productId, scenario.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_costs')
        .select('*')
        .eq('product_id', productId)
        .eq('scenario_id', scenario.id)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return (data || []) as ProductCost[];
    },
  });

  const { data: members = [] } = useQuery<TeamMemberLite[]>({
    queryKey: ['team-members-lite'],
    queryFn: async () => {
      const { data } = await supabase.from('team_members').select('id, full_name, hourly_cost').order('full_name');
      return (data || []) as TeamMemberLite[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const addCost = useMutation({
    mutationFn: async (type: CostType) => {
      // Evita criar uma nova linha se já existir uma rascunho (sem nome E sem valor) do mesmo tipo
      const draft = costs.find(c => c.cost_type === type && !c.cost_name?.trim() && (
        type === 'horas'
          ? !(Number(c.hours) || 0) && !(Number(c.hourly_rate) || 0)
          : !(Number(c.cost_value) || 0)
      ));
      if (draft) {
        throw new Error('Já existe uma linha vazia deste tipo. Preenche-a antes de adicionar outra.');
      }
      const { error } = await supabase.from('product_costs').insert({
        product_id: productId,
        scenario_id: scenario.id,
        cost_name: '',
        cost_type: type,
        cost_value: type === 'horas' ? null : 0,
        recurrence: type === 'recorrente' ? 'mensal' : null,
        sort_order: costs.length,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['product-costs', productId, scenario.id] }),
    onError: (e: any) => toast.error('Erro a adicionar custo', { description: e.message }),
  });

  const updateCost = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ProductCost> }) => {
      const { error } = await supabase.from('product_costs').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['product-costs', productId, scenario.id] });
      toast.success('Custo atualizado');
    },
    onError: (e: any) => toast.error('Erro a guardar', { description: e.message }),
  });

  const deleteCost = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('product_costs').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['product-costs', productId, scenario.id] }),
  });

  const updateScenario = useMutation({
    mutationFn: async (data: Partial<Scenario>) => {
      const { error } = await supabase.from('product_offer_scenarios').update(data as any).eq('id', scenario.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['product-offer-scenarios', productId] }),
  });

  // ── Cálculos agregados ──
  const breakdown = useMemo(() => {
    const sums: Record<CostType, number> = { one_off: 0, recorrente: 0, por_venda: 0, horas: 0 };
    costs.forEach(c => { sums[c.cost_type] += unitCostFromCost(c, scenario).unit; });
    return sums;
  }, [costs, scenario]);

  // Conta apenas linhas com valor real preenchido (evita falsa sensação de "configurado")
  const validCostsCount = useMemo(
    () => costs.filter(c =>
      c.cost_type === 'horas'
        ? (Number(c.hours) || 0) > 0 && (Number(c.hourly_rate) || 0) > 0
        : (Number(c.cost_value) || 0) > 0
    ).length,
    [costs]
  );
  const hasCosts = validCostsCount > 0;

  // Detecta custos que precisam de amortização (one_off / horas / recorrente em modo período)
  // mas não estão a ser amortizados por falta de vendas/meses configurados.
  const sales = Number(scenario.estimated_sales) || 0;
  const months = Number(scenario.lifetime_months) || 0;
  const hasUnamortizedCosts = useMemo(() => {
    if (sales > 0) return false;
    return costs.some(c => {
      if (c.cost_type === 'one_off') return (Number(c.cost_value) || 0) > 0;
      if (c.cost_type === 'horas')   return (Number(c.hours) || 0) > 0 && (Number(c.hourly_rate) || 0) > 0;
      if (c.cost_type === 'recorrente') return (Number(c.cost_value) || 0) > 0;
      return false;
    });
  }, [costs, sales]);

  // Custos verdadeiramente fixos (independentes do nº de vendas) — usados só para break-even
  const fixedTotal = useMemo(() =>
    costs.filter(c => c.cost_type === 'one_off' || c.cost_type === 'horas')
         .reduce((s, c) => s + ((c.cost_type === 'horas' ? (Number(c.hours)||0)*(Number(c.hourly_rate)||0) : Number(c.cost_value)||0)), 0),
    [costs]
  );
  // Custo variável por unidade (acompanha cada venda) — usado no break-even correto
  const variablePerUnit = breakdown.por_venda + breakdown.recorrente;

  const totalPerUnit = breakdown.one_off + breakdown.recorrente + breakdown.por_venda + breakdown.horas;
  const vatPercent = vatRate === 'isento' ? 0 : parseFloat(vatRate) || 23;
  const marginFraction = (Number(scenario.desired_margin) || 0) / 100;

  // Frações em função do regime fiscal
  const reg = scenario.tax_regime;
  const irsRate = (Number(scenario.tax_rate) || 0) / 100;
  const ssRate  = (Number(scenario.ss_rate)  || 0) / 100;
  // Simplificado: IRS sobre 75% da receita; SS sobre 70% da receita (aprox. trimestral)
  const irsBaseSimpl = 0.75;
  const ssBaseSimpl  = 0.70;

  // ── Preço recomendado: resolve para a MARGEM LÍQUIDA real (depois de impostos)
  // Simplificado: lucro = price*(1 - 0.75·IRS - 0.70·SS) - cost
  // Organizada:  lucro = (price - cost)·(1 - IRC)
  // Pretende-se: lucro / price = margem_desejada
  let recBase = 0;
  let recInfeasible = false;       // margem desejada matematicamente impossível
  let maxFeasibleMargin = 1;       // margem líquida máxima possível neste regime
  if (hasCosts) {
    if (reg === 'simplificado') {
      const taxFrac = irsBaseSimpl * irsRate + ssBaseSimpl * ssRate;
      maxFeasibleMargin = Math.max(0, 1 - taxFrac);
      const denom = 1 - taxFrac - marginFraction;
      if (denom > 0) recBase = totalPerUnit / denom;
      else { recInfeasible = true; recBase = 0; }
    } else {
      maxFeasibleMargin = Math.max(0, 1 - irsRate);
      const denom = 1 - marginFraction / Math.max(1 - irsRate, 0.0001);
      if (denom > 0) recBase = totalPerUnit / denom;
      else { recInfeasible = true; recBase = 0; }
    }
  }
  const recWithVat = recBase * (1 + vatPercent / 100);
  const recMargin = Number(scenario.desired_margin) || 0; // margem líquida alvo

  // Preço mínimo para LUCRO ≥ 0 depois de impostos (não apenas cobrir custo)
  // Simplificado: price*(1 - 0.75·IRS - 0.70·SS) = cost  →  price = cost / (1 - taxFrac)
  // Organizada: price - cost - (price-cost)*IRC ≥ 0  →  price ≥ cost  (IRC só sobre lucro)
  const taxFracSimpl = irsBaseSimpl * irsRate + ssBaseSimpl * ssRate;
  const floorBase = reg === 'simplificado' && taxFracSimpl < 1
    ? totalPerUnit / (1 - taxFracSimpl)
    : totalPerUnit;
  const floorWithVat = floorBase * (1 + vatPercent / 100);

  // Test price + impostos
  const [testPrice, setTestPrice] = useState('');
  const testVal = parseFloat(testPrice) || 0;
  const testWithVat = testVal * (1 + vatPercent / 100);
  // IRS/SS conforme regime
  let testIRS = 0;
  let testSS  = 0;
  if (reg === 'simplificado') {
    testIRS = testVal * irsBaseSimpl * irsRate;
    testSS  = testVal * ssBaseSimpl  * ssRate;
  } else {
    // Organizada: IRC sobre o lucro (price - custo); SS de empresa/sócio-gerente fora deste cálculo
    const profitPreTax = Math.max(testVal - totalPerUnit, 0);
    testIRS = profitPreTax * irsRate;
    testSS  = 0;
  }
  const testRealProfit = testVal - testIRS - testSS - totalPerUnit;
  const testNetMargin = testVal > 0 ? (testRealProfit / testVal) * 100 : 0;
  // Break-even: custos fixos / margem de contribuição por unidade (preço − custo variável)
  const contribPerUnit = testVal - variablePerUnit;
  const breakEvenSales = hasCosts && fixedTotal > 0 && contribPerUnit > 0
    ? Math.ceil(fixedTotal / contribPerUnit)
    : null;

  const verdict = useMemo(() => {
    if (testVal <= 0) return null;
    if (!hasCosts) return { icon: AlertTriangle, color: 'text-warning', bg: 'bg-warning/15 border-warning/30', label: 'Sem custos definidos', desc: 'Adiciona pelo menos um custo (com valor > 0) para o sistema poder avaliar este preço. Sem custos, qualquer preço parece lucrativo.' };
    if (hasUnamortizedCosts) return { icon: AlertTriangle, color: 'text-warning', bg: 'bg-warning/15 border-warning/30', label: 'Custos não amortizados', desc: 'Tens custos definidos mas "Vendas estimadas" está a 0 — o sistema não consegue distribuí-los pelas vendas. Define quantas vendas esperas para o cálculo ser real.' };
    if (testRealProfit < 0) return { icon: TrendingDown, color: 'text-destructive', bg: 'bg-destructive/5 border-destructive/20', label: 'Atenção', desc: 'Este preço não cobre custos + impostos.' };
    if (testVal >= recBase) return { icon: CheckCircle, color: 'text-success', bg: 'bg-success/15 border-success/30', label: 'Bom preço!', desc: `Margem líquida ${testNetMargin.toFixed(1)}% — lucro real ${formatEuro(testRealProfit)}` };
    return { icon: AlertTriangle, color: 'text-warning', bg: 'bg-warning/15 border-warning/30', label: 'Abaixo do recomendado', desc: `Margem líquida ${testNetMargin.toFixed(1)}% — lucro real ${formatEuro(testRealProfit)}` };
  }, [testVal, testRealProfit, recBase, testNetMargin, hasCosts, hasUnamortizedCosts]);

  return (
    <div className="space-y-6">
      {/* ── Configuração do cenário ── */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Parâmetros do cenário</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {/* Perfil fiscal — vem das Definições e não é editável aqui */}
          {fiscalFromSettings ? (
            <div className="rounded-md border bg-muted/30 px-3 py-2 flex items-center justify-between gap-3">
              <div className="text-xs">
                <span className="text-muted-foreground">Perfil fiscal: </span>
                <strong>{fiscalFromSettings.label}</strong>
              </div>
              <a href="/definicoes?tab=fiscal" className="text-[10px] text-primary hover:underline shrink-0">
                Alterar em Definições &gt; Fiscal →
              </a>
            </div>
          ) : (
            <div className="rounded-md border border-warning/40 bg-warning/10 p-2.5 text-xs flex items-start gap-2">
              <AlertTriangle className="h-3.5 w-3.5 text-warning mt-0.5 shrink-0" />
              <span>Configura o teu perfil fiscal em <strong>Definições &gt; Fiscal</strong> para o cálculo de impostos ser real.</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Margem desejada (%)</Label>
              <Input type="number" defaultValue={scenario.desired_margin}
                onBlur={e => updateScenario.mutate({ desired_margin: Number(e.target.value) || 0 })}
                disabled={!isOwner} />
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pt-2 border-t">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Vendas estimadas</Label>
              <Input type="number" defaultValue={scenario.estimated_sales ?? ''}
                onBlur={e => updateScenario.mutate({ estimated_sales: e.target.value === '' ? null : Number(e.target.value) })}
                placeholder="ex: 50" disabled={!isOwner} />
              <p className="text-[10px] text-muted-foreground">Quantas unidades pensas vender no período abaixo.</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Período de venda (meses)</Label>
              <Input type="number" defaultValue={scenario.lifetime_months ?? 12}
                onBlur={e => updateScenario.mutate({ lifetime_months: e.target.value === '' ? null : Number(e.target.value) })}
                placeholder="12" disabled={!isOwner} />
              <p className="text-[10px] text-muted-foreground">Por defeito 12 meses. Afeta amortização de custos recorrentes.</p>
            </div>
          </div>
          {hasUnamortizedCosts && (
            <div className="rounded-md border border-warning/40 bg-warning/10 p-2.5 text-xs flex items-start gap-2">
              <AlertTriangle className="h-3.5 w-3.5 text-warning mt-0.5 shrink-0" />
              <span><strong className="text-warning">Define "Vendas estimadas":</strong> tens custos one-off, horas ou recorrentes mas o sistema não consegue distribuí-los sem saber quantas vendas esperas — sem isto, o cálculo aparece a 0 e qualquer preço parece lucrativo.</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Custos por tipo ── */}
      <div className="space-y-3">
        <CostGroup type="one_off"    costs={costs} scenario={scenario} members={members} isOwner={isOwner}
          onAdd={t => addCost.mutate(t)} onUpdate={(id, d) => updateCost.mutate({ id, data: d })} onDelete={id => deleteCost.mutate(id)} />
        <CostGroup type="recorrente" costs={costs} scenario={scenario} members={members} isOwner={isOwner}
          onAdd={t => addCost.mutate(t)} onUpdate={(id, d) => updateCost.mutate({ id, data: d })} onDelete={id => deleteCost.mutate(id)} />
        <CostGroup type="por_venda"  costs={costs} scenario={scenario} members={members} isOwner={isOwner}
          onAdd={t => addCost.mutate(t)} onUpdate={(id, d) => updateCost.mutate({ id, data: d })} onDelete={id => deleteCost.mutate(id)} />
        <CostGroup type="horas"      costs={costs} scenario={scenario} members={members} isOwner={isOwner}
          onAdd={t => addCost.mutate(t)} onUpdate={(id, d) => updateCost.mutate({ id, data: d })} onDelete={id => deleteCost.mutate(id)} />
      </div>

      {/* ── Breakdown ── */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Composição do custo por unidade</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {totalPerUnit === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Adiciona custos e define vendas estimadas para veres o breakdown.</p>
          ) : (
            <>
              <div className="space-y-2">
                {(['one_off', 'recorrente', 'por_venda', 'horas'] as CostType[]).map(t => {
                  const v = breakdown[t];
                  if (v === 0) return null;
                  const pct = (v / totalPerUnit) * 100;
                  const meta = COST_TYPE_META[t];
                  return (
                    <div key={t} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="flex items-center gap-1.5"><meta.icon className={cn('h-3 w-3', meta.color)} /> {meta.label}</span>
                        <span className="font-medium">{formatEuro(v)} <span className="text-muted-foreground">({pct.toFixed(0)}%)</span></span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className={cn('h-full', meta.color.replace('text-', 'bg-'))} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between pt-3 border-t font-semibold text-sm">
                <span>Total custo por unidade</span>
                <span>{formatEuro(totalPerUnit)}</span>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Resultados (preço mínimo + recomendado) ── */}
      {hasCosts && totalPerUnit > 0 && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <Card className="border-dashed">
              <CardContent className="pt-4 pb-3 space-y-1">
                <p className="text-xs text-muted-foreground">Preço mínimo (lucro = 0)</p>
                <p className="text-lg font-bold text-destructive">
                  {formatEuro(floorBase)} <span className="text-sm font-medium text-muted-foreground">({formatEuro(floorWithVat)} c/ IVA)</span>
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {reg === 'simplificado'
                    ? 'Cobre custos + IRS + SS. Abaixo disto dá prejuízo.'
                    : 'Cobre custos. Acima disto há lucro tributável em IRC.'}
                </p>
              </CardContent>
            </Card>
            <Card className={cn('border-dashed', recInfeasible && 'border-warning/50 bg-warning/5')}>
              <CardContent className="pt-4 pb-3 space-y-1">
                <p className="text-xs text-muted-foreground">Preço recomendado</p>
                {recInfeasible ? (
                  <>
                    <p className="text-lg font-bold text-warning">Margem inviável</p>
                    <p className="text-[10px] text-muted-foreground">
                      Pediste {recMargin.toFixed(0)}% líquidos, mas neste regime os impostos consomem {((1 - maxFeasibleMargin) * 100).toFixed(1)}% da receita — máximo possível ≈ {(maxFeasibleMargin * 100).toFixed(0)}%. Reduz a margem desejada.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-lg font-bold text-success">
                      {formatEuro(recBase)} <span className="text-sm font-medium text-muted-foreground">({formatEuro(recWithVat)} c/ IVA)</span>
                    </p>
                    <p className="text-[10px] text-muted-foreground">Margem líquida alvo {recMargin.toFixed(1)}% (já considera IRS/{reg === 'simplificado' ? 'SS' : 'IRC'})</p>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ── Aplicar à ficha do produto ── */}
      {hasCosts && totalPerUnit > 0 && isOwner && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-4 pb-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Aplicar este cenário à ficha do produto</p>
                <p className="text-xs text-muted-foreground">
                  Marca este cenário como <strong>Mínimo</strong>, <strong>Sugerido</strong> ou <strong>Máximo</strong>. O preço recomendado fica como referência na Calculadora de Orçamento.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Select
                value={(scenario as any).price_role || 'none'}
                onValueChange={v => updateScenario.mutate({ price_role: v === 'none' ? null : v } as any)}
              >
                <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Sem papel —</SelectItem>
                  <SelectItem value="min">Preço mínimo</SelectItem>
                  <SelectItem value="sugerido">Preço sugerido</SelectItem>
                  <SelectItem value="max">Preço máximo</SelectItem>
                </SelectContent>
              </Select>
              <Button
                size="sm"
                disabled={!(scenario as any).price_role}
                onClick={async () => {
                  const role = (scenario as any).price_role as 'min' | 'sugerido' | 'max' | null;
                  if (!role) return;
                  const col = role === 'min' ? 'price_min' : role === 'max' ? 'price_max' : 'target_price';
                  const { error } = await supabase.from('products').update({ [col]: recBase } as any).eq('id', productId);
                  if (error) { toast.error('Erro a aplicar'); return; }
                  toast.success(`${role === 'min' ? 'Mínimo' : role === 'max' ? 'Máximo' : 'Sugerido'} atualizado: ${formatEuro(recBase)}`);
                  qc.invalidateQueries({ queryKey: ['products', productId] });
                }}
              >
                <Check className="h-3.5 w-3.5 mr-1" /> Aplicar {formatEuro(recBase)}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Testar preço ── */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Testar um preço</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-3 items-end">
            <div className="flex-1 space-y-1">
              <Label className="text-xs text-muted-foreground">Preço de venda (s/ IVA)</Label>
              <Input type="number" placeholder="Ex: 497" value={testPrice} onChange={e => setTestPrice(e.target.value)} className="text-lg font-semibold" />
            </div>
          </div>

          {verdict && (
            <div className={cn('flex items-start gap-3 p-3 rounded-lg border', verdict.bg)}>
              <verdict.icon className={cn('h-5 w-5 mt-0.5 shrink-0', verdict.color)} />
              <div>
                <p className={cn('font-semibold text-sm', verdict.color)}>{verdict.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{verdict.desc}</p>
              </div>
            </div>
          )}

          {testVal > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-center">
              <div className="p-2 rounded-md bg-muted/50">
                <p className="text-[10px] text-muted-foreground">Preço c/ IVA</p>
                <p className="text-sm font-semibold">{formatEuro(testWithVat)}</p>
              </div>
              <div className="p-2 rounded-md bg-muted/50">
                <p className="text-[10px] text-muted-foreground">IRS/IRC</p>
                <p className="text-sm font-semibold">{formatEuro(testIRS)}</p>
              </div>
              <div className="p-2 rounded-md bg-muted/50">
                <p className="text-[10px] text-muted-foreground">Seg. Social</p>
                <p className="text-sm font-semibold">{formatEuro(testSS)}</p>
              </div>
              <div className="p-2 rounded-md bg-muted/50">
                <p className="text-[10px] text-muted-foreground">Custos / unidade</p>
                <p className="text-sm font-semibold">{formatEuro(totalPerUnit)}</p>
              </div>
              <div className="p-2 rounded-md bg-muted/50">
                <p className="text-[10px] text-muted-foreground">Lucro real</p>
                <p className={cn('text-sm font-semibold', testRealProfit >= 0 ? 'text-success' : 'text-destructive')}>
                  {formatEuro(testRealProfit)}
                </p>
              </div>
            </div>
          )}

          {breakEvenSales !== null && fixedTotal > 0 && (
            <div className="rounded-md bg-info/5 border border-info/20 p-3 text-sm">
              <span className="font-medium">Break-even:</span>{' '}
              precisas de <strong>{breakEvenSales}</strong> vendas a {formatEuro(testVal)} para cobrir os {formatEuro(fixedTotal)} de custos one-off + horas.
            </div>
          )}

          {testVal > 0 && isOwner && (
            <div className="flex items-center justify-between gap-3 pt-3 border-t">
              <p className="text-xs text-muted-foreground">
                Guarda este preço + desdobramento como snapshot do cenário.
              </p>
              <Button
                size="sm"
                variant="default"
                onClick={() => updateScenario.mutate({
                  last_test_price: testVal,
                  price_breakdown: {
                    saved_at: new Date().toISOString(),
                    test_price: testVal,
                    price_with_vat: testWithVat,
                    vat_percent: vatPercent,
                    cost_per_unit: totalPerUnit,
                    breakdown_by_type: breakdown,
                    irs: testIRS,
                    social_security: testSS,
                    real_profit: testRealProfit,
                    net_margin_pct: testNetMargin,
                    recommended_price: recBase,
                    floor_price: floorBase,
                    break_even_sales: breakEvenSales,
                    tax_regime: scenario.tax_regime,
                    desired_margin: scenario.desired_margin,
                  },
                } as any)}
              >
                <Check className="h-3.5 w-3.5 mr-1" /> Guardar desdobramento de preço
              </Button>
            </div>
          )}

          {scenario.price_breakdown && (
            <div className="rounded-md bg-muted/40 border p-3 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm">📌 Último desdobramento guardado</span>
                <span className="text-muted-foreground">
                  {(scenario.price_breakdown as any).saved_at
                    ? new Date((scenario.price_breakdown as any).saved_at).toLocaleDateString('pt-PT')
                    : ''}
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-1">
                <div><span className="text-muted-foreground">Preço:</span> <strong>{formatEuro((scenario.price_breakdown as any).test_price || 0)}</strong></div>
                <div><span className="text-muted-foreground">Custos/un:</span> <strong>{formatEuro((scenario.price_breakdown as any).cost_per_unit || 0)}</strong></div>
                <div><span className="text-muted-foreground">Lucro real:</span> <strong>{formatEuro((scenario.price_breakdown as any).real_profit || 0)}</strong></div>
                <div><span className="text-muted-foreground">Margem:</span> <strong>{((scenario.price_breakdown as any).gross_margin_pct || 0).toFixed(1)}%</strong></div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────
export function OfferCalculator({ productId, vatRate, isOwner }: Props) {
  const qc = useQueryClient();

  const { data: scenarios = [], isLoading } = useQuery<Scenario[]>({
    queryKey: ['product-offer-scenarios', productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_offer_scenarios')
        .select('*')
        .eq('product_id', productId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as Scenario[];
    },
    enabled: !!productId,
  });

  const [activeId, setActiveId] = useState<string>('');
  useEffect(() => {
    if (scenarios.length && !activeId) setActiveId(scenarios[0].id);
  }, [scenarios, activeId]);

  // Auto-criar cenário "Padrão" se não existir nenhum
  const ensureDefault = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from('product_offer_scenarios')
        .insert({ product_id: productId, name: 'Padrão', is_default: true, sort_order: 0 })
        .select().single();
      if (error) throw error;
      return data as Scenario;
    },
    onSuccess: (s) => {
      qc.invalidateQueries({ queryKey: ['product-offer-scenarios', productId] });
      setActiveId(s.id);
    },
  });

  useEffect(() => {
    if (!isLoading && scenarios.length === 0 && productId && isOwner && !ensureDefault.isPending) {
      ensureDefault.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, scenarios.length, productId, isOwner]);

  const addScenario = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from('product_offer_scenarios')
        .insert({ product_id: productId, name: `Cenário ${scenarios.length + 1}`, sort_order: scenarios.length })
        .select().single();
      if (error) throw error;
      return data as Scenario;
    },
    onSuccess: (s) => {
      qc.invalidateQueries({ queryKey: ['product-offer-scenarios', productId] });
      setActiveId(s.id);
      toast.success('Cenário criado');
    },
  });

  const renameScenario = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase.from('product_offer_scenarios').update({ name }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['product-offer-scenarios', productId] }),
  });

  const deleteScenario = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('product_offer_scenarios').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['product-offer-scenarios', productId] });
      const remaining = scenarios.filter(s => s.id !== activeId);
      setActiveId(remaining[0]?.id || '');
      toast.success('Cenário eliminado');
    },
  });

  const active = scenarios.find(s => s.id === activeId) || scenarios[0];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base">Calculadora de Oferta</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Define todos os custos do produto (criação, recorrentes, por venda, horas de equipa) e simula preços com diferentes margens e regimes fiscais.
            </p>
          </div>
          {isOwner && scenarios.length > 0 && (
            <Button size="sm" variant="outline" onClick={() => addScenario.mutate()}>
              <Plus className="h-3 w-3 mr-1" /> Novo cenário
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {scenarios.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">A preparar cenário inicial…</p>
        ) : (
          <Tabs value={activeId} onValueChange={setActiveId}>
            <div className="flex items-center justify-between gap-3 mb-4">
              <TabsList className="flex-wrap h-auto">
                {scenarios.map(s => (
                  <TabsTrigger key={s.id} value={s.id} className="text-xs">
                    {s.name}
                    {s.is_default && (
                      <Badge
                        variant="secondary"
                        className="ml-1.5 text-[9px] py-0 px-1.5 bg-primary/15 text-primary border border-primary/30"
                      >
                        padrão
                      </Badge>
                    )}
                  </TabsTrigger>
                ))}
              </TabsList>
              {active && isOwner && (
                <div className="flex items-center gap-2">
                  <Input
                    defaultValue={active.name}
                    onBlur={e => { if (e.target.value !== active.name) renameScenario.mutate({ id: active.id, name: e.target.value }); }}
                    className="h-7 text-xs w-32"
                    aria-label="Nome do cenário"
                  />
                  {scenarios.length > 1 && (
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => {
                      if (window.confirm(`Eliminar cenário "${active.name}"? Os custos associados serão removidos.`)) {
                        deleteScenario.mutate(active.id);
                      }
                    }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              )}
            </div>
            {active && (
              <TabsContent value={active.id} className="mt-0">
                <ScenarioPanel scenario={active} productId={productId} vatRate={vatRate} isOwner={isOwner} />
              </TabsContent>
            )}
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}
