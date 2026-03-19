import { useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { usePlanningData } from '@/hooks/usePlanningData';
import { PlanningObjectivesTab } from '@/components/planning/PlanningObjectivesTab';
import { PlanningGoalsTab, type GoalsViewMode } from '@/components/planning/PlanningGoalsTab';
import { PlanningTrackingTab } from '@/components/planning/PlanningTrackingTab';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar, BarChart3, PieChart, Target } from 'lucide-react';

const currentYear = new Date().getFullYear();

const VIEW_CARDS: { key: GoalsViewMode; label: string; icon: typeof Calendar; iconColor: string; color: string }[] = [
  { key: 'mensal', label: 'Mensal', icon: Calendar, iconColor: 'text-emerald-600', color: 'from-emerald-500/10 to-emerald-600/5 hover:from-emerald-500/20 hover:to-emerald-600/10' },
  { key: 'trimestral', label: 'Trimestral', icon: BarChart3, iconColor: 'text-violet-600', color: 'from-violet-500/10 to-violet-600/5 hover:from-violet-500/20 hover:to-violet-600/10' },
  { key: 'semestral', label: 'Semestral', icon: PieChart, iconColor: 'text-amber-600', color: 'from-amber-500/10 to-amber-600/5 hover:from-amber-500/20 hover:to-amber-600/10' },
  { key: 'metas', label: 'Metas', icon: Target, iconColor: 'text-rose-600', color: 'from-rose-500/10 to-rose-600/5 hover:from-rose-500/20 hover:to-rose-600/10' },
];

export default function ExecutivePlaneamento() {
  const planning = usePlanningData(currentYear);
  const [viewMode, setViewMode] = useState<GoalsViewMode>('mensal');

  return (
    <AppLayout>
      <div className="space-y-10">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Planeamento Anual</h1>
          <p className="text-sm text-muted-foreground mt-1">{currentYear}</p>
        </div>

        {/* View mode cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {VIEW_CARDS.map(v => (
            <Card
              key={v.key}
              className={`group cursor-pointer border bg-gradient-to-br ${v.color} transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${viewMode === v.key ? 'ring-2 ring-primary shadow-md' : ''}`}
              onClick={() => setViewMode(v.key)}
            >
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`h-9 w-9 rounded-lg bg-background/80 flex items-center justify-center shadow-sm shrink-0 ${v.iconColor}`}>
                  <v.icon className="h-4.5 w-4.5" />
                </div>
                <span className="font-medium text-sm text-foreground">{v.label}</span>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Objetivos */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Objetivos</h2>
          <PlanningObjectivesTab planning={planning} />
        </section>

        <Separator />

        {/* Metas */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Metas</h2>
          <PlanningGoalsTab planning={planning} viewMode={viewMode} />
        </section>

        <Separator />

        {/* Acompanhamento */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Acompanhamento</h2>
          <PlanningTrackingTab planning={planning} />
        </section>
      </div>
    </AppLayout>
  );
}
