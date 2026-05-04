import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { isExecutive } from "@/types/auth";
import { getRouteGuardRoles } from "@/lib/routeAuth";
import { resolveKanbanRedirect } from "@/routing/kanbanRedirect";
import { AccessDenied, PageAccessRoute } from "@/routing/PageAccessRoute";
import { usePageAccess } from "@/hooks/usePageAccess";
import { resolveKanbanPageSlug } from "@/lib/kanbanOperationalAccess";
import { JustificationProvider } from "@/contexts/JustificationContext";
import { usePermissionDivergenceLogger } from "@/hooks/usePermissionDivergenceLogger";
import { useCrmDelayJustifications } from "@/hooks/useCrmDelayJustifications";
import { useClientTagDelayJustifications } from "@/hooks/useClientTagDelayJustifications";
import AppBootSkeleton from "@/components/AppBootSkeleton";
import MainLayout from "@/layouts/MainLayout";

// Pages — lazy para code-splitting por rota.
// LoginPage e NotFound ficam eager: uma é sempre o destino de redirect,
// a outra é fallback garantido.
import LoginPage from "./pages/LoginPage";
import NotFound from "./pages/NotFound";

const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const CEODashboardPage = lazy(() => import("./pages/CEODashboardPage"));
const MillennialsGrowthDashPage = lazy(() => import("./pages/MillennialsGrowthDashPage"));
const ProductDashboardPage = lazy(() => import("./pages/ProductDashboardPage"));
const KanbanPage = lazy(() => import("./pages/KanbanPage"));
const AdsManagerPage = lazy(() => import("./pages/AdsManagerPage"));
const AdsManagerIndividualPage = lazy(() => import("./pages/AdsManagerIndividualPage"));
const OutboundManagerPage = lazy(() => import("./pages/OutboundManagerPage"));
const OutboundManagerIndividualPage = lazy(() => import("./pages/OutboundManagerIndividualPage"));
const OutboundDashboardPage = lazy(() => import("./pages/OutboundDashboardPage"));
const SucessoClientePage = lazy(() => import("./pages/SucessoClientePage"));
const ConsultorComercialPage = lazy(() => import("./pages/ConsultorComercialPage"));
const ConsultorMKTPlacePage = lazy(() => import("./pages/ConsultorMKTPlacePage"));
const MktplaceDashboardPage = lazy(() => import("./pages/MktplaceDashboardPage"));
const FinanceiroPage = lazy(() => import("./pages/FinanceiroPage"));
const FinanceiroDashboardPage = lazy(() => import("./pages/FinanceiroDashboardPage"));
const GestorProjetosPage = lazy(() => import("./pages/GestorProjetosPage"));
const GestorCRMPage = lazy(() => import("./pages/GestorCRMPage"));
const DesignPage = lazy(() => import("./pages/DesignPage"));
const EditorVideoPage = lazy(() => import("./pages/EditorVideoPage"));
const DevsPage = lazy(() => import("./pages/DevsPage"));
const UsersPage = lazy(() => import("./pages/admin/UsersPage"));
const GroupsPage = lazy(() => import("./pages/admin/GroupsPage"));
const AuditoriaPage = lazy(() => import("./pages/admin/AuditoriaPage"));
const ClientRegistrationPage = lazy(() => import("./pages/ClientRegistrationPage"));
const ClientListPage = lazy(() => import("./pages/ClientListPage"));
const PublicStrategyPage = lazy(() => import("./pages/PublicStrategyPage"));
const PublicOutboundStrategyPage = lazy(() => import("./pages/PublicOutboundStrategyPage"));
const PublicNPSPage = lazy(() => import("./pages/PublicNPSPage"));
const PublicExitFormPage = lazy(() => import("./pages/PublicExitFormPage"));
const PublicResultsReportPage = lazy(() => import("./pages/PublicResultsReportPage"));
const PublicDiagnosticoPage = lazy(() => import("./pages/PublicDiagnosticoPage"));
const PublicPaddockDiagnosticoPage = lazy(() => import("./pages/PublicPaddockDiagnosticoPage"));
const WarRoom2Page = lazy(() => import("./pages/WarRoom2Page"));
const WarRoom3Page = lazy(() => import("./pages/WarRoom3Page"));
const UpsellsPage = lazy(() => import("./pages/UpsellsPage"));
const ComissoesPage = lazy(() => import("./pages/ComissoesPage"));
const ProvasSociaisPage = lazy(() => import("./pages/ProvasSociaisPage"));
const DashGestoresPage = lazy(() => import("./pages/DashGestoresPage"));
const TVDashboardPage = lazy(() => import("./pages/TVDashboardPage"));
const TreinamentosPage = lazy(() => import("./pages/TreinamentosPage"));
const JustificativasPage = lazy(() => import("./pages/Justificativas"));
const RecordedMeetingsPage = lazy(() => import("./pages/RecordedMeetingsPage"));
const MilennialsTechPage = lazy(() => import("./features/milennials-tech/pages/MilennialsTechPage").then(m => ({ default: m.MilennialsTechPage })));
const BacklogTab = lazy(() => import("./features/milennials-tech/pages/BacklogTab").then(m => ({ default: m.BacklogTab })));
const KanbanTab = lazy(() => import("./features/milennials-tech/pages/KanbanTab").then(m => ({ default: m.KanbanTab })));
const SprintsTab = lazy(() => import("./features/milennials-tech/pages/SprintsTab").then(m => ({ default: m.SprintsTab })));
const SubmitTaskPage = lazy(() => import("./features/milennials-tech/pages/SubmitTaskPage").then(m => ({ default: m.SubmitTaskPage })));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});

