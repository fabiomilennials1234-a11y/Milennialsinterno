import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, Ship, Anchor, Flag, Compass, Crown, X } from 'lucide-react';

// Import marco images
import marco1Img from '@/assets/marcos/marco-1.png';
import marco2Img from '@/assets/marcos/marco-2.png';
import marco3Img from '@/assets/marcos/marco-3.png';
import marco4Img from '@/assets/marcos/marco-4.png';
import marco5Img from '@/assets/marcos/marco-5.png';

// Millennials B2B Colors
const COLORS = {
  chaoFabrica: '#3A2E2C',
  farolCarga: '#FFD400',
  luzGalpao: '#F5F5DC',
  acoIndustrial: '#6B7A6F',
};

interface Marco {
  id: number;
  title: string;
  subtitle: string;
  description: string;
  icon: typeof Ship;
  image: string;
}

const MARCOS: Marco[] = [
  {
    id: 1,
    title: 'Largada da Rota Atlântica',
    subtitle: 'Campanha Já no Ar',
    description: 'Primeiros leads, primeiras vendas e primeiras otimizações. Medimos o "vento" do mercado: objeções, qualidade do lead e aderência da oferta.',
    icon: Anchor,
    image: marco1Img,
  },
  {
    id: 2,
    title: 'Deriva Controlada',
    subtitle: 'Validação de Oferta e Segmentação',
    description: 'Volume consistente de leads chegando. Padrões de comportamento e dados reais começam a surgir. Otimização de criativos e públicos.',
    icon: Ship,
    image: marco2Img,
  },
  {
    id: 3,
    title: 'Primeiro Porto',
    subtitle: 'Processo Comercial Estruturado',
    description: 'Leads qualificados chegando com consistência. Reuniões e vendas frequentes. Dados suficientes para entender o funil e padronizar o processo.',
    icon: Flag,
    image: marco3Img,
  },
  {
    id: 4,
    title: 'Expansão da Rota',
    subtitle: 'Escala de Investimento',
    description: 'Previsibilidade de vendas e ROI positivo. Aumento de investimento e volume de leads mantendo eficiência.',
    icon: Compass,
    image: marco4Img,
  },
  {
    id: 5,
    title: 'Escala Sustentada',
    subtitle: 'Operação Madura',
    description: 'Operação rodando com alto volume de leads. Time comercial maduro e previsível. Foco em crescimento composto e aumento de margem/LTV.',
    icon: Crown,
    image: marco5Img,
  },
];

export default function StrategyMarcosSection() {
  const [selectedMarco, setSelectedMarco] = useState<Marco | null>(null);

  return (
    <>
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
              <span className="text-2xl">⚓</span>
              <span style={{ color: COLORS.farolCarga }} className="font-semibold">
                JORNADA MILLENNIALS
              </span>
            </div>
            <h2 
              className="text-3xl md:text-4xl font-bold mb-4"
              style={{ color: COLORS.luzGalpao }}
            >
              Os 5 <span style={{ color: COLORS.farolCarga }}>Marcos</span> da Millennials
            </h2>
            <p style={{ color: COLORS.acoIndustrial }} className="max-w-2xl mx-auto text-lg">
              Entenda a jornada de crescimento que seu negócio percorrerá conosco
            </p>
          </motion.div>

          {/* Timeline visual dos marcos */}
          <div className="relative">
            {/* Linha conectora */}
            <div 
              className="hidden md:block absolute top-1/2 left-0 right-0 h-1 -translate-y-1/2"
              style={{ backgroundColor: `${COLORS.farolCarga}30` }}
            />

            <div className="grid grid-cols-1 md:grid-cols-5 gap-6 md:gap-4">
              {MARCOS.map((marco, index) => (
                <motion.div
                  key={marco.id}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="relative"
                >
                  {/* Botão do Marco */}
                  <button
                    onClick={() => setSelectedMarco(marco)}
                    className="w-full group relative p-6 rounded-2xl transition-all duration-300 hover:scale-105"
                    style={{ 
                      backgroundColor: `${COLORS.chaoFabrica}`,
                      border: `2px solid ${COLORS.farolCarga}40`,
                    }}
                  >
                    {/* Círculo do número */}
                    <div 
                      className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 relative z-10"
                      style={{ 
                        backgroundColor: COLORS.farolCarga,
                        boxShadow: `0 0 20px ${COLORS.farolCarga}50`
                      }}
                    >
                      <span 
                        className="text-lg font-bold"
                        style={{ color: COLORS.chaoFabrica }}
                      >
                        {marco.id}
                      </span>
                    </div>

                    {/* Ícone */}
                    <div className="flex justify-center mb-3">
                      <marco.icon 
                        className="w-8 h-8" 
                        style={{ color: COLORS.farolCarga }}
                      />
                    </div>

                    {/* Título */}
                    <h3 
                      className="text-sm font-bold mb-1 line-clamp-2"
                      style={{ color: COLORS.luzGalpao }}
                    >
                      {marco.title}
                    </h3>

                    {/* Subtitle */}
                    <p 
                      className="text-xs line-clamp-1"
                      style={{ color: COLORS.acoIndustrial }}
                    >
                      {marco.subtitle}
                    </p>

                    {/* Indicador de clique */}
                    <div 
                      className="mt-4 flex items-center justify-center gap-1 text-xs font-medium opacity-70 group-hover:opacity-100 transition-opacity"
                      style={{ color: COLORS.farolCarga }}
                    >
                      <span>Ver detalhes</span>
                      <ChevronRight className="w-4 h-4" />
                    </div>

                    {/* Glow effect on hover */}
                    <div 
                      className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                      style={{ 
                        boxShadow: `inset 0 0 30px ${COLORS.farolCarga}20, 0 0 30px ${COLORS.farolCarga}20`,
                      }}
                    />
                  </button>

                  {/* Seta conectora (apenas entre marcos em desktop) */}
                  {index < MARCOS.length - 1 && (
                    <div className="hidden md:block absolute top-1/2 -right-2 transform -translate-y-1/2 z-20">
                      <ChevronRight 
                        className="w-5 h-5"
                        style={{ color: COLORS.farolCarga }}
                      />
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </div>

          {/* Nota explicativa */}
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mt-10 text-sm max-w-2xl mx-auto"
            style={{ color: COLORS.acoIndustrial }}
          >
            Cada marco representa uma etapa crucial na jornada de crescimento do seu negócio. 
            Clique em cada um para entender em detalhes o que acontece em cada fase.
          </motion.p>
        </div>
      </section>

      {/* Modal de detalhes do Marco */}
      <AnimatePresence>
        {selectedMarco && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4"
            style={{ backgroundColor: 'rgba(0,0,0,0.9)' }}
            onClick={() => setSelectedMarco(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-4xl h-[90vh] rounded-2xl overflow-hidden"
              style={{ backgroundColor: COLORS.chaoFabrica }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Botão fechar */}
              <button
                onClick={() => setSelectedMarco(null)}
                className="absolute top-4 right-4 z-20 p-2 rounded-full transition-colors"
                style={{ 
                  backgroundColor: `${COLORS.farolCarga}20`,
                  color: COLORS.luzGalpao 
                }}
              >
                <X className="w-6 h-6" />
              </button>

              {/* Imagem do marco */}
              <div className="w-full h-full overflow-y-auto overscroll-contain">
                <img 
                  src={selectedMarco.image} 
                  alt={`Marco ${selectedMarco.id} - ${selectedMarco.title}`}
                  className="block w-full h-auto"
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
