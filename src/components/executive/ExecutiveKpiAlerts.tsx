import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, TrendingUp, CreditCard, AlertTriangle, RefreshCw, UserPlus } from 'lucide-react';
import { useClients } from '@/hooks/useClients';
import { useCommercialData } from '@/hooks/useCommercialData';
import { Link } from 'react-router-dom';

const currentMonth = new Date().getMonth() + 1;
const currentYear = new Date().getFullYear();

export function ExecutiveKpiAlerts() {
  const { clients } = useClients();
  const commercial = useCommercialData(currentYear);

  const allClients = clients.data || [];
  const activeClients = allClients.filter((c: any) => c.status === 'ativo').length;
  const onboardingClients = allClients.filter((c: any) => c.status === 'em_onboarding').length;
  const renewalClients = allClients.filter((c: any) => c.status === 'altura_renovacao').length;

  const sales = commercial.sales.data || [];
  const monthSales = sales.filter((s: any) => s.sale_month === currentMonth);
  const monthRevenue = monthSales.reduce((sum: number, s: any) => sum + (s.invoice_total || 0), 0);
  const yearRevenue = sales.reduce((sum: number, s: any) => sum + (s.invoice_total || 0), 0);
  const overdueSales = sales.filter((s: any) => s.status === 'em_atraso').length;

  const annualGoal = commercial.annualGoal.data?.goal_amount || 0;
  const goalProgress = annualGoal > 0 ? Math.round((yearRevenue / annualGoal) * 100) : 0;

  const kpis = [
    { label: 'Clientes ativos', value: activeClients, icon: Users, color: 'text-primary' },
    { label: 'Faturação mês', value: `${monthRevenue.toLocaleString('pt-PT')}€`, icon: CreditCard, color: 'text-emerald-600' },
    { label: 'Faturação anual', value: `${yearRevenue.toLocaleString('pt-PT')}€`, sub: annualGoal > 0 ? `${goalProgress}% da meta` : undefined, icon: TrendingUp, color: 'text-blue-600' },
    { label: 'Vendas mês', value: monthSales.length, icon: TrendingUp, color: 'text-violet-600' },
  ];

  const alerts: { label: string; count: number; variant: 'destructive' | 'default' | 'secondary'; link: string; icon: React.ElementType }[] = [];

  if (overdueSales > 0) alerts.push({ label: 'Pagamentos em atraso', count: overdueSales, variant: 'destructive', link: '/comercial/vendas', icon: AlertTriangle });
  if (renewalClients > 0) alerts.push({ label: 'Clientes em renovação', count: renewalClients, variant: 'default', link: '/clientes', icon: RefreshCw });
  if (onboardingClients > 0) alerts.push({ label: 'Em onboarding', count: onboardingClients, variant: 'secondary', link: '/clientes', icon: UserPlus });

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

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {alerts.map(a => (
            <Link key={a.label} to={a.link}>
              <Badge variant={a.variant} className="gap-1.5 py-1 px-3 text-xs cursor-pointer hover:opacity-80 transition-opacity">
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
