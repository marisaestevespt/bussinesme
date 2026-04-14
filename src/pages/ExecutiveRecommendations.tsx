import { useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { BackNavigation } from '@/components/BackNavigation';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sendNotification } from '@/hooks/useNotifications';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { DEPARTMENTS } from '@/lib/departments';

const AREA_OPTIONS = [
  { value: 'all', label: 'Todas as áreas' },
  ...DEPARTMENTS.map(d => ({ value: d.value, label: d.label })),
  { value: 'processos', label: 'Processos' },
  { value: 'comunicacao', label: 'Comunicação' },
  { value: 'equipa', label: 'Equipa' },
  { value: 'geral', label: 'Geral / Empresa' },
];

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Por tratar' },
  { value: 'tratada', label: 'Tratada' },
  { value: 'recusada', label: 'Recusada' },
  { value: 'standby', label: 'Em standby' },
];

const statusLabel = (val: string) => STATUS_OPTIONS.find(s => s.value === val)?.label || val;
const statusVariant = (val: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
  if (val === 'tratada') return 'default';
  if (val === 'recusada') return 'destructive';
  if (val === 'standby') return 'outline';
  return 'secondary';
};

export default function ExecutiveRecommendations() {
  const [filterArea, setFilterArea] = useState('all');
  const [tab, setTab] = useState('pending');
  const qc = useQueryClient();

  const { data: recommendations = [] } = useQuery({
    queryKey: ['recommendations-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recommendations')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status, userId }: { id: string; status: string; userId?: string }) => {
      const { error } = await supabase.from('recommendations').update({ status }).eq('id', id);
      if (error) throw error;
      return { status, userId };
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['recommendations-all'] });
      if (result?.userId && result.status !== 'pending') {
        sendNotification({
          userId: result.userId,
          type: 'recommendation',
          title: `Recomendação ${statusLabel(result.status).toLowerCase()}`,
          message: 'O status da tua recomendação foi atualizado.',
          link: '/executive/recommendations',
        });
      }
    },
  });

  const filtered = recommendations
    .filter(r => tab === 'pending' ? (r.status === 'pending' || !r.status) : r.status === tab)
    .filter(r => filterArea === 'all' || r.impacted_area === filterArea);

  const areaLabel = (val: string) => AREA_OPTIONS.find(a => a.value === val)?.label || val;

  const countForTab = (tabVal: string) =>
    recommendations.filter(r => tabVal === 'pending' ? (r.status === 'pending' || !r.status) : r.status === tabVal).length;

  return (
    <AppLayout>
      <div className="space-y-6">
        <BackNavigation parentRoute="/executive" parentLabel="Executive Room" />
        <PageHeader title="Caixa das Recomendações" subtitle="Todas as recomendações da equipa" />

        <div className="flex items-center justify-between flex-wrap gap-4">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="pending">Por tratar ({countForTab('pending')})</TabsTrigger>
              <TabsTrigger value="tratada">Tratadas ({countForTab('tratada')})</TabsTrigger>
              <TabsTrigger value="recusada">Recusadas ({countForTab('recusada')})</TabsTrigger>
              <TabsTrigger value="standby">Em standby ({countForTab('standby')})</TabsTrigger>
            </TabsList>
          </Tabs>
          <Select value={filterArea} onValueChange={setFilterArea}>
            <SelectTrigger className="w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AREA_OPTIONS.map(a => (
                <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {filtered.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Sem recomendações nesta categoria.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map(r => (
              <Card key={r.id}>
                <CardContent className="py-4 space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="font-medium text-sm text-foreground">{r.member_name}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">{areaLabel(r.impacted_area)}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(r.created_at), "d MMM yyyy, HH:mm", { locale: pt })}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{r.recommendation}</p>
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-xs text-muted-foreground">Status:</span>
                    <Select
                      value={r.status || 'pending'}
                      onValueChange={(val) => updateStatus.mutate({ id: r.id, status: val, userId: r.user_id })}
                    >
                      <SelectTrigger className="h-7 w-36 text-xs">
                        <Badge variant={statusVariant(r.status || 'pending')} className="text-[10px]">
                          {statusLabel(r.status || 'pending')}
                        </Badge>
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map(s => (
                          <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
