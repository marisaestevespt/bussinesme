import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Plus, Trash2, Save, Pencil } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { useCommercialData } from '@/hooks/useCommercialData';
import { useProducts } from '@/hooks/useProducts';

const MONTH_NAMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const QUARTER_RANGES: Record<number, string> = { 1: 'Jan–Mar', 2: 'Abr–Jun', 3: 'Jul–Set', 4: 'Out–Dez' };
const MONTH_QUARTER = (m: number) => Math.ceil(m / 3);
const MONTH_RANGE = (m: number, year: number) => {
  const d = new Date(year, m - 1, 1);
  const last = new Date(year, m, 0);
  return `${d.getDate().toString().padStart(2,'0')}/${(m).toString().padStart(2,'0')} – ${last.getDate()}/${(m).toString().padStart(2,'0')}`;
};

const fmt = (v: number) => v.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (part: number, whole: number) => whole > 0 ? ((part / whole) * 100).toFixed(1) + '%' : '0%';

export function CommercialMetas() {
  const data = useCommercialData();
  const { products } = useProducts();
  const [annualInput, setAnnualInput] = useState('');
  const [editingAnnual, setEditingAnnual] = useState(false);
  const [newProduct, setNewProduct] = useState({ product_name: '', goal_amount: '', intention: '' });

  // Auto-create product goals for products that don't have one yet
  const productsList = products.data || [];
  useEffect(() => {
    const existingGoals = data.productGoals.data || [];
    const activeProducts = productsList.filter(p => p.status === 'ativo');
    if (activeProducts.length === 0 || !data.productGoals.data) return;

    const existingNames = new Set(existingGoals.map(g => g.product_name.toLowerCase()));
    const missing = activeProducts.filter(p => !existingNames.has(p.name.toLowerCase()));

    missing.forEach((p, i) => {
      data.upsertProductGoal.mutate({
        product_name: p.name,
        goal_amount: 0,
        sort_order: existingGoals.length + i,
      });
    });
  }, [productsList.length, data.productGoals.data?.length]);

  const handleAnnualSave = () => {
    const v = parseFloat(annualInput);
    if (!isNaN(v)) {
      data.upsertAnnualGoal.mutate(v);
      setEditingAnnual(false);
    }
  };

  // Product goals
  const productGoalsSum = (data.productGoals.data || []).reduce((s, p) => s + Number(p.goal_amount || 0), 0);
  const productMismatch = data.annualGoalAmount > 0 && productGoalsSum < data.annualGoalAmount - 0.01;

  // Quarterly
  const qGoals = [1, 2, 3, 4].map(q => {
    const existing = (data.quarterlyGoals.data || []).find(g => g.quarter === q);
    return { quarter: q, goal_amount: Number(existing?.goal_amount || 0) };
  });
  const quarterlySum = qGoals.reduce((s, q) => s + q.goal_amount, 0);
  const quarterlyMismatch = data.annualGoalAmount > 0 && quarterlySum < data.annualGoalAmount - 0.01;

  // Monthly
  const mGoals = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    const existing = (data.monthlyGoals.data || []).find(g => g.month === m);
    return { month: m, goal_amount: Number(existing?.goal_amount || 0) };
  });

  // Per-quarter validation for months
  const quarterMonthValidation = [1, 2, 3, 4].map(q => {
    const qGoal = qGoals.find(g => g.quarter === q)?.goal_amount || 0;
    const monthsSum = mGoals.filter(m => MONTH_QUARTER(m.month) === q).reduce((s, m) => s + m.goal_amount, 0);
    return qGoal > 0 && monthsSum < qGoal - 0.01;
  });

  const analysis = (invoiced: number, goal: number) => {
    if (goal <= 0) return '';
    const p = ((invoiced / goal) * 100).toFixed(0);
    const remaining = goal - invoiced;
    return `Progresso: ${p}% — Faturado: €${fmt(invoiced)} de €${fmt(goal)}. Faltam €${fmt(Math.max(0, remaining))}.`;
  };

  return (
    <div className="space-y-8">
      {/* Annual Goal */}
      <section>
        <h3 className="text-lg font-semibold mb-3">Meta Anual</h3>
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
              <div><p className="text-sm text-muted-foreground">Ano</p><p className="text-lg font-medium">{data.year}</p></div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Meta de Vendas Anual (€)</p>
                {data.annualGoalAmount > 0 && !editingAnnual ? (
                  <div className="flex items-center gap-2">
                    <p className="text-lg font-medium">€{fmt(data.annualGoalAmount)}</p>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setAnnualInput(String(data.annualGoalAmount)); setEditingAnnual(true); }}>
                      <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Input type="number" step="0.01" defaultValue={data.annualGoalAmount || ''} onChange={e => setAnnualInput(e.target.value)} autoFocus={editingAnnual} />
                    <Button size="sm" onClick={handleAnnualSave}><Save className="h-4 w-4" /></Button>
                  </div>
                )}
              </div>
              <div><p className="text-sm text-muted-foreground">Total Faturado</p><p className="text-lg font-medium">€{fmt(data.totalInvoiced)}</p></div>
              <div><p className="text-sm text-muted-foreground">% Progresso</p><p className="text-lg font-medium">{data.progressPct.toFixed(1)}%</p></div>
              <div><p className="text-sm text-muted-foreground">Análise</p><p className="text-sm">{analysis(data.totalInvoiced, data.annualGoalAmount)}</p></div>
            </div>
          </CardContent>
        </Card>
      </section>

      <Separator />

      {/* Product Goals */}
      <section>
        <h3 className="text-lg font-semibold mb-3">Meta por Produto</h3>
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead className="text-right">Meta Anual (€)</TableHead>
                <TableHead className="text-right">Total Faturado</TableHead>
                <TableHead className="text-right">% Progresso</TableHead>
                <TableHead>Intenção</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.productTotals.map(p => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.product_name}</TableCell>
                  <TableCell className="text-right">
                    <Input type="number" step="0.01" className="w-28 ml-auto text-right" defaultValue={Number(p.goal_amount)} onBlur={e => {
                      const v = parseFloat(e.target.value);
                      if (!isNaN(v)) data.upsertProductGoal.mutate({ id: p.id, product_name: p.product_name, goal_amount: v, intention: p.intention || undefined });
                    }} />
                  </TableCell>
                  <TableCell className="text-right">€{fmt(p.totalInvoiced)}</TableCell>
                  <TableCell className="text-right">{pct(p.totalInvoiced, Number(p.goal_amount))}</TableCell>
                  <TableCell>
                    <Input defaultValue={p.intention || ''} className="text-sm" onBlur={e => {
                      data.upsertProductGoal.mutate({ id: p.id, product_name: p.product_name, goal_amount: Number(p.goal_amount), intention: e.target.value });
                    }} />
                  </TableCell>
                  <TableCell><Button variant="ghost" size="sm" onClick={() => data.deleteProductGoal.mutate(p.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button></TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell><Input placeholder="Nome do produto" value={newProduct.product_name} onChange={e => setNewProduct(p => ({ ...p, product_name: e.target.value }))} /></TableCell>
                <TableCell className="text-right"><Input type="number" step="0.01" placeholder="0.00" className="w-28 ml-auto text-right" value={newProduct.goal_amount} onChange={e => setNewProduct(p => ({ ...p, goal_amount: e.target.value }))} /></TableCell>
                <TableCell></TableCell><TableCell></TableCell>
                <TableCell><Input placeholder="Intenção" value={newProduct.intention} onChange={e => setNewProduct(p => ({ ...p, intention: e.target.value }))} /></TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" disabled={!newProduct.product_name.trim()} onClick={() => {
                    data.upsertProductGoal.mutate({ product_name: newProduct.product_name, goal_amount: parseFloat(newProduct.goal_amount) || 0, intention: newProduct.intention || undefined, sort_order: (data.productGoals.data || []).length });
                    setNewProduct({ product_name: '', goal_amount: '', intention: '' });
                  }}><Plus className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Card>
        {productMismatch && (
          <Alert className="mt-2 border-amber-300 bg-amber-50">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800">A soma das metas por produto (€{fmt(productGoalsSum)}) não corresponde à meta anual (€{fmt(data.annualGoalAmount)}).</AlertDescription>
          </Alert>
        )}
      </section>

      <Separator />

      {/* Quarterly Goals */}
      <section>
        <h3 className="text-lg font-semibold mb-3">Metas por Trimestre</h3>
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Trimestre</TableHead>
                <TableHead>Intervalo</TableHead>
                <TableHead className="text-right">Meta (€)</TableHead>
                <TableHead className="text-right">Total Faturado</TableHead>
                <TableHead className="text-right">% Progresso</TableHead>
                <TableHead>Análise</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {qGoals.map(q => (
                <TableRow key={q.quarter}>
                  <TableCell className="font-medium">T{q.quarter}</TableCell>
                  <TableCell className="text-muted-foreground">{QUARTER_RANGES[q.quarter]}</TableCell>
                  <TableCell className="text-right">
                    <Input type="number" step="0.01" className="w-28 ml-auto text-right" defaultValue={q.goal_amount || ''} onBlur={e => {
                      const v = parseFloat(e.target.value);
                      if (!isNaN(v)) data.upsertQuarterlyGoal.mutate({ quarter: q.quarter, goal_amount: v });
                    }} />
                  </TableCell>
                  <TableCell className="text-right">€{fmt(data.quarterTotals[q.quarter - 1])}</TableCell>
                  <TableCell className="text-right">{pct(data.quarterTotals[q.quarter - 1], q.goal_amount)}</TableCell>
                  <TableCell className="text-sm">{analysis(data.quarterTotals[q.quarter - 1], q.goal_amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
        {quarterlyMismatch && (
          <Alert className="mt-2 border-amber-300 bg-amber-50">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800">A soma dos trimestres (€{fmt(quarterlySum)}) não corresponde à meta anual (€{fmt(data.annualGoalAmount)}).</AlertDescription>
          </Alert>
        )}
      </section>

      <Separator />

      {/* Monthly Goals */}
      <section>
        <h3 className="text-lg font-semibold mb-3">Metas por Mês</h3>
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Trimestre</TableHead>
                <TableHead>Mês</TableHead>
                <TableHead className="text-right">Meta (€)</TableHead>
                <TableHead className="text-right">Total Faturado</TableHead>
                <TableHead className="text-right">% Progresso</TableHead>
                <TableHead>Análise</TableHead>
                <TableHead>Intervalo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mGoals.map(m => {
                const monthInvoiced = data.monthlyTotals[m.month - 1];
                return (
                  <TableRow key={m.month}>
                    <TableCell className="text-muted-foreground">T{MONTH_QUARTER(m.month)}</TableCell>
                    <TableCell className="font-medium">{MONTH_NAMES[m.month - 1]}</TableCell>
                    <TableCell className="text-right">
                      <Input type="number" step="0.01" className="w-28 ml-auto text-right" defaultValue={m.goal_amount || ''} onBlur={e => {
                        const v = parseFloat(e.target.value);
                        if (!isNaN(v)) data.upsertMonthlyGoal.mutate({ month: m.month, goal_amount: v });
                      }} />
                    </TableCell>
                    <TableCell className="text-right">€{fmt(monthInvoiced)}</TableCell>
                    <TableCell className="text-right">{pct(monthInvoiced, m.goal_amount)}</TableCell>
                    <TableCell className="text-sm">{analysis(monthInvoiced, m.goal_amount)}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{MONTH_RANGE(m.month, data.year)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
        {quarterMonthValidation.some(Boolean) && (
          <Alert className="mt-2 border-amber-300 bg-amber-50">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800">
              {quarterMonthValidation.map((mismatch, i) => mismatch ? `T${i + 1}: soma dos meses não corresponde à meta do trimestre. ` : '').join('')}
            </AlertDescription>
          </Alert>
        )}
        {data.monthlyMismatch && (
          <Alert className="mt-2 border-amber-300 bg-amber-50">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800">A soma dos meses (€{fmt(data.monthlyGoalsSum)}) não corresponde à meta anual (€{fmt(data.annualGoalAmount)}).</AlertDescription>
          </Alert>
        )}
      </section>
    </div>
  );
}
