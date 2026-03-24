import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  na: { label: 'N.A.', cls: 'bg-muted text-muted-foreground' },
  aguarda_pagamento: { label: 'Aguarda Pagamento', cls: 'bg-orange-100 text-orange-800' },
  em_atraso: { label: 'Em Atraso', cls: 'bg-red-100 text-red-800' },
  fatura_emitida: { label: 'Fatura Emitida', cls: 'bg-blue-100 text-blue-800' },
  pagamento_ok: { label: 'Pagamento OK', cls: 'bg-green-100 text-green-800' },
  recibo_enviado: { label: 'Recibo Enviado', cls: 'bg-emerald-100 text-emerald-800' },
  contabilidade_ok: { label: 'Contabilidade OK', cls: 'bg-teal-100 text-teal-800' },
};

type Sale = {
  id: string; sale_id: string; status: string; payment_date: string | null;
  description: string | null; base_value: number; invoice_total: number;
  product: string | null; client: string | null; source: string | null;
  sale_month: number | null; sale_quarter: number | null; sale_year: number | null;
};

interface Props { sales: Sale[]; currentYear: number; }

type Filter = 'all' | 'month' | 'quarter' | 'year';

export function FinEntradas({ sales, currentYear }: Props) {
  const [filter, setFilter] = useState<Filter>('year');
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
              ) : filtered.map(s => (
                <TableRow key={s.id}>
                  <TableCell><Badge variant="outline" className={STATUS_BADGE[s.status]?.cls || ''}>{STATUS_BADGE[s.status]?.label || s.status}</Badge></TableCell>
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
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
