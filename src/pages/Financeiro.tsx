import { useMemo, useState } from 'react';
import { useKpiSettings } from '@/hooks/useKpiSettings';
import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { excludeCancelled } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts';
import { useNavigate } from 'react-router-dom';
import { useFinancialData } from '@/hooks/useFinancialData';
import { useCommercialData } from '@/hooks/useCommercialData';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { YearSelector } from '@/components/YearSelector';
import { CalendarDays, CalendarRange, ArrowDownLeft, ArrowUpRight, Receipt, Shield, FolderOpen, Settings, TrendingUp, TrendingDown, Users, Package, UserCheck, Download, BarChart3, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { exportPdf } from '@/lib/exportPdf';


const fmt = (v: number) => v.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
const ML = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const PIE_COLORS = ['hsl(var(--primary))', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#6366f1'];

const ALL_SECTIONS_ROW1 = [
  { path: '/hub/financeiro/mensal', label: 'Mensal', icon: CalendarDays, iconColor: 'text-blue-600', color: 'from-blue-500/20 to-blue-600/10 border-blue-200/60 hover:from-blue-500/30 hover:to-blue-600/15 hover:border-blue-300/80', key: 'mensal' },
  { path: '/hub/financeiro/trimestral', label: 'Trimestral', icon: CalendarRange, iconColor: 'text-violet-600', color: 'from-violet-500/20 to-violet-600/10 border-violet-200/60 hover:from-violet-500/30 hover:to-violet-600/15 hover:border-violet-300/80', key: 'trimestral' },
  { path: '/hub/financeiro/documentos', label: 'Documentos', icon: FolderOpen, iconColor: 'text-orange-600', color: 'from-orange-500/20 to-orange-600/10 border-orange-200/60 hover:from-orange-500/30 hover:to-orange-600/15 hover:border-orange-300/80', key: 'documentos' },
  { path: '/hub/financeiro/iva', label: 'IVA', icon: Receipt, iconColor: 'text-amber-600', color: 'from-amber-500/20 to-amber-600/10 border-amber-200/60 hover:from-amber-500/30 hover:to-amber-600/15 hover:border-amber-300/80', key: 'iva' },
  { path: '/hub/financeiro/seguranca-social', label: 'Segurança Social', icon: Shield, iconColor: 'text-cyan-600', color: 'from-cyan-500/20 to-cyan-600/10 border-cyan-200/60 hover:from-cyan-500/30 hover:to-cyan-600/15 hover:border-cyan-300/80', key: 'ss' },
];

const ALL_SECTIONS_ROW2 = [
  { path: '/hub/financeiro/contabilidade', label: 'Contabilidade', icon: BookOpen, iconColor: 'text-emerald-600', color: 'from-emerald-500/20 to-emerald-600/10 border-emerald-200/60 hover:from-emerald-500/30 hover:to-emerald-600/15 hover:border-emerald-300/80', key: 'contabilidade' },
  { path: '/hub/financeiro/previsibilidade', label: 'Previsibilidade', icon: TrendingUp, iconColor: 'text-indigo-600', color: 'from-indigo-500/20 to-indigo-600/10 border-indigo-200/60 hover:from-indigo-500/30 hover:to-indigo-600/15 hover:border-indigo-300/80', key: 'previsibilidade' },
  { path: '/hub/financeiro/entradas', label: 'Entradas', icon: ArrowDownLeft, iconColor: 'text-emerald-600', color: 'from-emerald-500/20 to-emerald-600/10 border-emerald-200/60 hover:from-emerald-500/30 hover:to-emerald-600/15 hover:border-emerald-300/80', key: 'entradas' },
  { path: '/hub/financeiro/saidas', label: 'Saídas', icon: ArrowUpRight, iconColor: 'text-red-600', color: 'from-red-500/20 to-red-600/10 border-red-200/60 hover:from-red-500/30 hover:to-red-600/15 hover:border-red-300/80', key: 'saidas' },
  { path: '/hub/financeiro/setup-financeiro', label: 'Setup Financeiro', icon: Settings, iconColor: 'text-slate-600', color: 'from-slate-500/20 to-slate-600/10 border-slate-200/60 hover:from-slate-500/30 hover:to-slate-600/15 hover:border-slate-300/80', key: 'setup' },
];

export default function FinanceiroPage() {
  const { settings } = useBusinessSettings();
  const fin = useFinancialData();
  const [year, setYear] = useState(new Date().getFullYear());
  const com = useCommercialData(year);
  const navigate = useNavigate();

  // Filter IVA / SS / Ordenados sections based on fiscal settings
  const s = settings as any;
  const ivaExempt = s?.iva_exempt ?? false;
  const ssExempt = s?.ss_exempt ?? false;
  const isContabOrganizada = (s?.tax_irs_regime || '') === 'contabilidade_organizada';
  const teamType = s?.team_type || 'externa';
  const hasInternalTeam = teamType === 'interna' || teamType === 'ambas';

  const SECTIONS_ROW1 = useMemo(() => {
    return ALL_SECTIONS_ROW1.filter(sec => {
      if (sec.key === 'iva' && ivaExempt && !isContabOrganizada) return false;
      if (sec.key === 'ss' && ssExempt && !isContabOrganizada) return false;
      return true;
    });
  }, [ivaExempt, ssExempt, isContabOrganizada]);

  const SECTIONS_ROW2 = ALL_SECTIONS_ROW2;

  const sales = excludeCancelled(com.sales.data || []);
  const expenses = excludeCancelled(fin.expenses.data || []);

  // Fetch clients for counting
  const { data: clients = [] } = useQuery({
    queryKey: ['clients-fin-overview'],
    queryFn: async () => {
      const { data } = await supabase.from('clients').select('id, status, start_date, current_product');
      return data || [];
    },
  });

  // Filter by year
  const yearSales = useMemo(() => sales.filter(s => s.sale_year === year), [sales, year]);
  const yearExpenses = useMemo(() => expenses.filter(e => e.expense_year === year), [expenses, year]);

  // Summary
  const totalEntradas = yearSales.reduce((s, v) => s + v.invoice_total, 0);
  const totalBaseEntradas = yearSales.reduce((s, v) => s + v.base_value, 0);
  const totalSaidas = yearExpenses.reduce((s, v) => s + v.total_with_vat, 0);
  const totalBaseSaidas = yearExpenses.reduce((s, v) => s + v.base_value, 0);
  const resultado = totalEntradas - totalSaidas;
  const margem = totalEntradas > 0 ? Math.round(resultado / totalEntradas * 10000) / 100 : 0;

  // IVA
  const ivaCobrado = totalEntradas - totalBaseEntradas;
  const ivaPago = totalSaidas - totalBaseSaidas;
  const ivaBalanco = Math.round((ivaCobrado - ivaPago) * 100) / 100;

  // SS balance
  const ssTotal = useMemo(() => {
    return yearExpenses
      .filter(e => e.category === 'seguranca_social')
      .reduce((s, v) => s + v.total_with_vat, 0);
  }, [yearExpenses]);

  // Product insights (from sales)
  const productInsights = useMemo(() => {
    const byProduct = new Map<string, number>();
    yearSales.forEach(s => {
      const name = s.product || 'Sem produto';
      byProduct.set(name, (byProduct.get(name) || 0) + s.invoice_total);
    });
    const sorted = [...byProduct.entries()].sort((a, b) => b[1] - a[1]);
    return {
      best: sorted.length > 0 ? { name: sorted[0][0], value: sorted[0][1] } : null,
      worst: sorted.length > 1 ? { name: sorted[sorted.length - 1][0], value: sorted[sorted.length - 1][1] } : null,
    };
  }, [yearSales]);

  // Clients active in the year
  const clientsInYear = useMemo(() => {
    const clientSet = new Set<string>();
    yearSales.forEach(s => { if (s.client) clientSet.add(s.client); });
    return clientSet.size;
  }, [yearSales]);

  // Expense category insights
  const categoryInsights = useMemo(() => {
    const byCat = new Map<string, number>();
    yearExpenses.forEach(e => {
      const cat = e.category || 'outro';
      byCat.set(cat, (byCat.get(cat) || 0) + e.total_with_vat);
    });
    const sorted = [...byCat.entries()].sort((a, b) => b[1] - a[1]);
    return {
      biggest: sorted.length > 0 ? { name: sorted[0][0], value: sorted[0][1] } : null,
      smallest: sorted.length > 1 ? { name: sorted[sorted.length - 1][0], value: sorted[sorted.length - 1][1] } : null,
    };
  }, [yearExpenses]);

  const catLabel = (key: string) => {
    const map: Record<string, string> = {
      plataformas: 'Plataformas', marketing: 'Marketing', material: 'Material', servicos: 'Serviços',
      impostos: 'Impostos', seguranca_social: 'Segurança Social', ordenados: 'Ordenados',
      prestadores: 'Prestadores', outro: 'Outro', escritorio: 'Escritório',
    };
    return map[key] || key;
  };

  // Monthly chart data
  const monthlyData = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const ent = yearSales.filter(s => s.sale_month === m).reduce((s, v) => s + v.invoice_total, 0);
      const entBase = yearSales.filter(s => s.sale_month === m).reduce((s, v) => s + v.base_value, 0);
      const sai = yearExpenses.filter(e => e.expense_month === m).reduce((s, v) => s + v.total_with_vat, 0);
      const saiBase = yearExpenses.filter(e => e.expense_month === m).reduce((s, v) => s + v.base_value, 0);
      return { mes: ML[i], entradas: ent, saidas: sai, resultado: ent - sai, ivaCobrado: ent - entBase, ivaPago: sai - saiBase };
    });
  }, [yearSales, yearExpenses]);

  // Product distribution for pie chart
  const productPieData = useMemo(() => {
    const byProduct = new Map<string, number>();
    yearSales.forEach(s => {
      const name = s.product || 'Sem produto';
      byProduct.set(name, (byProduct.get(name) || 0) + s.invoice_total);
    });
    return [...byProduct.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [yearSales]);

  // Category distribution for pie chart
  const categoryPieData = useMemo(() => {
    const byCat = new Map<string, number>();
    yearExpenses.forEach(e => {
      const cat = catLabel(e.category || 'outro');
      byCat.set(cat, (byCat.get(cat) || 0) + e.total_with_vat);
    });
    return [...byCat.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [yearExpenses]);

  // Quarterly data
  const QUARTERS = [
    { label: 'T1', months: [1, 2, 3] },
    { label: 'T2', months: [4, 5, 6] },
    { label: 'T3', months: [7, 8, 9] },
    { label: 'T4', months: [10, 11, 12] },
  ];

  const quarterlyData = useMemo(() => {
    return QUARTERS.map(q => {
      const ent = yearSales.filter(s => q.months.includes(s.sale_month || 0)).reduce((s, v) => s + v.invoice_total, 0);
      const sai = yearExpenses.filter(e => q.months.includes(e.expense_month || 0)).reduce((s, v) => s + v.total_with_vat, 0);
      const res = ent - sai;
      return { label: q.label, entradas: ent, saidas: sai, resultado: res, margem: ent > 0 ? Math.round(res / ent * 10000) / 100 : 0 };
    });
  }, [yearSales, yearExpenses]);

  // Best/worst month
  const bestMonth = useMemo(() => {
    let best = monthlyData[0];
    monthlyData.forEach(d => { if (d.resultado > best.resultado) best = d; });
    return best;
  }, [monthlyData]);

  const worstMonth = useMemo(() => {
    let worst = monthlyData[0];
    monthlyData.forEach(d => { if (d.resultado < worst.resultado) worst = d; });
    return worst;
  }, [monthlyData]);

  // Average monthly
  const avgEntradas = totalEntradas / 12;
  const avgSaidas = totalSaidas / 12;

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader title="Contabilidade" subtitle="Gestão contabilística, entradas, saídas e obrigações fiscais." />

        {/* Navigation cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {SECTIONS.map(s => (
            <Card
              key={s.path}
              className={`group cursor-pointer border bg-gradient-to-br ${s.color} transition-all duration-200 hover:shadow-md hover:-translate-y-0.5`}
              onClick={() => navigate(s.path)}
            >
              <CardContent className="p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
                <div className={`h-8 w-8 sm:h-9 sm:w-9 rounded-lg bg-background/80 flex items-center justify-center shadow-sm shrink-0 ${s.iconColor}`}>
                  <s.icon className="h-4 w-4" />
                </div>
                <span className="font-medium text-xs sm:text-sm text-foreground leading-tight">{s.label}</span>
              </CardContent>
            </Card>
          ))}
        </div>




        <div className="flex items-center justify-between">
          <YearSelector year={year} onChange={setYear} />
          <Button size="sm" variant="outline" onClick={() => exportPdf(`Relatório Financeiro Anual — ${year}`, 'fin-annual-report')}>
            <Download className="h-3.5 w-3.5 mr-1" /> Exportar PDF
          </Button>
        </div>

        {/* Summary Cards */}
        <div id="fin-annual-report" className="space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          <Card><CardContent className="pt-3 pb-2 sm:pt-4 sm:pb-3"><p className="text-[10px] sm:text-xs text-muted-foreground">Entradas</p><p className="text-lg sm:text-xl font-bold text-emerald-600">{fmt(totalEntradas)}</p></CardContent></Card>
          <Card><CardContent className="pt-3 pb-2 sm:pt-4 sm:pb-3"><p className="text-[10px] sm:text-xs text-muted-foreground">Saídas</p><p className="text-lg sm:text-xl font-bold text-red-600">{fmt(totalSaidas)}</p></CardContent></Card>
          <Card><CardContent className="pt-3 pb-2 sm:pt-4 sm:pb-3"><p className="text-[10px] sm:text-xs text-muted-foreground">Resultado</p><p className={`text-lg sm:text-xl font-bold ${resultado >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{fmt(resultado)}</p></CardContent></Card>
          <Card><CardContent className="pt-3 pb-2 sm:pt-4 sm:pb-3"><p className="text-[10px] sm:text-xs text-muted-foreground">Margem</p><p className={`text-lg sm:text-xl font-bold ${margem >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{margem}%</p></CardContent></Card>
          <Card><CardContent className="pt-3 pb-2 sm:pt-4 sm:pb-3"><p className="text-[10px] sm:text-xs text-muted-foreground">Média Mensal Ent.</p><p className="text-lg sm:text-xl font-bold">{fmt(avgEntradas)}</p></CardContent></Card>
          <Card><CardContent className="pt-3 pb-2 sm:pt-4 sm:pb-3"><p className="text-[10px] sm:text-xs text-muted-foreground">Média Mensal Saí.</p><p className="text-lg sm:text-xl font-bold">{fmt(avgSaidas)}</p></CardContent></Card>
        </div>

        {/* Best/Worst month */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20 dark:border-emerald-800">
            <CardContent className="pt-4 flex items-center gap-3">
              <TrendingUp className="h-5 w-5 text-emerald-600 shrink-0" />
              <div><p className="text-xs text-muted-foreground">Melhor mês</p><p className="font-semibold">{bestMonth.mes}</p><p className="text-sm text-emerald-600">{fmt(bestMonth.resultado)}</p></div>
            </CardContent>
          </Card>
          <Card className="border-red-200 bg-red-50/50 dark:bg-red-950/20 dark:border-red-800">
            <CardContent className="pt-4 flex items-center gap-3">
              <TrendingDown className="h-5 w-5 text-red-600 shrink-0" />
              <div><p className="text-xs text-muted-foreground">Pior mês</p><p className="font-semibold">{worstMonth.mes}</p><p className="text-sm text-red-600">{fmt(worstMonth.resultado)}</p></div>
            </CardContent>
          </Card>
        </div>

        {/* Entradas vs Saídas chart */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Entradas vs Saídas — Evolução Mensal</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Legend />
                <Bar dataKey="entradas" name="Entradas" fill="#10b981" radius={[3, 3, 0, 0]} />
                <Bar dataKey="saidas" name="Saídas" fill="#ef4444" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Resultado mensal chart */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Resultado Mensal (Lucro / Prejuízo)</CardTitle></CardHeader>
          <CardContent className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Bar dataKey="resultado" name="Resultado" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Monthly detail table */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Detalhe Mensal — {year}</CardTitle></CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mês</TableHead>
                  <TableHead className="text-right">Entradas</TableHead>
                  <TableHead className="text-right">Saídas</TableHead>
                  <TableHead className="text-right">Resultado</TableHead>
                  <TableHead className="text-right">IVA Cobrado</TableHead>
                  <TableHead className="text-right">IVA Pago</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {monthlyData.map(d => (
                  <TableRow key={d.mes}>
                    <TableCell className="font-medium">{d.mes}</TableCell>
                    <TableCell className="text-right">{fmt(d.entradas)}</TableCell>
                    <TableCell className="text-right">{fmt(d.saidas)}</TableCell>
                    <TableCell className={`text-right font-medium ${d.resultado >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{fmt(d.resultado)}</TableCell>
                    <TableCell className="text-right">{fmt(d.ivaCobrado)}</TableCell>
                    <TableCell className="text-right">{fmt(d.ivaPago)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/50 font-semibold">
                  <TableCell>TOTAL</TableCell>
                  <TableCell className="text-right">{fmt(totalEntradas)}</TableCell>
                  <TableCell className="text-right">{fmt(totalSaidas)}</TableCell>
                  <TableCell className={`text-right ${resultado >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{fmt(resultado)}</TableCell>
                  <TableCell className="text-right">{fmt(ivaCobrado)}</TableCell>
                  <TableCell className="text-right">{fmt(ivaPago)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Quarterly comparison table */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Comparativo Trimestral</CardTitle></CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Trimestre</TableHead>
                  <TableHead className="text-right">Entradas</TableHead>
                  <TableHead className="text-right">Saídas</TableHead>
                  <TableHead className="text-right">Resultado</TableHead>
                  <TableHead className="text-right">Margem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quarterlyData.map(d => (
                  <TableRow key={d.label}>
                    <TableCell className="font-medium">{d.label}</TableCell>
                    <TableCell className="text-right">{fmt(d.entradas)}</TableCell>
                    <TableCell className="text-right">{fmt(d.saidas)}</TableCell>
                    <TableCell className={`text-right font-medium ${d.resultado >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{fmt(d.resultado)}</TableCell>
                    <TableCell className="text-right">{d.margem}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Pie charts: Products & Categories */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-1.5"><Package className="h-3.5 w-3.5" /> Receita por Produto</CardTitle></CardHeader>
            <CardContent>
              {productPieData.length > 0 ? (
                <div className="flex items-center gap-4">
                  <div className="h-48 w-48 shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart><Pie data={productPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} strokeWidth={1}>{productPieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}</Pie><Tooltip formatter={(v: number) => fmt(v)} /></PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-1.5 text-sm flex-1 min-w-0">
                    {productPieData.map((p, i) => (
                      <div key={p.name} className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                        <span className="truncate flex-1">{p.name}</span>
                        <span className="text-muted-foreground text-xs shrink-0">{fmt(p.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : <p className="text-sm text-muted-foreground">Sem dados</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-1.5"><ArrowUpRight className="h-3.5 w-3.5" /> Despesas por Categoria</CardTitle></CardHeader>
            <CardContent>
              {categoryPieData.length > 0 ? (
                <div className="flex items-center gap-4">
                  <div className="h-48 w-48 shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart><Pie data={categoryPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} strokeWidth={1}>{categoryPieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}</Pie><Tooltip formatter={(v: number) => fmt(v)} /></PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-1.5 text-sm flex-1 min-w-0">
                    {categoryPieData.map((c, i) => (
                      <div key={c.name} className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                        <span className="truncate flex-1">{c.name}</span>
                        <span className="text-muted-foreground text-xs shrink-0">{fmt(c.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : <p className="text-sm text-muted-foreground">Sem dados</p>}
            </CardContent>
          </Card>
        </div>

        {/* Insights row */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-1.5 mb-1"><Package className="h-3.5 w-3.5 text-muted-foreground" /><p className="text-xs text-muted-foreground">Produto + vendido</p></div>
              {productInsights.best ? (<><p className="text-sm font-semibold truncate">{productInsights.best.name}</p><p className="text-xs text-muted-foreground">{fmt(productInsights.best.value)}</p></>) : <p className="text-xs text-muted-foreground">Sem dados</p>}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-1.5 mb-1"><Package className="h-3.5 w-3.5 text-muted-foreground" /><p className="text-xs text-muted-foreground">Produto - vendido</p></div>
              {productInsights.worst ? (<><p className="text-sm font-semibold truncate">{productInsights.worst.name}</p><p className="text-xs text-muted-foreground">{fmt(productInsights.worst.value)}</p></>) : <p className="text-xs text-muted-foreground">Sem dados</p>}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-1.5 mb-1"><ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" /><p className="text-xs text-muted-foreground">Maior despesa</p></div>
              {categoryInsights.biggest ? (<><p className="text-sm font-semibold">{catLabel(categoryInsights.biggest.name)}</p><p className="text-xs text-muted-foreground">{fmt(categoryInsights.biggest.value)}</p></>) : <p className="text-xs text-muted-foreground">Sem dados</p>}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-1.5 mb-1"><ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" /><p className="text-xs text-muted-foreground">Menor despesa</p></div>
              {categoryInsights.smallest ? (<><p className="text-sm font-semibold">{catLabel(categoryInsights.smallest.name)}</p><p className="text-xs text-muted-foreground">{fmt(categoryInsights.smallest.value)}</p></>) : <p className="text-xs text-muted-foreground">Sem dados</p>}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-1.5 mb-1"><UserCheck className="h-3.5 w-3.5 text-muted-foreground" /><p className="text-xs text-muted-foreground">Clientes no ano</p></div>
              <p className="text-xl font-bold">{clientsInYear}</p>
            </CardContent>
          </Card>
        </div>

        {/* IVA & SS Balance */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-1.5 mb-2"><Receipt className="h-3.5 w-3.5 text-amber-600" /><p className="text-xs text-muted-foreground">Balanço IVA — {year}</p></div>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div><p className="text-[10px] text-muted-foreground">Cobrado</p><p className="font-semibold">{fmt(ivaCobrado)}</p></div>
                <div><p className="text-[10px] text-muted-foreground">Pago</p><p className="font-semibold">{fmt(ivaPago)}</p></div>
                <div><p className="text-[10px] text-muted-foreground">Balanço</p><p className={`font-semibold ${ivaBalanco > 0 ? 'text-amber-600' : ivaBalanco < 0 ? 'text-emerald-600' : ''}`}>{fmt(ivaBalanco)}</p></div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-1.5 mb-2"><Shield className="h-3.5 w-3.5 text-cyan-600" /><p className="text-xs text-muted-foreground">Segurança Social — {year}</p></div>
              <p className="text-xl font-bold">{fmt(ssTotal)}</p>
              <p className="text-[10px] text-muted-foreground">Total pago no ano</p>
            </CardContent>
          </Card>
        </div>

        {/* Nº vendas & despesas */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-1.5 mb-1"><BarChart3 className="h-3.5 w-3.5 text-muted-foreground" /><p className="text-xs text-muted-foreground">Total de vendas registadas</p></div>
              <p className="text-xl font-bold">{yearSales.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-1.5 mb-1"><BarChart3 className="h-3.5 w-3.5 text-muted-foreground" /><p className="text-xs text-muted-foreground">Total de despesas registadas</p></div>
              <p className="text-xl font-bold">{yearExpenses.length}</p>
            </CardContent>
          </Card>
        </div>
        </div>
      </div>
    </AppLayout>
  );
}
