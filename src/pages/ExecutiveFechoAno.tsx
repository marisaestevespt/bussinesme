import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { BackNavigation } from '@/components/BackNavigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, Lock, Sparkles, ArrowRight, Briefcase, Megaphone, Wallet, Settings2, Users, Package, UserCog, Target } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const AREAS = [
  { key: 'comercial', label: 'Comercial', icon: Briefcase },
  { key: 'marketing', label: 'Marketing', icon: Megaphone },
  { key: 'financeiro', label: 'Financeiro', icon: Wallet },
  { key: 'operacao', label: 'Operação', icon: Settings2 },
  { key: 'clientes', label: 'Clientes', icon: Users },
  { key: 'produtos', label: 'Produtos', icon: Package },
  { key: 'equipa', label: 'Equipa', icon: UserCog },
  { key: 'geral', label: 'Geral', icon: Target },
] as const;

function semaphore(pct: number) {
  if (pct >= 90) return 'bg-emerald-500';
  if (pct >= 60) return 'bg-amber-500';
  return 'bg-red-500';
}

type Review = {
  id?: string;
  year: number;
  status: 'em_analise' | 'fechado';
  fechado_em: string | null;
  o_que_funcionou: string | null;
  o_que_mudar: string | null;
  decisoes_ano_seguinte: string | null;
  alinhamento_visao_5_anos: string | null;
  area_notes: Record<string, string>;
};

