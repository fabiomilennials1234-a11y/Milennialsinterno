import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Plus, X, Wand2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  CRM_PRODUTOS_VALIDOS,
  CRM_PRODUTO_LABEL,
  CRM_PRODUTO_COLOR,
  useCreateCrmConfiguracoes,
  type CrmProduto,
} from '@/hooks/useCrmKanban';

// ========= Pipeline padrão compartilhado V8/Automation =========
const PIPELINE_PADRAO = [
  'Lead novo',
  'Contato 1 (Ligação)',
  'Contato 2 (WhatsApp)',
  'Contato 3 (WhatsApp)',
  'Contato 4 (Ligação)',
  'Qualificado',
  'Desqualificado',
  'Sem contato',
  'Agendado',
  'Compareceu',
  'Remarcar',
  'Proposta enviada',
  'Fechado',
  'Perdido',
];

const ORIGENS_LEADS = [
  { value: 'meta_ads_formulario', label: 'Meta Ads (Formulário)' },
  { value: 'meta_ads_whatsapp', label: 'Meta Ads → WhatsApp' },
  { value: 'landing_page', label: 'Landing Page' },
  { value: 'outro', label: 'Outro' },
];

const AUTOMACOES_DISPONIVEIS = [
  { value: 'lead_automatico', label: 'Lead entra automático no CRM' },
  { value: 'notificar_vendedor', label: 'Notificar vendedor' },
  { value: 'mensagem_automatica', label: 'Mensagem automática no WhatsApp' },
];

const OBJETIVOS_IA = [
  { value: 'qualificar', label: 'Qualificar lead e passar para o vendedor' },
  { value: 'agendar', label: 'Agendar reunião' },
  { value: 'vender', label: 'Vender direto no WhatsApp' },
  { value: 'suporte', label: 'Somente suporte' },
];

// Perguntas específicas por objetivo IA (Copilot)
const PERGUNTAS_POR_OBJETIVO: Record<string, { key: string; label: string; placeholder: string }[]> = {
  qualificar: [
    { key: 'criterios_qualificacao', label: 'Critérios de qualificação', placeholder: 'Ex: ter CNPJ, faturar acima de X, ser do nicho Y…' },
  ],
  agendar: [
    { key: 'calendario_link', label: 'Link/ferramenta de agendamento', placeholder: 'Ex: Calendly, Cal.com, Google Agenda…' },
  ],
  vender: [
    { key: 'oferta_principal', label: 'Oferta principal (o que a IA pode vender)', placeholder: 'Ex: curso X por R$ 997, assinatura mensal do plano Pro…' },
  ],
  suporte: [
    { key: 'fonte_faq', label: 'Fonte de conhecimento / FAQ', placeholder: 'Link da base, PDF, Notion, etc.' },
  ],
};

// ======================= TIPOS =======================

interface V8FormData {
  nome_cliente: string;
  nicho: string;
  whatsapp_principal: string;
  responsavel_atendimento: string;
  origem_leads: string[];
  origem_outro_descricao: string;
  meta_liberado: 'sim' | 'nao' | '';
  whatsapp_disponivel: 'sim' | 'nao' | '';
  pipeline_tipo: 'padrao' | 'personalizado';
  pipeline_customizado: string[];
  script_1: string;
}

interface AutomationFormData extends V8FormData {
  script_2: string;
  script_3: string;
  script_5: string;
  automacoes: string[];
}

interface CopilotFormData {
  nome_cliente: string;
  nicho: string;
  produto_principal: string;
  ticket_medio: string;
  objetivos_ia: string[];
  respostas_objetivos: Record<string, string>;
}

const emptyV8 = (cliente: string): V8FormData => ({
  nome_cliente: cliente,
  nicho: '',
  whatsapp_principal: '',
  responsavel_atendimento: '',
  origem_leads: [],
  origem_outro_descricao: '',
  meta_liberado: '',
  whatsapp_disponivel: '',
  pipeline_tipo: 'padrao',
  pipeline_customizado: [],
  script_1: '',
});

const emptyAutomation = (cliente: string): AutomationFormData => ({
  ...emptyV8(cliente),
  script_2: '',
  script_3: '',
  script_5: '',
  automacoes: [],
});

