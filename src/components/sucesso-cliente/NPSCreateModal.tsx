import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCreateNPSSurvey, NPSSurvey } from '@/hooks/useNPSSurveys';
import { BarChart3, Loader2, Copy, ExternalLink, Check } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface NPSCreateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function NPSCreateModal({ open, onOpenChange }: NPSCreateModalProps) {
  const [referenceDate, setReferenceDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [createdSurvey, setCreatedSurvey] = useState<NPSSurvey | null>(null);
  const [copied, setCopied] = useState(false);

  const createSurvey = useCreateNPSSurvey();

  const handleGenerate = async () => {
    const dateLabel = format(new Date(referenceDate + 'T12:00:00'), "dd 'de' MMMM, yyyy", { locale: ptBR });
    const title = `NPS Time | ${dateLabel}`;

    try {
      const survey = await createSurvey.mutateAsync({
        title,
        description: `Pesquisa quinzenal de satisfação da equipe — referência: ${dateLabel}`,
        surveyType: 'team',
      });
      setCreatedSurvey(survey);
    } catch {
      // Error handled by mutation
    }
  };

  const publicUrl = createdSurvey
    ? `${window.location.origin}/nps/${createdSurvey.public_token}`
    : '';

  const copyLink = () => {
    navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    toast.success('Link copiado!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      setCreatedSurvey(null);
      setCopied(false);
      setReferenceDate(format(new Date(), 'yyyy-MM-dd'));
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-purple-500/10">
              <BarChart3 className="h-5 w-5 text-purple-500" />
            </div>
            <div>
              <DialogTitle>Nova Pesquisa NPS Time</DialogTitle>
              <DialogDescription>
                Gere um link de pesquisa quinzenal para a equipe
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {!createdSurvey ? (
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="reference-date">Data de referência</Label>
              <Input
                id="reference-date"
                type="date"
                value={referenceDate}
                onChange={(e) => setReferenceDate(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                A data identifica o período avaliado pela pesquisa.
              </p>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 text-sm space-y-2">
              <p className="font-medium">Perguntas incluídas:</p>
              <ul className="text-muted-foreground text-xs space-y-1 list-disc list-inside">
                <li>Avaliação da experiência (1-5)</li>
                <li>Rapidez e eficiência nas demandas</li>
                <li>Ponto positivo do período</li>
                <li>O que podemos melhorar</li>
                <li>Ideias e sugestões</li>
              </ul>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleClose(false)}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleGenerate}
                disabled={createSurvey.isPending}
              >
                {createSurvey.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Gerar Pesquisa
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 mt-4">
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 text-center">
              <p className="text-sm font-medium text-green-700 dark:text-green-400">
                Pesquisa criada com sucesso!
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {createdSurvey.title}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Link público</Label>
              <div className="flex gap-2">
                <Input
                  value={publicUrl}
                  readOnly
                  className="text-xs font-mono"
                />
                <Button
                  size="icon"
                  variant="outline"
                  onClick={copyLink}
                  className="shrink-0"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => window.open(publicUrl, '_blank')}
                  className="shrink-0"
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button onClick={() => handleClose(false)}>
                Fechar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
