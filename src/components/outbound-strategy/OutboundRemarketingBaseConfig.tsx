import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Mail, MessageCircle, TrendingUp, Link as LinkIcon } from 'lucide-react';
import OutboundFunnelCard from './OutboundFunnelCard';
import type { RemarketingBaseConfig } from '@/hooks/useOutboundStrategies';

interface Props {
  emailReactivation: RemarketingBaseConfig;
  setEmailReactivation: (value: RemarketingBaseConfig) => void;
  whatsappNurturing: RemarketingBaseConfig;
  setWhatsappNurturing: (value: RemarketingBaseConfig) => void;
  upsellCrosssell: RemarketingBaseConfig;
  setUpsellCrosssell: (value: RemarketingBaseConfig) => void;
}

export default function OutboundRemarketingBaseConfig({
  emailReactivation, setEmailReactivation,
  whatsappNurturing, setWhatsappNurturing,
  upsellCrosssell, setUpsellCrosssell,
}: Props) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-2xl">🔄</span>
        <h3 className="text-lg font-semibold text-foreground">Remarketing de Base</h3>
      </div>

      <div className="space-y-3">
        {/* Email Reactivation */}
        <OutboundFunnelCard
          title="Reativação por Email"
          description="Sequência de emails para reativar leads e clientes inativos da base"
          icon={<Mail className="w-5 h-5 text-white" />}
          color="bg-gradient-to-br from-blue-500 to-blue-600"
          enabled={emailReactivation.enabled}
          setEnabled={(v) => setEmailReactivation({ ...emailReactivation, enabled: v })}
        >
          <div className="space-y-4">
            <div className="p-3 bg-info/10 rounded-lg text-sm text-info border border-info/20">
              <strong>Como funciona:</strong>
              <ul className="list-disc ml-4 mt-2 space-y-1">
                <li>Importamos a base de contatos existente do cliente</li>
                <li>Cadência de emails com ofertas e conteúdo de valor</li>
                <li>Segmentação por interesse, última interação e perfil</li>
                <li>Objetivo: reativar contatos e gerar novas oportunidades</li>
              </ul>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tamanho da Base</Label>
                <Input
                  type="number"
                  min="0"
                  value={emailReactivation.base_size || ''}
                  onChange={(e) => setEmailReactivation({ ...emailReactivation, base_size: Number(e.target.value) })}
                  placeholder="Ex: 5000"
                />
              </div>
              <div className="space-y-2">
                <Label>Ferramenta de Email</Label>
                <Input
                  value={emailReactivation.email_tool || ''}
                  onChange={(e) => setEmailReactivation({ ...emailReactivation, email_tool: e.target.value })}
                  placeholder="Ex: RD Station, ActiveCampaign..."
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Etapas da Cadência</Label>
                <Input
                  type="number"
                  min="1"
                  value={emailReactivation.cadence_steps || ''}
                  onChange={(e) => setEmailReactivation({ ...emailReactivation, cadence_steps: Number(e.target.value) })}
                  placeholder="Ex: 4"
                />
              </div>
              <div className="space-y-2">
                <Label>Intervalo entre etapas (dias)</Label>
                <Input
                  type="number"
                  min="1"
                  value={emailReactivation.cadence_interval_days || ''}
                  onChange={(e) => setEmailReactivation({ ...emailReactivation, cadence_interval_days: Number(e.target.value) })}
                  placeholder="Ex: 5"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Tipo de Oferta</Label>
              <Input
                value={emailReactivation.offer_type || ''}
                onChange={(e) => setEmailReactivation({ ...emailReactivation, offer_type: e.target.value })}
                placeholder="Ex: Desconto especial, Consultoria grátis, Demo exclusiva..."
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <LinkIcon className="w-4 h-4" />
                Link dos Scripts de Email
              </Label>
              <Input
                value={emailReactivation.scripts_url || ''}
                onChange={(e) => setEmailReactivation({ ...emailReactivation, scripts_url: e.target.value })}
                placeholder="Cole o link dos templates..."
              />
            </div>

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                value={emailReactivation.notes || ''}
                onChange={(e) => setEmailReactivation({ ...emailReactivation, notes: e.target.value })}
                placeholder="Notas adicionais..."
                className="min-h-[60px]"
              />
            </div>
          </div>
        </OutboundFunnelCard>

        {/* WhatsApp Nurturing */}
        <OutboundFunnelCard
          title="WhatsApp Nurturing"
          description="Nutrição de leads da base via WhatsApp com conteúdo e ofertas"
          icon={<MessageCircle className="w-5 h-5 text-white" />}
          color="bg-gradient-to-br from-green-500 to-green-600"
          enabled={whatsappNurturing.enabled}
          setEnabled={(v) => setWhatsappNurturing({ ...whatsappNurturing, enabled: v })}
        >
          <div className="space-y-4">
            <div className="p-3 bg-info/10 rounded-lg text-sm text-info border border-info/20">
              <strong>Como funciona:</strong>
              <ul className="list-disc ml-4 mt-2 space-y-1">
                <li>Disparos periódicos de conteúdo de valor para a base</li>
                <li>Segmentação por interesse e estágio do funil</li>
                <li>Mix de conteúdo educativo, cases e ofertas</li>
                <li>Objetivo: manter relacionamento e gerar oportunidades</li>
              </ul>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tamanho da Base</Label>
                <Input
                  type="number"
                  min="0"
                  value={whatsappNurturing.base_size || ''}
                  onChange={(e) => setWhatsappNurturing({ ...whatsappNurturing, base_size: Number(e.target.value) })}
                  placeholder="Ex: 2000"
                />
              </div>
              <div className="space-y-2">
                <Label>Frequência de Envio</Label>
                <Input
                  value={whatsappNurturing.message_frequency || ''}
                  onChange={(e) => setWhatsappNurturing({ ...whatsappNurturing, message_frequency: e.target.value })}
                  placeholder="Ex: Semanal, Quinzenal, 2x por semana..."
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Tipo de Conteúdo</Label>
              <Input
                value={whatsappNurturing.content_type || ''}
                onChange={(e) => setWhatsappNurturing({ ...whatsappNurturing, content_type: e.target.value })}
                placeholder="Ex: Conteúdo educativo, Ofertas, Cases de sucesso..."
              />
            </div>

            <div className="space-y-2">
              <Label>Template de Mensagem Inicial</Label>
              <Textarea
                value={whatsappNurturing.initial_message_template || ''}
                onChange={(e) => setWhatsappNurturing({ ...whatsappNurturing, initial_message_template: e.target.value })}
                placeholder="Modelo de mensagem para primeiro contato..."
                className="min-h-[80px]"
              />
            </div>

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                value={whatsappNurturing.notes || ''}
                onChange={(e) => setWhatsappNurturing({ ...whatsappNurturing, notes: e.target.value })}
                placeholder="Notas adicionais..."
                className="min-h-[60px]"
              />
            </div>
          </div>
        </OutboundFunnelCard>

        {/* Upsell/Cross-sell */}
        <OutboundFunnelCard
          title="Upsell / Cross-sell"
          description="Estratégia para vender mais para clientes existentes"
          icon={<TrendingUp className="w-5 h-5 text-white" />}
          color="bg-gradient-to-br from-purple-500 to-purple-600"
          enabled={upsellCrosssell.enabled}
          setEnabled={(v) => setUpsellCrosssell({ ...upsellCrosssell, enabled: v })}
        >
          <div className="space-y-4">
            <div className="p-3 bg-info/10 rounded-lg text-sm text-info border border-info/20">
              <strong>Como funciona:</strong>
              <ul className="list-disc ml-4 mt-2 space-y-1">
                <li>Identificação de clientes com potencial de upgrade</li>
                <li>Abordagem consultiva mostrando valor adicional</li>
                <li>Ofertas exclusivas para base existente</li>
                <li>ROI geralmente alto por trabalhar base quente</li>
              </ul>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Abordagem</Label>
                <Input
                  value={upsellCrosssell.approach || ''}
                  onChange={(e) => setUpsellCrosssell({ ...upsellCrosssell, approach: e.target.value })}
                  placeholder="Ex: Upgrade de plano, Produtos complementares..."
                />
              </div>
              <div className="space-y-2">
                <Label>Segmento Alvo</Label>
                <Input
                  value={upsellCrosssell.target_segment || ''}
                  onChange={(e) => setUpsellCrosssell({ ...upsellCrosssell, target_segment: e.target.value })}
                  placeholder="Ex: Clientes ativos há +6 meses..."
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Detalhes da Oferta</Label>
              <Textarea
                value={upsellCrosssell.offer_details || ''}
                onChange={(e) => setUpsellCrosssell({ ...upsellCrosssell, offer_details: e.target.value })}
                placeholder="Descreva a oferta de upsell/cross-sell..."
                className="min-h-[80px]"
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <LinkIcon className="w-4 h-4" />
                Link dos Scripts
              </Label>
              <Input
                value={upsellCrosssell.scripts_url || ''}
                onChange={(e) => setUpsellCrosssell({ ...upsellCrosssell, scripts_url: e.target.value })}
                placeholder="Cole o link dos scripts de abordagem..."
              />
            </div>

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                value={upsellCrosssell.notes || ''}
                onChange={(e) => setUpsellCrosssell({ ...upsellCrosssell, notes: e.target.value })}
                placeholder="Notas adicionais..."
                className="min-h-[60px]"
              />
            </div>
          </div>
        </OutboundFunnelCard>
      </div>
    </div>
  );
}
