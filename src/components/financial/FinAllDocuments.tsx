import { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Search, X, ExternalLink, ArrowDownLeft, ArrowUpRight, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { useFinancialData } from '@/hooks/useFinancialData';
import { useCommercialData } from '@/hooks/useCommercialData';
import { formatEuro } from '@/lib/formatting';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
type UnifiedDoc = {
  id: string;
  type: 'entrada' | 'saida';
  ref: string;
  description: string;
  client_or_supplier: string;
  category: string;
  date: string | null;
  value: number;
  status: string;
  documents: any;
};

export function FinAllDocuments() {
  // Only need expenses (entries come from useCommercialData)
  const fin = useFinancialData({ expenses: true, recurring: false, documents: false, payroll: false, contractors: false });
  const com = useCommercialData();

  // Suppliers map (id → name) for the "Cliente / Fornecedor" column on saídas
  const { data: suppliersMap } = useQuery({
    queryKey: ['suppliers-id-name-map'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.from('suppliers').select('id, name');
      if (error) throw error;
      const map = new Map<string, string>();
      (data || []).forEach((s: any) => map.set(s.id, s.name));
      return map;
    },
  });

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  type SortKey = 'type' | 'ref' | 'client_or_supplier' | 'description' | 'date' | 'value' | 'status';
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'date' || key === 'value' ? 'desc' : 'asc');
    }
  };

  const SortHeader = ({ k, children, align }: { k: SortKey; children: React.ReactNode; align?: 'right' }) => (
    <button
      type="button"
      onClick={() => toggleSort(k)}
      className={`inline-flex items-center gap-1 hover:text-foreground transition-colors ${align === 'right' ? 'justify-end w-full' : ''}`}
    >
      {children}
      {sortKey === k ? (
        sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
      ) : (
        <ArrowUpDown className="h-3 w-3 opacity-40" />
      )}
    </button>
  );

  const unified = useMemo(() => {
    const sales = com.sales.data || [];
    const expenses = fin.expenses.data || [];

    const entradas: UnifiedDoc[] = sales.map(s => ({
      id: s.id,
      type: 'entrada' as const,
      ref: s.sale_id,
      description: s.description || '',
      client_or_supplier: s.client || '',
      category: s.product || '',
      date: s.payment_date,
      value: s.invoice_total,
      status: s.status,
      documents: s.documents,
    }));

    const saidas: UnifiedDoc[] = expenses.map(e => ({
      id: e.id,
      type: 'saida' as const,
      ref: e.expense_id,
      description: e.description || '',
      client_or_supplier:
        (e.supplier_id && suppliersMap?.get(e.supplier_id))
        || (e as any).expense_name
        || e.description
        || e.category
        || '',
      category: e.category || '',
      date: e.expense_date,
      value: e.total_with_vat,
      status: e.status,
      documents: e.documents,
    }));

    return [...entradas, ...saidas];
  }, [com.sales.data, fin.expenses.data, suppliersMap]);

  const filtered = useMemo(() => {
    let data = unified;

    if (typeFilter !== 'all') {
      data = data.filter(d => d.type === typeFilter);
    }

    if (dateFrom) {
      data = data.filter(d => d.date && d.date >= dateFrom);
    }
    if (dateTo) {
      data = data.filter(d => d.date && d.date <= dateTo);
    }

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      data = data.filter(d =>
        d.ref.toLowerCase().includes(q) ||
        d.description.toLowerCase().includes(q) ||
        d.client_or_supplier.toLowerCase().includes(q) ||
        d.category.toLowerCase().includes(q)
      );
    }

    const sorted = [...data].sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      const av = a[sortKey];
      const bv = b[sortKey];
      if (sortKey === 'value') {
        return ((av as number) - (bv as number)) * dir;
      }
      // strings / dates (ISO strings sort lexicographically)
      const as = (av ?? '').toString();
      const bs = (bv ?? '').toString();
      if (!as && !bs) return 0;
      if (!as) return 1;
      if (!bs) return -1;
      return as.localeCompare(bs) * dir;
    });
    return sorted;
  }, [unified, typeFilter, dateFrom, dateTo, search, sortKey, sortDir]);

  const totalEntradas = filtered.filter(d => d.type === 'entrada').reduce((s, d) => s + d.value, 0);
  const totalSaidas = filtered.filter(d => d.type === 'saida').reduce((s, d) => s + d.value, 0);

  const hasFilters = search || typeFilter !== 'all' || dateFrom || dateTo;

  return (
    <div className="space-y-4">
      {/* Search & Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pesquisar por cliente, fornecedor, descrição, referência..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="entrada">Entradas</SelectItem>
              <SelectItem value="saida">Saídas</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground whitespace-nowrap">De</label>
            <Input type="date" className="h-10 w-36 text-xs" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground whitespace-nowrap">Até</label>
            <Input type="date" className="h-10 w-36 text-xs" value={dateTo} onChange={e => setDateTo(e.target.value)} />
          </div>
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setTypeFilter('all'); setDateFrom(''); setDateTo(''); }}>
              <X className="h-4 w-4 mr-1" /> Limpar
            </Button>
          )}
        </div>
      </Card>

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead><SortHeader k="type">Tipo</SortHeader></TableHead>
                <TableHead><SortHeader k="ref">Ref.</SortHeader></TableHead>
                <TableHead><SortHeader k="client_or_supplier">Cliente / Fornecedor</SortHeader></TableHead>
                <TableHead><SortHeader k="description">Descrição</SortHeader></TableHead>
                <TableHead><SortHeader k="date">Data</SortHeader></TableHead>
                <TableHead className="text-right"><SortHeader k="value" align="right">Valor</SortHeader></TableHead>
                <TableHead><SortHeader k="status">Status</SortHeader></TableHead>
                <TableHead>Doc</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground text-sm py-8">
                    Nenhum documento encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map(d => (
                  <TableRow key={d.id}>
                    <TableCell>
                      <Badge className={`text-[10px] border-0 ${d.type === 'entrada' ? 'bg-success/15 text-success dark:bg-success/40 dark:text-success' : 'bg-destructive/15 text-destructive dark:bg-destructive/40 dark:text-destructive'}`}>
                        {d.type === 'entrada' ? 'Entrada' : 'Saída'}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono">{d.ref}</TableCell>
                    <TableCell className="text-sm">{d.client_or_supplier || '—'}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{d.description || '—'}</TableCell>
                    <TableCell className="">{d.date || '—'}</TableCell>
                    <TableCell className={` text-right font-medium ${d.type === 'entrada' ? 'text-success' : 'text-destructive'}`}>
                      {d.type === 'entrada' ? '+' : '-'}{formatEuro(d.value)}
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const sc: Record<string, string> = {
                          pago: 'bg-success/15 text-success dark:bg-success/40 dark:text-success',
                          confirmada: 'bg-success/15 text-success dark:bg-success/40 dark:text-success',
                          pendente: 'bg-warning/15 text-warning dark:bg-warning/40 dark:text-warning',
                          por_pagar: 'bg-warning/15 text-warning dark:bg-warning/40 dark:text-warning',
                          cancelada: 'bg-destructive/15 text-destructive dark:bg-destructive/40 dark:text-destructive',
                          cancelado: 'bg-destructive/15 text-destructive dark:bg-destructive/40 dark:text-destructive',
                        };
                        const cls = sc[d.status] || 'bg-muted text-muted-foreground';
                        return <Badge className={`text-[10px] border-0 ${cls}`}>{d.status}</Badge>;
                      })()}
                    </TableCell>
                    <TableCell>
                      {d.documents && Array.isArray(d.documents) && d.documents.length > 0 ? (
                        <div className="flex flex-col gap-1">
                          {d.documents.map((doc: any, i: number) => (
                            <a
                              key={i}
                              href={doc?.url || '#'}
                              target="_blank"
                              rel="noopener"
                              className="inline-flex items-center gap-1 text-primary hover:underline max-w-[260px]"
                              title={doc?.name || 'Abrir ficheiro'}
                            >
                              <ExternalLink className="h-3 w-3 shrink-0" />
                              <span className="truncate">{doc?.name || 'ficheiro'}</span>
                            </a>
                          ))}
                        </div>
                      ) : '—'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
