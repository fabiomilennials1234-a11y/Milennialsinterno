import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RotateCcw, Calendar, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  resetCount: number;
  onReset: (reason: string, newDate?: string) => void;
  isResetting: boolean;
}

/**
 * Reset loop section for steps with has_reset_loop=true.
 * Shows reset count, requires reason + optional new date before resetting.
 */
export default function CrmResetLoopSection({ resetCount, onReset, isResetting }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [newDate, setNewDate] = useState('');

  const handleReset = () => {
    if (!reason.trim()) return;
    onReset(reason.trim(), newDate || undefined);
    setReason('');
    setNewDate('');
    setIsOpen(false);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <RotateCcw size={14} className="text-muted-foreground" />
          <span className="text-xs text-muted-foreground">
            Reset loop
            {resetCount > 0 && (
              <span className="ml-1.5 text-amber-600 font-semibold">
                ({resetCount} reset{resetCount > 1 ? 's' : ''})
              </span>
            )}
          </span>
        </div>
        {!isOpen && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsOpen(true)}
            className="h-7 text-[11px] gap-1 border-amber-500/30 text-amber-700 hover:bg-amber-500/10"
          >
            <RotateCcw size={11} />
            Resetar etapa
          </Button>
        )}
      </div>

      {isOpen && (
        <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20 space-y-3">
          <div className="flex items-start gap-1.5 text-xs text-amber-700">
            <AlertCircle size={12} className="mt-0.5 shrink-0" />
            Checklist sera zerado e uma nova tarefa de reagendamento sera criada.
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground">Motivo do reset *</label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex: Cliente nao compareceu a call..."
              className="text-sm min-h-[50px] resize-none"
              rows={2}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground flex items-center gap-1">
              <Calendar size={11} />
              Nova data (reagendamento)
            </label>
            <Input
              type="datetime-local"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="h-9 text-sm"
            />
          </div>

          <div className="flex gap-2 justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setIsOpen(false); setReason(''); setNewDate(''); }}
              className="h-7 text-[11px]"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              disabled={!reason.trim() || isResetting}
              onClick={handleReset}
              className={cn(
                'h-7 text-[11px] gap-1',
                'bg-amber-500 hover:bg-amber-600 text-slate-900'
              )}
            >
              <RotateCcw size={11} />
              {isResetting ? 'Resetando...' : 'Confirmar reset'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
