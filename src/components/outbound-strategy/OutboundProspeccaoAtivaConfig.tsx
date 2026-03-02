import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Linkedin, Phone, Mail, MessageSquare, Link as LinkIcon } from 'lucide-react';
import OutboundFunnelCard from './OutboundFunnelCard';
import type { ProspeccaoAtivaConfig } from '@/hooks/useOutboundStrategies';

interface Props {
  linkedinProspecting: ProspeccaoAtivaConfig;
  setLinkedinProspecting: (value: ProspeccaoAtivaConfig) => void;
  coldCalling: ProspeccaoAtivaConfig;
  setColdCalling: (value: ProspeccaoAtivaConfig) => void;
  coldEmail: ProspeccaoAtivaConfig;
  setColdEmail: (value: ProspeccaoAtivaConfig) => void;
  whatsappOutreach: ProspeccaoAtivaConfig;
  setWhatsappOutreach: (value: ProspeccaoAtivaConfig) => void;
}

export default function OutboundProspeccaoAtivaConfig({
  linkedinProspecting, setLinkedinProspecting,
  coldCalling, setColdCalling,
  coldEmail, setColdEmail,
  whatsappOutreach, setWhatsappOutreach,
}: Props) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-2xl">🎯</span>
        <h3 className="text-lg font-semibold text-foreground">Prospecção Ativa</h3>
      </div>

      <div className="space-y-3">
        {/* LinkedIn Prospecting */}
        <OutboundFunnelCard
          title="LinkedIn Prospecting"
          description="Conexões e mensagens diretas para decisores no LinkedIn"
          icon={<Linkedin className="w-5 h-5 text-white" />}
          color="bg-gradient-to-br from-blue-600 to-blue-800"
          enabled={linkedinProspecting.enabled}
          setEnabled={(v) => setLinkedinProspecting({ ...linkedinProspecting, enabled: v })}
        >
          <div className="space-y-4">
            <div className="p-3 bg-info/10 rounded-lg text-sm text-info border border-info/20">
              <strong>Como funciona:</strong>
              <ul className="list-disc ml-4 mt-2 space-y-1">
                <li>Envio diário de convites de conexão para decisores-alvo</li>
                <li>Sequência de mensagens personalizadas após aceitação</li>
                <li>Otimização do perfil para gerar autoridade</li>
                <li>Segmentação por cargo, setor e região</li>
              </ul>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Conexões/dia (meta)</Label>
                <Input
                  type="number"
                  min="0"
                  value={linkedinProspecting.daily_connections || ''}
                  onChange={(e) => setLinkedinProspecting({ ...linkedinProspecting, daily_connections: Number(e.target.value) })}
                  placeholder="Ex: 20"
                />
              </div>
              <div className="space-y-2">
                <Label>Mensagens/dia (meta)</Label>
                <Input
                  type="number"
                  min="0"
                  value={linkedinProspecting.daily_messages || ''}
                  onChange={(e) => setLinkedinProspecting({ ...linkedinProspecting, daily_messages: Number(e.target.value) })}
                  placeholder="Ex: 15"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Cargos-alvo</Label>
              <Textarea
                value={linkedinProspecting.target_titles || ''}
                onChange={(e) => setLinkedinProspecting({ ...linkedinProspecting, target_titles: e.target.value })}
                placeholder="Ex: CEO, Diretor Comercial, Gerente de Vendas, Head de Marketing..."
                className="min-h-[60px]"
              />
            </div>

            <div className="space-y-2">
              <Label>Setores-alvo</Label>
              <Textarea
                value={linkedinProspecting.target_industries || ''}
                onChange={(e) => setLinkedinProspecting({ ...linkedinProspecting, target_industries: e.target.value })}
                placeholder="Ex: SaaS, Tecnologia, Indústria, Serviços B2B..."
                className="min-h-[60px]"
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <LinkIcon className="w-4 h-4" />
                Link dos Scripts
              </Label>
              <Input
                value={linkedinProspecting.scripts_url || ''}
                onChange={(e) => setLinkedinProspecting({ ...linkedinProspecting, scripts_url: e.target.value })}
                placeholder="Cole o link dos scripts de abordagem..."
              />
            </div>

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                value={linkedinProspecting.notes || ''}
                onChange={(e) => setLinkedinProspecting({ ...linkedinProspecting, notes: e.target.value })}
                placeholder="Notas adicionais..."
                className="min-h-[60px]"
              />
            </div>
          </div>
        </OutboundFunnelCard>

        {/* Cold Calling */}
        <OutboundFunnelCard
          title="Cold Calling"
          description="Ligações diretas para prospects qualificados"
          icon={<Phone className="w-5 h-5 text-white" />}
          color="bg-gradient-to-br from-orange-500 to-orange-600"
          enabled={coldCalling.enabled}
          setEnabled={(v) => setColdCalling({ ...coldCalling, enabled: v })}
        >
          <div className="space-y-4">
            <div className="p-3 bg-info/10 rounded-lg text-sm text-info border border-info/20">
              <strong>Como funciona:</strong>
              <ul className="list-disc ml-4 mt-2 space-y-1">
                <li>Ligações diárias para lista de prospects qualificados</li>
                <li>Script de abordagem otimizado para conversão</li>
                <li>Objetivo: agendar reunião ou identificar interesse</li>
                <li>Follow-up estruturado após cada ligação</li>
              </ul>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Ligações/dia (meta)</Label>
                <Input
                  type="number"
                  min="0"
                  value={coldCalling.daily_calls_target || ''}
                  onChange={(e) => setColdCalling({ ...coldCalling, daily_calls_target: Number(e.target.value) })}
                  placeholder="Ex: 30"
                />
              </div>
              <div className="space-y-2">
                <Label>Ferramenta de Call</Label>
                <Input
                  value={coldCalling.call_tool || ''}
                  onChange={(e) => setColdCalling({ ...coldCalling, call_tool: e.target.value })}
                  placeholder="Ex: PhoneTrack, Meetime, JustCall..."
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Melhor Horário para Ligar</Label>
              <Input
                value={coldCalling.best_time_to_call || ''}
                onChange={(e) => setColdCalling({ ...coldCalling, best_time_to_call: e.target.value })}
                placeholder="Ex: 10h-12h / 14h-16h"
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <LinkIcon className="w-4 h-4" />
                Link do Script
              </Label>
              <Input
                value={coldCalling.scripts_url || ''}
                onChange={(e) => setColdCalling({ ...coldCalling, scripts_url: e.target.value })}
                placeholder="Cole o link do script de ligação..."
              />
            </div>

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                value={coldCalling.notes || ''}
                onChange={(e) => setColdCalling({ ...coldCalling, notes: e.target.value })}
                placeholder="Notas adicionais..."
                className="min-h-[60px]"
              />
            </div>
          </div>
        </OutboundFunnelCard>

        {/* Cold Email */}
        <OutboundFunnelCard
          title="Cold Email"
          description="Sequências de email frio para prospecção automatizada"
          icon={<Mail className="w-5 h-5 text-white" />}
          color="bg-gradient-to-br from-red-500 to-red-600"
          enabled={coldEmail.enabled}
          setEnabled={(v) => setColdEmail({ ...coldEmail, enabled: v })}
        >
          <div className="space-y-4">
            <div className="p-3 bg-info/10 rounded-lg text-sm text-info border border-info/20">
              <strong>Como funciona:</strong>
              <ul className="list-disc ml-4 mt-2 space-y-1">
                <li>Cadência de emails com personalização por lead</li>
                <li>Múltiplos touchpoints ao longo de dias/semanas</li>
                <li>A/B test de subject lines e copywriting</li>
                <li>Rastreamento de abertura e respostas</li>
              </ul>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Emails/dia (meta)</Label>
                <Input
                  type="number"
                  min="0"
                  value={coldEmail.daily_emails_target || ''}
                  onChange={(e) => setColdEmail({ ...coldEmail, daily_emails_target: Number(e.target.value) })}
                  placeholder="Ex: 50"
                />
              </div>
              <div className="space-y-2">
                <Label>Ferramenta de Email</Label>
                <Input
                  value={coldEmail.email_tool || ''}
                  onChange={(e) => setColdEmail({ ...coldEmail, email_tool: e.target.value })}
                  placeholder="Ex: Lemlist, Instantly, Woodpecker..."
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Etapas da Cadência</Label>
                <Input
                  type="number"
                  min="1"
                  value={coldEmail.cadence_steps || ''}
                  onChange={(e) => setColdEmail({ ...coldEmail, cadence_steps: Number(e.target.value) })}
                  placeholder="Ex: 5"
                />
              </div>
              <div className="space-y-2">
                <Label>Intervalo entre etapas (dias)</Label>
                <Input
                  type="number"
                  min="1"
                  value={coldEmail.cadence_interval_days || ''}
                  onChange={(e) => setColdEmail({ ...coldEmail, cadence_interval_days: Number(e.target.value) })}
                  placeholder="Ex: 3"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <LinkIcon className="w-4 h-4" />
                Link dos Scripts de Email
              </Label>
              <Input
                value={coldEmail.scripts_url || ''}
                onChange={(e) => setColdEmail({ ...coldEmail, scripts_url: e.target.value })}
                placeholder="Cole o link dos templates de email..."
              />
            </div>

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                value={coldEmail.notes || ''}
                onChange={(e) => setColdEmail({ ...coldEmail, notes: e.target.value })}
                placeholder="Notas adicionais..."
                className="min-h-[60px]"
              />
            </div>
          </div>
        </OutboundFunnelCard>

        {/* WhatsApp Outreach */}
        <OutboundFunnelCard
          title="WhatsApp Outreach"
          description="Abordagem ativa via WhatsApp Business para prospects B2B"
          icon={<MessageSquare className="w-5 h-5 text-white" />}
          color="bg-gradient-to-br from-green-500 to-green-600"
          enabled={whatsappOutreach.enabled}
          setEnabled={(v) => setWhatsappOutreach({ ...whatsappOutreach, enabled: v })}
        >
          <div className="space-y-4">
            <div className="p-3 bg-info/10 rounded-lg text-sm text-info border border-info/20">
              <strong>Como funciona:</strong>
              <ul className="list-disc ml-4 mt-2 space-y-1">
                <li>Envio de mensagens personalizadas para prospects</li>
                <li>Sequência de follow-up estruturada</li>
                <li>Possibilidade de automação com ferramentas especializadas</li>
                <li>Abordagem consultiva focada em gerar valor</li>
              </ul>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Mensagens/dia (meta)</Label>
                <Input
                  type="number"
                  min="0"
                  value={whatsappOutreach.daily_messages || ''}
                  onChange={(e) => setWhatsappOutreach({ ...whatsappOutreach, daily_messages: Number(e.target.value) })}
                  placeholder="Ex: 25"
                />
              </div>
              <div className="space-y-2">
                <Label>Usar automação?</Label>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={whatsappOutreach.use_automation || false}
                    onCheckedChange={(v) => setWhatsappOutreach({ ...whatsappOutreach, use_automation: v })}
                  />
                  <span className="text-sm text-muted-foreground">
                    {whatsappOutreach.use_automation ? 'Sim' : 'Não (envio manual)'}
                  </span>
                </div>
              </div>
            </div>

            {whatsappOutreach.use_automation && (
              <div className="space-y-2">
                <Label>Ferramenta de Automação</Label>
                <Input
                  value={whatsappOutreach.automation_tool || ''}
                  onChange={(e) => setWhatsappOutreach({ ...whatsappOutreach, automation_tool: e.target.value })}
                  placeholder="Ex: Z-API, Evolution API, Twilio..."
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Template de Mensagem Inicial</Label>
              <Textarea
                value={whatsappOutreach.initial_message_template || ''}
                onChange={(e) => setWhatsappOutreach({ ...whatsappOutreach, initial_message_template: e.target.value })}
                placeholder="Mensagem inicial de abordagem..."
                className="min-h-[80px]"
              />
            </div>

            <div className="space-y-2">
              <Label>Template de Follow-up</Label>
              <Textarea
                value={whatsappOutreach.followup_message_template || ''}
                onChange={(e) => setWhatsappOutreach({ ...whatsappOutreach, followup_message_template: e.target.value })}
                placeholder="Mensagem de follow-up caso não responda..."
                className="min-h-[80px]"
              />
            </div>

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                value={whatsappOutreach.notes || ''}
                onChange={(e) => setWhatsappOutreach({ ...whatsappOutreach, notes: e.target.value })}
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