export default function ExecutiveFechoAno() {
  const { ano } = useParams<{ ano: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const year = parseInt(ano || '', 10);
  const today = new Date();
  const currentYear = today.getFullYear();

  // Futuro: redirect (só aceita anos terminados ou o atual em Dezembro)
  useEffect(() => {
    if (!Number.isFinite(year) || year > currentYear) {
      navigate(`/executive/fecho-de-ano/${currentYear - 1}`, { replace: true });
    }
  }, [year, currentYear, navigate]);

  const { data: review } = useQuery({
    queryKey: ['year_review', year],
    queryFn: async () => {
      const { data } = await supabase
        .from('year_review').select('*').eq('year', year).maybeSingle();
      return (data as Review | null) ?? null;
    },
    enabled: Number.isFinite(year),
  });

  const { data: objectives = [] } = useQuery({
    queryKey: ['year_review_objectives', year],
    queryFn: async () => {
      const { data } = await supabase
        .from('executive_objectives')
        .select('id, area, title, target_value, target_unit, current_value, value_source')
        .eq('year', year);
      return data || [];
    },
    enabled: Number.isFinite(year),
  });

  const [draft, setDraft] = useState<Review>({
    year, status: 'em_analise', fechado_em: null,
    o_que_funcionou: '', o_que_mudar: '', decisoes_ano_seguinte: '',
    alinhamento_visao_5_anos: '', area_notes: {},
  });

  useEffect(() => {
    if (review) setDraft({ ...review, area_notes: review.area_notes || {} });
  }, [review?.id]);

  const isClosed = draft.status === 'fechado';
  const readOnly = isClosed;

  const save = useMutation({
    mutationFn: async (extra?: Partial<Review>) => {
      const row: any = {
        year,
        o_que_funcionou: draft.o_que_funcionou,
        o_que_mudar: draft.o_que_mudar,
        decisoes_ano_seguinte: draft.decisoes_ano_seguinte,
        alinhamento_visao_5_anos: draft.alinhamento_visao_5_anos,
        area_notes: draft.area_notes,
        ...(extra || {}),
      };
      if (review?.id) {
        const { error } = await supabase.from('year_review').update(row).eq('id', review.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('year_review').insert(row);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['year_review', year] });
      toast.success('Guardado');
    },
    onError: (e: any) => toast.error('Erro ao guardar: ' + (e.message || e)),
  });

  const closeYear = useMutation({
    mutationFn: async () => {
      await save.mutateAsync({ status: 'fechado', fechado_em: new Date().toISOString() });
    },
    onSuccess: () => {
      toast.success(`Ano de ${year} fechado.`);
      qc.invalidateQueries({ queryKey: ['year_review', year] });
    },
  });

  const cards = useMemo(() => AREAS.map(a => {
    const objs = objectives.filter((o: any) => o.area === a.key);
    const target = objs.reduce((s: number, o: any) => s + (Number(o.target_value) || 0), 0);
    const actual = objs.reduce((s: number, o: any) => s + (Number(o.current_value) || 0), 0);
    const pct = target > 0 ? Math.min(100, (actual / target) * 100) : 0;
    return { area: a, objs, target, actual, pct, hasObjective: objs.length > 0 };
  }), [objectives]);

  if (!Number.isFinite(year)) return null;

  return (
    <AppLayout>
      <div className="space-y-8">
        <BackNavigation />
        <PageHeader
          title={`Fecho de ${year}`}
          subtitle={isClosed
            ? `Fechado em ${draft.fechado_em ? new Date(draft.fechado_em).toLocaleDateString('pt-PT') : '—'}`
            : 'Em análise — revê os resultados, regista decisões e fecha o ano.'}
        />

        <div className="flex items-center gap-3 -mt-2 flex-wrap">
          <Badge variant={isClosed ? 'default' : 'secondary'} className="text-xs">
            {isClosed ? <><Lock className="h-3 w-3 mr-1" /> Fechado</> : 'Em análise'}
          </Badge>
          <div className="flex-1" />
          <Button asChild variant="outline" size="sm">
            <Link to={`/executive/planeamento/operacional?ano=${year}&mes=12`}>
              Cockpit de Dezembro
            </Link>
          </Button>
          {!isClosed && (
            <Button size="sm" onClick={() => save.mutate(undefined)} disabled={save.isPending}>
              Guardar rascunho
            </Button>
          )}
        </div>

        {/* SECÇÃO 1 — RESULTADOS POR ÁREA */}
        <section className="space-y-3">
          <h2 className="text-base font-semibold">Resultados por área</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {cards.map(({ area, objs, target, actual, pct, hasObjective }) => {
              const Icon = area.icon;
              return (
                <div key={area.key} className="hq-card p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold">{area.label}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {objs[0]?.title || 'Sem objetivo definido'}
                      </div>
                    </div>
                    {hasObjective && <span className={cn('h-2.5 w-2.5 rounded-full', semaphore(pct))} />}
                  </div>
                  {hasObjective && (
                    <>
                      <div className="flex items-baseline justify-between text-xs">
                        <span className="tabular-nums font-medium">
                          {actual.toLocaleString('pt-PT')} / {target.toLocaleString('pt-PT')}{' '}
                          {objs[0]?.target_unit || ''}
                        </span>
                        <Badge variant="outline" className="text-[10px]">{Math.round(pct)}%</Badge>
                      </div>
                      <Progress value={pct} className="h-1.5" />
                    </>
                  )}
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">O que aconteceu nesta área?</Label>
                    <Textarea
                      rows={2}
                      value={draft.area_notes[area.key] || ''}
                      onChange={(e) => setDraft(d => ({
                        ...d,
                        area_notes: { ...d.area_notes, [area.key]: e.target.value },
                      }))}
                      readOnly={readOnly}
                      className="text-xs"
                      placeholder="Ex: superámos a meta de receita por…"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* SECÇÃO 2 — REFLEXÃO */}
        <section className="space-y-3">
          <h2 className="text-base font-semibold">Reflexão</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-xs">O que funcionou este ano?</Label>
              <Textarea
                rows={5}
                value={draft.o_que_funcionou || ''}
                onChange={(e) => setDraft(d => ({ ...d, o_que_funcionou: e.target.value }))}
                readOnly={readOnly}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">O que mudar para o próximo ano?</Label>
              <Textarea
                rows={5}
                value={draft.o_que_mudar || ''}
                onChange={(e) => setDraft(d => ({ ...d, o_que_mudar: e.target.value }))}
                readOnly={readOnly}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Decisões para {year + 1}</Label>
              <Textarea
                rows={5}
                value={draft.decisoes_ano_seguinte || ''}
                onChange={(e) => setDraft(d => ({ ...d, decisoes_ano_seguinte: e.target.value }))}
                readOnly={readOnly}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-primary" />
                Este ano aproximou-me da minha visão a 5 anos?
              </Label>
              <Textarea
                rows={5}
                value={draft.alinhamento_visao_5_anos || ''}
                onChange={(e) => setDraft(d => ({ ...d, alinhamento_visao_5_anos: e.target.value }))}
                readOnly={readOnly}
              />
            </div>
          </div>
        </section>

        {/* SECÇÃO 3 — FECHAR / PRÓXIMOS PASSOS */}
        <section className="hq-card p-5 flex flex-col md:flex-row md:items-center gap-4">
          {!isClosed ? (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">Pronto para fechar {year}?</p>
                <p className="text-xs text-muted-foreground">
                  Ao fechar, os campos passam a read-only e o ano seguinte fica desbloqueado para planeamento.
                </p>
              </div>
              <Button onClick={() => closeYear.mutate()} disabled={closeYear.isPending}>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Fechar o ano de {year}
              </Button>
            </>
          ) : (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">{year} fechado.</p>
                <p className="text-xs text-muted-foreground">Avança para planear {year + 1}.</p>
              </div>
              <Button asChild>
                <Link to={`/executive/planeamento?ano=${year + 1}`}>
                  Planear {year + 1} <ArrowRight className="h-4 w-4 ml-2" />
                </Link>
              </Button>
            </>
          )}
        </section>
      </div>
    </AppLayout>
  );
}