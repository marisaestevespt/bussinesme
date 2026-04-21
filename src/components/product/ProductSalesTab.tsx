import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Gift, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const fmt = (v: number) => v.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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

  const totalSales = sales.length;
  const normalSales = sales.filter(s => !(s as any).is_special_offer);
  const specialSales = sales.filter(s => (s as any).is_special_offer);
  const totalRevenue = sales.reduce((acc, s) => acc + Number(s.invoice_total || 0), 0);
  const normalRevenue = normalSales.reduce((acc, s) => acc + Number(s.invoice_total || 0), 0);
  const specialRevenue = specialSales.reduce((acc, s) => acc + Number(s.invoice_total || 0), 0);

  // Unique clients
  const uniqueClients = [...new Set(sales.map(s => s.client).filter(Boolean))];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-200">
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
            <p className="text-2xl font-bold">€{fmt(totalRevenue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground flex items-center justify-center gap-1"><TrendingUp className="h-3 w-3" /> Preço Normal</p>
            <p className="text-lg font-semibold">{normalSales.length} vendas</p>
            <p className="text-xs text-muted-foreground">€{fmt(normalRevenue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground flex items-center justify-center gap-1"><Gift className="h-3 w-3" /> Oferta Especial</p>
            <p className="text-lg font-semibold">{specialSales.length} vendas</p>
            <p className="text-xs text-muted-foreground">€{fmt(specialRevenue)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Clients list */}
      {uniqueClients.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Clientes deste Produto</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {uniqueClients.map(c => (
                <Badge key={c} variant="secondary" className="text-sm">{c}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sales table */}
      <Card>
        <CardHeader><CardTitle className="text-base">Histórico de Vendas</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
          ) : sales.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Sem vendas registadas para este produto.</p>
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
                          <Badge variant="outline" className="gap-1 text-xs border-amber-300 bg-amber-50 text-amber-700">
                            <Gift className="h-3 w-3" /> Oferta Especial
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1 text-xs">
                            <TrendingUp className="h-3 w-3" /> Preço Normal
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">€{fmt(Number(s.base_value))}</TableCell>
                      <TableCell className="text-right">€{fmt(Number(s.invoice_total))}</TableCell>
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
