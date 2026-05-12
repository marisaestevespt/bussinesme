import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Briefcase, Megaphone, Wallet, Settings2, Users, Package, UserCog, Target, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Link } from 'react-router-dom';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';
import { MONTH_NAMES_PT } from './useMonthState';
import { ObjectiveDetailSheet } from '../ObjectiveDetailSheet';
import { usePlanningData } from '@/hooks/usePlanningData';

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

function statusTone(pct: number, hasGoal: boolean) {
  if (!hasGoal) return { dot: 'bg-muted', label: 'sem meta' };
  if (pct >= 90) return { dot: 'bg-emerald-500', label: 'no alvo' };
  if (pct >= 60) return { dot: 'bg-amber-500', label: 'atenção' };
  return { dot: 'bg-red-500', label: 'em risco' };
}

export function BlockObjetivos({ year, month }: { year: number; month: number }) {
  const periodLabel = MONTH_NAMES_PT[month - 1];
  const [areaFilter, setAreaFilter] = useState<string>('all');
  const [selected, setSelected] = useState<any>(null);
  const planning = usePlanningData(year);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['cockpit-objectives-table', year, month],
    queryFn: async () => {
      const [{ data: goals }, { data: objs }] = await Promise.all([
        supabase.from('planning_goals').select('*').eq('year', year).eq('period', periodLabel),
        supabase.from('executive_objectives').select('*').eq('year', year),
      ]);
      const goalsByObj = new Map<string, any>();
      (goals || []).forEach((g: any) => goalsByObj.set(g.objective_id, g));
      return (objs || []).map((o: any) => {
        const g = goalsByObj.get(o.id);
        const target = Number(g?.target_value ?? o.target_value ?? 0);
        const actual = Number(g?.actual_value ?? o.current_value ?? 0);
        const pct = target > 0 ? Math.min(100, (actual / target) * 100) : 0;
        return { obj: o, goal: g, target, actual, pct, hasGoal: !!g };
      });
    },
    staleTime: 60_000,
  });

  const filtered = areaFilter === 'all' ? rows : rows.filter((r: any) => r.obj.area === areaFilter);
  const areaCounts = AREAS.map(a => ({ ...a, count: rows.filter((r: any) => r.obj.area === a.key).length }));

  if (isLoading) return <div className="text-xs text-muted-foreground">A carregar metas…</div>;

  return (
    <div className="space-y-3">
      {/* Filtro por área */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <ToggleGroup type="single" value={areaFilter} onValueChange={(v) => v && setAreaFilter(v)} className="flex-wrap justify-start">
          <ToggleGroupItem value="all" className="h-7 px-2 text-xs">Todas ({rows.length})</ToggleGroupItem>
          {areaCounts.filter(a => a.count > 0).map(a => (
            <ToggleGroupItem key={a.key} value={a.key} className="h-7 px-2 text-xs">
              <a.icon className="h-3 w-3 mr-1" />{a.label} ({a.count})
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <Button asChild size="sm" variant="outline" className="h-7 text-xs">
          <Link to={`/executive/planeamento`}><Plus className="h-3 w-3 mr-1" />Novo objetivo</Link>
        </Button>
      </div>

      {/* Tabela */}
      {filtered.length === 0 ? (
        <p className="text-xs text-muted-foreground py-6 text-center">Sem objetivos para este filtro.</p>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="text-left font-medium px-3 py-2">Objetivo</th>
                <th className="text-left font-medium px-2 py-2">Departamento</th>
                <th className="text-right font-medium px-2 py-2">Meta</th>
                <th className="text-right font-medium px-2 py-2">Atual</th>
                <th className="text-left font-medium px-2 py-2 w-32">Progresso</th>
                <th className="text-left font-medium px-2 py-2">Estado</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(({ obj, target, actual, pct, hasGoal }: any) => {
                const area = AREAS.find(a => a.key === obj.area);
                const Icon = area?.icon || Target;
                const tone = statusTone(pct, hasGoal);
                return (
                  <tr
                    key={obj.id}
                    className="border-t hover:bg-muted/30 cursor-pointer hq-transition"
                    onClick={() => setSelected(obj)}
                  >
                    <td className="px-3 py-2 font-medium truncate max-w-[260px]">{obj.title}</td>
                    <td className="px-2 py-2">
                      <Badge variant="outline" className="text-[10px] gap-1">
                        <Icon className="h-3 w-3" />{area?.label || obj.area || '—'}
                      </Badge>
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">{hasGoal ? target.toLocaleString('pt-PT') : '—'}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{hasGoal ? actual.toLocaleString('pt-PT') : '—'}</td>
                    <td className="px-2 py-2">
                      {hasGoal ? (
                        <div className="flex items-center gap-2">
                          <Progress value={pct} className="h-1.5 flex-1" />
                          <span className="tabular-nums text-[10px] text-muted-foreground w-8 text-right">{Math.round(pct)}%</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-[10px]">sem meta mensal</span>
                      )}
                    </td>
                    <td className="px-2 py-2">
                      <span className="inline-flex items-center gap-1.5">
                        <span className={cn('h-2 w-2 rounded-full', tone.dot)} />
                        <span className="text-[10px] text-muted-foreground">{tone.label}</span>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ObjectiveDetailSheet
        open={!!selected}
        onClose={() => setSelected(null)}
        objective={selected}
        planning={planning}
      />
    </div>
  );
}
