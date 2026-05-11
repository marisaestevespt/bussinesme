import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Briefcase, Megaphone, Wallet, Settings2, Users, Package, UserCog, Target } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { MONTH_NAMES_PT } from './useMonthState';

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
  if (pct >= 90) return { tone: 'bg-emerald-500', label: 'No alvo' };
  if (pct >= 60) return { tone: 'bg-amber-500', label: 'Atenção' };
  return { tone: 'bg-red-500', label: 'Em risco' };
}

export function BlockObjetivos({ year, month }: { year: number; month: number }) {
  const periodLabel = MONTH_NAMES_PT[month - 1];

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['cockpit-objectives', year, month],
    queryFn: async () => {
      const [{ data: goals }, { data: objs }] = await Promise.all([
        supabase.from('planning_goals').select('*').eq('year', year).eq('period', periodLabel),
        supabase.from('executive_objectives').select('id, area, title, target_value, value_source').eq('year', year),
      ]);
      const objById = new Map((objs || []).map((o: any) => [o.id, o]));
      return AREAS.map(a => {
        const objsArea = (objs || []).filter((o: any) => o.area === a.key);
        const goalsArea = (goals || []).filter((g: any) => objsArea.some((o: any) => o.id === g.objective_id));
        const target = goalsArea.reduce((s: number, g: any) => s + (Number(g.target_value) || 0), 0);
        const actual = goalsArea.reduce((s: number, g: any) => s + (Number(g.actual_value) || 0), 0);
        return { area: a, target, actual, hasGoal: goalsArea.length > 0, objectiveCount: objsArea.length };
      });
      void objById; // reserved
    },
    staleTime: 60_000,
  });

  if (isLoading) return <div className="text-xs text-muted-foreground">A carregar metas…</div>;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
      {rows.map(({ area, target, actual, hasGoal }) => {
        const Icon = area.icon;
        const pct = target > 0 ? Math.min(100, (actual / target) * 100) : 0;
        const sem = semaphore(pct);
        return (
          <div key={area.key} className="hq-surface-sunken rounded-lg p-3 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-md bg-background flex items-center justify-center text-primary">
                <Icon className="h-3.5 w-3.5" />
              </div>
              <div className="text-xs font-medium flex-1 truncate">{area.label}</div>
              {hasGoal && <span className={`h-2 w-2 rounded-full ${sem.tone}`} title={sem.label} />}
            </div>
            {hasGoal ? (
              <>
                <div className="flex items-baseline gap-1 text-xs">
                  <span className="font-semibold tabular-nums">{actual.toLocaleString('pt-PT')}</span>
                  <span className="text-muted-foreground">/ {target.toLocaleString('pt-PT')}</span>
                </div>
                <Progress value={pct} className="h-1.5" />
                <Badge variant="outline" className="text-[10px] w-fit px-1.5 py-0">{Math.round(pct)}%</Badge>
              </>
            ) : (
              <>
                <p className="text-[11px] text-muted-foreground">Sem meta definida</p>
                <Button asChild size="sm" variant="ghost" className="h-7 text-xs justify-start px-2">
                  <Link to={`/executive/planeamento/objetivos?area=${area.key}&ano=${year}`}>
                    Definir meta
                  </Link>
                </Button>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}