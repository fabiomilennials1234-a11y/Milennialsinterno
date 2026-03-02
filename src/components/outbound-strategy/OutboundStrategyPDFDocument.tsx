import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from '@react-pdf/renderer';
import {
  OutboundStrategy,
  ProspeccaoAtivaConfig,
  RemarketingBaseConfig,
} from '@/hooks/useOutboundStrategies';

// Millennials B2B Brand Colors - Premium Gradient Theme
const COLORS = {
  chaoFabrica: '#3A2E2C',
  farolCarga: '#FFD400',
  luzGalpao: '#F5F5DC',
  acoIndustrial: '#6B7A6F',

  gradientDark: '#0F0A09',
  gradientMid: '#1F1815',
  gradientLight: '#2D2420',

  cardBg: '#1A1514',
  cardBgLight: '#241E1C',
  surfaceGlow: '#3D2E28',

  textPrimary: '#F5F5DC',
  textSecondary: '#B8A89C',
  textMuted: '#8B7B6F',

  gold: '#FFD400',
  goldLight: '#FFE34D',
  goldDark: '#CC9900',

  success: '#10B981',
  successLight: '#34D399',
  warning: '#F59E0B',

  prospeccao: '#3B82F6',
  remarketing: '#8B5CF6',
  ambos: '#F59E0B',
};

const styles = StyleSheet.create({
  page: {
    padding: 0,
    backgroundColor: COLORS.gradientDark,
    fontFamily: 'Helvetica',
  },

  // Hero Header
  heroHeader: {
    backgroundColor: COLORS.gradientDark,
    paddingTop: 50,
    paddingBottom: 40,
    paddingHorizontal: 50,
    borderBottomWidth: 3,
    borderBottomColor: COLORS.gold,
    position: 'relative',
  },
  headerTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
  },
  logoText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.gold,
    letterSpacing: 4,
    textTransform: 'uppercase',
  },
  proBadge: {
    backgroundColor: COLORS.gold,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  proBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: COLORS.gradientDark,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  heroTitle: {
    fontSize: 36,
    fontWeight: 'bold',
    color: COLORS.luzGalpao,
    marginBottom: 10,
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    letterSpacing: 0.5,
  },
  heroClientName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.gold,
    marginTop: 15,
  },
  heroDate: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 8,
  },

  // Content wrapper
  content: {
    padding: 40,
    paddingTop: 30,
  },

  // Section title
  sectionTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: COLORS.gold,
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },

  // General settings card
  settingsCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 16,
    padding: 25,
    marginBottom: 25,
    borderWidth: 1,
    borderColor: COLORS.surfaceGlow,
  },
  settingsRow: {
    flexDirection: 'row',
    marginBottom: 14,
    alignItems: 'flex-start',
  },
  settingsLabel: {
    fontSize: 10,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    width: 140,
    paddingTop: 2,
  },
  settingsValue: {
    fontSize: 12,
    color: COLORS.luzGalpao,
    flex: 1,
    lineHeight: 1.5,
  },
  settingsValueHighlight: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.gold,
    flex: 1,
  },

  // Strategy type badges
  badgesContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 15,
    marginBottom: 25,
    marginTop: 10,
  },
  badge: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 2,
    alignItems: 'center',
  },
  badgeEnabled: {
    opacity: 1,
  },
  badgeDisabled: {
    opacity: 0.3,
  },
  badgeProspeccao: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderColor: COLORS.prospeccao,
  },
  badgeRemarketing: {
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    borderColor: COLORS.remarketing,
  },
  badgeAmbos: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderColor: COLORS.ambos,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  badgeStatus: {
    fontSize: 8,
    marginTop: 3,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Sub-strategy section
  subStrategySection: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 16,
    marginBottom: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.surfaceGlow,
  },
  subStrategyHeader: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.gold,
  },
  subStrategyHeaderProspeccao: {
    backgroundColor: COLORS.prospeccao,
  },
  subStrategyHeaderRemarketing: {
    backgroundColor: COLORS.remarketing,
  },
  subStrategyTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  subStrategySubtitle: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 2,
  },
  subStrategyContent: {
    padding: 20,
  },
  configRow: {
    flexDirection: 'row',
    marginBottom: 10,
    alignItems: 'flex-start',
  },
  configLabel: {
    fontSize: 9,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    width: 130,
    paddingTop: 2,
  },
  configValue: {
    fontSize: 11,
    color: COLORS.luzGalpao,
    flex: 1,
    lineHeight: 1.5,
  },
  configDivider: {
    height: 1,
    backgroundColor: COLORS.surfaceGlow,
    marginVertical: 10,
  },

  // Template block
  templateBlock: {
    backgroundColor: COLORS.gradientDark,
    borderRadius: 10,
    padding: 15,
    marginTop: 10,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.gold,
  },
  templateLabel: {
    fontSize: 9,
    color: COLORS.gold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
    fontWeight: 'bold',
  },
  templateText: {
    fontSize: 10,
    color: COLORS.textSecondary,
    lineHeight: 1.6,
  },

  // Notes card
  notesCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 16,
    padding: 25,
    marginBottom: 25,
    borderWidth: 1,
    borderColor: COLORS.surfaceGlow,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.gold,
  },
  notesText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    lineHeight: 1.7,
  },

  // Footer
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.gradientDark,
    padding: 20,
    paddingHorizontal: 40,
    borderTopWidth: 2,
    borderTopColor: COLORS.gold,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerLeft: {
    flexDirection: 'column',
  },
  footerText: {
    fontSize: 9,
    color: COLORS.textMuted,
    marginBottom: 3,
  },
  footerBrand: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footerBrandText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.gold,
    letterSpacing: 2,
  },
  footerTagline: {
    fontSize: 8,
    color: COLORS.textMuted,
    marginLeft: 10,
  },
});

