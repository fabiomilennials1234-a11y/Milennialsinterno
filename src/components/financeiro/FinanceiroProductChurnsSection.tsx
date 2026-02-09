import { useState } from 'react';
import { useProductChurn, PRODUCT_DISTRATO_STEPS, ProductDistratoStep, ProductChurn } from '@/hooks/useProductChurn';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowRight, Clock, FileText, CheckCircle2, Archive, AlertTriangle, Package } from 'lucide-react';
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
import { PRODUCT_CONFIG } from '@/components/shared/ProductBadges';

// Column definitions - two independent churn workflows
const COLUMNS = [
  {
    id: 'churn_com_contrato',
    title: 'Churn com Contrato',
    maxDays: 3,
    headerClass: 'bg-gradient-to-r from-[#614385] to-[#516395]',
    steps: [
      { id: PRODUCT_DISTRATO_STEPS.CHURN_SOLICITADO, label: '[ 1 ] Churn Solicitado.' },
      { id: PRODUCT_DISTRATO_STEPS.COBRANCA_RETIRADA, label: '[ 2 ] Cobrança retirada.' },
      { id: PRODUCT_DISTRATO_STEPS.DISTRATO_ENVIADO, label: '[ 3 ] Distrato Enviado.' },
      { id: PRODUCT_DISTRATO_STEPS.DISTRATO_ASSINADO, label: '[ 4 ] Distrato assinado.' },
    ],
    finalStep: PRODUCT_DISTRATO_STEPS.DISTRATO_ASSINADO,
  },
  {
    id: 'churn_sem_contrato',
    title: 'Churn sem Contrato',
    maxDays: 10,
    headerClass: 'bg-gradient-to-r from-[#614385] to-[#516395]',
    steps: [
      { id: PRODUCT_DISTRATO_STEPS.SEM_CONTRATO_SOLICITADO, label: '[ 1 ] Churn Solicitado.' },
      { id: PRODUCT_DISTRATO_STEPS.SEM_CONTRATO_EFETIVADO, label: '[ 2 ] Churn Efetivado.' },
    ],
    finalStep: PRODUCT_DISTRATO_STEPS.SEM_CONTRATO_EFETIVADO,
  },
];

interface StepCardProps {
  step: { id: ProductDistratoStep; label: string };
  churns: ProductChurn[];
  onAdvance: (churnId: string, step: ProductDistratoStep) => void;
  onFinalize: (churnId: string, displayName: string) => void;
  getDaysSinceChurn: (date: string | null) => number;
  isFinalStep: boolean;
}

function StepCard({ step, churns, onAdvance, onFinalize, getDaysSinceChurn, isFinalStep }: StepCardProps) {
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

      {/* Churns in this step */}
      {churns.map((churn) => {
        const days = getDaysSinceChurn(churn.distrato_entered_at);
        const clientName = churn.client?.razao_social || churn.client?.name || 'Cliente';
        const productConfig = PRODUCT_CONFIG[churn.product_slug];
        const productColor = productConfig?.color || 'bg-muted';
        
        return (
          <Card key={churn.id} className="border-subtle hover:shadow-apple-hover transition-shadow">
            <CardContent className="p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  {isFinalStep && (
                    <div className="flex items-center gap-1 mb-1">
                      <CheckCircle2 size={12} className="text-emerald-500" />
                    </div>
                  )}
                  <h4 className="font-medium text-sm text-foreground line-clamp-2">
                    {clientName}
                  </h4>
                  {/* Product Badge */}
                  <div className="flex items-center gap-1 mt-1">
                    <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", productColor)}>
                      <Package size={8} className="mr-1" />
                      {churn.product_name}
                    </Badge>
                  </div>
                  {/* Monthly Value */}
                  {churn.monthly_value && churn.monthly_value > 0 && (
                    <p className="text-[10px] text-muted-foreground mt-1">
                      R$ {churn.monthly_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} /mês
                    </p>
                  )}
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
                  {days} dias
                </Badge>
              </div>

              {/* Actions */}
              {isFinalStep ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full h-8 text-xs gap-1 border-destructive/30 text-destructive hover:bg-destructive/10"
                  onClick={() => onFinalize(churn.id, `${clientName} - ${churn.product_name}`)}
                >
                  <Archive size={12} />
                  Finalizar Churn
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full h-8 text-xs gap-1"
                  onClick={() => onAdvance(churn.id, step.id)}
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

export default function FinanceiroProductChurnsSection() {
  const { 
    productChurns,
    isLoading, 
    advanceStep, 
    finalizeChurn, 
    getChurnsByStep, 
    getDaysSinceChurn 
  } = useProductChurn();

  const [archiveDialog, setArchiveDialog] = useState<{ open: boolean; churnId: string; displayName: string }>({
    open: false,
    churnId: '',
    displayName: '',
  });

  const handleAdvance = (churnId: string, currentStep: ProductDistratoStep) => {
    advanceStep.mutate({ churnId, currentStep });
  };

  const handleFinalize = (churnId: string, displayName: string) => {
    setArchiveDialog({ open: true, churnId, displayName });
  };

  const confirmFinalize = () => {
    finalizeChurn.mutate({ churnId: archiveDialog.churnId });
    setArchiveDialog({ open: false, churnId: '', displayName: '' });
  };

  if (isLoading) {
    return (
      <div className="flex gap-4 h-full">
        <Skeleton className="h-full w-[280px]" />
        <Skeleton className="h-full w-[280px]" />
      </div>
    );
  }

  // Check if there are any churns
  const totalChurns = productChurns.length;

  return (
    <>
      <ScrollArea className="w-full">
        <div className="flex gap-4 pb-4" style={{ minWidth: 'max-content' }}>
          {COLUMNS.map((column) => {
            // Count churns in this column
            const columnChurns = column.steps.reduce((count, step) => {
              return count + getChurnsByStep(step.id).length;
            }, 0);

            return (
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
                    {columnChurns > 0 && (
                      <Badge variant="secondary" className="bg-white/20 text-white text-xs">
                        {columnChurns}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Steps */}
                <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-apple bg-card">
                  {column.steps.map((step) => {
                    const churns = getChurnsByStep(step.id);
                    const isFinalStep = step.id === column.finalStep;
                    
                    return (
                      <StepCard
                        key={step.id}
                        step={step}
                        churns={churns}
                        onAdvance={handleAdvance}
                        onFinalize={handleFinalize}
                        getDaysSinceChurn={getDaysSinceChurn}
                        isFinalStep={isFinalStep}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {/* Empty state */}
      {totalChurns === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center text-muted-foreground">
            <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nenhum churn de produto em andamento</p>
          </div>
        </div>
      )}

      {/* Finalize Confirmation Dialog */}
      <AlertDialog open={archiveDialog.open} onOpenChange={(open) => setArchiveDialog({ ...archiveDialog, open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="text-destructive" size={20} />
              Finalizar Churn do Produto
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja finalizar o churn de <strong>{archiveDialog.displayName}</strong>?
              <br /><br />
              Esta ação irá:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Remover o produto dos produtos contratados do cliente</li>
                <li>Arquivar este registro de churn</li>
                <li>Se for o último produto, o cliente será arquivado</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmFinalize}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Confirmar Finalização
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
