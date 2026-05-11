import { useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Calendar, MessageSquare, Star } from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO, addDays, differenceInDays } from 'date-fns';
import { useTeamData } from '@/hooks/useTeamData';

const STATUS_OPTIONS = [
  { value: 'por_fazer', label: 'Por fazer' },
  { value: 'feito', label: 'Feito' },
  { value: 'em_atraso', label: 'Em atraso' },
];

interface Props {
  clientId: string;
  clientName: string;
  productName: string | null;
  startDate: string | null;
  /** When set, render only the requested sub-section (used inside dialogs) */
  onlySection?: 'nps';
}

export function ClientCustomerSuccess({ clientId, clientName, productName, startDate, onlySection }: Props) {
  const qc = useQueryClient();
  useTeamData({ members: false });

  // Fetch the product to get its id
  const { data: product } = useQuery({
    queryKey: ['product-by-name', productName],
    queryFn: async () => {
      if (!productName) return null;
      const { data } = await supabase.from('products').select('id').eq('name', productName).maybeSingle();
      return data;
    },
    enabled: !!productName,
  });

  const productId = product?.id;

  // Fetch ALL recolha configs for the product (NPS + Feedback)
  const { data: npsConfigs = [] } = useQuery({
    queryKey: ['product-nps-configs', productId],
    queryFn: async () => {
      if (!productId) return [];
      const { data } = await supabase
        .from('product_nps_config' as any)
        .select('*')
        .eq('product_id', productId)
        .order('sort_order', { ascending: true });
      return (data || []) as any[];
    },
    enabled: !!productId,
  });
  // Back-compat alias for any reference elsewhere in the file
  const npsConfig = npsConfigs[0] || null;

  // Fetch client NPS records
  const { data: npsRecords = [] } = useQuery({
    queryKey: ['client-nps-records', clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from('client_nps_records' as any)
        .select('*')
        .eq('client_id', clientId)
        .order('expected_date');
      return (data || []) as any[];
    },
  });

  // Generate NPS dates (auto-generate if missing)
  const generateNpsRecords = useMutation({
    mutationFn: async () => {
      if (!startDate || npsConfigs.length === 0 || !productId) return;

      // Delete existing non-manual records (re-generate from configs)
      await supabase.from('client_nps_records' as any).delete().eq('client_id', clientId).eq('is_manual', false);

      const start = parseISO(startDate);
      const records: any[] = [];
      // For each config, generate occurrences (recurring) for 2 years
      for (const cfg of npsConfigs) {
        const cadence = Number(cfg.cadence_days) || 0;
        if (cadence <= 0) continue;
        const occurrences = Math.max(1, Math.floor(730 / cadence));
        for (let i = 1; i <= occurrences; i++) {
          const expectedDate = addDays(start, cadence * i);
          records.push({
            client_id: clientId,
            product_id: productId,
            config_id: cfg.id,
            kind: cfg.kind || 'nps',
            title: cfg.title || (cfg.kind === 'feedback' ? 'Feedback' : 'NPS'),
            questions: cfg.kind === 'feedback' ? (cfg.questions || []) : null,
            expected_date: format(expectedDate, 'yyyy-MM-dd'),
            status: 'por_fazer',
            is_manual: false,
          });
        }
      }
      if (records.length > 0) {
        const { error } = await supabase.from('client_nps_records' as any).insert(records);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client-nps-records', clientId] });
      toast.success('Recolhas geradas');
    },
  });

  // Auto-generate on first load if records are empty — only if product has at least one recolha config
  const hasNpsConfig = npsConfigs.length > 0 && npsConfigs.some((c: any) => Number(c.cadence_days) > 0);
  const autoGenNpsRef = useRef(false);

  useEffect(() => {
    if (productId && startDate && hasNpsConfig && npsRecords.length === 0 && !generateNpsRecords.isPending && !autoGenNpsRef.current) {
      autoGenNpsRef.current = true;
      generateNpsRecords.mutate();
    }
  }, [productId, startDate, hasNpsConfig, npsRecords.length]);

  // Add manual NPS record
  const addManualNps = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('client_nps_records' as any).insert({
        client_id: clientId,
        product_id: productId || null,
        expected_date: format(new Date(), 'yyyy-MM-dd'),
        status: 'por_fazer',
        is_manual: true,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['client-nps-records', clientId] }),
  });

  // Update NPS record
  const updateNps = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const { error } = await supabase.from('client_nps_records' as any).update(data).eq('id', id);
      if (error) throw error;
      // Also sync to product_nps_records if we have a score
      if (data.nps_score !== undefined && data.status === 'feito' && productId) {
        await supabase.from('product_nps_records' as any).insert({
          product_id: productId,
          client_name: clientName,
          collection_date: data.actual_date || format(new Date(), 'yyyy-MM-dd'),
          nps_score: data.nps_score,
          notes: data.notes || '',
          status: 'feito',
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client-nps-records', clientId] });
      qc.invalidateQueries({ queryKey: ['product-nps-records'] });
    },
  });

  const today = new Date();

  const getRowColor = (expectedDate: string, status: string) => {
    if (status === 'feito') return 'bg-success/15 border-l-4 border-l-emerald-500';
    const d = parseISO(expectedDate);
    const diff = differenceInDays(d, today);
    if (diff < 0) return 'bg-destructive/15 border-l-4 border-l-red-500';
    if (diff <= 7) return 'bg-warning/15 border-l-4 border-l-amber-500';
    return '';
  };

  const autoStatus = (expectedDate: string, currentStatus: string) => {
    if (currentStatus === 'feito') return 'feito';
    const diff = differenceInDays(parseISO(expectedDate), today);
    if (diff < 0) return 'em_atraso';
    return 'por_fazer';
  };

  // Compute average NPS from "feito" records
  const doneRecords = npsRecords.filter((r: any) => r.status === 'feito' && r.nps_score != null);
  const avgNps = doneRecords.length > 0
    ? (doneRecords.reduce((s: number, r: any) => s + Number(r.nps_score), 0) / doneRecords.length).toFixed(1)
    : '—';

  if (!productName) {
    return (
      <Card className="h-full">
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Associa um Produto Atual para ativar o Customer Success.
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {/* NPS Records */}
      {(!onlySection || onlySection === 'nps') && (
      <Card className="h-full">
        <CardHeader className="space-y-3 pb-3">
          <div className="flex items-start justify-between gap-3">
            <CardTitle className="text-base">Recolha de NPS</CardTitle>
            <span className="whitespace-nowrap text-sm font-medium">
              Média: <span className="text-lg font-bold text-primary">{avgNps}</span>
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => addManualNps.mutate()}>
              <Plus className="h-4 w-4 mr-1" /> Recolha Manual
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { generateNpsRecords.mutate(); }}
              disabled={!startDate}
            >
              Recalcular datas
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {npsRecords.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              {!startDate ? 'Define a Data de Início para gerar as datas de recolha.' : 'Sem registos de NPS.'}
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {npsRecords.map((r: any) => {
                const computedStatus = autoStatus(r.expected_date, r.status);
                const statusInfo = computedStatus === 'feito'
                  ? { label: 'Feito', cls: 'bg-success/15 text-success border-success/30', accent: 'border-l-success' }
                  : computedStatus === 'em_atraso'
                    ? { label: 'Em atraso', cls: 'bg-destructive/15 text-destructive border-destructive/30', accent: 'border-l-destructive' }
                    : { label: 'Por fazer', cls: 'bg-warning/15 text-warning border-warning/30', accent: 'border-l-warning' };
                return (
                  <div key={r.id} className={`rounded-lg border-l-4 ${statusInfo.accent} border bg-card shadow-sm hover:shadow-md transition-shadow p-4 space-y-3`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-sm font-medium">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                        {format(parseISO(r.expected_date), 'dd/MM/yyyy')}
                      </div>
                      <Badge variant="outline" className={`${statusInfo.cls} whitespace-nowrap`}>{statusInfo.label}</Badge>
                    </div>
                    {r.is_manual && <Badge variant="outline" className="text-[10px]">Manual</Badge>}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                          <Star className="h-3 w-3" /> NPS
                        </label>
                        <Input
                          type="number"
                          min={0}
                          max={10}
                          value={r.nps_score ?? ''}
                          onChange={e => updateNps.mutate({
                            id: r.id,
                            data: {
                              nps_score: e.target.value ? Number(e.target.value) : null,
                              status: e.target.value ? 'feito' : r.status,
                              actual_date: e.target.value ? (r.actual_date || format(new Date(), 'yyyy-MM-dd')) : r.actual_date,
                            }
                          })}
                          className="h-9 text-sm font-semibold"
                          placeholder="0-10"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Status</label>
                        <Select value={computedStatus} onValueChange={v => updateNps.mutate({ id: r.id, data: { status: v } })}>
                          <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {STATUS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Data real</label>
                      <Input
                        type="date"
                        value={r.actual_date || ''}
                        onChange={e => updateNps.mutate({ id: r.id, data: { actual_date: e.target.value || null } })}
                        className="h-9 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" /> Notas
                      </label>
                      <Textarea
                        value={r.notes || ''}
                        onChange={e => updateNps.mutate({ id: r.id, data: { notes: e.target.value } })}
                        className="text-sm min-h-[60px]"
                        placeholder="Notas..."
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
      )}

    </>
  );
}
