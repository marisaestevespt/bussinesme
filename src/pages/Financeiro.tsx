import { useMemo, useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { excludeCancelled } from '@/lib/utils';
import { useFinancialData } from '@/hooks/useFinancialData';
import { useCommercialData } from '@/hooks/useCommercialData';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { YearSelector } from '@/components/YearSelector';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { exportPdf } from '@/lib/exportPdf';
import { ALL_SECTIONS_ROW1, ALL_SECTIONS_ROW2 } from '@/components/financial/finOverview/sections';
import { NavRow } from '@/components/financial/finOverview/NavSections';
import { useOverviewData } from '@/components/financial/finOverview/useOverviewData';
import { useProjectedRecurringExpenses } from '@/components/financial/useProjectedRecurringExpenses';
import { SummaryCards, BestWorstMonth } from '@/components/financial/finOverview/SummaryCards';
import { MonthlyCharts } from '@/components/financial/finOverview/MonthlyCharts';
import { PieDistributions } from '@/components/financial/finOverview/PieDistributions';
import { InsightsRow } from '@/components/financial/finOverview/InsightsRow';
import type { BusinessSettingsLike } from '@/components/financial/types';

export default function FinanceiroPage() {
  const { settings } = useBusinessSettings();
  const fin = useFinancialData({ expenses: true, recurring: false, documents: false, payroll: false, contractors: false });
  const [year, setYear] = useState(new Date().getFullYear());
  const com = useCommercialData(year);

  const s = (settings as (BusinessSettingsLike & { ss_exempt?: boolean; tax_irs_regime?: string }) | null) || {};
  const ivaExempt = s.iva_exempt ?? false;
  const ssExempt = s.ss_exempt ?? false;
  const isContabOrganizada = (s.tax_irs_regime || '') === 'contabilidade_organizada';

  const SECTIONS_ROW1 = useMemo(() => ALL_SECTIONS_ROW1.filter(sec => {
    if (sec.key === 'iva' && ivaExempt && !isContabOrganizada) return false;
    if (sec.key === 'ss' && ssExempt && !isContabOrganizada) return false;
    return true;
  }), [ivaExempt, ssExempt, isContabOrganizada]);

  const sales = excludeCancelled(com.sales.data || []);
  const expenses = excludeCancelled(fin.expenses.data || []);
  const projected = useProjectedRecurringExpenses(year, expenses);
  const augmentedExpenses = useMemo(() => [...expenses, ...projected], [expenses, projected]);

  useQuery({
    queryKey: ['clients-fin-overview'],
    queryFn: async () => {
      const { data } = await supabase.from('clients').select('id, status, start_date, current_product');
      return data || [];
    },
  });

  const data = useOverviewData(sales, augmentedExpenses, year);

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader title="Contabilidade" subtitle="Gestão contabilística, entradas, saídas e obrigações fiscais." department="financeiro" />

        <div className="space-y-3">
          <NavRow sections={SECTIONS_ROW1} />
          <NavRow sections={ALL_SECTIONS_ROW2} />
        </div>

        <div className="flex items-center justify-between">
          <YearSelector year={year} onChange={setYear} />
          <Button size="sm" variant="outline" onClick={() => exportPdf(`Relatório Financeiro Anual — ${year}`, 'fin-annual-report')}>
            <Download className="h-3.5 w-3.5 mr-1" /> Exportar PDF
          </Button>
        </div>

        <div id="fin-annual-report" className="space-y-6">
          <SummaryCards
            totalEntradas={data.totalEntradas}
            totalSaidas={data.totalSaidas}
            resultado={data.resultado}
            margem={data.margem}
            avgEntradas={data.avgEntradas}
            avgSaidas={data.avgSaidas}
          />
          <BestWorstMonth best={data.bestMonth} worst={data.worstMonth} />
          <MonthlyCharts data={data.monthlyData} />
          <PieDistributions products={data.productPieData} categories={data.categoryPieData} />
          <InsightsRow
            productInsights={data.productInsights}
            categoryInsights={data.categoryInsights}
            clientsInYear={data.clientsInYear}
            yearSalesCount={data.yearSales.length}
            yearExpensesCount={data.yearExpenses.length}
          />
        </div>
      </div>
    </AppLayout>
  );
}