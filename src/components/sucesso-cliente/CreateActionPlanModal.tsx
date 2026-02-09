import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import {
  useCreateActionPlan,
  PROBLEM_TYPES,
  SEVERITY_CONFIG,
  type ProblemType,
  type Severity,
} from '@/hooks/useCSActionPlans';
import { cn } from '@/lib/utils';

interface CreateActionPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: string;
  clientName: string;
}

export default function CreateActionPlanModal({
  isOpen,
  onClose,
  clientId,
  clientName,
}: CreateActionPlanModalProps) {
  const [step, setStep] = useState(1);
  const [problemType, setProblemType] = useState<ProblemType | null>(null);
  const [severity, setSeverity] = useState<Severity | null>(null);
  const [selectedIndicators, setSelectedIndicators] = useState<string[]>([]);
  const [notes, setNotes] = useState('');

  const createPlan = useCreateActionPlan();

  const handleClose = () => {
    setStep(1);
    setProblemType(null);
    setSeverity(null);
    setSelectedIndicators([]);
    setNotes('');
    onClose();
  };

  const handleCreate = async () => {
    if (!problemType || !severity) return;

    await createPlan.mutateAsync({
      clientId,
      problemType,
      severity,
      indicators: selectedIndicators,
      notes: notes || undefined,
    });
    handleClose();
  };

  const toggleIndicator = (indicator: string) => {
    setSelectedIndicators(prev =>
      prev.includes(indicator)
        ? prev.filter(i => i !== indicator)
        : [...prev, indicator]
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-warning" />
            Criar Plano de Ação
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Cliente: <strong>{clientName}</strong>
          </p>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-6 pr-2">
            {/* Step 1: Select Problem Type */}
            {step === 1 && (
              <div className="space-y-4">
                <Label className="text-sm font-semibold">
                  Qual é o tipo de problema?
                </Label>
                <div className="grid grid-cols-1 gap-3">
                  {(Object.entries(PROBLEM_TYPES) as [ProblemType, typeof PROBLEM_TYPES[ProblemType]][]).map(([key, config]) => (
                    <button
                      key={key}
                      onClick={() => {
                        setProblemType(key);
                        setSelectedIndicators([]);
                        setStep(2);
                      }}
                      className={cn(
                        'p-4 rounded-xl border-2 text-left transition-all hover:border-primary/50 hover:bg-muted/50',
                        problemType === key
                          ? 'border-primary bg-primary/5'
                          : 'border-border'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{config.icon}</span>
                        <div>
                          <span className="font-semibold text-foreground block">
                            {config.label}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {config.question}
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 2: Select Indicators */}
            {step === 2 && problemType && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">
                    Quais indicadores se aplicam?
                  </Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setStep(1)}
                  >
                    Voltar
                  </Button>
                </div>

                <div className="bg-muted/30 rounded-lg p-3 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{PROBLEM_TYPES[problemType].icon}</span>
                    <span className="font-medium">{PROBLEM_TYPES[problemType].label}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  {PROBLEM_TYPES[problemType].indicators.map((indicator) => (
                    <label
                      key={indicator}
                      className={cn(
                        'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all',
                        selectedIndicators.includes(indicator)
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:bg-muted/50'
                      )}
                    >
                      <Checkbox
                        checked={selectedIndicators.includes(indicator)}
                        onCheckedChange={() => toggleIndicator(indicator)}
                      />
                      <span className="text-sm">{indicator}</span>
                    </label>
                  ))}
                </div>

                <Button
                  className="w-full mt-4"
                  onClick={() => setStep(3)}
                  disabled={selectedIndicators.length === 0}
                >
                  Continuar
                </Button>
              </div>
            )}

            {/* Step 3: Select Severity */}
            {step === 3 && problemType && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">
                    Qual a severidade?
                  </Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setStep(2)}
                  >
                    Voltar
                  </Button>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {(Object.entries(SEVERITY_CONFIG) as [Severity, typeof SEVERITY_CONFIG[Severity]][]).map(([key, config]) => (
                    <button
                      key={key}
                      onClick={() => {
                        setSeverity(key);
                        setStep(4);
                      }}
                      className={cn(
                        'p-4 rounded-xl border-2 text-left transition-all hover:border-primary/50',
                        config.bgColor,
                        severity === key ? 'border-primary' : 'border-transparent'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className={cn('font-bold', config.color)}>
                            {config.label}
                          </span>
                          <p className="text-sm text-muted-foreground mt-1">
                            Prazo: {config.days} dias para resolução
                          </p>
                        </div>
                        <div className={cn(
                          'w-4 h-4 rounded-full',
                          key === 'leve' && 'bg-success',
                          key === 'moderado' && 'bg-warning',
                          key === 'critico' && 'bg-destructive'
                        )} />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 4: Notes and Confirm */}
            {step === 4 && problemType && severity && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">
                    Observações adicionais
                  </Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setStep(3)}
                  >
                    Voltar
                  </Button>
                </div>

                {/* Summary */}
                <div className="bg-muted/30 rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{PROBLEM_TYPES[problemType].icon}</span>
                    <span className="font-medium">{PROBLEM_TYPES[problemType].label}</span>
                  </div>
                  <div className={cn(
                    'inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium',
                    SEVERITY_CONFIG[severity].bgColor,
                    SEVERITY_CONFIG[severity].color
                  )}>
                    <div className={cn(
                      'w-2 h-2 rounded-full',
                      severity === 'leve' && 'bg-success',
                      severity === 'moderado' && 'bg-warning',
                      severity === 'critico' && 'bg-destructive'
                    )} />
                    {SEVERITY_CONFIG[severity].label}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <strong>Indicadores:</strong>
                    <ul className="list-disc list-inside mt-1">
                      {selectedIndicators.map(ind => (
                        <li key={ind}>{ind}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Observações (opcional)</Label>
                  <Textarea
                    placeholder="Adicione contexto ou detalhes importantes..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="min-h-[100px]"
                  />
                </div>

                <Button
                  className="w-full gap-2"
                  onClick={handleCreate}
                  disabled={createPlan.isPending}
                >
                  {createPlan.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  Criar Plano de Ação
                </Button>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
