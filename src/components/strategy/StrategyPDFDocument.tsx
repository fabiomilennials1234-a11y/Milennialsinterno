import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
  Svg,
  Defs,
  LinearGradient,
  Stop,
  Rect,
} from '@react-pdf/renderer';
import { ClientStrategy, MetaStrategy, GoogleStrategy, LinkedInStrategy } from '@/hooks/useClientStrategies';

// Millennials B2B Brand Colors - Premium Gradient Theme
const COLORS = {
  // Primary palette
  chaoFabrica: '#3A2E2C',
  farolCarga: '#FFD400',
  luzGalpao: '#F5F5DC',
  acoUsinado: '#6B7A6F',
  
  // Gradient colors
  gradientDark: '#0F0A09',
  gradientMid: '#1F1815',
  gradientLight: '#2D2420',
  
  // Card and surface colors
  cardBg: '#1A1514',
  cardBgLight: '#241E1C',
  surfaceGlow: '#3D2E28',
  
  // Text colors
  textPrimary: '#F5F5DC',
  textSecondary: '#B8A89C',
  textMuted: '#8B7B6F',
  
  // Accent colors
  gold: '#FFD400',
  goldLight: '#FFE34D',
  goldDark: '#CC9900',
  amber: '#F59E0B',
  
  // Platform colors
  metaBlue: '#1877F2',
  metaGradient1: '#0062E0',
  metaGradient2: '#19AFFF',
  googleRed: '#EA4335',
  googleGradient1: '#DB4437',
  googleGradient2: '#F4B400',
  linkedinBlue: '#0077B5',
  linkedinGradient1: '#0A66C2',
  linkedinGradient2: '#00A0DC',
  
  // Status colors
  success: '#10B981',
  successLight: '#34D399',
  warning: '#F59E0B',
  warningLight: '#FBBF24',
};

const styles = StyleSheet.create({
  page: {
    padding: 0,
    backgroundColor: COLORS.gradientDark,
    fontFamily: 'Helvetica',
  },
  
  // Hero Header with gradient effect
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
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoImage: {
    width: 120,
    height: 40,
    objectFit: 'contain',
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
  heroAccentLine: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: COLORS.gold,
  },
  
  // Content wrapper
  content: {
    padding: 40,
    paddingTop: 30,
  },
  
  // Intro section
  introSection: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 16,
    padding: 25,
    marginBottom: 25,
    borderWidth: 1,
    borderColor: COLORS.surfaceGlow,
  },
  introTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: COLORS.gold,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  introText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    lineHeight: 1.7,
    marginBottom: 10,
  },
  introHighlight: {
    color: COLORS.gold,
    fontWeight: 'bold',
  },
  
  // Summary Stats with gradient effect
  statsContainer: {
    backgroundColor: COLORS.cardBgLight,
    borderRadius: 16,
    padding: 25,
    marginBottom: 25,
    borderWidth: 2,
    borderColor: COLORS.gold,
  },
  statsTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.gold,
    marginBottom: 20,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    textAlign: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
    padding: 15,
  },
  statValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.gold,
    marginBottom: 6,
  },
  statLabel: {
    fontSize: 10,
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    textAlign: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: COLORS.surfaceGlow,
    height: '100%',
  },
  
  // Investment Hero Section
  investmentSection: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 16,
    marginBottom: 25,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.surfaceGlow,
  },
  investmentHeader: {
    backgroundColor: COLORS.surfaceGlow,
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.gold,
  },
  investmentHeaderText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.gold,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  investmentContent: {
    padding: 25,
  },
  investmentGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  investmentCard: {
    width: '48%',
    backgroundColor: COLORS.gradientDark,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.surfaceGlow,
  },
  investmentCardHighlight: {
    borderColor: COLORS.gold,
    borderWidth: 2,
  },
  investmentLabel: {
    fontSize: 9,
    color: COLORS.textMuted,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    textAlign: 'center',
  },
  investmentValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.gold,
  },
  investmentValueRecommended: {
    color: COLORS.successLight,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.gradientDark,
    borderRadius: 10,
    padding: 15,
    borderWidth: 1,
    borderColor: COLORS.surfaceGlow,
  },
  locationIcon: {
    fontSize: 16,
    marginRight: 12,
  },
  locationLabel: {
    fontSize: 9,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  locationValue: {
    fontSize: 13,
    color: COLORS.luzGalpao,
    fontWeight: 'bold',
  },
  
  // Platform Section - Modern Card Design
  platformSection: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 16,
    marginBottom: 25,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.surfaceGlow,
  },
  platformHeader: {
    paddingVertical: 18,
    paddingHorizontal: 25,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  platformHeaderMeta: {
    backgroundColor: COLORS.metaBlue,
  },
  platformHeaderGoogle: {
    backgroundColor: COLORS.googleRed,
  },
  platformHeaderLinkedIn: {
    backgroundColor: COLORS.linkedinBlue,
  },
  platformTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  platformIcon: {
    fontSize: 18,
    marginRight: 12,
  },
  platformTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  platformSubtitle: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  platformBadge: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  platformBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  platformContent: {
    padding: 20,
  },
  platformIntro: {
    fontSize: 11,
    color: COLORS.textSecondary,
    lineHeight: 1.6,
    marginBottom: 20,
    padding: 15,
    backgroundColor: COLORS.gradientDark,
    borderRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.gold,
  },
  
  // Funnel Card - Premium Design
  funnelCard: {
    backgroundColor: COLORS.gradientDark,
    borderRadius: 14,
    padding: 22,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: COLORS.surfaceGlow,
  },
  funnelCardAccent: {
    borderLeftWidth: 4,
    borderLeftColor: COLORS.gold,
  },
  funnelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  funnelTitleContainer: {
    flex: 1,
    marginRight: 15,
  },
  funnelTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: COLORS.luzGalpao,
    marginBottom: 5,
    letterSpacing: 0.3,
  },
  funnelTagline: {
    fontSize: 10,
    color: COLORS.gold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  funnelBudget: {
    backgroundColor: COLORS.success,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  funnelBudgetText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  
  // Funnel Description - Expanded
  funnelDescription: {
    marginBottom: 18,
  },
  funnelDescTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: COLORS.gold,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  funnelDescText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    lineHeight: 1.65,
  },
  
  // Example section
  exampleSection: {
    backgroundColor: COLORS.cardBgLight,
    borderRadius: 10,
    padding: 15,
    marginBottom: 18,
  },
  exampleTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: COLORS.amber,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  exampleText: {
    fontSize: 10,
    color: COLORS.textSecondary,
    lineHeight: 1.55,
    fontStyle: 'italic',
  },
  
  // Details grid
  funnelDetailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 18,
  },
  funnelDetail: {
    backgroundColor: COLORS.cardBg,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.surfaceGlow,
  },
  funnelDetailLabel: {
    fontSize: 8,
    color: COLORS.gold,
    marginBottom: 3,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  funnelDetailValue: {
    fontSize: 10,
    color: COLORS.luzGalpao,
    fontWeight: 'bold',
  },
  
  // How it works - Expanded
  howItWorks: {
    borderTopWidth: 1,
    borderTopColor: COLORS.surfaceGlow,
    paddingTop: 16,
  },
  howItWorksTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: COLORS.gold,
    marginBottom: 14,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  howItWorksStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  howItWorksNumber: {
    backgroundColor: COLORS.gold,
    color: COLORS.gradientDark,
    fontSize: 9,
    fontWeight: 'bold',
    width: 20,
    height: 20,
    borderRadius: 10,
    textAlign: 'center',
    lineHeight: 20,
    marginRight: 12,
  },
  howItWorksText: {
    flex: 1,
    fontSize: 10,
    color: COLORS.textSecondary,
    lineHeight: 1.5,
  },
  
  // Benefits section
  benefitsSection: {
    backgroundColor: COLORS.cardBgLight,
    borderRadius: 10,
    padding: 15,
    marginTop: 16,
    borderWidth: 1,
    borderColor: COLORS.successLight,
  },
  benefitsTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: COLORS.successLight,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  benefitBullet: {
    fontSize: 10,
    color: COLORS.successLight,
    marginRight: 8,
    fontWeight: 'bold',
  },
  benefitText: {
    fontSize: 10,
    color: COLORS.textSecondary,
    flex: 1,
  },
  
  // Material section
  materialSection: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 14,
    padding: 20,
    marginBottom: 25,
    borderWidth: 2,
    borderColor: COLORS.amber,
  },
  materialHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  materialIcon: {
    fontSize: 18,
    marginRight: 10,
  },
  materialTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: COLORS.amber,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  materialText: {
    fontSize: 11,
    color: COLORS.luzGalpao,
    lineHeight: 1.6,
  },
  
  // Footer - Premium
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
  
  // Page break section
  pageBreakSection: {
    paddingTop: 40,
  },
});

