import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Download, Copy } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { EntryDetailSheet } from './EntryDetailSheet';
import { EntryStatusSelect } from './InlineStatusSelect';
import { SaleFormDialog } from '@/components/commercial/SaleFormDialog';
import { exportCsv } from '@/lib/exportCsv';
import { exportPdf } from '@/lib/exportPdf';
import { toast } from 'sonner';
import { useCommercialData } from '@/hooks/useCommercialData';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { sumRevenue } from '@/lib/salesCalculations';

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
  const [dupOpen, setDupOpen] = useState(false);
  const [dupData, setDupData] = useState<any>(null);
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentQuarter = Math.ceil(currentMonth / 3);

  const com = useCommercialData(currentYear);
  const { data: productRows } = useQuery({
    queryKey: ['product-names-fin'],
    queryFn: async () => {
      const { data } = await supabase.from('products').select('name');
      return (data || []).map(p => p.name);
    },
    staleTime: 5 * 60 * 1000,
  });
  const productNames = productRows || [];

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
  const totalInvoice = sumRevenue(filtered);
  const fmt = (v: number) => v.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

  const openDetail = (sale: Sale) => {
    setSelectedSale(sale);
    setSheetOpen(true);
  };

  const duplicateSale = (s: Sale) => {
    const { id, sale_id, created_at, updated_at, ...rest } = s as any;
    setDupData({ ...rest, status: 'pendente' });
    setDupOpen(true);
  };

  const handleExportCsv = () => {
    const headers = ['ID', 'Data Pgto.', 'Descrição', 'Valor Base', 'Fatura Total', 'Produto', 'Cliente', 'Fonte', 'Mês', 'Trimestre', 'Ano'];
    const rows = filtered.map(s => [s.sale_id, s.payment_date || '', s.description || '', s.base_value, s.invoice_total, s.product || '', s.client || '', s.source || '', s.sale_month || '', `T${s.sale_quarter || ''}`, s.sale_year || '']);
    exportCsv(`entradas_${currentYear}.csv`, headers, rows);
    toast.success('CSV exportado');
  };

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          {([['all', 'Todos'], ['month', 'Este mês'], ['quarter', 'Este trimestre'], ['year', 'Este ano']] as const).map(([k, l]) => (
            <Button key={k} variant={filter === k ? 'default' : 'outline'} size="sm" onClick={() => setFilter(k)}>{l}</Button>
          ))}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={handleExportCsv}><Download className="h-3.5 w-3.5 mr-1" /> CSV</Button>
          <Button size="sm" variant="outline" onClick={() => { exportPdf(`Entradas — ${currentYear}`, 'fin-entradas-export'); toast.success('PDF a gerar...'); }}><Download className="h-3.5 w-3.5 mr-1" /> PDF</Button>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Total Valor Base</p><p className="text-lg font-bold">{fmt(totalBase)}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Total Fatura</p><p className="text-lg font-bold">{fmt(totalInvoice)}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Registos</p><p className="text-lg font-bold">{filtered.length}</p></CardContent></Card>
      </div>
      <Card id="fin-entradas-export">
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
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={13} className="text-center text-muted-foreground py-8">Sem entradas</TableCell></TableRow>
              ) : filtered.map(s => (
                  <TableRow key={s.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openDetail(s)}>
                    <TableCell onClick={e => e.stopPropagation()}><EntryStatusSelect saleId={s.id} currentStatus={s.status || 'aguarda_pagamento'} paymentDate={s.payment_date} hasDocuments={Array.isArray(s.documents) && s.documents.length > 0} /></TableCell>
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
                    <TableCell onClick={e => e.stopPropagation()}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" aria-label="Copiar" size="icon" className="h-7 w-7" onClick={() => duplicateSale(s)}>
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Duplicar</TooltipContent>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <EntryDetailSheet sale={selectedSale} open={sheetOpen} onOpenChange={setSheetOpen} />
      <SaleFormDialog
        open={dupOpen}
        onOpenChange={setDupOpen}
        products={productNames}
        initialData={dupData}
        onSave={(sale) => { com.upsertSale.mutate(sale); setDupOpen(false); }}
      />
    </div>
  );
}
