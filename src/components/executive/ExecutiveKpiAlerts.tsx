import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Users, TrendingUp, CreditCard, AlertTriangle, RefreshCw, UserPlus } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { sumRevenue } from '@/lib/salesCalculations';
import { teamMonthlyCapacitySummary } from '@/lib/memberCapacity';

const now = new Date();
const currentMonth = now.getMonth() + 1;
const currentYear = now.getFullYear();
const monthStart = format(startOfMonth(now), 'yyyy-MM-dd');
const monthEnd = format(endOfMonth(now), 'yyyy-MM-dd');

export function ExecutiveKpiAlerts() {
  // Single batched query instead of 3 heavy hooks (useClients + useCommercialData + useTeamData)
  const kpiData = useQuery({
    queryKey: ['exec-kpi-batch', currentMonth, currentYear],
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      const [clientsRes, salesRes, annualGoalRes, membersRes, timeRes] = await Promise.all([
        supabase.from('clients').select('id,status').order('created_at', { ascending: false }),
        supabase.from('commercial_sales')
          .select('id,invoice_total,sale_month,status')
          .eq('sale_year', currentYear),
        supabase.from('commercial_annual_goals').select('goal_amount').eq('year', currentYear).maybeSingle(),
        supabase.from('team_members').select('id,status,expected_weekly_hours'),
        supabase.from('time_entries').select('member_id,duration').gte('entry_date', monthStart).lte('entry_date', monthEnd),
      ]);
      return {
        clients: clientsRes.data || [],
        sales: salesRes.data || [],
        annualGoal: annualGoalRes.data?.goal_amount || 0,
        members: membersRes.data || [],
        timeEntries: timeRes.data || [],
      };
    },
  });

  const d = kpiData.data;

  const capacityAlert = useMemo(() => {
    if (!d) return null;
    const summary = teamMonthlyCapacitySummary(d.members, d.timeEntries);
    if (!summary) return null;
    return {
      pct: summary.pct,
      totalUsed: summary.totalUsed,
      totalCap: summary.totalCapacity,
      overloaded: summary.overloadedCount,
      total: summary.total,
    };
  }, [d]);

  const allClients = d?.clients || [];
  const activeClients = allClients.filter(c => c.status === 'ativo').length;
  const onboardingClients = allClients.filter(c => c.status === 'em_onboarding').length;
  const renewalClients = allClients.filter(c => c.status === 'altura_renovacao').length;

  const sales = d?.sales || [];
  const monthSales = sales.filter(s => s.sale_month === currentMonth);
  const monthRevenue = sumRevenue(monthSales);
  const yearRevenue = sumRevenue(sales);
  const overdueSales = sales.filter(s => s.status === 'em_atraso').length;

  const annualGoal = d?.annualGoal || 0;
  const goalProgress = annualGoal > 0 ? Math.round((yearRevenue / annualGoal) * 100) : 0;

  const kpis = [
    { label: 'Clientes ativos', value: activeClients, icon: Users, color: 'text-primary' },
    { label: 'Faturação mês', value: `${monthRevenue.toLocaleString('pt-PT')}€`, icon: CreditCard, color: 'text-success' },
    { label: 'Faturação anual', value: `${yearRevenue.toLocaleString('pt-PT')}€`, sub: annualGoal > 0 ? `${goalProgress}% da meta` : undefined, icon: TrendingUp, color: 'text-info' },
    { label: 'Vendas mês', value: monthSales.length, icon: TrendingUp, color: 'text-accent-violet' },
  ];

  const alerts: { label: string; count: number; variant: 'destructive' | 'default' | 'secondary'; link: string; icon: React.ElementType }[] = [];

  if (overdueSales > 0) alerts.push({ label: 'Pagamentos em atraso', count: overdueSales, variant: 'destructive', link: '/hub/comercial/vendas', icon: AlertTriangle });
  if (renewalClients > 0) alerts.push({ label: 'Clientes em renovação', count: renewalClients, variant: 'default', link: '/hub/clientes', icon: RefreshCw });
  if (onboardingClients > 0) alerts.push({ label: 'Em onboarding', count: onboardingClients, variant: 'secondary', link: '/hub/clientes', icon: UserPlus });

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map(k => (
          <Card key={k.label}>
            <CardContent className="p-4 flex items-start gap-3">
              <div className={`rounded-lg bg-muted p-2 ${k.color}`}>
                <k.icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{k.label}</p>
                <p className="text-lg font-bold tracking-tight">{k.value}</p>
                {k.sub && <p className="text-[10px] text-muted-foreground">{k.sub}</p>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Capacity Alert */}
      {capacityAlert && capacityAlert.pct >= 75 && (
        <Card className={cn(
          "border-l-4",
          capacityAlert.pct >= 95 ? "border-l-destructive bg-destructive/5" : "border-l-amber-500 bg-warning/15/50"
        )}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className={cn(
                  "rounded-lg p-2 mt-0.5",
                  capacityAlert.pct >= 95 ? "bg-destructive/10 text-destructive" : "bg-warning/15 text-warning"
                )}>
                  <UserPlus className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold">
                    {capacityAlert.pct >= 95
                      ? '⚠️ Capacidade esgotada — considerar contratação'
                      : '📊 Capacidade a ficar limitada'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Equipa a {capacityAlert.pct}% ({capacityAlert.totalUsed}h/{capacityAlert.totalCap}h).
                    {capacityAlert.overloaded > 0 && ` ${capacityAlert.overloaded} de ${capacityAlert.total} membros acima de 85%.`}
                  </p>
                  <Progress value={Math.min(capacityAlert.pct, 100)} className="h-2 w-48 mt-1" />
                </div>
              </div>
              <Link to="/executive/productivity?tab=simulation">
                <Button variant="outline" size="sm" className="shrink-0 text-xs">
                  <UserPlus className="h-3.5 w-3.5 mr-1.5" />
                  Simular contratação
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {alerts.map(a => (
            <Link key={a.label} to={a.link}>
              <Badge variant={a.variant} className="gap-2 py-1 px-3 text-xs cursor-pointer hover:opacity-80 transition-opacity">
                <a.icon className="h-3 w-3" />
                {a.count} {a.label}
              </Badge>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
