import { useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePlanningData } from '@/hooks/usePlanningData';
import { PlanningObjectivesTab } from '@/components/planning/PlanningObjectivesTab';
import { PlanningGoalsTab } from '@/components/planning/PlanningGoalsTab';
import { PlanningTrackingTab } from '@/components/planning/PlanningTrackingTab';

const currentYear = new Date().getFullYear();

export default function ExecutivePlaneamento() {
  const planning = usePlanningData(currentYear);
  const [tab, setTab] = useState('objetivos');

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Planeamento Anual</h1>
          <p className="text-sm text-muted-foreground">{currentYear}</p>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="objetivos">Objetivos</TabsTrigger>
            <TabsTrigger value="metas">Metas</TabsTrigger>
            <TabsTrigger value="acompanhamento">Acompanhamento</TabsTrigger>
          </TabsList>

          <TabsContent value="objetivos">
            <PlanningObjectivesTab planning={planning} />
          </TabsContent>
          <TabsContent value="metas">
            <PlanningGoalsTab planning={planning} />
          </TabsContent>
          <TabsContent value="acompanhamento">
            <PlanningTrackingTab planning={planning} />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
