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
import { DepartmentKpiSummary } from '@/components/planning/DepartmentKpiSummary';

const SECTIONS = [
  // Planeamento sempre primeiro (regra: ver mem://design/department-planning-card.md)
  (() => { const p = getPlanningSection('comercial'); return { path: p.path, label: p.label, icon: p.icon, iconColor: 'text-primary', color: 'from-primary/10 to-primary/5 hover:from-primary/20 hover:to-primary/10' }; })(),
  { path: '/hub/comercial/metas', label: 'Metas Comerciais', icon: Target, iconColor: 'text-emerald-600', color: 'from-emerald-500/10 to-emerald-600/5 hover:from-emerald-500/20 hover:to-emerald-600/10' },
  { path: '/hub/comercial/vendas', label: 'Vendas', icon: ShoppingCart, iconColor: 'text-violet-600', color: 'from-violet-500/10 to-violet-600/5 hover:from-violet-500/20 hover:to-violet-600/10' },
  { path: '/hub/comercial/acoes', label: 'Ações de Vendas', icon: Zap, iconColor: 'text-amber-600', color: 'from-amber-500/10 to-amber-600/5 hover:from-amber-500/20 hover:to-amber-600/10' },
  { path: '/hub/comercial/crm', label: 'CRM', icon: Users, iconColor: 'text-rose-600', color: 'from-rose-500/10 to-rose-600/5 hover:from-rose-500/20 hover:to-rose-600/10' },
  { path: '/hub/comercial/estrategia', label: 'Estratégia', icon: Lightbulb, iconColor: 'text-cyan-600', color: 'from-cyan-500/10 to-cyan-600/5 hover:from-cyan-500/20 hover:to-cyan-600/10' },
  { path: '/hub/comercial/biblioteca', label: 'Biblioteca', icon: BookOpen, iconColor: 'text-orange-600', color: 'from-orange-500/10 to-orange-600/5 hover:from-orange-500/20 hover:to-orange-600/10' },
  { path: '/hub/comercial/processos', label: 'Processos', icon: GitBranch, iconColor: 'text-slate-600', color: 'from-slate-500/10 to-slate-600/5 hover:from-slate-500/20 hover:to-slate-600/10' },
  { path: '/hub/comercial/analise', label: 'Análise Comercial', icon: BarChart3, iconColor: 'text-blue-600', color: 'from-blue-500/10 to-blue-600/5 hover:from-blue-500/20 hover:to-blue-600/10' },
  { path: '/hub/comercial/clientes', label: 'Lista de Clientes', icon: UserCheck, iconColor: 'text-indigo-600', color: 'from-indigo-500/10 to-indigo-600/5 hover:from-indigo-500/20 hover:to-indigo-600/10' },
  { path: '/hub/comercial/produtos', label: 'Produtos', icon: Package, iconColor: 'text-teal-600', color: 'from-teal-500/10 to-teal-600/5 hover:from-teal-500/20 hover:to-teal-600/10' },
];
export default function ComercialPage() {
  const navigate = useNavigate();
  const data = useCommercialData();

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader title="Comercial" subtitle="Gestão comercial, vendas e metas do negócio." department="comercial" />
        <DepartmentKpiSummary department="comercial" />

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
              className={`group cursor-pointer border bg-gradient-to-br ${s.color} transition-all duration-200 hover:shadow-md hover:-translate-y-0.5`}
              onClick={() => navigate(s.path)}
            >
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`h-9 w-9 rounded-lg bg-background/80 flex items-center justify-center shadow-sm shrink-0 ${s.iconColor}`}>
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
