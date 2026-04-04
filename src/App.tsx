import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { BusinessSettingsProvider, useBusinessSettings } from "@/hooks/useBusinessSettings";
import { ActiveTimerProvider } from "@/hooks/useActiveTimer";
import { KpiSettingsProvider } from "@/hooks/useKpiSettings";
import { FloatingTimer } from "@/components/FloatingTimer";
import { AuthPage } from "@/components/AuthPage";
import { SetupPage } from "@/components/SetupPage";
import NotFound from "./pages/NotFound";
import ResetPasswordPage from "./pages/ResetPassword";
import SecretariaPage from "./pages/Secretaria";
import ComecaAquiPage from "./pages/ComecaAqui";
import HubPage from "./pages/Hub";
import ExecutiveDashboard from "./pages/ExecutiveDashboard";
import ExecutivePlaneamento from "./pages/ExecutivePlaneamento";
import ExecutiveWeeklyAlign from "./pages/ExecutiveWeeklyAlign";
import ExecutiveGestaoEquipa from "./pages/ExecutiveGestaoEquipa";
import ExecutiveBusinessPlan from "./pages/ExecutiveBusinessPlan";
import ExecutiveInnovation from "./pages/ExecutiveInnovation";
import ExecutiveProductivity from "./pages/ExecutiveProductivity";
import ExecutiveCapacidade from "./pages/ExecutiveCapacidade";
import ExecutivePage from "./pages/Executive";
import ExecutiveRecommendations from "./pages/ExecutiveRecommendations";
import ExecutiveProcessos from "./pages/ExecutiveProcessos";
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
import MarketingAnalisePage from "./pages/MarketingAnalise";
import MarketingTrafegoPago from "./pages/MarketingTrafegoPago";
import TrafegoReportDetail from "./pages/TrafegoReportDetail";
import TrafegoCriativoDetail from "./pages/TrafegoCriativoDetail";
import ComercialPage from "./pages/Comercial";
import ComercialSubPage from "./pages/ComercialSubPage";
import ComercialAnalisePage from "./pages/ComercialAnalise";
import ProdutosPage from "./pages/Produtos";
import ProdutoDetailPage from "./pages/ProdutoDetail";
import ClientesPage from "./pages/Clientes";
import ClienteDetailPage from "./pages/ClienteDetail";
import ClientesAnalisePage from "./pages/ClientesAnalise";
import PortalClientesPage from "./pages/PortalClientes";
import ClientesFeedbackPage from "./pages/ClientesFeedback";
import PortalAuthPage from "./pages/PortalAuth";
import PortalViewPage from "./pages/PortalView";
import VendaDetailPage from "./pages/VendaDetail";
import CrmPipelinesPage from "./pages/CrmPipelines";
import FinanceiroPage from "./pages/Financeiro";
import FinanceiroSubPage from "./pages/FinanceiroSubPage";
import FornecedoresPage from "./pages/Fornecedores";
import OperacaoPage from "./pages/Operacao";
import RecursosHumanosSubPage from "./pages/RecursosHumanosSubPage";
import { ensureYearRoutineTasks } from '@/hooks/usePlanningRoutines';
import { useSuspensionCheck } from '@/hooks/useSuspensionCheck';
import { SuspensionScreen } from '@/components/SuspensionScreen';

import { useEffect, useRef } from 'react';

const queryClient = new QueryClient();

function AppRoutes() {
  const { user, loading: authLoading, isOwner } = useAuth();
  const { isSetupComplete, loading: settingsLoading } = useBusinessSettings();
  const { suspended, loading: suspensionLoading } = useSuspensionCheck();

  // Ensure routine tasks exist for current year on boot
  const routineBootRef = useRef(false);
  useEffect(() => {
    if (user && !routineBootRef.current) {
      routineBootRef.current = true;
      ensureYearRoutineTasks();
      // Birthday notifications moved to daily-birthday-check edge function (cron)
    }
  }, [user]);

  if (authLoading || settingsLoading || suspensionLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/portal/:token" element={<PortalAuthPage />} />
        <Route path="/portal/:token/view" element={<PortalViewPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="*" element={<AuthPage />} />
      </Routes>
    );
  }

  // Check suspension AFTER auth but BEFORE app content
  if (suspended) {
    return <SuspensionScreen />;
  }

  if (!isSetupComplete) {
    return (
      <Routes>
        <Route path="/portal/:token" element={<PortalAuthPage />} />
        <Route path="/portal/:token/view" element={<PortalViewPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="*" element={<SetupPage />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/portal/:token" element={<PortalAuthPage />} />
      <Route path="/portal/:token/view" element={<PortalViewPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
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
      <Route path="/hub/marketing/analise" element={<MarketingAnalisePage />} />
      <Route path="/hub/marketing/trafego-pago" element={<MarketingTrafegoPago />} />
      <Route path="/hub/marketing/trafego-pago/report/:id" element={<TrafegoReportDetail />} />
      <Route path="/hub/marketing/trafego-pago/criativo/:id" element={<TrafegoCriativoDetail />} />
      <Route path="/hub/marketing/:pageKey" element={<MarketingSubPage />} />
      <Route path="/hub/comercial" element={<ComercialPage />} />
      <Route path="/hub/comercial/analise" element={<ComercialAnalisePage />} />
      <Route path="/hub/comercial/vendas/:id" element={<VendaDetailPage />} />
      <Route path="/hub/comercial/pipelines" element={<CrmPipelinesPage />} />
      <Route path="/hub/comercial/:section" element={<ComercialSubPage />} />
      <Route path="/hub/produtos" element={<ProdutosPage />} />
      <Route path="/hub/produtos/:id" element={<ProdutoDetailPage />} />
      <Route path="/hub/clientes" element={<ClientesPage />} />
      <Route path="/hub/clientes/analise" element={<ClientesAnalisePage />} />
      <Route path="/hub/clientes/portais" element={<PortalClientesPage />} />
      <Route path="/hub/clientes/feedback" element={<ClientesFeedbackPage />} />
      <Route path="/hub/clientes/:id" element={<ClienteDetailPage />} />
      <Route path="/hub/financeiro" element={<FinanceiroPage />} />
      <Route path="/hub/financeiro/fornecedores" element={<FornecedoresPage />} />
      <Route path="/hub/financeiro/:section" element={<FinanceiroSubPage />} />
      <Route path="/hub/operacao" element={<OperacaoPage />} />
      <Route path="/hub/recursos-humanos" element={<ExecutiveGestaoEquipa />} />
      <Route path="/hub/recursos-humanos/:section" element={<RecursosHumanosSubPage />} />
      <Route path="/hub/:module" element={<HubPage />} />
      <Route path="/executive" element={<ExecutiveDashboard />} />
      <Route path="/executive/planeamento" element={<ExecutivePlaneamento />} />
      <Route path="/executive/weekly-align" element={<ExecutiveWeeklyAlign />} />
      <Route path="/executive/business-plan" element={<ExecutiveBusinessPlan />} />
      <Route path="/executive/innovation" element={<ExecutiveInnovation />} />
       <Route path="/executive/productivity" element={<ExecutiveProductivity />} />
       <Route path="/executive/capacidade" element={<ExecutiveCapacidade />} />
        <Route path="/executive/recommendations" element={<ExecutiveRecommendations />} />
        <Route path="/executive/processos" element={<ExecutiveProcessos />} />
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
              <KpiSettingsProvider>
                <FloatingTimer />
                <AppRoutes />
              </KpiSettingsProvider>
            </ActiveTimerProvider>
          </BusinessSettingsProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
