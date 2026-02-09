import { motion } from 'framer-motion';
import { 
  AlertTriangle, 
  DollarSign, 
  Target, 
  Clock, 
  TrendingUp,
  MessageSquare,
  Phone,
  FileText,
  Users,
  Search,
  Briefcase,
  CheckCircle2
} from 'lucide-react';

// Millennials B2B Colors
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

// Configuração de expectativas por funil
const EXPECTATIVAS_META: Record<string, FunnelExpectativa> = {
  millennials_mensagem: {
    title: 'Millennials Mensagem',
    icon: MessageSquare,
    custoMedio: 'CPL médio de R$ 15-40 por lead qualificado',
    problemasPrimeiraMoment: [
      'Leads podem não responder imediatamente – tempo de resposta varia',
      'Qualificação automática pode filtrar leads válidos se o filtro for muito agressivo',
      'Volume alto de conversas exige equipe comercial preparada',
      'Leads de outras regiões podem aparecer se anúncio não for bem segmentado',
    ],
    expectativasRealistas: [
      'Primeiras semanas são de TESTE e AJUSTE de segmentação',
      'Espere de 7-15 dias para ter dados suficientes de otimização',
      'Taxa de resposta esperada: 60-80% dos leads qualificados',
      'Conversão em vendas: depende do processo comercial do cliente',
    ],
  },
  millennials_cadastro: {
    title: 'Millennials Cadastro',
    icon: FileText,
    custoMedio: 'CPL médio de R$ 10-30 por lead com CNPJ',
    problemasPrimeiraMoment: [
      'Alguns leads podem preencher CNPJ inválido ou fictício',
      'Taxa de conversão do formulário precisa de otimização contínua',
      'Leads podem demorar para responder primeiro contato',
      'CRM precisa estar configurado corretamente para receber leads',
    ],
    expectativasRealistas: [
      'Leads 100% com CNPJ, mas nem todos serão seu cliente ideal',
      'Primeiros 10-14 dias são de calibragem do formulário',
      'Automação de disparo precisa de teste de mensagens',
      'Qualificação real: 70-85% dos leads cadastrados',
    ],
  },
  millennials_call: {
    title: 'Millennials Call',
    icon: Phone,
    custoMedio: 'Custo médio de R$ 50-150 por agendamento',
    problemasPrimeiraMoment: [
      'Alguns leads não comparecem à reunião (no-show)',
      'Horários disponíveis no calendário podem gerar gargalo',
      'Landing Page precisa de otimização de taxa de conversão',
      'Lead pode agendar e depois cancelar ou remarcar',
    ],
    expectativasRealistas: [
      'Taxa de show-up esperada: 70-85% com lembretes configurados',
      'Primeiras 2-3 semanas são de ajuste de LP e copywriting',
      'Conversão em venda: 20-40% dos que comparecem',
      'Treinamento comercial é CRUCIAL para maximizar resultados',
    ],
  },
  captacao_representantes: {
    title: 'Captação de Representantes',
    icon: Users,
    custoMedio: 'Custo médio de R$ 20-60 por candidato',
    problemasPrimeiraMoment: [
      'Muitos candidatos podem não ter o perfil desejado',
      'Filtro regional pode não ser 100% efetivo',
      'Candidatos podem desistir no processo seletivo',
      'Volume de candidatos pode ser muito alto para triagem manual',
    ],
    expectativasRealistas: [
      'Apenas 30-50% dos candidatos serão realmente qualificados',
      'Processo seletivo interno é responsabilidade do cliente',
      'Campanha roda por tempo indeterminado até atingir meta',
      'Taxa de contratação esperada: 10-20% dos qualificados',
    ],
  },
  captacao_sdr: {
    title: 'Captação de SDRs',
    icon: Users,
    custoMedio: 'Custo médio de R$ 25-70 por candidato',
    problemasPrimeiraMoment: [
      'Candidatos sem experiência prévia em SDR são comuns',
      'Expectativa salarial pode não estar alinhada',
      'Filtro de região pode deixar passar candidatos de fora',
      'Tempo de ramp-up do SDR depende do treinamento',
    ],
    expectativasRealistas: [
      'Candidatos qualificados: 25-40% do total',
      'Treinamento incluído reduz tempo de adaptação em 50%',
      'Nem todo candidato fica após período de experiência',
      'SDRs treinados começam a produzir em 2-4 semanas',
    ],
  },
  disparo_email: {
    title: 'Disparo de Email Base Antiga',
    icon: FileText,
    custoMedio: 'CPL médio de R$ 5-15 por reativação',
    problemasPrimeiraMoment: [
      'Base antiga pode ter emails inválidos ou desatualizados',
      'Taxa de abertura inicial pode ser baixa',
      'Alguns emails podem cair em spam',
      'Leads reativados podem ter baixo interesse',
    ],
    expectativasRealistas: [
      'Taxa de abertura esperada: 30-45%',
      'Taxa de reativação: 5-15% da base total',
      'Limpeza de lista é necessária antes dos disparos',
      'Melhor ROI quando combinado com outras estratégias',
    ],
  },
  grupo_vip: {
    title: 'Millennials Grupo VIP',
    icon: MessageSquare,
    custoMedio: 'Custo médio de R$ 5-20 por membro',
    problemasPrimeiraMoment: [
      'Alguns membros entram e nunca interagem',
      'Grupo precisa de conteúdo constante para engajamento',
      'Pode haver saídas se o conteúdo não for relevante',
      'Gestão do grupo demanda tempo e dedicação',
    ],
    expectativasRealistas: [
      'Engajamento esperado: 40-60% dos membros',
      'Conversão em vendas: 10-25% dos membros engajados',
      'Resultados de longo prazo – não espere vendas imediatas',
      'Grupo cresce e converte melhor com tempo',
    ],
  },
  aumento_base: {
    title: 'Millennials Aumento de Base',
    icon: TrendingUp,
    custoMedio: 'Custo médio de R$ 0.50-2 por seguidor',
    problemasPrimeiraMoment: [
      'Seguidores novos podem ter baixo engajamento inicial',
      'Conteúdo orgânico precisa estar alinhado com anúncios',
      'Crescimento de seguidores ≠ vendas imediatas',
      'Alguns seguidores podem dar unfollow após seguir',
    ],
    expectativasRealistas: [
      'Estratégia de longo prazo – resultados em 2-3 meses',
      'Taxa de engajamento esperada: 3-8%',
      'Conversão orgânica: 2-5% dos seguidores',
      'Requer consistência de conteúdo para retenção',
    ],
  },
};

