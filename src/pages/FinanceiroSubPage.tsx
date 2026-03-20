import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { excludeCancelled } from '@/lib/utils';
import { BackNavigation } from '@/components/BackNavigation';
import { useNavigate, useParams } from 'react-router-dom';
import { useState } from 'react';
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
import { YearSelector } from '@/components/YearSelector';

const TITLES: Record<string, string> = {
  mensal: 'Mensal',
  trimestral: 'Trimestral',
  entradas: 'Entradas',
  saidas: 'Saídas',
  iva: 'IVA',
  'seguranca-social': 'Segurança Social',
  documentos: 'Documentos',
};

const YEAR_SECTIONS = ['mensal', 'trimestral', 'entradas', 'iva', 'seguranca-social'];

export default function FinanceiroSubPage() {
  const { section } = useParams<{ section: string }>();
  const navigate = useNavigate();
  const [year, setYear] = useState(new Date().getFullYear());
  const fin = useFinancialData();
  const com = useCommercialData(year);
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
  const showYearSelector = YEAR_SECTIONS.includes(section || '');

  const renderContent = () => {
    switch (section) {
      case 'mensal':
        return <FinMensal sales={sales} expenses={expenses} subscriptions={subscriptions} payrollData={payrollData} contractorsData={contractorsData} documents={documents} currentYear={year} fin={fin} />;
      case 'trimestral':
        return <FinTrimestral sales={sales} expenses={expenses} currentYear={year} />;
      case 'entradas':
        return <FinEntradas sales={sales} currentYear={year} />;
      case 'saidas':
        return <FinSaidas fin={fin} />;
      case 'iva':
        return <FinIVA sales={sales} expenses={expenses} currentYear={year} fin={fin} />;
      case 'seguranca-social':
        return <FinSegurancaSocial fin={fin} expenses={expenses} currentYear={year} sales={sales} />;
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
        </div>
        <PageHeader title={title} />
        {showYearSelector && <YearSelector year={year} onChange={setYear} />}
        {renderContent()}
      </div>
    </AppLayout>
  );
}
