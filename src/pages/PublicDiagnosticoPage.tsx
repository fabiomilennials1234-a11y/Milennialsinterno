import { useParams } from 'react-router-dom';
import { Loader2, FileText } from 'lucide-react';
import {
  usePublicDiagnostico,
  calcAreaScores,
  calcNotaGeral,
  calcPrioridade,
  AREAS,
  type AreaScore,
  type DiagnosticoRecord,
} from '@/hooks/useMktplaceDiagnostico';
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts';

// ── Inverted keys & labels (same as hook) ──
const INVERTED_KEYS = new Set([
  'depende_uma_pessoa', 'cadastro_fraco', 'frete_impacta',
  'ruptura_frequente', 'logistica_prejudica', 'cancelamentos_falha',
  'potencial_mal_aproveitado', 'muitas_reclamacoes',
]);

const QUESTION_LABELS: Record<string, string> = {
  operacao_organizada: 'Operação organizada',
  responsavel_interno: 'Responsável interno',
  responde_rapido: 'Responde rápido às demandas',
  rotina_metricas: 'Rotina de métricas',
  depende_uma_pessoa: 'Não depende de uma só pessoa',
  processo_claro: 'Processos claros',
  titulos_bons: 'Títulos bem elaborados',
  descricoes_boas: 'Descrições persuasivas',
  imagens_profissionais: 'Imagens profissionais',
  padronizacao_visual: 'Padronização visual',
  ficha_tecnica_completa: 'Ficha técnica completa',
  cadastro_fraco: 'Sem cadastros fracos',
  diferenciais_claros: 'Diferenciais competitivos',
  precos_competitivos: 'Preços competitivos',
  entende_margem: 'Entende margem por produto',
  estrategia_precificacao: 'Estratégia de precificação',
  acompanha_concorrentes: 'Acompanha concorrentes',
  frete_impacta: 'Frete sem impacto negativo',
  estoque_sincronizado: 'Estoque sincronizado',
  ruptura_frequente: 'Sem ruptura frequente',
  prazo_envio_bom: 'Prazo de envio adequado',
  logistica_prejudica: 'Logística não prejudica',
  cancelamentos_falha: 'Sem cancelamentos por falha',
  conversao_saudavel: 'Conversão saudável',
  acompanha_metricas_conv: 'Acompanha métricas de conversão',
  produtos_visita_convertem: 'Produtos visitados convertem',
  potencial_mal_aproveitado: 'Potencial bem aproveitado',
  otimizacao_continua: 'Otimização contínua',
  reputacao_saudavel: 'Reputação saudável',
  atendimento_bom: 'Atendimento de qualidade',
  tempo_resposta_adequado: 'Tempo de resposta adequado',
  muitas_reclamacoes: 'Sem excesso de reclamações',
  usa_midia_paga: 'Usa mídia paga',
  midia_estrategica: 'Mídia paga estratégica',
  estrategia_crescimento: 'Estratégia de crescimento',
  priorizacao_potencial: 'Priorização por potencial',
  plano_escalar: 'Plano para escalar',
};

// ── Recommendation generator ──
function buildRecommendations(areas: AreaScore[], diag: DiagnosticoRecord) {
  const imediatas: string[] = [];
  const curtoPrazo: string[] = [];
  const escala: string[] = [];

  for (const area of areas) {
    if (area.status === 'critico') {
      switch (area.key) {
        case 'anuncios':
          imediatas.push('Corrigir anúncios incompletos e revisar títulos e descrições');
          imediatas.push('Melhorar qualidade das imagens dos produtos');
          break;
        case 'estoque':
          imediatas.push('Sincronizar estoque e corrigir rupturas');
          imediatas.push('Ajustar prazos de envio e logística');
          break;
        case 'reputacao':
          imediatas.push('Melhorar tempo de resposta e qualidade do atendimento');
          imediatas.push('Tratar reclamações e devoluções pendentes');
          break;
        case 'estrutura':
          imediatas.push('Organizar a operação e definir responsável interno');
          imediatas.push('Criar processos claros para cadastro, preço e estoque');
          break;
        case 'preco':
          curtoPrazo.push('Revisar precificação e definir estratégia competitiva');
          curtoPrazo.push('Monitorar concorrentes e ajustar posicionamento');
          break;
        case 'conversao':
          curtoPrazo.push('Analisar taxa de conversão e identificar gargalos');
          curtoPrazo.push('Priorizar produtos com maior potencial de vendas');
          break;
        case 'crescimento':
          escala.push('Definir plano de crescimento estruturado');
          escala.push('Avaliar investimento em mídia paga no marketplace');
          break;
      }
    } else if (area.status === 'atencao') {
      switch (area.key) {
        case 'anuncios': curtoPrazo.push('Otimizar anúncios existentes e padronizar cadastro'); break;
        case 'estoque': curtoPrazo.push('Melhorar controle de estoque e logística'); break;
        case 'reputacao': curtoPrazo.push('Fortalecer atendimento e reduzir reclamações'); break;
        case 'estrutura': curtoPrazo.push('Estruturar rotina de acompanhamento de métricas'); break;
        case 'preco': curtoPrazo.push('Refinar estratégia de preço e monitorar margens'); break;
        case 'conversao': escala.push('Implementar otimização contínua de conversão'); break;
        case 'crescimento': escala.push('Desenvolver plano de escala com priorização de SKUs'); break;
      }
    } else {
      escala.push(`Manter e otimizar ${area.label.toLowerCase()}`);
    }
  }
  if (diag.corrigir_imediatamente?.trim()) imediatas.push(diag.corrigir_imediatamente.trim());
  if (diag.melhorar_medio_prazo?.trim()) curtoPrazo.push(diag.melhorar_medio_prazo.trim());
  if (diag.gerar_faturamento_rapido?.trim()) escala.push(diag.gerar_faturamento_rapido.trim());

  return { imediatas, curtoPrazo, escala };
}

