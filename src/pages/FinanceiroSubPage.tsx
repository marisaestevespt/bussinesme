import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { excludeCancelled } from '@/lib/utils';
import { BackNavigation } from '@/components/BackNavigation';
import { useParams } from 'react-router-dom';
import { useState, lazy, Suspense, useMemo } from 'react';
import { useFinancialData, type FinancialDataOptions } from '@/hooks/useFinancialData';
import { useCommercialData } from '@/hooks/useCommercialData';
import { EmptyModulePage } from '@/components/EmptyModulePage';
import { YearSelector } from '@/components/YearSelector';
import { Skeleton } from '@/components/ui/skeleton';

const FinEntradas = lazy(() => import('@/components/financial/FinEntradas').then(m => ({ default: m.FinEntradas })));
const FinSaidas = lazy(() => import('@/components/financial/FinSaidas').then(m => ({ default: m.FinSaidas })));
const FinIVA = lazy(() => import('@/components/financial/FinIVA').then(m => ({ default: m.FinIVA })));
const FinPayroll = lazy(() => import('@/components/financial/FinPayroll').then(m => ({ default: m.FinPayroll })));
const FinMensal = lazy(() => import('@/components/financial/FinMensal').then(m => ({ default: m.FinMensal })));
const FinTrimestral = lazy(() => import('@/components/financial/FinTrimestral').then(m => ({ default: m.FinTrimestral })));
const FinSegurancaSocial = lazy(() => import('@/components/financial/FinSegurancaSocial').then(m => ({ default: m.FinSegurancaSocial })));
const FinAllDocuments = lazy(() => import('@/components/financial/FinAllDocuments').then(m => ({ default: m.FinAllDocuments })));
const FinSetupFinanceiro = lazy(() => import('@/components/financial/FinSetupFinanceiro').then(m => ({ default: m.FinSetupFinanceiro })));
const FinGoals = lazy(() => import('@/components/financial/FinGoals').then(m => ({ default: m.FinGoals })));
const FinContabilidade = lazy(() => import('@/components/financial/FinContabilidade').then(m => ({ default: m.FinContabilidade })));
const FinListaProdutos = lazy(() => import('@/components/financial/FinListaProdutos').then(m => ({ default: m.FinListaProdutos })));
const FinPrevisibilidade = lazy(() => import('@/components/financial/FinPrevisibilidade').then(m => ({ default: m.FinPrevisibilidade })));

const TITLES: Record<string, string> = {
  mensal: 'Mensal',
  trimestral: 'Trimestral',
  entradas: 'Entradas',
  saidas: 'Saídas',
  ordenados: 'Ordenados',
  iva: 'IVA',
  'seguranca-social': 'Segurança Social',
  documentos: 'Documentos',
  'setup-financeiro': 'Lista de Fornecedores',
  'lista-produtos': 'Lista de Produtos',
  contabilidade: 'Prazos Fiscais',
  previsibilidade: 'Previsibilidade',
};

const YEAR_SECTIONS = ['mensal', 'trimestral', 'entradas', 'saidas', 'ordenados', 'iva', 'seguranca-social', 'contabilidade', 'previsibilidade'];

/**
 * Per-section query requirements — only fetch what's actually needed.
 * Sections not listed here (contabilidade, ordenados, documentos) fetch their own data internally.
 */
function getFinancialOptions(section: string | undefined): FinancialDataOptions {
  switch (section) {
    case 'mensal':
      return { expenses: true, recurring: true, documents: true, payroll: true, contractors: true };
    case 'trimestral':
    case 'metas-financeiras':
      return { expenses: true, recurring: false, documents: false, payroll: false, contractors: false };
    case 'saidas':
      return { expenses: true, recurring: true, documents: false, payroll: false, contractors: false };
    case 'iva':
    case 'seguranca-social':
      return { expenses: true, recurring: true, documents: false, payroll: false, contractors: false };
    case 'setup-financeiro':
      return { expenses: true, recurring: true, documents: true, payroll: true, contractors: true };
    case 'previsibilidade':
      return { expenses: true, recurring: true, documents: false, payroll: true, contractors: true };
    case 'entradas':
      return { expenses: false, recurring: false, documents: false, payroll: false, contractors: false };
    // contabilidade, ordenados, documentos — fetch their own data internally
    default:
      return { expenses: false, recurring: false, documents: false, payroll: false, contractors: false };
  }
}

function needsCommercialData(section: string | undefined): boolean {
  return ['mensal', 'trimestral', 'entradas', 'iva', 'seguranca-social', 'metas-financeiras', 'contabilidade', 'previsibilidade'].includes(section || '');
}

function LoadingFallback() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

export default function FinanceiroSubPage() {
  const { section } = useParams<{ section: string }>();
  const [year, setYear] = useState(new Date().getFullYear());

  const finOptions = useMemo(() => getFinancialOptions(section), [section]);
  const fin = useFinancialData(finOptions);

  // Only fetch commercial data when the section needs it
  const comEnabled = needsCommercialData(section);
  const com = useCommercialData(comEnabled ? year : -1);

  const title = TITLES[section || ''] || section || '';
  const showYearSelector = YEAR_SECTIONS.includes(section || '');

  const renderContent = () => {
    const sales = comEnabled ? excludeCancelled(com.sales.data || []) : [];
    const expenses = excludeCancelled(fin.expenses.data || []);

    switch (section) {
      case 'mensal': {
        const payrollData = fin.payroll.data || [];
        const contractorsData = fin.contractors.data || [];
        const documents = fin.documents.data || [];
        return <FinMensal sales={sales} expenses={expenses} payrollData={payrollData} contractorsData={contractorsData} documents={documents} currentYear={year} fin={fin} />;
      }
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
      case 'metas-financeiras': {
        const yearSales = sales.filter(s => s.sale_year === year);
        const yearExpenses = expenses.filter(e => e.expense_year === year);
        return <FinGoals currentYear={year} yearSales={yearSales} yearExpenses={yearExpenses} />;
      }
      case 'contabilidade':
        return <FinContabilidade currentYear={year} />;
      case 'lista-produtos':
        return <FinListaProdutos />;
      case 'previsibilidade':
        return <FinPrevisibilidade fin={fin} currentYear={year} sales={sales} />;
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
        <Suspense fallback={<LoadingFallback />}>
          {renderContent()}
        </Suspense>
      </div>
    </AppLayout>
  );
}
