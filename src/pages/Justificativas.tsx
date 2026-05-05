import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PendentesTab from '@/components/justificativas/PendentesTab';
import JustificadasTab from '@/components/justificativas/JustificadasTab';
import EquipeTab from '@/components/justificativas/EquipeTab';
import ChurnTab from '@/components/justificativas/ChurnTab';
import { useJustificativasTeam } from '@/hooks/useJustificativas';
import { useChurnNotifications } from '@/hooks/useChurnNotifications';
import { useAuth } from '@/contexts/AuthContext';

const CHURN_TAB_ROLES = ['ceo', 'sucesso_cliente'];

export default function Justificativas() {
  const { user } = useAuth();
  // Tab Equipe so renderiza quando RPC retorna escopo > 0.
  const { data: teamData } = useJustificativasTeam(false);
  const showTeam = (teamData ?? []).length > 0;

  // Churn tab only for CEO + sucesso_cliente
  const showChurn = !!user?.role && CHURN_TAB_ROLES.includes(user.role);
  const { data: churnNotifs = [] } = useChurnNotifications();
  const churnCount = showChurn ? churnNotifs.length : 0;

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Justificativas</h1>
        <p className="text-sm text-muted-foreground">Centralize suas pendencias e acoes da equipe.</p>
      </header>

      <Tabs defaultValue="pendentes">
        <TabsList>
          <TabsTrigger value="pendentes">Pendentes</TabsTrigger>
          <TabsTrigger value="justificadas">Justificadas por mim</TabsTrigger>
          {showTeam && <TabsTrigger value="equipe">Da minha equipe</TabsTrigger>}
          {showChurn && (
            <TabsTrigger value="churn" className="gap-1.5">
              Alertas de Churn
              {churnCount > 0 && (
                <span className="bg-danger text-white text-xs font-semibold rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                  {churnCount}
                </span>
              )}
            </TabsTrigger>
          )}
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
        {showChurn && (
          <TabsContent value="churn" className="mt-4">
            <ChurnTab />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
