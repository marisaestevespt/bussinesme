import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, ChevronRight, Briefcase, Megaphone, FolderKanban, Wallet, UserCheck, Heart } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { useCeoCockpit } from '@/hooks/useCeoCockpit';
import { useSectorConfig } from '@/hooks/useSectorConfig';

type Derived = NonNullable<ReturnType<typeof useCeoCockpit>['derived']>;

function formatEuros(n: number): string {
  return `${Math.round(n).toLocaleString('pt-PT')}€`;
}

interface AreaCardProps {
  title: string;
  icon: React.ElementType;
  link: string;
  status: 'good' | 'warn' | 'bad' | 'neutral';
  metrics: { label: string; value: string; trend?: number }[];
}

function AreaCard({ title, icon: Icon, link, status, metrics }: AreaCardProps) {
  const statusDot: Record<string, string> = {
    good: 'bg-success', warn: 'bg-warning', bad: 'bg-destructive', neutral: 'bg-muted-foreground/40',
  };
  return (
    <Link to={link} className="block group">
      <Card className="h-full transition-all group-hover:shadow-md group-hover:-translate-y-0.5">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Icon className="h-4 w-4 text-muted-foreground" />
              {title}
              <span className={cn('h-1.5 w-1.5 rounded-full', statusDot[status])} aria-hidden />
            </CardTitle>
            <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-3 gap-2">
            {metrics.map((m, i) => (
              <div key={i} className="space-y-0.5">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{m.label}</p>
                <div className="flex items-baseline gap-1">
                  <p className="text-sm font-semibold">{m.value}</p>
                  {m.trend !== undefined && m.trend !== 0 && (
                    <span className={cn(
                      'inline-flex items-center text-[9px] font-medium',
                      m.trend > 0 ? 'text-success' : 'text-destructive',
                    )}>
                      {m.trend > 0 ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                      {Math.abs(m.trend)}%
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export function DepartmentHealth({ derived }: { derived: Derived }) {
  const sectorConfig = useSectorConfig();
  const h = derived.deptHealth;

  const comStatus: 'good' | 'warn' | 'bad' =
    h.comercial.staleLeads > 5 ? 'bad' :
    h.comercial.revenueDelta < -10 ? 'warn' : 'good';

  const opStatus: 'good' | 'warn' | 'bad' =
    h.operacao.overdueProjects > 0 ? 'bad' :
    h.operacao.overdueTasks > 5 ? 'warn' : 'good';

  const finStatus: 'good' | 'warn' | 'bad' =
    h.financeiro.net < 0 || h.financeiro.overdueSales > 2 ? 'bad' :
    h.financeiro.expenseDeltaPct >= 25 ? 'warn' : 'good';

  const cliStatus: 'good' | 'warn' | 'bad' =
    h.clientes.nearEnd > 2 ? 'warn' :
    (h.clientes.avgNps != null && h.clientes.avgNps < 7) ? 'warn' : 'good';

  const teamStatus: 'good' | 'warn' | 'bad' =
    h.equipa.usedPct >= 95 ? 'bad' :
    h.equipa.usedPct >= 80 ? 'warn' : 'good';

  const mkt = h.marketing;
  const mktStatus: 'good' | 'warn' | 'bad' =
    mkt.publishedMonth === 0 && mkt.scheduledMonth === 0 ? 'bad' :
    mkt.scheduledMonth < 2 ? 'warn' : 'good';

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Saúde por área</h2>
        <Link to="/executive/analise-empresarial" className="text-[10px] text-muted-foreground hover:text-foreground hover:underline transition-colors">
          Clica para ver análise completa
        </Link>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        <AreaCard
          title="Comercial" icon={Briefcase} link="/hub/comercial/analise" status={comStatus}
          metrics={[
            { label: 'Faturação', value: formatEuros(h.comercial.monthRevenue), trend: h.comercial.revenueDelta },
            { label: 'Leads', value: String(h.comercial.openLeads) },
            { label: 'Paradas', value: String(h.comercial.staleLeads) },
          ]}
        />
        <AreaCard
          title="Marketing" icon={Megaphone} link="/hub/marketing" status={mktStatus}
          metrics={[
            { label: 'Publicados', value: String(mkt.publishedMonth) },
            { label: 'Agendados', value: String(mkt.scheduledMonth) },
            { label: 'Ideias', value: String(mkt.ideas) },
          ]}
        />
        <AreaCard
          title="Operação" icon={FolderKanban} link="/hub/operacao" status={opStatus}
          metrics={[
            { label: 'Projetos', value: String(h.operacao.activeProjects) },
            { label: 'Atrasados', value: String(h.operacao.overdueProjects) },
            { label: 'Tarefas', value: String(h.operacao.openTasks) },
          ]}
        />
        <AreaCard
          title="Financeiro" icon={Wallet} link="/hub/financeiro" status={finStatus}
          metrics={[
            { label: 'Resultado', value: formatEuros(h.financeiro.net) },
            { label: 'Despesas', value: formatEuros(h.financeiro.monthExpenses), trend: -h.financeiro.expenseDeltaPct },
            { label: 'Atraso', value: String(h.financeiro.overdueSales) },
          ]}
        />
        <AreaCard
          title={sectorConfig.t('clientes')} icon={Heart} link="/hub/clientes/analise" status={cliStatus}
          metrics={[
            { label: 'Ativos', value: String(h.clientes.active) },
            { label: 'NPS', value: h.clientes.avgNps != null ? `${h.clientes.avgNps}` : '—' },
            { label: 'Fim ciclo', value: String(h.clientes.nearEnd) },
          ]}
        />
        <AreaCard
          title="Equipa" icon={UserCheck} link="/executive/productivity" status={teamStatus}
          metrics={[
            { label: 'Ativos', value: String(h.equipa.total) },
            { label: 'Ocupação', value: `${h.equipa.usedPct}%` },
            { label: 'Sobre 85%', value: String(h.equipa.overloaded) },
          ]}
        />
      </div>
    </section>
  );
}