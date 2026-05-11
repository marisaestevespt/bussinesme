import { useQuery } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';
import { Users, ExternalLink, FolderOpen } from 'lucide-react';
import { SharedClientsList, type SharedClientItem } from '@/components/shared/SharedClientsList';
import { EmptyHint } from '@/components/ui/loading-skeletons';
import { saleRevenue } from '@/lib/salesCalculations';
import { formatNumber } from '@/lib/formatting';
import { getStatusInfo, getTypeInfo } from '@/pages/Projetos';

interface Props {
  productId: string;
  productName: string;
}

export function ProductClientsHub({ productId, productName }: Props) {
  const navigate = useNavigate();

  // Active clients
  const { data: productClients = [] } = useQuery({
    queryKey: ['product-clients-hub', productName],
    queryFn: async () => {
      if (!productName) return [];
      const { data } = await supabase
        .from('clients')
        .select('id, full_name, client_id, status, current_product, current_product_id, start_date, end_of_cycle, email, whatsapp')
        .eq('current_product', productName)
        .order('end_of_cycle', { ascending: true, nullsFirst: false });
      return (data || []) as any[];
    },
    enabled: !!productName,
  });
  const activeClients = productClients.filter((c: any) => c.status === 'ativo' || c.status === 'em_onboarding');

  // Sales aggregate → top buyers
  const { data: sales = [] } = useQuery({
    queryKey: ['product-sales-hub', productId || productName],
    queryFn: async () => {
      if (!productId && !productName) return [];
      const q = supabase.from('commercial_sales').select('*').order('created_at', { ascending: false });
      const { data } = productId ? await q.eq('product_id', productId) : await q.eq('product', productName);
      return data || [];
    },
    enabled: !!(productId || productName),
  });
  const { data: clientsLookup = [] } = useQuery({
    queryKey: ['clients-lookup-names'],
    queryFn: async () => (await supabase.from('clients').select('id, full_name')).data || [],
  });
  const clientStats = Object.values(
    sales.reduce((acc: Record<string, any>, s: any) => {
      const name = s.client; if (!name) return acc;
      if (!acc[name]) acc[name] = { name, count: 0, total: 0, lastDate: null };
      acc[name].count += 1;
      acc[name].total += saleRevenue(s);
      const d = s.payment_date || s.created_at;
      if (d && (!acc[name].lastDate || new Date(d) > new Date(acc[name].lastDate))) acc[name].lastDate = d;
      return acc;
    }, {})
  ).sort((a: any, b: any) => b.total - a.total);

  // Client projects
  const { data: projects = [], isLoading: loadingProj } = useQuery({
    queryKey: ['product-client-projects', productId],
    queryFn: async () => {
      const { data } = await supabase
        .from('projects')
        .select('id, name, type, status, deadline, client_id, client_name, progress')
        .eq('product_id', productId)
        .not('client_id', 'is', null)
        .is('archived_at', null)
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!productId,
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          Clientes
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="ativos" className="w-full">
          <TabsList>
            <TabsTrigger value="ativos">
              Ativos & Renovações <Badge variant="secondary" className="ml-2">{activeClients.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="top">
              Top Compradores <Badge variant="secondary" className="ml-2">{clientStats.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="projetos">
              Projetos <Badge variant="secondary" className="ml-2">{projects.length}</Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ativos" className="mt-4 space-y-2">
            <p className="text-xs text-muted-foreground">A coluna <strong>Fim ciclo</strong> indica a próxima renovação.</p>
            <SharedClientsList
              items={productClients as unknown as SharedClientItem[]}
              hideProductColumn
              emptyLabel="Nenhum cliente associado a este produto."
            />
          </TabsContent>

          <TabsContent value="top" className="mt-4">
            {clientStats.length === 0 ? (
              <EmptyHint>Sem vendas registadas para este produto.</EmptyHint>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-right">Nº de Vendas</TableHead>
                    <TableHead className="text-right">Faturação Total</TableHead>
                    <TableHead>Última Compra</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clientStats.map((c: any) => (
                    <TableRow
                      key={c.name}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => {
                        const m = clientsLookup.find((cl: any) => cl.full_name === c.name);
                        if (m) navigate(`/hub/clientes/${m.id}`);
                      }}
                    >
                      <TableCell className="font-medium text-primary hover:underline">{c.name}</TableCell>
                      <TableCell className="text-right">{c.count}</TableCell>
                      <TableCell className="text-right">€{formatNumber(c.total)}</TableCell>
                      <TableCell>{c.lastDate ? format(new Date(c.lastDate), 'dd/MM/yyyy') : '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>

          <TabsContent value="projetos" className="mt-4 space-y-2">
            {loadingProj ? (
              <p className="text-sm text-muted-foreground">A carregar…</p>
            ) : projects.length === 0 ? (
              <EmptyHint>Sem projetos de cliente associados a {productName}.</EmptyHint>
            ) : (
              <div className="space-y-2">
                {projects.map((p: any) => {
                  const statusI = getStatusInfo(p.status || '');
                  const typeI = getTypeInfo(p.type || '');
                  return (
                    <Link
                      key={p.id}
                      to={`/hub/projetos/${p.id}`}
                      className="flex items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2.5 hover:bg-muted/50 hq-transition group"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium truncate">{p.name}</span>
                          {p.client_name && <span className="text-xs text-muted-foreground">· {p.client_name}</span>}
                        </div>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {typeI && <Badge variant="outline" className="text-[10px] h-4 px-1.5">{typeI.label}</Badge>}
                          {statusI && <Badge className={`${statusI.color} border-0 text-[10px] h-4 px-1.5`}>{statusI.label}</Badge>}
                          {p.deadline && (
                            <span className="text-[11px] text-muted-foreground">
                              até {format(parseISO(p.deadline), 'd MMM yyyy', { locale: pt })}
                            </span>
                          )}
                          {typeof p.progress === 'number' && p.progress > 0 && (
                            <span className="text-[11px] text-muted-foreground">{p.progress}%</span>
                          )}
                        </div>
                      </div>
                      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 hq-transition shrink-0" />
                    </Link>
                  );
                })}
                <div className="flex justify-end pt-1">
                  <Button asChild variant="outline" size="sm">
                    <Link to={`/hub/projetos?product_id=${productId}`}>
                      Ver todos no módulo Projetos <ExternalLink className="h-3 w-3 ml-1" />
                    </Link>
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}