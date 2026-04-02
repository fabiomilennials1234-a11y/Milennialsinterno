import { useState } from 'react';
import { Users, UserCheck, MessageSquare, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { usePendingWelcomeTasks, useConfirmWelcomeTask, type WelcomeTask } from '@/hooks/useProjectManagerWelcomeTasks';

interface Answers {
  welcomedClient: boolean | null;
  presentedTeam: boolean | null;
  addedEveryoneToGroup: boolean | null;
}

const INITIAL_ANSWERS: Answers = {
  welcomedClient: null,
  presentedTeam: null,
  addedEveryoneToGroup: null,
};

const TEAM_LABELS: { key: keyof WelcomeTask['team']; label: string }[] = [
  { key: 'gestorProjetos', label: 'Gestor de Projetos' },
  { key: 'treinadorComercial', label: 'Treinador Comercial' },
  { key: 'gestorAds', label: 'Gestor de Ads' },
  { key: 'sucessoCliente', label: 'Sucesso do Cliente' },
  { key: 'consultorMarketplace', label: 'Consultor de Marketplace' },
  { key: 'gestorCM', label: 'Gestor de CM' },
];

export default function ProjectManagerWelcomeModal() {
  const { data: tasks = [], isLoading } = usePendingWelcomeTasks();
  const confirmTask = useConfirmWelcomeTask();
  const [answers, setAnswers] = useState<Answers>(INITIAL_ANSWERS);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentTask = tasks[0] || null;

  if (isLoading || !currentTask) return null;

  const canSubmit =
    answers.welcomedClient === true &&
    answers.presentedTeam === true &&
    answers.addedEveryoneToGroup === true;

  const handleConfirm = async () => {
    if (!canSubmit || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await confirmTask.mutateAsync({
        taskId: currentTask.id,
        welcomedClient: true,
        presentedTeam: true,
        addedEveryoneToGroup: true,
      });
      setAnswers(INITIAL_ANSWERS);
    } finally {
      setIsSubmitting(false);
    }
  };

  const setAnswer = (key: keyof Answers, value: boolean) => {
    setAnswers(prev => ({ ...prev, [key]: value }));
  };

  return (
    <Dialog open={!!currentTask} onOpenChange={() => {}}>
      <DialogContent
        className="sm:max-w-lg max-h-[90vh] overflow-y-auto border-primary/30"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-primary">
            <UserCheck className="h-5 w-5" />
            Boas-vindas Obrigatórias
          </DialogTitle>
          <DialogDescription className="text-sm">
            Antes de continuar, confirme a recepção do cliente e a apresentação da equipe.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          {/* Client info */}
          <div className="p-3 bg-primary/10 rounded-lg border border-primary/20">
            <p className="text-xs text-primary font-medium mb-1">Novo Cliente</p>
            <p className="text-base font-semibold text-foreground">
              {currentTask.clientName}
            </p>
          </div>

          {/* Team members */}
          <div className="p-3 bg-muted/50 rounded-lg space-y-2">
            <div className="flex items-center gap-2 mb-2">
              <Users size={14} className="text-primary" />
              <span className="text-sm font-medium">Equipe Responsável</span>
            </div>
            {TEAM_LABELS.map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between text-sm py-1">
                <span className="text-muted-foreground">{label}:</span>
                <span className={`font-medium ${currentTask.team[key] ? 'text-foreground' : 'text-destructive/70'}`}>
                  {currentTask.team[key] || 'Não definido'}
                </span>
              </div>
            ))}
          </div>

          {/* Questions */}
          <div className="space-y-4">
            <QuestionBlock
              icon={<MessageSquare size={14} className="text-primary" />}
              question="Você deu as boas-vindas ao cliente?"
              value={answers.welcomedClient}
              onChange={(v) => setAnswer('welcomedClient', v)}
            />
            <QuestionBlock
              icon={<Users size={14} className="text-primary" />}
              question="Você apresentou o time corretamente?"
              value={answers.presentedTeam}
              onChange={(v) => setAnswer('presentedTeam', v)}
            />
            <QuestionBlock
              icon={<CheckCircle2 size={14} className="text-primary" />}
              question="Você adicionou todas as pessoas responsáveis no grupo?"
              value={answers.addedEveryoneToGroup}
              onChange={(v) => setAnswer('addedEveryoneToGroup', v)}
            />
          </div>

          {/* Warning if any answer is No */}
          {(answers.welcomedClient === false || answers.presentedTeam === false || answers.addedEveryoneToGroup === false) && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
              <p className="text-xs text-destructive font-medium">
                Todas as confirmações devem ser "Sim" para prosseguir. Complete as ações pendentes antes de confirmar.
              </p>
            </div>
          )}

          {/* Submit */}
          <Button
            className="w-full"
            onClick={handleConfirm}
            disabled={!canSubmit || isSubmitting}
          >
            {isSubmitting ? 'Confirmando...' : 'Confirmar Boas-vindas'}
          </Button>

          {tasks.length > 1 && (
            <p className="text-xs text-center text-muted-foreground">
              +{tasks.length - 1} boas-vindas pendente{tasks.length > 2 ? 's' : ''}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function QuestionBlock({
  icon,
  question,
  value,
  onChange,
}: {
  icon: React.ReactNode;
  question: string;
  value: boolean | null;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="p-3 bg-muted/30 rounded-lg space-y-2">
      <Label className="text-sm font-medium flex items-center gap-2">
        {icon}
        {question} <span className="text-destructive">*</span>
      </Label>
      <RadioGroup
        value={value === null ? '' : value ? 'sim' : 'nao'}
        onValueChange={(v) => onChange(v === 'sim')}
        className="flex gap-4"
      >
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="sim" id={`${question}-sim`} />
          <Label htmlFor={`${question}-sim`} className="cursor-pointer">Sim</Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="nao" id={`${question}-nao`} />
          <Label htmlFor={`${question}-nao`} className="cursor-pointer">Não</Label>
        </div>
      </RadioGroup>
    </div>
  );
}
