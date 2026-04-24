import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Receipt } from 'lucide-react';
import { EntryStatusSelect } from '../InlineStatusSelect';
import { formatEuro } from '@/lib/formatting';
import { MONTHS, type Sale } from './helpers';

interface EntradasTableProps {
  monthSales: (Sale & { id?: string; sale_id?: string | null; payment_date?: string | null; documents?: unknown; })[];
  totalBaseEntradas: number;
  totalEntradas: number;
  onAddSale: () => void;
  onSelectSale: (sale: Sale & { id?: string }) => void;
  onShowIvaCobrado?: () => void;
}

export function EntradasTable({ monthSales, totalBaseEntradas, totalEntradas, onAddSale, onSelectSale, onShowIvaCobrado }: EntradasTableProps) {
  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm">Entradas</CardTitle>
        <div className="flex items-center gap-2">
          {onShowIvaCobrado && (
            <Button size="sm" variant="outline" onClick={onShowIvaCobrado}><Receipt className="h-3.5 w-3.5 mr-1" /> Ver IVA</Button>
          )}
          <Button size="sm" variant="outline" onClick={onAddSale}><Plus className="h-3.5 w-3.5 mr-1" /> Nova Entrada</Button>
        </div>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader><TableRow><TableHead>Status</TableHead><TableHead>Data Pgto.</TableHead><TableHead className="whitespace-nowrap">ID</TableHead><TableHead>Descrição</TableHead><TableHead>Cliente</TableHead><TableHead className="text-right whitespace-nowrap">Base (€)</TableHead><TableHead className="text-right whitespace-nowrap">Fatura Total</TableHead><TableHead>Ficheiros</TableHead></TableRow></TableHeader>
          <TableBody>
            {monthSales.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">Sem entradas</TableCell></TableRow>
            ) : monthSales.map((s, i) => {
              const docs = Array.isArray(s.documents) ? s.documents : [];
              return (
                <TableRow key={i} className="cursor-pointer hover:bg-muted/50" onClick={() => onSelectSale(s)}>
                  <TableCell onClick={e => e.stopPropagation()}><EntryStatusSelect saleId={s.id} currentStatus={s.status || 'aguarda_pagamento'} paymentDate={s.payment_date} hasDocuments={docs.length > 0} /></TableCell>
                  <TableCell className="whitespace-nowrap">{s.payment_date || '—'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{s.sale_id || '—'}</TableCell>
                  <TableCell>{s.description || '—'}</TableCell>
                  <TableCell>{s.client || '—'}</TableCell>
                  <TableCell className="text-right">{formatEuro(s.base_value)}</TableCell>
                  <TableCell className="text-right">{formatEuro(s.invoice_total)}</TableCell>
                  <TableCell>{docs.length > 0 ? <Badge variant="outline" className="text-xs">{docs.length} ficheiro{docs.length > 1 ? 's' : ''}</Badge> : <span className="text-muted-foreground text-xs">—</span>}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
          {monthSales.length > 0 && (
            <tfoot>
              <TableRow className="border-t-2 bg-muted/40 font-semibold hover:bg-muted/40">
                <TableCell colSpan={5} className="text-right">Total</TableCell>
                <TableCell className="text-right">{formatEuro(totalBaseEntradas)}</TableCell>
                <TableCell className="text-right">{formatEuro(totalEntradas)}</TableCell>
                <TableCell />
              </TableRow>
            </tfoot>
          )}
        </Table>
      </CardContent>
    </Card>
  );
}

export function IvaCobradoDialog({ open, onOpenChange, monthSales, month, totalEntradas, totalBaseEntradas, ivaCobrado }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  monthSales: Sale[];
  month: number;
  totalEntradas: number;
  totalBaseEntradas: number;
  ivaCobrado: number;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle className="text-base">IVA Cobrado — {MONTHS[month - 1]}</DialogTitle></DialogHeader>
        {monthSales.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">Sem vendas registadas neste mês.</p>
        ) : (
          <Table>
            <TableHeader><TableRow><TableHead>Venda</TableHead><TableHead className="text-right">Total Fatura</TableHead><TableHead className="text-right">Base</TableHead><TableHead className="text-right">IVA</TableHead></TableRow></TableHeader>
            <TableBody>
              {monthSales.map((s, idx) => {
                const iva = Math.round((s.invoice_total - s.base_value) * 100) / 100;
                return (
                  <TableRow key={idx}>
                    <TableCell className="text-sm">{s.client || s.product || `Venda ${idx + 1}`}</TableCell>
                    <TableCell className="text-right text-sm">{formatEuro(s.invoice_total)}</TableCell>
                    <TableCell className="text-right text-sm">{formatEuro(s.base_value)}</TableCell>
                    <TableCell className="text-right text-sm font-medium">{formatEuro(iva)}</TableCell>
                  </TableRow>
                );
              })}
              <TableRow className="border-t-2 font-semibold">
                <TableCell>Total</TableCell>
                <TableCell className="text-right">{formatEuro(totalEntradas)}</TableCell>
                <TableCell className="text-right">{formatEuro(totalBaseEntradas)}</TableCell>
                <TableCell className="text-right">{formatEuro(ivaCobrado)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
}