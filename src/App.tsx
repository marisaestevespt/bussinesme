import { QueryClient, QueryClientProvider, MutationCache } from "@tanstack/react-query";
import { isConfirmCancelled } from "@/lib/confirmDestructive";
import { AppTabsProvider } from "@/hooks/useAppTabs";
import { BrowserRouter, Route, Routes, Navigate, useParams } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DialogsProvider } from "@/components/ui/confirm-dialog";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { BusinessSettingsProvider, useBusinessSettings } from "@/hooks/useBusinessSettings";
import { ActiveTimerProvider } from "@/hooks/useActiveTimer";
import { KpiSettingsProvider } from "@/hooks/useKpiSettings";
import { FloatingTimer } from "@/components/FloatingTimer";
import { ImpersonationProvider } from "@/contexts/ImpersonationContext";
import { GlobalRealtimeProvider } from "@/providers/GlobalRealtimeProvider";
import { ImpersonationBanner } from "@/components/ImpersonationBanner";
import { AuthPage } from "@/components/AuthPage";
import { SetupPage } from "@/components/SetupPage";
import NotFound from "./pages/NotFound";
import ResetPasswordPage from "./pages/ResetPassword";
import EmailUnsubscribePage from "./pages/EmailUnsubscribe";
import { lazy, Suspense, useEffect, useRef } from 'react';
import { ensureYearRoutineTasks } from '@/hooks/usePlanningRoutines';
import { useSuspensionCheck } from '@/hooks/useSuspensionCheck';
import { SuspensionScreen } from '@/components/SuspensionScreen';
import { InlineLoader } from '@/components/ui/loading-skeletons';
import { RouteGuard } from '@/components/RouteGuard';

function RedirectClienteId() {
  const { id } = useParams();
  return <Navigate to={`/hub/clientes/${id}`} replace />;
}

function RedirectTrafegoPagoLegacy() {
  const { id } = useParams();
  const target = id && id !== ':id'
    ? `/hub/marketing/trafego-pago/criativo/${id}`
    : '/hub/marketing/trafego-pago';

  return <Navigate to={target} replace />;
}

// Lazy-loaded pages (code-splitting per route)
const SecretariaPage = lazy(() => import("./pages/Secretaria"));
const ComecaAquiPage = lazy(() => import("./pages/ComecaAqui"));
const HubPage = lazy(() => import("./pages/Hub"));
const AdminDiagnosticsPage = lazy(() => import("./pages/AdminDiagnostics"));
const AdminPage = lazy(() => import("./pages/Admin"));
const ExecutiveDashboard = lazy(() => import("./pages/ExecutiveDashboard"));
const ExecutivePlaneamento = lazy(() => import("./pages/ExecutivePlaneamento"));
const ExecutivePlaneamentoTatico = lazy(() => import("./pages/ExecutivePlaneamentoTatico"));
const ExecutivePlaneamentoEstrategico = lazy(() => import("./pages/ExecutivePlaneamentoEstrategico"));
const ExecutivePlaneamentoOperacional = lazy(() => import("./pages/ExecutivePlaneamentoOperacional"));

