import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Save, ExternalLink, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { useTeamData } from '@/hooks/useTeamData';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';

const MILESTONE_TYPE_OPTIONS = [
  { value: 'check_in', label: 'Check-in' },
  { value: 'feedback', label: 'Recolha de Feedback' },
  { value: 'reuniao', label: 'Reunião' },
  { value: 'email', label: 'Email' },
  { value: 'outro', label: 'Outro' },
];

const NPS_STATUS_OPTIONS = [
  { value: 'por_fazer', label: 'Por fazer' },
  { value: 'feito', label: 'Feito' },
  { value: 'em_atraso', label: 'Em atraso' },
];

const QUICK_RENEWAL_DAYS = [15, 30, 45, 60];

interface Props {
  productId: string;
  isOwner: boolean;
}

export function ProductCustomerSuccess({ productId, isOwner }: Props) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { members } = useTeamData();
  const teamMembers = members.data || [];

  // ---- NPS SOP linked to this product ----
  const { data: npsSop } = useQuery({
    queryKey: ['nps-sop', productId],
    queryFn: async () => {
      const { data } = await (supabase.from('sops') as any)
        .select('id, title, sop_id')
        .eq('product_id', productId)
        .ilike('title', '%NPS%')
        .limit(1)
        .maybeSingle();
      return data as { id: string; title: string; sop_id: string } | null;
    },
  });

  // ---- Product renewal_advance_days ----
  const { data: product } = useQuery({
    queryKey: ['product-renewal', productId],
    queryFn: async () => {
      const { data } = await supabase
        .from('products')
        .select('renewal_advance_days')
        .eq('id', productId)
        .maybeSingle();
      return data;
    },
  });

  const [renewalDays, setRenewalDays] = useState<number>(30);

  useEffect(() => {
    if (product) {
      setRenewalDays(product.renewal_advance_days ?? 30);
    }
  }, [product]);

  const saveRenewalDays = useMutation({
    mutationFn: async (days: number) => {
      const { error } = await supabase.from('products').update({ renewal_advance_days: days } as any).eq('id', productId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['product-renewal', productId] });
      toast.success('Antecedência de renovação guardada');
    },
    onError: () => toast.error('Erro ao guardar'),
  });

  // ---- NPS Config ----
  const { data: npsConfig } = useQuery({
    queryKey: ['product-nps-config', productId],
    queryFn: async () => {
      const { data } = await supabase
        .from('product_nps_config' as any)
        .select('*')
        .eq('product_id', productId)
        .maybeSingle();
      return data as any;
    },
  });

  const [configForm, setConfigForm] = useState<any>(null);
  const effectiveConfig = configForm ?? npsConfig;

  if (npsConfig && !configForm) {
    setTimeout(() => setConfigForm(npsConfig), 0);
  }

  const saveConfig = useMutation({
    mutationFn: async () => {
      const payload = {
        product_id: productId,
        cadence_days: effectiveConfig?.cadence_days || 30,
        collection_message: effectiveConfig?.collection_message || '',
        responsible_id: effectiveConfig?.responsible_id || null,
        nps_form_url: effectiveConfig?.nps_form_url || null,
      };
      if (effectiveConfig?.id) {
        const { error } = await supabase.from('product_nps_config' as any).update(payload).eq('id', effectiveConfig.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('product_nps_config' as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['product-nps-config', productId] });
      toast.success('Configuração NPS guardada');
    },
    onError: () => toast.error('Erro ao guardar configuração'),
  });

  // ---- NPS Records (read-only) ----
  const { data: npsRecords = [] } = useQuery({
    queryKey: ['product-nps-records', productId],
    queryFn: async () => {
      const { data } = await supabase
        .from('product_nps_records' as any)
        .select('*')
        .eq('product_id', productId)
        .order('collection_date', { ascending: false });
      return (data || []) as any[];
    },
  });

  const avgNps = npsRecords.length > 0
    ? (npsRecords.reduce((s: number, r: any) => s + Number(r.nps_score || 0), 0) / npsRecords.length).toFixed(1)
    : '—';

  // ---- Milestones ----
  const { data: milestones = [] } = useQuery({
    queryKey: ['product-milestones', productId],
    queryFn: async () => {
      const { data } = await supabase
        .from('product_milestones' as any)
        .select('*')
        .eq('product_id', productId)
        .order('days_after_start');
      return (data || []) as any[];
    },
  });

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
    onSuccess: () => qc.invalidateQueries({ queryKey: ['product-milestones', productId] }),
  });

  const updateMilestone = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const { error } = await supabase.from('product_milestones' as any).update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['product-milestones', productId] }),
  });

  const deleteMilestone = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('product_milestones' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['product-milestones', productId] }),
  });

  const getMemberName = (id: string | null) => {
    if (!id) return '—';
    const m = teamMembers.find((t: any) => t.id === id);
    return m?.full_name || '—';
  };

  const statusBadge = (status: string) => {
    const opt = NPS_STATUS_OPTIONS.find(o => o.value === status);
    const label = opt?.label || status;
    const cls = status === 'feito'
      ? 'bg-emerald-100 text-emerald-700'
      : status === 'em_atraso'
        ? 'bg-red-100 text-red-700'
        : 'bg-amber-100 text-amber-700';
    return <Badge variant="outline" className={cls}>{label}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Renewal Advance Days */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Antecedência de Renovação</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Antecedência de renovação (dias)</Label>
            <div className="flex items-center gap-3">
              <Input
                type="number"
                min={1}
                max={365}
                value={renewalDays}
                onChange={e => setRenewalDays(Number(e.target.value))}
                className="h-9 w-32"
                readOnly={!isOwner}
              />
              {isOwner && (
                <Button
                  size="sm"
                  onClick={() => saveRenewalDays.mutate(renewalDays)}
                  disabled={saveRenewalDays.isPending}
                >
                  <Save className="h-4 w-4 mr-1" /> Guardar
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Quantos dias antes do fim de ciclo iniciar o processo de renovação com o cliente
            </p>
          </div>
          {isOwner && (
            <div className="flex flex-wrap gap-2">
              {QUICK_RENEWAL_DAYS.map(d => (
                <Button
                  key={d}
                  variant={renewalDays === d ? 'default' : 'outline'}
                  size="sm"
                  className="text-xs"
                  onClick={() => {
                    setRenewalDays(d);
                    saveRenewalDays.mutate(d);
                  }}
                >
                  {d} dias
                </Button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Histórico de NPS deste Produto</CardTitle>
            <div className="text-sm font-medium">
              Média NPS: <span className="text-lg font-bold text-primary">{avgNps}</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {npsRecords.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Sem registos de NPS. Os registos são criados nas fichas de cliente.
            </p>
          ) : (
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
                {npsRecords.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.client_name}</TableCell>
                    <TableCell>{r.collection_date ? format(new Date(r.collection_date), 'dd/MM/yyyy') : '—'}</TableCell>
                    <TableCell>
                      <span className={`font-bold ${Number(r.nps_score) >= 9 ? 'text-emerald-600' : Number(r.nps_score) >= 7 ? 'text-amber-600' : 'text-red-600'}`}>
                        {r.nps_score}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{r.notes || '—'}</TableCell>
                    <TableCell>{statusBadge(r.status)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Milestones */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Marcos de Acompanhamento</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Estes marcos são aplicados automaticamente à ficha de cada cliente associado a este produto.
              </p>
            </div>
            {isOwner && (
              <Button variant="outline" size="sm" onClick={() => addMilestone.mutate()}>
                <Plus className="h-4 w-4 mr-1" /> Adicionar Marco
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {milestones.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Sem marcos definidos.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Marco</TableHead>
                  <TableHead className="w-[120px]">Dias após início</TableHead>
                  <TableHead className="w-[160px]">Tipo</TableHead>
                  <TableHead className="w-[180px]">Responsável</TableHead>
                  {isOwner && <TableHead className="w-[50px]" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {milestones.map((m: any) => (
                  <TableRow key={m.id}>
                    <TableCell>
                      {isOwner ? (
                        <Input
                          value={m.milestone}
                          onChange={e => updateMilestone.mutate({ id: m.id, data: { milestone: e.target.value } })}
                          className="h-8 text-sm"
                          placeholder="Ex: Check-in semana 2"
                        />
                      ) : (
                        <span className="text-sm">{m.milestone || '—'}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {isOwner ? (
                        <Input
                          type="number"
                          min={0}
                          value={m.days_after_start}
                          onChange={e => updateMilestone.mutate({ id: m.id, data: { days_after_start: Number(e.target.value) } })}
                          className="h-8 text-sm w-20"
                        />
                      ) : (
                        <span className="text-sm">{m.days_after_start}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {isOwner ? (
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
                      ) : (
                        <span className="text-sm">{MILESTONE_TYPE_OPTIONS.find(o => o.value === m.milestone_type)?.label || m.milestone_type}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {isOwner ? (
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
                      ) : (
                        <span className="text-sm">{getMemberName(m.responsible_id)}</span>
                      )}
                    </TableCell>
                    {isOwner && (
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteMilestone.mutate(m.id)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
