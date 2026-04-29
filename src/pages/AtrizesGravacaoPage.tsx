import MainLayout from '@/layouts/MainLayout';
import AtrizesKanbanBoard from '@/components/atrizes/AtrizesKanbanBoard';

export default function AtrizesGravacaoPage() {
  return (
    <MainLayout>
      <div className="h-full flex flex-col overflow-hidden bg-background">
        <div className="px-8 py-6 border-b border-subtle shrink-0">
          <h1 className="text-display text-foreground">
            Atrizes de Gravação PRO+
          </h1>
          <p className="text-caption text-muted-foreground mt-1">
            Kanban de demandas de gravação
          </p>
        </div>

        <div className="flex-1 overflow-hidden px-8 py-6">
          <AtrizesKanbanBoard />
        </div>
      </div>
    </MainLayout>
  );
}
