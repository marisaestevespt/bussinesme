import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSectorConfig } from '@/hooks/useSectorConfig';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Pencil, Trash2, ExternalLink, Search, X, Gift } from 'lucide-react';
import { format } from 'date-fns';
import { useCommercialData } from '@/hooks/useCommercialData';
import { useUserViews, type DefaultView } from '@/hooks/useUserViews';
import { ViewTabs } from '@/components/ViewTabs';
import { SaleFormDialog } from './SaleFormDialog';
import { useAuth } from '@/hooks/useAuth';
import { ENTRY_STATUSES, getEntryStatusBadge, getEffectiveEntryStatus } from '@/components/financial/EntryDetailSheet';
import { EntryStatusSelect } from '@/components/financial/InlineStatusSelect';
import { sumRevenue } from '@/lib/salesCalculations';
import { formatNumber } from '@/lib/formatting';

const STATUS_OPTIONS = ENTRY_STATUSES.map(s => ({ value: s.value, label: s.label }));
import { DEFAULT_SALE_SOURCES } from '@/lib/labelMaps';
const SOURCE_OPTIONS = DEFAULT_SALE_SOURCES;
const QUARTER_LABEL = (q: number | null) => q ? `T${q}` : '—';
const MONTH_NAMES_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const DEFAULT_VIEWS: DefaultView[] = [
  { key: 'all', label: 'Todas as Vendas', isDefault: true },
  { key: 'overdue', label: 'Pagamentos em Atraso', isDefault: true },
];