interface NextStep {
  action: string;
  why: string;
  howTo: string[];
  examples: string[];
  learn: string[];
}

const AREA_STEPS: Record<string, { critico: NextStep; atencao: NextStep }> = {
  estrutura: {
    critico: {
      action: 'Reorganizar a estrutura operacional do marketplace',
      why: 'Sem uma operação organizada, todas as outras melhorias perdem efetividade. Erros de cadastro, atrasos e falta de processo geram retrabalho e perda de vendas.',
      howTo: [
        'Definir um responsável interno exclusivo para a operação no marketplace',
        'Criar checklist diário: verificar pedidos pendentes, mensagens não respondidas, estoque crítico e anúncios pausados',
        'Documentar o processo de cadastro de produto (título, fotos, descrição, preço, estoque)',
        'Estabelecer rotina semanal de análise de métricas: visitas, conversão, ticket médio e faturamento',
      ],
      examples: [
        'Antes: pedidos atrasam porque ninguém monitora o painel → Depois: responsável verifica painel 3x/dia com horários fixos',
        'Antes: cada produto é cadastrado de um jeito → Depois: template padrão com campos obrigatórios preenchidos',
        'Antes: métricas só são vistas quando o faturamento cai → Depois: planilha semanal com evolução de visitas, conversão e ticket',
      ],
      learn: [
        'Pesquise: "como organizar operação no Mercado Livre" ou "gestão de e-commerce marketplace"',
        'Assista vídeos sobre: "rotina de seller no marketplace" e "checklist operacional e-commerce"',
        'Consulte: Central do Vendedor do seu marketplace (Mercado Livre, Shopee, Amazon) — seção de boas práticas',
      ],
    },
    atencao: {
      action: 'Fortalecer a rotina de acompanhamento de métricas e processos',
      why: 'A operação funciona, mas sem rotina estruturada de métricas, problemas pequenos passam despercebidos até se tornarem grandes.',
      howTo: [
        'Criar dashboard simples (planilha ou ferramenta) com: visitas, conversão, ticket médio, faturamento e reputação',
        'Revisar esses números semanalmente e anotar variações significativas',
        'Documentar processos que ainda dependem de memória ou de uma única pessoa',
      ],
      examples: [
        'Uma queda de 20% nas visitas de um produto top pode indicar perda de posicionamento — sem monitoramento, só percebe quando o faturamento já caiu',
        'Planilha simples com 5 colunas (semana, visitas, pedidos, conversão, faturamento) já resolve 80% do problema',
      ],
      learn: [
        'Pesquise: "dashboard de métricas marketplace" e "KPIs para seller"',
        'Assista vídeos sobre: "como acompanhar métricas no Mercado Livre/Shopee"',
        'Consulte: relatórios nativos do seu marketplace — seção de analytics/desempenho',
      ],
    },
  },
  anuncios: {
    critico: {
      action: 'Corrigir cadastro, títulos, imagens e descrições dos anúncios',
      why: 'Anúncios fracos = menos cliques = menos vendas. No marketplace, o anúncio é a sua vitrine. Título ruim não aparece na busca, imagem ruim não gera clique, descrição fraca não converte.',
      howTo: [
        'Revisar os títulos: incluir palavra-chave principal + atributos do produto (marca, modelo, tamanho, cor, material)',
        'Trocar imagens amadoras por fotos com fundo branco, boa iluminação e múltiplos ângulos',
        'Reescrever descrições: começar pelo benefício principal, listar especificações técnicas e incluir chamada para ação',
        'Completar ficha técnica de todos os produtos (peso, dimensões, material, composição)',
        'Padronizar visualmente: mesmo estilo de foto, mesmo formato de título, mesmo padrão de descrição',
      ],
      examples: [
        'Título ruim: "Bolsa feminina bonita" → Título bom: "Bolsa Feminina Couro Sintético Grande Transversal - Preta"',
        'Imagem ruim: foto com fundo bagunçado tirada com celular → Imagem boa: fundo branco, produto centralizado, 6+ fotos com detalhes',
        'Descrição ruim: "Bolsa muito boa, compre já" → Descrição boa: "Bolsa transversal em couro sintético premium, com 3 compartimentos internos, alça ajustável e fecho magnético. Ideal para uso diário e trabalho. Dimensões: 30x25x10cm"',
      ],
      learn: [
        'Pesquise: "como criar título perfeito no Mercado Livre" e "SEO para marketplace"',
        'Assista vídeos sobre: "como tirar fotos de produtos para e-commerce" e "copywriting para marketplace"',
        'Consulte: Central do Vendedor — seção de qualidade de anúncios e requisitos de imagem',
        'Ferramenta útil: Canva (para editar imagens) e Google Keyword Planner (para encontrar termos de busca)',
      ],
    },
    atencao: {
      action: 'Otimizar anúncios existentes para melhorar posicionamento e conversão',
      why: 'Os anúncios funcionam, mas pequenas otimizações em título e imagem podem gerar ganhos significativos de visibilidade e conversão.',
      howTo: [
        'Identificar os 10 produtos com mais visitas e revisar títulos com palavras-chave mais buscadas',
        'Adicionar fotos extras (detalhes, produto em uso, embalagem)',
        'Completar fichas técnicas incompletas',
      ],
      examples: [
        'Adicionar "Kit com 3 unidades" no título quando aplicável pode aumentar o ticket médio',
        'Incluir foto do produto sendo usado pelo cliente aumenta a conversão em até 20%',
      ],
      learn: [
        'Pesquise: "otimização de anúncios marketplace" e "como melhorar conversão de produto"',
        'Assista vídeos sobre: "copywriting para e-commerce" e "fotografia de produtos com celular"',
      ],
    },
  },
  preco: {
    critico: {
      action: 'Revisar precificação e definir estratégia competitiva',
      why: 'Preço errado significa perder venda (caro demais) ou perder margem (barato demais). Sem estratégia, você compete no escuro.',
      howTo: [
        'Calcular custo real de cada produto: custo do produto + frete + comissão do marketplace + embalagem + impostos',
        'Definir margem mínima aceitável por categoria',
        'Pesquisar os 5 principais concorrentes de cada produto e anotar preços',
        'Ajustar preços para ficar competitivo sem sacrificar margem',
        'Avaliar se o frete grátis compensa (absorver no preço vs. cobrar separado)',
      ],
      examples: [
        'Produto custando R$30, vendido a R$49,90, com comissão de 16% (R$7,98) + frete (R$12) + embalagem (R$2) = custo total R$51,98 → está dando prejuízo',
        'Concorrente vende o mesmo por R$59,90 com frete grátis → oportunidade de ajustar para R$59,90 e incluir frete no preço',
      ],
      learn: [
        'Pesquise: "como calcular preço de venda marketplace" e "planilha de precificação e-commerce"',
        'Assista vídeos sobre: "estratégia de preço para Mercado Livre" e "como não perder margem vendendo online"',
        'Ferramenta útil: planilhas de precificação disponíveis gratuitamente no YouTube',
      ],
    },
    atencao: {
      action: 'Refinar estratégia de preço e monitorar margens continuamente',
      why: 'A precificação existe, mas sem monitoramento contínuo dos concorrentes e das margens, o posicionamento pode ficar defasado.',
      howTo: [
        'Criar planilha de monitoramento quinzenal dos preços dos top 5 concorrentes',
        'Revisar margem dos 20 produtos mais vendidos mensalmente',
        'Testar variações de preço em produtos com alta visita e baixa conversão',
      ],
      examples: [
        'Se um produto tem 500 visitas/mês e só 2% de conversão, mas o concorrente vende R$10 mais barato, o preço pode ser o gargalo',
      ],
      learn: [
        'Pesquise: "monitoramento de preço marketplace" e "price tracking e-commerce"',
        'Assista vídeos sobre: "como espiar concorrentes no Mercado Livre/Shopee"',
      ],
    },
  },
  estoque: {
    critico: {
      action: 'Corrigir sincronização de estoque e resolver problemas logísticos',
      why: 'Ruptura de estoque cancela vendas e derruba reputação. Atraso no envio gera reclamação, que prejudica o posicionamento dos anúncios.',
      howTo: [
        'Sincronizar estoque real com o estoque cadastrado no marketplace — verificar diariamente',
        'Identificar produtos com ruptura frequente e criar estoque mínimo de segurança',
        'Revisar prazo de envio: se está prometendo 1 dia útil mas despacha em 3, ajustar para prazo realista',
        'Mapear motivos de cancelamento dos últimos 30 dias e corrigir as causas',
        'Se usa múltiplos canais, considerar um ERP ou integrador para evitar venda duplicada',
      ],
      examples: [
        'Antes: vende produto que já acabou → cancelamento → reclamação → queda de reputação → menos vendas',
        'Depois: alerta automático quando estoque chega a 5 unidades → reposição antes de zerar',
        'Prazo real de envio: se sua transportadora leva 2 dias para coletar, não prometa envio em 1 dia',
      ],
      learn: [
        'Pesquise: "como evitar ruptura de estoque marketplace" e "gestão de estoque e-commerce"',
        'Assista vídeos sobre: "como configurar estoque no Mercado Livre" e "integrador de marketplace"',
        'Ferramentas úteis: Bling, Tiny, Omie (ERPs que integram com marketplaces)',
      ],
    },
    atencao: {
      action: 'Melhorar controle de estoque e reduzir atrasos logísticos',
      why: 'O estoque funciona, mas falhas pontuais ainda geram cancelamentos ou atrasos que impactam a reputação.',
      howTo: [
        'Automatizar alerta de estoque baixo para os 20 SKUs mais vendidos',
        'Negociar com transportadora para reduzir prazo de coleta',
        'Revisar embalagem para reduzir avarias no transporte',
      ],
      examples: [
        'Trocar embalagem de envelope simples para caixa com proteção interna reduz avarias de 8% para 1%',
      ],
      learn: [
        'Pesquise: "logística para marketplace" e "como melhorar prazo de envio e-commerce"',
        'Assista vídeos sobre: "fulfillment marketplace" e "como usar Mercado Envios Full"',
      ],
    },
  },
  conversao: {
    critico: {
      action: 'Analisar taxa de conversão e identificar gargalos de venda',
      why: 'Ter visitas sem converter é como ter uma loja cheia onde ninguém compra. O problema pode estar no preço, na apresentação, na reputação ou na falta de confiança.',
      howTo: [
        'Acessar relatório de conversão do marketplace e identificar produtos com muita visita e pouca venda',
        'Para cada produto com conversão abaixo de 3%, verificar: preço competitivo? Imagens boas? Descrição completa? Reputação ok?',
        'Priorizar otimização dos 10 produtos com mais visitas — são os que têm maior potencial imediato',
        'Testar variações: trocar imagem principal, ajustar título, oferecer frete grátis',
      ],
      examples: [
        'Produto com 1.000 visitas/mês e 1% de conversão = 10 vendas. Se otimizar para 3% = 30 vendas. Triplicou sem gastar mais com anúncio',
        'Trocar a primeira foto por uma com o produto em uso (lifestyle) pode dobrar a taxa de clique',
      ],
      learn: [
        'Pesquise: "como aumentar conversão no marketplace" e "taxa de conversão e-commerce"',
        'Assista vídeos sobre: "CRO para marketplace" e "como analisar funil de vendas no Mercado Livre"',
        'Consulte: painel de métricas do marketplace — seção de conversão por anúncio',
      ],
    },
    atencao: {
      action: 'Implementar rotina de otimização contínua de conversão',
      why: 'A conversão está razoável, mas sem otimização contínua o desempenho tende a estagnar enquanto concorrentes melhoram.',
      howTo: [
        'Criar rotina mensal de revisão dos 20 produtos com mais visitas',
        'Testar uma mudança por vez (foto, título ou preço) para medir impacto real',
        'Acompanhar evolução de conversão semana a semana',
      ],
      examples: [
        'Mês 1: trocar fotos dos top 10 → Mês 2: revisar títulos → Mês 3: ajustar preços. Medir impacto de cada mudança separadamente',
      ],
      learn: [
        'Pesquise: "teste A/B marketplace" e "otimização contínua de anúncios"',
        'Assista vídeos sobre: "growth hacking para e-commerce" e "como testar mudanças em anúncios"',
      ],
    },
  },
  reputacao: {
    critico: {
      action: 'Recuperar reputação e melhorar atendimento ao cliente',
      why: 'Reputação ruim no marketplace reduz visibilidade dos anúncios, perde o selo de bom vendedor e afasta compradores. É o fator mais difícil de recuperar.',
      howTo: [
        'Responder TODAS as perguntas e mensagens em menos de 1 hora durante horário comercial',
        'Resolver reclamações abertas: oferecer solução rápida (troca, reembolso parcial, envio de peça extra)',
        'Identificar os 3 motivos mais frequentes de reclamação e eliminar a causa raiz',
        'Pedir avaliação positiva para clientes satisfeitos (mensagem pós-venda educada)',
        'Se houver muitas devoluções, revisar qualidade do produto e da embalagem',
      ],
      examples: [
        'Causa #1 de reclamação: "produto diferente da foto" → Solução: trocar fotos por fotos reais do produto exato que será enviado',
        'Causa #2: "atraso na entrega" → Solução: ajustar prazo para valor realista + acompanhar rastreio proativamente',
        'Mensagem pós-venda: "Olá! Seu pedido foi entregue. Ficou tudo certo? Se precisar de algo, estamos aqui. Se puder avaliar sua compra, agradecemos!"',
      ],
      learn: [
        'Pesquise: "como recuperar reputação no Mercado Livre" e "gestão de atendimento marketplace"',
        'Assista vídeos sobre: "como lidar com reclamações no marketplace" e "SAC para e-commerce"',
        'Consulte: Central do Vendedor — seção de reputação e mediação de conflitos',
      ],
    },
    atencao: {
      action: 'Fortalecer atendimento preventivo e reduzir reclamações',
      why: 'A reputação está boa, mas reclamações pontuais podem prejudicar o posicionamento se não forem tratadas rapidamente.',
      howTo: [
        'Reduzir tempo médio de resposta para menos de 30 minutos',
        'Criar mensagens-padrão para dúvidas frequentes (prazo, troca, garantia)',
        'Monitorar avaliações negativas semanalmente e agir sobre cada uma',
      ],
      examples: [
        'Templates de resposta prontos economizam tempo: "Olá! O prazo de entrega para sua região é de X dias úteis após a postagem. Despachamos em até 24h."',
      ],
      learn: [
        'Pesquise: "templates de atendimento e-commerce" e "como reduzir reclamações marketplace"',
        'Assista vídeos sobre: "atendimento ao cliente para sellers" e "automação de mensagens marketplace"',
      ],
    },
  },
  crescimento: {
    critico: {
      action: 'Criar plano estruturado de crescimento no marketplace',
      why: 'Sem plano de crescimento, a operação fica estagnada. Concorrentes que investem em mídia e otimização vão ocupar o espaço.',
      howTo: [
        'Identificar os 5 produtos com maior potencial (boa margem + demanda + pouca concorrência)',
        'Avaliar investimento em Ads dentro do marketplace (Product Ads, Mercado Ads, Shopee Ads)',
        'Começar com orçamento pequeno (R$20-50/dia) nos produtos de melhor margem',
        'Acompanhar ROAS (retorno sobre investimento em anúncio) semanalmente',
        'Expandir catálogo com produtos complementares aos mais vendidos',
      ],
      examples: [
        'Se vende capas de celular, adicionar películas, carregadores e suportes — o cliente que compra um, frequentemente precisa dos outros',
        'Investir R$30/dia em Ads num produto com margem de R$25 por unidade: se gerar 3 vendas extras/dia = R$75 de margem - R$30 de ads = R$45 de lucro extra',
      ],
      learn: [
        'Pesquise: "como usar Mercado Ads" ou "Shopee Ads tutorial" e "estratégia de crescimento marketplace"',
        'Assista vídeos sobre: "Product Ads marketplace" e "como escalar vendas no e-commerce"',
        'Consulte: Central de Publicidade do seu marketplace — tutoriais de campanha',
      ],
    },
    atencao: {
      action: 'Desenvolver plano de escala com priorização inteligente de SKUs',
      why: 'A base de crescimento existe, mas sem priorização e investimento focado, o potencial fica subaproveitado.',
      howTo: [
        'Classificar SKUs em A (top 20% do faturamento), B (próximos 30%) e C (restante)',
        'Concentrar investimento em Ads nos produtos classe A',
        'Testar expansão para novos marketplaces com os produtos classe A já validados',
      ],
      examples: [
        'Regra 80/20: geralmente 20% dos SKUs geram 80% do faturamento. Investir nos 20% certos é mais eficiente que tentar otimizar tudo',
      ],
      learn: [
        'Pesquise: "curva ABC e-commerce" e "como escalar marketplace"',
        'Assista vídeos sobre: "gestão de portfólio de produtos" e "quando expandir para outros marketplaces"',
      ],
    },
  },
};

