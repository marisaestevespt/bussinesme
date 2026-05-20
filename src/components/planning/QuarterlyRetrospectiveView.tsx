import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CheckCircle2, XCircle, Lightbulb, Plus, Trash2, Briefcase, Megaphone, Wallet, Settings2, Users, Package, UserCog, Target, ChevronDown } from 'lucide-react';
import { PLAN_AREAS, planAreaLabel } from '@/hooks/usePlanningData';
import { useQuarterlyPlan, type QuarterStr } from '@/hooks/useQuarterlyPlan';
import { confirmDestructive } from '@/lib/confirmDestructive';
import { InlineEditableText } from '@/components/ui/inline-editable-text';

const AREA_ICONS: Record<string, any> = {
  comercial: Briefcase, marketing: Megaphone, financeiro: Wallet,
  operacao: Settings2, clientes: Users, produtos: Package,
  equipa: UserCog, geral: Target,
};

const QUARTER_MONTHS: Record<QuarterStr, string[]> = {
  T1: ['Janeiro', 'Fevereiro', 'Março'],
  T2: ['Abril', 'Maio', 'Junho'],
  T3: ['Julho', 'Agosto', 'Setembro'],
  T4: ['Outubro', 'Novembro', 'Dezembro'],
};

interface Props {
  planning: any;
  year: number;
  quarter: QuarterStr;
  onlyArea?: string;
}

/**
 * Retrospetiva do trimestre: para cada área mostra quantos KRs/metas foram
 * atingidos, lista de aprendizagens editáveis, e o resumo retrospetivo.
 */
export function QuarterlyRetrospectiveView({ planning, year, quarter, onlyArea }: Props) {
  const { plans, items, upsertPlan, upsertItem, removeItem } = useQuarterlyPlan(year, quarter);
  const qMonths = QUARTER_MONTHS[quarter];

  const objectives = planning.allObjectives || [];
  const goals = planning.allGoals || [];

  // Per-area metrics: count of quarterly goals achieved vs target
  const areaStats = useMemo(() => {
    const map: Record<string, { total: number; achieved: number; pct: number }> = {};
    for (const a of PLAN_AREAS) map[a.value] = { total: 0, achieved: 0, pct: 0 };
    for (const o of objectives) {
      const areaKey = o.area || 'geral';
      if (!map[areaKey]) map[areaKey] = { total: 0, achieved: 0, pct: 0 };
      const objGoals = goals.filter((g: any) =>
        g.objective_id === o.id && (qMonths.includes(g.period) || g.period === quarter)
      );
      for (const g of objGoals) {
        map[areaKey].total += 1;
        const t = Number(g.target_value || 0);
        const a = Number(g.actual_value || 0);
        if (t > 0 && a >= t) map[areaKey].achieved += 1;
      }
    }
    Object.keys(map).forEach((k) => {
      const s = map[k];
      s.pct = s.total > 0 ? Math.round((s.achieved / s.total) * 100) : 0;
    });
    return map;
  }, [objectives, goals, qMonths, quarter]);

  const [openAreas, setOpenAreas] = useState<Record<string, boolean>>({});
  const isOpen = (area: string) => (onlyArea ? true : openAreas[area] ?? false);
  const toggle = (area: string) => setOpenAreas((s) => ({ ...s, [area]: !isOpen(area) }));

  return (
    <div className="space-y-4">
      {(onlyArea ? PLAN_AREAS.filter(a => a.value === onlyArea) : PLAN_AREAS).map((a) => {
        const area = a.value;
        const Icon = AREA_ICONS[area] || Target;
        const stats = areaStats[area];
        const plan = plans.find(p => p.area === area);
        const learnings = items.filter(i => i.area === area && i.kind === 'learning');
        const open = isOpen(area);

        return (
          <Card key={area} className="hq-card overflow-hidden">
            <button
              type="button"
              onClick={() => !onlyArea && toggle(area)}
              disabled={!!onlyArea}
              className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-muted/30 border-b border-border/50 hq-transition hover:bg-muted/50 disabled:cursor-default disabled:hover:bg-muted/30"
            >
              <div className="flex items-center gap-2">
                {!onlyArea && (
                  <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground hq-transition ${open ? '' : '-rotate-90'}`} />
                )}
                <div className="h-7 w-7 rounded-md bg-primary/10 text-primary flex items-center justify-center">
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <h2 className="text-sm font-semibold uppercase tracking-wider">{planAreaLabel(area)}</h2>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <span className="tabular-nums">{stats.achieved}/{stats.total} metas atingidas</span>
                <Badge variant={stats.pct >= 70 ? 'default' : 'secondary'} className="text-[9px]">{stats.pct}%</Badge>
              </div>
            </button>

            {open && (
            <div className="p-4 grid gap-3 md:grid-cols-2">
              {/* Conclusão do Q */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span className="text-[10px] uppercase tracking-wider font-medium">Conclusão {quarter}</span>
                </div>
                {stats.total === 0 ? (
                  <p className="text-[11px] text-muted-foreground italic">Sem metas trimestrais nesta área.</p>
                ) : (
                  <Progress value={stats.pct} className="h-1.5" />
                )}
                <InlineEditableText
                  value={plan?.retrospective || ''}
                  multiline
                  rows={3}
                  placeholder="O que correu bem? O que falhou? Porquê?"
                  emptyText="Adicionar resumo retrospetivo"
                  onSave={(v) => upsertPlan.mutate({ area, year, quarter, retrospective: v })}
                />
              </div>

              {/* Aprendizagens */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Lightbulb className="h-3.5 w-3.5" />
                  <span className="text-[10px] uppercase tracking-wider font-medium">Aprendizagens</span>
                  <Badge variant="outline" className="text-[9px] ml-auto">{learnings.length}</Badge>
                </div>
                <LearningsEditor
                  area={area} year={year} quarter={quarter}
                  items={learnings}
                  onAdd={(title) => upsertItem.mutate({ area, year, quarter, kind: 'learning', title })}
                  onRemove={(id) => removeItem.mutate(id)}
                />
              </div>
            </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

function LearningsEditor({ items, onAdd, onRemove }: {
  area: string; year: number; quarter: QuarterStr;
  items: any[];
  onAdd: (title: string) => void;
  onRemove: (id: string) => void;
}) {
  const [newTitle, setNewTitle] = useState('');
  const add = () => {
    const t = newTitle.trim();
    if (!t) return;
    onAdd(t);
    setNewTitle('');
  };

  return (
    <div className="space-y-1.5">
      {items.length === 0 && (
        <p className="text-[11px] text-muted-foreground italic">
          Regista o que aprendeste para aplicar no próximo trimestre.
        </p>
      )}
      {items.map((it) => (
        <div key={it.id} className="flex items-center gap-1.5 rounded border border-border/40 bg-background p-1.5">
          <Lightbulb className="h-3 w-3 text-amber-500 shrink-0" />
          <span className="text-[11px] flex-1 truncate">{it.title}</span>
          <Button
            size="icon" variant="ghost" className="h-5 w-5 text-destructive shrink-0"
            onClick={async () => {
              if (await confirmDestructive({ title: 'Remover aprendizagem?' })) onRemove(it.id);
            }}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      ))}
      <div className="flex items-center gap-1.5 pt-1">
        <Input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') add(); }}
          placeholder="Nova aprendizagem…"
          className="h-7 text-xs"
        />
        <Button size="sm" className="h-7 px-2" onClick={add} disabled={!newTitle.trim()}>
          <Plus className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}