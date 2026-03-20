import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { BackNavigation } from '@/components/BackNavigation';
import { useNavigate, useParams } from 'react-router-dom';
import { useTeamData } from '@/hooks/useTeamData';
import { EmptyModulePage } from '@/components/EmptyModulePage';
import { TabEscala } from '@/components/hr/TabEscala';

import {
  TabEquipa,
  TabPerformance,
  TabFeedback,
  TabContracts,
} from '@/pages/ExecutiveGestaoEquipa';

const TITLES: Record<string, string> = {
  equipa: 'Equipa',
  escala: 'Escala',
  performance: 'Performance',
  feedback: 'Feedback',
  'contratos-pagamentos': 'Contratos & Pagamentos',
};

export default function RecursosHumanosSubPage() {
  const { section } = useParams<{ section: string }>();
  const navigate = useNavigate();
  const team = useTeamData();
  const title = TITLES[section || ''] || section || '';

  const renderContent = () => {
    switch (section) {
      case 'equipa': return <TabEquipa team={team} />;
      case 'escala': return <TabEscala />;
      case 'performance': return <TabPerformance team={team} />;
      case 'feedback': return <TabFeedback team={team} />;
      case 'contratos-pagamentos': return <TabContracts team={team} />;
      default: return <EmptyModulePage title={title} description="Conteúdo será construído em breve." />;
    }
  };

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/hub/recursos-humanos')}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Recursos Humanos
          </Button>
        </div>
        <PageHeader title={title} />
        {renderContent()}
      </div>
    </AppLayout>
  );
}
