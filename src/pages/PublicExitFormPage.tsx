import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useExitReasonByToken, useSubmitExitReason } from '@/hooks/useCSExitReasons';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { CheckCircle, Loader2, MessageSquare, Star, ThumbsUp, ThumbsDown, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import logo from '@/assets/logo.png';

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

export default function PublicExitFormPage() {
  const { token } = useParams<{ token: string }>();
  const { data: exitReason, isLoading } = useExitReasonByToken(token || null);
  const submitMutation = useSubmitExitReason();

  const [formData, setFormData] = useState({
    mainReason: '',
    satisfactionScore: 0,
    whatCouldImprove: '',
    wouldRecommend: null as boolean | null,
    additionalFeedback: '',
  });

  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!token || !formData.mainReason || !formData.satisfactionScore) {
      return;
    }

    try {
      await submitMutation.mutateAsync({
        token,
        mainReason: formData.mainReason,
        satisfactionScore: formData.satisfactionScore,
        whatCouldImprove: formData.whatCouldImprove,
        wouldRecommend: formData.wouldRecommend ?? false,
        additionalFeedback: formData.additionalFeedback,
      });
      setIsSubmitted(true);
    } catch (error) {
      // Error handled in mutation
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!exitReason) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-lg font-semibold">Formulário não encontrado</h2>
            <p className="text-muted-foreground mt-2">
              Este link não é válido ou já expirou.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (exitReason.is_submitted || isSubmitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <CheckCircle className="h-12 w-12 text-success mx-auto mb-4" />
            <h2 className="text-lg font-semibold">Obrigado pelo seu feedback!</h2>
            <p className="text-muted-foreground mt-2">
              Sua resposta foi registrada com sucesso. Agradecemos por compartilhar sua experiência conosco.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-4">
          <img src={logo} alt="Logo" className="h-12 mx-auto" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Pesquisa de Saída</h1>
            <p className="text-muted-foreground mt-1">
              Olá! Sentimos muito pela sua saída. Sua opinião é muito importante para nós.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Main Reason */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-primary" />
                Qual o principal motivo da sua saída?
              </CardTitle>
              <CardDescription>Selecione a opção que melhor descreve</CardDescription>
            </CardHeader>
            <CardContent>
              <RadioGroup
                value={formData.mainReason}
                onValueChange={(value) => setFormData(prev => ({ ...prev, mainReason: value }))}
                className="space-y-3"
              >
                {MAIN_REASONS.map((reason) => (
                  <div
                    key={reason.value}
                    className={cn(
                      "flex items-center space-x-3 p-3 rounded-lg border transition-colors cursor-pointer",
                      formData.mainReason === reason.value
                        ? "border-primary bg-primary/5"
                        : "border-subtle hover:bg-muted/50"
                    )}
                    onClick={() => setFormData(prev => ({ ...prev, mainReason: reason.value }))}
                  >
                    <RadioGroupItem value={reason.value} id={reason.value} />
                    <Label htmlFor={reason.value} className="cursor-pointer flex-1">
                      {reason.label}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </CardContent>
          </Card>

          {/* Satisfaction Score */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Star className="h-5 w-5 text-warning" />
                Como você avalia sua experiência geral?
              </CardTitle>
              <CardDescription>Sendo 1 muito insatisfeito e 5 muito satisfeito</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex justify-center gap-2">
                {[1, 2, 3, 4, 5].map((score) => (
                  <button
                    key={score}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, satisfactionScore: score }))}
                    className={cn(
                      "w-12 h-12 rounded-full text-lg font-semibold transition-all",
                      formData.satisfactionScore === score
                        ? "bg-primary text-primary-foreground scale-110"
                        : "bg-muted hover:bg-muted/80"
                    )}
                  >
                    {score}
                  </button>
                ))}
              </div>
              <div className="flex justify-between text-xs text-muted-foreground mt-2 px-2">
                <span>Muito insatisfeito</span>
                <span>Muito satisfeito</span>
              </div>
            </CardContent>
          </Card>

          {/* What Could Improve */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">O que poderíamos ter feito diferente?</CardTitle>
              <CardDescription>Sua sugestão nos ajuda a melhorar</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={formData.whatCouldImprove}
                onChange={(e) => setFormData(prev => ({ ...prev, whatCouldImprove: e.target.value }))}
                placeholder="Escreva aqui suas sugestões de melhoria..."
                rows={3}
              />
            </CardContent>
          </Card>

          {/* Would Recommend */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Você nos recomendaria para outras pessoas?</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4 justify-center">
                <Button
                  type="button"
                  variant={formData.wouldRecommend === true ? "default" : "outline"}
                  size="lg"
                  onClick={() => setFormData(prev => ({ ...prev, wouldRecommend: true }))}
                  className="flex-1 max-w-[150px]"
                >
                  <ThumbsUp className="h-5 w-5 mr-2" />
                  Sim
                </Button>
                <Button
                  type="button"
                  variant={formData.wouldRecommend === false ? "destructive" : "outline"}
                  size="lg"
                  onClick={() => setFormData(prev => ({ ...prev, wouldRecommend: false }))}
                  className="flex-1 max-w-[150px]"
                >
                  <ThumbsDown className="h-5 w-5 mr-2" />
                  Não
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Additional Feedback */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Deseja deixar algum comentário adicional?</CardTitle>
              <CardDescription>Opcional</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={formData.additionalFeedback}
                onChange={(e) => setFormData(prev => ({ ...prev, additionalFeedback: e.target.value }))}
                placeholder="Escreva aqui qualquer comentário adicional..."
                rows={3}
              />
            </CardContent>
          </Card>

          {/* Submit Button */}
          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={!formData.mainReason || !formData.satisfactionScore || submitMutation.isPending}
          >
            {submitMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Enviando...
              </>
            ) : (
              'Enviar Resposta'
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
