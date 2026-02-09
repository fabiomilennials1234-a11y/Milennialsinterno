import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";

// Pages
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import CEODashboardPage from "./pages/CEODashboardPage";
import MillennialsGrowthDashPage from "./pages/MillennialsGrowthDashPage";
import ProductDashboardPage from "./pages/ProductDashboardPage";
import KanbanPage from "./pages/KanbanPage";
import AdsManagerPage from "./pages/AdsManagerPage";
import AdsManagerIndividualPage from "./pages/AdsManagerIndividualPage";
import SucessoClientePage from "./pages/SucessoClientePage";
import ConsultorComercialPage from "./pages/ConsultorComercialPage";
import FinanceiroPage from "./pages/FinanceiroPage";
import FinanceiroDashboardPage from "./pages/FinanceiroDashboardPage";
import GestorProjetosPage from "./pages/GestorProjetosPage";
import GestorCRMPage from "./pages/GestorCRMPage";
import DesignPage from "./pages/DesignPage";
import EditorVideoPage from "./pages/EditorVideoPage";
import AtrizesGravacaoPage from "./pages/AtrizesGravacaoPage";
import DevsPage from "./pages/DevsPage";
import RHPage from "./pages/RHPage";
import RHJornadaEquipePage from "./pages/RHJornadaEquipePage";
import UsersPage from "./pages/admin/UsersPage";
import GroupsPage from "./pages/admin/GroupsPage";
import ClientRegistrationPage from "./pages/ClientRegistrationPage";
import ClientListPage from "./pages/ClientListPage";
import PublicStrategyPage from "./pages/PublicStrategyPage";
import PublicNPSPage from "./pages/PublicNPSPage";
import PublicExitFormPage from "./pages/PublicExitFormPage";
import UpsellsPage from "./pages/UpsellsPage";
import ComissoesPage from "./pages/ComissoesPage";
import DashGestoresPage from "./pages/DashGestoresPage";
import TVDashboardPage from "./pages/TVDashboardPage";
import TreinamentosPage from "./pages/TreinamentosPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// Protected Route Component
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
}

// Admin Only Route (CEO only)
function CEORoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuth();
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  if (user?.role !== 'ceo') {
    return <Navigate to="/dashboard" replace />;
  }
  
  return <>{children}</>;
}

// Admin Route (CEO and Gestor de Projetos)
function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isAdminUser } = useAuth();
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  if (!isAdminUser) {
    return <Navigate to="/" replace />;
  }
  
  return <>{children}</>;
}

// Manager Route (CEO, Gestor de Projetos e Sucesso do Cliente)
function ManagerRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, canManageUsersFlag } = useAuth();
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  if (!canManageUsersFlag) {
    return <Navigate to="/" replace />;
  }
  
  return <>{children}</>;
}

// Public Route Component (redirect if authenticated)
function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return <>{children}</>;
}

