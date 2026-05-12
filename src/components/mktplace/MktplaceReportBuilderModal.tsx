import { useState } from 'react';
import { FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useCreateMktplaceRelatorio } from '@/hooks/useMktplaceRelatorios';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onClose: () => void;
  clientId: string;
  clientName: string;
  trackingType: 'consultoria' | 'gestao';
}

interface FormData {
  acoes_realizadas: string;
  resultados: string;
  metricas_chave: string;
  pontos_melhoria: string;
  proximos_passos: string;
  resumo: string;
  observacoes: string;
  titulo: string;
  feedback_cliente: string;
  // Gestao-only
  saude_contas: string;
  status_logistica: string;
  situacao_estoque: string;
}

const INITIAL_FORM: FormData = {
  acoes_realizadas: '',
  resultados: '',
  metricas_chave: '',
  pontos_melhoria: '',
  proximos_passos: '',
  resumo: '',
  observacoes: '',
  titulo: '',
  feedback_cliente: '',
  saude_contas: '',
  status_logistica: '',
  situacao_estoque: '',
};

interface FieldDef {
  key: keyof FormData;
  label: string;
  placeholder: string;
  gestaoOnly?: boolean;
}

const FIELDS: FieldDef[] = [
  { key: 'acoes_realizadas', label: 'Acoes realizadas no periodo', placeholder: 'Descreva as acoes executadas durante o periodo...' },
  { key: 'resultados', label: 'Resultados obtidos', placeholder: 'Resultados alcancados no periodo...' },
  { key: 'metricas_chave', label: 'Metricas de desempenho (vendas, faturamento, conversao)', placeholder: 'Principais metricas do periodo...' },
  { key: 'pontos_melhoria', label: 'Pontos de melhoria identificados', placeholder: 'O que precisa ser ajustado...' },
  { key: 'proximos_passos', label: 'Proximos passos recomendados', placeholder: 'Acoes recomendadas para o proximo ciclo...' },
  { key: 'resumo', label: 'Resumo executivo do periodo', placeholder: 'Resumo geral do acompanhamento...' },
  { key: 'observacoes', label: 'Observacoes gerais', placeholder: 'Observacoes adicionais...' },
  { key: 'titulo', label: 'Campanha/produto destaque do periodo', placeholder: 'Campanha ou produto que mais se destacou...' },
  { key: 'feedback_cliente', label: 'Feedback do cliente sobre o acompanhamento', placeholder: 'O que o cliente disse sobre o trabalho...' },
  // Gestao-only
  { key: 'saude_contas', label: 'Saude das contas nos marketplaces (ML, Amazon, Shopee, Magalu, B2W)', placeholder: 'Status de cada marketplace...', gestaoOnly: true },
  { key: 'status_logistica', label: 'Status da logistica e fulfillment', placeholder: 'Situacao da logistica, prazos, fulfillment...', gestaoOnly: true },
  { key: 'situacao_estoque', label: 'Situacao de estoque e rupturas', placeholder: 'Niveis de estoque, rupturas identificadas...', gestaoOnly: true },
];

export default function MktplaceReportBuilderModal({ open, onClose, clientId, clientName, trackingType }: Props) {
  const [form, setForm] = useState<FormData>({ ...INITIAL_FORM });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const createReport = useCreateMktplaceRelatorio();

  const isGestao = trackingType === 'gestao';
  const cycleDays = isGestao ? 15 : 30;
  const visibleFields = FIELDS.filter(f => !f.gestaoOnly || isGestao);

  function validate(): boolean {
    for (const field of visibleFields) {
      if (!form[field.key].trim()) {
        toast.error(`Campo obrigatorio: ${field.label}`);
        return false;
      }
    }
    return true;
  }

  async function handleSubmit() {
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await createReport.mutateAsync({
        clientId,
        reportType: trackingType,
        titulo: form.titulo,
        resumo: form.resumo,
        acoes_realizadas: form.acoes_realizadas,
        resultados: form.resultados,
        metricas_chave: form.metricas_chave,
        pontos_melhoria: form.pontos_melhoria,
        proximos_passos: form.proximos_passos,
        observacoes: form.observacoes,
        feedback_cliente: form.feedback_cliente,
        ...(isGestao ? {
          saude_contas: form.saude_contas,
          status_logistica: form.status_logistica,
          situacao_estoque: form.situacao_estoque,
        } : {}),
      });

      setForm({ ...INITIAL_FORM });
      onClose();
    } catch {
      // Error handled by mutation onError
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleClose() {
    if (isSubmitting) return;
    setForm({ ...INITIAL_FORM });
    onClose();
  }

  const filledCount = visibleFields.filter(f => form[f.key].trim().length > 0).length;
  const totalFields = visibleFields.length;
  const canSubmit = filledCount === totalFields && !isSubmitting;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText size={20} className="text-purple-500" />
            Relatorio MKT Place — {isGestao ? 'Gestao' : 'Consultoria'}
          </DialogTitle>
          <DialogDescription>
            Relatorio de {isGestao ? 'gestao' : 'consultoria'} ({cycleDays} dias) para <strong>{clientName}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {visibleFields.map(({ key, label, placeholder, gestaoOnly }) => (
            <div key={key} className={`space-y-1.5 p-3 rounded-lg border ${gestaoOnly ? 'border-purple-500/20 bg-purple-500/5' : 'border-subtle bg-muted/20'}`}>
              <Label className="text-sm font-medium">
                {label} <span className="text-destructive">*</span>
                {gestaoOnly && (
                  <span className="ml-2 text-[10px] font-normal text-purple-500">Gestao</span>
                )}
              </Label>
              <Textarea
                value={form[key]}
                onChange={(e) => setForm(prev => ({ ...prev, [key]: e.target.value }))}
                placeholder={placeholder}
                className="min-h-[70px] resize-none"
              />
            </div>
          ))}

          {/* Progress */}
          <div className="text-xs text-muted-foreground text-center">
            {filledCount}/{totalFields} campos preenchidos
          </div>

          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            {isSubmitting ? (
              <><Loader2 size={14} className="mr-2 animate-spin" /> Salvando relatorio...</>
            ) : (
              'Salvar Relatorio'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
