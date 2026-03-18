import { EmptyModulePage } from '@/components/EmptyModulePage';
import { AppLayout } from '@/components/AppLayout';

export default function ComecaAquiPage() {
  return (
    <AppLayout>
      <EmptyModulePage title="Começa Aqui" description="Hall de entrada: apresentação, equipa, documentos e onboarding." />
    </AppLayout>
  );
}
