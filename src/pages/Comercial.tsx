import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useNavigate } from 'react-router-dom';
import { Target, ShoppingCart, Zap, Users, Lightbulb, BookOpen, UserCheck, Package, GitBranch, BarChart3 } from 'lucide-react';
import { CommercialOverview } from '@/components/commercial/CommercialOverview';
import { Separator } from '@/components/ui/separator';
import { useCommercialData } from '@/hooks/useCommercialData';
import { formatNumber } from '@/lib/formatting';
import { getPlanningSection } from '@/lib/department-planning';

const SECTIONS = [
  // Planeamento sempre primeiro (regra: ver mem://design/department-planning-card.md)
  (() => { const p = getPlanningSection('comercial'); return { path: p.path, label: p.label, icon: p.icon }; })(),
  { path: '/hub/comercial/metas', label: 'Metas Comerciais', icon: Target },
  { path: '/hub/comercial/vendas', label: 'Vendas', icon: ShoppingCart },
  { path: '/hub/comercial/acoes', label: 'Ações de Vendas', icon: Zap },
  { path: '/hub/comercial/crm', label: 'CRM', icon: Users },
  { path: '/hub/comercial/estrategia', label: 'Estratégia', icon: Lightbulb },
  { path: '/hub/comercial/biblioteca', label: 'Biblioteca', icon: BookOpen },
  { path: '/hub/comercial/processos', label: 'Processos', icon: GitBranch },
  { path: '/hub/comercial/analise', label: 'Análise Comercial', icon: BarChart3 },
  { path: '/hub/comercial/clientes', label: 'Lista de Clientes', icon: UserCheck },
  { path: '/hub/comercial/produtos', label: 'Produtos', icon: Package },
];
export default function ComercialPage() {
  const navigate = useNavigate();
  const data = useCommercialData();

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader title="Comercial" subtitle="Gestão comercial, vendas e metas do negócio." department="comercial" />

        {/* Annual goal progress bar */}
        <Card className="border-primary/20">
          <CardContent className="pt-5 pb-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold">Meta Anual {data.year}</span>
              </div>
              <span className="text-sm font-medium text-muted-foreground">
                {data.progressPct.toFixed(1)}%
              </span>
            </div>
            <Progress value={Math.min(data.progressPct, 100)} className="h-3" />
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Faturado: <span className="font-semibold text-foreground">€{formatNumber(data.totalInvoiced)}</span>
              </span>
              <span className="text-muted-foreground">
                Meta: <span className="font-semibold text-foreground">€{formatNumber(data.annualGoalAmount)}</span>
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Navigation cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {SECTIONS.map(s => (
            <Card
              key={s.path}
              className="group cursor-pointer border-2 border-primary bg-primary/10 hover:bg-primary/20 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
              onClick={() => navigate(s.path)}
            >
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shadow-sm shrink-0">
                  <s.icon className="h-4.5 w-4.5" />
                </div>
                <span className="font-medium text-sm text-foreground">{s.label}</span>
              </CardContent>
            </Card>
          ))}
        </div>

        <Separator />

        {/* Visão Geral inline */}
        <CommercialOverview />

        <Separator />
      </div>
    </AppLayout>
  );
}