// Redirect to first available tab based on role
function DefaultRedirect() {
  const { user, isAdminUser, isCEO, canViewTabById } = useAuth();
  
  // CEO vai para visão estratégica
  if (isCEO) {
    return <Navigate to="/ceo" replace />;
  }
  
  // Gestor de Projetos vai para o Dashboard
  if (isAdminUser) {
    return <Navigate to="/dashboard" replace />;
  }
  
  // Outros cargos vão para sua primeira aba autorizada
  const tabPriority = [
    { id: 'design', path: '/kanban/design' },
    { id: 'editor_video', path: '/kanban/editor-video' },
    { id: 'devs', path: '/kanban/devs' },
    { id: 'atrizes_gravacao', path: '/kanban/atrizes' },
    { id: 'produtora', path: '/kanban/produtora' },
    { id: 'gestor_crm', path: '/kanban/crm' },
    { id: 'consultor_comercial', path: '/kanban/comercial' },
    { id: 'gestor_ads', path: '/kanban/ads' },
    { id: 'sucesso_cliente', path: '/kanban/sucesso' },
    { id: 'financeiro', path: '/financeiro' },
    { id: 'rh', path: '/kanban/rh' },
  ];
  
  for (const tab of tabPriority) {
    if (canViewTabById(tab.id)) {
      return <Navigate to={tab.path} replace />;
    }
  }
  
  return <Navigate to="/login" replace />;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={
        <PublicRoute>
          <LoginPage />
        </PublicRoute>
      } />
      
      {/* CEO Strategic Dashboard */}
      <Route path="/ceo" element={
        <CEORoute>
          <CEODashboardPage />
        </CEORoute>
      } />
      
      {/* Millennials Growth Dashboard - CEO and Gestor de Projetos */}
      <Route path="/millennials-growth" element={
        <AdminRoute>
          <MillennialsGrowthDashPage />
        </AdminRoute>
      } />
      
      {/* Generic Product Dashboard - CEO and Gestor de Projetos */}
      <Route path="/produto/:productSlug" element={
        <AdminRoute>
          <ProductDashboardPage />
        </AdminRoute>
      } />
      
      {/* OKRs Millennials - Dashboard para TV */}
      <Route path="/okrs-millennials" element={
        <ProtectedRoute>
          <DashGestoresPage />
        </ProtectedRoute>
      } />
      
      {/* TV Dashboard - Dashboard visual para TV */}
      <Route path="/tv-dashboard" element={
        <ProtectedRoute>
          <TVDashboardPage />
        </ProtectedRoute>
      } />
      
      {/* Treinamentos Page */}
      <Route path="/treinamentos" element={
        <ProtectedRoute>
          <TreinamentosPage />
        </ProtectedRoute>
      } />
      
      {/* Redirect old route */}
      <Route path="/dash-gestores" element={<Navigate to="/okrs-millennials" replace />} />
      
      {/* Dashboard - CEO e Gestor de Projetos */}
      <Route path="/dashboard" element={
        <ProtectedRoute>
          <DashboardPage />
        </ProtectedRoute>
      } />
      
      {/* RH Kanban Board Routes (must be before generic /kanban/:boardId) */}
      <Route path="/kanban/rh" element={<Navigate to="/rh" replace />} />
      <Route path="/kanban/rh-board" element={<Navigate to="/rh" replace />} />
      
      {/* Kanban Routes */}
      <Route path="/kanban/:boardId" element={
        <ProtectedRoute>
          <KanbanPage />
        </ProtectedRoute>
      } />
      
      {/* Ads Manager Route - Generic */}
      <Route path="/gestor-ads" element={
        <ProtectedRoute>
          <AdsManagerPage />
        </ProtectedRoute>
      } />
      
      {/* Ads Manager Route - Individual by user ID */}
      <Route path="/gestor-ads/:userId" element={
        <ProtectedRoute>
          <AdsManagerIndividualPage />
        </ProtectedRoute>
      } />
      
      {/* Sucesso do Cliente Route */}
      <Route path="/sucesso-cliente" element={
        <ProtectedRoute>
          <SucessoClientePage />
        </ProtectedRoute>
      } />
      
      {/* Consultor Comercial Route */}
      <Route path="/consultor-comercial" element={
        <ProtectedRoute>
          <ConsultorComercialPage />
        </ProtectedRoute>
      } />
      
      {/* Financeiro Route */}
      <Route path="/financeiro" element={
        <ProtectedRoute>
          <FinanceiroPage />
        </ProtectedRoute>
      } />
      
      {/* Financeiro Dashboard Route */}
      <Route path="/financeiro-dashboard" element={
        <ProtectedRoute>
          <FinanceiroDashboardPage />
        </ProtectedRoute>
      } />
      
      {/* Redirect old kanban financeiro routes to new page */}
      <Route path="/kanban/financeiro" element={<Navigate to="/financeiro" replace />} />
      <Route path="/kanban/financeiro-board" element={<Navigate to="/financeiro" replace />} />
      
      {/* Gestor de Projetos Route */}
      <Route path="/gestor-projetos" element={
        <ProtectedRoute>
          <GestorProjetosPage />
        </ProtectedRoute>
      } />
      
      {/* Gestor de CRM Route */}
      <Route path="/gestor-crm" element={
        <ProtectedRoute>
          <GestorCRMPage />
        </ProtectedRoute>
      } />
      
      {/* Design Route */}
      <Route path="/design" element={
        <ProtectedRoute>
          <DesignPage />
        </ProtectedRoute>
      } />
      
      {/* Editor de Vídeo Route */}
      <Route path="/editor-video" element={
        <ProtectedRoute>
          <EditorVideoPage />
        </ProtectedRoute>
      } />
      
      {/* Atrizes de Gravação Route */}
      <Route path="/atrizes-gravacao" element={
        <ProtectedRoute>
          <AtrizesGravacaoPage />
        </ProtectedRoute>
      } />
      
      {/* Desenvolvedor Route */}
      <Route path="/devs" element={
        <ProtectedRoute>
          <DevsPage />
        </ProtectedRoute>
      } />
      
      {/* RH Routes */}
      <Route path="/rh" element={
        <ProtectedRoute>
          <RHPage />
        </ProtectedRoute>
      } />
      <Route path="/rh/contratacao" element={
        <ProtectedRoute>
          <RHPage />
        </ProtectedRoute>
      } />
      <Route path="/rh/jornada-equipe" element={
        <ProtectedRoute>
          <RHJornadaEquipePage />
        </ProtectedRoute>
      } />
      
      {/* UP Sells Route - CS, CEO and Gestor de Projetos */}
      <Route path="/upsells" element={
        <ProtectedRoute>
          <UpsellsPage />
        </ProtectedRoute>
      } />
      
      {/* Comissões Route - Financeiro and Admins */}
      <Route path="/comissoes" element={
        <ProtectedRoute>
          <ComissoesPage />
        </ProtectedRoute>
      } />
      
      {/* Client Registration Route - CEO, Gestor de Projetos e Sucesso do Cliente */}
      <Route path="/cadastro-clientes" element={
        <ManagerRoute>
          <ClientRegistrationPage />
        </ManagerRoute>
      } />
      
      {/* Client List Route - accessible to authorized roles */}
      <Route path="/lista-clientes" element={
        <ProtectedRoute>
          <ClientListPage />
        </ProtectedRoute>
      } />
      
      {/* Product-specific Client List Route */}
      <Route path="/clientes/:productSlug" element={
        <ProtectedRoute>
          <ClientListPage />
        </ProtectedRoute>
      } />
      
      {/* Admin Routes - CEO, Gestor de Projetos e Sucesso do Cliente para usuários */}
      <Route path="/admin/usuarios" element={
        <ManagerRoute>
          <UsersPage />
        </ManagerRoute>
      } />
      
      <Route path="/admin/configuracoes" element={
        <AdminRoute>
          <UsersPage />
        </AdminRoute>
      } />
      
      <Route path="/admin/grupos" element={
        <AdminRoute>
          <GroupsPage />
        </AdminRoute>
      } />
      
      {/* Public Strategy Page - accessible without authentication */}
      <Route path="/estrategia/:token" element={<PublicStrategyPage />} />
      
      {/* Public NPS Page - accessible without authentication */}
      <Route path="/nps/:token" element={<PublicNPSPage />} />
      
      {/* Public Exit Form Page - accessible without authentication */}
      <Route path="/saida/:token" element={<PublicExitFormPage />} />
      
      {/* Default Redirect baseado no cargo */}
      <Route path="/" element={
        <ProtectedRoute>
          <DefaultRedirect />
        </ProtectedRoute>
      } />
      
      {/* 404 */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
