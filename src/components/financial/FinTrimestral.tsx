import { useMemo, useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts';
import { Download, TrendingUp, TrendingDown, Package, ArrowUpRight, Receipt, Shield } from 'lucide-react';
import { exportPdf } from '@/lib/exportPdf';
import type { Expense } from '@/hooks/useFinancialData';
import { sumRevenue } from '@/lib/salesCalculations';

const QUARTERS = [
  { label: 'T1', range: 'Jan — Mar', months: [1, 2, 3] },
  { label: 'T2', range: 'Abr — Jun', months: [4, 5, 6] },
  { label: 'T3', range: 'Jul — Set', months: [7, 8, 9] },
  { label: 'T4', range: 'Out — Dez', months: [10, 11, 12] },
];

const ML = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const PIE_COLORS = ['hsl(var(--primary))', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#6366f1'];

type Sale = { invoice_total: number; base_value: number; sale_month: number | null; sale_year: number | null; product?: string | null; client?: string | null; };

interface Props {
  sales: Sale[];
  expenses: Expense[];
  currentYear: number;
}

const fmt = (v: number) => v.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
const catLabel = (key: string) => {
  const map: Record<string, string> = {
    plataformas: 'Plataformas', marketing: 'Marketing', material: 'Material', servicos: 'Serviços',
    impostos: 'Impostos', seguranca_social: 'Segurança Social', ordenados: 'Ordenados',
    prestadores: 'Prestadores', outro: 'Outro', escritorio: 'Escritório',
  };
  return map[key] || key;
};

export function FinTrimestral({ sales, expenses, currentYear }: Props) {
  const [selectedQ, setSelectedQ] = useState<string>('todos');
  const yearSales = useMemo(() => sales.filter(s => s.sale_year === currentYear), [sales, currentYear]);
  const yearExpenses = useMemo(() => expenses.filter(e => e.expense_year === currentYear), [expenses, currentYear]);

  // Quarterly summary
  const data = useMemo(() => {
    return QUARTERS.map(q => {
      const qSales = yearSales.filter(s => q.months.includes(s.sale_month || 0));
      const qExpenses = yearExpenses.filter(e => q.months.includes(e.expense_month || 0));
      const ent = sumRevenue(qSales);
      const entBase = qSales.reduce((s, v) => s + v.base_value, 0);
      const sai = qExpenses.reduce((s, v) => s + v.total_with_vat, 0);
      const saiBase = qExpenses.reduce((s, v) => s + v.base_value, 0);
      const resultado = ent - sai;
      const margem = ent > 0 ? Math.round(resultado / ent * 10000) / 100 : 0;
      const ivaCobrado = ent - entBase;
      const ivaPago = sai - saiBase;
      const ivaBalanco = ivaCobrado - ivaPago;
      const ss = qExpenses.filter(e => e.category === 'seguranca_social').reduce((s, v) => s + v.total_with_vat, 0);
      const clientSet = new Set<string>();
      qSales.forEach(s => { if (s.client) clientSet.add(s.client); });

      // Category breakdown
      const byCat = new Map<string, number>();
      qExpenses.forEach(e => {
        const cat = e.category || 'outro';
        byCat.set(cat, (byCat.get(cat) || 0) + e.total_with_vat);
      });
      const categories = [...byCat.entries()].sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));

      // Product breakdown
      const byProd = new Map<string, number>();
      qSales.forEach(s => {
        const name = s.product || 'Sem produto';
        byProd.set(name, (byProd.get(name) || 0) + s.invoice_total);
      });
      const products = [...byProd.entries()].sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));

      return { label: q.label, range: q.range, entradas: ent, saidas: sai, resultado, margem, ivaCobrado, ivaPago, ivaBalanco, ss, clients: clientSet.size, categories, products, numSales: qSales.length, numExpenses: qExpenses.length };
    });
  }, [yearSales, yearExpenses]);

  // Annual totals
  const totals = useMemo(() => {
    const ent = data.reduce((s, d) => s + d.entradas, 0);
    const sai = data.reduce((s, d) => s + d.saidas, 0);
    const res = ent - sai;
    return {
      entradas: ent, saidas: sai, resultado: res,
      margem: ent > 0 ? Math.round(res / ent * 10000) / 100 : 0,
      ivaCobrado: data.reduce((s, d) => s + d.ivaCobrado, 0),
      ivaPago: data.reduce((s, d) => s + d.ivaPago, 0),
      ivaBalanco: data.reduce((s, d) => s + d.ivaBalanco, 0),
      ss: data.reduce((s, d) => s + d.ss, 0),
    };
  }, [data]);

  // Monthly data for detailed chart
  const monthlyData = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const ent = sumRevenue(yearSales.filter(s => s.sale_month === m));
      const sai = yearExpenses.filter(e => e.expense_month === m).reduce((s, v) => s + v.total_with_vat, 0);
      return { mes: ML[i], entradas: ent, saidas: sai, resultado: ent - sai };
    });
  }, [yearSales, yearExpenses]);

  // All categories for pie
  const allCategories = useMemo(() => {
    const byCat = new Map<string, number>();
    yearExpenses.forEach(e => {
      const cat = catLabel(e.category || 'outro');
      byCat.set(cat, (byCat.get(cat) || 0) + e.total_with_vat);
    });
    return [...byCat.entries()].sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));
  }, [yearExpenses]);

  // All products for pie
  const allProducts = useMemo(() => {
    const byProd = new Map<string, number>();
    yearSales.forEach(s => {
      const name = s.product || 'Sem produto';
      byProd.set(name, (byProd.get(name) || 0) + s.invoice_total);
    });
    return [...byProd.entries()].sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));
  }, [yearSales]);

  const handleExport = () => {
    exportPdf(`Relatório Financeiro Trimestral — ${currentYear}`, 'fin-trimestral-report');
  };

  const bestQuarter = data.reduce((best, d) => d.resultado > best.resultado ? d : best, data[0]);
  const worstQuarter = data.reduce((worst, d) => d.resultado < worst.resultado ? d : worst, data[0]);

  // Selected quarter data
  const selectedData = selectedQ === 'todos' ? null : data.find(d => d.label === selectedQ) || null;
  const selectedQDef = selectedQ === 'todos' ? null : QUARTERS.find(q => q.label === selectedQ) || null;

  // Monthly data for selected quarter
  const selectedMonthlyData = useMemo(() => {
    if (!selectedQDef) return [];
    return selectedQDef.months.map(m => {
      const ent = sumRevenue(yearSales.filter(s => s.sale_month === m));
      const entBase = yearSales.filter(s => s.sale_month === m).reduce((s, v) => s + v.base_value, 0);
      const sai = yearExpenses.filter(e => e.expense_month === m).reduce((s, v) => s + v.total_with_vat, 0);
      const saiBase = yearExpenses.filter(e => e.expense_month === m).reduce((s, v) => s + v.base_value, 0);
      return { mes: ML[m - 1], entradas: ent, saidas: sai, resultado: ent - sai, ivaCobrado: ent - entBase, ivaPago: sai - saiBase };
    });
  }, [selectedQDef, yearSales, yearExpenses]);

  // Filtered products/categories for selected quarter
  const filteredProducts = useMemo(() => {
    if (!selectedQDef) return allProducts;
    const byProd = new Map<string, number>();
    yearSales.filter(s => selectedQDef.months.includes(s.sale_month || 0)).forEach(s => {
      const name = s.product || 'Sem produto';
      byProd.set(name, (byProd.get(name) || 0) + s.invoice_total);
    });
    return [...byProd.entries()].sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));
  }, [selectedQDef, yearSales, allProducts]);

  const filteredCategories = useMemo(() => {
    if (!selectedQDef) return allCategories;
    const byCat = new Map<string, number>();
    yearExpenses.filter(e => selectedQDef.months.includes(e.expense_month || 0)).forEach(e => {
      const cat = catLabel(e.category || 'outro');
      byCat.set(cat, (byCat.get(cat) || 0) + e.total_with_vat);
    });
    return [...byCat.entries()].sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));
  }, [selectedQDef, yearExpenses, allCategories]);

  // Display values (selected quarter or totals)
  const dv = selectedData ? {
    entradas: selectedData.entradas, saidas: selectedData.saidas, resultado: selectedData.resultado,
    margem: selectedData.margem, ivaCobrado: selectedData.ivaCobrado, ivaPago: selectedData.ivaPago,
    ivaBalanco: selectedData.ivaBalanco, ss: selectedData.ss,
  } : totals;

  return (
    <div className="space-y-6 mt-4">
      {/* Header with export */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Relatório Financeiro Trimestral — {currentYear}</h2>
        <Button size="sm" variant="outline" onClick={handleExport}>
          <Download className="h-3.5 w-3.5 mr-1" /> Exportar
        </Button>
      </div>

      {/* Quarter selector */}
      <Tabs value={selectedQ} onValueChange={setSelectedQ}>
        <TabsList>
          <TabsTrigger value="todos">Todos</TabsTrigger>
          {QUARTERS.map(q => (
            <TabsTrigger key={q.label} value={q.label}>{q.label} <span className="hidden sm:inline ml-1 text-muted-foreground text-[10px]">{q.range}</span></TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div id="fin-trimestral-report" className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">{selectedQ === 'todos' ? 'Total' : selectedQ} Entradas</p><p className="text-xl font-bold text-success">{fmt(dv.entradas)}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">{selectedQ === 'todos' ? 'Total' : selectedQ} Saídas</p><p className="text-xl font-bold text-destructive">{fmt(dv.saidas)}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Resultado</p><p className={`text-xl font-bold ${dv.resultado >= 0 ? 'text-success' : 'text-destructive'}`}>{fmt(dv.resultado)}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Margem</p><p className={`text-xl font-bold ${dv.margem >= 0 ? 'text-success' : 'text-destructive'}`}>{dv.margem}%</p></CardContent></Card>
      </div>

      {/* === "Todos" view === */}
      {selectedQ === 'todos' && (
        <>
          {/* Best & Worst quarter */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="border-success/30 bg-success/15/50 dark:bg-emerald-950/20 dark:border-emerald-800">
              <CardContent className="pt-4 flex items-center gap-3">
                <TrendingUp className="h-5 w-5 text-success shrink-0" />
                <div><p className="text-xs text-muted-foreground">Melhor trimestre</p><p className="font-semibold">{bestQuarter?.label} ({bestQuarter?.range})</p><p className="text-sm text-success">{fmt(bestQuarter?.resultado || 0)}</p></div>
              </CardContent>
            </Card>
            <Card className="border-destructive/30 bg-destructive/15/50 dark:bg-red-950/20 dark:border-red-800">
              <CardContent className="pt-4 flex items-center gap-3">
                <TrendingDown className="h-5 w-5 text-destructive shrink-0" />
                <div><p className="text-xs text-muted-foreground">Pior trimestre</p><p className="font-semibold">{worstQuarter?.label} ({worstQuarter?.range})</p><p className="text-sm text-destructive">{fmt(worstQuarter?.resultado || 0)}</p></div>
              </CardContent>
            </Card>
          </div>

          {/* Main quarterly table */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Balanço Trimestral</CardTitle></CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Trimestre</TableHead><TableHead>Período</TableHead><TableHead className="text-right">Entradas</TableHead><TableHead className="text-right">Saídas</TableHead><TableHead className="text-right">Resultado</TableHead><TableHead className="text-right">Margem</TableHead><TableHead className="text-right">Nº Vendas</TableHead><TableHead className="text-right">Clientes</TableHead></TableRow></TableHeader>
                <TableBody>
                  {data.map(d => (
                    <TableRow key={d.label} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedQ(d.label)}>
                      <TableCell className="font-medium">{d.label}</TableCell>
                      <TableCell className="text-muted-foreground">{d.range}</TableCell>
                      <TableCell className="text-right">{fmt(d.entradas)}</TableCell>
                      <TableCell className="text-right">{fmt(d.saidas)}</TableCell>
                      <TableCell className={`text-right font-medium ${d.resultado >= 0 ? 'text-success' : 'text-destructive'}`}>{fmt(d.resultado)}</TableCell>
                      <TableCell className="text-right">{d.margem}%</TableCell>
                      <TableCell className="text-right">{d.numSales}</TableCell>
                      <TableCell className="text-right">{d.clients}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/50 font-semibold">
                    <TableCell>TOTAL</TableCell><TableCell></TableCell>
                    <TableCell className="text-right">{fmt(totals.entradas)}</TableCell>
                    <TableCell className="text-right">{fmt(totals.saidas)}</TableCell>
                    <TableCell className={`text-right ${totals.resultado >= 0 ? 'text-success' : 'text-destructive'}`}>{fmt(totals.resultado)}</TableCell>
                    <TableCell className="text-right">{totals.margem}%</TableCell><TableCell></TableCell><TableCell></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Monthly evolution chart */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Evolução Mensal — Entradas vs Saídas</CardTitle></CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="mes" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => fmt(v)} /><Legend />
                  <Bar dataKey="entradas" name="Entradas" fill="#10b981" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="saidas" name="Saídas" fill="#ef4444" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* IVA & SS per quarter */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">IVA e Segurança Social por Trimestre</CardTitle></CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Trimestre</TableHead><TableHead className="text-right">IVA Cobrado</TableHead><TableHead className="text-right">IVA Pago</TableHead><TableHead className="text-right">Balanço IVA</TableHead><TableHead className="text-right">Seg. Social</TableHead></TableRow></TableHeader>
                <TableBody>
                  {data.map(d => (
                    <TableRow key={d.label}>
                      <TableCell className="font-medium">{d.label}</TableCell>
                      <TableCell className="text-right">{fmt(d.ivaCobrado)}</TableCell>
                      <TableCell className="text-right">{fmt(d.ivaPago)}</TableCell>
                      <TableCell className={`text-right font-medium ${d.ivaBalanco > 0 ? 'text-warning' : d.ivaBalanco < 0 ? 'text-success' : ''}`}>{fmt(d.ivaBalanco)}</TableCell>
                      <TableCell className="text-right">{fmt(d.ss)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/50 font-semibold">
                    <TableCell>TOTAL</TableCell>
                    <TableCell className="text-right">{fmt(totals.ivaCobrado)}</TableCell>
                    <TableCell className="text-right">{fmt(totals.ivaPago)}</TableCell>
                    <TableCell className={`text-right ${totals.ivaBalanco > 0 ? 'text-warning' : totals.ivaBalanco < 0 ? 'text-success' : ''}`}>{fmt(totals.ivaBalanco)}</TableCell>
                    <TableCell className="text-right">{fmt(totals.ss)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Pie charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-1.5"><Package className="h-3.5 w-3.5" /> Distribuição por Produto</CardTitle></CardHeader>
              <CardContent>
                {allProducts.length > 0 ? (
                  <div className="flex items-center gap-4">
                    <div className="h-48 w-48 shrink-0"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={allProducts} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} strokeWidth={1}>{allProducts.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}</Pie><Tooltip formatter={(v: number) => fmt(v)} /></PieChart></ResponsiveContainer></div>
                    <div className="space-y-1.5 text-sm flex-1 min-w-0">{allProducts.map((p, i) => (<div key={p.name} className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} /><span className="truncate flex-1">{p.name}</span><span className="text-muted-foreground text-xs shrink-0">{fmt(p.value)}</span></div>))}</div>
                  </div>
                ) : <p className="text-sm text-muted-foreground">Sem dados</p>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-1.5"><ArrowUpRight className="h-3.5 w-3.5" /> Distribuição por Categoria de Despesa</CardTitle></CardHeader>
              <CardContent>
                {allCategories.length > 0 ? (
                  <div className="flex items-center gap-4">
                    <div className="h-48 w-48 shrink-0"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={allCategories} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} strokeWidth={1}>{allCategories.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}</Pie><Tooltip formatter={(v: number) => fmt(v)} /></PieChart></ResponsiveContainer></div>
                    <div className="space-y-1.5 text-sm flex-1 min-w-0">{allCategories.map((c, i) => (<div key={c.name} className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} /><span className="truncate flex-1">{c.name}</span><span className="text-muted-foreground text-xs shrink-0">{fmt(c.value)}</span></div>))}</div>
                  </div>
                ) : <p className="text-sm text-muted-foreground">Sem dados</p>}
              </CardContent>
            </Card>
          </div>

          {/* Per-quarter detail cards */}
          {data.map(d => (
            <Card key={d.label}>
              <CardHeader className="pb-2"><CardTitle className="text-sm">{d.label} — {d.range} — Detalhe</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div><p className="text-[10px] text-muted-foreground">Entradas</p><p className="font-semibold text-success">{fmt(d.entradas)}</p></div>
                  <div><p className="text-[10px] text-muted-foreground">Saídas</p><p className="font-semibold text-destructive">{fmt(d.saidas)}</p></div>
                  <div><p className="text-[10px] text-muted-foreground">Resultado</p><p className={`font-semibold ${d.resultado >= 0 ? 'text-success' : 'text-destructive'}`}>{fmt(d.resultado)}</p></div>
                  <div><p className="text-[10px] text-muted-foreground">Margem</p><p className="font-semibold">{d.margem}%</p></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {d.products.length > 0 && (<div><p className="text-xs text-muted-foreground mb-2">Receita por produto</p><div className="space-y-1">{d.products.map(p => (<div key={p.name} className="flex justify-between text-sm"><span className="truncate">{p.name}</span><span className="text-muted-foreground shrink-0 ml-2">{fmt(p.value)}</span></div>))}</div></div>)}
                  {d.categories.length > 0 && (<div><p className="text-xs text-muted-foreground mb-2">Despesas por categoria</p><div className="space-y-1">{d.categories.map(c => (<div key={c.name} className="flex justify-between text-sm"><span className="truncate">{catLabel(c.name)}</span><span className="text-muted-foreground shrink-0 ml-2">{fmt(c.value)}</span></div>))}</div></div>)}
                </div>
              </CardContent>
            </Card>
          ))}
        </>
      )}

      {/* === Single quarter view === */}
      {selectedData && selectedQDef && (
        <>
          {/* Monthly breakdown chart for this quarter */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Entradas vs Saídas — {selectedData.label} ({selectedData.range})</CardTitle></CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={selectedMonthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="mes" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => fmt(v)} /><Legend />
                  <Bar dataKey="entradas" name="Entradas" fill="#10b981" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="saidas" name="Saídas" fill="#ef4444" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Monthly detail table */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Detalhe Mensal — {selectedData.label}</CardTitle></CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Mês</TableHead><TableHead className="text-right">Entradas</TableHead><TableHead className="text-right">Saídas</TableHead><TableHead className="text-right">Resultado</TableHead><TableHead className="text-right">IVA Cobrado</TableHead><TableHead className="text-right">IVA Pago</TableHead></TableRow></TableHeader>
                <TableBody>
                  {selectedMonthlyData.map(d => (
                    <TableRow key={d.mes}>
                      <TableCell className="font-medium">{d.mes}</TableCell>
                      <TableCell className="text-right">{fmt(d.entradas)}</TableCell>
                      <TableCell className="text-right">{fmt(d.saidas)}</TableCell>
                      <TableCell className={`text-right font-medium ${d.resultado >= 0 ? 'text-success' : 'text-destructive'}`}>{fmt(d.resultado)}</TableCell>
                      <TableCell className="text-right">{fmt(d.ivaCobrado)}</TableCell>
                      <TableCell className="text-right">{fmt(d.ivaPago)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/50 font-semibold">
                    <TableCell>TOTAL</TableCell>
                    <TableCell className="text-right">{fmt(dv.entradas)}</TableCell>
                    <TableCell className="text-right">{fmt(dv.saidas)}</TableCell>
                    <TableCell className={`text-right ${dv.resultado >= 0 ? 'text-success' : 'text-destructive'}`}>{fmt(dv.resultado)}</TableCell>
                    <TableCell className="text-right">{fmt(dv.ivaCobrado)}</TableCell>
                    <TableCell className="text-right">{fmt(dv.ivaPago)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* IVA & SS for this quarter */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-1.5 mb-2"><Receipt className="h-3.5 w-3.5 text-warning" /><p className="text-xs text-muted-foreground">IVA — {selectedData.label}</p></div>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div><p className="text-[10px] text-muted-foreground">Cobrado</p><p className="font-semibold">{fmt(dv.ivaCobrado)}</p></div>
                  <div><p className="text-[10px] text-muted-foreground">Pago</p><p className="font-semibold">{fmt(dv.ivaPago)}</p></div>
                  <div><p className="text-[10px] text-muted-foreground">Balanço</p><p className={`font-semibold ${dv.ivaBalanco > 0 ? 'text-warning' : dv.ivaBalanco < 0 ? 'text-success' : ''}`}>{fmt(dv.ivaBalanco)}</p></div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-1.5 mb-2"><Shield className="h-3.5 w-3.5 text-cyan-600" /><p className="text-xs text-muted-foreground">Segurança Social — {selectedData.label}</p></div>
                <p className="text-xl font-bold">{fmt(dv.ss)}</p>
              </CardContent>
            </Card>
          </div>

          {/* Pie charts for this quarter */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-1.5"><Package className="h-3.5 w-3.5" /> Receita por Produto — {selectedData.label}</CardTitle></CardHeader>
              <CardContent>
                {filteredProducts.length > 0 ? (
                  <div className="flex items-center gap-4">
                    <div className="h-48 w-48 shrink-0"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={filteredProducts} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} strokeWidth={1}>{filteredProducts.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}</Pie><Tooltip formatter={(v: number) => fmt(v)} /></PieChart></ResponsiveContainer></div>
                    <div className="space-y-1.5 text-sm flex-1 min-w-0">{filteredProducts.map((p, i) => (<div key={p.name} className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} /><span className="truncate flex-1">{p.name}</span><span className="text-muted-foreground text-xs shrink-0">{fmt(p.value)}</span></div>))}</div>
                  </div>
                ) : <p className="text-sm text-muted-foreground">Sem dados</p>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-1.5"><ArrowUpRight className="h-3.5 w-3.5" /> Despesas por Categoria — {selectedData.label}</CardTitle></CardHeader>
              <CardContent>
                {filteredCategories.length > 0 ? (
                  <div className="flex items-center gap-4">
                    <div className="h-48 w-48 shrink-0"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={filteredCategories} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} strokeWidth={1}>{filteredCategories.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}</Pie><Tooltip formatter={(v: number) => fmt(v)} /></PieChart></ResponsiveContainer></div>
                    <div className="space-y-1.5 text-sm flex-1 min-w-0">{filteredCategories.map((c, i) => (<div key={c.name} className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} /><span className="truncate flex-1">{c.name}</span><span className="text-muted-foreground text-xs shrink-0">{fmt(c.value)}</span></div>))}</div>
                  </div>
                ) : <p className="text-sm text-muted-foreground">Sem dados</p>}
              </CardContent>
            </Card>
          </div>

          {/* Nº vendas & clientes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card><CardContent className="pt-4 pb-3"><p className="text-xs text-muted-foreground">Nº Vendas — {selectedData.label}</p><p className="text-xl font-bold">{selectedData.numSales}</p></CardContent></Card>
            <Card><CardContent className="pt-4 pb-3"><p className="text-xs text-muted-foreground">Clientes — {selectedData.label}</p><p className="text-xl font-bold">{selectedData.clients}</p></CardContent></Card>
          </div>
        </>
      )}
      </div>
    </div>
  );
}
