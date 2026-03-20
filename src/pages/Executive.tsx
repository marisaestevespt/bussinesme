import { EmptyModulePage } from '@/components/EmptyModulePage';
import { AppLayout } from '@/components/AppLayout';
import { useParams } from 'react-router-dom';
import { BackNavigation } from '@/components/BackNavigation';

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
      <div className="space-y-6">
        <BackNavigation />
        <EmptyModulePage
          title={label || 'Executive Room'}
          description="Área exclusiva do Owner para planeamento estratégico."
        />
      </div>
    </AppLayout>
  );
}
