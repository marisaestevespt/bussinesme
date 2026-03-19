import { AppLayout } from '@/components/AppLayout';
import { excludeCancelled } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useFinancialData } from '@/hooks/useFinancialData';
import { useCommercialData } from '@/hooks/useCommercialData';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { FinEntradas } from '@/components/financial/FinEntradas';
import { FinSaidas } from '@/components/financial/FinSaidas';
import { FinIVA } from '@/components/financial/FinIVA';
import { FinPayroll } from '@/components/financial/FinPayroll';
import { FinMensal } from '@/components/financial/FinMensal';
import { FinTrimestral } from '@/components/financial/FinTrimestral';
import { FinSegurancaSocial } from '@/components/financial/FinSegurancaSocial';
import { FinAllDocuments } from '@/components/financial/FinAllDocuments';
import { EmptyModulePage } from '@/components/EmptyModulePage';

const TITLES: Record<string, string> = {
  mensal: 'Mensal',
  trimestral: 'Trimestral',
  entradas: 'Entradas',
  saidas: 'Saídas',
  iva: 'IVA',
  'seguranca-social': 'Segurança Social',
  documentos: 'Documentos',
};

export default function FinanceiroSubPage() {
  const { section } = useParams<{ section: string }>();
  const navigate = useNavigate();
  const fin = useFinancialData();
  const com = useCommercialData();
  const currentYear = new Date().getFullYear();
  const sales = excludeCancelled(com.sales.data || []);
  const expenses = excludeCancelled(fin.expenses.data || []);
  const subscriptions = fin.subscriptions.data || [];
  const payrollData = fin.payroll.data || [];
  const contractorsData = fin.contractors.data || [];
  const documents = fin.documents.data || [];

  const profiles = useQuery({
    queryKey: ['profiles-list'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, full_name');
      return data || [];
    },
  });

  const title = TITLES[section || ''] || section || '';

  const renderContent = () => {
    switch (section) {
      case 'mensal':
        return <FinMensal sales={sales} expenses={expenses} subscriptions={subscriptions} payrollData={payrollData} contractorsData={contractorsData} documents={documents} currentYear={currentYear} fin={fin} />;
      case 'trimestral':
        return <FinTrimestral sales={sales} expenses={expenses} currentYear={currentYear} />;
      case 'entradas':
        return <FinEntradas sales={sales} currentYear={currentYear} />;
      case 'saidas':
        return <FinSaidas fin={fin} />;
      case 'iva':
        return <FinIVA sales={sales} expenses={expenses} currentYear={currentYear} fin={fin} />;
      case 'seguranca-social':
        return <FinSegurancaSocial fin={fin} expenses={expenses} currentYear={currentYear} sales={sales} />;
      case 'documentos':
        return <FinAllDocuments />;
      default:
        return <EmptyModulePage title={title} />;
    }
  };

  return (
    <AppLayout>
      <div className="p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/hub/financeiro')}><ArrowLeft className="h-4 w-4" /></Button>
          <span className="text-sm text-muted-foreground">Contabilidade</span>
          <span className="text-muted-foreground">/</span>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        </div>
        {renderContent()}
      </div>
    </AppLayout>
  );
}
