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
import { SummaryCards, BestWorstMonth } from '@/components/financial/finOverview/SummaryCards';
import { MonthlyCharts } from '@/components/financial/finOverview/MonthlyCharts';
import { PieDistributions } from '@/components/financial/finOverview/PieDistributions';
import { InsightsRow } from '@/components/financial/finOverview/InsightsRow';
import type { BusinessSettingsLike } from '@/components/financial/types';
import { Card, CardContent } from '@/components/ui/card';
import { Wallet } from 'lucide-react';
import { formatEuro } from '@/lib/formatting';

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

  useQuery({
    queryKey: ['clients-fin-overview'],
    queryFn: async () => {
      const { data } = await supabase.from('clients').select('id, status, start_date, current_product');
      return data || [];
    },
  });

  // Saldo geral (lifetime, sem IVA) — independente do ano selecionado
  const lifetime = useQuery({
    queryKey: ['fin-lifetime-balance'],
    queryFn: async () => {
      const now = new Date();
      const cy = now.getFullYear();
      const cm = now.getMonth() + 1;
      const [salesRes, expRes] = await Promise.all([
        supabase.from('commercial_sales').select('base_value, status, sale_year, sale_month'),
        supabase.from('financial_expenses').select('base_value, status, expense_year, expense_month'),
      ]);
      const upTo = <T extends { sale_year?: number | null; sale_month?: number | null; expense_year?: number | null; expense_month?: number | null }>(items: T[], yKey: 'sale_year' | 'expense_year', mKey: 'sale_month' | 'expense_month') =>
        items.filter(i => {
          const y = i[yKey] as number | null | undefined;
          const m = i[mKey] as number | null | undefined;
          if (!y || !m) return false;
          return y < cy || (y === cy && m <= cm);
        });
      const allSales = upTo(excludeCancelled(salesRes.data || []), 'sale_year', 'sale_month');
      const allExp = upTo(excludeCancelled(expRes.data || []), 'expense_year', 'expense_month');
      const entradas = allSales.reduce((s, v) => s + Number(v.base_value || 0), 0);
      const saidas = allExp.reduce((s, v) => s + Number(v.base_value || 0), 0);
      return { entradas, saidas, saldo: entradas - saidas };
    },
  });

  const data = useOverviewData(sales, expenses, year);

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader title="Contabilidade" subtitle="Gestão contabilística, entradas, saídas e obrigações fiscais." department="financeiro" />

        {lifetime.data && (
          <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
            <CardContent className="pt-4 pb-3 flex flex-wrap items-center gap-x-8 gap-y-2">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  <Wallet className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Saldo geral acumulado até hoje (s/ IVA)</p>
                  <p className={`text-2xl font-bold ${lifetime.data.saldo >= 0 ? 'text-success' : 'text-destructive'}`}>
                    {formatEuro(lifetime.data.saldo)}
                  </p>
                </div>
              </div>
              <div className="flex gap-6 ml-auto text-sm">
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Total entradas</p>
                  <p className="font-semibold text-success">{formatEuro(lifetime.data.entradas)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Total saídas</p>
                  <p className="font-semibold text-destructive">{formatEuro(lifetime.data.saidas)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

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