import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BackgroundPaths } from '@/components/ui/background-paths';
import { MgrowthLogo } from '@/components/ui/MgrowthLogo';
import {
  Download,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  TrendingUp,
  TrendingDown,
  Target,
  Zap,
  Shield,
  BarChart3,
  BookOpen,
  ListChecks,
  Clock,
  ArrowRight,
  MessageCircle,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  calcPaddockAreaScores,
  calcPaddockNotaGeral,
  calcPaddockPrioridade,
  generatePaddockReport,
  PADDOCK_AREAS,
  type PaddockDiagnosticoFormData,
  type PaddockAreaScore,
} from '@/hooks/usePaddockDiagnostico';

// ── Design system (same as WarRoom2Page) ──────────────────────────
const COLORS = {
  chaoFabrica: '#3A2E2C',
  farolCarga: '#FFD400',
  luzGalpao: '#F5F5DC',
  acoIndustrial: '#6B7A6F',
};

// ── Area colors ───────────────────────────────────────────────────
const AREA_COLORS: Record<string, string> = {
  execucao: '#3B82F6',    // blue
  crm: '#8B5CF6',         // purple
  abordagem: '#06B6D4',   // cyan
  qualificacao: '#F59E0B', // amber
  followup: '#22C55E',    // green
  conversao: '#EF4444',   // red
  disciplina: '#6366F1',  // indigo
};

const AREA_DESCRIPTIONS: Record<string, string> = {
  execucao: 'Volume de atividades diárias: ligações, tentativas de contato, consistência do time',
  crm: 'Uso correto do CRM: registro de interações, movimentação de leads, confiabilidade dos dados',
  abordagem: 'Primeiro contato com o lead: velocidade de resposta, ligação vs WhatsApp, técnica de abertura',
  qualificacao: 'Filtro de leads: uso do BANT (orçamento, decisor, necessidade, prazo), qualidade das reuniões',
  followup: 'Persistência no contato: quantidade de tentativas, cadência, personalização das mensagens',
  conversao: 'Fechamento de vendas: condução de reuniões, tratamento de objeções, proposta de valor',
  disciplina: 'Rotina e organização: metas individuais, consistência diária, processos do time',
};

const STATUS_COLORS = {
  saudavel: '#22C55E',
  atencao: '#F59E0B',
  critico: '#EF4444',
};

const STATUS_LABELS: Record<string, string> = {
  saudavel: 'Saudavel',
  atencao: 'Atencao',
  critico: 'Critico',
};

const PRIORITY_COLORS: Record<string, string> = {
  Baixa: '#22C55E',
  'Media': '#F59E0B',
  Alta: '#F97316',
  Urgente: '#EF4444',
};

// ── Inverted keys ─────────────────────────────────────────────────
const INVERTED_KEYS = new Set<string>([
  'exec_volume_caiu', 'exec_alguem_nao_performa', 'exec_leads_sem_atividade',
  'crm_leads_parados', 'crm_whatsapp_fora', 'crm_erros_status',
  'abord_comeca_whatsapp', 'abord_fala_mais_que_escuta',
  'qual_qualifica_ou_empurra', 'qual_perde_tempo_ruins',
  'follow_desiste_rapido',
  'conv_leads_somem', 'conv_objecao_recorrente', 'conv_quebra_expectativa',
  'erro_liga_pouco', 'erro_comeca_whatsapp', 'erro_nao_registra', 'erro_fala_mais',
  'erro_nao_investiga', 'erro_aceita_nao', 'erro_nao_agenda', 'erro_nao_segue',
]);

