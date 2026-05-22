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
import { TrendingUp, Loader2, Copy, ExternalLink, Check } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ClientGrowthCreateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ClientGrowthCreateModal({ open, onOpenChange }: ClientGrowthCreateModalProps) {
  const [referenceDate, setReferenceDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [createdSurvey, setCreatedSurvey] = useState<NPSSurvey | null>(null);
  const [copied, setCopied] = useState(false);

  const createSurvey = useCreateNPSSurvey();

  const handleGenerate = async () => {
    const dateLabel = format(new Date(referenceDate + 'T12:00:00'), "dd/MM/yyyy");
    const title = `Pesquisa Growth | ${dateLabel}`;

    try {
      const survey = await createSurvey.mutateAsync({
        title,
        description: `Pesquisa mensal de evolução e experiência dos clientes — referência: ${dateLabel}`,
        surveyType: 'client_growth',
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
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <TrendingUp className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <DialogTitle>Nova Pesquisa Growth</DialogTitle>
              <DialogDescription>
                Gere um link de pesquisa mensal para os clientes
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {!createdSurvey ? (
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="growth-ref-date">Data de referência</Label>
              <Input
                id="growth-ref-date"
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
                <li>Resultados e evolução nos últimos 30 dias</li>
                <li>Maior desafio da empresa (múltipla escolha)</li>
                <li>Alinhamento com objetivos</li>
                <li>O que manter ou fortalecer</li>
                <li>Sugestões de melhoria</li>
                <li>Objetivo principal próximos meses</li>
                <li>NPS — recomendação 0 a 10</li>
              </ul>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => handleClose(false)}>
                Cancelar
              </Button>
              <Button onClick={handleGenerate} disabled={createSurvey.isPending}>
                {createSurvey.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
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
              <p className="text-xs text-muted-foreground mt-1">{createdSurvey.title}</p>
            </div>

            <div className="space-y-2">
              <Label>Link público</Label>
              <div className="flex gap-2">
                <Input value={publicUrl} readOnly className="text-xs font-mono" />
                <Button size="icon" variant="outline" onClick={copyLink} className="shrink-0">
                  {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
                <Button size="icon" variant="outline" onClick={() => window.open(publicUrl, '_blank')} className="shrink-0">
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button onClick={() => handleClose(false)}>Fechar</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
