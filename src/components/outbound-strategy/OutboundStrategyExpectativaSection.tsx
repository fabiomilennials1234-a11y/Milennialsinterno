import { motion } from 'framer-motion';
import {
  AlertTriangle,
  DollarSign,
  Target,
  Clock,
  TrendingUp,
  Linkedin,
  Phone,
  Mail,
  MessageSquare,
  MessageCircle,
  CheckCircle2
} from 'lucide-react';

const COLORS = {
  chaoFabrica: '#3A2E2C',
  farolCarga: '#FFD400',
  luzGalpao: '#F5F5DC',
  acoIndustrial: '#6B7A6F',
};

interface FunnelExpectativa {
  title: string;
  icon: typeof MessageSquare;
  custoMedio: string;
  problemasPrimeiraMoment: string[];
  expectativasRealistas: string[];
}

const EXPECTATIVAS_PROSPECCAO: Record<string, FunnelExpectativa> = {
  linkedin_prospecting: {
    title: 'LinkedIn Prospecting',
    icon: Linkedin,
    custoMedio: 'Custo médio de R$ 5-15 por lead qualificado',
    problemasPrimeiraMoment: [
      'Taxa de aceitação de conexões pode ser baixa (10-30%)',
      'Decisores podem demorar para responder mensagens',
      'Perfil precisa ser otimizado antes de começar',
      'LinkedIn pode limitar ações se houver uso excessivo',
    ],
    expectativasRealistas: [
      'Resultados consistentes em 2-4 semanas de operação',
      'Taxa de resposta esperada: 15-30% das mensagens',
      'Reuniões agendadas: 5-15% dos que respondem',
      'Ideal para vendas B2B de alto ticket',
    ],
  },
  cold_calling: {
    title: 'Cold Calling',
    icon: Phone,
    custoMedio: 'Custo médio de R$ 10-30 por reunião agendada',
    problemasPrimeiraMoment: [
      'Alta taxa de rejeição nos primeiros contatos',
      'Decisores podem ser difíceis de alcançar por telefone',
      'Script de abordagem precisa de vários ajustes iniciais',
      'Horários de ligação precisam ser testados',
    ],
    expectativasRealistas: [
      'Taxa de conexão esperada: 15-25% das ligações',
      'Reuniões agendadas: 5-10% das conexões',
      'Scripts melhoram significativamente após 2 semanas',
      'Resultados escaláveis com equipe treinada',
    ],
  },
  cold_email: {
    title: 'Cold Email',
    icon: Mail,
    custoMedio: 'CPL médio de R$ 3-10 por resposta positiva',
    problemasPrimeiraMoment: [
      'Emails podem cair em spam se o domínio não estiver aquecido',
      'Taxa de abertura pode ser baixa inicialmente',
      'Subject lines precisam de A/B test contínuo',
      'Aquecimento de domínio leva 2-4 semanas',
    ],
    expectativasRealistas: [
      'Taxa de abertura esperada: 40-60% após otimização',
      'Taxa de resposta: 5-15% dos emails abertos',
      'Cadência completa de 4-5 etapas gera melhores resultados',
      'Melhor custo-benefício para volume alto',
    ],
  },
  whatsapp_outreach: {
    title: 'WhatsApp Outreach',
    icon: MessageSquare,
    custoMedio: 'Custo médio de R$ 5-20 por conversa iniciada',
    problemasPrimeiraMoment: [
      'Números podem ser bloqueados se abordagem for spam',
      'Muitos contatos não respondem mensagem fria',
      'Necessário ter números de WhatsApp validados',
      'Abordagem precisa ser consultiva, não agressiva',
    ],
    expectativasRealistas: [
      'Taxa de resposta: 20-40% com mensagem personalizada',
      'Canal com maior taxa de abertura (98%+)',
      'Conversas tendem a ser mais diretas e rápidas',
      'Funciona melhor combinado com outros canais',
    ],
  },
};

