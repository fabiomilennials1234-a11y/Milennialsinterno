import { motion } from 'framer-motion';
import { AlertCircle, CheckCircle2, Clock, Rocket, Settings, Zap, Image } from 'lucide-react';

// Millennials B2B Colors
const COLORS = {
  chaoFabrica: '#3A2E2C',
  farolCarga: '#FFD400',
  luzGalpao: '#F5F5DC',
  acoIndustrial: '#6B7A6F',
};

interface Passo {
  number: number;
  title: string;
  description: string;
  icon: typeof CheckCircle2;
}

const PASSOS: Passo[] = [
  {
    number: 1,
    title: '5x primeiros criativos entregues',
    description: 'Máximo 5 dias após cliente entregar infos.',
    icon: Image,
  },
  {
    number: 2,
    title: '5x primeiros criativos aprovados',
    description: 'O cliente possui 1 dia para dar uma devolutiva dos anúncios, se não deveremos dar continuidade para avanço das campanhas.',
    icon: CheckCircle2,
  },
  {
    number: 3,
    title: 'Campanha ativa',
    description: 'Até 7 dias após o envio dos responsáveis do cliente.',
    icon: Rocket,
  },
  {
    number: 4,
    title: 'Primeiros resultados',
    description: 'É normal que os primeiros resultados apareçam em até 3 dias de campanhas. Assim iniciam as otimizações.',
    icon: Zap,
  },
  {
    number: 5,
    title: 'Otimização PRO+',
    description: 'Após os primeiros 7 dias, devemos conversar sobre as campanhas.',
    icon: Settings,
  },
];

export default function StrategyProximosPassosSection() {
  return (
    <section className="py-20 px-4">
      <div className="container mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <div 
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-4"
            style={{ backgroundColor: `${COLORS.farolCarga}20` }}
          >
            <span className="text-2xl">🚀</span>
            <span style={{ color: COLORS.farolCarga }} className="font-semibold">
              CRONOGRAMA
            </span>
          </div>
          <h2 
            className="text-3xl md:text-4xl font-bold mb-4"
            style={{ color: COLORS.luzGalpao }}
          >
            Próximos <span style={{ color: COLORS.farolCarga }}>Passos</span>
          </h2>
          <p style={{ color: COLORS.acoIndustrial }} className="max-w-2xl mx-auto text-lg">
            Confira o cronograma de execução da sua estratégia
          </p>
        </motion.div>

        {/* Lembrete importante */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-12 p-6 rounded-2xl flex items-start gap-4"
          style={{ 
            backgroundColor: `${COLORS.farolCarga}15`,
            border: `2px solid ${COLORS.farolCarga}40`
          }}
        >
          <div 
            className="shrink-0 w-12 h-12 rounded-full flex items-center justify-center"
            style={{ backgroundColor: `${COLORS.farolCarga}30` }}
          >
            <AlertCircle className="w-6 h-6" style={{ color: COLORS.farolCarga }} />
          </div>
          <div>
            <h3 
              className="font-bold text-lg mb-1"
              style={{ color: COLORS.farolCarga }}
            >
              LEMBRETE IMPORTANTE
            </h3>
            <p style={{ color: COLORS.luzGalpao }}>
              Todos os prazos e datas dependem da entrega dos <strong style={{ color: COLORS.farolCarga }}>responsáveis do cliente</strong>.
            </p>
          </div>
        </motion.div>

        {/* Timeline dos passos */}
        <div className="relative">
          {/* Linha vertical conectora (desktop) */}
          <div 
            className="hidden md:block absolute left-1/2 top-0 bottom-0 w-1 -translate-x-1/2"
            style={{ backgroundColor: `${COLORS.farolCarga}30` }}
          />

          <div className="space-y-8 md:space-y-12">
            {PASSOS.map((passo, index) => (
              <motion.div
                key={passo.number}
                initial={{ opacity: 0, x: index % 2 === 0 ? -50 : 50 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className={`relative flex flex-col md:flex-row items-center gap-6 ${
                  index % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'
                }`}
              >
                {/* Conteúdo */}
                <div 
                  className={`flex-1 p-6 rounded-2xl ${
                    index % 2 === 0 ? 'md:text-right' : 'md:text-left'
                  }`}
                  style={{ 
                    backgroundColor: COLORS.chaoFabrica,
                    border: `2px solid ${COLORS.farolCarga}40`
                  }}
                >
                  <div className={`flex items-center gap-3 mb-3 ${
                    index % 2 === 0 ? 'md:flex-row-reverse' : ''
                  }`}>
                    <div 
                      className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${COLORS.farolCarga}20` }}
                    >
                      <passo.icon className="w-5 h-5" style={{ color: COLORS.farolCarga }} />
                    </div>
                    <h3 
                      className="font-bold text-lg"
                      style={{ color: COLORS.luzGalpao }}
                    >
                      {passo.title}
                    </h3>
                  </div>
                  <p style={{ color: COLORS.acoIndustrial }}>
                    {passo.description}
                  </p>
                </div>

                {/* Círculo central com número */}
                <div 
                  className="w-14 h-14 rounded-full flex items-center justify-center shrink-0 relative z-10"
                  style={{ 
                    backgroundColor: COLORS.farolCarga,
                    boxShadow: `0 0 30px ${COLORS.farolCarga}50`
                  }}
                >
                  <span 
                    className="text-xl font-bold"
                    style={{ color: COLORS.chaoFabrica }}
                  >
                    {passo.number}
                  </span>
                </div>

                {/* Espaçador para manter alinhamento */}
                <div className="flex-1 hidden md:block" />
              </motion.div>
            ))}
          </div>
        </div>

        {/* Nota sobre prazo total */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-12 text-center"
        >
          <div 
            className="inline-flex items-center gap-3 px-6 py-4 rounded-2xl"
            style={{ 
              backgroundColor: `${COLORS.chaoFabrica}`,
              border: `2px solid ${COLORS.farolCarga}40`
            }}
          >
            <Clock className="w-6 h-6" style={{ color: COLORS.farolCarga }} />
            <span style={{ color: COLORS.luzGalpao }} className="font-semibold">
              Prazo estimado para primeiros resultados: <span style={{ color: COLORS.farolCarga }}>3 meses</span>
            </span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
