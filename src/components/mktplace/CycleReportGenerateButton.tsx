import { BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface Props {
  trackingType: 'consultoria' | 'gestao';
  onGenerate: () => void;
  className?: string;
}

const LABELS: Record<Props['trackingType'], string> = {
  consultoria: 'Gerar Relatorio de Consultoria',
  gestao: 'Gerar Relatorio de Gestao',
};

export default function CycleReportGenerateButton({ trackingType, onGenerate, className }: Props) {
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={`h-6 text-[10px] gap-1 border-purple-500/30 text-purple-400 hover:bg-purple-500/10 ${className || ''}`}
            onClick={onGenerate}
          >
            <BarChart3 size={10} />
            {LABELS[trackingType]}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          Gerar relatorio de ciclo para este cliente
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
