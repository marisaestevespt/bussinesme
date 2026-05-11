import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Gift, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {InlineLoader, EmptyHint } from '@/components/ui/loading-skeletons';
import { sumRevenue, saleRevenue } from '@/lib/salesCalculations';
import { formatNumber } from '@/lib/formatting';
interface Props {
  productName: string;
  ticketValue?: number;
  productId?: string;
}

export function ProductSalesTab({ productName, productId, ticketValue }: Props) {
  const navigate = useNavigate();

  const { data: sales = [], isLoading } = useQuery({
    queryKey: ['product-sales-history', productId || productName],
    queryFn: async () => {
      if (!productId && !productName) return [];
      const query = supabase
        .from('commercial_sales')
        .select('*')
        .order('created_at', { ascending: false });
      const { data, error } = productId
        ? await query.eq('product_id', productId)
        : await query.eq('product', productName);
      if (error) throw error;
      return data || [];
    },
    enabled: !!(productId || productName),
  });

  const { data: clientsLookup = [] } = useQuery({
    queryKey: ['clients-lookup-names'],
    queryFn: async () => {
      const { data } = await supabase.from('clients').select('id, full_name');
      return data || [];
    },
  });

  const totalSales = sales.length;
  const normalSales = sales.filter(s => !(s as any).is_special_offer);
  const specialSales = sales.filter(s => (s as any).is_special_offer);
  const totalRevenue = sumRevenue(sales);
  const normalRevenue = sumRevenue(normalSales);
  const specialRevenue = sumRevenue(specialSales);

  // Aggregate clients
  const clientStats = Object.values(
    sales.reduce((acc: Record<string, any>, s: any) => {
      const name = s.client;
      if (!name) return acc;
      if (!acc[name]) {
        acc[name] = { name, count: 0, total: 0, lastDate: null as string | null };
      }
      acc[name].count += 1;
      acc[name].total += saleRevenue(s);
      const d = s.payment_date || s.created_at;
      if (d && (!acc[name].lastDate || new Date(d) > new Date(acc[name].lastDate))) {
        acc[name].lastDate = d;
      }
      return acc;
    }, {})
  ).sort((a: any, b: any) => b.total - a.total);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-top-2 duration-200">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Total Vendas</p>
            <p className="text-2xl font-bold">{totalSales}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Faturação Total</p>
            <p className="text-2xl font-bold">€{formatNumber(totalRevenue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground flex items-center justify-center gap-1"><TrendingUp className="h-3 w-3" /> Preço Normal</p>
            <p className="text-lg font-semibold">{normalSales.length} vendas</p>
            <p className="text-xs text-muted-foreground">€{formatNumber(normalRevenue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground flex items-center justify-center gap-1"><Gift className="h-3 w-3" /> Oferta Especial</p>
            <p className="text-lg font-semibold">{specialSales.length} vendas</p>
            <p className="text-xs text-muted-foreground">€{formatNumber(specialRevenue)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Clients list */}
      {clientStats.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Compradores</CardTitle>
            <p className="text-xs text-muted-foreground">Ranking por faturação acumulada (todas as vendas registadas).</p>
          </CardHeader>
          <CardContent>
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
                      const match = clientsLookup.find((cl: any) => cl.full_name === c.name);
                      if (match) navigate(`/hub/clientes/${match.id}`);
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
          </CardContent>
        </Card>
      )}

      {/* Sales table */}
      <Card>
        <CardHeader><CardTitle className="text-base">Histórico de Vendas</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8"><InlineLoader /></div>
          ) : sales.length === 0 ? (
            <EmptyHint>Sem vendas registadas para este produto.</EmptyHint>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Valor Base</TableHead>
                  <TableHead className="text-right">Fatura Total</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Fonte</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sales.map(s => {
                  const isSpecial = (s as any).is_special_offer;
                  const reason = (s as any).special_offer_reason;
                  return (
                    <TableRow key={s.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/hub/comercial/vendas/${s.id}`)}>
                      <TableCell className="font-mono text-sm">{s.sale_id}</TableCell>
                      <TableCell>{s.payment_date ? format(new Date(s.payment_date), 'dd/MM/yyyy') : '—'}</TableCell>
                      <TableCell>{s.client || '—'}</TableCell>
                      <TableCell>
                        {isSpecial ? (
                          <Badge variant="outline" className="gap-1 text-xs border-warning/30 bg-warning/15 text-warning">
                            <Gift className="h-3 w-3" /> Oferta Especial
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1 text-xs">
                            <TrendingUp className="h-3 w-3" /> Preço Normal
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">€{formatNumber(Number(s.base_value))}</TableCell>
                      <TableCell className="text-right">€{formatNumber(Number(s.invoice_total))}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{isSpecial && reason ? reason : '—'}</TableCell>
                      <TableCell>{s.source || '—'}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
