import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, TrendingUp, TrendingDown, AlertTriangle, CheckCircle } from 'lucide-react';

const fmt = (v: number) => v.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

interface CostLine {
  id: string;
  label: string;
  value: string;
}

interface Props {
  vatRate: string;
}

export function OfferCalculator({ vatRate }: Props) {
  const [costs, setCosts] = useState<CostLine[]>([
    { id: '1', label: '', value: '' },
  ]);
  const [taxRate, setTaxRate] = useState('25'); // IRS / IRC estimate
  const [ssRate, setSsRate] = useState('21.4'); // Segurança Social
  const [desiredMargin, setDesiredMargin] = useState('80');
  const [testPrice, setTestPrice] = useState('');

  const addCost = () => setCosts(prev => [...prev, { id: String(Date.now()), label: '', value: '' }]);
  const removeCost = (id: string) => setCosts(prev => prev.filter(c => c.id !== id));
  const updateCost = (id: string, field: 'label' | 'value', val: string) =>
    setCosts(prev => prev.map(c => c.id === id ? { ...c, [field]: val } : c));

  const vatPercent = vatRate === 'isento' ? 0 : parseFloat(vatRate) || 23;

  const totalCosts = useMemo(() => costs.reduce((s, c) => s + (parseFloat(c.value) || 0), 0), [costs]);
  const taxPercent = parseFloat(taxRate) || 0;
  const ssPercent = parseFloat(ssRate) || 0;
  const marginPercent = parseFloat(desiredMargin) || 0;

  // --- Preço recomendado (reverse) ---
  // net = margin% × base, where:
  //   SS = base × 70% × ss%, taxable = base - costs - SS, IRS = taxable × tax%
  //   net = taxable × (1 - tax%) = base × margin%
  // Solving: base = costs / [(1 - 0.7×ss%) - margin% / (1 - tax%)]
  // SS_efectiva = 0.70 × (SS% / 100)
  const ssFactor = 0.7 * (ssPercent / 100);
  const marginFraction = marginPercent / 100;

  // Preço recomendado s/ IVA: X = custos / (1 - SS_efectiva - margem%)
  const recDenom = 1 - ssFactor - marginFraction;
  const minPriceBase = recDenom > 0 ? totalCosts / recDenom : totalCosts;
  const minPriceWithVat = minPriceBase * (1 + vatPercent / 100);

  // Absolute floor: base onde net = 0 → base(1 - ssFactor) = costs → base = costs / (1 - ssFactor)
  const floorBase = (1 - ssFactor) > 0 ? totalCosts / (1 - ssFactor) : totalCosts;
  const floorPrice = floorBase * (1 + vatPercent / 100);

  // --- Test price analysis ---
  // O preço introduzido é c/ IVA; extraímos a base
  // O utilizador introduz o preço s/ IVA
  const testVal = parseFloat(testPrice) || 0;
  const testWithVat = testVal * (1 + vatPercent / 100);
  const testSS = testVal * ssFactor;
  const testTaxableProfit = testVal - totalCosts - testSS;
  const testTax = testTaxableProfit > 0 ? testTaxableProfit * (taxPercent / 100) : 0;
  const testNetProfit = testTaxableProfit - testTax;
  const testMargin = testVal > 0 ? ((testVal - totalCosts - testSS) / testVal) * 100 : 0;

  const getVerdict = () => {
    if (testVal <= 0) return null;
    if (testVal < totalCosts) return { icon: TrendingDown, color: 'text-red-600', bg: 'bg-red-50 border-red-200', label: 'Abaixo do custo', desc: `Estás a perder dinheiro com este preço — margem de lucro de ${testMargin.toFixed(1)}%.` };
    if (testVal < minPriceBase * 0.8) return { icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200', label: 'Margem muito baixa', desc: `Margem de lucro de ${testMargin.toFixed(1)}%, abaixo do objectivo de ${marginPercent}%.` };
    if (testVal < minPriceBase) return { icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200', label: 'Quase lá', desc: `Margem de lucro de ${testMargin.toFixed(1)}%, abaixo do objectivo de ${marginPercent}%.` };
    return { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50 border-green-200', label: 'Bom preço!', desc: `Margem de lucro de ${testMargin.toFixed(1)}%.` };
  };
  const verdict = getVerdict();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Calculadora de Oferta</CardTitle>
        <p className="text-xs text-muted-foreground">Define os custos e impostos para descobrir o preço mínimo e testar diferentes valores.</p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Costs */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Custos Associados</Label>
          {costs.map(c => (
            <div key={c.id} className="flex gap-2 items-center">
              <Input
                placeholder="Ex: Plataforma, Conteúdo, Equipa..."
                value={c.label}
                onChange={e => updateCost(c.id, 'label', e.target.value)}
                className="flex-1"
              />
              <Input
                type="number"
                placeholder="0.00"
                value={c.value}
                onChange={e => updateCost(c.id, 'value', e.target.value)}
                className="w-32"
              />
              <span className="text-xs text-muted-foreground">€</span>
              {costs.length > 1 && (
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeCost(c.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addCost}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar custo
          </Button>
          <div className="flex justify-between items-center pt-2 border-t">
            <span className="text-sm font-medium">Total Custos</span>
            <span className="font-semibold">{fmt(totalCosts)}</span>
          </div>
        </div>

        {/* Tax & Margin */}
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Impostos sobre lucro (IRS/IRC %)</Label>
            <Input type="number" value={taxRate} onChange={e => setTaxRate(e.target.value)} placeholder="25" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Segurança Social (%)</Label>
            <Input type="number" value={ssRate} onChange={e => setSsRate(e.target.value)} placeholder="21.4" />
            <p className="text-[10px] text-muted-foreground">Taxa aplicada sobre 70% da faturação (rendimento relevante)</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Margem de lucro desejada (%)</Label>
            <Input type="number" value={desiredMargin} onChange={e => setDesiredMargin(e.target.value)} placeholder="30" />
          </div>
        </div>

        {/* Results */}
        {totalCosts > 0 && (
          <div className="grid grid-cols-2 gap-4">
            <Card className="border-dashed">
              <CardContent className="pt-4 pb-3 space-y-1">
                <p className="text-xs text-muted-foreground">Preço mínimo absoluto</p>
                <p className="text-lg font-bold text-red-600">{fmt(floorPrice)}</p>
                <p className="text-[10px] text-muted-foreground">Custos + SS + IVA, sem margem nem IRS</p>
              </CardContent>
            </Card>
            <Card className="border-dashed">
              <CardContent className="pt-4 pb-3 space-y-1">
                <p className="text-xs text-muted-foreground">Preço recomendado</p>
                <p className="text-lg font-bold text-green-600">
                  {fmt(minPriceBase)} <span className="text-sm font-medium text-muted-foreground">({fmt(minPriceWithVat)} c/ IVA)</span>
                </p>
                <p className="text-[10px] text-muted-foreground">Com {marginPercent}% margem + {ssPercent}% SS + {taxPercent}% impostos</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Test a price */}
        <div className="space-y-3 pt-2 border-t">
          <Label className="text-sm font-medium">Testar um preço</Label>
          <div className="flex gap-3 items-end">
            <div className="flex-1 space-y-1.5">
              <Label className="text-xs text-muted-foreground">Preço de venda (s/ IVA)</Label>
              <Input
                type="number"
                placeholder="Ex: 497"
                value={testPrice}
                onChange={e => setTestPrice(e.target.value)}
                className="text-lg font-semibold"
              />
            </div>
          </div>

          {verdict && (
            <div className={`flex items-start gap-3 p-3 rounded-lg border ${verdict.bg}`}>
              <verdict.icon className={`h-5 w-5 mt-0.5 shrink-0 ${verdict.color}`} />
              <div>
                <p className={`font-semibold text-sm ${verdict.color}`}>{verdict.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{verdict.desc}</p>
              </div>
            </div>
          )}

          {testVal > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
              <div className="p-2 rounded-md bg-muted/50">
                <p className="text-[10px] text-muted-foreground">Preço c/ IVA</p>
                <p className="text-sm font-semibold">{fmt(testWithVat)}</p>
              </div>
              <div className="p-2 rounded-md bg-muted/50">
                <p className="text-[10px] text-muted-foreground">Guardar p/ Seg. Social ({ssPercent}% s/ 70%)</p>
                <p className="text-sm font-semibold">{fmt(testSS)}</p>
              </div>
              <div className="p-2 rounded-md bg-muted/50">
                <p className="text-[10px] text-muted-foreground">IRS/IRC ({taxPercent}%)</p>
                <p className="text-sm font-semibold">{fmt(testTax)}</p>
              </div>
              <div className="p-2 rounded-md bg-muted/50">
                <p className="text-[10px] text-muted-foreground">Lucro Final (s/ custos e impostos)</p>
                <p className={`text-sm font-semibold ${testNetProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmt(testNetProfit)}</p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
