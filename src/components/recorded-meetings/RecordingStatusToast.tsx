import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { getAssemblyLabel } from './recordingUtils';
import type { AssemblyStage } from '@/hooks/useRecordingAssembly';

export interface RecordingStatusToastProps {
  variant: 'processing' | 'done' | 'error';
  assemblyStage: AssemblyStage;
  errorMessage: string | null;
  onDismiss: () => void;
}

export function RecordingStatusToast({
  variant,
  assemblyStage,
  errorMessage,
  onDismiss,
}: RecordingStatusToastProps) {
  if (variant === 'processing') {
    return (
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 px-5 py-3 rounded-2xl bg-card border border-border shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-200 min-w-[280px]">
        <Loader2 size={18} className="text-primary animate-spin shrink-0" />
        <p className="text-sm font-medium text-foreground">{getAssemblyLabel(assemblyStage)}</p>
      </div>
    );
  }

  if (variant === 'done') {
    return (
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl bg-card border border-emerald-500/30 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-200">
        <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
        <span className="text-sm font-medium text-foreground">Gravacao salva!</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDismiss}
          className="h-7 text-xs"
        >
          Fechar
        </Button>
      </div>
    );
  }

  // variant === 'error'
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl bg-card border border-destructive/30 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-200 max-w-md">
      <AlertCircle size={18} className="text-destructive shrink-0" />
      <span className="text-sm text-foreground flex-1 truncate">
        {errorMessage || 'Erro desconhecido'}
      </span>
      <Button
        variant="ghost"
        size="sm"
        onClick={onDismiss}
        className="h-7 text-xs shrink-0"
      >
        Fechar
      </Button>
    </div>
  );
}
