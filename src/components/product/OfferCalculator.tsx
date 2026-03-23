import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, AlertTriangle, CheckCircle, TrendingDown } from 'lucide-react';

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
  const [desiredMargin, setDesiredMargin] = useState('80');
  const [taxRate, setTaxRate] = useState('25');
  const [ssRate, setSsRate] = useState('21.4');
  const [testPrice, setTestPrice] = useState('');

  const addCost = () => setCosts(prev => [...prev, { id: String(Date.now()), label: '', value: '' }]);
  const removeCost = (id: string) => setCosts(prev => prev.filter(c => c.id !== id));
  const updateCost = (id: string, field: 'label' | 'value', val: string) =>
    setCosts(prev => prev.map(c => c.id === id ? { ...c, [field]: val } : c));

  const vatPercent = vatRate === 'isento' ? 0 : parseFloat(vatRate) || 23;
  const totalCosts = useMemo(() => costs.reduce((s, c) => s + (parseFloat(c.value) || 0), 0), [costs]);
  const marginPercent = parseFloat(desiredMargin) || 0;
  const taxPercent = parseFloat(taxRate) || 0;
  const ssPercent = parseFloat(ssRate) || 0;

  // ── Secção 1 — Preço mínimo e recomendado ──
  const marginFraction = marginPercent / 100;

  // Preço mínimo absoluto = custos
  const floorBase = totalCosts;
  const floorWithVat = floorBase * (1 + vatPercent / 100);

  // Preço recomendado s/ IVA = custos / (1 - margem%)
  const recDenom = 1 - marginFraction;
  const recBase = recDenom > 0 ? totalCosts / recDenom : totalCosts;
  const recWithVat = recBase * (1 + vatPercent / 100);

  // Margem bruta % do preço recomendado
  const recMargin = recBase > 0 ? ((recBase - totalCosts) / recBase) * 100 : 0;

  // ── Secção 3 — Testar um preço (s/ IVA) ──
  const testVal = parseFloat(testPrice) || 0;
  const testWithVat = testVal * (1 + vatPercent / 100);
  const testIRS = testVal * 0.75 * (taxPercent / 100);
  const testSS = testVal * 0.70 * (ssPercent / 100);
  const testRealProfit = testVal - testIRS - testSS - totalCosts;
  const testGrossMargin = testVal > 0 ? ((testVal - totalCosts) / testVal) * 100 : 0;

  const getVerdict = () => {
    if (testVal <= 0) return null;
    if (testRealProfit < 0) {
      return { icon: TrendingDown, color: 'text-destructive', bg: 'bg-destructive/5 border-destructive/20', label: 'Atenção', desc: 'Este preço não cobre todos os custos e impostos.' };
    }
    if (testVal > recBase) {
      return { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50 border-green-200', label: 'Bom preço!', desc: `Margem bruta de ${testGrossMargin.toFixed(1)}% — lucro real de ${fmt(testRealProfit)}` };
    }
    if (Math.abs(testVal - recBase) < 0.01) {
      return { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50 border-green-200', label: 'Preço no limite', desc: `Margem bruta de ${testGrossMargin.toFixed(1)}% — lucro real de ${fmt(testRealProfit)}` };
    }
    return { icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200', label: 'Abaixo do recomendado', desc: `Margem bruta de ${testGrossMargin.toFixed(1)}% — lucro real de ${fmt(testRealProfit)}` };
  };
  const verdict = getVerdict();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Calculadora de Oferta</CardTitle>
        <p className="text-xs text-muted-foreground">Define os custos e margem para descobrir o preço recomendado e testa diferentes valores.</p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* ── Secção 1: Custos e Margem ── */}
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

        {/* Margem desejada */}
        <div className="max-w-xs space-y-1.5">
          <Label className="text-xs text-muted-foreground">Margem de lucro desejada (%)</Label>
          <Input type="number" value={desiredMargin} onChange={e => setDesiredMargin(e.target.value)} placeholder="80" />
        </div>

        {/* Resultados automáticos */}
        {totalCosts > 0 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Card className="border-dashed">
                <CardContent className="pt-4 pb-3 space-y-1">
                  <p className="text-xs text-muted-foreground">Preço mínimo absoluto</p>
                  <p className="text-lg font-bold text-destructive">
                    {fmt(floorBase)} <span className="text-sm font-medium text-muted-foreground">({fmt(floorWithVat)} c/ IVA)</span>
                  </p>
                  <p className="text-[10px] text-muted-foreground">Custos, sem margem</p>
                </CardContent>
              </Card>
              <Card className="border-dashed">
                <CardContent className="pt-4 pb-3 space-y-1">
                  <p className="text-xs text-muted-foreground">Preço recomendado</p>
                  <p className="text-lg font-bold text-green-600">
                    {fmt(recBase)} <span className="text-sm font-medium text-muted-foreground">({fmt(recWithVat)} c/ IVA)</span>
                  </p>
                  <p className="text-[10px] text-muted-foreground">Margem bruta de {recMargin.toFixed(1)}%</p>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* ── Secção 2: Impostos ── */}
        <div className="space-y-3 pt-2 border-t">
          <Label className="text-sm font-medium">Impostos</Label>
          <p className="text-xs text-muted-foreground">Configuração para a simulação de preço abaixo. Não afecta o preço recomendado.</p>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">IRS/IRC — aplicado sobre 75% do rendimento</Label>
              <Input type="number" value={taxRate} onChange={e => setTaxRate(e.target.value)} placeholder="25" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Segurança Social — aplicado sobre 70% do rendimento</Label>
              <Input type="number" value={ssRate} onChange={e => setSsRate(e.target.value)} placeholder="21.4" />
            </div>
          </div>
        </div>

        {/* ── Secção 3: Testar um preço ── */}
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
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-center">
              <div className="p-2 rounded-md bg-muted/50">
                <p className="text-[10px] text-muted-foreground">Preço c/ IVA</p>
                <p className="text-sm font-semibold">{fmt(testWithVat)}</p>
              </div>
              <div className="p-2 rounded-md bg-muted/50">
                <p className="text-[10px] text-muted-foreground">IRS/IRC ({taxPercent}% s/ 75%)</p>
                <p className="text-sm font-semibold">{fmt(testIRS)}</p>
              </div>
              <div className="p-2 rounded-md bg-muted/50">
                <p className="text-[10px] text-muted-foreground">Seg. Social ({ssPercent}% s/ 70%)</p>
                <p className="text-sm font-semibold">{fmt(testSS)}</p>
              </div>
              <div className="p-2 rounded-md bg-muted/50">
                <p className="text-[10px] text-muted-foreground">Custos totais</p>
                <p className="text-sm font-semibold">{fmt(totalCosts)} — {(totalCosts / testVal * 100).toFixed(1)}% do preço</p>
              </div>
              <div className="p-2 rounded-md bg-muted/50">
                <p className="text-[10px] text-muted-foreground">Lucro real</p>
                <p className={`text-sm font-semibold ${testRealProfit >= 0 ? 'text-green-600' : 'text-destructive'}`}>{fmt(testRealProfit)} — {(testRealProfit / testVal * 100).toFixed(1)}% do preço</p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
