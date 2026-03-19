import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { useFinancialData } from '@/hooks/useFinancialData';

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

const fmt = (v: number) => v.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

interface Props {
  fin: ReturnType<typeof useFinancialData>;
  profiles: { id: string; full_name: string | null }[];
}

export function FinSegurancaSocial({ fin, profiles }: Props) {
  const currentYear = new Date().getFullYear();
  const payrollData = fin.payroll.data || [];

  const monthlyData = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const entries = payrollData.filter(p => p.year === currentYear && p.month === m);
      const ssEmployee = entries.reduce((s, v) => s + v.ss_employee, 0);
      const ssEmployer = entries.reduce((s, v) => s + v.ss_employer, 0);
      const withholding = entries.reduce((s, v) => s + v.withholding_value, 0);
      return {
        month: MONTHS[i],
        collaborators: entries.length,
        ssEmployee,
        ssEmployer,
        totalSS: ssEmployee + ssEmployer,
        withholding,
        total: ssEmployee + ssEmployer + withholding,
      };
    });
  }, [payrollData, currentYear]);

  const totals = useMemo(() => ({
    ssEmployee: monthlyData.reduce((s, d) => s + d.ssEmployee, 0),
    ssEmployer: monthlyData.reduce((s, d) => s + d.ssEmployer, 0),
    totalSS: monthlyData.reduce((s, d) => s + d.totalSS, 0),
    withholding: monthlyData.reduce((s, d) => s + d.withholding, 0),
    total: monthlyData.reduce((s, d) => s + d.total, 0),
  }), [monthlyData]);

  return (
    <div className="space-y-6 mt-4">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">SS Colaborador (11%)</p><p className="text-lg font-bold">{fmt(totals.ssEmployee)}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">SS Entidade (23,75%)</p><p className="text-lg font-bold">{fmt(totals.ssEmployer)}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Retenção na Fonte</p><p className="text-lg font-bold">{fmt(totals.withholding)}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Total Obrigações</p><p className="text-lg font-bold">{fmt(totals.total)}</p></CardContent></Card>
      </div>

      {/* Monthly breakdown */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Obrigações Mensais — {currentYear}</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mês</TableHead>
                <TableHead className="text-right">Colaboradores</TableHead>
                <TableHead className="text-right">SS Colaborador</TableHead>
                <TableHead className="text-right">SS Entidade</TableHead>
                <TableHead className="text-right">Total SS</TableHead>
                <TableHead className="text-right">Retenção</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {monthlyData.map((d, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{d.month}</TableCell>
                  <TableCell className="text-right">{d.collaborators || '—'}</TableCell>
                  <TableCell className="text-right">{d.ssEmployee > 0 ? fmt(d.ssEmployee) : '—'}</TableCell>
                  <TableCell className="text-right">{d.ssEmployer > 0 ? fmt(d.ssEmployer) : '—'}</TableCell>
                  <TableCell className="text-right">{d.totalSS > 0 ? fmt(d.totalSS) : '—'}</TableCell>
                  <TableCell className="text-right">{d.withholding > 0 ? fmt(d.withholding) : '—'}</TableCell>
                  <TableCell className="text-right font-medium">{d.total > 0 ? fmt(d.total) : '—'}</TableCell>
                </TableRow>
              ))}
              <TableRow className="border-t-2 font-semibold">
                <TableCell>Total</TableCell>
                <TableCell className="text-right" />
                <TableCell className="text-right">{fmt(totals.ssEmployee)}</TableCell>
                <TableCell className="text-right">{fmt(totals.ssEmployer)}</TableCell>
                <TableCell className="text-right">{fmt(totals.totalSS)}</TableCell>
                <TableCell className="text-right">{fmt(totals.withholding)}</TableCell>
                <TableCell className="text-right">{fmt(totals.total)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
