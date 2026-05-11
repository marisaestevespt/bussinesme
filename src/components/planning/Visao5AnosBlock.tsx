import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Sparkles, Save, Telescope, Building2, Users, Package, Globe, Heart } from 'lucide-react';
import { toast } from 'sonner';

const AREAS = [
  { key: 'negocio', label: 'Negócio', icon: Building2 },
  { key: 'equipa', label: 'Equipa', icon: Users },
  { key: 'produtos', label: 'Produtos', icon: Package },
  { key: 'mercado', label: 'Mercado', icon: Globe },
  { key: 'vida_pessoal', label: 'Vida pessoal', icon: Heart },
] as const;

type V5 = {
  id?: string;
  ano_alvo: number;
  onde_quero_estar: Record<string, string>;
  condicoes_necessarias: string | null;
  riscos: string | null;
  alinhamento_anual: string | null;
};

export function Visao5AnosBlock() {
  const qc = useQueryClient();
  const anoAlvo = useMemo(() => new Date().getFullYear() + 5, []);

  const { data, isLoading } = useQuery({
    queryKey: ['visao_5_anos', anoAlvo],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('visao_5_anos')
        .select('*')
        .eq('ano_alvo', anoAlvo)
        .maybeSingle();
      return data as V5 | null;
    },
  });

  const [draft, setDraft] = useState<V5>({
    ano_alvo: anoAlvo,
    onde_quero_estar: {},
    condicoes_necessarias: '',
    riscos: '',
    alinhamento_anual: '',
  });
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (data) {
      setDraft({
        ...data,
        onde_quero_estar: data.onde_quero_estar || {},
      });
      setActive(true);
    }
  }, [data?.id]);

  const save = useMutation({
    mutationFn: async (payload: V5) => {
      const row = {
        ano_alvo: payload.ano_alvo,
        onde_quero_estar: payload.onde_quero_estar,
        condicoes_necessarias: payload.condicoes_necessarias,
        riscos: payload.riscos,
        alinhamento_anual: payload.alinhamento_anual,
      };
      if (data?.id) {
        const { error } = await (supabase as any).from('visao_5_anos').update(row).eq('id', data.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from('visao_5_anos').insert(row);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['visao_5_anos'] });
      toast.success('Visão a 5 anos guardada');
    },
    onError: (e: any) => toast.error(e?.message || 'Erro ao guardar'),
  });

  if (isLoading) return null;

  if (!active && !data) {
    return (
      <Card className="hq-card border-dashed">
        <CardContent className="py-10 text-center space-y-3">
          <div className="mx-auto h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
            <Telescope className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold">Visão a 5 Anos</h3>
            <p className="text-xs text-muted-foreground max-w-md mx-auto mt-1">
              Define onde queres estar em {anoAlvo}. Os teus objetivos anuais podem
              depois marcar se contribuem para esta visão.
            </p>
          </div>
          <Button size="sm" onClick={() => setActive(true)}>
            <Sparkles className="h-3.5 w-3.5 mr-1.5" /> Definir a tua visão a 5 anos
          </Button>
        </CardContent>
      </Card>
    );
  }

  const setArea = (key: string, value: string) =>
    setDraft((p) => ({ ...p, onde_quero_estar: { ...p.onde_quero_estar, [key]: value } }));

  return (
    <Card className="hq-card">
      <CardHeader className="pb-4">
        <CardTitle className="text-base flex items-center gap-2">
          <Telescope className="h-5 w-5 text-primary" /> Visão a 5 Anos
          <Badge variant="outline" className="ml-2 text-[10px] font-normal">{anoAlvo}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 1. Onde quero estar — por área */}
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            1. Onde quero estar em {anoAlvo}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
            {AREAS.map((a) => {
              const Icon = a.icon;
              return (
                <div key={a.key} className="rounded-lg border p-3 bg-muted/10 space-y-2">
                  <Label className="flex items-center gap-1.5 text-xs font-medium">
                    <Icon className="h-3.5 w-3.5 text-primary" /> {a.label}
                  </Label>
                  <Textarea
                    rows={4}
                    value={draft.onde_quero_estar?.[a.key] || ''}
                    onChange={(e) => setArea(a.key, e.target.value)}
                    placeholder={`Onde está o ${a.label.toLowerCase()} em ${anoAlvo}?`}
                    className="text-xs leading-relaxed resize-none"
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* 2. Condições necessárias */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            2. O que tem de ser verdade para chegar lá
          </Label>
          <Textarea
            rows={4}
            value={draft.condicoes_necessarias || ''}
            onChange={(e) => setDraft((p) => ({ ...p, condicoes_necessarias: e.target.value }))}
            placeholder="Lista de condições necessárias (estrutura, parcerias, capital, competências, sistemas…)"
            className="text-sm leading-relaxed resize-none"
          />
        </div>

        {/* 3. Riscos */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            3. O que pode impedir
          </Label>
          <Textarea
            rows={4}
            value={draft.riscos || ''}
            onChange={(e) => setDraft((p) => ({ ...p, riscos: e.target.value }))}
            placeholder="Riscos e bloqueios antecipados (mercado, equipa, financeiro, pessoais)…"
            className="text-sm leading-relaxed resize-none"
          />
        </div>

        {/* 4. Alinhamento anual */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            4. Como o plano deste ano serve esta visão
          </Label>
          <Textarea
            rows={4}
            value={draft.alinhamento_anual || ''}
            onChange={(e) => setDraft((p) => ({ ...p, alinhamento_anual: e.target.value }))}
            placeholder="Reflexão anual: que peças deste ano nos aproximam da visão?"
            className="text-sm leading-relaxed resize-none"
          />
        </div>

        <div className="flex justify-end">
          <Button onClick={() => save.mutate(draft)} disabled={save.isPending}>
            <Save className="h-3.5 w-3.5 mr-1.5" /> Guardar visão
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}