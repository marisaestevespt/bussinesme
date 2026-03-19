import { useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Plus, LayoutGrid, List, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useProducts, STATUS_OPTIONS, ESCADA_OPTIONS, Product } from '@/hooks/useProducts';
import { useCommercialData } from '@/hooks/useCommercialData';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const MONTH_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

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
  const commercialData = useCommercialData();

  const items = products.data || [];
  const activeProducts = items.filter(p => p.status === 'vendas_ativas');

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const yearSales = commercialData.sales.data || [];

  // Monthly sales count for line chart
  const lineData = MONTH_LABELS.map((name, i) => ({
    name,
    vendas: yearSales.filter(s => s.sale_month === i + 1).length,
  }));

  // Current month base value total for donut
  const monthSales = yearSales.filter(s => s.sale_month === currentMonth);
  const monthBaseTotal = monthSales.reduce((s, v) => s + Number(v.base_value || 0), 0);
  const donutData = [
    { name: 'Faturado', value: monthBaseTotal },
    { name: 'Restante', value: Math.max(0, (commercialData.annualGoalAmount / 12) - monthBaseTotal) },
  ];
  const COLORS = ['hsl(var(--primary))', 'hsl(var(--muted))'];

  const fmt = (v: number) => v.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => navigate(`/hub/produtos/${p.id}`)}
              >
                {p.cover_url && (
                  <div className="w-full h-32 -mx-4 -mt-4 mb-2 overflow-hidden rounded-t-lg">
                    <img src={p.cover_url} alt={p.name} className="w-full h-full object-cover" />
                  </div>
                )}
                <CardContent className="p-4 pt-0 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-sm leading-tight">{p.name}</h3>
                    {getStatusBadge(p.status)}
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    {p.ticket && <span>Ticket: {p.ticket}</span>}
                    {p.escada && <Badge variant="outline" className="text-xs">{getEscadaLabel(p.escada)}</Badge>}
                  </div>
                  {p.sales_page_url && (
                    <a
                      href={p.sales_page_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary flex items-center gap-1 hover:underline"
                      onClick={e => e.stopPropagation()}
                    >
                      <ExternalLink className="h-3 w-3" /> Página de Vendas
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

        {/* Dashboard */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Active products */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                Ativos
                <Badge variant="secondary">{activeProducts.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {activeProducts.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhum produto com vendas ativas.</p>
              )}
              {activeProducts.map(p => (
                <div key={p.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <span className="text-sm font-medium">{p.name}</span>
                  <span className="text-sm text-muted-foreground">{p.ticket || '—'}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Sales flow */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Fluxo de Vendas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={lineData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="name" className="text-xs" />
                      <YAxis className="text-xs" allowDecimals={false} />
                      <Tooltip />
                      <Line type="monotone" dataKey="vendas" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="h-[200px] flex flex-col items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={donutData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} dataKey="value" paddingAngle={2}>
                        {donutData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => `€${fmt(v)}`} />
                    </PieChart>
                  </ResponsiveContainer>
                  <p className="text-xs text-muted-foreground mt-1">Valor Base este mês: €{fmt(monthBaseTotal)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
