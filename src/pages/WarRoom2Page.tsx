import { motion } from 'framer-motion';
import { BackgroundPaths } from '@/components/ui/background-paths';
import { GlowingEffect } from '@/components/ui/glowing-effect';
import { MgrowthLogo } from '@/components/ui/MgrowthLogo';
import {
  BookOpen,
  Clock,
  Target,
  Monitor,
  BarChart3,
  Users,
  Phone,
  MessageSquare,
  Zap,
  CheckCircle2,
  AlertTriangle,
  ArrowDown,
  FileText,
  Download,
  Smartphone,
  XCircle,
  CircleCheck,
  Calendar,
  Repeat,
  Search,
  Lightbulb,
  ListChecks,
} from 'lucide-react';

const COLORS = {
  chaoFabrica: '#3A2E2C',
  farolCarga: '#FFD400',
  luzGalpao: '#F5F5DC',
  acoIndustrial: '#6B7A6F',
};

export default function WarRoom2Page() {
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
        className="fixed top-6 right-6 z-50 flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm no-print transition-all hover:scale-105"
        style={{ backgroundColor: COLORS.farolCarga, color: COLORS.chaoFabrica }}
      >
        <Download size={16} />
        Baixar PDF
      </button>

      {/* ── Hero Section ── */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <BackgroundPaths />
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(ellipse at center, ${COLORS.chaoFabrica}00 0%, ${COLORS.chaoFabrica} 70%)`,
          }}
        />
        <div className="relative z-10 container mx-auto px-4 py-20 text-center">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-8"
          >
            <MgrowthLogo className="h-16 md:h-20 mx-auto text-[#F5F5DC]" />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-8"
            style={{
              backgroundColor: `${COLORS.farolCarga}20`,
              border: `1px solid ${COLORS.farolCarga}40`,
            }}
          >
            <Zap className="w-4 h-4" style={{ color: COLORS.farolCarga }} />
            <span style={{ color: COLORS.farolCarga }} className="text-sm font-medium">
              DOCUMENTO INTERNO
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6"
          >
            <span style={{ color: COLORS.luzGalpao }}>WAR ROOM </span>
            <span style={{ color: COLORS.farolCarga }}>#2</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-lg md:text-xl max-w-2xl mx-auto mb-12"
            style={{ color: COLORS.acoIndustrial }}
          >
            Treinamento para SDRs
          </motion.p>

          {/* Info Cards */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="grid md:grid-cols-3 gap-4 max-w-4xl mx-auto"
          >
            {[
              { icon: Clock, label: 'Duração total', value: '~2h40' },
              { icon: BookOpen, label: 'Materiais necessários', value: 'CRM configurado, acesso WhatsApp Business, caderno para anotações' },
              { icon: Target, label: 'Objetivo', value: 'Sair da reunião com o SDR 100% apto a operar — CRM dominado, técnica afiada, scripts prontos e rotina definida.' },
            ].map((card, i) => (
              <div key={i} className="relative rounded-2xl border border-yellow-500/30 bg-gradient-to-br from-yellow-600/10 to-yellow-800/10 p-6" style={{ backgroundColor: `${COLORS.chaoFabrica}ee` }}>
                <GlowingEffect spread={40} glow={false} borderWidth={1} />
                <card.icon className="w-8 h-8 mb-3" style={{ color: COLORS.farolCarga }} />
                <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: COLORS.acoIndustrial }}>{card.label}</p>
                <p className="text-sm font-medium" style={{ color: COLORS.luzGalpao }}>{card.value}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Main Content ── */}
      <div className="max-w-5xl mx-auto px-4 py-16 space-y-12">

        {/* ════════════════════════════════════════════
            BLOCO 1 — ABERTURA (10 min)
        ════════════════════════════════════════════ */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative rounded-2xl border border-yellow-500/30 bg-gradient-to-br from-yellow-600/10 to-yellow-800/10 overflow-hidden"
          style={{ backgroundColor: `${COLORS.chaoFabrica}ee` }}
        >
          <GlowingEffect spread={60} glow={false} borderWidth={1} />
          <div className="p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-yellow-500/20 to-yellow-700/20 flex items-center justify-center">
                <Zap className="w-6 h-6" style={{ color: COLORS.farolCarga }} />
              </div>
              <div>
                <h2 className="text-xl font-bold" style={{ color: COLORS.farolCarga }}>BLOCO 1 — ABERTURA (10 min)</h2>
              </div>
            </div>

            <blockquote
              className="rounded-xl px-5 py-4 text-sm italic whitespace-pre-line leading-relaxed"
              style={{
                backgroundColor: COLORS.chaoFabrica,
                borderLeft: `4px solid ${COLORS.farolCarga}`,
                color: COLORS.luzGalpao,
              }}
            >
              {`"Pessoal, boa tarde. Antes de mais nada: essa reunião não é palestra — é treinamento de verdade. Vocês vão sair daqui sabendo exatamente o que fazer, como fazer e o que eu espero de cada um.

A gente vai passar por quatro grandes blocos: primeiro, eu vou apresentar a ferramenta que vocês vão usar todo dia — o CRM. Depois, a gente entra na parte técnica: volume, qualificação, follow-up e SPIN. No terceiro bloco, a gente treina na prática — scripts, ligações, WhatsApp. E no final, eu vou dar as tarefas de casa e o que vai ser cobrado na próxima War Room.

Quero atenção total. Celular no silencioso. Qualquer dúvida, levanta a mão e pergunta na hora — melhor perguntar agora do que errar lá fora. Bora?"`}
            </blockquote>
          </div>
        </motion.div>

        {/* ════════════════════════════════════════════
            BLOCO 2 — APRESENTAÇÃO DO CRM (40 min)
        ════════════════════════════════════════════ */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative rounded-2xl border border-yellow-500/30 bg-gradient-to-br from-yellow-600/10 to-yellow-800/10 overflow-hidden"
          style={{ backgroundColor: `${COLORS.chaoFabrica}ee` }}
        >
          <GlowingEffect spread={60} glow={false} borderWidth={1} />
          <div className="p-8 space-y-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-yellow-500/20 to-yellow-700/20 flex items-center justify-center">
                <Monitor className="w-6 h-6" style={{ color: COLORS.farolCarga }} />
              </div>
              <div>
                <h2 className="text-xl font-bold" style={{ color: COLORS.farolCarga }}>BLOCO 2 — APRESENTAÇÃO DO CRM (40 min)</h2>
              </div>
            </div>

            {/* 2.1 — Tour pelo sistema */}
            <div className="p-5 rounded-xl" style={{ backgroundColor: COLORS.chaoFabrica }}>
              <h3 className="text-sm font-bold uppercase tracking-wide mb-4" style={{ color: COLORS.farolCarga }}>
                2.1 — Tour pelo sistema
              </h3>
              <p className="text-sm mb-4" style={{ color: COLORS.acoIndustrial }}>
                O treinador abre o CRM na tela e percorre cada módulo ao vivo com a equipe:
              </p>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {[
                  { icon: BarChart3, title: 'Dashboard', desc: 'Visão geral de metas, atividades e pipeline.' },
                  { icon: Target, title: 'Pipeline', desc: 'Etapas do funil (Lead Novo → Tentativa de Contato → Em Contato → Qualificado → Reunião Agendada → Proposta → Fechado).' },
                  { icon: Users, title: 'Contatos', desc: 'Cadastro, campos obrigatórios (nome, telefone, e-mail, empresa, segmento, origem).' },
                  { icon: Phone, title: 'Atividades', desc: 'Registro de ligações, e-mails e mensagens — tudo com data, hora e observação.' },
                  { icon: FileText, title: 'Relatórios', desc: 'Métricas individuais e de equipe — taxa de conversão, volume de atividades, tempo médio de resposta.' },
                ].map((item, i) => (
                  <div key={i} className="p-4 rounded-lg border border-yellow-500/20" style={{ backgroundColor: `${COLORS.chaoFabrica}` }}>
                    <item.icon className="w-5 h-5 mb-2" style={{ color: COLORS.farolCarga }} />
                    <p className="text-sm font-semibold mb-1" style={{ color: COLORS.luzGalpao }}>{item.title}</p>
                    <p className="text-xs" style={{ color: COLORS.acoIndustrial }}>{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* 2.2 — Métricas que o SDR precisa bater */}
            <div className="p-5 rounded-xl" style={{ backgroundColor: COLORS.chaoFabrica }}>
              <h3 className="text-sm font-bold uppercase tracking-wide mb-4" style={{ color: COLORS.farolCarga }}>
                2.2 — Métricas que o SDR precisa bater
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm rounded-lg overflow-hidden">
                  <thead>
                    <tr style={{ backgroundColor: COLORS.chaoFabrica, borderBottom: `2px solid ${COLORS.farolCarga}40` }}>
                      <th className="px-4 py-3 font-semibold text-left" style={{ color: COLORS.farolCarga }}>Atividade</th>
                      <th className="px-4 py-3 font-semibold text-left" style={{ color: COLORS.farolCarga }}>Mínimo diário</th>
                      <th className="px-4 py-3 font-semibold text-left" style={{ color: COLORS.farolCarga }}>Ideal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['Tentativas de contato (liga + WPP)', '50', '80'],
                      ['Conexões efetivas (falou com decisor)', '8', '15'],
                      ['Leads qualificados', '3', '5'],
                      ['Reuniões agendadas', '1', '2'],
                      ['Follow-ups executados', '100%', '100%'],
                    ].map((row, i) => (
                      <tr key={i} style={{ backgroundColor: i % 2 === 0 ? `${COLORS.chaoFabrica}` : `${COLORS.chaoFabrica}cc`, borderBottom: '1px solid rgba(255,212,0,0.1)' }}>
                        {row.map((cell, j) => (
                          <td key={j} className="px-4 py-2.5" style={{ color: COLORS.luzGalpao }}>{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 2.3 — Configuração do WhatsApp Business */}
            <div className="p-5 rounded-xl" style={{ backgroundColor: COLORS.chaoFabrica }}>
              <h3 className="text-sm font-bold uppercase tracking-wide mb-4" style={{ color: COLORS.farolCarga }}>
                <Smartphone className="w-4 h-4 inline mr-2" />
                2.3 — Configuração do WhatsApp Business
              </h3>
              <ol className="space-y-3 text-sm" style={{ color: COLORS.luzGalpao }}>
                {[
                  'Baixar o WhatsApp Business (não o pessoal).',
                  'Configurar o perfil comercial: nome da empresa, logo, descrição, horário de atendimento.',
                  'Criar etiquetas de organização: Lead Novo, Em Contato, Qualificado, Reunião Agendada.',
                  'Configurar mensagem de ausência e saudação automática.',
                  'Salvar respostas rápidas para os scripts WPP 01, WPP 02 e WPP 03.',
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style={{ backgroundColor: `${COLORS.farolCarga}20`, color: COLORS.farolCarga }}>
                      {i + 1}
                    </span>
                    {item}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </motion.div>

        {/* ════════════════════════════════════════════
            BLOCO 3 — CAPACITAÇÃO TÉCNICA (50 min)
        ════════════════════════════════════════════ */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative rounded-2xl border border-yellow-500/30 bg-gradient-to-br from-yellow-600/10 to-yellow-800/10 overflow-hidden"
          style={{ backgroundColor: `${COLORS.chaoFabrica}ee` }}
        >
          <GlowingEffect spread={60} glow={false} borderWidth={1} />
          <div className="p-8 space-y-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-yellow-500/20 to-yellow-700/20 flex items-center justify-center">
                <Target className="w-6 h-6" style={{ color: COLORS.farolCarga }} />
              </div>
              <div>
                <h2 className="text-xl font-bold" style={{ color: COLORS.farolCarga }}>BLOCO 3 — CAPACITAÇÃO TÉCNICA (50 min)</h2>
              </div>
            </div>

            {/* 3.1 — Volume: a base de tudo */}
            <div className="p-5 rounded-xl" style={{ backgroundColor: COLORS.chaoFabrica }}>
              <h3 className="text-sm font-bold uppercase tracking-wide mb-4" style={{ color: COLORS.farolCarga }}>
                3.1 — Volume: a base de tudo
              </h3>
              <p className="text-sm mb-4" style={{ color: COLORS.luzGalpao }}>
                Vendas é jogo de volume. Sem volume, não existe funil. O diagrama abaixo mostra a cascata real:
              </p>

              {/* Cascade Diagram */}
              <div className="rounded-xl p-6 text-center space-y-2" style={{ backgroundColor: `${COLORS.chaoFabrica}`, border: `1px solid ${COLORS.farolCarga}20` }}>
                {[
                  { text: '100 tentativas', highlight: true },
                  { text: '20 conexões (20%)', highlight: false },
                  { text: '8 conversas qualificadas (40%)', highlight: false },
                  { text: '3 reuniões (35%)', highlight: false },
                  { text: '1 proposta', highlight: true },
                ].map((step, i, arr) => (
                  <div key={i}>
                    <p className={`text-sm font-mono font-semibold ${step.highlight ? '' : ''}`} style={{ color: step.highlight ? COLORS.farolCarga : COLORS.luzGalpao }}>
                      {step.text}
                    </p>
                    {i < arr.length - 1 && (
                      <ArrowDown className="w-4 h-4 mx-auto my-1" style={{ color: COLORS.acoIndustrial }} />
                    )}
                  </div>
                ))}
              </div>

              {/* Warning Box */}
              <div
                className="mt-4 rounded-xl px-5 py-4 text-sm flex items-start gap-3"
                style={{
                  backgroundColor: `${COLORS.farolCarga}15`,
                  border: `1px solid ${COLORS.farolCarga}`,
                  color: COLORS.luzGalpao,
                }}
              >
                <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: COLORS.farolCarga }} />
                <span><strong>Atenção:</strong> Se o SDR faz menos de 50 tentativas por dia, o funil seca. Não existe técnica que compense falta de volume.</span>
              </div>
            </div>

            {/* 3.2 — Qualificação BANT + Status correto no CRM */}
            <div className="p-5 rounded-xl" style={{ backgroundColor: COLORS.chaoFabrica }}>
              <h3 className="text-sm font-bold uppercase tracking-wide mb-4" style={{ color: COLORS.farolCarga }}>
                3.2 — Qualificação BANT + Status correto no CRM
              </h3>
              <p className="text-sm mb-4" style={{ color: COLORS.luzGalpao }}>
                BANT é o framework de qualificação que usamos para decidir se o lead merece avançar no funil:
              </p>

              {/* BANT Cards */}
              <div className="grid sm:grid-cols-2 gap-3 mb-6">
                {[
                  {
                    letter: 'B',
                    title: 'Budget (Orçamento)',
                    desc: 'O lead tem verba para investir?',
                    question: '"Vocês já investem em marketing digital hoje? Qual o investimento mensal atual?"',
                  },
                  {
                    letter: 'A',
                    title: 'Authority (Autoridade)',
                    desc: 'Estou falando com quem decide?',
                    question: '"Quem participa da decisão de contratar um serviço como o nosso?"',
                  },
                  {
                    letter: 'N',
                    title: 'Need (Necessidade)',
                    desc: 'Existe uma dor real que a gente resolve?',
                    question: '"Qual o maior desafio comercial de vocês hoje?"',
                  },
                  {
                    letter: 'T',
                    title: 'Timeline (Urgência)',
                    desc: 'Existe urgência para resolver agora?',
                    question: '"Vocês têm um prazo ou meta que precisam bater nos próximos meses?"',
                  },
                ].map((bant, i) => (
                  <div key={i} className="p-4 rounded-xl border border-yellow-500/20" style={{ backgroundColor: `${COLORS.chaoFabrica}` }}>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-black" style={{ backgroundColor: `${COLORS.farolCarga}20`, color: COLORS.farolCarga }}>
                        {bant.letter}
                      </span>
                      <span className="text-sm font-bold" style={{ color: COLORS.farolCarga }}>{bant.title}</span>
                    </div>
                    <p className="text-sm mb-2" style={{ color: COLORS.luzGalpao }}>{bant.desc}</p>
                    <p className="text-xs italic" style={{ color: COLORS.acoIndustrial }}>Pergunta-exemplo: {bant.question}</p>
                  </div>
                ))}
              </div>

              <p className="text-sm font-semibold mb-3" style={{ color: COLORS.farolCarga }}>Status correto no CRM:</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm rounded-lg overflow-hidden">
                  <thead>
                    <tr style={{ backgroundColor: COLORS.chaoFabrica, borderBottom: `2px solid ${COLORS.farolCarga}40` }}>
                      <th className="px-4 py-3 font-semibold text-left" style={{ color: COLORS.farolCarga }}>Situação</th>
                      <th className="px-4 py-3 font-semibold text-left" style={{ color: COLORS.farolCarga }}>Status correto no CRM</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['Nunca atendeu / nunca respondeu', 'Tentativa de Contato'],
                      ['Atendeu mas não foi possível qualificar ainda', 'Em Contato'],
                      ['Atendeu, foi qualificado e não tem perfil', 'Desqualificado'],
                      ['Pediu pra ligar depois e nunca mais atendeu', 'Tentativa de Contato'],
                      ['Disse explicitamente que não tem interesse', 'Desqualificado'],
                    ].map((row, i) => (
                      <tr key={i} style={{ backgroundColor: i % 2 === 0 ? `${COLORS.chaoFabrica}` : `${COLORS.chaoFabrica}cc`, borderBottom: '1px solid rgba(255,212,0,0.1)' }}>
                        {row.map((cell, j) => (
                          <td key={j} className="px-4 py-2.5" style={{ color: COLORS.luzGalpao }}>{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 3.3 — Ciclo de Follow-up */}
            <div className="p-5 rounded-xl" style={{ backgroundColor: COLORS.chaoFabrica }}>
              <h3 className="text-sm font-bold uppercase tracking-wide mb-4" style={{ color: COLORS.farolCarga }}>
                <Repeat className="w-4 h-4 inline mr-2" />
                3.3 — Ciclo de Follow-up
              </h3>
              <div className="overflow-x-auto mb-4">
                <table className="w-full text-sm rounded-lg overflow-hidden">
                  <thead>
                    <tr style={{ backgroundColor: COLORS.chaoFabrica, borderBottom: `2px solid ${COLORS.farolCarga}40` }}>
                      <th className="px-4 py-3 font-semibold text-left" style={{ color: COLORS.farolCarga }}>Dia</th>
                      <th className="px-4 py-3 font-semibold text-left" style={{ color: COLORS.farolCarga }}>Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['Dia 1', 'Ligação imediata + WhatsApp se não atendeu'],
                      ['Dia 2', 'Nova tentativa de ligação + mensagem com valor'],
                      ['Dia 4', 'Ligação + mensagem com prova social'],
                      ['Dia 7', 'Última tentativa direta + mensagem de "breakup"'],
                      ['Dia 14', 'Reaquecimento leve, sem pressão'],
                    ].map((row, i) => (
                      <tr key={i} style={{ backgroundColor: i % 2 === 0 ? `${COLORS.chaoFabrica}` : `${COLORS.chaoFabrica}cc`, borderBottom: '1px solid rgba(255,212,0,0.1)' }}>
                        {row.map((cell, j) => (
                          <td key={j} className="px-4 py-2.5" style={{ color: COLORS.luzGalpao }}>{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="text-sm font-semibold mb-3" style={{ color: COLORS.farolCarga }}>3 Regras de Ouro do Follow-up:</p>
              <ol className="space-y-3 text-sm" style={{ color: COLORS.luzGalpao }}>
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style={{ backgroundColor: `${COLORS.farolCarga}20`, color: COLORS.farolCarga }}>1</span>
                  <span><strong>Nunca desistir antes de 5 tentativas.</strong> A maioria das vendas acontece entre a 5a e a 12a tentativa.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style={{ backgroundColor: `${COLORS.farolCarga}20`, color: COLORS.farolCarga }}>2</span>
                  <span><strong>Cada contato precisa agregar valor.</strong> Não ligue só para "ver se o lead viu a mensagem" — traga dado, case, insight.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style={{ backgroundColor: `${COLORS.farolCarga}20`, color: COLORS.farolCarga }}>3</span>
                  <span><strong>Sempre encerrar com próximo passo.</strong> Todo contato termina com data e hora do próximo — sem exceção.</span>
                </li>
              </ol>
            </div>

            {/* 3.4 — SPIN Selling */}
            <div className="p-5 rounded-xl" style={{ backgroundColor: COLORS.chaoFabrica }}>
              <h3 className="text-sm font-bold uppercase tracking-wide mb-4" style={{ color: COLORS.farolCarga }}>
                <Search className="w-4 h-4 inline mr-2" />
                3.4 — SPIN Selling
              </h3>
              <p className="text-sm mb-4" style={{ color: COLORS.luzGalpao }}>
                SPIN é a metodologia de perguntas que usamos para conduzir a conversa com o lead:
              </p>
              <div className="grid sm:grid-cols-2 gap-3">
                {[
                  {
                    letter: 'S',
                    title: 'Situação',
                    desc: 'Entender o cenário atual do lead.',
                    question: '"Como funciona a operação comercial de vocês hoje?"',
                  },
                  {
                    letter: 'P',
                    title: 'Problema',
                    desc: 'Identificar as dores e dificuldades.',
                    question: '"Qual tem sido o maior desafio para gerar leads qualificados?"',
                  },
                  {
                    letter: 'I',
                    title: 'Implicação',
                    desc: 'Mostrar o impacto do problema se não for resolvido.',
                    question: '"E se esse problema continuar por mais 6 meses, qual o impacto no faturamento?"',
                  },
                  {
                    letter: 'N',
                    title: 'Necessidade de solução',
                    desc: 'Fazer o lead verbalizar que precisa de ajuda.',
                    question: '"Se existisse uma forma de resolver isso nos próximos 30 dias, faria sentido pra vocês?"',
                  },
                ].map((spin, i) => (
                  <div key={i} className="p-4 rounded-xl border border-yellow-500/20" style={{ backgroundColor: `${COLORS.chaoFabrica}` }}>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-black" style={{ backgroundColor: `${COLORS.farolCarga}20`, color: COLORS.farolCarga }}>
                        {spin.letter}
                      </span>
                      <span className="text-sm font-bold" style={{ color: COLORS.farolCarga }}>{spin.title}</span>
                    </div>
                    <p className="text-sm mb-2" style={{ color: COLORS.luzGalpao }}>{spin.desc}</p>
                    <p className="text-xs italic" style={{ color: COLORS.acoIndustrial }}>{spin.question}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>

        {/* ════════════════════════════════════════════
            BLOCO 4 — COMO LIGAR DE VERDADE (30 min)
        ════════════════════════════════════════════ */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative rounded-2xl border border-yellow-500/30 bg-gradient-to-br from-yellow-600/10 to-yellow-800/10 overflow-hidden"
          style={{ backgroundColor: `${COLORS.chaoFabrica}ee` }}
        >
          <GlowingEffect spread={60} glow={false} borderWidth={1} />
          <div className="p-8 space-y-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-yellow-500/20 to-yellow-700/20 flex items-center justify-center">
                <Phone className="w-6 h-6" style={{ color: COLORS.farolCarga }} />
              </div>
              <div>
                <h2 className="text-xl font-bold" style={{ color: COLORS.farolCarga }}>BLOCO 4 — COMO LIGAR DE VERDADE (30 min)</h2>
              </div>
            </div>

            {/* 4.1 — Postura ao telefone */}
            <div className="p-5 rounded-xl" style={{ backgroundColor: COLORS.chaoFabrica }}>
              <h3 className="text-sm font-bold uppercase tracking-wide mb-4" style={{ color: COLORS.farolCarga }}>
                4.1 — Postura ao telefone
              </h3>
              <ul className="space-y-2 text-sm" style={{ color: COLORS.luzGalpao }}>
                {[
                  'Fale em pé ou com postura ereta — a voz muda.',
                  'Sorria ao falar — o tom muda mesmo sem a pessoa ver.',
                  'Use o nome do lead no mínimo 3 vezes na conversa.',
                  'Nunca fale rápido demais. Pausas estratégicas demonstram segurança.',
                  'Ouça 70% do tempo, fale 30%.',
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: COLORS.farolCarga }} />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* 4.2 — Estrutura da ligação */}
            <div className="p-5 rounded-xl" style={{ backgroundColor: COLORS.chaoFabrica }}>
              <h3 className="text-sm font-bold uppercase tracking-wide mb-4" style={{ color: COLORS.farolCarga }}>
                4.2 — Estrutura da ligação
              </h3>
              <ol className="space-y-3 text-sm" style={{ color: COLORS.luzGalpao }}>
                {[
                  { step: 'Abertura (15s)', desc: 'Nome, empresa, motivo da ligação.' },
                  { step: 'Quebra-gelo (30s)', desc: 'Comentário relevante sobre o lead ou a empresa.' },
                  { step: 'Permissão (10s)', desc: '"Você tem 2 minutinhos? Quero te fazer uma pergunta rápida."' },
                  { step: 'Levantamento SPIN (90s)', desc: 'Situação → Problema → Implicação → Necessidade.' },
                  { step: 'Proposta de valor (30s)', desc: 'Conectar a dor do lead com o que a Millennials resolve.' },
                  { step: 'Agendamento (30s)', desc: 'Oferecer duas opções de horário.' },
                  { step: 'Confirmação (20s)', desc: 'Repetir data, hora, participantes e enviar convite.' },
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style={{ backgroundColor: `${COLORS.farolCarga}20`, color: COLORS.farolCarga }}>
                      {i + 1}
                    </span>
                    <span><strong style={{ color: COLORS.farolCarga }}>{item.step}:</strong> {item.desc}</span>
                  </li>
                ))}
              </ol>
            </div>

            {/* 4.3 — Scripts */}
            <div className="p-5 rounded-xl" style={{ backgroundColor: COLORS.chaoFabrica }}>
              <h3 className="text-sm font-bold uppercase tracking-wide mb-4" style={{ color: COLORS.farolCarga }}>
                <FileText className="w-4 h-4 inline mr-2" />
                4.3 — Scripts
              </h3>

              {/* Script 1 */}
              <div className="mb-5">
                <p className="text-sm font-semibold mb-2 flex items-center gap-2" style={{ color: COLORS.luzGalpao }}>
                  <Phone className="w-4 h-4" style={{ color: COLORS.farolCarga }} />
                  Script 1 — Primeiro contato (lead inbound)
                </p>
                <pre
                  className="rounded-xl p-4 text-xs leading-relaxed overflow-x-auto whitespace-pre-wrap font-mono"
                  style={{
                    backgroundColor: '#1a1412',
                    borderLeft: `4px solid ${COLORS.farolCarga}`,
                    color: COLORS.luzGalpao,
                  }}
                >
{`SDR: "[Nome do lead]? Boa tarde! Aqui é o [seu nome], da Millennials Growth B2B."
(pausa de 1 segundo)
SDR: "Acabei de ver que você demonstrou interesse nos nossos serviços, e quis ligar pessoalmente pra entender melhor o momento de vocês."
(espera o lead responder)
SDR: "[Nome], me conta rapidamente: como tá a operação comercial de vocês hoje? Vocês têm uma estrutura de prospecção ativa ou os clientes chegam mais pelo boca a boca?"
(escuta, anota no CRM)
SDR: "Entendi. E qual tem sido o maior desafio? É mais em gerar leads em volume ou em converter os que já chegam?"
(SPIN — problema e implicação)
SDR: "[Nome], com base no que você me contou, eu tenho algo específico pra te mostrar que resolve exatamente isso. São 20 minutinhos. Você tem disponibilidade amanhã às 10h ou prefere quarta às 15h?"`}
                </pre>
              </div>

              {/* Script 2 */}
              <div className="mb-5">
                <p className="text-sm font-semibold mb-2 flex items-center gap-2" style={{ color: COLORS.luzGalpao }}>
                  <Repeat className="w-4 h-4" style={{ color: COLORS.farolCarga }} />
                  Script 2 — Follow-up (não atendeu antes)
                </p>
                <pre
                  className="rounded-xl p-4 text-xs leading-relaxed overflow-x-auto whitespace-pre-wrap font-mono"
                  style={{
                    backgroundColor: '#1a1412',
                    borderLeft: `4px solid ${COLORS.farolCarga}`,
                    color: COLORS.luzGalpao,
                  }}
                >
{`SDR: "[Nome]? Boa tarde, [seu nome] da Millennials Growth B2B."
SDR: "Tentei seu contato ontem mas não consegui te pegar. Vi que você tinha interesse na nossa solução — quis só confirmar se ainda faz sentido conversar."
(pausa)
— Se positivo: retome o SPIN e siga para agendamento.
— Se "não tenho tempo": SDR: "Sem problema. São só 15 minutos. Posso te mandar um link de calendário pra você escolher o horário?"
— Se resistência: SDR: "Entendo. Me faz uma pergunta: o que te impediu antes? Foi o timing ou você já resolveu o problema que te levou a se cadastrar?"`}
                </pre>
              </div>

              {/* Script 3 */}
              <div className="mb-5">
                <p className="text-sm font-semibold mb-2 flex items-center gap-2" style={{ color: COLORS.luzGalpao }}>
                  <Zap className="w-4 h-4" style={{ color: COLORS.farolCarga }} />
                  Script 3 — Outbound (prospecto frio)
                </p>
                <pre
                  className="rounded-xl p-4 text-xs leading-relaxed overflow-x-auto whitespace-pre-wrap font-mono"
                  style={{
                    backgroundColor: '#1a1412',
                    borderLeft: `4px solid ${COLORS.farolCarga}`,
                    color: COLORS.luzGalpao,
                  }}
                >
{`SDR: "Oi, [nome]! Tudo certo? Aqui é [seu nome], da Millennials Growth B2B."
(tom descontraído)
SDR: "Estou entrando em contato porque a gente trabalha com [segmento do lead], ajudando empresas a [resultado principal]. Vi que vocês têm uma operação interessante no mercado."
SDR: "Me conta uma coisa: hoje vocês têm alguma estratégia de marketing digital ativa? Anunciam no Meta, no Google?"
(escuta, qualifica)
SDR: "Qual é o maior gargalo hoje? É gerar leads em volume ou converter os que já chegam?"
(se qualificado)
SDR: "[Nome], acho que faz muito sentido a gente ter uma conversa mais aprofundada. Tenho agenda disponível amanhã às 10h ou quinta às 14h. Qual funciona melhor?"`}
                </pre>
              </div>

              {/* WhatsApp Scripts */}
              <div className="mb-5">
                <p className="text-sm font-semibold mb-2 flex items-center gap-2" style={{ color: COLORS.luzGalpao }}>
                  <MessageSquare className="w-4 h-4" style={{ color: '#25D366' }} />
                  WPP 01 — Primeiro contato WhatsApp
                </p>
                <pre
                  className="rounded-xl p-4 text-xs leading-relaxed overflow-x-auto whitespace-pre-wrap font-mono"
                  style={{
                    backgroundColor: '#1a1412',
                    borderLeft: '4px solid #25D366',
                    color: COLORS.luzGalpao,
                  }}
                >
{`[Nome], boa tarde! Aqui é o [seu nome] da Millennials Growth B2B.
Tentei seu contato agora por ligação.
Vi que você demonstrou interesse nos nossos serviços — quando tiver um momento, pode me retornar?
Tenho algo específico que pode fazer sentido pro momento de vocês.`}
                </pre>
              </div>

              <div className="mb-5">
                <p className="text-sm font-semibold mb-2 flex items-center gap-2" style={{ color: COLORS.luzGalpao }}>
                  <MessageSquare className="w-4 h-4" style={{ color: '#25D366' }} />
                  WPP 02 — Mensagem com prova social
                </p>
                <pre
                  className="rounded-xl p-4 text-xs leading-relaxed overflow-x-auto whitespace-pre-wrap font-mono"
                  style={{
                    backgroundColor: '#1a1412',
                    borderLeft: '4px solid #25D366',
                    color: COLORS.luzGalpao,
                  }}
                >
{`[Nome], bom dia!
Passando para compartilhar um resultado que geramos essa semana para um cliente do mesmo segmento que você:
[resultado específico — ex: "47 leads qualificados em 15 dias, custo por lead de R$ 18"]
Você mencionou que o maior desafio é [dor citada na ligação]. É exatamente isso que a gente está resolvendo para eles.
Vale 15 min de conversa pra eu te mostrar como? Me avisa o melhor horário.`}
                </pre>
              </div>

              <div className="mb-2">
                <p className="text-sm font-semibold mb-2 flex items-center gap-2" style={{ color: COLORS.luzGalpao }}>
                  <MessageSquare className="w-4 h-4" style={{ color: '#25D366' }} />
                  WPP 03 — Mensagem de breakup
                </p>
                <pre
                  className="rounded-xl p-4 text-xs leading-relaxed overflow-x-auto whitespace-pre-wrap font-mono"
                  style={{
                    backgroundColor: '#1a1412',
                    borderLeft: '4px solid #25D366',
                    color: COLORS.luzGalpao,
                  }}
                >
{`[Nome], tudo bem?
Tentei contato algumas vezes e entendo que o momento pode não ser o ideal agora.
Vou encerrar os contatos por ora — sem compromisso nenhum.
Se em algum momento fizer sentido retomar a conversa, é só me chamar. Tudo de bom pra você e pro negócio!`}
                </pre>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ════════════════════════════════════════════
            BLOCO 5 — ERROS CRÍTICOS (10 min)
        ════════════════════════════════════════════ */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative rounded-2xl border border-yellow-500/30 bg-gradient-to-br from-yellow-600/10 to-yellow-800/10 overflow-hidden"
          style={{ backgroundColor: `${COLORS.chaoFabrica}ee` }}
        >
          <GlowingEffect spread={60} glow={false} borderWidth={1} />
          <div className="p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-red-500/20 to-red-700/20 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6" style={{ color: '#ef4444' }} />
              </div>
              <div>
                <h2 className="text-xl font-bold" style={{ color: COLORS.farolCarga }}>BLOCO 5 — ERROS CRÍTICOS (10 min)</h2>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm rounded-lg overflow-hidden">
                <thead>
                  <tr style={{ backgroundColor: COLORS.chaoFabrica, borderBottom: `2px solid ${COLORS.farolCarga}40` }}>
                    <th className="px-4 py-3 font-semibold text-left" style={{ color: '#ef4444' }}>
                      <XCircle className="w-4 h-4 inline mr-1" /> NUNCA FAÇA
                    </th>
                    <th className="px-4 py-3 font-semibold text-left" style={{ color: '#22c55e' }}>
                      <CircleCheck className="w-4 h-4 inline mr-1" /> SEMPRE FAÇA
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['Ligar só uma vez e desistir', 'Seguir o ciclo completo — 5 tentativas mínimas'],
                    ['Começar pelo WhatsApp sem ligar', 'Ligação primeiro, sempre'],
                    ['Não registrar no CRM após contato', 'Registrar toda interação em tempo real'],
                    ['Falar mais do que ouvir', '70% ouvindo / 30% falando'],
                    ['Fazer perguntas fechadas (sim/não)', 'Usar perguntas abertas'],
                    ['Oferecer o produto antes de levantar a dor', 'Diagnosticar antes de prescrever'],
                    ['Aceitar "não tenho interesse" sem explorar', 'Entender o motivo com empatia'],
                    ['Deixar lead sem próximo passo', 'Sempre encerrar com data e hora do próximo contato'],
                  ].map((row, i) => (
                    <tr key={i} style={{ backgroundColor: i % 2 === 0 ? `${COLORS.chaoFabrica}` : `${COLORS.chaoFabrica}cc`, borderBottom: '1px solid rgba(255,212,0,0.1)' }}>
                      <td className="px-4 py-2.5" style={{ color: '#fca5a5' }}>{row[0]}</td>
                      <td className="px-4 py-2.5" style={{ color: '#86efac' }}>{row[1]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>

        {/* ════════════════════════════════════════════
            BLOCO 6 — ROTINA DIÁRIA DO SDR (5 min)
        ════════════════════════════════════════════ */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative rounded-2xl border border-yellow-500/30 bg-gradient-to-br from-yellow-600/10 to-yellow-800/10 overflow-hidden"
          style={{ backgroundColor: `${COLORS.chaoFabrica}ee` }}
        >
          <GlowingEffect spread={60} glow={false} borderWidth={1} />
          <div className="p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-yellow-500/20 to-yellow-700/20 flex items-center justify-center">
                <Calendar className="w-6 h-6" style={{ color: COLORS.farolCarga }} />
              </div>
              <div>
                <h2 className="text-xl font-bold" style={{ color: COLORS.farolCarga }}>BLOCO 6 — ROTINA DIÁRIA DO SDR (5 min)</h2>
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              {/* Manhã */}
              <div className="p-5 rounded-xl border border-yellow-500/20" style={{ backgroundColor: COLORS.chaoFabrica }}>
                <p className="text-sm font-bold mb-3" style={{ color: COLORS.farolCarga }}>
                  <Clock className="w-4 h-4 inline mr-2" />
                  Manhã
                </p>
                <ul className="space-y-2 text-sm" style={{ color: COLORS.luzGalpao }}>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: COLORS.farolCarga }} />
                    Abrir o CRM e revisar os follow-ups do dia.
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: COLORS.farolCarga }} />
                    Priorizar leads quentes (responderam, abriram e-mail, interagiram).
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: COLORS.farolCarga }} />
                    Fazer as primeiras 20 tentativas de contato antes das 11h.
                  </li>
                </ul>
              </div>

              {/* Ao longo do dia */}
              <div className="p-5 rounded-xl border border-yellow-500/20" style={{ backgroundColor: COLORS.chaoFabrica }}>
                <p className="text-sm font-bold mb-3" style={{ color: COLORS.farolCarga }}>
                  <Clock className="w-4 h-4 inline mr-2" />
                  Ao longo do dia
                </p>
                <ul className="space-y-2 text-sm" style={{ color: COLORS.luzGalpao }}>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: COLORS.farolCarga }} />
                    Registrar TODA interação no CRM em tempo real — não deixar para o final do dia.
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: COLORS.farolCarga }} />
                    Alternar entre ligações e WhatsApp conforme o ciclo de follow-up.
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: COLORS.farolCarga }} />
                    Bater no mínimo 50 tentativas e 8 conexões efetivas.
                  </li>
                </ul>
              </div>

              {/* Final do dia */}
              <div className="p-5 rounded-xl border border-yellow-500/20" style={{ backgroundColor: COLORS.chaoFabrica }}>
                <p className="text-sm font-bold mb-3" style={{ color: COLORS.farolCarga }}>
                  <Clock className="w-4 h-4 inline mr-2" />
                  Final do dia
                </p>
                <ul className="space-y-2 text-sm" style={{ color: COLORS.luzGalpao }}>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: COLORS.farolCarga }} />
                    Revisar o pipeline: leads que precisam de próximo passo.
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: COLORS.farolCarga }} />
                    Agendar os follow-ups do dia seguinte.
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: COLORS.farolCarga }} />
                    Atualizar status de todos os leads contatados.
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ════════════════════════════════════════════
            BLOCO 7 — TAREFAS DE CASA E PRÓXIMOS PASSOS (15 min)
        ════════════════════════════════════════════ */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative rounded-2xl border border-yellow-500/30 bg-gradient-to-br from-yellow-600/10 to-yellow-800/10 overflow-hidden"
          style={{ backgroundColor: `${COLORS.chaoFabrica}ee` }}
        >
          <GlowingEffect spread={60} glow={false} borderWidth={1} />
          <div className="p-8 space-y-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-yellow-500/20 to-yellow-700/20 flex items-center justify-center">
                <ListChecks className="w-6 h-6" style={{ color: COLORS.farolCarga }} />
              </div>
              <div>
                <h2 className="text-xl font-bold" style={{ color: COLORS.farolCarga }}>BLOCO 7 — TAREFAS DE CASA E PRÓXIMOS PASSOS (15 min)</h2>
              </div>
            </div>

            <p className="text-sm font-semibold" style={{ color: COLORS.luzGalpao }}>Tarefas para todos os SDRs:</p>
            <ol className="space-y-3 text-sm" style={{ color: COLORS.luzGalpao }}>
              {[
                'Configurar o WhatsApp Business completo (perfil, etiquetas, respostas rápidas) até amanhã.',
                'Decorar os 3 scripts de ligação e os 3 scripts de WhatsApp — praticar em voz alta no mínimo 5 vezes cada.',
                'Fazer no mínimo 50 tentativas de contato por dia a partir de amanhã.',
                'Registrar 100% das interações no CRM em tempo real — sem exceção.',
                'Trazer na próxima War Room: 3 objeções reais que ouviram e não souberam responder.',
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style={{ backgroundColor: `${COLORS.farolCarga}20`, color: COLORS.farolCarga }}>
                    {i + 1}
                  </span>
                  {item}
                </li>
              ))}
            </ol>

            {/* Materiais recomendados */}
            <div className="p-5 rounded-xl" style={{ backgroundColor: COLORS.chaoFabrica }}>
              <p className="text-sm font-semibold mb-3" style={{ color: COLORS.farolCarga }}>
                <BookOpen className="w-4 h-4 inline mr-2" />
                Materiais recomendados
              </p>
              <div className="space-y-3 text-sm" style={{ color: COLORS.luzGalpao }}>
                <div>
                  <p className="font-medium mb-1" style={{ color: COLORS.farolCarga }}>Livros:</p>
                  <ul className="space-y-1 ml-2">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-3 h-3 flex-shrink-0 mt-1" style={{ color: COLORS.acoIndustrial }} />
                      <em>SPIN Selling</em> — Neil Rackham
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-3 h-3 flex-shrink-0 mt-1" style={{ color: COLORS.acoIndustrial }} />
                      <em>Receita Previsível</em> — Aaron Ross
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-3 h-3 flex-shrink-0 mt-1" style={{ color: COLORS.acoIndustrial }} />
                      <em>The Challenger Sale</em> — Matthew Dixon &amp; Brent Adamson
                    </li>
                  </ul>
                </div>
                <div>
                  <p className="font-medium mb-1" style={{ color: COLORS.farolCarga }}>Podcast:</p>
                  <ul className="space-y-1 ml-2">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-3 h-3 flex-shrink-0 mt-1" style={{ color: COLORS.acoIndustrial }} />
                      <em>Podcast Millennials Growth</em> — episódios sobre prospecção e vendas B2B
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Closing trainer speech */}
            <blockquote
              className="rounded-xl px-5 py-4 text-sm italic whitespace-pre-line leading-relaxed"
              style={{
                backgroundColor: COLORS.chaoFabrica,
                borderLeft: `4px solid ${COLORS.farolCarga}`,
                color: COLORS.luzGalpao,
              }}
            >
              {`"Pessoal, vocês saem daqui hoje com tudo que precisam pra operar. CRM configurado, scripts na mão, técnica treinada e rotina definida. Agora é execução.

Na próxima War Room eu vou abrir o CRM de cada um e analisar: quantas tentativas, quantas conexões, como estão os registros, quais leads avançaram. Não tem como esconder — a ferramenta mostra tudo.

Quem seguir o processo vai ter resultado. Quem não seguir, a gente vai identificar e corrigir. É assim que a gente cresce — com método, volume e disciplina.

Dúvidas finais? Então bora. Bom trabalho pra todo mundo."`}
            </blockquote>
          </div>
        </motion.div>
      </div>

      {/* ── Footer ── */}
      <footer className="py-12 px-4 text-center" style={{ backgroundColor: COLORS.chaoFabrica }}>
        <MgrowthLogo className="h-10 mx-auto mb-4 text-[#F5F5DC] opacity-70" />
        <div className="w-12 h-0.5 mx-auto mb-4" style={{ backgroundColor: COLORS.farolCarga }} />
        <p className="text-xs" style={{ color: COLORS.acoIndustrial }}>
          Documento de uso interno &mdash; Millennials Growth B2B | War Room #2 | Treinamento para SDRs
        </p>
      </footer>
    </div>
  );
}
