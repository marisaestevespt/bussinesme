import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { Expense } from '@/hooks/useFinancialData';

const QUARTERS = [
  { label: 'T1', range: 'Jan — Mar', months: [1, 2, 3] },
  { label: 'T2', range: 'Abr — Jun', months: [4, 5, 6] },
  { label: 'T3', range: 'Jul — Set', months: [7, 8, 9] },
  { label: 'T4', range: 'Out — Dez', months: [10, 11, 12] },
];

type Sale = { invoice_total: number; sale_month: number | null; sale_year: number | null };

interface Props {
  sales: Sale[];
  expenses: Expense[];
  currentYear: number;
}

const fmt = (v: number) => v.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

export function FinTrimestral({ sales, expenses, currentYear }: Props) {
  const data = useMemo(() => {
    return QUARTERS.map(q => {
      const ent = sales.filter(s => s.sale_year === currentYear && q.months.includes(s.sale_month || 0)).reduce((s, v) => s + v.invoice_total, 0);
      const sai = expenses.filter(e => e.expense_year === currentYear && q.months.includes(e.expense_month || 0)).reduce((s, v) => s + v.total_with_vat, 0);
      const resultado = ent - sai;
      const margem = ent > 0 ? Math.round(resultado / ent * 10000) / 100 : 0;
      return { label: q.label, range: q.range, entradas: ent, saidas: sai, resultado, margem };
    });
  }, [sales, expenses, currentYear]);

  return (
    <div className="space-y-6 mt-4">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Balanço Trimestral — {currentYear}</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Trimestre</TableHead>
                <TableHead>Período</TableHead>
                <TableHead className="text-right">Entradas</TableHead>
                <TableHead className="text-right">Saídas</TableHead>
                <TableHead className="text-right">Resultado</TableHead>
                <TableHead className="text-right">Margem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map(d => (
                <TableRow key={d.label}>
                  <TableCell className="font-medium">{d.label}</TableCell>
                  <TableCell className="text-muted-foreground">{d.range}</TableCell>
                  <TableCell className="text-right">{fmt(d.entradas)}</TableCell>
                  <TableCell className="text-right">{fmt(d.saidas)}</TableCell>
                  <TableCell className={`text-right font-medium ${d.resultado >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmt(d.resultado)}</TableCell>
                  <TableCell className="text-right">{d.margem}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Entradas vs Saídas por Trimestre</CardTitle></CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => fmt(v)} />
              <Legend />
              <Bar dataKey="entradas" name="Entradas" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
              <Bar dataKey="saidas" name="Saídas" fill="hsl(var(--destructive))" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
