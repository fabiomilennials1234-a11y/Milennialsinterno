import { Navigate } from 'react-router-dom';
import AppBootSkeleton from '@/components/AppBootSkeleton';
import { useAuth } from '@/contexts/AuthContext';
import { usePageAccess } from '@/hooks/usePageAccess';
import { useLogPageAccess } from '@/hooks/useLogPageAccess';
import { getRolesWithPageSlug, type UserRole } from '@/types/auth';
import MainLayout from '@/layouts/MainLayout';

export function AccessDenied() {
  return (
    <MainLayout>
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-6">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-semibold text-foreground">Acesso restrito</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Seu usuário está autenticado, mas não possui permissão ativa para esta página.
          </p>
        </div>
      </div>
    </MainLayout>
  );
}

export function PageAccessRoute({
  children,
  pageSlug,
}: {
  children: React.ReactNode;
  pageSlug: string;
  fallbackRoles?: readonly UserRole[];
}) {
  const { isAuthenticated, isLoading, user, isAdminUser, isCEO } = useAuth();
  const pageAccess = usePageAccess();
  useLogPageAccess(isAuthenticated ? pageSlug : null);

  if (isLoading) return <AppBootSkeleton />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (isCEO || isAdminUser) return <>{children}</>;

  // Source of truth: user_page_grants via RPC get_my_page_access.
  if (pageAccess.isLoading) return <AppBootSkeleton />;
  if (pageAccess.data?.includes(pageSlug)) return <>{children}</>;

  // Defense-in-depth: if grants are missing or RPC errored, fall back to
  // ROLE_PAGE_MATRIX check. Prevents total lockout when user_page_grants
  // rows are absent (backfill gap, reconcile bug, or RPC failure).
  // Emits structured warning so divergence logger picks it up.
  if (user?.role) {
    const matrixRoles = getRolesWithPageSlug(pageSlug);
    if (matrixRoles.includes(user.role)) {
      console.warn('[PageAccessRoute] grant fallback activated', {
        userId: user.id,
        role: user.role,
        pageSlug,
        grantError: pageAccess.isError,
        grantData: pageAccess.data,
      });
      return <>{children}</>;
    }
  }

  return <AccessDenied />;
}