// Protected Route Component
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <AppBootSkeleton />;

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function ExecutiveRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) return <AppBootSkeleton />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!isExecutive(user?.role)) return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
}

function MilennialsTechRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) return <AppBootSkeleton />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!(isExecutive(user?.role) || user?.role === 'devs' || user?.can_access_mtech)) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}

// Admin Route (CEO and Gestor de Projetos)
function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, isAdminUser } = useAuth();

  if (isLoading) return <AppBootSkeleton />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!isAdminUser) return <AccessDenied />;

  return <>{children}</>;
}

// Manager Route (CEO, Gestor de Projetos e Sucesso do Cliente)
function ManagerRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, canManageUsersFlag } = useAuth();

  if (isLoading) return <AppBootSkeleton />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!canManageUsersFlag) return <AccessDenied />;

  return <>{children}</>;
}

// Public Route Component (redirect if authenticated)
function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  // Espera hidratação antes de decidir — evita piscar o login quando há
  // sessão persistida no localStorage.
  if (isLoading) return <AppBootSkeleton />;
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
}

// Kanban route wrapper. Board `comercial` é único global; scope de cards via RLS
// por client.group_id (decisão Opus B, migration 20260423120000). Role
// `consultor_comercial` tem hub próprio em `/consultor-comercial` — redirecionamos
// pra evitar que caia no board legacy. Mesmo padrão de `/kanban/rh → /rh`.
function KanbanRoute() {
  const { boardId } = useParams<{ boardId: string }>();
  const { user, isAdminUser, isCEO } = useAuth();
  const pageAccess = usePageAccess();

  const redirectTo = resolveKanbanRedirect(boardId, user?.role);
  if (redirectTo) return <Navigate to={redirectTo} replace />;

  const pageSlug = resolveKanbanPageSlug(boardId);
  if (pageSlug && !isCEO && !isAdminUser) {
    if (pageAccess.isLoading) return <AppBootSkeleton />;
    if (!pageAccess.data?.includes(pageSlug)) return <AccessDenied />;
  }

  return <KanbanPage />;
}

// Redirect based on user's own role (não iterar permissões herdadas — isso
// fazia gestor_ads/outbound/sucesso_cliente aterrissarem em /kanban/design
// porque BOARD_VISIBILITY deles inclui 'design' antes do próprio papel).
function DefaultRedirect() {
  const { user, isAdminUser, isCEO } = useAuth();

  // CEO vai para visão estratégica
  if (isCEO) {
    return <Navigate to="/ceo" replace />;
  }

  // Gestor de Projetos vai para o Dashboard
  if (isAdminUser) {
    return <Navigate to="/dashboard" replace />;
  }

  // Demais cargos: match EXATO pelo próprio role.
  const tabPriority = [
    { id: 'design', path: '/kanban/design' },
    { id: 'editor_video', path: '/kanban/editor-video' },
    { id: 'devs', path: '/kanban/devs' },
    { id: 'produtora', path: '/kanban/produtora' },
    { id: 'gestor_crm', path: '/kanban/crm' },
    { id: 'consultor_comercial', path: '/consultor-comercial' },
    { id: 'consultor_mktplace', path: '/consultor-mktplace' },
    { id: 'gestor_ads', path: '/gestor-ads' },
    { id: 'outbound', path: '/millennials-outbound' },
    { id: 'sucesso_cliente', path: '/kanban/sucesso' },
    { id: 'financeiro', path: '/financeiro' },
  ];

  for (const tab of tabPriority) {
    if (user?.role === tab.id) {
      return <Navigate to={tab.path} replace />;
    }
  }

  return <Navigate to="/login" replace />;
}

