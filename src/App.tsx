import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { BusinessSettingsProvider, useBusinessSettings } from "@/hooks/useBusinessSettings";
import { AuthPage } from "@/components/AuthPage";
import { SetupPage } from "@/components/SetupPage";
import NotFound from "./pages/NotFound";
import SecretariaPage from "./pages/Secretaria";
import ComecaAquiPage from "./pages/ComecaAqui";
import HubPage from "./pages/Hub";
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
      <Route path="/hub/:module" element={<HubPage />} />
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
            <AppRoutes />
          </BusinessSettingsProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
