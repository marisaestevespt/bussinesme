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
import { FinSetupFinanceiro } from '@/components/financial/FinSetupFinanceiro';
import { FinPrevisibilidade } from '@/components/financial/FinPrevisibilidade';
import { FinGoals } from '@/components/financial/FinGoals';
import { FinContabilidade } from '@/components/financial/FinContabilidade';
import { EmptyModulePage } from '@/components/EmptyModulePage';
import { YearSelector } from '@/components/YearSelector';

const TITLES: Record<string, string> = {
  mensal: 'Mensal',
  trimestral: 'Trimestral',
  entradas: 'Entradas',
  saidas: 'Saídas',
  ordenados: 'Ordenados',
  iva: 'IVA',
  'seguranca-social': 'Segurança Social',
  documentos: 'Documentos',
  'setup-financeiro': 'Setup Financeiro',
  previsibilidade: 'Previsibilidade Financeira',
  'metas-financeiras': 'Metas Financeiras',
  contabilidade: 'Contabilidade',
};

const YEAR_SECTIONS = ['mensal', 'trimestral', 'entradas', 'saidas', 'ordenados', 'iva', 'seguranca-social', 'previsibilidade', 'metas-financeiras', 'contabilidade'];

export default function FinanceiroSubPage() {
  const { section } = useParams<{ section: string }>();
  const navigate = useNavigate();
  const [year, setYear] = useState(new Date().getFullYear());
  const fin = useFinancialData();
  const com = useCommercialData(year);
  const sales = excludeCancelled(com.sales.data || []);
  const expenses = excludeCancelled(fin.expenses.data || []);
  const recurringExpenses = fin.recurringExpenses.data || [];
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

  const yearSales = sales.filter(s => s.sale_year === year);
  const yearExpenses = expenses.filter(e => e.expense_year === year);

  const renderContent = () => {
    switch (section) {
      case 'mensal':
        return <FinMensal sales={sales} expenses={expenses} payrollData={payrollData} contractorsData={contractorsData} documents={documents} currentYear={year} fin={fin} />;
      case 'trimestral':
        return <FinTrimestral sales={sales} expenses={expenses} currentYear={year} />;
      case 'entradas':
        return <FinEntradas sales={sales} currentYear={year} />;
      case 'saidas':
        return <FinSaidas fin={fin} currentYear={year} />;
      case 'ordenados':
        return <FinPayroll currentYear={year} />;
      case 'iva':
        return <FinIVA sales={sales} expenses={expenses} currentYear={year} fin={fin} />;
      case 'seguranca-social':
        return <FinSegurancaSocial fin={fin} expenses={expenses} currentYear={year} sales={sales} />;
      case 'documentos':
        return <FinAllDocuments />;
      case 'setup-financeiro':
        return <FinSetupFinanceiro fin={fin} />;
      case 'previsibilidade':
        return <FinPrevisibilidade fin={fin} currentYear={year} sales={sales} />;
      case 'metas-financeiras':
        return <FinGoals currentYear={year} yearSales={yearSales} yearExpenses={yearExpenses} />;
      case 'contabilidade':
        return <FinContabilidade currentYear={year} />;
      default:
        return <EmptyModulePage title={title} />;
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <BackNavigation />
        <PageHeader title={title} />
        {showYearSelector && <YearSelector year={year} onChange={setYear} />}
        {renderContent()}
      </div>
    </AppLayout>
  );
}