const PlaneamentoDepartamento = lazy(() => import("./pages/PlaneamentoDepartamento"));
const ExecutiveWeeklyAlign = lazy(() => import("./pages/ExecutiveWeeklyAlign"));
const ExecutiveGestaoEquipa = lazy(() => import("./pages/ExecutiveGestaoEquipa"));
const ExecutiveBusinessPlan = lazy(() => import("./pages/ExecutiveBusinessPlan"));
const ExecutiveBusinessPlanBlock = lazy(() => import("./pages/ExecutiveBusinessPlanBlock"));
const ExecutiveInnovation = lazy(() => import("./pages/ExecutiveInnovation"));
const ExecutiveProductivity = lazy(() => import("./pages/ExecutiveProductivity"));
const ExecutiveCapacidade = lazy(() => import("./pages/ExecutiveCapacidade"));
const ExecutiveAnaliseEmpresarial = lazy(() => import("./pages/ExecutiveAnaliseEmpresarial"));
const ExecutivePage = lazy(() => import("./pages/Executive"));
const ExecutiveRecommendations = lazy(() => import("./pages/ExecutiveRecommendations"));
const ExecutiveProcessos = lazy(() => import("./pages/ExecutiveProcessos"));
const ExecutiveBrainDump = lazy(() => import("./pages/ExecutiveBrainDump"));
const DefinicoesPage = lazy(() => import("./pages/Definicoes"));
const AjudaPage = lazy(() => import("./pages/Ajuda"));
const AgendaPage = lazy(() => import("./pages/Agenda"));
const ReunioesPage = lazy(() => import("./pages/Reunioes"));
const ReuniaoDetailPage = lazy(() => import("./pages/ReuniaoDetail"));
const AcessosPage = lazy(() => import("./pages/Acessos"));
const MuralPage = lazy(() => import("./pages/Mural"));
const ProjetosPage = lazy(() => import("./pages/Projetos"));
const ProjetoDetailPage = lazy(() => import("./pages/ProjetoDetail"));
const ProcessosPage = lazy(() => import("./pages/Processos"));
const SopDetailPage = lazy(() => import("./pages/SopDetail"));
const BibliotecaPage = lazy(() => import("./pages/Biblioteca"));
const TarefasPage = lazy(() => import("./pages/Tarefas"));
const HubEquipaPage = lazy(() => import("./pages/HubEquipa"));
const GestaoMarcaPage = lazy(() => import("./pages/GestaoMarca"));
const MarketingDashboard = lazy(() => import("./pages/MarketingDashboard"));
const MarketingSubPage = lazy(() => import("./pages/MarketingSubPage"));
const MarketingProcessos = lazy(() => import("./pages/MarketingProcessos"));
const MarketingRecursos = lazy(() => import("./pages/MarketingRecursos"));
const MarketingAutomacoes = lazy(() => import("./pages/MarketingAutomacoes"));
const MarketingAutomacaoDetail = lazy(() => import("./pages/MarketingAutomacaoDetail"));
const ConteudoDetailPage = lazy(() => import("./pages/ConteudoDetail"));
const ChannelPage = lazy(() => import("./pages/ChannelPage"));
const MarketingEstrategia = lazy(() => import("./pages/MarketingEstrategia"));
const MarketingPublicoAlvo = lazy(() => import("./pages/MarketingPublicoAlvo"));
const MarketingChannelStrategy = lazy(() => import("./pages/MarketingChannelStrategy"));
const MarketingFunis = lazy(() => import("./pages/MarketingFunis"));
const MarketingFunilDetail = lazy(() => import("./pages/MarketingFunilDetail"));
const MarketingAnalisePage = lazy(() => import("./pages/MarketingAnalise"));
const MarketingTrafegoPago = lazy(() => import("./pages/MarketingTrafegoPago"));
const TrafegoReportDetail = lazy(() => import("./pages/TrafegoReportDetail"));
const TrafegoCriativoDetail = lazy(() => import("./pages/TrafegoCriativoDetail"));
const ComercialPage = lazy(() => import("./pages/Comercial"));
const ComercialSubPage = lazy(() => import("./pages/ComercialSubPage"));
const ComercialAnalisePage = lazy(() => import("./pages/ComercialAnalise"));
const ProdutosPage = lazy(() => import("./pages/Produtos"));
const ProdutoDetailPage = lazy(() => import("./pages/ProdutoDetail"));
const ClientesPage = lazy(() => import("./pages/Clientes"));
const ClienteDetailPage = lazy(() => import("./pages/ClienteDetail"));
const ClientesAnalisePage = lazy(() => import("./pages/ClientesAnalise"));
const PortalClientesPage = lazy(() => import("./pages/PortalClientes"));
const ClientesFeedbackPage = lazy(() => import("./pages/ClientesFeedback"));
const PortalAuthPage = lazy(() => import("./pages/PortalAuth"));
const PortalViewPage = lazy(() => import("./pages/PortalView"));
const VendaDetailPage = lazy(() => import("./pages/VendaDetail"));
const CrmPipelinesPage = lazy(() => import("./pages/CrmPipelines"));
const LeadDetailPage = lazy(() => import("./pages/LeadDetail"));
const FinanceiroPage = lazy(() => import("./pages/Financeiro"));
const FinanceiroSubPage = lazy(() => import("./pages/FinanceiroSubPage"));
const FornecedoresPage = lazy(() => import("./pages/Fornecedores"));
const OperacaoPage = lazy(() => import("./pages/Operacao"));
const RecursosHumanosSubPage = lazy(() => import("./pages/RecursosHumanosSubPage"));