interface StrategyPDFDocumentProps {
  strategy: ClientStrategy;
  clientName: string;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

// Expanded and detailed funnel descriptions
const FUNNEL_DETAILS = {
  millennials_mensagem: {
    title: 'Millennials Mensagem',
    tagline: 'Conversas que Convertem',
    description: 'Esta é nossa estratégia mais poderosa para gerar conversas qualificadas em tempo real. Diferente de campanhas tradicionais que apenas coletam dados, o Millennials Mensagem foca em iniciar diálogos imediatos via WhatsApp ou Direct do Instagram, permitindo que sua equipe comercial conecte-se com leads quentes no momento exato de maior interesse.',
    example: 'Por exemplo: uma indústria de equipamentos industriais pode usar esta estratégia para receber mensagens de gestores de produção interessados em aumentar eficiência. Cada conversa já vem com perguntas qualificadoras respondidas, como porte da empresa e budget disponível.',
    howItWorks: [
      'Criação de anúncios otimizados para objetivo de mensagens no Meta Ads, segmentando decisores do seu mercado B2B',
      'Configuração de mensagem padrão com perguntas qualificadoras automáticas que filtram curiosos antes de chegar à sua equipe',
      'Segmentação avançada por cargo, setor, tamanho de empresa e comportamento digital para atingir exatamente seu ICP',
      'Otimização contínua baseada em dados de conversão para maximizar ROI e reduzir custo por lead qualificado',
    ],
    benefits: [
      'Leads já engajados e prontos para conversar',
      'Qualificação automática reduz tempo da equipe comercial',
      'Conexão instantânea aumenta taxa de fechamento em até 40%',
    ],
  },
  millennials_cadastro: {
    title: 'Millennials Cadastro',
    tagline: 'Lead Gen Nativo e Inteligente',
    description: 'O Millennials Cadastro utiliza os formulários nativos do Facebook e Instagram para capturar leads diretamente na plataforma, sem necessidade de landing pages externas. Isso reduz drasticamente a fricção no processo de conversão e aumenta significativamente a taxa de preenchimento. Os dados são automaticamente sincronizados com seu CRM.',
    example: 'Imagine uma distribuidora captando CNPJs de potenciais revendedores: o formulário já puxa automaticamente o nome da empresa do perfil do lead, bastando ele confirmar e adicionar informações comerciais específicas como volume de compras e região de atuação.',
    howItWorks: [
      'Formulário Lead Gen nativo do Meta que pré-preenche dados do perfil do usuário, aumentando conversão em até 50%',
      'Campos customizados com perguntas qualificadoras B2B como CNPJ, cargo, tamanho da empresa e necessidade específica',
      'Integração direta com CRMs como RD Station, Pipedrive, HubSpot e Salesforce para nutrição automática',
      'Disparo automático de mensagem de boas-vindas via WhatsApp ou e-mail para engajamento imediato do lead',
    ],
    benefits: [
      'Taxa de conversão 3x maior que landing pages tradicionais',
      'Dados precisos e verificados pela plataforma',
      'Integração automática elimina trabalho manual',
    ],
  },
  millennials_call: {
    title: 'Millennials Call',
    tagline: 'Agenda Cheia de Reuniões Qualificadas',
    description: 'O Millennials Call é a estratégia ideal para empresas com ticket médio alto que dependem de reuniões comerciais para fechar negócios. Combinamos anúncios de alta conversão com landing pages otimizadas e integração com ferramentas de agendamento, criando um funil completo que leva prospects direto para sua agenda.',
    example: 'Uma consultoria de transformação digital pode usar esta estratégia para agendar calls de diagnóstico gratuito com CEOs e CTOs. O lead vê o anúncio, acessa a landing page com cases de sucesso, e agenda diretamente no horário disponível do consultor.',
    howItWorks: [
      'Landing page de alta conversão com prova social, cases de sucesso e proposta de valor clara para seu público B2B',
      'Formulário de qualificação pré-agendamento que coleta informações essenciais como tamanho da empresa e desafio principal',
      'Integração com Calendly, Google Calendar ou ferramenta de agendamento da sua escolha para disponibilidade em tempo real',
      'Automação de e-mails de confirmação, lembrete 24h antes e follow-up pós-reunião para maximizar comparecimento',
    ],
    benefits: [
      'Reuniões já agendadas com leads pré-qualificados',
      'Redução de 60% no no-show com automações de lembrete',
      'Ciclo de vendas mais curto com prospects mais preparados',
    ],
  },
  captacao_representantes: {
    title: 'Captação de Representantes',
    tagline: 'Construa sua Rede Comercial',
    description: 'Estratégia especializada para indústrias e distribuidoras que precisam expandir sua rede de representantes comerciais. Utilizamos segmentação avançada para encontrar profissionais de vendas experientes no seu setor, destacando os benefícios de representar sua marca e o potencial de ganhos.',
    example: 'Uma indústria têxtil pode usar esta campanha para atrair representantes comerciais com carteira ativa no varejo de moda. O anúncio destaca comissionamento competitivo, mix de produtos exclusivos e suporte de marketing, atraindo profissionais já estabelecidos no mercado.',
    howItWorks: [
      'Segmentação por perfil profissional de vendas B2B, incluindo experiência no setor, região de atuação e histórico comercial',
      'Criativos que destacam benefícios tangíveis: comissionamento, exclusividade territorial, suporte e potencial de ganhos',
      'Formulário de qualificação profissional com perguntas sobre carteira de clientes, experiência e disponibilidade',
      'Automação de follow-up com kit de apresentação da empresa e processo de onboarding de representantes',
    ],
    benefits: [
      'Atraia representantes já experientes no seu setor',
      'Expanda cobertura geográfica rapidamente',
      'Reduza tempo de ramp-up com profissionais qualificados',
    ],
  },
  captacao_sdr: {
    title: 'Captação SDR',
    tagline: 'Monte seu Time de Pré-Vendas',
    description: 'O funil de Captação SDR é direcionado para empresas que precisam recrutar Sales Development Representatives qualificados. Atingimos profissionais de pré-vendas, inside sales e atendimento comercial que buscam oportunidades de crescimento, destacando sua empresa como empregadora de escolha.',
    example: 'Uma empresa SaaS em expansão pode usar esta estratégia para contratar SDRs com experiência em prospecção ativa. O anúncio destaca salário base + comissão atrativa, plano de carreira claro e ambiente de trabalho moderno, atraindo talentos competitivos.',
    howItWorks: [
      'Anúncios direcionados a profissionais em início ou transição de carreira em vendas, segmentados por formação e interesses',
      'Página de carreiras otimizada apresentando cultura da empresa, benefícios, plano de carreira e depoimentos de colaboradores',
      'Processo de triagem automatizado com testes de fit cultural e habilidades básicas de comunicação',
      'Integração com sistema de recrutamento (Gupy, Kenoby, etc.) para gestão centralizada do funil de contratação',
    ],
    benefits: [
      'Pipeline constante de candidatos qualificados',
      'Redução de 50% no tempo de contratação',
      'Employer branding fortalecido no mercado',
    ],
  },
  disparo_email: {
    title: 'Disparo de E-mail Marketing',
    tagline: 'Nutra e Reative sua Base',
    description: 'A estratégia de Disparo de E-mail trabalha sua base existente de leads e clientes com campanhas de remarketing inteligente. Segmentamos sua lista por estágio no funil, interesse demonstrado e comportamento, entregando conteúdo personalizado que move cada lead para mais perto da conversão.',
    example: 'Uma empresa de software pode criar uma sequência de 5 e-mails para leads que baixaram um e-book mas não agendaram demo: primeiro e-mail com case de sucesso relacionado, segundo com vídeo de funcionalidades, terceiro com oferta especial, e assim por diante.',
    howItWorks: [
      'Segmentação inteligente da base por estágio do funil (topo, meio, fundo), interesse e nível de engajamento anterior',
      'Criação de sequências de e-mail automatizadas com lógica condicional baseada em comportamento do lead',
      'Personalização dinâmica de conteúdo usando campos do CRM para aumentar relevância e taxa de abertura',
      'Dashboard de tracking completo com métricas de abertura, cliques, conversões e atribuição de receita',
    ],
    benefits: [
      'Reative leads frios da sua base existente',
      'ROI alto com custo por envio muito baixo',
      'Automação libera tempo da equipe comercial',
    ],
  },
  grupo_vip: {
    title: 'Grupo VIP',
    tagline: 'Comunidade Exclusiva de Clientes',
    description: 'A estratégia Grupo VIP cria uma comunidade exclusiva de clientes e prospects qualificados via WhatsApp ou Telegram. Além de fortalecer o relacionamento, o grupo funciona como canal direto para lançamentos, ofertas especiais e conteúdo exclusivo, gerando senso de pertencimento e aumentando lifetime value.',
    example: 'Uma distribuidora de vinhos pode criar um grupo VIP para restaurantes e bares, compartilhando antecipadamente lançamentos de novos rótulos, condições especiais para membros e convites para degustações exclusivas, fortalecendo a fidelização.',
    howItWorks: [
      'Campanha de captação posicionando o grupo como benefício exclusivo com acesso a conteúdo premium e ofertas especiais',
      'Mensagem de boas-vindas personalizada apresentando as regras, benefícios e primeiros conteúdos exclusivos',
      'Calendário de conteúdo planejado com dicas, lançamentos, ofertas relâmpago e interações para manter engajamento',
      'Automação de respostas para dúvidas frequentes e moderação para manter qualidade das interações',
    ],
    benefits: [
      'Canal direto de comunicação com engajamento 5x maior que e-mail',
      'Comunidade fortalece percepção de valor da marca',
      'Vendas diretas para base engajada e qualificada',
    ],
  },
  aumento_base: {
    title: 'Aumento de Base',
    tagline: 'Escale sua Lista de Leads',
    description: 'O Aumento de Base é nossa estratégia de crescimento acelerado para empresas que precisam expandir rapidamente sua lista de leads. Otimizamos para volume com custo por lead competitivo, usando criativos de alta performance e landing pages simplificadas que removem todas as barreiras à conversão.',
    example: 'Uma startup fintech pode usar esta estratégia para captar 5.000 leads de empresários interessados em sua solução de pagamentos em 30 dias. O foco é volume com qualificação básica, alimentando o topo do funil para nutrição posterior.',
    howItWorks: [
      'Campanhas de alcance maximizado com orçamento otimizado para volume, atingindo o maior número de pessoas do seu ICP',
      'Criativos de alta performance testados e otimizados com base em dados de CTR, custo por clique e conversão',
      'Landing page simplificada com proposta de valor clara e formulário mínimo para maximizar taxa de conversão',
      'Integração imediata com ferramentas de nutrição para começar a trabalhar os leads ainda quentes',
    ],
    benefits: [
      'Crescimento rápido da base de leads',
      'Custo por lead otimizado para volume',
      'Base pronta para nutrição e qualificação posterior',
    ],
  },
  google_pmax: {
    title: 'Google Performance Max',
    tagline: 'Inteligência Artificial do Google a Seu Favor',
    description: 'O Performance Max é a campanha mais avançada do Google, utilizando machine learning para otimizar automaticamente sua presença em todos os canais: Pesquisa, Display, YouTube, Gmail, Maps e Discover. A IA do Google encontra os melhores momentos e formatos para impactar seu público-alvo.',
    example: 'Uma empresa de logística pode usar PMax para aparecer quando um gerente de operações pesquisa "transportadora para e-commerce" no Google, vê um banner ao ler notícias do setor, assiste um vídeo no YouTube sobre supply chain, e recebe um e-mail promocional no Gmail.',
    howItWorks: [
      'Presença automatizada em todos os canais Google: Search, Display, YouTube, Gmail, Maps e Discover Network',
      'Otimização contínua por IA do Google que aprende quais combinações de anúncio, público e momento geram mais conversões',
      'Criativos adaptativos gerados automaticamente para cada formato, garantindo melhor performance em cada canal',
      'Bidding inteligente focado em maximizar conversões ou valor de conversão dentro do orçamento definido',
    ],
    benefits: [
      'Maior alcance com gestão simplificada',
      'IA otimiza 24/7 para melhores resultados',
      'Descubra novos públicos automaticamente',
    ],
  },
  google_pesquisa: {
    title: 'Pesquisa Google',
    tagline: 'Capture Demanda Ativa',
    description: 'A campanha de Pesquisa Google é essencial para capturar leads com alta intenção de compra. Quando alguém busca ativamente por sua solução no Google, seu anúncio aparece no topo dos resultados, conectando-se com prospects no momento exato em que estão procurando o que você oferece.',
    example: 'Quando um diretor financeiro pesquisa "software ERP para indústria metalúrgica", seu anúncio aparece no topo com extensões mostrando "Demo Gratuita", "Cases de Sucesso" e "Atendimento 24h", direcionando para uma landing page específica.',
    howItWorks: [
      'Pesquisa e seleção de palavras-chave estratégicas de alta intenção comercial, incluindo termos do seu nicho e concorrentes',
      'Criação de anúncios de texto otimizados com múltiplos títulos e descrições testados para maximizar CTR',
      'Extensões de anúncio como sitelinks para páginas específicas, callouts com diferenciais e snippets estruturados',
      'Bidding automatizado por conversão que ajusta lances em tempo real para cada leilão individual',
    ],
    benefits: [
      'Leads com altíssima intenção de compra',
      'Apareça exatamente quando pesquisam sua solução',
      'ROI mensurável e otimizável em tempo real',
    ],
  },
  google_display: {
    title: 'Display Google',
    tagline: 'Remarketing Visual de Alto Impacto',
    description: 'A Rede de Display do Google permite impactar seu público com anúncios visuais em milhões de sites parceiros. É especialmente poderosa para remarketing, mantendo sua marca presente para visitantes do site que ainda não converteram, e para awareness em públicos similares aos seus melhores clientes.',
    example: 'Um visitante pesquisou sua solução de CRM mas não converteu. Nos próximos dias, ele vê banners da sua marca enquanto lê notícias no G1, confere resultados esportivos e acessa blogs do setor, lembrando-o de retornar e solicitar uma demonstração.',
    howItWorks: [
      'Criação de banners responsivos que se adaptam automaticamente a centenas de tamanhos e formatos de anúncio',
      'Configuração de remarketing para impactar visitantes do site com frequência controlada e mensagens progressivas',
      'Segmentação por interesse, comportamento de navegação e dados demográficos para atingir públicos similares',
      'Otimização de frequência e alcance para maximizar impacto sem saturar o público com excesso de impressões',
    ],
    benefits: [
      'Mantenha sua marca top of mind',
      'Recupere visitantes que não converteram',
      'Alcance massivo com custo por mil impressões baixo',
    ],
  },
  linkedin_vagas: {
    title: 'Captação de Talentos LinkedIn',
    tagline: 'Atraia os Melhores Profissionais',
    description: 'O LinkedIn é a plataforma definitiva para recrutamento de profissionais qualificados. Esta estratégia utiliza os formatos exclusivos do LinkedIn Ads para atingir candidatos ideais com base em cargo atual, experiência, formação, competências e empresa onde trabalham.',
    example: 'Uma consultoria em expansão pode usar LinkedIn Ads para recrutar gerentes de projeto com certificação PMP e experiência em grandes empresas. O anúncio aparece no feed destes profissionais destacando salário competitivo, projetos desafiadores e cultura de inovação.',
    howItWorks: [
      'Segmentação precisa por cargo, senioridade, skills, formação, empresa atual e setor de atuação',
      'Página de carreiras integrada apresentando proposta de valor como empregador, benefícios e depoimentos',
      'Formulário Lead Gen nativo do LinkedIn que captura dados profissionais verificados do perfil do candidato',
      'Campanhas segmentadas por diferentes vagas e níveis, com mensagens específicas para cada perfil',
    ],
    benefits: [
      'Acesse profissionais passivos não buscando emprego',
      'Dados verificados e perfis detalhados',
      'Employer branding na maior rede profissional',
    ],
  },
  linkedin_cadastro: {
    title: 'Lead Gen LinkedIn B2B',
    tagline: 'Decisores Corporativos Qualificados',
    description: 'O LinkedIn é a plataforma premium para geração de leads B2B, permitindo atingir exatamente os decisores que você precisa. Com segmentação por cargo, empresa, setor e tamanho, suas campanhas chegam diretamente a quem tem poder de compra para sua solução.',
    example: 'Uma empresa de consultoria tributária pode usar LinkedIn Ads para atingir CFOs e diretores financeiros de empresas com faturamento acima de R$100M. O formulário captura automaticamente nome, cargo, empresa e e-mail corporativo para follow-up.',
    howItWorks: [
      'Segmentação cirúrgica por título, senioridade, função, indústria, tamanho da empresa e geografia',
      'Formulário Lead Gen nativo que pré-preenche dados profissionais verificados, aumentando taxa de conversão',
      'Conteúdo de valor como whitepapers, webinars e estudos de caso para justificar o preenchimento do formulário',
      'Integração direta com CRM corporativo para nutrição automática e passagem para o time comercial',
    ],
    benefits: [
      'Decisores de alto nível com dados verificados',
      'Menor concorrência que Meta e Google',
      'Leads B2B de altíssima qualidade',
    ],
  },
};

const MetaFunnelCard = ({ funnelKey, funnel }: { funnelKey: string; funnel: MetaStrategy }) => {
  if (!funnel?.enabled) return null;
  
  const details = FUNNEL_DETAILS[funnelKey as keyof typeof FUNNEL_DETAILS];
  if (!details) return null;
  
  return (
    <View style={[styles.funnelCard, styles.funnelCardAccent]} wrap={false}>
      <View style={styles.funnelHeader}>
        <View style={styles.funnelTitleContainer}>
          <Text style={styles.funnelTitle}>{details.title}</Text>
          <Text style={styles.funnelTagline}>{details.tagline}</Text>
        </View>
        <View style={styles.funnelBudget}>
          <Text style={styles.funnelBudgetText}>{formatCurrency(funnel.budget || 0)}/mês</Text>
        </View>
      </View>
      
      <View style={styles.funnelDescription}>
        <Text style={styles.funnelDescTitle}>O Que É Esta Estratégia</Text>
        <Text style={styles.funnelDescText}>{details.description}</Text>
      </View>
      
      <View style={styles.exampleSection}>
        <Text style={styles.exampleTitle}>💡 Exemplo Prático</Text>
        <Text style={styles.exampleText}>{details.example}</Text>
      </View>
      
      <View style={styles.funnelDetailsGrid}>
        {funnel.scripts_url && (
          <View style={styles.funnelDetail}>
            <Text style={styles.funnelDetailLabel}>Scripts</Text>
            <Text style={styles.funnelDetailValue}>Configurado ✓</Text>
          </View>
        )}
        {funnel.default_message && (
          <View style={styles.funnelDetail}>
            <Text style={styles.funnelDetailLabel}>Mensagem Padrão</Text>
            <Text style={styles.funnelDetailValue}>Configurada ✓</Text>
          </View>
        )}
        {funnel.region && (
          <View style={styles.funnelDetail}>
            <Text style={styles.funnelDetailLabel}>Região</Text>
            <Text style={styles.funnelDetailValue}>{funnel.region}</Text>
          </View>
        )}
        {funnel.crm_name && (
          <View style={styles.funnelDetail}>
            <Text style={styles.funnelDetailLabel}>CRM</Text>
            <Text style={styles.funnelDetailValue}>{funnel.crm_name}</Text>
          </View>
        )}
        {funnel.lp_url && (
          <View style={styles.funnelDetail}>
            <Text style={styles.funnelDetailLabel}>Landing Page</Text>
            <Text style={styles.funnelDetailValue}>Configurada ✓</Text>
          </View>
        )}
      </View>
      
      <View style={styles.howItWorks}>
        <Text style={styles.howItWorksTitle}>📋 Passo a Passo de Implementação</Text>
        {details.howItWorks.map((item, index) => (
          <View key={index} style={styles.howItWorksStep}>
            <Text style={styles.howItWorksNumber}>{index + 1}</Text>
            <Text style={styles.howItWorksText}>{item}</Text>
          </View>
        ))}
      </View>
      
      <View style={styles.benefitsSection}>
        <Text style={styles.benefitsTitle}>✅ Principais Benefícios</Text>
        {details.benefits.map((benefit, index) => (
          <View key={index} style={styles.benefitItem}>
            <Text style={styles.benefitBullet}>•</Text>
            <Text style={styles.benefitText}>{benefit}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const GoogleFunnelCard = ({ funnelKey, funnel }: { funnelKey: string; funnel: GoogleStrategy }) => {
  if (!funnel?.enabled) return null;
  
  const details = FUNNEL_DETAILS[funnelKey as keyof typeof FUNNEL_DETAILS];
  if (!details) return null;
  
  return (
    <View style={[styles.funnelCard, styles.funnelCardAccent]} wrap={false}>
      <View style={styles.funnelHeader}>
        <View style={styles.funnelTitleContainer}>
          <Text style={styles.funnelTitle}>{details.title}</Text>
          <Text style={styles.funnelTagline}>{details.tagline}</Text>
        </View>
        <View style={styles.funnelBudget}>
          <Text style={styles.funnelBudgetText}>{formatCurrency(funnel.budget || 0)}/mês</Text>
        </View>
      </View>
      
      <View style={styles.funnelDescription}>
        <Text style={styles.funnelDescTitle}>O Que É Esta Estratégia</Text>
        <Text style={styles.funnelDescText}>{details.description}</Text>
      </View>
      
      <View style={styles.exampleSection}>
        <Text style={styles.exampleTitle}>💡 Exemplo Prático</Text>
        <Text style={styles.exampleText}>{details.example}</Text>
      </View>
      
      <View style={styles.funnelDetailsGrid}>
        {funnel.keywords && (
          <View style={styles.funnelDetail}>
            <Text style={styles.funnelDetailLabel}>Palavras-chave</Text>
            <Text style={styles.funnelDetailValue}>Configuradas ✓</Text>
          </View>
        )}
        {funnel.ad_titles && (
          <View style={styles.funnelDetail}>
            <Text style={styles.funnelDetailLabel}>Títulos</Text>
            <Text style={styles.funnelDetailValue}>Configurados ✓</Text>
          </View>
        )}
        {funnel.sitelinks && (
          <View style={styles.funnelDetail}>
            <Text style={styles.funnelDetailLabel}>Sitelinks</Text>
            <Text style={styles.funnelDetailValue}>Configurados ✓</Text>
          </View>
        )}
        {funnel.callouts && (
          <View style={styles.funnelDetail}>
            <Text style={styles.funnelDetailLabel}>Callouts</Text>
            <Text style={styles.funnelDetailValue}>Configurados ✓</Text>
          </View>
        )}
      </View>
      
      <View style={styles.howItWorks}>
        <Text style={styles.howItWorksTitle}>📋 Passo a Passo de Implementação</Text>
        {details.howItWorks.map((item, index) => (
          <View key={index} style={styles.howItWorksStep}>
            <Text style={styles.howItWorksNumber}>{index + 1}</Text>
            <Text style={styles.howItWorksText}>{item}</Text>
          </View>
        ))}
      </View>
      
      <View style={styles.benefitsSection}>
        <Text style={styles.benefitsTitle}>✅ Principais Benefícios</Text>
        {details.benefits.map((benefit, index) => (
          <View key={index} style={styles.benefitItem}>
            <Text style={styles.benefitBullet}>•</Text>
            <Text style={styles.benefitText}>{benefit}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const LinkedInFunnelCard = ({ funnelKey, funnel }: { funnelKey: string; funnel: LinkedInStrategy }) => {
  if (!funnel?.enabled) return null;
  
  const details = FUNNEL_DETAILS[funnelKey as keyof typeof FUNNEL_DETAILS];
  if (!details) return null;
  
  return (
    <View style={[styles.funnelCard, styles.funnelCardAccent]} wrap={false}>
      <View style={styles.funnelHeader}>
        <View style={styles.funnelTitleContainer}>
          <Text style={styles.funnelTitle}>{details.title}</Text>
          <Text style={styles.funnelTagline}>{details.tagline}</Text>
        </View>
        <View style={styles.funnelBudget}>
          <Text style={styles.funnelBudgetText}>{formatCurrency(funnel.budget || 0)}/mês</Text>
        </View>
      </View>
      
      <View style={styles.funnelDescription}>
        <Text style={styles.funnelDescTitle}>O Que É Esta Estratégia</Text>
        <Text style={styles.funnelDescText}>{details.description}</Text>
      </View>
      
      <View style={styles.exampleSection}>
        <Text style={styles.exampleTitle}>💡 Exemplo Prático</Text>
        <Text style={styles.exampleText}>{details.example}</Text>
      </View>
      
      <View style={styles.howItWorks}>
        <Text style={styles.howItWorksTitle}>📋 Passo a Passo de Implementação</Text>
        {details.howItWorks.map((item, index) => (
          <View key={index} style={styles.howItWorksStep}>
            <Text style={styles.howItWorksNumber}>{index + 1}</Text>
            <Text style={styles.howItWorksText}>{item}</Text>
          </View>
        ))}
      </View>
      
      <View style={styles.benefitsSection}>
        <Text style={styles.benefitsTitle}>✅ Principais Benefícios</Text>
        {details.benefits.map((benefit, index) => (
          <View key={index} style={styles.benefitItem}>
            <Text style={styles.benefitBullet}>•</Text>
            <Text style={styles.benefitText}>{benefit}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const countEnabledFunnels = (strategy: ClientStrategy) => {
  let count = 0;
  if ((strategy.meta_millennials_mensagem as MetaStrategy)?.enabled) count++;
  if ((strategy.meta_millennials_cadastro as MetaStrategy)?.enabled) count++;
  if ((strategy.meta_millennials_call as MetaStrategy)?.enabled) count++;
  if ((strategy.meta_captacao_representantes as MetaStrategy)?.enabled) count++;
  if ((strategy.meta_captacao_sdr as MetaStrategy)?.enabled) count++;
  if ((strategy.meta_disparo_email as MetaStrategy)?.enabled) count++;
  if ((strategy.meta_grupo_vip as MetaStrategy)?.enabled) count++;
  if ((strategy.meta_aumento_base as MetaStrategy)?.enabled) count++;
  if ((strategy.google_pmax as GoogleStrategy)?.enabled) count++;
  if ((strategy.google_pesquisa as GoogleStrategy)?.enabled) count++;
  if ((strategy.google_display as GoogleStrategy)?.enabled) count++;
  if ((strategy.linkedin_vagas as LinkedInStrategy)?.enabled) count++;
  if ((strategy.linkedin_cadastro as LinkedInStrategy)?.enabled) count++;
  return count;
};

const calculateTotalBudget = (strategy: ClientStrategy) => {
  let total = 0;
  if ((strategy.meta_millennials_mensagem as MetaStrategy)?.enabled) 
    total += (strategy.meta_millennials_mensagem as MetaStrategy).budget || 0;
  if ((strategy.meta_millennials_cadastro as MetaStrategy)?.enabled) 
    total += (strategy.meta_millennials_cadastro as MetaStrategy).budget || 0;
  if ((strategy.meta_millennials_call as MetaStrategy)?.enabled) 
    total += (strategy.meta_millennials_call as MetaStrategy).budget || 0;
  if ((strategy.meta_captacao_representantes as MetaStrategy)?.enabled) 
    total += (strategy.meta_captacao_representantes as MetaStrategy).budget || 0;
  if ((strategy.meta_captacao_sdr as MetaStrategy)?.enabled) 
    total += (strategy.meta_captacao_sdr as MetaStrategy).budget || 0;
  if ((strategy.meta_disparo_email as MetaStrategy)?.enabled) 
    total += (strategy.meta_disparo_email as MetaStrategy).budget || 0;
  if ((strategy.meta_grupo_vip as MetaStrategy)?.enabled) 
    total += (strategy.meta_grupo_vip as MetaStrategy).budget || 0;
  if ((strategy.meta_aumento_base as MetaStrategy)?.enabled) 
    total += (strategy.meta_aumento_base as MetaStrategy).budget || 0;
  if ((strategy.google_pmax as GoogleStrategy)?.enabled) 
    total += (strategy.google_pmax as GoogleStrategy).budget || 0;
  if ((strategy.google_pesquisa as GoogleStrategy)?.enabled) 
    total += (strategy.google_pesquisa as GoogleStrategy).budget || 0;
  if ((strategy.google_display as GoogleStrategy)?.enabled) 
    total += (strategy.google_display as GoogleStrategy).budget || 0;
  if ((strategy.linkedin_vagas as LinkedInStrategy)?.enabled) 
    total += (strategy.linkedin_vagas as LinkedInStrategy).budget || 0;
  if ((strategy.linkedin_cadastro as LinkedInStrategy)?.enabled) 
    total += (strategy.linkedin_cadastro as LinkedInStrategy).budget || 0;
  return total;
};

const countPlatforms = (strategy: ClientStrategy) => {
  let count = 0;
  if (strategy.meta_enabled) count++;
  if (strategy.google_enabled) count++;
  if (strategy.linkedin_enabled) count++;
  return count;
};

const calculateMetaBudget = (strategy: ClientStrategy) => {
  let total = 0;
  if ((strategy.meta_millennials_mensagem as MetaStrategy)?.enabled) 
    total += (strategy.meta_millennials_mensagem as MetaStrategy).budget || 0;
  if ((strategy.meta_millennials_cadastro as MetaStrategy)?.enabled) 
    total += (strategy.meta_millennials_cadastro as MetaStrategy).budget || 0;
  if ((strategy.meta_millennials_call as MetaStrategy)?.enabled) 
    total += (strategy.meta_millennials_call as MetaStrategy).budget || 0;
  if ((strategy.meta_captacao_representantes as MetaStrategy)?.enabled) 
    total += (strategy.meta_captacao_representantes as MetaStrategy).budget || 0;
  if ((strategy.meta_captacao_sdr as MetaStrategy)?.enabled) 
    total += (strategy.meta_captacao_sdr as MetaStrategy).budget || 0;
  if ((strategy.meta_disparo_email as MetaStrategy)?.enabled) 
    total += (strategy.meta_disparo_email as MetaStrategy).budget || 0;
  if ((strategy.meta_grupo_vip as MetaStrategy)?.enabled) 
    total += (strategy.meta_grupo_vip as MetaStrategy).budget || 0;
  if ((strategy.meta_aumento_base as MetaStrategy)?.enabled) 
    total += (strategy.meta_aumento_base as MetaStrategy).budget || 0;
  return total;
};

const calculateGoogleBudget = (strategy: ClientStrategy) => {
  let total = 0;
  if ((strategy.google_pmax as GoogleStrategy)?.enabled) 
    total += (strategy.google_pmax as GoogleStrategy).budget || 0;
  if ((strategy.google_pesquisa as GoogleStrategy)?.enabled) 
    total += (strategy.google_pesquisa as GoogleStrategy).budget || 0;
  if ((strategy.google_display as GoogleStrategy)?.enabled) 
    total += (strategy.google_display as GoogleStrategy).budget || 0;
  return total;
};

const calculateLinkedInBudget = (strategy: ClientStrategy) => {
  let total = 0;
  if ((strategy.linkedin_vagas as LinkedInStrategy)?.enabled) 
    total += (strategy.linkedin_vagas as LinkedInStrategy).budget || 0;
  if ((strategy.linkedin_cadastro as LinkedInStrategy)?.enabled) 
    total += (strategy.linkedin_cadastro as LinkedInStrategy).budget || 0;
  return total;
};

export default function StrategyPDFDocument({ strategy, clientName }: StrategyPDFDocumentProps) {
  const createdDate = new Date(strategy.created_at).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  const totalFunnels = countEnabledFunnels(strategy);
  const totalBudget = calculateTotalBudget(strategy);
  const totalPlatforms = countPlatforms(strategy);

  return (
    <Document>
      {/* Page 1 - Cover and Introduction */}
      <Page size="A4" style={styles.page}>
        {/* Hero Header */}
        <View style={styles.heroHeader}>
          <View style={styles.headerTopBar}>
            <View style={styles.logoContainer}>
              <Image 
                src="/millennials-logo-1.png" 
                style={styles.logoImage}
              />
            </View>
            <View style={styles.proBadge}>
              <Text style={styles.proBadgeText}>Estratégia PRO+</Text>
            </View>
          </View>
          <Text style={styles.heroTitle}>{clientName}</Text>
          <Text style={styles.heroSubtitle}>Documento gerado em {createdDate}</Text>
        </View>

        <View style={styles.content}>
          {/* Introduction Section */}
          <View style={styles.introSection}>
            <Text style={styles.introTitle}>🎯 Sua Estratégia Personalizada</Text>
            <Text style={styles.introText}>
              Este documento apresenta a estratégia de marketing digital desenvolvida exclusivamente para {clientName}. 
              Baseada em análise de mercado, comportamento do seu público-alvo e melhores práticas do setor B2B, 
              esta estratégia foi desenhada para maximizar resultados e ROI.
            </Text>
            <Text style={styles.introText}>
              Cada funil descrito aqui foi selecionado estrategicamente para atender aos objetivos específicos do seu negócio,
              com orçamentos otimizados e táticas comprovadas pela equipe Millennials B2B.
            </Text>
          </View>

          {/* Summary Stats */}
          <View style={styles.statsContainer}>
            <Text style={styles.statsTitle}>📊 Resumo da Estratégia</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{totalPlatforms}</Text>
                <Text style={styles.statLabel}>Plataformas{'\n'}Ativas</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{totalFunnels}</Text>
                <Text style={styles.statLabel}>Funis{'\n'}Configurados</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{formatCurrency(totalBudget)}</Text>
                <Text style={styles.statLabel}>Orçamento{'\n'}Total Mensal</Text>
              </View>
            </View>
          </View>

          {/* Investment Section */}
          <View style={styles.investmentSection}>
            <View style={styles.investmentHeader}>
              <Text style={styles.investmentHeaderText}>💰 Investimento Planejado</Text>
            </View>
            <View style={styles.investmentContent}>
              <View style={styles.investmentGrid}>
                <View style={styles.investmentCard}>
                  <Text style={styles.investmentLabel}>Investimento Mínimo</Text>
                  <Text style={styles.investmentValue}>
                    {formatCurrency(strategy.minimum_investment || 0)}
                  </Text>
                </View>
                <View style={[styles.investmentCard, styles.investmentCardHighlight]}>
                  <Text style={styles.investmentLabel}>Investimento Recomendado</Text>
                  <Text style={[styles.investmentValue, styles.investmentValueRecommended]}>
                    {formatCurrency(strategy.recommended_investment || 0)}
                  </Text>
                </View>
              </View>

              {strategy.ad_location && (
                <View style={styles.locationRow}>
                  <Text style={styles.locationIcon}>📍</Text>
                  <View>
                    <Text style={styles.locationLabel}>Localização dos Anúncios</Text>
                    <Text style={styles.locationValue}>{strategy.ad_location}</Text>
                  </View>
                </View>
              )}
            </View>
          </View>

          {/* Material do Cliente */}
          {strategy.use_client_material && strategy.client_material_details && (
            <View style={styles.materialSection}>
              <View style={styles.materialHeader}>
                <Text style={styles.materialIcon}>🎬</Text>
                <Text style={styles.materialTitle}>Material do Cliente</Text>
              </View>
              <Text style={styles.materialText}>{strategy.client_material_details}</Text>
            </View>
          )}
        </View>
      </Page>

      {/* Meta Ads Pages */}
      {strategy.meta_enabled && (
        <Page size="A4" style={styles.page}>
          <View style={styles.content}>
            <View style={styles.platformSection}>
              <View style={[styles.platformHeader, styles.platformHeaderMeta]}>
                <View style={styles.platformTitleContainer}>
                  <Text style={styles.platformIcon}>📘</Text>
                  <View>
                    <Text style={styles.platformTitle}>Meta Ads</Text>
                    <Text style={styles.platformSubtitle}>Facebook & Instagram</Text>
                  </View>
                </View>
                <View style={styles.platformBadge}>
                  <Text style={styles.platformBadgeText}>{formatCurrency(calculateMetaBudget(strategy))}/mês</Text>
                </View>
              </View>
              <View style={styles.platformContent}>
                <Text style={styles.platformIntro}>
                  O Meta Ads é a plataforma mais poderosa para geração de leads B2B, combinando o alcance do Facebook 
                  com o engajamento visual do Instagram. Com mais de 3 bilhões de usuários ativos e dados de segmentação 
                  incomparáveis, permite atingir decisores com precisão cirúrgica.
                </Text>
                <MetaFunnelCard funnelKey="millennials_mensagem" funnel={strategy.meta_millennials_mensagem as MetaStrategy} />
                <MetaFunnelCard funnelKey="millennials_cadastro" funnel={strategy.meta_millennials_cadastro as MetaStrategy} />
                <MetaFunnelCard funnelKey="millennials_call" funnel={strategy.meta_millennials_call as MetaStrategy} />
                <MetaFunnelCard funnelKey="captacao_representantes" funnel={strategy.meta_captacao_representantes as MetaStrategy} />
                <MetaFunnelCard funnelKey="captacao_sdr" funnel={strategy.meta_captacao_sdr as MetaStrategy} />
                <MetaFunnelCard funnelKey="disparo_email" funnel={strategy.meta_disparo_email as MetaStrategy} />
                <MetaFunnelCard funnelKey="grupo_vip" funnel={strategy.meta_grupo_vip as MetaStrategy} />
                <MetaFunnelCard funnelKey="aumento_base" funnel={strategy.meta_aumento_base as MetaStrategy} />
              </View>
            </View>
          </View>
        </Page>
      )}

      {/* Google Ads Pages */}
      {strategy.google_enabled && (
        <Page size="A4" style={styles.page}>
          <View style={styles.content}>
            <View style={styles.platformSection}>
              <View style={[styles.platformHeader, styles.platformHeaderGoogle]}>
                <View style={styles.platformTitleContainer}>
                  <Text style={styles.platformIcon}>🔍</Text>
                  <View>
                    <Text style={styles.platformTitle}>Google Ads</Text>
                    <Text style={styles.platformSubtitle}>Search, Display & Performance Max</Text>
                  </View>
                </View>
                <View style={styles.platformBadge}>
                  <Text style={styles.platformBadgeText}>{formatCurrency(calculateGoogleBudget(strategy))}/mês</Text>
                </View>
              </View>
              <View style={styles.platformContent}>
                <Text style={styles.platformIntro}>
                  O Google Ads é essencial para capturar demanda ativa - pessoas que estão ativamente buscando 
                  soluções como a sua. Com presença em Search, Display, YouTube, Gmail e Maps, você alcança 
                  seu público em todos os momentos da jornada de compra.
                </Text>
                <GoogleFunnelCard funnelKey="google_pmax" funnel={strategy.google_pmax as GoogleStrategy} />
                <GoogleFunnelCard funnelKey="google_pesquisa" funnel={strategy.google_pesquisa as GoogleStrategy} />
                <GoogleFunnelCard funnelKey="google_display" funnel={strategy.google_display as GoogleStrategy} />
              </View>
            </View>
          </View>
        </Page>
      )}

      {/* LinkedIn Ads Pages */}
      {strategy.linkedin_enabled && (
        <Page size="A4" style={styles.page}>
          <View style={styles.content}>
            <View style={styles.platformSection}>
              <View style={[styles.platformHeader, styles.platformHeaderLinkedIn]}>
                <View style={styles.platformTitleContainer}>
                  <Text style={styles.platformIcon}>💼</Text>
                  <View>
                    <Text style={styles.platformTitle}>LinkedIn Ads</Text>
                    <Text style={styles.platformSubtitle}>A Rede Profissional</Text>
                  </View>
                </View>
                <View style={styles.platformBadge}>
                  <Text style={styles.platformBadgeText}>{formatCurrency(calculateLinkedInBudget(strategy))}/mês</Text>
                </View>
              </View>
              <View style={styles.platformContent}>
                <Text style={styles.platformIntro}>
                  O LinkedIn é a plataforma premium para B2B, onde 4 em cada 5 membros influenciam decisões 
                  de negócios. Com segmentação por cargo, empresa, setor e senioridade, você atinge exatamente 
                  os decisores que precisa alcançar.
                </Text>
                <LinkedInFunnelCard funnelKey="linkedin_vagas" funnel={strategy.linkedin_vagas as LinkedInStrategy} />
                <LinkedInFunnelCard funnelKey="linkedin_cadastro" funnel={strategy.linkedin_cadastro as LinkedInStrategy} />
              </View>
            </View>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <View style={styles.footerLeft}>
              <Text style={styles.footerText}>Documento confidencial • Válido por 30 dias</Text>
              <Text style={styles.footerText}>© {new Date().getFullYear()} Todos os direitos reservados</Text>
            </View>
            <View style={styles.footerBrand}>
              <Text style={styles.footerBrandText}>MILLENNIALS B2B</Text>
              <Text style={styles.footerTagline}>Marketing que Vende</Text>
            </View>
          </View>
        </Page>
      )}
    </Document>
  );
}
