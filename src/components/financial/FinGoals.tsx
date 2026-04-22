import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Save } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const fmt = (v: number) => v.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

interface Props {
  currentYear: number;
  yearSales: { invoice_total: number; sale_month: number | null }[];
  yearExpenses: { total_with_vat: number; expense_month: number | null }[];
}

export function FinGoals({ currentYear, yearSales, yearExpenses }: Props) {
  const qc = useQueryClient();

  const { data: goals = [] } = useQuery({
    queryKey: ['financial-goals', currentYear],
    queryFn: async () => {
      const { data } = await supabase
        .from('financial_goals')
        .select('*')
        .eq('year', currentYear)
        .order('month');
      return data || [];
    },
  });

  const [edits, setEdits] = useState<Record<number, { expense: string; profit: string }>>({});

  const save = useMutation({
    mutationFn: async (month: number) => {
      const e = edits[month];
      if (!e) return;
      const existing = goals.find((g: any) => g.month === month);
      const record = {
        year: currentYear,
        month,
        expense_target: parseFloat(e.expense) || 0,
        profit_target: parseFloat(e.profit) || 0,
      };
      if (existing) {
        await supabase.from('financial_goals').update(record).eq('id', (existing as any).id);
      } else {
        await supabase.from('financial_goals').insert(record);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['financial-goals', currentYear] });
      toast.success('Meta guardada');
    },
  });

  const getEdit = (month: number) => {
    if (edits[month]) return edits[month];
    const g = goals.find((g: any) => g.month === month);
    return {
      expense: g ? String((g as any).expense_target || 0) : '',
      profit: g ? String((g as any).profit_target || 0) : '',
    };
  };

  const setEdit = (month: number, field: string, value: string) => {
    setEdits(prev => ({
      ...prev,
      [month]: { ...getEdit(month), [field]: value },
    }));
  };

  // Actuals
  const actuals = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const revenue = sumRevenue(yearSales.filter(s => s.sale_month === m));
      const expense = yearExpenses.filter(e => e.expense_month === m).reduce((s, v) => s + v.total_with_vat, 0);
      return { month: m, revenue, expense, profit: revenue - expense };
    });
  }, [yearSales, yearExpenses]);

  const totalTargetExpense = goals.reduce((s: number, g: any) => s + ((g as any).expense_target || 0), 0);
  const totalTargetProfit = goals.reduce((s: number, g: any) => s + ((g as any).profit_target || 0), 0);
  const totalActualExpense = actuals.reduce((s, a) => s + a.expense, 0);
  const totalActualProfit = actuals.reduce((s, a) => s + a.profit, 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Meta Despesa Anual</p>
            <p className="text-lg font-bold">{fmt(totalTargetExpense)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Despesa Real</p>
            <p className="text-lg font-bold text-destructive">{fmt(totalActualExpense)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Meta Lucro Anual</p>
            <p className="text-lg font-bold">{fmt(totalTargetProfit)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Lucro Real</p>
            <p className={`text-lg font-bold ${totalActualProfit >= 0 ? 'text-success' : 'text-destructive'}`}>{fmt(totalActualProfit)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Metas Despesa & Lucro — {currentYear}</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mês</TableHead>
                <TableHead className="text-right">Receita Real</TableHead>
                <TableHead className="text-right">Meta Despesa</TableHead>
                <TableHead className="text-right">Despesa Real</TableHead>
                <TableHead className="text-right">Meta Lucro</TableHead>
                <TableHead className="text-right">Lucro Real</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {MONTHS.map((name, i) => {
                const m = i + 1;
                const edit = getEdit(m);
                const actual = actuals[i];
                return (
                  <TableRow key={m}>
                    <TableCell className="font-medium">{name}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{fmt(actual.revenue)}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        className="h-8 text-sm text-right w-28"
                        value={edit.expense}
                        onChange={e => setEdit(m, 'expense', e.target.value)}
                        placeholder="0"
                      />
                    </TableCell>
                    <TableCell className="text-right text-destructive">{fmt(actual.expense)}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        className="h-8 text-sm text-right w-28"
                        value={edit.profit}
                        onChange={e => setEdit(m, 'profit', e.target.value)}
                        placeholder="0"
                      />
                    </TableCell>
                    <TableCell className={`text-right font-medium ${actual.profit >= 0 ? 'text-success' : 'text-destructive'}`}>
                      {fmt(actual.profit)}
                    </TableCell>
                    <TableCell>
                      {edits[m] && (
                        <Button size="sm" variant="ghost" onClick={() => save.mutate(m)}>
                          <Save className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}