const EXPECTATIVAS_REMARKETING: Record<string, FunnelExpectativa> = {
  email_reactivation: {
    title: 'Reativação por Email',
    icon: Mail,
    custoMedio: 'CPL médio de R$ 2-8 por reativação',
    problemasPrimeiraMoment: [
      'Base antiga pode ter emails inválidos ou desatualizados',
      'Taxa de abertura inicial pode ser baixa',
      'Alguns emails podem cair em spam',
      'Leads reativados podem ter baixo interesse inicial',
    ],
    expectativasRealistas: [
      'Taxa de abertura esperada: 30-45%',
      'Taxa de reativação: 5-15% da base total',
      'Limpeza de lista é necessária antes dos disparos',
      'Melhor ROI quando combinado com outras estratégias',
    ],
  },
  whatsapp_nurturing: {
    title: 'WhatsApp Nurturing',
    icon: MessageCircle,
    custoMedio: 'Custo médio de R$ 1-5 por contato nutrido',
    problemasPrimeiraMoment: [
      'Contatos podem pedir para sair da lista',
      'Frequência alta pode irritar a base',
      'Conteúdo precisa ser relevante e não apenas comercial',
      'Gestão da base demanda tempo e dedicação',
    ],
    expectativasRealistas: [
      'Engajamento esperado: 40-60% dos contatos',
      'Conversão em oportunidades: 10-20% dos engajados',
      'Resultados de médio prazo (30-60 dias)',
      'Fortalece relacionamento e gera indicações',
    ],
  },
  upsell_crosssell: {
    title: 'Upsell / Cross-sell',
    icon: TrendingUp,
    custoMedio: 'ROI médio de 3-8x sobre o investimento',
    problemasPrimeiraMoment: [
      'Clientes podem não ver valor em upgrade',
      'Timing da oferta é crucial para conversão',
      'Abordagem errada pode gerar insatisfação',
      'Segmentação precisa ser precisa para funcionar',
    ],
    expectativasRealistas: [
      'Base quente tem 60-70% mais chance de converter',
      'Ticket médio pode aumentar 30-50% com cross-sell',
      'Resultados rápidos (1-2 semanas) por ser base conhecida',
      'LTV do cliente pode dobrar com estratégia bem executada',
    ],
  },
};

interface Props {
  prospeccaoAtivaEnabled?: boolean;
  remarketingBaseEnabled?: boolean;
  ambosEnabled?: boolean;
  paLinkedinProspecting?: any;
  paColdCalling?: any;
  paColdEmail?: any;
  paWhatsappOutreach?: any;
  rbEmailReactivation?: any;
  rbWhatsappNurturing?: any;
  rbUpsellCrosssell?: any;
}

