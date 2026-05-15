import { useState, useCallback } from 'react';
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
import { Separator } from '@/components/ui/separator';
import { Loader2, Check, ThumbsUp, Link2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useCreateClientNps, useCreateClientNpsLink, getNpsClassification, getNpsColor, getNpsLabel } from '@/hooks/useClientNps';

interface ClientNpsFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: string;
  clientName: string;
}

export default function ClientNpsFormModal({
  isOpen,
  onClose,
  clientId,
  clientName,
}: ClientNpsFormModalProps) {
  const [score, setScore] = useState<number | null>(null);
  const [reason, setReason] = useState('');
  const createNps = useCreateClientNps();
  const createLink = useCreateClientNpsLink();

  const referenceMonth = new Date().toISOString().slice(0, 7);

  const handleGenerateLink = useCallback(async () => {
    try {
      const result = await createLink.mutateAsync({
        client_id: clientId,
        reference_month: referenceMonth,
      });
      if (result?.public_token) {
        const url = `${window.location.origin}/nps-cliente/${result.public_token}`;
        await navigator.clipboard.writeText(url);
        toast.success('Link copiado! Envie para o cliente.');
      }
    } catch {
      // Error handled by mutation
    }
  }, [clientId, createLink, referenceMonth]);

  const handleSubmit = useCallback(async () => {
    if (score === null) return;

    await createNps.mutateAsync({
      client_id: clientId,
      nps_score: score,
      score_reason: reason || null,
      reference_month: referenceMonth,
    });

    setScore(null);
    setReason('');
    onClose();
  }, [clientId, createNps, onClose, reason, referenceMonth, score]);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        setScore(null);
        setReason('');
        onClose();
      }
    },
    [onClose],
  );

  const classification = score !== null ? getNpsClassification(score) : null;

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-500/10 flex items-center justify-center">
              <ThumbsUp className="w-4 h-4 text-teal-400" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">Registrar NPS</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                {clientName} — {referenceMonth}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          {/* NPS Score selector */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Nota NPS (0-10)</Label>
            <div className="flex gap-1.5 flex-wrap">
              {Array.from({ length: 11 }, (_, i) => i).map((n) => {
                const nClass = getNpsClassification(n);
                const isSelected = score === n;
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setScore(n)}
                    className={cn(
                      'w-10 h-10 rounded-lg text-sm font-bold transition-all duration-150 border',
                      isSelected
                        ? nClass === 'promotor'
                          ? 'bg-emerald-500 text-white border-emerald-400 shadow-lg shadow-emerald-500/20'
                          : nClass === 'neutro'
                            ? 'bg-amber-500 text-white border-amber-400 shadow-lg shadow-amber-500/20'
                            : 'bg-red-500 text-white border-red-400 shadow-lg shadow-red-500/20'
                        : 'bg-muted/50 border-border text-muted-foreground hover:bg-muted hover:text-foreground',
                    )}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
            {classification && (
              <p className={cn('text-xs font-medium', getNpsColor(classification))}>
                {getNpsLabel(classification)} ({score})
              </p>
            )}
          </div>

          {/* Reason */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Motivo</Label>
            <Textarea
              placeholder="Por que o cliente deu essa nota? (opcional)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="min-h-[80px] text-sm"
            />
          </div>

          {/* Reference month display */}
          <div className="p-3 rounded-lg bg-muted/30 border border-muted-foreground/10">
            <p className="text-xs text-muted-foreground">
              Mes de referencia: <span className="font-medium text-foreground">{referenceMonth}</span>
            </p>
          </div>

          {/* Submit — GP registra direto */}
          <Button
            className="w-full gap-1.5 bg-teal-600 hover:bg-teal-700 text-white"
            onClick={handleSubmit}
            disabled={score === null || createNps.isPending}
          >
            {createNps.isPending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Check size={14} />
            )}
            Registrar NPS
          </Button>

          <Separator className="my-1" />

          {/* Gerar Link — cliente responde pela pagina publica */}
          <Button
            variant="outline"
            className="w-full gap-1.5 text-sm"
            onClick={handleGenerateLink}
            disabled={createLink.isPending}
          >
            {createLink.isPending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Link2 size={14} />
            )}
            Gerar Link para Cliente
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
