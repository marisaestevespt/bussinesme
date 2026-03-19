import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { Expense } from '@/hooks/useFinancialData';

const FULL = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const fmt = (v: number) => v.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

type Sale = { invoice_total: number; sale_month: number | null; sale_year: number | null };

interface Props { sales: Sale[]; expenses: Expense[]; currentYear: number; }

export function FinBalanco({ sales, expenses, currentYear }: Props) {
  const monthly = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const entradas = sales.filter(s => s.sale_year === currentYear && s.sale_month === m).reduce((s, v) => s + v.invoice_total, 0);
      const saidas = expenses.filter(e => e.expense_year === currentYear && e.expense_month === m).reduce((s, v) => s + v.total_with_vat, 0);
      const resultado = entradas - saidas;
      const margem = entradas > 0 ? Math.round(resultado / entradas * 10000) / 100 : 0;
      return { mes: FULL[i], trimestre: `T${Math.ceil(m / 3)}`, entradas, saidas, resultado, margem };
    });
  }, [sales, expenses, currentYear]);

  const quarterly = useMemo(() => {
    return [1, 2, 3, 4].map(q => {
      const months = monthly.slice((q - 1) * 3, q * 3);
      const entradas = months.reduce((s, m) => s + m.entradas, 0);
      const saidas = months.reduce((s, m) => s + m.saidas, 0);
      const resultado = entradas - saidas;
      const margem = entradas > 0 ? Math.round(resultado / entradas * 10000) / 100 : 0;
      const startMonth = FULL[(q - 1) * 3];
      const endMonth = FULL[q * 3 - 1];
      return { trimestre: `T${q}`, intervalo: `${startMonth} — ${endMonth}`, entradas, saidas, resultado, margem };
    });
  }, [monthly]);

  return (
    <div className="space-y-6 mt-4">
      <div>
        <h3 className="text-lg font-semibold mb-3">Por Mês</h3>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mês</TableHead>
                  <TableHead>Trimestre</TableHead>
                  <TableHead className="text-right">Total Entradas</TableHead>
                  <TableHead className="text-right">Total Saídas</TableHead>
                  <TableHead className="text-right">Resultado Líquido</TableHead>
                  <TableHead className="text-right">Margem (%)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {monthly.map((d, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{d.mes}</TableCell>
                    <TableCell>{d.trimestre}</TableCell>
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
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-3">Por Trimestre</h3>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Trimestre</TableHead>
                  <TableHead>Intervalo</TableHead>
                  <TableHead className="text-right">Total Entradas</TableHead>
                  <TableHead className="text-right">Total Saídas</TableHead>
                  <TableHead className="text-right">Resultado Líquido</TableHead>
                  <TableHead className="text-right">Margem (%)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quarterly.map((q, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{q.trimestre}</TableCell>
                    <TableCell className="text-muted-foreground">{q.intervalo}</TableCell>
                    <TableCell className="text-right">{fmt(q.entradas)}</TableCell>
                    <TableCell className="text-right">{fmt(q.saidas)}</TableCell>
                    <TableCell className={`text-right font-medium ${q.resultado >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmt(q.resultado)}</TableCell>
                    <TableCell className="text-right">{q.margem}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
