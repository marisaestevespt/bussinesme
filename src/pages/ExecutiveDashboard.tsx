import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { Skeleton } from '@/components/ui/skeleton';
import { useCeoCockpit } from '@/hooks/useCeoCockpit';
import { BusinessPulse } from '@/components/executive/cockpit/BusinessPulse';
import { CeoAlerts } from '@/components/executive/cockpit/CeoAlerts';
import { WeekFocus } from '@/components/executive/cockpit/WeekFocus';
import { DepartmentHealth } from '@/components/executive/cockpit/DepartmentHealth';
import { StrategyShortcuts } from '@/components/executive/cockpit/StrategyShortcuts';

/**
 * Sala do CEO — vista única e cruzada para o Owner/Admin.
 * 5 blocos: Pulso · Alertas · Foco da Semana · Saúde por Área · Estratégia.
 */
export default function ExecutiveDashboard() {
  const { derived, isLoading } = useCeoCockpit();

  return (
    <AppLayout>
      <div className="space-y-8">
        <PageHeader
          title="Sala do CEO"
          subtitle="Visão de gestão · pulso, alertas, foco e saúde por área"
          department="executive"
        />

        {isLoading || !derived ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
            <Skeleton className="h-48" />
            <Skeleton className="h-32" />
          </div>
        ) : (
          <>
            <BusinessPulse derived={derived} />
            <CeoAlerts derived={derived} />
            <WeekFocus derived={derived} />
            <DepartmentHealth derived={derived} />
            <StrategyShortcuts />
          </>
        )}
      </div>
    </AppLayout>
  );
}