const EXPECTATIVAS_GOOGLE: Record<string, FunnelExpectativa> = {
  pmax: {
    title: 'Millennials PMAX',
    icon: Search,
    custoMedio: 'CPA 20% menor que campanhas separadas em média',
    problemasPrimeiraMoment: [
      'Algoritmo precisa de 2-4 semanas para aprender',
      'Primeiros leads podem não ser os mais qualificados',
      'Controle sobre onde os anúncios aparecem é limitado',
      'Volume de conversões pode variar bastante no início',
    ],
    expectativasRealistas: [
      'Fase de aprendizado: 2-4 semanas',
      'Alcance maior que outras campanhas (+50%)',
      'Conversões tendem a aumentar 15-30% após otimização',
      'Resultados consistentes após 30+ dias',
    ],
  },
  pesquisa: {
    title: 'Millennials Pesquisa',
    icon: Search,
    custoMedio: 'CPC médio de R$ 2-8 por clique qualificado',
    problemasPrimeiraMoment: [
      'Palavras-chave podem ter custo alto no início',
      'Índice de qualidade precisa ser otimizado',
      'Concorrência pode inflacionar CPCs',
      'Anúncios podem não aparecer nas primeiras posições',
    ],
    expectativasRealistas: [
      'Leads de alta intenção – já estão buscando',
      'Otimização de palavras-chave é contínua',
      'CTR esperado: 3-8% após otimização',
      'Qualidade do lead: geralmente alta',
    ],
  },
  display: {
    title: 'Millennials Display',
    icon: TrendingUp,
    custoMedio: 'CPM médio de R$ 5-20 por mil impressões',
    problemasPrimeiraMoment: [
      'CTR é naturalmente baixo em display (esperado)',
      'Anúncios podem aparecer em sites irrelevantes',
      'Frequência precisa ser controlada para evitar irritação',
      'Leads de display são geralmente menos quentes',
    ],
    expectativasRealistas: [
      'Estratégia de awareness – não espere vendas diretas',
      'CTR esperado: 0.1-0.5% (normal para display)',
      'Melhor quando combinado com remarketing',
      'Resultados mensuráveis em 4-8 semanas',
    ],
  },
};

