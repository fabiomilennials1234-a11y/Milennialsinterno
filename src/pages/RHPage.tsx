import MainLayout from '@/layouts/MainLayout';
import RHKanbanBoard from '@/components/rh/RHKanbanBoard';

export default function RHPage() {
  return (
    <MainLayout>
      <div className="h-[calc(100vh-4rem)] animate-fade-in">
        <RHKanbanBoard />
      </div>
    </MainLayout>
  );
}
