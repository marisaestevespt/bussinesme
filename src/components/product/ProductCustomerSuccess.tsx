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


const NPS_STATUS_OPTIONS = [
  { value: 'por_fazer', label: 'Por fazer' },
  { value: 'feito', label: 'Feito' },
  { value: 'em_atraso', label: 'Em atraso' },
];

interface Props {
  productId: string;
  isOwner: boolean;
}

export function ProductCustomerSuccess({ productId, isOwner }: Props) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { members } = useTeamData();
  const teamMembers = members.data || [];

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

    </div>
  );
}
