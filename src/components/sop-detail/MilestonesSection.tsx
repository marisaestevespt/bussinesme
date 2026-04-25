import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2 } from 'lucide-react';
import { EmptyHint } from '@/components/ui/loading-skeletons';

const MILESTONE_TYPE_OPTIONS = [
  { value: 'check_in', label: 'Check-in' },
  { value: 'feedback', label: 'Recolha de Feedback' },
  { value: 'reuniao', label: 'Reunião' },
  { value: 'email', label: 'Email' },
  { value: 'outro', label: 'Outro' },
];

interface Props {
  productId: string;
  teamMembers: any[];
}

export function MilestonesSection({ productId, teamMembers }: Props) {
  const queryClient = useQueryClient();

  const { data: milestones = [] } = useQuery({
    queryKey: ['product-milestones', productId],
    queryFn: async () => {
      const { data } = await supabase.from('product_milestones' as any).select('*').eq('product_id', productId).order('days_after_start');
      return (data || []) as any[];
    },
    enabled: !!productId,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['product-milestones', productId] });

  const addMilestone = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('product_milestones' as any).insert({
        product_id: productId,
        milestone: '',
        days_after_start: 0,
        milestone_type: 'check_in',
        sort_order: milestones.length,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const updateMilestone = useMutation({
    mutationFn: async ({ id: mId, data: mData }: { id: string; data: any }) => {
      const { error } = await supabase.from('product_milestones' as any).update(mData).eq('id', mId);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const deleteMilestone = useMutation({
    mutationFn: async (mId: string) => {
      const { error } = await supabase.from('product_milestones' as any).delete().eq('id', mId);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return (
    <section>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Marcos de Acompanhamento</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Estes marcos são aplicados automaticamente à ficha de cada cliente associado a este produto.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => addMilestone.mutate()}>
              <Plus className="h-4 w-4 mr-1" /> Adicionar Marco
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {milestones.length === 0 ? (
            <EmptyHint>Sem marcos definidos.</EmptyHint>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Marco</TableHead>
                  <TableHead className="w-[120px]">Dias após início</TableHead>
                  <TableHead className="w-[160px]">Tipo</TableHead>
                  <TableHead className="w-[180px]">Responsável</TableHead>
                  <TableHead className="w-[50px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {milestones.map((m: any) => (
                  <TableRow key={m.id}>
                    <TableCell>
                      <Input
                        value={m.milestone}
                        onChange={e => updateMilestone.mutate({ id: m.id, data: { milestone: e.target.value } })}
                        className="h-8 text-sm"
                        placeholder="Ex: Check-in semana 2"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        value={m.days_after_start}
                        onChange={e => updateMilestone.mutate({ id: m.id, data: { days_after_start: Number(e.target.value) } })}
                        className="h-8 text-sm w-20"
                      />
                    </TableCell>
                    <TableCell>
                      <Select
                        value={m.milestone_type}
                        onValueChange={v => updateMilestone.mutate({ id: m.id, data: { milestone_type: v } })}
                      >
                        <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {MILESTONE_TYPE_OPTIONS.map(o => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={m.responsible_id || ''}
                        onValueChange={v => updateMilestone.mutate({ id: m.id, data: { responsible_id: v } })}
                      >
                        <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                        <SelectContent>
                          {teamMembers.map((t: any) => (
                            <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" aria-label="Eliminar" size="icon" className="h-7 w-7" onClick={() => deleteMilestone.mutate(m.id)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </section>
  );
}