export default function OutboundStrategyExpectativaSection({
  prospeccaoAtivaEnabled,
  remarketingBaseEnabled,
  ambosEnabled,
  paLinkedinProspecting,
  paColdCalling,
  paColdEmail,
  paWhatsappOutreach,
  rbEmailReactivation,
  rbWhatsappNurturing,
  rbUpsellCrosssell,
}: Props) {
  const showProspeccao = prospeccaoAtivaEnabled || ambosEnabled;
  const showRemarketing = remarketingBaseEnabled || ambosEnabled;

  const enabledFunnels: FunnelExpectativa[] = [];

  if (showProspeccao) {
    if (paLinkedinProspecting?.enabled) enabledFunnels.push(EXPECTATIVAS_PROSPECCAO.linkedin_prospecting);
    if (paColdCalling?.enabled) enabledFunnels.push(EXPECTATIVAS_PROSPECCAO.cold_calling);
    if (paColdEmail?.enabled) enabledFunnels.push(EXPECTATIVAS_PROSPECCAO.cold_email);
    if (paWhatsappOutreach?.enabled) enabledFunnels.push(EXPECTATIVAS_PROSPECCAO.whatsapp_outreach);
  }

  if (showRemarketing) {
    if (rbEmailReactivation?.enabled) enabledFunnels.push(EXPECTATIVAS_REMARKETING.email_reactivation);
    if (rbWhatsappNurturing?.enabled) enabledFunnels.push(EXPECTATIVAS_REMARKETING.whatsapp_nurturing);
    if (rbUpsellCrosssell?.enabled) enabledFunnels.push(EXPECTATIVAS_REMARKETING.upsell_crosssell);
  }

  if (enabledFunnels.length === 0) return null;

  return (
    <section className="py-20 px-4">
      <div className="container mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-4"
            style={{ backgroundColor: `${COLORS.farolCarga}20` }}
          >
            <Target className="w-5 h-5" style={{ color: COLORS.farolCarga }} />
            <span style={{ color: COLORS.farolCarga }} className="font-semibold">
              ALINHAMENTO DE EXPECTATIVA
            </span>
          </div>
          <h2
            className="text-3xl md:text-4xl font-bold mb-4"
            style={{ color: COLORS.luzGalpao }}
          >
            O que <span style={{ color: COLORS.farolCarga }}>Esperar</span> de Cada Canal
          </h2>
          <p style={{ color: COLORS.acoIndustrial }} className="max-w-3xl mx-auto text-lg">
            Transparência total sobre custos médios, desafios comuns nos primeiros momentos
            e expectativas realistas para cada canal de outbound ativado.
          </p>
        </motion.div>

        {/* Aviso Marco 01 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-12 p-6 rounded-2xl"
          style={{
            backgroundColor: `${COLORS.farolCarga}10`,
            border: `2px solid ${COLORS.farolCarga}30`
          }}
        >
          <div className="flex items-start gap-4">
            <div
              className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center"
              style={{ backgroundColor: COLORS.farolCarga }}
            >
              <AlertTriangle className="w-6 h-6" style={{ color: COLORS.chaoFabrica }} />
            </div>
            <div>
              <h3 className="text-lg font-bold mb-2" style={{ color: COLORS.farolCarga }}>
                Marco 01: Início da Operação Outbound
              </h3>
              <p style={{ color: COLORS.luzGalpao }} className="text-sm mb-3">
                As primeiras semanas são de <strong>teste, ajuste e calibragem</strong>.
                Neste momento validamos scripts, listas, canais e abordagens.
              </p>
              <ul className="space-y-2">
                <li className="flex items-start gap-2">
                  <Clock className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: COLORS.farolCarga }} />
                  <span className="text-sm" style={{ color: COLORS.acoIndustrial }}>
                    <strong>Primeiros 7-15 dias:</strong> Validação de listas, scripts e canais
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <TrendingUp className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: COLORS.farolCarga }} />
                  <span className="text-sm" style={{ color: COLORS.acoIndustrial }}>
                    <strong>Primeiros 30 dias:</strong> Primeiras reuniões e oportunidades reais
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Target className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: COLORS.farolCarga }} />
                  <span className="text-sm" style={{ color: COLORS.acoIndustrial }}>
                    <strong>60-90 dias:</strong> Pipeline consistente e previsibilidade
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </motion.div>

        {/* Funnels Grid */}
        <div className="space-y-8">
          {enabledFunnels.map((funnel, index) => (
            <motion.div
              key={funnel.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="rounded-2xl overflow-hidden"
              style={{
                backgroundColor: COLORS.chaoFabrica,
                border: `1px solid ${COLORS.farolCarga}20`
              }}
            >
              <div
                className="p-6 flex items-center gap-4"
                style={{
                  background: `linear-gradient(90deg, ${COLORS.farolCarga}15 0%, transparent 100%)`
                }}
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: `${COLORS.farolCarga}20` }}
                >
                  <funnel.icon className="w-6 h-6" style={{ color: COLORS.farolCarga }} />
                </div>
                <div>
                  <h3 className="text-lg font-bold" style={{ color: COLORS.luzGalpao }}>
                    {funnel.title}
                  </h3>
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4" style={{ color: COLORS.farolCarga }} />
                    <span className="text-sm font-semibold" style={{ color: COLORS.farolCarga }}>
                      {funnel.custoMedio}
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-6 grid md:grid-cols-2 gap-6">
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <AlertTriangle className="w-5 h-5" style={{ color: '#ef4444' }} />
                    <h4 className="font-semibold text-sm" style={{ color: COLORS.luzGalpao }}>
                      Desafios Comuns no Início
                    </h4>
                  </div>
                  <ul className="space-y-2">
                    {funnel.problemasPrimeiraMoment.map((problema, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0" style={{ backgroundColor: '#ef4444' }} />
                        <span className="text-sm" style={{ color: COLORS.acoIndustrial }}>{problema}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <CheckCircle2 className="w-5 h-5" style={{ color: '#22c55e' }} />
                    <h4 className="font-semibold text-sm" style={{ color: COLORS.luzGalpao }}>
                      Expectativas Realistas
                    </h4>
                  </div>
                  <ul className="space-y-2">
                    {funnel.expectativasRealistas.map((expectativa, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0" style={{ backgroundColor: '#22c55e' }} />
                        <span className="text-sm" style={{ color: COLORS.acoIndustrial }}>{expectativa}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mt-12 text-center p-6 rounded-2xl"
          style={{ backgroundColor: `${COLORS.chaoFabrica}80` }}
        >
          <p className="text-sm max-w-3xl mx-auto" style={{ color: COLORS.acoIndustrial }}>
            <strong style={{ color: COLORS.farolCarga }}>Lembre-se:</strong>{' '}
            Cada negócio é único. Os dados acima são baseados em médias de mercado e
            experiência acumulada da Millennials B2B. Resultados reais dependem de
            fatores como nicho, ICP, processo comercial e investimento disponível.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
