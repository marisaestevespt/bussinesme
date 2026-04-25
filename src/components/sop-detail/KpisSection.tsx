import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { GripVertical, Plus, Trash2 } from 'lucide-react';
import { useConfirm } from '@/components/ui/confirm-dialog';

const KPI_TYPES = [
  { value: 'numerico', label: 'Numérico' },
  { value: 'percentagem', label: 'Percentagem' },
  { value: 'monetario', label: 'Monetário' },
];
const AUTO_SOURCES = [
  { value: 'vendas_count', label: 'Vendas do mês (número)' },
  { value: 'vendas_valor', label: 'Faturação do mês (valor)' },
  { value: 'novos_clientes', label: 'Novos clientes' },
  { value: 'clientes_ativos', label: 'Clientes ativos' },
  { value: 'churn', label: 'Churn' },
  { value: 'taxa_renovacao', label: 'Taxa de renovação' },
  { value: 'nps_medio', label: 'NPS médio atual' },
  { value: 'ticket_medio', label: 'Ticket médio' },
];

interface Props { productId: string; }

export function KpisSection({ productId }: Props) {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const [showKpiForm, setShowKpiForm] = useState(false);
  const [kpiForm, setKpiForm] = useState({ name: '', kpi_type: 'numerico', source: 'manual' as 'manual' | 'automatico', auto_source: '', monthly_goal: '' });

  const { data: kpis = [] } = useQuery({
    queryKey: ['product-kpis', productId],
    queryFn: async () => {
      const { data } = await supabase.from('product_kpis' as any).select('*').eq('product_id', productId).order('sort_order');
      return (data || []) as any[];
    },
    enabled: !!productId,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['product-kpis', productId] });

  const createKpi = useMutation({
    mutationFn: async () => {
      if (!kpiForm.name.trim()) throw new Error('Nome obrigatório');
      const { error } = await supabase.from('product_kpis' as any).insert({
        product_id: productId,
        name: kpiForm.name.trim(),
        kpi_type: kpiForm.kpi_type,
        source: kpiForm.source,
        auto_source: kpiForm.source === 'automatico' ? kpiForm.auto_source : null,
        monthly_goal: kpiForm.monthly_goal ? Number(kpiForm.monthly_goal) : null,
        sort_order: kpis.length,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      setShowKpiForm(false);
      setKpiForm({ name: '', kpi_type: 'numerico', source: 'manual', auto_source: '', monthly_goal: '' });
      toast.success('KPI criado');
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao criar KPI'),
  });

  const toggleKpiActive = useMutation({
    mutationFn: async ({ id: kId, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from('product_kpis' as any).update({ active }).eq('id', kId);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const deleteKpi = useMutation({
    mutationFn: async (kId: string) => {
      const { error } = await supabase.from('product_kpis' as any).delete().eq('id', kId);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success('KPI eliminado'); },
  });

  return (
    <section>
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">KPIs do Produto</CardTitle>
          <Button size="sm" onClick={() => setShowKpiForm(true)} disabled={showKpiForm}>
            <Plus className="h-4 w-4 mr-1" /> Novo KPI
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {showKpiForm && (
            <Card>
              <CardContent className="p-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Nome do KPI</Label>
                    <Input value={kpiForm.name} onChange={e => setKpiForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Taxa de retenção" autoFocus />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Tipo</Label>
                    <Select value={kpiForm.kpi_type} onValueChange={v => setKpiForm(f => ({ ...f, kpi_type: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {KPI_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Fonte</Label>
                    <Select value={kpiForm.source} onValueChange={v => setKpiForm(f => ({ ...f, source: v as any }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manual">Manual</SelectItem>
                        <SelectItem value="automatico">Automático</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {kpiForm.source === 'automatico' && (
                    <div className="space-y-1.5">
                      <Label className="text-xs">Fonte automática</Label>
                      <Select value={kpiForm.auto_source} onValueChange={v => setKpiForm(f => ({ ...f, auto_source: v }))}>
                        <SelectTrigger><SelectValue placeholder="Selecionar fonte" /></SelectTrigger>
                        <SelectContent>
                          {AUTO_SOURCES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <Label className="text-xs">Meta mensal (opcional)</Label>
                    <Input type="number" value={kpiForm.monthly_goal} onChange={e => setKpiForm(f => ({ ...f, monthly_goal: e.target.value }))} placeholder="Ex: 5000" />
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" size="sm" onClick={() => setShowKpiForm(false)}>Cancelar</Button>
                  <Button size="sm" onClick={() => createKpi.mutate()} disabled={createKpi.isPending}>Criar KPI</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {kpis.length === 0 && !showKpiForm ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhum KPI definido. Cria o primeiro KPI para acompanhar o desempenho deste produto.
            </p>
          ) : (
            <div className="space-y-2">
              {kpis.map((kpi: any) => (
                <Card key={kpi.id} className={kpi.active ? '' : 'opacity-50'}>
                  <CardContent className="p-3 flex items-center gap-3">
                    <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">{kpi.name}</span>
                        <Badge variant="outline" className="text-[10px] shrink-0">{KPI_TYPES.find(t => t.value === kpi.kpi_type)?.label || kpi.kpi_type}</Badge>
                        <Badge variant={kpi.source === 'automatico' ? 'default' : 'secondary'} className="text-[10px] shrink-0">
                          {kpi.source === 'automatico' ? 'Auto' : 'Manual'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                        <span>Fonte: {kpi.source === 'manual' ? 'Manual' : (AUTO_SOURCES.find(s => s.value === kpi.auto_source)?.label || 'Automático')}</span>
                        {kpi.monthly_goal != null && <span>Meta: {kpi.kpi_type === 'monetario' ? `${Number(kpi.monthly_goal).toLocaleString('pt-PT')} €` : kpi.kpi_type === 'percentagem' ? `${kpi.monthly_goal}%` : kpi.monthly_goal}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Switch checked={kpi.active} onCheckedChange={v => toggleKpiActive.mutate({ id: kpi.id, active: v })} />
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" aria-label="Eliminar KPI" onClick={async () => {
                        const ok = await confirm({
                          title: 'Eliminar KPI?',
                          description: 'O KPI e o seu histórico serão removidos.',
                          confirmText: 'Eliminar',
                          variant: 'destructive',
                        });
                        if (ok) deleteKpi.mutate(kpi.id);
                      }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}