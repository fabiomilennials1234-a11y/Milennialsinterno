import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AlertTriangle, Send, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DELAY_CATEGORIES } from '@/lib/crmDelayCategories';

interface Props {
  currentJustification: string | null;
  currentCategory: string | null;
  justifiedAt: string | null;
  onSave: (justification: string, category: string) => void;
  isSaving: boolean;
}

/**
 * Inline delay justification field with categorized dropdown.
 * Appears when step deadline is overdue.
 * If already justified, shows read-only with category + timestamp.
 * Otherwise shows category dropdown + textarea + save button.
 */
export default function CrmDelayJustificationField({
  currentJustification,
  currentCategory,
  justifiedAt,
  onSave,
  isSaving,
}: Props) {
  const [text, setText] = useState(currentJustification || '');
  const [category, setCategory] = useState<string>(currentCategory || '');
  const hasJustification = !!currentJustification && currentJustification.trim() !== '';

  const categoryLabel = DELAY_CATEGORIES.find(c => c.value === currentCategory)?.label || currentCategory;

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
        {categoryLabel && (
          <p className="text-[11px] font-semibold text-amber-600">{categoryLabel}</p>
        )}
        <p className="text-sm text-foreground/80 leading-relaxed">{currentJustification}</p>
      </div>
    );
  }

  const canSave = text.trim() !== '' && category !== '';

  return (
    <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/20 space-y-2">
      <div className="flex items-center gap-1.5 text-xs text-destructive font-semibold">
        <AlertTriangle size={12} />
        Etapa estourada — justifique o atraso
      </div>

      <div className="space-y-1">
        <label className="text-[11px] font-medium text-muted-foreground">Motivo</label>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="h-8 text-sm">
            <SelectValue placeholder="Selecione o motivo..." />
          </SelectTrigger>
          <SelectContent>
            {DELAY_CATEGORIES.map(cat => (
              <SelectItem key={cat.value} value={cat.value}>
                {cat.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Detalhes complementares..."
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
          disabled={!canSave || isSaving}
          onClick={() => onSave(text.trim(), category)}
          className="gap-1.5 text-xs border-destructive/30 text-destructive hover:bg-destructive/10"
        >
          <Send size={12} />
          {isSaving ? 'Salvando...' : 'Justificar'}
        </Button>
      </div>
    </div>
  );
}