const EXPECTATIVAS_LINKEDIN: Record<string, FunnelExpectativa> = {
  linkedin_vagas: {
    title: 'LinkedIn Vagas',
    icon: Briefcase,
    custoMedio: 'Custo médio de R$ 80-200 por candidato',
    problemasPrimeiraMoment: [
      'Candidatos podem estar empregados e não urgentes',
      'CPL mais alto que outras plataformas',
      'Formulários longos podem reduzir conversões',
      'Candidatos seniores são mais caros de atingir',
    ],
    expectativasRealistas: [
      'Qualidade de candidatos geralmente alta',
      'Tempo de resposta pode ser mais longo',
      'Melhor para vagas de nível sênior/especializado',
      'ROI justificado pela qualidade dos candidatos',
    ],
  },
  linkedin_cadastro: {
    title: 'LinkedIn Cadastro',
    icon: FileText,
    custoMedio: 'CPL médio de R$ 100-300 por lead B2B',
    problemasPrimeiraMoment: [
      'CPL mais alto que Meta/Google',
      'Decisores podem demorar para responder',
      'Volume de leads é menor que outras plataformas',
      'Formulários nativos podem ter campos limitados',
    ],
    expectativasRealistas: [
      'Leads de altíssima qualidade (decisores)',
      'Ciclo de venda B2B é mais longo',
      'Ticket médio tende a ser maior',
      'Ideal para vendas complexas e alto valor',
    ],
  },
};

interface Props {
  metaEnabled?: boolean;
  googleEnabled?: boolean;
  linkedinEnabled?: boolean;
  metaMillennialsMensagem?: any;
  metaMillennialsCadastro?: any;
  metaMillennialsCall?: any;
  metaCaptacaoRepresentantes?: any;
  metaCaptacaoSdr?: any;
  metaDisparoEmail?: any;
  metaGrupoVip?: any;
  metaAumentoBase?: any;
  googlePmax?: any;
  googlePesquisa?: any;
  googleDisplay?: any;
  linkedinVagas?: any;
  linkedinCadastro?: any;
}

