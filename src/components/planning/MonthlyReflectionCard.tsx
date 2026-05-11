import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, NotebookPen, Save } from 'lucide-react';
import { toast } from 'sonner';

const MONTH_NAMES = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
];

type Reflection = {
  id?: string;
  year: number;
  month: number;
  o_que_correu_bem: string | null;
  o_que_nao_correu: string | null;
  decisoes_mes_seguinte: string | null;
  revisto: boolean;
  revisto_em: string | null;
};

interface Props { year: number; month: number /* 1-12 */ }

export function MonthlyReflectionCard({ year, month }: Props) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['monthly_reflection', year, month],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('monthly_reflection')
        .select('*')
        .eq('year', year).eq('month', month)
        .maybeSingle();
      return data as Reflection | null;
    },
  });

  const [draft, setDraft] = useState<Reflection>({
    year, month, o_que_correu_bem: '', o_que_nao_correu: '',
    decisoes_mes_seguinte: '', revisto: false, revisto_em: null,
  });

  useEffect(() => {
    if (data) setDraft(data);
    else setDraft({ year, month, o_que_correu_bem: '', o_que_nao_correu: '',
      decisoes_mes_seguinte: '', revisto: false, revisto_em: null });
  }, [data?.id, year, month]);

  const save = useMutation({
    mutationFn: async (markRevisto?: boolean) => {
      const row: any = {
        year, month,
        o_que_correu_bem: draft.o_que_correu_bem,
        o_que_nao_correu: draft.o_que_nao_correu,
        decisoes_mes_seguinte: draft.decisoes_mes_seguinte,
      };
      if (markRevisto) {
        row.revisto = true;
        row.revisto_em = new Date().toISOString();
      }
      if (data?.id) {
        const { error } = await (supabase as any).from('monthly_reflection').update(row).eq('id', data.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from('monthly_reflection').insert(row);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['monthly_reflection', year, month] });
      toast.success('Reflexão guardada');
    },
    onError: (e: any) => toast.error(e?.message || 'Erro ao guardar'),
  });

  if (isLoading) return null;

  return (
    <Card className="hq-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <NotebookPen className="h-4 w-4 text-primary" />
          Reflexão de {MONTH_NAMES[month - 1]} {year}
          {data?.revisto && (
            <Badge variant="outline" className="ml-2 text-[10px] gap-1">
              <CheckCircle2 className="h-3 w-3 text-success" />
              Revisto
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            O que correu bem
          </Label>
          <Textarea rows={3} value={draft.o_que_correu_bem || ''}
            onChange={(e) => setDraft((p) => ({ ...p, o_que_correu_bem: e.target.value }))}
            placeholder="Vitórias, resultados, momentos altos…"
            className="text-sm resize-none" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            O que não correu
          </Label>
          <Textarea rows={3} value={draft.o_que_nao_correu || ''}
            onChange={(e) => setDraft((p) => ({ ...p, o_que_nao_correu: e.target.value }))}
            placeholder="Falhas, atrasos, problemas a resolver…"
            className="text-sm resize-none" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Decisões para o mês seguinte
          </Label>
          <Textarea rows={3} value={draft.decisoes_mes_seguinte || ''}
            onChange={(e) => setDraft((p) => ({ ...p, decisoes_mes_seguinte: e.target.value }))}
            placeholder="O que vais mudar, manter ou começar…"
            className="text-sm resize-none" />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => save.mutate(false)} disabled={save.isPending}>
            <Save className="h-3.5 w-3.5 mr-1.5" /> Guardar
          </Button>
          {!data?.revisto && (
            <Button size="sm" onClick={() => save.mutate(true)} disabled={save.isPending}>
              <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> Marcar como revisto
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}