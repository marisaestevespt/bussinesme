import { EmptyModulePage } from '@/components/EmptyModulePage';
import { AppLayout } from '@/components/AppLayout';
import { useParams } from 'react-router-dom';

const EXECUTIVE_LABELS: Record<string, string> = {
  planeamento: 'Planeamento',
  'weekly-align': 'Weekly Align',
  'gestao-equipa': 'Gestão de Equipa (CEO)',
};

export default function ExecutivePage() {
  const { section } = useParams<{ section: string }>();
  const label = section ? EXECUTIVE_LABELS[section] : 'Executive Room';

  return (
    <AppLayout>
      <EmptyModulePage
        title={label || 'Executive Room'}
        description="Área exclusiva do Owner para planeamento estratégico."
      />
    </AppLayout>
  );
}
