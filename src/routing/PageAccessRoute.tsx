import { Navigate } from 'react-router-dom';
import AppBootSkeleton from '@/components/AppBootSkeleton';
import { useAuth } from '@/contexts/AuthContext';
import { FEATURE_FLAGS } from '@/lib/featureFlags';
import { usePageAccess } from '@/hooks/usePageAccess';
import { useLogPageAccess } from '@/hooks/useLogPageAccess';
import type { UserRole } from '@/types/auth';
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
  fallbackRoles,
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

  if (FEATURE_FLAGS.USE_PAGE_GRANTS) {
    if (pageAccess.isLoading) return <AppBootSkeleton />;
    if (!pageAccess.data?.includes(pageSlug)) return <AccessDenied />;
    return <>{children}</>;
  }

  if (fallbackRoles && user?.role && fallbackRoles.includes(user.role)) {
    return <>{children}</>;
  }

  return <AccessDenied />;
}
