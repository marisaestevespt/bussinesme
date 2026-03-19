import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { Expense } from '@/hooks/useFinancialData';

const FULL = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const fmt = (v: number) => v.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

type Sale = { invoice_total: number; base_value: number; sale_month: number | null; sale_year: number | null };
interface Props { sales: Sale[]; expenses: Expense[]; currentYear: number; }

export function FinIVA({ sales, expenses, currentYear }: Props) {
  // IVA Cobrado (vendas)
  const ivaCobrado = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const ms = sales.filter(s => s.sale_year === currentYear && s.sale_month === m);
      const totalFatura = ms.reduce((s, v) => s + v.invoice_total, 0);
      const totalBase = ms.reduce((s, v) => s + v.base_value, 0);
      return { mes: FULL[i], totalFatura, totalBase, iva: Math.round((totalFatura - totalBase) * 100) / 100 };
    });
  }, [sales, currentYear]);

  // IVA Pago (despesas) by location
  const ivaPago = useMemo(() => {
    const locs = ['portugal', 'ue', 'fora_ue'] as const;
    return Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const me = expenses.filter(e => e.expense_year === currentYear && e.expense_month === m);
      const byLoc = locs.map(loc => {
        const le = me.filter(e => e.location === loc);
        const totalComIva = le.reduce((s, v) => s + v.total_with_vat, 0);
        const totalSemIva = le.reduce((s, v) => s + v.base_value, 0);
        return { loc, totalComIva, totalSemIva, iva: Math.round((totalComIva - totalSemIva) * 100) / 100 };
      });
      const totalIvaPago = byLoc.reduce((s, l) => s + l.iva, 0);
      return { mes: FULL[i], byLoc, totalIvaPago };
    });
  }, [expenses, currentYear]);

  // Balanço IVA
  const balanco = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const cobrado = ivaCobrado[i].iva;
      const pago = ivaPago[i].totalIvaPago;
      const bal = Math.round((cobrado - pago) * 100) / 100;
      return { mes: FULL[i], cobrado, pago, balanco: bal };
    });
  }, [ivaCobrado, ivaPago]);

  const locLabel = (l: string) => l === 'portugal' ? 'Portugal' : l === 'ue' ? 'União Europeia' : 'Fora da UE';

  return (
    <div className="space-y-8 mt-4">
      {/* IVA Cobrado */}
      <div>
        <h3 className="text-lg font-semibold mb-3">IVA Cobrado (Vendas)</h3>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mês</TableHead>
                  <TableHead className="text-right">Total Fatura</TableHead>
                  <TableHead className="text-right">Total Base</TableHead>
                  <TableHead className="text-right">IVA Cobrado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ivaCobrado.map((d, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{d.mes}</TableCell>
                    <TableCell className="text-right">{fmt(d.totalFatura)}</TableCell>
                    <TableCell className="text-right">{fmt(d.totalBase)}</TableCell>
                    <TableCell className="text-right font-medium">{fmt(d.iva)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* IVA Pago */}
      <div>
        <h3 className="text-lg font-semibold mb-3">IVA Pago (Despesas)</h3>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mês</TableHead>
                  <TableHead>Localização</TableHead>
                  <TableHead className="text-right">Total c/ IVA</TableHead>
                  <TableHead className="text-right">Total s/ IVA</TableHead>
                  <TableHead className="text-right">IVA Pago</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ivaPago.map((d, i) => (
                  d.byLoc.filter(l => l.totalComIva > 0).map((l, j) => (
                    <TableRow key={`${i}-${j}`}>
                      {j === 0 && <TableCell rowSpan={d.byLoc.filter(x => x.totalComIva > 0).length || 1} className="font-medium align-top">{d.mes}</TableCell>}
                      <TableCell>{locLabel(l.loc)}</TableCell>
                      <TableCell className="text-right">{fmt(l.totalComIva)}</TableCell>
                      <TableCell className="text-right">{fmt(l.totalSemIva)}</TableCell>
                      <TableCell className="text-right font-medium">{fmt(l.iva)}</TableCell>
                      <TableCell>
                        {(l.loc === 'ue' || l.loc === 'fora_ue') && <Badge variant="outline" className="bg-blue-100 text-blue-800 text-xs">Reverse Charge</Badge>}
                      </TableCell>
                    </TableRow>
                  ))
                ))}
                {ivaPago.every(d => d.byLoc.every(l => l.totalComIva === 0)) && (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Sem dados</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Balanço IVA */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Balanço de IVA</h3>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mês</TableHead>
                  <TableHead className="text-right">IVA Cobrado</TableHead>
                  <TableHead className="text-right">IVA Pago</TableHead>
                  <TableHead className="text-right">Balanço</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {balanco.map((d, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{d.mes}</TableCell>
                    <TableCell className="text-right">{fmt(d.cobrado)}</TableCell>
                    <TableCell className="text-right">{fmt(d.pago)}</TableCell>
                    <TableCell className={`text-right font-medium ${d.balanco >= 0 ? 'text-amber-600' : 'text-green-600'}`}>{fmt(d.balanco)}</TableCell>
                    <TableCell>
                      {d.balanco > 0 && <Badge variant="outline" className="bg-amber-100 text-amber-800 text-xs">A entregar</Badge>}
                      {d.balanco < 0 && <Badge variant="outline" className="bg-green-100 text-green-800 text-xs">A recuperar</Badge>}
                    </TableCell>
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
