import { useState } from 'react';
import { usePlanningData } from '@/hooks/usePlanningData';
import { useDepartmentKpis } from '@/hooks/useDepartmentKpis';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Target, Save } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Key Results em curso (objective_metrics) com leitura automática (KPI ligado ou fonte BD)
 * e edição rápida do valor atual quando manual.
 */
export function BlockMonthlyKRs({ year }: { year: number; month: number }) {
  const planning = usePlanningData(year);
  const allKpis = useDepartmentKpis();
  const kpiById = new Map((allKpis.list || []).map((k: any) => [k.id, k]));
  const [editing, setEditing] = useState<Record<string, string>>({});

  const krs = (planning.allMetrics || []).filter((m: any) => m.target_value);

  if (planning.metrics.isLoading) return <p className="text-xs text-muted-foreground">A carregar KRs…</p>;
  if (krs.length === 0) {
    return (
      <div className="text-xs text-muted-foreground space-y-1">
        <p>Ainda não há <strong>Key Results</strong> com meta definida.</p>
        <p className="text-[11px]">
          Os KRs vivem dentro de cada objetivo anual — abre Planeamento → Ano → escolhe um objetivo e adiciona as métricas (target + fonte). Aparecem aqui para acompanhares o progresso mês a mês. Não confundir com os KPIs do departamento (esses são permanentes e geridos por área).
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {krs.map((m: any) => {
        const linkedKpi = m.linked_kpi_id ? kpiById.get(m.linked_kpi_id) : null;
        const autoVal = !linkedKpi && m.source !== 'manual'
          ? planning.getAutoValue(m.source, null)
          : null;
        const current = linkedKpi ? Number(linkedKpi.current_value || 0)
          : (m.source === 'manual' ? Number(m.current_value || 0) : Number(autoVal || 0));
        const target = Number(m.target_value || 0);
        const pct = target > 0 ? Math.min(100, (current / target) * 100) : 0;
        const tone = pct >= 90 ? 'bg-emerald-500' : pct >= 60 ? 'bg-amber-500' : 'bg-red-500';
        const isManual = !linkedKpi && m.source === 'manual';
        const editVal = editing[m.id];
        const obj = (planning.allObjectives || []).find((o: any) => o.id === m.objective_id);

        return (
          <div key={m.id} className="hq-surface-sunken rounded-lg p-2.5 flex items-center gap-3">
            <Target className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium truncate">{m.name}</span>
                {obj && <Badge variant="outline" className="text-[10px]">{obj.title}</Badge>}
                {linkedKpi && <Badge variant="secondary" className="text-[10px]">via KPI: {linkedKpi.name}</Badge>}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className={cn('h-full', tone)} style={{ width: `${pct}%` }} />
                </div>
                <span className="text-[11px] tabular-nums text-muted-foreground whitespace-nowrap">
                  {current.toLocaleString('pt-PT')} / {target.toLocaleString('pt-PT')} {m.target_unit || ''}
                </span>
                <span className="text-[11px] tabular-nums font-medium w-10 text-right">{Math.round(pct)}%</span>
              </div>
            </div>
            {isManual && (
              editVal !== undefined ? (
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    autoFocus
                    value={editVal}
                    onChange={(e) => setEditing((s) => ({ ...s, [m.id]: e.target.value }))}
                    className="h-7 w-24 text-xs"
                  />
                  <Button size="sm" className="h-7 px-2" onClick={() => {
                    planning.upsertMetric.mutate({ id: m.id, objective_id: m.objective_id, current_value: Number(editVal) });
                    setEditing((s) => { const c = { ...s }; delete c[m.id]; return c; });
                  }}>
                    <Save className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <Button size="sm" variant="ghost" className="h-7 text-xs"
                  onClick={() => setEditing((s) => ({ ...s, [m.id]: String(current) }))}>
                  Atualizar
                </Button>
              )
            )}
          </div>
        );
      })}
    </div>
  );
}