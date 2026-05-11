import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, TrendingDown, Users, Wallet, Activity, Target, Info, ChevronRight } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { useCeoCockpit } from '@/hooks/useCeoCockpit';

type Derived = NonNullable<ReturnType<typeof useCeoCockpit>['derived']>;

function formatEuros(n: number): string {
  return `${Math.round(n).toLocaleString('pt-PT')}€`;
}

function DeltaBadge({ pct }: { pct: number }) {
  if (pct === 0) return null;
  const positive = pct > 0;
  const Icon = positive ? TrendingUp : TrendingDown;
  return (
    <span className={cn(
      'inline-flex items-center gap-0.5 text-[10px] font-medium',
      positive ? 'text-success' : 'text-destructive',
    )}>
      <Icon className="h-3 w-3" />
      {positive ? '+' : ''}{pct}%
    </span>
  );
}

interface KpiTileProps {
  label: string;
  value: string;
  icon: React.ElementType;
  status?: 'good' | 'warn' | 'bad' | 'neutral';
  delta?: number;
  sub?: string;
  link: string;
  hint?: string;
}

function KpiTile({ label, value, icon: Icon, status = 'neutral', delta, sub, link, hint }: KpiTileProps) {
  const statusBar: Record<string, string> = {
    good: 'bg-success',
    warn: 'bg-warning',
    bad: 'bg-destructive',
    neutral: 'bg-muted-foreground/30',
  };
  const iconBg: Record<string, string> = {
    good: 'bg-success/10 text-success',
    warn: 'bg-warning/15 text-warning',
    bad: 'bg-destructive/10 text-destructive',
    neutral: 'bg-muted text-muted-foreground',
  };

  return (
    <Link to={link} className="block group cursor-pointer">
      <Card className="relative overflow-hidden transition-all group-hover:shadow-md group-hover:-translate-y-0.5 group-hover:border-primary/40">
        <div className={cn('absolute left-0 top-0 bottom-0 w-1', statusBar[status])} />
        <ChevronRight className="absolute top-2 right-2 h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
        <CardContent className="p-4 pl-5">
          <div className="flex items-start gap-3">
            <div className={cn('rounded-lg p-2 shrink-0', iconBg[status])}>
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{label}</p>
                {hint && (
                  <Tooltip>
                    <TooltipTrigger
                      asChild
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    >
                      <Info className="h-3 w-3 text-muted-foreground/60 hover:text-foreground transition-colors cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[240px] text-xs">
                      {hint}
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
              <div className="flex items-baseline gap-2 flex-wrap">
                <p className="text-xl font-bold tracking-tight">{value}</p>
                {delta !== undefined && <DeltaBadge pct={delta} />}
              </div>
              {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export function BusinessPulse({ derived }: { derived: Derived }) {
  const revenueDelta = derived.prevMonthRevenue > 0
    ? Math.round(((derived.monthRevenue - derived.prevMonthRevenue) / derived.prevMonthRevenue) * 100)
    : 0;

  // Runway: only meaningful if burn > revenue (ie negative net). Otherwise mark as healthy.
  const burnNet = derived.burn90 - derived.monthRevenue;
  const runwayMonths = burnNet > 0 ? null : Infinity;
  const runwayLabel = runwayMonths === Infinity ? 'Saudável' : '—';
  const runwayStatus: 'good' | 'warn' | 'bad' = runwayMonths === Infinity ? 'good' : 'warn';

  const capacityPct = derived.capacity?.pct ?? 0;
  const capacityStatus: 'good' | 'warn' | 'bad' =
    capacityPct >= 95 ? 'bad' : capacityPct >= 80 ? 'warn' : 'good';

  const goalStatus: 'good' | 'warn' | 'bad' =
    derived.goalProgress >= 90 ? 'good' : derived.goalProgress >= 60 ? 'warn' : 'bad';

  const netStatus: 'good' | 'warn' | 'bad' =
    derived.monthlyNet > 0 ? 'good' : derived.monthlyNet > -1000 ? 'warn' : 'bad';

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Pulso do negócio</h2>
        <span className="text-[10px] text-muted-foreground">Clica em qualquer card para abrir o detalhe</span>
      </div>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <KpiTile
          label="MRR"
          value={formatEuros(derived.mrr)}
          icon={Activity}
          status="good"
          sub={`${derived.activeClientsCount} clientes ativos`}
          link="/hub/financeiro"
          hint="MRR (Monthly Recurring Revenue) é a receita recorrente que entra todos os meses dos clientes ativos."
        />
        <KpiTile
          label="Resultado mês"
          value={formatEuros(derived.monthlyNet)}
          icon={Wallet}
          status={netStatus}
          sub={`Receita ${formatEuros(derived.monthRevenue)}${revenueDelta !== 0 ? ` (${revenueDelta > 0 ? '+' : ''}${revenueDelta}%)` : ''}`}
          link="/hub/financeiro"
          hint="Receita do mês menos despesas do mês. A percentagem entre parênteses compara a receita com o mês anterior."
        />
        <KpiTile
          label="Fôlego financeiro"
          value={runwayLabel}
          icon={TrendingUp}
          status={runwayStatus}
          sub={`Burn 90d: ${formatEuros(derived.burn90)}/mês`}
          link="/executive/planeamento/estrategico"
          hint="Também conhecido como 'runway'. Indica quantos meses o negócio aguenta com as despesas atuais. 'Saudável' significa que a receita cobre as despesas e o negócio é sustentável. Burn = média de despesas dos últimos 90 dias."
        />
        <KpiTile
          label="Capacidade"
          value={`${capacityPct}%`}
          icon={Users}
          status={capacityStatus}
          sub={derived.capacity ? `${derived.capacity.totalUsed}h / ${derived.capacity.totalCapacity}h` : undefined}
          link="/executive/productivity"
          hint="Percentagem de horas da equipa que já estão alocadas este mês. Acima de 80% = atenção, acima de 95% = sobrecarga."
        />
      </div>

      {derived.annualGoal > 0 && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2 text-primary">
                <Target className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-sm font-medium">Meta anual de faturação</p>
                  <p className={cn(
                    'text-sm font-semibold',
                    goalStatus === 'good' ? 'text-success' : goalStatus === 'warn' ? 'text-warning' : 'text-destructive',
                  )}>
                    {derived.goalProgress}%
                  </p>
                </div>
                <Progress value={Math.min(derived.goalProgress, 100)} className="h-1.5" />
                <p className="text-[11px] text-muted-foreground">
                  {formatEuros(derived.yearRevenue)} de {formatEuros(derived.annualGoal)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </section>
  );
}