// ── Area detail (inline copy from hook) ──────────────────────────
const AREA_DETAIL: Record<string, {
  porQue: string;
  comoResolver: string;
  referenciaWar2: string;
  howTo: string[];
  examples: string[];
  learn: string[];
}> = {
  execucao: {
    porQue: 'O volume de atividades e a base matematica da operacao comercial B2B. A conta e simples: 100 tentativas de contato geram aproximadamente 20 conexoes efetivas (20%), que geram 8 conversas qualificadas (40%), que geram 3 reunioes agendadas (35%), que geram 1 proposta enviada. Se o vendedor faz 30 tentativas ao inves de 50, ele esta cortando pela metade o numero de reunioes possiveis. Nao e questao de talento — e matematica pura. Time que nao bate volume, nao bate meta.',
    comoResolver: 'A solucao e criar uma rotina blindada contra distracoes. O vendedor deve ter 2 blocos de ligacao por dia (manha e tarde) de 2 horas cada, com celular no silencioso, e-mail fechado e CRM aberto. O gestor deve monitorar o volume de cada vendedor no dashboard do CRM e cobrar diariamente. No final de cada dia, cada vendedor deve reportar: quantas tentativas fez, quantas conexoes conseguiu, quantas reunioes agendou.',
    referenciaWar2: 'Bloco 3.1 — Volume de atividades: a lei dos numeros. Tabela de metas minimas diarias (50 tentativas, 8 conexoes, 3 qualificados, 1 reuniao).',
    howTo: [
      'Passo 1: Definir horario fixo dos blocos de ligacao no calendario de TODOS os vendedores',
      'Passo 2: Configurar o CRM para mostrar o contador de atividades do dia no dashboard',
      'Passo 3: No inicio de cada dia, vendedor abre o CRM e checa atividades pendentes',
      'Passo 4: Durante o bloco, celular no silencioso, so CRM aberto, sem pausa para WhatsApp',
      'Passo 5: No final do dia, reportar volume no grupo da equipe: "Hoje: 52 tentativas, 12 conexoes, 2 reunioes"',
      'Passo 6: Gestor revisa o painel semanal e conversa individualmente com quem esta abaixo',
    ],
    examples: [
      'Antes: Vendedor comeca o dia no WhatsApp, faz 15 ligacoes aleatorias e reclama que nao tem resultado → Depois: Abre o CRM as 8:30, liga de forma sistematica por 2h, faz 30 tentativas so na manha',
      'Antes: Segunda-feira faz 60 atividades, terca faz 10 → Depois: Mantem entre 45-55 todos os dias da semana',
      'Antes: Gestor so descobre que vendedor nao esta ligando na reuniao semanal → Depois: Check diario de 2 minutos no dashboard identifica problema no mesmo dia',
      'Antes: Vendedor diz "nao tenho lead pra ligar" → Depois: Fila de leads no CRM e abastecida semanalmente, sempre tem no minimo 100 leads na fila',
    ],
    learn: [
      'Releia o Bloco 3.1 da War Room #2: "100 tentativas → 20 conexoes → 8 qualificados → 3 reunioes → 1 proposta"',
      'Livro recomendado: "Receita Previsivel" — Aaron Ross (Cap. sobre volume e processos de prospeccao)',
      'Referencia interna: tabela de metas minimas diarias entregue na War Room #2',
    ],
  },
  crm: {
    porQue: 'O CRM e o cerebro da operacao comercial. Se o CRM esta sujo, o gestor toma decisoes erradas, leads quentes se perdem, e o time trabalha no escuro. Um lead que nao foi movimentado no funil ha 5 dias e um lead que provavelmente ja comprou do concorrente. Lead sem registro de interacao e lead que ninguem sabe se foi contactado. E o pior erro: marcar como "Desqualificado" um lead que simplesmente nao atendeu — isso mata oportunidades reais antes de existirem.',
    comoResolver: 'A regra e: se nao esta no CRM, nao aconteceu. Toda ligacao, mensagem, e-mail e reuniao deve ser registrada em tempo real (nao no final do dia). O WhatsApp Business deve estar integrado ao CRM — conversas por fora nao contam. O gestor deve fazer uma limpeza semanal: leads parados ha mais de 7 dias sem atividade precisam ser reativados ou encerrados. Status devem ser corrigidos: lead que nao atendeu = "Tentativa de Contato", NAO "Desqualificado".',
    referenciaWar2: 'Bloco 2 — Apresentacao do CRM (Tour pelo sistema, Metricas, WhatsApp integrado). Especialmente a tabela de Status Correto no CRM.',
    howTo: [
      'Passo 1: Conectar o WhatsApp Business de cada vendedor no CRM (Configuracoes → Integracoes)',
      'Passo 2: Criar regra: apos CADA interacao, registrar no CRM com data, canal e resultado',
      'Passo 3: Todo lead deve ter proxima atividade agendada (nem que seja "ligar em 3 dias")',
      'Passo 4: Toda segunda-feira, gestor revisa funil: leads sem atividade ha 7+ dias = acao imediata',
      'Passo 5: Revisar e corrigir status errados (usar tabela da War #2 como referencia)',
      'Passo 6: Dashboard do CRM deve ser a primeira coisa que o gestor abre toda manha',
    ],
    examples: [
      'Antes: Vendedor fala com lead no WhatsApp pessoal, nao registra nada → colega liga pro mesmo lead e passa vergonha → Depois: Tudo no CRM, qualquer pessoa ve o historico completo',
      'Antes: Lead nao atendeu 2x → vendedor marca como "Desqualificado" → Depois: Marca como "Tentativa de Contato" e segue o ciclo de 5 tentativas',
      'Antes: Gestor pergunta "quantas reunioes marcamos?" e ninguem sabe → Depois: Dashboard mostra em tempo real: 12 reunioes na semana, 3 fechamentos',
      'Antes: 50 leads parados no funil ha 2 semanas sem ninguem tocar → Depois: Limpeza semanal, leads reativados ou encerrados, funil sempre limpo',
    ],
    learn: [
      'Releia o Bloco 2 da War Room #2: Tour pelo CRM e a tabela de Status Correto',
      'Regra fundamental: "Nunca atendeu" ≠ "Desqualificado". Sao etapas completamente diferentes',
      'Referencia: Passo a passo de integracao do WhatsApp dado na War Room #2 (Bloco 2.3)',
    ],
  },
  abordagem: {
    porQue: 'A abordagem inicial e a porta de entrada da venda. Lead novo que recebe ligacao em menos de 5 minutos tem 400% mais chance de conversao do que lead contactado apos 1 hora. Passaram 24 horas? O lead ja esfriou. E o maior erro que mata vendas antes de comecarem: comecar pelo WhatsApp ao inves de ligar. WhatsApp e facil de ignorar, nao permite qualificar em tempo real e cria uma falsa sensacao de "ja tentei". Ligacao e insubstituivel porque permite ouvir o tom do lead, fazer perguntas e conduzir a conversa.',
    comoResolver: 'A regra numero 1 e: lead entrou → ligacao em 5 minutos, sem excecao. A abertura deve ser estruturada (nome + empresa + motivo + permissao) mas soar natural, nao robotica. O vendedor deve fazer perguntas abertas (como, o que, me conta) e ESCUTAR. A regra e 70% escutando, 30% falando. Se o vendedor esta falando mais de 2 minutos seguidos, esta perdendo a ligacao.',
    referenciaWar2: 'Bloco 4 — Como Ligar de Verdade. Bloco 4.2 — Estrutura da ligacao perfeita (7 etapas). Scripts 1, 2 e 3.',
    howTo: [
      'Passo 1: Configurar alerta no CRM: lead entrou → notificacao imediata no celular do vendedor',
      'Passo 2: Vendedor para o que esta fazendo e liga em ate 5 minutos',
      'Passo 3: Usar abertura estruturada: "Oi [nome], aqui e [vendedor] da [empresa]. Vi que voce demonstrou interesse, quis ligar pessoalmente..."',
      'Passo 4: Pedir permissao: "Voce tem 2 minutinhos?"',
      'Passo 5: Fazer perguntas abertas: "Me conta, como funciona o comercial de voces hoje?"',
      'Passo 6: ESCUTAR a resposta. Anotar no CRM enquanto ouve.',
      'Passo 7: So depois de entender o cenario, conectar com a solucao',
    ],
    examples: [
      'Antes: Lead preenche formulario as 10h → vendedor ve as 16h → manda WhatsApp "Oi, vi seu interesse" → lead nao responde → Depois: Lead entra as 10h → ligacao as 10:03 → "Vi agora que voce se cadastrou, quis falar pessoalmente" → conversa de 3min → reuniao agendada',
      'Antes: "Oi, tudo bem? Eu sou da empresa X e a gente faz marketing digital, posso te apresentar?" → lead desliga → Depois: "Oi Joao, aqui e o Pedro da Millennials. Vi que voces estao expandindo a operacao comercial — me conta, qual o maior desafio hoje?" → conversa real',
      'Antes: Vendedor fala 4 minutos explicando o produto → lead fica em silencio → Depois: Vendedor faz 3 perguntas em 90 segundos → lead fala por 2 minutos → vendedor entende a dor e propoe reuniao',
    ],
    learn: [
      'Releia Scripts 1, 2 e 3 da War Room #2 — pratique em voz alta antes de ligar',
      'Bloco 4.1 da War Room #2: Postura e tom de voz (ficar de pe muda o tom!)',
      'Referencia: Estrutura da ligacao perfeita em 7 etapas (15s + 30s + 10s + 90s + 30s + 30s + 20s)',
    ],
  },
  qualificacao: {
    porQue: 'Qualificacao ruim e o maior desperdicio de tempo e energia do time comercial. Vendedor que nao qualifica empurra leads ruins para reuniao, gera frustracao no fechador, desperdica tempo de todo mundo e infla os numeros com reunioes que nunca vao fechar. O BANT (Budget, Authority, Need, Timeline) existe para separar oportunidades reais de curiosos. Se o lead nao tem orcamento, nao e o decisor, nao tem necessidade real ou nao tem prazo — NAO E QUALIFICADO.',
    comoResolver: 'Antes de marcar qualquer reuniao, o vendedor deve saber: 1) O lead tem orcamento ou previsao de investimento? 2) Esta falando com quem decide? 3) Tem dor real que a gente resolve? 4) Tem prazo para resolver? Minimo 3 de 4 criterios para avancar. E o erro mais grave: marcar como "Desqualificado" lead que nao atendeu. Lead que nao atendeu e "Tentativa de Contato" — sao coisas completamente diferentes.',
    referenciaWar2: 'Bloco 3.2 — Qualificacao de leads: BANT. Ponto critico sobre a diferenca entre "nao atendeu" e "desqualificado".',
    howTo: [
      'Passo 1: Antes de QUALQUER reuniao, vendedor preenche no CRM: Orcamento? Decisor? Necessidade? Prazo?',
      'Passo 2: Se responder "sim" para 3 de 4 → qualificado, pode agendar reuniao',
      'Passo 3: Se responder "sim" para 2 ou menos → manter em nutricao, nao agendar ainda',
      'Passo 4: Usar perguntas SPIN: Situacao ("como funciona hoje?"), Problema ("qual o maior desafio?"), Implicacao ("o que acontece se nao resolver?"), Necessidade ("se resolvesse, qual impacto?")',
      'Passo 5: Nunca perguntar direto "voce tem dinheiro?" — perguntar "voces ja investem em marketing digital hoje?"',
    ],
    examples: [
      'Antes: Vendedor marca reuniao com qualquer um que pareca interessado → 7 de 10 reunioes sao perda de tempo → Depois: So agenda com 3/4 BANT → 7 de 10 reunioes sao com decisores com dor real',
      'Antes: Lead diz "nao tenho interesse" → vendedor marca Desqualificado → Depois: Vendedor pergunta "entendo, o que te levou a se cadastrar?" → descobre que tem interesse mas timing ruim → agenda follow-up em 30 dias',
      'Antes: "Qual seu orcamento?" (lead desliga) → Depois: "Voces ja investem em alguma estrategia de marketing digital hoje? Quanto mais ou menos?" (conversa natural)',
    ],
    learn: [
      'Releia Bloco 3.2 da War Room #2: BANT completo com exemplos de perguntas',
      'Tabela de Status Correto: "Nunca atendeu = Tentativa de Contato, NAO Desqualificado"',
      'Livro: SPIN Selling — Neil Rackham (metodo de perguntas para qualificacao)',
    ],
  },
  followup: {
    porQue: '80% das vendas B2B acontecem entre a 5a e a 12a tentativa de contato. Mas a maioria dos vendedores desiste na 2a tentativa. Isso significa que o time esta literalmente jogando fora 80% das vendas possiveis por falta de persistencia. Follow-up nao e insistencia — e profissionalismo. O lead ja demonstrou interesse ao se cadastrar; o vendedor so precisa encontrar o momento certo. E cada follow-up deve agregar valor, nao repetir a mesma mensagem.',
    comoResolver: 'Implementar cadencia obrigatoria: Dia 1 (ligacao + WPP se nao atendeu), Dia 2 (ligacao + mensagem com valor), Dia 4 (ligacao + prova social), Dia 7 (ultima tentativa + mensagem de breakup), Dia 14 (reaquecimento leve). Minimo 5 tentativas antes de encerrar. Variar canal a cada tentativa. Cada mensagem deve ser diferente e personalizada. E leads antigos (30-60 dias) devem ser revisitados — muitos mudam de cenario.',
    referenciaWar2: 'Bloco 3.3 — Ciclo completo de follow-up (Dia 1, 2, 4, 7, 14). Scripts de WhatsApp 01, 02 e 03. As 3 regras de ouro da conducao.',
    howTo: [
      'Passo 1: Dia 1 — Lead entrou → ligar imediatamente. Se nao atendeu → WhatsApp (Script WPP 01 da War #2)',
      'Passo 2: Dia 2 — Nova ligacao + mensagem com informacao de valor sobre o mercado do lead',
      'Passo 3: Dia 4 — Ligacao + mensagem com caso de sucesso de cliente similar (Script WPP 02)',
      'Passo 4: Dia 7 — Ultima tentativa direta + mensagem de encerramento respeitosa (Script WPP 03)',
      'Passo 5: Dia 14 — Reaquecimento leve, sem pressao: "Passando pra ver se algo mudou"',
      'Passo 6: Apos 5 tentativas sem resposta → marcar como "Ciclo Encerrado", revisitar em 60 dias',
    ],
    examples: [
      'Antes: Vendedor liga 1x, manda WPP "Oi, vi seu interesse", nao responde, desiste → Depois: 5 tentativas em 14 dias, cada uma com abordagem diferente, resultado: 30% respondem entre a 3a e 5a tentativa',
      'Antes: "Oi, tudo bem? Queria saber se tem interesse" (mesma mensagem 3x) → Depois: "Joao, vi que a empresa X do mesmo segmento que voces gerou 47 leads em 15 dias com a gente. Vale 15min pra eu te mostrar como?"',
      'Antes: Lead respondeu "agora nao posso" → vendedor nunca mais liga → Depois: Agenda follow-up para 3 dias depois, liga e diz "lembra que conversamos? Arrumei um horario de 15min pra voce, amanha as 10h ou quarta as 15h?"',
    ],
    learn: [
      'Releia Scripts WPP 01, 02 e 03 da War Room #2 — sao templates prontos para copiar e adaptar',
      'Bloco 3.3: As 3 regras de ouro (todo lead com proxima acao, sempre agendar o proximo contato, nunca mandar a mesma mensagem duas vezes)',
      'Livro: "Receita Previsivel" — Aaron Ross (cadencia de prospeccao outbound)',
    ],
  },
  conversao: {
    porQue: 'Conversao e onde todo o trabalho anterior se transforma em resultado. Se o time gera leads, qualifica, faz follow-up, agenda reunioes — mas nao fecha, o problema pode estar em: conducao fraca da conversa, falta de proposta de valor clara, objecoes nao tratadas, ou quebra de expectativa entre o que o marketing promete e o que vendas entrega. Cada reuniao perdida e dinheiro gasto em marketing sem retorno.',
    comoResolver: 'Tres acoes concretas: 1) Mapear as 5 objecoes mais comuns e criar script de tratamento para cada uma. 2) Treinar conducao de conversa focada em valor usando SPIN (fazer o lead perceber sozinho que precisa da solucao). 3) Alinhar o discurso de vendas com o que o marketing comunica nos anuncios — se o lead espera uma coisa e ouve outra, nao fecha.',
    referenciaWar2: 'Bloco 3.4 — Metodo SPIN Selling. Bloco 4 — Como Ligar de Verdade (postura, estrutura, scripts).',
    howTo: [
      'Passo 1: Listar as 5 objecoes que mais aparecem (ex: "muito caro", "ja tenho fornecedor", "preciso pensar")',
      'Passo 2: Para cada objecao, criar resposta usando SPIN: transformar objecao em pergunta',
      'Passo 3: Treinar roleplay semanal: um vendedor faz o lead, outro tenta fechar',
      'Passo 4: Apos cada reuniao, registrar no CRM: "O que funcionou? O que travou? Proximo passo?"',
      'Passo 5: Revisar semanalmente o funil de conversao: onde esta o maior vazamento?',
    ],
    examples: [
      'Antes: Lead diz "ta caro" → vendedor da desconto → Depois: "Entendo a preocupacao com investimento. Me conta: quanto voces perdem por mes sem resolver esse problema? Se a gente resolver em 30 dias, quanto isso vale pra voces?"',
      'Antes: Marketing promete "50 leads por mes" → vendedor fala em "estrategia de marca" → lead fica confuso → Depois: Discurso alinhado: "Vamos gerar X leads qualificados com a estrategia Y, assim como fizemos para o cliente Z"',
      'Antes: Reuniao sem estrutura, vendedor improvisa 40 minutos → Depois: 5 minutos de rapport, 10 de diagnostico (SPIN), 10 de apresentacao de valor, 5 de agendamento de proximo passo',
    ],
    learn: [
      'Releia Bloco 3.4: SPIN Selling — Situacao, Problema, Implicacao, Necessidade',
      'Bloco 5 da War Room #2: Tabela de erros (NUNCA faca vs SEMPRE faca)',
      'Livro: SPIN Selling — Neil Rackham (Cap. sobre tratamento de objecoes)',
    ],
  },
  disciplina: {
    porQue: 'Disciplina e o que separa um SDR mediano de um top performer. Resultado em vendas B2B nao e dom, nao e carisma, nao e sorte — e rotina executada com consistencia TODOS os dias. Sem rotina clara, o vendedor improvisa: segunda liga bastante, terca responde e-mail, quarta faz reuniao, quinta nao faz nada, sexta "organiza". Essa aleatoriedade gera resultados imprevisiveis. Top performers fazem a mesma coisa, do mesmo jeito, todos os dias — e por isso entregam resultado previsivel.',
    comoResolver: 'Definir rotina diaria escrita e nao-negociavel: Manha (abrir CRM, checar pendencias, bloco de ligacoes 8:30-10:30), Tarde (follow-ups, registros, segundo bloco de ligacoes 14:00-16:00), Final do dia (atualizar pipeline, checar metas, reportar volume). Cada vendedor deve ter metas individuais claras e VISIVEIS — nao escondidas numa planilha. O gestor deve cobrar diariamente e reconhecer quem entrega.',
    referenciaWar2: 'Bloco 6 — Rotina Diaria do SDR (Manha, Ao longo do dia, Final do dia). Bloco 7 — Tarefas de Casa e Proximos Passos.',
    howTo: [
      'Passo 1: Escrever a rotina diaria em um documento de 1 pagina — horario por horario',
      'Passo 2: Cada vendedor imprime e cola ao lado do computador (sim, no papel)',
      'Passo 3: Definir metas individuais semanais: X tentativas, Y conexoes, Z reunioes',
      'Passo 4: Criar quadro visual (Notion, planilha ou quadro fisico) com meta vs realizado de cada um',
      'Passo 5: Check-in diario as 8:30: "o que fiz ontem, o que vou fazer hoje"',
      'Passo 6: Reconhecer publicamente quem bateu meta (mensagem no grupo, destaque na reuniao)',
    ],
    examples: [
      'Antes: Cada vendedor faz o que quer, na hora que quer → resultado oscila 50% semana a semana → Depois: Rotina padronizada, resultado varia no maximo 15%',
      'Antes: Gestor pergunta "como ta?" e vendedor diz "ta indo" → Depois: Dashboard mostra em tempo real: Joao esta em 78% da meta semanal, Maria em 112%',
      'Antes: Vendedor motivado na segunda, desanimado na quinta → Depois: Executa a rotina independente de motivacao, porque sabe que resultado e consequencia de volume',
      'Antes: Ninguem sabe a meta do mes → Depois: Meta escrita no quadro, cada vendedor sabe exatamente quanto falta',
    ],
    learn: [
      'Releia Bloco 6 da War Room #2: Rotina Diaria do SDR (Manha, Ao longo do dia, Final do dia)',
      'Releia Bloco 7: Tarefas de Casa — 5 tarefas obrigatorias ate a proxima War Room',
      'Livro: "O Poder do Habito" — Charles Duhigg (como criar rotinas que grudam)',
    ],
  },
};

