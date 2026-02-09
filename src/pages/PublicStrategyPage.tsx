import { useParams } from 'react-router-dom';
import { usePublicStrategy } from '@/hooks/useClientStrategies';
import { BackgroundPaths } from '@/components/ui/background-paths';
import { GlowingEffect } from '@/components/ui/glowing-effect';
import { motion } from 'framer-motion';
import StrategyMarcosSection from '@/components/strategy/StrategyMarcosSection';
import StrategyProximosPassosSection from '@/components/strategy/StrategyProximosPassosSection';
import StrategyExpectativaSection from '@/components/strategy/StrategyExpectativaSection';
import { 
  Loader2, 
  Target, 
  TrendingUp, 
  Users, 
  MessageSquare, 
  Phone, 
  Mail, 
  UserPlus,
  Megaphone,
  Sparkles,
  Search,
  LayoutGrid,
  MonitorPlay,
  Briefcase,
  FileText,
  ExternalLink,
  MapPin,
  DollarSign,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Globe,
  Settings,
  MessageCircle,
  Calendar,
  Database,
  Bot,
  GraduationCap,
  Image,
  Video,
  Link2
} from 'lucide-react';

// Millennials B2B Colors
const COLORS = {
  chaoFabrica: '#3A2E2C',
  farolCarga: '#FFD400',
  luzGalpao: '#F5F5DC',
  acoIndustrial: '#6B7A6F',
};

