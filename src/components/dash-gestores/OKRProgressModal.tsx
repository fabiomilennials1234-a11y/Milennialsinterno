import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { useOKRs, OKR } from '@/hooks/useOKRs';
import { Loader2, CheckCircle2, Trash2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface OKRProgressModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  okr: OKR | null;
}

export default function OKRProgressModal({ open, onOpenChange, okr }: OKRProgressModalProps) {
  const { updateOKR, deleteOKR } = useOKRs();
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (okr) {
      // Use current_value as percentage (0-100)
      setProgress(okr.current_value ?? 0);
    }
  }, [okr]);

  if (!okr) return null;

  const handleSave = async () => {
    await updateOKR.mutateAsync({
      id: okr.id,
      current_value: progress,
      target_value: 100, // Always use 100 as target for percentage
    });
    onOpenChange(false);
  };

  const handleComplete = async () => {
    await updateOKR.mutateAsync({
      id: okr.id,
      current_value: 100,
      target_value: 100,
      status: 'completed',
    });
    onOpenChange(false);
  };

  const handleDelete = async () => {
    if (confirm('Tem certeza que deseja arquivar este OKR?')) {
      await deleteOKR.mutateAsync(okr.id);
      onOpenChange(false);
    }
  };

  const quickButtons = [0, 25, 50, 75, 100];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="pr-8">{okr.title}</DialogTitle>
          {okr.description && (
            <DialogDescription>{okr.description}</DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-6 pt-2">
          {okr.end_date && (
            <div className="text-sm text-muted-foreground">
              Prazo: <span className="font-medium text-foreground">
                {new Date(okr.end_date).toLocaleDateString('pt-BR')}
              </span>
            </div>
          )}

          {/* Progress Display */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <Label>Progresso</Label>
              <span className="text-2xl font-bold text-primary">{progress}%</span>
            </div>
            <Progress value={progress} className="h-4" />
          </div>

          {/* Slider */}
          <div className="space-y-3">
            <Slider
              value={[progress]}
              onValueChange={(value) => setProgress(value[0])}
              max={100}
              step={5}
              className="w-full"
            />
          </div>

          {/* Quick Buttons */}
          <div className="flex gap-2 justify-center">
            {quickButtons.map((value) => (
              <Button
                key={value}
                variant={progress === value ? "default" : "outline"}
                size="sm"
                onClick={() => setProgress(value)}
                className="flex-1"
              >
                {value}%
              </Button>
            ))}
          </div>

          {/* Manual Input */}
          <div className="flex items-center gap-2">
            <Label htmlFor="manualProgress" className="whitespace-nowrap">Valor exato:</Label>
            <Input
              id="manualProgress"
              type="number"
              value={progress}
              onChange={(e) => setProgress(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
              min="0"
              max="100"
              className="w-20"
            />
            <span className="text-muted-foreground">%</span>
          </div>

          <div className="flex justify-between gap-2 pt-4 border-t">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              disabled={deleteOKR.isPending}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Arquivar
            </Button>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleComplete}
                disabled={updateOKR.isPending}
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Concluir
              </Button>
              <Button onClick={handleSave} disabled={updateOKR.isPending}>
                {updateOKR.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Salvar
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