const emptyCopilot = (cliente: string): CopilotFormData => ({
  nome_cliente: cliente,
  nicho: '',
  produto_principal: '',
  ticket_medio: '',
  objetivos_ia: [],
  respostas_objetivos: {},
});

// ======================= HELPERS =======================

function validateV8(data: V8FormData, produtoLabel: string): string | null {
  if (!data.nome_cliente.trim()) return `[${produtoLabel}] Nome do cliente é obrigatório`;
  if (!data.nicho.trim()) return `[${produtoLabel}] Nicho é obrigatório`;
  if (!data.whatsapp_principal.trim()) return `[${produtoLabel}] WhatsApp principal é obrigatório`;
  if (!data.responsavel_atendimento.trim()) return `[${produtoLabel}] Responsável pelo atendimento é obrigatório`;
  if (data.origem_leads.length === 0) return `[${produtoLabel}] Selecione ao menos uma origem dos leads`;
  if (data.origem_leads.includes('outro') && !data.origem_outro_descricao.trim()) return `[${produtoLabel}] Descreva a outra origem`;
  if (!data.meta_liberado) return `[${produtoLabel}] Informe se o Meta está liberado`;
  if (!data.whatsapp_disponivel) return `[${produtoLabel}] Informe se o WhatsApp está disponível`;
  if (!data.script_1.trim()) return `[${produtoLabel}] Script 1 é obrigatório`;
  return null;
}

function validateAutomation(data: AutomationFormData): string | null {
  const base = validateV8(data, 'Automation');
  if (base) return base;
  if (!data.script_2.trim()) return '[Automation] Script 2 — Qualificação é obrigatório';
  if (!data.script_3.trim()) return '[Automation] Script 3 — Agendamento é obrigatório';
  if (!data.script_5.trim()) return '[Automation] Script 5 — Reativação é obrigatório';
  return null;
}

function validateCopilot(data: CopilotFormData): string | null {
  if (!data.nome_cliente.trim()) return '[Copilot] Nome do cliente é obrigatório';
  if (!data.nicho.trim()) return '[Copilot] Nicho é obrigatório';
  if (!data.produto_principal.trim()) return '[Copilot] Produto/serviço principal é obrigatório';
  if (!data.ticket_medio.trim()) return '[Copilot] Ticket médio é obrigatório';
  if (data.objetivos_ia.length === 0) return '[Copilot] Selecione ao menos um objetivo da IA';
  return null;
}

// ========== PROPS ==========

interface Props {
  isOpen: boolean;
  onClose: () => void;
  clientId: string;
  clientName: string;
  gestorId: string;
  availableProdutos: CrmProduto[]; // sub-produtos Torque CRM contratados pelo cliente
  onSuccess?: () => void;
}

// =================== COMPONENTE ===================

