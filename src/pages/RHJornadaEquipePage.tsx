import MainLayout from '@/layouts/MainLayout';
import RHJornadaEquipeKanban from '@/components/rh/RHJornadaEquipeKanban';

export default function RHJornadaEquipePage() {
  return (
    <MainLayout>
      <div className="h-[calc(100vh-4rem)] animate-fade-in">
        <RHJornadaEquipeKanban />
      </div>
    </MainLayout>
  );
}
