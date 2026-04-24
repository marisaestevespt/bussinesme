import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TrendingUp, TrendingDown, Package, ArrowUpRight } from 'lucide-react';
import { formatEuro } from '@/lib/formatting';
import { expenseLabel } from '@/lib/financialCategories';
import { PieCard } from './PieCard';
import type { QuarterData, QuarterTotals, NamedValue } from './types';

interface Props {
  data: QuarterData[];
  totals: QuarterTotals;
  monthlyData: { mes: string; entradas: number; saidas: number; resultado: number }[];
  allProducts: NamedValue[];
  allCategories: NamedValue[];
  bestQuarter: QuarterData;
  worstQuarter: QuarterData;
  onSelectQuarter: (label: string) => void;
}

export function AllQuartersView({ data, totals, monthlyData, allProducts, allCategories, bestQuarter, worstQuarter, onSelectQuarter }: Props) {
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-success/30 bg-success/15/50 dark:bg-emerald-950/20 dark:border-emerald-800">
          <CardContent className="pt-4 flex items-center gap-3">
            <TrendingUp className="h-5 w-5 text-success shrink-0" />
            <div><p className="text-xs text-muted-foreground">Melhor trimestre</p><p className="font-semibold">{bestQuarter?.label} ({bestQuarter?.range})</p><p className="text-sm text-success">{formatEuro(bestQuarter?.resultado || 0)}</p></div>
          </CardContent>
        </Card>
        <Card className="border-destructive/30 bg-destructive/15/50 dark:bg-red-950/20 dark:border-red-800">
          <CardContent className="pt-4 flex items-center gap-3">
            <TrendingDown className="h-5 w-5 text-destructive shrink-0" />
            <div><p className="text-xs text-muted-foreground">Pior trimestre</p><p className="font-semibold">{worstQuarter?.label} ({worstQuarter?.range})</p><p className="text-sm text-destructive">{formatEuro(worstQuarter?.resultado || 0)}</p></div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Balanço Trimestral</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Trimestre</TableHead><TableHead>Período</TableHead><TableHead className="text-right">Entradas</TableHead><TableHead className="text-right">Saídas</TableHead><TableHead className="text-right">Resultado</TableHead><TableHead className="text-right">Margem</TableHead><TableHead className="text-right">Nº Vendas</TableHead><TableHead className="text-right">Clientes</TableHead></TableRow></TableHeader>
            <TableBody>
              {data.map(d => (
                <TableRow key={d.label} className="cursor-pointer hover:bg-muted/50" onClick={() => onSelectQuarter(d.label)}>
                  <TableCell className="font-medium">{d.label}</TableCell>
                  <TableCell className="text-muted-foreground">{d.range}</TableCell>
                  <TableCell className="text-right">{formatEuro(d.entradas)}</TableCell>
                  <TableCell className="text-right">{formatEuro(d.saidas)}</TableCell>
                  <TableCell className={`text-right font-medium ${d.resultado >= 0 ? 'text-success' : 'text-destructive'}`}>{formatEuro(d.resultado)}</TableCell>
                  <TableCell className="text-right">{d.margem}%</TableCell>
                  <TableCell className="text-right">{d.numSales}</TableCell>
                  <TableCell className="text-right">{d.clients}</TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-muted/50 font-semibold">
                <TableCell>TOTAL</TableCell><TableCell />
                <TableCell className="text-right">{formatEuro(totals.entradas)}</TableCell>
                <TableCell className="text-right">{formatEuro(totals.saidas)}</TableCell>
                <TableCell className={`text-right ${totals.resultado >= 0 ? 'text-success' : 'text-destructive'}`}>{formatEuro(totals.resultado)}</TableCell>
                <TableCell className="text-right">{totals.margem}%</TableCell><TableCell /><TableCell />
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Evolução Mensal — Entradas vs Saídas</CardTitle></CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="mes" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => formatEuro(v)} /><Legend />
              <Bar dataKey="entradas" name="Entradas" fill="#10b981" radius={[3, 3, 0, 0]} />
              <Bar dataKey="saidas" name="Saídas" fill="#ef4444" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">IVA e Segurança Social por Trimestre</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Trimestre</TableHead><TableHead className="text-right">IVA Cobrado</TableHead><TableHead className="text-right">IVA Pago</TableHead><TableHead className="text-right">Balanço IVA</TableHead><TableHead className="text-right">Seg. Social</TableHead></TableRow></TableHeader>
            <TableBody>
              {data.map(d => (
                <TableRow key={d.label}>
                  <TableCell className="font-medium">{d.label}</TableCell>
                  <TableCell className="text-right">{formatEuro(d.ivaCobrado)}</TableCell>
                  <TableCell className="text-right">{formatEuro(d.ivaPago)}</TableCell>
                  <TableCell className={`text-right font-medium ${d.ivaBalanco > 0 ? 'text-warning' : d.ivaBalanco < 0 ? 'text-success' : ''}`}>{formatEuro(d.ivaBalanco)}</TableCell>
                  <TableCell className="text-right">{formatEuro(d.ss)}</TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-muted/50 font-semibold">
                <TableCell>TOTAL</TableCell>
                <TableCell className="text-right">{formatEuro(totals.ivaCobrado)}</TableCell>
                <TableCell className="text-right">{formatEuro(totals.ivaPago)}</TableCell>
                <TableCell className={`text-right ${totals.ivaBalanco > 0 ? 'text-warning' : totals.ivaBalanco < 0 ? 'text-success' : ''}`}>{formatEuro(totals.ivaBalanco)}</TableCell>
                <TableCell className="text-right">{formatEuro(totals.ss)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PieCard title={<><Package className="h-3.5 w-3.5" /> Distribuição por Produto</>} data={allProducts} />
        <PieCard title={<><ArrowUpRight className="h-3.5 w-3.5" /> Distribuição por Categoria de Despesa</>} data={allCategories} />
      </div>

      {data.map(d => (
        <Card key={d.label}>
          <CardHeader className="pb-2"><CardTitle className="text-sm">{d.label} — {d.range} — Detalhe</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div><p className="text-[10px] text-muted-foreground">Entradas</p><p className="font-semibold text-success">{formatEuro(d.entradas)}</p></div>
              <div><p className="text-[10px] text-muted-foreground">Saídas</p><p className="font-semibold text-destructive">{formatEuro(d.saidas)}</p></div>
              <div><p className="text-[10px] text-muted-foreground">Resultado</p><p className={`font-semibold ${d.resultado >= 0 ? 'text-success' : 'text-destructive'}`}>{formatEuro(d.resultado)}</p></div>
              <div><p className="text-[10px] text-muted-foreground">Margem</p><p className="font-semibold">{d.margem}%</p></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {d.products.length > 0 && (<div><p className="text-xs text-muted-foreground mb-2">Receita por produto</p><div className="space-y-1">{d.products.map(p => (<div key={p.name} className="flex justify-between text-sm"><span className="truncate">{p.name}</span><span className="text-muted-foreground shrink-0 ml-2">{formatEuro(p.value)}</span></div>))}</div></div>)}
              {d.categories.length > 0 && (<div><p className="text-xs text-muted-foreground mb-2">Despesas por categoria</p><div className="space-y-1">{d.categories.map(c => (<div key={c.name} className="flex justify-between text-sm"><span className="truncate">{expenseLabel(c.name)}</span><span className="text-muted-foreground shrink-0 ml-2">{formatEuro(c.value)}</span></div>))}</div></div>)}
            </div>
          </CardContent>
        </Card>
      ))}
    </>
  );
}
