import { useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Plus, LayoutGrid, List, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useProducts, STATUS_OPTIONS, ESCADA_OPTIONS, Product } from '@/hooks/useProducts';

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  em_ideia: { label: 'Em Ideia', className: 'bg-muted text-muted-foreground' },
  a_criar: { label: 'A Criar', className: 'bg-amber-100 text-amber-800' },
  vendas_ativas: { label: 'Vendas Ativas', className: 'bg-green-100 text-green-800' },
  off: { label: 'Off', className: 'bg-red-100 text-red-800' },
};

function getEscadaLabel(value: string | null) {
  return ESCADA_OPTIONS.find(o => o.value === value)?.label || value || '—';
}

function getStatusBadge(status: string) {
  const s = STATUS_BADGE[status] || { label: status, className: '' };
  return <Badge variant="outline" className={s.className}>{s.label}</Badge>;
}

export default function ProdutosPage() {
  const [view, setView] = useState<'gallery' | 'list'>('gallery');
  const navigate = useNavigate();
  const { products } = useProducts();
  const items = products.data || [];

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <PageHeader title="Produtos" />
        <div className="flex items-center justify-between">
          <div />
          <Button size="sm" onClick={() => navigate('/hub/produtos/novo')}>
            <Plus className="h-4 w-4 mr-1" /> Novo Produto
          </Button>
        </div>

        {/* View toggles */}
        <div className="flex items-center gap-3">
          <ToggleGroup type="single" value={view} onValueChange={v => v && setView(v as any)}>
            <ToggleGroupItem value="gallery" aria-label="Galeria"><LayoutGrid className="h-4 w-4" /></ToggleGroupItem>
            <ToggleGroupItem value="list" aria-label="Lista"><List className="h-4 w-4" /></ToggleGroupItem>
          </ToggleGroup>
        </div>

        {/* Gallery */}
        {view === 'gallery' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {items.length === 0 && (
              <div className="col-span-full text-center py-16 text-muted-foreground">
                <p className="text-lg font-medium">Sem produtos</p>
                <p className="text-sm mt-1">Cria o teu primeiro produto.</p>
              </div>
            )}
            {items.map(p => (
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
                <CardContent className="p-4 space-y-3">
                  <h3 className="font-semibold text-base leading-snug">{p.name}</h3>
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
                  {p.ticket != null && (
                    <p className="text-sm font-semibold text-primary">
                      {Number(p.ticket).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}
                    </p>
                  )}
                  {p.escada && (
                    <p className="text-xs font-medium text-accent">{getEscadaLabel(p.escada)}</p>
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
                {items.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Sem produtos</TableCell></TableRow>
                )}
                {items.map(p => (
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
