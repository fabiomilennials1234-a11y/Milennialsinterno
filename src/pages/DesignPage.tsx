import MainLayout from '@/layouts/MainLayout';
import DesignKanbanBoard from '@/components/design/DesignKanbanBoard';

export default function DesignPage() {
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
