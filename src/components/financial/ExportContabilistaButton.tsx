import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Download, FileSpreadsheet, FileText } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useFinancialData } from '@/hooks/useFinancialData';
import { useCommercialData } from '@/hooks/useCommercialData';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { excludeCancelled } from '@/lib/utils';
import { exportPdf } from '@/lib/exportPdf';
import { exportContabilistaCsv, getMonthLabel } from '@/lib/exportContabilista';
import { toast } from 'sonner';

const fmt = (v: number) => v.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

interface Props {
  year: number;
  month: number;
}

/**
 * Per-month "Exportar para Contabilista" button — generates PDF or Excel
 * with sales, expenses, and documents for the given month.
 */
export function ExportContabilistaButton({ year, month }: Props) {
  const { settings } = useBusinessSettings();
  const fin = useFinancialData({ expenses: true, recurring: false, documents: true, payroll: false, contractors: false });
  const com = useCommercialData(year);

  const sales = excludeCancelled(com.sales.data || []);
  const expenses = excludeCancelled(fin.expenses.data || []);
  const documents = fin.documents.data || [];

  const monthSales = useMemo(
    () => sales.filter((s: any) => s.sale_year === year && s.sale_month === month),
    [sales, year, month],
  );
  const monthExpenses = useMemo(
    () => expenses.filter((e: any) => e.expense_year === year && e.expense_month === month),
    [expenses, year, month],
  );
  const monthDocs = useMemo(
    () => documents.filter((d: any) => d.period_year === year && d.period_month === month),
    [documents, year, month],
  );

  const label = getMonthLabel(year, month);
  const businessName = settings?.business_name || 'Negócio';

  const totalEnt = monthSales.reduce((s, v) => s + v.invoice_total, 0);
  const totalSai = monthExpenses.reduce((s, v) => s + v.total_with_vat, 0);

  const handleExcel = () => {
    exportContabilistaCsv({ businessName, label, sales: monthSales, expenses: monthExpenses, documents: monthDocs });
    toast.success('Excel exportado');
  };

  const handlePdf = () => {
    exportPdf(`Contabilidade — ${label}`, `contabilista-export-${year}-${month}`);
    toast.success('PDF a gerar...');
  };

  const exportId = `contabilista-export-${year}-${month}`;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline" className="gap-1.5">
            <Download className="h-3.5 w-3.5" /> Exportar p/ contabilista
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handlePdf} className="gap-2">
            <FileText className="h-4 w-4" /> PDF
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleExcel} className="gap-2">
            <FileSpreadsheet className="h-4 w-4" /> Excel (CSV)
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Hidden export area for PDF */}
      <div id={exportId} className="hidden print:block">
        <h2 className="text-lg font-bold mb-2">{businessName}</h2>
        <p className="text-sm text-muted-foreground mb-4">Período: {label}</p>

        <h3 className="font-semibold mt-4 mb-2">Resumo</h3>
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div><p className="text-xs text-muted-foreground">Total Entradas</p><p className="font-bold">{fmt(totalEnt)}</p></div>
          <div><p className="text-xs text-muted-foreground">Total Saídas</p><p className="font-bold">{fmt(totalSai)}</p></div>
          <div><p className="text-xs text-muted-foreground">Resultado</p><p className="font-bold">{fmt(totalEnt - totalSai)}</p></div>
        </div>

        <h3 className="font-semibold mt-4 mb-2">Entradas</h3>
        <table className="w-full text-xs">
          <thead><tr><th>Data</th><th>Descrição</th><th>Valor s/IVA</th><th>IVA</th><th>Valor c/IVA</th><th>Nº Doc</th></tr></thead>
          <tbody>
            {monthSales.map((s: any) => (
              <tr key={s.id}>
                <td>{s.payment_date}</td>
                <td>{s.description || s.client}</td>
                <td className="text-right">{fmt(s.base_value)}</td>
                <td className="text-right">{fmt(s.invoice_total - s.base_value)}</td>
                <td className="text-right">{fmt(s.invoice_total)}</td>
                <td>{s.sale_id}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h3 className="font-semibold mt-4 mb-2">Saídas</h3>
        <table className="w-full text-xs">
          <thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Valor s/IVA</th><th>IVA</th><th>Valor c/IVA</th><th>Nº Doc</th></tr></thead>
          <tbody>
            {monthExpenses.map((e: any) => (
              <tr key={e.id}>
                <td>{e.expense_date}</td>
                <td>{e.description}</td>
                <td>{e.category}</td>
                <td className="text-right">{fmt(e.base_value)}</td>
                <td className="text-right">{fmt(e.total_with_vat - e.base_value)}</td>
                <td className="text-right">{fmt(e.total_with_vat)}</td>
                <td>{e.expense_id}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {monthDocs.length > 0 && (
          <>
            <h3 className="font-semibold mt-4 mb-2">Documentos</h3>
            <table className="w-full text-xs">
              <thead><tr><th>Nome</th><th>Data</th></tr></thead>
              <tbody>
                {monthDocs.map((d: any) => (
                  <tr key={d.id}><td>{d.document_name || d.title}</td><td>{d.period_start}</td></tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </>
  );
}