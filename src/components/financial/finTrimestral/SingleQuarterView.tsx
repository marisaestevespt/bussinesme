import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Package, ArrowUpRight, Receipt, Shield } from 'lucide-react';
import { formatEuro } from '@/lib/formatting';
import { PieCard } from './PieCard';
import type { QuarterData, NamedValue } from './types';

interface DV {
  entradas: number; saidas: number; resultado: number; margem: number;
  ivaCobrado: number; ivaPago: number; ivaBalanco: number; ss: number;
}

interface Props {
  selectedData: QuarterData;
  selectedMonthlyData: { mes: string; entradas: number; saidas: number; resultado: number; ivaCobrado: number; ivaPago: number }[];
  filteredProducts: NamedValue[];
  filteredCategories: NamedValue[];
  dv: DV;
}

export function SingleQuarterView({ selectedData, selectedMonthlyData, filteredProducts, filteredCategories, dv }: Props) {
  return (
    <>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Entradas vs Saídas — {selectedData.label} ({selectedData.range})</CardTitle></CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={selectedMonthlyData}>
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
        <CardHeader className="pb-2"><CardTitle className="text-sm">Detalhe Mensal — {selectedData.label}</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Mês</TableHead><TableHead className="text-right">Entradas</TableHead><TableHead className="text-right">Saídas</TableHead><TableHead className="text-right">Resultado</TableHead><TableHead className="text-right">IVA Cobrado</TableHead><TableHead className="text-right">IVA Pago</TableHead></TableRow></TableHeader>
            <TableBody>
              {selectedMonthlyData.map(d => (
                <TableRow key={d.mes}>
                  <TableCell className="font-medium">{d.mes}</TableCell>
                  <TableCell className="text-right">{formatEuro(d.entradas)}</TableCell>
                  <TableCell className="text-right">{formatEuro(d.saidas)}</TableCell>
                  <TableCell className={`text-right font-medium ${d.resultado >= 0 ? 'text-success' : 'text-destructive'}`}>{formatEuro(d.resultado)}</TableCell>
                  <TableCell className="text-right">{formatEuro(d.ivaCobrado)}</TableCell>
                  <TableCell className="text-right">{formatEuro(d.ivaPago)}</TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-muted/50 font-semibold">
                <TableCell>TOTAL</TableCell>
                <TableCell className="text-right">{formatEuro(dv.entradas)}</TableCell>
                <TableCell className="text-right">{formatEuro(dv.saidas)}</TableCell>
                <TableCell className={`text-right ${dv.resultado >= 0 ? 'text-success' : 'text-destructive'}`}>{formatEuro(dv.resultado)}</TableCell>
                <TableCell className="text-right">{formatEuro(dv.ivaCobrado)}</TableCell>
                <TableCell className="text-right">{formatEuro(dv.ivaPago)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-2"><Receipt className="h-3.5 w-3.5 text-warning" /><p className="text-xs text-muted-foreground">IVA — {selectedData.label}</p></div>
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div><p className="text-[10px] text-muted-foreground">Cobrado</p><p className="font-semibold">{formatEuro(dv.ivaCobrado)}</p></div>
              <div><p className="text-[10px] text-muted-foreground">Pago</p><p className="font-semibold">{formatEuro(dv.ivaPago)}</p></div>
              <div><p className="text-[10px] text-muted-foreground">Balanço</p><p className={`font-semibold ${dv.ivaBalanco > 0 ? 'text-warning' : dv.ivaBalanco < 0 ? 'text-success' : ''}`}>{formatEuro(dv.ivaBalanco)}</p></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-2"><Shield className="h-3.5 w-3.5 text-info" /><p className="text-xs text-muted-foreground">Segurança Social — {selectedData.label}</p></div>
            <p className="text-xl font-bold">{formatEuro(dv.ss)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PieCard title={<><Package className="h-3.5 w-3.5" /> Receita por Produto — {selectedData.label}</>} data={filteredProducts} />
        <PieCard title={<><ArrowUpRight className="h-3.5 w-3.5" /> Despesas por Categoria — {selectedData.label}</>} data={filteredCategories} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card><CardContent className="pt-4 pb-3"><p className="text-xs text-muted-foreground">Nº Vendas — {selectedData.label}</p><p className="text-xl font-bold">{selectedData.numSales}</p></CardContent></Card>
        <Card><CardContent className="pt-4 pb-3"><p className="text-xs text-muted-foreground">Clientes — {selectedData.label}</p><p className="text-xl font-bold">{selectedData.clients}</p></CardContent></Card>
      </div>
    </>
  );
}
