import { useState, useMemo } from 'react';
import { InfiniteScrollList } from '@/components/InfiniteScrollList';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, BarChart3, Globe, MessageSquare, Users, ChevronDown, Archive } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AddLegacyClientDialog } from '@/components/clients/AddLegacyClientDialog';
import { useClients, Client } from '@/hooks/useClients';
import { useProducts } from '@/hooks/useProducts';
import { ProductIcon } from '@/components/entity-icon';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { format, parseISO } from 'date-fns';
import {
  CollectionPage,
  CollectionToolbar,
  CollectionEmpty,
} from '@/components/layout/collection';
import { EntityTabs, EntityTabsList, EntityTabsTrigger } from '@/components/layout/entity';
import { getPlanningSection } from '@/lib/department-planning';
import { useDetailAccessMap } from '@/hooks/useDetailAccess';
import { Lock } from 'lucide-react';

const fmtDate = (d: string | null | undefined) => {
  if (!d) return '—';
  try { return format(parseISO(d), 'dd/MM/yyyy'); } catch { return '—'; }
};
const fmtBirthday = (d: string | null | undefined) => {
  if (!d) return '—';
  try { return format(parseISO(d), 'dd/MM'); } catch { return '—'; }
};
import { getClientStatusInfo, ACTIVE_CLIENT_STATUSES, ARCHIVED_CLIENT_STATUSES } from '@/lib/clientStatus';
import { useSectorConfig } from '@/hooks/useSectorConfig';

const ACTIVE_STATUSES: string[] = ACTIVE_CLIENT_STATUSES;
const ARCHIVED_STATUSES: string[] = ARCHIVED_CLIENT_STATUSES;

