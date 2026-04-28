import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { BackNavigation } from '@/components/BackNavigation';
import { usePlanningData } from '@/hooks/usePlanningData';
import { TacticalByAreaView } from '@/components/planning/TacticalByAreaView';
import { PlanningGoalsTab } from '@/components/planning/PlanningGoalsTab';
import { PlanningObjectivesTab } from '@/components/planning/PlanningObjectivesTab';
import { MonthlyGallery } from '@/components/planning/MonthlyGallery';
import { Button } from '@/components/ui/button';
import { Target, Plus, ChevronDown, ChevronUp, Building2, CalendarDays } from 'lucide-react';

export default function ExecutivePlaneamentoTatico() {
  const [params] = useSearchParams();
  const yearParam = parseInt(params.get('ano') || '', 10);
  const year = Number.isFinite(yearParam) && yearParam > 2000 ? yearParam : new Date().getFullYear();
  const planning = usePlanningData(year);
  const [newObjectiveOpen, setNewObjectiveOpen] = useState(false);
  const [showAllGoals, setShowAllGoals] = useState(false);

  return (
    <AppLayout>
      <div className="space-y-8">
        <BackNavigation />
        <PageHeader title="Planeamento Tático" subtitle="Aprofundar o plano por área" />

        {/* Objetivos Anuais — big goals do ano em foco */}
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <Target className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-base font-semibold">Objetivos Anuais</h2>
                <p className="text-xs text-muted-foreground">Os big goals que definem o ano</p>
              </div>
            </div>
            <Button size="sm" onClick={() => setNewObjectiveOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Novo Objetivo
            </Button>
          </div>
          <PlanningObjectivesTab
            planning={planning}
            showHeaderButton={false}
            layout="gallery"
            newDialogOpen={newObjectiveOpen}
            onNewDialogChange={setNewObjectiveOpen}
          />
        </section>

        {/* Áreas / Departamentos — entrada principal do tático */}
        <section className="space-y-3 pt-6 border-t border-border/60">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Building2 className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold">Áreas do negócio</h2>
              <p className="text-xs text-muted-foreground">Cada departamento e o que entrega no ano. Click num bloco para ver o detalhe.</p>
            </div>
          </div>
          <TacticalByAreaView planning={planning} year={year} />
        </section>

        {/* Planeamento Mensal — galeria dos 12 meses */}
        <section className="space-y-3 pt-6 border-t border-border/60">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <CalendarDays className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold">Planeamento Mensal</h2>
              <p className="text-xs text-muted-foreground">Vista mês-a-mês do ano. Clica num mês para ver metas, capacidade da equipa e relatório.</p>
            </div>
          </div>
          <MonthlyGallery planning={planning} year={year} />
        </section>

        {/* Metas — secção colapsável no fim */}
        <section className="space-y-3 pt-6 border-t border-border/60">
          <button
            type="button"
            onClick={() => setShowAllGoals((v) => !v)}
            className="flex items-center gap-2 w-full text-left hq-transition hover:opacity-80"
          >
            <div className="h-7 w-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Target className="h-4 w-4" />
            </div>
            <div className="flex-1">
              <h2 className="text-base font-semibold">Todas as Metas</h2>
              <p className="text-xs text-muted-foreground">Vista plana de todas as metas do ano</p>
            </div>
            {showAllGoals ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </button>
          {showAllGoals && <PlanningGoalsTab planning={planning} viewMode="metas" />}
        </section>
      </div>
    </AppLayout>
  );
}
