import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { BusinessSettingsProvider, useBusinessSettings } from "@/hooks/useBusinessSettings";
import { ActiveTimerProvider } from "@/hooks/useActiveTimer";
import { FloatingTimer } from "@/components/FloatingTimer";
import { AuthPage } from "@/components/AuthPage";
import { SetupPage } from "@/components/SetupPage";
import NotFound from "./pages/NotFound";
import SecretariaPage from "./pages/Secretaria";
import ComecaAquiPage from "./pages/ComecaAqui";
import HubPage from "./pages/Hub";
import ExecutiveDashboard from "./pages/ExecutiveDashboard";
import ExecutivePlaneamento from "./pages/ExecutivePlaneamento";
import ExecutiveWeeklyAlign from "./pages/ExecutiveWeeklyAlign";
import ExecutiveGestaoEquipa from "./pages/ExecutiveGestaoEquipa";
import ExecutiveBusinessPlan from "./pages/ExecutiveBusinessPlan";
import ExecutiveInnovation from "./pages/ExecutiveInnovation";
import ExecutivePage from "./pages/Executive";
import DefinicoesPage from "./pages/Definicoes";
import AgendaPage from "./pages/Agenda";
import ReunioesPage from "./pages/Reunioes";
import ReuniaoDetailPage from "./pages/ReuniaoDetail";
import AcessosPage from "./pages/Acessos";
import MuralPage from "./pages/Mural";
import ProjetosPage from "./pages/Projetos";
import ProjetoDetailPage from "./pages/ProjetoDetail";
import ProcessosPage from "./pages/Processos";
import SopDetailPage from "./pages/SopDetail";
import BibliotecaPage from "./pages/Biblioteca";
import TarefasPage from "./pages/Tarefas";
import HubEquipaPage from "./pages/HubEquipa";
import GestaoMarcaPage from "./pages/GestaoMarca";
import MarketingDashboard from "./pages/MarketingDashboard";
import MarketingSubPage from "./pages/MarketingSubPage";
import MarketingProcessos from "./pages/MarketingProcessos";
import MarketingRecursos from "./pages/MarketingRecursos";
import MarketingAutomacoes from "./pages/MarketingAutomacoes";
import MarketingAutomacaoDetail from "./pages/MarketingAutomacaoDetail";
import ConteudoDetailPage from "./pages/ConteudoDetail";
import ChannelPage from "./pages/ChannelPage";
import MarketingEstrategia from "./pages/MarketingEstrategia";
import MarketingChannelStrategy from "./pages/MarketingChannelStrategy";
import MarketingFunis from "./pages/MarketingFunis";
import MarketingFunilDetail from "./pages/MarketingFunilDetail";
import MarketingTrafegoPago from "./pages/MarketingTrafegoPago";
import TrafegoReportDetail from "./pages/TrafegoReportDetail";
import TrafegoCriativoDetail from "./pages/TrafegoCriativoDetail";
import ComercialPage from "./pages/Comercial";
import ComercialSubPage from "./pages/ComercialSubPage";
import ProdutosPage from "./pages/Produtos";
import ProdutoDetailPage from "./pages/ProdutoDetail";
import ClientesPage from "./pages/Clientes";
import ClienteDetailPage from "./pages/ClienteDetail";
import VendaDetailPage from "./pages/VendaDetail";
import FinanceiroPage from "./pages/Financeiro";
import FinanceiroSubPage from "./pages/FinanceiroSubPage";
import OperacaoPage from "./pages/Operacao";

const queryClient = new QueryClient();

