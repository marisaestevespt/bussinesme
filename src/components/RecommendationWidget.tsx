import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { MessageSquareHeart, Send, Trash2, ChevronDown } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { DEPARTMENTS } from '@/lib/departments';
import { requireConfirm, confirmDestructive } from '@/lib/confirmDestructive';

const AREA_OPTIONS = [
  ...DEPARTMENTS.map(d => ({ value: d.value, label: d.label })),
  { value: 'processos', label: 'Processos' },
  { value: 'comunicacao', label: 'Comunicação' },
  { value: 'equipa', label: 'Equipa' },
  { value: 'geral', label: 'Geral / Empresa' },
];

interface Props {
  memberName: string;
}

export function RecommendationWidget({ memberName }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const [area, setArea] = useState('');
  const [showHistory, setShowHistory] = useState(false);

  const { data: myRecs = [] } = useQuery({
    queryKey: ['my-recommendations', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recommendations')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const submit = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('recommendations').insert({
        user_id: user!.id,
        member_name: memberName,
        recommendation: text.trim(),
        impacted_area: area,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Recomendação enviada!');
      setText('');
      setArea('');
      qc.invalidateQueries({ queryKey: ['my-recommendations'] });
    },
    onError: () => toast.error('Erro ao enviar recomendação.'),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await requireConfirm();
      const { error } = await supabase.from('recommendations').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-recommendations'] });
      toast.success('Recomendação removida.');
    },
  });

  const areaLabel = (val: string) => AREA_OPTIONS.find(a => a.value === val)?.label || val;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <MessageSquareHeart className="h-4 w-4" /> Caixa das Recomendações
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Form */}
        <div className="space-y-3">
          <Textarea
            placeholder="Escreve a tua recomendação ou sugestão..."
            value={text}
            onChange={e => setText(e.target.value)}
            className="min-h-[80px] text-sm"
          />
          <div className="flex items-center gap-2">
            <Select value={area} onValueChange={setArea}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Área impactada" />
              </SelectTrigger>
              <SelectContent>
                {AREA_OPTIONS.map(a => (
                  <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              disabled={!text.trim() || !area || submit.isPending}
              onClick={() => submit.mutate()}
              className="gap-2"
            >
              <Send className="h-3.5 w-3.5" /> Enviar
            </Button>
          </div>
        </div>

        {/* My past recommendations — collapsible */}
        {myRecs.length > 0 && (
          <Collapsible open={showHistory} onOpenChange={setShowHistory}>
            <CollapsibleTrigger asChild>
              <button className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors pt-2 border-t w-full">
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showHistory ? 'rotate-180' : ''}`} />
                As minhas recomendações ({myRecs.length})
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-2 pt-2">
              {myRecs.map(r => (
                <div key={r.id} className="flex items-start gap-2 group">
                  <div className="flex-1 space-y-0.5">
                    <p className="text-sm">{r.recommendation}</p>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] px-1.5">{areaLabel(r.impacted_area)}</Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {format(new Date(r.created_at), "d MMM yyyy", { locale: pt })}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => remove.mutate(r.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity mt-1"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                  </button>
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
}
