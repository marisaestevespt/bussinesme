import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { CommercialMetas } from '@/components/commercial/CommercialMetas';
import { CommercialVendas } from '@/components/commercial/CommercialVendas';
import { CommercialProcessos } from '@/components/commercial/CommercialProcessos';
import { EmptyModulePage } from '@/components/EmptyModulePage';

const TITLES: Record<string, string> = {
  metas: 'Metas Comerciais',
  vendas: 'Vendas',
  acoes: 'Ações de Vendas',
  crm: 'CRM',
  estrategia: 'Estratégia',
  biblioteca: 'Biblioteca',
  processos: 'Processos',
};

export default function ComercialSubPage() {
  const { section } = useParams<{ section: string }>();
  const navigate = useNavigate();
  const title = TITLES[section || ''] || section || '';

  const renderContent = () => {
    switch (section) {
      case 'metas': return <CommercialMetas />;
      case 'vendas': return <CommercialVendas />;
      case 'processos': return <CommercialProcessos />;
      default: return <EmptyModulePage title={title} description="Conteúdo será construído em breve." />;
    }
  };

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/hub/comercial')}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Comercial
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        </div>
        {renderContent()}
      </div>
    </AppLayout>
  );
}