function buildNextSteps(areas: AreaScore[], diag: DiagnosticoRecord): NextStep[] {
  const steps: NextStep[] = [];
  const criticas = areas.filter(a => a.status === 'critico');
  const atencaoAreas = areas.filter(a => a.status === 'atencao');

  // Steps from critical areas
  for (const area of criticas) {
    const config = AREA_STEPS[area.key];
    if (config?.critico) steps.push(config.critico);
  }

  // Steps from attention areas
  for (const area of atencaoAreas) {
    const config = AREA_STEPS[area.key];
    if (config?.atencao) steps.push(config.atencao);
  }

  // Acompanhamento
  steps.push({
    action: 'Agendar próximo acompanhamento para revisar progresso',
    why: 'Sem revisão periódica, as melhorias perdem ritmo e os problemas voltam. Acompanhamento garante execução contínua e ajuste de rota.',
    howTo: [
      'Definir data fixa para revisão (ex: toda segunda-feira, 30 minutos)',
      'Na revisão, comparar métricas atuais com as do diagnóstico anterior',
      'Anotar o que foi feito, o que funcionou e o que precisa ser ajustado',
      'Priorizar as próximas 3 ações da semana com base nos resultados observados',
    ],
    examples: [
      'Semana 1: troquei fotos de 5 produtos → visitas subiram 15% → continuar com os próximos 5',
      'Semana 2: ajustei preço de 3 produtos → conversão subiu de 2% para 3,5% → manter preço novo',
    ],
    learn: [
      'Pesquise: "rotina de gestão para e-commerce" e "como acompanhar evolução de vendas"',
      'Crie uma planilha simples de acompanhamento semanal com: ação realizada, resultado, próximos passos',
    ],
  });

  // Oportunidades do consultor
  if (diag.principais_oportunidades?.trim()) {
    steps.push({
      action: `Explorar oportunidades identificadas: ${diag.principais_oportunidades.trim()}`,
      why: 'Oportunidades identificadas na consultoria são específicas do seu negócio e do momento atual do mercado. Ignorá-las significa perder vantagem competitiva.',
      howTo: [
        'Listar cada oportunidade mencionada separadamente',
        'Para cada uma, definir: o que preciso fazer, quanto vai custar, quanto tempo leva',
        'Começar pela oportunidade de menor esforço e maior impacto',
      ],
      examples: [
        'Se a oportunidade é "expandir para Shopee", começar cadastrando apenas os 10 produtos mais vendidos no Mercado Livre',
      ],
      learn: [
        'Pesquise pelo tema específico da oportunidade identificada',
        'Busque cases de sucesso de sellers que aplicaram estratégia semelhante',
      ],
    });
  }

  // Revisão 30 dias
  steps.push({
    action: 'Revisar diagnóstico em 30 dias para avaliar evolução',
    why: '30 dias é o tempo mínimo para as mudanças gerarem dados mensuráveis. Comparar o antes e depois permite saber o que funcionou e onde ajustar.',
    howTo: [
      'Anotar as métricas atuais (faturamento, visitas, conversão, reputação) como baseline',
      'Após 30 dias, comparar cada métrica com o baseline',
      'Identificar quais ações geraram mais resultado',
      'Solicitar novo diagnóstico se necessário para recalibrar prioridades',
    ],
    examples: [
      'Baseline: faturamento R$20.000, conversão 2%, reputação amarela → Após 30 dias: faturamento R$28.000, conversão 3.2%, reputação verde → crescimento de 40%',
    ],
    learn: [
      'Pesquise: "como medir ROI de otimizações no marketplace" e "métricas de e-commerce para acompanhar"',
      'Consulte: relatórios do marketplace comparando períodos (mês atual vs. anterior)',
    ],
  });

  return steps;
}

