import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Save, ExternalLink } from 'lucide-react';

interface Props {
  productId: string;
  teamMembers: any[];
}

export function NpsConfigSection({ productId, teamMembers }: Props) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<any>(null);

  const { data: npsConfig } = useQuery({
    queryKey: ['product-nps-config', productId],
    queryFn: async () => {
      const { data } = await supabase
        .from('product_nps_config' as any)
        .select('*')
        .eq('product_id', productId)
        .order('sort_order', { ascending: true })
        .limit(1);
      return ((data || [])[0] || null) as any;
    },
    enabled: !!productId,
  });

  useEffect(() => {
    if (npsConfig && !form) setForm(npsConfig);
  }, [npsConfig]);

  const effective = form ?? npsConfig;

  const saveNpsConfig = useMutation({
    mutationFn: async () => {
      const payload = {
        product_id: productId,
        cadence_days: effective?.cadence_days || 30,
        collection_message: effective?.collection_message || '',
        responsible_id: effective?.responsible_id || null,
        nps_form_url: effective?.nps_form_url || null,
      };
      if (effective?.id) {
        const { error } = await supabase.from('product_nps_config' as any).update(payload).eq('id', effective.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('product_nps_config' as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-nps-config', productId] });
      toast.success('Configuração NPS guardada');
    },
    onError: () => toast.error('Erro ao guardar configuração'),
  });

  return (
    <section>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Configuração de Recolha de NPS</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Cadência de recolha (dias)</Label>
              <Input
                type="number"
                min={1}
                placeholder="Ex: 30"
                value={effective?.cadence_days ?? 30}
                onChange={e => setForm((p: any) => ({ ...(p || {}), cadence_days: Number(e.target.value) }))}
                className="h-9"
              />
              <p className="text-xs text-muted-foreground">30 = mensal · 60 = bimensal · 90 = trimestral</p>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Responsável pela recolha</Label>
              <Select
                value={effective?.responsible_id || ''}
                onValueChange={v => setForm((p: any) => ({ ...(p || {}), responsible_id: v }))}
              >
                <SelectTrigger className="h-9"><SelectValue placeholder="Selecionar membro" /></SelectTrigger>
                <SelectContent>
                  {teamMembers.map((m: any) => (
                    <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button size="sm" onClick={() => saveNpsConfig.mutate()} disabled={saveNpsConfig.isPending}>
                <Save className="h-4 w-4 mr-1" /> Guardar Config
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Mensagem de recolha</Label>
            <Textarea
              placeholder="Mensagem ou pergunta a enviar ao cliente..."
              value={effective?.collection_message || ''}
              onChange={e => setForm((p: any) => ({ ...(p || {}), collection_message: e.target.value }))}
              className="min-h-[60px]"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Link do formulário de recolha de NPS</Label>
            <div className="flex gap-2">
              <Input
                placeholder="https://forms.google.com/... ou outro link"
                value={effective?.nps_form_url || ''}
                onChange={e => setForm((p: any) => ({ ...(p || {}), nps_form_url: e.target.value }))}
                className="h-9"
              />
              {effective?.nps_form_url && (
                <Button variant="outline" size="sm" className="shrink-0" asChild>
                  <a href={effective.nps_form_url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}