export function CommercialVendas() {
  const data = useCommercialData();
  const sectorConfig = useSectorConfig();
  const { isOwner } = useAuth();
  const navigate = useNavigate();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [activeView, setActiveView] = useState('all');

  // Search & filter state
  const [searchText, setSearchText] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterProduct, setFilterProduct] = useState<string>('');
  const [filterSource, setFilterSource] = useState<string>('');
  const [filterYear, setFilterYear] = useState<string>('');
  const [filterQuarter, setFilterQuarter] = useState<string>('');

  const { allViews, addView, renameView, deleteView } = useUserViews('comercial-vendas', DEFAULT_VIEWS);

  const productGoalsList = data.productGoals.data || [];
  const products = productGoalsList.map(p => p.product_name);
  const allSalesData = data.allSales.data || [];
  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');

  const hasActiveFilters = searchText || filterStatus || filterProduct || filterSource || filterYear || filterQuarter;

  const clearFilters = () => {
    setSearchText('');
    setFilterStatus('');
    setFilterProduct('');
    setFilterSource('');
    setFilterYear('');
    setFilterQuarter('');
  };

  const filteredSales = useMemo(() => {
    let result = allSalesData;

    // Default view filters
    if (activeView === 'overdue') {
      result = result.filter(s => {
        const eff = getEffectiveEntryStatus(s.status, s.payment_date);
        return eff === 'pagamento_em_atraso';
      });
    }

    // Search text (across description, client, product, sale_id)
    if (searchText) {
      const q = searchText.toLowerCase();
      result = result.filter(s =>
        (s.description || '').toLowerCase().includes(q) ||
        (s.client || '').toLowerCase().includes(q) ||
        (s.product || '').toLowerCase().includes(q) ||
        (s.sale_id || '').toLowerCase().includes(q)
      );
    }

    // Filters
    if (filterStatus) result = result.filter(s => s.status === filterStatus);
    if (filterProduct) result = result.filter(s => s.product === filterProduct);
    if (filterSource) result = result.filter(s => s.source === filterSource);
    if (filterYear) result = result.filter(s => s.sale_year?.toString() === filterYear);
    if (filterQuarter) result = result.filter(s => s.sale_quarter?.toString() === filterQuarter);

    return result;
  }, [allSalesData, activeView, searchText, filterStatus, filterProduct, filterSource, filterYear, filterQuarter, todayStr]);

  const totalBase = filteredSales.reduce((s, v) => s + Number(v.base_value || 0), 0);
  const totalInvoice = sumRevenue(filteredSales);

  // Available years for filter
  const availableYears = [...new Set(allSalesData.map(s => s.sale_year).filter(Boolean))].sort((a, b) => (b || 0) - (a || 0));

  return (
    <div className="space-y-4">
      {/* Views + New Sale */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <ViewTabs
          views={allViews}
          activeKey={activeView}
          onSelect={setActiveView}
          onAdd={addView}
          onRename={(id, label) => renameView({ id, label })}
          onDelete={deleteView}
        />
        <Button size="sm" onClick={() => { setEditing(null); setFormOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Nova Venda
        </Button>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar por descrição, cliente, produto ou ID..."
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterStatus} onValueChange={v => setFilterStatus(v === '_all' ? '' : v)}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">Todos os status</SelectItem>
            {STATUS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterProduct} onValueChange={v => setFilterProduct(v === '_all' ? '' : v)}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder={sectorConfig.t('produto')} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">Todos</SelectItem>
            {products.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterSource} onValueChange={v => setFilterSource(v === '_all' ? '' : v)}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Fonte" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">Todas</SelectItem>
            {SOURCE_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterYear} onValueChange={v => setFilterYear(v === '_all' ? '' : v)}>
          <SelectTrigger className="w-[110px]"><SelectValue placeholder="Ano" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">Todos</SelectItem>
            {availableYears.map(y => <SelectItem key={y!} value={y!.toString()}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterQuarter} onValueChange={v => setFilterQuarter(v === '_all' ? '' : v)}>
          <SelectTrigger className="w-[110px]"><SelectValue placeholder="Trimestre" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">Todos</SelectItem>
            <SelectItem value="1">T1</SelectItem>
            <SelectItem value="2">T2</SelectItem>
            <SelectItem value="3">T3</SelectItem>
            <SelectItem value="4">T4</SelectItem>
          </SelectContent>
        </Select>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground">
            <X className="h-3.5 w-3.5 mr-1" /> Limpar
          </Button>
        )}
      </div>

      {/* Summary */}
      <div className="flex gap-6 text-sm">
        <span>Total Valor Base: <strong>€{formatNumber(totalBase)}</strong></span>
        <span>Total Fatura Total: <strong>€{formatNumber(totalInvoice)}</strong></span>
        <span>Registos: <strong>{filteredSales.length}</strong></span>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="whitespace-nowrap">ID</TableHead>
              <TableHead className="whitespace-nowrap">Status</TableHead>
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
              const docs = Array.isArray(s.documents) ? s.documents : [];
              return (
                <TableRow key={s.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/hub/comercial/vendas/${s.id}`)}>
                  <TableCell className="font-mono text-sm whitespace-nowrap">{s.sale_id}</TableCell>
                  <TableCell className="whitespace-nowrap" onClick={e => e.stopPropagation()}><EntryStatusSelect saleId={s.id} currentStatus={s.status || 'aguarda_pagamento'} paymentDate={s.payment_date} hasDocuments={docs.length > 0} /></TableCell>
                  <TableCell>{s.payment_date ? format(new Date(s.payment_date), 'dd/MM/yyyy') : '—'}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{s.description || '—'}</TableCell>
                  <TableCell className="text-right">€{formatNumber(Number(s.base_value))}</TableCell>
                  <TableCell className="text-right">€{formatNumber(Number(s.invoice_total))}</TableCell>
                  <TableCell>{s.product || '—'}</TableCell>
                  <TableCell>{s.client || '—'}</TableCell>
                  <TableCell>{s.source || '—'}{(s as any).is_special_offer && <Gift className="inline h-3.5 w-3.5 ml-1 text-warning" />}</TableCell>
                  <TableCell onClick={e => e.stopPropagation()}>{Array.isArray(s.documents) && s.documents.length > 0 ? <a href={(s.documents[0] as any)?.url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3.5 w-3.5" /></a> : '—'}</TableCell>
                  <TableCell>{s.sale_month ? MONTH_NAMES_SHORT[s.sale_month - 1] : '—'}</TableCell>
                  <TableCell>{QUARTER_LABEL(s.sale_quarter)}</TableCell>
                  <TableCell>{s.sale_year || '—'}</TableCell>
                  <TableCell onClick={e => e.stopPropagation()}>
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
