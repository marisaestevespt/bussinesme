import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { planStatusLabel } from '@/hooks/usePlanningData';

const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const QUARTERS = ['T1','T2','T3','T4'];
const SEMESTERS = ['S1','S2'];
const ORDER = [...MONTHS, ...QUARTERS, ...SEMESTERS, 'Anual'];

interface Props { planning: any; }

export function AllGoalsList({ planning }: Props) {
  const groups = useMemo(() => {
    const goals = (planning.allGoals || []) as any[];
    const map = new Map<string, any[]>();
    for (const g of goals) {
      const k = g.period || 'Sem período';
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(g);
    }
    return Array.from(map.entries()).sort(([a], [b]) => {
      const ai = ORDER.indexOf(a); const bi = ORDER.indexOf(b);
      if (ai === -1 && bi === -1) return a.localeCompare(b);
      if (ai === -1) return 1; if (bi === -1) return -1;
      return ai - bi;
    });
  }, [planning.allGoals]);

  if (groups.length === 0) {
    return <p className="text-xs text-muted-foreground italic">Sem metas pequenas definidas para este ano.</p>;
  }

  return (
    <div className="space-y-3">
      {groups.map(([period, items]) => (
        <div key={period} className="rounded-lg border border-border/60 bg-card p-3">
          <p className="text-xs font-semibold mb-2">{period} <span className="text-muted-foreground font-normal">· {items.length}</span></p>
          <div className="space-y-1.5">
            {items.map((g: any) => {
              const target = Number(g.target_value || 0);
              const actual = Number(g.actual_value || 0);
              const pct = g.status === 'atingido' ? 100 : (target > 0 ? Math.min(100, Math.round((actual / target) * 100)) : 0);
              return (
                <div key={g.id} className="flex items-center gap-2 text-xs">
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-medium">{g.title || g.description || 'Meta sem título'}</p>
                    {target > 0 && (
                      <p className="text-[10px] text-muted-foreground tabular-nums">
                        {actual} / {target} {g.target_unit || ''}
                      </p>
                    )}
                  </div>
                  <div className="w-20 hidden sm:block"><Progress value={pct} className="h-1" /></div>
                  <Badge variant="outline" className="text-[9px] shrink-0">{planStatusLabel(g.status)}</Badge>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}