// --- Helper Components ---

function FooterBlock() {
  return (
    <View style={styles.footer}>
      <View style={styles.footerLeft}>
        <Text style={styles.footerText}>Documento confidencial &bull; Válido por 30 dias</Text>
        <Text style={styles.footerText}>&copy; {new Date().getFullYear()} Todos os direitos reservados</Text>
      </View>
      <View style={styles.footerBrand}>
        <Text style={styles.footerBrandText}>MILLENNIALS B2B</Text>
        <Text style={styles.footerTagline}>Marketing que Vende</Text>
      </View>
    </View>
  );
}

function SettingRow({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string | number | null | undefined;
  highlight?: boolean;
}) {
  if (!value && value !== 0) return null;
  return (
    <View style={styles.settingsRow}>
      <Text style={styles.settingsLabel}>{label}</Text>
      <Text style={highlight ? styles.settingsValueHighlight : styles.settingsValue}>
        {String(value)}
      </Text>
    </View>
  );
}

function ConfigRow({
  label,
  value,
}: {
  label: string;
  value: string | number | boolean | null | undefined;
}) {
  if (value === null || value === undefined || value === '') return null;
  const displayValue = typeof value === 'boolean' ? (value ? 'Sim' : 'Não') : String(value);
  return (
    <View style={styles.configRow}>
      <Text style={styles.configLabel}>{label}</Text>
      <Text style={styles.configValue}>{displayValue}</Text>
    </View>
  );
}

function TemplateBlock({ label, text }: { label: string; text: string | null | undefined }) {
  if (!text) return null;
  return (
    <View style={styles.templateBlock}>
      <Text style={styles.templateLabel}>{label}</Text>
      <Text style={styles.templateText}>{text}</Text>
    </View>
  );
}

// --- Sub-strategy renderers ---

function ProspeccaoAtivaSubStrategy({
  title,
  subtitle,
  config,
}: {
  title: string;
  subtitle: string;
  config: ProspeccaoAtivaConfig | null;
}) {
  if (!config || !config.enabled) return null;

  return (
    <View style={styles.subStrategySection} wrap={false}>
      <View style={[styles.subStrategyHeader, styles.subStrategyHeaderProspeccao]}>
        <Text style={styles.subStrategyTitle}>{title}</Text>
        <Text style={styles.subStrategySubtitle}>{subtitle}</Text>
      </View>
      <View style={styles.subStrategyContent}>
        <ConfigRow label="Conexões/dia" value={config.daily_connections} />
        <ConfigRow label="Mensagens/dia" value={config.daily_messages} />
        <ConfigRow label="Ligações/dia" value={config.daily_calls_target} />
        <ConfigRow label="E-mails/dia" value={config.daily_emails_target} />
        <ConfigRow label="Etapas cadência" value={config.cadence_steps} />
        <ConfigRow label="Intervalo (dias)" value={config.cadence_interval_days} />
        <ConfigRow label="Automação" value={config.use_automation} />
        <ConfigRow label="Ferramenta" value={config.automation_tool} />
        <ConfigRow label="Cargos-alvo" value={config.target_titles} />
        <ConfigRow label="Indústrias-alvo" value={config.target_industries} />
        <ConfigRow label="Ferr. ligação" value={config.call_tool} />
        <ConfigRow label="Melhor horário" value={config.best_time_to_call} />
        <ConfigRow label="Ferr. e-mail" value={config.email_tool} />

        <TemplateBlock label="Mensagem Inicial" text={config.initial_message_template} />
        <TemplateBlock label="Follow-up" text={config.followup_message_template} />

        <ConfigRow label="URL Scripts" value={config.scripts_url} />
        <ConfigRow label="Observações" value={config.notes} />
      </View>
    </View>
  );
}

