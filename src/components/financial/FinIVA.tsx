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
      // IVA a deduzir: usa vat_deductible_amount se preenchido, senão assume 100% (= IVA pago)
      const totalIvaDeduzir = me.reduce((s, e) => {
        const ivaPago = Math.max(0, (e.total_with_vat || 0) - (e.base_value || 0));
        const dedutivel = (e as any).vat_deductible_amount;
        return s + (dedutivel != null ? Number(dedutivel) : ivaPago);
      }, 0);
      return { mes: FULL[i], byLoc, totalIvaPago, totalIvaDeduzir: Math.round(totalIvaDeduzir * 100) / 100, expenses: me };
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
                <TableCell className={`text-right ${totalBalanco > 0 ? 'text-warning' : totalBalanco < 0 ? 'text-success' : ''}`}>{fmt(totalBalanco)}</TableCell>
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
                    <TableCell className="text-right">{fmt(m.totalBase)}</TableCell>
                    <TableCell className="text-right font-medium">{fmt(m.ivaAutoLiq)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{m.items.length}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="border-t-2 font-semibold">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right">{fmt(autoLiquidacao.totalBase)}</TableCell>
                  <TableCell className="text-right">{fmt(autoLiquidacao.totalIva)}</TableCell>
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
    </div>
  );
}
