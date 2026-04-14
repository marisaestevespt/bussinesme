import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { BackNavigation } from '@/components/BackNavigation';
import { useParams } from 'react-router-dom';
import { CommercialMetas } from '@/components/commercial/CommercialMetas';
import { CommercialVendas } from '@/components/commercial/CommercialVendas';
import { CommercialProcessos } from '@/components/commercial/CommercialProcessos';
import { CommercialAcoes } from '@/components/commercial/CommercialAcoes';
import { CommercialCRM } from '@/components/commercial/CommercialCRM';
import { CommercialEstrategia } from '@/components/commercial/CommercialEstrategia';
import { CommercialBiblioteca } from '@/components/commercial/CommercialBiblioteca';
import { CommercialClientsList } from '@/components/commercial/CommercialClientsList';
import { CommercialProductsList } from '@/components/commercial/CommercialProductsList';
import { EmptyModulePage } from '@/components/EmptyModulePage';

const TITLES: Record<string, string> = {
  metas: 'Metas Comerciais',
  vendas: 'Vendas',
  acoes: 'Ações de Vendas',
  crm: 'CRM',
  estrategia: 'Estratégia',
  biblioteca: 'Biblioteca',
  processos: 'Processos',
  clientes: 'Lista de Clientes',
  produtos: 'Produtos',
};

export default function ComercialSubPage() {
  const { section } = useParams<{ section: string }>();
  
  const title = TITLES[section || ''] || section || '';

  const renderContent = () => {
    switch (section) {
      case 'metas': return <CommercialMetas />;
      case 'vendas': return <CommercialVendas />;
      case 'acoes': return <CommercialAcoes />;
      case 'crm': return <CommercialCRM />;
      case 'processos': return <CommercialProcessos />;
      case 'estrategia': return <CommercialEstrategia />;
      case 'biblioteca': return <CommercialBiblioteca />;
      case 'clientes': return <CommercialClientsList />;
      case 'produtos': return <CommercialProductsList />;
      default: return <EmptyModulePage title={title} description="Conteúdo será construído em breve." />;
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <BackNavigation />
        <PageHeader title={title} />
        {renderContent()}
      </div>
    </AppLayout>
  );
}
