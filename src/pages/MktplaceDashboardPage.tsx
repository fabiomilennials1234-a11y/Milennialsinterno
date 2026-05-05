import MainLayout from '@/layouts/MainLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { LayoutDashboard } from 'lucide-react';

export default function MktplaceDashboardPage() {
  const { isCEO, isAdminUser } = useAuth();

  if (!isCEO && !isAdminUser) {
    return <Navigate to="/" replace />;
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Consultoria de MKT Place</h1>
          <p className="text-muted-foreground">Dashboard do produto Gestão de MKT Place</p>
        </div>

        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <LayoutDashboard size={48} className="mb-4 opacity-30" />
          <p className="text-lg font-medium">Dashboard em construção</p>
          <p className="text-sm">Métricas e indicadores serão adicionados em breve.</p>
        </div>
      </div>
    </MainLayout>
  );
}
