import { EmptyModulePage } from '@/components/EmptyModulePage';
import { AppLayout } from '@/components/AppLayout';

export default function DefinicoesPage() {
  return (
    <AppLayout>
      <EmptyModulePage title="Definições" description="Gestão de configurações do negócio, roles e membros." />
    </AppLayout>
  );
}