function AppRoutes() {
  // Shadow comparator: loga divergências entre o modelo legado de permissões
  // e o novo user_page_grants. Observacional — não altera UI. Ver
  // usePermissionDivergenceLogger para detalhes.
  usePermissionDivergenceLogger();

  // Auto-trigger do modal bloqueante de justificativa coletiva CRM:
  // sempre que houver pending da tabela crm_delay_justification_pending para o
  // user logado, dispara o modal via JustificationContext (já globalmente montado).
  useCrmDelayJustifications();

  // Auto-trigger análogo para etiquetas (client_tags) vencidas onde o user
  // logado é responsável (gestor_ads / sucesso_cliente).
  useClientTagDelayJustifications();

  return (
    <Suspense fallback={<AppBootSkeleton />}>
      <Routes>
      {/* Public Routes */}
      <Route path="/login" element={
        <PublicRoute>
          <LoginPage />
        </PublicRoute>
      } />
      
      {/* CEO Strategic Dashboard */}
      <Route path="/ceo" element={
        <ExecutiveRoute>
          <CEODashboardPage />
        </ExecutiveRoute>
      } />
      
      {/* Millennials Growth Dashboard - CEO and Gestor de Projetos */}
      <Route path="/millennials-growth" element={
        <AdminRoute>
          <MillennialsGrowthDashPage />
        </AdminRoute>
      } />
      
      {/* Outbound Dashboard - dedicated */}
      <Route path="/outbound-dashboard" element={
        <PageAccessRoute pageSlug="outbound" fallbackRoles={getRouteGuardRoles('/outbound-dashboard')}>
          <OutboundDashboardPage />
        </PageAccessRoute>
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

      {/* Justificativas Page - All authenticated users */}
      <Route path="/justificativas" element={
        <ProtectedRoute>
          <MainLayout>
            <JustificativasPage />
          </MainLayout>
        </ProtectedRoute>
      } />

      {/* Reuniões Gravadas Page */}
      <Route path="/reunioes-gravadas" element={
        <ProtectedRoute>
          <RecordedMeetingsPage />
        </ProtectedRoute>
      } />
      
      {/* Redirect old route */}
      <Route path="/dash-gestores" element={<Navigate to="/okrs-millennials" replace />} />
      
      {/* Dashboard - CEO e Gestor de Projetos */}
      <Route path="/dashboard" element={
        <AdminRoute>
          <DashboardPage />
        </AdminRoute>
      } />
      
      {/* Redirect outbound kanban route to PRO+ page */}
      <Route path="/kanban/millennials-outbound" element={<Navigate to="/millennials-outbound" replace />} />
      
      {/* Kanban Routes */}
      <Route path="/kanban/:boardId" element={
        <ProtectedRoute>
          <KanbanRoute />
        </ProtectedRoute>
      } />
      
      {/* Ads Manager Route - Generic */}
      <Route path="/gestor-ads" element={
        <PageAccessRoute pageSlug="gestor-ads" fallbackRoles={getRouteGuardRoles('/gestor-ads')}>
          <AdsManagerPage />
        </PageAccessRoute>
      } />

      {/* Ads Manager Route - Individual by user ID */}
      <Route path="/gestor-ads/:userId" element={
        <PageAccessRoute pageSlug="gestor-ads" fallbackRoles={getRouteGuardRoles('/gestor-ads')}>
          <AdsManagerIndividualPage />
        </PageAccessRoute>
      } />

      {/* Outbound Manager Route - Generic */}
      <Route path="/millennials-outbound" element={
        <PageAccessRoute pageSlug="outbound" fallbackRoles={getRouteGuardRoles('/millennials-outbound')}>
          <OutboundManagerPage />
        </PageAccessRoute>
      } />

      {/* Outbound Manager Route - Individual by user ID */}
      <Route path="/millennials-outbound/:userId" element={
        <PageAccessRoute pageSlug="outbound" fallbackRoles={getRouteGuardRoles('/millennials-outbound')}>
          <OutboundManagerIndividualPage />
        </PageAccessRoute>
      } />

      {/* Sucesso do Cliente Route */}
      <Route path="/sucesso-cliente" element={
        <PageAccessRoute pageSlug="sucesso-cliente" fallbackRoles={getRouteGuardRoles('/sucesso-cliente')}>
          <SucessoClientePage />
        </PageAccessRoute>
      } />

      {/* Consultor Comercial Route */}
      <Route path="/consultor-comercial" element={
        <PageAccessRoute pageSlug="consultor-comercial" fallbackRoles={getRouteGuardRoles('/consultor-comercial')}>
          <ConsultorComercialPage />
        </PageAccessRoute>
      } />
      
      {/* Consultoria de MKT Place - Dashboard */}
      <Route path="/mktplace-dashboard" element={
        <AdminRoute>
          <MktplaceDashboardPage />
        </AdminRoute>
      } />

      {/* Consultor MKT Place Route */}
      <Route path="/consultor-mktplace" element={
        <PageAccessRoute pageSlug="consultor-mktplace" fallbackRoles={getRouteGuardRoles('/consultor-mktplace')}>
          <ConsultorMKTPlacePage />
        </PageAccessRoute>
      } />

      {/* Financeiro Route */}
      <Route path="/financeiro" element={
        <PageAccessRoute pageSlug="financeiro" fallbackRoles={getRouteGuardRoles('/financeiro')}>
          <FinanceiroPage />
        </PageAccessRoute>
      } />
      
      {/* Financeiro Dashboard Route */}
      <Route path="/financeiro-dashboard" element={
        <PageAccessRoute pageSlug="financeiro" fallbackRoles={getRouteGuardRoles('/financeiro')}>
          <FinanceiroDashboardPage />
        </PageAccessRoute>
      } />
      
      {/* Redirect old kanban financeiro routes to new page */}
      <Route path="/kanban/financeiro" element={<Navigate to="/financeiro" replace />} />
      <Route path="/kanban/financeiro-board" element={<Navigate to="/financeiro" replace />} />
      
      {/* Gestor de Projetos Route */}
      <Route path="/gestor-projetos" element={
        <AdminRoute>
          <GestorProjetosPage />
        </AdminRoute>
      } />
      
      {/* Gestor de CRM Route */}
      <Route path="/gestor-crm" element={
        <PageAccessRoute pageSlug="gestor-crm" fallbackRoles={getRouteGuardRoles('/gestor-crm')}>
          <GestorCRMPage />
        </PageAccessRoute>
      } />
      <Route path="/gestor-crm/:userId" element={
        <PageAccessRoute pageSlug="gestor-crm" fallbackRoles={getRouteGuardRoles('/gestor-crm')}>
          <GestorCRMPage />
        </PageAccessRoute>
      } />

      {/* Design Route */}
      <Route path="/design" element={
        <PageAccessRoute pageSlug="design" fallbackRoles={getRouteGuardRoles('/design')}>
          <DesignPage />
        </PageAccessRoute>
      } />
      
      {/* Editor de Vídeo Route */}
      <Route path="/editor-video" element={
        <PageAccessRoute pageSlug="editor-video" fallbackRoles={getRouteGuardRoles('/editor-video')}>
          <EditorVideoPage />
        </PageAccessRoute>
      } />
      
      {/* Desenvolvedor Route */}
      <Route path="/devs" element={
        <PageAccessRoute pageSlug="devs" fallbackRoles={getRouteGuardRoles('/devs')}>
          <DevsPage />
        </PageAccessRoute>
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

      {/* Provas Sociais Route */}
      <Route path="/provas-sociais" element={
        <ProtectedRoute>
          <ProvasSociaisPage />
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

      <Route path="/admin/auditoria" element={
        <AdminRoute>
          <AuditoriaPage />
        </AdminRoute>
      } />
      
      {/* Public Strategy Page - accessible without authentication */}
      <Route path="/estrategia/:token" element={<PublicStrategyPage />} />
      <Route path="/estrategia-outbound/:token" element={<PublicOutboundStrategyPage />} />
      
      {/* Public NPS Page - accessible without authentication */}
      <Route path="/nps/:token" element={<PublicNPSPage />} />
      
      {/* Public Exit Form Page - accessible without authentication */}
      <Route path="/saida/:token" element={<PublicExitFormPage />} />

      {/* Public Results Report Page - accessible without authentication */}
      <Route path="/resultados/:token" element={<PublicResultsReportPage />} />

      {/* Public MKT Place Diagnostic Page - accessible without authentication */}
      <Route path="/diagnostico-mktplace/:token" element={<PublicDiagnosticoPage />} />

      {/* Public Paddock Diagnostic Page - accessible without authentication */}
      <Route path="/diagnostico-paddock/:token" element={<PublicPaddockDiagnosticoPage />} />

      {/* War Room pages - accessible without authentication */}
      <Route path="/war-room-2" element={<WarRoom2Page />} />
      <Route path="/war-room-3" element={<WarRoom3Page />} />

      {/* Default Redirect baseado no cargo */}
      <Route path="/" element={
        <ProtectedRoute>
          <DefaultRedirect />
        </ProtectedRoute>
      } />
      
      {/* Milennials Tech */}
      <Route path="/milennials-tech" element={
        <MilennialsTechRoute><MilennialsTechPage /></MilennialsTechRoute>
      }>
        <Route index element={<Navigate to="kanban" replace />} />
        <Route path="backlog" element={<BacklogTab />} />
        <Route path="kanban" element={<KanbanTab />} />
        <Route path="sprints" element={<SprintsTab />} />
      </Route>

      {/* Submit Task — shared form (any logged-in user) */}
      <Route path="/submit-task" element={
        <ProtectedRoute><SubmitTaskPage /></ProtectedRoute>
      } />

      {/* 404 */}
      <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <JustificationProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </JustificationProvider>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