const AREA_OBS_KEYS: Record<string, string> = {
  execucao: '',
  crm: 'crm_principal_erro',
  abordagem: 'abord_erro_ligacoes',
  qualificacao: 'qual_erro_qualificacao',
  followup: 'follow_erro_followup',
  conversao: 'conv_erro_conversao',
  disciplina: 'disc_falta_rotina',
};

// ── Question labels ───────────────────────────────────────────────
const QUESTION_LABELS: Record<string, string> = {
  exec_batendo_50: 'Time batendo 50+ atividades/dia',
  exec_consistencia_diaria: 'Consistencia diaria na execucao',
  exec_comeca_pelo_crm: 'Comeca o dia pelo CRM',
  exec_blocos_ligacao: 'Blocos de ligacao organizados',
  exec_volume_caiu: 'Volume de atividades caiu',
  exec_alguem_nao_performa: 'Alguem do time nao performa',
  exec_followup_diario: 'Follow-up diario acontecendo',
  exec_leads_sem_atividade: 'Leads sem atividade recente',
  crm_movimentacao_correta: 'Movimentacao correta no CRM',
  crm_leads_parados: 'Leads parados no funil',
  crm_registra_interacoes: 'Registra todas as interacoes',
  crm_historico_completo: 'Historico completo dos leads',
  crm_whatsapp_fora: 'Conversas de WhatsApp fora do CRM',
  crm_erros_status: 'Erros frequentes de status no funil',
  crm_funil_realidade: 'Funil reflete a realidade',
  crm_gestor_confia: 'Gestor confia nos dados do CRM',
  abord_liga_imediatamente: 'Liga imediatamente para novos leads',
  abord_tempo_resposta_5min: 'Tempo de resposta abaixo de 5 minutos',
  abord_comeca_whatsapp: 'Comeca abordagem pelo WhatsApp ao inves de ligar',
  abord_ligacoes_frequentes: 'Ligacoes frequentes e consistentes',
  abord_seguranca_falar: 'Seguranca ao falar com leads',
  abord_abertura_estruturada: 'Abertura de ligacao estruturada',
  abord_faz_perguntas: 'Faz perguntas estrategicas na abordagem',
  abord_fala_mais_que_escuta: 'Fala mais do que escuta nas ligacoes',
  qual_perguntas_cenario: 'Faz perguntas sobre cenario do lead',
  qual_dor_real: 'Identifica a dor real do lead',
  qual_fala_decisor: 'Fala com o decisor',
  qual_descobre_orcamento: 'Descobre orcamento disponivel',
  qual_entende_prazo: 'Entende o prazo de decisao',
  qual_qualifica_ou_empurra: 'Empurra lead ao inves de qualificar',
  qual_perde_tempo_ruins: 'Perde tempo com leads ruins',
  qual_diferencia_status: 'Diferencia status dos leads corretamente',
  follow_5_tentativas: 'Faz pelo menos 5 tentativas de contato',
  follow_multicanal: 'Follow-up multicanal (ligacao, WhatsApp, e-mail)',
  follow_personalizado: 'Follow-up personalizado por lead',
  follow_desiste_rapido: 'Desiste rapido dos leads',
  follow_padrao_dias: 'Padrao de dias entre follow-ups definido',
  follow_revisita_antigos: 'Revisita leads antigos',
  follow_registra_crm: 'Registra follow-ups no CRM',
  follow_disciplina: 'Disciplina consistente no follow-up',
  conv_agenda_reunioes: 'Agenda reunioes com frequencia',
  conv_reunioes_qualificadas: 'Reunioes agendadas sao qualificadas',
  conv_leads_somem: 'Leads somem apos a proposta',
  conv_objecao_recorrente: 'Objecoes recorrentes nao tratadas',
  conv_conduz_conversa: 'Conduz a conversa de fechamento',
  conv_valor_ou_preco: 'Vende valor ao inves de preco',
  conv_quebra_expectativa: 'Quebra de expectativa no fechamento',
  conv_inicio_ou_fechamento: 'Foca no inicio do funil e no fechamento',
  disc_rotina_clara: 'Rotina clara de trabalho',
  disc_metas_individuais: 'Metas individuais definidas',
  disc_mede_desempenho: 'Mede desempenho individual',
  disc_cobranca_gestor: 'Cobranca consistente do gestor',
  disc_executa_sem_motivacao: 'Executa mesmo sem motivacao',
  disc_consistencia: 'Consistencia na execucao semanal',
  disc_sabe_o_que_fazer: 'Sabe exatamente o que fazer cada dia',
  disc_organizacao: 'Organizacao pessoal do vendedor',
  erro_liga_pouco: 'Liga pouco para os leads',
  erro_comeca_whatsapp: 'Comeca pelo WhatsApp ao inves de ligar',
  erro_nao_registra: 'Nao registra atividades no CRM',
  erro_fala_mais: 'Fala mais do que escuta',
  erro_nao_investiga: 'Nao investiga a dor do lead',
  erro_aceita_nao: 'Aceita o "nao" facil demais',
  erro_nao_agenda: 'Nao agenda proximo passo',
  erro_nao_segue: 'Nao segue o processo definido',
  evol_melhorou: 'Melhorou no geral apos War #2',
  evol_gestor_percebe: 'Gestor percebe a evolucao',
  evol_aplicou: 'Aplicou o que aprendeu no War #2',
  evol_aumento_reunioes: 'Aumento no numero de reunioes',
  evol_qualidade_leads: 'Melhoria na qualidade dos leads',
  evol_mais_organizado: 'Vendedor mais organizado',
  evol_crm_limpo: 'CRM mais limpo e atualizado',
  evol_processo_claro: 'Processo comercial mais claro',
};

