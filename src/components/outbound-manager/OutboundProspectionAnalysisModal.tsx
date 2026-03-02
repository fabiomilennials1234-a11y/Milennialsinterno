import { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { BarChart3, Send, Users, MessageCircle, Flame, TrendingUp, Wrench } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AnalysisData {
  leads_abordados: string;
  whatsapp_bloqueado: string;
  leads_quentes: string;
  taxa_conversao: string;
  precisa_ajuste: string;
}

interface OutboundProspectionAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientName: string;
  initialData?: AnalysisData;
  onSave: (data: AnalysisData) => void;
  isSaving?: boolean;
}

const EMPTY_DATA: AnalysisData = {
  leads_abordados: '',
  whatsapp_bloqueado: '',
  leads_quentes: '',
  taxa_conversao: '',
  precisa_ajuste: '',
};

function parseAnalysisFromDescription(description: string | undefined): AnalysisData {
  if (!description) return EMPTY_DATA;
  try {
    const parsed = JSON.parse(description);
    if (parsed && typeof parsed === 'object' && 'leads_abordados' in parsed) {
      return parsed as AnalysisData;
    }
  } catch {
    // not JSON, ignore
  }
  return EMPTY_DATA;
}

export { parseAnalysisFromDescription };

export default function OutboundProspectionAnalysisModal({
  isOpen,
  onClose,
  clientName,
  initialData,
  onSave,
  isSaving = false,
}: OutboundProspectionAnalysisModalProps) {
  const [form, setForm] = useState<AnalysisData>(initialData || EMPTY_DATA);

  useEffect(() => {
    if (isOpen) {
      setForm(initialData || EMPTY_DATA);
    }
  }, [isOpen, initialData]);

  const handleSubmit = () => {
    onSave(form);
  };

  const fields = [
    {
      key: 'leads_abordados' as const,
      label: 'Leads Abordados',
      placeholder: 'Quantos leads foram abordados hoje?',
      icon: Users,
      type: 'input',
    },
    {
      key: 'whatsapp_bloqueado' as const,
      label: 'WhatsApp Bloqueado?',
      placeholder: 'Sim / Não — Se sim, quantos?',
      icon: MessageCircle,
      type: 'input',
    },
    {
      key: 'leads_quentes' as const,
      label: 'Leads Quentes Entregues ao Cliente',
      placeholder: 'Quantos leads quentes foram entregues?',
      icon: Flame,
      type: 'input',
    },
    {
      key: 'taxa_conversao' as const,
      label: 'Taxa de Conversão',
      placeholder: 'Ex: 12%, 5 de 40...',
      icon: TrendingUp,
      type: 'input',
    },
    {
      key: 'precisa_ajuste' as const,
      label: 'Precisa ser feito ajuste? Se sim, qual?',
      placeholder: 'Descreva os ajustes necessários ou escreva "Não"...',
      icon: Wrench,
      type: 'textarea',
    },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg p-0 gap-0 bg-card border-subtle overflow-hidden shadow-apple-lg">
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-purple-500/10 to-primary/10 border-b border-subtle">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
              <BarChart3 className="text-purple-400" size={24} />
            </div>
            <div>
              <span className="text-xs font-medium text-purple-400 uppercase tracking-wider">
                Análise Diária
              </span>
              <h2 className="text-lg font-bold text-foreground">
                Prospecção — {clientName}
              </h2>
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
          {fields.map((field) => {
            const Icon = field.icon;
            return (
              <div key={field.key} className="space-y-1.5">
                <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Icon size={14} className="text-muted-foreground" />
                  {field.label}
                </label>
                {field.type === 'textarea' ? (
                  <Textarea
                    value={form[field.key]}
                    onChange={(e) => setForm((prev) => ({ ...prev, [field.key]: e.target.value }))}
                    placeholder={field.placeholder}
                    className="input-apple text-sm min-h-[80px] resize-none"
                  />
                ) : (
                  <Input
                    value={form[field.key]}
                    onChange={(e) => setForm((prev) => ({ ...prev, [field.key]: e.target.value }))}
                    placeholder={field.placeholder}
                    className="input-apple text-sm"
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex items-center justify-between">
          <div className="p-2.5 bg-info/10 border border-info/20 rounded-xl flex-1 mr-3">
            <p className="text-xs text-info font-medium">
              Preencha os dados da prospecção do dia para este cliente.
            </p>
          </div>
          <Button
            onClick={handleSubmit}
            disabled={isSaving}
            className="btn-cta gap-2 shrink-0"
          >
            <Send size={14} />
            {isSaving ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
