import { useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { usePlanningData } from '@/hooks/usePlanningData';
import { PlanningObjectivesTab } from '@/components/planning/PlanningObjectivesTab';
import { PlanningGoalsTab, type GoalsViewMode } from '@/components/planning/PlanningGoalsTab';
import { PlanningTrackingTab } from '@/components/planning/PlanningTrackingTab';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';

const currentYear = new Date().getFullYear();

const VIEW_BUTTONS = [
  { key: 'mensal', label: 'Mensal' },
  { key: 'trimestral', label: 'Trimestral' },
  { key: 'semestral', label: 'Semestral' },
  { key: 'metas', label: 'Metas' },
] as const;

export type PlanningViewMode = typeof VIEW_BUTTONS[number]['key'];

export default function ExecutivePlaneamento() {
  const planning = usePlanningData(currentYear);
  const [viewMode, setViewMode] = useState<PlanningViewMode>('mensal');

  return (
    <AppLayout>
      <div className="space-y-10">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold">Planeamento Anual</h1>
            <p className="text-sm text-muted-foreground">{currentYear}</p>
          </div>
          <div className="flex gap-2">
            {VIEW_BUTTONS.map(v => (
              <Button
                key={v.key}
                size="sm"
                variant={viewMode === v.key ? 'default' : 'outline'}
                onClick={() => setViewMode(v.key)}
              >
                {v.label}
              </Button>
            ))}
          </div>
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
