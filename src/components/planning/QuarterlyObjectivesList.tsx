import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ChevronDown, ChevronRight, Plus, Pencil, Save, X, Briefcase, Megaphone, Wallet, Settings2, Users, Package, UserCog, Target } from 'lucide-react';
import { cn } from '@/lib/utils';
import { planAreaLabel, planStatusLabel, PLAN_AREAS } from '@/hooks/usePlanningData';
import { ObjectiveDetailSheet } from './ObjectiveDetailSheet';
import { DepartmentKpisSection } from './DepartmentKpisSection';

const AREA_ICONS: Record<string, any> = {
  comercial: Briefcase,
  marketing: Megaphone,
  financeiro: Wallet,
  operacao: Settings2,
  clientes: Users,
  produtos: Package,
  equipa: UserCog,
  geral: Target,
};

const QUARTER_MONTHS: Record<string, string[]> = {
  T1: ['Janeiro', 'Fevereiro', 'Março'],
  T2: ['Abril', 'Maio', 'Junho'],
  T3: ['Julho', 'Agosto', 'Setembro'],
  T4: ['Outubro', 'Novembro', 'Dezembro'],
};

function fmt(v: number | null | undefined, unit?: string | null) {
  if (v == null || isNaN(Number(v))) return '—';
  const n = Number(v);
  const s = Math.abs(n) >= 1000 ? n.toLocaleString('pt-PT') : String(n);
  return unit ? `${s} ${unit}` : s;
}

interface Props {
  planning: any;
  quarter: 'T1' | 'T2' | 'T3' | 'T4';
  year: number;
}

/**
 * Vista de trimestre: lista vertical de objetivos anuais, cada um expandido
 * mostra os Key Results e as metas trimestrais (planning_goals) desse trimestre.
 * Áreas surgem agrupadas como secções colapsáveis editáveis.
 */
