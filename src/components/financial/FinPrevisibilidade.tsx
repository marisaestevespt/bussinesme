import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { parseISO } from 'date-fns';
import type { useFinancialData } from '@/hooks/useFinancialData';

const FULL = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const fmt = (v: number) => v.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

type Sale = {
  sale_month: number | null;
  sale_year: number | null;
  invoice_total: number;
};

interface Props {
  fin: ReturnType<typeof useFinancialData>;
  currentYear: number;
  sales: Sale[];
}

export function FinPrevisibilidade({ fin, currentYear, sales }: Props) {
  const subscriptions = fin.subscriptions.data || [];
  const payrollData = fin.payroll.data || [];
  const contractorsData = fin.contractors.data || [];

  const activeSubs = subscriptions.filter(s => s.status === 'ativo');
  const totalMonthly = activeSubs.reduce((s, sub) => s + sub.monthly_equivalent, 0);

  // Calculate average monthly revenue from past months of the current year
  const now = new Date();
  const currentMonth = now.getFullYear() === currentYear ? now.getMonth() + 1 : 12;

  const predictability = useMemo(() => {
    // Revenue per month from actual sales
    const revenueByMonth: Record<number, number> = {};
    sales.filter(s => s.sale_year === currentYear).forEach(s => {
      if (s.sale_month) {
        revenueByMonth[s.sale_month] = (revenueByMonth[s.sale_month] || 0) + s.invoice_total;
      }
    });

    // Average of past months for future prediction
    const pastMonths = Object.entries(revenueByMonth).filter(([m]) => parseInt(m) <= currentMonth);
    const avgRevenue = pastMonths.length > 0
      ? pastMonths.reduce((s, [, v]) => s + v, 0) / pastMonths.length
      : 0;

    return Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const subsTotal = totalMonthly;
      const pessoal = payrollData.filter(p => p.year === currentYear && p.month === m).reduce((s, v) => s + v.total_cost, 0);
      const prest = contractorsData.filter(c => c.year === currentYear && c.month === m).reduce((s, v) => s + v.value, 0);
      const totalSaidas = Math.round((subsTotal + pessoal + prest) * 100) / 100;

      // Use actual revenue for past/current months, average for future
      const isPast = m <= currentMonth && now.getFullYear() === currentYear;
      const entradas = isPast ? (revenueByMonth[m] || 0) : Math.round(avgRevenue * 100) / 100;
      const balanco = Math.round((entradas - totalSaidas) * 100) / 100;

      const renewals = subscriptions.filter(s => {
        if (!s.renewal_date || s.status !== 'ativo') return false;
        const rd = parseISO(s.renewal_date);
        return rd.getMonth() + 1 === m;
      });

      return { mes: FULL[i], entradas, subs: subsTotal, pessoal, prestadores: prest, totalSaidas, balanco, renewals, isPast };
    });
  }, [totalMonthly, payrollData, contractorsData, subscriptions, currentYear, sales, currentMonth]);

  const totals = useMemo(() => {
    return predictability.reduce((acc, p) => ({
      entradas: acc.entradas + p.entradas,
      saidas: acc.saidas + p.totalSaidas,
      balanco: acc.balanco + p.balanco,
    }), { entradas: 0, saidas: 0, balanco: 0 });
  }, [predictability]);

  return (
    <div className="space-y-6 mt-4">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Entradas Previstas (Ano)</p><p className="text-lg font-bold text-green-600">{fmt(totals.entradas)}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Saídas Previstas (Ano)</p><p className="text-lg font-bold text-red-600">{fmt(totals.saidas)}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Balanço Previsto (Ano)</p><p className={`text-lg font-bold ${totals.balanco >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmt(totals.balanco)}</p></CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mês</TableHead>
                <TableHead className="text-right">Entradas (€)</TableHead>
                <TableHead className="text-right">Subscrições (€)</TableHead>
                <TableHead className="text-right">Pessoal (€)</TableHead>
                <TableHead className="text-right">Prestadores (€)</TableHead>
                <TableHead className="text-right">Total Saídas (€)</TableHead>
                <TableHead className="text-right">Balanço (€)</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {predictability.map((p, i) => (
                <TableRow key={i} className={!p.isPast ? 'opacity-70' : ''}>
                  <TableCell className="font-medium">{p.mes}</TableCell>
                  <TableCell className="text-right text-green-600">
                    {fmt(p.entradas)}
                    {!p.isPast && <span className="text-[10px] text-muted-foreground ml-1">(est.)</span>}
                  </TableCell>
                  <TableCell className="text-right">{fmt(p.subs)}</TableCell>
                  <TableCell className="text-right">{fmt(p.pessoal)}</TableCell>
                  <TableCell className="text-right">{fmt(p.prestadores)}</TableCell>
                  <TableCell className="text-right font-medium text-red-600">{fmt(p.totalSaidas)}</TableCell>
                  <TableCell className={`text-right font-bold ${p.balanco >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmt(p.balanco)}</TableCell>
                  <TableCell>
                    {p.renewals.length > 0 && <Badge variant="outline" className="bg-amber-100 text-amber-800 text-xs">{p.renewals.length} renovação(ões)</Badge>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