// ── Inline data fetching hook ─────────────────────────────────────
function usePublicPaddockDiagnostico(token: string) {
  return useQuery({
    queryKey: ['public-paddock-diagnostico', token],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('paddock_diagnosticos' as any)
        .select('*, clients:client_id(name, razao_social)')
        .eq('public_token', token)
        .eq('is_published', true)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!token,
  });
}

// ── Helper: get strengths & bottlenecks ───────────────────────────
function getStrengthsAndBottlenecks(data: any) {
  const strengths: string[] = [];
  const bottlenecks: string[] = [];

  for (const area of PADDOCK_AREAS) {
    for (const q of area.questions) {
      const val = data[q] as string | null;
      if (!val) continue;
      const inverted = INVERTED_KEYS.has(q);
      const label = QUESTION_LABELS[q] || q;

      if (inverted) {
        if (val === 'nao') strengths.push(label);
        else bottlenecks.push(label + (val === 'parcialmente' ? ' (parcial)' : ''));
      } else {
        if (val === 'sim') strengths.push(label);
        else bottlenecks.push(label + (val === 'parcialmente' ? ' (parcial)' : ''));
      }
    }
  }

  return { strengths, bottlenecks };
}

// ── Helper: get critical errors ───────────────────────────────────
function getCriticalErrors(data: any) {
  const errors: string[] = [];
  const erroKeys = [
    'erro_liga_pouco', 'erro_comeca_whatsapp', 'erro_nao_registra', 'erro_fala_mais',
    'erro_nao_investiga', 'erro_aceita_nao', 'erro_nao_agenda', 'erro_nao_segue',
  ];
  for (const q of erroKeys) {
    const val = data[q] as string | null;
    if (val === 'sim') errors.push(QUESTION_LABELS[q] || q);
    else if (val === 'parcialmente') errors.push((QUESTION_LABELS[q] || q) + ' (parcial)');
  }
  return errors;
}

// ── Helper: get evolution data ────────────────────────────────────
function getEvolutionData(data: any) {
  const evolKeys = [
    { key: 'evol_melhorou', label: 'Melhorou no geral' },
    { key: 'evol_gestor_percebe', label: 'Gestor percebe a evolucao' },
    { key: 'evol_aplicou', label: 'Aplicou o que aprendeu' },
    { key: 'evol_aumento_reunioes', label: 'Aumento no numero de reunioes' },
    { key: 'evol_qualidade_leads', label: 'Melhoria na qualidade dos leads' },
    { key: 'evol_mais_organizado', label: 'Vendedor mais organizado' },
    { key: 'evol_crm_limpo', label: 'CRM mais limpo e atualizado' },
    { key: 'evol_processo_claro', label: 'Processo comercial mais claro' },
  ];
  const improved: string[] = [];
  const notImproved: string[] = [];
  for (const e of evolKeys) {
    const val = data[e.key] as string | null;
    if (val === 'sim') improved.push(e.label);
    else if (val === 'parcialmente') improved.push(e.label + ' (parcial)');
    else if (val === 'nao') notImproved.push(e.label);
  }
  return { improved, notImproved };
}

