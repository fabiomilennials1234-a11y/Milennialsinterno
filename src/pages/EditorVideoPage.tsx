import { useState } from 'react';
import MainLayout from '@/layouts/MainLayout';
import VideoKanbanBoard from '@/components/video/VideoKanbanBoard';
import VideoClientInfoTab from '@/components/video/VideoClientInfoTab';
import DepartmentTarefasSection from '@/components/department/DepartmentTarefasSection';
import { CheckSquare, ChevronRight, ChevronLeft, LayoutGrid, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import ManualCondutaBanner from '@/components/shared/ManualCondutaBanner';

export default function EditorVideoPage() {
  const [showTarefas, setShowTarefas] = useState(false);
  const [activeTab, setActiveTab] = useState<'kanban' | 'info-bank'>('kanban');

  return (
    <MainLayout>
      <div className="h-full flex flex-col overflow-hidden bg-background">
        <div className="px-8 py-6 border-b border-subtle shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-display text-foreground">
                Editor de Video PRO+
              </h1>
              <p className="text-caption text-muted-foreground mt-1">
                Kanban de demandas de edicao de video
              </p>
              <ManualCondutaBanner />
            </div>
            {activeTab === 'kanban' && (
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
            )}
          </div>
          <div className="flex items-center gap-2 mt-4">
            <button
              onClick={() => setActiveTab('kanban')}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                activeTab === 'kanban'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              )}
            >
              <LayoutGrid size={14} />
              Kanban
            </button>
            <button
              onClick={() => setActiveTab('info-bank')}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                activeTab === 'info-bank'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              )}
            >
              <Database size={14} />
              Banco de Info
            </button>
          </div>
        </div>

        {activeTab === 'kanban' && (
          <div className="flex-1 overflow-hidden flex">
            <div className="flex-1 overflow-hidden px-8 py-6">
              <VideoKanbanBoard />
            </div>

            {showTarefas && (
              <div className="w-[340px] flex-shrink-0 border-l border-subtle overflow-y-auto p-4 bg-card scrollbar-apple">
                <div className="section-header section-header-green rounded-xl mb-4">
                  <div className="flex items-center gap-3">
                    <CheckSquare size={18} className="text-white" />
                    <h2 className="font-semibold text-sm">Tarefas Recorrentes</h2>
                  </div>
                </div>
                <DepartmentTarefasSection department="editor_video" type="daily" />
              </div>
            )}
          </div>
        )}

        {activeTab === 'info-bank' && (
          <div className="flex-1 overflow-hidden p-6">
            <VideoClientInfoTab />
          </div>
        )}
      </div>
    </MainLayout>
  );
}