// Garantia global: depois de qualquer mutation com sucesso, invalida todas as
// queries activas. Evita ter de saltar de página para ver as alterações mesmo
// em ecrãs cuja mutation se esqueceu de chamar invalidateQueries explícito.
const mutationCache = new MutationCache({
  onSuccess: () => {
    queryClient.invalidateQueries();
  },
  onError: (error) => {
    // Silencia erros de cancelamento das confirmações destrutivas — não são bugs.
    if (isConfirmCancelled(error)) {
      return;
    }
  },
});

const queryClient = new QueryClient({
  mutationCache,
  defaultOptions: {
    queries: {
      // Cache resultados durante 30s antes de considerar stale
      staleTime: 30 * 1000,
      // Mantém em memória 5min após última utilização
      gcTime: 5 * 60 * 1000,
      // 1 retry em vez de 3 (failures são geralmente rede ou RLS, não vale a pena martelar)
      retry: 1,
      // Não refetch ao voltar à janela — evita re-renders pesados e perda de scroll.
      // Realtime/invalidate explícitos tratam de manter dados frescos.
      refetchOnWindowFocus: false,
      // Refetch ao reconectar mantém-se ligado (default: true)
    },
    mutations: {
      retry: 0,
    },
  },
});

const PageLoader = () => (
  <div className="flex min-h-screen items-center justify-center">
    <InlineLoader />
  </div>
);

