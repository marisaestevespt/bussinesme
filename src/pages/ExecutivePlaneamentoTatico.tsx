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
import { Badge } from '@/components/ui/badge';
import { Calendar, BarChart3, PieChart, Target } from 'lucide-react';

type Tab = 'mensal' | 'trimestral' | 'semestral' | 'metas';

export default function ExecutivePlaneamentoTatico() {
  const [params, setParams] = useSearchParams();
  const initialTab = (params.get('vista') as Tab) || 'mensal';
  const yearParam = parseInt(params.get('ano') || '', 10);
  const year = Number.isFinite(yearParam) && yearParam > 2000 ? yearParam : new Date().getFullYear();
  const [tab, setTab] = useState<Tab>(initialTab);
  const planning = usePlanningData(year);

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
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <PageHeader title="Planeamento Tático" subtitle="Aprofundar o plano" />
          <Badge variant="outline" className="text-sm font-medium px-3 py-1">{year}</Badge>
        </div>

        <Tabs value={tab} onValueChange={handleTab} className="space-y-6">
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
