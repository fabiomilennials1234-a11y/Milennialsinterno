import MainLayout from '@/layouts/MainLayout';
import VideoKanbanBoard from '@/components/video/VideoKanbanBoard';

export default function EditorVideoPage() {
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