function AppRoutes() {
  const { user, loading: authLoading } = useAuth();
  const { isSetupComplete, loading: settingsLoading } = useBusinessSettings();
  const { suspended, loading: suspensionLoading } = useSuspensionCheck();

  const routineBootRef = useRef(false);
  useEffect(() => {
    if (user && !routineBootRef.current) {
      routineBootRef.current = true;
      ensureYearRoutineTasks();
    }
  }, [user]);

  if (authLoading || settingsLoading || suspensionLoading) {
    return <PageLoader />;
  }

  if (!user) {
    return (
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/portal/:token" element={<PortalAuthPage />} />
          <Route path="/portal/:token/view" element={<PortalViewPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/unsubscribe" element={<EmailUnsubscribePage />} />
          <Route path="*" element={<AuthPage />} />
        </Routes>
      </Suspense>
    );
  }

  if (suspended) {
    return <SuspensionScreen />;
  }

  if (!isSetupComplete) {
    return (
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/portal/:token" element={<PortalAuthPage />} />
          <Route path="/portal/:token/view" element={<PortalViewPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/unsubscribe" element={<EmailUnsubscribePage />} />
          <Route path="*" element={<SetupPage />} />
        </Routes>
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<PageLoader />}>
      <RouteGuard>
      <Routes>
        <Route path="/portal/:token" element={<PortalAuthPage />} />
        <Route path="/portal/:token/view" element={<PortalViewPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/unsubscribe" element={<EmailUnsubscribePage />} />
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
        <Route path="/tarefas" element={<Navigate to="/hub/tarefas" replace />} />
        <Route path="/clientes/:id" element={<RedirectClienteId />} />
        <Route path="/comercial/crm" element={<Navigate to="/hub/comercial/crm" replace />} />
        <Route path="/financeiro/entradas" element={<Navigate to="/hub/financeiro/entradas" replace />} />
        <Route path="/hub/pessoas" element={<Navigate to="/hub-equipa" replace />} />
        {/* Legacy redirect — manter para compatibilidade com bookmarks externos. Não usar em novos links. */}
        <Route path="/executive/gestao-equipa" element={<Navigate to="/hub/recursos-humanos" replace />} />
        <Route path="/hub/marketing" element={<MarketingDashboard />} />
        <Route path="/hub/marketing/gestao-marca" element={<GestaoMarcaPage />} />
        <Route path="/hub/marketing/conteudos/:id" element={<ConteudoDetailPage />} />
        <Route path="/hub/marketing/canal/:channelId" element={<ChannelPage />} />
        <Route path="/hub/marketing/estrategia" element={<MarketingEstrategia />} />
        <Route path="/hub/marketing/estrategia/publico-alvo" element={<MarketingPublicoAlvo />} />
        <Route path="/hub/marketing/estrategia/canal/:channelId" element={<MarketingChannelStrategy />} />
        <Route path="/hub/marketing/processos-mkt" element={<MarketingProcessos />} />
        <Route path="/hub/marketing/recursos-mkt" element={<MarketingRecursos />} />
        <Route path="/hub/marketing/automacoes" element={<MarketingAutomacoes />} />
        <Route path="/hub/marketing/automacoes/:id" element={<MarketingAutomacaoDetail />} />
        <Route path="/hub/marketing/funis" element={<MarketingFunis />} />
        <Route path="/hub/marketing/funis/:id" element={<MarketingFunilDetail />} />
        <Route path="/hub/marketing/analise" element={<MarketingAnalisePage />} />
        <Route path="/hub/marketing/trafego-pago" element={<MarketingTrafegoPago />} />
        <Route path="/hub/marketing/trafego-pago/:id" element={<RedirectTrafegoPagoLegacy />} />
        <Route path="/hub/marketing/trafego-pago/report/:id" element={<TrafegoReportDetail />} />
        <Route path="/hub/marketing/trafego-pago/criativo/:id" element={<TrafegoCriativoDetail />} />
        <Route path="/hub/marketing/:pageKey" element={<MarketingSubPage />} />
        <Route path="/hub/comercial" element={<ComercialPage />} />
        <Route path="/hub/comercial/analise" element={<ComercialAnalisePage />} />
        <Route path="/hub/comercial/vendas/:id" element={<VendaDetailPage />} />
        <Route path="/hub/comercial/pipelines" element={<CrmPipelinesPage />} />
        <Route path="/hub/comercial/crm/:id" element={<LeadDetailPage />} />
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
        <Route path="/admin/diagnostics" element={<AdminDiagnosticsPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/executive" element={<ExecutiveDashboard />} />
        <Route path="/executive/planeamento" element={<ExecutivePlaneamento />} />
        <Route path="/executive/planeamento/estrategico" element={<ExecutivePlaneamentoEstrategico />} />
        <Route path="/executive/planeamento/tatico" element={<ExecutivePlaneamentoTatico />} />
        <Route path="/executive/planeamento/operacional" element={<ExecutivePlaneamentoOperacional />} />
        <Route path="/planeamento/dep/:area" element={<PlaneamentoDepartamento />} />
        <Route path="/executive/weekly-align" element={<ExecutiveWeeklyAlign />} />
        <Route path="/executive/business-plan" element={<ExecutiveBusinessPlan />} />
        <Route path="/executive/business-plan/:columnKey" element={<ExecutiveBusinessPlanBlock />} />
        <Route path="/executive/innovation" element={<ExecutiveInnovation />} />
        <Route path="/executive/productivity" element={<ExecutiveProductivity />} />
        <Route path="/executive/capacidade" element={<ExecutiveCapacidade />} />
        <Route path="/executive/analise-empresarial" element={<ExecutiveAnaliseEmpresarial />} />
        <Route path="/executive/recommendations" element={<ExecutiveRecommendations />} />
        <Route path="/executive/processos" element={<ExecutiveProcessos />} />
        <Route path="/executive/brain-dump" element={<ExecutiveBrainDump />} />
        <Route path="/executive/:section" element={<ExecutivePage />} />
        <Route path="/definicoes" element={<DefinicoesPage />} />
        <Route path="/ajuda" element={<AjudaPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      </RouteGuard>
    </Suspense>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <GlobalRealtimeProvider>
          <ImpersonationProvider>
            <BusinessSettingsProvider>
              <ActiveTimerProvider>
                <KpiSettingsProvider>
                  <AppTabsProvider>
                    <DialogsProvider>
                      <ImpersonationBanner />
                      <FloatingTimer />
                      <AppRoutes />
                    </DialogsProvider>
                  </AppTabsProvider>
                </KpiSettingsProvider>
              </ActiveTimerProvider>
            </BusinessSettingsProvider>
          </ImpersonationProvider>
          </GlobalRealtimeProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