export default function CrmTarefaFormModal({
  isOpen,
  onClose,
  clientId,
  clientName,
  gestorId,
  availableProdutos,
  onSuccess,
}: Props) {
  const createConfigs = useCreateCrmConfiguracoes();

  const [selected, setSelected] = useState<CrmProduto[]>(availableProdutos);
  const [v8Data, setV8Data] = useState<V8FormData>(() => emptyV8(clientName));
  const [autoData, setAutoData] = useState<AutomationFormData>(() => emptyAutomation(clientName));
  const [copilotData, setCopilotData] = useState<CopilotFormData>(() => emptyCopilot(clientName));
  const [newPipelineItem, setNewPipelineItem] = useState<{ v8: string; auto: string }>({ v8: '', auto: '' });

  const handleSubmit = async () => {
    if (selected.length === 0) {
      toast.error('Selecione ao menos um produto');
      return;
    }

    // Validação por produto selecionado
    if (selected.includes('v8')) {
      const err = validateV8(v8Data, 'V8');
      if (err) { toast.error(err); return; }
    }
    if (selected.includes('automation')) {
      const err = validateAutomation(autoData);
      if (err) { toast.error(err); return; }
    }
    if (selected.includes('copilot')) {
      const err = validateCopilot(copilotData);
      if (err) { toast.error(err); return; }
    }

    const formDataByProduto: Partial<Record<CrmProduto, Record<string, unknown>>> = {};
    if (selected.includes('v8')) formDataByProduto.v8 = v8Data as unknown as Record<string, unknown>;
    if (selected.includes('automation')) formDataByProduto.automation = autoData as unknown as Record<string, unknown>;
    if (selected.includes('copilot')) formDataByProduto.copilot = copilotData as unknown as Record<string, unknown>;

    try {
      await createConfigs.mutateAsync({
        clientId,
        clientName,
        gestorId,
        produtos: selected,
        formDataByProduto,
      });
      onSuccess?.();
      onClose();
    } catch {
      // erro já tratado pelo hook
    }
  };

  const toggleProduto = (p: CrmProduto, checked: boolean) => {
    setSelected(prev => (checked ? [...prev, p] : prev.filter(x => x !== p)));
  };

  const toggleArrayItem = <T extends string>(list: T[], item: T, checked: boolean): T[] =>
    checked ? [...list, item] : list.filter(i => i !== item);

  const saving = createConfigs.isPending;

  return (
    <Dialog open={isOpen} onOpenChange={(o) => { if (!o && !saving) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 size={18} className="text-primary" />
            Gerar Tarefa — {clientName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-2">
          {/* Seleção de produtos */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Quais produtos deseja configurar?</Label>
            <p className="text-xs text-muted-foreground">
              Cliente contratou: {availableProdutos.length > 0 ? availableProdutos.map(p => CRM_PRODUTO_LABEL[p]).join(', ') : 'nenhum'}.
              Você pode gerar tarefas para um, dois ou todos os três.
            </p>
            <div className="grid grid-cols-3 gap-2">
              {CRM_PRODUTOS_VALIDOS.map(p => {
                const checked = selected.includes(p);
                const available = availableProdutos.includes(p);
                return (
                  <label
                    key={p}
                    className={`flex items-center justify-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors text-sm font-medium ${
                      !available
                        ? 'opacity-40 cursor-not-allowed bg-muted/20'
                        : checked
                          ? 'bg-primary/10 border-primary text-primary'
                          : 'bg-background border-border hover:border-primary/50'
                    }`}
                  >
                    <Checkbox
                      checked={checked}
                      disabled={!available}
                      onCheckedChange={(c) => available && toggleProduto(p, !!c)}
                    />
                    {CRM_PRODUTO_LABEL[p]}
                  </label>
                );
              })}
            </div>
          </div>

          {/* =================== BLOCO V8 =================== */}
          {selected.includes('v8') && (
            <div className="border rounded-xl p-4 bg-sky-500/5 border-sky-500/30 space-y-4">
              <div className="flex items-center gap-2">
                <Badge className={`${CRM_PRODUTO_COLOR.v8} border`}>{CRM_PRODUTO_LABEL.v8}</Badge>
                <span className="text-xs text-muted-foreground">Preencha os dados para gerar a configuração V8</span>
              </div>

              <ClientBasicFields
                data={v8Data}
                onChange={(patch) => setV8Data(d => ({ ...d, ...patch }))}
              />

              <OrigemEAcessos
                data={v8Data}
                onChange={(patch) => setV8Data(d => ({ ...d, ...patch }))}
                toggleArrayItem={toggleArrayItem}
              />

              <PipelineEditor
                tipo={v8Data.pipeline_tipo}
                custom={v8Data.pipeline_customizado}
                newItem={newPipelineItem.v8}
                onChangeNewItem={(v) => setNewPipelineItem(p => ({ ...p, v8: v }))}
                onTipoChange={(t) => setV8Data(d => ({ ...d, pipeline_tipo: t }))}
                onAddCustom={(s) => setV8Data(d => ({ ...d, pipeline_customizado: [...d.pipeline_customizado, s] }))}
                onRemoveCustom={(i) => setV8Data(d => ({ ...d, pipeline_customizado: d.pipeline_customizado.filter((_, idx) => idx !== i) }))}
              />

              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">Script 1 — Primeiro contato *</Label>
                <Textarea
                  rows={4}
                  value={v8Data.script_1}
                  onChange={(e) => setV8Data(d => ({ ...d, script_1: e.target.value }))}
                  placeholder="Oi [nome], tudo bem? Sou [vendedor] da [empresa]..."
                />
              </div>
            </div>
          )}

          {/* =================== BLOCO AUTOMATION =================== */}
          {selected.includes('automation') && (
            <div className="border rounded-xl p-4 bg-violet-500/5 border-violet-500/30 space-y-4">
              <div className="flex items-center gap-2">
                <Badge className={`${CRM_PRODUTO_COLOR.automation} border`}>{CRM_PRODUTO_LABEL.automation}</Badge>
                <span className="text-xs text-muted-foreground">Inclui tudo do V8 + scripts e automações</span>
              </div>

              <ClientBasicFields
                data={autoData}
                onChange={(patch) => setAutoData(d => ({ ...d, ...patch }))}
              />

              <OrigemEAcessos
                data={autoData}
                onChange={(patch) => setAutoData(d => ({ ...d, ...patch }))}
                toggleArrayItem={toggleArrayItem}
              />

              <PipelineEditor
                tipo={autoData.pipeline_tipo}
                custom={autoData.pipeline_customizado}
                newItem={newPipelineItem.auto}
                onChangeNewItem={(v) => setNewPipelineItem(p => ({ ...p, auto: v }))}
                onTipoChange={(t) => setAutoData(d => ({ ...d, pipeline_tipo: t }))}
                onAddCustom={(s) => setAutoData(d => ({ ...d, pipeline_customizado: [...d.pipeline_customizado, s] }))}
                onRemoveCustom={(i) => setAutoData(d => ({ ...d, pipeline_customizado: d.pipeline_customizado.filter((_, idx) => idx !== i) }))}
              />

              <div className="grid grid-cols-1 gap-3">
                <ScriptField label="Script 1 — Primeiro contato *" value={autoData.script_1} onChange={(v) => setAutoData(d => ({ ...d, script_1: v }))} />
                <ScriptField label="Script 2 — Qualificação *" value={autoData.script_2} onChange={(v) => setAutoData(d => ({ ...d, script_2: v }))} />
                <ScriptField label="Script 3 — Agendamento *" value={autoData.script_3} onChange={(v) => setAutoData(d => ({ ...d, script_3: v }))} />
                <ScriptField label="Script 5 — Reativação de lead *" value={autoData.script_5} onChange={(v) => setAutoData(d => ({ ...d, script_5: v }))} />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold">Automações</Label>
                <div className="grid grid-cols-1 gap-2">
                  {AUTOMACOES_DISPONIVEIS.map(a => {
                    const checked = autoData.automacoes.includes(a.value);
                    return (
                      <label key={a.value} className="flex items-center gap-2 p-2 rounded-lg border border-border cursor-pointer hover:bg-muted/30">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(c) => setAutoData(d => ({ ...d, automacoes: toggleArrayItem(d.automacoes, a.value, !!c) }))}
                        />
                        <span className="text-sm">{a.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* =================== BLOCO COPILOT =================== */}
          {selected.includes('copilot') && (
            <div className="border rounded-xl p-4 bg-amber-500/5 border-amber-500/30 space-y-4">
              <div className="flex items-center gap-2">
                <Badge className={`${CRM_PRODUTO_COLOR.copilot} border`}>{CRM_PRODUTO_LABEL.copilot}</Badge>
                <span className="text-xs text-muted-foreground">Configuração da IA Copilot</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <FieldWrap label="Nome do cliente *">
                  <Input value={copilotData.nome_cliente} onChange={(e) => setCopilotData(d => ({ ...d, nome_cliente: e.target.value }))} />
                </FieldWrap>
                <FieldWrap label="Nicho *">
                  <Input value={copilotData.nicho} onChange={(e) => setCopilotData(d => ({ ...d, nicho: e.target.value }))} placeholder="E-commerce, clínica..." />
                </FieldWrap>
                <FieldWrap label="Produto/serviço principal *">
                  <Input value={copilotData.produto_principal} onChange={(e) => setCopilotData(d => ({ ...d, produto_principal: e.target.value }))} />
                </FieldWrap>
                <FieldWrap label="Ticket médio *">
                  <Input value={copilotData.ticket_medio} onChange={(e) => setCopilotData(d => ({ ...d, ticket_medio: e.target.value }))} placeholder="R$ 1.500,00" />
                </FieldWrap>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold">Objetivo da IA *</Label>
                <p className="text-xs text-muted-foreground">Pode selecionar mais de um — perguntas específicas aparecem abaixo</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {OBJETIVOS_IA.map(o => {
                    const checked = copilotData.objetivos_ia.includes(o.value);
                    return (
                      <label key={o.value} className="flex items-center gap-2 p-2 rounded-lg border border-border cursor-pointer hover:bg-muted/30">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(c) => setCopilotData(d => {
                            const next = toggleArrayItem(d.objetivos_ia, o.value, !!c);
                            return { ...d, objetivos_ia: next };
                          })}
                        />
                        <span className="text-sm">{o.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Perguntas condicionais por objetivo (dedupe automático por key) */}
              <DynamicObjetivoQuestions
                objetivos={copilotData.objetivos_ia}
                respostas={copilotData.respostas_objetivos}
                onChange={(k, v) => setCopilotData(d => ({ ...d, respostas_objetivos: { ...d.respostas_objetivos, [k]: v } }))}
              />
            </div>
          )}

          {/* ========= Submit ========= */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <Button variant="ghost" onClick={onClose} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={saving || selected.length === 0} className="gap-2">
              {saving ? 'Gerando...' : (<><CheckCircle2 size={16} /> Gerar e criar cards</>)}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ===================== Subcomponentes =====================

function FieldWrap({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">{label}</Label>
      {children}
    </div>
  );
}

function ScriptField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <FieldWrap label={label}>
      <Textarea rows={3} value={value} onChange={(e) => onChange(e.target.value)} />
    </FieldWrap>
  );
}

function ClientBasicFields({ data, onChange }: {
  data: { nome_cliente: string; nicho: string; whatsapp_principal: string; responsavel_atendimento: string };
  onChange: (patch: Partial<{ nome_cliente: string; nicho: string; whatsapp_principal: string; responsavel_atendimento: string }>) => void;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <FieldWrap label="Nome do cliente *">
        <Input value={data.nome_cliente} onChange={(e) => onChange({ nome_cliente: e.target.value })} />
      </FieldWrap>
      <FieldWrap label="Nicho *">
        <Input value={data.nicho} onChange={(e) => onChange({ nicho: e.target.value })} placeholder="Ex: E-commerce" />
      </FieldWrap>
      <FieldWrap label="WhatsApp principal *">
        <Input value={data.whatsapp_principal} onChange={(e) => onChange({ whatsapp_principal: e.target.value })} placeholder="(11) 99999-9999" />
      </FieldWrap>
      <FieldWrap label="Responsável pelo atendimento *">
        <Input value={data.responsavel_atendimento} onChange={(e) => onChange({ responsavel_atendimento: e.target.value })} />
      </FieldWrap>
    </div>
  );
}

function OrigemEAcessos({ data, onChange, toggleArrayItem }: {
  data: V8FormData;
  onChange: (patch: Partial<V8FormData>) => void;
  toggleArrayItem: <T extends string>(list: T[], item: T, checked: boolean) => T[];
}) {
  return (
    <>
      <div className="space-y-2">
        <Label className="text-sm font-semibold">Origem dos leads *</Label>
        <div className="grid grid-cols-2 gap-2">
          {ORIGENS_LEADS.map(o => {
            const checked = data.origem_leads.includes(o.value);
            return (
              <label key={o.value} className="flex items-center gap-2 p-2 rounded-lg border border-border cursor-pointer hover:bg-muted/30">
                <Checkbox
                  checked={checked}
                  onCheckedChange={(c) => onChange({ origem_leads: toggleArrayItem(data.origem_leads, o.value, !!c) })}
                />
                <span className="text-sm">{o.label}</span>
              </label>
            );
          })}
        </div>
        {data.origem_leads.includes('outro') && (
          <Input
            placeholder="Descreva a outra origem"
            value={data.origem_outro_descricao}
            onChange={(e) => onChange({ origem_outro_descricao: e.target.value })}
          />
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-sm font-semibold">Meta liberado? *</Label>
          <RadioGroup value={data.meta_liberado} onValueChange={(v) => onChange({ meta_liberado: v as 'sim' | 'nao' })} className="flex gap-4">
            <div className="flex items-center gap-2">
              <RadioGroupItem value="sim" id={`meta-sim-${Math.random()}`} />
              <Label className="text-sm">Sim</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="nao" id={`meta-nao-${Math.random()}`} />
              <Label className="text-sm">Não</Label>
            </div>
          </RadioGroup>
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm font-semibold">WhatsApp disponível? *</Label>
          <RadioGroup value={data.whatsapp_disponivel} onValueChange={(v) => onChange({ whatsapp_disponivel: v as 'sim' | 'nao' })} className="flex gap-4">
            <div className="flex items-center gap-2">
              <RadioGroupItem value="sim" id={`wa-sim-${Math.random()}`} />
              <Label className="text-sm">Sim</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="nao" id={`wa-nao-${Math.random()}`} />
              <Label className="text-sm">Não</Label>
            </div>
          </RadioGroup>
        </div>
      </div>
    </>
  );
}

function PipelineEditor({ tipo, custom, newItem, onChangeNewItem, onTipoChange, onAddCustom, onRemoveCustom }: {
  tipo: 'padrao' | 'personalizado';
  custom: string[];
  newItem: string;
  onChangeNewItem: (v: string) => void;
  onTipoChange: (t: 'padrao' | 'personalizado') => void;
  onAddCustom: (s: string) => void;
  onRemoveCustom: (i: number) => void;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-semibold">Pipeline do CRM *</Label>
      <RadioGroup value={tipo} onValueChange={(v) => onTipoChange(v as 'padrao' | 'personalizado')} className="flex gap-4 mb-2">
        <div className="flex items-center gap-2">
          <RadioGroupItem value="padrao" id={`pipe-padrao-${Math.random()}`} />
          <Label className="text-sm">Padrão (14 etapas)</Label>
        </div>
        <div className="flex items-center gap-2">
          <RadioGroupItem value="personalizado" id={`pipe-custom-${Math.random()}`} />
          <Label className="text-sm">Personalizado (padrão + extras)</Label>
        </div>
      </RadioGroup>

      {/* Etapas padrão (sempre visíveis como referência) */}
      <div className="bg-muted/30 rounded-lg p-2 flex flex-wrap gap-1.5">
        {PIPELINE_PADRAO.map(s => (
          <Badge key={s} variant="outline" className="text-[10px] bg-background">{s}</Badge>
        ))}
      </div>

      {tipo === 'personalizado' && (
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Etapas adicionais</Label>
          <div className="flex gap-2">
            <Input
              placeholder="Nome da etapa extra"
              value={newItem}
              onChange={(e) => onChangeNewItem(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newItem.trim()) {
                  onAddCustom(newItem.trim());
                  onChangeNewItem('');
                }
              }}
            />
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                if (newItem.trim()) {
                  onAddCustom(newItem.trim());
                  onChangeNewItem('');
                }
              }}
            >
              <Plus size={16} />
            </Button>
          </div>
          {custom.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {custom.map((s, idx) => (
                <Badge key={`${s}-${idx}`} className="gap-1.5 bg-primary/10 text-primary border-primary/30">
                  {s}
                  <button onClick={() => onRemoveCustom(idx)} className="hover:text-destructive">
                    <X size={10} />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DynamicObjetivoQuestions({ objetivos, respostas, onChange }: {
  objetivos: string[];
  respostas: Record<string, string>;
  onChange: (key: string, value: string) => void;
}) {
  // Dedupe por key (se dois objetivos diferentes compartilhassem pergunta)
  const perguntas = useMemo(() => {
    const seen = new Set<string>();
    const out: { key: string; label: string; placeholder: string }[] = [];
    for (const obj of objetivos) {
      const ps = PERGUNTAS_POR_OBJETIVO[obj] || [];
      for (const p of ps) {
        if (!seen.has(p.key)) {
          seen.add(p.key);
          out.push(p);
        }
      }
    }
    return out;
  }, [objetivos]);

  if (perguntas.length === 0) return null;

  return (
    <div className="space-y-3 bg-background rounded-lg p-3 border border-border">
      <Label className="text-sm font-semibold text-primary">Perguntas específicas dos objetivos</Label>
      {perguntas.map(p => (
        <FieldWrap key={p.key} label={p.label}>
          <Textarea rows={2} value={respostas[p.key] || ''} onChange={(e) => onChange(p.key, e.target.value)} placeholder={p.placeholder} />
        </FieldWrap>
      ))}
    </div>
  );
}
