import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { calcMonthlyEquivalent, type Expense, type Subscription, type PayrollEntry, type ContractorEntry } from '@/hooks/useFinancialData';

const ML = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const FULL = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

type Sale = { invoice_total: number; sale_month: number | null; sale_year: number | null };

interface Props {
  sales: Sale[];
  expenses: Expense[];
  subscriptions: Subscription[];
  payrollData: PayrollEntry[];
  contractorsData: ContractorEntry[];
  currentYear: number;
}

export function FinOverview({ sales, expenses, subscriptions, payrollData, contractorsData, currentYear }: Props) {
  const monthlyData = useMemo(() => {
    const activeSubs = subscriptions.filter(s => s.status === 'ativo');
    const totalSubsMonthly = activeSubs.reduce((s, sub) => s + sub.monthly_equivalent, 0);

    return Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const entradas = sales.filter(s => s.sale_year === currentYear && s.sale_month === m).reduce((s, v) => s + v.invoice_total, 0);
      const saidas = expenses.filter(e => e.expense_year === currentYear && e.expense_month === m).reduce((s, v) => s + v.total_with_vat, 0);
      const resultado = entradas - saidas;
      const margem = entradas > 0 ? Math.round(resultado / entradas * 10000) / 100 : 0;

      const pessoalFixo = payrollData.filter(p => p.year === currentYear && p.month === m).reduce((s, v) => s + v.total_cost, 0);
      const prestadores = contractorsData.filter(c => c.year === currentYear && c.month === m).reduce((s, v) => s + v.value, 0);
      const saidasPrevistas = Math.round((totalSubsMonthly + pessoalFixo + prestadores) * 100) / 100;

      return { mes: FULL[i], mesShort: ML[i], entradas, saidas, resultado, margem, saidasPrevistas };
    });
  }, [sales, expenses, subscriptions, payrollData, contractorsData, currentYear]);

  const totalEntradas = monthlyData.reduce((s, d) => s + d.entradas, 0);
  const totalSaidas = monthlyData.reduce((s, d) => s + d.saidas, 0);
  const resultado = totalEntradas - totalSaidas;
  const margem = totalEntradas > 0 ? Math.round(resultado / totalEntradas * 10000) / 100 : 0;

  const fmt = (v: number) => v.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

  return (
    <div className="space-y-6 mt-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Total Entradas</p><p className="text-xl font-bold text-green-600">{fmt(totalEntradas)}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Total Saídas</p><p className="text-xl font-bold text-red-600">{fmt(totalSaidas)}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Resultado Líquido</p><p className={`text-xl font-bold ${resultado >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmt(resultado)}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Margem de Lucro</p><p className={`text-xl font-bold ${margem >= 0 ? 'text-green-600' : 'text-red-600'}`}>{margem}%</p></CardContent></Card>
      </div>

      {/* Monthly table */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Resumo Mensal — {currentYear}</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mês</TableHead>
                <TableHead className="text-right">Entradas</TableHead>
                <TableHead className="text-right">Saídas</TableHead>
                <TableHead className="text-right">Resultado</TableHead>
                <TableHead className="text-right">Margem</TableHead>
                <TableHead className="text-right">Saídas Previstas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {monthlyData.map((d, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{d.mes}</TableCell>
                  <TableCell className="text-right">{fmt(d.entradas)}</TableCell>
                  <TableCell className="text-right">{fmt(d.saidas)}</TableCell>
                  <TableCell className={`text-right font-medium ${d.resultado >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmt(d.resultado)}</TableCell>
                  <TableCell className="text-right">{d.margem}%</TableCell>
                  <TableCell className="text-right text-muted-foreground">{fmt(d.saidasPrevistas)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Entradas vs Saídas</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mesShort" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Legend />
                <Bar dataKey="entradas" name="Entradas" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                <Bar dataKey="saidas" name="Saídas" fill="hsl(var(--destructive))" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Margem de Lucro (%)</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mesShort" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} unit="%" />
                <Tooltip formatter={(v: number) => `${v}%`} />
                <Line type="monotone" dataKey="margem" name="Margem" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
