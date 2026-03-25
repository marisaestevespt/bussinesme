import { useMemo, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { Expense } from '@/hooks/useFinancialData';
import type { useFinancialData } from '@/hooks/useFinancialData';
import { FinDocumentsUpload, type FinDocItem } from './FinDocumentsUpload';

const FULL = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const fmt = (v: number) => v.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

type Sale = { invoice_total: number; base_value: number; sale_month: number | null; sale_year: number | null; client?: string | null; product?: string | null; sale_id?: string };
interface Props { sales: Sale[]; expenses: Expense[]; currentYear: number; fin: ReturnType<typeof useFinancialData>; }

export function FinIVA({ sales, expenses, currentYear, fin }: Props) {
  const [cobradoMonth, setCobradoMonth] = useState<number | null>(null);
  const [pagoMonth, setPagoMonth] = useState<number | null>(null);

  // IVA documents
  const ivaDoc = useMemo(() => {
    const doc = (fin.documents.data || []).find(d => d.doc_type === 'iva_declarations' && d.period_year === currentYear);
    return doc;
  }, [fin.documents.data, currentYear]);

  const ivaDocuments: FinDocItem[] = useMemo(() => {
    if (!ivaDoc?.notes) return [];
    try { return JSON.parse(ivaDoc.notes); } catch { return []; }
  }, [ivaDoc]);

  const handleDocsUpdate = useCallback(async (docs: FinDocItem[]) => {
    await fin.upsertDocument.mutateAsync({
      ...(ivaDoc ? { id: ivaDoc.id } : {}),
      title: `Declarações IVA ${currentYear}`,
      doc_type: 'iva_declarations',
      period_year: currentYear,
      notes: JSON.stringify(docs),
      status: 'ativo',
    });
  }, [ivaDoc, currentYear, fin]);

  // IVA Cobrado (vendas)
  const ivaCobrado = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const ms = sales.filter(s => s.sale_year === currentYear && s.sale_month === m);
      const totalFatura = ms.reduce((s, v) => s + v.invoice_total, 0);
      const totalBase = ms.reduce((s, v) => s + v.base_value, 0);
      return { mes: FULL[i], totalFatura, totalBase, iva: Math.round((totalFatura - totalBase) * 100) / 100, sales: ms };
    });
  }, [sales, currentYear]);

  // IVA Pago (despesas)
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
      return { mes: FULL[i], byLoc, totalIvaPago, expenses: me };
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

  const totalCobrado = balanco.reduce((s, d) => s + d.cobrado, 0);
  const totalPago = balanco.reduce((s, d) => s + d.pago, 0);
  const totalBalanco = balanco.reduce((s, d) => s + d.balanco, 0);

  // Detail data for popups
  const cobradoDetail = cobradoMonth !== null ? ivaCobrado[cobradoMonth] : null;
  const pagoDetail = pagoMonth !== null ? ivaPago[pagoMonth] : null;

  return (
    <div className="space-y-6 mt-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">IVA — {currentYear}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mês</TableHead>
                <TableHead className="text-right">IVA Cobrado</TableHead>
                <TableHead className="text-right">IVA Pago</TableHead>
                <TableHead className="text-right">Balanço</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {balanco.map((d, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{d.mes}</TableCell>
                  <TableCell
                    className="text-right cursor-pointer hover:text-primary underline decoration-dotted underline-offset-2"
                    onClick={() => setCobradoMonth(i)}
                  >
                    {fmt(d.cobrado)}
                  </TableCell>
                  <TableCell
                    className="text-right cursor-pointer hover:text-primary underline decoration-dotted underline-offset-2"
                    onClick={() => setPagoMonth(i)}
                  >
                    {fmt(d.pago)}
                  </TableCell>
                  <TableCell className={`text-right font-medium ${d.balanco > 0 ? 'text-warning' : d.balanco < 0 ? 'text-success' : ''}`}>{fmt(d.balanco)}</TableCell>
                  <TableCell>
                    {d.balanco > 0 && <Badge variant="outline" className="bg-warning/10 text-warning text-xs">A entregar</Badge>}
                    {d.balanco < 0 && <Badge variant="outline" className="bg-success/10 text-success text-xs">A recuperar</Badge>}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="border-t-2 font-semibold">
                <TableCell>Total</TableCell>
                <TableCell className="text-right">{fmt(totalCobrado)}</TableCell>
                <TableCell className="text-right">{fmt(totalPago)}</TableCell>
                <TableCell className={`text-right ${totalBalanco > 0 ? 'text-amber-600' : totalBalanco < 0 ? 'text-green-600' : ''}`}>{fmt(totalBalanco)}</TableCell>
                <TableCell />
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <FinDocumentsUpload
        title={`Declarações de IVA — ${currentYear}`}
        documents={ivaDocuments}
        onUpdate={handleDocsUpdate}
      />

      {/* IVA Cobrado Detail Dialog */}
      <Dialog open={cobradoMonth !== null} onOpenChange={(open) => !open && setCobradoMonth(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base">IVA Cobrado — {cobradoDetail?.mes}</DialogTitle>
          </DialogHeader>
          {cobradoDetail && cobradoDetail.sales.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">Sem vendas registadas neste mês.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Venda</TableHead>
                  <TableHead className="text-right">Total Fatura</TableHead>
                  <TableHead className="text-right">Base</TableHead>
                  <TableHead className="text-right">IVA</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cobradoDetail?.sales.map((s, idx) => {
                  const iva = Math.round((s.invoice_total - s.base_value) * 100) / 100;
                  return (
                    <TableRow key={idx}>
                      <TableCell className="text-sm">{s.client || s.product || s.sale_id || `Venda ${idx + 1}`}</TableCell>
                      <TableCell className="text-right text-sm">{fmt(s.invoice_total)}</TableCell>
                      <TableCell className="text-right text-sm">{fmt(s.base_value)}</TableCell>
                      <TableCell className="text-right text-sm font-medium">{fmt(iva)}</TableCell>
                    </TableRow>
                  );
                })}
                <TableRow className="border-t-2 font-semibold">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right">{fmt(cobradoDetail?.totalFatura || 0)}</TableCell>
                  <TableCell className="text-right">{fmt(cobradoDetail?.totalBase || 0)}</TableCell>
                  <TableCell className="text-right">{fmt(cobradoDetail?.iva || 0)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>

      {/* IVA Pago Detail Dialog */}
      <Dialog open={pagoMonth !== null} onOpenChange={(open) => !open && setPagoMonth(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base">IVA Pago — {pagoDetail?.mes}</DialogTitle>
          </DialogHeader>
          {pagoDetail && pagoDetail.expenses.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">Sem despesas registadas neste mês.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Despesa</TableHead>
                  <TableHead className="text-right">Total c/ IVA</TableHead>
                  <TableHead className="text-right">Base</TableHead>
                  <TableHead className="text-right">IVA</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagoDetail?.expenses.map((e, idx) => {
                  const iva = Math.round((e.total_with_vat - e.base_value) * 100) / 100;
                  return (
                    <TableRow key={idx}>
                      <TableCell className="text-sm">{e.description || `Despesa ${idx + 1}`}</TableCell>
                      <TableCell className="text-right text-sm">{fmt(e.total_with_vat)}</TableCell>
                      <TableCell className="text-right text-sm">{fmt(e.base_value)}</TableCell>
                      <TableCell className="text-right text-sm font-medium">{fmt(iva)}</TableCell>
                    </TableRow>
                  );
                })}
                <TableRow className="border-t-2 font-semibold">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right">{fmt(pagoDetail?.expenses.reduce((s, e) => s + e.total_with_vat, 0) || 0)}</TableCell>
                  <TableCell className="text-right">{fmt(pagoDetail?.expenses.reduce((s, e) => s + e.base_value, 0) || 0)}</TableCell>
                  <TableCell className="text-right">{fmt(pagoDetail?.totalIvaPago || 0)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
