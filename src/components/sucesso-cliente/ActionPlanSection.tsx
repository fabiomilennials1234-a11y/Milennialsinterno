import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Plus, AlertTriangle } from 'lucide-react';
import { useClientActionPlans } from '@/hooks/useCSActionPlans';
import ActionPlanCard from './ActionPlanCard';
import CreateActionPlanModal from './CreateActionPlanModal';
import { useAuth } from '@/contexts/AuthContext';

interface ActionPlanSectionProps {
  clientId: string;
  clientName: string;
}

export default function ActionPlanSection({ clientId, clientName }: ActionPlanSectionProps) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const { data: plans, isLoading } = useClientActionPlans(clientId);
  const { user, isCEO, isAdminUser } = useAuth();

  const canCreate = isCEO || isAdminUser || user?.role === 'sucesso_cliente';
  const isViewOnly = !canCreate;

  const activePlans = plans?.filter(p => p.status === 'active') || [];
  const completedPlans = plans?.filter(p => p.status === 'completed') || [];
  const cancelledPlans = plans?.filter(p => p.status === 'cancelled') || [];

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-r from-warning/10 to-orange-500/10 rounded-xl p-5 border border-warning/30">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-warning to-orange-600 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-foreground">
              📋 Planos de Ação
            </h3>
            <p className="text-sm text-muted-foreground">
              Gerencie planos de recuperação e melhoria para este cliente
            </p>
          </div>
          {canCreate && (
            <Button onClick={() => setIsCreateOpen(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              Novo Plano
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-warning" />
          </div>
        ) : plans && plans.length > 0 ? (
          <div className="space-y-6">
            {/* Active Plans */}
            {activePlans.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Planos Ativos ({activePlans.length})
                </h4>
                <div className="space-y-3">
                  {activePlans.map((plan) => (
                    <ActionPlanCard key={plan.id} plan={plan} isViewOnly={isViewOnly} />
                  ))}
                </div>
              </div>
            )}

            {/* Completed Plans */}
            {completedPlans.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Concluídos ({completedPlans.length})
                </h4>
                <div className="space-y-3">
                  {completedPlans.map((plan) => (
                    <ActionPlanCard key={plan.id} plan={plan} isViewOnly={isViewOnly} />
                  ))}
                </div>
              </div>
            )}

            {/* Cancelled Plans */}
            {cancelledPlans.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Cancelados ({cancelledPlans.length})
                </h4>
                <div className="space-y-3">
                  {cancelledPlans.map((plan) => (
                    <ActionPlanCard key={plan.id} plan={plan} isViewOnly={isViewOnly} />
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <AlertTriangle className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Nenhum plano de ação criado</p>
            {canCreate && (
              <p className="text-sm">Clique em "Novo Plano" para começar</p>
            )}
          </div>
        )}
      </div>

      {/* Create Modal */}
      <CreateActionPlanModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        clientId={clientId}
        clientName={clientName}
      />
    </div>
  );
}
