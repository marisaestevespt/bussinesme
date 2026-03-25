import { AppLayout } from '@/components/AppLayout';
import { BackNavigation } from '@/components/BackNavigation';
import { PageHeader } from '@/components/PageHeader';
import { DepartmentProcessos } from '@/components/DepartmentProcessos';

export default function ExecutiveProcessos() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <BackNavigation />
        <PageHeader title="Processos da Administração" subtitle="SOPs, rotinas e links do departamento de Administração." />
        <DepartmentProcessos department="admin" />
      </div>
    </AppLayout>
  );
}
