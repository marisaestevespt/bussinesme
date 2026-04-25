import { useState, useMemo } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Plus, LayoutGrid, List, ExternalLink, Package, TrendingUp, Lightbulb, XCircle, ArrowUpRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useProducts, STATUS_OPTIONS, ESCADA_OPTIONS, Product } from '@/hooks/useProducts';

const STATUS_BADGE: Record<string, { label: string; className: string; icon: any }> = {
  em_ideia: { label: 'Em Ideia', className: 'bg-muted text-muted-foreground', icon: Lightbulb },
  a_criar: { label: 'A Criar', className: 'bg-warning/15 text-warning', icon: Package },
  vendas_ativas: { label: 'Vendas Ativas', className: 'bg-success/15 text-success', icon: TrendingUp },
  off: { label: 'Off', className: 'bg-destructive/15 text-destructive', icon: XCircle },
};

function getEscadaLabel(value: string | null) {
  return ESCADA_OPTIONS.find(o => o.value === value)?.label || value || '—';
}

function getStatusBadge(status: string) {
  const s = STATUS_BADGE[status] || { label: status, className: '' };
  return <Badge variant="outline" className={s.className}>{s.label}</Badge>;
}

const ESCADA_ORDER = ESCADA_OPTIONS.map(o => o.value);

