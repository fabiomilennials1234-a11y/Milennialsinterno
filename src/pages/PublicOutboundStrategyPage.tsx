import { useParams } from 'react-router-dom';
import { usePublicOutboundStrategy } from '@/hooks/useOutboundStrategies';
import { MgrowthLogo } from '@/components/ui/MgrowthLogo';
import { motion } from 'framer-motion';
import StrategyMarcosSection from '@/components/strategy/StrategyMarcosSection';
import OutboundStrategyProximosPassosSection from '@/components/outbound-strategy/OutboundStrategyProximosPassosSection';
import OutboundStrategyExpectativaSection from '@/components/outbound-strategy/OutboundStrategyExpectativaSection';
import {
  Loader2,
  Target,
  DollarSign,
  MapPin,
  Users,
  Wrench,
  Database,
  Linkedin,
  Phone,
  Mail,
  MessageSquare,
  MessageCircle,
  TrendingUp,
  CheckCircle2,
  Link2,
  Clock,
} from 'lucide-react';

const COLORS = {
  chaoFabrica: '#3A2E2C',
  farolCarga: '#FFD400',
  luzGalpao: '#F5F5DC',
  acoIndustrial: '#6B7A6F',
};

// Sub-strategy display config
const PA_CONFIG = {
  linkedin_prospecting: {
    title: 'LinkedIn Prospecting',
    icon: Linkedin,
    tagline: 'Prospecção B2B via LinkedIn',
    description: 'Envio diário de conexões e mensagens personalizadas para decisores-alvo no LinkedIn, com cadência de follow-ups estruturada.',
    configItems: [
      { key: 'daily_connections', label: 'Conexões/dia', icon: Users },
      { key: 'daily_messages', label: 'Mensagens/dia', icon: MessageSquare },
      { key: 'target_titles', label: 'Cargos-alvo', icon: Target },
      { key: 'target_industries', label: 'Setores-alvo', icon: Database },
      { key: 'scripts_url', label: 'Scripts', icon: Link2 },
    ],
  },
  cold_calling: {
    title: 'Cold Calling',
    icon: Phone,
    tagline: 'Ligações diretas para decisores',
    description: 'Ligações estruturadas para prospects qualificados, com script otimizado e rastreamento de resultados.',
    configItems: [
      { key: 'daily_calls_target', label: 'Ligações/dia', icon: Phone },
      { key: 'call_tool', label: 'Ferramenta', icon: Wrench },
      { key: 'best_time_to_call', label: 'Melhor horário', icon: Clock },
      { key: 'scripts_url', label: 'Script', icon: Link2 },
    ],
  },
  cold_email: {
    title: 'Cold Email',
    icon: Mail,
    tagline: 'Cadência automatizada de emails',
    description: 'Sequências de email personalizadas com múltiplos touchpoints, A/B test e monitoramento de abertura e respostas.',
    configItems: [
      { key: 'daily_emails_target', label: 'Emails/dia', icon: Mail },
      { key: 'email_tool', label: 'Ferramenta', icon: Wrench },
      { key: 'cadence_steps', label: 'Etapas da cadência', icon: Target },
      { key: 'cadence_interval_days', label: 'Intervalo (dias)', icon: Clock },
      { key: 'scripts_url', label: 'Scripts', icon: Link2 },
    ],
  },
  whatsapp_outreach: {
    title: 'WhatsApp Outreach',
    icon: MessageSquare,
    tagline: 'Abordagem direta via WhatsApp',
    description: 'Mensagens personalizadas para prospects via WhatsApp Business, com templates otimizados e sequência de follow-ups.',
    configItems: [
      { key: 'daily_messages', label: 'Mensagens/dia', icon: MessageSquare },
      { key: 'use_automation', label: 'Automação', icon: Wrench },
      { key: 'automation_tool', label: 'Ferramenta', icon: Wrench },
    ],
  },
};

