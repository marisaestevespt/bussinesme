import { useState, useMemo, useCallback } from 'react';
import { InfiniteScrollList } from '@/components/InfiniteScrollList';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, BarChart3, Globe, MessageSquare } from 'lucide-react';
import { useClients, CLIENT_STATUS_OPTIONS, Client } from '@/hooks/useClients';
import { useProducts } from '@/hooks/useProducts';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { format, parseISO, differenceInDays } from 'date-fns';
import { pt } from 'date-fns/locale';

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  em_onboarding: { label: 'Em onboarding', className: 'bg-blue-100 text-blue-800' },
  ativo: { label: 'Ativo', className: 'bg-green-100 text-green-800' },
  pausado: { label: 'Pausado', className: 'bg-amber-100 text-amber-800' },
  altura_renovacao: { label: 'Altura de renovação', className: 'bg-purple-100 text-purple-800' },
  terminado: { label: 'Terminado', className: 'bg-muted text-muted-foreground' },
};

function EndOfCycleBadge({ date }: { date: string | null }) {
  if (!date) return <span className="text-muted-foreground">—</span>;
  const d = parseISO(date);
  const days = differenceInDays(d, new Date());
  const label = format(d, 'dd/MM/yyyy');
  if (days < 0) return <Badge variant="outline" className="bg-red-100 text-red-800">{label}</Badge>;
  if (days <= 30) return <Badge variant="outline" className="bg-amber-100 text-amber-800">{label}</Badge>;
  return <span>{label}</span>;
}

export default function ClientesPage() {
  const navigate = useNavigate();
  const { clients } = useClients();
  const { products } = useProducts();

  const items = clients.data || [];
  const activeCount = items.filter(c => c.status !== 'terminado').length;

  // Donut data
  const donutData = [
    { name: 'Ativos', value: activeCount },
    { name: 'Outros', value: Math.max(0, items.length - activeCount) || (activeCount === 0 ? 1 : 0) },
  ];
  const COLORS = ['hsl(var(--primary))', 'hsl(var(--muted))'];

  // Bar chart: clients by product
  const byProduct = useMemo(() => {
    const map: Record<string, number> = {};
    items.forEach(c => {
      const p = c.current_product || 'Sem Produto';
      map[p] = (map[p] || 0) + 1;
    });
    return Object.entries(map).map(([name, count]) => ({ name, count }));
  }, [items]);

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <PageHeader title="Clientes" subtitle="Gestão de clientes, acompanhamento e satisfação." />
        <div className="flex items-center justify-between">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 flex-1 mr-4">
            {[
              { path: '/hub/clientes/analise', label: 'Análise de Clientes', icon: BarChart3, iconColor: 'text-blue-600', color: 'from-blue-500/10 to-blue-600/5 hover:from-blue-500/20 hover:to-blue-600/10' },
              { path: '/hub/clientes/portais', label: 'Portal de Clientes', icon: Globe, iconColor: 'text-violet-600', color: 'from-violet-500/10 to-violet-600/5 hover:from-violet-500/20 hover:to-violet-600/10' },
              { path: '/hub/clientes/feedback', label: 'Feedbacks', icon: MessageSquare, iconColor: 'text-amber-600', color: 'from-amber-500/10 to-amber-600/5 hover:from-amber-500/20 hover:to-amber-600/10' },
            ].map(s => (
              <Card
                key={s.path}
                className={`group cursor-pointer border bg-gradient-to-br ${s.color} transition-all duration-200 hover:shadow-md hover:-translate-y-0.5`}
                onClick={() => navigate(s.path)}
              >
                <CardContent className="p-4 flex items-center gap-3">
                  <div className={`h-9 w-9 rounded-lg bg-background/80 flex items-center justify-center shadow-sm shrink-0 ${s.iconColor}`}>
                    <s.icon className="h-4 w-4" />
                  </div>
                  <span className="font-medium text-sm">{s.label}</span>
                </CardContent>
              </Card>
            ))}
          </div>
          <Button size="sm" onClick={() => navigate('/hub/clientes/novo')}>
            <Plus className="h-4 w-4 mr-1" /> Novo Cliente
          </Button>
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

        {/* Full table */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Lista Completa de Clientes & Alunos</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <InfiniteScrollList
              totalCount={clients.totalCount}
              loadedCount={items.length}
              hasNextPage={clients.hasNextPage}
              isFetchingNextPage={clients.isFetchingNextPage}
              fetchNextPage={clients.fetchNextPage}
            >
              <div className="bg-primary text-primary-foreground px-4 py-2.5 font-medium text-xs grid grid-cols-9 gap-2">
                <span>ID</span>
                <span>Data de Início</span>
                <span>Status</span>
                <span>Nome</span>
                <span>E-mail</span>
                <span>Whatsapp</span>
                <span>Produto Atual</span>
                <span>F. Pagamento</span>
                <span>Fim de Ciclo</span>
              </div>
              {items.length === 0 ? (
                <p className="text-center text-muted-foreground py-12 text-sm">Sem clientes registados</p>
              ) : (
                items.map(c => (
                  <div
                    key={c.id}
                    className="px-4 py-2.5 text-sm grid grid-cols-9 gap-2 border-b hover:bg-muted/50 cursor-pointer items-center"
                    onClick={() => navigate(`/hub/clientes/${c.id}`)}
                  >
                    <span className="font-mono text-xs">{c.client_id}</span>
                    <span>{c.start_date ? format(parseISO(c.start_date), 'dd/MM/yyyy') : '—'}</span>
                    <span>
                      <Badge variant="outline" className={STATUS_BADGE[c.status]?.className || ''}>
                        {STATUS_BADGE[c.status]?.label || c.status}
                      </Badge>
                    </span>
                    <span className="truncate">{c.full_name}</span>
                    <span className="truncate text-muted-foreground">{c.email || '—'}</span>
                    <span className="truncate text-muted-foreground">{c.whatsapp || '—'}</span>
                    <span className="truncate">{c.current_product || '—'}</span>
                    <span className="text-muted-foreground">{c.payment_method || '—'}</span>
                    <span><EndOfCycleBadge date={c.end_of_cycle} /></span>
                  </div>
                ))
              )}
            </InfiniteScrollList>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
