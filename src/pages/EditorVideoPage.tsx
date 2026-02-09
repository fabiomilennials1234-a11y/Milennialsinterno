import MainLayout from '@/layouts/MainLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { canViewVideoBoard } from '@/hooks/useVideoKanban';
import VideoKanbanBoard from '@/components/video/VideoKanbanBoard';

export default function EditorVideoPage() {
  const { user, isCEO, isAdminUser } = useAuth();

  // Check if user can access this page
  const canAccess = canViewVideoBoard(user?.role || null) || isCEO || isAdminUser;
  
  if (!canAccess) {
    return <Navigate to="/" replace />;
  }

  return (
    <MainLayout>
      <div className="h-full flex flex-col overflow-hidden bg-background">
        <div className="px-8 py-6 border-b border-subtle shrink-0">
          <h1 className="text-display text-foreground">
            Editor de Vídeo PRO+
          </h1>
          <p className="text-caption text-muted-foreground mt-1">
            Kanban de demandas de edição de vídeo
          </p>
        </div>

        <div className="flex-1 overflow-hidden px-8 py-6">
          <VideoKanbanBoard />
        </div>
      </div>
    </MainLayout>
  );
}