const RB_CONFIG = {
  email_reactivation: {
    title: 'Reativação por Email',
    icon: Mail,
    tagline: 'Reativação da base existente',
    description: 'Cadência de emails estratégicos para reativar leads e clientes inativos, com ofertas e conteúdo de valor.',
    configItems: [
      { key: 'base_size', label: 'Tamanho da base', icon: Database },
      { key: 'email_tool', label: 'Ferramenta', icon: Wrench },
      { key: 'cadence_steps', label: 'Etapas', icon: Target },
      { key: 'cadence_interval_days', label: 'Intervalo (dias)', icon: Clock },
      { key: 'offer_type', label: 'Tipo de oferta', icon: DollarSign },
      { key: 'scripts_url', label: 'Scripts', icon: Link2 },
    ],
  },
  whatsapp_nurturing: {
    title: 'WhatsApp Nurturing',
    icon: MessageCircle,
    tagline: 'Nutrição de leads via WhatsApp',
    description: 'Disparos periódicos de conteúdo de valor para a base, mantendo relacionamento e gerando oportunidades de negócio.',
    configItems: [
      { key: 'base_size', label: 'Tamanho da base', icon: Database },
      { key: 'message_frequency', label: 'Frequência', icon: Clock },
      { key: 'content_type', label: 'Tipo de conteúdo', icon: Target },
    ],
  },
  upsell_crosssell: {
    title: 'Upsell / Cross-sell',
    icon: TrendingUp,
    tagline: 'Vendas para clientes existentes',
    description: 'Estratégia focada em aumentar o ticket médio com upgrades e produtos complementares para a base de clientes.',
    configItems: [
      { key: 'approach', label: 'Abordagem', icon: Target },
      { key: 'target_segment', label: 'Segmento alvo', icon: Users },
      { key: 'scripts_url', label: 'Scripts', icon: Link2 },
    ],
  },
};

