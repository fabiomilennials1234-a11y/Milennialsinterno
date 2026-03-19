import MainLayout from '@/layouts/MainLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import DevsKanbanBoard from '@/components/devs/DevsKanbanBoard';
import { canViewBoard } from '@/types/auth';

export default function DevsPage() {
  const { user, isCEO, isAdminUser } = useAuth();

  const canAccess = user?.role && canViewBoard(user.role, 'devs');

  if (!canAccess && !isCEO && !isAdminUser) {
    return <Navigate to="/" replace />;
  }

  return (
    <MainLayout>
      <DevsKanbanBoard />
    </MainLayout>
  );
}
