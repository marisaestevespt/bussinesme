import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Truck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { useFinancialData } from '@/hooks/useFinancialData';

const fmt = (v: number) => v.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

const PAYMENT_LABELS: Record<string, string> = {
  mbway: 'MB WAY',
  transferencia: 'Transferência',
  cartao: 'Cartão',
  paypal: 'PayPal',
  stripe: 'Stripe',
  numerario: 'Numerário',
  debito_direto: 'Débito Direto',
  outro: 'Outro',
};

interface Props {
  fin: ReturnType<typeof useFinancialData>;
}

export function FinSetupFinanceiro({ fin }: Props) {
  const navigate = useNavigate();

  // Suppliers
  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers-setup-fin'],
    queryFn: async () => {
      const { data } = await supabase
        .from('suppliers')
        .select('id, name, nif, category, payment_method, default_vat_rate, is_active, contract_start_date, contract_end_date')
        .order('name');
      return (data || []) as any[];
    },
  });

  // Products with payment methods
  const { data: products = [] } = useQuery({
    queryKey: ['products-setup-fin'],
    queryFn: async () => {
      const { data } = await supabase
        .from('products')
        .select('id, name, ticket, vat_rate, status')
        .order('name');
      return (data || []) as { id: string; name: string; ticket: string | null; vat_rate: string | null; status: string }[];
    },
  });

  const { data: paymentMethods = [] } = useQuery({
    queryKey: ['all-product-payment-methods'],
    queryFn: async () => {
      const { data } = await supabase
        .from('product_payment_methods' as any)
        .select('product_id, payment_method');
      return (data || []) as unknown as { product_id: string; payment_method: string }[];
    },
  });

  const getPaymentMethodsForProduct = (productId: string) =>
    paymentMethods.filter(pm => pm.product_id === productId).map(pm => PAYMENT_LABELS[pm.payment_method] || pm.payment_method);

  const computeTicketWithVat = (ticket: string | null, vatRate: string | null) => {
    const t = parseFloat(ticket || '0') || 0;
    const v = parseFloat(vatRate || '0') || 0;
    return t * (1 + v / 100);
  };

  const CATEGORY_LABELS: Record<string, string> = {
    ferramentas: 'Ferramentas', marketing: 'Marketing', pessoal: 'Pessoal',
    escritorio: 'Escritório', freelancer: 'Freelancer', formacao: 'Formação',
    viagens: 'Viagens', outro: 'Outro',
  };

  return (
    <div className="space-y-8">
      {/* FORNECEDORES */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Fornecedores</h3>
        <Button size="sm" variant="outline" onClick={() => navigate('/hub/financeiro/fornecedores')}>
          <Truck className="h-4 w-4 mr-1" /> Gerir Fornecedores
        </Button>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>NIF</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Pagamento</TableHead>
                <TableHead>IVA</TableHead>
                <TableHead>Contrato</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {suppliers.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Sem fornecedores</TableCell></TableRow>
              ) : suppliers.map((s: any) => (
                <TableRow key={s.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate('/hub/financeiro/fornecedores')}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell className="text-muted-foreground">{s.nif || '—'}</TableCell>
                  <TableCell><Badge variant="secondary" className="text-xs">{CATEGORY_LABELS[s.category] || s.category || '—'}</Badge></TableCell>
                  <TableCell><Badge variant="outline">{PAYMENT_LABELS[s.payment_method] || s.payment_method || '—'}</Badge></TableCell>
                  <TableCell>{s.default_vat_rate != null ? `${s.default_vat_rate}%` : '—'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {s.contract_start_date && s.contract_end_date
                      ? `${s.contract_start_date} → ${s.contract_end_date}`
                      : '—'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={s.is_active ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}>
                      {s.is_active ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* PRODUTOS */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Produtos — Visão Financeira</h3>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Ticket s/ IVA</TableHead>
                  <TableHead className="text-right">IVA</TableHead>
                  <TableHead className="text-right">Ticket c/ IVA</TableHead>
                  <TableHead>Formas de Pagamento</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Sem produtos</TableCell></TableRow>
                ) : products.map(p => {
                  const ticket = parseFloat(p.ticket || '0') || 0;
                  const vat = parseFloat(p.vat_rate || '0') || 0;
                  const ticketWithVat = computeTicketWithVat(p.ticket, p.vat_rate);
                  const methods = getPaymentMethodsForProduct(p.id);
                  return (
                    <TableRow key={p.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/hub/produtos/${p.id}`)}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={p.status === 'vendas_ativas' ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground'}>
                          {p.status === 'vendas_ativas' ? 'Vendas Ativas' : p.status === 'a_criar' ? 'A Criar' : p.status === 'em_ideia' ? 'Em Ideia' : 'Off'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{ticket > 0 ? fmt(ticket) : '—'}</TableCell>
                      <TableCell className="text-right">{vat > 0 ? `${vat}%` : '—'}</TableCell>
                      <TableCell className="text-right font-medium">{ticket > 0 ? fmt(ticketWithVat) : '—'}</TableCell>
                      <TableCell>
                        {methods.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {methods.map(m => <Badge key={m} variant="secondary" className="text-xs">{m}</Badge>)}
                          </div>
                        ) : <span className="text-muted-foreground text-xs">—</span>}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