function RemarketingBaseSubStrategy({
  title,
  subtitle,
  config,
}: {
  title: string;
  subtitle: string;
  config: RemarketingBaseConfig | null;
}) {
  if (!config || !config.enabled) return null;

  return (
    <View style={styles.subStrategySection} wrap={false}>
      <View style={[styles.subStrategyHeader, styles.subStrategyHeaderRemarketing]}>
        <Text style={styles.subStrategyTitle}>{title}</Text>
        <Text style={styles.subStrategySubtitle}>{subtitle}</Text>
      </View>
      <View style={styles.subStrategyContent}>
        <ConfigRow label="Tamanho base" value={config.base_size} />
        <ConfigRow label="Ferr. e-mail" value={config.email_tool} />
        <ConfigRow label="Etapas cadência" value={config.cadence_steps} />
        <ConfigRow label="Intervalo (dias)" value={config.cadence_interval_days} />
        <ConfigRow label="Freq. mensagens" value={config.message_frequency} />
        <ConfigRow label="Tipo conteúdo" value={config.content_type} />
        <ConfigRow label="Tipo oferta" value={config.offer_type} />
        <ConfigRow label="Abordagem" value={config.approach} />
        <ConfigRow label="Segmento-alvo" value={config.target_segment} />
        <ConfigRow label="Detalhes oferta" value={config.offer_details} />

        <TemplateBlock label="Mensagem Inicial" text={config.initial_message_template} />

        <ConfigRow label="URL Scripts" value={config.scripts_url} />
        <ConfigRow label="Observações" value={config.notes} />
      </View>
    </View>
  );
}

// --- Main Document ---

interface OutboundStrategyPDFDocumentProps {
  strategy: OutboundStrategy;
  clientName: string;
}