function SubStrategyCard({ config, data, color }: { config: any; data: any; color: string }) {
  if (!data?.enabled) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="rounded-2xl overflow-hidden"
      style={{
        backgroundColor: COLORS.chaoFabrica,
        border: `1px solid ${COLORS.farolCarga}20`,
      }}
    >
      {/* Header */}
      <div
        className="p-6"
        style={{
          background: `linear-gradient(135deg, ${color}15 0%, transparent 100%)`,
        }}
      >
        <div className="flex items-center gap-4 mb-3">
          <div
            className="w-14 h-14 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: `${color}20` }}
          >
            <config.icon className="w-7 h-7" style={{ color }} />
          </div>
          <div>
            <h3
              className="text-xl font-bold"
              style={{ color: COLORS.luzGalpao }}
            >
              {config.title}
            </h3>
            <p className="text-sm font-medium" style={{ color }}>
              {config.tagline}
            </p>
          </div>
        </div>
        <p className="text-sm" style={{ color: COLORS.acoIndustrial }}>
          {config.description}
        </p>
      </div>

      {/* Config items */}
      <div className="p-6 pt-0">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
          {config.configItems.map((item: any) => {
            const value = data[item.key];
            if (value === undefined || value === null || value === '') return null;

            const displayValue =
              typeof value === 'boolean'
                ? value
                  ? 'Sim'
                  : 'Não'
                : String(value);

            return (
              <div
                key={item.key}
                className="flex items-center gap-3 p-3 rounded-lg"
                style={{ backgroundColor: `${COLORS.farolCarga}08` }}
              >
                <item.icon
                  className="w-4 h-4 flex-shrink-0"
                  style={{ color: COLORS.farolCarga }}
                />
                <div className="min-w-0">
                  <p
                    className="text-xs font-medium"
                    style={{ color: COLORS.acoIndustrial }}
                  >
                    {item.label}
                  </p>
                  <p
                    className="text-sm font-semibold truncate"
                    style={{ color: COLORS.luzGalpao }}
                  >
                    {displayValue}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Notes */}
        {data.notes && (
          <div
            className="mt-4 p-4 rounded-lg"
            style={{
              backgroundColor: `${COLORS.farolCarga}08`,
              border: `1px solid ${COLORS.farolCarga}15`,
            }}
          >
            <p
              className="text-xs font-medium mb-1"
              style={{ color: COLORS.acoIndustrial }}
            >
              Observações
            </p>
            <p className="text-sm" style={{ color: COLORS.luzGalpao }}>
              {data.notes}
            </p>
          </div>
        )}

        {/* Templates */}
        {data.initial_message_template && (
          <div
            className="mt-3 p-4 rounded-lg"
            style={{
              backgroundColor: `${COLORS.farolCarga}08`,
              border: `1px solid ${COLORS.farolCarga}15`,
            }}
          >
            <p
              className="text-xs font-medium mb-1"
              style={{ color: COLORS.acoIndustrial }}
            >
              Mensagem Inicial
            </p>
            <p
              className="text-sm whitespace-pre-wrap"
              style={{ color: COLORS.luzGalpao }}
            >
              {data.initial_message_template}
            </p>
          </div>
        )}

        {data.followup_message_template && (
          <div
            className="mt-3 p-4 rounded-lg"
            style={{
              backgroundColor: `${COLORS.farolCarga}08`,
              border: `1px solid ${COLORS.farolCarga}15`,
            }}
          >
            <p
              className="text-xs font-medium mb-1"
              style={{ color: COLORS.acoIndustrial }}
            >
              Mensagem de Follow-up
            </p>
            <p
              className="text-sm whitespace-pre-wrap"
              style={{ color: COLORS.luzGalpao }}
            >
              {data.followup_message_template}
            </p>
          </div>
        )}

        {data.offer_details && (
          <div
            className="mt-3 p-4 rounded-lg"
            style={{
              backgroundColor: `${COLORS.farolCarga}08`,
              border: `1px solid ${COLORS.farolCarga}15`,
            }}
          >
            <p
              className="text-xs font-medium mb-1"
              style={{ color: COLORS.acoIndustrial }}
            >
              Detalhes da Oferta
            </p>
            <p
              className="text-sm whitespace-pre-wrap"
              style={{ color: COLORS.luzGalpao }}
            >
              {data.offer_details}
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default function PublicOutboundStrategyPage() {
  const { token } = useParams<{ token: string }>();
  const { data: strategyData, isLoading, error } = usePublicOutboundStrategy(token || '');

  if (isLoading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: COLORS.chaoFabrica }}
      >
        <Loader2
          className="w-8 h-8 animate-spin"
          style={{ color: COLORS.farolCarga }}
        />
      </div>
    );
  }

  if (error || !strategyData) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: COLORS.chaoFabrica }}
      >
        <div className="text-center">
          <Target
            className="w-16 h-16 mx-auto mb-4 opacity-50"
            style={{ color: COLORS.farolCarga }}
          />
          <h1
            className="text-2xl font-bold mb-2"
            style={{ color: COLORS.luzGalpao }}
          >
            Estratégia não encontrada
          </h1>
          <p style={{ color: COLORS.acoIndustrial }}>
            Este link pode estar expirado ou a estratégia foi removida.
          </p>
        </div>
      </div>
    );
  }

  const strategy = strategyData;
  const clientName =
    (strategy as any).clients?.name || 'Cliente';
  const showProspeccao =
    strategy.prospeccao_ativa_enabled || strategy.ambos_enabled;
  const showRemarketing =
    strategy.remarketing_base_enabled || strategy.ambos_enabled;

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: COLORS.chaoFabrica }}
    >
      {/* Hero Section */}
      <section className="relative min-h-[60vh] flex items-center justify-center px-4 overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(ellipse at center, ${COLORS.farolCarga}10 0%, transparent 70%)`,
          }}
        />

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="relative z-10 text-center max-w-4xl mx-auto"
        >
          <div className="flex justify-center mb-8">
            <MgrowthLogo className="h-12" />
          </div>

          <div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6"
            style={{ backgroundColor: `${COLORS.farolCarga}20` }}
          >
            <Target className="w-5 h-5" style={{ color: COLORS.farolCarga }} />
            <span
              style={{ color: COLORS.farolCarga }}
              className="font-semibold text-sm"
            >
              ESTRATÉGIA OUTBOUND PRO+
            </span>
          </div>

          <h1
            className="text-4xl md:text-6xl font-bold mb-6 leading-tight"
            style={{ color: COLORS.luzGalpao }}
          >
            Estratégia{' '}
            <span style={{ color: COLORS.farolCarga }}>Outbound</span>
            <br />
            {clientName}
          </h1>

          <p
            className="text-lg md:text-xl max-w-2xl mx-auto"
            style={{ color: COLORS.acoIndustrial }}
          >
            Plano estratégico personalizado de prospecção ativa para gerar
            reuniões qualificadas e oportunidades de negócio.
          </p>

          {/* Strategy type badges */}
          <div className="flex items-center justify-center gap-3 mt-8">
            {(strategy.prospeccao_ativa_enabled || strategy.ambos_enabled) && (
              <div
                className="px-4 py-2 rounded-full text-sm font-semibold"
                style={{
                  backgroundColor: '#f97316' + '20',
                  color: '#f97316',
                }}
              >
                Prospecção Ativa
              </div>
            )}
            {(strategy.remarketing_base_enabled || strategy.ambos_enabled) && (
              <div
                className="px-4 py-2 rounded-full text-sm font-semibold"
                style={{
                  backgroundColor: '#22c55e' + '20',
                  color: '#22c55e',
                }}
              >
                Remarketing de Base
              </div>
            )}
            {strategy.ambos_enabled && (
              <div
                className="px-4 py-2 rounded-full text-sm font-semibold"
                style={{
                  backgroundColor: '#a855f7' + '20',
                  color: '#a855f7',
                }}
              >
                Estratégia Combinada
              </div>
            )}
          </div>
        </motion.div>
      </section>

      {/* General Settings Section */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2
              className="text-3xl font-bold mb-4"
              style={{ color: COLORS.luzGalpao }}
            >
              Visão <span style={{ color: COLORS.farolCarga }}>Geral</span>
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {strategy.monthly_budget && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="p-6 rounded-2xl"
                style={{
                  backgroundColor: COLORS.chaoFabrica,
                  border: `1px solid ${COLORS.farolCarga}20`,
                }}
              >
                <DollarSign
                  className="w-8 h-8 mb-3"
                  style={{ color: COLORS.farolCarga }}
                />
                <p
                  className="text-sm mb-1"
                  style={{ color: COLORS.acoIndustrial }}
                >
                  Orçamento Mensal
                </p>
                <p
                  className="text-2xl font-bold"
                  style={{ color: COLORS.luzGalpao }}
                >
                  R${' '}
                  {Number(strategy.monthly_budget).toLocaleString('pt-BR')}
                </p>
              </motion.div>
            )}

            {strategy.target_region && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 }}
                className="p-6 rounded-2xl"
                style={{
                  backgroundColor: COLORS.chaoFabrica,
                  border: `1px solid ${COLORS.farolCarga}20`,
                }}
              >
                <MapPin
                  className="w-8 h-8 mb-3"
                  style={{ color: COLORS.farolCarga }}
                />
                <p
                  className="text-sm mb-1"
                  style={{ color: COLORS.acoIndustrial }}
                >
                  Região Alvo
                </p>
                <p
                  className="text-lg font-bold"
                  style={{ color: COLORS.luzGalpao }}
                >
                  {strategy.target_region}
                </p>
              </motion.div>
            )}

            {strategy.tools_used && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 }}
                className="p-6 rounded-2xl"
                style={{
                  backgroundColor: COLORS.chaoFabrica,
                  border: `1px solid ${COLORS.farolCarga}20`,
                }}
              >
                <Wrench
                  className="w-8 h-8 mb-3"
                  style={{ color: COLORS.farolCarga }}
                />
                <p
                  className="text-sm mb-1"
                  style={{ color: COLORS.acoIndustrial }}
                >
                  Ferramentas
                </p>
                <p
                  className="text-lg font-bold"
                  style={{ color: COLORS.luzGalpao }}
                >
                  {strategy.tools_used}
                </p>
              </motion.div>
            )}
          </div>

          {/* ICP Section */}
          {strategy.target_icp && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="mt-8 p-6 rounded-2xl"
              style={{
                backgroundColor: COLORS.chaoFabrica,
                border: `1px solid ${COLORS.farolCarga}20`,
              }}
            >
              <div className="flex items-center gap-3 mb-3">
                <Users
                  className="w-6 h-6"
                  style={{ color: COLORS.farolCarga }}
                />
                <h3
                  className="text-lg font-bold"
                  style={{ color: COLORS.luzGalpao }}
                >
                  Perfil de Cliente Ideal (ICP)
                </h3>
              </div>
              <p
                className="whitespace-pre-wrap"
                style={{ color: COLORS.acoIndustrial }}
              >
                {strategy.target_icp}
              </p>
            </motion.div>
          )}

          {/* Client Base */}
          {strategy.use_client_base && strategy.client_base_details && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="mt-6 p-6 rounded-2xl"
              style={{
                backgroundColor: COLORS.chaoFabrica,
                border: `1px solid ${COLORS.farolCarga}20`,
              }}
            >
              <div className="flex items-center gap-3 mb-3">
                <Database
                  className="w-6 h-6"
                  style={{ color: COLORS.farolCarga }}
                />
                <h3
                  className="text-lg font-bold"
                  style={{ color: COLORS.luzGalpao }}
                >
                  Base de Contatos do Cliente
                </h3>
              </div>
              <p
                className="whitespace-pre-wrap"
                style={{ color: COLORS.acoIndustrial }}
              >
                {strategy.client_base_details}
              </p>
            </motion.div>
          )}
        </div>
      </section>

      {/* Sub-strategies */}
      {showProspeccao && (
        <section className="py-16 px-4">
          <div className="container mx-auto max-w-6xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-12"
            >
              <div
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-4"
                style={{ backgroundColor: '#f9731620' }}
              >
                <span className="text-xl">🎯</span>
                <span style={{ color: '#f97316' }} className="font-semibold">
                  PROSPECÇÃO ATIVA
                </span>
              </div>
              <h2
                className="text-3xl font-bold"
                style={{ color: COLORS.luzGalpao }}
              >
                Canais de{' '}
                <span style={{ color: '#f97316' }}>Prospecção</span>
              </h2>
            </motion.div>

            <div className="space-y-6">
              <SubStrategyCard
                config={PA_CONFIG.linkedin_prospecting}
                data={strategy.pa_linkedin_prospecting}
                color="#3b82f6"
              />
              <SubStrategyCard
                config={PA_CONFIG.cold_calling}
                data={strategy.pa_cold_calling}
                color="#f97316"
              />
              <SubStrategyCard
                config={PA_CONFIG.cold_email}
                data={strategy.pa_cold_email}
                color="#ef4444"
              />
              <SubStrategyCard
                config={PA_CONFIG.whatsapp_outreach}
                data={strategy.pa_whatsapp_outreach}
                color="#22c55e"
              />
            </div>
          </div>
        </section>
      )}

      {showRemarketing && (
        <section className="py-16 px-4">
          <div className="container mx-auto max-w-6xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-12"
            >
              <div
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-4"
                style={{ backgroundColor: '#22c55e20' }}
              >
                <span className="text-xl">🔄</span>
                <span style={{ color: '#22c55e' }} className="font-semibold">
                  REMARKETING DE BASE
                </span>
              </div>
              <h2
                className="text-3xl font-bold"
                style={{ color: COLORS.luzGalpao }}
              >
                Canais de{' '}
                <span style={{ color: '#22c55e' }}>Remarketing</span>
              </h2>
            </motion.div>

            <div className="space-y-6">
              <SubStrategyCard
                config={RB_CONFIG.email_reactivation}
                data={strategy.rb_email_reactivation}
                color="#3b82f6"
              />
              <SubStrategyCard
                config={RB_CONFIG.whatsapp_nurturing}
                data={strategy.rb_whatsapp_nurturing}
                color="#22c55e"
              />
              <SubStrategyCard
                config={RB_CONFIG.upsell_crosssell}
                data={strategy.rb_upsell_crosssell}
                color="#a855f7"
              />
            </div>
          </div>
        </section>
      )}

      {/* Combined Notes */}
      {strategy.ambos_enabled && strategy.ambos_combined_notes && (
        <section className="py-8 px-4">
          <div className="container mx-auto max-w-6xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="p-6 rounded-2xl"
              style={{
                backgroundColor: COLORS.chaoFabrica,
                border: `2px solid #a855f730`,
              }}
            >
              <div className="flex items-center gap-3 mb-3">
                <CheckCircle2
                  className="w-6 h-6"
                  style={{ color: '#a855f7' }}
                />
                <h3
                  className="text-lg font-bold"
                  style={{ color: COLORS.luzGalpao }}
                >
                  Estratégia Combinada - Notas
                </h3>
              </div>
              <p
                className="whitespace-pre-wrap"
                style={{ color: COLORS.acoIndustrial }}
              >
                {strategy.ambos_combined_notes}
              </p>
            </motion.div>
          </div>
        </section>
      )}

      {/* Marcos Section (reused from ads) */}
      <StrategyMarcosSection />

      {/* Próximos Passos (outbound-specific) */}
      <OutboundStrategyProximosPassosSection />

      {/* Expectativas (outbound-specific) */}
      <OutboundStrategyExpectativaSection
        prospeccaoAtivaEnabled={strategy.prospeccao_ativa_enabled}
        remarketingBaseEnabled={strategy.remarketing_base_enabled}
        ambosEnabled={strategy.ambos_enabled}
        paLinkedinProspecting={strategy.pa_linkedin_prospecting}
        paColdCalling={strategy.pa_cold_calling}
        paColdEmail={strategy.pa_cold_email}
        paWhatsappOutreach={strategy.pa_whatsapp_outreach}
        rbEmailReactivation={strategy.rb_email_reactivation}
        rbWhatsappNurturing={strategy.rb_whatsapp_nurturing}
        rbUpsellCrosssell={strategy.rb_upsell_crosssell}
      />

      {/* Footer */}
      <footer className="py-12 px-4 text-center">
        <div className="container mx-auto max-w-4xl">
          <div className="flex justify-center mb-4">
            <MgrowthLogo className="h-8 opacity-60" />
          </div>
          <p className="text-sm" style={{ color: COLORS.acoIndustrial }}>
            Millennials B2B - Estratégia Outbound PRO+
          </p>
          <p
            className="text-xs mt-2"
            style={{ color: `${COLORS.acoIndustrial}80` }}
          >
            Este documento é confidencial e de uso exclusivo do cliente.
          </p>
        </div>
      </footer>
    </div>
  );
}
