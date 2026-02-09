import { useParams } from 'react-router-dom';
import MainLayout from '@/layouts/MainLayout';
import KanbanBoard from '@/components/kanban/KanbanBoard';

export default function KanbanPage() {
  const { boardId } = useParams<{ boardId: string }>();

  return (
    <MainLayout>
      <div className="h-[calc(100vh-4rem)] animate-fade-in">
        <KanbanBoard boardSlug={boardId || 'design'} />
      </div>
    </MainLayout>
  );
}
