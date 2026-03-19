import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const MILESTONE_TYPES = [
  { value: 'check_in', label: 'Check-in' },
  { value: 'feedback', label: 'Recolha de Feedback' },
  { value: 'reuniao', label: 'Reunião' },
  { value: 'email', label: 'Email' },
  { value: 'outro', label: 'Outro' },
];

interface Props {
  productId: string;
  isOwner: boolean;
  teamMembers: any[];
}

export function TabCustomerSuccess({ productId, isOwner, teamMembers }: Props) {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['product-nps-config', productId] });
    qc.invalidateQueries({ queryKey: ['product-milestones', productId] });
    qc.invalidateQueries({ queryKey: ['product-nps-records', productId] });
  };

  // NPS Config
  const { data: npsConfig } = useQuery({
    queryKey: ['product-nps-config', productId],
    queryFn: async () => {
      const { data } = await supabase.from('product_nps_config' as any).select('*').eq('product_id', productId).maybeSingle();
      return data as any;
    },
  });

  const upsertNpsConfig = useMutation({
    mutationFn: async (fields: any) => {
      if (npsConfig?.id) {
        const { error } = await supabase.from('product_nps_config' as any).update(fields).eq('id', npsConfig.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('product_nps_config' as any).insert({ product_id: productId, ...fields });
        if (error) throw error;
      }
    },
    onSuccess: invalidate,
    onError: () => toast.error('Erro ao guardar configuração NPS'),
  });

  // Milestones
  const { data: milestones = [] } = useQuery({
    queryKey: ['product-milestones', productId],
    queryFn: async () => {
      const { data } = await supabase.from('product_milestones' as any).select('*').eq('product_id', productId).order('sort_order');
      return data || [];
    },
  });

  const addMilestone = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('product_milestones' as any).insert({ product_id: productId, milestone: '', days_after_start: 0 });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const updateMilestone = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const { error } = await supabase.from('product_milestones' as any).update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const deleteMilestone = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('product_milestones' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  // NPS Records
  const { data: npsRecords = [] } = useQuery({
    queryKey: ['product-nps-records', productId],
    queryFn: async () => {
      const { data } = await supabase.from('product_nps_records' as any).select('*').eq('product_id', productId).order('collection_date', { ascending: false });
      return data || [];
    },
  });

  const avgNps = npsRecords.length > 0
    ? (npsRecords.reduce((s: number, r: any) => s + (r.nps_score || 0), 0) / npsRecords.filter((r: any) => r.nps_score != null).length).toFixed(1)
    : '—';

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      por_fazer: 'bg-amber-100 text-amber-700',
      feito: 'bg-emerald-100 text-emerald-700',
      em_atraso: 'bg-red-100 text-red-700',
    };
    return <Badge variant="outline" className={`text-xs ${map[status] || ''}`}>{status === 'por_fazer' ? 'Por fazer' : status === 'feito' ? 'Feito' : 'Em atraso'}</Badge>;
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">Esta tab define a estratégia de acompanhamento e recolha de feedback para este produto. As definições aqui feitas são aplicadas automaticamente a todos os clientes associados.</p>

      {/* NPS Config */}
      <Card>
        <CardHeader><CardTitle className="text-base">Configuração de Recolha de NPS</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Cadência de recolha (dias)</Label>
            <p className="text-xs text-muted-foreground mb-1">Ex: 30 = mensal, 60 = bimensal, 90 = trimestral</p>
            <Input
              type="number"
              min={1}
              defaultValue={npsConfig?.cadence_days || 90}
              onBlur={e => upsertNpsConfig.mutate({ cadence_days: parseInt(e.target.value) || 90 })}
              className="w-32 h-9"
              readOnly={!isOwner}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Mensagem de recolha</Label>
            <Textarea
              defaultValue={npsConfig?.collection_message || ''}
              onBlur={e => upsertNpsConfig.mutate({ collection_message: e.target.value })}
              placeholder="Mensagem ou pergunta a enviar ao cliente..."
              className="min-h-[80px]"
              readOnly={!isOwner}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Responsável pela recolha</Label>
            <Select
              value={npsConfig?.responsible_id || ''}
              onValueChange={v => upsertNpsConfig.mutate({ responsible_id: v || null })}
              disabled={!isOwner}
            >
              <SelectTrigger className="h-9 w-64"><SelectValue placeholder="Selecionar membro" /></SelectTrigger>
              <SelectContent>
                {teamMembers.map((m: any) => <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* NPS History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            Histórico de NPS deste Produto
            <Badge variant="secondary">Média: {avgNps}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Data de recolha</TableHead>
                <TableHead>NPS (0-10)</TableHead>
                <TableHead>Notas</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {npsRecords.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-4">Sem registos de NPS. Os registos são criados nas fichas de cliente.</TableCell></TableRow>}
              {npsRecords.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium text-sm">{r.client_name}</TableCell>
                  <TableCell className="text-sm">{r.collection_date}</TableCell>
                  <TableCell className="text-sm font-semibold">{r.nps_score ?? '—'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{r.notes || '—'}</TableCell>
                  <TableCell>{statusBadge(r.status)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Milestones */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">Marcos de Acompanhamento</CardTitle>
          {isOwner && <Button size="sm" variant="outline" onClick={() => addMilestone.mutate()}><Plus className="h-3 w-3 mr-1" /> Adicionar Marco</Button>}
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-3">Estes marcos são aplicados automaticamente à ficha de cada cliente associado a este produto, calculando as datas reais com base na Data de Início do cliente.</p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Marco</TableHead>
                <TableHead>Dias após início</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Responsável</TableHead>
                {isOwner && <TableHead className="w-10" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {milestones.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-4">Sem marcos definidos</TableCell></TableRow>}
              {(milestones as any[]).map((m) => (
                <TableRow key={m.id}>
                  <TableCell>
                    <Input defaultValue={m.milestone} onBlur={e => updateMilestone.mutate({ id: m.id, data: { milestone: e.target.value } })} className="border-none shadow-none h-auto p-0 text-sm" placeholder="Ex: Check-in semana 2" readOnly={!isOwner} />
                  </TableCell>
                  <TableCell>
                    <Input type="number" defaultValue={m.days_after_start} onBlur={e => updateMilestone.mutate({ id: m.id, data: { days_after_start: parseInt(e.target.value) || 0 } })} className="border-none shadow-none h-auto p-0 text-sm w-20" readOnly={!isOwner} />
                  </TableCell>
                  <TableCell>
                    <Select defaultValue={m.milestone_type} onValueChange={v => updateMilestone.mutate({ id: m.id, data: { milestone_type: v } })} disabled={!isOwner}>
                      <SelectTrigger className="h-7 w-[150px] text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {MILESTONE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Select defaultValue={m.responsible_id || ''} onValueChange={v => updateMilestone.mutate({ id: m.id, data: { responsible_id: v || null } })} disabled={!isOwner}>
                      <SelectTrigger className="h-7 w-[150px] text-xs"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                      <SelectContent>
                        {teamMembers.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  {isOwner && <TableCell><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteMilestone.mutate(m.id)}><Trash2 className="h-3 w-3" /></Button></TableCell>}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
