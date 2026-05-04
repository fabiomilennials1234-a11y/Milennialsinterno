import { useState } from 'react';
import MainLayout from '@/layouts/MainLayout';
import DesignKanbanBoard from '@/components/design/DesignKanbanBoard';
import DepartmentTarefasSection from '@/components/department/DepartmentTarefasSection';
import { CheckSquare, ChevronRight, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function DesignPage() {
  const [showTarefas, setShowTarefas] = useState(false);

  return (
    <MainLayout>
      <div className="h-full flex flex-col overflow-hidden bg-background">
        <div className="px-8 py-6 border-b border-subtle shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-display text-foreground">
                Design PRO+
              </h1>
              <p className="text-caption text-muted-foreground mt-1">
                Kanban de demandas de design
              </p>
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

        <div className="flex-1 overflow-hidden flex">
          <div className="flex-1 overflow-hidden p-6">
            <DesignKanbanBoard />
          </div>

          {showTarefas && (
            <div className="w-[340px] flex-shrink-0 border-l border-subtle overflow-y-auto p-4 bg-card scrollbar-apple">
              <div className="section-header section-header-green rounded-xl mb-4">
                <div className="flex items-center gap-3">
                  <CheckSquare size={18} className="text-white" />
                  <h2 className="font-semibold text-sm">Tarefas Recorrentes</h2>
                </div>
              </div>
              <DepartmentTarefasSection department="design" type="daily" />
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
