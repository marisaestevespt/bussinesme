import { EmptyModulePage } from '@/components/EmptyModulePage';
import { AppLayout } from '@/components/AppLayout';

export default function SecretariaPage() {
  return (
    <AppLayout>
      <EmptyModulePage title="Secretária" description="A tua secretária pessoal com tarefas, reuniões e atalhos." />
    </AppLayout>
  );
}
