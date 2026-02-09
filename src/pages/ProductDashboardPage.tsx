import { useParams } from 'react-router-dom';
import MainLayout from '@/layouts/MainLayout';
import { motion } from 'framer-motion';
import { 
  LayoutDashboard, 
  TrendingUp, 
  Users, 
  ArrowUpRight, 
  Rocket,
  BarChart3,
  Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

// Map product slugs to display names
const PRODUCT_NAMES: Record<string, string> = {
  'millennials-growth': 'Millennials Growth',
  'millennials-outbound': 'Millennials Outbound',
  'on-demand': 'ON Demand',
  'zydon': 'Zydon',
  'torque-crm': 'Torque CRM',
  'millennials-academy': 'Millennials Academy',
  'growth-club': 'Growth Club',
  'millennials-connect': 'Millennials Connect',
  'millennials-play': 'Millennials Play',
};

export default function ProductDashboardPage() {
  const { productSlug } = useParams<{ productSlug: string }>();
  const navigate = useNavigate();
  
  const productName = productSlug ? PRODUCT_NAMES[productSlug] || productSlug : 'Produto';

  // Redirect Millennials Growth to its dedicated dashboard
  if (productSlug === 'millennials-growth') {
    navigate('/millennials-growth', { replace: true });
    return null;
  }

  return (
    <MainLayout>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
        <div className="max-w-6xl mx-auto px-6 py-16">
          {/* Hero */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center space-y-6 mb-16"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, type: "spring" }}
              className="inline-flex items-center justify-center p-4 rounded-2xl bg-gradient-to-br from-primary/20 to-amber-500/20 mb-4"
            >
              <LayoutDashboard className="h-12 w-12 text-primary" />
            </motion.div>
            
            <h1 className="text-4xl md:text-5xl font-bold text-slate-900 tracking-tight">
              Dashboard <span className="text-primary">{productName}</span>
            </h1>
            
            <p className="text-lg text-slate-500 max-w-2xl mx-auto">
              Central de métricas e indicadores do produto. Em breve você terá acesso a dados consolidados de performance.
            </p>
          </motion.div>

          {/* Coming Soon Cards */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12"
          >
            {[
              { 
                icon: TrendingUp, 
                title: 'Faturamento', 
                description: 'MRR, ARR e crescimento mensal',
                color: 'from-emerald-500/20 to-teal-500/20',
                iconColor: 'text-emerald-500'
              },
              { 
                icon: Users, 
                title: 'Clientes', 
                description: 'Ativos, onboarding e churns',
                color: 'from-blue-500/20 to-cyan-500/20',
                iconColor: 'text-blue-500'
              },
              { 
                icon: BarChart3, 
                title: 'Performance', 
                description: 'Health score e satisfação',
                color: 'from-purple-500/20 to-pink-500/20',
                iconColor: 'text-purple-500'
              },
            ].map((item, index) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + index * 0.1 }}
                className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-8 hover:shadow-lg hover:border-primary/30 transition-all duration-300"
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${item.color} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
                <div className="relative z-10">
                  <div className="p-3 rounded-xl bg-slate-100 group-hover:bg-white/80 transition-colors inline-block mb-4">
                    <item.icon className={`h-7 w-7 ${item.iconColor}`} />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">{item.title}</h3>
                  <p className="text-sm text-slate-500">{item.description}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>

          {/* Coming Soon Banner */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.6 }}
            className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-10 text-center"
          >
            {/* Background decoration */}
            <div className="absolute inset-0 overflow-hidden">
              <div className="absolute top-0 left-1/4 w-64 h-64 bg-primary/20 rounded-full blur-3xl" />
              <div className="absolute bottom-0 right-1/4 w-48 h-48 bg-amber-500/20 rounded-full blur-3xl" />
            </div>
            
            <div className="relative z-10 space-y-6">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/20 text-primary text-sm font-medium">
                <Rocket className="h-4 w-4" />
                Em Desenvolvimento
              </div>
              
              <h2 className="text-2xl md:text-3xl font-bold text-white">
                Dashboard completo em breve
              </h2>
              
              <p className="text-slate-400 max-w-lg mx-auto">
                Estamos trabalhando para trazer métricas detalhadas, gráficos interativos e insights 
                personalizados para o produto {productName}.
              </p>

              <div className="flex items-center justify-center gap-4 pt-4">
                <Button 
                  onClick={() => navigate(-1)}
                  variant="outline"
                  className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                >
                  Voltar
                </Button>
                <Button 
                  onClick={() => navigate(`/clientes/${productSlug}`)}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  Ver Clientes
                  <ArrowUpRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>
          </motion.div>

          {/* Features Preview */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="mt-16 text-center"
          >
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-6">
              Funcionalidades Planejadas
            </h3>
            <div className="flex flex-wrap items-center justify-center gap-3">
              {[
                'Gráficos de MRR',
                'Funil de Onboarding',
                'Taxa de Churn',
                'Health Score',
                'NPS por Produto',
                'Margem Líquida'
              ].map((feature) => (
                <span
                  key={feature}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-slate-100 text-slate-600 text-sm"
                >
                  <Zap className="h-3 w-3 text-primary" />
                  {feature}
                </span>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </MainLayout>
  );
}