// ── Helper: get recommendations ───────────────────────────────────
function getRecommendations(areas: PaddockAreaScore[]) {
  const recs: { area: string; areaKey: string; status: string; color: string; message: string }[] = [];
  for (const area of areas) {
    if (area.status === 'critico') {
      recs.push({
        area: area.label,
        areaKey: area.key,
        status: 'Critico',
        color: STATUS_COLORS.critico,
        message: `URGENTE: ${area.label} esta em estado critico. Priorizar correcao imediata.`,
      });
    } else if (area.status === 'atencao') {
      recs.push({
        area: area.label,
        areaKey: area.key,
        status: 'Atencao',
        color: STATUS_COLORS.atencao,
        message: `${area.label} precisa de ajustes. Trabalhar melhorias nesta semana.`,
      });
    } else {
      recs.push({
        area: area.label,
        areaKey: area.key,
        status: 'Saudavel',
        color: STATUS_COLORS.saudavel,
        message: `${area.label} esta funcionando bem. Manter e escalar.`,
      });
    }
  }
  return recs;
}

// ── Section wrapper ───────────────────────────────────────────────
function Section({ title, icon, children, delay = 0 }: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  delay?: number;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, delay }}
      className="mb-10"
    >
      <div className="flex items-center gap-3 mb-5">
        <div className="p-2 rounded-lg" style={{ backgroundColor: COLORS.farolCarga + '22' }}>
          {icon}
        </div>
        <h2 className="text-xl font-bold" style={{ color: COLORS.luzGalpao }}>{title}</h2>
      </div>
      {children}
    </motion.section>
  );
}