function AppRoutes() {
  const { user, loading: authLoading, isOwner } = useAuth();
  const { isSetupComplete, loading: settingsLoading } = useBusinessSettings();

  if (authLoading || settingsLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) return <AuthPage />;
  if (!isSetupComplete) return <SetupPage />;

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/secretaria" replace />} />
      <Route path="/secretaria" element={<SecretariaPage />} />
      <Route path="/hub-equipa" element={<HubEquipaPage />} />
      <Route path="/comeca-aqui" element={<ComecaAquiPage />} />
      <Route path="/hub/agenda" element={<AgendaPage />} />
      <Route path="/hub/reunioes" element={<ReunioesPage />} />
      <Route path="/hub/reunioes/:id" element={<ReuniaoDetailPage />} />
      <Route path="/hub/acessos" element={<AcessosPage />} />
      <Route path="/hub/mural" element={<MuralPage />} />
      <Route path="/hub/projetos" element={<ProjetosPage />} />
      <Route path="/hub/projetos/:id" element={<ProjetoDetailPage />} />
      <Route path="/hub/processos" element={<ProcessosPage />} />
      <Route path="/hub/processos/:id" element={<SopDetailPage />} />
      <Route path="/hub/biblioteca" element={<BibliotecaPage />} />
      <Route path="/hub/tarefas" element={<TarefasPage />} />
        <Route path="/hub/marketing" element={<MarketingDashboard />} />
        <Route path="/hub/marketing/gestao-marca" element={<GestaoMarcaPage />} />
        <Route path="/hub/marketing/conteudos/:id" element={<ConteudoDetailPage />} />
        <Route path="/hub/marketing/canal/:channelId" element={<ChannelPage />} />
        <Route path="/hub/marketing/estrategia" element={<MarketingEstrategia />} />
        <Route path="/hub/marketing/estrategia/canal/:channelId" element={<MarketingChannelStrategy />} />
        <Route path="/hub/marketing/processos-mkt" element={<MarketingProcessos />} />
        <Route path="/hub/marketing/recursos-mkt" element={<MarketingRecursos />} />
        <Route path="/hub/marketing/automacoes" element={<MarketingAutomacoes />} />
        <Route path="/hub/marketing/automacoes/:id" element={<MarketingAutomacaoDetail />} />
        <Route path="/hub/marketing/funis" element={<MarketingFunis />} />
        <Route path="/hub/marketing/funis/:id" element={<MarketingFunilDetail />} />
        <Route path="/hub/marketing/trafego-pago" element={<MarketingTrafegoPago />} />
        <Route path="/hub/marketing/trafego-pago/report/:id" element={<TrafegoReportDetail />} />
        <Route path="/hub/marketing/trafego-pago/criativo/:id" element={<TrafegoCriativoDetail />} />
        <Route path="/hub/marketing/:pageKey" element={<MarketingSubPage />} />
      <Route path="/hub/comercial" element={<ComercialPage />} />
      <Route path="/hub/comercial/vendas/:id" element={<VendaDetailPage />} />
      <Route path="/hub/comercial/:section" element={<ComercialSubPage />} />
      <Route path="/hub/produtos" element={<ProdutosPage />} />
      <Route path="/hub/produtos/:id" element={<ProdutoDetailPage />} />
      <Route path="/hub/clientes" element={<ClientesPage />} />
      <Route path="/hub/clientes/:id" element={<ClienteDetailPage />} />
      <Route path="/hub/financeiro" element={<FinanceiroPage />} />
      <Route path="/hub/financeiro/:section" element={<FinanceiroSubPage />} />
      <Route path="/hub/operacao" element={<OperacaoPage />} />
        <Route path="/hub/:module" element={<HubPage />} />
      <Route path="/executive" element={<ExecutiveDashboard />} />
      <Route path="/executive/planeamento" element={<ExecutivePlaneamento />} />
      <Route path="/executive/weekly-align" element={<ExecutiveWeeklyAlign />} />
      <Route path="/executive/gestao-equipa" element={<ExecutiveGestaoEquipa />} />
      <Route path="/executive/:section" element={<ExecutivePage />} />
      <Route path="/definicoes" element={<DefinicoesPage />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <BusinessSettingsProvider>
            <ActiveTimerProvider>
              <FloatingTimer />
              <AppRoutes />
            </ActiveTimerProvider>
          </BusinessSettingsProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
