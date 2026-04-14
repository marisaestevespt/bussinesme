import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { BackNavigation } from '@/components/BackNavigation';
import { DepartmentProcessos } from '@/components/DepartmentProcessos';

export default function MarketingProcessos() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader title="Processos de Marketing" subtitle="Marketing 360" />
        <div className="space-y-6">
          <BackNavigation parentRoute="/hub/marketing" parentLabel="Marketing" />
          <DepartmentProcessos department="marketing" />
        </div>
      </div>
    </AppLayout>
  );
}
