import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

const PAYMENT_OPTIONS = [
  { value: 'pagamento_total', label: 'Pagamento Total' },
  { value: 'entrada_prestacoes', label: 'Pagamento Entrada + Prestações' },
  { value: 'prestacoes', label: 'Pagamento Prestações' },
  { value: 'avenca_mensal', label: 'Pagamento Avença Mensal' },
];

interface Props { productId: string; }

export function PaymentMethodsSection({ productId }: Props) {
  const queryClient = useQueryClient();

  const { data: paymentMethods = [] } = useQuery({
    queryKey: ['product-payment-methods', productId],
    queryFn: async () => {
      const { data } = await supabase.from('product_payment_methods' as any).select('*').eq('product_id', productId);
      return (data || []) as any[];
    },
    enabled: !!productId,
  });

  return (
    <section>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Formas de Pagamento</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-3">Seleciona as formas de pagamento disponíveis para este produto. Ao associar a um cliente, apenas estas opções aparecerão.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {PAYMENT_OPTIONS.map(opt => {
              const isActive = paymentMethods.some((pm: any) => pm.payment_method === opt.value);
              return (
                <label key={opt.value} className={cn(
                  "flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors",
                  isActive ? "border-primary bg-primary/5" : "border-border"
                )}>
                  <Checkbox
                    checked={isActive}
                    onCheckedChange={async (checked) => {
                      if (checked) {
                        await supabase.from('product_payment_methods' as any).insert({ product_id: productId, payment_method: opt.value });
                      } else {
                        const row = paymentMethods.find((pm: any) => pm.payment_method === opt.value);
                        if (row) await supabase.from('product_payment_methods' as any).delete().eq('id', row.id);
                      }
                      queryClient.invalidateQueries({ queryKey: ['product-payment-methods', productId] });
                    }}
                  />
                  <span className="text-sm">{opt.label}</span>
                </label>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}