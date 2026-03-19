import { AppLayout } from '@/components/AppLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CommercialOverview } from '@/components/commercial/CommercialOverview';
import { CommercialMetas } from '@/components/commercial/CommercialMetas';
import { CommercialVendas } from '@/components/commercial/CommercialVendas';
import { EmptyModulePage } from '@/components/EmptyModulePage';

export default function ComercialPage() {
  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Comercial</h1>
        <Tabs defaultValue="overview">
          <TabsList className="flex-wrap">
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            <TabsTrigger value="metas">Metas Comerciais</TabsTrigger>
            <TabsTrigger value="vendas">Vendas</TabsTrigger>
            <TabsTrigger value="acoes">Ações de Vendas</TabsTrigger>
            <TabsTrigger value="crm">CRM</TabsTrigger>
            <TabsTrigger value="estrategia">Estratégia</TabsTrigger>
            <TabsTrigger value="biblioteca">Biblioteca</TabsTrigger>
          </TabsList>
          <TabsContent value="overview"><CommercialOverview /></TabsContent>
          <TabsContent value="metas"><CommercialMetas /></TabsContent>
          <TabsContent value="vendas"><CommercialVendas /></TabsContent>
          <TabsContent value="acoes"><EmptyModulePage title="Ações de Vendas" description="Conteúdo será construído em breve." /></TabsContent>
          <TabsContent value="crm"><EmptyModulePage title="CRM" description="Conteúdo será construído em breve." /></TabsContent>
          <TabsContent value="estrategia"><EmptyModulePage title="Estratégia" description="Conteúdo será construído em breve." /></TabsContent>
          <TabsContent value="biblioteca"><EmptyModulePage title="Biblioteca" description="Conteúdo será construído em breve." /></TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