export function QuarterlyObjectivesList({ planning, quarter, year }: Props) {
  const [openObj, setOpenObj] = useState<Record<string, boolean>>({});
  const [detailObj, setDetailObj] = useState<any>(null);

  const objectives = planning.allObjectives || [];
  const metrics = planning.allMetrics || [];
  const goals = planning.allGoals || [];
  const qMonths = QUARTER_MONTHS[quarter];

  // Group objectives by area — render ALL 8 canonical areas, even empty ones,
  // so o utilizador pode planear/criar objetivos por área diretamente daqui.
  const byArea = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const a of PLAN_AREAS) map[a.value] = [];
    for (const o of objectives) {
      const k = o.area || 'geral';
      if (!map[k]) map[k] = [];
      map[k].push(o);
    }
    return PLAN_AREAS.map((a) => [a.value, map[a.value] || []] as [string, any[]]);
  }, [objectives]);

  const goalsForObj = (objId: string) =>
    goals.filter((g: any) => g.objective_id === objId && (qMonths.includes(g.period) || g.period === quarter));

  const krsForObj = (objId: string) => metrics.filter((m: any) => m.objective_id === objId);

  return (
    <div className="space-y-4">
      {byArea.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Sem objetivos definidos para {year}.
          </CardContent>
        </Card>
      )}

      {byArea.map(([area, objs]) => {
        const Icon = AREA_ICONS[area] || Target;
        return (
          <Card key={area} className="hq-card overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-4 py-3 bg-muted/30 border-b border-border/50">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-md bg-primary/10 text-primary flex items-center justify-center">
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <h2 className="text-sm font-semibold uppercase tracking-wider">{planAreaLabel(area)}</h2>
                <Badge variant="outline" className="text-[10px]">{objs.length} objetivos</Badge>
              </div>
              <span className="text-[10px] text-muted-foreground">{quarter} · {qMonths.join(' · ')}</span>
            </div>

            <div className="p-4 space-y-4">
              {/* KPIs permanentes do departamento */}
              <DepartmentKpisSection department={area} departmentLabel={planAreaLabel(area)} />

              {/* Objetivos da área */}
              <Card className="hq-card">
                <CardContent className="pt-5">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-base font-semibold">Objetivos &amp; Key Results</p>
                      <p className="text-xs text-muted-foreground">Metas anuais com progresso por {quarter}.</p>
                    </div>
                  </div>
                  <div className="divide-y divide-border/40 -mx-4">
                {objs.length === 0 && (
                  <div className="px-4 py-6 text-center text-xs text-muted-foreground space-y-2">
                    <p>Sem objetivos para esta área neste ano.</p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => {
                        planning.upsertObjective.mutate({
                          title: `Novo objetivo · ${planAreaLabel(area)}`,
                          area,
                          objective_type: 'quantitativo',
                          status: 'por_iniciar',
                          year,
                        });
                      }}
                    >
                      <Plus className="h-3 w-3 mr-1" /> Criar objetivo de {planAreaLabel(area)}
                    </Button>
                  </div>
                )}
                {objs.map((obj: any) => {
                  const expanded = !!openObj[obj.id];
                  const krs = krsForObj(obj.id);
                  const objGoals = goalsForObj(obj.id);
                  const prog = planning.objectiveProgress(obj);
                  const current = planning.objectiveCurrentValue?.(obj);
                  return (
                    <div key={obj.id} className="px-4 py-3 space-y-2">
                      <div className="flex items-start gap-2">
                        <button
                          onClick={() => setOpenObj((s) => ({ ...s, [obj.id]: !expanded }))}
                          className="mt-0.5 text-muted-foreground hover:text-foreground"
                          aria-label={expanded ? 'Colapsar' : 'Expandir'}
                        >
                          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline justify-between gap-3 flex-wrap">
                            <p className="font-medium text-sm">{obj.title}</p>
                            <div className="flex items-center gap-2 text-[11px] text-muted-foreground tabular-nums">
                              {obj.target_value ? (
                                <span>{fmt(current ?? 0, obj.target_unit)} / {fmt(obj.target_value, obj.target_unit)}</span>
                              ) : null}
                              <Badge variant="secondary" className="text-[9px]">{prog}%</Badge>
                            </div>
                          </div>
                          <Progress value={prog} className="h-1 mt-1.5" />
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => setDetailObj(obj)}
                          aria-label="Editar objetivo"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </div>

                      {expanded && (
                        <div className="pl-6 pt-2 space-y-3">
                          {/* Key Results */}
                          <div className="space-y-1.5">
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Key Results</p>
                            {krs.length === 0 && (
                              <p className="text-[11px] text-muted-foreground italic">Sem KRs. Abre o objetivo para adicionar.</p>
                            )}
                            {krs.map((m: any) => {
                              const mt = Number(m.target_value || 0);
                              const mc = Number(m.current_value || 0);
                              const mp = mt > 0 ? Math.min(100, Math.round((mc / mt) * 100)) : 0;
                              return (
                                <div key={m.id} className="space-y-0.5">
                                  <div className="flex items-baseline justify-between gap-2 text-[11px]">
                                    <span className="truncate">{m.name}</span>
                                    <span className="tabular-nums shrink-0 font-medium">
                                      {fmt(mc, m.target_unit)} {mt > 0 ? `/ ${fmt(mt, m.target_unit)}` : ''}
                                    </span>
                                  </div>
                                  {mt > 0 && <Progress value={mp} className="h-1" />}
                                </div>
                              );
                            })}
                          </div>

                          {/* Metas do trimestre (editáveis inline) */}
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Metas neste trimestre</p>
                              <NewGoalButton planning={planning} objective={obj} quarter={quarter} year={year} />
                            </div>
                            {objGoals.length === 0 && (
                              <p className="text-[11px] text-muted-foreground italic">Ainda sem metas trimestrais/mensais para {quarter}.</p>
                            )}
                            <div className="space-y-1">
                              {objGoals.map((g: any) => (
                                <EditableGoalRow key={g.id} goal={g} planning={planning} unit={obj.target_unit} />
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
                  </div>
                </CardContent>
              </Card>
            </div>
          </Card>
        );
      })}

      <ObjectiveDetailSheet
        open={!!detailObj}
        onClose={() => setDetailObj(null)}
        objective={detailObj}
        planning={planning}
      />
    </div>
  );
}

function EditableGoalRow({ goal, planning, unit }: { goal: any; planning: any; unit?: string | null }) {
  const [editing, setEditing] = useState(false);
  const [target, setTarget] = useState(String(goal.target_value ?? ''));
  const [actual, setActual] = useState(String(goal.actual_value ?? ''));
  const [notes, setNotes] = useState(String(goal.notes ?? ''));

  const save = () => {
    planning.upsertGoal.mutate({
      ...goal,
      target_value: target,
      actual_value: actual,
      notes,
    });
    setEditing(false);
  };

  const cancel = () => {
    setTarget(String(goal.target_value ?? ''));
    setActual(String(goal.actual_value ?? ''));
    setNotes(String(goal.notes ?? ''));
    setEditing(false);
  };

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="w-full text-left flex items-baseline justify-between gap-2 text-[11px] px-2 py-1.5 rounded-md hover:bg-muted/50 hq-transition border border-transparent hover:border-border/50"
      >
        <span className="flex items-center gap-2 truncate">
          <Badge variant="outline" className="text-[9px] shrink-0">{goal.period}</Badge>
          <span className="text-muted-foreground truncate">{goal.notes || 'Sem notas'}</span>
        </span>
        <span className="tabular-nums shrink-0 font-medium">
          {fmt(Number(goal.actual_value || 0), unit)} / {fmt(Number(goal.target_value || 0), unit)}
        </span>
      </button>
    );
  }

  return (
    <div className="space-y-2 p-2 rounded-md bg-muted/40 border border-border/50">
      <div className="flex items-center gap-2 text-[11px]">
        <Badge variant="outline" className="text-[9px]">{goal.period}</Badge>
        <span className="text-muted-foreground">Meta {unit ? `(${unit})` : ''}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Input
          value={actual}
          onChange={(e) => setActual(e.target.value)}
          placeholder="Atual"
          className="h-7 text-xs"
        />
        <Input
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          placeholder="Target"
          className="h-7 text-xs"
        />
      </div>
      <Textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notas (opcional)"
        rows={2}
        className="text-xs"
      />
      <div className="flex items-center justify-end gap-1">
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={cancel}>
          <X className="h-3 w-3 mr-1" /> Cancelar
        </Button>
        <Button size="sm" className="h-7 text-xs" onClick={save}>
          <Save className="h-3 w-3 mr-1" /> Guardar
        </Button>
      </div>
    </div>
  );
}

function NewGoalButton({ planning, objective, quarter, year }: { planning: any; objective: any; quarter: string; year: number }) {
  const [open, setOpen] = useState(false);
  const [period, setPeriod] = useState<string>(quarter);
  const [target, setTarget] = useState('');
  const [notes, setNotes] = useState('');

  const save = () => {
    if (!target) return;
    planning.upsertGoal.mutate({
      objective_id: objective.id,
      year,
      period,
      period_type: period.startsWith('T') ? 'trimestral' : 'mensal',
      target_value: target,
      actual_value: '0',
      notes,
      status: 'por_iniciar',
    });
    setOpen(false);
    setTarget('');
    setNotes('');
  };

  if (!open) {
    return (
      <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => setOpen(true)}>
        <Plus className="h-3 w-3 mr-1" /> Nova meta
      </Button>
    );
  }

  const periods = [quarter, ...QUARTER_MONTHS[quarter]];

  return (
    <div className="flex items-center gap-1">
      <select
        value={period}
        onChange={(e) => setPeriod(e.target.value)}
        className="h-6 text-[10px] rounded border border-border bg-background px-1"
      >
        {periods.map((p) => <option key={p} value={p}>{p}</option>)}
      </select>
      <Input
        value={target}
        onChange={(e) => setTarget(e.target.value)}
        placeholder="Target"
        className="h-6 text-[10px] w-20"
      />
      <Input
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notas"
        className="h-6 text-[10px] w-32"
      />
      <Button size="sm" className="h-6 text-[10px]" onClick={save} disabled={!target}>OK</Button>
      <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => setOpen(false)}>X</Button>
    </div>
  );
}