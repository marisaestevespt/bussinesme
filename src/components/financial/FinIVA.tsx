import { useMemo, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Download, AlertTriangle } from 'lucide-react';
import type { Expense } from '@/hooks/useFinancialData';
import type { useFinancialData } from '@/hooks/useFinancialData';
import { FinDocumentsUpload, type FinDocItem } from './FinDocumentsUpload';
import { exportCsv } from '@/lib/exportCsv';
import { exportPdf } from '@/lib/exportPdf';
import { toast } from 'sonner';
import { computeVatForExpenses, computeVatForSales } from '@/lib/vatCalculations';
import { VatDeductibleCell } from './VatDeductibleCell';
import { formatEuro } from '@/lib/formatting';
import { EmptyHint } from '@/components/ui/loading-skeletons';

const FULL = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
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

  // IVA Cobrado (vendas) — cálculo centralizado em lib/vatCalculations
  const ivaCobrado = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const ms = sales.filter(s => s.sale_year === currentYear && s.sale_month === m);
      const totals = computeVatForSales(ms);
      return {
        mes: FULL[i],
        totalFatura: totals.totalEntradas,
        totalBase: totals.totalBase,
        iva: totals.ivaCobrado,
        sales: ms,
      };
    });
  }, [sales, currentYear]);

  // IVA Pago / Dedutível (despesas) — cálculo centralizado, com breakdown por localização
  const ivaPago = useMemo(() => {
    const locs = ['portugal', 'ue', 'fora_ue'] as const;
    return Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const me = expenses.filter(e => e.expense_year === currentYear && e.expense_month === m);
      const byLoc = locs.map(loc => {
        const le = me.filter(e => e.location === loc);
        const t = computeVatForExpenses(le);
        return { loc, totalComIva: t.totalSaidas, totalSemIva: t.totalBase, iva: t.ivaPago };
      });
      const totals = computeVatForExpenses(me);
      return {
        mes: FULL[i],
        byLoc,
        totalIvaPago: totals.ivaPago,
        totalIvaDeduzir: totals.ivaDeduzir,
        expenses: me,
      };
    });
  }, [expenses, currentYear]);

  // Balanço IVA = IVA Cobrado − IVA a Deduzir (não IVA pago)
  const balanco = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const cobrado = ivaCobrado[i].iva;
      const pago = ivaPago[i].totalIvaPago;
      const deduzir = ivaPago[i].totalIvaDeduzir;
      const bal = Math.round((cobrado - deduzir) * 100) / 100;
      return { mes: FULL[i], cobrado, pago, deduzir, balanco: bal };
    });
  }, [ivaCobrado, ivaPago]);

  const locLabel = (l: string) => l === 'portugal' ? 'Portugal' : l === 'ue' ? 'União Europeia' : 'Fora da UE';

  // Auto-liquidação: EU purchases where reverse charge applies
  const autoLiquidacao = useMemo(() => {
    const euExpenses = expenses.filter(e => e.expense_year === currentYear && e.location === 'ue');
    const byMonth = Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const me = euExpenses.filter(e => e.expense_month === m);
      const totalBase = me.reduce((s, e) => s + e.base_value, 0);
      // Standard PT VAT rate (23%) applied for reverse charge declaration
      const ivaAutoLiq = Math.round(totalBase * 0.23 * 100) / 100;
      return { mes: FULL[i], items: me, totalBase, ivaAutoLiq };
    });
    const totalBase = byMonth.reduce((s, m) => s + m.totalBase, 0);
    const totalIva = byMonth.reduce((s, m) => s + m.ivaAutoLiq, 0);
    return { byMonth, totalBase, totalIva, hasAny: euExpenses.length > 0 };
  }, [expenses, currentYear]);

  const totalCobrado = balanco.reduce((s, d) => s + d.cobrado, 0);
  const totalPago = balanco.reduce((s, d) => s + d.pago, 0);
  const totalDeduzir = balanco.reduce((s, d) => s + d.deduzir, 0);
  const totalBalanco = balanco.reduce((s, d) => s + d.balanco, 0);

  // Detail data for popups
  const cobradoDetail = cobradoMonth !== null ? ivaCobrado[cobradoMonth] : null;
  const pagoDetail = pagoMonth !== null ? ivaPago[pagoMonth] : null;

  const handleExportCsv = () => {
    const headers = ['Mês', 'IVA Cobrado', 'IVA Pago', 'IVA a Deduzir', 'Balanço'];
    const rows = balanco.map(b => [b.mes, b.cobrado, b.pago, b.deduzir, b.balanco]);
    rows.push(['TOTAL', totalCobrado, totalPago, totalDeduzir, totalBalanco]);
    exportCsv(`iva_${currentYear}.csv`, headers, rows);
    toast.success('CSV exportado');
  };

  return (
    <div className="space-y-6 mt-4">
      <div className="flex items-center justify-end gap-2">
        <Button size="sm" variant="outline" onClick={handleExportCsv}><Download className="h-3.5 w-3.5 mr-1" /> CSV</Button>
        <Button size="sm" variant="outline" onClick={() => { exportPdf(`IVA — ${currentYear}`, 'fin-iva-export'); toast.success('PDF a gerar...'); }}><Download className="h-3.5 w-3.5 mr-1" /> PDF</Button>
      </div>
      <div id="fin-iva-export">
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
                <TableHead className="text-right">IVA a Deduzir</TableHead>
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
                    {formatEuro(d.cobrado)}
                  </TableCell>
                  <TableCell
 className="text-right cursor-pointer hover:text-primary underline decoration-dotted underline-offset-2"
 onClick={() => setPagoMonth(i)}
                  >
                    {formatEuro(d.pago)}
                  </TableCell>
                  <TableCell className="text-right font-medium text-primary">{formatEuro(d.deduzir)}</TableCell>
                  <TableCell className={`text-right font-medium ${d.balanco > 0 ? 'text-warning' : d.balanco < 0 ? 'text-success' : ''}`}>{formatEuro(d.balanco)}</TableCell>
                  <TableCell>
                    {d.balanco > 0 && <Badge variant="outline" className="bg-warning/10 text-warning text-xs">A entregar</Badge>}
                    {d.balanco < 0 && <Badge variant="outline" className="bg-success/10 text-success text-xs">A recuperar</Badge>}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="border-t-2 font-semibold">
                <TableCell>Total</TableCell>
                <TableCell className="text-right">{formatEuro(totalCobrado)}</TableCell>
                <TableCell className="text-right">{formatEuro(totalPago)}</TableCell>
                <TableCell className="text-right text-primary">{formatEuro(totalDeduzir)}</TableCell>
                <TableCell className={`text-right ${totalBalanco > 0 ? 'text-warning' : totalBalanco < 0 ? 'text-success' : ''}`}>{formatEuro(totalBalanco)}</TableCell>
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

      {/* Auto-liquidação UE */}
      {autoLiquidacao.hasAny && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" />
              Auto-liquidação — Compras UE ({currentYear})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Alert className="mb-4">
              <AlertDescription className="text-xs">
                Compras a fornecedores da UE com <strong>reverse charge</strong> devem ser declaradas nos campos 16 e 17 da declaração periódica de IVA.
                O IVA é simultaneamente liquidado e deduzido (efeito neutro), mas tem de ser declarado.
              </AlertDescription>
            </Alert>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mês</TableHead>
                  <TableHead className="text-right">Base (€)</TableHead>
                  <TableHead className="text-right">IVA a declarar (23%)</TableHead>
                  <TableHead className="text-right">Nº compras</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {autoLiquidacao.byMonth.filter(m => m.items.length > 0).map((m, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{m.mes}</TableCell>
                    <TableCell className="text-right">{formatEuro(m.totalBase)}</TableCell>
                    <TableCell className="text-right font-medium">{formatEuro(m.ivaAutoLiq)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{m.items.length}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="border-t-2 font-semibold">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right">{formatEuro(autoLiquidacao.totalBase)}</TableCell>
                  <TableCell className="text-right">{formatEuro(autoLiquidacao.totalIva)}</TableCell>
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* IVA Cobrado Detail Dialog */}
      <Dialog open={cobradoMonth !== null} onOpenChange={(open) => !open && setCobradoMonth(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base">IVA Cobrado — {cobradoDetail?.mes}</DialogTitle>
          </DialogHeader>
          {cobradoDetail && cobradoDetail.sales.length === 0 ? (
            <EmptyHint>Sem vendas registadas neste mês.</EmptyHint>
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
                      <TableCell className="text-right text-sm">{formatEuro(s.invoice_total)}</TableCell>
                      <TableCell className="text-right text-sm">{formatEuro(s.base_value)}</TableCell>
                      <TableCell className="text-right text-sm font-medium">{formatEuro(iva)}</TableCell>
                    </TableRow>
                  );
                })}
                <TableRow className="border-t-2 font-semibold">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right">{formatEuro(cobradoDetail?.totalFatura || 0)}</TableCell>
                  <TableCell className="text-right">{formatEuro(cobradoDetail?.totalBase || 0)}</TableCell>
                  <TableCell className="text-right">{formatEuro(cobradoDetail?.iva || 0)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>

      {/* IVA Pago Detail Dialog */}
      <Dialog open={pagoMonth !== null} onOpenChange={(open) => !open && setPagoMonth(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-base">IVA Pago — {pagoDetail?.mes}</DialogTitle>
          </DialogHeader>
          {pagoDetail && pagoDetail.expenses.length === 0 ? (
            <EmptyHint>Sem despesas registadas neste mês.</EmptyHint>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Despesa</TableHead>
                  <TableHead className="text-right">Total c/ IVA</TableHead>
                  <TableHead className="text-right">Base</TableHead>
                  <TableHead className="text-right">IVA Pago</TableHead>
                  <TableHead className="text-right">IVA a Deduzir</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagoDetail?.expenses.map((e, idx) => {
                  const iva = Math.round((e.total_with_vat - e.base_value) * 100) / 100;
                  return (
                    <TableRow key={idx}>
                      <TableCell className="text-sm">{e.description || `Despesa ${idx + 1}`}</TableCell>
                      <TableCell className="text-right text-sm">{formatEuro(e.total_with_vat)}</TableCell>
                      <TableCell className="text-right text-sm">{formatEuro(e.base_value)}</TableCell>
                      <TableCell className="text-right text-sm font-medium">{formatEuro(iva)}</TableCell>
                      <TableCell className="text-right text-sm">
                        <VatDeductibleCell expense={e as any} />
                      </TableCell>
                    </TableRow>
                  );
                })}
                <TableRow className="border-t-2 font-semibold">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right">{formatEuro(pagoDetail?.expenses.reduce((s, e) => s + e.total_with_vat, 0) || 0)}</TableCell>
                  <TableCell className="text-right">{formatEuro(pagoDetail?.expenses.reduce((s, e) => s + e.base_value, 0) || 0)}</TableCell>
                  <TableCell className="text-right">{formatEuro(pagoDetail?.totalIvaPago || 0)}</TableCell>
                  <TableCell className="text-right text-primary">{formatEuro(pagoDetail?.totalIvaDeduzir || 0)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}
