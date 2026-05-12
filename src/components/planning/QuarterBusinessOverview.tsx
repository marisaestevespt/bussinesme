import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, TrendingDown, Minus, Euro, Users, CheckSquare, Calendar, Smile, Clock, Target, Wallet, PieChart } from 'lucide-react';
import { useQuarterBusinessSummary } from '@/hooks/useQuarterBusinessSummary';
import { cn } from '@/lib/utils';

const fmtEur = (n: number) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0);
const fmtNum = (n: number) => new Intl.NumberFormat('pt-PT').format(Math.round(n || 0));

function GrowthBadge({ pct, invert = false }: { pct: number; invert?: boolean }) {
  if (pct === 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground">
        <Minus className="h-3 w-3" /> 0%
      </span>
    );
  }
  const positive = invert ? pct < 0 : pct > 0;
  const Icon = pct > 0 ? TrendingUp : TrendingDown;
  return (
    <span className={cn('inline-flex items-center gap-0.5 text-[11px] font-medium', positive ? 'text-emerald-600' : 'text-rose-600')}>
      <Icon className="h-3 w-3" />
      {pct > 0 ? '+' : ''}{pct}%
    </span>
  );
}

function KpiCard({ icon: Icon, label, value, sub, growth, invertGrowth }: any) {
  return (
    <div className="rounded-xl border bg-card p-4 space-y-1.5 hq-transition hover:shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-md bg-primary/10 text-primary flex items-center justify-center">
            <Icon className="h-3.5 w-3.5" />
          </div>
          <span className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">{label}</span>
        </div>
        {typeof growth === 'number' && <GrowthBadge pct={growth} invert={invertGrowth} />}
      </div>
      <div className="text-xl font-bold tabular-nums">{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

interface Props {
  year: number;
  quarterIdx: number;
  quarterLabel: string;
}

export function QuarterBusinessOverview({ year, quarterIdx, quarterLabel }: Props) {
  const { data, isLoading } = useQuarterBusinessSummary(year, quarterIdx);

  if (isLoading || !data) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Resultados do Trimestre — {quarterLabel}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
          </div>
        </CardContent>
      </Card>
    );
  }

  const marginPct = data.revenue > 0 ? Math.round((data.margin / data.revenue) * 100) : 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Resultados do Trimestre — {quarterLabel}</CardTitle>
        <p className="text-xs text-muted-foreground">Visão consolidada do negócio: vendas, crescimento, produtividade e clientes — comparado com o trimestre anterior.</p>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Negócio */}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Negócio</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard
              icon={Euro}
              label="Vendas"
              value={fmtEur(data.revenue)}
              sub={`Anterior: ${fmtEur(data.revenuePrev)}`}
              growth={data.revenueGrowth}
            />
            <KpiCard
              icon={Wallet}
              label="Despesas"
              value={fmtEur(data.expenses)}
              sub={`Anterior: ${fmtEur(data.expensesPrev)}`}
              growth={data.expensesGrowth}
              invertGrowth
            />
            <KpiCard
              icon={PieChart}
              label="Margem"
              value={fmtEur(data.margin)}
              sub={`${marginPct}% das vendas`}
              growth={data.marginGrowth}
            />
            <KpiCard
              icon={Target}
              label="Conversão Leads"
              value={`${data.conversion}%`}
              sub={`${data.leadsWon} ganhos / ${data.leadsTotal} leads`}
            />
          </div>
        </div>

        {/* Crescimento */}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Crescimento</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard
              icon={Users}
              label="Novos Clientes"
              value={fmtNum(data.newClients)}
              sub={`Anterior: ${data.newClientsPrev}`}
              growth={data.newClientsGrowth}
            />
            <KpiCard
              icon={Target}
              label="Leads"
              value={fmtNum(data.leadsTotal)}
              sub={`Anterior: ${data.leadsTotalPrev}`}
              growth={data.leadsGrowth}
            />
            <KpiCard
              icon={Users}
              label="Carteira Ativa"
              value={fmtNum(data.clientsActive)}
              sub="clientes ativos"
            />
            <KpiCard
              icon={Smile}
              label="NPS Médio"
              value={data.npsAvg !== null ? data.npsAvg : '—'}
              sub={data.npsCount ? `${data.npsCount} respostas` : 'sem respostas'}
            />
          </div>
        </div>

        {/* Produtividade */}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Produtividade</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard
              icon={CheckSquare}
              label="Tarefas Concluídas"
              value={fmtNum(data.tasksDone)}
              sub={`Anterior: ${data.tasksDonePrev}`}
              growth={data.tasksGrowth}
            />
            <KpiCard
              icon={Clock}
              label="Horas Registadas"
              value={`${fmtNum(data.hours)}h`}
              sub={`Anterior: ${fmtNum(data.hoursPrev)}h`}
              growth={data.hoursGrowth}
            />
            <KpiCard
              icon={Calendar}
              label="Reuniões"
              value={fmtNum(data.meetings)}
              sub="terminadas/confirmadas"
            />
            <KpiCard
              icon={CheckSquare}
              label="Top Departamento"
              value={(() => {
                const entries = Object.entries(data.tasksByDept).sort((a, b) => b[1] - a[1]);
                return entries.length ? `${entries[0][0]}` : '—';
              })()}
              sub={(() => {
                const entries = Object.entries(data.tasksByDept).sort((a, b) => b[1] - a[1]);
                return entries.length ? `${entries[0][1]} tarefas` : 'sem dados';
              })()}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}