import { motion } from 'framer-motion';
import { BackgroundPaths } from '@/components/ui/background-paths';
import { GlowingEffect } from '@/components/ui/glowing-effect';
import { MgrowthLogo } from '@/components/ui/MgrowthLogo';
import {
  Zap,
  MessageSquare,
  BarChart3,
  HelpCircle,
  Flag,
  Users,
  Download,
  CheckCircle2,
  AlertTriangle,
  Search,
} from 'lucide-react';

const COLORS = {
  chaoFabrica: '#3A2E2C',
  farolCarga: '#FFD400',
  luzGalpao: '#F5F5DC',
  acoIndustrial: '#6B7A6F',
};

export default function WarRoom3Page() {
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
            <span style={{ color: COLORS.farolCarga }}>#3</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-lg md:text-xl max-w-2xl mx-auto mb-12"
            style={{ color: COLORS.acoIndustrial }}
          >
            Feedback, Análise e Direcionamento
          </motion.p>
        </div>
      </section>

      {/* ── Main Content ── */}
      <div className="max-w-5xl mx-auto px-4 py-16 space-y-12">

        {/* ════════════════════════════════════════════
            ABERTURA E CONTEXTO
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
                <MessageSquare className="w-6 h-6" style={{ color: COLORS.farolCarga }} />
              </div>
              <div>
                <h2 className="text-xl font-bold" style={{ color: COLORS.farolCarga }}>ABERTURA E CONTEXTO</h2>
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
              {`"Faz dias desde a nossa War Room #2. Vocês saíram de lá com CRM na mão, scripts na cabeça e metas definidas. Hoje a gente não vai apresentar nada novo — vai analisar o que foi feito, corrigir o que precisa ser corrigido e decidir o próximo passo de cada um.

Essa é a lógica das War Rooms: a primeira planta a semente, a segunda rega. E a partir de agora, toda War Room vai funcionar assim — olhamos para o que aconteceu, ajustamos, e saímos com direcionamento claro.

Sem julgamento aqui. Erro que a gente consegue ver e nomear é erro que a gente consegue corrigir."`}
            </blockquote>
          </div>
        </motion.div>

        {/* ════════════════════════════════════════════
            PAPEL DO TREINADOR COMERCIAL
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
                <Users className="w-6 h-6" style={{ color: COLORS.farolCarga }} />
              </div>
              <div>
                <h2 className="text-xl font-bold" style={{ color: COLORS.farolCarga }}>PAPEL DO TREINADOR COMERCIAL</h2>
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
              {`"Quero deixar claro o meu papel aqui hoje. Não sou o chefe da operação de vocês — sou o espelho. Meu trabalho é:

Primeiro: analisar o que está acontecendo na ferramenta — acertos, erros, padrões.
Segundo: responder dúvidas que surgiram na prática, porque na teoria tudo faz sentido, mas na hora de ligar de verdade surgem situações que não estavam no script.
Terceiro: alinhar treinamentos específicos para quem precisa de ajuste em algum ponto do processo.

O que vocês me derem de informação hoje — dúvidas reais, dificuldades reais — é o que vai fazer essa reunião valer. Quanto mais honesto, melhor."`}
            </blockquote>

            <div className="p-5 rounded-xl" style={{ backgroundColor: COLORS.chaoFabrica }}>
              <p className="text-sm font-semibold mb-4" style={{ color: COLORS.farolCarga }}>Os 3 papéis do treinador nesta War Room:</p>
              <div className="grid md:grid-cols-3 gap-3">
                {[
                  {
                    icon: Search,
                    number: '1',
                    title: 'Analisador',
                    desc: 'Abrir o CRM e o diagnóstico ao vivo, identificar padrões de acerto e erro na operação — volume de atividades, qualidade dos registros, taxa de conversão entre etapas.',
                  },
                  {
                    icon: HelpCircle,
                    number: '2',
                    title: 'Respondedor de dúvidas',
                    desc: 'Coletar as dúvidas reais que surgiram na prática dos últimos dias — objeções inesperadas, situações fora do script, dificuldades com a ferramenta.',
                  },
                  {
                    icon: Flag,
                    number: '3',
                    title: 'Alinhador de treinamento',
                    desc: 'Com base na análise e nas dúvidas, definir treinamentos específicos para cada SDR ou para a equipe — reforço de SPIN, prática de scripts, ajuste de postura.',
                  },
                ].map((role, i) => (
                  <div key={i} className="p-4 rounded-xl border border-yellow-500/20" style={{ backgroundColor: `${COLORS.chaoFabrica}` }}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold" style={{ backgroundColor: `${COLORS.farolCarga}20`, color: COLORS.farolCarga }}>
                        {role.number}
                      </span>
                      <role.icon className="w-4 h-4" style={{ color: COLORS.farolCarga }} />
                      <span className="text-sm font-bold" style={{ color: COLORS.farolCarga }}>{role.title}</span>
                    </div>
                    <p className="text-xs" style={{ color: COLORS.acoIndustrial }}>{role.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>

        {/* ════════════════════════════════════════════
            FEEDBACK: ANÁLISE DO CRM
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
                <BarChart3 className="w-6 h-6" style={{ color: COLORS.farolCarga }} />
              </div>
              <div>
                <h2 className="text-xl font-bold" style={{ color: COLORS.farolCarga }}>FEEDBACK: ANÁLISE DO CRM</h2>
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
              {`"Agora iremos abrir o Diagnóstico e analisar tudo juntos."`}
            </blockquote>

            {/* Highlighted action card */}
            <div
              className="rounded-xl px-5 py-4 text-sm flex items-start gap-3"
              style={{
                backgroundColor: `${COLORS.farolCarga}15`,
                border: `1px solid ${COLORS.farolCarga}`,
                color: COLORS.luzGalpao,
              }}
            >
              <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: COLORS.farolCarga }} />
              <div>
                <p className="font-semibold mb-1" style={{ color: COLORS.farolCarga }}>Abertura da análise ao vivo</p>
                <p>[Abrir o Diagnóstico comercial WAR #3]</p>
              </div>
            </div>

            <div className="p-5 rounded-xl" style={{ backgroundColor: COLORS.chaoFabrica }}>
              <p className="text-sm mb-3" style={{ color: COLORS.luzGalpao }}>Neste momento o treinador deve:</p>
              <ul className="space-y-2 text-sm" style={{ color: COLORS.luzGalpao }}>
                {[
                  'Abrir o CRM de cada SDR na tela compartilhada.',
                  'Analisar volume de tentativas, conexões, registros e follow-ups.',
                  'Destacar acertos publicamente para reforçar comportamentos positivos.',
                  'Apontar erros de forma construtiva, sempre com a solução junto.',
                  'Comparar métricas individuais com as metas definidas na War Room #2.',
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: COLORS.farolCarga }} />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </motion.div>

        {/* ════════════════════════════════════════════
            DÚVIDAS DA EQUIPE
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
                <HelpCircle className="w-6 h-6" style={{ color: COLORS.farolCarga }} />
              </div>
              <div>
                <h2 className="text-xl font-bold" style={{ color: COLORS.farolCarga }}>DÚVIDAS DA EQUIPE</h2>
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
              {`"Agora é o momento de vocês. Nos últimos 15 dias, com certeza surgiram situações que não estavam no script — leads que responderam de forma diferente, objeções que não sabiam como tratar, dúvidas sobre o que registrar no CRM. Quero ouvir tudo isso agora."`}
            </blockquote>

            <div className="p-5 rounded-xl" style={{ backgroundColor: COLORS.chaoFabrica }}>
              <p className="text-sm mb-3" style={{ color: COLORS.luzGalpao }}>O treinador deve:</p>
              <ul className="space-y-2 text-sm" style={{ color: COLORS.luzGalpao }}>
                {[
                  'Anotar cada dúvida antes de responder.',
                  'Agrupar dúvidas semelhantes.',
                  'Responder com exemplos práticos, não apenas teoria.',
                  'Se uma dúvida exigir treinamento mais longo, anotar para sessão dedicada.',
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: COLORS.farolCarga }} />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </motion.div>

        {/* ════════════════════════════════════════════
            ENCERRAMENTO
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
                <Flag className="w-6 h-6" style={{ color: COLORS.farolCarga }} />
              </div>
              <div>
                <h2 className="text-xl font-bold" style={{ color: COLORS.farolCarga }}>ENCERRAMENTO</h2>
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
              {`"Pessoal, em 15 dias vocês saíram do zero no CRM para operar com a ferramenta no dia a dia. Isso já é avanço real. O que a gente identificou hoje não são problemas — são os próximos degraus.

Cada um sai daqui com: um ponto de melhora claro, um direcionamento de estudo, e uma campanha ativa. O trabalho começa agora.

Próxima War Room daqui 15 dias. Até lá: volume todos os dias, registro em tempo real, e foco na campanha. Bora?"`}
            </blockquote>
          </div>
        </motion.div>
      </div>

      {/* ── Footer ── */}
      <footer className="py-12 px-4 text-center" style={{ backgroundColor: COLORS.chaoFabrica }}>
        <MgrowthLogo className="h-10 mx-auto mb-4 text-[#F5F5DC] opacity-70" />
        <div className="w-12 h-0.5 mx-auto mb-4" style={{ backgroundColor: COLORS.farolCarga }} />
        <p className="text-xs" style={{ color: COLORS.acoIndustrial }}>
          Documento de uso interno &mdash; Millennials Growth B2B | War Room #3
        </p>
      </footer>
    </div>
  );
}
