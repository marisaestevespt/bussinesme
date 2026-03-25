import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Search, X } from 'lucide-react';
import { useProducts, Product, STATUS_OPTIONS, ESCADA_OPTIONS, PRODUCT_TYPE_OPTIONS, SALES_TYPE_OPTIONS } from '@/hooks/useProducts';

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  em_ideia: { label: 'Em Ideia', className: 'bg-info/10 text-info' },
  a_criar: { label: 'A Criar', className: 'bg-warning/10 text-warning' },
  vendas_ativas: { label: 'Vendas Ativas', className: 'bg-success/10 text-success' },
  off: { label: 'Off', className: 'bg-muted text-muted-foreground' },
};

const labelFor = (options: readonly { value: string; label: string }[], val: string | null) =>
  options.find(o => o.value === val)?.label || val || '—';

export function CommercialProductsList() {
  const navigate = useNavigate();
  const { products } = useProducts();
  const items = products.data || [];

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [salesTypeFilter, setSalesTypeFilter] = useState<string>('all');

  const filtered = useMemo(() => {
    let result = items;

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(p =>
        p.name?.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q) ||
        p.ticket?.toLowerCase().includes(q) ||
        p.invoice_denomination?.toLowerCase().includes(q)
      );
    }

    if (statusFilter !== 'all') result = result.filter(p => p.status === statusFilter);
    if (typeFilter !== 'all') result = result.filter(p => p.product_type === typeFilter);
    if (salesTypeFilter !== 'all') result = result.filter(p => p.sales_type === salesTypeFilter);

    return result;
  }, [items, search, statusFilter, typeFilter, salesTypeFilter]);

  const hasFilters = search || statusFilter !== 'all' || typeFilter !== 'all' || salesTypeFilter !== 'all';

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setTypeFilter('all');
    setSalesTypeFilter('all');
  };

  return (
    <div className="space-y-4">
      {/* Search + Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar por nome, descrição, ticket..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Status</SelectItem>
            {STATUS_OPTIONS.map(s => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[190px]">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Tipos</SelectItem>
            {PRODUCT_TYPE_OPTIONS.map(s => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={salesTypeFilter} onValueChange={setSalesTypeFilter}>
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder="Tipo de Venda" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {SALES_TYPE_OPTIONS.map(s => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1 text-muted-foreground">
            <X className="h-3.5 w-3.5" /> Limpar
          </Button>
        )}
      </div>

      <p className="text-sm text-muted-foreground">
        {filtered.length} {filtered.length === 1 ? 'produto' : 'produtos'} encontrados
      </p>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="bg-primary text-primary-foreground px-4 py-2.5 font-medium text-xs grid grid-cols-7 gap-2">
            <span>Nome</span>
            <span>Status</span>
            <span>Tipo</span>
            <span>Tipo de Venda</span>
            <span>Escada</span>
            <span>Ticket</span>
            <span>Denominação Fatura</span>
          </div>
          {filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-12 text-sm">
              {items.length === 0 ? 'Sem produtos registados' : 'Nenhum produto corresponde aos filtros'}
            </p>
          ) : (
            filtered.map(p => (
              <div
                key={p.id}
                className="px-4 py-2.5 text-sm grid grid-cols-7 gap-2 border-b hover:bg-muted/50 cursor-pointer items-center"
                onClick={() => navigate(`/hub/produtos/${p.id}`)}
              >
                <span className="truncate font-medium">{p.name}</span>
                <span>
                  <Badge variant="outline" className={STATUS_BADGE[p.status]?.className || ''}>
                    {STATUS_BADGE[p.status]?.label || p.status}
                  </Badge>
                </span>
                <span className="truncate text-muted-foreground">{labelFor(PRODUCT_TYPE_OPTIONS, p.product_type)}</span>
                <span className="truncate text-muted-foreground">{labelFor(SALES_TYPE_OPTIONS, p.sales_type)}</span>
                <span className="truncate text-muted-foreground">{labelFor(ESCADA_OPTIONS, p.escada)}</span>
                <span className="text-muted-foreground">{p.ticket || '—'}</span>
                <span className="truncate text-muted-foreground">{p.invoice_denomination || '—'}</span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
