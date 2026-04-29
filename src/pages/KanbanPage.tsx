import { useParams } from 'react-router-dom';
import MainLayout from '@/layouts/MainLayout';
import KanbanBoard from '@/components/kanban/KanbanBoard';
import DesignKanbanBoard from '@/components/design/DesignKanbanBoard';
import VideoKanbanBoard from '@/components/video/VideoKanbanBoard';
import DevsKanbanBoard from '@/components/devs/DevsKanbanBoard';
import ProdutoraKanbanBoard from '@/components/produtora/ProdutoraKanbanBoard';

/**
 * Detects if a board slug corresponds to a specialized board
 * and returns the appropriate component.
 * This ensures all users see the same specialized Kanban as the CEO,
 * regardless of which route they use to access it.
 */
function getSpecializedBoard(slug: string): React.ReactNode | null {
  const normalized = slug.toLowerCase();

  if (normalized.includes('design')) {
    return <DesignKanbanBoard />;
  }
  if (normalized.includes('video') || normalized.includes('editor')) {
    return <VideoKanbanBoard />;
  }
  if (normalized.includes('dev')) {
    return <DevsKanbanBoard />;
  }
  if (normalized.includes('produtora')) {
    return <ProdutoraKanbanBoard />;
  }

  return null;
}

export default function KanbanPage() {
  const { boardId } = useParams<{ boardId: string }>();
  const slug = boardId || 'design';

  const specializedBoard = getSpecializedBoard(slug);

  if (specializedBoard) {
    return (
      <MainLayout>
        <div className="h-full flex flex-col overflow-hidden bg-background">
          <div className="flex-1 overflow-hidden p-6">
            {specializedBoard}
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="h-[calc(100vh-4rem)] animate-fade-in">
        <KanbanBoard boardSlug={slug} />
      </div>
    </MainLayout>
  );
}
