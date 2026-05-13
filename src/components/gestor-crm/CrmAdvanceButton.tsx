import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { CheckCircle2, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  canAdvance: boolean;
  blockers: string[];
  onAdvance: () => void;
  isLoading?: boolean;
  isFinalized?: boolean;
}

/**
 * "Concluir etapa" button. Disabled with tooltip when blocked.
 * Shows lock icon + blocker list on hover.
 */
export default function CrmAdvanceButton({
  canAdvance,
  blockers,
  onAdvance,
  isLoading,
  isFinalized,
}: Props) {
  if (isFinalized) {
    return (
      <div className="flex items-center gap-1.5 text-emerald-600 text-sm font-medium">
        <CheckCircle2 size={16} />
        Finalizado
      </div>
    );
  }

  const button = (
    <Button
      size="sm"
      disabled={!canAdvance || isLoading}
      onClick={onAdvance}
      className={cn(
        'gap-1.5 font-semibold transition-all',
        canAdvance
          ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
          : 'bg-muted text-muted-foreground cursor-not-allowed'
      )}
    >
      {!canAdvance && <Lock size={12} />}
      {canAdvance && <CheckCircle2 size={14} />}
      {isLoading ? 'Avancando...' : 'Concluir etapa'}
    </Button>
  );

  if (!canAdvance && blockers.length > 0) {
    return (
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span>{button}</span>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <p className="text-[11px] font-semibold mb-1">Pendencias para avancar:</p>
            <ul className="text-[11px] space-y-0.5 list-disc pl-3">
              {blockers.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return button;
}
