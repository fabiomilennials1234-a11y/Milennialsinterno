import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { RotateCcw, Calendar, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  resetCount: number;
  checklistItems: string[];
  onReset: (reason: string, newDate?: string, failedItems?: string[]) => void;
  isResetting: boolean;
}

/**
 * Reset loop section for steps with has_reset_loop=true.
 * Shows reset count, requires reason + failed items selection + optional new date before resetting.
 */
export default function CrmResetLoopSection({ resetCount, checklistItems, onReset, isResetting }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [newDate, setNewDate] = useState('');
  const [failedItems, setFailedItems] = useState<string[]>([]);

  const toggleFailedItem = (item: string) => {
    setFailedItems(prev =>
      prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item]
    );
  };

  const handleReset = () => {
    if (!reason.trim()) return;
    onReset(reason.trim(), newDate || undefined, failedItems.length > 0 ? failedItems : undefined);
    setReason('');
    setNewDate('');
    setFailedItems([]);
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

          {/* Failed items selection (7.8) */}
          {checklistItems.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Qual(is) item(ns) travou(aram)?</label>
              <div className="space-y-1">
                {checklistItems.map(item => (
                  <label
                    key={item}
                    className={cn(
                      'flex items-start gap-2 p-1.5 rounded-md border cursor-pointer transition-all text-[11px]',
                      failedItems.includes(item)
                        ? 'bg-amber-500/10 border-amber-500/30'
                        : 'bg-background border-border/50 hover:border-amber-500/20'
                    )}
                  >
                    <Checkbox
                      checked={failedItems.includes(item)}
                      onCheckedChange={() => toggleFailedItem(item)}
                      className="mt-0.5"
                    />
                    <span className="leading-snug">{item}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

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
              onClick={() => { setIsOpen(false); setReason(''); setNewDate(''); setFailedItems([]); }}
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
