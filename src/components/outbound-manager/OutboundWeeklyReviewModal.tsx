import { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Target, Send, ClipboardList, Lightbulb } from 'lucide-react';

interface ReviewData {
  relatorio_semana_anterior: string;
  plano_proxima_semana: string;
}

interface OutboundWeeklyReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientName: string;
  initialData?: ReviewData;
  onSave: (data: ReviewData) => void;
  isSaving?: boolean;
}

const EMPTY_DATA: ReviewData = {
  relatorio_semana_anterior: '',
  plano_proxima_semana: '',
};

export function parseReviewFromDescription(description: string | undefined): ReviewData {
  if (!description) return EMPTY_DATA;
  try {
    const parsed = JSON.parse(description);
    if (parsed && typeof parsed === 'object' && 'relatorio_semana_anterior' in parsed) {
      return parsed as ReviewData;
    }
  } catch {
    // not JSON
  }
  return EMPTY_DATA;
}

export default function OutboundWeeklyReviewModal({
  isOpen,
  onClose,
  clientName,
  initialData,
  onSave,
  isSaving = false,
}: OutboundWeeklyReviewModalProps) {
  const [form, setForm] = useState<ReviewData>(initialData || EMPTY_DATA);

  useEffect(() => {
    if (isOpen) {
      setForm(initialData || EMPTY_DATA);
    }
  }, [isOpen, initialData]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg p-0 gap-0 bg-card border-subtle overflow-hidden shadow-apple-lg">
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border-b border-subtle">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
              <Target className="text-blue-400" size={24} />
            </div>
            <div>
              <span className="text-xs font-medium text-blue-400 uppercase tracking-wider">
                Segunda-feira
              </span>
              <h2 className="text-lg font-bold text-foreground">
                Revisão de Metas — {clientName}
              </h2>
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="p-6 space-y-5 max-h-[60vh] overflow-y-auto">
          <p className="text-xs text-muted-foreground bg-muted/50 px-3 py-2 rounded-lg">
            Toda segunda, chame o cliente no início do dia com o relatório da semana anterior e o plano para a próxima semana.
          </p>

          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-sm font-medium text-foreground">
              <ClipboardList size={14} className="text-muted-foreground" />
              Como foi a semana anterior?
            </label>
            <Textarea
              value={form.relatorio_semana_anterior}
              onChange={(e) => setForm((prev) => ({ ...prev, relatorio_semana_anterior: e.target.value }))}
              placeholder="Resultados, métricas, o que aconteceu na semana passada..."
              className="input-apple text-sm min-h-[120px] resize-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Lightbulb size={14} className="text-muted-foreground" />
              O que você pensou em fazer de diferente para a próxima semana?
            </label>
            <Textarea
              value={form.plano_proxima_semana}
              onChange={(e) => setForm((prev) => ({ ...prev, plano_proxima_semana: e.target.value }))}
              placeholder="Estratégias, ajustes, novas abordagens planejadas..."
              className="input-apple text-sm min-h-[120px] resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex items-center justify-between">
          <div className="p-2.5 bg-info/10 border border-info/20 rounded-xl flex-1 mr-3">
            <p className="text-xs text-info font-medium">
              Envie este relatório ao cliente no início de toda segunda-feira.
            </p>
          </div>
          <Button onClick={() => onSave(form)} disabled={isSaving} className="btn-cta gap-2 shrink-0">
            <Send size={14} />
            {isSaving ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
