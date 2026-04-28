import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { BackNavigation } from '@/components/BackNavigation';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { usePlanningData } from '@/hooks/usePlanningData';
import { MonthlyGallery } from '@/components/planning/MonthlyGallery';
import { QuarterlyGallery } from '@/components/planning/QuarterlyGallery';
import { SemesterGallery } from '@/components/planning/SemesterGallery';
import { PlanningGoalsTab } from '@/components/planning/PlanningGoalsTab';
import { PlanningObjectivesTab } from '@/components/planning/PlanningObjectivesTab';
import { Button } from '@/components/ui/button';
import { Calendar, BarChart3, PieChart, Target, Plus } from 'lucide-react';

type Tab = 'mensal' | 'trimestral' | 'semestral' | 'metas';

export default function ExecutivePlaneamentoTatico() {
  const [params, setParams] = useSearchParams();
  const initialTab = (params.get('vista') as Tab) || 'mensal';
  const yearParam = parseInt(params.get('ano') || '', 10);
  const year = Number.isFinite(yearParam) && yearParam > 2000 ? yearParam : new Date().getFullYear();
  const [tab, setTab] = useState<Tab>(initialTab);
  const planning = usePlanningData(year);
  const [newObjectiveOpen, setNewObjectiveOpen] = useState(false);

  const handleTab = (v: string) => {
    setTab(v as Tab);
    const next = new URLSearchParams(params);
    next.set('vista', v);
    setParams(next, { replace: true });
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <BackNavigation />
        <PageHeader title="Planeamento Tático" subtitle="Aprofundar o plano" />

        {/* Destaque: Objetivos Anuais — big goals do ano em foco */}
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

        <Tabs value={tab} onValueChange={handleTab} className="space-y-6 pt-6 mt-4 border-t border-border/60">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 max-w-2xl">
            <TabsTrigger value="mensal" className="gap-2">
              <Calendar className="h-4 w-4" /> Mensal
            </TabsTrigger>
            <TabsTrigger value="trimestral" className="gap-2">
              <BarChart3 className="h-4 w-4" /> Trimestral
            </TabsTrigger>
            <TabsTrigger value="semestral" className="gap-2">
              <PieChart className="h-4 w-4" /> Semestral
            </TabsTrigger>
            <TabsTrigger value="metas" className="gap-2">
              <Target className="h-4 w-4" /> Metas
            </TabsTrigger>
          </TabsList>

          <TabsContent value="mensal"><MonthlyGallery planning={planning} year={year} /></TabsContent>
          <TabsContent value="trimestral"><QuarterlyGallery planning={planning} year={year} /></TabsContent>
          <TabsContent value="semestral"><SemesterGallery planning={planning} year={year} /></TabsContent>
          <TabsContent value="metas"><PlanningGoalsTab planning={planning} viewMode="metas" /></TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
