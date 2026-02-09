import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2, Star, ThumbsUp, ThumbsDown, MessageSquare, Archive } from 'lucide-react';
import { cn } from '@/lib/utils';

const MAIN_REASONS = [
  { value: 'preco', label: 'Preço muito alto' },
  { value: 'resultados', label: 'Resultados abaixo do esperado' },
  { value: 'atendimento', label: 'Atendimento insatisfatório' },
  { value: 'comunicacao', label: 'Problemas de comunicação' },
  { value: 'mudanca_estrategia', label: 'Mudança de estratégia interna' },
  { value: 'orcamento', label: 'Corte de orçamento' },
  { value: 'concorrente', label: 'Migração para concorrente' },
  { value: 'outro', label: 'Outro motivo' },
];

interface InternalExitFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  clientName: string;
  existingExitReasonId?: string | null;
  onSubmitSuccess?: () => void;
}

export default function InternalExitFormModal({
  open,
  onOpenChange,
  clientId,
  clientName,
  existingExitReasonId,
  onSubmitSuccess,
}: InternalExitFormModalProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [formData, setFormData] = useState({
    mainReason: '',
    satisfactionScore: 0,
    whatCouldImprove: '',
    wouldRecommend: null as boolean | null,
    additionalFeedback: '',
  });
  const [archiveAfterSubmit, setArchiveAfterSubmit] = useState(true);

  const createAndSubmitMutation = useMutation({
    mutationFn: async () => {
      // If there's no existing exit reason, create one first
      let exitReasonId = existingExitReasonId;
      
      if (!exitReasonId) {
        const { data: newReason, error: createError } = await supabase
          .from('cs_exit_reasons')
          .insert({
            client_id: clientId,
            client_name: clientName,
            created_by: user?.id,
          } as any)
          .select()
          .single();

        if (createError) throw createError;
        exitReasonId = newReason.id;
      }

      // Update with the form data
      const { error: updateError } = await supabase
        .from('cs_exit_reasons')
        .update({
          main_reason: formData.mainReason,
          satisfaction_score: formData.satisfactionScore,
          what_could_improve: formData.whatCouldImprove,
          would_recommend: formData.wouldRecommend ?? false,
          additional_feedback: formData.additionalFeedback,
          is_submitted: true,
          submitted_at: new Date().toISOString(),
        } as any)
        .eq('id', exitReasonId);

      if (updateError) throw updateError;

      // Archive client if requested
      if (archiveAfterSubmit) {
        const { error: archiveError } = await supabase
          .from('clients')
          .update({
            archived: true,
            archived_at: new Date().toISOString(),
          })
          .eq('id', clientId);

        if (archiveError) throw archiveError;
      }

      return { archived: archiveAfterSubmit };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['cs-exit-reasons'] });
      queryClient.invalidateQueries({ queryKey: ['cs-clients'] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      
      if (result.archived) {
        toast.success('Motivo de saída registrado e cliente arquivado');
      } else {
        toast.success('Motivo de saída registrado');
      }
      
      onOpenChange(false);
      resetForm();
      onSubmitSuccess?.();
    },
    onError: (error: any) => {
      if (error.code === '23505') {
        toast.error('Já existe um formulário de saída para este cliente');
      } else {
        toast.error('Erro ao registrar motivo de saída', { description: error.message });
      }
    },
  });

  const resetForm = () => {
    setFormData({
      mainReason: '',
      satisfactionScore: 0,
      whatCouldImprove: '',
      wouldRecommend: null,
      additionalFeedback: '',
    });
    setArchiveAfterSubmit(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.mainReason || !formData.satisfactionScore) {
      toast.error('Preencha os campos obrigatórios');
      return;
    }

    createAndSubmitMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            Registrar Motivo de Saída
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Cliente: <span className="font-medium text-foreground">{clientName}</span>
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Main Reason */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Principal motivo da saída <span className="text-destructive">*</span>
            </Label>
            <RadioGroup
              value={formData.mainReason}
              onValueChange={(value) => setFormData(prev => ({ ...prev, mainReason: value }))}
              className="space-y-2"
            >
              {MAIN_REASONS.map((reason) => (
                <div
                  key={reason.value}
                  className={cn(
                    "flex items-center space-x-3 p-2.5 rounded-lg border transition-colors cursor-pointer",
                    formData.mainReason === reason.value
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/50"
                  )}
                  onClick={() => setFormData(prev => ({ ...prev, mainReason: reason.value }))}
                >
                  <RadioGroupItem value={reason.value} id={reason.value} />
                  <Label htmlFor={reason.value} className="cursor-pointer flex-1 text-sm">
                    {reason.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Satisfaction Score */}
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-1.5">
              <Star className="h-4 w-4 text-warning" />
              Satisfação geral (1-5) <span className="text-destructive">*</span>
            </Label>
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((score) => (
                <button
                  key={score}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, satisfactionScore: score }))}
                  className={cn(
                    "w-10 h-10 rounded-full text-sm font-semibold transition-all",
                    formData.satisfactionScore === score
                      ? "bg-primary text-primary-foreground scale-110"
                      : "bg-muted hover:bg-muted/80"
                  )}
                >
                  {score}
                </button>
              ))}
            </div>
            <div className="flex justify-between text-xs text-muted-foreground px-2">
              <span>Muito insatisfeito</span>
              <span>Muito satisfeito</span>
            </div>
          </div>

          {/* What Could Improve */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">O que poderia melhorar?</Label>
            <Textarea
              value={formData.whatCouldImprove}
              onChange={(e) => setFormData(prev => ({ ...prev, whatCouldImprove: e.target.value }))}
              placeholder="Sugestões de melhoria..."
              rows={2}
            />
          </div>

          {/* Would Recommend */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Recomendaria para outras pessoas?</Label>
            <div className="flex gap-3">
              <Button
                type="button"
                variant={formData.wouldRecommend === true ? "default" : "outline"}
                size="sm"
                onClick={() => setFormData(prev => ({ ...prev, wouldRecommend: true }))}
                className="flex-1"
              >
                <ThumbsUp className="h-4 w-4 mr-1.5" />
                Sim
              </Button>
              <Button
                type="button"
                variant={formData.wouldRecommend === false ? "destructive" : "outline"}
                size="sm"
                onClick={() => setFormData(prev => ({ ...prev, wouldRecommend: false }))}
                className="flex-1"
              >
                <ThumbsDown className="h-4 w-4 mr-1.5" />
                Não
              </Button>
            </div>
          </div>

          {/* Additional Feedback */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Comentários adicionais</Label>
            <Textarea
              value={formData.additionalFeedback}
              onChange={(e) => setFormData(prev => ({ ...prev, additionalFeedback: e.target.value }))}
              placeholder="Observações..."
              rows={2}
            />
          </div>

          {/* Archive Option */}
          <div 
            className={cn(
              "flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors",
              archiveAfterSubmit 
                ? "border-primary/50 bg-primary/5" 
                : "border-border hover:bg-muted/50"
            )}
            onClick={() => setArchiveAfterSubmit(!archiveAfterSubmit)}
          >
            <div className={cn(
              "w-5 h-5 rounded flex items-center justify-center border-2 transition-colors",
              archiveAfterSubmit ? "bg-primary border-primary" : "border-muted-foreground/50"
            )}>
              {archiveAfterSubmit && (
                <svg className="w-3 h-3 text-primary-foreground" fill="currentColor" viewBox="0 0 12 12">
                  <path d="M10.28 2.28L3.989 8.575 1.695 6.28A1 1 0 00.28 7.695l3 3a1 1 0 001.414 0l7-7A1 1 0 0010.28 2.28z" />
                </svg>
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-1.5">
                <Archive className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Arquivar cliente após registro</span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Move o cliente para a lista de arquivados
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={createAndSubmitMutation.isPending || !formData.mainReason || !formData.satisfactionScore}
            >
              {createAndSubmitMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Registrar'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
