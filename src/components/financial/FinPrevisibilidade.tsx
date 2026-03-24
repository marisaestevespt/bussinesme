import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { parseISO } from 'date-fns';
import type { useFinancialData } from '@/hooks/useFinancialData';

const FULL = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const fmt = (v: number) => v.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

interface Props {
  fin: ReturnType<typeof useFinancialData>;
  currentYear: number;
}

export function FinPrevisibilidade({ fin, currentYear }: Props) {
  const subscriptions = fin.subscriptions.data || [];
  const payrollData = fin.payroll.data || [];
  const contractorsData = fin.contractors.data || [];

  const activeSubs = subscriptions.filter(s => s.status === 'ativo');
  const totalMonthly = activeSubs.reduce((s, sub) => s + sub.monthly_equivalent, 0);

  const predictability = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const subsTotal = totalMonthly;
      const pessoal = payrollData.filter(p => p.year === currentYear && p.month === m).reduce((s, v) => s + v.total_cost, 0);
      const prest = contractorsData.filter(c => c.year === currentYear && c.month === m).reduce((s, v) => s + v.value, 0);
      const renewals = subscriptions.filter(s => {
        if (!s.renewal_date || s.status !== 'ativo') return false;
        const rd = parseISO(s.renewal_date);
        return rd.getMonth() + 1 === m;
      });
      return { mes: FULL[i], subs: subsTotal, pessoal, prestadores: prest, total: Math.round((subsTotal + pessoal + prest) * 100) / 100, renewals };
    });
  }, [totalMonthly, payrollData, contractorsData, subscriptions, currentYear]);

  return (
    <div className="space-y-6 mt-4">
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mês</TableHead>
                <TableHead className="text-right">Subscrições (€)</TableHead>
                <TableHead className="text-right">Pessoal Fixo (€)</TableHead>
                <TableHead className="text-right">Prestadores (€)</TableHead>
                <TableHead className="text-right">Total Previsto (€)</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {predictability.map((p, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{p.mes}</TableCell>
                  <TableCell className="text-right">{fmt(p.subs)}</TableCell>
                  <TableCell className="text-right">{fmt(p.pessoal)}</TableCell>
                  <TableCell className="text-right">{fmt(p.prestadores)}</TableCell>
                  <TableCell className="text-right font-medium">{fmt(p.total)}</TableCell>
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
