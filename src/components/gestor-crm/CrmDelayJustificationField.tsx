import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { AlertTriangle, Send, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  currentJustification: string | null;
  justifiedAt: string | null;
  onSave: (justification: string) => void;
  isSaving: boolean;
}

/**
 * Inline delay justification field. Appears when step deadline is overdue.
 * If already justified, shows the justification read-only with timestamp.
 * Otherwise shows a textarea + save button.
 */
export default function CrmDelayJustificationField({
  currentJustification,
  justifiedAt,
  onSave,
  isSaving,
}: Props) {
  const [text, setText] = useState(currentJustification || '');
  const hasJustification = !!currentJustification && currentJustification.trim() !== '';

  if (hasJustification) {
    return (
      <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20 space-y-1.5">
        <div className="flex items-center gap-1.5 text-xs text-amber-700 font-medium">
          <CheckCircle2 size={12} />
          Atraso justificado
          {justifiedAt && (
            <span className="text-[10px] text-muted-foreground font-normal ml-auto">
              {new Date(justifiedAt).toLocaleDateString('pt-BR')}{' '}
              {new Date(justifiedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
        <p className="text-sm text-foreground/80 leading-relaxed">{currentJustification}</p>
      </div>
    );
  }

  return (
    <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/20 space-y-2">
      <div className="flex items-center gap-1.5 text-xs text-destructive font-semibold">
        <AlertTriangle size={12} />
        Etapa estourada — justifique o atraso
      </div>
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Descreva o motivo do atraso..."
        className={cn(
          'text-sm min-h-[60px] resize-none',
          'border-destructive/30 focus:border-destructive/50'
        )}
        rows={2}
      />
      <div className="flex justify-end">
        <Button
          size="sm"
          variant="outline"
          disabled={!text.trim() || isSaving}
          onClick={() => onSave(text.trim())}
          className="gap-1.5 text-xs border-destructive/30 text-destructive hover:bg-destructive/10"
        >
          <Send size={12} />
          {isSaving ? 'Salvando...' : 'Justificar'}
        </Button>
      </div>
    </div>
  );
}
