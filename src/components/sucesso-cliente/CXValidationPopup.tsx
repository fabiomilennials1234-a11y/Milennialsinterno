import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
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
import { useApproveCXValidation, useRejectCXValidation, type CXPendingClient } from '@/hooks/useCXValidation';
import { ShieldAlert, Phone } from 'lucide-react';

interface Props {
  client: CXPendingClient;
  isOpen: boolean;
  onClose: () => void;
}

const CHECKLIST_ITEMS = [
  'Alinhar quanto tempo demora o Onboarding (Até 12 dias).',
  'Alinhar Investimento/Resultado esperado.',
  'Alinhar Produção de criativos.',
  'Alinhar objetivos principais (É Lead, é venda, é Brading?).',
];

export default function CXValidationPopup({ client, isOpen, onClose }: Props) {
  const [checkedItems, setCheckedItems] = useState<boolean[]>(new Array(CHECKLIST_ITEMS.length).fill(false));
  const [notes, setNotes] = useState('');
  const [showConfirmApprove, setShowConfirmApprove] = useState(false);
  const [showRejectMessage, setShowRejectMessage] = useState(false);

  const approveValidation = useApproveCXValidation();
  const rejectValidation = useRejectCXValidation();

  const handleCheckToggle = (index: number) => {
    setCheckedItems(prev => {
      const next = [...prev];
      next[index] = !next[index];
      return next;
    });
  };

  const handleSimClick = () => {
    setShowConfirmApprove(true);
  };

  const handleConfirmApprove = async () => {
    await approveValidation.mutateAsync({ clientId: client.id, notes });
    setShowConfirmApprove(false);
    onClose();
  };

  const handleNaoClick = async () => {
    await rejectValidation.mutateAsync({ clientId: client.id, notes });
    setShowRejectMessage(true);
  };

  const handleRejectMessageClose = () => {
    setShowRejectMessage(false);
    onClose();
  };

  return (
    <>
      <Dialog open={isOpen && !showRejectMessage} onOpenChange={() => {}}>
        <DialogContent
          className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto [&>button.absolute]:hidden"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                <ShieldAlert className="text-destructive" size={20} />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold">PAPO DE CX.</DialogTitle>
                <Badge variant="outline" className="text-xs mt-1">
                  {client.name}
                </Badge>
              </div>
            </div>
            <DialogDescription className="text-sm mt-4 leading-relaxed">
              <span className="font-semibold text-foreground">Novo Cliente Milennials!!</span>{' '}
              Para o projeto iniciar, você deve ligar agora e alinhar a expectativa com o cliente, só assim iremos iniciar o atendimento.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 mt-2">
            {/* Informações do cliente */}
            <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg">
              <Phone size={14} className="text-muted-foreground" />
              <span className="text-sm font-medium">{client.name}</span>
              {client.niche && (
                <span className="text-xs text-muted-foreground">· {client.niche}</span>
              )}
            </div>

            {/* Checklist */}
            <div className="space-y-1">
              <p className="text-sm font-semibold">Checklist de expectativa:</p>
              <div className="space-y-3 mt-2">
                {CHECKLIST_ITEMS.map((item, index) => (
                  <label
                    key={index}
                    className="flex items-start gap-3 cursor-pointer group"
                  >
                    <Checkbox
                      checked={checkedItems[index]}
                      onCheckedChange={() => handleCheckToggle(index)}
                      className="mt-0.5"
                    />
                    <span className={`text-sm leading-tight ${checkedItems[index] ? 'line-through text-muted-foreground' : ''}`}>
                      {item}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Campo de observações */}
            <div className="space-y-2">
              <p className="text-sm font-semibold">Escreva aqui suas Observações</p>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Observações sobre o alinhamento com o cliente..."
                className="min-h-[80px] text-sm"
              />
            </div>

            {/* Pergunta final */}
            <div className="border-t pt-4">
              <p className="text-sm font-semibold mb-3">
                O Cliente está alinhado o suficiente para iniciarmos o projeto?
              </p>
              <div className="flex gap-3">
                <Button
                  onClick={handleSimClick}
                  className="flex-1"
                  disabled={approveValidation.isPending || rejectValidation.isPending}
                >
                  Sim
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleNaoClick}
                  className="flex-1"
                  disabled={approveValidation.isPending || rejectValidation.isPending}
                >
                  Não
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmação do "Sim" */}
      <AlertDialog open={showConfirmApprove} onOpenChange={setShowConfirmApprove}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>
              Ao confirmar, o cliente será liberado para início do projeto e a etiqueta
              "ESPERAR VALIDAÇÃO" será removida do Gestor de ADS.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmApprove}
              disabled={approveValidation.isPending}
            >
              Sim, liberar cliente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Mensagem do "Não" */}
      <AlertDialog open={showRejectMessage} onOpenChange={handleRejectMessageClose}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cliente pendente</AlertDialogTitle>
            <AlertDialogDescription>
              Avise imediatamente o comercial responsável pela venda.
              O cliente ficará na coluna de pendência até ser aprovado manualmente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={handleRejectMessageClose}>
              Entendi
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
