import { useState } from 'react';
import MainLayout from '@/layouts/MainLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { canViewProdutoraBoard } from '@/hooks/useProdutoraKanban';
import ProdutoraKanbanBoard from '@/components/produtora/ProdutoraKanbanBoard';
import DepartmentTarefasSection from '@/components/department/DepartmentTarefasSection';
import { CheckSquare, ChevronRight, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ManualCondutaBanner from '@/components/shared/ManualCondutaBanner';

export default function ProdutoraPage() {
  const { user, isCEO, isAdminUser } = useAuth();
  const [showTarefas, setShowTarefas] = useState(false);

  // Check if user can access this page
  const canAccess = canViewProdutoraBoard(user?.role || null) || isCEO || isAdminUser;

  if (!canAccess) {
    return <Navigate to="/" replace />;
  }

  return (
    <MainLayout>
      <div className="flex flex-col bg-background">
        <div className="px-8 py-6 border-b border-subtle shrink-0 sticky top-0 z-20 bg-background">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-display text-foreground">
                Produtora
              </h1>
              <p className="text-caption text-muted-foreground mt-1">
                Kanban de demandas de gravacao
              </p>
              <ManualCondutaBanner />
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => setShowTarefas(!showTarefas)}
            >
              <CheckSquare size={14} />
              Tarefas Recorrentes
              {showTarefas ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
            </Button>
          </div>
        </div>

        <div className="flex-1 flex">
          <div className="flex-1 px-8 py-6">
            <ProdutoraKanbanBoard />
          </div>

          {showTarefas && (
            <div className="w-[340px] flex-shrink-0 border-l border-subtle overflow-y-auto p-4 bg-card scrollbar-apple">
              <div className="section-header section-header-green rounded-xl mb-4">
                <div className="flex items-center gap-3">
                  <CheckSquare size={18} className="text-white" />
                  <h2 className="font-semibold text-sm">Tarefas Recorrentes</h2>
                </div>
              </div>
              <DepartmentTarefasSection department="produtora" type="daily" />
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
