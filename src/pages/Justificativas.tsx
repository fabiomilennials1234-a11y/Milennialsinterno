import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PendentesTab from '@/components/justificativas/PendentesTab';
import JustificadasTab from '@/components/justificativas/JustificadasTab';
import EquipeTab from '@/components/justificativas/EquipeTab';
import { useJustificativasTeam } from '@/hooks/useJustificativas';

export default function Justificativas() {
  // Tab Equipe só renderiza quando RPC retorna escopo > 0.
  const { data: teamData } = useJustificativasTeam(false);
  const showTeam = (teamData ?? []).length > 0;

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Justificativas</h1>
        <p className="text-sm text-muted-foreground">Centralize suas pendências e ações da equipe.</p>
      </header>

      <Tabs defaultValue="pendentes">
        <TabsList>
          <TabsTrigger value="pendentes">Pendentes</TabsTrigger>
          <TabsTrigger value="justificadas">Justificadas por mim</TabsTrigger>
          {showTeam && <TabsTrigger value="equipe">Da minha equipe</TabsTrigger>}
        </TabsList>

        <TabsContent value="pendentes" className="mt-4">
          <PendentesTab />
        </TabsContent>
        <TabsContent value="justificadas" className="mt-4">
          <JustificadasTab />
        </TabsContent>
        {showTeam && (
          <TabsContent value="equipe" className="mt-4">
            <EquipeTab />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
