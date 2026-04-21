import { useState, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2, AlertTriangle, CheckCircle, TrendingDown, Check } from 'lucide-react';

const fmt = (v: number) => v.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

interface PersistedCost {
  id: string;
  name: string;
  usage_desc: string;
  value: number;
}

interface Props {
  vatRate: string;
  costs: PersistedCost[];
  isOwner: boolean;
  onAddCost: () => void;
  onUpdateCost: (id: string, data: Partial<PersistedCost>) => void;
  onDeleteCost: (id: string) => void;
}

function CostRow({ cost, isOwner, onUpdate, onDelete }: {
  cost: PersistedCost;
  isOwner: boolean;
  onUpdate: (id: string, data: Partial<PersistedCost>) => void;
  onDelete: (id: string) => void;
}) {
  const [name, setName] = useState(cost.name);
  const [usageDesc, setUsageDesc] = useState(cost.usage_desc);
  const [value, setValue] = useState(String(cost.value || ''));
  const [dirty, setDirty] = useState(false);

  const handleSave = () => {
    onUpdate(cost.id, { name, usage_desc: usageDesc, value: Number(value) || 0 });
    setDirty(false);
  };

  return (
    <TableRow>
      <TableCell>
        <Input value={name} onChange={e => { setName(e.target.value); setDirty(true); }} className="border-none shadow-none h-auto p-0 text-sm" readOnly={!isOwner} />
      </TableCell>
      <TableCell>
        <Input value={usageDesc} onChange={e => { setUsageDesc(e.target.value); setDirty(true); }} className="border-none shadow-none h-auto p-0 text-sm" readOnly={!isOwner} />
      </TableCell>
      <TableCell>
        <Input type="number" value={value} onChange={e => { setValue(e.target.value); setDirty(true); }} className="border-none shadow-none h-auto p-0 text-sm w-20" readOnly={!isOwner} />
      </TableCell>
      {isOwner && (
        <TableCell>
          <div className="flex gap-1">
            {dirty && (
              <Button variant="ghost" size="icon" className="h-7 w-7 text-success hover:text-success" onClick={handleSave}>
                <Check className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onDelete(cost.id)}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </TableCell>
      )}
    </TableRow>
  );
}

export function OfferCalculator({ vatRate, costs, isOwner, onAddCost, onUpdateCost, onDeleteCost }: Props) {
  const [desiredMargin, setDesiredMargin] = useState('80');
  const [taxRate, setTaxRate] = useState('25');
  const [ssRate, setSsRate] = useState('21.4');
  const [testPrice, setTestPrice] = useState('');

  const vatPercent = vatRate === 'isento' ? 0 : parseFloat(vatRate) || 23;
  const totalCosts = useMemo(() => costs.reduce((s, c) => s + (Number(c.value) || 0), 0), [costs]);
  const marginPercent = parseFloat(desiredMargin) || 0;
  const taxPercent = parseFloat(taxRate) || 0;
  const ssPercent = parseFloat(ssRate) || 0;

  // ── Secção 1 — Preço mínimo e recomendado ──
  const marginFraction = marginPercent / 100;
  const floorBase = totalCosts;
  const floorWithVat = floorBase * (1 + vatPercent / 100);
  const recDenom = 1 - marginFraction;
  const recBase = recDenom > 0 ? totalCosts / recDenom : totalCosts;
  const recWithVat = recBase * (1 + vatPercent / 100);
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
      return { icon: CheckCircle, color: 'text-success', bg: 'bg-success/15 border-success/30', label: 'Bom preço!', desc: `Margem bruta de ${testGrossMargin.toFixed(1)}% — lucro real de ${fmt(testRealProfit)}` };
    }
    if (Math.abs(testVal - recBase) < 0.01) {
      return { icon: CheckCircle, color: 'text-success', bg: 'bg-success/15 border-success/30', label: 'Preço no limite', desc: `Margem bruta de ${testGrossMargin.toFixed(1)}% — lucro real de ${fmt(testRealProfit)}` };
    }
    return { icon: AlertTriangle, color: 'text-warning', bg: 'bg-warning/15 border-warning/30', label: 'Abaixo do recomendado', desc: `Margem bruta de ${testGrossMargin.toFixed(1)}% — lucro real de ${fmt(testRealProfit)}` };
  };
  const verdict = getVerdict();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Calculadora de Oferta</CardTitle>
        <p className="text-xs text-muted-foreground">Define os custos e margem para descobrir o preço recomendado e testa diferentes valores.</p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* ── Custos do Produto (persisted table) ── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Custos do Produto</Label>
            {isOwner && (
              <Button variant="outline" size="sm" onClick={onAddCost}>
                <Plus className="h-3 w-3 mr-1" /> Adicionar
              </Button>
            )}
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Utilização</TableHead>
                <TableHead>Valor (€)</TableHead>
                {isOwner && <TableHead className="w-10" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {costs.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-4">Sem custos</TableCell></TableRow>
              )}
              {costs.map((c) => (
                <CostRow key={c.id} cost={c} isOwner={isOwner} onUpdate={onUpdateCost} onDelete={onDeleteCost} />
              ))}
            </TableBody>
          </Table>
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
                  <p className="text-lg font-bold text-success">
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
                <p className={`text-sm font-semibold ${testRealProfit >= 0 ? 'text-success' : 'text-destructive'}`}>{fmt(testRealProfit)} — {(testRealProfit / testVal * 100).toFixed(1)}% do preço</p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
