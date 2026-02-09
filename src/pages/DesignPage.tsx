import { useEffect } from 'react';
import MainLayout from '@/layouts/MainLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import DesignKanbanBoard from '@/components/design/DesignKanbanBoard';

export default function DesignPage() {
  const { user, isCEO, isAdminUser } = useAuth();

  const allowedRoles = ['design', 'gestor_projetos', 'ceo', 'gestor_ads'];
  const canAccess = user?.role && allowedRoles.includes(user.role);

  // Empty useEffect to satisfy hook order (if needed for future)
  useEffect(() => {}, []);

  if (!canAccess && !isCEO && !isAdminUser) {
    return <Navigate to="/" replace />;
  }

  return (
    <MainLayout>
      <div className="h-full flex flex-col overflow-hidden bg-background">
        <div className="px-8 py-6 border-b border-subtle shrink-0">
          <h1 className="text-display text-foreground">
            Design PRO+
          </h1>
          <p className="text-caption text-muted-foreground mt-1">
            Kanban de demandas de design
          </p>
        </div>

        <div className="flex-1 overflow-hidden p-6">
          <DesignKanbanBoard />
        </div>
      </div>
    </MainLayout>
  );
}