export default function OutboundStrategyPDFDocument({
  strategy,
  clientName,
}: OutboundStrategyPDFDocumentProps) {
  const dateFormatted = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  const budgetFormatted = strategy.monthly_budget
    ? `R$ ${strategy.monthly_budget.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
    : null;

  const hasProspeccao =
    strategy.prospeccao_ativa_enabled &&
    (strategy.pa_linkedin_prospecting?.enabled ||
      strategy.pa_cold_calling?.enabled ||
      strategy.pa_cold_email?.enabled ||
      strategy.pa_whatsapp_outreach?.enabled);

  const hasRemarketing =
    strategy.remarketing_base_enabled &&
    (strategy.rb_email_reactivation?.enabled ||
      strategy.rb_whatsapp_nurturing?.enabled ||
      strategy.rb_upsell_crosssell?.enabled);

  return (
    <Document>
      {/* ============ PAGE 1: Hero + General Settings ============ */}
      <Page size="A4" style={styles.page}>
        {/* Hero Header */}
        <View style={styles.heroHeader}>
          <View style={styles.headerTopBar}>
            <Text style={styles.logoText}>MILLENNIALS B2B</Text>
            <View style={styles.proBadge}>
              <Text style={styles.proBadgeText}>Outbound PRO+</Text>
            </View>
          </View>
          <Text style={styles.heroTitle}>Estratégia Outbound PRO+</Text>
          <Text style={styles.heroSubtitle}>
            Plano estratégico de prospecção ativa e remarketing de base
          </Text>
          <Text style={styles.heroClientName}>{clientName}</Text>
          <Text style={styles.heroDate}>{dateFormatted}</Text>
        </View>

        {/* General Settings */}
        <View style={styles.content}>
          <Text style={styles.sectionTitle}>Configurações Gerais</Text>
          <View style={styles.settingsCard}>
            <SettingRow label="Investimento mensal" value={budgetFormatted} highlight />
            <SettingRow label="Região-alvo" value={strategy.target_region} />
            <SettingRow label="ICP (Perfil ideal)" value={strategy.target_icp} />
            <SettingRow label="Ferramentas" value={strategy.tools_used} />
            <SettingRow
              label="Base de clientes"
              value={
                strategy.use_client_base
                  ? strategy.client_base_details || 'Sim (sem detalhes informados)'
                  : 'Não utiliza base própria'
              }
            />
          </View>

          {/* Strategy type badges */}
          <Text style={styles.sectionTitle}>Tipo de Estratégia</Text>
          <View style={styles.badgesContainer}>
            <View
              style={[
                styles.badge,
                styles.badgeProspeccao,
                strategy.prospeccao_ativa_enabled ? styles.badgeEnabled : styles.badgeDisabled,
              ]}
            >
              <Text style={styles.badgeText}>Prospecção Ativa</Text>
              <Text
                style={[
                  styles.badgeStatus,
                  { color: strategy.prospeccao_ativa_enabled ? COLORS.prospeccao : COLORS.textMuted },
                ]}
              >
                {strategy.prospeccao_ativa_enabled ? 'ATIVO' : 'INATIVO'}
              </Text>
            </View>

            <View
              style={[
                styles.badge,
                styles.badgeRemarketing,
                strategy.remarketing_base_enabled ? styles.badgeEnabled : styles.badgeDisabled,
              ]}
            >
              <Text style={styles.badgeText}>Remarketing de Base</Text>
              <Text
                style={[
                  styles.badgeStatus,
                  { color: strategy.remarketing_base_enabled ? COLORS.remarketing : COLORS.textMuted },
                ]}
              >
                {strategy.remarketing_base_enabled ? 'ATIVO' : 'INATIVO'}
              </Text>
            </View>

            <View
              style={[
                styles.badge,
                styles.badgeAmbos,
                strategy.ambos_enabled ? styles.badgeEnabled : styles.badgeDisabled,
              ]}
            >
              <Text style={styles.badgeText}>Ambos</Text>
              <Text
                style={[
                  styles.badgeStatus,
                  { color: strategy.ambos_enabled ? COLORS.ambos : COLORS.textMuted },
                ]}
              >
                {strategy.ambos_enabled ? 'ATIVO' : 'INATIVO'}
              </Text>
            </View>
          </View>
        </View>

        <FooterBlock />
      </Page>

      {/* ============ PAGE 2+: Prospecção Ativa Sub-strategies ============ */}
      {hasProspeccao && (
        <Page size="A4" style={styles.page}>
          <View style={styles.content}>
            <Text style={styles.sectionTitle}>Prospecção Ativa — Canais Configurados</Text>

            <ProspeccaoAtivaSubStrategy
              title="LinkedIn Prospecting"
              subtitle="Prospecção via LinkedIn"
              config={strategy.pa_linkedin_prospecting}
            />

            <ProspeccaoAtivaSubStrategy
              title="Cold Calling"
              subtitle="Ligações frias para leads qualificados"
              config={strategy.pa_cold_calling}
            />

            <ProspeccaoAtivaSubStrategy
              title="Cold E-mail"
              subtitle="Campanhas de e-mail frio"
              config={strategy.pa_cold_email}
            />

            <ProspeccaoAtivaSubStrategy
              title="WhatsApp Outreach"
              subtitle="Prospecção ativa via WhatsApp"
              config={strategy.pa_whatsapp_outreach}
            />
          </View>

          <FooterBlock />
        </Page>
      )}

      {/* ============ PAGE 3+: Remarketing de Base Sub-strategies ============ */}
      {hasRemarketing && (
        <Page size="A4" style={styles.page}>
          <View style={styles.content}>
            <Text style={styles.sectionTitle}>Remarketing de Base — Canais Configurados</Text>

            <RemarketingBaseSubStrategy
              title="Reativação por E-mail"
              subtitle="Campanhas de reativação da base"
              config={strategy.rb_email_reactivation}
            />

            <RemarketingBaseSubStrategy
              title="Nutrição via WhatsApp"
              subtitle="Nurturing de leads via WhatsApp"
              config={strategy.rb_whatsapp_nurturing}
            />

            <RemarketingBaseSubStrategy
              title="Upsell & Cross-sell"
              subtitle="Estratégia de expansão de conta"
              config={strategy.rb_upsell_crosssell}
            />
          </View>

          <FooterBlock />
        </Page>
      )}

      {/* ============ COMBINED NOTES PAGE (if ambos_enabled) ============ */}
      {strategy.ambos_enabled && strategy.ambos_combined_notes && (
        <Page size="A4" style={styles.page}>
          <View style={styles.content}>
            <Text style={styles.sectionTitle}>Notas da Estratégia Combinada</Text>
            <View style={styles.notesCard}>
              <Text style={styles.notesText}>{strategy.ambos_combined_notes}</Text>
            </View>
          </View>

          <FooterBlock />
        </Page>
      )}

      {/* ============ FINAL PAGE: Footer Note ============ */}
      <Page size="A4" style={styles.page}>
        <View style={styles.content}>
          <Text style={styles.sectionTitle}>Observações Finais</Text>
          <View style={styles.notesCard}>
            <Text style={styles.notesText}>
              Este documento apresenta a estratégia outbound completa elaborada para {clientName}.
              Todas as configurações, cadências e templates foram desenhados com base no perfil
              ideal de cliente (ICP) e nas melhores práticas de prospecção B2B.
            </Text>
            <Text style={[styles.notesText, { marginTop: 12 }]}>
              A execução disciplinada das cadências definidas, aliada ao monitoramento constante
              dos indicadores de performance, será essencial para alcançar os resultados esperados.
            </Text>
            <Text style={[styles.notesText, { marginTop: 12, color: COLORS.gold, fontWeight: 'bold' }]}>
              Em caso de dúvidas, entre em contato com o time Millennials B2B.
            </Text>
          </View>
        </View>

        <FooterBlock />
      </Page>
    </Document>
  );
}