// Funnel configuration with icons and detailed explanations
const FUNNEL_CONFIG = {
  // ================================
  // META FUNNELS
  // ================================
  millennials_mensagem: {
    title: 'Millennials Mensagem',
    tagline: 'Volume + Qualificação',
    icon: MessageSquare,
    description: 'Estratégia de mensagem com filtros fortes evitando desqualificação. O objetivo é gerar um volume alto de leads qualificados e extremamente filtrados.',
    detailedDescription: `Esta é a nossa estratégia mais robusta de captação via mensagens diretas. A campanha envia leads diretamente para o WhatsApp ou Direct do cliente, com uma mensagem padrão pré-configurada.

O grande diferencial é a automação de qualificação: por dentro da própria campanha, configuramos uma mensagem automática que solicita CNPJ ou outro filtro forte, eliminando curiosos e pessoas físicas logo na primeira interação.

Todos os "Advantage" da campanha serão desativados para manter controle total sobre a segmentação e otimização.`,
    howItWorks: [
      'Campanha enviando ao WhatsApp/Direct com mensagem padrão configurada',
      'Automação interna da campanha para filtro forte (ex: pedir CNPJ)',
      'Se anúncio regional: citação obrigatória da região no criativo (ex: "Se você mora em Floripa e região")',
      'Desativação de todos os Advantage da campanha para máximo controle',
    ],
    benefits: [
      'Volume alto de leads já pré-qualificados',
      'Filtro automático elimina curiosos antes do contato humano',
      'Redução drástica de tempo gasto com leads desqualificados',
      'Controle total sobre segmentação sem interferência do algoritmo',
    ],
    metrics: ['CPL Médio: R$ 15-40', 'Taxa de Resposta: 60-80%', 'Qualificação Automática: 70%+'],
    configItems: [
      { key: 'default_message', label: 'Mensagem Padrão', icon: MessageCircle },
      { key: 'auto_filter_message', label: 'Mensagem de Filtro Automático', icon: Bot },
      { key: 'is_national', label: 'Anúncio Nível Brasil', icon: Globe, isBoolean: true },
      { key: 'region', label: 'Região do Anúncio', icon: MapPin },
      { key: 'scripts_url', label: 'Roteiros', icon: FileText, isLink: true },
    ],
    importantNotes: [
      'Treinamentos comerciais para criação de scripts são FUNDAMENTAIS nessa estratégia',
      'Se não for nível Brasil, o criativo DEVE citar a região para evitar leads de fora',
    ],
  },
  millennials_cadastro: {
    title: 'Millennials Cadastro',
    tagline: 'Leads Ultra-Filtrados',
    icon: FileText,
    description: 'Captação através de formulário de cadastro com filtros inteligentes. 4 criativos de anúncios onde o cliente clica em "Obter Cotação" e preenche um cadastro qualificador.',
    detailedDescription: `Esta estratégia utiliza 4 criativos de anúncios diferentes. Quando o lead clica em "Obter Cotação", ele é direcionado para um formulário de cadastro que funciona como filtro de curiosos.

Logo no início do formulário é solicitado o CNPJ, garantindo que apenas empresas avancem no processo.

Para evitar leads de outras regiões, incluímos a pergunta: "Você mora na Região X?" - se a resposta for "não", o formulário fecha automaticamente.

Todos os Advantage serão desativados para controle total.`,
    howItWorks: [
      '4 criativos de anúncios direcionando para formulário de cadastro',
      'CNPJ obrigatório logo no início do formulário',
      'Pergunta de região para filtrar leads de fora (fecha forms se responder "não")',
      'Leads caem no CRM do cliente ou criamos um CRM gratuito',
    ],
    benefits: [
      'Filtro de CNPJ elimina pessoas físicas automaticamente',
      'Filtro de região evita leads de outras localidades',
      'Integração automática com CRM existente ou criação gratuita',
      'Automação de disparo inicial para novos leads',
    ],
    metrics: ['CPL Médio: R$ 10-30', 'Taxa de Qualificação: 80%+', 'Leads com CNPJ: 100%'],
    configItems: [
      { key: 'has_crm', label: 'Cliente possui CRM', icon: Database, isBoolean: true },
      { key: 'crm_name', label: 'Nome do CRM', icon: Database },
      { key: 'initial_dispatch_message', label: 'Mensagem de Disparo Inicial', icon: Bot },
      { key: 'scripts_url', label: 'Roteiros', icon: FileText, isLink: true },
    ],
    importantNotes: [
      'Todos os Advantage serão desativados',
      'Automação de disparo automático para todo novo lead',
      'Se cliente não tiver CRM, criamos um gratuito',
    ],
  },
  millennials_call: {
    title: 'Millennials Call',
    tagline: 'Agendamentos Diretos',
    icon: Phone,
    description: 'Campanha onde o cliente se cadastra com objetivo de AGENDAR UMA REUNIÃO, não apenas receber contato. Landing Page de alta conversão integrada com calendário automático.',
    detailedDescription: `Diferente das outras estratégias, aqui o objetivo não é apenas captar o lead, mas já AGENDAR a reunião diretamente.

Criamos uma Landing Page personalizada onde acontece o cadastro. O cliente é responsável por criar uma conta na ferramenta de agendamento (Calendly, etc.) e conectar a própria agenda.

As reuniões marcadas vão direto para o calendário do cliente, eliminando fricções e trabalho manual.

O treinamento comercial é CRUCIAL para garantir alta taxa de comparecimento e conversão.`,
    howItWorks: [
      'Landing Page personalizada para cadastro e agendamento',
      'Cliente cria conta de agendamento (Calendly, etc.) e conecta agenda',
      'Reuniões marcadas vão direto para agenda do cliente',
      'Lembretes automáticos aumentam taxa de comparecimento',
    ],
    benefits: [
      'Lead já agenda a reunião - zero trabalho de SDR',
      'Alta qualificação: quem agenda TEM interesse real',
      'Redução de 80% no tempo de agendamento manual',
      'Maior taxa de show-up com lembretes automáticos',
    ],
    metrics: ['Custo por Agendamento: R$ 50-150', 'Taxa de Show-up: 70-85%', 'Conversão em Venda: 20-40%'],
    configItems: [
      { key: 'lp_url', label: 'Link da Landing Page', icon: Link2, isLink: true },
      { key: 'scripts_url', label: 'Roteiros', icon: FileText, isLink: true },
    ],
    importantNotes: [
      'TREINAMENTO COMERCIAL é fundamental: preparação para calls, scripts de abertura, tratamento de objeções, técnicas de fechamento',
      'Cliente deve criar conta em ferramenta de agendamento e conectar calendário',
      'Alta taxa de comparecimento depende de scripts bem estruturados',
    ],
  },
  captacao_representantes: {
    title: 'Captação de Representantes',
    tagline: 'Expansão Comercial',
    icon: Users,
    description: 'Campanha de cadastro para captar representantes comerciais qualificados. Enviamos para CRM de vagas que iremos criar, com filtros regionais rigorosos.',
    detailedDescription: `Estratégia especializada em atrair representantes comerciais para expandir sua força de vendas.

Criamos um CRM específico para vagas onde os candidatos se cadastram. No anúncio, já citamos a região para evitar representantes de fora. No cadastro, perguntamos novamente a região como duplo filtro.

Coletamos todas as informações relevantes sobre o revendedor e rodamos a campanha por tempo indeterminado até atingir taxa aceitável de representantes contratados.`,
    howItWorks: [
      'Campanha de cadastro enviando para CRM de vagas criado por nós',
      'Perguntamos principais informações sobre o revendedor',
      'Região citada no anúncio + pergunta no cadastro (duplo filtro)',
      'Campanha roda até atingir volume de representantes desejado',
    ],
    benefits: [
      'CRM dedicado para gestão de candidatos',
      'Duplo filtro regional evita candidatos de outras áreas',
      'Campanha contínua até meta de contratação',
      'Expansão comercial escalável e previsível',
    ],
    metrics: ['Custo por Candidato: R$ 20-60', 'Taxa de Qualificação: 30-50%', 'Contratação: 10-20%'],
    configItems: [
      { key: 'scripts_url', label: 'Roteiros', icon: FileText, isLink: true },
    ],
    importantNotes: [
      'CRM de vagas será criado pela equipe Millennials',
      'Campanha roda por tempo indeterminado até taxa aceitável',
      'Filtro de região no anúncio E no formulário',
    ],
  },
  captacao_sdr: {
    title: 'Captação de SDRs + Treinamento',
    tagline: 'Time de Prospecção',
    icon: UserPlus,
    description: 'Captação de profissionais de pré-vendas + treinamento comercial completo após contratação. CRM dedicado e filtros regionais rigorosos.',
    detailedDescription: `Estratégia completa que vai além da captação: inclui treinamento comercial após a contratação.

Criamos um CRM específico para vagas de SDR. No anúncio e no cadastro, aplicamos filtros regionais para garantir candidatos da área de atuação.

O grande diferencial é que, ao contratar, já iniciamos o programa de treinamento comercial, garantindo que os SDRs estejam preparados para gerar resultados desde o primeiro dia.`,
    howItWorks: [
      'Campanha de cadastro enviando para CRM de vagas de SDR',
      'Coleta de informações principais sobre o candidato',
      'Duplo filtro regional (anúncio + cadastro)',
      'Ao contratar → Iniciamos treinamento comercial',
    ],
    benefits: [
      'Candidatos já filtrados por região',
      'Treinamento incluído reduz tempo de ramp-up',
      'SDRs prontos para produzir desde o início',
      'Processo seletivo + capacitação integrados',
    ],
    metrics: ['Custo por Candidato: R$ 25-70', 'Candidatos Qualificados: 25-40%', 'Tempo de Ramp-up: -50%'],
    configItems: [
      { key: 'scripts_url', label: 'Roteiros', icon: FileText, isLink: true },
    ],
    importantNotes: [
      'CRM de vagas criado pela equipe Millennials',
      'Treinamento comercial INCLUÍDO após contratação',
      'Campanha contínua até volume desejado de SDRs',
    ],
  },
  disparo_email: {
    title: 'Disparo de Email Base Antiga',
    tagline: 'Reativação de Clientes',
    icon: Mail,
    description: 'Estratégia de reativação: pegamos a base antiga de clientes inativos e configuramos disparos automáticos com objetivo de reativá-los.',
    detailedDescription: `Esta estratégia é focada em trabalhar uma base que você já possui mas não está ativa.

Pegamos sua base antiga de clientes/leads e configuramos sequências de disparo automático com objetivo de reativação. O custo por cliente reativado é significativamente menor do que adquirir um novo.

É uma estratégia de alto ROI pois trabalha com pessoas que já conhecem sua empresa.`,
    howItWorks: [
      'Análise e segmentação da base antiga de clientes',
      'Criação de sequências de email personalizadas',
      'Configuração de disparos automáticos',
      'Acompanhamento de métricas de reativação',
    ],
    benefits: [
      'Custo muito menor que aquisição de novos leads',
      'Público já conhece sua empresa',
      'Alta taxa de resposta por familiaridade',
      'Potencial de receita "dormindo" na base',
    ],
    metrics: ['CPL: R$ 5-15', 'Taxa de Abertura: 30-45%', 'Reativação: 5-15%'],
    configItems: [
      { key: 'scripts_url', label: 'Roteiros de Disparo', icon: FileText, isLink: true },
    ],
    importantNotes: [
      'Base de clientes deve ser fornecida pelo cliente',
      'Roteiros de disparo são essenciais para resultado',
      'Estratégia complementar às campanhas de aquisição',
    ],
  },
  grupo_vip: {
    title: 'Millennials Grupo VIP',
    tagline: 'Comunidade Exclusiva',
    icon: Sparkles,
    description: 'Campanha de mensagem onde o lead recebe vídeo/estático sobre o grupo VIP. Ao enviar mensagem, recebe automaticamente o link do grupo. Relacionamento premium.',
    detailedDescription: `Estratégia de construção de comunidade exclusiva no WhatsApp.

Criamos uma campanha de mensagem onde o criativo (vídeo ou estático) apresenta o Grupo VIP e seus benefícios. Quando o lead envia uma mensagem, recebe automaticamente um disparo com o link do grupo.

Dentro do grupo, configuramos mensagens de boas-vindas e mantemos o engajamento constante para conversão futura.`,
    howItWorks: [
      'Campanha com criativo apresentando o Grupo VIP',
      'Lead envia mensagem → Recebe link do grupo automaticamente',
      'Mensagem de boas-vindas configurada no grupo',
      'Estratégia de engajamento e conversão no grupo',
    ],
    benefits: [
      'Criação de comunidade engajada',
      'Contato direto sem algoritmo intermediando',
      'Prova social através de outros membros',
      'Ofertas exclusivas para membros VIP',
    ],
    metrics: ['Custo por Membro: R$ 5-20', 'Engajamento: 40-60%', 'Conversão: 10-25%'],
    configItems: [
      { key: 'welcome_message', label: 'Mensagem de Boas-Vindas', icon: MessageCircle },
      { key: 'default_message', label: 'Mensagem Padrão', icon: MessageCircle },
      { key: 'auto_response', label: 'Resposta Automática', icon: Bot },
      { key: 'scripts_url', label: 'Roteiros', icon: FileText, isLink: true },
    ],
    importantNotes: [
      'Configuração completa de mensagens automáticas',
      'Grupo VIP requer estratégia de conteúdo contínuo',
      'Alta retenção e conversão de membros engajados',
    ],
  },
  aumento_base: {
    title: 'Millennials Aumento de Base',
    tagline: 'Crescimento Orgânico',
    icon: TrendingUp,
    description: 'Pegamos conteúdos já existentes do cliente e rodamos em tráfego para o perfil. Inclui consultoria de produção de conteúdo.',
    detailedDescription: `Estratégia focada em aumentar seguidores qualificados no Instagram/Facebook.

Utilizamos conteúdos que o cliente já possui e rodamos campanhas de tráfego direcionando para o perfil. O objetivo é construir uma base de seguidores engajada que será nutrida organicamente.

Incluímos consultoria de produção de conteúdo para otimizar a retenção dos novos seguidores.`,
    howItWorks: [
      'Seleção dos melhores conteúdos existentes do cliente',
      'Campanhas de tráfego para o perfil do Instagram/Facebook',
      'Consultoria de produção de conteúdo incluída',
      'Estratégia de retenção de novos seguidores',
    ],
    benefits: [
      'Base própria de audiência qualificada',
      'Redução de custo de mídia a longo prazo',
      'Prova social com crescimento de seguidores',
      'Funil orgânico complementar ao pago',
    ],
    metrics: ['Custo por Seguidor: R$ 0.50-2', 'Taxa de Engajamento: 3-8%', 'Conversão Orgânica: 2-5%'],
    configItems: [
      { key: 'scripts_url', label: 'Roteiros', icon: FileText, isLink: true },
    ],
    importantNotes: [
      'Consultoria de produção de conteúdo INCLUÍDA',
      'Utilização de conteúdos já existentes do cliente',
      'Estratégia de longo prazo para construção de audiência',
    ],
  },
  
  // ================================
  // GOOGLE FUNNELS
  // ================================
  pmax: {
    title: 'Millennials PMAX',
    tagline: 'Máxima Performance',
    icon: Zap,
    description: 'O Performance Max é o tipo de campanha mais avançado do Google Ads. Utiliza IA para otimizar automaticamente em Search, Display, YouTube, Gmail e Maps simultaneamente.',
    detailedDescription: `A PMAX (Performance Max) é a campanha mais poderosa do Google Ads, utilizando machine learning para distribuir seus anúncios automaticamente em TODOS os canais Google:

• Rede de Pesquisa (Google Search)
• Rede de Display (milhões de sites parceiros)
• YouTube (vídeos e shorts)
• Gmail (anúncios na caixa de entrada)
• Google Maps (anúncios de localização)
• Discovery (feed do Google)

O algoritmo aprende continuamente qual combinação de canais, horários e públicos geram mais conversões, otimizando em tempo real.`,
    howItWorks: [
      'Configuração de metas de conversão específicas para seu negócio',
      'Upload de assets criativos (textos, imagens, vídeos, logos)',
      'Algoritmo do Google otimiza automaticamente para melhor ROAS',
      'Monitoramento e ajuste contínuo de sinais de audiência',
    ],
    benefits: [
      'Cobertura em TODOS os canais Google com uma campanha',
      'IA otimiza automaticamente para conversões',
      'Descoberta de novos públicos de alta intenção',
      'Menor custo por conversão que campanhas isoladas',
    ],
    metrics: ['CPA: -20% vs campanhas separadas', 'Alcance: +50%', 'Conversões: +15-30%'],
    configItems: [
      { key: 'keywords', label: 'Palavras-chave', icon: Search },
      { key: 'ad_titles', label: 'Títulos dos Anúncios', icon: FileText },
      { key: 'ad_descriptions', label: 'Descrições dos Anúncios', icon: FileText },
      { key: 'sitelinks', label: 'Sitelinks', icon: Link2 },
      { key: 'callouts', label: 'Frases de Destaque', icon: Megaphone },
      { key: 'scripts_url', label: 'Roteiros', icon: FileText, isLink: true },
    ],
    importantNotes: [
      'Requer período de aprendizado inicial (2-4 semanas)',
      'Necessário fornecer assets criativos variados',
      'IA decide onde e quando exibir os anúncios',
    ],
  },
  pesquisa: {
    title: 'Millennials Rede de Pesquisa',
    tagline: 'Intenção de Compra',
    icon: Search,
    description: 'Campanhas de Search Ads que aparecem quando seu público-alvo busca ativamente por soluções. A forma mais direta de captar demanda existente com alta intenção de compra.',
    detailedDescription: `A Rede de Pesquisa é o formato mais tradicional e poderoso do Google Ads. Seus anúncios aparecem quando alguém pesquisa exatamente pelo que você oferece.

Este é o canal de MAIOR INTENÇÃO: a pessoa está ATIVAMENTE buscando uma solução. Por isso, a taxa de conversão costuma ser a mais alta entre todos os canais.

Criamos grupos de anúncios segmentados por intenção, com palavras-chave específicas e landing pages otimizadas para conversão.`,
    howItWorks: [
      'Mapeamento completo de palavras-chave do seu mercado',
      'Criação de grupos de anúncios segmentados por intenção',
      'Desenvolvimento de anúncios com extensões (sitelinks, callouts)',
      'Otimização contínua de lances e qualidade',
    ],
    benefits: [
      'Leads com ALTÍSSIMA intenção de compra',
      'Mensuração precisa de ROI por palavra-chave',
      'Controle total sobre quando e onde aparecer',
      'Resultados mais previsíveis e escaláveis',
    ],
    metrics: ['CPC Médio B2B: R$ 5-25', 'Taxa de Conversão: 3-10%', 'Qualidade do Lead: Muito Alta'],
    configItems: [
      { key: 'keywords', label: 'Palavras-chave', icon: Search },
      { key: 'ad_titles', label: 'Títulos dos Anúncios', icon: FileText },
      { key: 'ad_descriptions', label: 'Descrições dos Anúncios', icon: FileText },
      { key: 'sitelinks', label: 'Sitelinks', icon: Link2 },
      { key: 'callouts', label: 'Frases de Destaque', icon: Megaphone },
      { key: 'scripts_url', label: 'Roteiros', icon: FileText, isLink: true },
    ],
    importantNotes: [
      'Palavras-chave negativas são essenciais para evitar cliques irrelevantes',
      'Landing pages específicas aumentam conversão significativamente',
      'Extensões de anúncio aumentam CTR em até 15%',
    ],
  },
  display: {
    title: 'Millennials Display',
    tagline: 'Visibilidade Massiva',
    icon: LayoutGrid,
    description: 'Campanhas de banners visuais em milhões de sites parceiros do Google. Perfeito para remarketing, awareness e manter sua marca presente.',
    detailedDescription: `A Rede de Display do Google alcança mais de 90% dos usuários da internet através de banners em milhões de sites, apps e no YouTube.

É a estratégia ideal para:
• Remarketing: lembrar quem visitou seu site
• Awareness: apresentar sua marca para novos públicos
• Complemento: reforçar mensagens de Search e Meta

Os banners podem ser estáticos ou animados, em diversos formatos e tamanhos.`,
    howItWorks: [
      'Desenvolvimento de banners em múltiplos formatos e tamanhos',
      'Configuração de segmentações por interesse, demografia e contexto',
      'Implementação de remarketing para visitantes do site',
      'Otimização contínua de frequência e posicionamentos',
    ],
    benefits: [
      'Alcance massivo a baixo custo por impressão',
      'Remarketing mantém sua marca presente',
      'Formatos visuais aumentam recall de marca',
      'Complementa estratégias de Search e Meta',
    ],
    metrics: ['CPM: R$ 5-20', 'CTR: 0.3-1%', 'Assist Conversions: +20-40%'],
    configItems: [
      { key: 'keywords', label: 'Palavras-chave', icon: Search },
      { key: 'ad_titles', label: 'Títulos dos Anúncios', icon: FileText },
      { key: 'ad_descriptions', label: 'Descrições dos Anúncios', icon: FileText },
      { key: 'sitelinks', label: 'Sitelinks', icon: Link2 },
      { key: 'callouts', label: 'Frases de Destaque', icon: Megaphone },
      { key: 'scripts_url', label: 'Roteiros dos Displays', icon: Image, isLink: true },
    ],
    importantNotes: [
      'Roteiros de displays devem ser anexados',
      'Remarketing é fundamental para performance',
      'Banners em múltiplos formatos aumentam alcance',
    ],
  },
  
  // ================================
  // LINKEDIN FUNNELS
  // ================================
  linkedin_vagas: {
    title: 'Millennials Vagas LinkedIn',
    tagline: 'Talentos Premium',
    icon: Briefcase,
    description: 'Campanhas de recrutamento no LinkedIn para atrair profissionais de alto nível. Segmentação por cargo, empresa, setor e experiência.',
    detailedDescription: `O LinkedIn é a plataforma #1 para recrutamento B2B e profissional. As campanhas de vagas permitem alcançar profissionais qualificados que não estão em job boards tradicionais.

Investimento mínimo recomendado: R$ 50/dia (exigência do LinkedIn)

Tipos de criativos utilizados:
• Sponsored Content (posts patrocinados)
• Message Ads (mensagens diretas)
• Dynamic Ads (personalizados com nome/foto)

A segmentação avançada do LinkedIn permite filtrar por cargo, empresa, setor, senioridade, skills e muito mais.`,
    howItWorks: [
      'Definição do perfil ideal com segmentação avançada',
      'Criação de anúncios de employer branding atrativos',
      'Configuração de formulários de candidatura simplificados',
      'Integração com ATS para processamento automático',
    ],
    benefits: [
      'Acesso a profissionais passivos não disponíveis em job boards',
      'Segmentação por cargo, empresa e senioridade',
      'Maior qualidade de candidatos vs anúncios tradicionais',
      'Dados enriquecidos do perfil LinkedIn',
    ],
    metrics: ['Custo por Candidatura: R$ 50-150', 'Qualidade: Alta', 'Tempo de Contratação: -30%'],
    configItems: [
      { key: 'scripts_url', label: 'Roteiros', icon: FileText, isLink: true },
    ],
    importantNotes: [
      'Investimento mínimo: R$ 50/dia no LinkedIn',
      'Criativos: Sponsored Content, Message Ads, Dynamic Ads',
      'Segmentação avançada por cargo, empresa, setor, senioridade',
    ],
  },
  linkedin_cadastro: {
    title: 'Millennials Cadastro LinkedIn',
    tagline: 'Leads Corporativos',
    icon: Target,
    description: 'Lead Gen Forms do LinkedIn para captação de decisores B2B. Formulários pré-preenchidos com dados do perfil garantem leads altamente qualificados.',
    detailedDescription: `Os Lead Gen Forms do LinkedIn são formulários nativos pré-preenchidos automaticamente com dados do perfil do usuário, garantindo informações precisas de decisores B2B.

Investimento mínimo recomendado: R$ 50/dia (exigência do LinkedIn)

Criativos utilizados:
• Sponsored Content com CTA para formulário
• Ofertas de valor (ebooks, webinars, demos)
• Cases de sucesso e provas sociais

A segmentação permite alcançar exatamente os cargos, empresas e setores que interessam para seu negócio.`,
    howItWorks: [
      'Segmentação por cargo, setor, tamanho de empresa e senioridade',
      'Criação de ofertas de valor específicas para executivos B2B',
      'Formulários com campos personalizados + dados LinkedIn pré-preenchidos',
      'Integração automática com CRM ou automação de marketing',
    ],
    benefits: [
      'Dados precisos direto do perfil LinkedIn',
      'Decisores e influenciadores de compra',
      'Maior qualificação vs outras plataformas',
      'Segmentação B2B mais precisa do mercado',
    ],
    metrics: ['CPL: R$ 80-200', 'Qualidade: Premium', 'Conversão em Reunião: 25-40%'],
    configItems: [
      { key: 'scripts_url', label: 'Roteiros', icon: FileText, isLink: true },
    ],
    importantNotes: [
      'Investimento mínimo: R$ 50/dia no LinkedIn',
      'Formulários pré-preenchidos com dados do perfil',
      'Ideal para ofertas de alto valor (demos, consultorias)',
    ],
  },
};

