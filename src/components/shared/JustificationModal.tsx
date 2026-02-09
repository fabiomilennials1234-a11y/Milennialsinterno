import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { AlertTriangle, Loader2 } from 'lucide-react';

interface JustificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (justification: string) => Promise<void>;
  taskTitle?: string;
  existingJustification?: string | null;
  isPending?: boolean;
}

export default function JustificationModal({
  isOpen,
  onClose,
  onSubmit,
  taskTitle,
  existingJustification,
  isPending = false,
}: JustificationModalProps) {
  const [justification, setJustification] = useState(existingJustification || '');

  const handleSubmit = async () => {
    if (!justification.trim()) return;
    await onSubmit(justification.trim());
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-warning/20 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-warning" />
            </div>
            <div>
              <DialogTitle>Justificar Atraso</DialogTitle>
              <DialogDescription>
                {taskTitle ? `Tarefa: ${taskTitle}` : 'Informe o motivo do atraso'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div className="bg-warning/10 border border-warning/30 rounded-lg p-3">
            <p className="text-sm text-warning font-medium">
              ⚠️ Esta tarefa está atrasada. Por favor, justifique o motivo.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="justification">Justificativa</Label>
            <Textarea
              id="justification"
              placeholder="Explique o motivo do atraso..."
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              className="min-h-[120px]"
              maxLength={1000}
            />
            <p className="text-xs text-muted-foreground text-right">
              {justification.length}/1000 caracteres
            </p>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancelar
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={!justification.trim() || isPending}
              className="flex-1 gap-2"
            >
              {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Salvar Justificativa
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
