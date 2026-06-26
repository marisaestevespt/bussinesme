import { useState, useMemo } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, ExternalLink, Package, TrendingUp, Lightbulb, XCircle, Sparkles, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useProducts, STATUS_OPTIONS, ESCADA_OPTIONS } from '@/hooks/useProducts';
import { EntityIconDisplay } from '@/components/entity-icon';
import { ProductCoverImage } from '@/components/ProductCoverImage';
import { useConfirm } from '@/components/ui/confirm-dialog';
import {
  CollectionPage,
  CollectionHeader,
  CollectionToolbar,
  CollectionGrid,
  CollectionCard,
  CollectionViewSwitcher,
  CollectionEmpty,
  type CollectionView,
} from '@/components/layout/collection';
import { useSectorConfig } from '@/hooks/useSectorConfig';

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
  const [view, setView] = useState<CollectionView>('grid');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'ativos' | 'off'>('ativos');
  const navigate = useNavigate();
  const { products, deleteProduct } = useProducts();
  const confirm = useConfirm();
  const sectorConfig = useSectorConfig();
  const items = products.data || [];

  const handleDelete = async (e: React.MouseEvent, p: { id: string; name: string }) => {
    e.stopPropagation();
    const ok = await confirm({
      title: 'Eliminar produto?',
      description: `O produto "${p.name}" e os dados associados serão removidos permanentemente.`,
      confirmText: 'Eliminar',
      variant: 'destructive',
    });
    if (!ok) return;
    await deleteProduct.mutateAsync(p.id);
  };

  // Status counts
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    STATUS_OPTIONS.forEach(s => { counts[s.value] = 0; });
    items.forEach(p => { counts[p.status] = (counts[p.status] || 0) + 1; });
    return counts;
  }, [items]);

  // Filtered items
  const filtered = useMemo(() => {
    let list = items;
    list = tab === 'off' ? list.filter(p => p.status === 'off') : list.filter(p => p.status !== 'off');
    if (statusFilter) list = list.filter(p => p.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p =>
        p.name?.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q),
      );
    }
    return list;
  }, [items, statusFilter, search, tab]);

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

  const statusCards = tab === 'off'
    ? [{ key: 'off', label: 'Off', icon: XCircle, color: 'text-destructive' }]
    : [
        { key: 'vendas_ativas', label: 'Vendas Ativas', icon: TrendingUp, color: 'text-success' },
        { key: 'a_criar', label: 'A Criar', icon: Package, color: 'text-warning' },
        { key: 'em_ideia', label: 'Em Ideia', icon: Lightbulb, color: 'text-muted-foreground' },
      ];

  const activeCount = items.filter(p => p.status !== 'off').length;
  const offCount = items.filter(p => p.status === 'off').length;

  return (
    <AppLayout>
      <CollectionPage>
        <CollectionHeader
          title={sectorConfig.t('produtos')}
          icon={Package}
          description="Catálogo de produtos, escada de valor e entregas."
          count={items.length}
          actions={
            <Button size="sm" onClick={() => navigate('/hub/produtos/novo')}>
              <Plus className="h-4 w-4 mr-1" /> Novo Produto
            </Button>
          }
        />

        {/* Summary Cards (filter chips) */}
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
              <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5" /> Escada de Valor
              </h3>
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

        {/* Tabs: Produtos / Off */}
        <div className="inline-flex rounded-lg border bg-muted/30 p-1">
          <Button
            variant={tab === 'ativos' ? 'default' : 'ghost'}
            size="sm"
            className="h-8"
            onClick={() => { setTab('ativos'); setStatusFilter(null); }}
          >
            Produtos <span className="ml-1.5 text-xs opacity-70">({activeCount})</span>
          </Button>
          <Button
            variant={tab === 'off' ? 'default' : 'ghost'}
            size="sm"
            className="h-8"
            onClick={() => { setTab('off'); setStatusFilter(null); }}
          >
            Off <span className="ml-1.5 text-xs opacity-70">({offCount})</span>
          </Button>
        </div>

        {/* Toolbar */}
        <CollectionToolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Pesquisar produto…"
          trailing={
            <CollectionViewSwitcher value={view} onChange={setView} />
          }
        >
          {statusFilter && (
            <Button variant="ghost" size="sm" className="text-xs h-8" onClick={() => setStatusFilter(null)}>
              ✕ Limpar filtro
            </Button>
          )}
          <span className="text-xs text-muted-foreground">{filtered.length} resultado{filtered.length !== 1 ? 's' : ''}</span>
        </CollectionToolbar>

        {/* Gallery */}
        {view === 'grid' && (
          filtered.length === 0 ? (
            <CollectionEmpty
              icon={Package}
              title="Sem produtos"
              description={statusFilter || search ? 'Nenhum produto corresponde aos filtros.' : 'Cria o teu primeiro produto para começar.'}
              action={!statusFilter && !search && (
                <Button size="sm" onClick={() => navigate('/hub/produtos/novo')}>
                  <Plus className="h-4 w-4 mr-1" /> Novo Produto
                </Button>
              )}
            />
          ) : (
            <CollectionGrid density="compact">
              {filtered.map(p => (
                <CollectionCard
                  key={p.id}
                  title={p.name}
                  description={p.description || undefined}
                  status={getStatusBadge(p.status)}
                  cover={
                    p.cover_url ? (
                      <ProductCoverImage url={p.cover_url} alt={p.name} className="h-full w-full object-cover" />
                    ) : (p as any).icon || p.logo_url ? (
                      <div className="flex h-full w-full items-center justify-center bg-muted/20">
                        <EntityIconDisplay
                          icon={(p as any).icon ?? (p.logo_url ? { type: 'image', value: p.logo_url } : null)}
                          className="h-20 w-20"
                          emojiClassName="text-5xl"
                        />
                      </div>
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-3xl font-bold text-muted-foreground/20">{p.name?.charAt(0)}</div>
                    )
                  }
                  meta={
                    <>
                      {p.ticket != null && (
                        <span className="font-semibold text-primary">
                          {Number(p.ticket).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}
                        </span>
                      )}
                      {p.escada && <span>· {getEscadaLabel(p.escada)}</span>}
                      {p.sales_page_url && (
                        <a
                          href={p.sales_page_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-auto inline-flex items-center gap-1 text-primary hover:underline"
                          onClick={e => e.stopPropagation()}
                        >
                          <ExternalLink className="h-3 w-3" /> Landing
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={(e) => handleDelete(e, p)}
                        className="ml-auto inline-flex items-center gap-1 text-muted-foreground hover:text-destructive transition-colors"
                        title="Eliminar produto"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </>
                  }
                  onClick={() => navigate(`/hub/produtos/${p.id}`)}
                />
              ))}
            </CollectionGrid>
          )
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
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Sem produtos</TableCell></TableRow>
                )}
                {filtered.map(p => (
                  <TableRow key={p.id} className="cursor-pointer" onClick={() => navigate(`/hub/produtos/${p.id}`)}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <EntityIconDisplay
                          icon={(p as any).icon ?? (p.logo_url ? { type: 'image', value: p.logo_url } : null)}
                          className="h-7 w-7"
                          emojiClassName="text-base"
                        />
                        <span>{p.name}</span>
                      </div>
                    </TableCell>
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
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={(e) => handleDelete(e, p)}
                        title="Eliminar produto"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}

      </CollectionPage>
    </AppLayout>
  );
}