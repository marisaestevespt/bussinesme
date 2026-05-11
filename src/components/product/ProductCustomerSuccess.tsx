import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useTeamData } from '@/hooks/useTeamData';
import { format, addDays } from 'date-fns';
import { Plus, Pencil, Trash2, Calendar, MessageSquare, Settings2, Sparkles, Copy } from 'lucide-react';

const NPS_STATUS_OPTIONS = [
  { value: 'por_fazer', label: 'Por fazer' },
  { value: 'feito', label: 'Feito' },
  { value: 'em_atraso', label: 'Em atraso' },
];

interface Props {
  productId: string;
  productName: string;
  isOwner: boolean;
}

interface RecordForm {
  id?: string;
  client_id: string | null;
  client_name: string;
  due_date: string;
  collection_date: string;
  nps_score: string;
  notes: string;
  status: string;
}

const emptyRecord = (): RecordForm => ({
  client_id: null,
  client_name: '',
  due_date: format(new Date(), 'yyyy-MM-dd'),
  collection_date: format(new Date(), 'yyyy-MM-dd'),
  nps_score: '',
  notes: '',
  status: 'por_fazer',
});

export function ProductCustomerSuccess({ productId, productName, isOwner }: Props) {
  const qc = useQueryClient();
  const { members } = useTeamData({ members: true });
  const teamMembers = members.data || [];

  // ---- Config ----
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

  const [configForm, setConfigForm] = useState<any>({
    cadence_days: 90,
    collection_message: '',
    responsible_id: null,
    nps_form_url: '',
  });

  useEffect(() => {
    if (npsConfig) setConfigForm(npsConfig);
  }, [npsConfig]);

  const saveConfig = useMutation({
    mutationFn: async () => {
      const payload = {
        product_id: productId,
        cadence_days: Number(configForm.cadence_days) || 90,
        collection_message: configForm.collection_message || null,
        responsible_id: configForm.responsible_id || null,
        nps_form_url: configForm.nps_form_url || null,
      };
      if (npsConfig?.id) {
        const { error } = await supabase.from('product_nps_config' as any).update(payload).eq('id', npsConfig.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('product_nps_config' as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['product-nps-config', productId] });
      toast.success('Configuração guardada');
    },
    onError: () => toast.error('Erro ao guardar'),
  });

  // ---- Records / Cycles ----
  const { data: npsRecords = [] } = useQuery({
    queryKey: ['product-nps-records', productId],
    queryFn: async () => {
      const { data } = await supabase
        .from('product_nps_records' as any)
        .select('*')
        .eq('product_id', productId)
        .order('due_date', { ascending: false, nullsFirst: false });
      return (data || []) as any[];
    },
  });

  // ---- Clients of this product ----
  const { data: productClients = [] } = useQuery({
    queryKey: ['product-clients-cs', productName, productId],
    queryFn: async () => {
      if (!productName) return [];
      const { data } = await supabase
        .from('clients')
        .select('id, full_name, status, start_date, end_of_cycle')
        .or(`current_product.eq.${productName},current_product_id.eq.${productId}`)
        .order('full_name');
      return (data || []) as any[];
    },
    enabled: !!productName,
  });

  const activeClients = productClients.filter((c: any) => c.status === 'ativo' || c.status === 'em_onboarding');

  // ---- Record dialog ----
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<RecordForm>(emptyRecord());

  const openNew = () => {
    setForm(emptyRecord());
    setDialogOpen(true);
  };

  const openEdit = (r: any) => {
    setForm({
      id: r.id,
      client_id: r.client_id || null,
      client_name: r.client_name || '',
      due_date: r.due_date || format(new Date(), 'yyyy-MM-dd'),
      collection_date: r.collection_date || format(new Date(), 'yyyy-MM-dd'),
      nps_score: r.nps_score != null ? String(r.nps_score) : '',
      notes: r.notes || '',
      status: r.status || 'por_fazer',
    });
    setDialogOpen(true);
  };

  const saveRecord = useMutation({
    mutationFn: async () => {
      const client = productClients.find((c: any) => c.id === form.client_id);
      const payload: any = {
        product_id: productId,
        client_id: form.client_id || null,
        client_name: client?.full_name || form.client_name || null,
        due_date: form.due_date || null,
        collection_date: form.collection_date || null,
        nps_score: form.nps_score === '' ? null : Math.max(0, Math.min(10, Number(form.nps_score))),
        notes: form.notes || null,
        status: form.status,
      };
      if (form.id) {
        const { error } = await supabase.from('product_nps_records' as any).update(payload).eq('id', form.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('product_nps_records' as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['product-nps-records', productId] });
      setDialogOpen(false);
      toast.success('Registo guardado');
    },
    onError: (e: any) => toast.error(e?.message || 'Erro ao guardar registo'),
  });

  const deleteRecord = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('product_nps_records' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['product-nps-records', productId] });
      toast.success('Registo eliminado');
    },
  });

  const generateCycles = useMutation({
    mutationFn: async () => {
      const cadence = Number(configForm.cadence_days) || 90;
      const today = new Date();
      const rows = activeClients.map((c: any) => ({
        product_id: productId,
        client_id: c.id,
        client_name: c.full_name,
        due_date: format(addDays(today, cadence), 'yyyy-MM-dd'),
        status: 'por_fazer',
      }));
      if (rows.length === 0) throw new Error('Sem clientes ativos');
      const { error } = await supabase.from('product_nps_records' as any).insert(rows);
      if (error) throw error;
      return rows.length;
    },
    onSuccess: (n) => {
      qc.invalidateQueries({ queryKey: ['product-nps-records', productId] });
      toast.success(`${n} ciclo(s) gerado(s)`);
    },
    onError: (e: any) => toast.error(e?.message || 'Erro ao gerar'),
  });

  const scored = npsRecords.filter((r: any) => r.nps_score != null);
  const avgNps = scored.length > 0
    ? (scored.reduce((s: number, r: any) => s + Number(r.nps_score || 0), 0) / scored.length).toFixed(1)
    : '—';
  const pending = npsRecords.filter((r: any) => r.status !== 'feito').length;

  const statusBadge = (status: string) => {
    const opt = NPS_STATUS_OPTIONS.find(o => o.value === status);
    const label = opt?.label || status;
    const cls = status === 'feito'
      ? 'bg-success/15 text-success border-success/30'
      : status === 'em_atraso'
        ? 'bg-destructive/15 text-destructive border-destructive/30'
        : 'bg-warning/15 text-warning border-warning/30';
    return <Badge variant="outline" className={cls}>{label}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <p className="eyebrow">Média NPS</p>
            <p className="text-3xl font-bold text-primary mt-1">{avgNps}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="eyebrow">Respostas</p>
            <p className="kpi-display-sm mt-1">{scored.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="eyebrow">Por recolher</p>
            <p className="text-3xl font-bold text-warning mt-1">{pending}</p>
          </CardContent>
        </Card>
      </div>

      {/* Configuration */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-base">Configuração de NPS</CardTitle>
              <CardDescription>Define a cadência, mensagem e responsável pelo Customer Success deste produto.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Cadência (dias)</Label>
              <Input
                type="number"
                min={1}
                value={configForm.cadence_days || ''}
                onChange={(e) => setConfigForm({ ...configForm, cadence_days: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">Intervalo entre recolhas para cada cliente.</p>
            </div>
            <div className="space-y-2">
              <Label>Responsável de Customer Success</Label>
              <Select
                value={configForm.responsible_id || 'none'}
                onValueChange={(v) => setConfigForm({ ...configForm, responsible_id: v === 'none' ? null : v })}
              >
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Sem responsável —</SelectItem>
                  {teamMembers.map((m: any) => (
                    <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Link do formulário NPS (opcional)</Label>
            <div className="flex gap-2">
              <Input
                placeholder="https://..."
                value={configForm.nps_form_url || ''}
                onChange={(e) => setConfigForm({ ...configForm, nps_form_url: e.target.value })}
              />
              {configForm.nps_form_url && (
                <Button variant="outline" size="icon" onClick={() => {
                  navigator.clipboard.writeText(configForm.nps_form_url);
                  toast.success('Link copiado');
                }}>
                  <Copy className="h-4 w-4" />
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Cole aqui o link do formulário (Tally, Typeform, Google Forms, etc.) que será partilhado com os clientes — também aparece no portal de cliente.
            </p>
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5"><MessageSquare className="h-3.5 w-3.5" /> Mensagem de recolha</Label>
            <Textarea
              rows={3}
              placeholder="Olá {nome}, gostaríamos da tua opinião sobre o {produto}..."
              value={configForm.collection_message || ''}
              onChange={(e) => setConfigForm({ ...configForm, collection_message: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">Texto enviado ao cliente quando se pede o NPS. Suporta {`{nome}`} e {`{produto}`}.</p>
          </div>
          <div className="flex justify-end">
            <Button onClick={() => saveConfig.mutate()} disabled={saveConfig.isPending}>
              Guardar configuração
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Cycles & records */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              <div>
                <CardTitle className="text-base">Ciclos e Recolhas</CardTitle>
                <CardDescription>Acompanhe o estado de cada recolha de NPS por cliente.</CardDescription>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => generateCycles.mutate()} disabled={generateCycles.isPending || activeClients.length === 0}>
                <Sparkles className="h-4 w-4 mr-1.5" />
                Gerar ciclo p/ ativos ({activeClients.length})
              </Button>
              <Button size="sm" onClick={openNew}>
                <Plus className="h-4 w-4 mr-1.5" />
                Novo registo
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {npsRecords.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground border-2 border-dashed rounded-lg">
              Sem registos. Cria um manualmente ou gera um ciclo para todos os clientes ativos.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Prevista</TableHead>
                  <TableHead>Recolha</TableHead>
                  <TableHead>NPS</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Notas</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {npsRecords.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.client_name || '—'}</TableCell>
                    <TableCell className="text-sm">{r.due_date ? format(new Date(r.due_date), 'dd/MM/yyyy') : '—'}</TableCell>
                    <TableCell className="text-sm">{r.collection_date ? format(new Date(r.collection_date), 'dd/MM/yyyy') : '—'}</TableCell>
                    <TableCell>
                      {r.nps_score != null ? (
                        <span className={`font-bold ${Number(r.nps_score) >= 9 ? 'text-success' : Number(r.nps_score) >= 7 ? 'text-warning' : 'text-destructive'}`}>
                          {r.nps_score}
                        </span>
                      ) : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>{statusBadge(r.status)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[240px] truncate">{r.notes || '—'}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(r)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => {
                          if (confirm('Eliminar este registo?')) deleteRecord.mutate(r.id);
                        }}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? 'Editar registo NPS' : 'Novo registo NPS'}</DialogTitle>
            <DialogDescription>Regista uma recolha de NPS ou planeia um ciclo.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Cliente</Label>
              <Select
                value={form.client_id || 'none'}
                onValueChange={(v) => setForm({ ...form, client_id: v === 'none' ? null : v })}
              >
                <SelectTrigger><SelectValue placeholder="Selecionar cliente" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Sem cliente associado —</SelectItem>
                  {productClients.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Data prevista</Label>
                <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Data de recolha</Label>
                <Input type="date" value={form.collection_date} onChange={(e) => setForm({ ...form, collection_date: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>NPS (0-10)</Label>
                <Input type="number" min={0} max={10} value={form.nps_score} onChange={(e) => setForm({ ...form, nps_score: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {NPS_STATUS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notas de Customer Success</Label>
              <Textarea rows={4} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Feedback, ações de follow-up, riscos..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => saveRecord.mutate()} disabled={saveRecord.isPending}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
