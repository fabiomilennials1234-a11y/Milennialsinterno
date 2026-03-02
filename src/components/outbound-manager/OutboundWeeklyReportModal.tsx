import { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { FileText, Send, Users, Flame, TrendingUp, TrendingDown, ShoppingCart, XCircle, Lightbulb } from 'lucide-react';

interface ReportData {
  leads_abordados: string;
  leads_quentes: string;
  taxa_conversao: string;
  taxa_noshow: string;
  vendas: string;
  perdidos: string;
  melhorias: string;
}

interface OutboundWeeklyReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientName: string;
  initialData?: ReportData;
  onSave: (data: ReportData) => void;
  isSaving?: boolean;
}

const EMPTY_DATA: ReportData = {
  leads_abordados: '',
  leads_quentes: '',
  taxa_conversao: '',
  taxa_noshow: '',
  vendas: '',
  perdidos: '',
  melhorias: '',
};

export function parseReportFromDescription(description: string | undefined): ReportData {
  if (!description) return EMPTY_DATA;
  try {
    const parsed = JSON.parse(description);
    if (parsed && typeof parsed === 'object' && 'leads_abordados' in parsed && 'taxa_noshow' in parsed) {
      return parsed as ReportData;
    }
  } catch {
    // not JSON
  }
  return EMPTY_DATA;
}

export default function OutboundWeeklyReportModal({
  isOpen,
  onClose,
  clientName,
  initialData,
  onSave,
  isSaving = false,
}: OutboundWeeklyReportModalProps) {
  const [form, setForm] = useState<ReportData>(initialData || EMPTY_DATA);

  useEffect(() => {
    if (isOpen) {
      setForm(initialData || EMPTY_DATA);
    }
  }, [isOpen, initialData]);

  const fields = [
    { key: 'leads_abordados' as const, label: 'Leads Abordados', placeholder: 'Total de leads abordados na semana', icon: Users, type: 'input' },
    { key: 'leads_quentes' as const, label: 'Leads Quentes', placeholder: 'Leads quentes identificados', icon: Flame, type: 'input' },
    { key: 'taxa_conversao' as const, label: 'Taxa de Conversão', placeholder: 'Ex: 15%, 8 de 50...', icon: TrendingUp, type: 'input' },
    { key: 'taxa_noshow' as const, label: 'Taxa de No-show', placeholder: 'Ex: 10%, 3 de 30...', icon: TrendingDown, type: 'input' },
    { key: 'vendas' as const, label: 'Vendas', placeholder: 'Vendas fechadas na semana', icon: ShoppingCart, type: 'input' },
    { key: 'perdidos' as const, label: 'Perdidos', placeholder: 'Leads perdidos na semana', icon: XCircle, type: 'input' },
    { key: 'melhorias' as const, label: 'O que pode melhorar ou fazer para entregar resultado ao cliente?', placeholder: 'Descreva ações de melhoria...', icon: Lightbulb, type: 'textarea' },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg p-0 gap-0 bg-card border-subtle overflow-hidden shadow-apple-lg">
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-orange-500/10 to-red-500/10 border-b border-subtle">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-orange-500/20 flex items-center justify-center">
              <FileText className="text-orange-400" size={24} />
            </div>
            <div>
              <span className="text-xs font-medium text-orange-400 uppercase tracking-wider">
                Sexta-feira
              </span>
              <h2 className="text-lg font-bold text-foreground">
                Relatório Interno — {clientName}
              </h2>
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
          <p className="text-xs text-muted-foreground bg-muted/50 px-3 py-2 rounded-lg">
            Preencha o relatório da semana puxando todas as informações do cliente.
          </p>
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
              Este relatório deve ser preenchido toda sexta ao final do dia.
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
