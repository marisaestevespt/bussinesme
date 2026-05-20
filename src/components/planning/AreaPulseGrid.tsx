import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Megaphone, ShoppingCart, UserCheck, DollarSign, Headphones, Package, UsersRound } from 'lucide-react';
import { useDepartmentKpis } from '@/hooks/useDepartmentKpis';
import { useDepartmentKpiMonthly } from '@/hooks/useDepartmentKpiMonthly';
import { useKpiAutoValue } from '@/hooks/useKpiAutoValue';

const AREAS: { key: string; label: string; Icon: typeof Megaphone }[] = [
  { key: 'marketing',  label: 'Marketing',   Icon: Megaphone },
  { key: 'comercial',  label: 'Comercial',   Icon: ShoppingCart },
  { key: 'clientes',   label: 'Clientes',    Icon: UserCheck },
  { key: 'financeiro', label: 'Financeiro',  Icon: DollarSign },
  { key: 'operacao',   label: 'Operação',    Icon: Headphones },
  { key: 'produtos',   label: 'Produtos',    Icon: Package },
  { key: 'equipa',     label: 'Equipa',      Icon: UsersRound },
];

function AreaCard({ area }: { area: typeof AREAS[number] }) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const { list: kpis } = useDepartmentKpis(area.key);
  const kpiIds = useMemo(() => kpis.map((k) => k.id), [kpis]);
  const { list: rows } = useDepartmentKpiMonthly(year, kpiIds);
  const { resolve } = useKpiAutoValue(year, month);

  const { onTrack, total, top } = useMemo(() => {
    const monthRows = new Map(rows.filter((r) => r.month === month).map((r) => [r.kpi_id, r]));
    let on = 0;
    let counted = 0;
    const topItems: { name: string; actual: number | null; target: number | null }[] = [];
    kpis.forEach((k) => {
      const row = monthRows.get(k.id);
      const target = row?.target_value;
      const isManual = !k.value_source || k.value_source === 'manual';
      const actual = isManual ? row?.actual_value ?? null : resolve(k);
      if (target != null && actual != null && Number(target) > 0) {
        counted += 1;
        if (Number(actual) >= Number(target)) on += 1;
      }
      if (topItems.length < 2) topItems.push({ name: k.name, actual: actual != null ? Number(actual) : null, target: target != null ? Number(target) : null });
    });
    return { onTrack: on, total: counted, top: topItems };
  }, [kpis, rows, month, resolve]);

  // Semaphore: green if all on track, amber if some, red if mostly off, neutral if no measurements
  let dotCls = 'bg-muted-foreground/40';
  let pulseLabel = 'Sem medição';
  if (kpis.length === 0) {
    pulseLabel = 'Sem indicadores';
  } else if (total === 0) {
    pulseLabel = `${kpis.length} ${kpis.length === 1 ? 'indicador' : 'indicadores'} · sem dados`;
  } else {
    const ratio = onTrack / total;
    if (ratio === 1) { dotCls = 'bg-emerald-500'; pulseLabel = 'No caminho'; }
    else if (ratio >= 0.5) { dotCls = 'bg-amber-500'; pulseLabel = `${onTrack}/${total} no caminho`; }
    else { dotCls = 'bg-red-500'; pulseLabel = `${onTrack}/${total} no caminho`; }
  }

  return (
    <Link
      to={`/planeamento/dep/${area.key}`}
      className="group flex flex-col gap-2 rounded-lg border border-border/60 bg-card p-4 hover:border-primary/40 hover:shadow-sm hq-transition"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <area.Icon className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-sm font-semibold truncate">{area.label}</span>
        </div>
        <span className={`h-2 w-2 rounded-full ${dotCls} shrink-0`} aria-label={pulseLabel} />
      </div>
      <p className="text-[11px] text-muted-foreground">{pulseLabel}</p>
      {top.length > 0 && (
        <div className="space-y-1 pt-1 border-t border-border/40">
          {top.map((t, i) => (
            <div key={i} className="flex items-center justify-between gap-2 text-[11px]">
              <span className="truncate text-muted-foreground">{t.name}</span>
              <span className="tabular-nums shrink-0">
                {t.actual != null ? Number(t.actual).toLocaleString('pt-PT') : '—'}
                {t.target != null && <span className="text-muted-foreground">/{Number(t.target).toLocaleString('pt-PT')}</span>}
              </span>
            </div>
          ))}
        </div>
      )}
      <span className="mt-1 inline-flex items-center gap-1 text-[11px] text-primary font-medium">
        Abrir <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 hq-transition" />
      </span>
    </Link>
  );
}

/**
 * Owner-facing pulse: a card per business area, each linking to that
 * department's full planning & analysis page.
 */
export function AreaPulseGrid() {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <h2 className="text-base font-semibold">Pulse por área</h2>
        <span className="text-xs text-muted-foreground">Mês corrente · clica para abrir</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {AREAS.map((a) => <AreaCard key={a.key} area={a} />)}
      </div>
    </div>
  );
}