export default function ClientesPage() {
  const navigate = useNavigate();
  const { clients } = useClients();
  const { products } = useProducts();
  const sectorConfig = useSectorConfig();
  const [tab, setTab] = useState<'ativos' | 'arquivados' | 'historico'>('ativos');
  const [legacyDialogOpen, setLegacyDialogOpen] = useState(false);

  const items = clients.data || [];
  const legacyItems = useMemo(() => items.filter(c => (c as any).is_legacy === true), [items]);
  const activeItems = useMemo(() => items.filter(c => !(c as any).is_legacy && ACTIVE_STATUSES.includes(c.status)), [items]);
  const archivedItems = useMemo(() => items.filter(c => !(c as any).is_legacy && ARCHIVED_STATUSES.includes(c.status)), [items]);
  const displayItems = tab === 'ativos' ? activeItems : tab === 'arquivados' ? archivedItems : legacyItems;

  // Cadeado por linha: precalcular permissão de abertura
  const ids = useMemo(() => displayItems.map((c: any) => c.id), [displayItems]);
  const { data: accessMap = {} } = useDetailAccessMap('client', ids);

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

  const renderClientRow = (c: Client) => {
    const canOpen = accessMap[c.id] !== false; // default optimista enquanto carrega
    return (
    <TableRow
      key={c.id}
      className={canOpen ? 'cursor-pointer' : 'cursor-not-allowed opacity-70'}
      onClick={() => { if (canOpen) navigate(`/hub/clientes/${c.id}`); }}
      title={canOpen ? undefined : 'Não tens acesso a este cliente'}
    >
      <TableCell className="font-medium max-w-[220px] truncate" title={c.full_name}>
        <span className="inline-flex items-center gap-1.5">
          {!canOpen && <Lock className="h-3 w-3 text-muted-foreground shrink-0" />}
          <span className="truncate">{c.full_name}</span>
        </span>
      </TableCell>
      <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">{c.client_id}</TableCell>
      <TableCell className="whitespace-nowrap">
        <Badge variant="outline" className={`whitespace-nowrap ${getClientStatusInfo(c.status).color}`}>
          {getClientStatusInfo(c.status).label}
        </Badge>
      </TableCell>
      <TableCell className="max-w-[200px]">
        <span className="inline-flex items-center gap-1.5 min-w-0">
          {(c.current_product_id || c.current_product) && (
            <ProductIcon productId={c.current_product_id as any} className="h-4 w-4 shrink-0" emojiClassName="text-xs" />
          )}
          <span className="truncate">{c.current_product || '—'}</span>
        </span>
      </TableCell>
      <TableCell className="text-muted-foreground tabular-nums whitespace-nowrap">{fmtDate(c.start_date)}</TableCell>
      <TableCell className="text-muted-foreground tabular-nums whitespace-nowrap">{fmtDate(c.end_of_cycle)}</TableCell>
      <TableCell className="text-muted-foreground max-w-[220px] truncate" title={c.email || ''}>{c.email || '—'}</TableCell>
      <TableCell className="text-muted-foreground whitespace-nowrap">{c.whatsapp || '—'}</TableCell>
    </TableRow>
  );};

  return (
    <AppLayout>
      <PageHeader title={sectorConfig.t('clientes')} subtitle={`Gestão de ${sectorConfig.t('clientes').toLowerCase()}, acompanhamento e satisfação.`} department="clientes" />
      <CollectionPage className="pt-6">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 flex-1">
            {[
              // Planeamento sempre primeiro (regra: ver mem://design/department-planning-card.md)
              (() => { const p = getPlanningSection('clientes'); return { path: p.path, label: p.label, icon: p.icon, iconColor: p.iconColor, color: p.color }; })(),
              { path: '/hub/clientes/analise', label: 'Análise de Clientes', icon: BarChart3, iconColor: 'text-info', color: 'from-info/20 to-info/10 border-info/30/60 hover:from-info/30 hover:to-info/15 hover:border-info/30/80' },
              { path: '/hub/clientes/portais', label: 'Portal de Clientes', icon: Globe, iconColor: 'text-accent-violet', color: 'from-accent-violet/20 to-accent-violet/10 border-accent-violet/60 hover:from-accent-violet/30 hover:to-accent-violet/15 hover:border-accent-violet/80' },
              { path: '/hub/clientes/feedback', label: 'Feedbacks', icon: MessageSquare, iconColor: 'text-warning', color: 'from-warning/20 to-warning/10 border-warning/30/60 hover:from-warning/30 hover:to-warning/15 hover:border-warning/30/80' },
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
                <BarChart data={byProduct} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 11 }}
                    width={120}
                    interval={0}
                  />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Client list */}
        <CollectionToolbar
          trailing={
            <div className="flex items-center gap-2">
              <EntityTabs value={tab} onValueChange={v => setTab(v as any)}>
                <EntityTabsList>
                  <EntityTabsTrigger value="ativos">Ativos · {activeItems.length}</EntityTabsTrigger>
                  <EntityTabsTrigger value="arquivados">Arquivados · {archivedItems.length}</EntityTabsTrigger>
                  <EntityTabsTrigger value="historico">Histórico · {legacyItems.length}</EntityTabsTrigger>
                </EntityTabsList>
              </EntityTabs>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-1" /> Novo Cliente <ChevronDown className="h-3 w-3 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => navigate('/hub/clientes/novo')}>
                    <Plus className="h-4 w-4 mr-2" /> Cliente novo (com projeto)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setLegacyDialogOpen(true)}>
                    <Archive className="h-4 w-4 mr-2" /> Cliente histórico (arquivo)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          }
        >
          <h2 className="text-sm font-semibold">Lista de Clientes & Alunos</h2>
        </CollectionToolbar>
        <div className="rounded-xl border border-border/60 bg-card overflow-hidden shadow-sm">
          <InfiniteScrollList
            totalCount={clients.totalCount}
            loadedCount={items.length}
            hasNextPage={clients.hasNextPage}
            isFetchingNextPage={clients.isFetchingNextPage}
            fetchNextPage={clients.fetchNextPage}
          >
            {displayItems.length === 0 ? (
              <CollectionEmpty
                icon={Users}
                title={tab === 'ativos' ? 'Sem clientes ativos' : tab === 'arquivados' ? 'Sem clientes arquivados' : 'Sem clientes históricos'}
                description={tab === 'ativos' ? 'Adiciona um novo cliente para começar.' : tab === 'arquivados' ? 'Quando arquivares clientes, aparecem aqui.' : 'Adiciona registos de clientes antigos para arquivo.'}
                className="border-0"
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>ID</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>Início</TableHead>
                    <TableHead>Fim ciclo</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Contacto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayItems.map(renderClientRow)}
                </TableBody>
              </Table>
            )}
          </InfiniteScrollList>
        </div>
        <AddLegacyClientDialog open={legacyDialogOpen} onOpenChange={setLegacyDialogOpen} />
      </CollectionPage>
    </AppLayout>
  );
}
