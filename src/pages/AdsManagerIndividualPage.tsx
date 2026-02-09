import { useParams } from 'react-router-dom';
import { useRef, useEffect, useState } from 'react';
import MainLayout from '@/layouts/MainLayout';
import { useAuth } from '@/contexts/AuthContext';
import { AdsManagerProvider } from '@/contexts/AdsManagerContext';
import { Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Calendar, FileText, CheckSquare, Users, AlertCircle, UserPlus, Flag, Wrench, Gift, Quote, ChevronLeft, ChevronRight, UserX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import AdsReunioesSection from '@/components/ads-manager/AdsReunioesSection';
import AdsDocumentacaoSection from '@/components/ads-manager/AdsDocumentacaoSection';
import AdsTarefasSection from '@/components/ads-manager/AdsTarefasSection';
import AdsAcompanhamentoSection from '@/components/ads-manager/AdsAcompanhamentoSection';
import AdsJustificativaSection from '@/components/ads-manager/AdsJustificativaSection';
import AdsNovoClienteSection from '@/components/ads-manager/AdsNovoClienteSection';
import AdsOnboardingSection from '@/components/ads-manager/AdsOnboardingSection';
import AdsFerramentasSection from '@/components/ads-manager/AdsFerramentasSection';
import AdsBonusSection from '@/components/ads-manager/AdsBonusSection';
import AdsLemasSection from '@/components/ads-manager/AdsLemasSection';
import AdsChurnSection from '@/components/ads-manager/AdsChurnSection';
import AdsMovimentacaoNotification from '@/components/ads-manager/AdsMovimentacaoNotification';
import AdsTaskDelayModal from '@/components/AdsTaskDelayModal';

// Cores vibrantes para cada seção - Ordem definida pelo usuário
const COLUMNS = [{
  id: 'reunioes',
  title: 'Reuniões',
  icon: Calendar,
  headerClass: 'section-header-blue',
  iconColor: 'text-white'
}, {
  id: 'documentacao',
  title: 'Documentação',
  icon: FileText,
  headerClass: 'section-header-purple',
  iconColor: 'text-white'
}, {
  id: 'tarefas-diarias',
  title: 'Tarefas Diárias',
  icon: CheckSquare,
  headerClass: 'section-header-green',
  iconColor: 'text-white'
}, {
  id: 'tarefas-semanais',
  title: 'Tarefas Semanais',
  icon: CheckSquare,
  headerClass: 'section-header-yellow',
  iconColor: 'text-foreground'
}, {
  id: 'acompanhamento',
  title: 'Acompanhamento',
  icon: Users,
  headerClass: 'section-header-orange',
  iconColor: 'text-white'
}, {
  id: 'justificativa',
  title: 'Justificativa',
  icon: AlertCircle,
  headerClass: 'section-header-danger',
  iconColor: 'text-white'
}, {
  id: 'novo-cliente',
  title: 'Novo Cliente',
  icon: UserPlus,
  headerClass: 'section-header-green',
  iconColor: 'text-white'
}, {
  id: 'churn',
  title: 'Churns',
  icon: UserX,
  headerClass: 'section-header-danger',
  iconColor: 'text-white'
}, {
  id: 'ferramentas',
  title: 'Ferramentas PRO+',
  icon: Wrench,
  headerClass: 'section-header-purple',
  iconColor: 'text-white'
}, {
  id: 'bonus',
  title: 'Bônus Millennials',
  icon: Gift,
  headerClass: 'section-header-yellow',
  iconColor: 'text-foreground'
}, {
  id: 'lemas',
  title: 'Lemas',
  icon: Quote,
  headerClass: 'section-header-orange',
  iconColor: 'text-white'
}];
const ONBOARDING_SECTION = {
  id: 'onboarding',
  title: 'Onboarding',
  icon: Flag,
  headerClass: 'section-header-yellow',
  iconColor: 'text-foreground'
};
export default function AdsManagerIndividualPage() {
  const {
    userId
  } = useParams<{
    userId: string;
  }>();
  const {
    user,
    isCEO,
    isAdminUser
  } = useAuth();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  // Fetch the manager's profile
  const {
    data: managerProfile,
    isLoading
  } = useQuery({
    queryKey: ['manager-profile', userId],
    queryFn: async () => {
      if (!userId) return null;
      const {
        data,
        error
      } = await supabase.from('profiles').select('user_id, name').eq('user_id', userId).single();
      if (error) throw error;
      return data;
    },
    enabled: !!userId
  });
  const checkScrollButtons = () => {
    const container = scrollContainerRef.current;
    if (container) {
      setCanScrollLeft(container.scrollLeft > 0);
      setCanScrollRight(container.scrollLeft < container.scrollWidth - container.clientWidth - 10);
    }
  };
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener('scroll', checkScrollButtons);
      checkScrollButtons();
      return () => container.removeEventListener('scroll', checkScrollButtons);
    }
  }, []);

  // Access control: CEO, Admin, or the manager themselves
  const allowedRoles = ['gestor_ads', 'sucesso_cliente', 'gestor_projetos', 'ceo'];
  const canAccess = user?.role && allowedRoles.includes(user.role);
  if (!canAccess && !isCEO && !isAdminUser) {
    return <Navigate to="/" replace />;
  }
  const scroll = (direction: 'left' | 'right') => {
    const container = scrollContainerRef.current;
    if (container) {
      const scrollAmount = 380;
      container.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };
  const renderColumnContent = (columnId: string) => {
    switch (columnId) {
      case 'reunioes':
        return <AdsReunioesSection />;
      case 'documentacao':
        return <AdsDocumentacaoSection />;
      case 'tarefas-diarias':
        return <AdsTarefasSection type="daily" />;
      case 'tarefas-semanais':
        return <AdsTarefasSection type="weekly" />;
      case 'acompanhamento':
        return <AdsAcompanhamentoSection />;
      case 'justificativa':
        return <AdsJustificativaSection role="gestor_ads" />;
      case 'novo-cliente':
        return <AdsNovoClienteSection />;
      case 'churn':
        return <AdsChurnSection />;
      case 'ferramentas':
        return <AdsFerramentasSection />;
      case 'bonus':
        return <AdsBonusSection />;
      case 'lemas':
        return <AdsLemasSection />;
      default:
        return null;
    }
  };
  if (isLoading) {
    return <MainLayout>
        <div className="flex items-center justify-center h-full">
          <div className="animate-pulse text-muted-foreground">Carregando...</div>
        </div>
      </MainLayout>;
  }
  const managerName = managerProfile?.name || 'Gestor';

  // Wrap with AdsManagerProvider to pass the target userId to all hooks
  return <AdsManagerProvider targetUserId={userId}>
      <MainLayout>
        {/* Modal de justificativa para tarefas atrasadas */}
        <AdsTaskDelayModal />
        
        {/* Notificação de movimentação pendente - ativa às 16:30 */}
        <AdsMovimentacaoNotification />
        
        <div className="h-full flex flex-col overflow-hidden bg-background">
          {/* Header - Minimalista Apple */}
          <div className="px-8 py-6 border-b border-subtle shrink-0">
          <h1 className="text-display text-foreground">
            Gestor de ADS ({managerName})
          </h1>
          <p className="text-caption text-muted-foreground mt-1">Central de operações individual </p>
        </div>

        {/* Board Container */}
        <div className="flex-1 relative overflow-hidden">
          {/* Scroll Buttons - Discretos */}
          {canScrollLeft && <Button variant="ghost" size="icon" className="absolute left-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-card shadow-apple-hover border border-subtle hover:bg-muted" onClick={() => scroll('left')}>
              <ChevronLeft size={18} className="text-muted-foreground" />
            </Button>}
          {canScrollRight && <Button variant="ghost" size="icon" className="absolute right-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-card shadow-apple-hover border border-subtle hover:bg-muted" onClick={() => scroll('right')}>
              <ChevronRight size={18} className="text-muted-foreground" />
            </Button>}

          {/* Scrollable Container */}
          <div ref={scrollContainerRef} className="h-full overflow-x-auto overflow-y-hidden px-8 py-6 scrollbar-apple">
            <div className="flex gap-6 h-full pb-4" style={{
              minWidth: 'max-content'
            }}>
              {/* Colunas antes do Onboarding (1-8) */}
              {COLUMNS.slice(0, 8).map(column => {
                const Icon = column.icon;
                return <div key={column.id} className="w-[340px] flex-shrink-0 flex flex-col bg-card rounded-2xl border border-subtle overflow-hidden shadow-apple">
                    <div className={`section-header ${column.headerClass}`}>
                      <div className="flex items-center gap-3">
                        <Icon size={18} className={column.iconColor} />
                        <h2 className="font-semibold">{column.title}</h2>
                      </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 scrollbar-apple bg-card">
                      {renderColumnContent(column.id)}
                    </div>
                  </div>;
              })}

              {/* Onboarding Section - Posição 8 */}
              <div className="flex-shrink-0 flex flex-col">
                <div className={`section-header ${ONBOARDING_SECTION.headerClass} rounded-t-xl`}>
                  <div className="flex items-center gap-3">
                    <Flag size={18} className={ONBOARDING_SECTION.iconColor} />
                    <h2 className="font-semibold">{ONBOARDING_SECTION.title}</h2>
                  </div>
                </div>
                <div className="flex-1 overflow-x-auto overflow-y-hidden bg-muted/30 rounded-b-2xl border border-subtle border-t-0 p-4">
                  <AdsOnboardingSection />
                </div>
              </div>

              {/* Colunas após o Onboarding: Ferramentas, Bônus, Lemas */}
              {COLUMNS.slice(8).map(column => {
                const Icon = column.icon;
                return <div key={column.id} className="w-[340px] flex-shrink-0 flex flex-col bg-card rounded-2xl border border-subtle overflow-hidden shadow-apple">
                    <div className={`section-header ${column.headerClass}`}>
                      <div className="flex items-center gap-3">
                        <Icon size={18} className={column.iconColor} />
                        <h2 className="font-semibold">{column.title}</h2>
                      </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 scrollbar-apple bg-card">
                      {renderColumnContent(column.id)}
                    </div>
                  </div>;
              })}
            </div>
          </div>
          </div>
        </div>
      </MainLayout>
    </AdsManagerProvider>;
}