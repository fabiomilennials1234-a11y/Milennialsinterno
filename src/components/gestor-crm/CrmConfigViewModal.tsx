import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { CRM_PRODUTO_LABEL, CRM_PRODUTO_COLOR, CRM_STEP_LABEL, type CrmProduto } from '@/hooks/useCrmKanban';
import { FileText, CheckCircle2, Clock } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  config: {
    id: string;
    client_id: string;
    produto: CrmProduto;
    current_step: string;
    is_finalizado: boolean;
    form_data: Record<string, any>;
    clients?: { name?: string; razao_social?: string } | null;
  } | null;
}

/**
 * Modal que exibe os dados do formulário preenchido para uma configuração
 * específica (card V8 / Automation / Copilot no kanban). Mostra exatamente
 * as respostas daquele produto — independente dos demais cards do cliente.
 */
export default function CrmConfigViewModal({ isOpen, onClose, config }: Props) {
  if (!config) return null;

  const clientName = config.clients?.razao_social || config.clients?.name || 'Cliente';
  const label = CRM_PRODUTO_LABEL[config.produto];
  const color = CRM_PRODUTO_COLOR[config.produto];
  const stepLabel = CRM_STEP_LABEL[config.current_step] || config.current_step;
  const formData = config.form_data || {};

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText size={18} className="text-primary" />
            Configuração {label} — {clientName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          <div className="flex items-center gap-3 flex-wrap">
            <Badge className={`${color} border`}>{label}</Badge>
            {config.is_finalizado ? (
              <span className="inline-flex items-center gap-1 text-sm text-emerald-600 font-medium">
                <CheckCircle2 size={14} />
                Finalizado
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-sm text-muted-foreground font-medium">
                <Clock size={14} />
                Etapa atual: <strong className="text-foreground">{stepLabel}</strong>
              </span>
            )}
          </div>

          {/* Renderização genérica dos dados do formulário */}
          <FormDataView data={formData} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

// =========== Renderização recursiva dos dados JSON ==========

const FIELD_LABELS: Record<string, string> = {
  nome_cliente: 'Nome do cliente',
  nicho: 'Nicho',
  whatsapp_principal: 'WhatsApp principal',
  responsavel_atendimento: 'Responsável pelo atendimento',
  origem_leads: 'Origem dos leads',
  origem_outro_descricao: 'Outra origem (descrição)',
  meta_liberado: 'Meta liberado',
  whatsapp_disponivel: 'WhatsApp disponível',
  pipeline_tipo: 'Tipo de pipeline',
  pipeline_customizado: 'Etapas adicionais do pipeline',
  script_1: 'Script 1 — Primeiro contato',
  script_2: 'Script 2 — Qualificação',
  script_3: 'Script 3 — Agendamento',
  script_5: 'Script 5 — Reativação',
  automacoes: 'Automações',
  produto_principal: 'Produto/serviço principal',
  ticket_medio: 'Ticket médio',
  objetivos_ia: 'Objetivo da IA',
  respostas_objetivos: 'Respostas específicas por objetivo',
  criterios_qualificacao: 'Critérios de qualificação',
  calendario_link: 'Link/ferramenta de agendamento',
  oferta_principal: 'Oferta principal',
  fonte_faq: 'Fonte de conhecimento / FAQ',
};

const VALUE_LABELS: Record<string, string> = {
  meta_ads_formulario: 'Meta Ads (Formulário)',
  meta_ads_whatsapp: 'Meta Ads → WhatsApp',
  landing_page: 'Landing Page',
  outro: 'Outro',
  lead_automatico: 'Lead entra automático no CRM',
  notificar_vendedor: 'Notificar vendedor',
  mensagem_automatica: 'Mensagem automática no WhatsApp',
  qualificar: 'Qualificar lead',
  agendar: 'Agendar reunião',
  vender: 'Vender direto no WhatsApp',
  suporte: 'Somente suporte',
  padrao: 'Padrão',
  personalizado: 'Personalizado',
  sim: 'Sim',
  nao: 'Não',
};

function humanize(k: string): string {
  return FIELD_LABELS[k] || k.replace(/_/g, ' ');
}

function humanizeValue(v: string): string {
  return VALUE_LABELS[v] || v;
}

function FormDataView({ data }: { data: Record<string, any> }) {
  const keys = Object.keys(data).filter(k => {
    const v = data[k];
    if (v === null || v === undefined) return false;
    if (typeof v === 'string' && v.trim() === '') return false;
    if (Array.isArray(v) && v.length === 0) return false;
    if (typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0) return false;
    return true;
  });

  if (keys.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhum dado preenchido.</p>;
  }

  return (
    <div className="space-y-3">
      {keys.map(k => (
        <div key={k} className="space-y-1">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">{humanize(k)}</p>
          <FormValue value={data[k]} />
        </div>
      ))}
    </div>
  );
}

function FormValue({ value }: { value: any }) {
  if (value === null || value === undefined) return <span className="text-sm text-muted-foreground">—</span>;

  if (Array.isArray(value)) {
    return (
      <div className="flex flex-wrap gap-1">
        {value.map((v, i) => (
          <Badge key={i} variant="outline" className="text-[11px]">{humanizeValue(String(v))}</Badge>
        ))}
      </div>
    );
  }

  if (typeof value === 'object') {
    return (
      <div className="pl-3 border-l-2 border-primary/30 space-y-2">
        {Object.keys(value).map(k => (
          <div key={k}>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{humanize(k)}</p>
            <FormValue value={value[k]} />
          </div>
        ))}
      </div>
    );
  }

  const s = String(value);
  // Textos longos (scripts etc.) ganham bloco formatado
  if (s.length > 80 || s.includes('\n')) {
    return <p className="text-sm whitespace-pre-wrap bg-muted/30 rounded-md p-2 border border-border">{s}</p>;
  }
  return <p className="text-sm text-foreground">{humanizeValue(s)}</p>;
}
