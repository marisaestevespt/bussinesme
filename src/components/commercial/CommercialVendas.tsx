import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { useCommercialData } from '@/hooks/useCommercialData';
import { SaleFormDialog } from './SaleFormDialog';
import { useAuth } from '@/hooks/useAuth';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

const STATUS_MAP: Record<string, { label: string; className: string }> = {
  na: { label: 'N.A.', className: 'bg-muted text-muted-foreground' },
  fatura_emitida: { label: 'Fatura Emitida', className: 'bg-amber-100 text-amber-800 border-amber-200' },
  pagamento_ok: { label: 'Pagamento OK', className: 'bg-green-100 text-green-800 border-green-200' },
  recibo_enviado: { label: 'Recibo Enviado', className: 'bg-blue-100 text-blue-800 border-blue-200' },
  contabilidade_ok: { label: 'Contabilidade OK', className: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
};

const QUARTER_LABEL = (q: number | null) => q ? `T${q}` : '—';
const MONTH_NAMES_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const fmt = (v: number) => v.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function CommercialVendas() {
  const data = useCommercialData();
  const { isOwner } = useAuth();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [view, setView] = useState<'all' | 'overdue'>('all');

  const products = (data.productGoals.data || []).map(p => p.product_name);
  const allSalesData = data.allSales.data || [];

  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');

  const filteredSales = view === 'overdue'
    ? allSalesData.filter(s => ['na', 'fatura_emitida'].includes(s.status) && s.payment_date && s.payment_date < todayStr)
    : allSalesData;

  const totalBase = filteredSales.reduce((s, v) => s + Number(v.base_value || 0), 0);
  const totalInvoice = filteredSales.reduce((s, v) => s + Number(v.invoice_total || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Tabs value={view} onValueChange={v => setView(v as any)}>
          <TabsList>
            <TabsTrigger value="all">Todas as Vendas</TabsTrigger>
            <TabsTrigger value="overdue">Pagamentos em Atraso</TabsTrigger>
          </TabsList>
        </Tabs>
        <Button size="sm" onClick={() => { setEditing(null); setFormOpen(true); }}><Plus className="h-4 w-4 mr-1" /> Nova Venda</Button>
      </div>

      {/* Summary */}
      <div className="flex gap-6 text-sm">
        <span>Total Valor Base: <strong>€{fmt(totalBase)}</strong></span>
        <span>Total Fatura Total: <strong>€{fmt(totalInvoice)}</strong></span>
        <span>Registos: <strong>{filteredSales.length}</strong></span>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Data Pag.</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead className="text-right">Valor Base</TableHead>
              <TableHead className="text-right">Fatura Total</TableHead>
              <TableHead>Produto</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Fonte</TableHead>
              <TableHead>Docs</TableHead>
              <TableHead>Mês</TableHead>
              <TableHead>Trim.</TableHead>
              <TableHead>Ano</TableHead>
              <TableHead className="w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSales.length === 0 && (
              <TableRow><TableCell colSpan={14} className="text-center text-muted-foreground py-8">Sem vendas registadas</TableCell></TableRow>
            )}
            {filteredSales.map(s => {
              const st = STATUS_MAP[s.status] || STATUS_MAP.na;
              return (
                <TableRow key={s.id}>
                  <TableCell className="font-mono text-sm">{s.sale_id}</TableCell>
                  <TableCell><Badge variant="outline" className={st.className}>{st.label}</Badge></TableCell>
                  <TableCell>{s.payment_date ? format(new Date(s.payment_date), 'dd/MM/yyyy') : '—'}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{s.description || '—'}</TableCell>
                  <TableCell className="text-right">€{fmt(Number(s.base_value))}</TableCell>
                  <TableCell className="text-right">€{fmt(Number(s.invoice_total))}</TableCell>
                  <TableCell>{s.product || '—'}</TableCell>
                  <TableCell>{s.client || '—'}</TableCell>
                  <TableCell>{s.source || '—'}</TableCell>
                  <TableCell>{s.documents ? <a href={s.documents} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3.5 w-3.5" /></a> : '—'}</TableCell>
                  <TableCell>{s.sale_month ? MONTH_NAMES_SHORT[s.sale_month - 1] : '—'}</TableCell>
                  <TableCell>{QUARTER_LABEL(s.sale_quarter)}</TableCell>
                  <TableCell>{s.sale_year || '—'}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => { setEditing(s); setFormOpen(true); }}><Pencil className="h-3.5 w-3.5" /></Button>
                      {isOwner && <Button variant="ghost" size="sm" onClick={() => data.deleteSale.mutate(s.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      <SaleFormDialog open={formOpen} onOpenChange={setFormOpen} products={products} initialData={editing} onSave={(sale) => { data.upsertSale.mutate(sale); setFormOpen(false); }} />
    </div>
  );
}
