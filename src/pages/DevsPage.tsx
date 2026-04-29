import MainLayout from '@/layouts/MainLayout';
import DevsKanbanBoard from '@/components/devs/DevsKanbanBoard';

export default function DevsPage() {
  return (
    <MainLayout>
      <DevsKanbanBoard />
    </MainLayout>
  );
}
