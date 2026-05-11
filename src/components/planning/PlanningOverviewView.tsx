import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Building2, TrendingUp, Megaphone, Users, Cog, UserCog, Lightbulb, Workflow, Target, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { HorizonsView } from './HorizonsView';

const AREA_META: Record<string, { label: string; icon: typeof Building2; color: string }> = {
  financeiro: { label: 'Financeiro', icon: Building2, color: 'text-success bg-success/10' },
  comercial:  { label: 'Comercial',  icon: TrendingUp, color: 'text-primary bg-primary/10' },
  marketing:  { label: 'Marketing',  icon: Megaphone, color: 'text-accent-violet bg-accent-violet/10' },
  operacao:   { label: 'Operação',   icon: Cog, color: 'text-warning bg-warning/10' },
  clientes:   { label: 'Clientes',   icon: Users, color: 'text-info bg-info/10' },
  equipa:     { label: 'Equipa',     icon: UserCog, color: 'text-destructive bg-destructive/10' },
  produto:    { label: 'Produto & Inovação', icon: Lightbulb, color: 'text-accent-violet bg-accent-violet/10' },
  processos:  { label: 'Processos',  icon: Workflow, color: 'text-foreground bg-muted' },
};

// 8 áreas oficiais para análise de cobertura
const COVERAGE_AREAS = ['financeiro', 'comercial', 'marketing', 'operacao', 'clientes', 'equipa', 'produto', 'processos'] as const;

interface Props {
  planning: any;
  year: number;
  stats: { totalObjs: number; achieved: number; inProgress: number; avgProgress: number; deviationCount: number };
}

export function PlanningOverviewView({ planning, year, stats }: Props) {
  const objectives = planning.allObjectives || [];

  // Cobertura por área
  const areaCoverage = useMemo(() => {
    return COVERAGE_AREAS.map(areaKey => {
      const meta = AREA_META[areaKey];
      const objs = objectives.filter((o: any) => (o.area || 'outro') === areaKey);
      const total = objs.length;
      const achieved = objs.filter((o: any) => o.status === 'atingido').length;
      const inProgress = objs.filter((o: any) => o.status === 'em_curso').length;
      const avgProg = total > 0
        ? Math.round(objs.reduce((s: number, o: any) => s + planning.objectiveProgress(o), 0) / total)
        : 0;
      return { key: areaKey, ...meta, total, achieved, inProgress, avgProg, missing: total === 0 };
    });
  }, [objectives, planning]);

  const missingAreas = areaCoverage.filter(a => a.missing).length;
  const coveredAreas = COVERAGE_AREAS.length - missingAreas;
  const coveragePct = Math.round((coveredAreas / COVERAGE_AREAS.length) * 100);

  return (
    <div className="space-y-6">
      {/* Horizontes do ano (substitui cascata estratégico/tático/operacional) */}
      <HorizonsView planning={planning} year={year} />

      {/* Cobertura por área */}
      <Card className="hq-card">
        <CardHeader>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                Cobertura por Área de Negócio
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Estás a planear <strong className="text-foreground">{coveredAreas}/{COVERAGE_AREAS.length}</strong> áreas do negócio ({coveragePct}%).
                {missingAreas > 0 && <> Faltam <strong className="text-destructive">{missingAreas}</strong> áreas sem objetivos.</>}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Progress value={coveragePct} className="w-32 h-2" />
              <span className="text-sm font-semibold tabular-nums">{coveragePct}%</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {areaCoverage.map(area => {
              const Icon = area.icon;
              return (
                <div
                  key={area.key}
                  className={`rounded-xl border p-3 transition-all ${area.missing ? 'border-dashed border-destructive/40 bg-destructive/5' : 'border-border bg-card hover:shadow-md'}`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${area.color}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    {area.missing ? (
                      <Badge variant="outline" className="text-[10px] gap-1 border-destructive/40 text-destructive">
                        <AlertTriangle className="h-2.5 w-2.5" /> Sem plano
                      </Badge>
                    ) : area.avgProg >= 80 ? (
                      <Badge variant="outline" className="text-[10px] gap-1 border-success/40 text-success">
                        <CheckCircle2 className="h-2.5 w-2.5" /> Forte
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-sm font-semibold">{area.label}</p>
                  {area.missing ? (
                    <p className="text-xs text-muted-foreground mt-1">Define ao menos 1 objetivo aqui.</p>
                  ) : (
                    <>
                      <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
                        <span>{area.total} obj · {area.achieved} ✓</span>
                        <span className="font-medium tabular-nums text-foreground">{area.avgProg}%</span>
                      </div>
                      <Progress value={area.avgProg} className="h-1 mt-1.5" />
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {missingAreas > 0 && (
            <>
              <Separator className="my-4" />
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <p className="text-xs text-muted-foreground">
                  Olhar o negócio "como um todo" implica ter pelo menos 1 objetivo em cada área crítica.
                </p>
                <Button size="sm" variant="outline" onClick={() => {
                  const el = document.querySelector('[data-objectives-section]');
                  el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}>
                  <Target className="h-3.5 w-3.5 mr-1.5" /> Adicionar objetivo
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}