// ── Colors ──
const STATUS_COLORS = { saudavel: '#10b981', atencao: '#f59e0b', critico: '#ef4444' };
const BAR_COLORS = (nota: number) => nota >= 8 ? '#10b981' : nota >= 5 ? '#f59e0b' : '#ef4444';

// ── Components ──
function StatusPill({ status }: { status: AreaScore['status'] }) {
  const labels = { saudavel: 'Saudável', atencao: 'Atenção', critico: 'Crítico' };
  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full"
      style={{ background: STATUS_COLORS[status] + '20', color: STATUS_COLORS[status] }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: STATUS_COLORS[status] }} />
      {labels[status]}
    </span>
  );
}

function PrioridadePill({ p }: { p: string }) {
  const c: Record<string, string> = { Baixa: '#10b981', Média: '#f59e0b', Alta: '#f97316', Urgente: '#ef4444' };
  return (
    <span className="inline-flex items-center text-xs font-bold px-3 py-1 rounded-full" style={{ background: (c[p] || '#888') + '20', color: c[p] || '#888' }}>
      {p}
    </span>
  );
}

function Section({ title, children, className = '' }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-sm p-6 md:p-8 ${className}`}>
      <h2 className="text-lg font-bold mb-4" style={{ color: '#fbbf24' }}>{title}</h2>
      {children}
    </div>
  );
}

// ── Main Page ──
export default function PublicDiagnosticoPage() {
  const { token } = useParams<{ token: string }>();
  const { data: diag, isLoading, error } = usePublicDiagnostico(token || '');

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-white/40" />
      </div>
    );
  }

  if (error || !diag) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white">
        <div className="text-center space-y-4">
          <FileText className="mx-auto w-12 h-12 text-white/20" />
          <h1 className="text-xl font-bold">Diagnóstico não encontrado</h1>
          <p className="text-white/50 text-sm">Este link pode ter expirado ou o diagnóstico não está disponível.</p>
        </div>
      </div>
    );
  }

  const areas = calcAreaScores(diag);
  const notaGeral = calcNotaGeral(areas);
  const prioridade = calcPrioridade(notaGeral);
  const criticas = areas.filter(a => a.status === 'critico');
  const atencao = areas.filter(a => a.status === 'atencao');

  // Pontos fortes e gargalos
  const pontosFortes: string[] = [];
  const gargalos: string[] = [];
  for (const area of AREAS) {
    for (const q of area.questions) {
      const val = (diag as any)[q] as string | null;
      if (!val) continue;
      const inv = INVERTED_KEYS.has(q);
      const label = QUESTION_LABELS[q] || q;
      if (inv) { val === 'nao' ? pontosFortes.push(label) : gargalos.push(label); }
      else { val === 'sim' ? pontosFortes.push(label) : gargalos.push(label + (val === 'parcialmente' ? ' (parcial)' : '')); }
    }
  }

  // Resumo
  let resumo = '';
  if (criticas.length >= 4) {
    resumo = `A operação de ${diag.cliente_nome || 'o cliente'} no marketplace apresenta falhas estruturais importantes em diversas áreas. Antes de investir em crescimento ou escala, é necessário corrigir a base operacional para garantir sustentabilidade e competitividade.`;
  } else if (criticas.length >= 2 || atencao.length >= 3) {
    resumo = `A operação possui uma base parcialmente estruturada, porém com pontos críticos que limitam o crescimento. Há oportunidades claras de melhoria que, se corrigidas, podem destravar resultados significativos.`;
  } else if (atencao.length >= 1) {
    resumo = `A operação está bem encaminhada, com boa base operacional. Existem pontos de atenção pontuais que podem ser otimizados para acelerar o crescimento e melhorar os resultados.`;
  } else {
    resumo = `A operação está saudável e bem estruturada. O foco agora deve ser em otimização contínua e estratégias de escala para maximizar o faturamento.`;
  }

  const recs = buildRecommendations(areas, diag);
  const nextSteps = buildNextSteps(areas, diag);

  // Chart data
  const radarData = areas.map(a => ({ area: a.label.replace(' e ', '\ne ').replace(' da ', '\nda '), nota: a.nota, fullMark: 10 }));
  const barData = areas.map(a => ({ area: a.label, nota: a.nota }));

  const notaColor = notaGeral >= 8 ? '#10b981' : notaGeral >= 5 ? '#f59e0b' : '#ef4444';

  return (
    <div className="min-h-screen text-white" style={{ background: 'linear-gradient(160deg, #0c0a09 0%, #1a1412 50%, #0c0a09 100%)' }}>
      {/* Floating ambient */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-20 left-10 w-80 h-80 rounded-full blur-3xl animate-pulse" style={{ background: 'rgba(168,85,247,0.06)' }} />
        <div className="absolute bottom-20 right-10 w-96 h-96 rounded-full blur-3xl animate-pulse" style={{ background: 'rgba(234,179,8,0.05)', animationDelay: '1.5s' }} />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-white/10 px-6 md:px-12 py-5">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-purple-500 to-fuchsia-600 flex items-center justify-center">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <span className="text-sm font-medium text-amber-400/70">Millennials Growth • MKT Place</span>
          </div>
          <span className="text-xs text-white/30">{diag.data_consultoria || ''}</span>
        </div>
      </header>

      {/* Content */}
      <main className="relative z-10 max-w-5xl mx-auto px-6 md:px-12 py-10 space-y-8">

        {/* ── Hero ── */}
        <div className="text-center space-y-3 pb-4">
          <p className="text-sm text-amber-400/60 uppercase tracking-widest font-semibold">Diagnóstico de MKT Place</p>
          <h1 className="text-3xl md:text-4xl font-black">{diag.cliente_nome || 'Cliente'}</h1>
          <div className="flex items-center justify-center gap-4 text-sm text-white/50">
            {diag.marketplace_principal && <span>Marketplace: <strong className="text-white/70">{diag.marketplace_principal}</strong></span>}
            {diag.responsavel_diagnostico && <span>Consultor: <strong className="text-white/70">{diag.responsavel_diagnostico}</strong></span>}
          </div>
        </div>

        {/* ── Nota geral + Prioridade ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1 rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center">
            <p className="text-xs text-white/40 uppercase tracking-wider mb-2">Nota Geral</p>
            <p className="text-6xl font-black" style={{ color: notaColor }}>{notaGeral}</p>
            <p className="text-xs text-white/30 mt-1">de 10</p>
            <div className="mt-4"><PrioridadePill p={prioridade} /></div>
          </div>

          {/* Radar Chart */}
          <div className="md:col-span-2 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <p className="text-xs text-white/40 uppercase tracking-wider mb-3">Visão geral por área</p>
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
                <PolarGrid stroke="rgba(255,255,255,0.08)" />
                <PolarAngleAxis dataKey="area" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }} />
                <PolarRadiusAxis angle={90} domain={[0, 10]} tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 9 }} />
                <Radar name="Nota" dataKey="nota" stroke="#a855f7" fill="#a855f7" fillOpacity={0.25} strokeWidth={2} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── Bar chart — notas por área ── */}
        <Section title="Nota por Área">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={barData} layout="vertical" margin={{ left: 140, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis type="number" domain={[0, 10]} tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} />
              <YAxis type="category" dataKey="area" tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 11 }} width={130} />
              <Tooltip
                contentStyle={{ background: '#1c1917', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', fontSize: 12 }}
                formatter={(v: number) => [`${v}/10`, 'Nota']}
              />
              <Bar dataKey="nota" radius={[0, 6, 6, 0]} barSize={20}>
                {barData.map((entry, i) => (
                  <Cell key={i} fill={BAR_COLORS(entry.nota)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-3 mt-4">
            {areas.map(a => (
              <div key={a.key} className="flex items-center gap-2">
                <span className="text-sm text-white/60">{a.label}:</span>
                <span className="text-sm font-bold" style={{ color: STATUS_COLORS[a.status] }}>{a.nota}/10</span>
                <StatusPill status={a.status} />
              </div>
            ))}
          </div>
        </Section>

        {/* ── Dados do cliente ── */}
        {(diag.categoria_principal || diag.ticket_medio || diag.faturamento_atual) && (
          <Section title="Dados da Operação">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              {diag.categoria_principal && <div><span className="text-white/40">Categoria:</span> <span className="font-medium">{diag.categoria_principal}</span></div>}
              {diag.ticket_medio && <div><span className="text-white/40">Ticket médio:</span> <span className="font-medium">R$ {Number(diag.ticket_medio).toLocaleString('pt-BR')}</span></div>}
              {diag.quantidade_skus && <div><span className="text-white/40">SKUs:</span> <span className="font-medium">{diag.quantidade_skus}</span></div>}
              {diag.faturamento_atual && <div><span className="text-white/40">Faturamento atual:</span> <span className="font-medium">R$ {Number(diag.faturamento_atual).toLocaleString('pt-BR')}</span></div>}
              {diag.meta_faturamento && <div><span className="text-white/40">Meta:</span> <span className="font-medium">R$ {Number(diag.meta_faturamento).toLocaleString('pt-BR')}</span></div>}
              {diag.outros_marketplaces && <div><span className="text-white/40">Outros marketplaces:</span> <span className="font-medium">{diag.outros_marketplaces}</span></div>}
            </div>
          </Section>
        )}

        {/* ── Resumo Geral ── */}
        <Section title="Resumo Geral">
          <p className="text-sm text-white/70 leading-relaxed">{resumo}</p>
        </Section>

        {/* ── Pontos Fortes ── */}
        {pontosFortes.length > 0 && (
          <Section title="Pontos Fortes Identificados" className="border-emerald-500/20">
            <ul className="space-y-1.5">
              {pontosFortes.map((p, i) => (
                <li key={i} className="text-sm text-white/70 flex items-start gap-2">
                  <span className="text-emerald-400 mt-0.5">✓</span> {p}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* ── Gargalos ── */}
        {gargalos.length > 0 && (
          <Section title="Principais Gargalos" className="border-red-500/20">
            <ul className="space-y-1.5">
              {gargalos.map((g, i) => (
                <li key={i} className="text-sm text-white/70 flex items-start gap-2">
                  <span className="text-red-400 mt-0.5">✗</span> {g}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* ── Melhorias Recomendadas ── */}
        {(recs.imediatas.length > 0 || recs.curtoPrazo.length > 0 || recs.escala.length > 0) && (
          <Section title="Melhorias Recomendadas">
            <div className="space-y-5">
              {recs.imediatas.length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#ef4444' }}>Ações imediatas</p>
                  <ul className="space-y-1">{recs.imediatas.map((a, i) => <li key={i} className="text-sm text-white/70 flex items-start gap-2"><span className="text-red-400 mt-0.5 shrink-0">▸</span>{a}</li>)}</ul>
                </div>
              )}
              {recs.curtoPrazo.length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#f59e0b' }}>Ações de curto prazo</p>
                  <ul className="space-y-1">{recs.curtoPrazo.map((a, i) => <li key={i} className="text-sm text-white/70 flex items-start gap-2"><span className="text-amber-400 mt-0.5 shrink-0">▸</span>{a}</li>)}</ul>
                </div>
              )}
              {recs.escala.length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#10b981' }}>Ações de escala</p>
                  <ul className="space-y-1">{recs.escala.map((a, i) => <li key={i} className="text-sm text-white/70 flex items-start gap-2"><span className="text-emerald-400 mt-0.5 shrink-0">▸</span>{a}</li>)}</ul>
                </div>
              )}
            </div>
          </Section>
        )}

        {/* ── Próximos Passos ── */}
        {nextSteps.length > 0 && (
          <Section title="Próximos Passos — Guia Prático">
            <div className="space-y-8">
              {nextSteps.map((step, i) => (
                <div key={i} className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
                  {/* Action header */}
                  <div className="px-5 py-4 border-b border-white/8 flex items-start gap-3">
                    <span className="w-7 h-7 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">{i + 1}</span>
                    <p className="text-sm font-semibold text-white">{step.action}</p>
                  </div>

                  <div className="px-5 py-4 space-y-5">
                    {/* Why */}
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-amber-400/80 mb-1.5">Por que isso é importante</p>
                      <p className="text-sm text-white/60 leading-relaxed">{step.why}</p>
                    </div>

                    {/* How to */}
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-blue-400/80 mb-2">Como executar</p>
                      <ul className="space-y-1.5">
                        {step.howTo.map((h, j) => (
                          <li key={j} className="text-sm text-white/60 flex items-start gap-2">
                            <span className="text-blue-400/60 mt-1 shrink-0 text-[10px]">●</span> {h}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Examples */}
                    {step.examples.length > 0 && (
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-400/80 mb-2">Exemplos práticos</p>
                        <div className="space-y-2">
                          {step.examples.map((ex, j) => (
                            <div key={j} className="text-sm text-white/50 bg-white/[0.03] rounded-lg px-4 py-2.5 border-l-2 border-emerald-500/30">
                              {ex}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Learn */}
                    {step.learn.length > 0 && (
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-wider text-purple-400/80 mb-2">Onde aprender mais</p>
                        <ul className="space-y-1.5">
                          {step.learn.map((l, j) => (
                            <li key={j} className="text-sm text-white/50 flex items-start gap-2">
                              <span className="text-purple-400/60 mt-0.5 shrink-0">📚</span> {l}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* ── Prioridades do consultor ── */}
        {(diag.principais_gargalos || diag.principais_oportunidades || diag.corrigir_imediatamente || diag.melhorar_medio_prazo || diag.gerar_faturamento_rapido) && (
          <Section title="Análise do Consultor">
            <div className="space-y-4 text-sm">
              {diag.principais_gargalos && <div><p className="text-xs font-semibold text-red-400 mb-1">Gargalos identificados:</p><p className="text-white/60">{diag.principais_gargalos}</p></div>}
              {diag.principais_oportunidades && <div><p className="text-xs font-semibold text-purple-400 mb-1">Oportunidades:</p><p className="text-white/60">{diag.principais_oportunidades}</p></div>}
              {diag.gerar_faturamento_rapido && <div><p className="text-xs font-semibold text-emerald-400 mb-1">Gerar faturamento rápido:</p><p className="text-white/60">{diag.gerar_faturamento_rapido}</p></div>}
            </div>
          </Section>
        )}

        {/* ── Observações finais ── */}
        {diag.observacoes_finais && (
          <Section title="Observações Finais">
            <p className="text-sm text-white/60 leading-relaxed">{diag.observacoes_finais}</p>
          </Section>
        )}

        {/* ── Footer ── */}
        <footer className="text-center py-10 border-t border-white/10">
          <p className="text-xs text-white/30">Diagnóstico gerado por <strong className="text-amber-400/50">Millennials Growth Marketing B2B</strong></p>
        </footer>
      </main>
    </div>
  );
}
