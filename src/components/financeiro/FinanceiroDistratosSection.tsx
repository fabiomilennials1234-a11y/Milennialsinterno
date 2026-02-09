import { useState } from 'react';
import { useFinanceiroDistrato, DISTRATO_STEPS, DistratoStep, DistratoClient } from '@/hooks/useFinanceiroDistrato';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowRight, Clock, FileText, CheckCircle2, Archive, Timer, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

// Column definitions - two independent churn workflows
const COLUMNS = [
  {
    id: 'churn_com_contrato',
    title: 'Churn com Contrato',
    maxDays: 3,
    headerClass: 'bg-gradient-to-r from-[#614385] to-[#516395]',
    steps: [
      { id: DISTRATO_STEPS.CHURN_SOLICITADO, label: '[ 1 ] Churn Solicitado.' },
      { id: DISTRATO_STEPS.COBRANCA_RETIRADA, label: '[ 2 ] Cobrança retirada.' },
      { id: DISTRATO_STEPS.DISTRATO_ENVIADO, label: '[ 3 ] Distrato Enviado.' },
      { id: DISTRATO_STEPS.DISTRATO_ASSINADO, label: '[ 4 ] Distrato assinado.' },
    ],
    finalStep: DISTRATO_STEPS.DISTRATO_ASSINADO,
  },
  {
    id: 'churn_sem_contrato',
    title: 'Churn sem Contrato',
    maxDays: 10,
    headerClass: 'bg-gradient-to-r from-[#614385] to-[#516395]',
    steps: [
      { id: DISTRATO_STEPS.SEM_CONTRATO_SOLICITADO, label: '[ 1 ] Churn Solicitado.' },
      { id: DISTRATO_STEPS.SEM_CONTRATO_EFETIVADO, label: '[ 2 ] Churn Efetivado.' },
    ],
    finalStep: DISTRATO_STEPS.SEM_CONTRATO_EFETIVADO,
  },
];

interface StepCardProps {
  step: { id: DistratoStep; label: string };
  clients: DistratoClient[];
  onAdvance: (clientId: string, step: DistratoStep) => void;
  onFinalize: (clientId: string, clientName: string) => void;
  getDaysSinceDistrato: (date: string | null) => number;
  isFinalStep: boolean;
}

function StepCard({ step, clients, onAdvance, onFinalize, getDaysSinceDistrato, isFinalStep }: StepCardProps) {
  return (
    <div className="space-y-2">
      {/* Step Header Card */}
      <div className="p-3 bg-gradient-to-r from-muted/80 to-muted/60 rounded-xl border border-border/50 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-foreground">{step.label}</h4>
          <div className="w-8 h-8 flex items-center justify-center">
            <span className="text-primary/30 text-2xl font-serif italic">M</span>
          </div>
        </div>
      </div>

      {/* Clients in this step */}
      {clients.map((client) => {
        const days = getDaysSinceDistrato(client.distrato_entered_at);
        const displayName = client.razao_social || client.name;
        
        return (
          <Card key={client.id} className="border-subtle hover:shadow-apple-hover transition-shadow">
            <CardContent className="p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  {isFinalStep && (
                    <div className="flex items-center gap-1 mb-1">
                      <CheckCircle2 size={12} className="text-emerald-500" />
                    </div>
                  )}
                  <h4 className="font-medium text-sm text-foreground line-clamp-2">
                    {displayName}
                  </h4>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Badge 
                  variant="outline" 
                  className={cn(
                    "text-xs",
                    days > 7 ? "border-destructive text-destructive bg-destructive/10" : "border-warning text-warning bg-warning/10"
                  )}
                >
                  <Clock size={10} className="mr-1" />
                  {days} days
                </Badge>
              </div>

              {/* Actions */}
              {isFinalStep ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full h-8 text-xs gap-1 border-destructive/30 text-destructive hover:bg-destructive/10"
                  onClick={() => onFinalize(client.id, displayName)}
                >
                  <Archive size={12} />
                  Arquivar Cliente
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full h-8 text-xs gap-1"
                  onClick={() => onAdvance(client.id, step.id)}
                >
                  <ArrowRight size={12} />
                  Avançar
                </Button>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export default function FinanceiroDistratosSection() {
  const { 
    isLoading, 
    advanceStep, 
    finalizeChurn, 
    getClientsByStep, 
    getDaysSinceDistrato 
  } = useFinanceiroDistrato();

  const [archiveDialog, setArchiveDialog] = useState<{ open: boolean; clientId: string; clientName: string }>({
    open: false,
    clientId: '',
    clientName: '',
  });

  const handleAdvance = (clientId: string, currentStep: DistratoStep) => {
    advanceStep.mutate({ clientId, currentStep });
  };

  const handleFinalize = (clientId: string, clientName: string) => {
    setArchiveDialog({ open: true, clientId, clientName });
  };

  const confirmArchive = () => {
    finalizeChurn.mutate({ clientId: archiveDialog.clientId });
    setArchiveDialog({ open: false, clientId: '', clientName: '' });
  };

  if (isLoading) {
    return (
      <div className="flex gap-4 h-full">
        <Skeleton className="h-full w-[280px]" />
        <Skeleton className="h-full w-[280px]" />
      </div>
    );
  }

  return (
    <>
      <ScrollArea className="w-full">
        <div className="flex gap-4 pb-4" style={{ minWidth: 'max-content' }}>
          {COLUMNS.map((column) => (
            <div 
              key={column.id} 
              className="w-[280px] flex-shrink-0 flex flex-col bg-card rounded-2xl border border-subtle overflow-hidden shadow-apple"
            >
              {/* Column Header */}
              <div className={cn('px-4 py-3', column.headerClass)}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText size={16} className="text-white" />
                    <span className="font-semibold text-sm text-white">{column.title}</span>
                  </div>
                </div>
              </div>

              {/* Steps */}
              <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-apple bg-card">
                {column.steps.map((step) => {
                  const clients = getClientsByStep(step.id);
                  // Etapa final é a última de cada coluna (permite arquivar)
                  const isFinalStep = step.id === column.finalStep;
                  
                  return (
                    <StepCard
                      key={step.id}
                      step={step}
                      clients={clients}
                      onAdvance={handleAdvance}
                      onFinalize={handleFinalize}
                      getDaysSinceDistrato={getDaysSinceDistrato}
                      isFinalStep={isFinalStep}
                    />
                  );
                })}

                {/* Add Card Button */}
                <button className="w-full p-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-xl flex items-center gap-2 transition-colors border-2 border-dashed border-transparent hover:border-muted">
                  + Adicionar cartão
                </button>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Archive Confirmation Dialog */}
      <AlertDialog open={archiveDialog.open} onOpenChange={(open) => setArchiveDialog({ ...archiveDialog, open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="text-destructive" size={20} />
              Arquivar Cliente
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja arquivar <strong>{archiveDialog.clientName}</strong>?
              <br /><br />
              Esta ação irá:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Remover o cliente dos clientes ativos</li>
                <li>Marcar como churned</li>
                <li>Arquivar permanentemente</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmArchive}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Confirmar Arquivamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
