import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Save } from 'lucide-react';

const QUICK_RENEWAL_DAYS = [15, 30, 45, 60];

interface Props { productId: string; }

export function RenewalSection({ productId }: Props) {
  const queryClient = useQueryClient();
  const [renewalDays, setRenewalDays] = useState<number>(30);

  const { data: productRenewal } = useQuery({
    queryKey: ['product-renewal', productId],
    queryFn: async () => {
      const { data } = await supabase.from('products').select('renewal_advance_days').eq('id', productId).maybeSingle();
      return data;
    },
    enabled: !!productId,
  });

  useEffect(() => {
    if (productRenewal) setRenewalDays(productRenewal.renewal_advance_days ?? 30);
  }, [productRenewal]);

  const saveRenewalDays = useMutation({
    mutationFn: async (days: number) => {
      const { error } = await supabase.from('products').update({ renewal_advance_days: days } as any).eq('id', productId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-renewal', productId] });
      toast.success('Antecedência de renovação guardada');
    },
    onError: () => toast.error('Não consegui guardar a SOP. Tenta novamente.'),
  });

  return (
    <section>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Antecedência de Renovação</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Antecedência de renovação (dias)</Label>
            <div className="flex items-center gap-3">
              <Input
                type="number"
                min={1}
                max={365}
                value={renewalDays}
                onChange={e => setRenewalDays(Number(e.target.value))}
                className="h-9 w-32"
              />
              <Button size="sm" onClick={() => saveRenewalDays.mutate(renewalDays)} disabled={saveRenewalDays.isPending}>
                <Save className="h-4 w-4 mr-1" /> Guardar
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Quantos dias antes do fim de ciclo iniciar o processo de renovação com o cliente
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {QUICK_RENEWAL_DAYS.map(d => (
              <Button
                key={d}
                variant={renewalDays === d ? 'default' : 'outline'}
                size="sm"
                className="text-xs"
                onClick={() => { setRenewalDays(d); saveRenewalDays.mutate(d); }}
              >
                {d} dias
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}