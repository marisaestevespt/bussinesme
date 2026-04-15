import { useState, useMemo, useCallback } from 'react';
import { InfiniteScrollList } from '@/components/InfiniteScrollList';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, BarChart3, Globe, MessageSquare } from 'lucide-react';
import { useClients, CLIENT_STATUS_OPTIONS, Client } from '@/hooks/useClients';
import { useProducts } from '@/hooks/useProducts';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { format, parseISO } from 'date-fns';

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  em_onboarding: { label: 'Em onboarding', className: 'bg-blue-100 text-blue-800' },
  ativo: { label: 'Ativo', className: 'bg-green-100 text-green-800' },
  pausado: { label: 'Pausado', className: 'bg-amber-100 text-amber-800' },
  altura_renovacao: { label: 'Altura de renovação', className: 'bg-purple-100 text-purple-800' },
  em_offboarding: { label: 'Em offboarding', className: 'bg-orange-100 text-orange-800' },
  terminado: { label: 'Terminado', className: 'bg-muted text-muted-foreground' },
};

const ACTIVE_STATUSES = ['em_onboarding', 'ativo', 'pausado', 'altura_renovacao', 'em_offboarding'];
const ARCHIVED_STATUSES = ['terminado'];

export default function ClientesPage() {
  const navigate = useNavigate();
  const { clients } = useClients();
  const { products } = useProducts();
  const [tab, setTab] = useState<'ativos' | 'arquivados'>('ativos');

  const items = clients.data || [];
  const activeItems = useMemo(() => items.filter(c => ACTIVE_STATUSES.includes(c.status)), [items]);
  const archivedItems = useMemo(() => items.filter(c => ARCHIVED_STATUSES.includes(c.status)), [items]);
  const displayItems = tab === 'ativos' ? activeItems : archivedItems;

  const activeCount = activeItems.length;

  // Donut data
  const donutData = [
    { name: 'Ativos', value: activeCount },
    { name: 'Outros', value: Math.max(0, items.length - activeCount) || (activeCount === 0 ? 1 : 0) },
  ];
  const COLORS = ['hsl(var(--primary))', 'hsl(var(--muted))'];

  // Bar chart: clients by product
  const byProduct = useMemo(() => {
    const map: Record<string, number> = {};
    activeItems.forEach(c => {
      const p = c.current_product || 'Sem Produto';
      map[p] = (map[p] || 0) + 1;
    });
    return Object.entries(map).map(([name, count]) => ({ name, count }));
  }, [activeItems]);

  const renderClientRow = (c: Client) => (
    <div
      key={c.id}
      className="px-6 py-2.5 text-sm border-b hover:bg-muted/50 cursor-pointer"
      onClick={() => navigate(`/hub/clientes/${c.id}`)}
    >
      {/* Desktop: grid row */}
      <div className="hidden md:grid grid-cols-6 gap-2 items-center">
        <span className="font-mono text-xs">{c.client_id}</span>
        <span>
          <Badge variant="outline" className={STATUS_BADGE[c.status]?.className || ''}>
            {STATUS_BADGE[c.status]?.label || c.status}
          </Badge>
        </span>
        <span className="truncate">{c.full_name}</span>
        <span className="truncate text-muted-foreground">{c.email || '—'}</span>
        <span className="truncate text-muted-foreground">{c.whatsapp || '—'}</span>
        <span className="truncate">{c.current_product || '—'}</span>
      </div>
      {/* Mobile: stacked */}
      <div className="md:hidden space-y-1">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium truncate">{c.full_name}</span>
          <Badge variant="outline" className={`shrink-0 text-[10px] ${STATUS_BADGE[c.status]?.className || ''}`}>
            {STATUS_BADGE[c.status]?.label || c.status}
          </Badge>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="font-mono">{c.client_id}</span>
          {c.current_product && <span>· {c.current_product}</span>}
        </div>
      </div>
    </div>
  );

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader title="Clientes" subtitle="Gestão de clientes, acompanhamento e satisfação." />
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 flex-1">
            {[
              { path: '/hub/clientes/analise', label: 'Análise de Clientes', icon: BarChart3, iconColor: 'text-blue-600', color: 'from-blue-500/20 to-blue-600/10 border-blue-200/60 hover:from-blue-500/30 hover:to-blue-600/15 hover:border-blue-300/80' },
              { path: '/hub/clientes/portais', label: 'Portal de Clientes', icon: Globe, iconColor: 'text-violet-600', color: 'from-violet-500/20 to-violet-600/10 border-violet-200/60 hover:from-violet-500/30 hover:to-violet-600/15 hover:border-violet-300/80' },
              { path: '/hub/clientes/feedback', label: 'Feedbacks', icon: MessageSquare, iconColor: 'text-amber-600', color: 'from-amber-500/20 to-amber-600/10 border-amber-200/60 hover:from-amber-500/30 hover:to-amber-600/15 hover:border-amber-300/80' },
            ].map(s => (
              <Card
                key={s.path}
                className={`group cursor-pointer border bg-gradient-to-br ${s.color} transition-all duration-200 hover:shadow-md hover:-translate-y-0.5`}
                onClick={() => navigate(s.path)}
              >
                <CardContent className="p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
                  <div className={`h-8 w-8 sm:h-9 sm:w-9 rounded-lg bg-background/80 flex items-center justify-center shadow-sm shrink-0 ${s.iconColor}`}>
                    <s.icon className="h-4 w-4" />
                  </div>
                  <span className="font-medium text-xs sm:text-sm leading-tight">{s.label}</span>
                </CardContent>
              </Card>
          ))}
          </div>
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Clientes Ativos</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-center h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={donutData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} dataKey="value" stroke="none">
                    {donutData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute text-2xl font-bold">{activeCount}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Por Produto</CardTitle>
            </CardHeader>
            <CardContent className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byProduct} margin={{ bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis type="category" dataKey="name" tick={{ fontSize: 11 }} interval={0} />
                  <YAxis type="number" allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Client list with tabs */}
        <Card className="shadow-sm">
          <CardHeader className="pb-4 pt-5 px-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <CardTitle className="text-base font-semibold">Lista de Clientes & Alunos</CardTitle>
              </div>
              <div className="flex items-center gap-2">
                <Tabs value={tab} onValueChange={v => setTab(v as any)}>
                  <TabsList className="h-8">
                    <TabsTrigger value="ativos" className="text-xs px-3">
                      Ativos ({activeItems.length})
                    </TabsTrigger>
                    <TabsTrigger value="arquivados" className="text-xs px-3">
                      Arquivados ({archivedItems.length})
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
                <Button size="sm" onClick={() => navigate('/hub/clientes/novo')}>
                  <Plus className="h-4 w-4 mr-1" /> Novo Cliente
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0 pt-1">
            <InfiniteScrollList
              totalCount={clients.totalCount}
              loadedCount={items.length}
              hasNextPage={clients.hasNextPage}
              isFetchingNextPage={clients.isFetchingNextPage}
              fetchNextPage={clients.fetchNextPage}
            >
              <div className="hidden md:grid bg-primary text-primary-foreground px-6 py-2.5 font-medium text-xs grid-cols-6 gap-2">
                <span>ID</span>
                <span>Status</span>
                <span>Nome</span>
                <span>E-mail</span>
                <span>Whatsapp</span>
                <span>Produto Atual</span>
              </div>
              {displayItems.length === 0 ? (
                <p className="text-center text-muted-foreground py-12 text-sm">
                  {tab === 'ativos' ? 'Sem clientes ativos' : 'Sem clientes arquivados'}
                </p>
              ) : (
                displayItems.map(renderClientRow)
              )}
            </InfiniteScrollList>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
