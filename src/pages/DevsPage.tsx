import MainLayout from '@/layouts/MainLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import DevsKanbanBoard from '@/components/devs/DevsKanbanBoard';

export default function DevsPage() {
  const { user, isCEO, isAdminUser } = useAuth();

  const allowedRoles = ['devs', 'gestor_projetos', 'ceo'];
  const canAccess = user?.role && allowedRoles.includes(user.role);
  
  if (!canAccess && !isCEO && !isAdminUser) {
    return <Navigate to="/" replace />;
  }

  return (
    <MainLayout>
      <DevsKanbanBoard />
    </MainLayout>
  );
}