export default function ProdutosPage() {
  const [view, setView] = useState<'gallery' | 'list'>('gallery');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const navigate = useNavigate();
  const { products } = useProducts();
  const items = products.data || [];

  // Status counts
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    STATUS_OPTIONS.forEach(s => { counts[s.value] = 0; });
    items.forEach(p => { counts[p.status] = (counts[p.status] || 0) + 1; });
    return counts;
  }, [items]);

  // Filtered items
  const filtered = useMemo(() => {
    if (!statusFilter) return items;
    return items.filter(p => p.status === statusFilter);
  }, [items, statusFilter]);

  // Escada de valor — only products with escada set, sorted
  const escadaProducts = useMemo(() => {
    return items
      .filter(p => p.escada && p.status !== 'off')
      .sort((a, b) => {
        const ai = ESCADA_ORDER.indexOf(a.escada as any);
        const bi = ESCADA_ORDER.indexOf(b.escada as any);
        return ai - bi;
      });
  }, [items]);

  const statusCards = [
    { key: 'vendas_ativas', label: 'Vendas Ativas', icon: TrendingUp, color: 'text-success' },
    { key: 'a_criar', label: 'A Criar', icon: Package, color: 'text-warning' },
    { key: 'em_ideia', label: 'Em Ideia', icon: Lightbulb, color: 'text-muted-foreground' },
    { key: 'off', label: 'Off', icon: XCircle, color: 'text-destructive' },
  ];

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader title="Produtos" subtitle="Catálogo de produtos, escada de valor e entregas." department="produtos" />

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {statusCards.map(sc => {
            const Icon = sc.icon;
            const isActive = statusFilter === sc.key;
            return (
              <Card
                key={sc.key}
                className={`cursor-pointer transition-all hover:shadow-md ${isActive ? 'ring-2 ring-primary' : ''}`}
                onClick={() => setStatusFilter(isActive ? null : sc.key)}
              >
                <CardContent className="p-4 flex items-center gap-3">
                  <div className={`p-2 rounded-lg bg-muted/50`}>
                    <Icon className={`h-4 w-4 ${sc.color}`} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{statusCounts[sc.key] || 0}</p>
                    <p className="text-xs text-muted-foreground">{sc.label}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Escada de Valor */}
        {escadaProducts.length > 0 && (
          <Card>
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">Escada de Valor</h3>
              <div className="flex items-end gap-2 overflow-x-auto pb-2">
                {escadaProducts.map((p, i) => {
                  const stepHeight = 48 + i * 20;
                  const ticket = p.ticket ? Number(p.ticket) : null;
                  return (
                    <div
                      key={p.id}
                      className="flex flex-col items-center gap-2 min-w-[100px] cursor-pointer group"
                      onClick={() => navigate(`/hub/produtos/${p.id}`)}
                    >
                      <span className="text-[10px] text-muted-foreground text-center leading-tight">
                        {getEscadaLabel(p.escada)}
                      </span>
                      <div
                        className="w-full rounded-t-md bg-primary/10 group-hover:bg-primary/20 transition-colors flex items-end justify-center px-2 pb-2 border border-b-0 border-primary/20"
                        style={{ height: `${stepHeight}px` }}
                      >
                        <div className="text-center">
                          <p className="text-xs font-semibold leading-tight line-clamp-2">{p.name}</p>
                          {ticket != null && (
                            <p className="text-[10px] font-bold text-primary mt-0.5">
                              {ticket.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Active filter indicator + View toggles */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ToggleGroup type="single" value={view} onValueChange={v => v && setView(v as any)}>
              <ToggleGroupItem value="gallery" aria-label="Galeria"><LayoutGrid className="h-4 w-4" /></ToggleGroupItem>
              <ToggleGroupItem value="list" aria-label="Lista"><List className="h-4 w-4" /></ToggleGroupItem>
            </ToggleGroup>
            {statusFilter && (
              <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setStatusFilter(null)}>
                ✕ Limpar filtro
              </Button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <p className="text-xs text-muted-foreground">{filtered.length} produto{filtered.length !== 1 ? 's' : ''}</p>
            <Button size="sm" onClick={() => navigate('/hub/produtos/novo')}>
              <Plus className="h-4 w-4 mr-1" /> Novo Produto
            </Button>
          </div>
        </div>

        {/* Gallery */}
        {view === 'gallery' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.length === 0 && (
              <div className="col-span-full text-center py-16 text-muted-foreground">
                <p className="text-lg font-medium">Sem produtos</p>
                <p className="text-sm mt-1">{statusFilter ? 'Nenhum produto com este status.' : 'Cria o teu primeiro produto.'}</p>
              </div>
            )}
            {filtered.map(p => (
              <Card
                key={p.id}
                className="cursor-pointer hover:shadow-md transition-shadow overflow-hidden"
                onClick={() => navigate(`/hub/produtos/${p.id}`)}
              >
                <div className="w-full h-36 overflow-hidden bg-muted/30 flex items-center justify-center">
                  {p.cover_url ? (
                    <img src={p.cover_url} alt={p.name} className="w-full h-full object-cover" />
                  ) : p.logo_url ? (
                    <img src={p.logo_url} alt={p.name} className="h-16 w-16 object-contain" />
                  ) : (
                    <span className="text-3xl font-bold text-muted-foreground/20">{p.name?.charAt(0)}</span>
                  )}
                </div>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-base leading-snug">{p.name}</h3>
                    {getStatusBadge(p.status)}
                  </div>
                  {p.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{p.description}</p>
                  )}
                  <div className="flex items-center justify-between pt-1">
                    {p.ticket != null ? (
                      <p className="text-sm font-semibold text-primary">
                        {Number(p.ticket).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}
                      </p>
                    ) : <span />}
                    {p.escada && (
                      <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{getEscadaLabel(p.escada)}</span>
                    )}
                  </div>
                  {p.sales_page_url && (
                    <a
                      href={p.sales_page_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary flex items-center gap-1 hover:underline"
                      onClick={e => e.stopPropagation()}
                    >
                      <ExternalLink className="h-3 w-3" /> Landing Page
                    </a>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* List */}
        {view === 'list' && (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Tipo de Produto</TableHead>
                  <TableHead>Tipo de Vendas</TableHead>
                  <TableHead>Escada</TableHead>
                  <TableHead>Ticket</TableHead>
                  <TableHead>Página de Vendas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Sem produtos</TableCell></TableRow>
                )}
                {filtered.map(p => (
                  <TableRow key={p.id} className="cursor-pointer" onClick={() => navigate(`/hub/produtos/${p.id}`)}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>{getStatusBadge(p.status)}</TableCell>
                    <TableCell className="text-sm">{p.product_type || '—'}</TableCell>
                    <TableCell className="text-sm">{p.sales_type || '—'}</TableCell>
                    <TableCell className="text-sm">{getEscadaLabel(p.escada)}</TableCell>
                    <TableCell className="text-sm">{p.ticket || '—'}</TableCell>
                    <TableCell>
                      {p.sales_page_url ? (
                        <a href={p.sales_page_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline" onClick={e => e.stopPropagation()}>
                          <ExternalLink className="h-3.5 w-3.5 inline mr-1" />Link
                        </a>
                      ) : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}

      </div>
    </AppLayout>
  );
}