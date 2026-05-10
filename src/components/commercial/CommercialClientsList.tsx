import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSectorConfig } from '@/hooks/useSectorConfig';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Search, X } from 'lucide-react';
import { useClients, CLIENT_STATUS_OPTIONS, Client } from '@/hooks/useClients';
import { useClientFinancialHealth, HEALTH_BADGE } from '@/hooks/useClientFinancialHealth';
import { format, parseISO, differenceInDays } from 'date-fns';
import { getClientStatusInfo } from '@/lib/clientStatus';

function EndOfCycleBadge({ date }: { date: string | null }) {
  if (!date) return <span className="text-muted-foreground">—</span>;
  const d = parseISO(date);
  const days = differenceInDays(d, new Date());
  const label = format(d, 'dd/MM/yyyy');
  if (days < 0) return <Badge variant="outline" className="bg-destructive/10 text-destructive">{label}</Badge>;
  if (days <= 30) return <Badge variant="outline" className="bg-warning/10 text-warning">{label}</Badge>;
  return <span>{label}</span>;
}

export function CommercialClientsList() {
  const navigate = useNavigate();
  const sectorConfig = useSectorConfig();
  const { clients } = useClients();
  const { getHealth } = useClientFinancialHealth();
  const items = clients.data || [];

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [productFilter, setProductFilter] = useState<string>('all');

  const products = useMemo(() => [...new Set(items.map(c => c.current_product).filter(Boolean))].sort(), [items]);

  const filtered = useMemo(() => {
    let result = items;

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(c =>
        c.full_name?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.whatsapp?.toLowerCase().includes(q) ||
        c.client_id?.toLowerCase().includes(q) ||
        c.current_product?.toLowerCase().includes(q) ||
        c.nif?.toLowerCase().includes(q) ||
        c.observations?.toLowerCase().includes(q)
      );
    }

    if (statusFilter !== 'all') {
      result = result.filter(c => c.status === statusFilter);
    }
    if (productFilter !== 'all') {
      result = result.filter(c => c.current_product === productFilter);
    }

    return result;
  }, [items, search, statusFilter, productFilter]);

  const hasFilters = search || statusFilter !== 'all' || productFilter !== 'all';

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setProductFilter('all');
  };

  return (
    <div className="space-y-4">
      {/* Search + Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar por nome, e-mail, NIF, produto..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Status</SelectItem>
            {CLIENT_STATUS_OPTIONS.map(s => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={productFilter} onValueChange={setProductFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={sectorConfig.t('produto')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Produtos</SelectItem>
            {products.map(p => (
              <SelectItem key={p!} value={p!}>{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1 text-muted-foreground">
            <X className="h-3.5 w-3.5" /> Limpar
          </Button>
        )}
      </div>

      {/* Results count */}
      <p className="text-sm text-muted-foreground">
        {filtered.length} {filtered.length === 1 ? 'cliente' : 'clientes'} encontrados
      </p>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="bg-primary text-primary-foreground px-4 py-2.5 font-medium text-xs grid grid-cols-9 gap-2">
            <span>ID</span>
            <span>Data de Início</span>
            <span>Status</span>
            <span>Nome</span>
            <span>E-mail</span>
            <span>Whatsapp</span>
            <span>Produto Atual</span>
            <span>Saúde Fin.</span>
            <span>Fim de Ciclo</span>
          </div>
          {filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-12 text-sm">
              {items.length === 0 ? 'Sem clientes registados' : 'Nenhum cliente corresponde aos filtros'}
            </p>
          ) : (
            filtered.map(c => {
              const health = getHealth(c.full_name);
              return (
                <div
                  key={c.id}
                  className="px-4 py-2.5 text-sm grid grid-cols-9 gap-2 border-b hover:bg-muted/50 cursor-pointer items-center"
                  onClick={() => navigate(`/hub/clientes/${c.id}`)}
                >
                  <span className="font-mono text-xs">{c.client_id}</span>
                  <span>{c.start_date ? format(parseISO(c.start_date), 'dd/MM/yyyy') : '—'}</span>
                  <span>
                    <Badge variant="outline" className={getClientStatusInfo(c.status).color}>
                      {getClientStatusInfo(c.status).label}
                    </Badge>
                  </span>
                  <span className="truncate">{c.full_name}</span>
                  <span className="truncate text-muted-foreground">{c.email || '—'}</span>
                  <span className="truncate text-muted-foreground">{c.whatsapp || '—'}</span>
                  <span className="truncate">{c.current_product || '—'}</span>
                  <span>
                    <Badge variant="outline" className={HEALTH_BADGE[health.status]?.className || ''}>
                      {health.label}
                    </Badge>
                  </span>
                  <span><EndOfCycleBadge date={c.end_of_cycle} /></span>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
