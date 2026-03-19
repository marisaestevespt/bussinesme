import { useMemo } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { useFinancialData } from '@/hooks/useFinancialData';
import { useCommercialData } from '@/hooks/useCommercialData';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { FinOverview } from '@/components/financial/FinOverview';
import { FinEntradas } from '@/components/financial/FinEntradas';
import { FinSaidas } from '@/components/financial/FinSaidas';
import { FinBalanco } from '@/components/financial/FinBalanco';
import { FinIVA } from '@/components/financial/FinIVA';
import { FinDocumentos } from '@/components/financial/FinDocumentos';
import { FinPayroll } from '@/components/financial/FinPayroll';

const fmt = (v: number) => v.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

export default function FinanceiroPage() {
  const fin = useFinancialData();
  const com = useCommercialData();

  const profiles = useQuery({
    queryKey: ['profiles-list'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, full_name');
      return data || [];
    },
  });

  const currentYear = new Date().getFullYear();
  const sales = com.sales.data || [];
  const expenses = fin.expenses.data || [];
  const subscriptions = fin.subscriptions.data || [];
  const payrollData = fin.payroll.data || [];
  const contractorsData = fin.contractors.data || [];

  const { totalEntradas, totalSaidas, resultado, margem } = useMemo(() => {
    const ent = sales.filter(s => s.sale_year === currentYear).reduce((s, v) => s + v.invoice_total, 0);
    const sai = expenses.filter(e => e.expense_year === currentYear).reduce((s, v) => s + v.total_with_vat, 0);
    const res = ent - sai;
    const mar = ent > 0 ? Math.round(res / ent * 10000) / 100 : 0;
    return { totalEntradas: ent, totalSaidas: sai, resultado: res, margem: mar };
  }, [sales, expenses, currentYear]);

  return (
    <AppLayout>
      <div className="p-6 space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">Financeiro</h1>

        {/* Always-visible summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Total Entradas ({currentYear})</p><p className="text-xl font-bold text-green-600">{fmt(totalEntradas)}</p></CardContent></Card>
          <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Total Saídas ({currentYear})</p><p className="text-xl font-bold text-red-600">{fmt(totalSaidas)}</p></CardContent></Card>
          <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Resultado Líquido</p><p className={`text-xl font-bold ${resultado >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmt(resultado)}</p></CardContent></Card>
          <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Margem de Lucro</p><p className={`text-xl font-bold ${margem >= 0 ? 'text-green-600' : 'text-red-600'}`}>{margem}%</p></CardContent></Card>
        </div>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="w-full justify-start flex-wrap h-auto gap-1">
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            <TabsTrigger value="entradas">Entradas</TabsTrigger>
            <TabsTrigger value="saidas">Saídas</TabsTrigger>
            <TabsTrigger value="balanco">Balanço</TabsTrigger>
            <TabsTrigger value="iva">IVA</TabsTrigger>
            <TabsTrigger value="documentos">Documentos</TabsTrigger>
            <TabsTrigger value="payroll">Folha de Pagamentos</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <FinOverview sales={sales} expenses={expenses} subscriptions={subscriptions} payrollData={payrollData} contractorsData={contractorsData} currentYear={currentYear} />
          </TabsContent>
          <TabsContent value="entradas">
            <FinEntradas sales={sales} currentYear={currentYear} />
          </TabsContent>
          <TabsContent value="saidas">
            <FinSaidas fin={fin} />
          </TabsContent>
          <TabsContent value="balanco">
            <FinBalanco sales={sales} expenses={expenses} currentYear={currentYear} />
          </TabsContent>
          <TabsContent value="iva">
            <FinIVA sales={sales} expenses={expenses} currentYear={currentYear} />
          </TabsContent>
          <TabsContent value="documentos">
            <FinDocumentos fin={fin} />
          </TabsContent>
          <TabsContent value="payroll">
            <FinPayroll fin={fin} profiles={profiles.data || []} />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