export default function StrategyExpectativaSection({
  metaEnabled,
  googleEnabled,
  linkedinEnabled,
  metaMillennialsMensagem,
  metaMillennialsCadastro,
  metaMillennialsCall,
  metaCaptacaoRepresentantes,
  metaCaptacaoSdr,
  metaDisparoEmail,
  metaGrupoVip,
  metaAumentoBase,
  googlePmax,
  googlePesquisa,
  googleDisplay,
  linkedinVagas,
  linkedinCadastro,
}: Props) {
  // Collect all enabled funnels
  const enabledFunnels: FunnelExpectativa[] = [];

  if (metaEnabled) {
    if (metaMillennialsMensagem?.enabled) enabledFunnels.push(EXPECTATIVAS_META.millennials_mensagem);
    if (metaMillennialsCadastro?.enabled) enabledFunnels.push(EXPECTATIVAS_META.millennials_cadastro);
    if (metaMillennialsCall?.enabled) enabledFunnels.push(EXPECTATIVAS_META.millennials_call);
    if (metaCaptacaoRepresentantes?.enabled) enabledFunnels.push(EXPECTATIVAS_META.captacao_representantes);
    if (metaCaptacaoSdr?.enabled) enabledFunnels.push(EXPECTATIVAS_META.captacao_sdr);
    if (metaDisparoEmail?.enabled) enabledFunnels.push(EXPECTATIVAS_META.disparo_email);
    if (metaGrupoVip?.enabled) enabledFunnels.push(EXPECTATIVAS_META.grupo_vip);
    if (metaAumentoBase?.enabled) enabledFunnels.push(EXPECTATIVAS_META.aumento_base);
  }

  if (googleEnabled) {
    if (googlePmax?.enabled) enabledFunnels.push(EXPECTATIVAS_GOOGLE.pmax);
    if (googlePesquisa?.enabled) enabledFunnels.push(EXPECTATIVAS_GOOGLE.pesquisa);
    if (googleDisplay?.enabled) enabledFunnels.push(EXPECTATIVAS_GOOGLE.display);
  }

  if (linkedinEnabled) {
    if (linkedinVagas?.enabled) enabledFunnels.push(EXPECTATIVAS_LINKEDIN.linkedin_vagas);
    if (linkedinCadastro?.enabled) enabledFunnels.push(EXPECTATIVAS_LINKEDIN.linkedin_cadastro);
  }

  if (enabledFunnels.length === 0) return null;

  return (
    <section className="py-20 px-4">
      <div className="container mx-auto max-w-6xl">
        {/* Header */}
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
            O que <span style={{ color: COLORS.farolCarga }}>Esperar</span> de Cada Estratégia
          </h2>
          <p style={{ color: COLORS.acoIndustrial }} className="max-w-3xl mx-auto text-lg">
            Transparência total sobre custos médios, desafios comuns nos primeiros momentos 
            e expectativas realistas para cada funil ativado nesta estratégia.
          </p>
        </motion.div>

        {/* Aviso Importante - Marco 01 */}
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
              <h3 
                className="text-lg font-bold mb-2"
                style={{ color: COLORS.farolCarga }}
              >
                Marco 01: Largada da Rota Atlântica
              </h3>
              <p style={{ color: COLORS.luzGalpao }} className="text-sm mb-3">
                As primeiras semanas são de <strong>teste, ajuste e calibragem</strong>. 
                Neste momento medimos o "vento" do mercado: objeções, qualidade do lead 
                e aderência da oferta.
              </p>
              <ul className="space-y-2">
                <li className="flex items-start gap-2">
                  <Clock className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: COLORS.farolCarga }} />
                  <span className="text-sm" style={{ color: COLORS.acoIndustrial }}>
                    <strong>Primeiros 7-15 dias:</strong> Coleta de dados e primeiras otimizações
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <TrendingUp className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: COLORS.farolCarga }} />
                  <span className="text-sm" style={{ color: COLORS.acoIndustrial }}>
                    <strong>Primeiros 30 dias:</strong> Padrões de comportamento começam a surgir
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Target className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: COLORS.farolCarga }} />
                  <span className="text-sm" style={{ color: COLORS.acoIndustrial }}>
                    <strong>60-90 dias:</strong> Resultados consistentes e previsibilidade
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
                backgroundColor: `${COLORS.chaoFabrica}`,
                border: `1px solid ${COLORS.farolCarga}20`
              }}
            >
              {/* Funnel Header */}
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
                  <h3 
                    className="text-lg font-bold"
                    style={{ color: COLORS.luzGalpao }}
                  >
                    {funnel.title}
                  </h3>
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4" style={{ color: COLORS.farolCarga }} />
                    <span 
                      className="text-sm font-semibold"
                      style={{ color: COLORS.farolCarga }}
                    >
                      {funnel.custoMedio}
                    </span>
                  </div>
                </div>
              </div>

              {/* Content Grid */}
              <div className="p-6 grid md:grid-cols-2 gap-6">
                {/* Problemas do Primeiro Momento */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <AlertTriangle className="w-5 h-5" style={{ color: '#ef4444' }} />
                    <h4 
                      className="font-semibold text-sm"
                      style={{ color: COLORS.luzGalpao }}
                    >
                      Problemas Comuns no Início
                    </h4>
                  </div>
                  <ul className="space-y-2">
                    {funnel.problemasPrimeiraMoment.map((problema, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span 
                          className="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0"
                          style={{ backgroundColor: '#ef4444' }}
                        />
                        <span className="text-sm" style={{ color: COLORS.acoIndustrial }}>
                          {problema}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Expectativas Realistas */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <CheckCircle2 className="w-5 h-5" style={{ color: '#22c55e' }} />
                    <h4 
                      className="font-semibold text-sm"
                      style={{ color: COLORS.luzGalpao }}
                    >
                      Expectativas Realistas
                    </h4>
                  </div>
                  <ul className="space-y-2">
                    {funnel.expectativasRealistas.map((expectativa, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span 
                          className="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0"
                          style={{ backgroundColor: '#22c55e' }}
                        />
                        <span className="text-sm" style={{ color: COLORS.acoIndustrial }}>
                          {expectativa}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Footer Note */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mt-12 text-center p-6 rounded-2xl"
          style={{ backgroundColor: `${COLORS.chaoFabrica}80` }}
        >
          <p 
            className="text-sm max-w-3xl mx-auto"
            style={{ color: COLORS.acoIndustrial }}
          >
            <strong style={{ color: COLORS.farolCarga }}>Lembre-se:</strong>{' '}
            Cada negócio é único. Os dados acima são baseados em médias de mercado e 
            experiência acumulada da Millennials B2B. Resultados reais dependem de 
            fatores como nicho, oferta, processo comercial e investimento disponível.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
