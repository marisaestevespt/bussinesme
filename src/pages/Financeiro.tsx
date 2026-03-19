import { AppLayout } from '@/components/AppLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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

  return (
    <AppLayout>
      <div className="p-6 space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">Financeiro</h1>
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