// ── Main Page ─────────────────────────────────────────────────────
export default function PublicPaddockDiagnosticoPage() {
  const { token } = useParams<{ token: string }>();
  const { data: rawData, isLoading, isError } = usePublicPaddockDiagnostico(token || '');

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center" style={{ backgroundColor: COLORS.chaoFabrica }}>
        <Loader2 className="w-10 h-10 animate-spin mb-4" style={{ color: COLORS.farolCarga }} />
        <p style={{ color: COLORS.luzGalpao }}>Carregando diagnostico...</p>
      </div>
    );
  }

  if (isError || !rawData) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center" style={{ backgroundColor: COLORS.chaoFabrica }}>
        <XCircle className="w-12 h-12 mb-4" style={{ color: '#EF4444' }} />
        <h1 className="text-xl font-bold mb-2" style={{ color: COLORS.luzGalpao }}>Diagnostico nao encontrado</h1>
        <p style={{ color: COLORS.acoIndustrial }}>O link pode estar incorreto ou o diagnostico nao foi publicado.</p>
      </div>
    );
  }

  const data = rawData as any;
  const clientName = data.clients?.razao_social || data.clients?.name || data.cliente_nome || 'Cliente';
  const areaScores = calcPaddockAreaScores(data as PaddockDiagnosticoFormData);
  const notaGeral = calcPaddockNotaGeral(areaScores);
  const prioridade = calcPaddockPrioridade(notaGeral);
  const prioColor = PRIORITY_COLORS[prioridade] || '#F59E0B';
  const { strengths, bottlenecks } = getStrengthsAndBottlenecks(data);
  const criticalErrors = getCriticalErrors(data);
  const { improved, notImproved } = getEvolutionData(data);
  const recommendations = getRecommendations(areaScores);

  return (
    <div className="min-h-screen relative" style={{ backgroundColor: COLORS.chaoFabrica }}>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; color: black !important; }
          * { color: black !important; background: white !important; border-color: #ccc !important; }
        }
      `}</style>

      {/* PDF Download Button */}
      <button
        onClick={() => window.print()}
        className="no-print fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-all hover:scale-105"
        style={{ backgroundColor: COLORS.farolCarga, color: COLORS.chaoFabrica }}
      >
        <Download className="w-4 h-4" />
        Baixar PDF
      </button>

      {/* ── HERO SECTION ────────────────────────────────────────── */}
      <div className="relative overflow-hidden">
        <BackgroundPaths />
        <div className="relative z-10 max-w-5xl mx-auto px-6 pt-16 pb-20 text-center">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <MgrowthLogo className="w-40 mx-auto mb-6" />
            <p className="text-sm font-semibold tracking-widest uppercase mb-2" style={{ color: COLORS.farolCarga }}>
              Diagnostico Comercial Pos War #2
            </p>
            <h1 className="text-4xl md:text-5xl font-black mb-4" style={{ color: COLORS.luzGalpao }}>
              {clientName}
            </h1>
            <div className="flex flex-wrap items-center justify-center gap-4 mb-6">
              {data.data_consultoria && (
                <span className="text-sm px-3 py-1 rounded-full" style={{ backgroundColor: COLORS.acoIndustrial + '33', color: COLORS.luzGalpao }}>
                  {data.data_consultoria}
                </span>
              )}
              {data.responsavel_diagnostico && (
                <span className="text-sm px-3 py-1 rounded-full" style={{ backgroundColor: COLORS.acoIndustrial + '33', color: COLORS.luzGalpao }}>
                  Consultor: {data.responsavel_diagnostico}
                </span>
              )}
            </div>
          </motion.div>

          {/* Overall score */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-col items-center"
          >
            <div
              className="w-32 h-32 rounded-full flex flex-col items-center justify-center border-4 mb-4"
              style={{
                borderColor: notaGeral >= 8 ? STATUS_COLORS.saudavel : notaGeral >= 5 ? STATUS_COLORS.atencao : STATUS_COLORS.critico,
                backgroundColor: COLORS.chaoFabrica + 'cc',
              }}
            >
              <span className="text-4xl font-black" style={{ color: COLORS.luzGalpao }}>{notaGeral}</span>
              <span className="text-xs" style={{ color: COLORS.acoIndustrial }}>/10</span>
            </div>
            <span
              className="text-sm font-bold px-4 py-1 rounded-full"
              style={{ backgroundColor: prioColor + '22', color: prioColor, border: `1px solid ${prioColor}44` }}
            >
              Prioridade: {prioridade}
            </span>
          </motion.div>
        </div>
      </div>

      {/* ── CONTENT ─────────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-6 pb-20">

        {/* ── RADAR CHART (CSS bars) ───────────────────────────── */}
        <Section title="Visao por Area" icon={<BarChart3 className="w-5 h-5" style={{ color: COLORS.farolCarga }} />} delay={0.1}>
          <div className="grid grid-cols-1 gap-3">
            {areaScores.map((area) => {
              const pct = (area.nota / 10) * 100;
              const areaColor = AREA_COLORS[area.key] || '#888';
              return (
                <div key={area.key} className="rounded-lg p-3" style={{ backgroundColor: '#ffffff08' }}>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="text-sm font-semibold" style={{ color: COLORS.luzGalpao }}>{area.label}</span>
                      {AREA_DESCRIPTIONS[area.key] && (
                        <p className="text-[10px] leading-tight" style={{ color: COLORS.acoIndustrial + 'bb' }}>{AREA_DESCRIPTIONS[area.key]}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-sm font-bold" style={{ color: areaColor }}>{area.nota}/10</span>
                      <span
                        className="text-xs px-2 py-0.5 rounded-full font-semibold"
                        style={{
                          backgroundColor: STATUS_COLORS[area.status] + '22',
                          color: STATUS_COLORS[area.status],
                        }}
                      >
                        {STATUS_LABELS[area.status]}
                      </span>
                    </div>
                  </div>
                  <div className="h-3 rounded-full overflow-hidden" style={{ backgroundColor: '#ffffff11' }}>
                    <motion.div
                      initial={{ width: 0 }}
                      whileInView={{ width: `${pct}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 1, delay: 0.2 }}
                      className="h-full rounded-full"
                      style={{ backgroundColor: areaColor }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Section>

        {/* ── 7 AREA SCORE CARDS ───────────────────────────────── */}
        <Section title="Detalhamento por Area" icon={<Target className="w-5 h-5" style={{ color: COLORS.farolCarga }} />} delay={0.15}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {areaScores.map((area, idx) => {
              const areaColor = AREA_COLORS[area.key] || '#888';
              const statusColor = STATUS_COLORS[area.status];
              const StatusIcon = area.status === 'saudavel' ? CheckCircle2 : area.status === 'atencao' ? AlertTriangle : XCircle;
              return (
                <motion.div
                  key={area.key}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: idx * 0.08 }}
                  className="rounded-xl p-5 border"
                  style={{ backgroundColor: '#ffffff08', borderColor: areaColor + '33' }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold" style={{ color: areaColor }}>{area.label}</h3>
                    <StatusIcon className="w-5 h-5" style={{ color: statusColor }} />
                  </div>
                  {AREA_DESCRIPTIONS[area.key] && (
                    <p className="text-[10px] leading-tight mb-3" style={{ color: COLORS.acoIndustrial + 'bb' }}>{AREA_DESCRIPTIONS[area.key]}</p>
                  )}
                  <div className="text-3xl font-black mb-1" style={{ color: COLORS.luzGalpao }}>
                    {area.nota}<span className="text-sm font-normal" style={{ color: COLORS.acoIndustrial }}>/10</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className="text-xs font-semibold px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: statusColor + '22', color: statusColor }}
                    >
                      {STATUS_LABELS[area.status]}
                    </span>
                    <span className="text-xs" style={{ color: COLORS.acoIndustrial }}>
                      {area.score}/{area.maxScore} pts
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </Section>

        {/* ── STRENGTHS ────────────────────────────────────────── */}
        {strengths.length > 0 && (
          <Section title="Pontos Fortes" icon={<CheckCircle2 className="w-5 h-5" style={{ color: '#22C55E' }} />} delay={0.2}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {strengths.map((s, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded-lg p-3"
                  style={{ backgroundColor: '#22C55E11' }}
                >
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: '#22C55E' }} />
                  <span className="text-sm" style={{ color: COLORS.luzGalpao }}>{s}</span>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* ── BOTTLENECKS ──────────────────────────────────────── */}
        {bottlenecks.length > 0 && (
          <Section title="Principais Gargalos" icon={<AlertTriangle className="w-5 h-5" style={{ color: '#F59E0B' }} />} delay={0.25}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {bottlenecks.map((b, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded-lg p-3"
                  style={{ backgroundColor: '#EF444411' }}
                >
                  <XCircle className="w-4 h-4 flex-shrink-0" style={{ color: '#EF4444' }} />
                  <span className="text-sm" style={{ color: COLORS.luzGalpao }}>{b}</span>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* ── EVOLUTION ────────────────────────────────────────── */}
        {(improved.length > 0 || notImproved.length > 0) && (
          <Section title="Evolucao Pos War #2" icon={<TrendingUp className="w-5 h-5" style={{ color: COLORS.farolCarga }} />} delay={0.3}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {improved.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: '#22C55E' }}>
                    <TrendingUp className="w-4 h-4" /> O que melhorou
                  </h3>
                  <div className="space-y-2">
                    {improved.map((item, i) => (
                      <div key={i} className="flex items-center gap-2 rounded-lg p-2" style={{ backgroundColor: '#22C55E11' }}>
                        <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: '#22C55E' }} />
                        <span className="text-sm" style={{ color: COLORS.luzGalpao }}>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {notImproved.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: '#EF4444' }}>
                    <TrendingDown className="w-4 h-4" /> O que nao melhorou
                  </h3>
                  <div className="space-y-2">
                    {notImproved.map((item, i) => (
                      <div key={i} className="flex items-center gap-2 rounded-lg p-2" style={{ backgroundColor: '#EF444411' }}>
                        <XCircle className="w-4 h-4 flex-shrink-0" style={{ color: '#EF4444' }} />
                        <span className="text-sm" style={{ color: COLORS.luzGalpao }}>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {data.evol_o_que_melhorou?.trim() && (
              <div className="mt-4 rounded-lg p-4" style={{ backgroundColor: '#ffffff08' }}>
                <p className="text-xs font-semibold mb-1" style={{ color: COLORS.farolCarga }}>Detalhes do que melhorou:</p>
                <p className="text-sm" style={{ color: COLORS.luzGalpao }}>{data.evol_o_que_melhorou}</p>
              </div>
            )}
            {data.evol_o_que_nao_melhorou?.trim() && (
              <div className="mt-3 rounded-lg p-4" style={{ backgroundColor: '#ffffff08' }}>
                <p className="text-xs font-semibold mb-1" style={{ color: '#EF4444' }}>Detalhes do que nao melhorou:</p>
                <p className="text-sm" style={{ color: COLORS.luzGalpao }}>{data.evol_o_que_nao_melhorou}</p>
              </div>
            )}
          </Section>
        )}

        {/* ── CRITICAL ERRORS ──────────────────────────────────── */}
        {criticalErrors.length > 0 && (
          <Section title="Erros Criticos Detectados" icon={<Zap className="w-5 h-5" style={{ color: '#EF4444' }} />} delay={0.35}>
            <div className="space-y-2">
              {criticalErrors.map((err, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded-lg p-3 border"
                  style={{ backgroundColor: '#EF444411', borderColor: '#EF444433' }}
                >
                  <Zap className="w-4 h-4 flex-shrink-0" style={{ color: '#EF4444' }} />
                  <span className="text-sm" style={{ color: COLORS.luzGalpao }}>{err}</span>
                </div>
              ))}
            </div>
            {data.erro_mais_prejudica?.trim() && (
              <div className="mt-4 rounded-lg p-4 border" style={{ backgroundColor: '#EF444411', borderColor: '#EF444433' }}>
                <p className="text-xs font-semibold mb-1" style={{ color: '#EF4444' }}>Erro que mais prejudica:</p>
                <p className="text-sm" style={{ color: COLORS.luzGalpao }}>{data.erro_mais_prejudica}</p>
              </div>
            )}
          </Section>
        )}

        {/* ── ACTION PLAN ──────────────────────────────────────── */}
        {(data.evol_top3_gargalos?.trim() || data.evol_top3_acoes?.trim()) && (
          <Section title="Plano de Acao" icon={<Target className="w-5 h-5" style={{ color: COLORS.farolCarga }} />} delay={0.4}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {data.evol_top3_gargalos?.trim() && (
                <div className="rounded-xl p-5 border" style={{ backgroundColor: '#ffffff08', borderColor: '#EF444433' }}>
                  <h3 className="text-sm font-bold mb-3 flex items-center gap-2" style={{ color: '#EF4444' }}>
                    <AlertTriangle className="w-4 h-4" /> Top 3 Gargalos
                  </h3>
                  <p className="text-sm whitespace-pre-wrap" style={{ color: COLORS.luzGalpao }}>{data.evol_top3_gargalos}</p>
                </div>
              )}
              {data.evol_top3_acoes?.trim() && (
                <div className="rounded-xl p-5 border" style={{ backgroundColor: '#ffffff08', borderColor: '#22C55E33' }}>
                  <h3 className="text-sm font-bold mb-3 flex items-center gap-2" style={{ color: '#22C55E' }}>
                    <CheckCircle2 className="w-4 h-4" /> Top 3 Acoes
                  </h3>
                  <p className="text-sm whitespace-pre-wrap" style={{ color: COLORS.luzGalpao }}>{data.evol_top3_acoes}</p>
                </div>
              )}
            </div>
          </Section>
        )}

        {/* ── RECOMMENDATIONS ──────────────────────────────────── */}
        <Section title="Recomendacoes por Area" icon={<Shield className="w-5 h-5" style={{ color: COLORS.farolCarga }} />} delay={0.45}>
          <div className="space-y-3">
            {recommendations.map((rec, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.06 }}
                className="flex items-start gap-3 rounded-lg p-4 border"
                style={{ backgroundColor: '#ffffff08', borderColor: rec.color + '33' }}
              >
                <span
                  className="text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5"
                  style={{ backgroundColor: rec.color + '22', color: rec.color }}
                >
                  {rec.status}
                </span>
                <div>
                  <span className="text-sm font-semibold" style={{ color: COLORS.luzGalpao }}>{rec.area}</span>
                  {rec.areaKey && AREA_DESCRIPTIONS[rec.areaKey] && (
                    <p className="text-xs mt-0.5" style={{ color: COLORS.acoIndustrial + 'cc' }}>{AREA_DESCRIPTIONS[rec.areaKey]}</p>
                  )}
                  <p className="text-sm mt-1" style={{ color: COLORS.acoIndustrial }}>{rec.message}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </Section>

        {/* ── DETAILED ANALYSIS PER AREA ─────────────────────── */}
        <Section title="Analise Detalhada por Area" icon={<BookOpen className="w-5 h-5" style={{ color: COLORS.farolCarga }} />} delay={0.5}>
          <div className="space-y-4">
            {areaScores.map((area, idx) => {
              const detail = AREA_DETAIL[area.key];
              if (!detail) return null;
              const areaColor = AREA_COLORS[area.key] || '#888';
              const statusColor = STATUS_COLORS[area.status];
              const obsKey = AREA_OBS_KEYS[area.key];
              const obsValue = obsKey ? (data[obsKey] as string | null) : null;
              return (
                <motion.div
                  key={area.key}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: idx * 0.08 }}
                  className="rounded-xl p-5 border"
                  style={{ backgroundColor: '#ffffff08', borderColor: areaColor + '33' }}
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold" style={{ color: areaColor }}>{area.label}</h3>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-black" style={{ color: COLORS.luzGalpao }}>{area.nota}</span>
                      <span className="text-sm" style={{ color: COLORS.acoIndustrial }}>/10</span>
                      <span
                        className="text-xs font-semibold px-2 py-0.5 rounded-full ml-2"
                        style={{ backgroundColor: statusColor + '22', color: statusColor }}
                      >
                        {STATUS_LABELS[area.status]}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="rounded-lg p-3" style={{ backgroundColor: '#ffffff06' }}>
                      <p className="text-xs font-bold mb-1" style={{ color: COLORS.farolCarga }}>Por que isso importa:</p>
                      <p className="text-sm" style={{ color: COLORS.luzGalpao }}>{detail.porQue}</p>
                    </div>
                    <div className="rounded-lg p-3" style={{ backgroundColor: '#ffffff06' }}>
                      <p className="text-xs font-bold mb-1" style={{ color: '#22C55E' }}>Como resolver:</p>
                      <p className="text-sm" style={{ color: COLORS.luzGalpao }}>{detail.comoResolver}</p>
                    </div>
                    <div className="rounded-lg p-3" style={{ backgroundColor: '#ffffff06' }}>
                      <p className="text-xs font-bold mb-1" style={{ color: '#8B5CF6' }}>Referencia War Room #2:</p>
                      <p className="text-sm" style={{ color: COLORS.luzGalpao }}>{detail.referenciaWar2}</p>
                    </div>

                    {/* How To - Step by step */}
                    {detail.howTo && detail.howTo.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.4, delay: 0.1 }}
                        className="rounded-lg p-4 border"
                        style={{ backgroundColor: COLORS.farolCarga + '08', borderColor: COLORS.farolCarga + '33' }}
                      >
                        <p className="text-xs font-bold mb-3 flex items-center gap-2" style={{ color: COLORS.farolCarga }}>
                          <ListChecks className="w-4 h-4" /> Como resolver (passo a passo):
                        </p>
                        <div className="space-y-2">
                          {detail.howTo.map((step, si) => (
                            <motion.div
                              key={si}
                              initial={{ opacity: 0, x: -10 }}
                              whileInView={{ opacity: 1, x: 0 }}
                              viewport={{ once: true }}
                              transition={{ duration: 0.3, delay: si * 0.05 }}
                              className="flex items-start gap-3"
                            >
                              <div
                                className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold mt-0.5"
                                style={{ backgroundColor: COLORS.farolCarga + '22', color: COLORS.farolCarga, border: `1px solid ${COLORS.farolCarga}44` }}
                              >
                                {si + 1}
                              </div>
                              <p className="text-sm" style={{ color: COLORS.luzGalpao }}>{step.replace(/^Passo \d+:\s*/, '')}</p>
                            </motion.div>
                          ))}
                        </div>
                      </motion.div>
                    )}

                    {/* Examples - Before/After */}
                    {detail.examples && detail.examples.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.4, delay: 0.2 }}
                        className="rounded-lg p-4 border"
                        style={{ backgroundColor: '#06B6D408', borderColor: '#06B6D433' }}
                      >
                        <p className="text-xs font-bold mb-3 flex items-center gap-2" style={{ color: '#06B6D4' }}>
                          <ArrowRight className="w-4 h-4" /> Exemplos praticos:
                        </p>
                        <div className="space-y-3">
                          {detail.examples.map((example, ei) => {
                            const parts = example.split(' → Depois: ');
                            const beforeText = parts[0]?.replace(/^Antes:\s*/, '') || example;
                            const afterText = parts[1] || '';
                            return (
                              <motion.div
                                key={ei}
                                initial={{ opacity: 0, y: 8 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.3, delay: ei * 0.06 }}
                                className="rounded-lg overflow-hidden border"
                                style={{ borderColor: '#ffffff11' }}
                              >
                                <div className="p-3" style={{ backgroundColor: '#EF444412' }}>
                                  <p className="text-xs font-bold mb-1" style={{ color: '#EF4444' }}>Antes:</p>
                                  <p className="text-sm" style={{ color: COLORS.luzGalpao }}>{beforeText}</p>
                                </div>
                                {afterText && (
                                  <div className="p-3" style={{ backgroundColor: '#22C55E12' }}>
                                    <p className="text-xs font-bold mb-1" style={{ color: '#22C55E' }}>Depois:</p>
                                    <p className="text-sm" style={{ color: COLORS.luzGalpao }}>{afterText}</p>
                                  </div>
                                )}
                              </motion.div>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}

                    {/* Learn - References */}
                    {detail.learn && detail.learn.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.4, delay: 0.3 }}
                        className="rounded-lg p-4 border"
                        style={{ backgroundColor: '#8B5CF608', borderColor: '#8B5CF633' }}
                      >
                        <p className="text-xs font-bold mb-3 flex items-center gap-2" style={{ color: '#8B5CF6' }}>
                          <BookOpen className="w-4 h-4" /> Material de referencia:
                        </p>
                        <div className="space-y-2">
                          {detail.learn.map((item, li) => (
                            <motion.div
                              key={li}
                              initial={{ opacity: 0, x: -8 }}
                              whileInView={{ opacity: 1, x: 0 }}
                              viewport={{ once: true }}
                              transition={{ duration: 0.3, delay: li * 0.05 }}
                              className="flex items-start gap-2 rounded-lg p-2"
                              style={{ backgroundColor: '#8B5CF60a' }}
                            >
                              <BookOpen className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: '#8B5CF6' }} />
                              <p className="text-sm" style={{ color: COLORS.luzGalpao }}>{item}</p>
                            </motion.div>
                          ))}
                        </div>
                      </motion.div>
                    )}

                    {obsValue?.trim() && (
                      <div className="rounded-lg p-3 border" style={{ backgroundColor: '#F59E0B11', borderColor: '#F59E0B33' }}>
                        <p className="text-xs font-bold mb-1 flex items-center gap-1" style={{ color: '#F59E0B' }}>
                          <MessageCircle className="w-3 h-3" /> Observacao do consultor:
                        </p>
                        <p className="text-sm" style={{ color: COLORS.luzGalpao }}>{obsValue}</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </Section>

        {/* ── ERRORS FROM WAR #2 THAT PERSIST ─────────────────── */}
        {criticalErrors.length > 0 && (
          <Section title="Erros da War #2 que Continuam" icon={<Zap className="w-5 h-5" style={{ color: '#EF4444' }} />} delay={0.55}>
            <div className="rounded-xl p-5 border" style={{ backgroundColor: '#EF444409', borderColor: '#EF444433' }}>
              <p className="text-sm mb-4" style={{ color: COLORS.acoIndustrial }}>
                Os seguintes erros identificados no Bloco 8 da War Room #2 ainda persistem na operacao:
              </p>
              <div className="space-y-2 mb-4">
                {criticalErrors.map((err, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 rounded-lg p-3"
                    style={{ backgroundColor: '#EF444411' }}
                  >
                    <Zap className="w-4 h-4 flex-shrink-0" style={{ color: '#EF4444' }} />
                    <span className="text-sm" style={{ color: COLORS.luzGalpao }}>{err}</span>
                  </div>
                ))}
              </div>
              {data.erro_mais_prejudica?.trim() && (
                <div className="rounded-lg p-4 border-2" style={{ backgroundColor: '#EF444418', borderColor: '#EF4444' }}>
                  <p className="text-xs font-bold mb-1 flex items-center gap-1" style={{ color: '#EF4444' }}>
                    <AlertTriangle className="w-3 h-3" /> Erro que MAIS prejudica a operacao:
                  </p>
                  <p className="text-sm font-semibold" style={{ color: COLORS.luzGalpao }}>{data.erro_mais_prejudica}</p>
                </div>
              )}
            </div>
          </Section>
        )}

        {/* ── STRUCTURED ACTION PLAN ──────────────────────────── */}
        <Section title="Plano de Acao Estruturado" icon={<ListChecks className="w-5 h-5" style={{ color: COLORS.farolCarga }} />} delay={0.6}>
          {(() => {
            const criticalAreas = areaScores.filter(a => a.status === 'critico');
            const attentionAreas = areaScores.filter(a => a.status === 'atencao');
            const healthyAreas = areaScores.filter(a => a.status === 'saudavel');
            return (
              <div className="space-y-6">
                {/* Immediate actions (48h) */}
                {criticalAreas.length > 0 && (
                  <div className="rounded-xl p-5 border" style={{ backgroundColor: '#EF444409', borderColor: '#EF444433' }}>
                    <h3 className="text-sm font-bold mb-3 flex items-center gap-2" style={{ color: '#EF4444' }}>
                      <Clock className="w-4 h-4" /> Acoes Imediatas (48h)
                    </h3>
                    <div className="space-y-3">
                      {criticalAreas.map((area) => {
                        const detail = AREA_DETAIL[area.key];
                        return (
                          <div key={area.key} className="flex items-start gap-3 rounded-lg p-3" style={{ backgroundColor: '#EF444411' }}>
                            <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: '#EF4444' }} />
                            <div>
                              <p className="text-sm font-semibold" style={{ color: COLORS.luzGalpao }}>{area.label} ({area.nota}/10)</p>
                              {detail && <p className="text-xs mt-1" style={{ color: COLORS.acoIndustrial }}>{detail.comoResolver}</p>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Short-term actions (1-2 weeks) */}
                {attentionAreas.length > 0 && (
                  <div className="rounded-xl p-5 border" style={{ backgroundColor: '#F59E0B09', borderColor: '#F59E0B33' }}>
                    <h3 className="text-sm font-bold mb-3 flex items-center gap-2" style={{ color: '#F59E0B' }}>
                      <Clock className="w-4 h-4" /> Acoes de Curto Prazo (1-2 semanas)
                    </h3>
                    <div className="space-y-3">
                      {attentionAreas.map((area) => {
                        const detail = AREA_DETAIL[area.key];
                        return (
                          <div key={area.key} className="flex items-start gap-3 rounded-lg p-3" style={{ backgroundColor: '#F59E0B11' }}>
                            <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: '#F59E0B' }} />
                            <div>
                              <p className="text-sm font-semibold" style={{ color: COLORS.luzGalpao }}>{area.label} ({area.nota}/10)</p>
                              {detail && <p className="text-xs mt-1" style={{ color: COLORS.acoIndustrial }}>{detail.comoResolver}</p>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Scale actions */}
                {healthyAreas.length > 0 && (
                  <div className="rounded-xl p-5 border" style={{ backgroundColor: '#22C55E09', borderColor: '#22C55E33' }}>
                    <h3 className="text-sm font-bold mb-3 flex items-center gap-2" style={{ color: '#22C55E' }}>
                      <TrendingUp className="w-4 h-4" /> Acoes de Escala
                    </h3>
                    <div className="space-y-3">
                      {healthyAreas.map((area) => (
                        <div key={area.key} className="flex items-start gap-3 rounded-lg p-3" style={{ backgroundColor: '#22C55E11' }}>
                          <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: '#22C55E' }} />
                          <div>
                            <p className="text-sm font-semibold" style={{ color: COLORS.luzGalpao }}>{area.label} ({area.nota}/10)</p>
                            <p className="text-xs mt-1" style={{ color: COLORS.acoIndustrial }}>Manter e escalar boas praticas. Usar como referencia para outras areas.</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </Section>

        {/* ── NEXT STEPS ──────────────────────────────────────── */}
        <Section title="Proximos Passos" icon={<ArrowRight className="w-5 h-5" style={{ color: COLORS.farolCarga }} />} delay={0.65}>
          <div className="space-y-3">
            {(() => {
              const criticalAreas = areaScores.filter(a => a.status === 'critico');
              const attentionAreas = areaScores.filter(a => a.status === 'atencao');
              const steps: { step: number; text: string; color: string; show: boolean }[] = [
                {
                  step: 1,
                  text: `Corrigir ${criticalAreas.map(a => a.label).join(', ')} — Prazo: 48h para primeiras acoes`,
                  color: '#EF4444',
                  show: criticalAreas.length > 0,
                },
                {
                  step: 2,
                  text: 'Reforcar treinamento — Acao: Roleplay individual com cada vendedor',
                  color: '#F59E0B',
                  show: criticalAreas.length > 0,
                },
                {
                  step: 3,
                  text: 'Eliminar erros da War #2 — Acao: Revisao individual de cada erro persistente',
                  color: '#EF4444',
                  show: criticalErrors.length > 0,
                },
                {
                  step: 4,
                  text: `Monitorar ${attentionAreas.map(a => a.label).join(', ')} — Prazo: 7 dias`,
                  color: '#F59E0B',
                  show: attentionAreas.length > 0,
                },
                {
                  step: 5,
                  text: 'Agendar War Room #3 — Prazo: 15 dias',
                  color: COLORS.farolCarga,
                  show: true,
                },
                {
                  step: 6,
                  text: 'Refazer diagnostico em 30 dias',
                  color: COLORS.farolCarga,
                  show: true,
                },
              ];
              const visibleSteps = steps.filter(s => s.show);
              return visibleSteps.map((s, i) => (
                <motion.div
                  key={s.step}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.08 }}
                  className="flex items-start gap-4 rounded-lg p-4 border"
                  style={{ backgroundColor: '#ffffff08', borderColor: s.color + '33' }}
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm"
                    style={{ backgroundColor: s.color + '22', color: s.color, border: `1px solid ${s.color}44` }}
                  >
                    {i + 1}
                  </div>
                  <p className="text-sm pt-1" style={{ color: COLORS.luzGalpao }}>{s.text}</p>
                </motion.div>
              ));
            })()}
          </div>
        </Section>

        {/* ── TOP 3 BOTTLENECKS AND ACTIONS ───────────────────── */}
        {(data.evol_top3_gargalos?.trim() || data.evol_top3_acoes?.trim()) && (
          <Section title="Top 3 Gargalos e Acoes" icon={<Target className="w-5 h-5" style={{ color: COLORS.farolCarga }} />} delay={0.7}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {data.evol_top3_gargalos?.trim() && (
                <div className="rounded-xl p-5 border" style={{ backgroundColor: '#ffffff08', borderColor: '#EF444433' }}>
                  <h3 className="text-sm font-bold mb-3 flex items-center gap-2" style={{ color: '#EF4444' }}>
                    <AlertTriangle className="w-4 h-4" /> Top 3 Gargalos
                  </h3>
                  <p className="text-sm whitespace-pre-wrap" style={{ color: COLORS.luzGalpao }}>{data.evol_top3_gargalos}</p>
                </div>
              )}
              {data.evol_top3_acoes?.trim() && (
                <div className="rounded-xl p-5 border" style={{ backgroundColor: '#ffffff08', borderColor: '#22C55E33' }}>
                  <h3 className="text-sm font-bold mb-3 flex items-center gap-2" style={{ color: '#22C55E' }}>
                    <CheckCircle2 className="w-4 h-4" /> Top 3 Acoes
                  </h3>
                  <p className="text-sm whitespace-pre-wrap" style={{ color: COLORS.luzGalpao }}>{data.evol_top3_acoes}</p>
                </div>
              )}
            </div>
          </Section>
        )}

        {/* ── OBSERVATIONS ─────────────────────────────────────── */}
        {data.observacoes_finais?.trim() && (
          <Section title="Observacoes do Consultor" icon={<BarChart3 className="w-5 h-5" style={{ color: COLORS.farolCarga }} />} delay={0.5}>
            <div className="rounded-xl p-5" style={{ backgroundColor: '#ffffff08' }}>
              <p className="text-sm whitespace-pre-wrap" style={{ color: COLORS.luzGalpao }}>{data.observacoes_finais}</p>
            </div>
          </Section>
        )}

        {/* ── FOOTER ───────────────────────────────────────────── */}
        <motion.footer
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="mt-16 pt-8 border-t text-center"
          style={{ borderColor: COLORS.acoIndustrial + '33' }}
        >
          <MgrowthLogo className="w-28 mx-auto mb-4 opacity-60" />
          <p className="text-xs" style={{ color: COLORS.acoIndustrial }}>
            Diagnostico gerado pela plataforma Millennials Growth
          </p>
          <p className="text-xs mt-1" style={{ color: COLORS.acoIndustrial + '88' }}>
            Este documento e confidencial e destinado exclusivamente ao cliente.
          </p>
        </motion.footer>
      </div>
    </div>
  );
}