type FunnelKey = keyof typeof FUNNEL_CONFIG;

interface FunnelData {
  enabled: boolean;
  budget: number;
  scripts_url?: string;
  default_message?: string;
  auto_filter_message?: string;
  is_national?: boolean;
  region?: string;
  has_crm?: boolean;
  crm_name?: string;
  initial_dispatch_message?: string;
  lp_url?: string;
  welcome_message?: string;
  auto_response?: string;
  keywords?: string;
  ad_titles?: string;
  ad_descriptions?: string;
  sitelinks?: string;
  callouts?: string;
  [key: string]: any;
}

export default function PublicStrategyPage() {
  const { token } = useParams<{ token: string }>();
  const { data, isLoading, error } = usePublicStrategy(token || '');

  if (isLoading) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: COLORS.chaoFabrica }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <Loader2 
            className="w-16 h-16 animate-spin mx-auto mb-4" 
            style={{ color: COLORS.farolCarga }} 
          />
          <p style={{ color: COLORS.luzGalpao }} className="text-lg">
            Carregando estratégia...
          </p>
        </motion.div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: COLORS.chaoFabrica }}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-md px-6"
        >
          <div 
            className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center"
            style={{ backgroundColor: `${COLORS.farolCarga}20` }}
          >
            <Target className="w-10 h-10" style={{ color: COLORS.farolCarga }} />
          </div>
          <h1 className="text-2xl font-bold mb-4" style={{ color: COLORS.luzGalpao }}>
            Estratégia não encontrada
          </h1>
          <p style={{ color: COLORS.acoIndustrial }}>
            O link que você acessou não é válido ou a estratégia foi removida.
          </p>
        </motion.div>
      </div>
    );
  }

  const strategy = data;
  const clientName = (data as any).clients?.name || 'Cliente';

  // Helper to format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
    }).format(value);
  };

  // Calculate totals
  const calculateTotalBudget = () => {
    let total = 0;
    const metaFunnels = [
      strategy.meta_millennials_mensagem,
      strategy.meta_millennials_cadastro,
      strategy.meta_millennials_call,
      strategy.meta_captacao_representantes,
      strategy.meta_captacao_sdr,
      strategy.meta_disparo_email,
      strategy.meta_grupo_vip,
      strategy.meta_aumento_base,
    ];
    const googleFunnels = [
      strategy.google_pmax,
      strategy.google_pesquisa,
      strategy.google_display,
    ];
    const linkedinFunnels = [
      strategy.linkedin_vagas,
      strategy.linkedin_cadastro,
    ];

    [...metaFunnels, ...googleFunnels, ...linkedinFunnels].forEach((funnel) => {
      if (funnel?.enabled && funnel?.budget) {
        total += funnel.budget;
      }
    });

    return total;
  };

  const countEnabledFunnels = () => {
    let count = 0;
    if (strategy.meta_millennials_mensagem?.enabled) count++;
    if (strategy.meta_millennials_cadastro?.enabled) count++;
    if (strategy.meta_millennials_call?.enabled) count++;
    if (strategy.meta_captacao_representantes?.enabled) count++;
    if (strategy.meta_captacao_sdr?.enabled) count++;
    if (strategy.meta_disparo_email?.enabled) count++;
    if (strategy.meta_grupo_vip?.enabled) count++;
    if (strategy.meta_aumento_base?.enabled) count++;
    if (strategy.google_pmax?.enabled) count++;
    if (strategy.google_pesquisa?.enabled) count++;
    if (strategy.google_display?.enabled) count++;
    if (strategy.linkedin_vagas?.enabled) count++;
    if (strategy.linkedin_cadastro?.enabled) count++;
    return count;
  };

  const countPlatforms = () => {
    let count = 0;
    if (strategy.meta_enabled) count++;
    if (strategy.google_enabled) count++;
    if (strategy.linkedin_enabled) count++;
    return count;
  };

  // Render a single funnel card with detailed information
  const renderFunnelCard = (
    funnelKey: FunnelKey,
    funnel: FunnelData | null,
    platform: 'meta' | 'google' | 'linkedin'
  ) => {
    if (!funnel?.enabled) return null;

    const config = FUNNEL_CONFIG[funnelKey];
    if (!config) return null;

    const Icon = config.icon;

    const platformColors = {
      meta: { bg: 'from-blue-600/20 to-blue-800/20', border: 'border-blue-500/30', accent: 'text-blue-400' },
      google: { bg: 'from-red-600/20 to-red-800/20', border: 'border-red-500/30', accent: 'text-red-400' },
      linkedin: { bg: 'from-blue-700/20 to-blue-900/20', border: 'border-blue-600/30', accent: 'text-blue-300' },
    };

    // Helper to render config items from the strategy data
    const renderConfigItem = (item: { key: string; label: string; icon: any; isBoolean?: boolean; isLink?: boolean }) => {
      const value = funnel[item.key];
      if (value === undefined || value === null || value === '') return null;

      const ItemIcon = item.icon;

      if (item.isBoolean) {
        return (
          <div 
            key={item.key}
            className="flex items-center gap-3 p-3 rounded-lg"
            style={{ backgroundColor: `${COLORS.chaoFabrica}` }}
          >
            <ItemIcon className="w-4 h-4 shrink-0" style={{ color: COLORS.farolCarga }} />
            <span className="text-sm" style={{ color: COLORS.acoIndustrial }}>{item.label}:</span>
            <span 
              className="text-sm font-semibold ml-auto"
              style={{ color: value ? '#22c55e' : '#ef4444' }}
            >
              {value ? 'Sim' : 'Não'}
            </span>
          </div>
        );
      }

      if (item.isLink && value) {
        return (
          <a
            key={item.key}
            href={value}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-3 rounded-lg transition-all duration-200 hover:scale-[1.02]"
            style={{ backgroundColor: COLORS.farolCarga, color: COLORS.chaoFabrica }}
          >
            <ItemIcon className="w-4 h-4 shrink-0" />
            <span className="text-sm font-semibold">{item.label}</span>
            <ExternalLink className="w-4 h-4 ml-auto" />
          </a>
        );
      }

      return (
        <div 
          key={item.key}
          className="p-3 rounded-lg"
          style={{ backgroundColor: `${COLORS.chaoFabrica}` }}
        >
          <div className="flex items-center gap-2 mb-2">
            <ItemIcon className="w-4 h-4" style={{ color: COLORS.farolCarga }} />
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: COLORS.farolCarga }}>
              {item.label}
            </span>
          </div>
          <p className="text-sm" style={{ color: COLORS.luzGalpao }}>
            {value}
          </p>
        </div>
      );
    };

    return (
      <motion.div
        key={funnelKey}
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="relative group"
      >
        <div className={`relative rounded-2xl border ${platformColors[platform].border} p-1 md:p-2`}>
          <GlowingEffect
            spread={40}
            glow={true}
            disabled={false}
            proximity={64}
            inactiveZone={0.01}
            borderWidth={2}
            variant="gold"
          />
          <div 
            className={`relative flex flex-col h-full rounded-xl bg-gradient-to-br ${platformColors[platform].bg} p-6`}
            style={{ backgroundColor: `${COLORS.chaoFabrica}ee` }}
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div 
                className="w-14 h-14 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: `${COLORS.farolCarga}20` }}
              >
                <Icon className="w-7 h-7" style={{ color: COLORS.farolCarga }} />
              </div>
              <span 
                className="text-xs font-bold px-4 py-1.5 rounded-full"
                style={{ 
                  backgroundColor: `${COLORS.farolCarga}20`,
                  color: COLORS.farolCarga 
                }}
              >
                {config.tagline}
              </span>
            </div>

            {/* Title & Short Description */}
            <h3 
              className="text-2xl font-bold mb-3"
              style={{ color: COLORS.luzGalpao }}
            >
              {config.title}
            </h3>
            <p 
              className="text-sm mb-5 leading-relaxed"
              style={{ color: COLORS.acoIndustrial }}
            >
              {config.description}
            </p>

            {/* Detailed Description */}
            <div 
              className="p-5 rounded-xl mb-5"
              style={{ backgroundColor: `${COLORS.chaoFabrica}`, border: `1px solid ${COLORS.farolCarga}20` }}
            >
              <h4 
                className="text-sm font-bold mb-3 flex items-center gap-2"
                style={{ color: COLORS.farolCarga }}
              >
                <FileText className="w-4 h-4" />
                Detalhamento da Estratégia
              </h4>
              <p 
                className="text-sm leading-relaxed whitespace-pre-line"
                style={{ color: COLORS.luzGalpao }}
              >
                {config.detailedDescription}
              </p>
            </div>

            {/* How It Works */}
            <div className="mb-5">
              <h4 
                className="text-sm font-bold mb-4 flex items-center gap-2"
                style={{ color: COLORS.farolCarga }}
              >
                <Zap className="w-4 h-4" />
                Como Funciona
              </h4>
              <div className="space-y-3">
                {config.howItWorks.map((step, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <div 
                      className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold"
                      style={{ 
                        backgroundColor: `${COLORS.farolCarga}20`,
                        color: COLORS.farolCarga 
                      }}
                    >
                      {index + 1}
                    </div>
                    <p 
                      className="text-sm leading-relaxed"
                      style={{ color: COLORS.luzGalpao }}
                    >
                      {step}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Benefits */}
            <div className="mb-5">
              <h4 
                className="text-sm font-bold mb-4 flex items-center gap-2"
                style={{ color: COLORS.farolCarga }}
              >
                <Sparkles className="w-4 h-4" />
                Benefícios
              </h4>
              <div className="grid grid-cols-1 gap-2">
                {config.benefits.map((benefit, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <CheckCircle2 
                      className="w-5 h-5 shrink-0 mt-0.5"
                      style={{ color: '#22c55e' }}
                    />
                    <p 
                      className="text-sm"
                      style={{ color: COLORS.luzGalpao }}
                    >
                      {benefit}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Important Notes */}
            {'importantNotes' in config && config.importantNotes && (
              <div 
                className="p-4 rounded-xl mb-5"
                style={{ backgroundColor: `${COLORS.farolCarga}10`, border: `1px solid ${COLORS.farolCarga}30` }}
              >
                <h4 
                  className="text-sm font-bold mb-3 flex items-center gap-2"
                  style={{ color: COLORS.farolCarga }}
                >
                  <AlertTriangle className="w-4 h-4" />
                  Pontos Importantes
                </h4>
                <div className="space-y-2">
                  {config.importantNotes.map((note, index) => (
                    <div key={index} className="flex items-start gap-2">
                      <div 
                        className="w-1.5 h-1.5 rounded-full mt-2 shrink-0"
                        style={{ backgroundColor: COLORS.farolCarga }}
                      />
                      <p 
                        className="text-sm"
                        style={{ color: COLORS.luzGalpao }}
                      >
                        {note}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Metrics */}
            <div className="flex flex-wrap gap-2 mb-5">
              {config.metrics.map((metric, index) => (
                <span 
                  key={index}
                  className="text-xs font-medium px-3 py-2 rounded-lg"
                  style={{ 
                    backgroundColor: `${COLORS.farolCarga}15`,
                    color: COLORS.luzGalpao,
                    border: `1px solid ${COLORS.farolCarga}30`
                  }}
                >
                  {metric}
                </span>
              ))}
            </div>

            {/* Dynamic Config Items from Strategy */}
            {'configItems' in config && config.configItems && (
              <div className="mb-5">
                <h4 
                  className="text-sm font-bold mb-3 flex items-center gap-2"
                  style={{ color: COLORS.farolCarga }}
                >
                  <Settings className="w-4 h-4" />
                  Configurações desta Estratégia
                </h4>
                <div className="space-y-2">
                  {config.configItems.map(renderConfigItem)}
                </div>
              </div>
            )}

            {/* Budget */}
            <div 
              className="flex items-center gap-3 p-5 rounded-xl mt-auto"
              style={{ backgroundColor: `${COLORS.farolCarga}20`, border: `1px solid ${COLORS.farolCarga}40` }}
            >
              <DollarSign className="w-6 h-6" style={{ color: COLORS.farolCarga }} />
              <div>
                <span className="text-sm block" style={{ color: COLORS.acoIndustrial }}>
                  Investimento Mensal
                </span>
                <span 
                  className="font-bold text-2xl"
                  style={{ color: COLORS.farolCarga }}
                >
                  {formatCurrency(funnel.budget)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <div 
      className="min-h-screen relative"
      style={{ backgroundColor: COLORS.chaoFabrica }}
    >
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <BackgroundPaths />
        
        {/* Background gradient overlay */}
        <div 
          className="absolute inset-0"
          style={{
            background: `radial-gradient(ellipse at center, ${COLORS.chaoFabrica}00 0%, ${COLORS.chaoFabrica} 70%)`,
          }}
        />

        <div className="relative z-10 container mx-auto px-4 py-20 text-center">
          {/* Logo */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-8"
          >
            <img 
              src="/millennials-logo-1.png" 
              alt="Millennials B2B" 
              className="h-16 md:h-20 mx-auto"
            />
          </motion.div>

          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-8"
            style={{ 
              backgroundColor: `${COLORS.farolCarga}20`,
              border: `1px solid ${COLORS.farolCarga}40` 
            }}
          >
            <Zap className="w-4 h-4" style={{ color: COLORS.farolCarga }} />
            <span style={{ color: COLORS.farolCarga }} className="text-sm font-medium">
              ESTRATÉGIA PRO+ EXCLUSIVA
            </span>
          </motion.div>

          {/* Title */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6"
          >
            <span style={{ color: COLORS.luzGalpao }}>Estratégia </span>
            <span style={{ color: COLORS.farolCarga }}>Personalizada</span>
            <br />
            <span style={{ color: COLORS.luzGalpao }}>para </span>
            <span style={{ color: COLORS.farolCarga }}>{clientName}</span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-lg md:text-xl max-w-2xl mx-auto mb-12"
            style={{ color: COLORS.acoIndustrial }}
          >
            Uma estratégia completa de tráfego pago desenvolvida especialmente 
            para escalar suas vendas B2B
          </motion.p>

          {/* Stats Cards */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto"
          >
            {[
              { label: 'Investimento Mín.', value: formatCurrency(strategy.minimum_investment || 0) },
              { label: 'Investimento Rec.', value: formatCurrency(strategy.recommended_investment || 0) },
              { label: 'Plataformas', value: countPlatforms().toString() },
              { label: 'Funis Ativos', value: countEnabledFunnels().toString() },
            ].map((stat, index) => (
              <div
                key={index}
                className="relative p-4 rounded-xl"
                style={{ 
                  backgroundColor: `${COLORS.chaoFabrica}`,
                  border: `1px solid ${COLORS.farolCarga}30` 
                }}
              >
                <p 
                  className="text-2xl md:text-3xl font-bold"
                  style={{ color: COLORS.farolCarga }}
                >
                  {stat.value}
                </p>
                <p 
                  className="text-xs md:text-sm"
                  style={{ color: COLORS.acoIndustrial }}
                >
                  {stat.label}
                </p>
              </div>
            ))}
          </motion.div>

          {/* Scroll indicator */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="absolute bottom-10 left-1/2 -translate-x-1/2"
          >
            <motion.div
              animate={{ y: [0, 10, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="flex flex-col items-center gap-2"
            >
              <span 
                className="text-sm uppercase tracking-widest"
                style={{ color: COLORS.acoIndustrial }}
              >
                Explorar
              </span>
              <div 
                className="w-6 h-10 rounded-full flex items-start justify-center p-2"
                style={{ border: `2px solid ${COLORS.farolCarga}40` }}
              >
                <motion.div
                  animate={{ y: [0, 12, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: COLORS.farolCarga }}
                />
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* General Settings Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 
              className="text-3xl md:text-4xl font-bold mb-4"
              style={{ color: COLORS.luzGalpao }}
            >
              Configurações <span style={{ color: COLORS.farolCarga }}>Gerais</span>
            </h2>
            <p style={{ color: COLORS.acoIndustrial }} className="max-w-2xl mx-auto">
              Parâmetros fundamentais da sua estratégia de tráfego pago
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Location Card */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="p-6 rounded-2xl"
              style={{ 
                backgroundColor: `${COLORS.chaoFabrica}`,
                border: `1px solid ${COLORS.farolCarga}30` 
              }}
            >
              <div className="flex items-center gap-4 mb-4">
                <div 
                  className="w-14 h-14 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: `${COLORS.farolCarga}20` }}
                >
                  <MapPin className="w-7 h-7" style={{ color: COLORS.farolCarga }} />
                </div>
                <div>
                  <h3 
                    className="text-lg font-bold"
                    style={{ color: COLORS.luzGalpao }}
                  >
                    Localização dos Anúncios
                  </h3>
                  <p 
                    className="text-sm"
                    style={{ color: COLORS.acoIndustrial }}
                  >
                    Região geográfica de veiculação
                  </p>
                </div>
              </div>
              <p 
                className="text-xl font-semibold"
                style={{ color: COLORS.farolCarga }}
              >
                {strategy.ad_location || 'Não especificado'}
              </p>
            </motion.div>

            {/* Material Card */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="p-6 rounded-2xl"
              style={{ 
                backgroundColor: `${COLORS.chaoFabrica}`,
                border: `1px solid ${COLORS.farolCarga}30` 
              }}
            >
              <div className="flex items-center gap-4 mb-4">
                <div 
                  className="w-14 h-14 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: `${COLORS.farolCarga}20` }}
                >
                  <MonitorPlay className="w-7 h-7" style={{ color: COLORS.farolCarga }} />
                </div>
                <div>
                  <h3 
                    className="text-lg font-bold"
                    style={{ color: COLORS.luzGalpao }}
                  >
                    Material do Cliente
                  </h3>
                  <p 
                    className="text-sm"
                    style={{ color: COLORS.acoIndustrial }}
                  >
                    Uso de criativos fornecidos
                  </p>
                </div>
              </div>
              <p 
                className="text-xl font-semibold"
                style={{ color: COLORS.farolCarga }}
              >
                {strategy.use_client_material ? 'Sim' : 'Não'}
              </p>
              {strategy.client_material_details && (
                <p 
                  className="mt-2 text-sm"
                  style={{ color: COLORS.acoIndustrial }}
                >
                  {strategy.client_material_details}
                </p>
              )}
            </motion.div>
          </div>
        </div>
      </section>

      {/* Meta Funnels Section */}
      {strategy.meta_enabled && (
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
                style={{ backgroundColor: 'rgba(59, 130, 246, 0.2)' }}
              >
                <span className="text-2xl">📘</span>
                <span className="text-blue-400 font-semibold">META ADS</span>
              </div>
              <h2 
                className="text-3xl md:text-4xl font-bold mb-4"
                style={{ color: COLORS.luzGalpao }}
              >
                Funis <span style={{ color: COLORS.farolCarga }}>Meta</span>
              </h2>
              <p style={{ color: COLORS.acoIndustrial }} className="max-w-2xl mx-auto">
                Estratégias otimizadas para Facebook, Instagram e WhatsApp
              </p>
            </motion.div>

            <div className="grid lg:grid-cols-2 gap-8">
              {renderFunnelCard('millennials_mensagem', strategy.meta_millennials_mensagem, 'meta')}
              {renderFunnelCard('millennials_cadastro', strategy.meta_millennials_cadastro, 'meta')}
              {renderFunnelCard('millennials_call', strategy.meta_millennials_call, 'meta')}
              {renderFunnelCard('captacao_representantes', strategy.meta_captacao_representantes, 'meta')}
              {renderFunnelCard('captacao_sdr', strategy.meta_captacao_sdr, 'meta')}
              {renderFunnelCard('disparo_email', strategy.meta_disparo_email, 'meta')}
              {renderFunnelCard('grupo_vip', strategy.meta_grupo_vip, 'meta')}
              {renderFunnelCard('aumento_base', strategy.meta_aumento_base, 'meta')}
            </div>
          </div>
        </section>
      )}

      {/* Google Funnels Section */}
      {strategy.google_enabled && (
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
                style={{ backgroundColor: 'rgba(239, 68, 68, 0.2)' }}
              >
                <span className="text-2xl">🔍</span>
                <span className="text-red-400 font-semibold">GOOGLE ADS</span>
              </div>
              <h2 
                className="text-3xl md:text-4xl font-bold mb-4"
                style={{ color: COLORS.luzGalpao }}
              >
                Funis <span style={{ color: COLORS.farolCarga }}>Google</span>
              </h2>
              <p style={{ color: COLORS.acoIndustrial }} className="max-w-2xl mx-auto">
                Campanhas de alta performance na rede do Google
              </p>
            </motion.div>

            <div className="grid lg:grid-cols-2 gap-8">
              {renderFunnelCard('pmax', strategy.google_pmax, 'google')}
              {renderFunnelCard('pesquisa', strategy.google_pesquisa, 'google')}
              {renderFunnelCard('display', strategy.google_display, 'google')}
            </div>
          </div>
        </section>
      )}

      {/* LinkedIn Funnels Section */}
      {strategy.linkedin_enabled && (
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
                style={{ backgroundColor: 'rgba(59, 130, 246, 0.3)' }}
              >
                <span className="text-2xl">💼</span>
                <span className="text-blue-300 font-semibold">LINKEDIN ADS</span>
              </div>
              <h2 
                className="text-3xl md:text-4xl font-bold mb-4"
                style={{ color: COLORS.luzGalpao }}
              >
                Funis <span style={{ color: COLORS.farolCarga }}>LinkedIn</span>
              </h2>
              <p style={{ color: COLORS.acoIndustrial }} className="max-w-2xl mx-auto">
                Alcance decisores e profissionais B2B
              </p>
            </motion.div>

            <div className="grid lg:grid-cols-2 gap-8 max-w-4xl mx-auto">
              {renderFunnelCard('linkedin_vagas', strategy.linkedin_vagas, 'linkedin')}
              {renderFunnelCard('linkedin_cadastro', strategy.linkedin_cadastro, 'linkedin')}
            </div>
          </div>
        </section>
      )}

      {/* Investment Summary */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="relative p-8 md:p-12 rounded-3xl overflow-hidden"
            style={{ 
              background: `linear-gradient(135deg, ${COLORS.chaoFabrica} 0%, ${COLORS.farolCarga}15 100%)`,
              border: `2px solid ${COLORS.farolCarga}40`
            }}
          >
            <div className="relative z-10 text-center">
              <h2 
                className="text-3xl md:text-4xl font-bold mb-8"
                style={{ color: COLORS.luzGalpao }}
              >
                Resumo do <span style={{ color: COLORS.farolCarga }}>Investimento</span>
              </h2>

              <div className="grid md:grid-cols-3 gap-6 mb-8">
                <div className="p-6 rounded-2xl" style={{ backgroundColor: `${COLORS.chaoFabrica}90` }}>
                  <p className="text-sm mb-2" style={{ color: COLORS.acoIndustrial }}>
                    Investimento Mínimo
                  </p>
                  <p className="text-3xl font-bold" style={{ color: COLORS.farolCarga }}>
                    {formatCurrency(strategy.minimum_investment || 0)}
                  </p>
                </div>
                <div className="p-6 rounded-2xl" style={{ backgroundColor: `${COLORS.chaoFabrica}90` }}>
                  <p className="text-sm mb-2" style={{ color: COLORS.acoIndustrial }}>
                    Investimento Recomendado
                  </p>
                  <p className="text-3xl font-bold" style={{ color: COLORS.farolCarga }}>
                    {formatCurrency(strategy.recommended_investment || 0)}
                  </p>
                </div>
                <div className="p-6 rounded-2xl" style={{ backgroundColor: `${COLORS.chaoFabrica}90` }}>
                  <p className="text-sm mb-2" style={{ color: COLORS.acoIndustrial }}>
                    Total em Mídia (Funis)
                  </p>
                  <p className="text-3xl font-bold" style={{ color: COLORS.farolCarga }}>
                    {formatCurrency(calculateTotalBudget())}/mês
                  </p>
                </div>
              </div>

              <p 
                className="text-lg max-w-2xl mx-auto"
                style={{ color: COLORS.acoIndustrial }}
              >
                Esta estratégia foi desenvolvida especificamente para potencializar 
                os resultados da <strong style={{ color: COLORS.farolCarga }}>{clientName}</strong> 
                {' '}no mercado B2B.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* 5 Marcos Millennials Section */}
      <StrategyMarcosSection />

      {/* Próximos Passos Section */}
      <StrategyProximosPassosSection />

      {/* Alinhamento de Expectativa Section */}
      <StrategyExpectativaSection
        metaEnabled={strategy.meta_enabled}
        googleEnabled={strategy.google_enabled}
        linkedinEnabled={strategy.linkedin_enabled}
        metaMillennialsMensagem={strategy.meta_millennials_mensagem}
        metaMillennialsCadastro={strategy.meta_millennials_cadastro}
        metaMillennialsCall={strategy.meta_millennials_call}
        metaCaptacaoRepresentantes={strategy.meta_captacao_representantes}
        metaCaptacaoSdr={strategy.meta_captacao_sdr}
        metaDisparoEmail={strategy.meta_disparo_email}
        metaGrupoVip={strategy.meta_grupo_vip}
        metaAumentoBase={strategy.meta_aumento_base}
        googlePmax={strategy.google_pmax}
        googlePesquisa={strategy.google_pesquisa}
        googleDisplay={strategy.google_display}
        linkedinVagas={strategy.linkedin_vagas}
        linkedinCadastro={strategy.linkedin_cadastro}
      />

      {/* Footer */}
      <footer className="py-8 px-4 border-t" style={{ borderColor: `${COLORS.farolCarga}20` }}>
        <div className="container mx-auto max-w-6xl text-center">
          <img 
            src="/millennials-logo-1.png" 
            alt="Millennials B2B" 
            className="h-10 mx-auto mb-4 opacity-70"
          />
          <p className="text-sm" style={{ color: COLORS.acoIndustrial }}>
            © {new Date().getFullYear()} Millennials B2B • A Maior Aceleradora de Fábricas e Distribuidoras B2B da América Latina
          </p>
        </div>
      </footer>
    </div>
  );
}
