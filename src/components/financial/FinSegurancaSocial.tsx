import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Save } from 'lucide-react';
import { toast } from 'sonner';
import type { useFinancialData } from '@/hooks/useFinancialData';
import type { Expense } from '@/hooks/useFinancialData';

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

const fmt = (v: number) => v.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

interface Props {
  fin: ReturnType<typeof useFinancialData>;
  expenses: Expense[];
  currentYear: number;
}

export function FinSegurancaSocial({ fin, expenses, currentYear }: Props) {
  const ssExpenses = useMemo(() =>
    expenses.filter(e => e.category === 'seguranca_social' && e.expense_year === currentYear),
    [expenses, currentYear]
  );

  const [editValues, setEditValues] = useState<Record<number, string>>({});

  const monthlyData = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const entry = ssExpenses.find(e => e.expense_month === m);
      return { month: m, label: MONTHS[i], value: entry?.total_with_vat ?? 0, entry };
    });
  }, [ssExpenses]);

  const totalPago = monthlyData.reduce((s, d) => s + d.value, 0);
  const mesesPagos = monthlyData.filter(d => d.value > 0).length;

  const handleSave = async (m: number) => {
    const val = parseFloat(editValues[m] || '0') || 0;
    const existing = monthlyData.find(d => d.month === m)?.entry;
    const dateStr = `${currentYear}-${String(m).padStart(2, '0')}-15`;

    if (existing) {
      await fin.upsertExpense.mutateAsync({
        id: existing.id,
        total_with_vat: val,
        base_value: val,
        description: `Segurança Social — ${MONTHS[m - 1]} ${currentYear}`,
      } as any);
    } else if (val > 0) {
      await fin.upsertExpense.mutateAsync({
        description: `Segurança Social — ${MONTHS[m - 1]} ${currentYear}`,
        category: 'seguranca_social',
        base_value: val,
        vat_rate: 0,
        total_with_vat: val,
        location: 'portugal',
        expense_date: dateStr,
        expense_month: m,
        expense_quarter: Math.ceil(m / 3),
        expense_year: currentYear,
        status: 'pago',
      } as any);
    }
    setEditValues(prev => { const n = { ...prev }; delete n[m]; return n; });
    toast.success(`SS de ${MONTHS[m - 1]} guardada`);
  };

  return (
    <div className="space-y-6 mt-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Total Pago ({currentYear})</p><p className="text-lg font-bold">{fmt(totalPago)}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Meses Pagos</p><p className="text-lg font-bold">{mesesPagos} / 12</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Média Mensal</p><p className="text-lg font-bold">{fmt(mesesPagos > 0 ? totalPago / mesesPagos : 0)}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Segurança Social — Trabalhador Independente — {currentYear}</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mês</TableHead>
                <TableHead className="text-right">Valor Pago</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-[200px]">Editar</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {monthlyData.map(d => (
                <TableRow key={d.month}>
                  <TableCell className="font-medium">{String(d.month).padStart(2, '0')} {d.label}</TableCell>
                  <TableCell className="text-right">{d.value > 0 ? fmt(d.value) : '—'}</TableCell>
                  <TableCell>
                    {d.value > 0
                      ? <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Pago</Badge>
                      : <Badge variant="outline" className="text-muted-foreground">Pendente</Badge>
                    }
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      placeholder={d.value > 0 ? String(d.value) : '0.00'}
                      value={editValues[d.month] ?? ''}
                      onChange={e => setEditValues(prev => ({ ...prev, [d.month]: e.target.value }))}
                      className="h-8 text-sm"
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleSave(d.month)}
                      disabled={!(d.month in editValues) || editValues[d.month] === ''}
                    >
                      <Save className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="border-t-2 font-semibold">
                <TableCell>Total</TableCell>
                <TableCell className="text-right">{fmt(totalPago)}</TableCell>
                <TableCell colSpan={3} />
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
