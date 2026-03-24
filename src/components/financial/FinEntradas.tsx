import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EntryDetailSheet, getEntryStatusBadge } from './EntryDetailSheet';

type Sale = {
  id: string; sale_id: string; status: string; payment_date: string | null;
  description: string | null; base_value: number; invoice_total: number;
  product: string | null; client: string | null; source: string | null;
  sale_month: number | null; sale_quarter: number | null; sale_year: number | null;
  documents?: any;
};

interface Props { sales: Sale[]; currentYear: number; }

type Filter = 'all' | 'month' | 'quarter' | 'year';

export function FinEntradas({ sales, currentYear }: Props) {
  const [filter, setFilter] = useState<Filter>('year');
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentQuarter = Math.ceil(currentMonth / 3);

  const filtered = useMemo(() => {
    return sales.filter(s => {
      if (filter === 'all') return true;
      if (filter === 'year') return s.sale_year === currentYear;
      if (filter === 'quarter') return s.sale_year === currentYear && s.sale_quarter === currentQuarter;
      if (filter === 'month') return s.sale_year === currentYear && s.sale_month === currentMonth;
      return true;
    });
  }, [sales, filter, currentYear, currentMonth, currentQuarter]);

  const totalBase = filtered.reduce((s, v) => s + v.base_value, 0);
  const totalInvoice = filtered.reduce((s, v) => s + v.invoice_total, 0);
  const fmt = (v: number) => v.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

  const openDetail = (sale: Sale) => {
    setSelectedSale(sale);
    setSheetOpen(true);
  };

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center gap-2 flex-wrap">
        {([['all', 'Todos'], ['month', 'Este mês'], ['quarter', 'Este trimestre'], ['year', 'Este ano']] as const).map(([k, l]) => (
          <Button key={k} variant={filter === k ? 'default' : 'outline'} size="sm" onClick={() => setFilter(k)}>{l}</Button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Total Valor Base</p><p className="text-lg font-bold">{fmt(totalBase)}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Total Fatura</p><p className="text-lg font-bold">{fmt(totalInvoice)}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Registos</p><p className="text-lg font-bold">{filtered.length}</p></CardContent></Card>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>ID</TableHead>
                <TableHead>Data Pgto.</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="text-right">Valor Base</TableHead>
                <TableHead className="text-right">Fatura Total</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Fonte</TableHead>
                <TableHead>Mês</TableHead>
                <TableHead>Trim.</TableHead>
                <TableHead>Ano</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={12} className="text-center text-muted-foreground py-8">Sem entradas</TableCell></TableRow>
              ) : filtered.map(s => {
                const sb = getEntryStatusBadge(s.status);
                return (
                  <TableRow key={s.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openDetail(s)}>
                    <TableCell><Badge variant="outline" className={sb.cls}>{sb.label}</Badge></TableCell>
                    <TableCell className="font-mono text-xs">{s.sale_id}</TableCell>
                    <TableCell>{s.payment_date || '—'}</TableCell>
                    <TableCell className="truncate max-w-[200px]">{s.description || '—'}</TableCell>
                    <TableCell className="text-right">{fmt(s.base_value)}</TableCell>
                    <TableCell className="text-right font-medium">{fmt(s.invoice_total)}</TableCell>
                    <TableCell>{s.product || '—'}</TableCell>
                    <TableCell>{s.client || '—'}</TableCell>
                    <TableCell>{s.source || '—'}</TableCell>
                    <TableCell>{s.sale_month || '—'}</TableCell>
                    <TableCell>T{s.sale_quarter || '—'}</TableCell>
                    <TableCell>{s.sale_year || '—'}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <EntryDetailSheet sale={selectedSale} open={sheetOpen} onOpenChange={setSheetOpen} />
    </div>
  );
}
