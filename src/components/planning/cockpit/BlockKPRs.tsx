import { useMemo, useState } from 'react';
import { useDepartmentKpis, type DepartmentKpi } from '@/hooks/useDepartmentKpis';
import { useDepartmentKpiMonthly } from '@/hooks/useDepartmentKpiMonthly';
import { PLAN_AREAS, planAreaLabel } from '@/hooks/usePlanningData';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, Briefcase, Megaphone, Wallet, Settings2, Users, Package, UserCog, Target } from 'lucide-react';
import { InlineEditableText } from '@/components/ui/inline-editable-text';

const AREA_ICONS: Record<string, any> = {
  comercial: Briefcase, marketing: Megaphone, financeiro: Wallet,
  operacao: Settings2, clientes: Users, produtos: Package,
  equipa: UserCog, geral: Target,
};

interface Props {
  year: number;
  month: number;
}

export function BlockKPRs({ year, month }: Props) {
  const { list: kpis } = useDepartmentKpis();
  const kpiIds = useMemo(() => kpis.map(k => k.id), [kpis]);
  const { list: monthlyRows, upsert } = useDepartmentKpiMonthly(year, kpiIds);

  const byKpi = useMemo(() => {
    const m = new Map<string, typeof monthlyRows[number]>();
    monthlyRows.filter(r => r.month === month).forEach(r => m.set(r.kpi_id, r));
    return m;
  }, [monthlyRows, month]);

  const byArea = useMemo(() => {
    const m = new Map<string, DepartmentKpi[]>();
    for (const a of PLAN_AREAS) m.set(a.value, []);
    for (const k of kpis) {
      const arr = m.get(k.department) || [];
      arr.push(k);
      m.set(k.department, arr);
    }
    return m;
  }, [kpis]);

  const [open, setOpen] = useState<Record<string, boolean>>({});
  const toggle = (a: string) => setOpen(s => ({ ...s, [a]: !s[a] }));

  if (kpis.length === 0) {
    return <p className="text-xs text-muted-foreground italic">Sem KPRs definidos. Adiciona-os no dashboard de cada departamento.</p>;
  }

  return (
    <div className="space-y-2">
      {PLAN_AREAS.map(a => {
        const list = byArea.get(a.value) || [];
        if (list.length === 0) return null;
        const Icon = AREA_ICONS[a.value] || Target;
        const isOpen = open[a.value] ?? false;
        const filledCount = list.filter(k => {
          const r = byKpi.get(k.id);
          return r && (r.actual_value != null || r.target_value != null);
        }).length;
        return (
          <div key={a.value} className="rounded-md border border-border/60 overflow-hidden">
            <button
              type="button"
              onClick={() => toggle(a.value)}
              className="w-full flex items-center justify-between gap-3 px-3 py-2 bg-muted/30 hover:bg-muted/50 hq-transition"
            >
              <div className="flex items-center gap-2">
                <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground hq-transition ${isOpen ? '' : '-rotate-90'}`} />
                <div className="h-6 w-6 rounded bg-primary/10 text-primary flex items-center justify-center">
                  <Icon className="h-3 w-3" />
                </div>
                <span className="text-xs font-semibold uppercase tracking-wider">{planAreaLabel(a.value)}</span>
                <Badge variant="outline" className="text-[9px]">{list.length}</Badge>
              </div>
              <span className="text-[10px] text-muted-foreground tabular-nums">{filledCount}/{list.length} preenchidos</span>
            </button>

            {isOpen && (
              <div className="divide-y divide-border/40">
                <div className="grid grid-cols-[1fr_90px_90px_70px_1.5fr] gap-2 px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-medium bg-muted/10">
                  <span>KPR</span>
                  <span className="text-right">Meta</span>
                  <span className="text-right">Valor</span>
                  <span className="text-right">Δ</span>
                  <span>Análise / Impacto</span>
                </div>
                {list.map(k => {
                  const row = byKpi.get(k.id);
                  const target = row?.target_value;
                  const actual = row?.actual_value;
                  let delta: { txt: string; tone: string } | null = null;
                  if (target != null && actual != null && Number(target) > 0) {
                    const diff = ((Number(actual) - Number(target)) / Number(target)) * 100;
                    delta = {
                      txt: `${diff >= 0 ? '+' : ''}${diff.toFixed(0)}%`,
                      tone: diff >= 0 ? 'text-emerald-600' : 'text-amber-600',
                    };
                  }
                  return (
                    <div key={k.id} className="grid grid-cols-[1fr_90px_90px_70px_1.5fr] gap-2 px-3 py-2 items-center">
                      <div className="min-w-0">
                        <div className="text-xs truncate">{k.name}</div>
                        {k.unit && <div className="text-[10px] text-muted-foreground">{k.unit}</div>}
                      </div>
                      <Input
                        type="number"
                        defaultValue={target ?? ''}
                        onBlur={(e) => {
                          const v = e.target.value === '' ? null : Number(e.target.value);
                          if (v !== (target ?? null)) upsert.mutate({ kpi_id: k.id, year, month, target_value: v, actual_value: actual ?? null });
                        }}
                        className="h-7 text-xs text-right tabular-nums"
                        placeholder="—"
                      />
                      <Input
                        type="number"
                        defaultValue={actual ?? ''}
                        onBlur={(e) => {
                          const v = e.target.value === '' ? null : Number(e.target.value);
                          if (v !== (actual ?? null)) upsert.mutate({ kpi_id: k.id, year, month, actual_value: v, target_value: target ?? null });
                        }}
                        className="h-7 text-xs text-right tabular-nums"
                        placeholder="—"
                      />
                      <div className={`text-[11px] text-right tabular-nums ${delta?.tone || 'text-muted-foreground'}`}>
                        {delta?.txt || '—'}
                      </div>
                      <div className="min-w-0">
                        <InlineEditableText
                          value={row?.analysis || ''}
                          emptyText={row?.auto_analysis || 'Adicionar análise…'}
                          placeholder={row?.auto_analysis || 'Porquê? Que ação tomar?'}
                          multiline
                          rows={1}
                          onSave={(v) => upsert.mutate({ kpi_id: k.id, year, month, analysis: v, target_value: target ?? null, actual_value: actual ?? null })}
                          displayClassName="text-[11px] text-muted-foreground"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
