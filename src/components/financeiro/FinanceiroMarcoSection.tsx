import { useState } from 'react';
import { useFinanceiroOnboarding, MARCOS, ContractStep, getStepLabel, ALL_STEPS } from '@/hooks/useFinanceiroOnboarding';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Clock } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import ContractExpirationModal from './ContractExpirationModal';

interface FinanceiroMarcoSectionProps {
  marcoId: 'marco1' | 'marco2' | 'marco3';
}

export default function FinanceiroMarcoSection({ marcoId }: FinanceiroMarcoSectionProps) {
  const { getClientsByStep, moveToNextStep, isLoading, getDaysSinceCreated } = useFinanceiroOnboarding();
  
  const [contractModal, setContractModal] = useState<{
    open: boolean;
    clientId: string;
    clientName: string;
    currentStep: string;
    expectedInvestment: number | null;
  }>({
    open: false,
    clientId: '',
    clientName: '',
    currentStep: '',
    expectedInvestment: null,
  });
  
  const marco = MARCOS.find(m => m.id === marcoId);
  if (!marco) return null;

  if (isLoading) {
    return (
      <div className="space-y-4">
        {marco.steps.map((step, i) => (
          <div key={i} className="space-y-2">
            <div className="h-6 bg-muted/50 rounded animate-pulse w-3/4" />
            <div className="h-16 bg-muted/50 rounded-lg animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  // Check if advancing will lead to contrato_assinado
  const willMoveToContratoAssinado = (currentStep: string) => {
    const currentIndex = ALL_STEPS.indexOf(currentStep as ContractStep);
    if (currentIndex === -1 || currentIndex >= ALL_STEPS.length - 1) return false;
    return ALL_STEPS[currentIndex + 1] === 'contrato_assinado';
  };

  const handleAdvance = (clientId: string, currentStep: string, expectedInvestment?: number | null, clientName?: string) => {
    // If next step is contrato_assinado, open the contract expiration modal
    if (willMoveToContratoAssinado(currentStep)) {
      setContractModal({
        open: true,
        clientId,
        clientName: clientName || 'Cliente',
        currentStep,
        expectedInvestment: expectedInvestment || null,
      });
    } else {
      // Regular advance
      moveToNextStep.mutate({ clientId, currentStep, expectedInvestment });
    }
  };

  const handleContractConfirm = (expirationDate: Date) => {
    moveToNextStep.mutate({
      clientId: contractModal.clientId,
      currentStep: contractModal.currentStep,
      expectedInvestment: contractModal.expectedInvestment,
      contractExpiresAt: expirationDate.toISOString().split('T')[0],
    });
    setContractModal({ open: false, clientId: '', clientName: '', currentStep: '', expectedInvestment: null });
  };

  return (
    <>
      <ScrollArea className="h-full">
        <div className="space-y-6 pr-2">
          {marco.steps.map((step) => {
            const clients = getClientsByStep(step.id as ContractStep);

            return (
              <div key={step.id} className="space-y-2">
                {/* Step Header */}
                <div className="flex items-center gap-2 px-1">
                  <h3 className="text-sm font-semibold text-foreground">{step.label}</h3>
                  {clients.length > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {clients.length}
                    </Badge>
                  )}
                </div>

                {/* Clients in this step */}
                {clients.length === 0 ? (
                  <div className="py-3 text-center">
                    <p className="text-xs text-muted-foreground">Nenhum cliente</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {clients.map((record) => {
                      const daysAgo = getDaysSinceCreated(record.created_at);
                      const displayName = record.client?.razao_social || record.client?.name || 'Cliente';
                      const investment = record.client?.expected_investment;
                      const isOverdue = daysAgo > marco.maxDays;
                      const isLastStepInMarco = step.id === marco.steps[marco.steps.length - 1].id;
                      const isContractStep = willMoveToContratoAssinado(record.current_step);

                      return (
                        <Card 
                          key={record.id} 
                          className={cn(
                            "border-subtle hover:shadow-apple-hover transition-shadow",
                            isOverdue && "border-destructive/50 bg-destructive/5"
                          )}
                        >
                          <CardContent className="p-3">
                            <div className="space-y-2">
                              <div className="flex-1 min-w-0">
                                <h4 className="font-medium text-sm text-foreground line-clamp-2">
                                  {displayName}
                                </h4>
                                {investment && (
                                  <p className="text-xs text-muted-foreground">
                                    R$ {investment.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                  </p>
                                )}
                              </div>

                              <div className="flex items-center justify-between">
                                <Badge 
                                  variant="outline" 
                                  className={cn(
                                    "text-xs",
                                    isOverdue 
                                      ? "bg-destructive/10 text-destructive border-destructive/30" 
                                      : "bg-muted text-muted-foreground"
                                  )}
                                >
                                  <Clock size={10} className="mr-1" />
                                  {daysAgo} {daysAgo === 1 ? 'dia' : 'dias'}
                                </Badge>

                                <Button
                                  size="sm"
                                  variant={isContractStep ? "default" : "ghost"}
                                  className={cn(
                                    "h-6 text-xs px-2",
                                    isContractStep && "bg-primary text-primary-foreground"
                                  )}
                                  onClick={() => handleAdvance(record.client_id, record.current_step, record.client?.expected_investment, displayName)}
                                  disabled={moveToNextStep.isPending}
                                >
                                  {isContractStep ? 'Assinar Contrato' : (isLastStepInMarco ? 'Próximo Marco' : 'Avançar')}
                                  <ArrowRight size={12} className="ml-1" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {/* Contract Expiration Modal */}
      <ContractExpirationModal
        open={contractModal.open}
        onOpenChange={(open) => setContractModal({ ...contractModal, open })}
        clientName={contractModal.clientName}
        onConfirm={handleContractConfirm}
        isLoading={moveToNextStep.isPending}
        title="Contrato Assinado"
      />
    </>
  );
}
