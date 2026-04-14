import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { BackNavigation } from '@/components/BackNavigation';
import { DepartmentProcessos } from '@/components/DepartmentProcessos';

export default function MarketingProcessos() {
  return (
    <AppLayout>
      <div className="flex flex-col min-h-screen">
        <PageHeader title="Processos de Marketing" subtitle="Marketing 360" />
        <div className="w-full px-4 py-8 space-y-6">
          <BackNavigation parentRoute="/hub/marketing" parentLabel="Marketing" />
          <DepartmentProcessos department="marketing" />
        </div>
      </div>
    </AppLayout>
  );
}
